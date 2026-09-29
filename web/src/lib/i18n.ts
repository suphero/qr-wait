import type { PublicRoom, Table } from "@/lib/api";

// Ziyaretçi sayfalarının dili (join, status, home): telefonun dil tercihlerinden ilk desteklenen, yoksa Türkçe.
// Görevli ve yönetim ekranları Türkçe kalır. Sunucu metinleri src/i18n.js'te, aynı diller.
export const LANGS = ["tr", "en", "de", "ru"] as const;
export type Lang = (typeof LANGS)[number];

export const lang: Lang = (navigator.languages ?? [navigator.language])
  .map((l) => l.slice(0, 2).toLowerCase()).find((l): l is Lang => (LANGS as readonly string[]).includes(l)) ?? "tr";

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
    noGeo: "Tarayıcınız konum desteklemiyor.",
    geoDenied: "Konum izni gerekli. Tarayıcı ayarlarından bu siteye konum izni verin.",
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
    noGeo: "Your browser doesn't support location.",
    geoDenied: "Location access is required. Allow this site to use your location in your browser settings.",
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
    noGeo: "Ihr Browser unterstützt keine Standortbestimmung.",
    geoDenied: "Die Standortfreigabe ist erforderlich. Erlauben Sie dieser Seite in den Browsereinstellungen den Zugriff auf Ihren Standort.",
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
    noGeo: "Ваш браузер не поддерживает геолокацию.",
    geoDenied: "Нужен доступ к геолокации. Разрешите этому сайту определять местоположение в настройках браузера.",
  },
});

export const waitText = (r: PublicRoom) => (r.waiting ? S.waiting(r) : S.empty);
// "2, 3 veya 4"
export const orList = (a: number[]) => (a.length > 1 ? `${a.slice(0, -1).join(", ")} ${S.or} ${a.at(-1)}` : String(a[0]));
// src/i18n.js'teki tableLabel ile aynı
export const tableLabel = (t: Pick<Table, "name" | "cap">) => (/^\d+$/.test(t.name) ? S.table(t.name) : t.name || S.tableFor(t.cap));
export const geoErrors = { unsupported: S.noGeo, denied: S.geoDenied };
// 850 m, 1,2 km / 1.2 km
export const fmtDistL = (m: number) => (m < 1000 ? `${Math.max(10, Math.round(m / 10) * 10)} m`
  : `${(m / 1000).toLocaleString(lang, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} km`);

document.documentElement.lang = lang;
