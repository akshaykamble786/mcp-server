const { getBasePool, manualDatabases } = require("../db");

module.exports = async function listDatabases() {
  const pool = getBasePool();
  const [rows] = await pool.query("SHOW DATABASES");

  const discoveredDatabases = rows
    .map((row) => Object.values(row)[0])
    .filter((name) => typeof name === "string");

  return [...new Set([...discoveredDatabases, ...manualDatabases])];
};
