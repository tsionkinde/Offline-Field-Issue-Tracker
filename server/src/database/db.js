
const Database = require("better-sqlite3");
const path = require("path");
const fs = require("fs");

// Use a separate database for testing when DB_FILE is provided.
const databasePath =
  process.env.DB_FILE ||
  path.join(__dirname, "../../data/field-issues.db");

// Create the database folder if it does not exist.
const dataDirectory = path.dirname(databasePath);

if (!fs.existsSync(dataDirectory)) {
  fs.mkdirSync(dataDirectory, { recursive: true });
}

// Open or create the SQLite database.
const db = new Database(databasePath);

db.pragma("foreign_keys = ON");

// Create the tables.
db.exec(`
  CREATE TABLE IF NOT EXISTS reports (
    id TEXT PRIMARY KEY,
    category TEXT NOT NULL,
    description TEXT NOT NULL,
    location TEXT NOT NULL,
    priority TEXT NOT NULL
      CHECK(priority IN ('Low', 'Medium', 'High', 'Critical')),
    status TEXT NOT NULL DEFAULT 'Submitted'
      CHECK(status IN (
        'Draft', 'Submitted', 'Assigned',
        'In Progress', 'Resolved', 'Rejected'
      )),
    reported_at TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS activities (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    report_id TEXT NOT NULL,
    event_type TEXT NOT NULL,
    description TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (report_id) REFERENCES reports(id)
  );
`);

module.exports = db;
