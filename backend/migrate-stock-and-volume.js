"use strict";
const db = require("./db");

const stmts = [
  // кількість на складі
  `ALTER TABLE products ADD COLUMN stock_qty INTEGER NOT NULL DEFAULT 0`,
  // обʼєм 1 одиниці товару (м³) — для доставки
  `ALTER TABLE products ADD COLUMN volume_m3 REAL`,
  // вага 1 одиниці (кг) — опційно
  `ALTER TABLE products ADD COLUMN weight_kg REAL`,
];

db.serialize(() => {
  let ok = 0;
  stmts.forEach((sql) => {
    db.run(sql, (err) => {
      // якщо колонка вже існує — SQLite дасть помилку, це не страшно
      if (err) console.log("skip:", err.message);
      else ok++;
    });
  });

  db.get("PRAGMA table_info(products)", (err) => {
    if (err) console.error(err.message);
    console.log("✅ migration done");
    process.exit(0);
  });
});
