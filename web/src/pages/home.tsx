import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { api, catIcon, locate, type PublicRoom } from "@/lib/api";
import { fmtDistL, geoErrors, lang, pick, waitText } from "@/lib/i18n";
import { baseMap, L, meters } from "@/lib/leaflet";
import { H2, pill, Section, Site, solid } from "@/components/site";
import { mount } from "@/lib/mount";
import { cn } from "@/lib/utils";
import "./home.css";

const green = "#15803D", yellow = "#FFE27A";
const esc = (s: unknown) => String(s ?? "").replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

type Pair = [string, string];
const T = pick<{
  title: string; signup: string; freeNote: string; heroTitle: string; heroText: string; findNear: string;
  steps: string[]; done: string; ticketAria: string;
  nearTitle: string; sortByLoc: string; noteStart: string; noteNear: string; noneNear: (d: string) => string; here: string;
  mapAria: string; loadFail: string; loading: string; none: string; seeStatus: string;
  howTitle: string; how: Pair[]; useTitle: string; uses: Pair[]; rulesTitle: string; rules: Pair[];
  adminTitle: string; adminList: string[]; contactTitle: string; contactText: string;
}>({
  tr: {
    title: "QRWait · QR kodlu sanal sıra sistemi",
    signup: "Ücretsiz hesap aç",
    freeNote: "Kendi sıranızı birkaç dakikada kurun. İlk 1000 bilet ücretsiz, kredi kartı gerekmez.",
    heroTitle: "Sıranı al, gerisini telefonun beklesin.",
    heroText: "Plajda, iskelede, hizmet noktasında. QR kodu okut, sıraya gir, sıran gelince telefonun titresin. Uygulama indirmen gerekmez.",
    findNear: "Yakınımdaki sıraları bul",
    steps: ["Önünüzde 3 grup var", "Önünüzde 2 grup var", "Önünüzde 1 grup var", "Sıradaki sizsiniz, hazır olun"],
    done: "Sıran geldi! Görevliye numaranı göster.",
    ticketAria: "Örnek sıra fişi, yeniden oynatmak için dokunun",
    nearTitle: "Yakınındaki sıralar",
    sortByLoc: "Konumuma göre sırala",
    noteStart: "Sıra durumunu görmek için bir yere dokun. Konumunu paylaşırsan en yakındakiler üstte görünür.",
    noteNear: "En yakındakiler üstte. Sıra durumunu görmek için bir yere dokun.",
    noneNear: (d) => `Yakınında henüz sıra yok. En yakını ${d} uzakta.`,
    here: "Buradasın",
    mapAria: "Sıraların haritası",
    loadFail: "Sıralar yüklenemedi. Sayfayı yenileyin.",
    loading: "Sıralar yükleniyor…",
    none: "Henüz sıra yok.",
    seeStatus: "Sıra durumunu gör",
    howTitle: "Kuyrukta dikilmek yok",
    how: [
      ["QR kodu okut", "Görevlinin ekranındaki kodu telefonunun kamerasıyla okut. Açılan sayfada kaç kişi olduğunu seç, sıraya gir."],
      ["Sıranı takip et", "Önünde kaç kişi kaldığını anlık gör. Bu arada gölgede otur, çayını iç, sıranı kimse kapmaz."],
      ["Sıran gelince gel", "Telefonun titrer, ekran yeşile döner. Görevliye numaranı göster, yerine geç."],
    ],
    useTitle: "Beklemenin olduğu her yerde",
    uses: [
      ["Plajlar ve havuzlar", "Şezlong ve alan kapasitesi dolduğunda yer kavgası yerine düzenli sıra. Gruplar kaç şezlonga razı olduğunu seçer, 4 kişi 2 şezlongla da yerleşebilir."],
      ["İskele ve otobüs kuyrukları", "Araç geldiğinde koltuk sayısı kadar kişi çağrılır, kalanlar yerinden kalkmaz."],
      ["Belediye hizmet noktaları", "Gişe önünde yığılma olmadan, sırası gelen gelir."],
      ["Etkinlik ve festival girişleri", "Kapıda bekleyen kalabalık yerine telefondan takip edilen giriş sırası."],
      ["Özel işletmeler", "Beach club, restoran, klinik. Müşteriniz beklerken alanınızı dolaşsın."],
      ["Uzaktan sıra durumu", "Her noktanın kendi adresi var. Yola çıkmadan önce ne kadar kalabalık olduğunu gör."],
    ],
    rulesTitle: "Herkese aynı kural",
    rules: [
      ["Evden sıraya girilmez", "Sıraya girmek için orada olmak gerekir. Telefonun konumu kontrol edilir."],
      ["Ekran görüntüsü işe yaramaz", "QR kod saniyeler içinde yenilenir. Gruplara atılan fotoğrafla sıraya girilemez."],
      ["Bir telefon, bir sıra", "Aynı telefonla ikinci numara alınamaz. Grup büyüklüğünün de üst sınırı var."],
      ["Telefonu olmayan dışarıda kalmaz", "Görevli, akıllı telefonu olmayanları tek dokunuşla sıraya ekler ve numarasını söyler."],
    ],
    adminTitle: "Yönetmesi de kolay",
    adminList: [
      "Kaç kişi ayrıldığını girin, sistem sıradakileri kendisi çağırır.",
      "Gelmeyeni tek dokunuşla düşürün, yeri sıradakine geçsin.",
      "Her nokta haritadan seçilir, kendi web adresini alır.",
      "Görevli paneli tablette ya da telefonda açılır, kurulum gerekmez.",
    ],
    contactTitle: "Kendi sıranızı kuralım",
    contactText: "Plajınız, işletmeniz ya da etkinliğiniz için sıra sistemi kurmak isterseniz yazın. Kurulumu birlikte yapalım.",
  },
  en: {
    title: "QRWait · Virtual queue with a QR code, no app",
    signup: "Sign up for free",
    freeNote: "Set up your own queue in minutes. The first 1000 tickets are free, no credit card needed.",
    heroTitle: "Take your number, let your phone do the waiting.",
    heroText: "At the beach, the pier, the service desk. Scan the QR code, join the queue, and your phone buzzes when it's your turn. No app to download.",
    findNear: "Find queues near me",
    steps: ["3 groups ahead of you", "2 groups ahead of you", "1 group ahead of you", "You're next, get ready"],
    done: "It's your turn! Show your number to the attendant.",
    ticketAria: "Sample queue ticket, tap to replay",
    nearTitle: "Queues near you",
    sortByLoc: "Sort by my location",
    noteStart: "Tap a place to see its queue. Share your location to see the nearest ones first.",
    noteNear: "Nearest first. Tap a place to see its queue.",
    noneNear: (d) => `No queues near you yet. The nearest is ${d} away.`,
    here: "You are here",
    mapAria: "Map of queues",
    loadFail: "Couldn't load queues. Please refresh the page.",
    loading: "Loading queues…",
    none: "No queues yet.",
    seeStatus: "See queue status",
    howTitle: "No more standing in line",
    how: [
      ["Scan the QR code", "Scan the code on the attendant's screen with your phone camera. On the page that opens, choose how many you are and join."],
      ["Follow your place", "See live how many are still ahead of you. Meanwhile, sit in the shade and have a tea — nobody takes your place."],
      ["Come when it's your turn", "Your phone vibrates and the screen turns green. Show your number to the attendant and take your spot."],
    ],
    useTitle: "Wherever there's waiting",
    uses: [
      ["Beaches and pools", "An orderly queue instead of fights over space when sunbeds and areas are full. Groups choose how many sunbeds they'd accept — 4 people can settle for 2."],
      ["Pier and bus lines", "When a vehicle arrives, as many people as there are seats are called; everyone else stays put."],
      ["Municipal service points", "No crowding at the counter — people come when it's their turn."],
      ["Event and festival entrances", "An entry queue followed on the phone instead of a crowd at the gate."],
      ["Private businesses", "Beach clubs, restaurants, clinics. Let your customers look around while they wait."],
      ["Queue status from afar", "Every point has its own address. See how busy it is before you set off."],
    ],
    rulesTitle: "Same rules for everyone",
    rules: [
      ["No joining from home", "You have to be there to join. The phone's location is checked."],
      ["Screenshots don't work", "The QR code refreshes within seconds. A photo shared in a group chat won't get anyone in."],
      ["One phone, one place", "The same phone can't take a second number. Group size has an upper limit too."],
      ["Nobody without a phone is left out", "The attendant adds people without a smartphone with one tap and tells them their number."],
    ],
    adminTitle: "Easy to run, too",
    adminList: [
      "Enter how many people left, and the system calls the next ones itself.",
      "Drop a no-show with one tap and their place goes to the next group.",
      "Each point is picked on the map and gets its own web address.",
      "The attendant panel opens on a tablet or phone, no installation needed.",
    ],
    contactTitle: "Let's set up your queue",
    contactText: "Want a queue system for your beach, business or event? Write to us and we'll set it up together.",
  },
  de: {
    title: "QRWait · Virtuelle Warteschlange per QR-Code",
    signup: "Kostenlos registrieren",
    freeNote: "Richten Sie Ihre eigene Warteschlange in wenigen Minuten ein. Die ersten 1000 Tickets sind kostenlos, keine Kreditkarte nötig.",
    heroTitle: "Nummer ziehen, das Warten übernimmt Ihr Handy.",
    heroText: "Am Strand, am Anleger, am Serviceschalter. QR-Code scannen, anstellen, und Ihr Handy vibriert, wenn Sie an der Reihe sind. Keine App nötig.",
    findNear: "Warteschlangen in meiner Nähe",
    steps: ["3 Gruppen vor Ihnen", "2 Gruppen vor Ihnen", "1 Gruppe vor Ihnen", "Sie sind als Nächstes dran"],
    done: "Sie sind dran! Zeigen Sie dem Personal Ihre Nummer.",
    ticketAria: "Beispiel-Warteticket, zum erneuten Abspielen tippen",
    nearTitle: "Warteschlangen in Ihrer Nähe",
    sortByLoc: "Nach meinem Standort sortieren",
    noteStart: "Tippen Sie auf einen Ort, um die Warteschlange zu sehen. Mit Ihrem Standort erscheinen die nächstgelegenen zuerst.",
    noteNear: "Die nächstgelegenen zuerst. Tippen Sie auf einen Ort, um die Warteschlange zu sehen.",
    noneNear: (d) => `In Ihrer Nähe gibt es noch keine Warteschlange. Die nächste ist ${d} entfernt.`,
    here: "Sie sind hier",
    mapAria: "Karte der Warteschlangen",
    loadFail: "Warteschlangen konnten nicht geladen werden. Bitte laden Sie die Seite neu.",
    loading: "Warteschlangen werden geladen…",
    none: "Noch keine Warteschlangen.",
    seeStatus: "Status ansehen",
    howTitle: "Nie mehr Schlange stehen",
    how: [
      ["QR-Code scannen", "Scannen Sie den Code auf dem Bildschirm des Personals mit der Handykamera. Wählen Sie auf der Seite, wie viele Sie sind, und stellen Sie sich an."],
      ["Platz verfolgen", "Sehen Sie live, wie viele noch vor Ihnen sind. Setzen Sie sich solange in den Schatten und trinken Sie einen Tee – niemand nimmt Ihnen den Platz weg."],
      ["Kommen, wenn Sie dran sind", "Ihr Handy vibriert, der Bildschirm wird grün. Zeigen Sie dem Personal Ihre Nummer und nehmen Sie Ihren Platz ein."],
    ],
    useTitle: "Überall, wo gewartet wird",
    uses: [
      ["Strände und Pools", "Geordnete Warteschlange statt Streit um Plätze, wenn Liegen und Flächen voll sind. Gruppen wählen, mit wie vielen Liegen sie zufrieden sind – 4 Personen kommen auch mit 2 aus."],
      ["Anleger und Busschlangen", "Kommt ein Fahrzeug, werden so viele Personen aufgerufen, wie Sitze frei sind; alle anderen bleiben sitzen."],
      ["Städtische Servicestellen", "Kein Gedränge am Schalter – wer dran ist, kommt."],
      ["Einlass bei Events und Festivals", "Eine Einlass-Warteschlange auf dem Handy statt einer Menge am Tor."],
      ["Private Betriebe", "Beach Club, Restaurant, Klinik. Ihre Kunden können sich beim Warten umsehen."],
      ["Status aus der Ferne", "Jeder Ort hat seine eigene Adresse. Sehen Sie vor dem Losgehen, wie voll es ist."],
    ],
    rulesTitle: "Gleiche Regeln für alle",
    rules: [
      ["Kein Anstellen von zu Hause", "Zum Anstellen muss man vor Ort sein. Der Standort des Handys wird geprüft."],
      ["Screenshots nützen nichts", "Der QR-Code erneuert sich innerhalb von Sekunden. Mit einem in Gruppen geteilten Foto kann sich niemand anstellen."],
      ["Ein Handy, ein Platz", "Mit demselben Handy gibt es keine zweite Nummer. Auch die Gruppengröße ist begrenzt."],
      ["Ohne Handy bleibt niemand draußen", "Das Personal fügt Menschen ohne Smartphone mit einem Tippen hinzu und nennt ihnen ihre Nummer."],
    ],
    adminTitle: "Auch einfach zu verwalten",
    adminList: [
      "Geben Sie ein, wie viele Personen gegangen sind – das System ruft die Nächsten selbst auf.",
      "Wer nicht erscheint, wird mit einem Tippen entfernt; der Platz geht an die Nächsten.",
      "Jeder Ort wird auf der Karte gewählt und erhält eine eigene Webadresse.",
      "Das Personal-Panel läuft auf Tablet oder Handy, ohne Installation.",
    ],
    contactTitle: "Lassen Sie uns Ihre Warteschlange einrichten",
    contactText: "Sie möchten ein Warteschlangensystem für Ihren Strand, Ihren Betrieb oder Ihr Event? Schreiben Sie uns – wir richten es gemeinsam ein.",
  },
  ru: {
    title: "QRWait · Электронная очередь по QR-коду",
    signup: "Зарегистрироваться бесплатно",
    freeNote: "Создайте свою очередь за несколько минут. Первые 1000 билетов бесплатно, карта не нужна.",
    heroTitle: "Возьмите номер — ждать будет ваш телефон.",
    heroText: "На пляже, на пристани, в пункте обслуживания. Отсканируйте QR-код, встаньте в очередь, и телефон завибрирует, когда подойдёт ваша очередь. Приложение не нужно.",
    findNear: "Найти очереди рядом",
    steps: ["Перед вами 3 группы", "Перед вами 2 группы", "Перед вами 1 группа", "Вы следующий, будьте готовы"],
    done: "Ваша очередь! Покажите номер сотруднику.",
    ticketAria: "Пример талона очереди, нажмите, чтобы повторить",
    nearTitle: "Очереди рядом с вами",
    sortByLoc: "Сортировать по моему местоположению",
    noteStart: "Нажмите на место, чтобы увидеть очередь. Если поделитесь местоположением, ближайшие будут сверху.",
    noteNear: "Ближайшие сверху. Нажмите на место, чтобы увидеть очередь.",
    noneNear: (d) => `Рядом с вами очередей пока нет. Ближайшая — в ${d}.`,
    here: "Вы здесь",
    mapAria: "Карта очередей",
    loadFail: "Не удалось загрузить очереди. Обновите страницу.",
    loading: "Загрузка очередей…",
    none: "Очередей пока нет.",
    seeStatus: "Посмотреть очередь",
    howTitle: "Больше не нужно стоять в очереди",
    how: [
      ["Отсканируйте QR-код", "Отсканируйте камерой телефона код на экране сотрудника. На открывшейся странице укажите, сколько вас, и встаньте в очередь."],
      ["Следите за очередью", "В реальном времени видно, сколько человек перед вами. А пока посидите в тени и выпейте чаю — ваше место никто не займёт."],
      ["Приходите, когда подойдёт очередь", "Телефон завибрирует, экран станет зелёным. Покажите номер сотруднику и занимайте место."],
    ],
    useTitle: "Везде, где приходится ждать",
    uses: [
      ["Пляжи и бассейны", "Порядок вместо споров за место, когда шезлонги и площадь заняты. Группы выбирают, сколько шезлонгов им подойдёт — 4 человека могут устроиться и на 2."],
      ["Очереди на пристани и к автобусу", "Когда приходит транспорт, вызывают столько людей, сколько есть мест; остальные остаются на месте."],
      ["Муниципальные пункты обслуживания", "Без толпы у окошка — подходят те, чья очередь."],
      ["Вход на мероприятия и фестивали", "Очередь на вход в телефоне вместо толпы у ворот."],
      ["Частный бизнес", "Бич-клуб, ресторан, клиника. Пока клиенты ждут, они могут прогуляться."],
      ["Состояние очереди издалека", "У каждой точки свой адрес. Посмотрите, насколько там людно, ещё до выхода из дома."],
    ],
    rulesTitle: "Одни правила для всех",
    rules: [
      ["Из дома в очередь не встать", "Чтобы встать в очередь, нужно быть на месте. Местоположение телефона проверяется."],
      ["Скриншот не поможет", "QR-код обновляется за секунды. По фото из чата в очередь не встать."],
      ["Один телефон — одно место", "С одного телефона нельзя взять второй номер. Размер группы тоже ограничен."],
      ["Без телефона никто не останется в стороне", "Сотрудник одним нажатием добавляет в очередь людей без смартфона и называет им номер."],
    ],
    adminTitle: "И управлять просто",
    adminList: [
      "Укажите, сколько человек ушло, — система сама вызовет следующих.",
      "Неявившегося можно убрать одним нажатием, его место перейдёт следующим.",
      "Каждая точка выбирается на карте и получает свой веб-адрес.",
      "Панель сотрудника открывается на планшете или телефоне, установка не нужна.",
    ],
    contactTitle: "Давайте создадим вашу очередь",
    contactText: "Хотите систему очереди для вашего пляжа, бизнеса или мероприятия? Напишите нам — настроим вместе.",
  },
});
if (lang !== "tr") document.title = T.title;

// Fişteki tek animasyon: sıra ilerler, sonunda yeşile döner. Hareket azaltma tercihinde son hali gösterilir.
const STEPS = T.steps, DONE = T.done;
function Ticket() {
  const [state, setState] = useState(STEPS[0]);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  function play() {
    timers.current.forEach(clearTimeout);
    setState(STEPS[0]);
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return setState(DONE);
    timers.current = [...STEPS.map((t, i) => setTimeout(() => setState(t), 900 + i * 1100)), setTimeout(() => setState(DONE), 900 + STEPS.length * 1100)];
  }
  useEffect(() => { play(); return () => timers.current.forEach(clearTimeout); }, []);
  const go = state === DONE;
  return (
    <button type="button" onClick={play} aria-label={T.ticketAria}
      className={cn("ticket relative w-[min(340px,100%)] cursor-pointer justify-self-center rounded-md px-8 pt-7 pb-8 text-left transition-[background,color,transform] duration-500",
        go ? "scale-[1.03] rotate-0 bg-success text-white" : "-rotate-3 bg-ticket text-ink")}>
      <span className="text-[.95rem] font-semibold opacity-75">Konyaaltı Halk Plajı</span>
      <div className="mt-2 mb-3 text-[7.5rem] leading-none font-extrabold tracking-[-0.05em] tabular-nums">47</div>
      <p aria-live="polite" className="min-h-[3.2em] border-t-2 border-dashed border-current/35 pt-3.5 text-xl font-semibold">{state}</p>
    </button>
  );
}

// Yakındaki sıralar: harita + mesafeye göre liste
function Nearby() {
  const [rooms, setRooms] = useState<PublicRoom[]>([]);
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [me, setMe] = useState<{ lat: number; lng: number } | null>(null);
  const [note, setNote] = useState(T.noteStart);
  const [locating, setLocating] = useState(false);
  const mapEl = useRef<HTMLDivElement>(null);
  const m = useRef<{ map?: L.Map; me?: L.CircleMarker; markers: Record<string, L.Marker> }>({ markers: {} });

  async function load(fit: boolean) {
    let list: PublicRoom[];
    try { list = await api<PublicRoom[]>("/api/rooms"); } catch { return setFailed(true); }
    setFailed(false);
    setRooms(list);
    setLoaded(true);
    if (fit && list.length) m.current.map?.fitBounds(L.latLngBounds(list.map((r) => [r.lat, r.lng])), { padding: [30, 30] });
    return list;
  }

  async function sortByMe(list = rooms) {
    setLocating(true);
    try {
      const c = await locate(geoErrors);
      const here = { lat: c.latitude, lng: c.longitude }, x = m.current;
      setMe(here);
      x.me ? x.me.setLatLng(here) : (x.me = L.circleMarker(here, { radius: 7, color: "#fff", weight: 3, fillColor: "#2563EB", fillOpacity: 1 }).bindTooltip(T.here).addTo(x.map!));
      const nearest = list.map((r) => ({ r, d: meters(here, r) })).sort((a, b) => a.d - b.d)[0];
      if (nearest && nearest.d > 50000) {
        // Uzaktaysa haritayı kıtalar ölçeğine açma, sıralarda kal
        setNote(T.noneNear(fmtDistL(nearest.d)));
        return;
      }
      if (nearest) x.map!.fitBounds(L.latLngBounds([[here.lat, here.lng], [nearest.r.lat, nearest.r.lng]]), { padding: [40, 40], maxZoom: 16 });
      setNote(T.noteNear);
    } catch (e: any) { setNote(e.message); }
    finally { setLocating(false); }
  }

  useEffect(() => {
    m.current.map = baseMap(mapEl.current!, { scrollWheelZoom: false }).setView([36.86, 30.73], 13);
    load(true).then((list) => navigator.permissions?.query({ name: "geolocation" })
      .then((p) => { if (p.state === "granted") sortByMe(list ?? []); }).catch(() => {}));
    const t = setInterval(() => !document.hidden && load(false), 60000);
    return () => { clearInterval(t); m.current.map?.remove(); m.current = { markers: {} }; };
  }, []);

  // Kategori ikonu, dolgu rengi bekleme durumu (sarı: sıra var, yeşil: sıra yok)
  useEffect(() => {
    const x = m.current;
    for (const r of rooms) {
      const popup = `<b>${catIcon(r.category)} ${esc(r.name)}</b><br>${waitText(r)}<br><a href="${esc(r.link)}">${esc(T.seeStatus)}</a>`;
      const icon = L.divIcon({ className: "", html: `<span class="pin" style="background:${r.waiting ? yellow : green}">${catIcon(r.category)}</span>`, iconSize: [34, 34], iconAnchor: [17, 17], popupAnchor: [0, -14] });
      const k = r.slug ?? r.link;
      x.markers[k] ? x.markers[k].setIcon(icon).setPopupContent(popup)
        : (x.markers[k] = L.marker([r.lat, r.lng], { icon, title: r.name }).bindPopup(popup).addTo(x.map!));
    }
  }, [rooms]);

  const list = rooms.map((r) => ({ r, d: me ? meters(me, r) : 0 }))
    .sort((a, b) => (me ? a.d - b.d : a.r.name.localeCompare(b.r.name, lang)));
  // Listede bir sıranın üzerine gelince haritada göster
  const show = (r: PublicRoom) => m.current.markers[r.slug ?? r.link]?.openPopup();

  return (
    <Section id="yakin">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-4">
        <H2 className="m-0">{T.nearTitle}</H2>
        <Button className={pill} disabled={locating} onClick={() => sortByMe()}>{T.sortByLoc}</Button>
      </div>
      <p className="mb-6 text-ink-soft">{note}</p>
      <div className="grid gap-4 md:grid-cols-[1.4fr_1fr] md:gap-6">
        <div ref={mapEl} role="region" aria-label={T.mapAria} className="z-0 h-[300px] rounded-[20px] border border-line md:h-[480px]" />
        <ol aria-live="polite" className="m-0 list-none overflow-y-auto border-t border-line p-0 md:max-h-[480px]">
          {failed ? <li className="font-semibold text-destructive">{T.loadFail}</li>
            : !loaded ? <li className="text-ink-soft">{T.loading}</li>
            : !list.length ? <li className="text-ink-soft">{T.none}</li>
            : list.map(({ r, d }) => (
              <li key={r.link}>
                <a href={r.link} onMouseOver={() => show(r)} onFocus={() => show(r)}
                  className="flex items-center justify-between gap-3 border-b border-line px-1 py-3.5 no-underline hover:bg-white focus-visible:bg-white">
                  <span>
                    <b className="block text-[1.1rem]">{catIcon(r.category)} {r.name}</b>
                    <span className={cn("text-[.95rem]", r.waiting ? "text-ink-soft" : "font-semibold text-success")}>{waitText(r)}</span>
                  </span>
                  {d ? <span className="text-[1.15rem] font-extrabold whitespace-nowrap tabular-nums">{fmtDistL(d)}</span> : null}
                </a>
              </li>
            ))}
        </ol>
      </div>
    </Section>
  );
}

function HomePage() {
  return (
    <Site>
      <div className="grid items-center gap-10 pt-12 pb-16 md:grid-cols-[1.15fr_1fr] md:gap-12 md:pb-24">
        <div>
          <h1 className="mb-6 text-[clamp(2.5rem,6vw,4.25rem)] leading-[1.02] font-extrabold tracking-[-0.035em]">{T.heroTitle}</h1>
          <p className="mb-8 max-w-[34ch] text-xl text-ink-soft">{T.heroText}</p>
          <div className="flex flex-wrap gap-3">
            <Button asChild className={cn(pill, solid)}><a href="#yakin">{T.findNear}</a></Button>
            <Button asChild className={pill}><a href="/admin#signup">{T.signup}</a></Button>
          </div>
          <p className="mt-4 max-w-[40ch] text-ink-soft">{T.freeNote}</p>
        </div>
        <Ticket />
      </div>

      <Nearby />

      <Section id="nasil">
        <H2>{T.howTitle}</H2>
        <ol className="steps m-0 grid list-none gap-7 p-0 md:grid-cols-3 md:gap-10">
          {T.how.map(([t, d]) => <li key={t}><h3 className="mb-1.5 text-xl font-semibold tracking-[-0.01em]">{t}</h3><p className="text-ink-soft">{d}</p></li>)}
        </ol>
      </Section>

      <Section>
        <H2>{T.useTitle}</H2>
        <dl className="m-0 grid md:grid-cols-2 md:gap-x-12">
          {T.uses.map(([t, d]) => (
            <div key={t} className="border-b border-line py-5">
              <dt className="text-[1.15rem] font-semibold">{t}</dt>
              <dd className="mt-1 text-ink-soft">{d}</dd>
            </div>
          ))}
        </dl>
      </Section>

      <Section>
        <H2>{T.rulesTitle}</H2>
        <div className="grid gap-x-12 gap-y-9 md:grid-cols-2">
          {T.rules.map(([t, d]) => (
            <div key={t} className="border-l-4 border-ticket-edge pl-5">
              <h3 className="mb-1.5 text-xl font-semibold tracking-[-0.01em]">{t}</h3>
              <p className="text-ink-soft">{d}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section>
        <div className="grid items-start gap-10 md:grid-cols-2 md:gap-12">
          <H2 className="m-0">{T.adminTitle}</H2>
          <ul className="m-0 grid gap-3 pl-[1.2em] text-ink-soft [list-style:disc]">
            {T.adminList.map((x) => <li key={x}>{x}</li>)}
          </ul>
        </div>
      </Section>

      <section id="iletisim" className="mt-10 mb-20 rounded-[20px] bg-ink px-6 py-10 text-white md:rounded-[28px] md:px-12 md:py-16">
        <H2 className="mb-4">{T.contactTitle}</H2>
        <p className="mb-8 max-w-[46ch] text-[1.15rem] text-[#C9D2E3]">{T.contactText}</p>
        <Button asChild className={cn(pill, "mb-8 border-ticket bg-ticket text-ink hover:bg-ticket/90")}><a href="/admin#signup">{T.signup}</a></Button>
        <a className="inline-block text-[clamp(1.4rem,4vw,2.4rem)] font-extrabold tracking-[-0.02em] break-all text-ticket underline decoration-3 underline-offset-6" href="mailto:hello@qrwait.app">hello@qrwait.app</a>
      </section>
    </Site>
  );
}

mount(<HomePage />);
