const apiKeyInput = document.getElementById('apiKeyInput');
const saveStatus  = document.getElementById('saveStatus');

let statusTimer = null;

function showStatus(msg, isError = false) {
  saveStatus.textContent = msg;
  saveStatus.className = 'save-status ' + (isError ? 'status-error' : 'status-ok');
  if (statusTimer) clearTimeout(statusTimer);
  statusTimer = setTimeout(() => {
    saveStatus.className = 'save-status hidden';
  }, 2500);
}

chrome.storage.local.get('apiKey').then(({ apiKey }) => {
  if (apiKey) apiKeyInput.value = apiKey;
});

document.getElementById('optionsForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const key = apiKeyInput.value.trim();
  if (!key) {
    showStatus('Veuillez entrer une clé valide.', true);
    return;
  }
  await chrome.storage.local.set({ apiKey: key });
  showStatus('Clé enregistrée.');
});

document.getElementById('clearBtn').addEventListener('click', async () => {
  await chrome.storage.local.remove('apiKey');
  apiKeyInput.value = '';
  showStatus('Clé effacée.');
});
