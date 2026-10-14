const { DatabaseSync } = require("node:sqlite");
const { createClient } = require("@libsql/client");
const path = require("path");

const TURSO_URL = "libsql://fb-tool-ngocminhkien.aws-ap-northeast-1.turso.io";
const TURSO_TOKEN = "eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3OTE5NTgxNjksImlkIjoiMDFhMTM5MDYtZmYwMS03MTgxLWJjMjgtZDRlNDU0OGQ1ZTc0Iiwia2lkIjoiODg5bGpHMDBvd2lhMjBIQ1lOUDdjbXF1S3ZEMC0zQ095VU0yYmtLQ0hXUSIsInJpZCI6ImE1ODYxN2EzLTY4NGQtNDIxYi1iNzlkLTU1ODUzMGMyMDMzNSJ9.dd9TP104ZP65RDBemzu4UNfRCGN5k4kcRpyvD5CSVhovhnNACaCy5tX3MpyItSNO2U5Hf0ctXdgX6MnoZvAwCg";

async function main() {
  console.log("Connecting to Turso...");
  const turso = createClient({
    url: TURSO_URL,
    authToken: TURSO_TOKEN,
  });

  const dbPath = path.join(process.cwd(), "data", "app.db");
  const localDb = new DatabaseSync(dbPath);

  // 1. Get all table schemas
  const tableRows = localDb.prepare("SELECT name, sql FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all();
  console.log(`Found ${tableRows.length} tables in local SQLite.`);

  for (const row of tableRows) {
    if (!row.sql) continue;
    console.log(`Migrating table schema: ${row.name}...`);
    try {
      await turso.execute(row.sql);
      console.log(`✓ Table ${row.name} created on Turso.`);
    } catch (err) {
      if (err.message && err.message.includes("already exists")) {
        console.log(`- Table ${row.name} already exists.`);
      } else {
        console.warn(`! Error on ${row.name}:`, err.message);
      }
    }
  }

  // 2. Get all indexes
  const indexRows = localDb.prepare("SELECT name, sql FROM sqlite_master WHERE type='index' AND sql IS NOT NULL").all();
  for (const row of indexRows) {
    if (!row.sql) continue;
    try {
      await turso.execute(row.sql);
      console.log(`✓ Index ${row.name} created.`);
    } catch (err) {
      // ignore already exists
    }
  }

  // 3. Migrate data for key tables
  for (const row of tableRows) {
    const tableName = row.name;
    const records = localDb.prepare(`SELECT * FROM ${tableName}`).all();
    if (records.length === 0) continue;

    console.log(`Migrating ${records.length} records for ${tableName}...`);
    for (const record of records) {
      const keys = Object.keys(record);
      const placeholders = keys.map(() => "?").join(", ");
      const values = keys.map((k) => record[k]);
      const sql = `INSERT OR IGNORE INTO ${tableName} (${keys.join(", ")}) VALUES (${placeholders})`;
      try {
        await turso.execute({ sql, args: values });
      } catch (err) {
        console.warn(`! Row insert error on ${tableName}:`, err.message);
      }
    }
    console.log(`✓ ${tableName} data migrated.`);
  }

  console.log("\nALL SCHEMAS AND DATA MIGRATED TO TURSO SUCCESSFULLY!");
}

main().catch(console.error);
