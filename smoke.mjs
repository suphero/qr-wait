// `npm run dev` açıkken çalıştırın: node smoke.mjs  (.dev.vars içinde ADMIN_PASSWORD=test, ya da PASSWORD=<şifre> node smoke.mjs)
// WRANGLER_LOG=<wrangler dev çıktısı>: e-posta bağlantıları (DEV=1) oradan okunur; yoksa şifre sıfırlama testi atlanır.
// Giriş IP başına dakikada 10 istekle sınırlı: art arda çalıştırırken bir dakika bekleyin.
import assert from "node:assert/strict";
import { createECDH, createHmac, randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";

const B = process.env.BASE ?? "http://localhost:8787";
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
// Ziyaretçinin dili: hata mesajları o dilde, desteklenmeyen dilde Türkçe
const ljoin = (lang, body = {}) => post(`/api/r/${room}/join`, { t: `${Date.now() - 120000}.x`, ...spot, size: 2, device: "device-lang-000000001", lang, ...body }, { "x-lang": lang });
assert.match((await ljoin("en")).error, /QR code has expired/);
assert.match((await ljoin("de")).error, /QR-Code ist abgelaufen/);
assert.match((await ljoin("ru")).error, /QR-кода истёк/);
assert.match((await ljoin("fr")).error, /süresi dolmuş/, "desteklenmeyen dil → Türkçe");
assert.match((await ljoin("en", { t: token, size: 99 })).error, /1–8 people/);

const me = async (id) => (await fetch(`${B}/api/r/${room}/me?id=${id}`)).json();
assert.equal((await me(c.id)).aheadPeople, 6);

// #1 bildirim açık: çağrılınca push gönderilir (sahte abonelik, gönderim hatası isteği bozmamalı)
const ec = createECDH("prime256v1"); ec.generateKeys();
const sub = { endpoint: `https://fcm.googleapis.com/fcm/send/${"x".repeat(40)}`, keys: { p256dh: ec.getPublicKey().toString("base64url"), auth: randomBytes(16).toString("base64url") } };
assert.deepEqual(await post(`/api/r/${room}/push`, { id: a.id, sub }), { ok: true });
assert.equal((await post(`/api/r/${room}/push`, { id: a.id, sub: { endpoint: "https://evil.example/x" } }, { "x-lang": "de" })).error, "Ungültiges Benachrichtigungsabonnement");

// 3 kişi kalktı: #1 (2 kişi) çağrılır, 1 yer artar
let s = await admin({ action: "free", n: 3 });
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
const S1 = await signup();
assert.ok(S1.token && S1.user === N, "hesap açan kullanıcı girişli döner");
const SA = { authorization: `Bearer ${S1.token}` };
assert.match((await signup({ user: `${N}-b` })).error, /e-posta ile/, "aynı e-posta iki hesapta olamaz");
assert.match((await signup({ email: `x${EM}` })).error, /alınmış/);
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
