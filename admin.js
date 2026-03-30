"use strict";

const API_BASE = window.API_BASE || "http://localhost:3001";

/* ===================== AUTH + API ===================== */
function getToken() {
  return localStorage.getItem("admin_token") || "";
}

function authHeaders() {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
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
  const data = isJson
    ? await res.json().catch(() => null)
    : await res.text().catch(() => null);

  if (!res.ok) {
    const msg =
      (data && typeof data === "object" && (data.error || data.message)) ||
      (typeof data === "string" ? data : "") ||
      `HTTP ${res.status}`;

    if (res.status === 401) {
      localStorage.removeItem("admin_token");
      localStorage.removeItem("current_user");
      if (typeof showLogin === "function") showLogin();
    }

    throw new Error(msg);
  }

  return data;
}

/* ===================== HELPERS ===================== */
function escapeAttr(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function parseLooseNumber(value) {
  const raw = String(value ?? "").trim().replace(",", ".");
  if (!raw) return NaN;
  const n = Number(raw);
  return Number.isFinite(n) ? n : NaN;
}

/* ===================== UI ===================== */
// auth
const loginBox = document.getElementById("loginBox");
const panelBox = document.getElementById("panelBox");
const adminName = document.getElementById("adminName");
const adminPass = document.getElementById("adminPass");
const loginBtn = document.getElementById("loginBtn");
const logoutBtn = document.getElementById("logoutBtn");
const toggleAdminPass = document.getElementById("toggleAdminPass");

// tabs
const tabCats = document.getElementById("tabCats");
const tabProds = document.getElementById("tabProds");
const catsBox = document.getElementById("catsBox");
const prodsBox = document.getElementById("prodsBox");

// categories
const catName = document.getElementById("catName");
const catIcon = document.getElementById("catIcon");
const addCatBtn = document.getElementById("addCatBtn");
const catsList = document.getElementById("catsList");

// products
const pTitle = document.getElementById("pTitle");
const pCat = document.getElementById("pCat");
const pCatList = document.getElementById("pCatList");
const pBrand = document.getElementById("pBrand");
const pImg = document.getElementById("pImg");
const pFile = document.getElementById("pFile");
const pDescription = document.getElementById("pDescription");
const pIsCustomOrder = document.getElementById("pIsCustomOrder");
const pRelatedIds = document.getElementById("pRelatedIds");
const addProductBtn = document.getElementById("addProductBtn");
const prodsList = document.getElementById("prodsList");

const variantRows = document.getElementById("variantRows");
const addVariantRowBtn = document.getElementById("addVariantRowBtn");

/* ===================== STATE ===================== */
let CATEGORIES = [];
let PRODUCTS = [];

/* ===================== VARIANTS FORM ===================== */
function createVariantRow(label = "", price = "", stockQty = "") {
  const row = document.createElement("div");
  row.className = "variantRow";
  row.style.display = "grid";
  row.style.gridTemplateColumns = "1.2fr 1fr 1fr auto";
  row.style.gap = "8px";
  row.style.marginBottom = "8px";

  row.innerHTML = `
    <input class="searchInput" data-field="label" placeholder="Фасування (напр. 0.9кг)" value="${escapeAttr(label)}">
    <input class="searchInput" data-field="price" placeholder="Ціна" type="number" step="0.01" min="0" value="${escapeAttr(price)}">
    <input class="searchInput" data-field="stockQty" placeholder="Кількість" type="number" step="0.1" min="0" value="${escapeAttr(stockQty)}">
    <button class="btnDanger" type="button" data-act="removeVariant">×</button>
  `;

  row.addEventListener("click", (e) => {
    if (e.target?.dataset?.act !== "removeVariant") return;

    row.remove();

    if (!variantRows.children.length) {
      variantRows.appendChild(createVariantRow());
    }
  });

  return row;
}

function collectVariantsFromForm() {
  const rows = Array.from(variantRows.querySelectorAll(".variantRow"));

  return rows
    .map((row, index) => {
      const labelRaw = row.querySelector('[data-field="label"]')?.value ?? "";
      const priceRaw = row.querySelector('[data-field="price"]')?.value ?? "";
      const stockRaw = row.querySelector('[data-field="stockQty"]')?.value ?? "";

      const label = String(labelRaw).trim();
      const price = parseLooseNumber(priceRaw);
      const stockQty = parseLooseNumber(stockRaw);

      const isEmpty = !label && !String(priceRaw).trim() && !String(stockRaw).trim();
      if (isEmpty) return null;

      return {
        label,
        price,
        stockQty,
        sortOrder: index,
      };
    })
    .filter(Boolean);
}

function resetVariantsForm() {
  if (!variantRows) return;
  variantRows.innerHTML = "";
  variantRows.appendChild(createVariantRow());
}

/* ===================== UI STATE ===================== */
function showPanel() {
  if (loginBox) loginBox.hidden = true;
  if (panelBox) panelBox.hidden = false;
  setTab("cats");
  refreshAll();
}

function showLogin() {
  if (loginBox) loginBox.hidden = false;
  if (panelBox) panelBox.hidden = true;
}

function setTab(tab) {
  const isCats = tab === "cats";

  tabCats?.classList.toggle("tabActive", isCats);
  tabProds?.classList.toggle("tabActive", !isCats);

  if (catsBox) catsBox.hidden = !isCats;
  if (prodsBox) prodsBox.hidden = isCats;
}

tabCats?.addEventListener("click", () => setTab("cats"));
tabProds?.addEventListener("click", () => setTab("prods"));

addVariantRowBtn?.addEventListener("click", () => {
  variantRows?.appendChild(createVariantRow());
});

logoutBtn?.addEventListener("click", () => {
  localStorage.removeItem("admin_token");
  localStorage.removeItem("current_user");
  showLogin();
});

toggleAdminPass?.addEventListener("click", () => {
  if (!adminPass) return;
  adminPass.type = adminPass.type === "password" ? "text" : "password";
});

/* ===================== LOGIN ===================== */
loginBtn?.addEventListener("click", async () => {
  const email = adminName?.value.trim() || "";
  const password = adminPass?.value || "";

  if (!email || !password) {
    alert("Введіть Email і пароль");
    return;
  }

  try {
    const data = await api("/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    if (!data?.token) {
      throw new Error("Токен не отримано");
    }

    localStorage.setItem("admin_token", data.token);

    if (data?.user) {
      localStorage.setItem("current_user", JSON.stringify(data.user));
    }

    showPanel();
  } catch (e) {
    alert("Помилка входу: " + e.message);
  }
});

/* ===================== LOAD DATA ===================== */
async function refreshAll() {
  try {
    const [cats, prods] = await Promise.all([
      api("/categories", { method: "GET" }),
      api("/products", { method: "GET" }),
    ]);

    CATEGORIES = Array.isArray(cats) ? cats : [];
    PRODUCTS = Array.isArray(prods) ? prods : [];

    localStorage.setItem("categories_db", JSON.stringify(CATEGORIES));
    localStorage.setItem("products_db", JSON.stringify(PRODUCTS));

    renderCats();
    renderCatSelect();
    renderProds();
  } catch (e) {
    alert("Помилка завантаження даних: " + e.message);
  }
}

/* ===================== CATEGORIES ===================== */
addCatBtn?.addEventListener("click", async () => {
  const name = catName?.value.trim() || "";
  const icon = catIcon?.value.trim() || "";

  if (!name) {
    alert("Введіть назву категорії");
    return;
  }

  try {
    await api("/categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, icon: icon || null }),
    });

    if (catName) catName.value = "";
    if (catIcon) catIcon.value = "";

    await refreshAll();
  } catch (e) {
    alert("Не вдалося додати категорію: " + e.message);
  }
});

function renderCats() {
  if (!catsList) return;
  catsList.innerHTML = "";

  if (!CATEGORIES.length) {
    catsList.innerHTML = `<div class="hint">Категорій ще немає.</div>`;
    return;
  }

  CATEGORIES.forEach((c) => {
    const row = document.createElement("div");
    row.className = "adminRow";
    row.innerHTML = `
      <div style="width:52px;height:52px;display:flex;align-items:center;justify-content:center;font-size:26px;border:1px solid #e5e7eb;border-radius:12px;background:#fff;">
        ${c.icon || "📦"}
      </div>
      <div>
        <div style="font-weight:900">${c.name}</div>
      </div>
      <input type="text" value="${escapeAttr(c.icon || "")}" data-field="icon" placeholder="іконка" />
      <button class="btn" data-act="save" type="button">Зберегти</button>
      <button class="btnDanger" data-act="del" type="button">Видалити</button>
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
          return;
        }

        if (act === "save") {
          const iconInput = row.querySelector('[data-field="icon"]');

          await api(`/categories/${c.id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              name: c.name,
              icon: String(iconInput?.value || "").trim() || null,
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
  if (!pCatList) return;
  pCatList.innerHTML = "";

  CATEGORIES.forEach((c) => {
    const opt = document.createElement("option");
    opt.value = c.name;
    pCatList.appendChild(opt);
  });
}

/* ===================== PRODUCTS ===================== */
addProductBtn?.addEventListener("click", async () => {
  const title = pTitle?.value.trim() || "";
  const catText = String(pCat?.value || "").trim();
  const matchedCat = CATEGORIES.find(
    (c) => String(c.name || "").trim().toLowerCase() === catText.toLowerCase()
  );
  const catId = matchedCat ? Number(matchedCat.id) : null;

  const brand = pBrand?.value.trim() || "";
  let img = String(pImg?.value || "").trim();
  const description = String(pDescription?.value || "").trim();
  const isCustomOrder = Number(pIsCustomOrder?.value || 0);
  const variants = collectVariantsFromForm();

  const relatedIds = String(pRelatedIds?.value || "")
    .split(",")
    .map((x) => Number(x.trim()))
    .filter(Number.isFinite);

  if (!title) {
    alert("Введіть назву товару");
    return;
  }

  if (!catId) {
    alert("Оберіть категорію зі списку");
    return;
  }

  if (!brand) {
    alert("Введіть виробника");
    return;
  }

  if (!variants.length) {
    alert("Додай хоча б одне фасування");
    return;
  }

  for (const v of variants) {
    if (!v.label) {
      alert("У кожного фасування має бути назва, наприклад 0.9кг");
      return;
    }

    if (!Number.isFinite(v.price) || v.price <= 0) {
      alert(`Для фасування "${v.label}" ціна має бути більше 0`);
      return;
    }

    if (!Number.isFinite(v.stockQty) || v.stockQty < 0) {
      alert(`Для фасування "${v.label}" кількість має бути числом ≥ 0`);
      return;
    }
  }

  try {
    if (pFile?.files?.[0]) {
      const fd = new FormData();
      fd.append("image", pFile.files[0]);

      const uploaded = await api("/media/upload", {
        method: "POST",
        body: fd,
      });

      img = uploaded?.url || "";
    }

    await api("/products", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title,
        catId,
        brand,
        img,
        description,
        isActive: 1,
        isCustomOrder,
        relatedIds,
        variants,
      }),
    });

    if (pTitle) pTitle.value = "";
    if (pCat) pCat.value = "";
    if (pBrand) pBrand.value = "";
    if (pImg) pImg.value = "";
    if (pFile) pFile.value = "";
    if (pDescription) pDescription.value = "";
    if (pIsCustomOrder) pIsCustomOrder.value = "0";
    if (pRelatedIds) pRelatedIds.value = "";

    resetVariantsForm();
    await refreshAll();
  } catch (e) {
    alert("Не вдалося додати товар: " + e.message);
  }
});

function renderProds() {
  if (!prodsList) return;

  const catsMap = new Map(CATEGORIES.map((c) => [Number(c.id), c]));
  prodsList.innerHTML = "";

  if (!PRODUCTS.length) {
    prodsList.innerHTML = `<div class="hint">Товарів ще немає.</div>`;
    return;
  }

  PRODUCTS.forEach((p) => {
    const cat = p.catId ? catsMap.get(Number(p.catId)) : null;

    const row = document.createElement("div");
    row.className = "adminRow";

    const variantsText =
      Array.isArray(p.variants) && p.variants.length
        ? p.variants
            .map(
              (v) =>
                `${v.label}: ${Number(v.price).toFixed(2)} ₴ • склад: ${Number(v.stockQty ?? 0)}`
            )
            .join("<br>")
        : "Фасування не задані";

    row.innerHTML = `
      <img src="${escapeAttr(p.img || "")}" alt="" onerror="this.style.display='none'">
      <div>
        <div style="font-weight:900">${p.title || ""}</div>
        <div style="font-size:12px;color:#6b7280">
          ${cat ? cat.name : "Без категорії"} • ${p.brand || ""}
        </div>
        <div style="font-size:12px;color:#374151; margin-top:4px;">
          ${variantsText}
        </div>
      </div>

      <button class="btn" data-act="editVariants" type="button">Редагувати фасування</button>
      <button class="btnDanger" data-act="del" type="button">Видалити</button>
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
          return;
        }

        if (act === "editVariants") {
          const currentValue =
            Array.isArray(p.variants) && p.variants.length
              ? p.variants
                  .map((v) => `${v.label}|${v.price}|${v.stockQty ?? 0}`)
                  .join("\n")
              : "";

          const variantsText = prompt(
            "Введи фасування у форматі:\n0.9кг|180|6\n2.8кг|490|3",
            currentValue
          );

          if (variantsText === null) return;

          const variants = String(variantsText)
            .split("\n")
            .map((line) => line.trim())
            .filter(Boolean)
            .map((line, index) => {
              const [labelRaw, priceRaw, stockRaw] = line.split("|");
              return {
                label: String(labelRaw || "").trim(),
                price: parseLooseNumber(priceRaw),
                stockQty: parseLooseNumber(stockRaw),
                sortOrder: index,
              };
            });

          if (!variants.length) {
            alert("Потрібно вказати хоча б одне фасування");
            return;
          }

          for (const v of variants) {
            if (!v.label) {
              alert("У кожного фасування має бути назва");
              return;
            }
            if (!Number.isFinite(v.price) || v.price <= 0) {
              alert(`Невірна ціна для ${v.label}`);
              return;
            }
            if (!Number.isFinite(v.stockQty) || v.stockQty < 0) {
              alert(`Невірна кількість для ${v.label}`);
              return;
            }
          }

          await api(`/products/${p.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ variants }),
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
  resetVariantsForm();

  const token = getToken();
  if (!token) {
    showLogin();
    return;
  }

  try {
    await api("/auth/me", { method: "GET" });
    showPanel();
  } catch {
    localStorage.removeItem("admin_token");
    localStorage.removeItem("current_user");
    showLogin();
  }
})();