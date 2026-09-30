// Web Push (RFC 8291 aes128gcm şifreleme + RFC 8292 VAPID), yalnızca WebCrypto ile.
// Anahtarlar: VAPID_PUBLIC_KEY (65 baytlık sıkıştırılmamış P-256 noktası), VAPID_PRIVATE_KEY (32 baytlık d), ikisi de base64url.

import { fail } from "./i18n.js";

const SUBJECT = "mailto:hello@qrwait.app";
const te = new TextEncoder();

const b64u = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
const unb64u = (s) => Uint8Array.from(atob(s.replaceAll("-", "+").replaceAll("_", "/")), (c) => c.charCodeAt(0));
const concat = (...parts) => {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let i = 0;
  for (const p of parts) { out.set(p, i); i += p.length; }
  return out;
};

async function hkdf(salt, ikm, info, bytes) {
  const key = await crypto.subtle.importKey("raw", ikm, "HKDF", false, ["deriveBits"]);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: "HKDF", hash: "SHA-256", salt, info }, key, bytes * 8));
}

async function vapid(endpoint, env) {
  const pub = unb64u(env.VAPID_PUBLIC_KEY);
  const key = await crypto.subtle.importKey("jwk", {
    kty: "EC", crv: "P-256", d: env.VAPID_PRIVATE_KEY, x: b64u(pub.slice(1, 33)), y: b64u(pub.slice(33, 65)),
  }, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
  const head = b64u(te.encode(JSON.stringify({ typ: "JWT", alg: "ES256" })));
  const body = b64u(te.encode(JSON.stringify({ aud: new URL(endpoint).origin, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: SUBJECT })));
  const sig = await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key, te.encode(`${head}.${body}`));
  return `vapid t=${head}.${body}.${b64u(sig)}, k=${env.VAPID_PUBLIC_KEY}`;
}

export async function encrypt(sub, payload) {
  const uaPublic = unb64u(sub.keys.p256dh), auth = unb64u(sub.keys.auth);
  const local = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]);
  const asPublic = new Uint8Array(await crypto.subtle.exportKey("raw", local.publicKey));
  const ua = await crypto.subtle.importKey("raw", uaPublic, { name: "ECDH", namedCurve: "P-256" }, false, []);
  const shared = new Uint8Array(await crypto.subtle.deriveBits({ name: "ECDH", public: ua }, local.privateKey, 256));
  const ikm = await hkdf(auth, shared, concat(te.encode("WebPush: info\0"), uaPublic, asPublic), 32);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const cek = await hkdf(salt, ikm, te.encode("Content-Encoding: aes128gcm\0"), 16);
  const nonce = await hkdf(salt, ikm, te.encode("Content-Encoding: nonce\0"), 12);
  const key = await crypto.subtle.importKey("raw", cek, "AES-GCM", false, ["encrypt"]);
  // Tek kayıt: içerik + 0x02 (son kayıt ayırıcısı)
  const data = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce }, key, concat(te.encode(payload), [2])));
  // Başlık: salt(16) | kayıt boyutu(4) | anahtar uzunluğu(1) | gönderen açık anahtarı(65)
  return concat(salt, [0, 0, 16, 0], [asPublic.length], asPublic, data);
}

// Sonuç: true gönderildi, false abonelik artık geçersiz (silinmeli). Diğer hatalar fırlatılır.
export async function sendPush(sub, message, env) {
  const r = await fetch(sub.endpoint, {
    method: "POST",
    headers: {
      authorization: await vapid(sub.endpoint, env),
      "content-encoding": "aes128gcm",
      "content-type": "application/octet-stream",
      ttl: "900", // 15 dk içinde ulaştırılamazsa anlamı kalmaz
      urgency: "high",
    },
    body: await encrypt(sub, JSON.stringify(message)),
  });
  if (r.status === 404 || r.status === 410) return false;
  if (!r.ok) throw new Error(`push ${r.status}: ${await r.text().catch(() => "")}`);
  return true;
}

// Worker keyfi adreslere istek atmasın diye yalnızca bilinen push servisleri (Chrome, Safari, Firefox, Edge)
const PUSH_HOSTS = /^(fcm\.googleapis\.com|([\w-]+\.)*push\.apple\.com|([\w-]+\.)*push\.services\.mozilla\.com|([\w-]+\.)*notify\.windows\.com)$/;

// Tarayıcıdan gelen PushSubscription.toJSON() çıktısını doğrular ve yalnızca gerekli alanları saklar
export function cleanSub(sub) {
  const { endpoint, keys } = sub ?? {};
  const u = URL.parse(endpoint);
  const ok = u?.protocol === "https:" && endpoint.length < 1000 && PUSH_HOSTS.test(u.hostname) &&
    /^[\w-]{80,100}$/.test(keys?.p256dh ?? "") && /^[\w-]{16,32}$/.test(keys?.auth ?? "");
  if (!ok) throw fail("badPush");
  return { endpoint, keys: { p256dh: keys.p256dh, auth: keys.auth } };
}
