const apiKeyInput     = document.getElementById('apiKeyInput');
const maxResultsInput = document.getElementById('maxResultsInput');
const maxResultsVal   = document.getElementById('maxResultsVal');
const langSelect      = document.getElementById('langSelect');
const modelSelect     = document.getElementById('modelSelect');
const debugToggle     = document.getElementById('debugToggle');
const saveStatus      = document.getElementById('saveStatus');
const licenseInput    = document.getElementById('licenseInput');
const licenseStatus   = document.getElementById('licenseStatus');
const proStatusBadge  = document.getElementById('proStatusBadge');

let statusTimer = null;
let licenseTimer = null;

function showStatus(msg, isError = false) {
  saveStatus.textContent = msg;
  saveStatus.className = 'save-status ' + (isError ? 'status-error' : 'status-ok');
  if (statusTimer) clearTimeout(statusTimer);
  statusTimer = setTimeout(() => { saveStatus.className = 'save-status hidden'; }, 2500);
}

function showLicenseStatus(msg, isError = false) {
  licenseStatus.textContent = msg;
  licenseStatus.className = 'save-status ' + (isError ? 'status-error' : 'status-ok');
  if (licenseTimer) clearTimeout(licenseTimer);
  licenseTimer = setTimeout(() => { licenseStatus.className = 'save-status hidden'; }, 3000);
}

function isValidLicenseFormat(key) {
  return /^SYMG-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/i.test(key.trim());
}

function syncProBadge(isActive) {
  proStatusBadge.classList.toggle('hidden', !isActive);
}

// Load saved settings
chrome.storage.local.get([
  'apiKey',
  'symbolgenMaxResults',
  'symbolgenLang',
  'symbolgenModel',
  'symbolgenDebug',
  'symbolgenLicense'
]).then((data) => {
  if (data.apiKey)             apiKeyInput.value     = data.apiKey;
  const n = data.symbolgenMaxResults || 5;
  maxResultsInput.value = n;
  maxResultsVal.textContent = n;
  if (data.symbolgenLang)      langSelect.value      = data.symbolgenLang;
  if (data.symbolgenModel)     modelSelect.value     = data.symbolgenModel;
  if (data.symbolgenDebug)     debugToggle.checked   = data.symbolgenDebug;
  if (data.symbolgenLicense)   licenseInput.value    = data.symbolgenLicense;
  syncProBadge(isValidLicenseFormat(data.symbolgenLicense || ''));
});

maxResultsInput.addEventListener('input', () => {
  maxResultsVal.textContent = maxResultsInput.value;
});

document.getElementById('optionsForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const key = apiKeyInput.value.trim();
  if (!key) { showStatus('Veuillez entrer une clé valide.', true); return; }
  await chrome.storage.local.set({
    apiKey:               key,
    symbolgenMaxResults:  parseInt(maxResultsInput.value, 10),
    symbolgenLang:        langSelect.value,
    symbolgenModel:       modelSelect.value,
    symbolgenDebug:       debugToggle.checked
  });
  showStatus('Paramètres enregistrés.');
});

document.getElementById('clearBtn').addEventListener('click', async () => {
  await chrome.storage.local.remove('apiKey');
  apiKeyInput.value = '';
  showStatus('Clé effacée.');
});

document.getElementById('activateBtn').addEventListener('click', async () => {
  const key = licenseInput.value.trim().toUpperCase();
  if (!key) { showLicenseStatus('Entrez une clé de licence.', true); return; }
  if (!isValidLicenseFormat(key)) {
    showLicenseStatus('Format invalide. Ex: SYMG-ABCD-1234-XY56', true);
    return;
  }
  await chrome.storage.local.set({ symbolgenLicense: key });
  licenseInput.value = key;
  syncProBadge(true);
  showLicenseStatus('Licence Pro activée !');
});
