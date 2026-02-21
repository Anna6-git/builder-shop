const db = require("./db");

db.serialize(() => {
  db.all(
    "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name",
    [],
    (err, rows) => {
      if (err) {
        console.error("DB error:", err.message);
        process.exit(1);
      }

      console.log("Tables:");
      for (const r of rows) console.log("-", r.name);

      process.exit(0);
    }
  );
});
