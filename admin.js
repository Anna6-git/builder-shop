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


// state
let CATEGORIES = [];
let PRODUCTS = [];

function createVariantRow(label = "", price = "", stockQty = "") {
  const row = document.createElement("div");
  row.className = "variantRow";
  row.style.display = "grid";
  row.style.gridTemplateColumns = "1.2fr 1fr 1fr auto";
  row.style.gap = "8px";
  row.style.marginBottom = "8px";

  row.innerHTML = `
    <input class="searchInput" data-field="label" placeholder="Фасування (напр. 0.9кг)" value="${label}">
    <input class="searchInput" data-field="price" placeholder="Ціна" type="number" step="0.01" value="${price}">
    <input class="searchInput" data-field="stockQty" placeholder="Кількість" type="number" step="0.1" value="${stockQty}">
    <button class="btnDanger" type="button" data-act="removeVariant">×</button>
  `;

  row.addEventListener("click", (e) => {
    if (e.target?.dataset?.act === "removeVariant") {
      row.remove();

      if (!variantRows.children.length) {
        variantRows.appendChild(createVariantRow());
      }
    }
  });

  return row;
}

function collectVariantsFromForm() {
  const rows = Array.from(variantRows.querySelectorAll(".variantRow"));

  return rows
    .map((row) => {
      const label = row.querySelector('[data-field="label"]')?.value?.trim() || "";
      const price = Number(row.querySelector('[data-field="price"]')?.value);
      const stockQty = Number(row.querySelector('[data-field="stockQty"]')?.value || 0);

      return { label, price, stockQty };
    })
    .filter((v) => v.label || Number.isFinite(v.price) || Number.isFinite(v.stockQty));
}

function resetVariantsForm() {
  variantRows.innerHTML = "";
  variantRows.appendChild(createVariantRow());
}

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

addVariantRowBtn?.addEventListener("click", () => {
  variantRows.appendChild(createVariantRow());
});

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
  if (!pCatList) return;

  pCatList.innerHTML = "";

  cats.forEach((c) => {
    const opt = document.createElement("option");
    opt.value = c.name;
    pCatList.appendChild(opt);
  });
}

/* ===================== PRODUCTS ===================== */
addProductBtn?.addEventListener("click", async () => {
  const title = pTitle.value.trim();
const catName = (pCat.value || "").trim();
const matchedCat = CATEGORIES.find(
  (c) => String(c.name || "").trim().toLowerCase() === catName.toLowerCase()
);
const catId = matchedCat ? Number(matchedCat.id) : null;
  const brand = pBrand.value.trim();
  let img = (pImg.value || "").trim();
  const description = (pDescription.value || "").trim();
  const isCustomOrder = Number(pIsCustomOrder.value || 0);
  const variants = collectVariantsFromForm();

  const relatedIds = (pRelatedIds.value || "")
    .split(",")
    .map((x) => Number(x.trim()))
    .filter(Number.isFinite);

  if (!title) {
    return alert("Введіть назву товару");
  }
  if (!catId) {
  return alert("Оберіть категорію зі списку");
}

  if (!brand) {
    return alert("Введіть виробника");
  }

  if (!variants.length) {
    return alert("Додай хоча б одне фасування");
  }

  for (const v of variants) {
    if (!v.label) {
      return alert("У кожного фасування має бути назва, наприклад 0.9кг");
    }

    if (!Number.isFinite(v.price) || v.price <= 0) {
      return alert(`Для фасування "${v.label || "—"}" ціна має бути більше 0`);
    }

    if (!Number.isFinite(v.stockQty) || v.stockQty < 0) {
      return alert(`Для фасування "${v.label || "—"}" кількість має бути числом ≥ 0`);
    }
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

    pTitle.value = "";
    pBrand.value = "";
    pImg.value = "";
    if (pFile) pFile.value = "";
    pDescription.value = "";
    pIsCustomOrder.value = "0";
    pRelatedIds.value = "";
    resetVariantsForm();

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
          ${cat ? cat.name : "Без категорії"} • ${p.brand || ""}
        </div>
        <div style="font-size:12px;color:#374151; margin-top:4px;">
          ${
            Array.isArray(p.variants) && p.variants.length
              ? p.variants.map(v => `${v.label}: ${Number(v.price).toFixed(2)} ₴ • склад: ${Number(v.stockQty ?? 0)}`).join("<br>")
              : "Фасування не задані"
          }
        </div>
      </div>

      <button class="btn" data-act="editVariants">Редагувати</button>
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

        if (act === "editVariants") {
          const variantsText = prompt(
            "Введи фасування у форматі:\n0.9кг|180|6\n2.8кг|490|3",
            Array.isArray(p.variants)
              ? p.variants.map(v => `${v.label}|${v.price}|${v.stockQty ?? 0}`).join("\n")
              : ""
          );

          if (variantsText === null) return;

          const variants = variantsText
            .split("\n")
            .map(line => line.trim())
            .filter(Boolean)
            .map((line) => {
              const [label, price, stockQty] = line.split("|").map(x => (x || "").trim());
              return {
                label,
                price: Number(price),
                stockQty: Number(stockQty || 0),
              };
            });

          if (!variants.length) {
            return alert("Потрібно вказати хоча б одне фасування");
          }

          for (const v of variants) {
            if (!v.label) return alert("У кожного фасування має бути назва");
            if (!Number.isFinite(v.price) || v.price <= 0) return alert(`Невірна ціна для ${v.label}`);
            if (!Number.isFinite(v.stockQty) || v.stockQty < 0) return alert(`Невірний склад для ${v.label}`);
          }

          await api(`/products/${p.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              variants,
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
  resetVariantsForm();
})();

;
