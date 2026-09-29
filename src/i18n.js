// Ziyaretçiye giden sunucu metinleri: sıraya girme hataları ve push bildirimi.
// Diller web/src/lib/i18n.ts ile aynı; görevli ve yönetim metinleri Türkçe kalır.
export const LANGS = ["tr", "en", "de", "ru"];
export const langOf = (l) => (LANGS.includes(l) ? l : "tr");

const M = {
  notFound: {
    tr: "Sıra bulunamadı",
    en: "Queue not found",
    de: "Warteschlange nicht gefunden",
    ru: "Очередь не найдена",
  },
  qrInvalid: {
    tr: "Bu QR kodu artık geçerli değil. Görevliden güncel kodu isteyin.",
    en: "This QR code is no longer valid. Ask the attendant for the current code.",
    de: "Dieser QR-Code ist nicht mehr gültig. Bitten Sie das Personal um den aktuellen Code.",
    ru: "Этот QR-код больше не действует. Попросите у сотрудника актуальный код.",
  },
  qrExpired: {
    tr: "QR kodunun süresi dolmuş. Görevlinin ekranındaki kodu yeniden okutun.",
    en: "The QR code has expired. Scan the code on the attendant's screen again.",
    de: "Der QR-Code ist abgelaufen. Scannen Sie den Code auf dem Bildschirm des Personals erneut.",
    ru: "Срок действия QR-кода истёк. Отсканируйте код на экране сотрудника ещё раз.",
  },
  far: {
    tr: "Sıranın bulunduğu yerde görünmüyorsunuz. Konum izniniz açık olmalı ve orada olmalısınız.",
    en: "You don't seem to be at the queue's location. Location access must be on and you need to be there.",
    de: "Sie scheinen nicht am Ort der Warteschlange zu sein. Die Standortfreigabe muss aktiviert sein und Sie müssen vor Ort sein.",
    ru: "Похоже, вы не находитесь у очереди. Разрешите доступ к геолокации — и нужно быть на месте.",
  },
  device: {
    tr: "Geçersiz cihaz",
    en: "Invalid device",
    de: "Ungültiges Gerät",
    ru: "Недопустимое устройство",
  },
  group: (n) => ({
    tr: `Grup 1-${n} kişi olmalı`,
    en: `A group must be 1–${n} people`,
    de: `Eine Gruppe muss 1–${n} Personen umfassen`,
    ru: `В группе должно быть от 1 до ${n} человек`,
  }),
  accept: {
    tr: "Kabul ettiğiniz en az bir yer sayısı seçin",
    en: "Choose at least one number of places you would accept",
    de: "Wählen Sie mindestens eine Platzanzahl, die Sie akzeptieren",
    ru: "Выберите хотя бы одно подходящее количество мест",
  },
  full: {
    tr: "Sıra dolu",
    en: "The queue is full",
    de: "Die Warteschlange ist voll",
    ru: "Очередь заполнена",
  },
  yourTurn: {
    tr: "Sıra size geldi!",
    en: "It's your turn!",
    de: "Sie sind dran!",
    ru: "Ваша очередь!",
  },
  tableReady: {
    tr: "Masanız hazır!",
    en: "Your table is ready!",
    de: "Ihr Tisch ist bereit!",
    ru: "Ваш столик готов!",
  },
  // Push gövdesi: "<sıra adı> · 47 numara · Masa 7. Görevliye gidip numaranızı gösterin."
  pushBody: (name, no, table) => ({
    tr: `${name} · ${no} numara${table ? ` · ${table}` : ""}. Görevliye gidip numaranızı gösterin.`,
    en: `${name} · No. ${no}${table ? ` · ${table}` : ""}. Go to the attendant and show your number.`,
    de: `${name} · Nr. ${no}${table ? ` · ${table}` : ""}. Gehen Sie zum Personal und zeigen Sie Ihre Nummer.`,
    ru: `${name} · № ${no}${table ? ` · ${table}` : ""}. Подойдите к сотруднику и покажите свой номер.`,
  }),
  // "7" → "Masa 7", "Bahçe 3" olduğu gibi, adsız masa kapasitesiyle; web/src/lib/i18n.ts'teki tableLabel ile aynı
  table: (name) => ({ tr: `Masa ${name}`, en: `Table ${name}`, de: `Tisch ${name}`, ru: `Стол ${name}` }),
  tableFor: (cap) => ({ tr: `${cap} kişilik masa`, en: `Table for ${cap}`, de: `Tisch für ${cap}`, ru: `Стол на ${cap}` }),
};

export function msg(lang, key, ...args) {
  const m = M[key];
  return (typeof m === "function" ? m(...args) : m)[langOf(lang)];
}

export const tableLabel = (t, lang) => (/^\d+$/.test(t.name) ? msg(lang, "table", t.name) : t.name || msg(lang, "tableFor", t.cap));
