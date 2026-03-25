const ENCRYPTION_ALGO = "AES-GCM";

async function getMasterKey(password, salt) {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations: 100000, hash: "SHA-256" },
    keyMaterial,
    { name: ENCRYPTION_ALGO, length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

async function encrypt(text, password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await getMasterKey(password, salt);
  const ciphertext = await crypto.subtle.encrypt({ name: ENCRYPTION_ALGO, iv }, key, new TextEncoder().encode(text));
  return JSON.stringify({
    ct: btoa(String.fromCharCode(...new Uint8Array(ciphertext))),
    s: btoa(String.fromCharCode(...salt)),
    iv: btoa(String.fromCharCode(...iv))
  });
}

async function decrypt(encObjStr, password) {
  try {
    const { ct, s, iv } = JSON.parse(encObjStr);
    const salt = new Uint8Array(atob(s).split("").map(c => c.charCodeAt(0)));
    const ivArr = new Uint8Array(atob(iv).split("").map(c => c.charCodeAt(0)));
    const ciphertext = new Uint8Array(atob(ct).split("").map(c => c.charCodeAt(0)));
    const key = await getMasterKey(password, salt);
    const decrypted = await crypto.subtle.decrypt({ name: ENCRYPTION_ALGO, iv: ivArr }, key, ciphertext);
    return new TextDecoder().decode(decrypted);
  } catch (e) { return null; }
}