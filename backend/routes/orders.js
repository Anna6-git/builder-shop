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
        variant_id INTEGER,
        variant_label TEXT,
        qty REAL NOT NULL,
        unit TEXT,
        price REAL NOT NULL DEFAULT 0,
        FOREIGN KEY (order_id) REFERENCES orders(id),
        FOREIGN KEY (product_id) REFERENCES products(id)
      );`,
      (err) => {
        if (err) return cb(err);

        db.run(`ALTER TABLE order_items ADD COLUMN variant_id INTEGER`, () => {
          db.run(`ALTER TABLE order_items ADD COLUMN variant_label TEXT`, () => {
            db.run(`ALTER TABLE order_items ADD COLUMN price REAL NOT NULL DEFAULT 0`, (alterErr) => {
              if (
                alterErr &&
                !String(alterErr.message || "").includes("duplicate column name")
              ) {
                return cb(alterErr);
              }

              cb(null);
            });
          });
        });
      }
    );
  });
}

async function sendOrderEmails(order, itemsDetailed = []) {
  const apiKey = String(process.env.BREVO_API_KEY || "").trim();
  const senderName = String(process.env.BREVO_SENDER_NAME || "БудМаркет").trim();
  const senderEmail = String(process.env.BREVO_SENDER_EMAIL || "").trim();
  const adminEmail = String(
    process.env.ADMIN_NOTIFY_EMAIL || process.env.ADMIN_EMAIL || ""
  ).trim();

  if (!apiKey || !senderEmail) {
    console.warn("Brevo API config missing:", {
      hasApiKey: Boolean(apiKey),
      hasSenderEmail: Boolean(senderEmail),
      hasAdminEmail: Boolean(adminEmail),
    });
    return;
  }

  let total = 0;

  const lines = (itemsDetailed || []).map((it) => {
    const qty = Number(it.qty || 0);
    const price = Number(it.price || 0);
    const rowSum = qty * price;
    total += rowSum;

    return `• ${it.name || "Товар"} — ${qty} ${it.unit || "шт"} × ${price.toFixed(2)} грн = ${rowSum.toFixed(2)} грн`;
  });

  const adminText = [
    `Нове замовлення №${order.id}`,
    ``,
    `Клієнт: ${order.customerName || ""}`,
    `Телефон: ${order.phone || ""}`,
    `Email: ${order.email || ""}`,
    `Адреса: ${order.address || ""}`,
    `Дата доставки: ${order.delivery_date || ""}`,
    `Примітка: ${order.note || "-"}`,
    ``,
    `Товари:`,
    ...lines,
    ``,
    `Сума: ${total.toFixed(2)} грн`,
    `Статус: ${order.status || "new"}`,
  ].join("\n");

  const customerText = [
    `Дякуємо за замовлення в БудМаркет.`,
    ``,
    `Ваше замовлення №${order.id} успішно створено.`,
    `Дата доставки: ${order.delivery_date || ""}`,
    ``,
    `Товари:`,
    ...lines,
    ``,
    `Сума: ${total.toFixed(2)} грн`,
    ``,
    `Ми зв’яжемося з вами найближчим часом.`,
  ].join("\n");

  async function sendViaBrevo({ toEmail, toName, subject, text }) {
    if (!toEmail) return;

    const res = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        accept: "application/json",
        "content-type": "application/json",
        "api-key": apiKey,
      },
      body: JSON.stringify({
        sender: {
          name: senderName,
          email: senderEmail,
        },
        to: [
          {
            email: toEmail,
            name: toName || "",
          },
        ],
        subject,
        textContent: text,
      }),
    });

    const data = await res.text().catch(() => "");

    if (!res.ok) {
      throw new Error(`Brevo HTTP ${res.status}: ${data}`);
    }

    console.log("Brevo email sent:", {
      toEmail,
      subject,
      response: data,
    });
  }

  try {
    if (adminEmail) {
      await sendViaBrevo({
        toEmail: adminEmail,
        toName: "Адміністратор",
        subject: `Нове замовлення №${order.id} — БудМаркет`,
        text: adminText,
      });
    }

    if (order.email) {
      await sendViaBrevo({
        toEmail: order.email,
        toName: order.customerName || "Клієнт",
        subject: `Ваше замовлення №${order.id} — БудМаркет`,
        text: customerText,
      });
    }
  } catch (err) {
    console.error("Brevo send error:", err?.message || err);
  }
}

router.post("/", (req, res) => {
  const key = req.headers["x-order-key"];

  if (!key || key !== expectedOrderKey()) {
    return res.status(403).json({ error: "Forbidden" });
  }

  const body = req.body || {};
  const customer_name = String(body.customer_name || "").trim();
  const customer_phone = String(body.customer_phone || "").trim();
  const customer_email = String(body.customer_email || "").trim();
  const city = String(body.city || "").trim();
  const address = String(body.address || "").trim();
  const note = String(body.note || "").trim();
  const delivery_date = String(body.delivery_date || "").trim();
  const items = Array.isArray(body.items) ? body.items : [];

  if (!customer_name || !city || !address) {
    return res.status(400).json({ error: "customer_name, city, address required" });
  }

  if (!customer_phone || !customer_email) {
    return res.status(400).json({ error: "customer_phone and customer_email required" });
  }

  if (!delivery_date) {
    return res.status(400).json({ error: "delivery_date required" });
  }

  if (!items.length) {
    return res.status(400).json({ error: "items required" });
  }

  for (const it of items) {
    const pid = Number(it.product_id);
    const qty = Number(it.qty);
    const price = Number(it.price);

    if (
      !Number.isInteger(pid) ||
      !Number.isFinite(qty) ||
      qty <= 0 ||
      !Number.isFinite(price) ||
      price < 0
    ) {
      return res.status(400).json({ error: "invalid items format" });
    }
  }

  ensureTables((ensureErr) => {
    if (ensureErr) {
      return res.status(500).json({ error: ensureErr.message });
    }

    db.serialize(() => {
      db.run("BEGIN TRANSACTION");

      db.run(
        `INSERT INTO orders (
          customerName,
          phone,
          email,
          address,
          itemsJson,
          total,
          status,
          created_at,
          delivery_date,
          note
        ) VALUES (?, ?, ?, ?, ?, ?, 'new', datetime('now'), ?, ?)`,
        [
          customer_name,
          customer_phone,
          customer_email,
          `${city}, ${address}`,
          JSON.stringify(items),
          0,
          delivery_date,
          note,
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

            db.all(
              `SELECT oi.product_id, oi.variant_id, oi.variant_label, oi.qty, oi.unit, oi.price, p.name
               FROM order_items oi
               LEFT JOIN products p ON p.id = oi.product_id
               WHERE oi.order_id = ?`,
              [orderId],
              (eItems, itemsDetailed) => {
                if (eItems) {
                  return db.run("COMMIT", () => {
                    res.json({ ok: true, id: orderId });
                  });
                }

                db.get(
                  `SELECT id, customerName, phone, email, address, status, created_at, delivery_date, note
                   FROM orders
                   WHERE id = ?`,
                  [orderId],
                  (eOrder, orderRow) => {
                    db.run("COMMIT", (eCommit) => {
                      if (eCommit) {
                        return res.status(500).json({ error: eCommit.message });
                      }

                      res.json({ ok: true, id: orderId });

                      if (!eOrder && orderRow) {
                        setTimeout(() => {
                          sendOrderEmails(orderRow, itemsDetailed || []).catch((err) => {
                            console.error("Background email error:", err?.message || err);
                          });
                        }, 0);
                      }
                    });
                  }
                );
              }
            );
          };

          items.forEach((it) => {
            const pid = Number(it.product_id);
            const qty = Number(it.qty);
            const unit = String(it.unit || "").trim();
            const price = Number(it.price || 0);
            const variantId = Number(it.variant_id || 0);
            const variantLabel = String(it.variant_label || unit || "").trim();

            db.get(
              "SELECT id, stock_qty, is_custom_order FROM products WHERE id = ? LIMIT 1",
              [pid],
              (eGet, row) => {
                if (eGet) return rollback(500, { error: eGet.message });
                if (!row) return rollback(400, { error: `product ${pid} not found` });

                const stock = Number(row.stock_qty);
                const isCustomOrder = Number(row.is_custom_order || 0) === 1;

                if (!isCustomOrder) {
                  if (!Number.isFinite(stock) || stock < qty) {
                    return rollback(400, { error: `not enough stock for product ${pid}` });
                  }
                }

                db.run(
                  `INSERT INTO order_items (
                    order_id,
                    product_id,
                    variant_id,
                    variant_label,
                    qty,
                    unit,
                    price
                  ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
                  [
                    orderId,
                    pid,
                    variantId || null,
                    variantLabel || null,
                    qty,
                    unit || null,
                    price,
                  ],
                  (eIns) => {
                    if (eIns) return rollback(500, { error: eIns.message });

                    if (isCustomOrder) {
                      left -= 1;
                      if (left === 0) commit();
                      return;
                    }

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
              }
            );
          });
        }
      );
    });
  });
});

router.get("/", auth, (req, res) => {
  const status = String(req.query.status || "all").trim().toLowerCase();

  let sql = `
    SELECT id, customerName, phone, email, address, status, created_at, delivery_date, note
    FROM orders
  `;
  const params = [];

  if (status === "new" || status === "done") {
    sql += ` WHERE status = ? `;
    params.push(status);
  }

  sql += ` ORDER BY id DESC`;

  db.all(sql, params, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows || []);
  });
});

router.get("/:id", auth, (req, res) => {
  const id = Number(req.params.id);

  if (!Number.isInteger(id)) {
    return res.status(400).json({ error: "invalid id" });
  }

  db.get(
    `SELECT id, customerName, phone, email, address, status, created_at, delivery_date, note
     FROM orders
     WHERE id = ?
     LIMIT 1`,
    [id],
    (e1, order) => {
      if (e1) return res.status(500).json({ error: e1.message });
      if (!order) return res.status(404).json({ error: "not found" });

      db.all(
        `SELECT oi.product_id, oi.variant_id, oi.variant_label, oi.qty, oi.unit, oi.price, p.name
         FROM order_items oi
         LEFT JOIN products p ON p.id = oi.product_id
         WHERE oi.order_id = ?`,
        [id],
        (e2, items) => {
          if (e2) return res.status(500).json({ error: e2.message });
          res.json({ ...order, items: items || [] });
        }
      );
    }
  );
});

router.patch("/:id/status", auth, (req, res) => {
  const id = Number(req.params.id);
  const status = String(req.body?.status || "").trim().toLowerCase();

  if (!Number.isInteger(id)) {
    return res.status(400).json({ error: "invalid id" });
  }

  if (!["new", "done"].includes(status)) {
    return res.status(400).json({ error: "invalid status" });
  }

  db.run(
    `UPDATE orders
     SET status = ?
     WHERE id = ?`,
    [status, id],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      if (!this.changes) return res.status(404).json({ error: "not found" });
      res.json({ ok: true });
    }
  );
});

module.exports = router;