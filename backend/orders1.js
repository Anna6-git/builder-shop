"use strict";

const express = require("express");
const router = express.Router();
const db = require("../db");

// Створення замовлення + списання зі складу
// body: { customer: {...}, items: [{product_id, qty}] }
router.post("/", (req, res) => {
  const { customer, items } = req.body || {};

  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: "items required" });
  }

  // нормалізація
  const clean = items
    .map((it) => ({
      product_id: Number(it.product_id),
      qty: Number(it.qty),
    }))
    .filter((it) => Number.isInteger(it.product_id) && it.product_id > 0 && it.qty > 0);

  if (clean.length === 0) return res.status(400).json({ error: "invalid items" });

  db.serialize(() => {
    db.run("BEGIN IMMEDIATE TRANSACTION");

    // 1) перевірка і списання по кожному товару
    const errors = [];
    let processed = 0;

    clean.forEach((it) => {
      db.run(
        `UPDATE products
         SET stock_qty = stock_qty - ?
         WHERE id = ? AND stock_qty >= ?`,
        [it.qty, it.product_id, it.qty],
        function (err) {
          if (err) errors.push(err.message);
          else if (this.changes === 0) errors.push(`Not enough stock for product ${it.product_id}`);

          processed++;
          if (processed === clean.length) finish();
        }
      );
    });

    function finish() {
      if (errors.length) {
        db.run("ROLLBACK");
        return res.status(409).json({ error: "Stock error", details: errors });
      }

      // 2) створимо таблиці orders / order_items (якщо нема)
      db.run(
        `CREATE TABLE IF NOT EXISTS orders (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          customer_json TEXT,
          created_at TEXT DEFAULT (datetime('now'))
        )`
      );

      db.run(
        `CREATE TABLE IF NOT EXISTS order_items (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          order_id INTEGER NOT NULL,
          product_id INTEGER NOT NULL,
          qty INTEGER NOT NULL,
          FOREIGN KEY(order_id) REFERENCES orders(id) ON DELETE CASCADE
        )`
      );

      // 3) запис замовлення
      db.run(
        `INSERT INTO orders (customer_json) VALUES (?)`,
        [JSON.stringify(customer || {})],
        function (err) {
          if (err) {
            db.run("ROLLBACK");
            return res.status(500).json({ error: err.message });
          }

          const orderId = this.lastID;

          // 4) items
          let done = 0;
          clean.forEach((it) => {
            db.run(
              `INSERT INTO order_items (order_id, product_id, qty) VALUES (?, ?, ?)`,
              [orderId, it.product_id, it.qty],
              (err2) => {
                if (err2) errors.push(err2.message);
                done++;
                if (done === clean.length) finalCommit(orderId, errors);
              }
            );
          });
        }
      );
    }

    function finalCommit(orderId, errors2) {
      if (errors2.length) {
        db.run("ROLLBACK");
        return res.status(500).json({ error: "Order save error", details: errors2 });
      }

      db.run("COMMIT");
      return res.json({ ok: true, order_id: orderId });
    }
  });
});

module.exports = router;
