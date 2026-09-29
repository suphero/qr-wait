const $ = (s) => document.querySelector(s);

async function api(path, body, headers = {}, method = body ? "POST" : "GET") {
  const r = await fetch(path, { method, headers: { "content-type": "application/json", ...headers }, body: body && JSON.stringify(body) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || "Bağlantı hatası");
  return j;
}

function locate() {
  return new Promise((ok, fail) => {
    if (!navigator.geolocation) return fail(new Error("Tarayıcınız konum desteklemiyor."));
    navigator.geolocation.getCurrentPosition((p) => ok(p.coords),
      () => fail(new Error("Konum izni gerekli. Tarayıcı ayarlarından bu siteye konum izni verin.")),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 });
  });
}

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const mins = (t) => Math.floor((Date.now() - t) / 60000);

// Esnek yer seçimi: 1..size onay kutuları, varsayılan yalnızca grup büyüklüğü işaretli
function renderAccept(el, size) {
  el.innerHTML = Array.from({ length: size }, (_, i) => i + 1)
    .map((n) => `<label class="pick"><input type="checkbox" value="${n}"${n === size ? " checked" : ""}> ${n}</label>`).join("");
}
// Grup büyüklüğü seçimi: 1..max, varsayılan 2 (tek kişilik sırada 1)
function renderSizes(el, max) {
  const cur = +el.value || 2;
  el.innerHTML = Array.from({ length: max }, (_, i) => i + 1)
    .map((n) => `<option${n === Math.min(cur, max) ? " selected" : ""}>${n}</option>`).join("");
}

// Sıra kategorileri; anahtarlar src/index.js'teki CATEGORIES ile aynı
const CATEGORIES = {
  plaj: ["🏖️", "Plaj"], iskele: ["⛴️", "İskele / ulaşım"], gise: ["🎫", "Gişe"], restoran: ["🍽️", "Restoran / kafe"],
  saglik: ["🏥", "Sağlık"], resmi: ["🏛️", "Resmi daire"], etkinlik: ["🎪", "Etkinlik"], diger: ["📍", "Diğer"],
};
const catIcon = (c) => (CATEGORIES[c] ?? CATEGORIES.diger)[0];
const readAccept = (el) => [...el.querySelectorAll("input:checked")].map((i) => +i.value);
const orList = (a) => (a.length > 1 ? `${a.slice(0, -1).join(", ")} veya ${a.at(-1)}` : String(a[0]));

// Google Analytics (GA4) — tüm sayfalar app.js'i yüklediği için tek yerden
const GA_ID = "G-BPEZ8M7B76";
if (!GA_ID.includes("X") && location.hostname !== "localhost") {
  const s = document.createElement("script");
  s.async = true;
  s.src = `https://www.googletagmanager.com/gtag/js?id=${GA_ID}`;
  document.head.append(s);
  window.dataLayer = window.dataLayer || [];
  window.gtag = function () { dataLayer.push(arguments); };
  gtag("js", new Date());
  gtag("config", GA_ID);
}
