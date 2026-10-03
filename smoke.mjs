// `npm run dev` açıkken çalıştırın: node smoke.mjs  (.dev.vars içinde ADMIN_PASSWORD=test, ya da PASSWORD=<şifre> node smoke.mjs)
// WRANGLER_LOG=<wrangler dev çıktısı>: e-posta bağlantıları (DEV=1) oradan okunur; yoksa şifre sıfırlama testi atlanır.
// Giriş IP başına dakikada 10 istekle sınırlı: art arda çalıştırırken bir dakika bekleyin.
import assert from "node:assert/strict";
import { createECDH, createHmac, randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";

const B = process.env.BASE ?? "http://localhost:8787";
// Beklenen mesajlar Türkçe; sunucunun varsayılan dili İngilizce olduğundan x-lang'siz isteklere tr eklenir
const fetch = (url, o = {}) => globalThis.fetch(url, { ...o, headers: { "x-lang": "tr", ...o.headers } });
const req = async (method, p, body, h = {}) => {
  const r = await fetch(B + p, { method, headers: { "content-type": "application/json", ...h }, body: body && JSON.stringify(body) });
  return r.json();
};
const post = (p, body, h) => req("POST", p, body, h);
const bearer = async (user, password) => ({ authorization: `Bearer ${(await post("/api/login", { user, password })).token}` });
// Süper yönetici bir test kullanıcısı açar; sıralar o kullanıcıyla yönetilir
const SU = await bearer("admin", process.env.PASSWORD ?? "test");
const U = `test${Date.now()}`, U2 = `${U}-b`;
assert.deepEqual(await post("/api/admin/users", { user: U, password: "deneme123" }, SU), { ok: true });
await post("/api/admin/users", { user: U2, password: "deneme123" }, SU);
assert.match((await post("/api/admin/users", { user: U, password: "deneme123" }, SU)).error, /alınmış/);
assert.match((await post("/api/admin/users", { user: "Kötü Ad", password: "deneme123" }, SU)).error, /Geçersiz kullanıcı/);
assert.match((await post("/api/admin/users", { user: `${U}-c`, password: "kisa" }, SU)).error, /en az 8/);
// Süper yönetici e-postayı açarken ya da sonradan, onay bağlantısı olmadan belirler; aynı adres iki hesapta olamaz
const U3 = `${U}-m`, EU3 = `${U3}@example.com`;
assert.match((await post("/api/admin/users", { user: U3, password: "deneme123", email: "yok" }, SU)).error, /Geçersiz e-posta/);
assert.deepEqual(await post("/api/admin/users", { user: U3, password: "deneme123", email: EU3 }, SU), { ok: true });
assert.match((await post("/api/admin/users", { user: `${U}-n`, password: "deneme123", email: EU3 }, SU)).error, /e-posta ile/);
assert.match((await post(`/api/admin/users/${U2}/plan`, { email: EU3 }, SU)).error, /e-posta ile/);
await post(`/api/admin/users/${U2}/plan`, { email: `${U2}@example.com` }, SU);
const emails = Object.fromEntries((await req("GET", "/api/admin/users", undefined, SU)).users.map((u) => [u.name, u.email]));
assert.deepEqual([emails[U], emails[U2], emails[U3]], [null, `${U2}@example.com`, EU3]);
// Adres değişince eski adrese bildirim gider (önceden adres yoksa gitmez)
await post(`/api/admin/users/${U2}/plan`, { email: `${U2}-2@example.com` }, SU);
if (process.env.WRANGLER_LOG) assert.match(readFileSync(process.env.WRANGLER_LOG, "utf8"), new RegExp(`mail changed → ${U2}@example\\.com: mailto:`));
await req("DELETE", `/api/admin/users/${U3}`, undefined, SU);
assert.match((await post("/api/login", { user: U, password: "yanlis-sifre" })).error, /hatalı/);
const PW = await bearer(U, "deneme123"), PW2 = await bearer(U2, "deneme123");
assert.equal((await req("GET", "/api/admin/me", undefined, PW)).user, U);
assert.match((await req("GET", "/api/admin/rooms", undefined, SU)).error, /kullanıcı hesabıyla/, "süper yönetici sıra yönetmez");
assert.match((await req("GET", "/api/admin/users", undefined, PW)).error, /Geçersiz istek/, "kullanıcı, kullanıcıları yönetemez");
const spot = { lat: 36.8841, lng: 30.7056 };

const slug = `test-${Date.now()}`;
const { room, key } = await post("/api/admin/rooms", { name: "Test Sırası", slug, radius: 300, ...spot }, PW);
assert.ok(room && key);
const resolve = async (r, u = U) => (await req("GET", `/api/resolve?u=${u}&r=${r}`, undefined));
assert.equal((await resolve(slug)).room, room, "slug oda id'sine çözülür");
assert.equal((await resolve(room)).room, room, "eski id linkleri çalışır");
assert.match((await post("/api/admin/rooms", { name: "X", slug, radius: 300, ...spot }, PW)).error, /kullanılıyor/, "aynı slug iki odaya verilemez");
assert.match((await post("/api/admin/rooms", { name: "X", slug: "Kötü Adres", radius: 300, ...spot }, PW)).error, /Geçersiz adres/);
assert.equal((await req("GET", "/api/admin/rooms", undefined, { authorization: "Bearer yanlis" })).error, "Oturum geçersiz, yeniden giriş yapın");
// Kullanıcılar birbirinden ayrı: aynı adres başka kullanıcıda serbest, başkasının sırası görülmez ve değiştirilemez
const other = await post("/api/admin/rooms", { name: "Öteki", slug, radius: 300, ...spot }, PW2);
assert.ok(other.room, "aynı slug başka kullanıcıda kullanılabilir");
assert.equal((await resolve(slug, U2)).room, other.room);
assert.equal((await resolve(slug)).room, room);
assert.equal((await req("GET", "/api/admin/rooms", undefined, PW2)).length, 1);
assert.equal((await req("DELETE", `/api/admin/rooms/${room}`, undefined, PW2)).error, "Sıra bulunamadı", "başkasının sırası silinemez");
assert.equal((await post(`/api/admin/rooms/${room}/rotate`, {}, PW2)).error, "Sıra bulunamadı");
assert.deepEqual((await req("GET", `/api/rooms?u=${U2}`)).map((r) => r.name), ["Öteki"], "kullanıcı sayfası yalnızca onun sıraları");
assert.deepEqual(await resolve("", U), { account: U }, "kullanıcı adresi");
assert.match((await req("DELETE", `/api/admin/users/${U2}`, undefined, SU)).error, /sıraları var/);
await req("DELETE", `/api/admin/rooms/${other.room}`, undefined, PW2);
assert.deepEqual(await req("DELETE", `/api/admin/users/${U2}`, undefined, SU), { ok: true });
assert.match((await req("GET", "/api/admin/rooms", undefined, PW2)).error, /Oturum geçersiz/, "silinen kullanıcının oturumu düşer");

const admin = (body = {}) => post(`/api/r/${room}/admin`, body, { "x-key": key });
assert.equal((await post(`/api/r/${room}/admin`, {}, { "x-key": "x" })).error, "Yetkisiz");
assert.equal((await post(`/api/r/${room}/admin`, {}, { "x-key": "x", "x-lang": "en" })).error, "Unauthorized", "hata isteğin dilinde");
assert.equal((await post("/api/login", { user: U, password: "yanlis" }, { "x-lang": "ru" })).error, "Неверное имя пользователя или пароль");
const { token } = await admin();

const join = (device, size, pos = spot, t = token) => post(`/api/r/${room}/join`, { t, ...pos, size, device });
const a = await join("device-aaaaaaaaaaaa", 2);
const b = await join("device-bbbbbbbbbbbb", 4);
const c = await join("device-cccccccccccc", 1);
assert.deepEqual([a.no, b.no, c.no], [1, 2, 3]);
assert.equal((await join("device-aaaaaaaaaaaa", 3)).no, 1, "aynı cihaz ikinci bilet alamaz");
assert.match((await join("device-dddddddddddd", 2, { lat: 36.9, lng: 30.7056 })).error, /bulunduğu yerde görünmüyorsunuz/, "~1.8 km uzak");
assert.match((await join("device-dddddddddddd", 2, spot, `${Date.now() - 120000}.abc`)).error, /süresi dolmuş/);
assert.match((await join("device-dddddddddddd", 2, spot, `${token.split(".")[0]}.${"0".repeat(20)}`)).error, /süresi dolmuş/, "sahte imza");
// Ziyaretçinin dili: hata mesajları o dilde, desteklenmeyen dilde ya da dil yoksa İngilizce
const ljoin = (lang, body = {}) => post(`/api/r/${room}/join`, { t: `${Date.now() - 120000}.x`, ...spot, size: 2, device: "device-lang-000000001", lang, ...body }, { "x-lang": lang });
assert.match((await ljoin("en")).error, /QR code has expired/);
assert.match((await ljoin("de")).error, /QR-Code ist abgelaufen/);
assert.match((await ljoin("ru")).error, /QR-кода истёк/);
assert.match((await ljoin("fr")).error, /QR code has expired/, "desteklenmeyen dil → İngilizce");
assert.match((await globalThis.fetch(`${B}/api/r/${room}/join`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ t: `${Date.now() - 120000}.x`, ...spot, size: 2, device: "device-lang-000000001" }) }).then((r) => r.json())).error, /QR code has expired/, "dil yok → İngilizce");
assert.match((await ljoin("en", { t: token, size: 99 })).error, /1–8 people/);

const me = async (id) => (await fetch(`${B}/api/r/${room}/me?id=${id}`)).json();
assert.equal((await me(c.id)).aheadPeople, 6);

// #1 bildirim açık: çağrılınca push gönderilir (sahte abonelik, gönderim hatası isteği bozmamalı)
const ec = createECDH("prime256v1"); ec.generateKeys();
const sub = { endpoint: `https://fcm.googleapis.com/fcm/send/${"x".repeat(40)}`, keys: { p256dh: ec.getPublicKey().toString("base64url"), auth: randomBytes(16).toString("base64url") } };
assert.deepEqual(await post(`/api/r/${room}/push`, { id: a.id, sub }), { ok: true });
assert.equal((await post(`/api/r/${room}/push`, { id: a.id, sub: { endpoint: "https://evil.example/x" } }, { "x-lang": "de" })).error, "Ungültiges Benachrichtigungsabonnement");

// Panelde ulaşılabilirlik: son görülme ve bildirim durumu (elle eklenende yok); cihaz ve abonelik gönderilmez
let s = await admin({});
const ea = s.entries.find((e) => e.id === a.id), ec2 = s.entries.find((e) => e.id === c.id);
assert.ok(Math.abs(s.now - ea.seen) < 60000, "son görülme");
assert.deepEqual([ea.notify, ec2.notify], [true, false]);
assert.ok(!("push" in ea) && !("device" in ea));

// 3 kişi kalktı: #1 (2 kişi) çağrılır, 1 yer artar
s = await admin({ action: "free", n: 3 });
assert.equal(s.error, undefined, "push gönderimi çağırmayı bozmaz");
assert.equal((await me(a.id)).status, "called");
assert.equal((await me(b.id)).status, "waiting");
console.log("fill sonrası boş yer:", s.available, "| #3 durumu:", (await me(c.id)).status);

// #1 gelmedi: 2 yeri geri döner (toplam 3), #2 (4 kişi) hâlâ sığmıyor
s = await admin({ action: "drop", id: a.id });
assert.equal((await me(a.id)).status, "gone");
assert.equal(s.available, 3);
s = await admin({ action: "free", n: 1 });
assert.equal((await me(b.id)).status, "called", "#2 (4 kişi) artık sığıyor");

s = await admin({ action: "add", size: 2, note: "telefonsuz" });
assert.equal(s.added, 4);
assert.ok(((e) => !("seen" in e) && !("notify" in e))(s.entries.find((e) => e.no === 4)), "elle eklenende ulaşılabilirlik yok");
const st = await (await fetch(`${B}/api/r/${room}/status`)).json();
assert.deepEqual([st.waiting, st.called, st.lastNo, st.next], [2, [b.no], b.no, c.no]);
assert.ok(!JSON.stringify(st).includes("telefonsuz") && !("entries" in st), "herkese açık durumda not ve bilet bilgisi yok");
await admin({ action: "arrived", id: b.id });
assert.equal((await me(b.id)).status, "gone");
// Oda CRUD
const find = async () => (await req("GET", "/api/admin/rooms", undefined, PW)).find((r) => r.room === room);
assert.equal((await find()).people, 3, "listede bekleyen kişi sayısı görünür (#3 + #4)");
const slug2 = `${slug}-yeni`;
await req("PUT", `/api/admin/rooms/${room}`, { name: "Yeni Ad", slug: slug2, radius: 500, ...spot }, PW);
assert.deepEqual([(await find()).name, (await find()).radius, (await find()).slug], ["Yeni Ad", 500, slug2]);
assert.ok((await find()).link.includes(slug2), "görevli linki yeni slug ile");
assert.equal((await resolve(slug)).error, "Sıra bulunamadı", "eski slug serbest kalır");
assert.equal((await resolve(slug2)).room, room);
const { key: key2 } = await post(`/api/admin/rooms/${room}/rotate`, {}, PW);
assert.notEqual(key2, key);
assert.equal((await admin()).error, "Yetkisiz", "eski görevli linki geçersiz");
assert.equal((await post(`/api/r/${room}/admin`, {}, { "x-key": key2 })).name, "Yeni Ad");
await req("DELETE", `/api/admin/rooms/${room}`, undefined, PW);
assert.equal(await find(), undefined);
assert.equal((await resolve(slug2)).error, "Sıra bulunamadı", "silinen odanın slug'ı serbest kalır");
assert.equal((await me(c.id)).error, "Sıra bulunamadı");
assert.equal((await post(`/api/admin/rooms/${room}/import`, {}, PW)).error, "Sıra bulunamadı", "silinmiş oda içe aktarılamaz");
// Esnek yer seçimi: grup kişi sayısından az yeri de kabul edebilir
const f = await post("/api/admin/rooms", { name: "Esnek", slug: `${slug}-esnek`, radius: 300, flex: true, ...spot }, PW);
const fadmin = (body = {}) => post(`/api/r/${f.room}/admin`, body, { "x-key": f.key });
const ft = (await fadmin()).token;
const fjoin = (device, size, accept) => post(`/api/r/${f.room}/join`, { t: ft, ...spot, size, accept, device });
const fme = async (id) => (await fetch(`${B}/api/r/${f.room}/me?id=${id}`)).json();
const g1 = await fjoin("flex-device-000000001", 4, [4, 2]);
const g2 = await fjoin("flex-device-000000002", 2, [2]);
assert.deepEqual((await fme(g1.id)).accept, [2, 4]);
assert.match((await fjoin("flex-device-000000003", 2, [5])).error, /en az bir yer/, "kişi sayısından fazla yer seçilemez");
let fs = await fadmin({ action: "free", n: 3 }); // #1 "2 veya 4": 2 yer alır, 1 artar; #2 (2 yer) sığmaz
assert.deepEqual([(await fme(g1.id)).status, (await fme(g1.id)).alloc, fs.available], ["called", 2, 1]);
assert.equal((await fme(g2.id)).status, "waiting");
fs = await fadmin({ action: "drop", id: g1.id }); // gelmedi: ayrılan 2 yer (4 değil) geri döner → 3 → #2 çağrılır
assert.deepEqual([(await fme(g2.id)).status, (await fme(g2.id)).alloc, fs.available], ["called", 2, 1]);
await req("DELETE", `/api/admin/rooms/${f.room}`, undefined, PW);
// Sığmayan grubun arkası: varsayılan katı FIFO, skip açıkken sığan küçük gruplar öne geçer
for (const skip of [false, true]) {
  const k = await post("/api/admin/rooms", { name: "Atlama", slug: `${slug}-atla-${skip}`, radius: 300, skip, ...spot }, PW);
  const kadmin = (body = {}) => post(`/api/r/${k.room}/admin`, body, { "x-key": k.key });
  await kadmin({ action: "add", size: 4 });
  await kadmin({ action: "add", size: 2 });
  const ks = await kadmin({ action: "free", n: 3 });
  assert.deepEqual(ks.entries.map((e) => e.status), ["waiting", skip ? "called" : "waiting"], `skip=${skip}`);
  assert.equal(ks.available, skip ? 1 : 3);
  await req("DELETE", `/api/admin/rooms/${k.room}`, undefined, PW);
}
// Gizli sıra: rastgele adres, haritada yok; gizli kaldıkça adres korunur, açılınca seçilen adres kullanılır
const pv = await post("/api/admin/rooms", { name: "Gizli", slug: "tahmin-edilir", private: true, radius: 300, ...spot }, PW);
const pfind = async () => (await req("GET", "/api/admin/rooms", undefined, PW)).find((r) => r.room === pv.room);
const ps = (await pfind()).slug;
assert.ok((await pfind()).private && /^[a-z0-9]{20}$/.test(ps), "gizli sıranın adresi rastgele");
assert.equal((await resolve("tahmin-edilir")).error, "Sıra bulunamadı", "gönderilen slug yok sayılır");
assert.equal((await resolve(ps)).room, pv.room, "gizli adres linkle çalışır");
const pub = async () => (await req("GET", "/api/rooms")).map((r) => r.name);
assert.ok(!(await pub()).includes("Gizli"), "gizli sıra haritada görünmez");
await req("PUT", `/api/admin/rooms/${pv.room}`, { name: "Gizli", private: true, radius: 300, ...spot }, PW);
assert.equal((await pfind()).slug, ps, "gizli kaldıkça adres değişmez");
const { slug: ps2 } = await post(`/api/admin/rooms/${pv.room}/reslug`, {}, PW);
assert.ok(ps2 !== ps && (await resolve(ps)).error && (await resolve(ps2)).room === pv.room, "gizli adres yenilenir, eskisi geçersiz");
await req("PUT", `/api/admin/rooms/${pv.room}`, { name: "Gizli", slug: `${slug}-acik`, radius: 300, ...spot }, PW);
assert.ok((await pub()).includes("Gizli"), "açık sıra haritada görünür");
assert.equal((await resolve(ps2)).error, "Sıra bulunamadı", "eski gizli adres serbest kalır");
assert.match((await post(`/api/admin/rooms/${pv.room}/reslug`, {}, PW)).error, /Yalnızca gizli/, "açık sıranın adresi rastgele yenilenmez");
await req("DELETE", `/api/admin/rooms/${pv.room}`, undefined, PW);
// Oda ayarları: kategori, en büyük grup, QR süresi, sabit QR
const o = await post("/api/admin/rooms", { name: "Ayarlı", slug: `${slug}-ayar`, radius: 300, category: "plaj", maxGroup: 3, ttl: 180, ...spot }, PW);
const oadmin = (body = {}) => post(`/api/r/${o.room}/admin`, body, { "x-key": o.key });
const ofind = async () => (await req("GET", "/api/admin/rooms", undefined, PW)).find((r) => r.room === o.room);
assert.deepEqual(((r) => [r.category, r.maxGroup, r.qr, r.ttl])(await ofind()), ["plaj", 3, "dynamic", 180]);
const ost = await (await fetch(`${B}/api/r/${o.room}/status`)).json();
assert.deepEqual([ost.category, ost.maxGroup], ["plaj", 3], "join sayfası ayarları durumdan okur");
const ojoin = (device, size, t) => post(`/api/r/${o.room}/join`, { t, ...spot, size, device });
assert.match((await ojoin("opt-device-00000001", 4, (await oadmin()).token)).error, /1-3 kişi/, "en büyük grup odaya göre");
assert.match((await oadmin({ action: "add", size: 4 })).error, /Geçersiz grup/);
assert.equal((await ojoin("opt-device-00000001", 3, (await oadmin()).token)).no, 1);
assert.match((await ojoin("opt-device-00000002", 1, `${Date.now() - 120000}.x`)).error, /süresi dolmuş/);
// Sabit QR: token değişmez, dinamiğe dönünce ve anahtar yenilenince geçersiz
await req("PUT", `/api/admin/rooms/${o.room}`, { name: "Ayarlı", slug: `${slug}-ayar`, radius: 300, qr: "static", ...spot }, PW);
const st1 = await oadmin(), st2 = await oadmin();
assert.ok(st1.qr === "static" && st1.token.startsWith("s.") && st1.token === st2.token, "sabit token değişmez");
assert.equal((await ojoin("opt-device-00000002", 2, st1.token)).no, 2);
assert.match((await ojoin("opt-device-00000003", 2, `s.${"0".repeat(20)}`)).error, /geçerli değil/, "sahte sabit imza");
assert.equal((await ofind()).maxGroup, 8, "gönderilmeyen ayar varsayılana döner");
await req("PUT", `/api/admin/rooms/${o.room}`, { name: "Ayarlı", slug: `${slug}-ayar`, radius: 300, qr: "dynamic", ...spot }, PW);
assert.match((await ojoin("opt-device-00000003", 2, st1.token)).error, /geçerli değil/, "dinamiğe dönünce basılı QR çalışmaz");
await req("PUT", `/api/admin/rooms/${o.room}`, { name: "Ayarlı", slug: `${slug}-ayar`, radius: 300, qr: "static", ...spot }, PW);
const { key: okey } = await post(`/api/admin/rooms/${o.room}/rotate`, {}, PW);
assert.match((await ojoin("opt-device-00000003", 2, st1.token)).error, /geçerli değil/, "link yenilenince basılı QR çalışmaz");
assert.notEqual((await post(`/api/r/${o.room}/admin`, {}, { "x-key": okey })).token, st1.token);
// Konum kontrolü: kapalıyken konumsuz girilir; dinamikte görevli panelinin gönderdiği son konuma göre
const gadmin = (body = {}) => post(`/api/r/${o.room}/admin`, body, { "x-key": okey });
const far = { lat: 36.9, lng: 30.7056 }; // ~1.8 km uzak
const gjoin = (device, pos) => post(`/api/r/${o.room}/join`, { t: gst.token, ...pos, size: 1, device });
await req("PUT", `/api/admin/rooms/${o.room}`, { name: "Ayarlı", slug: `${slug}-ayar`, radius: 300, qr: "static", geo: "off", ...spot }, PW);
const gst = await gadmin();
assert.equal(gst.geo, "off");
assert.equal((await ofind()).geo, "off");
assert.equal((await ofind()).lat, null, "sabit konum dışında nokta tutulmaz");
assert.equal((await ofind()).radius, 300, "konum kapalıyken yarıçap korunur");
assert.ok((await gjoin("geo-device-0000001", {})).no, "konum kontrolü kapalıyken konumsuz girilir");
await req("PUT", `/api/admin/rooms/${o.room}`, { name: "Ayarlı", slug: `${slug}-ayar`, radius: 300, qr: "static", geo: "dynamic" }, PW);
assert.equal((await ofind()).geo, "dynamic", "dinamikte nokta gerekmez");
assert.match((await gjoin("geo-device-0000002", spot)).error, /Görevlinin konumu/, "görevli konumu yokken girilmez");
await gadmin({ here: far });
assert.match((await gjoin("geo-device-0000002", spot)).error, /Görevlinin yanında/, "sıranın noktası değil görevlinin konumu");
assert.ok((await gjoin("geo-device-0000002", far)).no, "görevlinin yanından girilir");
await req("PUT", `/api/admin/rooms/${o.room}`, { name: "Ayarlı", slug: `${slug}-ayar`, radius: 300, qr: "static", ...spot }, PW);
assert.equal((await ofind()).geo, "fixed", "varsayılan sabit konum");
assert.match((await req("PUT", `/api/admin/rooms/${o.room}`, { name: "Ayarlı", slug: `${slug}-ayar`, radius: 300 }, PW)).error, /Geçersiz konum/, "sabitte nokta zorunlu");
// Gelme süresi: çağrılan sürede gelmezse düşer, yeri geri döner. Gerçek süre dolumu SLOW=1 ile (3 dk bekler).
await req("PUT", `/api/admin/rooms/${o.room}`, { name: "Ayarlı", slug: `${slug}-ayar`, radius: 300, qr: "static", wait: 3, ...spot }, PW);
assert.equal((await ofind()).wait, 3);
assert.equal((await req("GET", `/api/r/${o.room}/status`)).wait, 3);
await gadmin({ action: "reset" });
const wj = await gjoin("wait-device-000001", spot);
const wme = () => req("GET", `/api/r/${o.room}/me?id=${wj.id}`);
assert.deepEqual(await post(`/api/r/${o.room}/push`, { id: wj.id, sub }), { ok: true }); // süre dolunca bildirim (hata akışı bozmamalı)
assert.equal((await wme()).remaining, null, "beklerken süre işlemez");
await gadmin({ action: "free", n: 1 });
const wm = await wme();
assert.ok(wm.status === "called" && wm.remaining > 170000 && wm.remaining <= 180000, "çağrılınca 3 dk geri sayım");
if (process.env.SLOW) {
  await new Promise((r) => setTimeout(r, 185000));
  assert.equal((await wme()).status, "expired", "süresi dolan düşer");
  assert.equal((await gadmin()).available, 1, "yeri geri döner");
}
await req("PUT", `/api/admin/rooms/${o.room}`, { name: "Ayarlı", slug: `${slug}-ayar`, radius: 300, qr: "static", ...spot }, PW);
assert.equal((await ofind()).wait, null, "varsayılan süresiz");
// Katılım: kapasite, durdurma, açılış saatleri (sıranın saat diliminde)
const put = (extra) => req("PUT", `/api/admin/rooms/${o.room}`, { name: "Ayarlı", slug: `${slug}-ayar`, radius: 300, qr: "static", tz: "Europe/Istanbul", ...spot, ...extra }, PW);
const ostat = () => req("GET", `/api/r/${o.room}/status`);
await put({ cap: 1 });
await gadmin({ action: "reset" });
const c1 = await gjoin("cap-device-0000001", spot);
assert.ok(c1.no);
assert.match((await gjoin("cap-device-0000002", spot)).error, /Sıra dolu/);
assert.equal((await ostat()).full, true);
assert.equal((await gjoin("cap-device-0000001", spot)).no, c1.no, "dolu sırada da kendi biletini alır");
assert.ok((await gadmin({ action: "add", size: 1 })).added, "elle ekleme sınıra takılmaz");
await put({});
assert.equal((await ofind()).cap, null);
assert.equal((await gadmin({ action: "pause" })).paused, true);
assert.match((await gjoin("cap-device-0000002", spot)).error, /yeni katılıma kapalı/);
assert.equal((await ostat()).paused, true);
assert.equal((await gadmin({ action: "resume" })).paused, false);
assert.ok((await gjoin("cap-device-0000002", spot)).no, "açılınca girilir");
const hm = (h) => new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Istanbul", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(Date.now() + h * 3600e3);
// Eski biçim { from, to } her gün aynı saat olarak saklanır
await put({ hours: { from: hm(2), to: hm(3) } });
assert.match((await gjoin("cap-device-0000003", spot)).error, /Sıra şu an kapalı\. Yeniden açılış: bugün/);
assert.equal((await ostat()).open, false);
assert.deepEqual((await ostat()).opens?.from, hm(2));
await put({ hours: { from: hm(-1), to: hm(1) } });
assert.equal((await ostat()).open, true, "saat aralığında açık");
assert.deepEqual((await ofind()).hours, { days: Array(7).fill({ from: hm(-1), to: hm(1) }) });
// Haftalık: bugün kapalı, yarın açık; bugün açık gün
const wd = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].indexOf(new Intl.DateTimeFormat("en", { timeZone: "Europe/Istanbul", weekday: "short" }).format(new Date()));
const week = (fn) => ({ days: Array.from({ length: 7 }, (_, i) => fn(i)) });
await put({ hours: week((i) => (i === (wd + 1) % 7 ? { from: "09:00", to: "12:00" } : null)) });
assert.match((await gjoin("cap-device-0000003", spot)).error, /Yeniden açılış: yarın 09:00/);
assert.deepEqual((await ostat()).opens, { in: 1, day: (wd + 1) % 7, from: "09:00" });
await put({ hours: week((i) => (i === wd ? { from: hm(-1), to: hm(1) } : null)) });
assert.equal((await ostat()).open, true, "bugünün aralığında açık");
await put({ hours: week(() => null) });
assert.equal((await ofind()).hours, null, "hiç açık gün yoksa her zaman açık");
await put({});
// Tahmini bekleme: son 1 saatte en az 3 çağrı olunca
assert.equal((await ostat()).eta, null, "çağrı yokken tahmin yok");
for (let i = 0; i < 3; i++) await gadmin({ action: "add", size: 1 });
await gadmin({ action: "free", n: 3 });
const eta = (await ostat()).eta;
assert.ok(eta >= 1, "çağrı hızından tahmin");
// İstatistik: bugünün sayaçları
const today = async () => (await req("GET", `/api/admin/rooms/${o.room}/stats`, undefined, PW)).days.at(-1);
const day0 = await today();
assert.ok(day0.joined >= 6 && day0.manual >= 4 && day0.called >= 3 && day0.hours.length === 24);
const calledNow = (await gadmin()).entries.find((e) => e.status === "called");
await gadmin({ action: "arrived", id: calledNow.id });
const waitingNow = (await gadmin()).entries.find((e) => e.status === "waiting");
await gadmin({ action: "drop", id: waitingNow.id });
const day1 = await today();
assert.deepEqual([day1.served - day0.served, day1.removed - day0.removed], [1, 1]);
const foreign = await req("GET", `/api/admin/rooms/${o.room}/stats`, undefined, PW2);
assert.ok(foreign.error && !foreign.days, "başkasının istatistiği görülmez");
assert.match((await gjoin("geo-device-0000003", far)).error, /bulunduğu yerde görünmüyorsunuz/);
assert.match((await post("/api/admin/rooms", { name: "X", slug: `${slug}-x`, radius: 300, maxGroup: 50, ...spot }, PW)).error, /1-20/);
await req("DELETE", `/api/admin/rooms/${o.room}`, undefined, PW);
// Masa modu: masa bölünmez, sığan en küçük masa, boş sandalye sınırı, bekleyen masa, masa adı
const tr = await post("/api/admin/rooms", { name: "Lokanta", slug: `${slug}-masa`, radius: 300, category: "restoran", mode: "tables", maxEmpty: 1, flex: true, ...spot }, PW);
const tadmin = (body = {}) => post(`/api/r/${tr.room}/admin`, body, { "x-key": tr.key });
const tt = await tadmin();
assert.ok(tt.tables && !tt.flex && tt.maxEmpty === 1, "masa modunda esnek yer kapalı");
const tjoin = (device, size) => post(`/api/r/${tr.room}/join`, { t: tt.token, ...spot, size, accept: [1], device });
const tme = async (id) => (await fetch(`${B}/api/r/${tr.room}/me?id=${id}`)).json();
const t1 = await tjoin("table-device-00000001", 2), t2 = await tjoin("table-device-00000002", 4), t3 = await tjoin("table-device-00000003", 3);
assert.deepEqual((await tme(t1.id)).accept, [2], "masa modunda accept yok sayılır");
let ts = await tadmin({ action: "table", n: 4, name: "7" }); // #1 (2 kişi) 4'lüğe fazla boş bırakır → #2 (4 kişi)
assert.equal(ts.seated, t2.no);
assert.deepEqual(((m) => [m.status, m.table.name, m.table.cap])(await tme(t2.id)), ["called", "7", 4]);
assert.equal(ts.available, 0, "masa havuza yer eklemez");
ts = await tadmin({ action: "table", n: 6, name: "Bahçe 1" }); // #1: 4 boş, #3: 3 boş → uygun yok, bekler
assert.equal(ts.seated, null);
assert.deepEqual(ts.freeTables.map((t) => t.name), ["Bahçe 1"]);
assert.match((await tadmin({ action: "table", n: 2, name: "Bahçe 1" })).error, /zaten boş/);
ts = await tadmin({ action: "table", n: 2 }); // #1 (2 kişi) adsız 2'lik masaya
assert.equal(ts.seated, t1.no);
assert.equal((await tme(t1.id)).table.cap, 2);
ts = await tadmin({ action: "drop", id: t2.id }); // #2 gelmedi: Masa 7 (4'lük) #3'e (3 kişi) geçer
assert.equal((await tme(t3.id)).table.name, "7", "gelmeyenin masası sıradaki uygun gruba");
const t4 = await tjoin("table-device-00000004", 5); // gelen 5 kişi bekleyen 6'lık masaya oturur
assert.equal((await tme(t4.id)).table.name, "Bahçe 1", "sıraya girince bekleyen masaya hemen çağrılır");
ts = await tadmin();
assert.equal(ts.freeTables.length, 0);
const t5 = await tjoin("table-device-00000005", 1);
ts = await tadmin({ action: "table", n: 4 }); // 1 kişi 4'lüğe sınırı aşar → bekler; görevli elle çağırırsa masayı alır
assert.equal(ts.seated, null);
await tadmin({ action: "call", id: t5.id });
assert.equal((await tme(t5.id)).table.cap, 4, "elle çağırmada sınır yok");
await tadmin({ action: "table", n: 2 });
ts = await tadmin({ action: "untable", id: (await tadmin()).freeTables[0].id });
assert.equal(ts.freeTables.length, 0);
await req("DELETE", `/api/admin/rooms/${tr.room}`, undefined, PW);
// Gişe modu: tek sıra, "Sıradakini çağır" gişeye yönlendirir; önceki grup gelmiş sayılır; boştaki gişe ilk gelene
assert.match((await post("/api/admin/rooms", { name: "Banka", slug: `${slug}-gise`, radius: 300, mode: "desks", desks: " , ", ...spot }, PW)).error, /gişe adı/);
const dr = await post("/api/admin/rooms", { name: "Banka", slug: `${slug}-gise`, radius: 300, mode: "desks", desks: "1, 2, Vezne A, 2", flex: true, ...spot }, PW);
const dadmin = (body = {}) => post(`/api/r/${dr.room}/admin`, body, { "x-key": dr.key });
let ds = await dadmin();
assert.deepEqual([ds.mode, ds.desks, ds.flex], ["desks", ["1", "2", "Vezne A"], false], "tekrarlanan gişe atılır, esnek yer yok");
const djoin = (device) => post(`/api/r/${dr.room}/join`, { t: ds.token, ...spot, size: 1, device });
const dme = async (id) => (await fetch(`${B}/api/r/${dr.room}/me?id=${id}`)).json();
const d1 = await djoin("desk-device-00000001"), d2 = await djoin("desk-device-00000002"), d3 = await djoin("desk-device-00000003");
assert.equal((await dme(d1.id)).status, "waiting", "gişe açılmadan kimse çağrılmaz");
await dadmin({ action: "next", desk: "1" });
await dadmin({ action: "next", desk: "2" });
assert.deepEqual(((m) => [m.status, m.desk])(await dme(d1.id)), ["called", "1"]);
assert.equal((await dme(d2.id)).desk, "2");
assert.deepEqual((await req("GET", `/api/r/${dr.room}/status`)).deskOf, { [d1.no]: "1", [d2.no]: "2" });
await dadmin({ action: "next", desk: "1" }); // #1'in işi bitti, #3 gişe 1'e
assert.equal((await dme(d1.id)).status, "gone");
assert.equal((await dme(d3.id)).desk, "1");
ds = await dadmin({ action: "next", desk: "Vezne A" }); // bekleyen yok: gişe boşta bekler
assert.deepEqual(ds.idle, ["Vezne A"]);
const d4 = await djoin("desk-device-00000004");
assert.equal((await dme(d4.id)).desk, "Vezne A", "boştaki gişeye ilk giren hemen çağrılır");
ds = await dadmin({ action: "drop", id: d2.id }); // gişe 2'deki gelmedi: gişe boşa düşer
assert.deepEqual(ds.idle, ["2"]);
ds = await dadmin({ action: "undesk", desk: "2" });
assert.deepEqual(ds.idle, []);
assert.equal((await dadmin({ action: "next", desk: "9" })).error, "Gişe bulunamadı");
const d5 = await djoin("desk-device-00000005");
assert.equal((await dme(d5.id)).status, "waiting");
await dadmin({ action: "call", id: d5.id, desk: "2" });
assert.equal((await dme(d5.id)).desk, "2", "elle çağırma seçilen gişeye");
assert.equal((await req("GET", `/api/admin/rooms/${dr.room}/stats`, undefined, PW)).days.at(-1).served, 1);
await req("DELETE", `/api/admin/rooms/${dr.room}`, undefined, PW);
// Bölgeler: ziyaretçi kabul ettiği bölgeleri seçer, boş yer bölge bölge; katı sıra her bölgede ayrı işler
assert.match((await post("/api/admin/rooms", { name: "Kafe", slug: `${slug}-bolge`, radius: 300, zones: "a,b,c,d,e,f,g,h,i,j,k", ...spot }, PW)).error, /En fazla 10 bölge/);
const zr = await post("/api/admin/rooms", { name: "Kafe", slug: `${slug}-bolge`, radius: 300, zones: "İçeri, Dışarı", ...spot }, PW);
const zadmin = (body = {}) => post(`/api/r/${zr.room}/admin`, body, { "x-key": zr.key });
let zs = await zadmin();
assert.deepEqual([zs.zones, zs.spots], [["İçeri", "Dışarı"], { İçeri: 0, Dışarı: 0 }]);
const zjoin = (device, size, zones) => post(`/api/r/${zr.room}/join`, { t: zs.token, ...spot, size, zones, device });
const zme = async (id) => (await fetch(`${B}/api/r/${zr.room}/me?id=${id}`)).json();
assert.match((await zjoin("zone-device-00000000", 2)).error, /en az bir bölge/);
const z1 = await zjoin("zone-device-00000001", 2, ["İçeri"]), z2 = await zjoin("zone-device-00000002", 2, ["Dışarı", "Yok"]);
const z3 = await zjoin("zone-device-00000003", 3, ["Dışarı", "İçeri"]), z4 = await zjoin("zone-device-00000004", 1, ["İçeri"]);
assert.deepEqual((await zme(z3.id)).zones, ["İçeri", "Dışarı"], "bölgeler sıranın sırasıyla, bilinmeyen atılır");
assert.deepEqual([(await zme(z2.id)).aheadGroups, (await zme(z4.id)).aheadGroups], [0, 2], "önündekiler yalnızca aynı bölgeyi isteyenler");
assert.deepEqual((await req("GET", `/api/r/${zr.room}/status`)).zones.map((z) => [z.name, z.waiting]), [["İçeri", 3], ["Dışarı", 2]]);
await zadmin({ action: "free", n: 2, zone: "Dışarı" });
assert.deepEqual(((m) => [m.status, m.zone, m.alloc])(await zme(z2.id)), ["called", "Dışarı", 2]);
zs = await zadmin({ action: "free", n: 3, zone: "İçeri" }); // #1 içeri; #3 (3 kişi) sığmaz, iki bölgeyi de tıkar → #4 bekler
assert.equal((await zme(z1.id)).zone, "İçeri");
assert.equal((await zme(z4.id)).status, "waiting", "katı sırada sığmayan grup bölgelerini tıkar");
assert.deepEqual(zs.spots, { İçeri: 1, Dışarı: 0 });
zs = await zadmin({ action: "free", n: 3, zone: "Dışarı" }); // #3 dışarı, ardından #4 içerideki 1 yere
assert.equal((await zme(z3.id)).zone, "Dışarı");
assert.deepEqual(((m) => [m.status, m.zone])(await zme(z4.id)), ["called", "İçeri"]);
assert.deepEqual(zs.spots, { İçeri: 0, Dışarı: 0 });
zs = await zadmin({ action: "drop", id: z2.id }); // dışarıdaki gelmedi: 2 yer dışarıya döner
assert.deepEqual(zs.spots, { İçeri: 0, Dışarı: 2 });
assert.equal((await zadmin({ action: "free", n: 1, zone: "Bahçe" })).error, "Bölge bulunamadı");
assert.match((await zadmin({ action: "add", size: 1 })).error, /en az bir bölge/);
zs = await zadmin({ action: "add", size: 2, zones: ["Dışarı"] });
assert.deepEqual(((e) => [e.status, e.zone])(zs.entries.find((e) => e.no === zs.added)), ["called", "Dışarı"], "elle eklenen bölgesindeki boş yere");
await req("DELETE", `/api/admin/rooms/${zr.room}`, undefined, PW);
// Masa + bölge: masa yalnızca o bölgeyi kabul eden gruba
const zt = await post("/api/admin/rooms", { name: "Lokanta", slug: `${slug}-bolge-masa`, radius: 300, mode: "tables", zones: "Bahçe, Salon", ...spot }, PW);
const ztadmin = (body = {}) => post(`/api/r/${zt.room}/admin`, body, { "x-key": zt.key });
const ztj = await post(`/api/r/${zt.room}/join`, { t: (await ztadmin()).token, ...spot, size: 2, zones: ["Salon"], device: "zone-table-device-001" });
assert.match((await ztadmin({ action: "table", n: 2 })).error, /Bölge bulunamadı/);
assert.equal((await ztadmin({ action: "table", n: 2, zone: "Bahçe" })).seated, null, "bahçedeki masa salonu bekleyene verilmez");
assert.equal((await ztadmin({ action: "table", n: 2, zone: "Salon" })).seated, ztj.no);
assert.equal((await (await fetch(`${B}/api/r/${zt.room}/me?id=${ztj.id}`)).json()).zone, "Salon");
await req("DELETE", `/api/admin/rooms/${zt.room}`, undefined, PW);
// Şifre değişince eski oturum düşer; kullanıcının seçtiği şifre sızıntı listelerinde olmamalı
const strong = () => `smoke-${randomBytes(12).toString("hex")}`;
assert.match((await post("/api/admin/password", { old: "yanlis-sifre", password: strong() }, PW)).error, /hatalı/);
assert.match((await post("/api/admin/password", { old: "deneme123", password: "password123" }, PW)).error, /sızıntı/);
const PW3 = { authorization: `Bearer ${(await post("/api/admin/password", { old: "deneme123", password: strong() }, PW)).token}` };
assert.match((await req("GET", "/api/admin/rooms", undefined, PW)).error, /Oturum geçersiz/);
assert.deepEqual(await req("GET", "/api/admin/rooms", undefined, PW3), []);
const um = await req("GET", "/api/admin/me", undefined, PW3);
assert.ok(um.verified && um.balance.metered === false, "süper yöneticinin açtığı kullanıcı doğrulanmış ve sınırsız");
await req("DELETE", `/api/admin/users/${U}`, undefined, SU);

// --- Hesap açma, e-posta doğrulama, bilet hakkı, ödeme ---
const LOG = process.env.WRANGLER_LOG;
// DEV=1 iken mail.js bağlantıyı günlüğe yazar: "mail verify → a@b: http://…/admin?verify=<belirteç>"
const mailed = async (kind, to) => {
  if (!LOG) return null;
  for (let i = 0; i < 20; i++) {
    const m = [...readFileSync(LOG, "utf8").matchAll(new RegExp(`mail ${kind} → ${to.replace(/[.+]/g, "\\$&")}: \\S+[?&]${kind}=([a-f0-9]+)`, "g"))].at(-1);
    if (m) return m[1];
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`${kind} e-postası günlükte yok`);
};
const cfg = await req("GET", "/api/config");
assert.equal(cfg.free, 1000);
const captcha = "XXXX.DUMMY.TOKEN.XXXX"; // Turnstile test anahtarı her belirteci kabul eder
const N = `self${Date.now()}`, EM = `${N}@example.com`, P1 = strong();
const signup = (b) => post("/api/signup", { user: N, email: EM, password: P1, captcha, terms: "2026-09-30", ...b });
assert.match((await signup({ terms: undefined })).error, /koşullarını/, "koşullar kabul edilmeden hesap açılmaz");
assert.match((await signup({ email: "yok" })).error, /Geçersiz e-posta/);
assert.match((await signup({ user: "destek" })).error, /Geçersiz kullanıcı/, "resmi görünen adlar ayrılmış");
assert.match((await signup({ password: "password123" })).error, /sızıntı/);
const S1 = await signup({ ref: { src: "qrwait/join<b>", page: "/beach-queue" } });
assert.ok(S1.token && S1.user === N, "hesap açan kullanıcı girişli döner");
const SA = { authorization: `Bearer ${S1.token}` };
assert.match((await signup({ user: `${N}-b` })).error, /e-posta ile/, "aynı e-posta iki hesapta olamaz");
assert.match((await signup({ email: `x${EM}` })).error, /alınmış/);
const sref = (await req("GET", "/api/admin/users", undefined, SU)).users.find((u) => u.name === N).ref;
assert.deepEqual(sref, { src: "qrwait/joinb", page: "/beach-queue" }, "kayıt kaynağı düz metin olarak saklanır");
let sme = await req("GET", "/api/admin/me", undefined, SA);
assert.deepEqual([sme.verified, sme.email, sme.balance.metered, sme.balance.left], [false, EM, true, 1000]);
assert.match((await post("/api/admin/rooms", { name: "X", slug: `${N}-x`, radius: 300, ...spot }, SA)).error, /doğrulayın/, "doğrulanmadan sıra açılmaz");
assert.match((await post("/api/admin/checkout", { variant: "111" }, SA)).error, /doğrulayın/);
assert.match((await post("/api/verify", { token: "0".repeat(48) })).error, /Bağlantı geçersiz/);
const vt = await mailed("verify", EM);
if (vt) assert.equal((await post("/api/verify", { token: vt })).user, N);
else await post(`/api/admin/users/${N}/plan`, { verified: true }, SU);
if (vt) assert.match((await post("/api/verify", { token: vt })).error, /Bağlantı geçersiz/, "doğrulama bağlantısı tek kullanımlık");
assert.equal((await req("GET", "/api/admin/me", undefined, SA)).verified, true);
assert.match((await post("/api/admin/verify", {}, SA)).error, /zaten doğrulanmış/);
// Bilet hakkı: her yeni bilet 1 düşer (QR ve elle ekleme), bitince görevli nedenini, ziyaretçi yalnızca kapalı olduğunu görür
const sr = await post("/api/admin/rooms", { name: N, slug: `${N}-sira`, radius: 300, ...spot }, SA);
assert.ok(sr.room);
await post(`/api/admin/users/${N}/plan`, { grant: -997 }, SU); // 1000 - 997 = 3 hak
const sadmin = (body = {}) => post(`/api/r/${sr.room}/admin`, body, { "x-key": sr.key });
await sadmin({ action: "add", size: 1 });
const sjoin = (device) => sadmin().then(({ token: t }) => post(`/api/r/${sr.room}/join`, { t, ...spot, size: 1, device }));
const j1 = await sjoin("paid-device-000000001");
assert.equal((await sjoin("paid-device-000000001")).no, j1.no, "aynı cihazın bileti yeniden sayılmaz");
await sjoin("paid-device-000000002");
assert.match((await sjoin("paid-device-000000003")).error, /yeni kişi almıyor/, "hak bitince ziyaretçi sıraya giremez");
assert.match((await sadmin({ action: "add", size: 1 })).error, /Bilet hakkı bitti/);
assert.equal((await sadmin()).entries.length, 3, "hakkı yetmeyen bilet sırada kalmaz");
sme = await req("GET", "/api/admin/me", undefined, SA);
assert.deepEqual([sme.balance.used, sme.balance.left], [3, 0]);
// Lemon Squeezy webhook'u: imzasız istek reddedilir, sipariş bir kez yüklenir, iade geri alır
const hook = (event, status, id = "9001", secret = "test-webhook-secret") => {
  const raw = JSON.stringify({ meta: { event_name: event, test_mode: true, custom_data: { user: N } },
    data: { id, attributes: { status, total_formatted: "$1.00", first_order_item: { variant_id: 111, quantity: 1 } } } });
  return fetch(`${B}/api/lemon`, { method: "POST", headers: { "content-type": "application/json", "x-signature": createHmac("sha256", secret).update(raw).digest("hex") }, body: raw });
};
assert.equal((await hook("order_created", "paid", "9001", "yanlis")).status, 401, "imzası tutmayan webhook");
assert.equal((await hook("order_created", "paid")).status, 200);
assert.equal((await hook("order_created", "paid")).status, 200);
const left = async () => (await req("GET", "/api/admin/me", undefined, SA)).balance.left;
assert.equal(await left(), 500, "aynı sipariş iki kez yüklenmez");
assert.ok((await sjoin("paid-device-000000003")).no, "hak yüklenince sıra yeniden çalışır");
await hook("order_refunded", "refunded");
assert.equal(await left(), -1, "iade edilen paket geri alınır");
await post(`/api/admin/users/${N}/plan`, { grant: 1001 }, SU);
assert.match((await post("/api/admin/checkout", { variant: "999" }, SA)).error, /Ödeme şu an/, "bilinmeyen paket");
// Askıya alma: giriş ve oturum düşer, sıra haritadan kalkar, bilet alınmaz
const listedNames = async () => (await req("GET", "/api/rooms")).map((r) => r.name);
assert.ok((await listedNames()).includes(N));
await post(`/api/admin/users/${N}/plan`, { suspended: true }, SU);
assert.match((await req("GET", "/api/admin/me", undefined, SA)).error, /askıya/);
assert.match((await post("/api/login", { user: EM, password: P1 })).error, /askıya/, "e-postayla giriş; askıdaki hesap giremez");
assert.ok(!(await listedNames()).includes(N), "askıdaki kullanıcının sırası haritada yok");
assert.match((await sjoin("paid-device-000000004")).error, /yeni kişi almıyor/);
await post(`/api/admin/users/${N}/plan`, { suspended: false }, SU);
// Görevli linki olmadan başkasının odası içe aktarılamaz
assert.match((await post(`/api/admin/rooms/${sr.room}/import`, { key: "yanlis" }, SA)).error, /Yetkisiz/);
// Şifremi unuttum: kayıtlı olmayan e-postada da aynı yanıt
assert.deepEqual(await post("/api/forgot", { email: `yok-${EM}`, captcha }), { ok: true });
assert.deepEqual(await post("/api/forgot", { email: EM, captcha }), { ok: true });
const rt = await mailed("reset", EM);
let cur = P1;
if (rt) {
  assert.match((await post("/api/reset", { token: rt, password: "password123" })).error, /sızıntı/);
  const P2 = strong();
  assert.deepEqual(await post("/api/reset", { token: rt, password: P2 }), { ok: true });
  assert.match((await post("/api/reset", { token: rt, password: strong() })).error, /Bağlantı geçersiz/, "sıfırlama bağlantısı tek kullanımlık");
  assert.match((await req("GET", "/api/admin/me", undefined, SA)).error, /Oturum geçersiz/, "şifre sıfırlanınca oturumlar düşer");
  SA.authorization = `Bearer ${(await post("/api/login", { user: N, password: P2 })).token}`;
  cur = P2;
} else console.log("WRANGLER_LOG yok: şifre sıfırlama bağlantısı testi atlandı");
// E-posta değiştirme: yeni adrese onay bağlantısı gider, açılana kadar eski adres geçerli kalır
const EM2 = `${N}-yeni@example.com`, U4 = `${N}-d`, EU4 = `${U4}@example.com`;
await post("/api/admin/users", { user: U4, password: "deneme123", email: EU4 }, SU);
assert.match((await post("/api/admin/email", { email: EM2, password: "yanlis" }, SA)).error, /hatalı/);
assert.match((await post("/api/admin/email", { email: EM, password: cur }, SA)).error, /zaten bu adres/);
assert.match((await post("/api/admin/email", { email: EU4, password: cur }, SA)).error, /e-posta ile/);
assert.deepEqual(await post("/api/admin/email", { email: EM2, password: cur }, SA), { ok: true });
assert.equal((await req("GET", "/api/admin/me", undefined, SA)).email, EM, "onaylanmadan adres değişmez");
const et = await mailed("email", EM2);
if (et) {
  assert.deepEqual(await post("/api/email", { token: et }), { user: N, email: EM2 });
  assert.match((await post("/api/email", { token: et })).error, /Bağlantı geçersiz/, "onay bağlantısı tek kullanımlık");
  assert.equal((await req("GET", "/api/admin/me", undefined, SA)).email, EM2);
  assert.match(readFileSync(LOG, "utf8"), new RegExp(`mail changed → ${EM.replace(/[.+]/g, "\\$&")}: mailto:`), "eski adrese değişiklik bildirimi");
  // Eski adres boşa çıktı: başka hesaba verilebilir
  assert.equal(typeof (await post(`/api/admin/users/${U4}/plan`, { email: EM }, SU)).used, "number");
} else console.log("WRANGLER_LOG yok: e-posta değiştirme bağlantısı testi atlandı");
await req("DELETE", `/api/admin/users/${U4}`, undefined, SU);
// Kullanıcı adı değiştirme: sıralar, bakiye ve e-posta yeni ada geçer; eski ad yeni ada yönlenir ve başkasına verilmez
const N2 = `${N}-yeni`, before = await left();
assert.match((await post("/api/admin/rename", { user: N2, password: "yanlis" }, SA)).error, /hatalı/);
assert.match((await post("/api/admin/rename", { user: N, password: cur }, SA)).error, /zaten bu/);
assert.match((await post("/api/admin/rename", { user: "xn--abc", password: cur }, SA)).error, /Geçersiz kullanıcı/, "punycode biçimli ad");
const rn = await post("/api/admin/rename", { user: N2, password: cur }, SA);
assert.equal(rn.user, N2);
assert.match((await req("GET", "/api/admin/me", undefined, SA)).error, /Oturum geçersiz/, "eski adın oturumu düşer");
SA.authorization = `Bearer ${rn.token}`;
assert.equal((await req("GET", "/api/admin/me", undefined, SA)).user, N2);
assert.equal(await left(), before, "bakiye yeni ada taşınır");
assert.deepEqual((await req("GET", "/api/admin/rooms", undefined, SA)).map((r) => r.room), [sr.room]);
assert.equal((await resolve(`${N}-sira`, N2)).room, sr.room);
assert.equal((await resolve(`${N}-sira`, N)).room, sr.room, "eski adla açık kalan sayfa yeni ada çözülür");
assert.deepEqual((await req("GET", `/api/rooms?u=${N}`)).map((r) => r.name), [N], "eski adın herkese açık listesi");
await sadmin({ action: "add", size: 1 });
assert.equal(await left(), before - 1, "odanın biletleri yeni adın hesabından düşer");
assert.match((await post("/api/admin/users", { user: N, password: "deneme123" }, SU)).error, /alınmış/, "eski ad başkasına verilmez");
assert.match((await post("/api/admin/rename", { user: `${N}-uc`, password: cur }, SA)).error, /30 günde/);
const users = (await req("GET", "/api/admin/users", undefined, SU)).users.map((u) => u.name);
assert.ok(users.includes(N2) && !users.includes(N));
// Süper yönetici 30 gün sınırı olmadan değiştirebilir; kullanıcı eski adına dönebilir
assert.deepEqual(await post(`/api/admin/users/${N2}/rename`, { user: N }, SU), { user: N });
assert.equal((await resolve(`${N}-sira`, N2)).room, sr.room, "dönüşte de eski ad yönlenir");
assert.deepEqual(await post(`/api/admin/users/${N}/rename`, { user: N2 }, SU), { user: N2 });
assert.equal(await left(), before - 1, "bakiye taşınmalarda korunur");
await hook("order_created", "paid", "9002"); // ödeme sayfası eski adla açılmıştı
assert.equal(await left(), before - 1 + 500, "eski adla verilen siparişin biletleri yeni ada yüklenir");
// Dil: hesap e-postalarının dili hesaba yazılır
assert.deepEqual(await post("/api/admin/lang", { lang: "de" }, SA), { ok: true });
// Hesabı silme: önce sıralar silinmeli
assert.match((await post("/api/admin/account/delete", { password: "yanlis" }, SA)).error, /hatalı/);
assert.match((await post("/api/admin/account/delete", { password: cur }, SA)).error, /sıraları var/);
await req("DELETE", `/api/admin/rooms/${sr.room}`, undefined, SA);
assert.deepEqual(await post("/api/admin/account/delete", { password: cur }, SA), { ok: true });
assert.match((await req("GET", "/api/admin/me", undefined, SA)).error, /Oturum geçersiz/);
// IP başına istek sınırı (en sonda: dakikada 10 istek)
const codes = await Promise.all(Array.from({ length: 12 }, () => fetch(`${B}/api/verify`, { method: "POST", headers: { "content-type": "application/json" }, body: "{}" }).then((r) => r.status)));
assert.ok(codes.includes(429), "istek sınırı");
// Güvenlik başlıkları
const hp = await fetch(`${B}/admin`);
assert.ok(hp.headers.get("content-security-policy")?.includes("frame-ancestors 'none'") && hp.headers.get("x-content-type-options") === "nosniff");
console.log("smoke OK");
