"use strict";

const express = require("express");
const router = express.Router();

const db = require("../db");
const auth = require("../middleware/auth");

function expectedOrderKey() {
  return (
    process.env.ORDER_WEBHOOK_KEY ||
    process.env.ORDER_KEY ||
    "some_long_random_string"
  );
}

function ensureTables(cb) {
  db.serialize(() => {
    db.run(
      `CREATE TABLE IF NOT EXISTS order_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_id INTEGER NOT NULL,
        product_id INTEGER NOT NULL,
        qty REAL NOT NULL,
        FOREIGN KEY (order_id) REFERENCES orders(id),
        FOREIGN KEY (product_id) REFERENCES products(id)
      );`
    );
    cb();
  });
}

// POST /api/orders (публічно, але захищено ключем)
router.post("/", (req, res) => {
  const key = req.headers["x-order-key"];
  if (!key || key !== expectedOrderKey()) {
    return res.status(403).json({ error: "Forbidden" });
  }

  const body = req.body || {};
  const customer_name = String(body.customer_name || "").trim();
  const customer_phone = String(body.customer_phone || "").trim();
  const city = String(body.city || "").trim();
  const address = String(body.address || "").trim();
  const note = String(body.note || "").trim();
  const delivery_date = String(body.delivery_date || "").trim();
  const delivery_time = String(body.delivery_time || "").trim();
  const items = Array.isArray(body.items) ? body.items : [];

  if (!customer_name || !customer_phone || !city || !address) {
    return res.status(400).json({ error: "customer_name, customer_phone, city, address required" });
  }
  if (!delivery_date || !delivery_time) {
    return res.status(400).json({ error: "delivery_date and delivery_time required" });
  }
  if (!items.length) {
    return res.status(400).json({ error: "items required" });
  }

  for (const it of items) {
    const pid = Number(it.product_id);
    const qty = Number(it.qty);
    if (!Number.isInteger(pid) || !Number.isFinite(qty) || qty <= 0) {
      return res.status(400).json({ error: "invalid items format" });
    }
  }

  ensureTables(() => {
    // ✅ перевірка зайнятого часу
    db.get(
      `SELECT id FROM orders WHERE delivery_date = ? AND delivery_time = ? LIMIT 1`,
      [delivery_date, delivery_time],
      (eBusy, busyRow) => {
        if (eBusy) return res.status(500).json({ error: eBusy.message });
        if (busyRow) return res.status(409).json({ error: "Цей час зайнятий. Оберіть інший." });

        db.serialize(() => {
          db.run("BEGIN TRANSACTION");

          db.run(
            `INSERT INTO orders (customerName, phone, address, itemsJson, total, status, created_at, delivery_date, delivery_time)
             VALUES (?, ?, ?, ?, ?, 'new', datetime('now'), ?, ?)`,
            [
              customer_name,
              customer_phone,
              `${city}, ${address}`,
              JSON.stringify(items),
              0,
              delivery_date,
              delivery_time,
            ],
            function (err) {
              if (err) {
                db.run("ROLLBACK");
                return res.status(500).json({ error: err.message });
              }

              const orderId = this.lastID;

              let left = items.length;
              let failed = false;

              const rollback = (status, payload) => {
                if (failed) return;
                failed = true;
                db.run("ROLLBACK", () => res.status(status).json(payload));
              };

              const commit = () => {
                if (failed) return;
                db.run("COMMIT", (e2) => {
                  if (e2) return res.status(500).json({ error: e2.message });
                  return res.json({ ok: true, id: orderId });
                });
              };

              items.forEach((it) => {
                const pid = Number(it.product_id);
                const qty = Number(it.qty);

                db.get("SELECT id, stock_qty FROM products WHERE id = ? LIMIT 1", [pid], (eGet, row) => {
                  if (eGet) return rollback(500, { error: eGet.message });
                  if (!row) return rollback(400, { error: `product ${pid} not found` });

                  const stock = Number(row.stock_qty);
                  if (!Number.isFinite(stock) || stock < qty) {
                    return rollback(400, { error: `not enough stock for product ${pid}` });
                  }

                  db.run(
                    "INSERT INTO order_items (order_id, product_id, qty) VALUES (?, ?, ?)",
                    [orderId, pid, qty],
                    (eIns) => {
                      if (eIns) return rollback(500, { error: eIns.message });

                      db.run(
                        "UPDATE products SET stock_qty = stock_qty - ? WHERE id = ?",
                        [qty, pid],
                        (eUpd) => {
                          if (eUpd) return rollback(500, { error: eUpd.message });

                          left -= 1;
                          if (left === 0) commit();
                        }
                      );
                    }
                  );
                });
              });
            }
          );
        });
      }
    );
  });
});

// GET /api/orders (список) — тільки для адміна
router.get("/", auth, (req, res) => {
  db.all(
    `SELECT id, customerName, phone, address, status, created_at, delivery_date, delivery_time
     FROM orders
     ORDER BY id DESC`,
    [],
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(rows);
    }
  );
});

// GET /api/orders/:id (деталі + items) — тільки для адміна
router.get("/:id", auth, (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: "invalid id" });

  db.get(
    `SELECT id, customerName, phone, address, status, created_at, delivery_date, delivery_time
     FROM orders WHERE id = ? LIMIT 1`,
    [id],
    (e1, order) => {
      if (e1) return res.status(500).json({ error: e1.message });
      if (!order) return res.status(404).json({ error: "not found" });

      db.all(
        `SELECT oi.product_id, oi.qty, p.name, p.price
         FROM order_items oi
         LEFT JOIN products p ON p.id = oi.product_id
         WHERE oi.order_id = ?`,
        [id],
        (e2, items) => {
          if (e2) return res.status(500).json({ error: e2.message });
          res.json({ ...order, items });
        }
      );
    }
  );
});

module.exports = router;