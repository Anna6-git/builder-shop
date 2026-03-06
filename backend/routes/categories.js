"use strict";

const express = require("express");
const router = express.Router();
const db = require("../db");
const auth = require("../middleware/auth");

function mapCategory(row) {
  return {
    id: row.id,
    name: row.name ?? "",
    icon: row.icon ?? "",
    img: row.image_url ?? "",
    order: Number(row.display_order ?? 9999),
  };
}

router.get("/", (_req, res) => {
  db.all(
    `SELECT id, name, icon, image_url, display_order
     FROM categories
     ORDER BY COALESCE(display_order, 9999), id DESC`,
    [],
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message || String(err) });
      res.json(rows.map(mapCategory));
    }
  );
});

router.post("/", auth, (req, res) => {
  const { name, icon, img, image_url, order, display_order } = req.body || {};
  const categoryName = String(name || "").trim();
  const categoryIcon = String(icon || "").trim() || null;
  const categoryImg = String(img || image_url || "").trim() || null;
  const categoryOrder = Number.isFinite(Number(order ?? display_order))
    ? Number(order ?? display_order)
    : 9999;

  if (!categoryName) return res.status(400).json({ error: "Name required" });

  db.run(
    `INSERT INTO categories (name, icon, image_url, display_order)
     VALUES (?, ?, ?, ?)`,
    [categoryName, categoryIcon, categoryImg, categoryOrder],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ ok: true, id: this.lastID });
    }
  );
});

router.put("/:id", auth, (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: "Invalid id" });

  const { name, icon, img, image_url, order, display_order } = req.body || {};
  const categoryName = String(name || "").trim();
  const categoryIcon = String(icon || "").trim() || null;
  const categoryImg = String(img || image_url || "").trim() || null;
  const categoryOrder = Number.isFinite(Number(order ?? display_order))
    ? Number(order ?? display_order)
    : 9999;

  if (!categoryName) return res.status(400).json({ error: "Name required" });

  db.run(
    `UPDATE categories
     SET name = ?, icon = ?, image_url = ?, display_order = ?
     WHERE id = ?`,
    [categoryName, categoryIcon, categoryImg, categoryOrder, id],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ ok: true, changes: this.changes });
    }
  );
});

router.patch("/:id", auth, (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: "Invalid id" });

  const b = req.body || {};
  const fields = [];
  const values = [];

  const set = (sql, val) => {
    fields.push(sql);
    values.push(val);
  };

  if (b.name !== undefined) set("name = ?", String(b.name).trim());
  if (b.icon !== undefined) set("icon = ?", String(b.icon).trim() || null);
  if (b.img !== undefined || b.image_url !== undefined) {
    set("image_url = ?", String(b.img ?? b.image_url).trim() || null);
  }
  if (b.order !== undefined || b.display_order !== undefined) {
    set("display_order = ?", Number(b.order ?? b.display_order) || 9999);
  }

  if (!fields.length) return res.status(400).json({ error: "No fields to update" });

  const sql = `UPDATE categories SET ${fields.join(", ")} WHERE id = ?`;
  values.push(id);

  db.run(sql, values, function (err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ ok: true, changes: this.changes });
  });
});

// ВАЖЛИВО: видаляємо товари категорії, потім саму категорію
router.delete("/:id", auth, (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: "Invalid id" });

  db.serialize(() => {
    db.run("BEGIN TRANSACTION");

    db.run("DELETE FROM products WHERE category_id = ?", [id], function (e1) {
      if (e1) {
        db.run("ROLLBACK");
        return res.status(500).json({ error: e1.message });
      }

      db.run("DELETE FROM categories WHERE id = ?", [id], function (e2) {
        if (e2) {
          db.run("ROLLBACK");
          return res.status(500).json({ error: e2.message });
        }

        db.run("COMMIT", (e3) => {
          if (e3) return res.status(500).json({ error: e3.message });
          res.json({ ok: true, deletedCategoryId: id });
        });
      });
    });
  });
});

module.exports = router;