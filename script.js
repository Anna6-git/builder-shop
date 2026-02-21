const KEY_CATS = "categories_db";
const KEY_PRODS = "products_db";
const KEY_CART = "cart_v2";

/* AUTH keys */
const KEY_USERS = "users_db";
const KEY_SESSION = "current_user";

/* ===== Seed data if empty ===== */
function seedIfEmpty() {
  const catsRaw = localStorage.getItem(KEY_CATS);
  const prodsRaw = localStorage.getItem(KEY_PRODS);

  if (!catsRaw) {
    const cats = [
      { id: 1, name: "Гіпсокартон", icon: "🧱", order: 1 },
      { id: 2, name: "Профіль для гіпсокартону", icon: "📐", order: 2 },
      { id: 3, name: "Будівельні суміші", icon: "🪣", order: 3 },
      { id: 4, name: "Лакофарбові матеріали", icon: "🎨", order: 4 },
    ];
    localStorage.setItem(KEY_CATS, JSON.stringify(cats));
  }

  if (!prodsRaw) {
    // ВАЖЛИВО: тепер замість stock:true/false ми використовуємо stockQty (кількість)
    const prods = [
      { id: 101, title: "Гіпсокартон 12.5 мм, 1.2×2.5 м", catId: 1, brand: "Knauf", price: 265, img: "assets/img/gk.jpg", unitType: "pcs", stockQty: 20 },
      { id: 102, title: "Профіль CD 60/27, 3 м", catId: 2, brand: "Rigips", price: 120, img: "assets/img/profil.jpg", unitType: "length", stockQty: 80 },
      { id: 103, title: "Цемент 25 кг", catId: 3, brand: "Knauf", price: 210, img: "assets/img/cement.jpg", unitType: "weight", stockQty: 200 },
      { id: 104, title: "Фарба інтер’єрна матова, 3 л", catId: 4, brand: "Knauf", price: 399, img: "assets/img/farba.jpg", unitType: "pcs", stockQty: 0 },
    ];
    localStorage.setItem(KEY_PRODS, JSON.stringify(prods));
  }
}

/* ===== Migration: якщо раніше було stock:true/false ===== */
function migrateProductsIfNeeded() {
  const raw = localStorage.getItem(KEY_PRODS);
  if (!raw) return;

  let list;
  try {
    list = JSON.parse(raw);
  } catch {
    return;
  }
  if (!Array.isArray(list)) return;

  let changed = false;

  const fixed = list.map((p) => {
    const obj = { ...p };

    // якщо старий формат stock (boolean) і немає stockQty
    if (typeof obj.stockQty === "undefined" && typeof obj.stock === "boolean") {
      obj.stockQty = obj.stock ? 10 : 0; // дефолтно 10, якщо було "в наявності"
      changed = true;
    }

    // якщо stockQty є, але некоректний
    if (typeof obj.stockQty !== "undefined") {
      const n = Number(obj.stockQty);
      if (!Number.isFinite(n) || n < 0) {
        obj.stockQty = 0;
        changed = true;
      }
    }

    return obj;
  });

  if (changed) localStorage.setItem(KEY_PRODS, JSON.stringify(fixed));
}

/* ===== Storage helpers ===== */
function getCats() {
  return JSON.parse(localStorage.getItem(KEY_CATS) || "[]");
}
function getProds() {
  return JSON.parse(localStorage.getItem(KEY_PRODS) || "[]");
}
function setProds(list) {
  localStorage.setItem(KEY_PRODS, JSON.stringify(list));
}
function getCart() {
  return JSON.parse(localStorage.getItem(KEY_CART) || "{}");
}
function setCart(obj) {
  localStorage.setItem(KEY_CART, JSON.stringify(obj));
}

/* унікальні товари в значку кошика */
function cartUniqueProductsCount() {
  const cart = getCart();
  const ids = new Set(Object.keys(cart).map((k) => String(k).split("|")[0]));
  return ids.size;
}

/* ===== Utils ===== */
function normalizeQuery(s) {
  return (s || "").trim().toLowerCase();
}
function unique(arr) {
  return [...new Set(arr)];
}
function unitsFor(unitType) {
  if (unitType === "length") return ["м", "см", "мм"];
  if (unitType === "weight") return ["кг", "г"];
  return ["шт"];
}
function catById(cats, id) {
  return cats.find((c) => c.id === id);
}
function escapeHTML(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
function isInStock(p) {
  return Number(p?.stockQty || 0) > 0;
}
function clamp(n, min, max) {
  const x = Number(n);
  if (!Number.isFinite(x)) return min;
  return Math.max(min, Math.min(max, x));
}
function round1(x) {
  return Math.round(Number(x) * 10) / 10;
}

/* ===== Header settings ===== */
function applyHeaderSettings() {
  const siteTitle = document.getElementById("siteTitle");
  if (siteTitle) siteTitle.textContent = "БудМаркет Радомишль";

  const tg = document.getElementById("tgLink");
  const vb = document.getElementById("viberLink");
  const p1 = document.getElementById("phone1");
  const p2 = document.getElementById("phone2");
  const p3 = document.getElementById("phone3");
  const wt = document.getElementById("workTime");

  if (tg) tg.href = "https://t.me/MarinaStyaglyuk";
  if (vb) vb.href = "viber://chat?number=%2B380979129698";
  if (p1) p1.textContent = "+380988966988 Магазин";
  if (p2) p2.textContent = "+380979129698 Марина консультант";
  if (p3) p3.textContent = "+380979129690 Олександр доставка";
  if (wt) wt.textContent = "Пн–Сб 09:00–17:00 • Нд вихідний";
}

/* ===== UI elements ===== */
const cartCountEl = document.getElementById("cartCount");

const productsSection = document.getElementById("productsSection");
const productsTitle = document.getElementById("productsTitle");
const prodGrid = document.getElementById("prodGrid");
const backToCatalogBtn = document.getElementById("backToCatalogBtn");

const searchInput = document.getElementById("searchInput");
const suggestions = document.getElementById("suggestions");

const minPrice = document.getElementById("minPrice");
const maxPrice = document.getElementById("maxPrice");
const inStockOnly = document.getElementById("inStockOnly");
const brandList = document.getElementById("brandList");
const unitList = document.getElementById("unitList");
const applyFiltersBtn = document.getElementById("applyFiltersBtn");
const resetFiltersBtn = document.getElementById("resetFiltersBtn");

const modalOverlay = document.getElementById("modalOverlay");
const productModal = document.getElementById("productModal");
const mClose = document.getElementById("mClose");
const mTitle = document.getElementById("mTitle");
const mImg = document.getElementById("mImg");
const mPrice = document.getElementById("mPrice");
const mMeta = document.getElementById("mMeta");
const mHint = document.getElementById("mHint");
const mMinus = document.getElementById("mMinus");
const mPlus = document.getElementById("mPlus");
const mQty = document.getElementById("mQty");
const mUnit = document.getElementById("mUnit");
const mAdd = document.getElementById("mAdd");

const catalogNav = document.getElementById("catalogNav");

const slidesBox = document.getElementById("slides");
const dotsBox = document.getElementById("dots");
const prevSlideBtn = document.getElementById("prevSlide");
const nextSlideBtn = document.getElementById("nextSlide");

let activeCatId = null;
let currentProduct = null;

/* ===== Left catalog ===== */
function renderLeftCatalog(cats) {
  if (!catalogNav) return;
  catalogNav.innerHTML = "";

  if (!cats.length) {
    catalogNav.innerHTML = `<div class="hint" style="padding:10px 14px;">Немає категорій. Додайте їх в admin.html</div>`;
    return;
  }

  cats.forEach((c) => {
    const a = document.createElement("a");
    a.className = "catalogNav__item";
    a.href = "#";
    a.innerHTML = `
      <span class="catalogNav__icon">${c.icon || "📦"}</span>
      <span class="catalogNav__name">${escapeHTML(c.name)}</span>
    `;
    a.addEventListener("click", (e) => {
      e.preventDefault();
      openCategory(c.id);
    });
    catalogNav.appendChild(a);
  });
}

function renderCatalog() {
  const cats = getCats().slice().sort((a, b) => (a.order ?? 9999) - (b.order ?? 9999));
  renderLeftCatalog(cats);
}

/* ===== Filters ===== */
function renderFilterCheckboxes(container, values, prefix) {
  if (!container) return;
  container.innerHTML = "";
  values.forEach((v) => {
    const id = `${prefix}_${String(v).replaceAll(" ", "_")}`;
    const label = document.createElement("label");
    label.className = "check";
    label.innerHTML = `<input type="checkbox" value="${v}" id="${id}"><span>${v}</span>`;
    container.appendChild(label);
  });
}
function getCheckedValues(container) {
  if (!container) return [];
  return Array.from(container.querySelectorAll('input[type="checkbox"]:checked')).map((x) => x.value);
}
function resetFiltersUI(list) {
  const prices = list.map((p) => p.price);
  const min = prices.length ? Math.min(...prices) : 0;
  const max = prices.length ? Math.max(...prices) : 999999;

  if (minPrice) minPrice.value = String(min);
  if (maxPrice) maxPrice.value = String(max);
  if (inStockOnly) inStockOnly.checked = false;

  const brands = unique(list.map((p) => p.brand)).sort();
  const units = unique(list.flatMap((p) => unitsFor(p.unitType))).sort();

  renderFilterCheckboxes(brandList, brands, "brand");
  renderFilterCheckboxes(unitList, units, "unit");
}
function applyFiltersToList(list) {
  const min = Number(minPrice?.value) || 0;
  const max = Number(maxPrice?.value) || 999999999;
  const onlyStock = Boolean(inStockOnly?.checked);
  const brands = getCheckedValues(brandList);
  const units = getCheckedValues(unitList);

  return list.filter((p) => {
    if (p.price < min || p.price > max) return false;
    if (onlyStock && !isInStock(p)) return false;
    if (brands.length && !brands.includes(p.brand)) return false;
    if (units.length) {
      const possible = unitsFor(p.unitType);
      if (!units.some((u) => possible.includes(u))) return false;
    }
    return true;
  });
}

/* ===== Products ===== */
function renderProducts(list, titleText) {
  if (productsTitle) productsTitle.textContent = titleText;
  if (!prodGrid) return;

  prodGrid.innerHTML = "";

  if (!list.length) {
    prodGrid.innerHTML = `<div class="hint">Нічого не знайдено.</div>`;
    return;
  }

  const cats = getCats();

  list.forEach((p) => {
    const c = catById(cats, p.catId);
    const stockText = isInStock(p) ? ` • В наявності: ${p.stockQty}` : " • Немає в наявності";

    const card = document.createElement("article");
    card.className = "prodCard";
    card.innerHTML = `
      <img class="prodImg" src="${p.img}" alt="${escapeHTML(p.title)}" loading="lazy">
      <div class="prodBody">
        <h3 class="prodTitle">${escapeHTML(p.title)}</h3>
        <p class="prodMeta">${escapeHTML(c ? c.name : "Категорія")} • ${escapeHTML(p.brand)}${stockText}</p>
        <div class="prodBottom">
          <div class="prodPrice">${p.price} ₴</div>
        </div>
      </div>
    `;
    card.addEventListener("click", () => openProductModal(p));
    prodGrid.appendChild(card);
  });
}

function openCategory(catId) {
  activeCatId = catId;
  if (productsSection) productsSection.hidden = false;

  const cats = getCats();
  const c = catById(cats, catId);
  const list = getProds().filter((p) => p.catId === catId);

  resetFiltersUI(list);
  renderProducts(list, c ? c.name : "Товари");
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function backToCatalog() {
  activeCatId = null;
  if (productsSection) productsSection.hidden = true;
  if (suggestions) suggestions.hidden = true;
  window.scrollTo({ top: 0, behavior: "smooth" });
}

/* ===== Live search ===== */
function findProductsByQuery(q) {
  const query = normalizeQuery(q);
  if (!query) return [];
  return getProds().filter((p) => normalizeQuery(p.title).includes(query)).slice(0, 8);
}
function showSuggestions(items) {
  if (!suggestions) return;

  if (!items.length) {
    suggestions.hidden = true;
    suggestions.innerHTML = "";
    return;
  }

  const cats = getCats();
  suggestions.hidden = false;
  suggestions.innerHTML = "";

  items.forEach((p) => {
    const c = catById(cats, p.catId);
    const row = document.createElement("div");
    row.className = "suggItem";
    row.innerHTML = `
      <img class="suggImg" src="${p.img}" alt="">
      <div>
        <div class="suggTitle">${escapeHTML(p.title)}</div>
        <div class="suggMeta">${escapeHTML(c ? c.name : "")} • ${p.price} ₴</div>
      </div>
    `;
    row.addEventListener("click", () => {
      suggestions.hidden = true;
      openProductModal(p);
    });
    suggestions.appendChild(row);
  });
}

/* ===== Cart badge ===== */
function updateCartBadge() {
  if (!cartCountEl) return;
  cartCountEl.textContent = String(cartUniqueProductsCount());
}

/* ===== Added-to-cart popup (2 кнопки) ===== */
function ensureAddedModal() {
  if (document.getElementById("addedModal")) return;

  const wrap = document.createElement("div");
  wrap.id = "addedModal";
  wrap.className = "miniModal";
  wrap.hidden = true;

  wrap.innerHTML = `
    <div class="miniModal__backdrop" data-act="close"></div>
    <div class="miniModal__box" role="dialog" aria-modal="true" aria-label="Додано в кошик">
      <div class="miniModal__title">Товар додано в кошик</div>
      <div class="miniModal__body">
        <img id="addedImg" src="" alt="">
        <div>
          <div id="addedTitle" class="miniModal__name"></div>
          <div id="addedMeta" class="miniModal__meta"></div>
        </div>
      </div>
      <div class="miniModal__actions">
        <button class="btnPrimary" id="btnContinue" type="button">Повернутися до покупок</button>
        <a class="btn" id="btnGoCart" href="cart.html">Перейти до кошика</a>
      </div>
    </div>
  `;

  document.body.appendChild(wrap);

  wrap.addEventListener("click", (e) => {
    const act = e.target?.dataset?.act;
    if (act === "close") hideAddedModal();
  });

  document.getElementById("btnContinue")?.addEventListener("click", hideAddedModal);
  document.addEventListener("keydown", (e) => {
    const el = document.getElementById("addedModal");
    if (e.key === "Escape" && el && !el.hidden) hideAddedModal();
  });
}

function showAddedModal(p, qty, unit) {
  ensureAddedModal();
  const el = document.getElementById("addedModal");
  const img = document.getElementById("addedImg");
  const title = document.getElementById("addedTitle");
  const meta = document.getElementById("addedMeta");

  if (!el) return;

  if (img) {
    img.src = p.img || "";
    img.alt = p.title || "";
  }
  if (title) title.textContent = p.title || "";
  if (meta) meta.textContent = `Кількість: ${qty} ${unit}`;

  el.hidden = false;
  document.body.classList.add("miniModalOpen");
}
function hideAddedModal() {
  const el = document.getElementById("addedModal");
  if (!el) return;
  el.hidden = true;
  document.body.classList.remove("miniModalOpen");
}

/* ===== Product modal ===== */
function openProductModal(p) {
  currentProduct = p;
  const c = catById(getCats(), p.catId);

  if (mTitle) mTitle.textContent = p.title;
  if (mImg) {
    mImg.src = p.img;
    mImg.alt = p.title;
  }
  if (mPrice) mPrice.textContent = `${p.price} ₴`;

  const stockText = isInStock(p) ? ` • В наявності: ${p.stockQty}` : " • Немає в наявності";
  if (mMeta) mMeta.textContent = `${c ? c.name : "Категорія"} • ${p.brand}${stockText}`;

  if (mHint) mHint.textContent = isInStock(p) ? "" : "Цього товару зараз немає в наявності.";
  if (mAdd) mAdd.disabled = !isInStock(p);

  if (mUnit) {
    mUnit.innerHTML = "";
    unitsFor(p.unitType).forEach((u) => {
      const opt = document.createElement("option");
      opt.value = u;
      opt.textContent = u;
      mUnit.appendChild(opt);
    });
  }

  if (mQty) {
    // Кроки
    if (p.unitType === "length" || p.unitType === "weight") {
      mQty.step = "0.1";
      mQty.min = "0.1";
      mQty.value = "1";
    } else {
      mQty.step = "1";
      mQty.min = "1";
      mQty.value = "1";
    }

    // Для шт обмежимо max по складу
    if (p.unitType === "pcs") {
      const max = Number(p.stockQty || 0);
      if (max > 0) mQty.max = String(max);
      else mQty.removeAttribute("max");
    } else {
      // для ваги/довжини max не ставимо (якщо хочеш — можна теж ставити)
      mQty.removeAttribute("max");
    }
  }

  document.body.classList.add("modalProductOpen");
  productModal?.setAttribute("aria-hidden", "false");
}

function closeProductModal() {
  productModal?.setAttribute("aria-hidden", "true");
  document.body.classList.remove("modalProductOpen");
  currentProduct = null;
}

/* ===== Slider ===== */
const SLIDES = [
  { title: "НОВИНКА!", subtitle: "Декоративні покриття для інтер’єру", imageUrl: "assets/img/banner1.jpg" },
  { title: "ЗНИЖКИ", subtitle: "Топові матеріали за вигідними цінами", imageUrl: "assets/img/banner2.jpg" },
  { title: "ДОСТАВКА", subtitle: "По Радомишлю та області — уточнюйте в чаті", imageUrl: "assets/img/banner3.jpg" },
];

let sliderIndex = 0;
let sliderTimer = null;

function renderSlider() {
  if (!slidesBox || !dotsBox) return;

  slidesBox.innerHTML = "";
  dotsBox.innerHTML = "";

  SLIDES.forEach((s, i) => {
    const slide = document.createElement("div");
    slide.className = "slide" + (i === 0 ? " active" : "");
    slide.style.backgroundImage = `url("${s.imageUrl}")`;
    slide.innerHTML = `
      <div class="slideOverlay"></div>
      <div class="slideText">
        ${s.title ? `<h2>${escapeHTML(s.title)}</h2>` : ""}
        ${s.subtitle ? `<p>${escapeHTML(s.subtitle)}</p>` : ""}
      </div>
    `;
    slidesBox.appendChild(slide);

    const dot = document.createElement("div");
    dot.className = "dot" + (i === 0 ? " active" : "");
    dot.addEventListener("click", () => goToSlide(i, true));
    dotsBox.appendChild(dot);
  });

  startAutoSlider();
}

function goToSlide(i, restart = false) {
  if (!slidesBox || !dotsBox || !SLIDES.length) return;

  const slides = Array.from(slidesBox.querySelectorAll(".slide"));
  const dots = Array.from(dotsBox.querySelectorAll(".dot"));

  slides[sliderIndex]?.classList.remove("active");
  dots[sliderIndex]?.classList.remove("active");

  sliderIndex = (i + SLIDES.length) % SLIDES.length;

  slides[sliderIndex]?.classList.add("active");
  dots[sliderIndex]?.classList.add("active");

  if (restart) startAutoSlider();
}

function startAutoSlider() {
  if (sliderTimer) clearInterval(sliderTimer);
  sliderTimer = setInterval(() => goToSlide(sliderIndex + 1, false), 10000);
}

/* ===== AUTH ===== */
function getUsers() {
  return JSON.parse(localStorage.getItem(KEY_USERS) || "[]");
}
function setUsers(list) {
  localStorage.setItem(KEY_USERS, JSON.stringify(list));
}
function getSession() {
  return JSON.parse(localStorage.getItem(KEY_SESSION) || "null");
}
function setSession(u) {
  localStorage.setItem(KEY_SESSION, JSON.stringify(u));
}
function clearSession() {
  localStorage.removeItem(KEY_SESSION);
}

/* auth ui */
const btnLogin = document.getElementById("btnLogin");
const btnRegister = document.getElementById("btnRegister");
const btnLogout = document.getElementById("btnLogout");
const userBox = document.getElementById("userBox");
const userHello = document.getElementById("userHello");

const authOverlay = document.getElementById("authOverlay");
const authModal = document.getElementById("authModal");
const authClose = document.getElementById("authClose");
const authTitle = document.getElementById("authTitle");

const loginForm = document.getElementById("loginForm");
const registerForm = document.getElementById("registerForm");
const lName = document.getElementById("lName");
const lPass = document.getElementById("lPass");
const lHint = document.getElementById("lHint");
const rName = document.getElementById("rName");
const rSurname = document.getElementById("rSurname");
const rContact = document.getElementById("rContact");
const rPass = document.getElementById("rPass");
const rHint = document.getElementById("rHint");
const toLogin = document.getElementById("toLogin");
const toRegister = document.getElementById("toRegister");

function refreshAuthUI() {
  const u = getSession();
  if (u) {
    btnLogin.hidden = true;
    btnRegister.hidden = true;
    userBox.hidden = false;
    userHello.textContent = `Привіт, ${u.name}!`;
  } else {
    btnLogin.hidden = false;
    btnRegister.hidden = false;
    userBox.hidden = true;
  }
}

function openAuth(mode) {
  authOverlay.hidden = false;
  authModal.hidden = false;
  authModal.setAttribute("aria-hidden", "false");

  loginForm.hidden = true;
  registerForm.hidden = true;

  if (lHint) lHint.textContent = "";
  if (rHint) rHint.textContent = "";

  if (mode === "login") {
    authTitle.textContent = "Вхід";
    loginForm.hidden = false;
    setTimeout(() => lName?.focus(), 0);
  } else {
    authTitle.textContent = "Реєстрація";
    registerForm.hidden = false;
    setTimeout(() => rName?.focus(), 0);
  }
}

function closeAuth() {
  authModal.setAttribute("aria-hidden", "true");
  authModal.hidden = true;
  authOverlay.hidden = true;
  loginForm.hidden = true;
  registerForm.hidden = true;
  if (lHint) lHint.textContent = "";
  if (rHint) rHint.textContent = "";
}

btnLogin?.addEventListener("click", () => openAuth("login"));
btnRegister?.addEventListener("click", () => openAuth("register"));
toLogin?.addEventListener("click", () => openAuth("login"));
toRegister?.addEventListener("click", () => openAuth("register"));

authClose?.addEventListener("click", closeAuth);
authOverlay?.addEventListener("click", closeAuth);
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && authModal && !authModal.hidden) closeAuth();
});

registerForm?.addEventListener("submit", (e) => {
  e.preventDefault();

  const name = (rName.value || "").trim();
  const surname = (rSurname.value || "").trim();
  const contact = (rContact.value || "").trim();
  const pass = (rPass.value || "").trim();

  if (!name || !surname || !contact || !pass) {
    rHint.textContent = "Заповніть всі поля.";
    return;
  }

  const users = getUsers();
  const keyContact = contact.toLowerCase();

  if (users.some((u) => String(u.contact).toLowerCase() === keyContact)) {
    rHint.textContent = "Користувач з таким контактом вже існує.";
    return;
  }

  const user = { id: Date.now(), name, surname, contact, pass };
  users.push(user);
  setUsers(users);

  setSession({ id: user.id, name: user.name, contact: user.contact });
  closeAuth();
  refreshAuthUI();
});

loginForm?.addEventListener("submit", (e) => {
  e.preventDefault();

  const name = (lName.value || "").trim();
  const pass = (lPass.value || "").trim();

  if (!name || !pass) {
    lHint.textContent = "Введіть ім’я та пароль.";
    return;
  }

  const users = getUsers();
  const u = users.find((x) => String(x.name).toLowerCase() === name.toLowerCase() && x.pass === pass);

  if (!u) {
    lHint.textContent = "Невірне ім’я або пароль.";
    return;
  }

  setSession({ id: u.id, name: u.name, contact: u.contact });
  closeAuth();
  refreshAuthUI();
});

btnLogout?.addEventListener("click", () => {
  clearSession();
  refreshAuthUI();
});

/* ===== Events ===== */
backToCatalogBtn?.addEventListener("click", backToCatalog);

applyFiltersBtn?.addEventListener("click", () => {
  if (!activeCatId) return;
  const list = getProds().filter((p) => p.catId === activeCatId);
  renderProducts(applyFiltersToList(list), catById(getCats(), activeCatId)?.name || "Товари");
});

resetFiltersBtn?.addEventListener("click", () => {
  if (!activeCatId) return;
  const list = getProds().filter((p) => p.catId === activeCatId);
  resetFiltersUI(list);
  renderProducts(list, catById(getCats(), activeCatId)?.name || "Товари");
});

searchInput?.addEventListener("input", () => showSuggestions(findProductsByQuery(searchInput.value)));

document.addEventListener("click", (e) => {
  if (suggestions && !e.target.closest(".headerSearch")) suggestions.hidden = true;
});

mClose?.addEventListener("click", closeProductModal);
modalOverlay?.addEventListener("click", closeProductModal);

mMinus?.addEventListener("click", () => {
  if (!currentProduct) return;

  const step = Number(mQty?.step) || 1;
  const min = Number(mQty?.min) || step;
  const max = currentProduct.unitType === "pcs" ? Number(currentProduct.stockQty || 0) : Infinity;

  let v = Number(mQty?.value);
  v = clamp(v - step, min, max);
  if (currentProduct.unitType !== "pcs") v = round1(v);

  if (mQty) mQty.value = String(v);
});

mPlus?.addEventListener("click", () => {
  if (!currentProduct) return;

  const step = Number(mQty?.step) || 1;
  const min = Number(mQty?.min) || step;
  const max = currentProduct.unitType === "pcs" ? Number(currentProduct.stockQty || 0) : Infinity;

  let v = Number(mQty?.value);
  v = clamp(v + step, min, max);
  if (currentProduct.unitType !== "pcs") v = round1(v);

  if (mQty) mQty.value = String(v);
});

mAdd?.addEventListener("click", () => {
  if (!currentProduct) return;
  if (!isInStock(currentProduct)) return;

  let qty = Number(mQty?.value);
  if (!(qty > 0)) return;

  // для "шт" не дозволяємо більше, ніж на складі
  if (currentProduct.unitType === "pcs") {
    const max = Number(currentProduct.stockQty || 0);
    qty = clamp(qty, 1, max);
    qty = Math.round(qty);
  } else {
    qty = round1(qty);
  }

  const unit = mUnit?.value || "шт";
  const key = `${currentProduct.id}|${unit}`;

  const cart = getCart();
  cart[key] = round1((cart[key] || 0) + qty);
  setCart(cart);

  updateCartBadge();
  closeProductModal();

  showAddedModal(currentProduct, qty, unit);
});

prevSlideBtn?.addEventListener("click", () => goToSlide(sliderIndex - 1, true));
nextSlideBtn?.addEventListener("click", () => goToSlide(sliderIndex + 1, true));

async function syncFromApi() {
  const API_BASE = window.API_BASE || "http://localhost:3001";

  // 1) категорії
  const catsRes = await fetch(`${API_BASE}/api/categories`);
  const cats = await catsRes.json();
  localStorage.setItem("categories_db", JSON.stringify(cats));

  // 2) товари
  const prodsRes = await fetch(`${API_BASE}/api/products`);
  const prods = await prodsRes.json();
  localStorage.setItem("products_db", JSON.stringify(prods));
}

/* ===== INIT ===== */
(async function init() {
  try {
    await syncFromApi();
  } catch (e) {
    console.error("syncFromApi failed:", e);
  }

  // далі твій старий init як був
  seedIfEmpty();
  migrateProductsIfNeeded();
  applyHeaderSettings();
  renderCatalog();
  renderSlider();
  updateCartBadge();
  refreshAuthUI();

  if (productsSection) productsSection.hidden = true;
})();