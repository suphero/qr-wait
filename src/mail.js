// Hesap e-postaları: doğrulama, e-posta değiştirme (yeni adrese onay, eski adrese bildirim), şifre sıfırlama, bilet hakkı azaldı / bitti.
// Cloudflare Email Service (wrangler.jsonc send_email → EMAIL), gönderen MAIL_FROM.
// DEV=1 (yalnızca .dev.vars): bağlantılar günlüğe de yazılır, smoke testi doğrulama bağlantısını oradan okur.
import { langOf } from "./i18n.js";

const M = {
  verify: {
    tr: { subject: "E-posta adresinizi doğrulayın", body: (u) => `Merhaba ${u},\n\nQRWait hesabınızı etkinleştirmek için aşağıdaki bağlantıyı açın. Bağlantı 3 gün geçerli.`, button: "E-postamı doğrula", foot: "Bu hesabı siz açmadıysanız bu e-postayı yok sayın." },
    en: { subject: "Verify your email address", body: (u) => `Hi ${u},\n\nOpen the link below to activate your QRWait account. The link is valid for 3 days.`, button: "Verify my email", foot: "If you didn't create this account, ignore this email." },
    de: { subject: "Bestätigen Sie Ihre E-Mail-Adresse", body: (u) => `Hallo ${u},\n\nÖffnen Sie den folgenden Link, um Ihr QRWait-Konto zu aktivieren. Der Link ist 3 Tage gültig.`, button: "E-Mail bestätigen", foot: "Wenn Sie dieses Konto nicht erstellt haben, ignorieren Sie diese E-Mail." },
    ru: { subject: "Подтвердите адрес электронной почты", body: (u) => `Здравствуйте, ${u}!\n\nОткройте ссылку ниже, чтобы активировать учётную запись QRWait. Ссылка действует 3 дня.`, button: "Подтвердить почту", foot: "Если вы не создавали эту учётную запись, проигнорируйте письмо." },
  },
  email: {
    tr: { subject: "Yeni e-posta adresinizi onaylayın", body: (u) => `Merhaba ${u},\n\nQRWait hesabınızın e-posta adresini bu adres olarak değiştirmek için aşağıdaki bağlantıyı açın. Bağlantı 1 gün geçerli.`, button: "Adresi onayla", foot: "Bu değişikliği siz istemediyseniz bu e-postayı yok sayın, hesabın adresi değişmez." },
    en: { subject: "Confirm your new email address", body: (u) => `Hi ${u},\n\nOpen the link below to make this the email address of your QRWait account. The link is valid for 1 day.`, button: "Confirm address", foot: "If you didn't request this change, ignore this email; the account's address won't change." },
    de: { subject: "Bestätigen Sie Ihre neue E-Mail-Adresse", body: (u) => `Hallo ${u},\n\nÖffnen Sie den folgenden Link, um diese Adresse als E-Mail-Adresse Ihres QRWait-Kontos festzulegen. Der Link ist 1 Tag gültig.`, button: "Adresse bestätigen", foot: "Wenn Sie diese Änderung nicht angefordert haben, ignorieren Sie diese E-Mail; die Adresse des Kontos bleibt unverändert." },
    ru: { subject: "Подтвердите новый адрес почты", body: (u) => `Здравствуйте, ${u}!\n\nОткройте ссылку ниже, чтобы сделать этот адрес почтой учётной записи QRWait. Ссылка действует 1 день.`, button: "Подтвердить адрес", foot: "Если вы не запрашивали это изменение, проигнорируйте письмо — адрес учётной записи не изменится." },
  },
  // Eski adrese: hesabın adresi değişti; n yeni adres. Şifre sıfırlama artık yeni adrese gittiği için çare bize yazmak.
  changed: {
    tr: { subject: "Hesabınızın e-posta adresi değişti", body: (u, n) => `Merhaba ${u},\n\nQRWait hesabınızın e-posta adresi ${n} olarak değiştirildi. Bundan sonra hesap e-postaları o adrese gidecek.\n\nBu değişikliği siz yapmadıysanız hemen bize yazın.`, button: "Bize yazın" },
    en: { subject: "Your account's email address changed", body: (u, n) => `Hi ${u},\n\nThe email address of your QRWait account was changed to ${n}. Account emails will go to that address from now on.\n\nIf you didn't make this change, contact us right away.`, button: "Contact us" },
    de: { subject: "Die E-Mail-Adresse Ihres Kontos wurde geändert", body: (u, n) => `Hallo ${u},\n\nDie E-Mail-Adresse Ihres QRWait-Kontos wurde in ${n} geändert. Konto-E-Mails gehen ab jetzt an diese Adresse.\n\nWenn Sie das nicht waren, schreiben Sie uns sofort.`, button: "Kontakt aufnehmen" },
    ru: { subject: "Адрес почты учётной записи изменён", body: (u, n) => `Здравствуйте, ${u}!\n\nАдрес почты учётной записи QRWait изменён на ${n}. Теперь письма учётной записи будут приходить туда.\n\nЕсли это сделали не вы, сразу напишите нам.`, button: "Написать нам" },
  },
  reset: {
    tr: { subject: "Şifre sıfırlama", body: (u) => `Merhaba ${u},\n\nŞifrenizi sıfırlamak için aşağıdaki bağlantıyı açın. Bağlantı 1 saat geçerli ve bir kez kullanılabilir.`, button: "Yeni şifre belirle", foot: "Şifre sıfırlamayı siz istemediyseniz bu e-postayı yok sayın, şifreniz değişmez." },
    en: { subject: "Password reset", body: (u) => `Hi ${u},\n\nOpen the link below to reset your password. The link is valid for 1 hour and can be used once.`, button: "Set a new password", foot: "If you didn't request a reset, ignore this email; your password won't change." },
    de: { subject: "Passwort zurücksetzen", body: (u) => `Hallo ${u},\n\nÖffnen Sie den folgenden Link, um Ihr Passwort zurückzusetzen. Der Link ist 1 Stunde gültig und nur einmal verwendbar.`, button: "Neues Passwort festlegen", foot: "Wenn Sie das nicht angefordert haben, ignorieren Sie diese E-Mail; Ihr Passwort bleibt unverändert." },
    ru: { subject: "Сброс пароля", body: (u) => `Здравствуйте, ${u}!\n\nОткройте ссылку ниже, чтобы сбросить пароль. Ссылка действует 1 час и срабатывает один раз.`, button: "Задать новый пароль", foot: "Если вы не запрашивали сброс, проигнорируйте письмо — пароль не изменится." },
  },
  low: {
    tr: { subject: "Bilet hakkınız azaldı", body: (u, n) => `Merhaba ${u},\n\nHesabınızda ${n} bilet hakkı kaldı. Hak bitince sıralarınız yeni kişi almaz. Yönetim ekranından bilet paketi alabilirsiniz.`, button: "Bilet al" },
    en: { subject: "Your tickets are running low", body: (u, n) => `Hi ${u},\n\nYour account has ${n} tickets left. When they run out, your queues stop accepting new people. You can buy a ticket pack in the admin panel.`, button: "Buy tickets" },
    de: { subject: "Ihr Ticketguthaben wird knapp", body: (u, n) => `Hallo ${u},\n\nIhr Konto hat noch ${n} Tickets. Sind sie aufgebraucht, nehmen Ihre Warteschlangen niemanden mehr auf. Im Verwaltungsbereich können Sie ein Ticketpaket kaufen.`, button: "Tickets kaufen" },
    ru: { subject: "Билеты заканчиваются", body: (u, n) => `Здравствуйте, ${u}!\n\nНа вашем счёте осталось билетов: ${n}. Когда они закончатся, очереди перестанут принимать людей. Пакет билетов можно купить в панели управления.`, button: "Купить билеты" },
  },
  empty: {
    tr: { subject: "Bilet hakkınız bitti", body: (u) => `Merhaba ${u},\n\nHesabınızdaki bilet hakkı bitti; sıralarınız şu an yeni kişi almıyor. Bilet paketi aldığınızda sıralar hemen yeniden çalışır.`, button: "Bilet al" },
    en: { subject: "You're out of tickets", body: (u) => `Hi ${u},\n\nYour account is out of tickets; your queues aren't accepting new people right now. They start working again as soon as you buy a ticket pack.`, button: "Buy tickets" },
    de: { subject: "Ihr Ticketguthaben ist aufgebraucht", body: (u) => `Hallo ${u},\n\nIhr Ticketguthaben ist aufgebraucht; Ihre Warteschlangen nehmen derzeit niemanden auf. Sobald Sie ein Ticketpaket kaufen, funktionieren sie wieder.`, button: "Tickets kaufen" },
    ru: { subject: "Билеты закончились", body: (u) => `Здравствуйте, ${u}!\n\nБилеты на вашем счёте закончились — очереди сейчас не принимают людей. Они снова заработают сразу после покупки пакета.`, button: "Купить билеты" },
  },
};

// Kullanıcı adı NAME_RE'ye uyar, bağlantı bizim ürettiğimiz; yine de HTML'e kaçışlı girer
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

// kind: M'nin anahtarı; link: düğmenin açacağı adres; n: kalan bilet (low), yeni adres (changed)
export async function mail(env, { to, lang, kind, user, link, n }) {
  const t = M[kind][langOf(lang)], body = t.body(user, n);
  if (env.DEV === "1") console.log(`mail ${kind} → ${to}: ${link}`);
  if (!env.EMAIL) return;
  const text = `${body}\n\n${link}\n${t.foot ? `\n${t.foot}\n` : ""}\n— QRWait`;
  const html = `<div style="font-family:system-ui,sans-serif;font-size:16px;line-height:1.5;color:#1B2A4A;max-width:520px">
${body.split("\n\n").map((p) => `<p>${esc(p)}</p>`).join("\n")}
<p><a href="${esc(link)}" style="display:inline-block;background:#1B2A4A;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none">${esc(t.button)}</a></p>
<p style="font-size:13px;color:#666">${esc(link)}</p>
${t.foot ? `<p style="font-size:13px;color:#666">${esc(t.foot)}</p>` : ""}
<p>— QRWait</p></div>`;
  await env.EMAIL.send({ to, from: env.MAIL_FROM, subject: t.subject, text, html });
}
