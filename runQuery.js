const {
  getBasePool,
  getPool,
  supportedDatabases,
  findDatabaseForTable,
  splitQualifiedName,
} = require("../db");

module.exports = async function runQuery({ sql, database } = {}) {
  const normalized = String(sql || "").trim();

  if (!/^(select|show|describe|with)\b/i.test(normalized)) {
    throw new Error("Only read-only SELECT-style queries are allowed");
  }

  if (/[;]|(--\s|\/\*)/i.test(normalized)) {
    throw new Error("Multiple statements and SQL comments are blocked");
  }

  if (/\b(drop|delete|truncate|update|insert|alter|create|grant|revoke)\b/i.test(normalized)) {
    throw new Error("Dangerous queries are blocked");
  }

  const execute = async (pool) => {
    const [rows] = await pool.query(normalized);
    return rows;
  };

  if (database) {
    return execute(getPool(database));
  }

  const basePool = getBasePool();

  try {
    return await execute(basePool);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const needsResolution =
      /no database selected/i.test(message) ||
      /doesn't exist/i.test(message) ||
      /unknown table/i.test(message);

    if (!needsResolution) {
      throw error;
    }

    const tableNames = [...normalized.matchAll(/\b(?:from|join|update|into)\s+([`"]?[\w$]+(?:\.[`"]?[\w$]+)?)/gi)]
      .map((match) => match[1].replace(/[`"]/g, ""));

    for (const name of tableNames) {
      const qualified = splitQualifiedName(name);

      if (qualified?.database) {
        return execute(getPool(qualified.database));
      }

      const resolvedDatabase = await findDatabaseForTable(name, supportedDatabases);

      if (resolvedDatabase) {
        return execute(getPool(resolvedDatabase));
      }
    }

    throw error;
  }
};
