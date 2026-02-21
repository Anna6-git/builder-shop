"use strict";

const express = require("express");
const router = express.Router();

const db = require("../db");
const auth = require("../middleware/auth");

function mapProduct(row) {
  return {
    id: row.id,
    title: row.name ?? "",
    price: Number(row.price ?? 0),
    catId: row.category_id ?? null,
    description: row.description ?? "",
    img: row.image_url ?? "",
    brand: row.brand ?? "",
    unit: row.unit ?? "шт",
    unitType: row.unit_type ?? "pcs",
    stockQty: Number(row.stock_qty ?? 0),
    isActive: row.is_active ? 1 : 0,
    createdAt: row.created_at ?? null,
    updatedAt: row.updated_at ?? null,
  };
}

router.get("/", (req, res) => {
  db.all(
    `SELECT id, name, price, category_id, description, image_url, brand, unit, unit_type,
            stock_qty, is_active, created_at, updated_at
     FROM products
     WHERE is_active = 1
     ORDER BY id DESC`,
    [],
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(rows.map(mapProduct));
    }
  );
});

router.post("/", auth, (req, res) => {
  const b = req.body || {};
  const name = String(b.title || b.name || "").trim();
  const price = Number(b.price);
  const category_id = b.catId ?? b.category_id ?? null;
  const description = String(b.description || "").trim();
  const image_url = String(b.img || b.image_url || "").trim();
  const brand = String(b.brand || "").trim();
  const unit = String(b.unit || "шт").trim();
  const unit_type = String(b.unitType || b.unit_type || "pcs").trim();
  const stock_qty = Number.isFinite(Number(b.stockQty ?? b.stock_qty)) ? Number(b.stockQty ?? b.stock_qty) : 0;
  const is_active = b.isActive === 0 || b.is_active === 0 ? 0 : 1;

  if (!name) return res.status(400).json({ error: "title/name required" });
  if (!Number.isFinite(price) || price < 0) return res.status(400).json({ error: "invalid price" });

  db.run(
    `INSERT INTO products (name, price, category_id, description, image_url, brand, unit, unit_type, stock_qty, is_active, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
    [name, price, category_id, description, image_url, brand, unit, unit_type, stock_qty, is_active],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ ok: true, id: this.lastID });
    }
  );
});

router.patch("/:id", auth, (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: "invalid id" });

  const b = req.body || {};
  const fields = [];
  const values = [];

  const set = (sql, val) => { fields.push(sql); values.push(val); };

  if (b.title !== undefined || b.name !== undefined) set("name = ?", String(b.title ?? b.name).trim());
  if (b.price !== undefined) set("price = ?", Number(b.price));
  if (b.catId !== undefined || b.category_id !== undefined) set("category_id = ?", b.catId ?? b.category_id);
  if (b.description !== undefined) set("description = ?", String(b.description).trim());
  if (b.img !== undefined || b.image_url !== undefined) set("image_url = ?", String(b.img ?? b.image_url).trim());
  if (b.brand !== undefined) set("brand = ?", String(b.brand).trim());
  if (b.unit !== undefined) set("unit = ?", String(b.unit).trim());
  if (b.unitType !== undefined || b.unit_type !== undefined) set("unit_type = ?", String(b.unitType ?? b.unit_type).trim());
  if (b.stockQty !== undefined || b.stock_qty !== undefined) set("stock_qty = ?", Number(b.stockQty ?? b.stock_qty));
  if (b.isActive !== undefined || b.is_active !== undefined) set("is_active = ?", (b.isActive ?? b.is_active) ? 1 : 0);

  if (!fields.length) return res.status(400).json({ error: "no fields to update" });

  fields.push("updated_at = datetime('now')");
  const sql = `UPDATE products SET ${fields.join(", ")} WHERE id = ?`;
  values.push(id);

  db.run(sql, values, function (err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ ok: true, changes: this.changes });
  });
});

router.delete("/:id", auth, (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: "invalid id" });

  db.run("DELETE FROM products WHERE id = ?", [id], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ ok: true, changes: this.changes });
  });
});

module.exports = router;