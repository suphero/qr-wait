// `npm run dev` açıkken çalıştırın: node smoke.mjs  (.dev.vars içinde ADMIN_PASSWORD=test)
import assert from "node:assert/strict";

const B = process.env.BASE ?? "http://localhost:8787";
const req = async (method, p, body, h = {}) => {
  const r = await fetch(B + p, { method, headers: { "content-type": "application/json", ...h }, body: body && JSON.stringify(body) });
  return r.json();
};
const post = (p, body, h) => req("POST", p, body, h);
const PW = { "x-admin": process.env.PASSWORD ?? "test" };
const spot = { lat: 36.8841, lng: 30.7056 };

const slug = `test-${Date.now()}`;
const { room, key } = await post("/api/admin/rooms", { name: "Test Sırası", slug, radius: 300, ...spot }, PW);
assert.ok(room && key);
const resolve = async (r, h) => (await req("GET", `/api/resolve?r=${r}`, undefined, h));
assert.equal((await resolve(slug)).room, room, "slug oda id'sine çözülür");
assert.equal((await resolve(room)).room, room, "eski id linkleri çalışır");
assert.match((await post("/api/admin/rooms", { name: "X", slug, radius: 300, ...spot }, PW)).error, /kullanılıyor/, "aynı slug iki odaya verilemez");
assert.match((await post("/api/admin/rooms", { name: "X", slug: "Kötü Adres", radius: 300, ...spot }, PW)).error, /Geçersiz adres/);
assert.equal((await req("GET", "/api/admin/rooms", undefined, { "x-admin": "yanlis" })).error, "Hatalı şifre");

const admin = (body = {}) => post(`/api/r/${room}/admin`, body, { "x-key": key });
assert.equal((await post(`/api/r/${room}/admin`, {}, { "x-key": "x" })).error, "Yetkisiz");
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

const me = async (id) => (await fetch(`${B}/api/r/${room}/me?id=${id}`)).json();
assert.equal((await me(c.id)).aheadPeople, 6);

// 3 kişi kalktı: #1 (2 kişi) çağrılır, 1 yer artar
let s = await admin({ action: "free", n: 3 });
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
assert.match((await post("/api/admin/rooms", { name: "X", slug: `${slug}-x`, radius: 300, maxGroup: 50, ...spot }, PW)).error, /1-20/);
await req("DELETE", `/api/admin/rooms/${o.room}`, undefined, PW);
console.log("smoke OK");
