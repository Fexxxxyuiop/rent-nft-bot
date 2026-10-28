
const API = "https://api.changes.tg";
const PROXY = "https://proxy.cors.dev/";

const $ = (s) => document.querySelector(s);
let gifts = [];
let activeFilter = "all";

const esc = (value) =>
  String(value ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;",
    '"': "&quot;", "'": "&#39;"
  })[c]);

async function getJSON(url) {
  let error;

  for (const address of [
    url,
    PROXY + url
  ]) {
    try {
      const response = await fetch(address, {
        headers: { Accept: "application/json" }
      });
      if (!response.ok) throw new Error("HTTP " + response.status);
      const data = await response.json();
      if (data && data.error) throw new Error(data.message || data.error);
      return data;
    } catch (e) {
      error = e;
    }
  }

  throw error || new Error("Не удалось загрузить API");
}

function normalize(item) {
  if (typeof item === "string") {
    return { name: item, id: item, upgradable: true };
  }

  if (item && typeof item === "object") {
    const name = item.name || item.title || item.gift;
    if (!name) return null;
    return { ...item, name, id: item.id || name };
  }

  return null;
}

function imageURL(gift) {
  return `${API}/original/${encodeURIComponent(gift.id || gift.name)}.png?size=256`;
}

function showError(message) {
  $("#status").textContent = "Ошибка";
  $("#error-banner").classList.remove("hidden");
  $("#error-banner").textContent =
    message + " Если каталог не открылся, обнови страницу чуть позже.";
}

function render() {
  const query = ($("#search").value || "").trim().toLowerCase();

  const filtered = gifts.filter((gift) => {
    const matches = gift.name.toLowerCase().includes(query);
    const isUpgradable = gift.upgradable !== false;
    const isLimited = gift.limited === true ||
      gift.availability === "limited";

    if (activeFilter === "upgradable" && !isUpgradable) return false;
    if (activeFilter === "limited" && !isLimited) return false;

    return matches;
  });

  $("#status").textContent = `${filtered.length} найдено`;

  if (!filtered.length) {
    $("#catalog").innerHTML =
      '<div class="empty-state">Подарки не найдены.</div>';
    return;
  }

  $("#catalog").innerHTML = filtered.map((gift) => `
    <article class="gift-card">
      <div class="gift-image-wrap">
        <img
          class="gift-image"
          src="${esc(imageURL(gift))}"
          alt="${esc(gift.name)}"
          loading="lazy"
          onerror="this.style.display='none';this.nextElementSibling.style.display='block'"
        >
        <div class="gift-emoji" style="display:none">🎁</div>
      </div>
      <div class="gift-info">
        <div class="gift-name">${esc(gift.name)}</div>
        <div class="gift-description">Коллекционный подарок Telegram</div>
        <div class="gift-meta">
          <span class="gift-price">Уточнить цену</span>
          <span class="gift-badge">Каталог</span>
        </div>
        <button class="gift-rent-btn" data-gift="${esc(gift.name)}">
          Подробнее
        </button>
      </div>
    </article>
  `).join("");
}

async function openGift(name) {
  const gift = gifts.find((g) => g.name === name);
  if (!gift) return;

  $("#modal").classList.remove("hidden");
  $("#modal-content").innerHTML = `
    <h2>${esc(gift.name)}</h2>
    <p>Подарок из каталога Telegram.</p>
    <p>Стоимость и доступность аренды уточняются у менеджера.</p>
    <form id="rent-form">
      <div class="form-group">
        <label for="rent-period">Желаемый срок аренды</label>
        <select id="rent-period" required>
          <option value="1 день">1 день</option>
          <option value="3 дня">3 дня</option>
          <option value="7 дней">7 дней</option>
          <option value="30 дней">30 дней</option>
        </select>
      </div>
      <div class="form-group">
        <label for="rent-contact">Твой Telegram @username</label>
        <input id="rent-contact" placeholder="@username" required>
      </div>
      <button class="primary-btn" type="submit">Создать заявку</button>
    </form>
    <p id="rent-result"></p>
  `;

  $("#rent-form").addEventListener("submit", (event) => {
    event.preventDefault();

    const period = $("#rent-period").value;
    const contact = $("#rent-contact").value.trim();

    if (!contact) return;

    const message =
      `Здравствуйте! Хочу уточнить аренду подарка ${gift.name}. ` +
      `Срок: ${period}. Telegram: ${contact}`;

    $("#rent-result").textContent =
      "Заявка подготовлена. Отправь её менеджеру для подтверждения.";

    const tg = window.Telegram?.WebApp;
    if (tg) {
      tg.showPopup({
        title: "Заявка подготовлена",
        message: "Для оформления нужно отправить сообщение менеджеру.",
        buttons: [{ type: "ok" }]
      });
    }

    const manager = "GiftChangesAPI";
    const url = `https://t.me/${manager}?text=${encodeURIComponent(message)}`;
    window.open(url, "_blank");
  });
}

async function loadGifts() {
  $("#status").textContent = "Загрузка…";
  $("#catalog").innerHTML = `
    <div class="loading">
      <div class="spinner"></div>
      <p>Загружаем каталог подарков…</p>
    </div>`;

  try {
    const data = await getJSON(`${API}/gifts`);
    const list = Array.isArray(data)
      ? data
      : Array.isArray(data.gifts) ? data.gifts
      : Array.isArray(data.results) ? data.results
      : [];

    gifts = list.map(normalize).filter(Boolean);

    if (!gifts.length) {
      throw new Error("API вернул пустой список");
    }

    $("#gift-count").textContent = gifts.length.toLocaleString("ru-RU");
    $("#error-banner").classList.add("hidden");
    render();
  } catch (error) {
    console.error("NFT RENT catalog error:", error);
$("#status").textContent = "Ошибка: " + String(error);
    $("#catalog").innerHTML = `
      <div class="empty-state">
        <p>Не удалось загрузить каталог.</p>
        <button class="gift-rent-btn" id="retry-load">Попробовать снова</button>
      </div>`;
    $("#retry-load").addEventListener("click", loadGifts);
    showError("Не удалось получить данные каталога.");
  }
}

$("#search").addEventListener("input", render);

$("#clear-search").addEventListener("click", () => {
  $("#search").value = "";
  render();
});

document.querySelectorAll(".filter").forEach((button) => {
  button.addEventListener("click", () => {
    document.querySelectorAll(".filter").forEach((b) =>
      b.classList.remove("active")
    );
    button.classList.add("active");
    activeFilter = button.dataset.filter;
    render();
  });
});

$("#catalog").addEventListener("click", (event) => {
  const button = event.target.closest("[data-gift]");
  if (button) openGift(button.dataset.gift);
});

$("#modal").addEventListener("click", (event) => {
  if (event.target.dataset.close === "true") {
    $("#modal").classList.add("hidden");
  }
});

if (window.Telegram?.WebApp) {
  window.Telegram.WebApp.ready();
  window.Telegram.WebApp.expand();
}

loadGifts();
