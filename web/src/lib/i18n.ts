import type { PublicRoom, Table } from "@/lib/api";

// Sayfaların dili. Tanıtım sitesinde (<html data-site>, vite.config.ts) adresten gelir: /tr/pricing Türkçe, /pricing İngilizce.
// Diğer sayfalarda (sıraya giriş, durum, görevli, yönetim) üst çubuktan seçilen dil, yoksa cihazın dil tercihlerinden ilk
// desteklenen, o da yoksa İngilizce. Seçim ana alan adına "lang" çereziyle yazılır: qrwait.app'te seçilen dil
// antalyabb.qrwait.app'te de geçerlidir (localStorage alt alan adları arasında paylaşılmaz; yedek olarak orada da durur). Sunucu metinleri src/i18n.js'te, aynı diller.
export const LANGS = ["tr", "en", "de", "ru"] as const;
export type Lang = (typeof LANGS)[number];
export const LANG_NAMES: Record<Lang, string> = { tr: "Türkçe", en: "English", de: "Deutsch", ru: "Русский" };
const isLang = (l: unknown): l is Lang => (LANGS as readonly unknown[]).includes(l);

// Çerezin alanı: antalyabb.qrwait.app ve qrwait.app → qrwait.app; localhost'ta alan yazılmaz
const host = location.hostname, cookieDomain = host === "localhost" || host.endsWith(".localhost") ? "" : `; domain=${host.split(".").slice(-2).join(".")}`;
const saved = (() => {
  const c = document.cookie.match(/(?:^|; )lang=(\w+)/)?.[1];
  if (isLang(c)) return c;
  try { const l = localStorage.getItem("lang"); return isLang(l) ? l : null; } catch { return null; }
})();
const preferred = (navigator.languages ?? [navigator.language]).map((l) => l.slice(0, 2).toLowerCase()).find(isLang) ?? "en";
const root = document.documentElement, site = root.hasAttribute("data-site");
export const lang: Lang = site && isLang(root.lang) ? root.lang : saved ?? preferred;
root.lang = lang;

// Tanıtım sitesinde dil öneki olmadan yol: /tr/pricing → /pricing, /tr/ → /
export const basePath = () => location.pathname.replace(/^\/(tr|de|ru)(?=\/|$)/, "") || "/";
// Tanıtım sitesi sayfasının bu dildeki adresi: sitePath("/pricing") → /tr/pricing (İngilizce önek almaz)
export const sitePath = (path: string, l: Lang = lang) => (l === "en" ? path : `/${l}${path}`);

// İngilizce kök adrese gelen ziyaretçi seçtiği ya da telefonunun dilindeki sayfaya gider; arama motorları (İngilizce) kökte kalır
const want = saved ?? preferred;
if (site && lang === "en" && want !== "en") location.replace(sitePath(basePath(), want) + location.search + location.hash);

// Ekrandan dil seçimi: hatırlanır; tanıtım sitesinde aynı sayfanın o dildeki adresine, diğer sayfalarda yeniden yükleyerek
export function setLang(l: Lang) {
  document.cookie = `lang=${l}${cookieDomain}; path=/; max-age=31536000; samesite=lax`;
  try { localStorage.setItem("lang", l); } catch {}
  if (site) location.href = sitePath(basePath(), l) + location.search + location.hash;
  else location.reload();
}

// Sayfa sözlüğü: tr kaynak, diğerleri aynı biçimde olmak zorunda
export const pick = <D,>(d: { tr: D } & Record<Exclude<Lang, "tr">, D>): D => d[lang];

// Sayı + çoğul: pl(3, { one: "group", other: "groups" }) → "3 groups". Rusçada few/many da gerekir.
const rules = new Intl.PluralRules(lang);
type Forms = Partial<Record<Intl.LDMLPluralRule, string>> & { other: string };
export const word = (n: number, f: Forms) => f[rules.select(n)] ?? f.other;
export const pl = (n: number, f: Forms) => `${n} ${word(n, f)}`;

export const S = pick({
  tr: {
    cancel: "Vazgeç",
    ok: "Tamam",
    network: "Bağlantı hatası",
    categories: { plaj: "Plaj", iskele: "İskele / ulaşım", gise: "Gişe", restoran: "Restoran / kafe", saglik: "Sağlık", resmi: "Resmi daire", etkinlik: "Etkinlik", diger: "Diğer" },
    waiting: (r: PublicRoom) => `${r.waiting} grup, ${r.people} kişi bekliyor`,
    empty: "Şu an sıra yok",
    or: "veya",
    table: (n: string) => `Masa ${n}`,
    tableFor: (c: number) => `${c} kişilik masa`,
    minU: "dk", hourU: "sa",
    eta: (t: string) => `Tahmini bekleme: yaklaşık ${t}`,
    closedPaused: "Sıra şu an yeni katılıma kapalı.",
    closedHours: (a: string, b: string) => `Sıra şu an kapalı. Katılım saatleri: ${a}-${b}.`,
    closedFull: "Sıra şu an dolu. Biraz sonra yeniden deneyin.",
    noGeo: "Tarayıcınız konum desteklemiyor.",
    geoDenied: "Konum izni gerekli. Tarayıcı ayarlarından bu siteye konum izni verin.",
    packs: { starter: "Başlangıç", business: "İşletme", season: "Sezon", enterprise: "Kurumsal" },
  },
  en: {
    cancel: "Cancel",
    ok: "OK",
    network: "Connection error",
    categories: { plaj: "Beach", iskele: "Pier / transport", gise: "Ticket office", restoran: "Restaurant / café", saglik: "Health", resmi: "Public office", etkinlik: "Event", diger: "Other" },
    waiting: (r: PublicRoom) => `${pl(r.waiting, { one: "group", other: "groups" })}, ${pl(r.people, { one: "person", other: "people" })} waiting`,
    empty: "No queue right now",
    or: "or",
    table: (n: string) => `Table ${n}`,
    tableFor: (c: number) => `Table for ${c}`,
    minU: "min", hourU: "h",
    eta: (t: string) => `Estimated wait: about ${t}`,
    closedPaused: "The queue isn't taking new people right now.",
    closedHours: (a: string, b: string) => `The queue is closed right now. Joining hours: ${a}–${b}.`,
    closedFull: "The queue is full right now. Please try again a little later.",
    noGeo: "Your browser doesn't support location.",
    geoDenied: "Location access is required. Allow this site to use your location in your browser settings.",
    packs: { starter: "Starter", business: "Business", season: "Season", enterprise: "Enterprise" },
  },
  de: {
    cancel: "Abbrechen",
    ok: "OK",
    network: "Verbindungsfehler",
    categories: { plaj: "Strand", iskele: "Anleger / Verkehr", gise: "Kasse", restoran: "Restaurant / Café", saglik: "Gesundheit", resmi: "Behörde", etkinlik: "Veranstaltung", diger: "Sonstiges" },
    waiting: (r: PublicRoom) => `${pl(r.waiting, { one: "Gruppe", other: "Gruppen" })}, ${pl(r.people, { one: "Person", other: "Personen" })} warten`,
    empty: "Derzeit keine Warteschlange",
    or: "oder",
    table: (n: string) => `Tisch ${n}`,
    tableFor: (c: number) => `Tisch für ${c}`,
    minU: "Min.", hourU: "Std.",
    eta: (t: string) => `Geschätzte Wartezeit: etwa ${t}`,
    closedPaused: "Die Warteschlange nimmt gerade niemanden neu auf.",
    closedHours: (a: string, b: string) => `Die Warteschlange ist gerade geschlossen. Anstellzeiten: ${a}–${b}.`,
    closedFull: "Die Warteschlange ist gerade voll. Bitte versuchen Sie es etwas später erneut.",
    noGeo: "Ihr Browser unterstützt keine Standortbestimmung.",
    geoDenied: "Die Standortfreigabe ist erforderlich. Erlauben Sie dieser Seite in den Browsereinstellungen den Zugriff auf Ihren Standort.",
    packs: { starter: "Starter", business: "Business", season: "Saison", enterprise: "Enterprise" },
  },
  ru: {
    cancel: "Отмена",
    ok: "ОК",
    network: "Ошибка соединения",
    categories: { plaj: "Пляж", iskele: "Пристань / транспорт", gise: "Касса", restoran: "Ресторан / кафе", saglik: "Здоровье", resmi: "Госучреждение", etkinlik: "Мероприятие", diger: "Другое" },
    waiting: (r: PublicRoom) => `Ждут: ${pl(r.waiting, { one: "группа", few: "группы", many: "групп", other: "группы" })}, ${pl(r.people, { one: "человек", few: "человека", many: "человек", other: "человека" })}`,
    empty: "Сейчас очереди нет",
    or: "или",
    table: (n: string) => `Стол ${n}`,
    tableFor: (c: number) => `Стол на ${c}`,
    minU: "мин", hourU: "ч",
    eta: (t: string) => `Примерное ожидание: около ${t}`,
    closedPaused: "Очередь сейчас не принимает новых посетителей.",
    closedHours: (a: string, b: string) => `Очередь сейчас закрыта. Время записи: ${a}–${b}.`,
    closedFull: "Очередь сейчас заполнена. Попробуйте чуть позже.",
    noGeo: "Ваш браузер не поддерживает геолокацию.",
    geoDenied: "Нужен доступ к геолокации. Разрешите этому сайту определять местоположение в настройках браузера.",
    packs: { starter: "Старт", business: "Бизнес", season: "Сезон", enterprise: "Корпоративный" },
  },
});

export const waitText = (r: PublicRoom) => (r.waiting ? S.waiting(r) : S.empty);
// "2, 3 veya 4"
export const orList = (a: number[]) => (a.length > 1 ? `${a.slice(0, -1).join(", ")} ${S.or} ${a.at(-1)}` : String(a[0]));
// src/i18n.js'teki tableLabel ile aynı
export const tableLabel = (t: Pick<Table, "name" | "cap">) => (/^\d+$/.test(t.name) ? S.table(t.name) : t.name || S.tableFor(t.cap));
// Tahmini bekleme: 25 dk, 1 sa 10 dk. 10 dk'dan uzunsa 5'e yuvarlanır (kesinlik izlenimi vermesin).
export const fmtWait = (n: number) => {
  const m = n > 10 ? Math.ceil(n / 5) * 5 : n;
  return m < 60 ? `${m} ${S.minU}` : `${Math.floor(m / 60)} ${S.hourU}${m % 60 ? ` ${m % 60} ${S.minU}` : ""}`;
};
// Yeni katılım kapalıysa nedeni; açıksa null
export const closedText = (r: { paused: boolean; open: boolean; full: boolean; hours: { from: string; to: string } | null }) =>
  r.paused ? S.closedPaused : !r.open && r.hours ? S.closedHours(r.hours.from, r.hours.to) : r.full ? S.closedFull : null;
export const geoErrors = { unsupported: S.noGeo, denied: S.geoDenied };
// 850 m, 1,2 km / 1.2 km
export const fmtDistL = (m: number) => (m < 1000 ? `${Math.max(10, Math.round(m / 10) * 10)} m`
  : `${(m / 1000).toLocaleString(lang, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} km`);

document.documentElement.lang = lang;
