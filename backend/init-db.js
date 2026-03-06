"use strict";

const db = require("./db");
const bcrypt = require("bcryptjs");

function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, (err) => (err ? reject(err) : resolve()));
  });
}

function getOne(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => (err ? reject(err) : resolve(row)));
  });
}

async function initDb() {
  await run(`
    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      icon TEXT,
      image_url TEXT,
      display_order INTEGER DEFAULT 9999
    );
  `);

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
    stock_qty REAL NOT NULL DEFAULT 0,
    is_active INTEGER NOT NULL DEFAULT 1,
    is_custom_order INTEGER NOT NULL DEFAULT 0,
    custom_note_placeholder TEXT DEFAULT '',
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    code TEXT,
    related_ids TEXT DEFAULT '[]',
    FOREIGN KEY (category_id) REFERENCES categories(id)
  );
`);

await run(`ALTER TABLE products ADD COLUMN is_custom_order INTEGER NOT NULL DEFAULT 0;`).catch(() => {});
await run(`ALTER TABLE products ADD COLUMN custom_note_placeholder TEXT DEFAULT '';`).catch(() => {});

  await run(`
    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      created_at TEXT DEFAULT (datetime('now')),
      status TEXT DEFAULT 'new',
      customerName TEXT,
      phone TEXT,
      email TEXT,
      address TEXT,
      itemsJson TEXT,
      total REAL DEFAULT 0,
      delivery_date TEXT,
      note TEXT
    );
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);

  await run(`ALTER TABLE orders ADD COLUMN email TEXT;`).catch(() => {});
  await run(`ALTER TABLE orders ADD COLUMN note TEXT;`).catch(() => {});
  await run(`ALTER TABLE orders ADD COLUMN delivery_date TEXT;`).catch(() => {});
  await run(`ALTER TABLE products ADD COLUMN unit TEXT DEFAULT 'шт';`).catch(() => {});
  await run(`ALTER TABLE products ADD COLUMN unit_type TEXT DEFAULT 'pcs';`).catch(() => {});
  await run(`ALTER TABLE products ADD COLUMN code TEXT;`).catch(() => {});
  await run(`ALTER TABLE products ADD COLUMN related_ids TEXT DEFAULT '[]';`).catch(() => {});
  await run(`ALTER TABLE categories ADD COLUMN icon TEXT;`).catch(() => {});
  await run(`ALTER TABLE categories ADD COLUMN image_url TEXT;`).catch(() => {});
  await run(`ALTER TABLE categories ADD COLUMN display_order INTEGER DEFAULT 9999;`).catch(() => {});

  await run(`
    CREATE TABLE IF NOT EXISTS admins (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    );
  `);

  const anyAdmin = await getOne(`SELECT id FROM admins LIMIT 1`);
  if (!anyAdmin) {
    const email = (process.env.ADMIN_EMAIL || "").trim() || "admin@example.com";
    const pass = (process.env.ADMIN_PASSWORD || "").trim() || "admin12345";
    const hash = await bcrypt.hash(pass, 10);

    await run(
      `INSERT INTO admins (email, password_hash) VALUES (?, ?)`,
      [email, hash]
    );
  }

  const envEmail = (process.env.ADMIN_EMAIL || "").trim();
  const envPass = (process.env.ADMIN_PASSWORD || "").trim();

  if (envEmail && envPass) {
    const hash = await bcrypt.hash(envPass, 10);

    await run(
      `INSERT INTO admins (email, password_hash)
       VALUES (?, ?)
       ON CONFLICT(email) DO UPDATE SET password_hash=excluded.password_hash`,
      [envEmail, hash]
    );
  }

  console.log("✅ DB initialized");
}

module.exports = { initDb };