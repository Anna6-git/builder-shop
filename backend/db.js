"use strict";

const path = require("path");
const fs = require("fs");
const sqlite3 = require("sqlite3").verbose();

const DB_PATH = process.env.DB_PATH || "/data/database.sqlite";

const dbDir = path.dirname(DB_PATH);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

console.log("DB PATH =", DB_PATH);

const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) console.error("❌ SQLite open error:", err.message);
  else console.log("✅ SQLite connected:", DB_PATH);
});

db.serialize(() => {
  db.run("PRAGMA foreign_keys = ON;");
  db.run("PRAGMA journal_mode = WAL;");
  db.run("PRAGMA synchronous = NORMAL;");
});

module.exports = db;