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
console.log("smoke OK");
