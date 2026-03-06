"use strict";

const express = require("express");
const path = require("path");
const fs = require("fs");
const multer = require("multer");
const auth = require("../middleware/auth");

const router = express.Router();

const uploadDir = path.join(__dirname, "..", "uploads");
fs.mkdirSync(uploadDir, { recursive: true });

function safeName(name) {
  return String(name || "file")
    .replace(/\.[^/.]+$/, "")
    .replace(/[^a-zA-Z0-9_-]+/g, "_")
    .slice(0, 60);
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname || "").toLowerCase() || ".jpg";
    cb(null, `${Date.now()}_${safeName(file.originalname)}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ok = /^image\/(png|jpe?g|webp|gif)$/i.test(file.mimetype || "");
    if (!ok) return cb(new Error("Only image files are allowed"));
    cb(null, true);
  },
});

router.post("/upload", auth, upload.single("image"), (req, res) => {
  if (!req.file) return res.status(400).json({ error: "Image required" });

  const base =
    (process.env.PUBLIC_BASE_URL || "").trim() ||
    `http://localhost:${process.env.PORT || 3001}`;

  const url = `${base.replace(/\/$/, "")}/uploads/${req.file.filename}`;
  res.json({
    ok: true,
    filename: req.file.filename,
    url,
  });
});

module.exports = router;