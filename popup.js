const GROQ_ENDPOINT = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_MODEL    = 'llama-3.3-70b-versatile';
const MAX_TOKENS    = 256;

const SYSTEM_PROMPT =
  'You are a Unicode symbol expert. The user describes a symbol in natural ' +
  'language (French or English). Return ONLY a valid JSON array (no markdown, ' +
  'no explanation) of up to 5 matching symbols, sorted by relevance. Each object ' +
  'must have exactly these fields: symbol (the character itself), name (English ' +
  'name), unicode (e.g. U+2248). If nothing matches, return an empty array [].';

const queryInput      = document.getElementById('query');
const searchBtn       = document.getElementById('searchBtn');
const errorMsg        = document.getElementById('errorMsg');
const errorText       = document.getElementById('errorText');
const spinner         = document.getElementById('spinner');
const resultsEl       = document.getElementById('results');
const toast           = document.getElementById('toast');
const favSection      = document.getElementById('favoritesSection');
const favGrid         = document.getElementById('favoritesGrid');
const favCount        = document.getElementById('favCount');

let toastTimer = null;
let favorites  = []; // [{ symbol, name, unicode }]

// ── Favorites ─────────────────────────────────────────────────────────────────

function isFavorite(unicode) {
  return favorites.some(f => f.unicode === unicode);
}

async function saveFavorites() {
  await chrome.storage.local.set({ symbolgenFavs: favorites });
}

async function toggleFavorite(item) {
  if (isFavorite(item.unicode)) {
    favorites = favorites.filter(f => f.unicode !== item.unicode);
  } else {
    favorites.push({ symbol: item.symbol, name: item.name, unicode: item.unicode });
  }
  await saveFavorites();
  renderFavorites();
  // Update star buttons in the results section
  document.querySelectorAll('.star-btn[data-unicode]').forEach(btn => {
    if (btn.dataset.unicode === item.unicode) syncStarBtn(btn, item.unicode);
  });
}

function syncStarBtn(btn, unicode) {
  const starred = isFavorite(unicode);
  btn.textContent = starred ? '★' : '☆';
  btn.classList.toggle('starred', starred);
  btn.title = starred ? 'Retirer des favoris' : 'Ajouter aux favoris';
}

function renderFavorites() {
  favGrid.textContent = '';
  if (favorites.length === 0) {
    favSection.classList.add('hidden');
    return;
  }
  favSection.classList.remove('hidden');
  favCount.textContent = favorites.length;
  favorites.forEach(item => favGrid.appendChild(buildCard(item, true)));
}

// ── Card builder ───────────────────────────────────────────────────────────────
// Outer div — prevents nested <button> issue when star sits inside a copy button.

function buildCard(item, inFavorites = false) {
  const card = document.createElement('div');
  card.className = 'result-card';

  // Copy zone
  const copyBtn = document.createElement('button');
  copyBtn.className = 'card-copy';
  copyBtn.title = `Copier ${item.name}`;

  const symbolEl = document.createElement('span');
  symbolEl.className = 'card-symbol';
  symbolEl.textContent = item.symbol;

  const metaEl = document.createElement('div');
  metaEl.className = 'card-meta';

  const nameEl = document.createElement('span');
  nameEl.className = 'card-name';
  nameEl.textContent = item.name;

  const codeEl = document.createElement('span');
  codeEl.className = 'card-code';
  codeEl.textContent = item.unicode;

  metaEl.appendChild(nameEl);
  metaEl.appendChild(codeEl);
  copyBtn.appendChild(symbolEl);
  copyBtn.appendChild(metaEl);

  copyBtn.addEventListener('click', () => {
    navigator.clipboard.writeText(item.symbol).then(showToast).catch(() => {
      const ta = document.createElement('textarea');
      ta.value = item.symbol;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      showToast();
    });
  });

  // Action button: star (results) or × (favorites)
  const actionBtn = document.createElement('button');
  if (inFavorites) {
    actionBtn.className = 'remove-btn';
    actionBtn.textContent = '×';
    actionBtn.title = 'Retirer des favoris';
    actionBtn.addEventListener('click', () => toggleFavorite(item));
  } else {
    actionBtn.className = 'star-btn';
    actionBtn.dataset.unicode = item.unicode;
    syncStarBtn(actionBtn, item.unicode);
    actionBtn.addEventListener('click', () => toggleFavorite(item));
  }

  card.appendChild(copyBtn);
  card.appendChild(actionBtn);
  return card;
}

// ── Results ────────────────────────────────────────────────────────────────────

function renderResults(symbols) {
  resultsEl.textContent = '';
  if (!symbols || symbols.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'empty-state';
    empty.textContent = 'Aucun symbole trouvé.';
    resultsEl.appendChild(empty);
    return;
  }
  symbols.slice(0, 5).forEach(item => resultsEl.appendChild(buildCard(item, false)));
}

// ── UI helpers ─────────────────────────────────────────────────────────────────

function showError(msg, withLink = false) {
  errorText.innerHTML = '';
  errorText.textContent = msg;
  if (withLink) {
    const link = document.createElement('a');
    link.href = '#';
    link.textContent = ' → Configurer la clé API';
    link.addEventListener('click', (e) => {
      e.preventDefault();
      chrome.runtime.openOptionsPage();
    });
    errorText.appendChild(link);
  }
  errorMsg.classList.remove('hidden');
}

function hideError() {
  errorMsg.classList.add('hidden');
  errorText.innerHTML = '';
}

function setLoading(isLoading) {
  spinner.classList.toggle('hidden', !isLoading);
  searchBtn.disabled = isLoading;
  queryInput.disabled = isLoading;
}

function showToast() {
  toast.classList.remove('hidden');
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.add('hidden'), 1800);
}

// ── API ────────────────────────────────────────────────────────────────────────

async function fetchSymbols(apiKey, query) {
  const response = await fetch(GROQ_ENDPOINT, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'content-type':  'application/json'
    },
    body: JSON.stringify({
      model: GROQ_MODEL,
      max_tokens: MAX_TOKENS,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: query }
      ]
    })
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    const detail = errData?.error?.message || response.statusText;
    throw new Error(`Erreur API (${response.status}): ${detail}`);
  }

  const data = await response.json();
  const rawText = data?.choices?.[0]?.message?.content;
  if (!rawText) throw new Error('Réponse API inattendue.');

  const cleaned = rawText.trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '');
  return JSON.parse(cleaned);
}

// ── Search handler ─────────────────────────────────────────────────────────────

async function handleSearch() {
  const query = queryInput.value.trim();
  if (!query) return;

  hideError();
  resultsEl.textContent = '';
  setLoading(true);

  try {
    const { apiKey } = await chrome.storage.local.get('apiKey');
    if (!apiKey) {
      showError('Clé API manquante.', true);
      return;
    }

    const symbols = await fetchSymbols(apiKey, query);
    renderResults(symbols);
    // Persist last search so it survives popup close/reopen
    chrome.storage.local.set({ symbolgenLastQuery: query, symbolgenLastResults: symbols });
  } catch (err) {
    showError(err.message || 'Une erreur est survenue.');
  } finally {
    setLoading(false);
  }
}

// ── Init ───────────────────────────────────────────────────────────────────────

async function init() {
  const data = await chrome.storage.local.get([
    'symbolgenFavs',
    'symbolgenLastQuery',
    'symbolgenLastResults'
  ]);

  favorites = data.symbolgenFavs || [];

  if (data.symbolgenLastQuery) {
    queryInput.value = data.symbolgenLastQuery;
  }
  if (data.symbolgenLastResults?.length > 0) {
    renderResults(data.symbolgenLastResults);
  }

  renderFavorites();
}

searchBtn.addEventListener('click', handleSearch);
queryInput.addEventListener('keydown', e => { if (e.key === 'Enter') handleSearch(); });

init();
