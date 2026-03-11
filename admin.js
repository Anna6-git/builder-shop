const API_BASE = window.API_BASE || "http://localhost:3001";

/* ===================== AUTH + API ===================== */
function getToken() {
  return localStorage.getItem("admin_token") || "";
}

function authHeaders() {
  const t = getToken();
  return t ? { Authorization: `Bearer ${t}` } : {};
}

async function api(path, options = {}) {
  const res = await fetch(`${API_BASE}/api${path}`, {
    ...options,
    headers: {
      ...(options.headers || {}),
      ...authHeaders(),
    },
  });

  const ct = res.headers.get("content-type") || "";
  const isJson = ct.includes("application/json");
  const data = isJson ? await res.json().catch(() => null) : await res.text().catch(() => null);

  if (!res.ok) {
    const msg =
      (data && typeof data === "object" && (data.error || data.message)) ||
      (typeof data === "string" ? data : "") ||
      `HTTP ${res.status}`;

    if (res.status === 401) {
  token = "";
  localStorage.removeItem("admin_token");
  localStorage.removeItem("current_user");
}

    throw new Error(msg);
  }

  return data;
}



/* ===================== UI ===================== */
let token = localStorage.getItem("admin_token") || "";

// UI
const loginBox = document.getElementById("loginBox");
const panelBox = document.getElementById("panelBox");
const adminName = document.getElementById("adminName");
const adminPass = document.getElementById("adminPass");
const loginBtn = document.getElementById("loginBtn");
const logoutBtn = document.getElementById("logoutBtn");
const toggleAdminPass = document.getElementById("toggleAdminPass");

const tabCats = document.getElementById("tabCats");
const tabProds = document.getElementById("tabProds");
const catsBox = document.getElementById("catsBox");
const prodsBox = document.getElementById("prodsBox");

// cats
const catName = document.getElementById("catName");
const catIcon = document.getElementById("catIcon");
const addCatBtn = document.getElementById("addCatBtn");
const catsList = document.getElementById("catsList");

// prods
const pTitle = document.getElementById("pTitle");
const pCat = document.getElementById("pCat");
const pBrand = document.getElementById("pBrand");
const pPrice = document.getElementById("pPrice");
const pImg = document.getElementById("pImg");
const pFile = document.getElementById("pFile");
const pUnit = document.getElementById("pUnit");
const pUnitType = document.getElementById("pUnitType");
const pStockQty = document.getElementById("pStockQty");
const pDescription = document.getElementById("pDescription");
const pIsCustomOrder = document.getElementById("pIsCustomOrder");
const pRelatedIds = document.getElementById("pRelatedIds");
const addProductBtn = document.getElementById("addProductBtn");
const prodsList = document.getElementById("prodsList");

// state
let CATEGORIES = [];
let PRODUCTS = [];

function showPanel() {
  loginBox.hidden = true;
  panelBox.hidden = false;
  setTab("cats");
  refreshAll();
}

function showLogin() {
  loginBox.hidden = false;
  panelBox.hidden = true;
}

function setTab(tab) {
  const isCats = tab === "cats";
  tabCats.classList.toggle("tabActive", isCats);
  tabProds.classList.toggle("tabActive", !isCats);
  catsBox.hidden = !isCats;
  prodsBox.hidden = isCats;
}

tabCats?.addEventListener("click", () => setTab("cats"));
tabProds?.addEventListener("click", () => setTab("prods"));

logoutBtn?.addEventListener("click", () => {
  token = "";
  localStorage.removeItem("admin_token");
  localStorage.removeItem("current_user");
  showLogin();
});

toggleAdminPass?.addEventListener("click", () => {
  adminPass.type = adminPass.type === "password" ? "text" : "password";
});

/* ===================== LOGIN ===================== */
loginBtn?.addEventListener("click", async () => {
  const email = adminName.value.trim();
  const password = adminPass.value;
  console.log("LOGIN CLICK ✅");

  if (!email || !password) return alert("Введіть Email і пароль");

  console.log("sending login...", { email, passLen: password.length });

  try {
    const data = await api("/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    if (!data?.token) throw new Error("Токен не отримано");
    if (data?.user) {
  localStorage.setItem("current_user", JSON.stringify(data.user));
}

    token = data.token;
    localStorage.setItem("admin_token", token);
    showPanel();
  } catch (e) {
    alert("Помилка входу: " + e.message);
  }
});

/* ===================== LOAD DATA ===================== */
async function refreshAll() {
  try {
    CATEGORIES = await api("/categories", { method: "GET" });
    PRODUCTS = await api("/products", { method: "GET" });

    renderCats();
    renderCatSelect();
    renderProds();
  } catch (e) {
    alert("Помилка завантаження даних: " + e.message);
  }
}

/* ===================== CATEGORIES ===================== */
addCatBtn?.addEventListener("click", async () => {
  const name = catName.value.trim();
  const icon = catIcon.value.trim();

  if (!name) return alert("Введіть назву категорії");

  try {
    await api("/categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, icon: icon || null }),
    });

    catName.value = "";
    catIcon.value = "";
    await refreshAll();
  } catch (e) {
    alert("Не вдалося додати категорію: " + e.message);
  }
});

function renderCats() {
  const cats = Array.isArray(CATEGORIES) ? CATEGORIES : [];
  catsList.innerHTML = "";

  if (!cats.length) {
    catsList.innerHTML = `<div class="hint">Категорій ще немає.</div>`;
    return;
  }

  cats.forEach((c) => {
    const row = document.createElement("div");
    row.className = "adminRow";
    row.innerHTML = `
      <div style="width:52px;height:52px;display:flex;align-items:center;justify-content:center;font-size:26px;border:1px solid #e5e7eb;border-radius:12px;background:#fff;">
        ${c.icon || "📦"}
      </div>
      <div>
        <div style="font-weight:900">${c.name}</div>
      </div>
      <input type="text" value="${c.icon || ""}" data-field="icon" placeholder="іконка" />
      <button class="btn" data-act="save">Зберегти</button>
      <button class="btnDanger" data-act="del">Видалити</button>
    `;

    row.addEventListener("click", async (e) => {
      const act = e.target?.dataset?.act;
      if (!act) return;

      try {
        if (act === "del") {
          const ok = confirm("Видалити категорію?");
          if (!ok) return;
          await api(`/categories/${c.id}`, { method: "DELETE" });
          await refreshAll();
        }

        if (act === "save") {
          const iconInput = row.querySelector('input[data-field="icon"]');
          await api(`/categories/${c.id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              name: c.name,
              icon: (iconInput.value || "").trim() || null,
            }),
          });
          await refreshAll();
        }
      } catch (err) {
        alert("Помилка категорій: " + err.message);
      }
    });

    catsList.appendChild(row);
  });
}

function renderCatSelect() {
  const cats = Array.isArray(CATEGORIES) ? CATEGORIES : [];
  pCat.innerHTML = "";
  cats.forEach((c) => {
    const opt = document.createElement("option");
    opt.value = String(c.id);
    opt.textContent = c.name;
    pCat.appendChild(opt);
  });
}

/* ===================== PRODUCTS ===================== */
addProductBtn?.addEventListener("click", async () => {
  const title = pTitle.value.trim();
  const catId = Number(pCat.value) || null;
  const brand = pBrand.value.trim();
  const price = Number(pPrice.value);
  let img = (pImg.value || "").trim();

  const unit = (pUnit.value || "").trim() || "шт";
  const unitType = (pUnitType.value || "pcs").trim();
  const stockQty = Number(pStockQty.value || 0);
  const description = (pDescription.value || "").trim();
  const isCustomOrder = Number(pIsCustomOrder.value || 0);

  const relatedIds = (pRelatedIds.value || "")
    .split(",")
    .map((x) => Number(x.trim()))
    .filter(Number.isFinite);

  if (!title) {
    return alert("Введіть назву товару");
  }

  if (!brand) {
    return alert("Введіть виробника");
  }

  if (!Number.isFinite(price) || price <= 0) {
    return alert("Ціна має бути більше 0");
  }

  if (!Number.isFinite(stockQty) || stockQty < 0) {
    return alert("Кількість на складі має бути числом ≥ 0");
  }

  try {
    if (pFile && pFile.files && pFile.files[0]) {
      const fd = new FormData();
      fd.append("image", pFile.files[0]);

      const uploaded = await api("/media/upload", {
        method: "POST",
        body: fd,
      });

      img = uploaded.url || "";
    }

    await api("/products", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title,
        price,
        catId,
        brand,
        img,
        unit,
        unitType,
        stockQty,
        description,
        isActive: 1,
        isCustomOrder,
        relatedIds,
      }),
    });

    pTitle.value = "";
    pBrand.value = "";
    pPrice.value = "";
    pImg.value = "";
    if (pFile) pFile.value = "";
    pUnit.value = "";
    pUnitType.value = "pcs";
    pStockQty.value = "";
    pDescription.value = "";
    pIsCustomOrder.value = "0";
    pRelatedIds.value = "";

    await refreshAll();
  } catch (e) {
    alert("Не вдалося додати товар: " + e.message);
  }
});

function renderProds() {
  const catsMap = new Map((Array.isArray(CATEGORIES) ? CATEGORIES : []).map((c) => [c.id, c]));
  prodsList.innerHTML = "";

  if (!Array.isArray(PRODUCTS) || !PRODUCTS.length) {
    prodsList.innerHTML = `<div class="hint">Товарів ще немає.</div>`;
    return;
  }

  PRODUCTS.forEach((p) => {
    const cat = p.catId ? catsMap.get(p.catId) : null;

    const row = document.createElement("div");
    row.className = "adminRow";
    row.innerHTML = `
      <img src="${p.img || ""}" alt="" onerror="this.style.display='none'">
      <div>
        <div style="font-weight:900">${p.title}</div>
        <div style="font-size:12px;color:#6b7280">
          ${cat ? cat.name : "Без категорії"} • ${p.brand || ""} • ${p.unitType || "pcs"}
          • На складі: ${Number(p.stockQty ?? 0)}
        </div>
      </div>

      <input type="number" value="${p.price}" data-field="price" />
      <input type="number" value="${Number(p.stockQty ?? 0)}" data-field="stockQty" placeholder="qty" />
      <button class="btn" data-act="save">Зберегти</button>
      <button class="btnDanger" data-act="del">Видалити</button>
    `;

    row.addEventListener("click", async (e) => {
      const act = e.target?.dataset?.act;
      if (!act) return;

      try {
        if (act === "del") {
          const ok = confirm("Видалити товар?");
          if (!ok) return;
          await api(`/products/${p.id}`, { method: "DELETE" });
          await refreshAll();
        }

        if (act === "save") {
          const priceInput = row.querySelector('input[data-field="price"]');
          const stockInput = row.querySelector('input[data-field="stockQty"]');

          const newPrice = Number(priceInput.value);
          const newStock = Number(stockInput.value);

          if (!(newPrice > 0)) return alert("Ціна має бути > 0");
          if (!Number.isFinite(newStock) || newStock < 0) return alert("Кількість має бути ≥ 0");

          await api(`/products/${p.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              price: newPrice,
              stockQty: Math.floor(newStock),
            }),
          });

          await refreshAll();
        }
      } catch (err) {
        alert("Помилка товарів: " + err.message);
      }
    });

    prodsList.appendChild(row);
  });
}

/* ===================== INIT ===================== */
(async function init() {
  if (token) {
    try {
      await api("/auth/me", { method: "GET" });
      await refreshAll();
      showPanel();
      return;
    } catch {
      token = "";
      localStorage.removeItem("admin_token");
    }
  }
  showLogin();
})();

;
