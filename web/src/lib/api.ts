export async function api<T = any>(path: string, body?: unknown, headers: Record<string, string> = {}, method = body ? "POST" : "GET"): Promise<T> {
  const r = await fetch(path, { method, headers: { "content-type": "application/json", ...headers }, body: body === undefined ? undefined : JSON.stringify(body) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || "Bağlantı hatası");
  return j;
}

export function locate(): Promise<GeolocationCoordinates> {
  return new Promise((ok, fail) => {
    if (!navigator.geolocation) return fail(new Error("Tarayıcınız konum desteklemiyor."));
    navigator.geolocation.getCurrentPosition((p) => ok(p.coords),
      () => fail(new Error("Konum izni gerekli. Tarayıcı ayarlarından bu siteye konum izni verin.")),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 });
  });
}

export const mins = (t: number) => Math.floor((Date.now() - t) / 60000);
export const orList = (a: number[]) => (a.length > 1 ? `${a.slice(0, -1).join(", ")} veya ${a.at(-1)}` : String(a[0]));
export const range = (n: number) => Array.from({ length: n }, (_, i) => i + 1);

// Sıra kategorileri; anahtarlar src/index.js'teki CATEGORIES ile aynı
export const CATEGORIES: Record<string, [string, string]> = {
  plaj: ["🏖️", "Plaj"], iskele: ["⛴️", "İskele / ulaşım"], gise: ["🎫", "Gişe"], restoran: ["🍽️", "Restoran / kafe"],
  saglik: ["🏥", "Sağlık"], resmi: ["🏛️", "Resmi daire"], etkinlik: ["🎪", "Etkinlik"], diger: ["📍", "Diğer"],
};
export const catIcon = (c?: string) => (CATEGORIES[c ?? ""] ?? CATEGORIES.diger)[0];

// "7" → "Masa 7", "Bahçe 3" olduğu gibi; src/index.js'teki tableName ile aynı
export const tableName = (t: Table) => (/^\d+$/.test(t.name) ? `Masa ${t.name}` : t.name || `${t.cap} kişilik masa`);

// Sayfa dönen `setInterval` yoklaması; sekme gizliyken atlanır, sekmeye dönünce hemen yenilenir
export function poll(fn: () => void, ms: number, whenHidden = false) {
  const tick = () => (whenHidden || !document.hidden) && fn();
  const onVis = () => !document.hidden && fn();
  const t = setInterval(tick, ms);
  document.addEventListener("visibilitychange", onVis);
  return () => { clearInterval(t); document.removeEventListener("visibilitychange", onVis); };
}

// --- API yanıt tipleri (src/index.js) ---
export type Status = {
  name: string; slug?: string; lat: number; lng: number; flex: boolean; private: boolean; category: string; maxGroup: number;
  waiting: number; people: number; next: number | null; called: number[]; lastNo: number | null;
};
export type PublicRoom = Status & { link: string };
export type Table = { id: string; cap: number; name: string; at: number };
export type Me = {
  name: string; status: "waiting" | "called" | "gone"; no: number; size: number; accept: number[]; alloc?: number; table?: Table; calledAt?: number;
  aheadGroups: number; aheadPeople: number;
};
export type Entry = {
  id: string; no: number; size: number; accept?: number[]; alloc?: number; table?: Table; src: "qr" | "manual"; note: string;
  status: "waiting" | "called"; at: number; calledAt?: number;
};
export type AdminState = {
  name: string; flex: boolean; tables: boolean; maxEmpty: number | null; available: number; added?: number;
  seated?: number | null; freeTables: Table[]; qr: "dynamic" | "static"; ttl: number; maxGroup: number;
  token: string; entries: Entry[];
};
export type RoomInfo = {
  room: string; name: string; slug?: string; lat: number; lng: number; radius: number; flex: boolean; private: boolean; key: string;
  category: string; mode: "seats" | "tables"; tables: boolean; maxEmpty: number | null; maxGroup: number; qr: "dynamic" | "static"; ttl: number; waiting: number; people: number; called: number; link: string; page: string;
};
