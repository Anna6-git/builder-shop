/* cart.js */
console.log("✅ cart.js loaded");

const KEY_PRODS = "products_db";
const KEY_CATS = "categories_db";
const KEY_CART = "cart_v2";

const API_BASE = window.API_BASE || "http://localhost:3001";
const ORDER_KEY = "some_long_random_string"; // має збігатися з Railway env ORDER_WEBHOOK_KEY

// контакти
const TG_LINK = "https://t.me/MarinaStyaglyuk";
const VIBER_LINK = "viber://chat?number=%2B380979129698";
const CALL_PHONE = "+380988966988";

// ===== helpers =====
function getProds() {
  const raw = localStorage.getItem(KEY_PRODS);
  return raw ? JSON.parse(raw) : [];
}
function setProds(list) {
  localStorage.setItem(KEY_PRODS, JSON.stringify(list));
}
function getCats() {
  const raw = localStorage.getItem(KEY_CATS);
  return raw ? JSON.parse(raw) : [];
}
function getCart() {
  const raw = localStorage.getItem(KEY_CART);
  return raw ? JSON.parse(raw) : {};
}
function setCart(cartObj) {
  localStorage.setItem(KEY_CART, JSON.stringify(cartObj));
}
function escapeHTML(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
function parseCartKey(key) {
  const [idStr, unit] = String(key).split("|");
  const id = Number(idStr);
  return { id, unit: unit || "шт" };
}
function formatQty(qty) {
  const n = Number(qty);
  if (Number.isInteger(n)) return String(n);
  return String(Math.round(n * 10) / 10);
}
function round1(x) {
  return Math.round(Number(x) * 10) / 10;
}
function stepByUnitType(unitType) {
  return unitType === "length" || unitType === "weight" ? 0.1 : 1;
}
function isInStock(p) {
  return Number(p?.stockQty || 0) > 0;
}

// ===== DOM =====
const cartList = document.getElementById("cartList");
const cartItemsCount = document.getElementById("cartItemsCount");
const cartTotal = document.getElementById("cartTotal");
const clearCartBtn = document.getElementById("clearCartBtn");

const tgBtn = document.getElementById("tgBtn");
const viberBtn = document.getElementById("viberBtn");
const callBtn = document.getElementById("callBtn");

const overlay = document.getElementById("checkoutOverlay");
const modal = document.getElementById("checkoutModal");
const closeBtn = document.getElementById("checkoutClose");
const checkoutSendBtn = document.getElementById("checkoutSendBtn");

const cCity = document.getElementById("cCity");
const cAddress = document.getElementById("cAddress");
const cPhone = document.getElementById("cPhone");
const cName = document.getElementById("cName");
const cDate = document.getElementById("cDate");
const cTime = document.getElementById("cTime");
const checkoutHint = document.getElementById("checkoutHint");

const checkoutPreview = document.getElementById("checkoutPreview");
const checkoutTotal = document.getElementById("checkoutTotal");

const afterConfirm = document.getElementById("afterConfirm");
const sendTg = document.getElementById("sendTg");
const sendViber = document.getElementById("sendViber");
const sendCall = document.getElementById("sendCall");

// ===== render =====
function renderCart() {
  const prods = getProds();
  const cats = getCats();
  const cart = getCart();

  if (!cartList) return;

  const entries = Object.entries(cart).filter(([, qty]) => Number(qty) > 0);

  if (entries.length === 0) {
    cartList.innerHTML = `<div class="hint">Кошик порожній.</div>`;
    if (cartItemsCount) cartItemsCount.textContent = "0";
    if (cartTotal) cartTotal.textContent = "0";
    return;
  }

  let totalQty = 0;
  let totalSum = 0;

  cartList.innerHTML = "";

  for (const [key, qtyRaw] of entries) {
    const qty = Number(qtyRaw);
    const { id, unit } = parseCartKey(key);

    const p = prods.find((x) => Number(x.id) === id);
    if (!p) continue;

    const cat = cats.find((c) => Number(c.id) === Number(p.catId));
    const rowSum = p.price * qty;

    totalQty += qty;
    totalSum += rowSum;

    const step = stepByUnitType(p.unitType);
    const stockText =
      typeof p.stockQty !== "undefined"
        ? isInStock(p)
          ? `В наявності: ${p.stockQty}`
          : "Немає в наявності"
        : "";

    const overStock =
      p.unitType === "pcs" &&
      Number(p.stockQty || 0) > 0 &&
      qty > Number(p.stockQty || 0);

    const row = document.createElement("div");
    row.className = "cartRow";
    row.innerHTML = `
      <img class="cartImg" src="${p.img}" alt="">
      <div class="cartInfo">
        <div class="cartTitle">${escapeHTML(p.title)}</div>
        <div class="cartMeta">
          ${escapeHTML(cat ? cat.name : "Категорія")} • ${escapeHTML(
      p.brand
    )} • ${escapeHTML(unit)} • ${escapeHTML(stockText)}
          ${
            overStock
              ? `<div class="hint" style="color:#b91c1c;margin-top:4px;">У кошику більше, ніж є на складі. Зменшіть кількість.</div>`
              : ""
          }
        </div>
      </div>

      <div class="cartPrice">${p.price} ₴</div>

      <div class="qtyBox">
        <button class="qtyBtn" data-act="minus" data-key="${escapeHTML(
          key
        )}">−</button>
        <div class="qtyNum">${formatQty(qty)}</div>
        <button class="qtyBtn" data-act="plus" data-key="${escapeHTML(
          key
        )}" data-step="${step}">+</button>
      </div>

      <div class="cartSum">${Math.round(rowSum)} ₴</div>

      <button class="delBtn" title="Видалити" data-act="del" data-key="${escapeHTML(
        key
      )}">🗑</button>
    `;
    cartList.appendChild(row);
  }

  if (cartItemsCount) cartItemsCount.textContent = formatQty(totalQty);
  if (cartTotal) cartTotal.textContent = String(Math.round(totalSum));

  if (checkoutPreview && checkoutTotal) {
    checkoutPreview.innerHTML = "";
    for (const [key, qtyRaw] of entries) {
      const qty = Number(qtyRaw);
      const { id, unit } = parseCartKey(key);
      const p = prods.find((x) => Number(x.id) === id);
      if (!p) continue;
      const sum = p.price * qty;

      const div = document.createElement("div");
      div.className = "chkRow";
      div.innerHTML = `
        <img class="chkImg" src="${p.img}" alt="">
        <div>
          <div class="chkName">${escapeHTML(p.title)}</div>
          <div class="chkMeta">${formatQty(qty)} ${escapeHTML(
        unit
      )} × ${p.price} ₴</div>
        </div>
        <div class="chkSum">${Math.round(sum)} ₴</div>
      `;
      checkoutPreview.appendChild(div);
    }
    checkoutTotal.textContent = `${Math.round(totalSum)} ₴`;
  }
}

function changeQty(key, delta) {
  const cart = getCart();
  const current = Number(cart[key] || 0);
  const next = round1(current + delta);

  if (next <= 0) delete cart[key];
  else cart[key] = next;

  setCart(cart);
  renderCart();
}

function deleteItem(key) {
  const cart = getCart();
  delete cart[key];
  setCart(cart);
  renderCart();
}

// ===== events =====
cartList?.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-act]");
  if (!btn) return;

  const act = btn.getAttribute("data-act");
  const key = btn.getAttribute("data-key");
  if (!key) return;

  const prods = getProds();
  const { id } = parseCartKey(key);
  const p = prods.find((x) => Number(x.id) === id);
  const step = p ? stepByUnitType(p.unitType) : 1;

  if (act === "minus") changeQty(key, -step);
  if (act === "plus") changeQty(key, +step);
  if (act === "del") deleteItem(key);
});

clearCartBtn?.addEventListener("click", () => {
  setCart({});
  renderCart();
});

function openCheckout() {
  document.body.classList.add("modalOpen");
  modal?.setAttribute("aria-hidden", "false");
  if (afterConfirm) afterConfirm.hidden = true;
  if (checkoutHint) checkoutHint.textContent = "";
}
function closeCheckout() {
  document.body.classList.remove("modalOpen");
  modal?.setAttribute("aria-hidden", "true");
}

tgBtn?.addEventListener("click", openCheckout);
viberBtn?.addEventListener("click", openCheckout);

closeBtn?.addEventListener("click", closeCheckout);
overlay?.addEventListener("click", closeCheckout);
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closeCheckout();
});

// ===== schedule time options =====
const WORK = {
  0: null,
  1: { start: "09:00", end: "18:00" },
  2: { start: "09:00", end: "18:00" },
  3: { start: "09:00", end: "18:00" },
  4: { start: "09:00", end: "18:00" },
  5: { start: "09:00", end: "18:00" },
  6: { start: "09:00", end: "16:00" },
};
const SLOT_MIN = 30;

function toMin(hhmm) {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}
function pad2(n) {
  return String(n).padStart(2, "0");
}
function minToHHMM(min) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${pad2(h)}:${pad2(m)}`;
}

function fillTimeOptions(dateStr) {
  if (!cTime) return;
  cTime.innerHTML = "";

  if (!dateStr) {
    const opt = document.createElement("option");
    opt.value = "";
    opt.textContent = "Оберіть дату";
    cTime.appendChild(opt);
    return;
  }

  const d = new Date(dateStr + "T00:00:00");
  const day = d.getDay();
  const rule = WORK[day];

  if (!rule) {
    const opt = document.createElement("option");
    opt.value = "";
    opt.textContent = "Вихідний день";
    cTime.appendChild(opt);
    cTime.disabled = true;
    return;
  }

  cTime.disabled = false;

  const start = toMin(rule.start);
  const end = toMin(rule.end);

  for (let t = start; t <= end; t += SLOT_MIN) {
    const hhmm = minToHHMM(t);
    const opt = document.createElement("option");
    opt.value = hhmm;
    opt.textContent = hhmm;
    cTime.appendChild(opt);
  }
}

if (cDate) {
  const today = new Date();
  cDate.min = today.toISOString().slice(0, 10);
  cDate.addEventListener("change", () => fillTimeOptions(cDate.value));
  fillTimeOptions(cDate.value);
}

// ===== checkout submit =====
checkoutSendBtn?.addEventListener("click", async () => {
  const city = (cCity?.value || "").trim();
  const addr = (cAddress?.value || "").trim();
  const phone = (cPhone?.value || "").trim();
  const name = (cName?.value || "").trim();
  const delivery_date = (cDate?.value || "").trim();
  const delivery_time = (cTime?.value || "").trim();

  if (!delivery_date || !delivery_time) {
    if (checkoutHint) checkoutHint.textContent = "Оберіть дату та час.";
    return;
  }

  if (!city || !addr || !phone || !name) {
    if (checkoutHint) checkoutHint.textContent = "Заповніть всі поля.";
    return;
  }

  const cart = getCart();
  const entries = Object.entries(cart).filter(([, q]) => Number(q) > 0);
  if (!entries.length) {
    if (checkoutHint) checkoutHint.textContent = "Кошик порожній.";
    return;
  }

  const prods = getProds();

  const items = [];
  for (const [key, qtyRaw] of entries) {
    const qty = Number(qtyRaw);
    const { id } = parseCartKey(key);
    const p = prods.find((x) => Number(x.id) === Number(id));
    if (!p) continue;
    items.push({ product_id: Number(id), qty: qty });
  }
  if (!items.length) {
    if (checkoutHint) checkoutHint.textContent = "Не вдалося сформувати список товарів.";
    return;
  }

  try {
    if (checkoutHint) checkoutHint.textContent = "Надсилаю замовлення...";

    const resp = await fetch(`${API_BASE}/api/orders`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Order-Key": ORDER_KEY,
      },
      body: JSON.stringify({
        customer_name: name,
        customer_phone: phone,
        city: city,
        address: addr,
        delivery_date,
        delivery_time,
        note: "",
        items: items,
      }),
    });

    const data = await resp.json().catch(() => null);

    if (!resp.ok) {
      const msg = data?.error || data?.message || `HTTP ${resp.status}`;
      if (checkoutHint) checkoutHint.textContent = "Помилка: " + msg;
      return;
    }

    // Telegram text
    let sum = 0;
    const lines = [];
    lines.push(`Замовлення:`);
    lines.push(`ПІБ: ${name}`);
    lines.push(`Телефон: ${phone}`);
    lines.push(`Місто: ${city}`);
    lines.push(`Адреса: ${addr}`);
    lines.push(`Дата/час: ${delivery_date} ${delivery_time}`);
    lines.push(`--- Товари ---`);

    for (const [key, qtyRaw] of entries) {
      const qty = Number(qtyRaw);
      const { id, unit } = parseCartKey(key);
      const p = prods.find((x) => Number(x.id) === id);
      if (!p) continue;
      const rowSum = p.price * qty;
      sum += rowSum;
      lines.push(`${p.title} — ${formatQty(qty)} ${unit} × ${p.price}₴ = ${Math.round(rowSum)}₴`);
    }

    lines.push(`---`);
    lines.push(`До оплати: ${Math.round(sum)}₴`);
    const enc = encodeURIComponent(lines.join("\n"));

    // clear cart
    setCart({});
    renderCart();

    // show buttons
    if (sendTg) sendTg.href = `${TG_LINK}?text=${enc}`;
    if (sendViber) sendViber.href = `${VIBER_LINK}`;
    if (sendCall) sendCall.href = `tel:${CALL_PHONE}`;

    if (afterConfirm) afterConfirm.hidden = false;
    if (checkoutHint) checkoutHint.textContent = "Готово! Оберіть спосіб відправки.";
  } catch (e) {
    if (checkoutHint) checkoutHint.textContent = "Помилка запиту: " + (e?.message || e);
  }
});

// ===== sync products and render =====
async function syncProductsFromApi() {
  const res = await fetch(`${API_BASE}/api/products`);
  const prods = await res.json();
  localStorage.setItem(KEY_PRODS, JSON.stringify(prods));
}

syncProductsFromApi().then(renderCart);

if (callBtn) callBtn.href = `tel:${CALL_PHONE}`;