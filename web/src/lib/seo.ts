// Tanıtım sitesi sayfalarının arama motoru başlığı ve açıklaması, dil başına. vite.config.ts her dil için ayrı HTML üretir
// (İngilizce kökte: /pricing; diğerleri önekli: /tr/pricing) ve <head>'e bunları yazar. Saf veri: vite.config.ts de içe aktarır,
// bu yüzden React ya da tarayıcıya bağlı bir şey içermez. Başlıklar sayfaların kendi T.title metinleriyle aynı kalmalı.
export const SITE_LANGS = ["en", "tr", "de", "ru"] as const;
export type SiteLang = (typeof SITE_LANGS)[number];
export const USE_PAGES = ["restaurant-waitlist", "beach-queue", "event-queue", "service-desk-queue"] as const;
export type SitePage = "home" | "pricing" | "privacy" | "terms" | (typeof USE_PAGES)[number];

// Sayfanın dil öneki olmadan yolu: home → "/", diğerleri "/<ad>"
export const pagePath = (p: SitePage) => (p === "home" ? "/" : `/${p}`);
// Dilin adresi: İngilizce önek almaz; /tr/ ana sayfa, /tr/pricing
export const langPath = (l: SiteLang, path: string) => (l === "en" ? path : `/${l}${path}`);

export const SEO: Record<SiteLang, Record<SitePage, [title: string, description: string]>> = {
  en: {
    home: ["QRWait · Virtual queue with a QR code, no app", "QR code queue system for beaches, piers, service points and events. Join the queue without an app and your phone tells you when it's your turn."],
    pricing: ["Pricing · QRWait", "QRWait pricing: no subscription, the first 1000 tickets are free. Ticket packages are one-time payments and never expire."],
    privacy: ["Privacy Policy · QRWait", "QRWait privacy policy: what data is kept, why, and for how long."],
    terms: ["Terms of Use · QRWait", "QRWait terms of use: accounts, ticket packages and use of the service."],
    "restaurant-waitlist": ["Restaurant waitlist with a QR code, no app · QRWait", "Guests join your restaurant waitlist by scanning a QR code and get called when a table that fits them frees up. No app, no pagers. First 1000 tickets free."],
    "beach-queue": ["Beach and pool sunbed queue · QRWait", "A fair virtual queue for beach and pool sunbeds. Visitors scan a QR code, wait in the shade and get called when sunbeds free up. No app needed."],
    "event-queue": ["Event and festival entry queue with a QR code · QRWait", "Virtual entry queue for events and festivals. Visitors scan a QR code, take a number and get called to the gate when there's room. No app needed."],
    "service-desk-queue": ["Queue system for service desks and clinics, no ticket machine · QRWait", "QR code queue system for municipal service points, clinics and offices. No ticket machine or hardware: visitors take a number on their phone."],
  },
  tr: {
    home: ["QRWait · QR kodlu sanal sıra sistemi", "Plaj, iskele, hizmet noktası ve etkinlikler için QR kodlu sıra sistemi. Ziyaretçi uygulama indirmeden sıraya girer, sırası gelince telefonu haber verir."],
    pricing: ["Fiyatlar · QRWait", "QRWait fiyatları: abonelik yok, ilk 1000 bilet ücretsiz. Bilet paketleri tek seferlik ödenir ve süresi dolmaz."],
    privacy: ["Gizlilik Politikası ve KVKK Aydınlatma Metni · QRWait", "QRWait gizlilik politikası ve KVKK aydınlatma metni: hangi veriler, neden ve ne kadar süre saklanır."],
    terms: ["Kullanım Koşulları · QRWait", "QRWait kullanım koşulları: hesaplar, bilet paketleri ve hizmetin kullanımı."],
    "restaurant-waitlist": ["QR kodlu restoran bekleme listesi · QRWait", "Misafirler QR kodu okutarak restoranınızın bekleme listesine girer, onlara uygun masa boşalınca telefonları haber verir. Uygulama ve çağrı cihazı yok. İlk 1000 bilet ücretsiz."],
    "beach-queue": ["Plaj ve havuz için şezlong sırası · QRWait", "Plaj ve havuz şezlongları için adil sanal sıra. Ziyaretçi QR kodu okutur, gölgede bekler, şezlong boşalınca çağrılır. Uygulama gerekmez."],
    "event-queue": ["QR kodlu etkinlik ve festival giriş sırası · QRWait", "Etkinlik ve festivaller için sanal giriş sırası. Ziyaretçi QR kodu okutur, numarasını alır, yer açılınca kapıya çağrılır. Uygulama gerekmez."],
    "service-desk-queue": ["Hizmet noktası ve klinikler için sıramatik alternatifi · QRWait", "Belediye hizmet noktaları, klinikler ve ofisler için QR kodlu sıra sistemi. Sıramatik ya da cihaz yok: ziyaretçi numarasını telefonundan alır."],
  },
  de: {
    home: ["QRWait · Virtuelle Warteschlange per QR-Code", "Warteschlangensystem per QR-Code für Strände, Anleger, Servicestellen und Events. Anstellen ohne App, das Handy meldet sich, wenn man dran ist."],
    pricing: ["Preise · QRWait", "QRWait-Preise: kein Abo, die ersten 1000 Tickets sind kostenlos. Ticketpakete werden einmalig bezahlt und verfallen nicht."],
    privacy: ["Datenschutzerklärung · QRWait", "QRWait-Datenschutzerklärung: welche Daten gespeichert werden, warum und wie lange."],
    terms: ["Nutzungsbedingungen · QRWait", "QRWait-Nutzungsbedingungen: Konten, Ticketpakete und Nutzung des Dienstes."],
    "restaurant-waitlist": ["Restaurant-Warteliste per QR-Code, ohne App · QRWait", "Gäste tragen sich per QR-Code in die Warteliste Ihres Restaurants ein und werden gerufen, sobald ein passender Tisch frei wird. Keine App, keine Pager. Die ersten 1000 Tickets sind kostenlos."],
    "beach-queue": ["Warteschlange für Liegen an Strand und Pool · QRWait", "Eine faire virtuelle Warteschlange für Liegen an Strand und Pool. Gäste scannen einen QR-Code, warten im Schatten und werden gerufen, wenn Liegen frei werden. Ohne App."],
    "event-queue": ["Einlass-Warteschlange für Events und Festivals per QR-Code · QRWait", "Virtuelle Einlass-Warteschlange für Events und Festivals. Besucher scannen einen QR-Code, ziehen eine Nummer und werden zum Eingang gerufen, sobald Platz ist. Ohne App."],
    "service-desk-queue": ["Warteschlangensystem für Schalter und Praxen, ohne Ticketautomat · QRWait", "Warteschlangensystem per QR-Code für Bürgerbüros, Praxen und Ämter. Kein Ticketautomat, keine Hardware: Besucher ziehen die Nummer auf dem Handy."],
  },
  ru: {
    home: ["QRWait · Электронная очередь по QR-коду", "Электронная очередь по QR-коду для пляжей, причалов, пунктов обслуживания и мероприятий. Встать в очередь без приложения — телефон сообщит, когда подойдёт очередь."],
    pricing: ["Цены · QRWait", "Цены QRWait: без подписки, первые 1000 билетов бесплатно. Пакеты билетов оплачиваются один раз и не сгорают."],
    privacy: ["Политика конфиденциальности · QRWait", "Политика конфиденциальности QRWait: какие данные хранятся, зачем и как долго."],
    terms: ["Условия использования · QRWait", "Условия использования QRWait: учётные записи, пакеты билетов и пользование сервисом."],
    "restaurant-waitlist": ["Лист ожидания для ресторана по QR-коду, без приложения · QRWait", "Гости встают в лист ожидания ресторана, отсканировав QR-код, и получают вызов, когда освобождается подходящий стол. Без приложения и пейджеров. Первые 1000 билетов бесплатно."],
    "beach-queue": ["Очередь на шезлонги на пляже и у бассейна · QRWait", "Честная электронная очередь на шезлонги на пляже и у бассейна. Гости сканируют QR-код, ждут в тени и получают вызов, когда освобождаются шезлонги. Без приложения."],
    "event-queue": ["Очередь на вход на мероприятие и фестиваль по QR-коду · QRWait", "Электронная очередь на вход для мероприятий и фестивалей. Посетители сканируют QR-код, берут номер и получают вызов ко входу, когда есть места. Без приложения."],
    "service-desk-queue": ["Электронная очередь для пунктов обслуживания и клиник без терминала · QRWait", "Электронная очередь по QR-коду для муниципальных пунктов обслуживания, клиник и офисов. Без терминала и оборудования: посетитель берёт номер в телефоне."],
  },
};
