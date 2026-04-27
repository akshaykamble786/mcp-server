const { getPool, defaultDatabase, supportedDatabases } = require("../db");

module.exports = async function getSchema({ database } = {}) {
  const requestedDatabase = database || defaultDatabase;

  if (!requestedDatabase) {
    throw new Error("A database name is required");
  }

  const databaseNames = database ? [requestedDatabase] : supportedDatabases;
  const schema = {};

  for (const dbName of databaseNames) {
    const pool = getPool(dbName);
    const [tables] = await pool.query("SHOW TABLES");
    const tableSchemas = {};

    for (const row of tables) {
      const tableName = Object.values(row)[0];
      const [columns] = await pool.query(`DESCRIBE ${pool.escapeId(tableName)}`);
      tableSchemas[tableName] = columns;
    }

    schema[dbName] = tableSchemas;
  }

  return schema;
};
