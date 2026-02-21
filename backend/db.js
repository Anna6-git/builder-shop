"use strict";

const path = require("path");
const sqlite3 = require("sqlite3").verbose();

// Render persistent disk часто монтують як /var/data
const DB_PATH = process.env.DB_PATH || path.join(__dirname, "database.sqlite");

console.log("DB PATH =", DB_PATH);

const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) console.error("❌ SQLite open error:", err.message);
  else console.log("✅ SQLite connected:", DB_PATH);
});

// ✅ корисні налаштування SQLite
db.serialize(() => {
  db.run("PRAGMA foreign_keys = ON;");
  db.run("PRAGMA journal_mode = WAL;");
  db.run("PRAGMA synchronous = NORMAL;");
});

module.exports = db;
