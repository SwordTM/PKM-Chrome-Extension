async function sha256Hex(input) {
  const enc = new TextEncoder();
  const data = enc.encode(input);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function isInjectable(url = "") {
  try {
    const u = new URL(url);
    if (!/^https?:$/.test(u.protocol)) return false;
    if (u.hostname === "chrome.google.com") return false;
    return true;
  } catch {
    return false;
  }
}

export function contentHash(text) {
  return sha256Hex(text);
}