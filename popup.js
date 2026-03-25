const unlockBtn = document.getElementById('unlockBtn');
const lockStatus = document.getElementById('lockStatus'); // Matches your HTML B tag
const stateEl = document.getElementById('state');         // Matches your HTML B tag
const pwdInput = document.getElementById('pwd');

// 1. UI Sync: Runs every time the popup opens
function updateUI() {
  chrome.storage.local.get(['vault', 'enabled'], (res) => {
    // Check if vault has any actual data keys
    const hasData = res.vault && Object.keys(res.vault).length > 0;
    stateEl.innerText = res.enabled ? "ON" : "OFF";
    
    chrome.storage.session.get(['sessionPassword'], (sess) => {
      const isUnlocked = !!sess.sessionPassword;

      if (isUnlocked) {
        lockStatus.innerText = "UNLOCKED";
        unlockBtn.innerText = "Change Master Password";
        document.getElementById('dangerZone').style.display = "none";
      } else if (hasData) {
        lockStatus.innerText = "LOCKED";
        unlockBtn.innerText = "Enter Password";
        document.getElementById('dangerZone').style.display = "block";
      } else {
        lockStatus.innerText = "NEW USER";
        unlockBtn.innerText = "Set Master Password";
        document.getElementById('dangerZone').style.display = "none";
      }
    });
  });
}

updateUI();

// 2. Toggle Master Switch
document.getElementById('toggleBtn').onclick = () => {
  chrome.storage.local.get(['enabled'], (res) => {
    const next = !res.enabled;
    chrome.storage.local.set({ enabled: next }, updateUI);
  });
};

// 3. Unlock or Change Password Logic
unlockBtn.onclick = async () => {
  const newPwd = pwdInput.value;
  if (!newPwd) return alert("Please enter a password");

  const { sessionPassword } = await chrome.storage.session.get('sessionPassword');
  const { vault } = await chrome.storage.local.get('vault');

  // IF UNLOCKED: Perform Re-encryption
  if (sessionPassword && vault) {
    if (confirm("Change master password? This will re-encrypt your entire vault.")) {
      const newVault = {};
      for (const host in vault) {
        newVault[host] = await Promise.all(vault[host].map(async (item) => {
          const decrypted = await decrypt(item.value, sessionPassword);
          const reEncrypted = await encrypt(decrypted, newPwd);
          return { ...item, value: reEncrypted };
        }));
      }
      await chrome.storage.local.set({ vault: newVault });
      alert("Vault re-encrypted with new password!");
    }
  }

  // Set the new/current password into Session RAM
  await chrome.storage.session.setAccessLevel({ accessLevel: 'TRUSTED_AND_UNTRUSTED_CONTEXTS' });
  await chrome.storage.session.set({ sessionPassword: newPwd });
  
  pwdInput.value = ""; 
  updateUI();
};

// 4. Wipe & Reset
document.getElementById('resetVault').onclick = () => {
  if (confirm("PERMANENTLY delete all saved passwords? This cannot be undone.")) {
    chrome.storage.local.set({ vault: {} }, () => {
      chrome.storage.session.remove('sessionPassword');
      updateUI();
    });
  }
};

// 5. Export / Import
document.getElementById('exportBtn').onclick = () => {
  chrome.storage.local.get('vault', (res) => {
    const blob = new Blob([JSON.stringify(res.vault || {})], {type: "application/json"});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `vault_export_${new Date().toISOString().slice(0,10)}.json`;
    a.click();
  });
};

document.getElementById('importBtn').onclick = () => document.getElementById('fileInput').click();

document.getElementById('fileInput').onchange = (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (ev) => {
    try {
      const data = JSON.parse(ev.target.result);
      chrome.storage.local.set({ vault: data }, () => {
        alert("Imported successfully. You must use the password that was active when this backup was made.");
        updateUI();
      });
    } catch (err) { alert("Invalid JSON file."); }
  };
  reader.readAsText(file);
};