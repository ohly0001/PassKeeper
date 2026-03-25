const hostname = window.location.hostname;
let typingTimer;

function getFingerprint(input) {
  return {
    label: input.labels?.[0]?.innerText || input.placeholder || input.name || "field",
    name: input.name || "",
    placeholder: input.placeholder || ""
  };
}

async function handleSave(input) {
  const { enabled } = await chrome.storage.local.get('enabled');
  const { sessionPassword } = await chrome.storage.session.get('sessionPassword');
  if (!enabled || !sessionPassword || !input.value) return;

  const fingerprint = getFingerprint(input);
  const encryptedValue = await encrypt(input.value, sessionPassword);

  chrome.storage.local.get({ vault: {} }, (data) => {
    if (!data.vault[hostname]) data.vault[hostname] = [];
    const idx = data.vault[hostname].findIndex(f => f.fingerprint.label === fingerprint.label);
    const entry = { fingerprint, value: encryptedValue };

    if (idx > -1) data.vault[hostname][idx] = entry;
    else data.vault[hostname].push(entry);

    chrome.storage.local.set({ vault: data.vault });
    input.style.border = "2px solid ";
    setTimeout(() => input.style.border = "", 1000);
  });
}

async function handleFill() {
  const { enabled } = await chrome.storage.local.get('enabled');
  const { sessionPassword } = await chrome.storage.session.get('sessionPassword');
  if (!enabled || !sessionPassword) return;

  chrome.storage.local.get('vault', async (data) => {
    const siteData = data.vault?.[hostname];
    if (!siteData) return;

    for (const item of siteData) {
      const field = document.querySelector(`input[name="${item.fingerprint.name}"]`) || 
                    document.querySelector(`input[placeholder="${item.fingerprint.placeholder}"]`);
      if (field && !field.value) {
        const decrypted = await decrypt(item.value, sessionPassword);
        if (decrypted) {
          field.value = decrypted;
          field.dispatchEvent(new Event('input', { bubbles: true }));
        }
      }
    }
  });
}

document.addEventListener('input', (e) => {
  if (e.target.tagName === 'INPUT') {
    clearTimeout(typingTimer);
    typingTimer = setTimeout(() => handleSave(e.target), 1000);
  }
}, true);

setTimeout(handleFill, 1000);