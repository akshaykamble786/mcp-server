const readline = require("readline");

const getSchema = require("./tools/getSchema");
const getTableInfo = require("./tools/getTableInfo");
const listDatabases = require("./tools/listDatabases");
const runQuery = require("./tools/runQuery");

const SERVER_NAME = "mariadb-mcp";
const SERVER_VERSION = "1.0.0";
const DEFAULT_PROTOCOL_VERSION = "2025-11-25";

const tools = {
  getSchema,
  getTableInfo,
  listDatabases,
  runQuery,
};

const toolDefinitions = [
  {
    name: "getSchema",
    description: "Get the full database schema.",
    inputSchema: {
      type: "object",
      properties: {
        database: {
          type: "string",
          description: "Optional database name. Defaults to MYSQL_DATABASE or expensemgt, but may also be set to communication_centre or csproductionsupport.",
        },
      },
      required: [],
      additionalProperties: false,
    },
  },
  {
    name: "listDatabases",
    description: "List databases visible to the current MariaDB user.",
    inputSchema: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
  },
  {
    name: "getTableInfo",
    description: "Get the structure of a single table.",
    inputSchema: {
      type: "object",
      properties: {
        table: { type: "string" },
        database: {
          type: "string",
          description: "Optional database name. Defaults to MYSQL_DATABASE or expensemgt, but may also be set to communication_centre or csproductionsupport.",
        },
      },
      required: ["table"],
      additionalProperties: false,
    },
  },
  {
    name: "runQuery",
    description: "Run a read-only SQL query.",
    inputSchema: {
      type: "object",
      properties: {
        sql: { type: "string" },
        database: {
          type: "string",
          description: "Optional database name. Defaults to MYSQL_DATABASE or expensemgt, but may also be set to communication_centre or csproductionsupport.",
        },
      },
      required: ["sql"],
      additionalProperties: false,
    },
  },
];

const rl = readline.createInterface({
  input: process.stdin,
  crlfDelay: Infinity,
});

function send(message) {
  process.stdout.write(`${JSON.stringify(message)}\n`);
}

function sendResult(id, result) {
  send({
    jsonrpc: "2.0",
    id,
    result,
  });
}

function sendError(id, code, message) {
  send({
    jsonrpc: "2.0",
    id,
    error: {
      code,
      message,
    },
  });
}

function toTextResult(value) {
  if (typeof value === "string") {
    return value;
  }

  return JSON.stringify(value, null, 2);
}

async function callTool(name, args) {
  const tool = tools[name];

  if (!tool) {
    throw new Error(`Unknown tool: ${name}`);
  }

  return tool(args);
}

rl.on("line", async (line) => {
  if (!line.trim()) {
    return;
  }

  let req;

  try {
    req = JSON.parse(line);
  } catch {
    sendError(null, -32700, "Parse error");
    return;
  }

  try {
    if (req.method === "initialize") {
      const clientProtocolVersion = req?.params?.protocolVersion;

      sendResult(req.id, {
        protocolVersion: clientProtocolVersion || DEFAULT_PROTOCOL_VERSION,
        capabilities: {
          tools: {
            listChanged: false,
          },
        },
        serverInfo: {
          name: SERVER_NAME,
          version: SERVER_VERSION,
        },
      });
      return;
    }

    if (req.method === "notifications/initialized") {
      return;
    }

    if (req.method === "tools/list") {
      sendResult(req.id, {
        tools: toolDefinitions,
      });
      return;
    }

    if (req.method === "tools/call") {
      const name = req?.params?.name;
      const args = req?.params?.arguments ?? {};
      const result = await callTool(name, args);

      sendResult(req.id, {
        content: [
          {
            type: "text",
            text: toTextResult(result),
          },
        ],
        structuredContent:
          result && typeof result === "object" && !Array.isArray(result)
            ? result
            : undefined,
      });
      return;
    }

    if (req.id !== undefined && req.id !== null) {
      sendError(req.id, -32601, `Method not found: ${req.method}`);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";

    sendResult(req.id ?? null, {
      content: [
        {
          type: "text",
          text: `Error: ${message}`,
        },
      ],
      isError: true,
    });
  }
});
