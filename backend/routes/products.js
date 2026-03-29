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

function normalizeVariants(raw) {
  if (!Array.isArray(raw)) return [];

  return raw
    .map((item, index) => {
      const label = String(item?.label || "").trim();
      const price = Number(item?.price);
      const stockQty = Number(item?.stockQty ?? item?.stock_qty ?? 0);

      return {
        label,
        price,
        stockQty,
        sortOrder: Number.isFinite(Number(item?.sortOrder))
          ? Number(item.sortOrder)
          : index,
      };
    })
    .filter(
      (v) =>
        v.label &&
        Number.isFinite(v.price) &&
        v.price >= 0 &&
        Number.isFinite(v.stockQty) &&
        v.stockQty >= 0
    );
}

function mapProduct(row, variants = []) {
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
    variants,
  };
}

function loadVariantsByProductIds(productIds, cb) {
  const ids = Array.isArray(productIds)
    ? productIds.map(Number).filter(Number.isFinite)
    : [];

  if (!ids.length) return cb(null, new Map());

  const placeholders = ids.map(() => "?").join(",");

  db.all(
    `SELECT id, product_id, label, price, stock_qty, sort_order
     FROM product_variants
     WHERE product_id IN (${placeholders})
     ORDER BY product_id ASC, sort_order ASC, id ASC`,
    ids,
    (err, rows) => {
      if (err) return cb(err);

      const map = new Map();

      for (const row of rows || []) {
        const pid = Number(row.product_id);
        if (!map.has(pid)) map.set(pid, []);

        map.get(pid).push({
          id: Number(row.id),
          label: row.label ?? "",
          price: Number(row.price ?? 0),
          stockQty: Number(row.stock_qty ?? 0),
          sortOrder: Number(row.sort_order ?? 0),
        });
      }

      cb(null, map);
    }
  );
}

function replaceVariants(productId, variants, cb) {
  db.run(`DELETE FROM product_variants WHERE product_id = ?`, [productId], (delErr) => {
    if (delErr) return cb(delErr);

    if (!variants.length) return cb(null);

    let left = variants.length;
    let failed = false;

    variants.forEach((variant, index) => {
      db.run(
        `INSERT INTO product_variants (product_id, label, price, stock_qty, sort_order)
         VALUES (?, ?, ?, ?, ?)`,
        [
          productId,
          variant.label,
          variant.price,
          variant.stockQty,
          Number.isFinite(variant.sortOrder) ? variant.sortOrder : index,
        ],
        (insErr) => {
          if (failed) return;

          if (insErr) {
            failed = true;
            return cb(insErr);
          }

          left -= 1;
          if (left === 0) cb(null);
        }
      );
    });
  });
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

      const ids = (rows || []).map((r) => Number(r.id));

      loadVariantsByProductIds(ids, (varErr, variantsMap) => {
        if (varErr) return res.status(500).json({ error: varErr.message });

        res.json(
          (rows || []).map((row) =>
            mapProduct(row, variantsMap.get(Number(row.id)) || [])
          )
        );
      });
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

      loadVariantsByProductIds([id], (varErr, variantsMap) => {
        if (varErr) return res.status(500).json({ error: varErr.message });

        res.json(mapProduct(row, variantsMap.get(id) || []));
      });
    }
  );
});

router.post("/", auth, (req, res) => {
  const b = req.body || {};

  const name = String(b.title || b.name || "").trim();
  const category_id = b.catId ?? b.category_id ?? null;
  const description = String(b.description || "").trim();
  const image_url = String(b.img || b.image_url || "").trim();
  const brand = String(b.brand || "").trim();
  const is_active = b.isActive === 0 || b.is_active === 0 ? 0 : 1;
  const is_custom_order = b.isCustomOrder === 1 || b.is_custom_order === 1 ? 1 : 0;
  const custom_note_placeholder = String(
    b.customNotePlaceholder || b.custom_note_placeholder || ""
  ).trim();
  const code = String(b.code || "").trim();

  const related_ids = JSON.stringify(
    Array.isArray(b.relatedIds)
      ? b.relatedIds.map(Number).filter(Number.isFinite)
      : []
  );

  const variants = normalizeVariants(b.variants);

  if (!name) {
    return res.status(400).json({ error: "title/name required" });
  }

  if (!variants.length) {
    return res.status(400).json({ error: "variants required" });
  }

  const firstVariant = variants[0];
  const totalStock = variants.reduce((sum, v) => sum + Number(v.stockQty || 0), 0);

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
      firstVariant.price,
      category_id,
      description,
      image_url,
      brand,
      firstVariant.label,
      "variant",
      totalStock,
      is_active,
      is_custom_order,
      custom_note_placeholder,
      code,
      related_ids,
    ],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });

      const productId = this.lastID;

      replaceVariants(productId, variants, (varErr) => {
        if (varErr) return res.status(500).json({ error: varErr.message });
        return res.json({ ok: true, id: productId });
      });
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

  if (b.isActive !== undefined || b.is_active !== undefined) {
    const v = Number(b.isActive ?? b.is_active) === 0 ? 0 : 1;
    setField("is_active = ?", v);
  }

  if (b.isCustomOrder !== undefined || b.is_custom_order !== undefined) {
    const v = Number(b.isCustomOrder ?? b.is_custom_order) === 1 ? 1 : 0;
    setField("is_custom_order = ?", v);
  }

  if (b.customNotePlaceholder !== undefined || b.custom_note_placeholder !== undefined) {
    setField(
      "custom_note_placeholder = ?",
      String(b.customNotePlaceholder ?? b.custom_note_placeholder).trim()
    );
  }

  if (b.code !== undefined) {
    setField("code = ?", String(b.code).trim());
  }

  if (b.relatedIds !== undefined) {
    const related_ids = JSON.stringify(
      Array.isArray(b.relatedIds)
        ? b.relatedIds.map(Number).filter(Number.isFinite)
        : []
    );
    setField("related_ids = ?", related_ids);
  }

  const variantsProvided = b.variants !== undefined;
  const variants = variantsProvided ? normalizeVariants(b.variants) : [];

  if (variantsProvided && !variants.length) {
    return res.status(400).json({ error: "variants required" });
  }

  if (variantsProvided) {
    const firstVariant = variants[0];
    const totalStock = variants.reduce((sum, v) => sum + Number(v.stockQty || 0), 0);

    setField("price = ?", firstVariant.price);
    setField("unit = ?", firstVariant.label);
    setField("unit_type = ?", "variant");
    setField("stock_qty = ?", totalStock);
  }

  fields.push("updated_at = datetime('now')");

  const sqlValues = [];
  fields.forEach((field, idx) => {
    if (!field.includes("datetime('now')")) {
      sqlValues.push(values[idx]);
    }
  });

  const sql = `UPDATE products SET ${fields.join(", ")} WHERE id = ?`;
  sqlValues.push(id);

  db.run(sql, sqlValues, function (err) {
    if (err) return res.status(500).json({ error: err.message });
    if (!this.changes) return res.status(404).json({ error: "not found" });

    if (!variantsProvided) {
      return res.json({ ok: true });
    }

    replaceVariants(id, variants, (varErr) => {
      if (varErr) return res.status(500).json({ error: varErr.message });
      return res.json({ ok: true });
    });
  });
});

router.delete("/:id", auth, (req, res) => {
  const id = Number(req.params.id);

  if (!Number.isInteger(id)) {
    return res.status(400).json({ error: "invalid id" });
  }

  db.serialize(() => {
    db.run(`DELETE FROM product_variants WHERE product_id = ?`, [id], (varErr) => {
      if (varErr) return res.status(500).json({ error: varErr.message });

      db.run(`DELETE FROM products WHERE id = ?`, [id], function (err) {
        if (err) return res.status(500).json({ error: err.message });
        if (!this.changes) return res.status(404).json({ error: "not found" });

        return res.json({ ok: true });
      });
    });
  });
});

module.exports = router;