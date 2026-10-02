import { DurableObject } from "cloudflare:workers";
import { Account, checkout, FREE, packages, webhook } from "./billing.js";
import { human, ip, limit, pwned, secure } from "./guard.js";
import { fail, failed, langOf, localize, msg, tableLabel } from "./i18n.js";
import { mail } from "./mail.js";
import { cleanSub, sendPush } from "./push.js";
import { enc, hex, randomHex, same, sha256, sign } from "./util.js";

export { Account };

const TTLS = [60, 90, 180, 300]; // seçilebilir QR geçerlilik süreleri (sn); görevli ekranı süre/4'te bir yeni kod gösterir
const MAX_GROUP = 8; // varsayılan en büyük grup
const GROUP_LIMIT = 20;
const TABLE_LIMIT = 50;
const CATEGORIES = new Set(["plaj", "iskele", "gise", "restoran", "saglik", "resmi", "etkinlik", "diger"]); // ikonları public/app.js'te
const MAX_ENTRIES = 1000;
const GEOS = new Set(["off", "fixed", "dynamic"]);
const WAITS = [3, 5, 10, 15, 20, 30]; // çağrılanın gelme süresi seçenekleri (dk); süre dolunca sıradan düşer
const HERE_TTL = 5 * 60 * 1000; // dinamik konum: görevli konumu bundan eskiyse ziyaretçi giremez (panel kapalı / konum alınamıyor)
const SOON = 2; // önünde en fazla bu kadar grup kalınca "sıranız yaklaşıyor" bildirimi
const ETA_WINDOW = 60 * 60 * 1000; // tahmini bekleme: son 1 saatteki çağrı hızından
const STAT_DAYS = 90; // günlük istatistiklerin saklandığı gün sayısı
const TZ = "Europe/Istanbul"; // saat dilimi gönderilmeyen eski sıralar
const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

// Saat dilimine göre gün ("2026-10-01"), saat (0-23) ve gün içindeki dakika
const fmts = {};
function clock(tz, t = Date.now()) {
  const f = (fmts[tz] ??= new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }));
  const p = Object.fromEntries(f.formatToParts(t).map((x) => [x.type, x.value]));
  return { day: `${p.year}-${p.month}-${p.day}`, hour: Number(p.hour), min: Number(p.hour) * 60 + Number(p.minute) };
}
const validTz = (tz) => { try { return typeof tz === "string" && !!new Intl.DateTimeFormat("en", { timeZone: tz }) && tz; } catch { return false; } };
const mins = (hhmm) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3));
// Açılış saatleri; from > to gece yarısını geçen aralık (ör. 18:00-02:00)
function isOpen(hours, tz) {
  if (!hours) return true;
  const now = clock(tz).min, a = mins(hours.from), b = mins(hours.to);
  return a < b ? now >= a && now < b : now >= a || now < b;
}

// Haversine mesafesi, metre
function meters(a, b) {
  const r = Math.PI / 180;
  const h = Math.sin(((b.lat - a.lat) * r) / 2) ** 2 +
    Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(((b.lng - a.lng) * r) / 2) ** 2;
  return 2 * 6371e3 * Math.asin(Math.sqrt(h));
}

// key, args: aralık dışında atılan çevrilebilir hata (src/i18n.js)
const int = (v, min, max, key, ...args) => {
  const n = Math.trunc(Number(v));
  if (!(n >= min && n <= max)) throw fail(key, ...args);
  return n;
};

// Grubun kabul ettiği yer sayıları (ör. 4 kişi: [2, 4]). Esnek olmayan sırada ve eski kayıtlarda yalnızca grup büyüklüğü.
const acceptOf = (e) => e.accept ?? [e.size];


// Sonradan eklenen oda ayarları; eski kayıtlarda alan yoksa varsayılan.
// Sıra türü: "seats" boş yer havuzu (plaj, iskele), "tables" masalar (restoran); masada esnek yer seçimi anlamsız.
// skip: yer modunda sıradaki grup sığmazsa arkadan sığan küçük gruplar öne alınır (masa modu zaten böyle çalışır).
const conf = (s) => {
  const mode = s.mode === "tables" ? "tables" : "seats", tables = mode === "tables";
  return {
    category: s.category ?? "diger", mode, tables, flex: !!s.flex && !tables, skip: !!s.skip && !tables, maxEmpty: tables ? s.maxEmpty ?? null : null,
    maxGroup: s.maxGroup ?? MAX_GROUP, qr: s.qr ?? "dynamic", ttl: s.ttl ?? 90,
    // Konum kontrolü: "fixed" sıranın haritadaki noktası, "dynamic" QR'ı gösteren görevlinin konumu, "off" yok
    geo: GEOS.has(s.geo) ? s.geo : "fixed",
    wait: s.wait ?? null, // null: süresiz, görevli "Geldi"/"Gelmedi" diyene kadar bekler
    hours: s.hours ?? null, // { from, to } "HH:MM": bu saatler dışında yeni katılım yok; null: her zaman açık
    cap: s.cap ?? null, // en fazla bekleyen grup; null: sınır yok (görevlinin elle eklemesi sınıra takılmaz)
    tz: s.tz ?? TZ,
  };
};

// Grup masaya sığıyor mu; maxEmpty: masada boş kalabilecek en fazla sandalye (null: sınır yok)
const seats = (size, cap, maxEmpty) => size <= cap && (maxEmpty === null || cap - size <= maxEmpty);

// Boş yere sığan en büyük kabul edilen yer sayısı; hiçbiri sığmıyorsa null
function fit(e, available) {
  const ok = acceptOf(e).filter((a) => a <= available);
  return ok.length ? Math.max(...ok) : null;
}

function acceptList(accept, size, flex) {
  if (!flex) return [size];
  const list = [...new Set([].concat(accept ?? size).map(Number))].filter((a) => Number.isInteger(a) && a >= 1 && a <= size);
  if (!list.length) throw fail("accept");
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
    if (!this.s) throw fail("notFound");
    return this.s;
  }

  // Her kayıtta alarm, süreli sırada en erken dolacak çağrıya kurulur (yoksa kaldırılır)
  async save() {
    await this.ctx.storage.put("s", this.s);
    const next = this.deadline();
    if (next) await this.ctx.storage.setAlarm(next);
    else await this.ctx.storage.deleteAlarm();
  }

  // Çağrılan grubun gelme süresinin dolduğu an; süresiz sırada null
  due(e) {
    const w = conf(this.s).wait;
    return w && e.status === "called" ? e.calledAt + w * 60000 : null;
  }

  deadline() {
    if (!this.s) return null;
    const all = this.s.entries.map((e) => this.due(e)).filter(Boolean);
    return all.length ? Math.min(...all) : null;
  }

  // Süresi dolan çağrılar sıradan düşer; ayrılan yer / masa sıradakilere geçer.
  // Düşenlerin id'leri kısa süre tutulur: ziyaretçi sayfası "süreniz doldu" diyebilsin.
  expire() {
    const now = Date.now(), late = this.s.entries.filter((e) => this.due(e) !== null && this.due(e) <= now);
    for (const e of late) {
      this.drop(e.id);
      this.stat("expired");
      if (e.push) (this.lost ??= []).push(e); // notify() "süreniz doldu" bildirimi gönderir
    }
    if (!late.length) return false;
    this.s.expired = [...(this.s.expired ?? []), ...late.map((e) => e.id)].slice(-200);
    this.fill();
    return true;
  }

  async alarm() {
    if (!this.s) return;
    const changed = this.expire();
    await this.save();
    if (changed) await this.notify();
  }

  // owner: biletler bu kullanıcının hesabından düşer (billing.js); sahipsiz eski odalarda yok
  async create(fields, owner) {
    if (this.s) throw new Error("Oda zaten var");
    this.s = { ...fields, owner, key: crypto.randomUUID(), seq: 0, available: 0, tables: [], entries: [] };
    await this.save();
    return this.s.key;
  }

  async setOwner(owner) {
    if (!this.s) return;
    this.s.owner = owner;
    await this.save();
  }

  keyOk(key) { return same(key, this.need().key); }

  info() {
    const s = this.need(), w = s.entries.filter((e) => e.status === "waiting");
    return {
      name: s.name, slug: s.slug, lat: s.lat, lng: s.lng, radius: s.radius, private: !!s.private, key: s.key, ...conf(s),
      waiting: w.length, people: w.reduce((n, e) => n + e.size, 0), called: s.entries.length - w.length, paused: !!s.paused,
    };
  }

  // Herkese açık sıra durumu: yalnızca sayılar ve numaralar, kişisel bilgi (not, cihaz, bilet id) yok
  status() {
    const s = this.need(), w = s.entries.filter((e) => e.status === "waiting");
    return {
      name: s.name, slug: s.slug, lat: s.lat, lng: s.lng, flex: conf(s).flex, private: !!s.private,
      category: conf(s).category, maxGroup: conf(s).maxGroup, geo: conf(s).geo, wait: conf(s).wait,
      waiting: w.length, people: w.reduce((n, e) => n + e.size, 0), next: w[0]?.no ?? null,
      called: s.entries.filter((e) => e.status === "called").map((e) => e.no), lastNo: s.lastNo ?? null,
      ...this.gate(w.length), hours: conf(s).hours,
      eta: this.eta(w.length), // şimdi girene tahmini bekleme (dk); veri azsa null
    };
  }

  // Yeni katılım açık mı: görevli durdurmadı, açılış saatlerinde, kapasite dolmadı
  gate(waiting) {
    const s = this.s, c = conf(s);
    return { paused: !!s.paused, open: isOpen(c.hours, c.tz), full: c.cap !== null && waiting >= c.cap };
  }

  // Önünde ahead grup olana tahmini bekleme (dk): son 1 saatteki çağrı hızı. En az 3 çağrı yoksa ya da sıra durdurulduysa null.
  // Boş geçen süre de hesaba girer (now - ilk çağrı): görevli ara verince tahmin uzar.
  eta(ahead) {
    const now = Date.now(), calls = (this.s.calls ?? []).filter((t) => now - t < ETA_WINDOW);
    if (calls.length < 3 || this.s.paused) return null;
    const perMin = calls.length / (Math.max(now - calls[0], 5 * 60000) / 60000);
    return Math.max(1, Math.ceil((ahead + 1) / perMin));
  }

  // Günlük sayaçlar (saat dilimine göre gün); kişisel veri yok. Son STAT_DAYS gün tutulur.
  stat(key, n = 1, t = Date.now()) {
    const s = this.s, { day, hour } = clock(conf(s).tz, t);
    s.stats ??= {};
    if (!s.stats[day]) {
      s.stats[day] = { joined: 0, manual: 0, called: 0, waitMs: 0, served: 0, noShow: 0, expired: 0, left: 0, removed: 0, hours: Array(24).fill(0) };
      for (const d of Object.keys(s.stats).sort().slice(0, -STAT_DAYS)) delete s.stats[d];
    }
    s.stats[day][key] += n;
    if (key === "joined") s.stats[day].hours[hour] += n;
  }

  stats() {
    const s = this.need();
    return { tz: conf(s).tz, days: Object.entries(s.stats ?? {}).sort(([a], [b]) => a.localeCompare(b)).map(([day, d]) => ({ day, ...d })) };
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

  // lang: ziyaretçinin dili; "sıra size geldi" push bildirimi bu dilde gider
  async join({ t, lat, lng, size, accept, device, lang }) {
    lang = langOf(lang);
    const s = this.need(), c = conf(s);
    const [ts, sig] = String(t).split(".");
    if (ts === "s") {
      if (c.qr !== "static" || !same(sig, await sign(s.key, "static")))
        throw fail("qrInvalid");
    } else {
      const age = Date.now() - Number(ts);
      if (!(age > -5000 && age < c.ttl * 1000) || !same(sig, await sign(s.key, ts)))
        throw fail("qrExpired");
    }
    if (c.geo !== "off") {
      const at = c.geo === "dynamic" ? s.here : s;
      if (c.geo === "dynamic" && !(Date.now() - (at?.at ?? 0) < HERE_TTL)) throw fail("noHost");
      if (!(meters(at, { lat: Number(lat), lng: Number(lng) }) <= s.radius)) throw fail(c.geo === "dynamic" ? "farHost" : "far");
    }
    if (typeof device !== "string" || device.length < 16) throw fail("device");
    size = int(size, 1, c.maxGroup, "group", c.maxGroup);
    accept = acceptList(accept, size, c.flex);
    // Aynı cihaz ikinci bilet alamaz, mevcut bileti geri döner (sıra kapansa da). Sahibin bilet hakkı bittiyse ziyaretçi yalnızca sıranın kapalı olduğunu görür.
    let e = s.entries.find((x) => x.device === device);
    if (!e) {
      const g = this.gate(s.entries.filter((x) => x.status === "waiting").length);
      if (g.paused) throw fail("paused");
      if (!g.open) throw fail("hoursClosed", c.hours.from, c.hours.to);
      if (g.full) throw fail("capFull");
      e = await this.ticket(size, accept, "qr", device, "", lang).catch((err) => {
        throw failed(err, "quota") || failed(err, "suspended") ? fail("closed") : err;
      });
    }
    this.fill(); // boş yer / bekleyen masa varsa hemen çağrılır
    await this.save();
    await this.notify();
    return { id: e.id, no: e.no };
  }

  add(size, accept, src, device = null, note = "", lang = "en") {
    if (this.s.entries.length >= MAX_ENTRIES) throw fail("full");
    const e = { id: crypto.randomUUID(), no: ++this.s.seq, size, accept, src, device, note, lang, status: "waiting", at: Date.now() };
    this.s.entries.push(e);
    return e;
  }

  // Her yeni bilet sahibin hesabından 1 hak düşer. Bilet önce eklenir: hesap cevabı beklenirken aynı cihazın ikinci isteği
  // onu bulur, MAX_ENTRIES aşılmaz. Hak yoksa bilet geri alınır (bu arada çağrıldıysa ayrılan yer de döner).
  async ticket(...args) {
    const e = this.add(...args);
    if (!this.s.owner) {
      this.stat("joined");
      if (e.src === "manual") this.stat("manual");
      return e;
    }
    try {
      await this.env.ACCOUNT.getByName(this.s.owner).spend();
    } catch (err) {
      this.drop(e.id);
      throw err;
    }
    this.stat("joined");
    if (e.src === "manual") this.stat("manual");
    return e;
  }

  me(id) {
    const s = this.need();
    const i = s.entries.findIndex((e) => e.id === id);
    if (i < 0) return { name: s.name, status: s.expired?.includes(id) ? "expired" : "gone" };
    const e = s.entries[i], due = this.due(e);
    const ahead = s.entries.slice(0, i).filter((x) => x.status === "waiting");
    return {
      name: s.name, no: e.no, size: e.size, accept: acceptOf(e), alloc: e.alloc, table: e.table, status: e.status, calledAt: e.calledAt,
      aheadGroups: ahead.length, aheadPeople: ahead.reduce((n, x) => n + x.size, 0),
      // Süreli sırada kalan süre (ms); istemci saati farklı olabileceği için bitiş anı değil kalan gönderilir
      wait: conf(s).wait, remaining: due === null ? null : Math.max(0, due - Date.now()),
      eta: e.status === "waiting" ? this.eta(ahead.length) : null,
    };
  }

  async leave(id) {
    if (this.need().entries.some((e) => e.id === id)) this.stat("left");
    this.drop(id);
    this.fill();
    await this.save();
    await this.notify();
    return { ok: true };
  }

  // Sayfa kapalıyken / ekran kilitliyken haber verebilmek için tarayıcının push aboneliği
  async subscribe(id, sub) {
    const e = this.need().entries.find((x) => x.id === id);
    if (!e) throw fail("entryNotFound");
    e.push = cleanSub(sub);
    await this.save();
    return { ok: true };
  }

  // call() ile biriken çağrılara push gönderir. Sayfa açıksa yoklama zaten yakalar; push hatası isteği bozmamalı.
  // Süresi dolup düşenlere de (this.lost) gider; aynı etiketle "sıra size geldi" bildiriminin yerini alır.
  async notify() {
    const list = (this.outbox ?? []).filter((e) => this.s?.entries.includes(e)); // hakkı yetmeyip geri alınan bilet çıkar
    const lost = this.lost ?? [], soon = (this.soon ?? []).filter((e) => e.status === "waiting" && this.s?.entries.includes(e));
    this.outbox = [];
    this.lost = [];
    this.soon = [];
    if (!(list.length || lost.length || soon.length) || !this.env.VAPID_PRIVATE_KEY) return;
    const s = this.s, url = s.slug ? `/join?r=${s.slug}` : "/";
    let dead = false;
    const waiting = s.entries.filter((x) => x.status === "waiting");
    await Promise.all([...list.map((e) => [e, false]), ...lost.map((e) => [e, true]), ...soon.map((e) => [e, "soon"])].map(async ([e, gone]) => {
      const note = gone === "soon"
        ? { title: msg(e.lang, "soonTitle"), body: msg(e.lang, "soonBody", s.name, e.no, waiting.indexOf(e)), tag: `called-${e.id}`, url }
        : gone
        ? { title: msg(e.lang, "timeUp"), body: msg(e.lang, "expiredBody", s.name, e.no), tag: `called-${e.id}`, url }
        : {
          title: msg(e.lang, e.table ? "tableReady" : "yourTurn"),
          body: msg(e.lang, "pushBody", s.name, e.no, e.table?.name && tableLabel(e.table, e.lang)),
          tag: `called-${e.id}`,
          url,
        };
      try {
        // Düşen kaydın aboneliği zaten silindi; yalnızca sıradakilerin geçersiz aboneliği temizlenir
        if (!(await sendPush(e.push, note, this.env)) && gone !== true) { delete e.push; dead = true; }
      } catch (err) { console.error("push", err.message); }
    }));
    if (dead) await this.save();
  }

  // Yer modunda sığan en büyük seçenek ayrılır; görevli sığmayan birini elle çağırırsa en küçük seçenek.
  // Masa modunda masanın tamamı gruba verilir (table yoksa görevli masasız çağırmıştır).
  call(e, table) {
    e.status = "called";
    e.calledAt = Date.now();
    this.s.calls = [...(this.s.calls ?? []), e.calledAt].slice(-20); // tahmini bekleme için
    this.stat("called");
    this.stat("waitMs", e.calledAt - e.at);
    this.s.lastNo = e.no;
    if (conf(this.s).tables) {
      if (table) {
        this.s.tables = this.s.tables.filter((t) => t !== table);
        e.table = table;
      }
    } else {
      e.alloc = fit(e, this.s.available) ?? Math.min(...acceptOf(e));
      this.s.available = Math.max(0, this.s.available - e.alloc);
    }
    if (e.push) (this.outbox ??= []).push(e);
  }

  // Sıradan çıkarma. Çağrılmış ama gelmemiş biri çıkarsa, ayrılan yerleri / masası boşa döner.
  drop(id) {
    const i = this.s.entries.findIndex((e) => e.id === id);
    if (i < 0) return;
    const [e] = this.s.entries.splice(i, 1);
    if (e.status !== "called") return;
    if (e.table) this.s.tables.push(e.table);
    else if (!conf(this.s).tables) this.s.available += e.alloc ?? e.size;
  }

  // Bekleyen masalar içinde gruba sığan en küçüğü; eşitse en uzun bekleyen
  bestTable(size, maxEmpty) {
    return this.s.tables.filter((t) => seats(size, t.cap, maxEmpty)).sort((a, b) => a.cap - b.cap)[0];
  }

  // Boş yer (this.s.available) varken bekleyenleri çağırır.
  // Varsayılan katı FIFO: sıradaki grup sığmıyorsa arkadakiler de bekler. skip açıksa sığan küçük gruplar öne alınır
  // (daha az boş yer kalır ama kalabalık gruplar sürekli geri düşebilir).
  // Masa modunda: bekleyen gruplar sırayla, her birine sığan en küçük boş masa. Sığmayan grup atlanır;
  // böylece büyük masa boşalınca arkadaki büyük grup çağrılabilir.
  fill() {
    const s = this.s;
    if (conf(s).tables) {
      s.tables ??= [];
      for (const e of s.entries) {
        if (!s.tables.length) break;
        const t = e.status === "waiting" && this.bestTable(e.size, conf(s).maxEmpty);
        if (t) this.call(e, t);
      }
    } else {
      for (const e of s.entries) {
        if (e.status !== "waiting") continue;
        if (fit(e, this.s.available) !== null) this.call(e);
        else if (!conf(s).skip) break;
      }
    }
    this.nearing();
  }

  // Önünde SOON grup ya da daha azı kalan bekleyen bir kez işaretlenir; bildirim aboneliği varsa notify() "yaklaşıyor" gönderir.
  // Zaten öndeyken giren (ya da aboneliği sonradan gelen) işaretlenir ama bildirim almaz: sayfası açık.
  nearing() {
    this.s.entries.filter((e) => e.status === "waiting").slice(0, SOON + 1).forEach((e) => {
      if (e.soon) return;
      e.soon = true;
      if (e.push) (this.soon ??= []).push(e);
    });
  }

  // Dinamik konumda görevli panelinin her yoklamada gönderdiği konum. Bellekte hep güncellenir; depoya yalnızca
  // 10 m'den fazla kaydıysa ya da son yazımdan 1 dk geçtiyse yazılır (DO bellekten düşerse tazelik bilgisi kalsın).
  here(p) {
    const s = this.s, lat = Number(p?.lat), lng = Number(p?.lng);
    if (conf(s).geo !== "dynamic" || !(Math.abs(lat) <= 90 && Math.abs(lng) <= 180)) return false;
    const prev = s.here, now = Date.now();
    s.here = { lat, lng, at: now };
    if (prev && meters(prev, s.here) < 10 && now - (this.hereSaved ?? 0) < 60000) return false;
    this.hereSaved = now;
    return true;
  }

  async admin(key, { action, id, n, size, accept, note, name, here }) {
    const s = this.need(), c = conf(s);
    if (!same(key, s.key)) throw fail("unauthorized");
    const moved = this.here(here);
    const expired = this.expire(); // alarm gecikse de panel güncel listeyi görsün
    s.tables ??= [];
    const e = s.entries.find((x) => x.id === id);
    let added, table;
    switch (action) {
      case "free": s.available += int(n, 1, 500, "badNumber"); break;
      case "setAvailable": s.available = int(n, 0, 500, "badNumber"); break;
      case "table": {
        if (!c.tables) throw fail("noTables");
        const nm = String(name ?? "").trim().slice(0, 20);
        if (nm && s.tables.some((t) => t.name === nm)) throw fail("tableTaken", nm);
        table = { id: crypto.randomUUID().slice(0, 8), cap: int(n, 1, TABLE_LIMIT, "tableCap", TABLE_LIMIT), name: nm, at: Date.now() };
        s.tables.push(table);
        break;
      }
      case "untable": s.tables = s.tables.filter((t) => t.id !== id); break;
      // Masa modunda elle çağırma boş kalma sınırına bakmaz: sığan en küçük boş masa, yoksa masasız
      case "call": if (e?.status === "waiting") this.call(e, c.tables ? this.bestTable(e.size, null) : undefined); break;
      case "arrived":
        if (e?.status === "called") this.stat("served");
        s.entries = s.entries.filter((x) => x !== e);
        break;
      case "drop":
        if (e) this.stat(e.status === "called" ? "noShow" : "removed");
        this.drop(id);
        break;
      case "pause": s.paused = true; break;
      case "resume": s.paused = false; break;
      case "add": {
        const sz = int(size, 1, conf(s).maxGroup, "badGroup");
        added = await this.ticket(sz, acceptList(accept, sz, c.flex), "manual", null, String(note ?? "").slice(0, 60));
        break;
      }
      case "reset": Object.assign(s, { seq: 0, available: 0, tables: [], entries: [], expired: [], calls: [] }); break;
    }
    this.fill();
    if (action || moved || expired) await this.save();
    await this.notify();
    const { qr, ttl, maxGroup, flex, tables, maxEmpty, geo, wait, hours, cap } = c;
    return {
      name: s.name, flex, tables, maxEmpty, available: s.available, added: added?.no, qr, ttl, maxGroup, geo, wait, hours, cap,
      ...this.gate(s.entries.filter((x) => x.status === "waiting").length),
      now: Date.now(), // panel kalan süreyi sunucu saatine göre hesaplar
      // Boşalan masa: çağrılan grubun numarası, uygun grup yoksa null (masa bekleyenlere düştü)
      seated: table && (s.entries.find((x) => x.table === table)?.no ?? null),
      freeTables: s.tables,
      token: await this.token(),
      entries: s.entries.map(({ device, push, soon, ...x }) => x),
    };
  }
}

// Kullanıcılar, oda listesi ve adres eşlemesi. DO'lar listelenemediği için buradadır; oda bilgisi odanın kendisindedir.
// Anahtarlar:
//   "<oda id>" → { at, owner }; eski kayıtlarda yalnızca oluşturulma zamanı (sahipsiz oda)
//   "slug:<kullanıcı>/<slug>" → oda id; sahipsiz eski odalarda "slug:<slug>"
//   "legacy:<slug>" → oda id: kullanıcıya taşınan eski odanın <slug>.qrwait.app adresi yeni adrese yönlenir
//   "user:<ad>" → { salt, hash, at, email?, lang?, self?, verified?, suspended? }
//     self: kendisi hesap açtı (sıra sayısı sınırlı), verified: false → e-postası doğrulanmadı, sıra açamaz
//   "email:<adres>" → kullanıcı adı, "susp:<ad>" → askıya alınan kullanıcının sıraları haritada görünmez
//   "fail:<ad>" → { n, at } başarısız giriş sayacı
//   "tok:<verify|reset>:<sha256(belirteç)>" → { name, exp }: e-postayla giden tek kullanımlık bağlantı; belirtecin kendisi saklanmaz
// Sıcak yolda değil: sayfalar adresi açılışta bir kez çözer, sonra doğrudan odaya gider. Bilet hakkı kullanıcının
// Account DO'sunda (billing.js). Şifre özeti (PBKDF2) burada değil Worker'da hesaplanır: tek DO'yu giriş denemeleri kilitlemesin.
export class Registry extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    // Bir kez, bilet hakkı gelmeden önceki veriye: odalara sahiplerini yazar (biletler sahibin hesabından düşsün),
    // mevcut kullanıcıları sınırsız yapar (Account varsayılanı sayaçlı)
    ctx.blockConcurrencyWhile(async () => {
      if (await ctx.storage.get("meta:billing")) return;
      for (const r of await this.rooms()) if (r.owner) await env.ROOM.getByName(r.id).setOwner(r.owner).catch(() => {});
      for (const k of (await ctx.storage.list({ prefix: "user:" })).keys()) await env.ACCOUNT.getByName(k.slice(5)).set({ metered: false });
      await ctx.storage.put("meta:billing", Date.now());
    });
  }

  value(k) { return this.ctx.storage.get(k); }

  async rooms(owner) {
    // Oda id'leri [a-f0-9]: bu aralık user:, slug:, tok: gibi anahtarları taramaz
    const all = [...(await this.ctx.storage.list({ start: "0", end: "g" }))].filter(([k]) => ID_RE.test(k))
      .map(([id, v]) => (typeof v === "number" ? { id, at: v, owner: null } : { id, ...v }));
    return all.filter((r) => owner === undefined || r.owner === owner).sort((a, b) => a.at - b.at);
  }

  // Herkese açık liste: askıya alınan kullanıcıların sıraları hariç
  async listed(owner) {
    const susp = new Set([...(await this.ctx.storage.list({ prefix: "susp:" })).keys()].map((k) => k.slice(5)));
    return (await this.rooms(owner)).filter((r) => !susp.has(r.owner));
  }

  add(id, owner) { return this.ctx.storage.put(id, { at: Date.now(), owner }); }
  remove(id, owner, slug) { return this.ctx.storage.delete([id, `slug:${owner}/${slug}`]); }
  async owns(id, owner) { return (await this.value(id))?.owner === owner; }

  // DO girdi kapısı sayesinde oku-yaz arasında başka istek araya giremez: bir kullanıcıda aynı slug iki odaya verilemez
  async claim(owner, slug, id, old) {
    const k = `slug:${owner}/${slug}`, taken = await this.value(k);
    if (taken && taken !== id) throw fail("slugTaken");
    if (old && old !== slug) await this.ctx.storage.delete(`slug:${owner}/${old}`);
    await this.ctx.storage.put(k, id);
  }

  // u: kullanıcı (alt alan adı ya da ?u=), r: slug ya da oda id'si.
  // Kullanıcı değilse eski tek seviyeli adrestir (bambus.qrwait.app, ?r=bambus); owner varsa sayfa yeni adrese yönlenir.
  async resolve(u, r) {
    if (ID_RE.test(r)) return { room: r };
    if (u && (await this.value(`user:${u}`))) return r ? { room: await this.value(`slug:${u}/${r}`) } : { account: u };
    const name = r || u, room = name && ((await this.value(`legacy:${name}`)) ?? (await this.value(`slug:${name}`)));
    return room ? { room, owner: (await this.value(room))?.owner ?? null } : {};
  }

  async users() {
    const rooms = await this.rooms();
    return [...(await this.ctx.storage.list({ prefix: "user:" }))].map(([k, v]) => {
      const name = k.slice(5);
      return {
        name, at: v.at, email: v.email ?? null, self: !!v.self, verified: v.verified !== false, suspended: !!v.suspended,
        rooms: rooms.filter((r) => r.owner === name).length,
      };
    });
  }

  async user(name) {
    const u = await this.value(`user:${name}`);
    if (!u) throw fail("userNotFound");
    return u;
  }

  async nameFree(name) {
    if (await this.value(`user:${name}`)) throw fail("userTaken");
    // Eski sıra adresiyle aynı ad olursa eski adres yönlendirmesi bozulur
    if ((await this.value(`legacy:${name}`)) || (await this.value(`slug:${name}`))) throw fail("userLegacy");
  }

  // Süper yöneticinin açtığı kullanıcı: e-postasız, doğrulanmış; Worker hesabını sınırsız yapar
  async createUser(name, cred) {
    await this.nameFree(name);
    await this.ctx.storage.put(`user:${name}`, { ...cred, at: Date.now() });
  }

  // Kendi hesap açan kullanıcı; dönen değer doğrulama bağlantısının belirteci.
  // 7 gün içinde doğrulanmayan ve sırası olmayan hesap silinir (alarm): kullanıcı adları boşuna tutulmasın.
  // terms: kabul edilen kullanım koşulları sürümü (web/src/components/legal.tsx TERMS_VERSION)
  async signup(name, cred, email, lang, terms) {
    await this.nameFree(name);
    if (await this.value(`email:${email}`)) throw fail("emailTaken");
    await this.ctx.storage.put({
      [`user:${name}`]: { ...cred, email, lang, terms, termsAt: Date.now(), self: true, verified: false, at: Date.now(), mailed: { verify: Date.now() } },
      [`email:${email}`]: name,
    });
    await this.tidyLater();
    return this.token("verify", name, 3 * 864e5);
  }

  async token(kind, name, ttl) {
    const t = randomHex(24);
    await this.ctx.storage.put(`tok:${kind}:${await sha256(t)}`, { name, exp: Date.now() + ttl });
    await this.tidyLater();
    return t;
  }

  // Tek kullanımlık: süresi dolmamışsa kullanıcı adını döner ve siler
  async redeem(kind, t) {
    const k = `tok:${kind}:${await sha256(String(t ?? ""))}`, v = await this.value(k);
    if (!v || v.exp < Date.now() || !(await this.value(`user:${v.name}`))) throw fail("badToken");
    await this.ctx.storage.delete(k);
    return v.name;
  }

  // E-posta gönderimini sınırlar: aynı kullanıcıya aynı türden (verify, reset) dakikada en fazla bir e-posta. Gönderilmeyecekse null.
  async mailSlot(name, kind) {
    const u = await this.value(`user:${name}`);
    if (!u?.email || Date.now() - (u.mailed?.[kind] ?? 0) < 60e3) return null;
    await this.ctx.storage.put(`user:${name}`, { ...u, mailed: { ...u.mailed, [kind]: Date.now() } });
    return u;
  }

  async resendVerify(name) {
    const u = await this.user(name);
    if (u.verified !== false) throw fail("alreadyVerified");
    if (!(await this.mailSlot(name, "verify"))) throw fail("tooMany");
    return { email: u.email, lang: u.lang, token: await this.token("verify", name, 3 * 864e5) };
  }

  async verify(t) {
    const name = await this.redeem("verify", t);
    await this.setUser(name, { verified: true });
    return name;
  }

  // Şifremi unuttum: kullanıcı yoksa ya da az önce e-posta gittiyse null (yanıt yine aynı; e-postanın kayıtlı olduğu anlaşılmasın)
  async forgot(email) {
    const name = await this.value(`email:${email}`), u = name && (await this.mailSlot(name, "reset"));
    return u ? { name, lang: u.lang, token: await this.token("reset", name, 3600e3) } : null;
  }

  // Bağlantı e-postaya gittiği için e-posta doğrulanmış sayılır
  async reset(t, cred) {
    const name = await this.redeem("reset", t);
    await this.setPassword(name, { ...cred, verified: true });
    return name;
  }

  async setUser(name, fields) {
    await this.ctx.storage.put(`user:${name}`, { ...(await this.user(name)), ...fields });
    if ("suspended" in fields) await (fields.suspended ? this.ctx.storage.put(`susp:${name}`, 1) : this.ctx.storage.delete(`susp:${name}`));
  }

  async setPassword(name, cred) {
    await this.setUser(name, cred);
    await this.ctx.storage.delete(`fail:${name}`);
  }

  async deleteUser(name) {
    const u = await this.user(name);
    if ((await this.rooms(name)).length) throw fail("userHasRooms");
    await this.ctx.storage.delete([`user:${name}`, `fail:${name}`, `susp:${name}`, ...(u.email ? [`email:${u.email}`] : [])]);
  }

  // Sahipsiz (hesaplardan önceki) tüm sıraları kullanıcıya verir; eski adresleri yeni adrese yönlenir
  async adopt(name) {
    await this.user(name);
    const s = this.ctx.storage, rooms = await this.rooms(null);
    const slugs = [...(await s.list({ prefix: "slug:" }))].filter(([k]) => !k.includes("/")).map(([k, id]) => [k.slice(5), id]);
    for (const [slug, id] of slugs) {
      const taken = await s.get(`slug:${name}/${slug}`);
      if (taken && taken !== id) throw fail("adoptConflict", slug);
    }
    for (const [slug, id] of slugs) {
      await s.delete(`slug:${slug}`);
      await s.put({ [`slug:${name}/${slug}`]: id, [`legacy:${slug}`]: id });
    }
    for (const r of rooms) {
      await s.put(r.id, { at: r.at, owner: name });
      await this.env.ROOM.getByName(r.id).setOwner(name).catch(() => {});
    }
    return rooms.length;
  }

  // Giriş: id kullanıcı adı ya da e-posta. Şifreyi Worker doğrular, sonucu loginResult ile bildirir.
  // Kaba kuvvete karşı 15 dakikada 10 hatalı denemeden sonra kilitlenir (ayrıca Worker'da IP başına istek sınırı var).
  async loginInfo(id) {
    const name = id.includes("@") ? (await this.value(`email:${id}`)) ?? id : id;
    const f = await this.value(`fail:${name}`);
    if (f?.n >= 10 && Date.now() - f.at < 15 * 60e3) throw fail("locked");
    const u = name === SUPER ? null : await this.value(`user:${name}`);
    return { name, known: name === SUPER || !!u, salt: u?.salt, hash: u?.hash, suspended: !!u?.suspended, failed: !!f };
  }

  async loginResult(name, ok) {
    const fk = `fail:${name}`, f = await this.value(fk), now = Date.now();
    if (ok) await this.ctx.storage.delete(fk);
    else await this.ctx.storage.put(fk, { n: (f && now - f.at < 15 * 60e3 ? f.n : 0) + 1, at: now });
  }

  async tidyLater() {
    if (!(await this.ctx.storage.getAlarm())) await this.ctx.storage.setAlarm(Date.now() + 864e5);
  }

  // Günlük temizlik: süresi dolan bağlantılar, eski giriş sayaçları, 7 günde doğrulanmayan boş hesaplar
  async alarm() {
    const s = this.ctx.storage, now = Date.now(), gone = [];
    for (const [k, v] of await s.list({ prefix: "tok:" })) if (v.exp < now) gone.push(k);
    for (const [k, v] of await s.list({ prefix: "fail:" })) if (now - v.at > 864e5) gone.push(k);
    const owners = new Set((await this.rooms()).map((r) => r.owner));
    let pending = false;
    for (const [k, u] of await s.list({ prefix: "user:" })) {
      if (u.verified !== false) continue;
      const name = k.slice(5);
      if (now - u.at < 7 * 864e5 || owners.has(name)) { pending = true; continue; }
      gone.push(k, `email:${u.email}`);
      await this.env.ACCOUNT.getByName(name).destroy();
    }
    for (let i = 0; i < gone.length; i += 128) await s.delete(gone.slice(i, i + 128));
    if (pending || (await s.list({ prefix: "tok:", limit: 1 })).size) await s.setAlarm(now + 864e5);
  }
}

const ID_RE = /^[a-f0-9]{10}$/;
const NAME_RE = /^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
// Alt alan adı, kullanıcı adı ya da sıra adresi olamaz: sayfa ve dosya yollarıyla çakışır (antalyabb.qrwait.app/join),
// ya da herkes hesap açabildiği için resmi bir adres gibi görünüp kötüye kullanılabilir (destek.qrwait.app)
const RESERVED = new Set([
  "www", "api", "admin", "yonetim", "mail", "join", "host", "status", "home", "assets", "icons",
  "app", "panel", "dashboard", "login", "giris", "signup", "kayit", "account", "hesap", "auth", "secure", "guvenlik",
  "billing", "pay", "odeme", "fatura", "support", "destek", "help", "yardim", "info", "blog", "docs", "cdn", "static",
  "root", "system", "sistem", "official", "resmi", "qrwait", "noreply", "no-reply", "bildirim", "security",
  "gizlilik", "kosullar", "kvkk", "privacy", "terms", "legal", "hukuk", "pricing", "fiyat", "fiyatlar", "ucret",
]);
const SUPER = "admin"; // süper yönetici girişi: kullanıcı adı "admin", şifre ADMIN_PASSWORD
const SESSION_MS = 30 * 864e5;
const ROOM_LIMIT = 20; // kendi hesap açan kullanıcının en fazla sıra sayısı (herkese açık liste her sıraya sorar)

// antalyabb.qrwait.app → "antalyabb"; ana alan adı ve www için "". Geliştirmede antalyabb.localhost:8787 de çalışır.
function subdomain(url, env) {
  const h = url.hostname, base = [env.BASE_DOMAIN, "localhost"].find((b) => b && h.endsWith(`.${b}`));
  const sub = base ? h.slice(0, -base.length - 1) : "";
  return RESERVED.has(sub) ? "" : sub;
}

// 100 000: Workers'ın PBKDF2'de izin verdiği en yüksek tur sayısı
async function pbkdf2(password, salt) {
  const k = await crypto.subtle.importKey("raw", enc(password), "PBKDF2", false, ["deriveBits"]);
  return hex(await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: enc(salt), iterations: 100000 }, k, 256));
}

// checkLeaks: kullanıcının kendi seçtiği şifre sızmış şifre listelerinde olmamalı (süper yöneticinin verdiği geçici şifrede bakılmaz)
async function credential(password, checkLeaks = false) {
  password = String(password ?? "");
  if (password.length < 8 || password.length > 200) throw fail("shortPassword");
  if (checkLeaks && (await pwned(password))) throw fail("pwned");
  const salt = randomHex(16);
  return { salt, hash: await pbkdf2(password, salt) };
}

function userName(v) {
  const name = String(v ?? "").trim().toLowerCase();
  if (!NAME_RE.test(name) || ID_RE.test(name) || RESERVED.has(name))
    throw fail("badUser");
  return name;
}

function emailOf(v) {
  const e = String(v ?? "").trim().toLowerCase();
  if (e.length > 254 || !EMAIL_RE.test(e)) throw fail("badEmail");
  return e;
}

// Oturum: "<kullanıcı>.<bitiş>.<imza>". İmza anahtarı kullanıcının şifre özeti; şifre değişince eski oturumlar düşer.
async function session(name, secret) {
  const exp = Date.now() + SESSION_MS;
  return { token: `${name}.${exp}.${await sign(secret, `${name}.${exp}`)}`, user: name, super: name === SUPER };
}

// Bilinmeyen kullanıcıda da PBKDF2 hesaplanır: yanıt süresinden e-postanın kayıtlı olup olmadığı anlaşılmasın
async function checkLogin(env, reg, id, password) {
  const u = await reg.loginInfo(String(id ?? "").trim().toLowerCase());
  password = String(password ?? "");
  const ok = u.name === SUPER ? !!env.ADMIN_PASSWORD && same(password, env.ADMIN_PASSWORD)
    : same(await pbkdf2(password, u.salt ?? "-"), u.hash ?? "") && u.known;
  if (u.known && (!ok || u.failed)) await reg.loginResult(u.name, ok);
  if (!ok) throw fail("badLogin");
  if (u.suspended) throw fail("suspended");
  return { name: u.name, secret: u.name === SUPER ? env.ADMIN_PASSWORD : u.hash };
}

// Dönen u: süper yönetici için null
async function auth(req, env, reg) {
  const [name, exp, sig] = (req.headers.get("authorization") ?? "").replace(/^Bearer /, "").split(".");
  if (!name || !(Number(exp) > Date.now())) throw fail("auth");
  const u = name === SUPER ? null : await reg.value(`user:${name}`);
  const secret = name === SUPER ? env.ADMIN_PASSWORD : u?.hash;
  if (!secret || !same(sig, await sign(secret, `${name}.${exp}`))) throw fail("auth");
  if (u?.suspended) throw fail("suspended");
  return { owner: name, u };
}

const acct = (env, name) => env.ACCOUNT.getByName(name);

// E-postadaki bağlantılar isteğin geldiği sitenin yönetim sayfasına gider
async function sendLink(env, url, { to, lang, kind, user, token }) {
  const q = kind === "verify" ? "verify" : "reset";
  await mail(env, { to, lang, kind, user, link: `${url.origin}/admin?${q}=${token}` }).catch((e) => console.error("mail", e.message));
}

// Gizli sıranın adresi: 20 karakter [a-z0-9] (~103 bit), tahmin edilemez; slug kuralına uyar, ID_RE'ye uymaz
function secretSlug() {
  const abc = "abcdefghijklmnopqrstuvwxyz0123456789";
  return [...crypto.getRandomValues(new Uint8Array(20))].map((b) => abc[b % 36]).join("");
}

// prev: düzenlenen odanın mevcut bilgisi. Gizli oda gizli kaldıkça adresi korunur, gizliye geçerken yenisi üretilir.
function roomFields(b, prev) {
  // Nokta yalnızca sabit konum kontrolünde: kabul dairesinin merkezi ve haritadaki yeri. Diğerleri haritada görünmez.
  const geo = GEOS.has(b.geo) ? b.geo : "fixed";
  let lat = null, lng = null;
  if (geo === "fixed") {
    lat = Number(b.lat); lng = Number(b.lng);
    if (b.lat == null || b.lng == null || !(Math.abs(lat) <= 90 && Math.abs(lng) <= 180)) throw fail("badLocation");
  }
  const hidden = b.private === true || b.private === "on"; // haritada/listede görünmez, adresi rastgele
  const slug = hidden ? (prev?.private && prev.slug) || secretSlug() : String(b.slug ?? "").trim();
  if (!NAME_RE.test(slug) || ID_RE.test(slug) || RESERVED.has(slug))
    throw fail("badSlug");
  return {
    private: hidden,
    name: String(b.name ?? "").trim().slice(0, 60) || "Sıra",
    slug, lat, lng,
    radius: geo === "off" ? prev?.radius ?? 300 : int(b.radius, 50, 2000, "radius"),
    flex: b.flex === true || b.flex === "on", // grup, kişi sayısından az yeri de kabul edebilir (plaj şezlongu gibi)
    skip: b.skip === true || b.skip === "on", // sığmayan grubun arkasındaki küçük gruplar öne geçebilir
    category: CATEGORIES.has(b.category) ? b.category : "diger",
    mode: b.mode === "tables" ? "tables" : "seats",
    // Masa modunda masada boş kalabilecek en fazla sandalye; boş: sınır yok
    maxEmpty: b.maxEmpty === "" || b.maxEmpty == null ? null : int(b.maxEmpty, 0, TABLE_LIMIT, "maxEmpty", TABLE_LIMIT),
    maxGroup: int(b.maxGroup ?? MAX_GROUP, 1, GROUP_LIMIT, "maxGroup", GROUP_LIMIT),
    qr: b.qr === "static" ? "static" : "dynamic", // sabit: basılı QR, giriş yalnızca konumla sınırlı
    geo,
    wait: b.wait == null || b.wait === "" || Number(b.wait) === 0 ? null : WAITS.includes(Number(b.wait)) ? Number(b.wait) : 10,
    hours: HHMM.test(b.hours?.from) && HHMM.test(b.hours?.to) && b.hours.from !== b.hours.to ? { from: b.hours.from, to: b.hours.to } : null,
    cap: b.cap == null || b.cap === "" ? null : int(b.cap, 1, MAX_ENTRIES, "capRange", MAX_ENTRIES),
    tz: validTz(b.tz) || prev?.tz || TZ, // yönetim sayfasını açan tarayıcının saat dilimi
    ttl: TTLS.includes(Number(b.ttl)) ? Number(b.ttl) : 90,
  };
}

// Kullanıcının sayfası: antalyabb.qrwait.app; alan adı tanımlı değilse (workers.dev) aynı origin
const accountLink = (url, env, user) => (env.BASE_DOMAIN ? `https://${user}.${env.BASE_DOMAIN}/` : `${url.origin}/status?u=${user}`);

// Görevli linki: antalyabb.qrwait.app/host#bambus.<anahtar>; alan adı yoksa oda id'si ile
function hostLink(url, env, owner, r) {
  if (env.BASE_DOMAIN && r.slug) return `https://${owner}.${env.BASE_DOMAIN}/host#${r.slug}.${r.key}`;
  return `${url.origin}/host#${r.room}.${r.key}`;
}

// Ziyaretçiye açık sıra durumu sayfası: antalyabb.qrwait.app/bambus; sahipsiz eski oda bambus.qrwait.app
function statusLink(url, env, owner, ref) {
  if (!env.BASE_DOMAIN || ID_RE.test(ref)) return `${url.origin}/status?r=${ref}`;
  return owner ? `https://${owner}.${env.BASE_DOMAIN}/${ref}` : `https://${ref}.${env.BASE_DOMAIN}/`;
}

// Süper yönetici: kullanıcı açar, şifre sıfırlar, siler; hesaplardan önceki sıraları bir kullanıcıya taşır;
// bilet hakkı verir, sayaçlı/sınırsız yapar, askıya alır
async function usersApi(req, env, reg, url, body) {
  const m = url.pathname.match(/^\/api\/admin\/users(?:\/([a-z0-9-]+)(?:\/(adopt|plan))?)?$/);
  if (!m) throw fail("badRequest");
  const [, name, op] = m;
  if (!name && req.method === "GET") {
    const users = await Promise.all((await reg.users()).map(async (u) => ({ ...u, link: accountLink(url, env, u.name), balance: await acct(env, u.name).balance() })));
    return { users, unowned: (await reg.rooms(null)).length };
  }
  if (!name && req.method === "POST") {
    const n = userName(body.user);
    await reg.createUser(n, await credential(body.password));
    await acct(env, n).set({ metered: false });
  }
  else if (op === "adopt" && req.method === "POST") return { moved: await reg.adopt(name) };
  else if (op === "plan" && req.method === "POST") {
    await reg.user(name);
    const a = acct(env, name);
    if ("metered" in body) await a.set({ metered: !!body.metered });
    if (body.grant) await a.grant(int(body.grant, -1e7, 1e7, "badNumber"));
    if ("suspended" in body) {
      await reg.setUser(name, { suspended: !!body.suspended });
      await a.set({ suspended: !!body.suspended });
    }
    if (body.verified) await reg.setUser(name, { verified: true });
    return a.balance();
  } else if (!op && req.method === "PUT") await reg.setPassword(name, await credential(body.password));
  else if (!op && req.method === "DELETE") {
    await reg.deleteUser(name);
    await acct(env, name).destroy();
  } else throw fail("badRequest");
  return { ok: true };
}

// Kullanıcının kendi hesabı: /me, şifre, doğrulama e-postası, bilet paketi alma, hesabı silme
async function accountApi(req, env, reg, url, body, owner, u) {
  const p = url.pathname;
  if (p === "/api/admin/me") {
    return {
      user: owner, super: false, home: accountLink(url, env, owner), email: u.email ?? null, verified: u.verified !== false,
      balance: await acct(env, owner).balance(), packages: packages(env),
    };
  }
  if (p === "/api/admin/password" && req.method === "POST") {
    await checkLogin(env, reg, owner, body.old);
    const cred = await credential(body.password, true);
    await reg.setPassword(owner, cred);
    return session(owner, cred.hash); // eski oturumlar düştü, bu tarayıcı girişli kalsın
  }
  if (p === "/api/admin/verify" && req.method === "POST") {
    const r = await reg.resendVerify(owner);
    await sendLink(env, url, { to: r.email, lang: r.lang, kind: "verify", user: owner, token: r.token });
    return { ok: true };
  }
  if (p === "/api/admin/checkout" && req.method === "POST") {
    if (u.verified === false) throw fail("unverified");
    await limit(env, "AUTH_LIMIT", `pay:${owner}`);
    return { url: await checkout(env, url.origin, owner, u.email, body.variant) };
  }
  if (p === "/api/admin/account/delete" && req.method === "POST") {
    await checkLogin(env, reg, owner, body.password);
    await reg.deleteUser(owner); // sırası varsa silinmez
    await acct(env, owner).destroy();
    return { ok: true };
  }
  return null;
}

async function adminApi(req, env, url, body) {
  const reg = env.REGISTRY.getByName("main"), { owner, u } = await auth(req, env, reg);
  if (owner === SUPER) {
    if (url.pathname === "/api/admin/me") return { user: owner, super: true, home: false };
    if (url.pathname.startsWith("/api/admin/users")) return usersApi(req, env, reg, url, body);
    throw fail("superNoRooms");
  }
  const own = await accountApi(req, env, reg, url, body, owner, u);
  if (own) return own;
  const m = url.pathname.match(/^\/api\/admin\/rooms(?:\/([a-f0-9]{10})(?:\/(rotate|import|reslug|stats))?)?$/);
  if (!m) throw fail("badRequest");
  const [, id, op] = m;
  if (!id && req.method === "GET") {
    const list = await reg.rooms(owner);
    const rooms = await Promise.all(list.map(({ id: room }) => env.ROOM.getByName(room).info().then((x) => ({ room, ...x }), () => null)));
    return rooms.filter(Boolean).map((r) => ({ ...r, link: hostLink(url, env, owner, r), page: statusLink(url, env, owner, r.slug ?? r.room) }));
  }
  if (!id && req.method === "POST") {
    if (u.verified === false) throw fail("unverified");
    if (u.self && (await reg.rooms(owner)).length >= ROOM_LIMIT) throw fail("roomLimit", ROOM_LIMIT);
    const fields = roomFields(body);
    const room = crypto.randomUUID().replaceAll("-", "").slice(0, 10);
    await reg.claim(owner, fields.slug, room);
    const key = await env.ROOM.getByName(room).create(fields, owner);
    await reg.add(room, owner);
    return { room, key };
  }
  const room = env.ROOM.getByName(id);
  if (op === "import" && req.method === "POST") {
    // Listede olmayan mevcut bir odayı görevli linkinden (ID + anahtar) listeye geri ekler; anahtarı bilmeyen alamaz
    const { slug } = await room.info(); // oda yoksa "Sıra bulunamadı" fırlatır
    if (!(await room.keyOk(String(body.key ?? "")))) throw fail("unauthorized");
    if (await reg.value(id)) throw fail("alreadyListed");
    if (slug) await reg.claim(owner, slug, id);
    await reg.add(id, owner);
    await room.setOwner(owner);
    return { ok: true };
  }
  if (!(await reg.owns(id, owner))) throw fail("notFound");
  if (op === "rotate" && req.method === "POST") return { key: await room.rotate() };
  if (op === "stats" && req.method === "GET") return room.stats();
  if (op === "reslug" && req.method === "POST") {
    // Gizli sıranın adresi sızarsa: yeni rastgele adres, eski adres ve ziyaretçi linkleri anında geçersiz olur
    const prev = await room.info();
    if (!prev.private) throw fail("onlyPrivate");
    const slug = secretSlug();
    await reg.claim(owner, slug, id, prev.slug);
    await room.update({ slug });
    return { slug };
  }
  if (!op && req.method === "PUT") {
    const prev = await room.info();
    const fields = roomFields(body, prev);
    await reg.claim(owner, fields.slug, id, prev.slug);
    await room.update(fields);
  } else if (!op && req.method === "DELETE") {
    const { slug } = await room.info().catch(() => ({}));
    await room.destroy();
    await reg.remove(id, owner, slug);
  } else throw fail("badRequest");
  return { ok: true };
}

// Hesap açma, e-posta doğrulama, şifremi unuttum. Hepsi IP başına sınırlı; hesap açma ve sıfırlama isteği Turnstile ister.
async function publicAuth(req, env, reg, url, body) {
  const p = url.pathname;
  if (req.method !== "POST" || !["/api/login", "/api/signup", "/api/verify", "/api/forgot", "/api/reset"].includes(p)) return null;
  await limit(env, "AUTH_LIMIT", `${p}:${ip(req)}`);
  switch (p) {
    case "/api/login": {
      const { name, secret } = await checkLogin(env, reg, body.user, body.password);
      return session(name, secret);
    }
    case "/api/signup": {
      await human(env, req, body.captcha);
      const name = userName(body.user), email = emailOf(body.email), lang = langOf(body.lang);
      if (typeof body.terms !== "string" || !body.terms) throw fail("terms");
      const cred = await credential(body.password, true);
      const token = await reg.signup(name, cred, email, lang, body.terms.slice(0, 20));
      await acct(env, name).set({ metered: true, suspended: false, email, lang, user: name });
      await sendLink(env, url, { to: email, lang, kind: "verify", user: name, token });
      return session(name, cred.hash);
    }
    case "/api/verify": return { user: await reg.verify(body.token) };
    case "/api/forgot": {
      await human(env, req, body.captcha);
      const email = emailOf(body.email), r = await reg.forgot(email);
      if (r) await sendLink(env, url, { to: email, lang: r.lang, kind: "reset", user: r.name, token: r.token });
      return { ok: true };
    }
    case "/api/reset": {
      const cred = await credential(body.password, true);
      await reg.reset(body.token, cred);
      return { ok: true };
    }
  }
}

// Herkese açık sıra listesi (tanıtım sitesindeki harita, kullanıcı sayfası): yalnızca status() alanları, anahtar yok, gizli sıralar
// ve askıya alınan kullanıcılar hariç. ?u=: yalnızca o kullanıcının sıraları.
// Her istek tüm odalara sorduğu için 30 sn önbellekte; önbellek anahtarında yalnızca u var, rastgele parametreyle aşılamaz.
async function publicRooms(req, env, url, reg) {
  const u = url.searchParams.get("u") || "";
  const key = new Request(`${url.origin}/api/rooms?u=${encodeURIComponent(u)}`), cache = env.DEV === "1" ? null : caches.default;
  const hit = await cache?.match(key);
  if (hit) return hit;
  const list = await reg.listed(u || undefined);
  const rooms = await Promise.all(list.map(({ id, owner }) => env.ROOM.getByName(id).status()
    .then((st) => ({ ...st, link: statusLink(url, env, owner, st.slug ?? id) }), () => null)));
  const res = Response.json(rooms.filter((r) => r && !r.private), { headers: { "cache-control": "public, max-age=30" } });
  await cache?.put(key, res.clone());
  return res;
}

const PAGES = new Set(["/join", "/host", "/status"]); // wrangler.jsonc'ta run_worker_first: eski adres yönlendirmesi için

// Sayfa istekleri. Kök: alt alan adında kullanıcının sayfası / sıra durumu, ana alan adında tanıtım sitesi.
// antalyabb.qrwait.app/bambus → sıra durumu. Hesaplardan önceki bambus.qrwait.app adresleri
// sıra bir kullanıcıya taşındıysa antalyabb.qrwait.app'a yönlenir (basılı QR'lar ve görevli linkleri çalışmaya devam eder).
// Yönetim sayfası yalnızca ana alan adında: kullanıcı adresinde giriş formu görünmesin.
async function page(req, env, url) {
  const sub = subdomain(url, env), path = url.pathname;
  if (path === "/admin") {
    if (!sub) return env.ASSETS.fetch(req);
    const to = new URL(url);
    to.hostname = url.hostname.slice(sub.length + 1);
    return Response.redirect(to, 302);
  }
  if (!sub) return path === "/" ? env.ASSETS.fetch(new Request(new URL("/home", url), req)) : env.ASSETS.fetch(req);
  const r = await env.REGISTRY.getByName("main").resolve(sub, url.searchParams.get("r") ?? "");
  if (r.owner) {
    const { slug } = await env.ROOM.getByName(r.room).status();
    const to = new URL(url);
    to.hostname = `${r.owner}.${url.hostname.slice(sub.length + 1)}`;
    if (path === "/") to.pathname = `/${slug}`;
    else to.searchParams.set("r", slug);
    return Response.redirect(to, 302);
  }
  if (PAGES.has(path)) return env.ASSETS.fetch(req);
  return env.ASSETS.fetch(new Request(new URL(`/status${url.search}`, url), req));
}

async function handle(req, env) {
  const url = new URL(req.url), lang = langOf(req.headers.get("x-lang")); // hata mesajlarının dili (web/src/lib/api.ts gönderir)
  try {
    if (!url.pathname.startsWith("/api/")) {
      // Buraya yalnızca PAGES, /admin, kök ve eşleşen dosyası olmayan yollar gelir
      if (PAGES.has(url.pathname) || url.pathname === "/" || url.pathname === "/admin" || (subdomain(url, env) && NAME_RE.test(url.pathname.slice(1)))) return await page(req, env, url);
      return new Response("Not found", { status: 404 });
    }
    if (url.pathname === "/api/lemon" && req.method === "POST") return await webhook(req, env); // gövde ham haliyle imzalanır
    const body = ["POST", "PUT"].includes(req.method) ? await req.json() : {};
    const reg = env.REGISTRY.getByName("main");
    const pub = await publicAuth(req, env, reg, url, body);
    if (pub) return Response.json(pub);
    if (url.pathname.startsWith("/api/admin/")) {
      try {
        return Response.json(await adminApi(req, env, url, body));
      } catch (e) {
        return Response.json({ error: localize(e.message, lang) }, { status: failed(e, "auth") || failed(e, "suspended") ? 401 : 400 });
      }
    }
    if (url.pathname === "/api/rooms") return await publicRooms(req, env, url, reg);
    if (url.pathname === "/api/vapid") return Response.json({ key: env.VAPID_PUBLIC_KEY ?? null });
    // Hesap açma formu ve fiyatlar: Turnstile site anahtarı (gizli değil), ücretsiz bilet sayısı, paketler
    if (url.pathname === "/api/config") return Response.json({ turnstile: env.TURNSTILE_SITE_KEY ?? "", free: FREE, packages: packages(env) });
    if (url.pathname === "/api/resolve") {
      // ?r= oda id'si ya da slug, ?u= kullanıcı (yoksa alt alan adından: antalyabb.qrwait.app).
      // r'siz kullanıcı adresi { account } döner: sayfa kullanıcının sıralarını listeler.
      const r = await reg.resolve(url.searchParams.get("u") || subdomain(url, env), url.searchParams.get("r") ?? "");
      if (!r.room && !r.account) throw fail("notFound");
      return Response.json(r.account ? { account: r.account } : { room: r.room });
    }
    const m = url.pathname.match(/^\/api\/r\/([a-f0-9]{10})\/(join|me|leave|push|admin|status)$/);
    if (!m) return new Response("Not found", { status: 404 });
    const room = env.ROOM.getByName(m[1]);
    switch (m[2]) {
      case "join":
        // Her bilet sıra sahibinin hakkından düştüğü için rastgele cihaz kimliğiyle toplu girişi IP başına sınırlar
        await limit(env, "JOIN_LIMIT", `${m[1]}:${ip(req)}`);
        return Response.json(await room.join(body));
      case "me": return Response.json(await room.me(url.searchParams.get("id")));
      case "leave": return Response.json(await room.leave(body.id));
      case "push": return Response.json(await room.subscribe(body.id, body.sub));
      case "admin": return Response.json(await room.admin(req.headers.get("x-key"), body));
      case "status": return Response.json(await room.status());
    }
  } catch (e) {
    return Response.json({ error: localize(e.message, lang) }, { status: failed(e, "tooMany") ? 429 : 400 });
  }
}

export default {
  async fetch(req, env) {
    return secure(await handle(req, env));
  },
};
