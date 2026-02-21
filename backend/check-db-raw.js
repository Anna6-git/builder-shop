const fs = require("fs");
const path = require("path");
const sqlite3 = require("sqlite3").verbose();

// 1) Підбираємо шлях до БД: спочатку uploads/database.sqlite, потім database.sqlite
const candidates = [
  process.env.DB_PATH,
  path.join(__dirname, "uploads", "database.sqlite"),
  path.join(__dirname, "database.sqlite"),
].filter(Boolean);

const dbPath = candidates.find((p) => fs.existsSync(p));

if (!dbPath) {
  console.error("❌ DB file not found. Tried:", candidates);
  process.exit(1);
}

console.log("✅ Using DB:", dbPath);

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error("❌ Cannot open DB:", err.message);
    process.exit(1);
  }
});

db.all(
  "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name",
  [],
  (err, rows) => {
    if (err) {
      console.error("❌ Query error:", err.message);
      db.close(() => process.exit(1));
      return;
    }

    console.log("Tables:");
    for (const r of rows) console.log("-", r.name);

    db.close(() => process.exit(0));
  }
);
