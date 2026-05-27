document.getElementById('openOptions').addEventListener('click', () => {
  chrome.runtime.openOptionsPage();
});

document.getElementById('closeWelcome').addEventListener('click', () => {
  window.close();
});
