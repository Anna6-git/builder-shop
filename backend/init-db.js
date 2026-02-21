// backend/init-db.js
"use strict";

const db = require("./db");
const bcrypt = require("bcryptjs");

function run(sql) {
  return new Promise((resolve, reject) => {
    db.run(sql, (err) => (err ? reject(err) : resolve()));
  });
}

function getOne(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => (err ? reject(err) : resolve(row)));
  });
}

function runParams(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) return reject(err);
      resolve(this.lastID);
    });
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

  // ✅ orders
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

  // ✅ admins
  await run(`
    CREATE TABLE IF NOT EXISTS admins (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    );
  `);

  // ✅ seed admin (якщо адмінів ще нема)
  const anyAdmin = await getOne(`SELECT id FROM admins LIMIT 1`);
  if (!anyAdmin) {
    const email = (process.env.ADMIN_EMAIL || "").trim() || "admin@example.com";
    const pass = (process.env.ADMIN_PASSWORD || "").trim() || "admin12345";
    const hash = await bcrypt.hash(pass, 10);

    await runParams(
      `INSERT INTO admins (email, password_hash) VALUES (?, ?)`,
      [email, hash]
    );

    console.log("✅ Admin seeded:", email);
  }

  // ✅ force reset / ensure admin password from ENV (створить або оновить)
  const envEmail = (process.env.ADMIN_EMAIL || "").trim();
  const envPass = (process.env.ADMIN_PASSWORD || "").trim();

  if (envEmail && envPass) {
    const hash = await bcrypt.hash(envPass, 10);

    await runParams(
      `INSERT INTO admins (email, password_hash)
       VALUES (?, ?)
       ON CONFLICT(email) DO UPDATE SET password_hash=excluded.password_hash`,
      [envEmail, hash]
    );

    console.log("✅ Admin password ensured for:", envEmail);
  }

  console.log("✅ DB initialized (tables ensured)");
}

module.exports = { initDb };