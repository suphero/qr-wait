// Ortak kripto yardımcıları (index.js, billing.js)
export const enc = (s) => new TextEncoder().encode(String(s ?? ""));
export const hex = (b) => [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, "0")).join("");

// Sabit zamanlı karşılaştırma
export const same = (a, b) => {
  const x = enc(a), y = enc(b);
  return x.length === y.length && crypto.subtle.timingSafeEqual(x, y);
};

async function hmac(key, msg) {
  const k = await crypto.subtle.importKey("raw", enc(key), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return crypto.subtle.sign("HMAC", k, enc(msg));
}

// Kısa imza (80 bit): QR kodu ve oturum anahtarı
export const sign = async (key, msg) => hex(await hmac(key, msg)).slice(0, 20);
export const hmacHex = async (key, msg) => hex(await hmac(key, msg));
export const sha256 = async (s) => hex(await crypto.subtle.digest("SHA-256", enc(s)));
export const randomHex = (n) => hex(crypto.getRandomValues(new Uint8Array(n)));
