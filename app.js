
(() => {
  const API = "https://api.changes.tg";
  const tg = window.Telegram?.WebApp;

  if (tg) {
    tg.ready();
    tg.expand();
  }

  const $ = (s) => document.querySelector(s);

  const catalog = $("#catalog");
  const search = $("#search");
  const modal = $("#modal");
  const content = $("#modal-content");

  let gifts = [];
  let filtered = [];
  let filter = "all";
  let currentGift = null;
  let currentTab = "models";
  const cache = new Map();

  const escapeHTML = (value) =>
    String(value ?? "").replace(/[&<>"']/g, (c) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    })[c]);

  const giftName = (gift) =>
    String(gift?.name || gift?.title || gift?.gift || gift?.id || "Telegram Gift");

  const giftId = (gift) =>
    String(gift?.id || gift?.giftId || gift?.name || giftName(gift));

  async function api(path) {
    const response = await fetch(API + path, {
      headers: { Accept: "application/json" }
    });

    if (!response.ok) {
      throw new Error("API вернул ошибку " + response.status);
    }

    return response.json();
  }

  function toGiftArray(data) {
    const list = Array.isArray(data)
      ? data
      : Array.isArray(data?.gifts)
        ? data.gifts
        : Array.isArray(data?.items)
          ? data.items
          : Array.isArray(data?.data)
            ? data.data
            : [];

    // /gifts может возвращать именно названия, а не объекты.
    return list.map((item) => {
      if (typeof item === "string" || typeof item === "number") {
        return { name: String(item), id: String(item) };
      }

      if (item && typeof item === "object") {
        return {
          ...item,
          name: item.name || item.title || item.gift || String(item.id || "Telegram Gift")
        };
      }

      return null;
    }).filter(Boolean);
  }

  function giftImage(gift) {
    return `${API}/original/${encodeURIComponent(giftId(gift))}.png?size=256`;
  }

  function isUpgradable(gift) {
    return gift.upgradable === true || gift.isUpgradable === true;
  }

  function isLimited(gift) {
    return gift.limited === true ||
      gift.isLimited === true ||
      String(gift.supply || "").toLowerCase().includes("limited");
  }

  function render() {
    const query = search.value.trim().toLowerCase();

    filtered = gifts.filter((gift) => {
      const matchesSearch =
        !query ||
        giftName(gift).toLowerCase().includes(query);

      const matchesFilter =
        filter === "all" ||
        (filter === "upgradable" && isUpgradable(gift)) ||
        (filter === "limited" && isLimited(gift));

      return matchesSearch && matchesFilter;
    });

    $("#status").textContent = `${filtered.length} подарков`;

    if (!filtered.length) {
      catalog.innerHTML = `
        <div class="empty-state">
          <p>Подарки по этому запросу не найдены.</p>
          <p>Попробуй другой поиск или категорию.</p>
        </div>`;
      return;
    }

    catalog.innerHTML = filtered.map((gift, index) => {
      const name = giftName(gift);
      const image = giftImage(gift);
      const tag = isUpgradable(gift)
        ? "COLLECTIBLE"
        : isLimited(gift)
          ? "LIMITED"
          : "TELEGRAM GIFT";

      return `
        <article class="gift-card">
          <div class="gift-image-wrap">
            <img
              class="gift-image"
              loading="lazy"
              src="${escapeHTML(image)}"
              alt="${escapeHTML(name)}"
              onerror="this.style.display='none'"
            >
          </div>
          <div class="gift-info">
            <div class="gift-name">${escapeHTML(name)}</div>
            <div class="gift-description">${tag}</div>
            <div class="gift-meta">
              <span class="gift-badge">${isUpgradable(gift) ? "Коллекционный" : "Telegram Gift"}</span>
            </div>
            <button class="gift-rent-btn" data-open="${index}">
              Подробнее
            </button>
          </div>
        </article>`;
    }).join("");

    catalog.querySelectorAll("[data-open]").forEach((button) => {
      button.addEventListener("click", () => {
        openGift(filtered[Number(button.dataset.open)]);
      });
    });
  }

  async function loadGifts() {
    $("#status").textContent = "Загрузка…";
    catalog.innerHTML = `
      <div class="loading">
        <div class="spinner"></div>
        <p>Загружаем подарки…</p>
      </div>`;

    try {
      const data = await api("/gifts");
      gifts = toGiftArray(data);

      if (!gifts.length) {
        throw new Error("API вернул пустой список");
      }

      gifts.sort((a, b) =>
        giftName(a).localeCompare(giftName(b), "ru")
      );

      $("#gift-count").textContent =
        gifts.length.toLocaleString("ru-RU");

      $("#error-banner").classList.add("hidden");
      render();
    } catch (error) {
      console.error("Ошибка каталога:", error);

      $("#status").textContent = "Ошибка загрузки";
      $("#error-banner").textContent =
        "Не удалось загрузить каталог. Проверь интернет и попробуй ещё раз.";
      $("#error-banner").classList.remove("hidden");

      catalog.innerHTML = `
        <div class="empty-state">
          <p>Каталог временно недоступен.</p>
          <button class="primary-btn" id="retry">Повторить загрузку</button>
        </div>`;

      $("#retry").addEventListener("click", loadGifts);
    }
  }

  async function loadDetails(gift) {
    const key = giftName(gift);

    if (cache.has(key)) {
      return cache.get(key);
    }

    const details = await api(
      "/gift/" + encodeURIComponent(key)
    );

    cache.set(key, details);
    return details;
  }

  function listFrom(data, key) {
    return Array.isArray(data?.[key]) ? data[key] : [];
  }

  function renderVariants(details) {
    const holder = $("#variants");
    if (!holder) return;

    const keys = {
      models: "models",
      backdrops: "backdrops",
      symbols: "symbols"
    };

    const items = listFrom(details, keys[currentTab]);

    if (!items.length) {
      holder.innerHTML = `
        <div class="empty-state">
          Для этого раздела пока нет данных.
        </div>`;
      return;
    }

    holder.innerHTML = items.map((item) => {
      const name = giftName(item);
      const rarity = item.rarity != null
        ? `${item.rarity}% редкости`
        : "";

      if (currentTab === "backdrops") {
        let color = item.centerColor || item.color || item.hex || "#383249";

        if (!/^#?[0-9a-f]{3,8}$/i.test(color)) {
          color = "#383249";
        }

        if (!color.startsWith("#")) color = "#" + color;

        return `
          <div class="variant-card">
            <div style="height:62px;border-radius:12px;background:${color}"></div>
            <div class="variant-name">${escapeHTML(name)}</div>
            <div class="variant-rarity">${escapeHTML(rarity)}</div>
          </div>`;
      }

      const endpoint = currentTab === "models" ? "model" : "symbol";
      const imageURL =
        `${API}/${endpoint}/${encodeURIComponent(giftName(currentGift))}/${encodeURIComponent(name)}.png?size=128`;

      return `
        <div class="variant-card">
          <img loading="lazy" src="${escapeHTML(imageURL)}" alt="${escapeHTML(name)}">
          <div class="variant-name">${escapeHTML(name)}</div>
          <div class="variant-rarity">${escapeHTML(rarity)}</div>
        </div>`;
    }).join("");
  }

  function requestForm(gift) {
    return `
      <form class="request-form" id="rent-form">
        <h3>Заявка на аренду</h3>
        <p>Менеджер должен подтвердить наличие и условия аренды.</p>

        <div class="form-group">
          <label for="contact">Твой Telegram @username</label>
          <input id="contact" required maxlength="80" placeholder="@username">
        </div>

        <div class="form-group">
          <label for="duration">Желаемый срок</label>
          <select id="duration">
            <option>1 день</option>
            <option>3 дня</option>
            <option>7 дней</option>
            <option>30 дней</option>
          </select>
        </div>

        <div class="form-group">
          <label for="comment">Комментарий</label>
          <textarea id="comment" maxlength="500" placeholder="Какая модель интересует?"></textarea>
        </div>

        <button class="primary-btn" type="submit">
          Отправить заявку
        </button>

        <p class="disclaimer">
          Отправка в бота работает только при настроенном обработчике Mini App.
        </p>
      </form>`;
  }

  function bindRequest(gift) {
    $("#rent-form")?.addEventListener("submit", (event) => {
      event.preventDefault();

      const request = {
        type: "rent_request",
        gift: giftName(gift),
        giftId: gift.id || gift.giftId || null,
        contact: $("#contact").value.trim(),
        duration: $("#duration").value,
        comment: $("#comment").value.trim()
      };

      if (!request.contact) return;

      if (tg?.sendData) {
        tg.sendData(JSON.stringify(request));
        tg.close();
      } else {
        const message =
          `Заявка на аренду\n` +
          `Подарок: ${request.gift}\n` +
          `Контакт: ${request.contact}\n` +
          `Срок: ${request.duration}\n` +
          `Комментарий: ${request.comment || "—"}`;

        content.insertAdjacentHTML(
          "beforeend",
          `<div class="notice">${escapeHTML(message).replace(/\n/g, "<br>")}</div>`
        );
      }
    });
  }

  async function openGift(gift) {
    currentGift = gift;
    currentTab = "models";

    modal.classList.remove("hidden");
    document.body.style.overflow = "hidden";

    content.innerHTML = `
      <h2>${escapeHTML(giftName(gift))}</h2>
      <div class="loading">
        <div class="spinner"></div>
        <p>Загружаем информацию…</p>
      </div>`;

    try {
      const details = await loadDetails(gift);

      content.innerHTML = `
        <div class="detail-head">
          <div class="detail-art">
            <img src="${escapeHTML(giftImage(gift))}" alt="">
          </div>
          <div>
            <h2>${escapeHTML(giftName(gift))}</h2>
            <p>Информация о подарке</p>
            <div class="detail-badges">
              <span class="detail-badge">${listFrom(details, "models").length} моделей</span>
              <span class="detail-badge">${listFrom(details, "backdrops").length} фонов</span>
              <span class="detail-badge">${listFrom(details, "symbols").length} узоров</span>
            </div>
          </div>
        </div>

        <div class="tabs">
          <button class="tab active" data-tab="models">Модели</button>
          <button class="tab" data-tab="backdrops">Фоны</button>
          <button class="tab" data-tab="symbols">Узоры</button>
        </div>

        <div id="variants" class="variant-grid"></div>

        ${requestForm(gift)}

        <p class="disclaimer">
          Данные каталога предоставляются @GiftChangesAPI.
          Наличие подарка для аренды должен подтвердить менеджер.
        </p>`;

      renderVariants(details);

      content.querySelectorAll("[data-tab]").forEach((button) => {
        button.addEventListener("click", () => {
          currentTab = button.dataset.tab;

          content.querySelectorAll("[data-tab]").forEach((tab) => {
            tab.classList.toggle("active", tab === button);
          });

          renderVariants(details);
        });
      });

      bindRequest(gift);
    } catch (error) {
      console.error("Ошибка подробностей подарка:", error);

      content.innerHTML = `
        <h2>${escapeHTML(giftName(gift))}</h2>
        <p>Не удалось загрузить подробности подарка. Попробуй ещё раз позже.</p>
        <button class="primary-btn" id="retry-detail">Повторить</button>
        ${requestForm(gift)}`;

      $("#retry-detail").addEventListener("click", () => openGift(gift));
      bindRequest(gift);
    }
  }

  function closeModal() {
    modal.classList.add("hidden");
    document.body.style.overflow = "";
  }

  modal.addEventListener("click", (event) => {
    if (event.target?.dataset?.close === "true") {
      closeModal();
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeModal();
  });

  search.addEventListener("input", render);

  $("#clear-search")?.addEventListener("click", () => {
    search.value = "";
    render();
  });

  document.querySelectorAll(".filter").forEach((button) => {
    button.addEventListener("click", () => {
      filter = button.dataset.filter;

      document.querySelectorAll(".filter").forEach((item) => {
        item.classList.toggle("active", item === button);
      });

      render();
    });
  });

  loadGifts();
})();
