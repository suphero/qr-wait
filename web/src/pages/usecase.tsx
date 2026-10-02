import { CheckIcon } from "lucide-react";
import { EMAIL } from "@/components/legal";
import { H2, pill, Section, Site, solid, USES, type Use } from "@/components/site";
import { Button } from "@/components/ui/button";
import { basePath, pick, sitePath } from "@/lib/i18n";
import { mount } from "@/lib/mount";
import { cn } from "@/lib/utils";
import "./home.css";

// Kullanım senaryosu sayfaları (/restaurant-waitlist, /beach-queue, /event-queue, /service-desk-queue): hepsi bu modülü yükler,
// içerik adresten seçilir. Her birinin HTML'i ve arama motoru etiketleri vite.config.ts PAGES'te; adresler src/index.js RESERVED'da.
// Buradaki özellikler README'deki ve görevli panelindeki davranışla aynı kalmalı.
type Pair = [string, string];
type Page = { title: string; h1: string; intro: string; steps: Pair[]; features: Pair[]; faq: Pair[] };

const T = pick<{
  signup: string; freeNote: string; pricing: string;
  stepsTitle: string; featuresTitle: string; faqTitle: string; othersTitle: string; contactTitle: string; contactText: string;
  pages: Record<Use, Page>;
}>({
  tr: {
    signup: "Ücretsiz hesap aç",
    freeNote: "Sıranızı birkaç dakikada kurun. İlk 1000 bilet ücretsiz, kredi kartı gerekmez.",
    pricing: "Fiyatları gör",
    stepsTitle: "Nasıl çalışır",
    featuresTitle: "Neler var",
    faqTitle: "Sorular",
    othersTitle: "Diğer kullanımlar",
    contactTitle: "Kurulumda yardım ister misiniz?",
    contactText: "Yazın, ilk sıranızı birlikte kuralım.",
    pages: {
      "restaurant-waitlist": {
        title: "QR kodlu restoran bekleme listesi · QRWait",
        h1: "Misafirlerinizin QR kodla girdiği bekleme listesi.",
        intro: "Misafir kapıdaki kodu okutur, kaç kişi olduğunu seçer ve gezmeye çıkar. Ona uygun masa boşalınca telefonu haber verir. Uygulama yok, çağrı cihazı yok, salona isim bağırmak yok.",
        steps: [
          ["Kapıda QR kodu okutur", "Açılan sayfada kaç kişi olduğunu seçer. Uygulama indirmez, hesap açmaz."],
          ["Siz masayı boşaltırsınız", "Masanın kaç kişilik olduğunu girersiniz. Bekleyenlerden masaya sığan ilk grup kendiliğinden çağrılır."],
          ["Telefonu haber verir", "Ekran yeşile döner, telefon titrer. Numarasını gösterir, masaya geçer."],
        ],
        features: [
          ["Masaya göre çağırma", "2 kişilik masa 6 kişilik gruba verilmez. Bir masada en fazla kaç sandalye boş kalabileceğini de belirleyebilirsiniz."],
          ["Birleştirilen masalar", "İki masayı birleştirip toplam kişi sayısını girin, sıra daha büyük bir grubu eşleştirsin."],
          ["Gelme süresi", "Çağrılan misafire gelmesi için 3 ile 30 dakika arası süre verin. Gelmezse masa sıradaki gruba geçer."],
          ["Tahmini bekleme", "Misafir, masaların ne hızla boşaldığına göre tahmini bekleme süresini görür. Sırasına iki grup kala bildirim alır."],
          ["Basılı ya da ekranda", "Karşılama masasındaki tablette sürekli yenilenen bir QR kod gösterin ya da kapıya sabit bir kod basıp asın."],
          ["Günlük istatistik", "Gelen ve oturan grup, gelmeyenler, ortalama bekleme ve yoğun saatler. CSV olarak indirilir; yalnızca sayılar, kişisel veri yok."],
        ],
        faq: [
          ["Misafirin uygulama indirmesi gerekir mi?", "Hayır. Kod okutulunca bekleme listesi telefonun tarayıcısında açılır."],
          ["Akıllı telefonu olmayan misafir ne yapacak?", "Karşılama görevlisi onu tek dokunuşla listeye ekler ve numarasını söyler."],
          ["Ücreti ne kadar?", "İlk 1000 bilet ücretsiz. Sonrasında tek seferlik bilet paketleri alırsınız; abonelik yoktur."],
        ],
      },
      "beach-queue": {
        title: "Plaj ve havuz için şezlong sırası · QRWait",
        h1: "Sabah koşturması olmadan adil şezlong sırası.",
        intro: "Plaj ya da havuz dolduğunda ziyaretçi QR kodu okutur ve girişte dikilmek yerine gölgede bekler. Şezlong boşaldıkça sıradaki gruplar telefonlarından çağrılır.",
        steps: [
          ["Girişte okutur", "Kaç kişi olduğunu ve kaç şezlonga razı olacağını seçer."],
          ["Yakında istediği yerde bekler", "Sırasını anlık takip eder. Denize girerken ya da bir şey içerken sırasını kimse kapmaz."],
          ["Çağrılınca gelir", "Şezlong boşalınca sıradaki grupların telefonu titrer, numaralarını gösterirler."],
        ],
        features: [
          ["Boşalan yere göre çağırma", "Kaç şezlong boşaldığını girin, sıradaki gruplar kendiliğinden çağrılsın."],
          ["Esnek gruplar", "4 kişilik bir grup 2 şezlonga razı olduğunu söyleyebilir, yerler boş kalmaz. İsterseniz sığan küçük gruplar öne alınır."],
          ["Otel odasından sıraya girilmez", "Telefonun konumu sıranın yakınında olmalı: sabit bir nokta ya da görevlinin anlık konumu."],
          ["Ekran görüntüsü işe yaramaz", "Görevlinin ekranındaki QR kod birkaç saniyede bir değişir; gruplara atılan fotoğrafla kimse sıraya giremez."],
          ["Gelme süresi", "Çağrılan gruba gelmesi için 3 ile 30 dakika verilir, ekranında geri sayım görünür. Gelmeyen kendiliğinden düşer."],
          ["Herkese açık durum sayfası", "Her plaj ya da havuzun kendi adresi var ve haritada görünür. Ziyaretçi yola çıkmadan ne kadar kalabalık olduğunu görür."],
        ],
        faq: [
          ["Dört dilde çalışıyor mu?", "Evet. Ziyaretçi sayfaları telefonun diline göre Türkçe, İngilizce, Almanca ya da Rusça açılır."],
          ["Akıllı telefonu olmayan ziyaretçi ne yapacak?", "Görevli onu tek dokunuşla sıraya ekler ve numarasını söyler."],
          ["Ücreti ne kadar?", "İlk 1000 bilet ücretsiz. Sonrasında süresi dolmayan tek seferlik paketler alırsınız; yalnızca sezonda ödersiniz."],
        ],
      },
      "event-queue": {
        title: "QR kodlu etkinlik ve festival giriş sırası · QRWait",
        h1: "Telefondan takip edilen giriş sırası.",
        intro: "Kapıda yığılan kalabalık yerine ziyaretçi QR kodu okutur, numarasını alır ve sırası gelene kadar alanın tadını çıkarır. Siz de kapasite el verdikçe içeri alırsınız.",
        steps: [
          ["Kapıda okutur", "Grubu için numara alır. Uygulama yok, kayıt yok."],
          ["Bu arada dolaşır", "Önünde kaç grup olduğunu ve tahmini bekleme süresini görür."],
          ["Çağrılınca girer", "Yer açılınca telefonu titrer. Kapıda numarasını gösterir."],
        ],
        features: [
          ["Kapasiteye göre içeri alma", "Kaç kişilik yer açıldığını girin, sıradaki gruplar çağrılsın."],
          ["Sırayı sınırlama", "Bekleyen grup sayısına üst sınır koyun, giriş saatleri belirleyin ya da yeni girişleri tek dokunuşla durdurun."],
          ["Kalabalık kapıda adil", "Bir telefon, bir sıra; grup büyüklüğünün üst sınırı var. Konum kontrolü başka yerden sıraya girilmesini engeller."],
          ["Sıra gelmeden haber", "Ziyaretçi sırasına iki grup kala bildirim alır, kapıya zamanında gelir."],
          ["Birden çok kapı, tek hesap", "Her kapı, sahne ya da etkinlik için ayrı sıra açın; her birinin kendi adresi olur."],
          ["Etkinlik sonrası rakamlar", "Gelen, alınan, gelmeyen, ortalama bekleme ve saat saat girişler. CSV olarak indirilir."],
        ],
        faq: [
          ["Ziyaretçi gelmeden sıraya girebilir mi?", "Konum kontrolü açıksa hayır, sıranın yakınında olmak gerekir. İsterseniz kapatabilirsiniz."],
          ["Yalnızca bir hafta sonu için kullanabilir miyiz?", "Evet. Abonelik yok; ücretsiz biletleri kullanırsınız ya da tek seferlik bir paket alırsınız."],
          ["Oyuncak, atölye gibi aktiviteler için de olur mu?", "Evet. İnsanların sıra beklediği her nokta için ayrı bir sıra açılabilir."],
        ],
      },
      "service-desk-queue": {
        title: "Hizmet noktası ve klinikler için sıramatik alternatifi · QRWait",
        h1: "Sıramatik cihazı olmadan hizmet noktası sırası.",
        intro: "Belediye hizmet noktaları, klinikler ve ofisler için: ziyaretçi QR kodu okutur, numara alır ve istediği yerde bekler. Satın alınacak cihaz yok; görevli paneli herhangi bir tablette ya da telefonda açılır.",
        steps: [
          ["Okutur, numara alır", "QR kod görevlinin ekranında ya da duvara asılı."],
          ["İstediği yerde bekler", "Sırasını anlık takip eder, tahmini bekleme süresini görür."],
          ["Çağrılınca gişeye gelir", "Telefonu titrer, ekran yeşile döner."],
        ],
        features: [
          ["Cihaz gerekmez", "Kurulacak sıramatik ya da ekran yok. Tarayıcısı olan bir tablet ya da telefon yeter."],
          ["Kimse dışarıda kalmaz", "Görevli, akıllı telefonu olmayanları tek dokunuşla sıraya ekler ve numarasını söyler."],
          ["Çalışma saatleri", "Sıraya giriş belirli saatlerle sınırlanabilir, gişe erken kapanınca durdurulabilir."],
          ["Gelmeyen sırayı tıkamaz", "Gelmeyeni tek dokunuşla düşürün ya da gelme süresi dolunca kendiliğinden düşsün."],
          ["Herkese açık durum sayfası", "Her hizmet noktasının kendi adresi var ve haritada görünür. Vatandaş gelmeden ne kadar kalabalık olduğuna bakar."],
          ["Kişisel veri olmadan istatistik", "Günlük hizmet verilen kişi, ortalama bekleme ve yoğun saatler; CSV olarak indirilir. Ad ya da telefon numarası toplanmaz."],
        ],
        faq: [
          ["Ziyaretçi adını ya da telefon numarasını vermek zorunda mı?", "Hayır. Bir numara alır, başka bir şey sorulmaz."],
          ["Farklı hizmetler için ayrı sıra açabilir miyiz?", "Evet. Her hizmet ya da bina için kendi adresi ve QR kodu olan ayrı bir sıra açın."],
          ["Ücreti ne kadar?", "İlk 1000 bilet ücretsiz. Birden çok noktası olan belediyeler için yıllık fiyat konuşabiliriz."],
        ],
      },
    },
  },
  en: {
    signup: "Create a free account",
    freeNote: "Set up your queue in a few minutes. The first 1000 tickets are free, no credit card needed.",
    pricing: "See pricing",
    stepsTitle: "How it works",
    featuresTitle: "What you get",
    faqTitle: "Questions",
    othersTitle: "Other uses",
    contactTitle: "Want help setting it up?",
    contactText: "Write to us and we'll set up your first queue together.",
    pages: {
      "restaurant-waitlist": {
        title: "Restaurant waitlist with a QR code, no app · QRWait",
        h1: "A restaurant waitlist your guests join with a QR code.",
        intro: "Guests scan the code at the door, say how many they are and wander off. When a table that fits them frees up, their phone tells them. No app, no pagers, no names shouted across the room.",
        steps: [
          ["Guests scan at the door", "They choose their group size on the page that opens. No app to install, no account."],
          ["You free a table", "Enter how many seats the table has. The first waiting group that fits is called automatically."],
          ["Their phone tells them", "The screen turns green and the phone buzzes. They show their number and sit down."],
        ],
        features: [
          ["Table-aware calling", "A table for 2 isn't given to a group of 6. You can also cap how many chairs may stay empty at a table."],
          ["Tables pushed together", "Join two tables and enter the total seats; the queue matches a larger group."],
          ["Arrival time limit", "Give called guests 3 to 30 minutes to arrive. If they don't, the table goes to the next group."],
          ["Estimated wait", "Guests see an estimate based on how fast tables have been freeing up, and get a heads-up when they're two groups away."],
          ["Printed or on screen", "Show a rotating QR code on a tablet at the host stand, or print a fixed one for the door."],
          ["Daily statistics", "Groups joined and seated, no-shows, average wait and busy hours, exportable as CSV. Counts only, no personal data."],
        ],
        faq: [
          ["Do guests need to download an app?", "No. The waitlist opens in the phone's browser after scanning the code."],
          ["What about guests without a smartphone?", "The host adds them with one tap and tells them their number."],
          ["How much does it cost?", "The first 1000 tickets are free. After that you buy one-time ticket packages; there's no subscription."],
        ],
      },
      "beach-queue": {
        title: "Beach and pool sunbed queue · QRWait",
        h1: "A fair queue for sunbeds, without the morning rush.",
        intro: "When the beach or pool is full, visitors scan the QR code and wait in the shade instead of standing at the entrance. As sunbeds free up, the next groups are called on their phones.",
        steps: [
          ["Scan at the entrance", "Visitors choose how many they are and how many sunbeds they would accept."],
          ["Wait anywhere nearby", "They follow their place live; nobody takes it while they swim or have a drink."],
          ["Come when called", "When sunbeds free up, the next groups' phones buzz and they show their number."],
        ],
        features: [
          ["Call by freed places", "Enter how many sunbeds opened up; the next groups are called automatically."],
          ["Flexible groups", "A group of 4 can say they'll settle for 2 sunbeds, so places don't sit empty. Optionally, smaller groups that fit are moved ahead."],
          ["No joining from the hotel room", "The phone's location must be near the queue: a fixed point or the attendant's live location."],
          ["Screenshots don't work", "The QR code on the attendant's screen changes every few seconds, so a photo shared in a group chat gets nobody in."],
          ["Arrival time limit", "Called groups get 3 to 30 minutes to arrive, with a countdown on their screen. No-shows are dropped automatically."],
          ["Public status page", "Each beach or pool has its own address and appears on the map, so people can see how busy it is before they set off."],
        ],
        faq: [
          ["Does it work in several languages?", "Yes. Visitor pages open in English, Turkish, German or Russian depending on the phone's language."],
          ["What about visitors without a smartphone?", "The attendant adds them with one tap and tells them their number."],
          ["How much does it cost?", "The first 1000 tickets are free. After that you buy one-time packages that don't expire, so you only pay during the season."],
        ],
      },
      "event-queue": {
        title: "Event and festival entry queue with a QR code · QRWait",
        h1: "An entry queue people follow from their phone.",
        intro: "Instead of a crowd at the gate, visitors scan a QR code, take a number and enjoy the venue until it's their turn to go in. You let people in as capacity allows.",
        steps: [
          ["Scan at the gate", "Visitors take a number for their group. No app, no sign-up."],
          ["Look around meanwhile", "They see how many groups are ahead and an estimated wait."],
          ["Go in when called", "Their phone buzzes when there's room. They show their number at the door."],
        ],
        features: [
          ["Let in as capacity allows", "Enter how many places opened up and the next groups are called."],
          ["Limit the queue", "Cap the number of waiting groups, set joining hours, or pause new joins with one tap."],
          ["Fair at busy gates", "One phone, one place, with an upper limit on group size. The location check stops people joining from elsewhere."],
          ["A heads-up before their turn", "Visitors get a notification when they're two groups away, so they're at the gate on time."],
          ["Several gates, one account", "Create a queue for each gate, stage or activity, each with its own address."],
          ["Numbers after the event", "Joined, served, no-shows, average wait and joins by hour, exportable as CSV."],
        ],
        faq: [
          ["Can visitors join before they arrive?", "Not with the location check on: they have to be near the queue. You can also turn it off."],
          ["Can we use it for a single weekend?", "Yes. There's no subscription; use the free tickets or buy a one-time package."],
          ["Does it work for rides or workshops?", "Yes. Any spot where people wait for their turn can have its own queue."],
        ],
      },
      "service-desk-queue": {
        title: "Queue system for service desks and clinics, no ticket machine · QRWait",
        h1: "A queue system for service desks, without a ticket machine.",
        intro: "For municipal service points, clinics and offices: visitors scan a QR code, take a number and wait where they like. There's no hardware to buy; the attendant panel runs on any tablet or phone.",
        steps: [
          ["Scan and take a number", "The QR code is on the attendant's screen or printed on the wall."],
          ["Wait where you like", "Visitors follow their place live and see an estimated wait."],
          ["Come to the desk when called", "Their phone buzzes and the screen turns green."],
        ],
        features: [
          ["No hardware", "No ticket machine or display to install. A tablet or phone with a browser is enough."],
          ["Nobody is left out", "The attendant adds visitors without a smartphone with one tap and tells them their number."],
          ["Opening hours", "Joins can be limited to set hours and paused when the desk closes early."],
          ["No-shows don't hold up the line", "Drop a no-show with one tap, or let them drop automatically after an arrival time limit."],
          ["Public status page", "Each service point has its own address and appears on the map, so people can check how busy it is before coming."],
          ["Statistics without personal data", "Daily counts of visitors served, average wait and busy hours, with CSV export. No names or phone numbers are collected."],
        ],
        faq: [
          ["Do visitors have to give their name or phone number?", "No. They get a number; nothing else is asked."],
          ["Can we run separate queues for different services?", "Yes. Create a queue for each service or building, each with its own address and QR code."],
          ["How much does it cost?", "The first 1000 tickets are free. For municipalities with several service points we can agree on yearly pricing."],
        ],
      },
    },
  },
  de: {
    signup: "Kostenloses Konto erstellen",
    freeNote: "Richten Sie Ihre Warteschlange in wenigen Minuten ein. Die ersten 1000 Tickets sind kostenlos, keine Kreditkarte nötig.",
    pricing: "Preise ansehen",
    stepsTitle: "So funktioniert's",
    featuresTitle: "Was Sie bekommen",
    faqTitle: "Fragen",
    othersTitle: "Weitere Einsatzbereiche",
    contactTitle: "Hilfe bei der Einrichtung?",
    contactText: "Schreiben Sie uns, dann richten wir Ihre erste Warteschlange gemeinsam ein.",
    pages: {
      "restaurant-waitlist": {
        title: "Restaurant-Warteliste per QR-Code, ohne App · QRWait",
        h1: "Eine Restaurant-Warteliste, auf die sich Gäste per QR-Code setzen.",
        intro: "Gäste scannen den Code an der Tür, geben an, wie viele sie sind, und gehen spazieren. Wird ein passender Tisch frei, meldet sich ihr Handy. Keine App, keine Pager, kein Namenrufen durch den Raum.",
        steps: [
          ["Gäste scannen an der Tür", "Auf der geöffneten Seite wählen sie ihre Gruppengröße. Keine App, kein Konto."],
          ["Sie geben einen Tisch frei", "Geben Sie die Plätze des Tisches ein. Die erste wartende Gruppe, die passt, wird automatisch aufgerufen."],
          ["Das Handy meldet sich", "Der Bildschirm wird grün, das Handy vibriert. Sie zeigen ihre Nummer und setzen sich."],
        ],
        features: [
          ["Aufruf nach Tischgröße", "Ein Zweiertisch geht nicht an eine Sechsergruppe. Sie können auch festlegen, wie viele Stühle höchstens leer bleiben dürfen."],
          ["Zusammengeschobene Tische", "Schieben Sie zwei Tische zusammen und geben Sie die Gesamtzahl der Plätze ein; die Warteschlange findet eine größere Gruppe."],
          ["Zeit zum Erscheinen", "Geben Sie aufgerufenen Gästen 3 bis 30 Minuten. Kommen sie nicht, geht der Tisch an die nächste Gruppe."],
          ["Geschätzte Wartezeit", "Gäste sehen eine Schätzung danach, wie schnell zuletzt Tische frei wurden, und werden zwei Gruppen vorher benachrichtigt."],
          ["Gedruckt oder auf dem Bildschirm", "Zeigen Sie am Empfang einen wechselnden QR-Code auf dem Tablet oder hängen Sie einen festen Code an die Tür."],
          ["Tagesstatistik", "Angemeldete und platzierte Gruppen, Nichterscheinen, durchschnittliche Wartezeit und Stoßzeiten, als CSV exportierbar. Nur Zahlen, keine personenbezogenen Daten."],
        ],
        faq: [
          ["Müssen Gäste eine App herunterladen?", "Nein. Die Warteliste öffnet sich nach dem Scannen im Browser des Handys."],
          ["Und Gäste ohne Smartphone?", "Der Empfang fügt sie mit einem Tippen hinzu und nennt ihnen ihre Nummer."],
          ["Was kostet es?", "Die ersten 1000 Tickets sind kostenlos. Danach kaufen Sie einmalige Ticketpakete; es gibt kein Abo."],
        ],
      },
      "beach-queue": {
        title: "Warteschlange für Liegen an Strand und Pool · QRWait",
        h1: "Eine faire Warteschlange für Liegen, ohne Ansturm am Morgen.",
        intro: "Ist Strand oder Pool voll, scannen Gäste den QR-Code und warten im Schatten statt am Eingang. Werden Liegen frei, werden die nächsten Gruppen auf dem Handy aufgerufen.",
        steps: [
          ["Am Eingang scannen", "Gäste wählen, wie viele sie sind und mit wie vielen Liegen sie zufrieden wären."],
          ["In der Nähe warten", "Sie verfolgen ihren Platz live; niemand nimmt ihn, während sie schwimmen oder etwas trinken."],
          ["Kommen, wenn aufgerufen", "Werden Liegen frei, vibrieren die Handys der nächsten Gruppen und sie zeigen ihre Nummer."],
        ],
        features: [
          ["Aufruf nach frei gewordenen Plätzen", "Geben Sie ein, wie viele Liegen frei wurden; die nächsten Gruppen werden automatisch aufgerufen."],
          ["Flexible Gruppen", "Eine Vierergruppe kann angeben, dass ihr 2 Liegen reichen, damit keine Plätze leer bleiben. Optional rücken passende kleinere Gruppen vor."],
          ["Kein Anstellen vom Hotelzimmer", "Der Standort des Handys muss in der Nähe der Warteschlange sein: ein fester Punkt oder der Live-Standort des Personals."],
          ["Screenshots helfen nicht", "Der QR-Code auf dem Bildschirm des Personals wechselt alle paar Sekunden; ein Foto im Gruppenchat bringt niemanden in die Schlange."],
          ["Zeit zum Erscheinen", "Aufgerufene Gruppen haben 3 bis 30 Minuten, mit Countdown auf dem Bildschirm. Wer nicht kommt, fällt automatisch heraus."],
          ["Öffentliche Statusseite", "Jeder Strand und Pool hat eine eigene Adresse und erscheint auf der Karte, so sieht man vor dem Losgehen, wie voll es ist."],
        ],
        faq: [
          ["Funktioniert es in mehreren Sprachen?", "Ja. Die Besucherseiten öffnen sich je nach Handysprache auf Deutsch, Englisch, Türkisch oder Russisch."],
          ["Und Gäste ohne Smartphone?", "Das Personal fügt sie mit einem Tippen hinzu und nennt ihnen ihre Nummer."],
          ["Was kostet es?", "Die ersten 1000 Tickets sind kostenlos. Danach kaufen Sie einmalige Pakete ohne Ablaufdatum und zahlen nur in der Saison."],
        ],
      },
      "event-queue": {
        title: "Einlass-Warteschlange für Events und Festivals per QR-Code · QRWait",
        h1: "Eine Einlass-Warteschlange, die man auf dem Handy verfolgt.",
        intro: "Statt einer Menge am Tor scannen Besucher einen QR-Code, ziehen eine Nummer und genießen das Gelände, bis sie hineindürfen. Sie lassen Leute ein, wie es die Kapazität erlaubt.",
        steps: [
          ["Am Tor scannen", "Besucher ziehen eine Nummer für ihre Gruppe. Keine App, keine Anmeldung."],
          ["Sich inzwischen umsehen", "Sie sehen, wie viele Gruppen vor ihnen sind, und eine geschätzte Wartezeit."],
          ["Hinein, wenn aufgerufen", "Ist Platz frei, vibriert ihr Handy. Am Eingang zeigen sie ihre Nummer."],
        ],
        features: [
          ["Einlass nach Kapazität", "Geben Sie ein, wie viele Plätze frei wurden, und die nächsten Gruppen werden aufgerufen."],
          ["Warteschlange begrenzen", "Begrenzen Sie die Zahl wartender Gruppen, legen Sie Zeiten fest oder stoppen Sie neue Anmeldungen mit einem Tippen."],
          ["Fair an vollen Toren", "Ein Handy, ein Platz, mit Obergrenze für die Gruppengröße. Die Standortprüfung verhindert das Anstellen von woanders."],
          ["Hinweis vor dem Aufruf", "Besucher werden zwei Gruppen vorher benachrichtigt und sind rechtzeitig am Tor."],
          ["Mehrere Eingänge, ein Konto", "Legen Sie für jedes Tor, jede Bühne oder Aktivität eine eigene Warteschlange mit eigener Adresse an."],
          ["Zahlen nach dem Event", "Angemeldet, eingelassen, nicht erschienen, durchschnittliche Wartezeit und Anmeldungen pro Stunde, als CSV exportierbar."],
        ],
        faq: [
          ["Können sich Besucher schon vor der Ankunft anstellen?", "Nicht mit aktiver Standortprüfung: Sie müssen in der Nähe sein. Sie können sie auch ausschalten."],
          ["Können wir es nur für ein Wochenende nutzen?", "Ja. Es gibt kein Abo; nutzen Sie die kostenlosen Tickets oder kaufen Sie ein einmaliges Paket."],
          ["Geht das auch für Fahrgeschäfte oder Workshops?", "Ja. Jeder Ort, an dem Menschen anstehen, kann eine eigene Warteschlange bekommen."],
        ],
      },
      "service-desk-queue": {
        title: "Warteschlangensystem für Schalter und Praxen, ohne Ticketautomat · QRWait",
        h1: "Ein Aufrufsystem für Schalter, ganz ohne Ticketautomat.",
        intro: "Für Bürgerbüros, Praxen und Ämter: Besucher scannen einen QR-Code, ziehen eine Nummer und warten, wo sie möchten. Keine Hardware zu kaufen; das Panel läuft auf jedem Tablet oder Handy.",
        steps: [
          ["Scannen und Nummer ziehen", "Der QR-Code ist auf dem Bildschirm des Personals oder hängt ausgedruckt an der Wand."],
          ["Warten, wo man möchte", "Besucher verfolgen ihren Platz live und sehen eine geschätzte Wartezeit."],
          ["Zum Schalter, wenn aufgerufen", "Das Handy vibriert und der Bildschirm wird grün."],
        ],
        features: [
          ["Keine Hardware", "Kein Ticketautomat und keine Anzeige zu installieren. Ein Tablet oder Handy mit Browser genügt."],
          ["Niemand bleibt außen vor", "Das Personal fügt Besucher ohne Smartphone mit einem Tippen hinzu und nennt ihnen ihre Nummer."],
          ["Öffnungszeiten", "Anmeldungen lassen sich auf feste Zeiten begrenzen und pausieren, wenn der Schalter früher schließt."],
          ["Wer nicht kommt, hält nicht auf", "Nicht Erschienene mit einem Tippen entfernen oder nach Ablauf der Zeit zum Erscheinen automatisch."],
          ["Öffentliche Statusseite", "Jeder Schalter hat eine eigene Adresse und erscheint auf der Karte, so kann man vorher sehen, wie voll es ist."],
          ["Statistik ohne personenbezogene Daten", "Tägliche Zahlen zu bedienten Besuchern, Wartezeit und Stoßzeiten, mit CSV-Export. Es werden keine Namen oder Telefonnummern erfasst."],
        ],
        faq: [
          ["Müssen Besucher Namen oder Telefonnummer angeben?", "Nein. Sie bekommen eine Nummer, sonst wird nichts abgefragt."],
          ["Können wir getrennte Warteschlangen für verschiedene Dienste führen?", "Ja. Legen Sie für jeden Dienst oder jedes Gebäude eine eigene Warteschlange mit eigener Adresse und eigenem QR-Code an."],
          ["Was kostet es?", "Die ersten 1000 Tickets sind kostenlos. Für Kommunen mit mehreren Standorten vereinbaren wir gern Jahrespreise."],
        ],
      },
    },
  },
  ru: {
    signup: "Создать бесплатный аккаунт",
    freeNote: "Настройте очередь за несколько минут. Первые 1000 билетов бесплатно, банковская карта не нужна.",
    pricing: "Посмотреть цены",
    stepsTitle: "Как это работает",
    featuresTitle: "Возможности",
    faqTitle: "Вопросы",
    othersTitle: "Другие применения",
    contactTitle: "Нужна помощь с настройкой?",
    contactText: "Напишите нам, и мы вместе настроим вашу первую очередь.",
    pages: {
      "restaurant-waitlist": {
        title: "Лист ожидания для ресторана по QR-коду, без приложения · QRWait",
        h1: "Лист ожидания, в который гости встают по QR-коду.",
        intro: "Гость сканирует код у входа, указывает, сколько их, и идёт гулять. Когда освобождается подходящий стол, телефон сообщает об этом. Без приложения, без пейджеров, без выкрикивания имён на весь зал.",
        steps: [
          ["Гость сканирует код у входа", "На открывшейся странице выбирает размер группы. Без приложения и аккаунта."],
          ["Вы освобождаете стол", "Введите, на сколько мест стол. Первая подходящая группа из очереди вызывается автоматически."],
          ["Телефон сообщает", "Экран становится зелёным, телефон вибрирует. Гость показывает номер и садится."],
        ],
        features: [
          ["Вызов с учётом стола", "Стол на двоих не отдаётся группе из шести. Можно ограничить, сколько стульев может остаться пустыми."],
          ["Сдвинутые столы", "Сдвиньте два стола и введите общее число мест — очередь подберёт группу побольше."],
          ["Время на подход", "Дайте вызванным гостям от 3 до 30 минут. Если не пришли, стол переходит следующей группе."],
          ["Примерное ожидание", "Гости видят оценку по тому, как быстро освобождались столы, и получают уведомление за две группы до своей очереди."],
          ["Распечатка или экран", "Показывайте меняющийся QR-код на планшете у стойки или повесьте постоянный код на дверь."],
          ["Статистика за день", "Сколько групп встало в очередь и село, неявки, среднее ожидание и часы пик, с выгрузкой в CSV. Только числа, без персональных данных."],
        ],
        faq: [
          ["Нужно ли гостям скачивать приложение?", "Нет. Лист ожидания открывается в браузере телефона после сканирования кода."],
          ["А гости без смартфона?", "Администратор добавляет их одним нажатием и называет номер."],
          ["Сколько это стоит?", "Первые 1000 билетов бесплатно. Дальше — разовые пакеты билетов, без подписки."],
        ],
      },
      "beach-queue": {
        title: "Очередь на шезлонги на пляже и у бассейна · QRWait",
        h1: "Честная очередь на шезлонги без утренней гонки.",
        intro: "Когда пляж или бассейн заполнен, гости сканируют QR-код и ждут в тени, а не стоят у входа. Когда освобождаются шезлонги, следующие группы получают вызов на телефон.",
        steps: [
          ["Сканируют у входа", "Выбирают, сколько их и на сколько шезлонгов они согласны."],
          ["Ждут где угодно рядом", "Следят за очередью в реальном времени; пока они купаются или пьют что-то, место никто не займёт."],
          ["Приходят по вызову", "Когда освобождаются шезлонги, у следующих групп вибрирует телефон, и они показывают номер."],
        ],
        features: [
          ["Вызов по освободившимся местам", "Введите, сколько шезлонгов освободилось, и следующие группы вызываются автоматически."],
          ["Гибкие группы", "Группа из четырёх может согласиться на 2 шезлонга, чтобы места не пустовали. По желанию подходящие небольшие группы продвигаются вперёд."],
          ["Из номера отеля не встать", "Телефон должен быть рядом с очередью: у фиксированной точки или рядом с сотрудником."],
          ["Скриншоты не работают", "QR-код на экране сотрудника меняется каждые несколько секунд, так что фото в групповом чате никого в очередь не поставит."],
          ["Время на подход", "Вызванной группе даётся от 3 до 30 минут, на экране идёт обратный отсчёт. Неявившиеся выбывают автоматически."],
          ["Публичная страница состояния", "У каждого пляжа и бассейна свой адрес и метка на карте — можно заранее посмотреть, сколько там людей."],
        ],
        faq: [
          ["Работает ли на нескольких языках?", "Да. Страницы для гостей открываются на русском, английском, немецком или турецком в зависимости от языка телефона."],
          ["А гости без смартфона?", "Сотрудник добавляет их одним нажатием и называет номер."],
          ["Сколько это стоит?", "Первые 1000 билетов бесплатно. Дальше — разовые пакеты без срока действия, так что платите только в сезон."],
        ],
      },
      "event-queue": {
        title: "Очередь на вход на мероприятие и фестиваль по QR-коду · QRWait",
        h1: "Очередь на вход, за которой следят с телефона.",
        intro: "Вместо толпы у ворот посетители сканируют QR-код, берут номер и проводят время на площадке, пока не подойдёт их очередь. Вы пускаете людей по мере освобождения мест.",
        steps: [
          ["Сканируют у входа", "Посетитель берёт номер для своей группы. Без приложения и регистрации."],
          ["Тем временем гуляют", "Видят, сколько групп впереди, и примерное время ожидания."],
          ["Заходят по вызову", "Когда есть место, телефон вибрирует. На входе показывают номер."],
        ],
        features: [
          ["Вход по мере мест", "Введите, сколько мест освободилось, и следующие группы будут вызваны."],
          ["Ограничение очереди", "Ограничьте число ожидающих групп, задайте часы записи или остановите запись одним нажатием."],
          ["Честно у загруженного входа", "Один телефон — одно место, есть предел размера группы. Проверка геолокации не даёт встать в очередь издалека."],
          ["Уведомление заранее", "Посетители получают уведомление за две группы до своей очереди и приходят ко входу вовремя."],
          ["Несколько входов, один аккаунт", "Создайте очередь для каждого входа, сцены или активности, у каждой свой адрес."],
          ["Цифры после мероприятия", "Встали в очередь, прошли, не явились, среднее ожидание и запись по часам, с выгрузкой в CSV."],
        ],
        faq: [
          ["Можно ли встать в очередь до прихода?", "Нет, если включена проверка геолокации: нужно быть рядом. Её можно отключить."],
          ["Можно использовать только на одни выходные?", "Да. Подписки нет; используйте бесплатные билеты или купите разовый пакет."],
          ["Подходит для аттракционов или мастер-классов?", "Да. У любого места, где люди ждут своей очереди, может быть своя очередь."],
        ],
      },
      "service-desk-queue": {
        title: "Электронная очередь для пунктов обслуживания и клиник без терминала · QRWait",
        h1: "Электронная очередь для пунктов обслуживания без терминала.",
        intro: "Для муниципальных пунктов обслуживания, клиник и офисов: посетитель сканирует QR-код, берёт номер и ждёт где удобно. Покупать оборудование не нужно; панель сотрудника работает на любом планшете или телефоне.",
        steps: [
          ["Сканирует и берёт номер", "QR-код на экране сотрудника или распечатан на стене."],
          ["Ждёт где удобно", "Следит за очередью в реальном времени и видит примерное ожидание."],
          ["Подходит к окну по вызову", "Телефон вибрирует, экран становится зелёным."],
        ],
        features: [
          ["Без оборудования", "Не нужен терминал с талонами или табло. Достаточно планшета или телефона с браузером."],
          ["Никто не останется в стороне", "Сотрудник добавляет посетителей без смартфона одним нажатием и называет номер."],
          ["Часы работы", "Запись можно ограничить часами работы и приостановить, если окно закрывается раньше."],
          ["Неявки не задерживают очередь", "Уберите неявившегося одним нажатием или пусть он выбывает автоматически по истечении времени на подход."],
          ["Публичная страница состояния", "У каждого пункта свой адрес и метка на карте — можно заранее проверить, сколько людей в очереди."],
          ["Статистика без персональных данных", "Ежедневные цифры по обслуженным посетителям, ожиданию и часам пик, с выгрузкой в CSV. Имена и номера телефонов не собираются."],
        ],
        faq: [
          ["Нужно ли посетителю называть имя или номер телефона?", "Нет. Он получает номер, больше ничего не спрашивается."],
          ["Можно вести отдельные очереди для разных услуг?", "Да. Создайте очередь для каждой услуги или здания, со своим адресом и QR-кодом."],
          ["Сколько это стоит?", "Первые 1000 билетов бесплатно. Для муниципалитетов с несколькими пунктами можем договориться о годовой цене."],
        ],
      },
    },
  },
});

const use = (USES.find(([u]) => `/${u}` === basePath().replace(/\.html$/, ""))?.[0] ?? "restaurant-waitlist") as Use;
const P = T.pages[use];
document.title = P.title;

function UseCasePage() {
  return (
    <Site>
      <div className="pt-12 pb-12 md:pb-16">
        <h1 className="mb-6 max-w-[20ch] text-[clamp(2.5rem,6vw,4.25rem)] leading-[1.02] font-extrabold tracking-[-0.035em]">{P.h1}</h1>
        <p className="mb-8 max-w-[46ch] text-xl text-ink-soft">{P.intro}</p>
        <div className="flex flex-wrap gap-3">
          <Button asChild className={cn(pill, solid)}><a href="/admin#signup">{T.signup}</a></Button>
          <Button asChild className={pill}><a href={sitePath("/pricing")}>{T.pricing}</a></Button>
        </div>
        <p className="mt-4 max-w-[40ch] text-ink-soft">{T.freeNote}</p>
      </div>

      <Section>
        <H2>{T.stepsTitle}</H2>
        <ol className="steps m-0 grid list-none gap-7 p-0 md:grid-cols-3 md:gap-10">
          {P.steps.map(([t, d]) => <li key={t}><h3 className="mb-1.5 text-xl font-semibold tracking-[-0.01em]">{t}</h3><p className="text-ink-soft">{d}</p></li>)}
        </ol>
      </Section>

      <Section>
        <H2>{T.featuresTitle}</H2>
        <ul className="m-0 grid list-none gap-x-12 gap-y-7 p-0 md:grid-cols-2">
          {P.features.map(([t, d]) => (
            <li key={t} className="flex gap-3">
              <CheckIcon aria-hidden="true" className="mt-1 size-5 shrink-0 text-success" />
              <div><h3 className="text-[1.15rem] font-semibold">{t}</h3><p className="mt-1 text-ink-soft">{d}</p></div>
            </li>
          ))}
        </ul>
      </Section>

      <Section>
        <H2>{T.faqTitle}</H2>
        <dl className="m-0 grid md:grid-cols-2 md:gap-x-12">
          {P.faq.map(([q, a]) => (
            <div key={q} className="border-b border-line py-5">
              <dt className="text-[1.15rem] font-semibold">{q}</dt>
              <dd className="mt-1 text-ink-soft">{a}</dd>
            </div>
          ))}
        </dl>
      </Section>

      <Section>
        <H2>{T.othersTitle}</H2>
        <ul className="m-0 flex list-none flex-wrap gap-3 p-0">
          {USES.filter(([u]) => u !== use).map(([u, name]) => <li key={u}><Button asChild className={pill}><a href={sitePath(`/${u}`)}>{name}</a></Button></li>)}
        </ul>
      </Section>

      <section className="mt-10 mb-20 rounded-[20px] bg-ink px-6 py-10 text-white md:rounded-[28px] md:px-12 md:py-16">
        <H2 className="mb-4">{T.contactTitle}</H2>
        <p className="mb-8 max-w-[46ch] text-[1.15rem] text-[#C9D2E3]">{T.contactText}</p>
        <div className="flex flex-wrap items-center gap-x-8 gap-y-6">
          <Button asChild className={cn(pill, "border-ticket bg-ticket text-ink hover:bg-ticket/90")}><a href="/admin#signup">{T.signup}</a></Button>
          <a className="inline-block text-[clamp(1.4rem,4vw,2.4rem)] font-extrabold tracking-[-0.02em] break-all text-ticket underline decoration-3 underline-offset-6" href={`mailto:${EMAIL}`}>{EMAIL}</a>
        </div>
      </section>
    </Site>
  );
}

mount(<UseCasePage />);
