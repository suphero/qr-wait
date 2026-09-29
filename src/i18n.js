// Sunucu metinleri: hata mesajları ve push bildirimi. Diller web/src/lib/i18n.ts ile aynı.
// Hatalar metin yerine anahtar + parametre taşır (fail), böylece Durable Object sınırını geçer;
// Worker yanıtı dönerken isteğin diline çevirir (localize). Dil: x-lang başlığı, yoksa Türkçe.
export const LANGS = ["tr", "en", "de", "ru"];
export const langOf = (l) => (LANGS.includes(l) ? l : "tr");

const all = (s) => ({ tr: s, en: s, de: s, ru: s });
// "7" → "Masa 7", "Bahçe 3" olduğu gibi
const tableNo = (name) => (/^\d+$/.test(name) ? { tr: `Masa ${name}`, en: `Table ${name}`, de: `Tisch ${name}`, ru: `Стол ${name}` } : all(name));

const M = {
  // --- ziyaretçi ---
  notFound: { tr: "Sıra bulunamadı", en: "Queue not found", de: "Warteschlange nicht gefunden", ru: "Очередь не найдена" },
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
  device: { tr: "Geçersiz cihaz", en: "Invalid device", de: "Ungültiges Gerät", ru: "Недопустимое устройство" },
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
  full: { tr: "Sıra dolu", en: "The queue is full", de: "Die Warteschlange ist voll", ru: "Очередь заполнена" },
  entryNotFound: { tr: "Sıra kaydı bulunamadı", en: "Queue entry not found", de: "Eintrag in der Warteschlange nicht gefunden", ru: "Запись в очереди не найдена" },
  badPush: { tr: "Geçersiz bildirim aboneliği", en: "Invalid notification subscription", de: "Ungültiges Benachrichtigungsabonnement", ru: "Недействительная подписка на уведомления" },

  // --- görevli ---
  unauthorized: { tr: "Yetkisiz", en: "Unauthorized", de: "Nicht berechtigt", ru: "Нет доступа" },
  badNumber: { tr: "Geçersiz sayı", en: "Invalid number", de: "Ungültige Zahl", ru: "Недопустимое число" },
  noTables: { tr: "Bu sırada masa yok", en: "This queue has no tables", de: "Diese Warteschlange hat keine Tische", ru: "В этой очереди нет столов" },
  tableTaken: (name) => {
    const t = tableNo(name);
    return {
      tr: `${t.tr} zaten boş masalarda`,
      en: `${t.en} is already among the free tables`,
      de: `${t.de} ist bereits unter den freien Tischen`,
      ru: `${t.ru} уже среди свободных столов`,
    };
  },
  tableCap: (n) => ({
    tr: `Masa 1-${n} kişilik olmalı`,
    en: `A table must seat 1–${n} people`,
    de: `Ein Tisch muss für 1–${n} Personen sein`,
    ru: `Стол должен быть на 1–${n} человек`,
  }),
  badGroup: { tr: "Geçersiz grup", en: "Invalid group", de: "Ungültige Gruppe", ru: "Недопустимая группа" },

  // --- yönetim ---
  auth: {
    tr: "Oturum geçersiz, yeniden giriş yapın",
    en: "Session is invalid, please log in again",
    de: "Sitzung ungültig, bitte melden Sie sich erneut an",
    ru: "Сеанс недействителен, войдите снова",
  },
  badLogin: {
    tr: "Kullanıcı adı ya da şifre hatalı",
    en: "Incorrect username or password",
    de: "Benutzername oder Passwort ist falsch",
    ru: "Неверное имя пользователя или пароль",
  },
  locked: {
    tr: "Çok fazla hatalı deneme. 15 dakika sonra tekrar deneyin.",
    en: "Too many failed attempts. Try again in 15 minutes.",
    de: "Zu viele Fehlversuche. Versuchen Sie es in 15 Minuten erneut.",
    ru: "Слишком много неудачных попыток. Повторите через 15 минут.",
  },
  shortPassword: {
    tr: "Şifre en az 8 karakter olmalı",
    en: "Password must be at least 8 characters",
    de: "Das Passwort muss mindestens 8 Zeichen lang sein",
    ru: "Пароль должен содержать не менее 8 символов",
  },
  badUser: {
    tr: "Geçersiz kullanıcı adı: 3-40 karakter, küçük harf, rakam ve tire",
    en: "Invalid username: 3–40 characters, lowercase letters, digits and hyphens",
    de: "Ungültiger Benutzername: 3–40 Zeichen, Kleinbuchstaben, Ziffern und Bindestriche",
    ru: "Недопустимое имя пользователя: 3–40 символов, строчные латинские буквы, цифры и дефис",
  },
  userNotFound: { tr: "Kullanıcı bulunamadı", en: "User not found", de: "Benutzer nicht gefunden", ru: "Пользователь не найден" },
  userTaken: { tr: "Bu kullanıcı adı alınmış", en: "This username is taken", de: "Dieser Benutzername ist vergeben", ru: "Это имя пользователя занято" },
  userLegacy: {
    tr: "Bu ad eski bir sıranın adresi, başka bir ad seçin",
    en: "This name is the address of an older queue, choose another name",
    de: "Dieser Name ist die Adresse einer älteren Warteschlange, wählen Sie einen anderen",
    ru: "Это имя — адрес старой очереди, выберите другое",
  },
  userHasRooms: {
    tr: "Kullanıcının sıraları var, önce sıraları silin",
    en: "This user has queues, delete them first",
    de: "Dieser Benutzer hat Warteschlangen, löschen Sie diese zuerst",
    ru: "У пользователя есть очереди, сначала удалите их",
  },
  adoptConflict: (slug) => ({
    tr: `"${slug}" adresi bu kullanıcıda zaten kullanılıyor`,
    en: `The address "${slug}" is already used by this user`,
    de: `Die Adresse „${slug}“ wird bei diesem Benutzer bereits verwendet`,
    ru: `Адрес «${slug}» уже используется у этого пользователя`,
  }),
  superNoRooms: {
    tr: "Sıraları yönetmek için kullanıcı hesabıyla giriş yapın",
    en: "Log in with a user account to manage queues",
    de: "Melden Sie sich mit einem Benutzerkonto an, um Warteschlangen zu verwalten",
    ru: "Чтобы управлять очередями, войдите под учётной записью пользователя",
  },
  badRequest: { tr: "Geçersiz istek", en: "Invalid request", de: "Ungültige Anfrage", ru: "Недопустимый запрос" },
  slugTaken: {
    tr: "Bu adres başka bir sırada kullanılıyor",
    en: "This address is used by another queue",
    de: "Diese Adresse wird von einer anderen Warteschlange verwendet",
    ru: "Этот адрес уже используется другой очередью",
  },
  alreadyListed: { tr: "Sıra zaten listede", en: "The queue is already in the list", de: "Die Warteschlange ist bereits in der Liste", ru: "Очередь уже в списке" },
  onlyPrivate: {
    tr: "Yalnızca gizli sıraların adresi yenilenebilir",
    en: "Only hidden queues can get a new address",
    de: "Nur versteckte Warteschlangen können eine neue Adresse erhalten",
    ru: "Новый адрес можно получить только для скрытых очередей",
  },
  badLocation: { tr: "Geçersiz konum", en: "Invalid location", de: "Ungültiger Standort", ru: "Недопустимое местоположение" },
  badSlug: {
    tr: "Geçersiz adres: 3-40 karakter, küçük harf, rakam ve tire",
    en: "Invalid address: 3–40 characters, lowercase letters, digits and hyphens",
    de: "Ungültige Adresse: 3–40 Zeichen, Kleinbuchstaben, Ziffern und Bindestriche",
    ru: "Недопустимый адрес: 3–40 символов, строчные латинские буквы, цифры и дефис",
  },
  radius: { tr: "Yarıçap 50-2000 m olmalı", en: "Radius must be 50–2000 m", de: "Der Radius muss 50–2000 m betragen", ru: "Радиус должен быть 50–2000 м" },
  maxEmpty: (n) => ({
    tr: `Boş sandalye 0-${n} olmalı`,
    en: `Empty seats must be 0–${n}`,
    de: `Leere Stühle müssen 0–${n} sein`,
    ru: `Свободных стульев должно быть 0–${n}`,
  }),
  maxGroup: (n) => ({
    tr: `Grup büyüklüğü 1-${n} kişi olmalı`,
    en: `Group size must be 1–${n} people`,
    de: `Die Gruppengröße muss 1–${n} Personen betragen`,
    ru: `Размер группы должен быть от 1 до ${n} человек`,
  }),

  // --- push bildirimi ---
  yourTurn: { tr: "Sıra size geldi!", en: "It's your turn!", de: "Sie sind dran!", ru: "Ваша очередь!" },
  tableReady: { tr: "Masanız hazır!", en: "Your table is ready!", de: "Ihr Tisch ist bereit!", ru: "Ваш столик готов!" },
  // "<sıra adı> · 47 numara · Masa 7. Görevliye gidip numaranızı gösterin."
  pushBody: (name, no, table) => ({
    tr: `${name} · ${no} numara${table ? ` · ${table}` : ""}. Görevliye gidip numaranızı gösterin.`,
    en: `${name} · No. ${no}${table ? ` · ${table}` : ""}. Go to the attendant and show your number.`,
    de: `${name} · Nr. ${no}${table ? ` · ${table}` : ""}. Gehen Sie zum Personal und zeigen Sie Ihre Nummer.`,
    ru: `${name} · № ${no}${table ? ` · ${table}` : ""}. Подойдите к сотруднику и покажите свой номер.`,
  }),
  table: tableNo,
  tableFor: (cap) => ({ tr: `${cap} kişilik masa`, en: `Table for ${cap}`, de: `Tisch für ${cap}`, ru: `Стол на ${cap}` }),
};

export function msg(lang, key, ...args) {
  const m = M[key];
  if (!m) return key;
  return (typeof m === "function" ? m(...args) : m)[langOf(lang)];
}

// web/src/lib/i18n.ts'teki tableLabel ile aynı
export const tableLabel = (t, lang) => (t.name ? msg(lang, "table", t.name) : msg(lang, "tableFor", t.cap));

// Çevrilebilir hata: throw fail("group", 8). Mesajı "§[\"group\",8]"; localize() isteğin dilinde metne çevirir.
export const fail = (key, ...args) => new Error(`§${JSON.stringify([key, ...args])}`);
export const failed = (e, key) => e.message.startsWith(`§["${key}"`);

export function localize(message, lang) {
  if (!message?.startsWith("§")) return message;
  try {
    const [key, ...args] = JSON.parse(message.slice(1));
    return msg(lang, key, ...args);
  } catch { return message; }
}
