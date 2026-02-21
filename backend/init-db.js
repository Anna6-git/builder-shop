// backend/init-db.js
"use strict";

const db = require("./db");

function run(sql) {
  return new Promise((resolve, reject) => {
    db.run(sql, (err) => (err ? reject(err) : resolve()));
  });
}

async function initDb() {
  // ✅ categories
  await run(`
    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL
    );
  `);

  // ✅ products (під routes/products.js)
  await run(`DROP TABLE IF EXISTS products;`);

  await run(`
    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      price REAL NOT NULL DEFAULT 0,
      category_id INTEGER,
      description TEXT,
      image_url TEXT,
      brand TEXT,
      unit TEXT DEFAULT 'шт',
      unit_type TEXT DEFAULT 'pcs',
      stock_qty INTEGER NOT NULL DEFAULT 0,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (category_id) REFERENCES categories(id)
    );
  `);

  // ✅ orders (якщо треба для /api/orders)
  await run(`
    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      created_at TEXT DEFAULT (datetime('now')),
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