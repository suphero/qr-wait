import { DurableObject } from "cloudflare:workers";
import { cleanSub, sendPush } from "./push.js";

const TTLS = [60, 90, 180, 300]; // seçilebilir QR geçerlilik süreleri (sn); görevli ekranı süre/4'te bir yeni kod gösterir
const MAX_GROUP = 8; // varsayılan en büyük grup
const GROUP_LIMIT = 20;
const CATEGORIES = new Set(["plaj", "iskele", "gise", "restoran", "saglik", "resmi", "etkinlik", "diger"]); // ikonları public/app.js'te
const MAX_ENTRIES = 1000;

const enc = (s) => new TextEncoder().encode(String(s ?? ""));
const same = (a, b) => {
  const x = enc(a), y = enc(b);
  return x.length === y.length && crypto.subtle.timingSafeEqual(x, y);
};

async function sign(key, msg) {
  const k = await crypto.subtle.importKey("raw", enc(key), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", k, enc(msg)));
  return [...sig.slice(0, 10)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

// Haversine mesafesi, metre
function meters(a, b) {
  const r = Math.PI / 180;
  const h = Math.sin(((b.lat - a.lat) * r) / 2) ** 2 +
    Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(((b.lng - a.lng) * r) / 2) ** 2;
  return 2 * 6371e3 * Math.asin(Math.sqrt(h));
}

const int = (v, min, max, msg) => {
  const n = Math.trunc(Number(v));
  if (!(n >= min && n <= max)) throw new Error(msg);
  return n;
};

// Grubun kabul ettiği yer sayıları (ör. 4 kişi: [2, 4]). Esnek olmayan sırada ve eski kayıtlarda yalnızca grup büyüklüğü.
const acceptOf = (e) => e.accept ?? [e.size];

// Sonradan eklenen oda ayarları; eski kayıtlarda alan yoksa varsayılan
const conf = (s) => ({
  category: s.category ?? "diger", maxGroup: s.maxGroup ?? MAX_GROUP, qr: s.qr ?? "dynamic", ttl: s.ttl ?? 90,
});

// Boş yere sığan en büyük kabul edilen yer sayısı; hiçbiri sığmıyorsa null
function fit(e, available) {
  const ok = acceptOf(e).filter((a) => a <= available);
  return ok.length ? Math.max(...ok) : null;
}

function acceptList(accept, size, flex) {
  if (!flex) return [size];
  const list = [...new Set([].concat(accept ?? size).map(Number))].filter((a) => Number.isInteger(a) && a >= 1 && a <= size);
  if (!list.length) throw new Error("Kabul ettiğiniz en az bir yer sayısı seçin");
  return list.sort((a, b) => a - b);
}

// Sıra başına bir oda (plaj, iskele, gişe…). Tüm durum tek bir kayıtta tutulur.
// ponytail: tek kayıtta tüm durum, MAX_ENTRIES ile sınırlı; binlerce kişi olursa SQL tablolarına geç.
export class Room extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    ctx.blockConcurrencyWhile(async () => { this.s = await ctx.storage.get("s"); });
  }

  need() {
    if (!this.s) throw new Error("Sıra bulunamadı");
    return this.s;
  }

  save() { return this.ctx.storage.put("s", this.s); }

  async create(fields) {
    if (this.s) throw new Error("Oda zaten var");
    this.s = { ...fields, key: crypto.randomUUID(), seq: 0, available: 0, entries: [] };
    await this.save();
    return this.s.key;
  }

  info() {
    const s = this.need(), w = s.entries.filter((e) => e.status === "waiting");
    return {
      name: s.name, slug: s.slug, lat: s.lat, lng: s.lng, radius: s.radius, flex: !!s.flex, private: !!s.private, key: s.key, ...conf(s),
      waiting: w.length, people: w.reduce((n, e) => n + e.size, 0), called: s.entries.length - w.length,
    };
  }

  // Herkese açık sıra durumu: yalnızca sayılar ve numaralar, kişisel bilgi (not, cihaz, bilet id) yok
  status() {
    const s = this.need(), w = s.entries.filter((e) => e.status === "waiting");
    return {
      name: s.name, slug: s.slug, lat: s.lat, lng: s.lng, flex: !!s.flex, private: !!s.private,
      category: conf(s).category, maxGroup: conf(s).maxGroup,
      waiting: w.length, people: w.reduce((n, e) => n + e.size, 0), next: w[0]?.no ?? null,
      called: s.entries.filter((e) => e.status === "called").map((e) => e.no), lastNo: s.lastNo ?? null,
    };
  }

  async update(fields) {
    Object.assign(this.need(), fields);
    await this.save();
  }

  // Görevli bağlantısı sızarsa: eski bağlantı ve ekrandaki QR anında geçersiz olur
  async rotate() {
    this.need().key = crypto.randomUUID();
    await this.save();
    return this.s.key;
  }

  async destroy() {
    await this.ctx.storage.deleteAll();
    this.s = undefined;
  }

  // Sabit QR: "s.<imza>", yazdırılıp asılabilir; yalnızca oda sabit moddayken ve anahtar değişmedikçe geçerli
  async token() {
    const s = this.need();
    if (conf(s).qr === "static") return `s.${await sign(s.key, "static")}`;
    const ts = String(Date.now());
    return `${ts}.${await sign(s.key, ts)}`;
  }

  async join({ t, lat, lng, size, accept, device }) {
    const s = this.need(), c = conf(s);
    const [ts, sig] = String(t).split(".");
    if (ts === "s") {
      if (c.qr !== "static" || !same(sig, await sign(s.key, "static")))
        throw new Error("Bu QR kodu artık geçerli değil. Görevliden güncel kodu isteyin.");
    } else {
      const age = Date.now() - Number(ts);
      if (!(age > -5000 && age < c.ttl * 1000) || !same(sig, await sign(s.key, ts)))
        throw new Error("QR kodunun süresi dolmuş. Görevlinin ekranındaki kodu yeniden okutun.");
    }
    if (!(meters(s, { lat: Number(lat), lng: Number(lng) }) <= s.radius))
      throw new Error("Sıranın bulunduğu yerde görünmüyorsunuz. Konum izniniz açık olmalı ve orada olmalısınız.");
    if (typeof device !== "string" || device.length < 16) throw new Error("Geçersiz cihaz");
    size = int(size, 1, c.maxGroup, `Grup 1-${c.maxGroup} kişi olmalı`);
    accept = acceptList(accept, size, s.flex);
    // Aynı cihaz ikinci bilet alamaz, mevcut bileti geri döner
    const e = s.entries.find((x) => x.device === device) ?? this.add(size, accept, "qr", device);
    await this.save();
    return { id: e.id, no: e.no };
  }

  add(size, accept, src, device = null, note = "") {
    if (this.s.entries.length >= MAX_ENTRIES) throw new Error("Sıra dolu");
    const e = { id: crypto.randomUUID(), no: ++this.s.seq, size, accept, src, device, note, status: "waiting", at: Date.now() };
    this.s.entries.push(e);
    return e;
  }

  me(id) {
    const s = this.need();
    const i = s.entries.findIndex((e) => e.id === id);
    if (i < 0) return { name: s.name, status: "gone" };
    const e = s.entries[i];
    const ahead = s.entries.slice(0, i).filter((x) => x.status === "waiting");
    return {
      name: s.name, no: e.no, size: e.size, accept: acceptOf(e), alloc: e.alloc, status: e.status, calledAt: e.calledAt,
      aheadGroups: ahead.length, aheadPeople: ahead.reduce((n, x) => n + x.size, 0),
    };
  }

  async leave(id) {
    this.need();
    this.drop(id);
    this.fill();
    await this.save();
    await this.notify();
    return { ok: true };
  }

  // Sayfa kapalıyken / ekran kilitliyken haber verebilmek için tarayıcının push aboneliği
  async subscribe(id, sub) {
    const e = this.need().entries.find((x) => x.id === id);
    if (!e) throw new Error("Sıra kaydı bulunamadı");
    e.push = cleanSub(sub);
    await this.save();
    return { ok: true };
  }

  // call() ile biriken çağrılara push gönderir. Sayfa açıksa yoklama zaten yakalar; push hatası isteği bozmamalı.
  async notify() {
    const list = this.outbox ?? [];
    this.outbox = [];
    if (!list.length || !this.env.VAPID_PRIVATE_KEY) return;
    const s = this.s;
    let dead = false;
    await Promise.all(list.map(async (e) => {
      const msg = {
        title: "Sıra size geldi!",
        body: `${s.name} · ${e.no} numara. Görevliye gidip numaranızı gösterin.`,
        tag: `called-${e.id}`,
        url: s.slug ? `/join?r=${s.slug}` : "/",
      };
      try {
        if (!(await sendPush(e.push, msg, this.env))) { delete e.push; dead = true; }
      } catch (err) { console.error("push", err.message); }
    }));
    if (dead) await this.save();
  }

  // Sığan en büyük seçenek ayrılır; görevli sığmayan birini elle çağırırsa en küçük seçenek
  call(e) {
    e.status = "called";
    e.calledAt = Date.now();
    e.alloc = fit(e, this.s.available) ?? Math.min(...acceptOf(e));
    this.s.lastNo = e.no;
    this.s.available = Math.max(0, this.s.available - e.alloc);
    if (e.push) (this.outbox ??= []).push(e);
  }

  // Sıradan çıkarma. Çağrılmış ama gelmemiş biri çıkarsa, ayrılan yerleri boşa döner.
  drop(id) {
    const i = this.s.entries.findIndex((e) => e.id === id);
    if (i < 0) return;
    const [e] = this.s.entries.splice(i, 1);
    if (e.status === "called") this.s.available += e.alloc ?? e.size;
  }

  // Boş yer (this.s.available) varken bekleyenleri çağırır.
  // TODO(politika): Şu an katı FIFO: sıradaki grup sığmıyorsa arkadakiler de beklemeye devam eder.
  // Alternatif: sığan küçük grupları öne al (daha az boş yer kalır ama kalabalık aileler sürekli geri düşebilir).
  fill() {
    for (const e of this.s.entries) {
      if (e.status !== "waiting") continue;
      if (fit(e, this.s.available) === null) break;
      this.call(e);
    }
  }

  async admin(key, { action, id, n, size, accept, note }) {
    const s = this.need();
    if (!same(key, s.key)) throw new Error("Yetkisiz");
    const e = s.entries.find((x) => x.id === id);
    let added;
    switch (action) {
      case "free": s.available += int(n, 1, 500, "Geçersiz sayı"); break;
      case "setAvailable": s.available = int(n, 0, 500, "Geçersiz sayı"); break;
      case "call": if (e?.status === "waiting") this.call(e); break;
      case "arrived": s.entries = s.entries.filter((x) => x !== e); break;
      case "drop": this.drop(id); break;
      case "add": {
        const sz = int(size, 1, conf(s).maxGroup, "Geçersiz grup");
        added = this.add(sz, acceptList(accept, sz, s.flex), "manual", null, String(note ?? "").slice(0, 60));
        break;
      }
      case "reset": Object.assign(s, { seq: 0, available: 0, entries: [] }); break;
    }
    this.fill();
    if (action) await this.save();
    await this.notify();
    const { qr, ttl, maxGroup } = conf(s);
    return {
      name: s.name, flex: !!s.flex, available: s.available, added: added?.no, qr, ttl, maxGroup,
      token: await this.token(),
      entries: s.entries.map(({ device, push, ...x }) => x),
    };
  }
}

// Oda listesi ve slug eşlemesi. DO'lar listelenemediği için buradadır; oda bilgisi odanın kendisindedir.
// Anahtarlar: "<oda id>" → oluşturulma zamanı, "slug:<slug>" → oda id.
// Sıcak yolda değil: sayfalar slug'ı açılışta bir kez çözer, sonra doğrudan odaya gider.
export class Registry extends DurableObject {
  add(id) { return this.ctx.storage.put(id, Date.now()); }
  remove(id, slug) { return this.ctx.storage.delete([id, `slug:${slug}`]); }
  resolve(slug) { return this.ctx.storage.get(`slug:${slug}`); }

  async list() {
    const all = [...(await this.ctx.storage.list())].filter(([k]) => !k.startsWith("slug:"));
    return all.sort((a, b) => a[1] - b[1]).map(([id]) => id);
  }

  // DO girdi kapısı sayesinde oku-yaz arasında başka istek araya giremez: aynı slug iki odaya verilemez
  async claim(slug, id, old) {
    const owner = await this.ctx.storage.get(`slug:${slug}`);
    if (owner && owner !== id) throw new Error("Bu adres başka bir sırada kullanılıyor");
    if (old && old !== slug) await this.ctx.storage.delete(`slug:${old}`);
    await this.ctx.storage.put(`slug:${slug}`, id);
  }
}

const ID_RE = /^[a-f0-9]{10}$/;
const RESERVED = new Set(["www", "api", "admin", "yonetim", "mail"]);

// antalya-konserve.sirangeldi.com → "antalya-konserve"; ana alan adı ve www için ""
function subdomain(url, env) {
  const sub = env.BASE_DOMAIN && url.hostname.endsWith(`.${env.BASE_DOMAIN}`) ? url.hostname.slice(0, -env.BASE_DOMAIN.length - 1) : "";
  return RESERVED.has(sub) ? "" : sub;
}

// Gizli sıranın adresi: 20 karakter [a-z0-9] (~103 bit), tahmin edilemez; slug kuralına uyar, ID_RE'ye uymaz
function secretSlug() {
  const abc = "abcdefghijklmnopqrstuvwxyz0123456789";
  return [...crypto.getRandomValues(new Uint8Array(20))].map((b) => abc[b % 36]).join("");
}

// prev: düzenlenen odanın mevcut bilgisi. Gizli oda gizli kaldıkça adresi korunur, gizliye geçerken yenisi üretilir.
function roomFields(b, prev) {
  const lat = Number(b.lat), lng = Number(b.lng);
  if (!(Math.abs(lat) <= 90 && Math.abs(lng) <= 180)) throw new Error("Geçersiz konum");
  const hidden = b.private === true || b.private === "on"; // haritada/listede görünmez, adresi rastgele
  const slug = hidden ? (prev?.private && prev.slug) || secretSlug() : String(b.slug ?? "").trim();
  if (!/^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/.test(slug) || ID_RE.test(slug) || RESERVED.has(slug))
    throw new Error("Geçersiz adres: 3-40 karakter, küçük harf, rakam ve tire");
  return {
    private: hidden,
    name: String(b.name ?? "").trim().slice(0, 60) || "Sıra",
    slug, lat, lng, radius: int(b.radius, 50, 2000, "Yarıçap 50-2000 m olmalı"),
    flex: b.flex === true || b.flex === "on", // grup, kişi sayısından az yeri de kabul edebilir (plaj şezlongu gibi)
    category: CATEGORIES.has(b.category) ? b.category : "diger",
    maxGroup: int(b.maxGroup ?? MAX_GROUP, 1, GROUP_LIMIT, `Grup büyüklüğü 1-${GROUP_LIMIT} kişi olmalı`),
    qr: b.qr === "static" ? "static" : "dynamic", // sabit: basılı QR, giriş yalnızca konumla sınırlı
    ttl: TTLS.includes(Number(b.ttl)) ? Number(b.ttl) : 90,
  };
}

// Görevli linki: alan adı tanımlıysa slug alt alan adı, değilse aynı origin + slug (yoksa id)
function hostLink(url, env, r) {
  if (env.BASE_DOMAIN && r.slug) return `https://${r.slug}.${env.BASE_DOMAIN}/host#${r.key}`;
  return `${url.origin}/host#${r.slug ?? r.room}.${r.key}`;
}

// Ziyaretçiye açık sıra durumu sayfası: alt alan adı ya da ?r= ile
function statusLink(url, env, ref) {
  return env.BASE_DOMAIN && !ID_RE.test(ref) ? `https://${ref}.${env.BASE_DOMAIN}/` : `${url.origin}/status?r=${ref}`;
}

async function adminApi(req, env, url, body) {
  if (!env.ADMIN_PASSWORD || !same(req.headers.get("x-admin"), env.ADMIN_PASSWORD)) throw new Error("Hatalı şifre");
  const m = url.pathname.match(/^\/api\/admin\/rooms(?:\/([a-f0-9]{10})(?:\/(rotate|import|reslug))?)?$/);
  if (!m) throw new Error("Geçersiz istek");
  const [, id, op] = m, reg = env.REGISTRY.getByName("main");
  if (!id && req.method === "GET") {
    const ids = await reg.list();
    const rooms = await Promise.all(ids.map((room) => env.ROOM.getByName(room).info().then((x) => ({ room, ...x }), () => null)));
    return rooms.filter(Boolean).map((r) => ({ ...r, link: hostLink(url, env, r) }));
  }
  if (!id && req.method === "POST") {
    const fields = roomFields(body);
    const room = crypto.randomUUID().replaceAll("-", "").slice(0, 10);
    await reg.claim(fields.slug, room);
    const key = await env.ROOM.getByName(room).create(fields);
    await reg.add(room);
    return { room, key };
  }
  const room = env.ROOM.getByName(id);
  if (op === "rotate" && req.method === "POST") return { key: await room.rotate() };
  if (op === "reslug" && req.method === "POST") {
    // Gizli sıranın adresi sızarsa: yeni rastgele adres, eski adres ve ziyaretçi linkleri anında geçersiz olur
    const prev = await room.info();
    if (!prev.private) throw new Error("Yalnızca gizli sıraların adresi yenilenebilir");
    const slug = secretSlug();
    await reg.claim(slug, id, prev.slug);
    await room.update({ slug });
    return { slug };
  }
  if (op === "import" && req.method === "POST") {
    // Listede olmayan mevcut bir odayı (ör. görevli linkinden ID ile) listeye geri ekler
    await room.info(); // oda yoksa "Sıra bulunamadı" fırlatır
    await reg.add(id);
  } else if (!op && req.method === "PUT") {
    const prev = await room.info();
    const fields = roomFields(body, prev);
    await reg.claim(fields.slug, id, prev.slug);
    await room.update(fields);
  } else if (!op && req.method === "DELETE") {
    const { slug } = await room.info().catch(() => ({}));
    await room.destroy();
    await reg.remove(id, slug);
  } else throw new Error("Geçersiz istek");
  return { ok: true };
}

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    // Kök adres: alt alan adında sıra durumu, ana alan adında tanıtım sitesi
    // (public/ altında index.html yok, bu yüzden "/" statik dosyayla eşleşmez ve buraya gelir)
    if (url.pathname === "/") return env.ASSETS.fetch(new Request(new URL(subdomain(url, env) ? "/status" : "/home", url), req));
    try {
      const body = ["POST", "PUT"].includes(req.method) ? await req.json() : {};
      if (url.pathname.startsWith("/api/admin/")) return Response.json(await adminApi(req, env, url, body));
      if (url.pathname === "/api/rooms") {
        // Herkese açık sıra listesi (tanıtım sitesindeki harita): yalnızca status() alanları, anahtar yok, gizli sıralar hariç
        // ponytail: her istek tüm odalara sorar; yüzlerce sıra olursa listeyi Cache API ile 30 sn önbelleğe al
        const ids = await env.REGISTRY.getByName("main").list();
        const rooms = await Promise.all(ids.map((id) => env.ROOM.getByName(id).status()
          .then((st) => ({ ...st, link: statusLink(url, env, st.slug ?? id) }), () => null)));
        return Response.json(rooms.filter((r) => r && !r.private));
      }
      if (url.pathname === "/api/vapid") return Response.json({ key: env.VAPID_PUBLIC_KEY ?? null });
      if (url.pathname === "/api/resolve") {
        // ?r= oda id'si ya da slug; yoksa alt alan adından (antalya-konserve.sirangeldi.com)
        const ref = url.searchParams.get("r") || subdomain(url, env);
        const room = ID_RE.test(ref) ? ref : ref && (await env.REGISTRY.getByName("main").resolve(ref));
        if (!room) throw new Error("Sıra bulunamadı");
        return Response.json({ room });
      }
      const m = url.pathname.match(/^\/api\/r\/([a-f0-9]{10})\/(join|me|leave|push|admin|status)$/);
      if (!m) return new Response("Not found", { status: 404 });
      const room = env.ROOM.getByName(m[1]);
      switch (m[2]) {
        case "join": return Response.json(await room.join(body));
        case "me": return Response.json(await room.me(url.searchParams.get("id")));
        case "leave": return Response.json(await room.leave(body.id));
        case "push": return Response.json(await room.subscribe(body.id, body.sub));
        case "admin": return Response.json(await room.admin(req.headers.get("x-key"), body));
        case "status": return Response.json(await room.status());
      }
    } catch (e) {
      return Response.json({ error: e.message }, { status: 400 });
    }
  },
};
