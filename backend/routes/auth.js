"use strict";

const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const router = express.Router();
const db = require("../db");

const JWT_SECRET = process.env.JWT_SECRET || "change_me";

// POST /api/auth/login
router.post("/login", (req, res) => {
  const { email, password } = req.body || {};
  console.log("LOGIN HIT ✅", { email, passLen: (password || "").length });

  if (!email || !password) {
    return res.status(400).json({ error: "email and password required" });
  }

  const emailNorm = String(email).trim().toLowerCase();

  db.get(
    "SELECT id, email, password_hash FROM admins WHERE lower(email)=lower(?) LIMIT 1",
    [emailNorm],
    async (err, admin) => {
      if (err) return res.status(500).json({ error: err.message });
      if (!admin) return res.status(401).json({ error: "Invalid credentials" });

      const ok = await bcrypt.compare(String(password), String(admin.password_hash));
      if (!ok) return res.status(401).json({ error: "Invalid credentials" });

      const token = jwt.sign(
        { id: admin.id, email: admin.email, role: "admin" },
        JWT_SECRET,
        { expiresIn: "7d" }
      );

      return res.json({
        ok: true,
        token,
        user: { id: admin.id, email: admin.email, role: "admin" },
      });
    }
  );
});

// GET /api/auth/me
router.get("/me", (req, res) => {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) return res.status(401).json({ error: "No token" });

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    return res.json({ ok: true, user: payload });
  } catch {
    return res.status(401).json({ error: "Invalid token" });
  }
});

module.exports = router;
