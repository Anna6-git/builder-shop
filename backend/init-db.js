"use strict";

const db = require("./db");

function run(sql) {
  return new Promise((resolve, reject) => {
    db.run(sql, (err) => (err ? reject(err) : resolve()));
  });
}

async function initDb() {
  // categories
  await run(`
    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL
    );
  `);

  // products (мінімальний набір полів)
  await run(`
    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      price REAL NOT NULL DEFAULT 0,
      catId INTEGER,
      img TEXT,
      stockQty INTEGER NOT NULL DEFAULT 0,
      unitType TEXT,
      brand TEXT,
      createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (catId) REFERENCES categories(id)
    );
  `);

  // orders (якщо треба для /api/orders)
  await run(`
    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
      status TEXT DEFAULT 'new',
      customerName TEXT,
      phone TEXT,
      address TEXT,
      itemsJson TEXT,
      total REAL DEFAULT 0
    );
  `);

  console.log("✅ DB initialized (tables ensured)");
}

module.exports = { initDb };