const GROQ_ENDPOINT = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_MODEL    = 'llama-3.3-70b-versatile';
const MAX_TOKENS    = 256;
const CODECOGS_BASE = 'https://latex.codecogs.com/png.image?';

const SYSTEM_PROMPT =
  'You are a Unicode symbol expert. The user describes a symbol in natural ' +
  'language (French or English). Return ONLY a valid JSON array (no markdown, ' +
  'no explanation) of up to 5 matching symbols, sorted by relevance. Each object ' +
  'must have exactly these fields: symbol (the character itself), name (English ' +
  'name), unicode (e.g. U+2248). If nothing matches, return an empty array [].';

const FORMULA_SYSTEM_PROMPT =
  'You are a LaTeX math expert. The user describes a mathematical formula or expression ' +
  'in natural language (French or English). Return ONLY the raw LaTeX expression — ' +
  'no markdown fences, no $ or $$ delimiters, no \\[ \\] wrappers, no explanation. ' +
  'Just the expression itself, for example: y = 2x^2 + 5 or \\frac{a}{b} = c^2. ' +
  'If you cannot parse the input, return exactly the word ERROR.';

// ── DOM refs ───────────────────────────────────────────────────────────────────
const queryInput       = document.getElementById('query');
const searchBtn        = document.getElementById('searchBtn');
const errorMsg         = document.getElementById('errorMsg');
const errorText        = document.getElementById('errorText');
const spinner          = document.getElementById('spinner');
const resultsEl        = document.getElementById('results');
const favSection       = document.getElementById('favoritesSection');
const favGrid          = document.getElementById('favoritesGrid');
const favCount         = document.getElementById('favCount');
const toast            = document.getElementById('toast');

const formulaQuery     = document.getElementById('formulaQuery');
const formulaBtn       = document.getElementById('formulaBtn');
const formulaError     = document.getElementById('formulaError');
const formulaErrorText = document.getElementById('formulaErrorText');
const formulaSpinner   = document.getElementById('formulaSpinner');
const formulaResult    = document.getElementById('formulaResult');
const formulaImg       = document.getElementById('formulaImg');
const copyLatexBtn     = document.getElementById('copyLatexBtn');
const copyImgBtn       = document.getElementById('copyImgBtn');
const formulaCode      = document.getElementById('formulaCode');

// ── State ──────────────────────────────────────────────────────────────────────
let toastTimer   = null;
let favorites    = [];
let currentLatex = '';

// ── Tabs ───────────────────────────────────────────────────────────────────────

function switchTab(tabName) {
  document.querySelectorAll('.tab').forEach(t => {
    t.classList.toggle('active', t.dataset.tab === tabName);
  });
  document.getElementById('symbolsPane').classList.toggle('hidden', tabName !== 'symbols');
  document.getElementById('formulaPane').classList.toggle('hidden', tabName !== 'formula');
  chrome.storage.local.set({ symbolgenActiveTab: tabName });
  if (tabName === 'formula') formulaQuery.focus();
  else queryInput.focus();
}

document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => switchTab(tab.dataset.tab));
});

// ── Favorites ──────────────────────────────────────────────────────────────────

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

function buildCard(item, inFavorites = false) {
  const card = document.createElement('div');
  card.className = 'result-card';

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

// ── Symbols results ────────────────────────────────────────────────────────────

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
    link.addEventListener('click', e => { e.preventDefault(); chrome.runtime.openOptionsPage(); });
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

function showFormulaError(msg, withLink = false) {
  formulaErrorText.innerHTML = '';
  formulaErrorText.textContent = msg;
  if (withLink) {
    const link = document.createElement('a');
    link.href = '#';
    link.textContent = ' → Configurer la clé API';
    link.addEventListener('click', e => { e.preventDefault(); chrome.runtime.openOptionsPage(); });
    formulaErrorText.appendChild(link);
  }
  formulaError.classList.remove('hidden');
}

function hideFormulaError() {
  formulaError.classList.add('hidden');
  formulaErrorText.innerHTML = '';
}

function setFormulaLoading(isLoading) {
  formulaSpinner.classList.toggle('hidden', !isLoading);
  formulaBtn.disabled = isLoading;
  formulaQuery.disabled = isLoading;
}

function showToast() {
  toast.classList.remove('hidden');
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.add('hidden'), 1800);
}

// ── Formula rendering ──────────────────────────────────────────────────────────

function latexToImgUrl(latex) {
  // \dpi{150} = resolution, \bg{white} = white background always readable
  return CODECOGS_BASE + encodeURIComponent('\\dpi{150}\\bg{white}' + latex);
}

function renderFormula(latex) {
  currentLatex = latex;
  formulaImg.src = latexToImgUrl(latex);
  formulaCode.textContent = latex;
  formulaResult.classList.remove('hidden');
}

// ── API calls ──────────────────────────────────────────────────────────────────

async function groqPost(apiKey, systemPrompt, userContent, maxTokens = MAX_TOKENS) {
  const response = await fetch(GROQ_ENDPOINT, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      model: GROQ_MODEL,
      max_tokens: maxTokens,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user',   content: userContent }
      ]
    })
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(`Erreur API (${response.status}): ${errData?.error?.message || response.statusText}`);
  }

  const data = await response.json();
  const text = data?.choices?.[0]?.message?.content;
  if (!text) throw new Error('Réponse API inattendue.');
  return text.trim();
}

async function fetchSymbols(apiKey, query) {
  const raw = await groqPost(apiKey, SYSTEM_PROMPT, query);
  const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  return JSON.parse(cleaned);
}

async function fetchLatex(apiKey, query) {
  const raw = await groqPost(apiKey, FORMULA_SYSTEM_PROMPT, query);
  if (raw === 'ERROR') throw new Error('Formule non reconnue. Essayez de reformuler.');
  return raw;
}

// ── Search handlers ────────────────────────────────────────────────────────────

async function handleSearch() {
  const query = queryInput.value.trim();
  if (!query) return;

  hideError();
  resultsEl.textContent = '';
  setLoading(true);

  try {
    const { apiKey } = await chrome.storage.local.get('apiKey');
    if (!apiKey) { showError('Clé API manquante.', true); return; }

    const symbols = await fetchSymbols(apiKey, query);
    renderResults(symbols);
    chrome.storage.local.set({ symbolgenLastQuery: query, symbolgenLastResults: symbols });
  } catch (err) {
    showError(err.message || 'Une erreur est survenue.');
  } finally {
    setLoading(false);
  }
}

async function handleFormulaSearch() {
  const query = formulaQuery.value.trim();
  if (!query) return;

  hideFormulaError();
  formulaResult.classList.add('hidden');
  setFormulaLoading(true);

  try {
    const { apiKey } = await chrome.storage.local.get('apiKey');
    if (!apiKey) { showFormulaError('Clé API manquante.', true); return; }

    const latex = await fetchLatex(apiKey, query);
    renderFormula(latex);
    chrome.storage.local.set({ symbolgenLastFormulaQuery: query, symbolgenLastLatex: latex });
  } catch (err) {
    showFormulaError(err.message || 'Une erreur est survenue.');
  } finally {
    setFormulaLoading(false);
  }
}

// ── Copy formula ───────────────────────────────────────────────────────────────

copyLatexBtn.addEventListener('click', () => {
  if (!currentLatex) return;
  navigator.clipboard.writeText(currentLatex).then(showToast).catch(() => {
    const ta = document.createElement('textarea');
    ta.value = currentLatex;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    showToast();
  });
});

copyImgBtn.addEventListener('click', async () => {
  if (!currentLatex) return;
  try {
    const response = await fetch(latexToImgUrl(currentLatex));
    if (!response.ok) throw new Error('Erreur lors du téléchargement de l\'image.');
    const blob = await response.blob();
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
    showToast();
  } catch (err) {
    showFormulaError(err.message);
  }
});

// ── Event listeners ────────────────────────────────────────────────────────────

searchBtn.addEventListener('click', handleSearch);
queryInput.addEventListener('keydown', e => { if (e.key === 'Enter') handleSearch(); });
formulaBtn.addEventListener('click', handleFormulaSearch);
formulaQuery.addEventListener('keydown', e => { if (e.key === 'Enter') handleFormulaSearch(); });

// ── Init ───────────────────────────────────────────────────────────────────────

async function init() {
  const data = await chrome.storage.local.get([
    'symbolgenFavs',
    'symbolgenLastQuery',
    'symbolgenLastResults',
    'symbolgenLastFormulaQuery',
    'symbolgenLastLatex',
    'symbolgenActiveTab'
  ]);

  favorites = data.symbolgenFavs || [];

  if (data.symbolgenLastQuery)         queryInput.value  = data.symbolgenLastQuery;
  if (data.symbolgenLastResults?.length > 0) renderResults(data.symbolgenLastResults);

  if (data.symbolgenLastFormulaQuery)  formulaQuery.value = data.symbolgenLastFormulaQuery;
  if (data.symbolgenLastLatex)         renderFormula(data.symbolgenLastLatex);

  renderFavorites();

  if (data.symbolgenActiveTab === 'formula') switchTab('formula');
}

init();
