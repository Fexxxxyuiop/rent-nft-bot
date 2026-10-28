
const API = 'https://nft-rent-api.dragonpej5.workers.dev';
const SOURCE = 'https://api.changes.tg/gifts';

const $ = id => document.getElementById(id);
const state = { gifts: [], token: '' };

const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;',
  '"': '&quot;', "'": '&#39;'
}[c]));

const price = gift =>
  gift.price_per_day
    ? `${gift.price_per_day} TON / сутки`
    : 'Цена уточняется';

function showError(message) {
  const status = $('catalog-status');
  const grid = $('gift-grid');
  if (status) status.textContent = message;
  if (grid) {
    grid.innerHTML = `
      <div class="empty">
        <p>Не удалось загрузить каталог.</p>
        <p>${esc(message)}</p>
        <button id="retry-catalog" type="button">Попробовать снова</button>
      </div>`;
    $('retry-catalog').onclick = load;
  }
}

function modal(id) {
  $(id)?.classList.remove('hidden');
}

function close(id) {
  $(id)?.classList.add('hidden');
}

document.addEventListener('DOMContentLoaded', init);

function init() {
  if ($('year')) $('year').textContent = new Date().getFullYear();

  document.querySelectorAll('[data-close]').forEach(button => {
    button.onclick = () => close(button.dataset.close);
  });

  document.querySelectorAll('.modal').forEach(element => {
    element.onclick = event => {
      if (event.target === element) close(element.id);
    };
  });

  if ($('search')) $('search').oninput = render;
  if ($('sort')) $('sort').onchange = render;

  if ($('request-form')) {
    $('request-form').onsubmit = submitRequest;
  }

  if ($('admin-open')) {
    $('admin-open').onclick = () => modal('admin-modal');
  }

  if ($('admin-login-button')) {
    $('admin-login-button').onclick = loginAdmin;
  }

  if ($('refresh-requests')) {
    $('refresh-requests').onclick = adminLoad;
  }

  if ($('admin-logout')) {
    $('admin-logout').onclick = () => {
      state.token = '';
      if ($('admin-password')) $('admin-password').value = '';
      $('admin-content')?.classList.add('hidden');
      $('admin-login')?.classList.remove('hidden');
    };
  }

  load();
}

function normalize(raw) {
  if (Array.isArray(raw)) return raw;
  if (raw && Array.isArray(raw.gifts)) return raw.gifts;
  if (raw && Array.isArray(raw.data)) return raw.data;
  if (raw && Array.isArray(raw.items)) return raw.items;
  if (raw && raw.data && Array.isArray(raw.data.gifts)) {
    return raw.data.gifts;
  }
  throw new Error('Формат каталога не распознан');
}

function normalizeGift(item, index) {
  if (typeof item === 'string') {
    return { id: item, name: item };
  }

  const name = item.name || item.title ||
    item.gift_name || item.slug || item.id || `Gift ${index + 1}`;

  return {
    ...item,
    id: String(item.id || name),
    name: String(name),
    image_url: item.image_url || item.image ||
      item.photo_url || item.thumbnail || ''
  };
}

async function load() {
  const status = $('catalog-status');
  const grid = $('gift-grid');

  if (status) status.textContent = 'Загрузка каталога…';
  if (grid) grid.innerHTML = '<p>Загружаем подарки…</p>';

  try {
    const response = await fetch(SOURCE);
    if (!response.ok) {
      throw new Error(`Источник ответил: HTTP ${response.status}`);
    }

    const raw = await response.json();
    const gifts = normalize(raw).map(normalizeGift);

    if (!gifts.length) {
      throw new Error('Источник вернул пустой список');
    }

    state.gifts = gifts;

    // Подмешиваем цены из своей базы, если они настроены.
    try {
      const pricesResponse = await fetch(`${API}/api/gifts`);
      if (pricesResponse.ok) {
        const data = await pricesResponse.json();
        const prices = Array.isArray(data)
          ? data
          : Array.isArray(data.gifts) ? data.gifts : [];

        const map = new Map(
          prices.map(item => [
            String(item.name || '').toLowerCase(),
            item
          ])
        );

        state.gifts = state.gifts.map(gift => ({
          ...gift,
          ...(map.get(gift.name.toLowerCase()) || {})
        }));
      }
    } catch (error) {
      console.warn('Цены из базы пока недоступны:', error);
    }

    render();
  } catch (error) {
    console.error('Ошибка каталога:', error);
    showError(
      error instanceof TypeError
        ? 'Возможна блокировка CORS или ошибка сети.'
        : error.message || 'Неизвестная ошибка'
    );
  }
}

function render() {
  const grid = $('gift-grid');
  if (!grid) return;

  const query = ($('search')?.value || '').trim().toLowerCase();
  const sort = $('sort')?.value || 'name';

  const list = state.gifts.filter(gift =>
    gift.name.toLowerCase().includes(query)
  );

  list.sort((a, b) => {
    if (sort === 'price') {
      const pa = Number(a.price_per_day) || Infinity;
      const pb = Number(b.price_per_day) || Infinity;
      return pa - pb;
    }
    return a.name.localeCompare(b.name, 'ru');
  });

  if ($('gift-count')) $('gift-count').textContent = state.gifts.length;
  if ($('catalog-status')) {
    $('catalog-status').textContent =
      `Показано ${list.length} из ${state.gifts.length}`;
  }

  grid.innerHTML = list.length
    ? list.map(gift => `
      <article class="gift">
        <div class="art">
          ${gift.image_url
            ? `<img src="${esc(gift.image_url)}"
                alt="${esc(gift.name)}" loading="lazy"
                onerror="this.style.display='none'">`
            : '🎁'}
        </div>
        <div class="info">
          <div class="name">${esc(gift.name)}</div>
          <div class="price">${esc(price(gift))}</div>
          <div class="note">Стоимость подтверждается менеджером</div>
          <button type="button" data-gift="${esc(gift.name)}">
            Оставить заявку
          </button>
        </div>
      </article>`).join('')
    : '<p>По твоему запросу подарки не найдены.</p>';

  grid.querySelectorAll('[data-gift]').forEach(button => {
    button.onclick = () => {
      const gift = state.gifts.find(
        item => item.name === button.dataset.gift
      );
      if (!gift) return;

      $('gift-name').value = gift.name;
      $('selected-gift').textContent =
        `${gift.name} · ${price(gift)}`;
      $('request-message').textContent = '';
      modal('request-modal');
    };
  });
}

async function submitRequest(event) {
  event.preventDefault();

  const button = event.submitter;
  if (button) {
    button.disabled = true;
    button.textContent = 'Отправляем…';
  }

  try {
    const response = await fetch(`${API}/api/requests`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        gift_name: $('gift-name').value,
        duration: $('duration').value,
        telegram: $('telegram').value,
        comment: $('comment').value
      })
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || 'Ошибка сервера');
    }

    $('request-message').textContent =
      `Заявка №${data.id} сохранена.`;
    $('request-form').reset();
  } catch (error) {
    $('request-message').textContent =
      `Не удалось отправить заявку: ${error.message}`;
  } finally {
    if (button) {
      button.disabled = false;
      button.textContent = 'Отправить заявку';
    }
  }
}

async function loginAdmin() {
  state.token = $('admin-password').value;

  try {
    await adminLoad();
    $('admin-login').classList.add('hidden');
    $('admin-content').classList.remove('hidden');
    $('admin-login-message').textContent = '';
  } catch (error) {
    state.token = '';
    $('admin-login-message').textContent = error.message;
  }
}

async function adminLoad() {
  const response = await fetch(`${API}/api/requests`, {
    headers: { Authorization: `Bearer ${state.token}` }
  });

  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Ошибка входа');

  const requests = data.requests || [];
  $('admin-summary').textContent = `Всего заявок: ${requests.length}`;

  $('admin-requests').innerHTML = requests.length
    ? requests.map(request => `
      <div class="request">
        <b>№${esc(request.id)} · ${esc(request.gift_name)} · ${esc(request.status)}</b>
        <p>
          Telegram: ${esc(request.telegram)}<br>
          Срок: ${esc(request.duration)}<br>
          Комментарий: ${esc(request.comment || '—')}<br>
          Дата: ${esc(request.created_at)}
        </p>
        <select data-status="${esc(request.id)}">
          ${['new', 'contacted', 'confirmed', 'closed'].map(status =>
            `<option value="${status}" ${request.status === status ? 'selected' : ''}>${status}</option>`
          ).join('')}
        </select>
        <button type="button" data-save="${esc(request.id)}">Сохранить</button>
      </div>`).join('')
    : 'Заявок пока нет';

  $('admin-requests').querySelectorAll('[data-save]').forEach(button => {
    button.onclick = async () => {
      const id = button.dataset.save;
      const status = document.querySelector(`[data-status="${id}"]`).value;

      const result = await fetch(`${API}/api/requests/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${state.token}`
        },
        body: JSON.stringify({ status })
      });

      const body = await result.json();
      if (!result.ok) {
        alert(body.error || 'Не удалось обновить заявку');
        return;
      }

      await adminLoad();
    };
  });
}
