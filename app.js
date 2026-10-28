
const API = 'https://nft-rent-api.dragonpej5.workers.dev';
const SOURCE = 'https://api.changes.tg/gifts';

const $ = id => document.getElementById(id);
const state = { gifts: [], token: '' };

const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;',
  '"': '&quot;', "'": '&#39;'
}[c]));

function findImage(obj, depth = 0) {
  if (!obj || typeof obj !== 'object' || depth > 4) return '';

  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'string' &&
        /image|photo|thumbnail|sticker|picture|animation/i.test(key) &&
        /^https?:\/\//i.test(value)) {
      return value;
    }
  }

  for (const value of Object.values(obj)) {
    if (value && typeof value === 'object') {
      const found = findImage(value, depth + 1);
      if (found) return found;
    }
  }

  return '';
}

function normalize(raw) {
  if (Array.isArray(raw)) return raw;
  for (const key of ['gifts', 'data', 'items', 'results']) {
    if (Array.isArray(raw?.[key])) return raw[key];
  }
  if (Array.isArray(raw?.data?.gifts)) return raw.data.gifts;
  throw new Error('Не удалось прочитать список подарков');
}

function normalizeGift(item, index) {
  if (typeof item === 'string') {
    return { id: item, name: item, image: '' };
  }

  return {
    ...item,
    id: String(item.id || item.name || index),
    name: String(item.name || item.title || item.id || `Gift ${index + 1}`),
    image: findImage(item)
  };
}

function showError(message) {
  if ($('catalog-status')) $('catalog-status').textContent = message;
  if ($('gift-grid')) {
    $('gift-grid').innerHTML =
      `<p>${esc(message)} <button id="retry">Повторить</button></p>`;
    $('retry').onclick = load;
  }
}

async function load() {
  if ($('catalog-status')) $('catalog-status').textContent = 'Загрузка подарков…';
  if ($('gift-grid')) $('gift-grid').innerHTML = '<p>Загрузка…</p>';

  try {
    const response = await fetch(SOURCE);
    if (!response.ok) throw new Error(`Ошибка API: ${response.status}`);

    state.gifts = normalize(await response.json()).map(normalizeGift);

    try {
      const responsePrices = await fetch(`${API}/api/gifts`);
      if (responsePrices.ok) {
        const data = await responsePrices.json();
        const prices = normalize(data);
        const byName = new Map(prices.map(g => [
          String(g.name || '').toLowerCase(), g
        ]));

        state.gifts = state.gifts.map(g => ({
          ...g,
          ...(byName.get(g.name.toLowerCase()) || {}),
          image: g.image || findImage(byName.get(g.name.toLowerCase()))
        }));
      }
    } catch (e) {
      console.warn('Цены пока недоступны', e);
    }

    render();
  } catch (error) {
    console.error(error);
    showError('Не удалось загрузить каталог: ' + error.message);
  }
}

function render() {
  const grid = $('gift-grid');
  if (!grid) return;

  const query = ($('search')?.value || '').toLowerCase().trim();
  let gifts = state.gifts.filter(g => g.name.toLowerCase().includes(query));

  if ($('sort')?.value === 'price') {
    gifts.sort((a, b) =>
      (Number(a.price_per_day) || Infinity) -
      (Number(b.price_per_day) || Infinity)
    );
  } else {
    gifts.sort((a, b) => a.name.localeCompare(b.name));
  }

  if ($('gift-count')) $('gift-count').textContent = state.gifts.length;
  if ($('catalog-status')) {
    $('catalog-status').textContent = `Подарков: ${gifts.length}`;
  }

  grid.innerHTML = gifts.map(g => `
    <article class="gift">
      <div class="art">
        ${g.image
          ? `<img src="${esc(g.image)}" alt="${esc(g.name)}"
                 loading="lazy" style="width:100%;height:100%;object-fit:contain"
                 onerror="this.style.display='none';this.nextElementSibling.style.display='block'">
             <span style="display:none">🎁</span>`
          : '<span>🎁</span>'}
      </div>
      <div class="info">
        <div class="name">${esc(g.name)}</div>
        <div class="price">${
          g.price_per_day
            ? esc(g.price_per_day) + ' TON / сутки'
            : 'Цена уточняется'
        }</div>
        <button type="button" data-gift="${esc(g.name)}">Оставить заявку</button>
      </div>
    </article>
  `).join('') || '<p>Подарки не найдены.</p>';

  grid.querySelectorAll('[data-gift]').forEach(button => {
    button.onclick = () => {
      if ($('gift-name')) $('gift-name').value = button.dataset.gift;
      if ($('selected-gift')) $('selected-gift').textContent = button.dataset.gift;
      if ($('request-message')) $('request-message').textContent = '';
      $('request-modal')?.classList.remove('hidden');
    };
  });
}

async function submitRequest(event) {
  event.preventDefault();
  const button = event.submitter;
  if (button) button.disabled = true;

  try {
    const response = await fetch(`${API}/api/requests`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        gift_name: $('gift-name')?.value,
        duration: $('duration')?.value,
        telegram: $('telegram')?.value,
        comment: $('comment')?.value
      })
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Ошибка отправки');

    if ($('request-message')) {
      $('request-message').textContent = 'Заявка отправлена!';
    }
  } catch (error) {
    if ($('request-message')) {
      $('request-message').textContent = 'Ошибка: ' + error.message;
    }
  } finally {
    if (button) button.disabled = false;
  }
}

document.addEventListener('DOMContentLoaded', () => {
  if ($('year')) $('year').textContent = new Date().getFullYear();

  document.querySelectorAll('[data-close]').forEach(button => {
    button.onclick = () =>
      $(button.dataset.close)?.classList.add('hidden');
  });

  document.querySelectorAll('.modal').forEach(m => {
    m.onclick = e => {
      if (e.target === m) m.classList.add('hidden');
    };
  });

  if ($('search')) $('search').addEventListener('input', render);
  if ($('sort')) $('sort').addEventListener('change', render);
  if ($('request-form')) $('request-form').addEventListener('submit', submitRequest);

  load();
});
