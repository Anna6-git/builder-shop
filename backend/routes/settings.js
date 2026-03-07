"use strict";

const express = require("express");
const router = express.Router();
const db = require("../db");
const auth = require("../middleware/auth");

function getSetting(key) {
  return new Promise((resolve, reject) => {
    db.get(
      "SELECT value FROM settings WHERE key = ? LIMIT 1",
      [key],
      (err, row) => {
        if (err) return reject(err);
        resolve(row ? row.value : null);
      }
    );
  });
}

function setSetting(key, value) {
  return new Promise((resolve, reject) => {
    db.run(
      `INSERT INTO settings (key, value)
       VALUES (?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
      [key, value],
      function (err) {
        if (err) return reject(err);
        resolve(true);
      }
    );
  });
}

router.get("/", async (_req, res) => {
  try {
    const slidesRaw = await getSetting("slides");
    const homeInfoCardsRaw = await getSetting("homeInfoCards");

    res.json({
      slides: slidesRaw ? JSON.parse(slidesRaw) : [],
      homeInfoCards: homeInfoCardsRaw ? JSON.parse(homeInfoCardsRaw) : []
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post("/", auth, async (req, res) => {
  try {
    const body = req.body || {};

    if (body.slides !== undefined) {
      await setSetting(
        "slides",
        JSON.stringify(Array.isArray(body.slides) ? body.slides : [])
      );
    }

    if (body.homeInfoCards !== undefined) {
      await setSetting(
        "homeInfoCards",
        JSON.stringify(Array.isArray(body.homeInfoCards) ? body.homeInfoCards : [])
      );
    }

    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;