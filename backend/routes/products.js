"use strict";

const express = require("express");
const router = express.Router();

const db = require("../db");
const auth = require("../middleware/auth");

function parseRelatedIds(value) {
  if (!value) return [];

  try {
    const arr = JSON.parse(value);
    return Array.isArray(arr)
      ? arr.map(Number).filter(Number.isFinite)
      : [];
  } catch {
    return [];
  }
}

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
    isCustomOrder: row.is_custom_order ? 1 : 0,
    customNotePlaceholder: row.custom_note_placeholder ?? "",
    createdAt: row.created_at ?? null,
    updatedAt: row.updated_at ?? null,
    code: row.code ?? "",
    relatedIds: parseRelatedIds(row.related_ids),
  };
}

router.get("/", (_req, res) => {
  db.all(
    `SELECT
       id,
       name,
       price,
       category_id,
       description,
       image_url,
       brand,
       unit,
       unit_type,
       stock_qty,
       is_active,
       is_custom_order,
       custom_note_placeholder,
       created_at,
       updated_at,
       code,
       related_ids
     FROM products
     WHERE is_active = 1
     ORDER BY id DESC`,
    [],
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json((rows || []).map(mapProduct));
    }
  );
});

router.get("/:id", (req, res) => {
  const id = Number(req.params.id);

  if (!Number.isInteger(id)) {
    return res.status(400).json({ error: "invalid id" });
  }

  db.get(
    `SELECT
       id,
       name,
       price,
       category_id,
       description,
       image_url,
       brand,
       unit,
       unit_type,
       stock_qty,
       is_active,
       is_custom_order,
       custom_note_placeholder,
       created_at,
       updated_at,
       code,
       related_ids
     FROM products
     WHERE id = ?
     LIMIT 1`,
    [id],
    (err, row) => {
      if (err) return res.status(500).json({ error: err.message });
      if (!row) return res.status(404).json({ error: "not found" });

      res.json(mapProduct(row));
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

  const stockQtyRaw = b.stockQty ?? b.stock_qty;
  const stock_qty = Number.isFinite(Number(stockQtyRaw))
    ? Number(stockQtyRaw)
    : 0;

  const is_active =
    b.isActive === 0 || b.is_active === 0 ? 0 : 1;

  const is_custom_order =
    b.isCustomOrder === 1 || b.is_custom_order === 1 ? 1 : 0;

  const custom_note_placeholder = String(
    b.customNotePlaceholder || b.custom_note_placeholder || ""
  ).trim();

  const code = String(b.code || "").trim();

  const related_ids = JSON.stringify(
    Array.isArray(b.relatedIds)
      ? b.relatedIds.map(Number).filter(Number.isFinite)
      : []
  );

  if (!name) {
    return res.status(400).json({ error: "title/name required" });
  }

  if (!Number.isFinite(price) || price < 0) {
    return res.status(400).json({ error: "invalid price" });
  }

  if (!Number.isFinite(stock_qty) || stock_qty < 0) {
    return res.status(400).json({ error: "invalid stock_qty" });
  }

  db.run(
    `INSERT INTO products (
      name,
      price,
      category_id,
      description,
      image_url,
      brand,
      unit,
      unit_type,
      stock_qty,
      is_active,
      is_custom_order,
      custom_note_placeholder,
      created_at,
      updated_at,
      code,
      related_ids
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'), ?, ?)`,
    [
      name,
      price,
      category_id,
      description,
      image_url,
      brand,
      unit,
      unit_type,
      stock_qty,
      is_active,
      is_custom_order,
      custom_note_placeholder,
      code,
      related_ids,
    ],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      return res.json({ ok: true, id: this.lastID });
    }
  );
});

router.patch("/:id", auth, (req, res) => {
  const id = Number(req.params.id);

  if (!Number.isInteger(id)) {
    return res.status(400).json({ error: "invalid id" });
  }

  const b = req.body || {};
  const fields = [];
  const values = [];

  const setField = (sql, value) => {
    fields.push(sql);
    values.push(value);
  };

  if (b.title !== undefined || b.name !== undefined) {
    const value = String(b.title ?? b.name).trim();
    if (!value) {
      return res.status(400).json({ error: "title/name cannot be empty" });
    }
    setField("name = ?", value);
  }

  if (b.price !== undefined) {
    const value = Number(b.price);
    if (!Number.isFinite(value) || value < 0) {
      return res.status(400).json({ error: "invalid price" });
    }
    setField("price = ?", value);
  }

  if (b.catId !== undefined || b.category_id !== undefined) {
    setField("category_id = ?", b.catId ?? b.category_id);
  }

  if (b.description !== undefined) {
    setField("description = ?", String(b.description).trim());
  }

  if (b.img !== undefined || b.image_url !== undefined) {
    setField("image_url = ?", String(b.img ?? b.image_url).trim());
  }

  if (b.brand !== undefined) {
    setField("brand = ?", String(b.brand).trim());
  }

  if (b.unit !== undefined) {
    setField("unit = ?", String(b.unit).trim());
  }

  if (b.unitType !== undefined || b.unit_type !== undefined) {
    setField(
      "unit_type = ?",
      String(b.unitType ?? b.unit_type).trim()
    );
  }

  if (b.stockQty !== undefined || b.stock_qty !== undefined) {
    const value = Number(b.stockQty ?? b.stock_qty);
    if (!Number.isFinite(value) || value < 0) {
      return res.status(400).json({ error: "invalid stock_qty" });
    }
    setField("stock_qty = ?", value);
  }

  if (b.isActive !== undefined || b.is_active !== undefined) {
    setField("is_active = ?", (b.isActive ?? b.is_active) ? 1 : 0);
  }

  if (b.isCustomOrder !== undefined || b.is_custom_order !== undefined) {
    setField(
      "is_custom_order = ?",
      (b.isCustomOrder ?? b.is_custom_order) ? 1 : 0
    );
  }

  if (
    b.customNotePlaceholder !== undefined ||
    b.custom_note_placeholder !== undefined
  ) {
    setField(
      "custom_note_placeholder = ?",
      String(b.customNotePlaceholder ?? b.custom_note_placeholder).trim()
    );
  }

  if (b.code !== undefined) {
    setField("code = ?", String(b.code).trim());
  }

  if (b.relatedIds !== undefined) {
    const arr = Array.isArray(b.relatedIds)
      ? b.relatedIds.map(Number).filter(Number.isFinite)
      : [];

    setField("related_ids = ?", JSON.stringify(arr));
  }

  if (!fields.length) {
    return res.status(400).json({ error: "no fields to update" });
  }

  fields.push("updated_at = datetime('now')");
  const sql = `UPDATE products SET ${fields.join(", ")} WHERE id = ?`;
  values.push(id);

  db.run(sql, values, function (err) {
    if (err) return res.status(500).json({ error: err.message });
    return res.json({ ok: true, changes: this.changes });
  });
});

router.delete("/:id", auth, (req, res) => {
  const id = Number(req.params.id);

  if (!Number.isInteger(id)) {
    return res.status(400).json({ error: "invalid id" });
  }

  db.run(
    `UPDATE products
     SET is_active = 0, updated_at = datetime('now')
     WHERE id = ?`,
    [id],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      return res.json({ ok: true, changes: this.changes });
    }
  );
});

module.exports = router;