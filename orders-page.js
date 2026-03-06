const API_BASE = window.API_BASE || "http://localhost:3001";

function getToken() {
  return localStorage.getItem("token") || "";
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
    throw new Error(msg);
  }

  return data;
}

const tabNew = document.getElementById("tabNew");
const tabDone = document.getElementById("tabDone");
const tabAll = document.getElementById("tabAll");
const ordersList = document.getElementById("ordersList");
const ordersHint = document.getElementById("ordersHint");

let currentStatus = "new";

function setActiveTab(status) {
  currentStatus = status;
  tabNew.classList.toggle("tabActive", status === "new");
  tabDone.classList.toggle("tabActive", status === "done");
  tabAll.classList.toggle("tabActive", status === "all");
}

async function loadOrders(status = "new") {
  setActiveTab(status);
  ordersHint.textContent = "Завантаження...";
  ordersList.innerHTML = "";

  const orders = await api(`/orders?status=${encodeURIComponent(status)}`, {
    method: "GET",
  });

  ordersHint.textContent = "";

  if (!orders.length) {
    ordersList.innerHTML = `<div class="hint">Замовлень немає.</div>`;
    return;
  }

  ordersList.innerHTML = orders.map((o) => {
    const customerName = o.customerName || "Без імені";
    const phone = o.phone || "—";
    const email = o.email || "—";
    const address = o.address || "—";
    const delivery = o.delivery_date || "—";
    const note = o.note || "—";
    const statusText = o.status === "done" ? "Виконано" : "Нове";

    return `
      <div class="adminRow" style="grid-template-columns: 1fr auto auto; gap:10px;">
        <div>
          <div style="font-weight:900">№${o.id} • ${customerName}</div>
          <div style="font-size:12px;color:#6b7280">Телефон: ${phone}</div>
          <div style="font-size:12px;color:#6b7280">Email: ${email}</div>
          <div style="font-size:12px;color:#6b7280">Адреса: ${address}</div>
          <div style="font-size:12px;color:#6b7280">Дата доставки: ${delivery}</div>
          <div style="font-size:12px;color:#6b7280">Створено: ${o.created_at}</div>
          <div style="font-size:12px;color:#6b7280">Примітка: ${note}</div>
          <div style="font-size:12px;color:#111827; margin-top:4px;"><b>Статус:</b> ${statusText}</div>
        </div>

        <button class="btn" type="button" data-act="details" data-id="${o.id}">
          Деталі
        </button>

        ${
          o.status === "new"
            ? `<button class="btnPrimary" type="button" data-act="done" data-id="${o.id}">
                Виконано
              </button>`
            : `<button class="btn" type="button" data-act="new" data-id="${o.id}">
                Повернути в нові
              </button>`
        }
      </div>
    `;
  }).join("");
}

ordersList?.addEventListener("click", async (e) => {
  const btn = e.target.closest("[data-act]");
  if (!btn) return;

  const act = btn.dataset.act;
  const id = Number(btn.dataset.id);

  if (!Number.isInteger(id)) return;

  try {
    if (act === "done") {
      await api(`/orders/${id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "done" }),
      });
      await loadOrders(currentStatus);
    }

    if (act === "new") {
      await api(`/orders/${id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "new" }),
      });
      await loadOrders(currentStatus);
    }

    if (act === "details") {
      const order = await api(`/orders/${id}`, { method: "GET" });

      const itemsText = (order.items || []).map((it) => {
        const qty = Number(it.qty || 0);
        const price = Number(it.price || 0);
        const rowSum = qty * price;
        return `${it.name || "Товар"} — ${qty} ${it.unit || "шт"} × ${price.toFixed(2)} грн = ${rowSum.toFixed(2)} грн`;
      }).join("\n");

      alert(
        `Замовлення №${order.id}\n\n` +
        `Клієнт: ${order.customerName || "—"}\n` +
        `Телефон: ${order.phone || "—"}\n` +
        `Email: ${order.email || "—"}\n` +
        `Адреса: ${order.address || "—"}\n` +
        `Дата доставки: ${order.delivery_date || "—"}\n` +
        `Примітка: ${order.note || "—"}\n` +
        `Статус: ${order.status || "—"}\n\n` +
        `Товари:\n${itemsText || "Немає товарів"}`
      );
    }
  } catch (err) {
    alert("Помилка: " + err.message);
  }
});

tabNew?.addEventListener("click", () => loadOrders("new"));
tabDone?.addEventListener("click", () => loadOrders("done"));
tabAll?.addEventListener("click", () => loadOrders("all"));

(async function init() {
  const token = getToken();
  if (!token) {
    alert("Спочатку увійди в адмінку.");
    window.location.href = "admin.html";
    return;
  }

  try {
    await loadOrders("new");
  } catch (e) {
    ordersHint.textContent = "Помилка: " + e.message;
  }
})();