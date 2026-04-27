const mysql = require("mysql2/promise");

const baseConfig = {
  host: process.env.MYSQL_HOST || "localhost",
  user: process.env.MYSQL_USER || "root",
  password: process.env.MYSQL_PASSWORD || "",
};

const defaultDatabase = process.env.MYSQL_DATABASE || "expensemgt";
const manualDatabases = ["communication_centre", "csproductionsupport", "salesiq-new"];
const supportedDatabases = [...new Set([defaultDatabase, ...manualDatabases].filter(Boolean))];
const pools = new Map();
let basePool;

function getBasePool() {
  if (!basePool) {
    basePool = mysql.createPool(baseConfig);
  }

  return basePool;
}

function getPool(database = defaultDatabase) {
  if (!database) {
    throw new Error("A database name is required");
  }

  if (!pools.has(database)) {
    pools.set(
      database,
      mysql.createPool({
        ...baseConfig,
        database,
      }),
    );
  }

  return pools.get(database);
}

function isQualifiedName(name) {
  return typeof name === "string" && name.includes(".");
}

function splitQualifiedName(name) {
  if (!isQualifiedName(name)) {
    return null;
  }

  const [database, table] = String(name).split(".", 2);

  if (!database || !table) {
    return null;
  }

  return { database, table };
}

async function findDatabaseForTable(table, databases = supportedDatabases) {
  const candidates = [...new Set((databases || []).filter(Boolean))];

  for (const database of candidates) {
    const pool = getPool(database);
    const [rows] = await pool.query("SHOW TABLES LIKE ?", [table]);

    if (rows.length > 0) {
      return database;
    }
  }

  return null;
}

module.exports = {
  getBasePool,
  getPool,
  defaultDatabase,
  manualDatabases,
  supportedDatabases,
  isQualifiedName,
  splitQualifiedName,
  findDatabaseForTable,
};
