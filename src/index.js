import { DurableObject } from "cloudflare:workers";

const TOKEN_TTL = 90_000; // QR token ömrü; görevli ekranı her 20 sn'de yeni kod gösterir
const MAX_GROUP = 8;
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

// Plaj başına bir oda. Tüm durum tek bir kayıtta tutulur.
// ponytail: tek kayıtta tüm durum, MAX_ENTRIES ile sınırlı; binlerce kişi olursa SQL tablolarına geç.
export class Room extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    ctx.blockConcurrencyWhile(async () => { this.s = await ctx.storage.get("s"); });
  }

  need() {
    if (!this.s) throw new Error("Oda bulunamadı");
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
      name: s.name, slug: s.slug, lat: s.lat, lng: s.lng, radius: s.radius, key: s.key,
      waiting: w.length, people: w.reduce((n, e) => n + e.size, 0), called: s.entries.length - w.length,
    };
  }

  // Herkese açık sıra durumu: yalnızca sayılar ve numaralar, kişisel bilgi (not, cihaz, bilet id) yok
  status() {
    const s = this.need(), w = s.entries.filter((e) => e.status === "waiting");
    return {
      name: s.name, lat: s.lat, lng: s.lng,
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

  async join({ t, lat, lng, size, device }) {
    const s = this.need();
    const [ts, sig] = String(t).split(".");
    const age = Date.now() - Number(ts);
    if (!(age > -5000 && age < TOKEN_TTL) || !same(sig, await sign(s.key, ts)))
      throw new Error("QR kodunun süresi dolmuş. Görevlinin ekranındaki kodu yeniden okutun.");
    if (!(meters(s, { lat: Number(lat), lng: Number(lng) }) <= s.radius))
      throw new Error("Plaj alanında görünmüyorsunuz. Konumunuz açık olmalı ve plajda olmalısınız.");
    if (typeof device !== "string" || device.length < 16) throw new Error("Geçersiz cihaz");
    size = int(size, 1, MAX_GROUP, `Grup 1-${MAX_GROUP} kişi olmalı`);
    // Aynı cihaz ikinci bilet alamaz, mevcut bileti geri döner
    const e = s.entries.find((x) => x.device === device) ?? this.add(size, "qr", device);
    await this.save();
    return { id: e.id, no: e.no };
  }

  add(size, src, device = null, note = "") {
    if (this.s.entries.length >= MAX_ENTRIES) throw new Error("Sıra dolu");
    const e = { id: crypto.randomUUID(), no: ++this.s.seq, size, src, device, note, status: "waiting", at: Date.now() };
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
      name: s.name, no: e.no, size: e.size, status: e.status, calledAt: e.calledAt,
      aheadGroups: ahead.length, aheadPeople: ahead.reduce((n, x) => n + x.size, 0),
    };
  }

  async leave(id) {
    this.need();
    this.drop(id);
    this.fill();
    await this.save();
    return { ok: true };
  }

  call(e) {
    e.status = "called";
    e.calledAt = Date.now();
    this.s.lastNo = e.no;
    this.s.available = Math.max(0, this.s.available - e.size);
  }

  // Sıradan çıkarma. Çağrılmış ama gelmemiş biri çıkarsa, ayrılan yerleri boşa döner.
  drop(id) {
    const i = this.s.entries.findIndex((e) => e.id === id);
    if (i < 0) return;
    const [e] = this.s.entries.splice(i, 1);
    if (e.status === "called") this.s.available += e.size;
  }

  // Boş yer (this.s.available) varken bekleyenleri çağırır.
  // TODO(politika): Şu an katı FIFO: sıradaki grup sığmıyorsa arkadakiler de beklemeye devam eder.
  // Alternatif: sığan küçük grupları öne al (daha az boş yer kalır ama kalabalık aileler sürekli geri düşebilir).
  fill() {
    for (const e of this.s.entries) {
      if (e.status !== "waiting") continue;
      if (e.size > this.s.available) break;
      this.call(e);
    }
  }

  async admin(key, { action, id, n, size, note }) {
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
      case "add": added = this.add(int(size, 1, MAX_GROUP, "Geçersiz grup"), "manual", null, String(note ?? "").slice(0, 60)); break;
      case "reset": Object.assign(s, { seq: 0, available: 0, entries: [] }); break;
    }
    this.fill();
    if (action) await this.save();
    const ts = String(Date.now());
    return {
      name: s.name, available: s.available, added: added?.no,
      token: `${ts}.${await sign(s.key, ts)}`,
      entries: s.entries.map(({ device, ...x }) => x),
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
    if (owner && owner !== id) throw new Error("Bu adres başka bir plajda kullanılıyor");
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

function roomFields(b) {
  const lat = Number(b.lat), lng = Number(b.lng);
  if (!(Math.abs(lat) <= 90 && Math.abs(lng) <= 180)) throw new Error("Geçersiz konum");
  const slug = String(b.slug ?? "").trim();
  if (!/^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/.test(slug) || ID_RE.test(slug) || RESERVED.has(slug))
    throw new Error("Geçersiz adres: 3-40 karakter, küçük harf, rakam ve tire");
  return {
    name: String(b.name ?? "").trim().slice(0, 60) || "Plaj",
    slug, lat, lng, radius: int(b.radius, 50, 2000, "Yarıçap 50-2000 m olmalı"),
  };
}

// Görevli linki: alan adı tanımlıysa slug alt alan adı, değilse aynı origin + slug (yoksa id)
function hostLink(url, env, r) {
  if (env.BASE_DOMAIN && r.slug) return `https://${r.slug}.${env.BASE_DOMAIN}/host#${r.key}`;
  return `${url.origin}/host#${r.slug ?? r.room}.${r.key}`;
}

async function adminApi(req, env, url, body) {
  if (!env.ADMIN_PASSWORD || !same(req.headers.get("x-admin"), env.ADMIN_PASSWORD)) throw new Error("Hatalı şifre");
  const m = url.pathname.match(/^\/api\/admin\/rooms(?:\/([a-f0-9]{10})(?:\/(rotate|import))?)?$/);
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
  if (op === "import" && req.method === "POST") {
    // Listede olmayan mevcut bir odayı (ör. görevli linkinden ID ile) listeye geri ekler
    await room.info(); // oda yoksa "Oda bulunamadı" fırlatır
    await reg.add(id);
  } else if (!op && req.method === "PUT") {
    const fields = roomFields(body);
    await reg.claim(fields.slug, id, (await room.info()).slug);
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
      if (url.pathname === "/api/resolve") {
        // ?r= oda id'si ya da slug; yoksa alt alan adından (antalya-konserve.belediyeplaj.com)
        const ref = url.searchParams.get("r") || subdomain(url, env);
        const room = ID_RE.test(ref) ? ref : ref && (await env.REGISTRY.getByName("main").resolve(ref));
        if (!room) throw new Error("Plaj bulunamadı");
        return Response.json({ room });
      }
      const m = url.pathname.match(/^\/api\/r\/([a-f0-9]{10})\/(join|me|leave|admin|status)$/);
      if (!m) return new Response("Not found", { status: 404 });
      const room = env.ROOM.getByName(m[1]);
      switch (m[2]) {
        case "join": return Response.json(await room.join(body));
        case "me": return Response.json(await room.me(url.searchParams.get("id")));
        case "leave": return Response.json(await room.leave(body.id));
        case "admin": return Response.json(await room.admin(req.headers.get("x-key"), body));
        case "status": return Response.json(await room.status());
      }
    } catch (e) {
      return Response.json({ error: e.message }, { status: 400 });
    }
  },
};
