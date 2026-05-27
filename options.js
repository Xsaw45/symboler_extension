const apiKeyInput     = document.getElementById('apiKeyInput');
const maxResultsInput = document.getElementById('maxResultsInput');
const maxResultsVal   = document.getElementById('maxResultsVal');
const saveStatus      = document.getElementById('saveStatus');

let statusTimer = null;

function showStatus(msg, isError = false) {
  saveStatus.textContent = msg;
  saveStatus.className = 'save-status ' + (isError ? 'status-error' : 'status-ok');
  if (statusTimer) clearTimeout(statusTimer);
  statusTimer = setTimeout(() => { saveStatus.className = 'save-status hidden'; }, 2500);
}

// Load saved settings
chrome.storage.local.get(['apiKey', 'symbolgenMaxResults']).then((data) => {
  if (data.apiKey) apiKeyInput.value = data.apiKey;
  const saved = data.symbolgenMaxResults || 5;
  maxResultsInput.value = saved;
  maxResultsVal.textContent = saved;
});

// Live preview of slider value
maxResultsInput.addEventListener('input', () => {
  maxResultsVal.textContent = maxResultsInput.value;
});

document.getElementById('optionsForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const key = apiKeyInput.value.trim();
  if (!key) { showStatus('Veuillez entrer une clé valide.', true); return; }
  await chrome.storage.local.set({
    apiKey: key,
    symbolgenMaxResults: parseInt(maxResultsInput.value, 10)
  });
  showStatus('Paramètres enregistrés.');
});

document.getElementById('clearBtn').addEventListener('click', async () => {
  await chrome.storage.local.remove('apiKey');
  apiKeyInput.value = '';
  showStatus('Clé effacée.');
});
