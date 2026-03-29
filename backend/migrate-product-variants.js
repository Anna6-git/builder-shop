"use strict";

const db = require("./db");

db.serialize(() => {
  db.run(
    `CREATE TABLE IF NOT EXISTS product_variants (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER NOT NULL,
      label TEXT NOT NULL,
      price REAL NOT NULL,
      stock_qty REAL NOT NULL DEFAULT 0,
      sort_order INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
    )`,
    (err) => {
      if (err) {
        console.error("❌ create product_variants error:", err.message);
        process.exit(1);
      }

      console.log("✅ product_variants table is ready");
      process.exit(0);
    }
  );
});