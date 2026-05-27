chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type !== 'INSERT_SYMBOL') return;

  const el = document.activeElement;
  if (!el) { sendResponse({ ok: false }); return; }

  // Standard input / textarea
  if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
    const start = el.selectionStart ?? el.value.length;
    const end   = el.selectionEnd   ?? el.value.length;
    el.value = el.value.slice(0, start) + message.symbol + el.value.slice(end);
    el.selectionStart = el.selectionEnd = start + message.symbol.length;
    el.dispatchEvent(new Event('input',  { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    sendResponse({ ok: true });
    return;
  }

  // contenteditable (Notion, Google Docs lite, rich-text editors…)
  const editable = el.isContentEditable ? el : el.closest('[contenteditable="true"]');
  if (editable) {
    // execCommand works in all Chromium versions and handles undo history
    document.execCommand('insertText', false, message.symbol);
    sendResponse({ ok: true });
    return;
  }

  sendResponse({ ok: false });
});
