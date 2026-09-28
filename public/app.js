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
