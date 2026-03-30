(function () {
  const isLocal =
    location.hostname === "localhost" ||
    location.hostname === "127.0.0.1";

  window.API_BASE = isLocal
    ? "http://localhost:3001"
    : "https://builder-shop-production.up.railway.app";
})();