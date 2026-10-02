import type { ReactNode } from "react";
import { LEGAL, LegalPage, Mail, siteUrl, type Section } from "@/components/legal";
import { pick } from "@/lib/i18n";
import { mount } from "@/lib/mount";

// Gizlilik Politikası / KVKK Aydınlatma Metni. İçerik src/ altındaki gerçek veri akışına göre yazıldı:
// yeni bir alan ya da hizmet sağlayıcı eklenirse dört dilde de güncellenmeli.

// Çerez kararını sıfırlar; sayfa yenilenince bildirim yeniden çıkar (lib/mount.tsx)
const Reset = ({ children }: { children: ReactNode }) => (
  <button type="button" className="underline" onClick={() => { try { localStorage.removeItem("consent"); } catch {} location.reload(); }}>{children}</button>
);
const Terms = ({ children }: { children: ReactNode }) => <a href={siteUrl("/terms")}>{children}</a>;

const S: Section[] = pick<Section[]>({
  tr: [
    { h: "Kapsam", p: [<>Bu metin, 6698 sayılı Kişisel Verilerin Korunması Kanunu ("KVKK") ve AB Genel Veri Koruma Tüzüğü ("GDPR") kapsamında, QRWait (qrwait.app) hizmetinde kişisel verilerin nasıl işlendiğini açıklar.</>] },
    { h: "Veri sorumlusu", p: [
      <>Hesap sahiplerinin verileri bakımından veri sorumlusu QRWait'tir. İletişim: <Mail /></>,
      <>QRWait ile sıra kuran işletmeler (hesap sahipleri), kendi sıralarına giren ziyaretçilerin verileri bakımından veri sorumlusudur; QRWait bu verileri işletme adına, yalnızca hizmetin çalışması için işleyen <b>veri işleyen</b> konumundadır.</>,
    ] },
    { h: "Sıraya giren ziyaretçilerin verileri", ul: [
      <><b>Sıra kaydı:</b> grup büyüklüğü, kabul edilen yer sayıları, sıra numarası, giriş ve çağrılma zamanı, arayüz dili.</>,
      <><b>Cihaz kimliği:</b> tarayıcınızda üretilen rastgele bir kimlik; aynı telefonla ikinci numara alınmasını önler. Adınızla ya da telefon numaranızla ilişkili değildir.</>,
      <><b>Konum:</b> sıra konum kontrolü kullanıyorsa yalnızca sıraya girerken, sıranın alanında ya da görevlinin yakınında olduğunuzu doğrulamak için o anda kullanılır. <b>Konumunuz saklanmaz.</b></>,
      <><b>Bildirim aboneliği:</b> "sıra size geldi" bildirimine izin verirseniz tarayıcınızın bildirim adresi.</>,
      <><b>Görevli notu:</b> görevli sizi elle eklerse yazdığı kısa not.</>,
      <>Ziyaretçilerden ad, telefon numarası ya da e-posta adresi istenmez.</>,
    ] },
    { h: "Hesap sahiplerinin verileri", ul: [
      <><b>Hesap:</b> kullanıcı adı, e-posta adresi, dil tercihi, kullanım koşullarının kabul edildiği sürüm ve zaman, siteye ilk geldiğiniz kaynak (kampanya etiketi ya da sizi yönlendiren site) ve sayfa.</>,
      <><b>Şifre:</b> yalnızca geri döndürülemeyen özeti (PBKDF2) saklanır. Şifrenin bilinen veri sızıntılarında geçip geçmediği, özetin yalnızca ilk 5 karakteri gönderilerek (k-anonimlik) kontrol edilir; şifre ya da tam özet hiçbir yere gönderilmez.</>,
      <><b>Sıralar:</b> sıra adı, adresi, konumu ve ayarları. Konum kontrolü görevlinin konumuna göre yapılan sıralarda, görevli panelinin gönderdiği son konum (yalnızca en sonuncusu, kontrol için). Günlük istatistikler yalnızca sayılardan oluşur (kaç grup katıldı, çağrıldı, ortalama bekleme), ziyaretçiye ait bilgi içermez.</>,
      <><b>Kullanım ve ödeme kayıtları:</b> kullanılan ve kalan bilet sayısı, sipariş numarası, paket ve tutar. Kart bilgileriniz bize ulaşmaz; ödemeyi Lemon Squeezy alır.</>,
    ] },
    { h: "Tüm ziyaretçiler", ul: [
      <><b>Teknik veriler:</b> IP adresi, tarayıcı bilgisi ve istek kayıtları; güvenlik, istek sınırı ve kötüye kullanımın önlenmesi için.</>,
      <><b>Bot doğrulaması:</b> hesap açma ve şifre sıfırlama formlarında Cloudflare Turnstile.</>,
      <><b>Analitik:</b> yalnızca izin verirseniz Google Analytics ile kullanım istatistikleri.</>,
    ] },
    { h: "Amaçlar ve hukuki sebepler", ul: [
      <>Sıra hizmeti, hesap yönetimi, bilet takibi ve ödemelerin hesaba yansıtılması: sözleşmenin kurulması ve ifası (KVKK m. 5/2-c; GDPR m. 6/1-b).</>,
      <>Güvenlik, sahte kayıt ve kötüye kullanımın önlenmesi, hesap doğrulama, hangi tanıtım kanalının işe yaradığını ölçmek: meşru menfaat (KVKK m. 5/2-f; GDPR m. 6/1-f).</>,
      <>Yasal yükümlülükler ve yetkili makam talepleri: hukuki yükümlülük (KVKK m. 5/2-ç; GDPR m. 6/1-c).</>,
      <>Analitik çerezler: açık rıza (KVKK m. 5/1; GDPR m. 6/1-a); dilediğiniz zaman geri alabilirsiniz.</>,
    ] },
    { h: "Aktarım ve yurt dışına aktarım", ul: [
      <><b>Cloudflare, Inc. (ABD):</b> barındırma, depolama, e-posta gönderimi, bot doğrulaması, güvenlik.</>,
      <><b>Lemon Squeezy, LLC (ABD):</b> ödeme ve faturalama. Satıcı (merchant of record) Lemon Squeezy'dir; ödeme verileri onun gizlilik politikasına tabidir.</>,
      <><b>Google LLC (ABD):</b> yalnızca izin verirseniz analitik.</>,
      <><b>OpenStreetMap Vakfı (Birleşik Krallık):</b> harita görüntüleri ve yönetim ekranındaki adres araması.</>,
      <><b>Sırayı işleten işletme:</b> sıra kaydınız işletmenin görevli ekranında görünür.</>,
      <>Yurt dışına aktarım KVKK m. 9 kapsamında standart sözleşmeler ya da ilgili istisnalar çerçevesinde yapılır. Verileriniz satılmaz, reklam amacıyla paylaşılmaz.</>,
    ] },
    { h: "Saklama süreleri", ul: [
      <><b>Sıra kaydı:</b> görevli "geldi" ya da "çıkar" olarak işaretleyene, siz sıradan ayrılana ya da işletme sırayı sıfırlayana kadar; bildirim aboneliği kayıtla birlikte silinir.</>,
      <><b>Hesap:</b> hesap silinene kadar. E-postası 7 gün içinde doğrulanmayan hesaplar otomatik silinir.</>,
      <><b>Doğrulama ve şifre sıfırlama bağlantıları:</b> 3 gün ve 1 saat; kullanılınca silinir.</>,
      <><b>Başarısız giriş sayaçları:</b> en fazla 1 gün. <b>Teknik kayıtlar:</b> hizmet sağlayıcının kayıt süresince, genellikle birkaç gün.</>,
    ] },
    { h: "Çerezler ve tarayıcıda saklanan bilgiler", ul: [
      <><b>Zorunlu:</b> oturum anahtarı, cihaz kimliği ve sıra numaranız tarayıcının yerel deposunda (localStorage) tutulur; bunlar olmadan hizmet çalışmaz. Dil seçerseniz tercihiniz bir "lang" çerezinde saklanır, böylece işletmelerin adreslerinde de aynı dil açılır.</>,
      <><b>Analitik (isteğe bağlı):</b> Google Analytics çerezleri yalnızca çerez bildiriminde izin verirseniz kullanılır. Kararınızı <Reset>buradan değiştirebilirsiniz</Reset>.</>,
    ] },
    { h: "Haklarınız", p: [
      <>KVKK m. 11 ve GDPR kapsamında verilerinize erişme, bilgi isteme, düzeltme, silme, işlemeyi kısıtlama, itiraz etme, verilerinizi taşınabilir biçimde alma ve zararın giderilmesini isteme haklarına sahipsiniz.</>,
      <>Başvurularınızı <Mail /> adresine iletebilirsiniz; en geç 30 gün içinde yanıtlanır. Hesap sahipleri hesaplarını yönetim ekranından kendileri silebilir. Bir sıraya ilişkin ziyaretçi talepleri, veri sorumlusu olan işletmeye iletilir. Kişisel Verileri Koruma Kurulu'na ya da bulunduğunuz AB ülkesinin veri koruma otoritesine şikâyet hakkınız saklıdır.</>,
    ] },
    { h: "Güvenlik", p: [<>Tüm bağlantılar şifrelidir (HTTPS). Şifreler geri döndürülemez biçimde saklanır, giriş denemeleri sınırlanır, e-posta bağlantıları tek kullanımlıktır ve yalnızca özetleri saklanır.</>] },
    { h: "Değişiklikler", p: [<>Bu metin güncellenebilir; önemli değişiklikler hesap sahiplerine e-postayla bildirilir. Hizmet kuralları için <Terms>Kullanım Koşulları</Terms>'na bakın.</>] },
  ],
  en: [
    { h: "Scope", p: [<>This notice explains how personal data is processed in the QRWait service (qrwait.app) under Turkish Law No. 6698 on the Protection of Personal Data ("KVKK") and the EU General Data Protection Regulation ("GDPR").</>] },
    { h: "Data controller", p: [
      <>QRWait is the controller of account holders' data. Contact: <Mail /></>,
      <>Businesses that set up queues with QRWait (account holders) are the controllers of the data of visitors joining their queues; QRWait acts as a <b>processor</b>, handling that data on the business's behalf solely to run the service.</>,
    ] },
    { h: "Data of visitors joining a queue", ul: [
      <><b>Queue entry:</b> group size, accepted numbers of places, queue number, time of joining and being called, interface language.</>,
      <><b>Device ID:</b> a random identifier generated in your browser to prevent a second number from the same phone. It is not linked to your name or phone number.</>,
      <><b>Location:</b> if the queue uses a location check, used only at the moment you join, to check that you are at the queue's location or near the attendant. <b>Your location is not stored.</b></>,
      <><b>Notification subscription:</b> your browser's push address, if you allow "it's your turn" notifications.</>,
      <><b>Attendant note:</b> a short note if the attendant adds you manually.</>,
      <>Visitors are never asked for their name, phone number or email address.</>,
    ] },
    { h: "Data of account holders", ul: [
      <><b>Account:</b> username, email address, language, the version and time you accepted the terms of use, and how you first reached the site (campaign tag or referring site) and the page you landed on.</>,
      <><b>Password:</b> only an irreversible hash (PBKDF2) is stored. Whether a password appears in known data breaches is checked by sending only the first 5 characters of its hash (k-anonymity); the password or full hash is never sent anywhere.</>,
      <><b>Queues:</b> queue name, address, location and settings. For queues that check location against the attendant, the last location sent by the attendant panel (only the latest one, for the check). Daily statistics are counts only (how many groups joined, were called, average wait) and contain no visitor information.</>,
      <><b>Usage and payment records:</b> tickets used and remaining, order number, pack and amount. Your card details never reach us; payment is taken by Lemon Squeezy.</>,
    ] },
    { h: "All visitors", ul: [
      <><b>Technical data:</b> IP address, browser information and request logs, for security, rate limiting and abuse prevention.</>,
      <><b>Bot check:</b> Cloudflare Turnstile on the sign-up and password reset forms.</>,
      <><b>Analytics:</b> usage statistics with Google Analytics, only if you consent.</>,
    ] },
    { h: "Purposes and legal bases", ul: [
      <>Providing the queue service, managing accounts, tracking tickets and crediting payments: performance of a contract (KVKK Art. 5/2-c; GDPR Art. 6/1-b).</>,
      <>Security, preventing fake sign-ups and abuse, account verification, measuring which marketing channels work: legitimate interests (KVKK Art. 5/2-f; GDPR Art. 6/1-f).</>,
      <>Legal obligations and requests from authorities: legal obligation (KVKK Art. 5/2-ç; GDPR Art. 6/1-c).</>,
      <>Analytics cookies: consent (KVKK Art. 5/1; GDPR Art. 6/1-a), which you can withdraw at any time.</>,
    ] },
    { h: "Recipients and international transfers", ul: [
      <><b>Cloudflare, Inc. (USA):</b> hosting, storage, email delivery, bot checks, security.</>,
      <><b>Lemon Squeezy, LLC (USA):</b> payments and invoicing. Lemon Squeezy is the merchant of record; payment data is subject to its privacy policy.</>,
      <><b>Google LLC (USA):</b> analytics, only with your consent.</>,
      <><b>OpenStreetMap Foundation (UK):</b> map tiles and address search in the admin panel.</>,
      <><b>The business running the queue:</b> your entry is shown on its attendant screen.</>,
      <>International transfers rely on standard contractual clauses or applicable exceptions (KVKK Art. 9; GDPR Chapter V). Your data is never sold or shared for advertising.</>,
    ] },
    { h: "Retention", ul: [
      <><b>Queue entry:</b> until the attendant marks you as arrived or removes you, you leave the queue, or the business resets the queue; the push subscription is deleted with it.</>,
      <><b>Account:</b> until the account is deleted. Accounts whose email isn't verified within 7 days are deleted automatically.</>,
      <><b>Verification and password reset links:</b> 3 days and 1 hour; deleted once used.</>,
      <><b>Failed login counters:</b> at most 1 day. <b>Technical logs:</b> for the provider's log period, usually a few days.</>,
    ] },
    { h: "Cookies and browser storage", ul: [
      <><b>Essential:</b> your session key, device ID and queue number are kept in your browser's local storage; the service can't work without them. If you choose a language, it's kept in a "lang" cookie so businesses' addresses open in the same language.</>,
      <><b>Analytics (optional):</b> Google Analytics cookies are used only if you accept them in the cookie notice. You can <Reset>change your choice here</Reset>.</>,
    ] },
    { h: "Your rights", p: [
      <>Under KVKK Art. 11 and the GDPR you have the right to access, rectify and erase your data, restrict or object to processing, receive your data in a portable format, and seek compensation for damages.</>,
      <>Send requests to <Mail />; we reply within 30 days. Account holders can delete their account themselves in the admin panel. Visitor requests about a queue are forwarded to the business that controls it. You may also complain to the Turkish Personal Data Protection Authority or the data protection authority of your EU country.</>,
    ] },
    { h: "Security", p: [<>All connections are encrypted (HTTPS). Passwords are stored irreversibly, login attempts are limited, and email links are single-use with only their hashes stored.</>] },
    { h: "Changes", p: [<>We may update this notice; account holders are informed of significant changes by email. See the <Terms>Terms of Use</Terms> for the rules of the service.</>] },
  ],
  de: [
    { h: "Geltungsbereich", p: [<>Diese Erklärung beschreibt, wie im Dienst QRWait (qrwait.app) personenbezogene Daten gemäß dem türkischen Datenschutzgesetz Nr. 6698 („KVKK“) und der EU-Datenschutz-Grundverordnung („DSGVO“) verarbeitet werden.</>] },
    { h: "Verantwortlicher", p: [
      <>Für die Daten der Kontoinhaber ist QRWait verantwortlich. Kontakt: <Mail /></>,
      <>Betriebe, die mit QRWait Warteschlangen einrichten (Kontoinhaber), sind für die Daten der Besucher ihrer Warteschlangen verantwortlich; QRWait verarbeitet diese Daten als <b>Auftragsverarbeiter</b> im Auftrag des Betriebs und nur zum Betrieb des Dienstes.</>,
    ] },
    { h: "Daten von Besuchern einer Warteschlange", ul: [
      <><b>Eintrag:</b> Gruppengröße, akzeptierte Platzanzahlen, Nummer, Zeitpunkt des Eintritts und des Aufrufs, Sprache.</>,
      <><b>Geräte-ID:</b> eine in Ihrem Browser erzeugte Zufallskennung, die eine zweite Nummer vom selben Telefon verhindert. Sie ist nicht mit Ihrem Namen oder Ihrer Telefonnummer verknüpft.</>,
      <><b>Standort:</b> wird, falls die Warteschlange eine Standortprüfung nutzt, nur beim Eintritt verwendet, um zu prüfen, dass Sie am Ort der Warteschlange oder in der Nähe des Personals sind. <b>Ihr Standort wird nicht gespeichert.</b></>,
      <><b>Benachrichtigungsabo:</b> die Push-Adresse Ihres Browsers, wenn Sie „Sie sind dran“-Benachrichtigungen erlauben.</>,
      <><b>Notiz des Personals:</b> eine kurze Notiz, wenn das Personal Sie manuell hinzufügt.</>,
      <>Besucher werden nie nach Name, Telefonnummer oder E-Mail-Adresse gefragt.</>,
    ] },
    { h: "Daten der Kontoinhaber", ul: [
      <><b>Konto:</b> Benutzername, E-Mail-Adresse, Sprache, Version und Zeitpunkt der Zustimmung zu den Nutzungsbedingungen sowie die Quelle Ihres ersten Besuchs (Kampagnen-Tag oder verweisende Website) und die Einstiegsseite.</>,
      <><b>Passwort:</b> gespeichert wird nur ein nicht umkehrbarer Hash (PBKDF2). Ob ein Passwort in bekannten Datenlecks vorkommt, wird geprüft, indem nur die ersten 5 Zeichen seines Hashes gesendet werden (k-Anonymität); Passwort oder vollständiger Hash werden nie übermittelt.</>,
      <><b>Warteschlangen:</b> Name, Adresse, Standort und Einstellungen. Bei Warteschlangen, die den Standort des Personals prüfen, der zuletzt vom Personal-Panel gesendete Standort (nur der jeweils letzte, für die Prüfung). Tägliche Statistiken bestehen nur aus Zahlen (wie viele Gruppen sich angestellt haben, aufgerufen wurden, durchschnittliche Wartezeit) und enthalten keine Besucherdaten.</>,
      <><b>Nutzungs- und Zahlungsdaten:</b> verbrauchte und verbleibende Tickets, Bestellnummer, Paket und Betrag. Ihre Kartendaten erreichen uns nicht; die Zahlung wickelt Lemon Squeezy ab.</>,
    ] },
    { h: "Alle Besucher", ul: [
      <><b>Technische Daten:</b> IP-Adresse, Browserinformationen und Anfrageprotokolle zur Sicherheit, Begrenzung von Anfragen und Missbrauchsabwehr.</>,
      <><b>Bot-Prüfung:</b> Cloudflare Turnstile in den Formularen zur Registrierung und zum Zurücksetzen des Passworts.</>,
      <><b>Analyse:</b> Nutzungsstatistiken mit Google Analytics, nur mit Ihrer Einwilligung.</>,
    ] },
    { h: "Zwecke und Rechtsgrundlagen", ul: [
      <>Bereitstellung des Dienstes, Kontoverwaltung, Ticketverwaltung und Gutschrift von Zahlungen: Vertragserfüllung (KVKK Art. 5/2-c; DSGVO Art. 6 Abs. 1 lit. b).</>,
      <>Sicherheit, Verhinderung von Scheinregistrierungen und Missbrauch, Kontobestätigung, Messung, welche Marketingkanäle wirken: berechtigte Interessen (KVKK Art. 5/2-f; DSGVO Art. 6 Abs. 1 lit. f).</>,
      <>Gesetzliche Pflichten und behördliche Anfragen: rechtliche Verpflichtung (KVKK Art. 5/2-ç; DSGVO Art. 6 Abs. 1 lit. c).</>,
      <>Analyse-Cookies: Einwilligung (KVKK Art. 5/1; DSGVO Art. 6 Abs. 1 lit. a), jederzeit widerrufbar.</>,
    ] },
    { h: "Empfänger und Übermittlung in Drittländer", ul: [
      <><b>Cloudflare, Inc. (USA):</b> Hosting, Speicherung, E-Mail-Versand, Bot-Prüfung, Sicherheit.</>,
      <><b>Lemon Squeezy, LLC (USA):</b> Zahlung und Rechnungsstellung. Lemon Squeezy ist Verkäufer (Merchant of Record); für Zahlungsdaten gilt dessen Datenschutzerklärung.</>,
      <><b>Google LLC (USA):</b> Analyse, nur mit Einwilligung.</>,
      <><b>OpenStreetMap Foundation (Vereinigtes Königreich):</b> Kartenkacheln und Adresssuche im Verwaltungsbereich.</>,
      <><b>Der Betrieb der Warteschlange:</b> Ihr Eintrag erscheint auf dessen Personalbildschirm.</>,
      <>Übermittlungen in Drittländer stützen sich auf Standardvertragsklauseln oder anwendbare Ausnahmen (KVKK Art. 9; DSGVO Kapitel V). Ihre Daten werden nie verkauft oder für Werbung weitergegeben.</>,
    ] },
    { h: "Speicherdauer", ul: [
      <><b>Eintrag:</b> bis das Personal Sie als angekommen markiert oder entfernt, Sie die Warteschlange verlassen oder der Betrieb sie zurücksetzt; das Benachrichtigungsabo wird mit gelöscht.</>,
      <><b>Konto:</b> bis zur Löschung. Konten, deren E-Mail nicht innerhalb von 7 Tagen bestätigt wird, werden automatisch gelöscht.</>,
      <><b>Bestätigungs- und Zurücksetzungslinks:</b> 3 Tage bzw. 1 Stunde; nach Nutzung gelöscht.</>,
      <><b>Zähler fehlgeschlagener Anmeldungen:</b> höchstens 1 Tag. <b>Technische Protokolle:</b> für die Protokolldauer des Anbieters, meist einige Tage.</>,
    ] },
    { h: "Cookies und Browserspeicher", ul: [
      <><b>Notwendig:</b> Sitzungsschlüssel, Geräte-ID und Ihre Nummer werden im lokalen Speicher des Browsers gehalten; ohne sie funktioniert der Dienst nicht. Wählen Sie eine Sprache, wird sie in einem „lang“-Cookie gespeichert, damit auch die Adressen der Betriebe in dieser Sprache öffnen.</>,
      <><b>Analyse (optional):</b> Google-Analytics-Cookies werden nur verwendet, wenn Sie im Cookie-Hinweis zustimmen. Sie können Ihre <Reset>Entscheidung hier ändern</Reset>.</>,
    ] },
    { h: "Ihre Rechte", p: [
      <>Nach KVKK Art. 11 und der DSGVO haben Sie das Recht auf Auskunft, Berichtigung, Löschung, Einschränkung der Verarbeitung, Widerspruch, Datenübertragbarkeit und Schadensersatz.</>,
      <>Anfragen richten Sie an <Mail />; wir antworten innerhalb von 30 Tagen. Kontoinhaber können ihr Konto im Verwaltungsbereich selbst löschen. Besucheranfragen zu einer Warteschlange leiten wir an den verantwortlichen Betrieb weiter. Sie können sich außerdem bei der türkischen Datenschutzbehörde oder der Datenschutzaufsichtsbehörde Ihres EU-Landes beschweren.</>,
    ] },
    { h: "Sicherheit", p: [<>Alle Verbindungen sind verschlüsselt (HTTPS). Passwörter werden nicht umkehrbar gespeichert, Anmeldeversuche begrenzt, E-Mail-Links sind nur einmal verwendbar und nur als Hash gespeichert.</>] },
    { h: "Änderungen", p: [<>Wir können diese Erklärung aktualisieren; über wesentliche Änderungen informieren wir Kontoinhaber per E-Mail. Die Regeln des Dienstes finden Sie in den <Terms>Nutzungsbedingungen</Terms>.</>] },
  ],
  ru: [
    { h: "Сфера действия", p: [<>Этот документ описывает, как сервис QRWait (qrwait.app) обрабатывает персональные данные в соответствии с турецким Законом № 6698 о защите персональных данных («KVKK») и Общим регламентом ЕС по защите данных («GDPR»).</>] },
    { h: "Оператор данных", p: [
      <>Оператором данных владельцев учётных записей является QRWait. Контакт: <Mail /></>,
      <>Предприятия, создающие очереди в QRWait (владельцы учётных записей), являются операторами данных посетителей своих очередей; QRWait выступает <b>обработчиком</b> и обрабатывает эти данные от имени предприятия только для работы сервиса.</>,
    ] },
    { h: "Данные посетителей очереди", ul: [
      <><b>Запись в очереди:</b> размер группы, подходящее количество мест, номер, время записи и вызова, язык интерфейса.</>,
      <><b>Идентификатор устройства:</b> случайный идентификатор, созданный в вашем браузере, чтобы с одного телефона нельзя было взять второй номер. Он не связан с вашим именем или номером телефона.</>,
      <><b>Местоположение:</b> если очередь проверяет местоположение, используется только в момент записи, чтобы проверить, что вы находитесь у очереди или рядом с сотрудником. <b>Местоположение не сохраняется.</b></>,
      <><b>Подписка на уведомления:</b> push-адрес браузера, если вы разрешили уведомления «ваша очередь».</>,
      <><b>Заметка сотрудника:</b> короткая заметка, если сотрудник добавил вас вручную.</>,
      <>У посетителей не запрашиваются имя, номер телефона или адрес электронной почты.</>,
    ] },
    { h: "Данные владельцев учётных записей", ul: [
      <><b>Учётная запись:</b> имя пользователя, адрес почты, язык, версия и время принятия условий использования, а также откуда вы впервые пришли на сайт (метка кампании или ссылающийся сайт) и на какую страницу.</>,
      <><b>Пароль:</b> хранится только необратимый хеш (PBKDF2). Наличие пароля в известных утечках проверяется отправкой лишь первых 5 символов хеша (k-анонимность); пароль и полный хеш никуда не передаются.</>,
      <><b>Очереди:</b> название, адрес, местоположение и настройки. Для очередей с проверкой по местоположению сотрудника — последнее местоположение, отправленное панелью сотрудника (только последнее, для проверки). Ежедневная статистика содержит только числа (сколько групп встало, было вызвано, среднее ожидание) и не содержит данных посетителей.</>,
      <><b>Данные об использовании и оплате:</b> использованные и оставшиеся билеты, номер заказа, пакет и сумма. Данные карты к нам не попадают — оплату принимает Lemon Squeezy.</>,
    ] },
    { h: "Все посетители", ul: [
      <><b>Технические данные:</b> IP-адрес, сведения о браузере и журналы запросов — для безопасности, ограничения частоты запросов и защиты от злоупотреблений.</>,
      <><b>Проверка на робота:</b> Cloudflare Turnstile в формах регистрации и сброса пароля.</>,
      <><b>Аналитика:</b> статистика использования через Google Analytics — только с вашего согласия.</>,
    ] },
    { h: "Цели и правовые основания", ul: [
      <>Работа сервиса очередей, управление учётной записью, учёт билетов и зачисление оплат: исполнение договора (KVKK ст. 5/2-c; GDPR ст. 6/1-b).</>,
      <>Безопасность, предотвращение фиктивных регистраций и злоупотреблений, подтверждение учётной записи, оценка эффективности рекламных каналов: законный интерес (KVKK ст. 5/2-f; GDPR ст. 6/1-f).</>,
      <>Исполнение закона и запросы уполномоченных органов: юридическая обязанность (KVKK ст. 5/2-ç; GDPR ст. 6/1-c).</>,
      <>Аналитические cookie: согласие (KVKK ст. 5/1; GDPR ст. 6/1-a), которое можно отозвать в любой момент.</>,
    ] },
    { h: "Получатели и трансграничная передача", ul: [
      <><b>Cloudflare, Inc. (США):</b> хостинг, хранение, отправка писем, проверка на робота, безопасность.</>,
      <><b>Lemon Squeezy, LLC (США):</b> оплата и выставление счетов. Продавцом (merchant of record) выступает Lemon Squeezy; платёжные данные регулируются его политикой конфиденциальности.</>,
      <><b>Google LLC (США):</b> аналитика — только с вашего согласия.</>,
      <><b>OpenStreetMap Foundation (Великобритания):</b> карты и поиск адреса в панели управления.</>,
      <><b>Предприятие, ведущее очередь:</b> ваша запись видна на экране сотрудника.</>,
      <>Трансграничная передача осуществляется на основе стандартных договорных условий или применимых исключений (KVKK ст. 9; GDPR глава V). Ваши данные не продаются и не передаются для рекламы.</>,
    ] },
    { h: "Сроки хранения", ul: [
      <><b>Запись в очереди:</b> пока сотрудник не отметит, что вы пришли, или не удалит вас, пока вы не покинете очередь или предприятие её не сбросит; подписка на уведомления удаляется вместе с записью.</>,
      <><b>Учётная запись:</b> до удаления. Учётные записи, почта которых не подтверждена за 7 дней, удаляются автоматически.</>,
      <><b>Ссылки подтверждения и сброса пароля:</b> 3 дня и 1 час; удаляются после использования.</>,
      <><b>Счётчики неудачных входов:</b> не более 1 дня. <b>Технические журналы:</b> в течение срока хранения у поставщика, обычно несколько дней.</>,
    ] },
    { h: "Cookie и хранилище браузера", ul: [
      <><b>Необходимые:</b> ключ сеанса, идентификатор устройства и ваш номер хранятся в локальном хранилище браузера; без них сервис не работает. Если вы выберете язык, он сохраняется в файле cookie «lang», чтобы адреса заведений открывались на том же языке.</>,
      <><b>Аналитика (по желанию):</b> cookie Google Analytics используются, только если вы согласились в уведомлении о cookie. <Reset>Изменить выбор</Reset>.</>,
    ] },
    { h: "Ваши права", p: [
      <>Согласно ст. 11 KVKK и GDPR вы вправе получить доступ к своим данным, исправить или удалить их, ограничить обработку или возразить против неё, получить данные в переносимом формате и потребовать возмещения ущерба.</>,
      <>Направляйте запросы на <Mail />; мы отвечаем в течение 30 дней. Владельцы учётных записей могут сами удалить учётную запись в панели управления. Запросы посетителей об очереди передаются предприятию-оператору. Вы также можете подать жалобу в турецкое Управление по защите персональных данных или в надзорный орган своей страны ЕС.</>,
    ] },
    { h: "Безопасность", p: [<>Все соединения зашифрованы (HTTPS). Пароли хранятся необратимо, попытки входа ограничены, ссылки из писем одноразовые и хранятся только в виде хешей.</>] },
    { h: "Изменения", p: [<>Мы можем обновлять этот документ; о существенных изменениях владельцы учётных записей узнают по почте. Правила сервиса — в <Terms>Условиях использования</Terms>.</>] },
  ],
});

mount(<LegalPage title={LEGAL.privacy} sections={S} />);
