const GROQ_ENDPOINT = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_MODEL    = 'llama-3.3-70b-versatile';
const MAX_TOKENS    = 256;
const CODECOGS_BASE = 'https://latex.codecogs.com/png.image?';
const CODECOGS_SVG  = 'https://latex.codecogs.com/svg.image?';
const HISTORY_MAX   = 20;
const RECENT_MAX    = 5;

const FREE_LIMITS = { symbolsPerDay: 5, formulasPerDay: 3, maxFavorites: 10 };

const SYSTEM_PROMPT =
  'You are a Unicode symbol expert. The user describes a symbol in natural ' +
  'language (French or English). Return ONLY a valid JSON array (no markdown, ' +
  'no explanation) of up to 5 matching symbols, sorted by relevance. Each object ' +
  'must have exactly these fields: symbol (the character itself), name (English ' +
  'name), unicode (e.g. U+2248). If nothing matches, return an empty array [].';

// Stricter prompt used on retry if JSON.parse fails
const SYSTEM_PROMPT_STRICT =
  'CRITICAL: Return ONLY a raw JSON array — absolutely no text before or after. ' +
  'Each object must have exactly: symbol, name, unicode. Up to 5 items. ' +
  'Example: [{"symbol":"≈","name":"Approximately equal","unicode":"U+2248"}]. ' +
  'Empty array [] if nothing matches.';

const FORMULA_SYSTEM_PROMPT =
  'You are a LaTeX math expert. The user describes a mathematical formula or expression ' +
  'in natural language (French or English). Return ONLY the raw LaTeX expression — ' +
  'no markdown fences, no $ or $$ delimiters, no \\[ \\] wrappers, no explanation. ' +
  'Just the expression itself, for example: y = 2x^2 + 5 or \\frac{a}{b} = c^2. ' +
  'If you cannot parse the input, return exactly the word ERROR.';

// ── DOM refs ───────────────────────────────────────────────────────────────────
const queryInput       = document.getElementById('query');
const searchBtn        = document.getElementById('searchBtn');
const historyBtn       = document.getElementById('historyBtn');
const historyPanel     = document.getElementById('historyPanel');
const historyList      = document.getElementById('historyList');
const clearHistoryBtn  = document.getElementById('clearHistoryBtn');
const errorMsg         = document.getElementById('errorMsg');
const errorText        = document.getElementById('errorText');
const spinner          = document.getElementById('spinner');
const recentSection    = document.getElementById('recentSection');
const recentGrid       = document.getElementById('recentGrid');
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
const formulaSkeleton  = document.getElementById('formulaSkeleton');
const formulaImg       = document.getElementById('formulaImg');
const copyLatexBtn     = document.getElementById('copyLatexBtn');
const insertLatexBtn   = document.getElementById('insertLatexBtn');
const copySvgBtn       = document.getElementById('copySvgBtn');
const copyImgBtn       = document.getElementById('copyImgBtn');
const formulaCode      = document.getElementById('formulaCode');
const upgradeBar       = document.getElementById('upgradeBar');
const upgradeBarFormula= document.getElementById('upgradeBarFormula');
const proBadge         = document.getElementById('proBadge');

// ── State ──────────────────────────────────────────────────────────────────────
let toastTimer      = null;
let favorites       = [];
let searchHistory   = []; // [{ query }]
let recentSymbols   = []; // [{ symbol, name, unicode }]
let maxResults      = 5;
let currentLatex    = '';
let groqModel       = 'llama-3.3-70b-versatile';
let prefLang        = 'both';
let debugMode       = false;
let lastRawResponse = '';
let proStatus       = false;
let todayUsage      = { date: '', symbols: 0, formulas: 0 };

// ── Freemium ───────────────────────────────────────────────────────────────────

async function loadUsage() {
  const data = await chrome.storage.local.get(['symbolgenUsage', 'symbolgenLicense']);
  const today = new Date().toISOString().slice(0, 10);
  const saved = data.symbolgenUsage;
  if (saved && saved.date === today) {
    todayUsage = saved;
  } else {
    todayUsage = { date: today, symbols: 0, formulas: 0 };
    await chrome.storage.local.set({ symbolgenUsage: todayUsage });
  }
  const license = data.symbolgenLicense || '';
  proStatus = /^SYMG-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/i.test(license);
  proBadge.classList.toggle('hidden', !proStatus);
}

function isLimitReached(type) {
  if (proStatus) return false;
  if (type === 'symbols')  return todayUsage.symbols  >= FREE_LIMITS.symbolsPerDay;
  if (type === 'formulas') return todayUsage.formulas >= FREE_LIMITS.formulasPerDay;
  return false;
}

async function incrementUsage(type) {
  if (proStatus) return;
  if (type === 'symbols')  todayUsage.symbols++;
  if (type === 'formulas') todayUsage.formulas++;
  await chrome.storage.local.set({ symbolgenUsage: todayUsage });
}

document.getElementById('upgradeSymbolsBtn').addEventListener('click', () => chrome.runtime.openOptionsPage());
document.getElementById('upgradeFormulaBtn').addEventListener('click', () => chrome.runtime.openOptionsPage());

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

// ── History ────────────────────────────────────────────────────────────────────

async function addToHistory(query) {
  searchHistory = [{ query }, ...searchHistory.filter(h => h.query !== query)].slice(0, HISTORY_MAX);
  await chrome.storage.local.set({ symbolgenHistory: searchHistory });
  renderHistory();
}

function renderHistory() {
  historyList.textContent = '';
  if (searchHistory.length === 0) {
    const li = document.createElement('li');
    li.className = 'history-empty';
    li.textContent = 'Aucun historique';
    historyList.appendChild(li);
    return;
  }
  searchHistory.forEach(({ query }) => {
    const li = document.createElement('li');
    li.className = 'history-item';
    li.textContent = query;
    li.addEventListener('click', () => {
      queryInput.value = query;
      historyPanel.classList.add('hidden');
      handleSearch();
    });
    historyList.appendChild(li);
  });
}

historyBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  historyPanel.classList.toggle('hidden');
});

clearHistoryBtn.addEventListener('click', async (e) => {
  e.stopPropagation();
  searchHistory = [];
  await chrome.storage.local.remove('symbolgenHistory');
  renderHistory();
});

document.addEventListener('click', (e) => {
  if (!historyBtn.contains(e.target) && !historyPanel.contains(e.target)) {
    historyPanel.classList.add('hidden');
  }
});

// ── Recent symbols ─────────────────────────────────────────────────────────────

async function addToRecent(item) {
  recentSymbols = [
    { symbol: item.symbol, name: item.name, unicode: item.unicode },
    ...recentSymbols.filter(r => r.unicode !== item.unicode)
  ].slice(0, RECENT_MAX);
  await chrome.storage.local.set({ symbolgenRecent: recentSymbols });
  renderRecent();
}

function renderRecent() {
  recentGrid.textContent = '';
  if (recentSymbols.length === 0 || resultsEl.children.length > 0) {
    recentSection.classList.add('hidden');
    return;
  }
  recentSection.classList.remove('hidden');
  recentSymbols.forEach(item => recentGrid.appendChild(buildCard(item, false, true)));
}

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
    if (!proStatus && favorites.length >= FREE_LIMITS.maxFavorites) {
      showError(`Limite de ${FREE_LIMITS.maxFavorites} favoris atteinte. Passez Pro pour des favoris illimités.`);
      setTimeout(hideError, 4000);
      return;
    }
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
// inFavorites: show × remove button; isRecent: compact style, no star

function buildCard(item, inFavorites = false, isRecent = false) {
  const card = document.createElement('div');
  card.className = 'result-card' + (isRecent ? ' card-recent' : '');

  const copyBtn = document.createElement('button');
  copyBtn.className = 'card-copy';
  copyBtn.title = `Copier ${item.name}`;

  const symbolEl = document.createElement('span');
  symbolEl.className = 'card-symbol';
  symbolEl.textContent = item.symbol;
  symbolEl.title = `${item.name}  ${item.unicode}`;

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
    addToRecent(item);
    copyAndInsert(item.symbol);
  });

  if (!isRecent) {
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
  } else {
    card.appendChild(copyBtn);
  }

  return card;
}

// ── Results ────────────────────────────────────────────────────────────────────

function renderResults(symbols) {
  resultsEl.textContent = '';
  recentSection.classList.add('hidden');
  if (!symbols || symbols.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'empty-state';
    empty.textContent = 'Aucun symbole trouvé.';
    resultsEl.appendChild(empty);
    return;
  }
  symbols.slice(0, maxResults).forEach(item => resultsEl.appendChild(buildCard(item, false)));
}

// ── Copy + insert ──────────────────────────────────────────────────────────────

async function copyAndInsert(symbol) {
  try {
    await navigator.clipboard.writeText(symbol);
  } catch {
    const ta = document.createElement('textarea');
    ta.value = symbol;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
  }
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.id) chrome.tabs.sendMessage(tab.id, { type: 'INSERT_SYMBOL', symbol });
  } catch { /* silent */ }
  showToast();
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
  return CODECOGS_BASE + encodeURIComponent('\\dpi{150}\\bg{white}' + latex);
}

function latexToSvgUrl(latex) {
  return CODECOGS_SVG + encodeURIComponent('\\bg{white}' + latex);
}

function renderFormula(latex) {
  currentLatex = latex;
  formulaCode.textContent = latex;

  // Show skeleton while image loads
  formulaSkeleton.classList.remove('hidden');
  formulaImg.classList.add('hidden');

  formulaImg.onload = () => {
    formulaSkeleton.classList.add('hidden');
    formulaImg.classList.remove('hidden');
  };
  formulaImg.onerror = () => {
    formulaSkeleton.classList.add('hidden');
    formulaImg.classList.remove('hidden');
  };

  formulaImg.src = latexToImgUrl(latex);
  formulaResult.classList.remove('hidden');
}

// ── API ────────────────────────────────────────────────────────────────────────

// Build symbol system prompt dynamically (lang pref + max results)
function buildSymbolPrompt() {
  const langNote = prefLang === 'fr'
    ? 'The user writes in French.'
    : prefLang === 'en'
    ? 'The user writes in English.'
    : 'The user may write in French or English.';
  return (
    `You are a Unicode symbol expert. ${langNote} ` +
    `Return ONLY a valid JSON array (no markdown, no explanation) of up to ${maxResults} matching symbols, ` +
    `sorted by relevance. Each object must have exactly: symbol (the character), name (English name), ` +
    `unicode (e.g. U+2248). If nothing matches, return [].`
  );
}

async function groqPost(apiKey, systemPrompt, userContent) {
  const response = await fetch(GROQ_ENDPOINT, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      model: groqModel,
      max_tokens: MAX_TOKENS,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user',   content: userContent }
      ]
    })
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(`Erreur API (${response.status}): ${err?.error?.message || response.statusText}`);
  }
  const data = await response.json();
  const text = data?.choices?.[0]?.message?.content;
  lastRawResponse = text?.trim() || '';
  if (!text) throw new Error('Réponse API inattendue.');
  return text.trim();
}

async function fetchSymbols(apiKey, query) {
  const parse = raw => {
    const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
    return JSON.parse(cleaned);
  };
  const raw = await groqPost(apiKey, buildSymbolPrompt(), query);
  try {
    return parse(raw);
  } catch {
    const raw2 = await groqPost(apiKey, SYSTEM_PROMPT_STRICT, query);
    return parse(raw2);
  }
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

  if (isLimitReached('symbols')) {
    upgradeBar.classList.remove('hidden');
    return;
  }

  hideError();
  upgradeBar.classList.add('hidden');
  resultsEl.textContent = '';
  recentSection.classList.add('hidden');
  historyPanel.classList.add('hidden');
  setLoading(true);

  try {
    const { apiKey } = await chrome.storage.local.get('apiKey');
    if (!apiKey) { showError('Clé API manquante.', true); return; }

    const symbols = await fetchSymbols(apiKey, query);
    await incrementUsage('symbols');
    renderResults(symbols);
    addToHistory(query);
    chrome.storage.local.set({ symbolgenLastQuery: query, symbolgenLastResults: symbols });
  } catch (err) {
    let msg = err.message || 'Une erreur est survenue.';
    if (debugMode && lastRawResponse) msg += `\n\nRéponse brute :\n${lastRawResponse}`;
    showError(msg);
  } finally {
    setLoading(false);
  }
}

async function handleFormulaSearch() {
  const query = formulaQuery.value.trim();
  if (!query) return;

  if (isLimitReached('formulas')) {
    upgradeBarFormula.classList.remove('hidden');
    return;
  }

  hideFormulaError();
  upgradeBarFormula.classList.add('hidden');
  formulaResult.classList.add('hidden');
  setFormulaLoading(true);

  try {
    const { apiKey } = await chrome.storage.local.get('apiKey');
    if (!apiKey) { showFormulaError('Clé API manquante.', true); return; }

    const latex = await fetchLatex(apiKey, query);
    await incrementUsage('formulas');
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

copySvgBtn.addEventListener('click', async () => {
  if (!currentLatex) return;
  try {
    const response = await fetch(latexToSvgUrl(currentLatex));
    if (!response.ok) throw new Error('Fetch SVG failed');
    const svgText = await response.text();
    await navigator.clipboard.writeText(svgText);
    showToast();
  } catch (err) {
    showFormulaError('Impossible de copier le SVG: ' + err.message);
  }
});

insertLatexBtn.addEventListener('click', async () => {
  if (!currentLatex) return;
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.id) {
      chrome.tabs.sendMessage(tab.id, { type: 'INSERT_SYMBOL', symbol: currentLatex });
      showToast();
    }
  } catch (err) {
    showFormulaError('Impossible d\'insérer : ' + err.message);
  }
});

copyImgBtn.addEventListener('click', async () => {
  if (!currentLatex) return;
  try {
    const response = await fetch(latexToImgUrl(currentLatex));
    if (!response.ok) throw new Error('Fetch image failed');
    const blob = await response.blob();
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
    showToast();
  } catch (err) {
    showFormulaError('Impossible de copier l\'image: ' + err.message);
  }
});

// ── Event listeners ────────────────────────────────────────────────────────────

searchBtn.addEventListener('click', handleSearch);
queryInput.addEventListener('keydown', e => { if (e.key === 'Enter') handleSearch(); });
formulaBtn.addEventListener('click', handleFormulaSearch);
formulaQuery.addEventListener('keydown', e => { if (e.key === 'Enter') handleFormulaSearch(); });

// Show recent symbols when input is cleared
queryInput.addEventListener('input', () => {
  if (queryInput.value === '' && resultsEl.children.length === 0) renderRecent();
  else recentSection.classList.add('hidden');
});

// ── Init ───────────────────────────────────────────────────────────────────────

async function init() {
  await loadUsage();

  const data = await chrome.storage.local.get([
    'symbolgenFavs',
    'symbolgenHistory',
    'symbolgenRecent',
    'symbolgenMaxResults',
    'symbolgenModel',
    'symbolgenLang',
    'symbolgenDebug',
    'symbolgenLastQuery',
    'symbolgenLastResults',
    'symbolgenLastFormulaQuery',
    'symbolgenLastLatex',
    'symbolgenActiveTab'
  ]);

  favorites      = data.symbolgenFavs        || [];
  searchHistory  = data.symbolgenHistory     || [];
  recentSymbols  = data.symbolgenRecent      || [];
  maxResults     = data.symbolgenMaxResults  || 5;
  groqModel      = data.symbolgenModel       || 'llama-3.3-70b-versatile';
  prefLang       = data.symbolgenLang        || 'both';
  debugMode      = data.symbolgenDebug       || false;

  renderHistory();

  if (data.symbolgenLastQuery) {
    queryInput.value = data.symbolgenLastQuery;
  }
  if (data.symbolgenLastResults?.length > 0) {
    renderResults(data.symbolgenLastResults);
  } else {
    renderRecent();
  }

  if (data.symbolgenLastFormulaQuery) formulaQuery.value = data.symbolgenLastFormulaQuery;
  if (data.symbolgenLastLatex)        renderFormula(data.symbolgenLastLatex);

  renderFavorites();

  if (data.symbolgenActiveTab === 'formula') switchTab('formula');
}

init();
