import { geoErrors, lang, S } from "@/lib/i18n";

// Hata mesajları x-lang dilinde gelir; hatanın status'u 401 ise oturum geçersizdir
export async function api<T = any>(path: string, body?: unknown, headers: Record<string, string> = {}, method = body ? "POST" : "GET"): Promise<T> {
  const r = await fetch(path, { method, headers: { "content-type": "application/json", "x-lang": lang, ...headers }, body: body === undefined ? undefined : JSON.stringify(body) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw Object.assign(new Error(j.error || S.network), { status: r.status });
  return j;
}

export function locate(msg = geoErrors): Promise<GeolocationCoordinates> {
  return new Promise((ok, fail) => {
    if (!navigator.geolocation) return fail(new Error(msg.unsupported));
    navigator.geolocation.getCurrentPosition((p) => ok(p.coords),
      () => fail(new Error(msg.denied)),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 });
  });
}

export const mins = (t: number) => Math.floor((Date.now() - t) / 60000);
export const range = (n: number) => Array.from({ length: n }, (_, i) => i + 1);

// Sıra kategorileri; anahtarlar src/index.js'teki CATEGORIES ile aynı, adlar lib/i18n.ts'te
export const CATEGORIES: Record<string, [string, string]> = Object.fromEntries(Object.entries({
  plaj: "🏖️", iskele: "⛴️", gise: "🎫", restoran: "🍽️", saglik: "🏥", resmi: "🏛️", etkinlik: "🎪", diger: "📍",
}).map(([k, icon]) => [k, [icon, S.categories[k as keyof typeof S.categories]]]));
export const catIcon = (c?: string) => (CATEGORIES[c ?? ""] ?? CATEGORIES.diger)[0];

// Bilet paketi (wrangler.jsonc PACKAGES, /api/config); price yalnızca gösterim metni, ör. "$9"
export type Pkg = { variant: string; name: string; tickets: number; price: string };
// Paketin bu dildeki adı ("starter" → "Başlangıç"); adı tanımsızsa null, yerine bilet sayısı gösterilir
export const packName = (p: Pkg) => S.packs[p.name as keyof typeof S.packs] ?? null;
// "$9", 5000 bilet → "$1.80" (1000 bilet başı); dolar değilse ya da ayrıştırılamazsa null
export const perThousand = (p: Pkg) => {
  const n = p.price.startsWith("$") ? Number(p.price.slice(1).replace(/,/g, "")) : NaN;
  return n > 0 ? `$${((n * 1000) / p.tickets).toFixed(2)}` : null;
};


// Sayfa dönen `setInterval` yoklaması; sekme gizliyken atlanır, sekmeye dönünce hemen yenilenir
export function poll(fn: () => void, ms: number, whenHidden = false) {
  const tick = () => (whenHidden || !document.hidden) && fn();
  const onVis = () => !document.hidden && fn();
  const t = setInterval(tick, ms);
  document.addEventListener("visibilitychange", onVis);
  return () => { clearInterval(t); document.removeEventListener("visibilitychange", onVis); };
}

// Odanın canlı bağlantısı (WebSocket, /api/r/<oda>/live). Gelen mesajlar onMsg'a gider.
// Bağlantı yokken refresh ms'de bir yoklanır (WebSocket engelliyse eski davranış), varken yalnızca slow ms'de bir
// (kaçan mesaj, görevlide dinamik QR). Kopunca artan aralıklarla yeniden bağlanır; sayfa yeniden görünür olunca hemen.
// hello: bağlanınca gönderilen ilk mesaj (görevli anahtarı). "ping"e sunucu oda uyanmadan "pong" döner.
// vis: sayfanın ekranda olup olmadığı bağlanınca ve her değişimde bildirilir (ziyaretçi; ekran kilitlenince bağlantı bir süre açık kalabilir)
export function live(path: string, onMsg: (m: any) => void, refresh: () => void, { ms, slow, hidden = false, hello, vis = false }: { ms: number; slow: number; hidden?: boolean; hello?: object; vis?: boolean }) {
  let ws: WebSocket | null = null, up = false, stopped = false, backoff = 1000, retry = 0, heard = 0, pinged = 0, fresh = Date.now();
  const connect = () => {
    if (stopped || ws || !window.WebSocket) return;
    clearTimeout(retry);
    const s = (ws = new WebSocket(`${location.protocol === "https:" ? "wss" : "ws"}://${location.host}${path}`));
    s.onopen = () => {
      up = true; backoff = 1000; heard = pinged = Date.now();
      s.send("ping");
      if (hello) s.send(JSON.stringify(hello));
      if (vis) s.send(JSON.stringify({ vis: !document.hidden }));
    };
    s.onmessage = (e) => {
      heard = Date.now();
      if (e.data === "pong") return;
      fresh = heard;
      try { onMsg(JSON.parse(e.data)); } catch {}
    };
    s.onclose = () => {
      if (ws === s) { ws = null; up = false; }
      if (!stopped && !document.hidden) retry = window.setTimeout(connect, (backoff = Math.min(backoff * 2, 30000)));
    };
  };
  const tick = () => {
    const now = Date.now();
    if (ws && up) {
      if (now - heard > 60000) ws.close(); // uyku / ağ değişimi sonrası yanıt vermeyen bağlantı
      else if (now - pinged >= 25000) { pinged = now; ws.send("ping"); }
    }
    if ((hidden || !document.hidden) && (!up || now - fresh >= slow)) { fresh = now; refresh(); }
  };
  const onVis = () => {
    if (vis && ws && up) ws.send(JSON.stringify({ vis: !document.hidden }));
    if (document.hidden) return;
    if (!ws) connect();
    refresh();
  };
  const t = setInterval(tick, ms);
  document.addEventListener("visibilitychange", onVis);
  connect();
  return () => {
    stopped = true;
    clearInterval(t); clearTimeout(retry);
    document.removeEventListener("visibilitychange", onVis);
    ws?.close();
  };
}

// --- API yanıt tipleri (src/index.js) ---
// Katılım saatleri "HH:MM"; from > to gece yarısını geçer. days: pazartesi … pazar, null: o gün kapalı
export type Span = { from: string; to: string };
export type Hours = { days: (Span | null)[] };
// Saat dışında bir sonraki açılış: in kaç gün sonra (0 bugün), day haftanın günü (0 pazartesi)
export type Opens = { in: number; day: number; from: string };
// Konum kontrolü: sıranın sabit noktası, QR'ı gösteren görevlinin konumu ya da yok
export type Geo = "off" | "fixed" | "dynamic";
// lat/lng: yalnızca sabit konumlu sıralarda; diğerleri haritada görünmez
export type Status = {
  name: string; slug?: string; lat: number | null; lng: number | null; flex: boolean; private: boolean; category: string; maxGroup: number; geo: Geo;
  wait: number | null; // çağrılanın gelme süresi (dk), null: süresiz
  paused: boolean; open: boolean; full: boolean; hours: Hours | null; opens: Opens | null; // yeni katılım: durduruldu / saat dışı / dolu
  eta: number | null; // şimdi girene tahmini bekleme (dk)
  waiting: number; people: number; next: number | null; called: number[]; lastNo: number | null;
  deskOf: Record<number, string>; // çağrılan numara → gişe (gişe modu)
  zones: { name: string; waiting: number; eta: number | null }[]; // bölge başına bekleyen ve o bölgeyi seçene tahmini bekleme
};
export type PublicRoom = Status & { link: string };
// Sıra türü: boş yer havuzu, masalar, tek sıra + birden çok gişe
export type Mode = "seats" | "tables" | "desks";
export type Table = { id: string; cap: number; name: string; at: number; zone?: string };
export type Me = {
  name: string; status: "waiting" | "called" | "gone" | "expired"; no: number; size: number; accept: number[]; alloc?: number; table?: Table; desk?: string; zones?: string[]; zone?: string; calledAt?: number;
  aheadGroups: number; aheadPeople: number; wait: number | null; remaining: number | null; eta: number | null;
};
export type Entry = {
  id: string; no: number; size: number; accept?: number[]; alloc?: number; table?: Table; desk?: string; zones?: string[]; zone?: string; src: "qr" | "manual"; note: string;
  status: "waiting" | "called"; at: number; calledAt?: number;
  // Yalnızca QR ile girenlerde: sayfanın son görülmesi (sunucu saati), sayfa şu an ekranda değil mi, push ile ulaşılabilir mi
  seen?: number; hidden?: boolean; notify?: boolean;
};
export type AdminState = {
  name: string; flex: boolean; tables: boolean; mode: Mode; desks: string[]; idle: string[]; zones: string[]; spots: Record<string, number>; maxEmpty: number | null; available: number; added?: number;
  seated?: number | null; freeTables: Table[]; qr: "dynamic" | "static"; ttl: number; maxGroup: number; geo: Geo; wait: number | null; now: number;
  hours: Hours | null; opens: Opens | null; cap: number | null; paused: boolean; open: boolean; full: boolean;
  token: string; entries: Entry[];
};
export type RoomInfo = {
  room: string; name: string; slug?: string; lat: number | null; lng: number | null; radius: number; flex: boolean; skip: boolean; private: boolean; key: string;
  category: string; mode: Mode; desks: string[]; zones: string[]; tables: boolean; maxEmpty: number | null; maxGroup: number; qr: "dynamic" | "static"; ttl: number; geo: Geo; wait: number | null; hours: Hours | null; cap: number | null; tz: string; paused: boolean; waiting: number; people: number; called: number; link: string; page: string;
};

// Günlük sıra istatistikleri (GET /api/admin/rooms/<id>/stats); kişisel veri yok
export type StatDay = {
  day: string; joined: number; manual: number; called: number; waitMs: number; served: number; noShow: number; expired: number; left: number; removed: number;
  hours: number[];
};
export type Stats = { tz: string; days: StatDay[] };
