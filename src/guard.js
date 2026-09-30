// Kötüye kullanıma karşı: istek sınırı, bot doğrulaması (Turnstile), sızmış şifre kontrolü, güvenlik başlıkları
import { fail } from "./i18n.js";
import { enc, hex } from "./util.js";

export const ip = (req) => req.headers.get("cf-connecting-ip") ?? "local";

// Workers Rate Limiting (wrangler.jsonc ratelimits). Bağlama yoksa (eski yapılandırma) sınır uygulanmaz.
export async function limit(env, binding, key) {
  const l = env[binding];
  if (l && !(await l.limit({ key })).success) throw fail("tooMany");
}

// Hesap açma ve şifre sıfırlama isteğinde Cloudflare Turnstile belirteci. Yerelde ve CI'da Cloudflare'in her zaman
// geçen test anahtarları kullanılır (.dev.vars), üretimde gerçek anahtar; anahtar yoksa istek reddedilir.
export async function human(env, req, token) {
  if (!env.TURNSTILE_SECRET) {
    console.error("TURNSTILE_SECRET tanımlı değil");
    throw fail("captcha");
  }
  const r = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    body: new URLSearchParams({ secret: env.TURNSTILE_SECRET, response: String(token ?? ""), remoteip: ip(req) }),
  }).then((x) => x.json(), () => ({}));
  if (!r.success) throw fail("captcha");
}

// Have I Been Pwned k-anonimlik: şifrenin SHA-1'inin yalnızca ilk 5 karakteri gönderilir.
// Servis yanıt vermezse kayıt engellenmez.
export async function pwned(password) {
  try {
    const h = hex(await crypto.subtle.digest("SHA-1", enc(password))).toUpperCase();
    const r = await fetch(`https://api.pwnedpasswords.com/range/${h.slice(0, 5)}`, { headers: { "add-padding": "true" }, signal: AbortSignal.timeout(3000) });
    if (!r.ok) return false;
    return (await r.text()).split("\n").some((l) => {
      const [suffix, n] = l.trim().split(":");
      return suffix === h.slice(5) && Number(n) > 0;
    });
  } catch { return false; }
}

// Worker'dan dönen sayfalar (wrangler.jsonc run_worker_first) ve API yanıtları.
// Dış kaynaklar: Turnstile, Google Analytics, OpenStreetMap haritası ve adres araması, Google Fonts (tanıtım sitesi).
const CSP = [
  "default-src 'self'",
  "script-src 'self' https://challenges.cloudflare.com https://www.googletagmanager.com",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com",
  "img-src 'self' data: blob: https://tile.openstreetmap.org https://*.google-analytics.com https://*.googletagmanager.com",
  "connect-src 'self' https://nominatim.openstreetmap.org https://*.google-analytics.com https://*.analytics.google.com https://*.googletagmanager.com",
  "frame-src https://challenges.cloudflare.com",
  "worker-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

const HEADERS = {
  "content-security-policy": CSP,
  "x-content-type-options": "nosniff",
  "x-frame-options": "DENY",
  "referrer-policy": "strict-origin-when-cross-origin",
  "permissions-policy": "geolocation=(self), camera=(), microphone=(), payment=()",
  "strict-transport-security": "max-age=31536000; includeSubDomains",
};

export function secure(res) {
  const r = new Response(res.body, res);
  for (const [k, v] of Object.entries(HEADERS)) r.headers.set(k, v);
  return r;
}
