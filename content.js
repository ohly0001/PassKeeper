const hostname = window.location.hostname;
let typingTimer; // The "Wait" timer
const DONE_TYPING_INTERVAL = 1000; // 1 second of no typing before saving

/**
 * 1. THE FINGERPRINTING LOGIC (Remains the same)
 */
function getFingerprint(input) {
  let labelText = "";
  const labelEl = document.querySelector(`label[for="${input.id}"]`);
  labelText = labelEl ? labelEl.innerText.trim() : (input.closest('label')?.innerText.trim() || "");

  return {
    autocomplete: input.autocomplete || "",
    label: labelText.split('\n')[0], // First line only
    placeholder: input.placeholder || "",
    name: input.name || "",
    type: input.type
  };
}

/**
 * 2. THE SAVE FUNCTION (Only called after the pause)
 */
function commitToVault(input) {
  const fingerprint = getFingerprint(input);
  const value = input.value;

  chrome.storage.local.get({ vault: {} }, (data) => {
    if (!data.vault[hostname]) data.vault[hostname] = [];
    
    // Find the existing record by semantic fingerprint
    const existingIdx = data.vault[hostname].findIndex(f => 
      (f.fingerprint.label && f.fingerprint.label === fingerprint.label) || 
      (f.fingerprint.name && f.fingerprint.name === fingerprint.name) ||
      (f.fingerprint.placeholder && f.fingerprint.placeholder === fingerprint.placeholder)
    );

    if (value.length === 0) {
      // If user cleared the field, delete it from storage
      if (existingIdx > -1) data.vault[hostname].splice(existingIdx, 1);
    } else {
      // Update or Add new entry
      const entry = { fingerprint, value, timestamp: Date.now() };
      if (existingIdx > -1) {
        data.vault[hostname][existingIdx] = entry;
      } else {
        data.vault[hostname].push(entry);
      }
    }

    chrome.storage.local.set({ vault: data.vault }, () => {
      console.log("✅ Saved to Vault:", fingerprint.label || fingerprint.name || "Field");
      // Visual feedback: brief green flash
      input.style.transition = "box-shadow 0.2s";
      input.style.boxShadow = "0 0 8px green";
      setTimeout(() => input.style.boxShadow = "none", 500);
    });
  });
}

/**
 * 3. THE TYPING LISTENER (The Trigger)
 */
document.addEventListener('input', (e) => {
  if (e.target.tagName === 'INPUT') {
    // Clear the timer every time a key is pressed
    clearTimeout(typingTimer);

    // Provide immediate feedback that we are "waiting" to save
    e.target.style.boxShadow = "0 0 8px orange";

    // Set a new timer
    typingTimer = setTimeout(() => {
      commitToVault(e.target);
    }, DONE_TYPING_INTERVAL);
  }
}, true);

/**
 * 4. AUTOFILL LOGIC (Standard strategy)
 */
const fillFields = () => {
  chrome.storage.local.get('vault', (data) => {
    const siteData = data.vault?.[hostname];
    if (!siteData) return;

    siteData.forEach(item => {
      // Simple selector-based find (reuse your findField function here)
      const field = document.querySelector(`input[name="${item.fingerprint.name}"]`) || 
                    document.querySelector(`input[placeholder="${item.fingerprint.placeholder}"]`);
      
      if (field && !field.value) {
        field.value = item.value;
        field.dispatchEvent(new Event('input', { bubbles: true }));
      }
    });
  });
};

// Initial fill
setTimeout(fillFields, 500);