const {
  getPool,
  defaultDatabase,
  supportedDatabases,
  findDatabaseForTable,
  splitQualifiedName,
} = require("../db");

module.exports = async function getTableInfo({ table, database } = {}) {
  if (!table) {
    throw new Error("A table name is required");
  }

  const qualified = splitQualifiedName(table);
  const resolvedDatabase = qualified?.database || database || (await findDatabaseForTable(table, supportedDatabases)) || defaultDatabase;
  const resolvedTable = qualified?.table || table;

  if (!resolvedDatabase) {
    throw new Error(`Table not found: ${table}`);
  }

  const pool = getPool(resolvedDatabase);
  const [rows] = await pool.query(`DESCRIBE ${pool.escapeId(resolvedTable)}`);
  return rows;
};
