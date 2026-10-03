import { ChevronDownIcon, PauseIcon, PlayIcon } from "lucide-react";
import { QRCodeCanvas } from "qrcode.react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useConfirm } from "@/components/confirm";
import { AcceptPicker, SizeSelect, ZonePicker } from "@/components/group";
import { ErrorText, Page, Title } from "@/components/page";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { api, live, mins, type AdminState, type Entry } from "@/lib/api";
import { deskLabel, fmtOpens, geoErrors, lang, LANGS, pick, pl, S, tableLabel, type Lang } from "@/lib/i18n";
import { mount } from "@/lib/mount";
import { cn } from "@/lib/utils";

// Hash: "<slug veya id>.<anahtar>" ya da yalnızca "<anahtar>". Eski <slug>.qrwait.app/host#<anahtar> linki
// yeni adrese ?r=<slug> ile yönlenir.
const hash = location.hash.slice(1), dot = hash.indexOf(".");
const ref = dot < 0 ? new URLSearchParams(location.search).get("r") ?? "" : hash.slice(0, dot), key = hash.slice(dot + 1);
let room = ""; // açılışta çözülen oda id'si; slug sonradan değişse de açık panel çalışmaya devam eder

// QR'ın altındaki çağrı ziyaretçiye: görevlinin dili önde, diğer diller altında küçük
const SCAN: Record<Lang, string> = {
  tr: "Sıraya girmek için telefon kameranızla okutun",
  en: "Scan with your phone camera to join the queue",
  de: "Mit der Handykamera scannen, um sich anzustellen",
  ru: "Отсканируйте камерой телефона, чтобы встать в очередь",
};

const T = pick({
  tr: {
    title: "Görevli paneli",
    badLink: (m: string) => `Geçersiz görevli bağlantısı: ${m}`,
    people: (n: number) => `${n} kişi`,
    seats: (n: number) => `${n} kişilik`,
    places: (n: number) => `${n} yer`,
    acceptOk: (list: string) => `${list} yer olur`,
    manual: "elle",
    ago: (n: number) => `${n} dk önce`,
    online: "sayfası açık",
    seen: (n: number) => (n < 1 ? "az önce görüldü" : n < 60 ? `${n} dk önce görüldü` : "1 saattir görülmedi"),
    pushOn: "Bildirim açık: sayfası kapalıyken de çağrıdan haberi olur",
    pushOff: "Bildirim kapalı: yalnızca sayfası açıkken çağrıdan haberi olur",
    remain: (n: number) => (n < 1 ? "1 dk'dan az kaldı" : `${n} dk kaldı`),
    min: (n: number) => `${n} dk`,
    waitingSum: (g: number, p: number) => `${g} grup / ${p} kişi bekliyor`,
    added: (n: number) => `Sıra numarası: ${n}`,
    tellThem: "Kişiye söyleyin.",
    seated: (t: string, n: number) => `${t} → #${n} çağrıldı.`,
    noFit: (t: string) => `${t} için uygun grup yok. Boş masalarda bekliyor, uygun grup gelince otomatik çağrılır.`,
    staticQr: "Bu QR sabittir, değişmez. Yazdırıp sıranın başına asabilirsiniz.",
    hereOn: "📍 Konumunuz alındı: ziyaretçiler yalnızca yakınınızdayken sıraya girebilir.",
    pause: "Girişleri durdur",
    resume: "Girişleri aç",
    pausedNote: "Yeni katılım durduruldu. Sıradakiler çağrılmaya devam eder.",
    hoursNote: (w: string) => `Katılım saatleri dışında: yeni katılım kapalı. Yeniden açılış: ${w}.`,
    fullNote: (n: number) => `Sıra dolu (en fazla ${n} grup): yeni katılım kapalı.`,
    keepOpenTitle: "Bu sayfayı açık tutun",
    keepOpen: "Konum kontrolü bu cihazın konumuna göre yapılıyor. Sayfa kapanırsa, ekran kilitlenirse ya da konum servisleri kapanırsa birkaç dakika içinde kimse sıraya giremez.",
    keepOpenPrinted: "Basılı QR da yalnızca bu sayfa açıkken çalışır.",
    hereWait: "📍 Konumunuz alınıyor…",
    hereErr: (m: string) => `⚠ ${m} Konumunuz alınamadıkça ziyaretçiler sıraya giremez.`,
    fullscreen: "Tam ekran QR",
    print: "Yazdır",
    tableFreed: "Masa boşaldı",
    tableName: "Masa adı / no (isteğe bağlı, ör. 7 veya Bahçe 3)",
    capPh: "kişi",
    freed: "Boşaldı",
    tableHint: "Sıradaki gruplardan masaya sığan ilk grup çağrılır.",
    maxEmpty: (n: number) => ` Masada en fazla ${n} boş sandalye kalacak şekilde.`,
    joinTables: "Birleştirdiğiniz masaları toplam kişi sayısıyla girin.",
    freeTables: "Boş masalar (uygun grup bekliyor)",
    remove: "Kaldır",
    desksTitle: "Gişeler",
    thisDevice: "Bu cihazın gişesi",
    allDesks: "Tüm gişeler",
    nextBtn: "Sıradakini çağır",
    idle: "Boşta: sıraya ilk giren buraya çağrılacak",
    deskHint: "Sıradakini çağırınca bu gişede önceki çağrılan grup gelmiş sayılır.",
    freedSeats: "Boşalan yer sayısı",
    zoneQ: "Hangi bölgede?",
    addZonesQ: "Hangi bölgeler olur?",
    callNext: "Yer boşaldı, sıradakileri çağır",
    available: (n: number) => <>Ayrılmayı bekleyen boş yer: <b>{n}</b> (sıradaki grup sığmıyor)</>,
    reset: "Sıfırla",
    called: "Çağrılanlar",
    arrived: "Geldi",
    noShow: "Gelmedi",
    none: "Yok",
    waiting: "Bekleyenler",
    call: "Çağır",
    del: "Sil",
    empty: "Sıra boş",
    addTitle: "Elle ekle (telefonu olmayanlar için)",
    notePh: "Not (ör. şapkalı amca)",
    acceptQ: "Kaç yer olursa kabul ediyorlar?",
    add: "Sıraya ekle",
    resetTitle: "Sırayı sıfırla",
    resetAsk: "Tüm sıra silinecek. Emin misiniz?",
    resetBtn: "Sırayı sıfırla (gün sonu)",
  },
  en: {
    title: "Attendant panel",
    badLink: (m: string) => `Invalid attendant link: ${m}`,
    people: (n: number) => pl(n, { one: "person", other: "people" }),
    seats: (n: number) => `seats ${n}`,
    places: (n: number) => pl(n, { one: "place", other: "places" }),
    acceptOk: (list: string) => `${list} places OK`,
    manual: "added manually",
    ago: (n: number) => `${n} min ago`,
    online: "page open",
    seen: (n: number) => (n < 1 ? "seen just now" : n < 60 ? `seen ${n} min ago` : "not seen for 1 hour"),
    pushOn: "Notifications on: they'll hear about the call even with the page closed",
    pushOff: "Notifications off: they'll only hear about the call while the page is open",
    remain: (n: number) => (n < 1 ? "under 1 min left" : `${n} min left`),
    min: (n: number) => `${n} min`,
    waitingSum: (g: number, p: number) => `${pl(g, { one: "group", other: "groups" })} / ${pl(p, { one: "person", other: "people" })} waiting`,
    added: (n: number) => `Queue number: ${n}`,
    tellThem: "Tell the person their number.",
    seated: (t: string, n: number) => `${t} → #${n} called.`,
    noFit: (t: string) => `No suitable group for ${t}. It waits among the free tables and is assigned automatically when a suitable group arrives.`,
    staticQr: "This QR code is fixed and doesn't change. You can print it and post it at the queue.",
    hereOn: "📍 Location found: visitors can only join while near you.",
    pause: "Stop new joins",
    resume: "Allow new joins",
    pausedNote: "New joins are stopped. Groups already waiting are still called.",
    hoursNote: (w: string) => `Outside joining hours: no new joins. Opens again: ${w}.`,
    fullNote: (n: number) => `Queue is full (max ${n} groups): no new joins.`,
    keepOpenTitle: "Keep this page open",
    keepOpen: "The location check uses this device's location. If the page closes, the screen locks or location services are turned off, nobody can join within a few minutes.",
    keepOpenPrinted: "A printed QR code also only works while this page is open.",
    hereWait: "📍 Getting your location…",
    hereErr: (m: string) => `⚠ ${m} Visitors can't join until your location is available.`,
    fullscreen: "Full-screen QR",
    print: "Print",
    tableFreed: "Table freed",
    tableName: "Table name / no. (optional, e.g. 7 or Garden 3)",
    capPh: "seats",
    freed: "Freed",
    tableHint: "The first waiting group that fits the table is called.",
    maxEmpty: (n: number) => ` Leaving at most ${n} empty ${n === 1 ? "chair" : "chairs"} at the table.`,
    joinTables: "For tables pushed together, enter the total number of seats.",
    freeTables: "Free tables (waiting for a suitable group)",
    remove: "Remove",
    desksTitle: "Counters",
    thisDevice: "This device's counter",
    allDesks: "All counters",
    nextBtn: "Call next",
    idle: "Free: the next person to join is sent here",
    deskHint: "Calling the next group marks the group previously called to this counter as served.",
    freedSeats: "Places freed",
    zoneQ: "In which area?",
    addZonesQ: "Which areas are fine for them?",
    callNext: "Places freed, call the next ones",
    available: (n: number) => <>Free places not yet assigned: <b>{n}</b> (the next group doesn't fit)</>,
    reset: "Reset",
    called: "Called",
    arrived: "Arrived",
    noShow: "No-show",
    none: "None",
    waiting: "Waiting",
    call: "Call",
    del: "Delete",
    empty: "Queue is empty",
    addTitle: "Add manually (for people without a phone)",
    notePh: "Note (e.g. man with the hat)",
    acceptQ: "How many places would they accept?",
    add: "Add to queue",
    resetTitle: "Reset queue",
    resetAsk: "The whole queue will be deleted. Are you sure?",
    resetBtn: "Reset queue (end of day)",
  },
  de: {
    title: "Personal-Panel",
    badLink: (m: string) => `Ungültiger Personal-Link: ${m}`,
    people: (n: number) => pl(n, { one: "Person", other: "Personen" }),
    seats: (n: number) => `für ${n}`,
    places: (n: number) => pl(n, { one: "Platz", other: "Plätze" }),
    acceptOk: (list: string) => `${list} Plätze möglich`,
    manual: "manuell",
    ago: (n: number) => `vor ${n} Min.`,
    online: "Seite geöffnet",
    seen: (n: number) => (n < 1 ? "gerade eben gesehen" : n < 60 ? `vor ${n} Min. gesehen` : "seit 1 Std. nicht gesehen"),
    pushOn: "Mitteilungen an: erfährt vom Aufruf auch bei geschlossener Seite",
    pushOff: "Mitteilungen aus: erfährt vom Aufruf nur bei geöffneter Seite",
    remain: (n: number) => (n < 1 ? "unter 1 Min. übrig" : `noch ${n} Min.`),
    min: (n: number) => `${n} Min.`,
    waitingSum: (g: number, p: number) => `${pl(g, { one: "Gruppe", other: "Gruppen" })} / ${pl(p, { one: "Person", other: "Personen" })} warten`,
    added: (n: number) => `Wartenummer: ${n}`,
    tellThem: "Nennen Sie der Person ihre Nummer.",
    seated: (t: string, n: number) => `${t} → Nr. ${n} aufgerufen.`,
    noFit: (t: string) => `Keine passende Gruppe für ${t}. Der Tisch wartet bei den freien Tischen und wird automatisch vergeben, sobald eine passende Gruppe kommt.`,
    staticQr: "Dieser QR-Code ist fest und ändert sich nicht. Sie können ihn ausdrucken und an der Warteschlange aushängen.",
    hereOn: "📍 Standort ermittelt: Besucher können sich nur in Ihrer Nähe anstellen.",
    pause: "Anstellen stoppen",
    resume: "Anstellen erlauben",
    pausedNote: "Neues Anstellen ist gestoppt. Wartende Gruppen werden weiter aufgerufen.",
    hoursNote: (w: string) => `Außerhalb der Anstellzeiten: kein neues Anstellen. Wieder geöffnet: ${w}.`,
    fullNote: (n: number) => `Warteschlange voll (max. ${n} Gruppen): kein neues Anstellen.`,
    keepOpenTitle: "Lassen Sie diese Seite geöffnet",
    keepOpen: "Die Standortprüfung nutzt den Standort dieses Geräts. Wird die Seite geschlossen, der Bildschirm gesperrt oder die Ortungsdienste ausgeschaltet, kann sich nach wenigen Minuten niemand mehr anstellen.",
    keepOpenPrinted: "Auch ein ausgedruckter QR-Code funktioniert nur, solange diese Seite geöffnet ist.",
    hereWait: "📍 Ihr Standort wird ermittelt…",
    hereErr: (m: string) => `⚠ ${m} Solange Ihr Standort nicht verfügbar ist, können sich Besucher nicht anstellen.`,
    fullscreen: "QR im Vollbild",
    print: "Drucken",
    tableFreed: "Tisch frei geworden",
    tableName: "Tischname / Nr. (optional, z. B. 7 oder Garten 3)",
    capPh: "Pers.",
    freed: "Frei",
    tableHint: "Die erste wartende Gruppe, die an den Tisch passt, wird aufgerufen.",
    maxEmpty: (n: number) => ` Dabei bleiben höchstens ${n} ${n === 1 ? "Stuhl" : "Stühle"} leer.`,
    joinTables: "Bei zusammengestellten Tischen die Gesamtzahl der Plätze eingeben.",
    freeTables: "Freie Tische (warten auf eine passende Gruppe)",
    remove: "Entfernen",
    desksTitle: "Schalter",
    thisDevice: "Schalter dieses Geräts",
    allDesks: "Alle Schalter",
    nextBtn: "Nächste aufrufen",
    idle: "Frei: Wer sich als Nächstes anstellt, wird hierher gerufen",
    deskHint: "Beim Aufrufen der nächsten Gruppe gilt die zuvor an diesen Schalter gerufene Gruppe als bedient.",
    freedSeats: "Frei gewordene Plätze",
    zoneQ: "In welchem Bereich?",
    addZonesQ: "Welche Bereiche passen für sie?",
    callNext: "Plätze frei, Nächste aufrufen",
    available: (n: number) => <>Noch nicht vergebene freie Plätze: <b>{n}</b> (die nächste Gruppe passt nicht)</>,
    reset: "Zurücksetzen",
    called: "Aufgerufen",
    arrived: "Gekommen",
    noShow: "Nicht erschienen",
    none: "Keine",
    waiting: "Wartend",
    call: "Aufrufen",
    del: "Löschen",
    empty: "Warteschlange ist leer",
    addTitle: "Manuell hinzufügen (für Personen ohne Handy)",
    notePh: "Notiz (z. B. Mann mit Hut)",
    acceptQ: "Wie viele Plätze würden sie akzeptieren?",
    add: "Hinzufügen",
    resetTitle: "Warteschlange zurücksetzen",
    resetAsk: "Die gesamte Warteschlange wird gelöscht. Sind Sie sicher?",
    resetBtn: "Warteschlange zurücksetzen (Tagesende)",
  },
  ru: {
    title: "Панель сотрудника",
    badLink: (m: string) => `Недействительная ссылка сотрудника: ${m}`,
    people: (n: number) => pl(n, { one: "человек", few: "человека", many: "человек", other: "человека" }),
    seats: (n: number) => `на ${n}`,
    places: (n: number) => pl(n, { one: "место", few: "места", many: "мест", other: "места" }),
    acceptOk: (list: string) => `подойдёт мест: ${list}`,
    manual: "добавлен вручную",
    ago: (n: number) => `${n} мин назад`,
    online: "страница открыта",
    seen: (n: number) => (n < 1 ? "был(а) только что" : n < 60 ? `был(а) ${n} мин назад` : "не появлялся(-ась) больше часа"),
    pushOn: "Уведомления включены: узнает о вызове, даже если страница закрыта",
    pushOff: "Уведомления выключены: узнает о вызове, только пока страница открыта",
    remain: (n: number) => (n < 1 ? "меньше 1 мин" : `осталось ${n} мин`),
    min: (n: number) => `${n} мин`,
    waitingSum: (g: number, p: number) => `Ждут: ${pl(g, { one: "группа", few: "группы", many: "групп", other: "группы" })} / ${pl(p, { one: "человек", few: "человека", many: "человек", other: "человека" })}`,
    added: (n: number) => `Номер в очереди: ${n}`,
    tellThem: "Сообщите человеку его номер.",
    seated: (t: string, n: number) => `${t} → вызван № ${n}.`,
    noFit: (t: string) => `Для «${t}» нет подходящей группы. Стол ждёт среди свободных и будет отдан автоматически, когда придёт подходящая группа.`,
    staticQr: "Этот QR-код постоянный и не меняется. Его можно распечатать и повесить у очереди.",
    hereOn: "📍 Местоположение получено: встать в очередь можно только рядом с вами.",
    pause: "Остановить запись",
    resume: "Возобновить запись",
    pausedNote: "Запись новых посетителей остановлена. Ожидающие группы по-прежнему вызываются.",
    hoursNote: (w: string) => `Вне времени записи: новых посетителей нет. Снова откроется: ${w}.`,
    fullNote: (n: number) => `Очередь заполнена (макс. ${n} групп): новых посетителей нет.`,
    keepOpenTitle: "Не закрывайте эту страницу",
    keepOpen: "Проверка идёт по местоположению этого устройства. Если страница закроется, экран заблокируется или службы геолокации выключатся, через несколько минут встать в очередь будет нельзя.",
    keepOpenPrinted: "Распечатанный QR-код тоже работает только пока эта страница открыта.",
    hereWait: "📍 Определяем ваше местоположение…",
    hereErr: (m: string) => `⚠ ${m} Пока ваше местоположение недоступно, посетители не смогут встать в очередь.`,
    fullscreen: "QR на весь экран",
    print: "Печать",
    tableFreed: "Стол освободился",
    tableName: "Название / № стола (необязательно, напр. 7 или Сад 3)",
    capPh: "мест",
    freed: "Свободен",
    tableHint: "Вызывается первая ожидающая группа, которая помещается за стол.",
    maxEmpty: (n: number) => ` При этом свободными остаётся не более ${pl(n, { one: "стула", few: "стульев", many: "стульев", other: "стула" })}.`,
    joinTables: "Для составленных вместе столов укажите общее число мест.",
    freeTables: "Свободные столы (ждут подходящую группу)",
    remove: "Убрать",
    desksTitle: "Окна",
    thisDevice: "Окно этого устройства",
    allDesks: "Все окна",
    nextBtn: "Вызвать следующего",
    idle: "Свободно: следующий вставший в очередь будет вызван сюда",
    deskHint: "При вызове следующей группы ранее вызванная к этому окну группа считается обслуженной.",
    freedSeats: "Освободилось мест",
    zoneQ: "В какой зоне?",
    addZonesQ: "Какие зоны им подходят?",
    callNext: "Места освободились, вызвать следующих",
    available: (n: number) => <>Свободные нераспределённые места: <b>{n}</b> (следующая группа не помещается)</>,
    reset: "Сбросить",
    called: "Вызванные",
    arrived: "Пришёл",
    noShow: "Не пришёл",
    none: "Нет",
    waiting: "Ожидают",
    call: "Вызвать",
    del: "Удалить",
    empty: "Очередь пуста",
    addTitle: "Добавить вручную (для тех, у кого нет телефона)",
    notePh: "Заметка (напр. мужчина в шляпе)",
    acceptQ: "Какое количество мест им подойдёт?",
    add: "Добавить в очередь",
    resetTitle: "Сбросить очередь",
    resetAsk: "Вся очередь будет удалена. Вы уверены?",
    resetBtn: "Сбросить очередь (конец дня)",
  },
});

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Card className="print:hidden">
      <CardHeader><CardTitle className="text-lg font-semibold">{title}</CardTitle></CardHeader>
      <CardContent className="text-base">{children}</CardContent>
    </Card>
  );
}

// Ziyaretçi sayfası canlı bağlantıda 25 sn'de bir ping atar (yoksa 10 sn'de bir yoklar); son sinyal bundan yeniyse sayfası açık sayılır.
// Sayfa ekrandan kalkınca (ekran kilidi, başka uygulama) sunucu o anı son görülme olarak gönderir.
const ACTIVE = 60000;

// Yer bilgisi: çağrılanda ayrılan yer, bekleyende (kişi sayısından farklıysa) kabul edilen yerler
// wait: süreli sırada gelme süresi (dk); skew: sunucu saati - bu cihazın saati
// QR ile girenlerde ulaşılabilirlik: sayfa son yoklamadan beri açık mı, bildirim açık mı (kararı görevli verir)
function Row({ e, wait, skew, children }: { e: Entry; wait?: number | null; skew?: number; children: ReactNode }) {
  const left = wait && e.calledAt ? Math.floor((e.calledAt + wait * 60000 - Date.now() - (skew ?? 0)) / 60000) : null;
  const away = e.seen ? Date.now() + (skew ?? 0) - e.seen : null, online = away !== null && !e.hidden && away < ACTIVE;
  const late = left !== null ? left < 1 : e.calledAt && mins(e.calledAt) >= 10;
  return (
    <div className="flex items-center gap-2 border-b py-2 last:border-0">
      <b className="min-w-[3.5em] tabular-nums">#{e.no}</b>
      <span className="flex-1">
        {T.people(e.size)}
        {e.desk ? <> · <b>{deskLabel(e.desk)}</b></>
          : e.table ? <> · <b>{tableLabel(e.table)}</b>{e.table.name && ` (${T.seats(e.table.cap)})`}</>
          : e.status === "called" ? e.alloc != null && <> · <b>{T.places(e.alloc)}</b></>
          : e.accept && (e.accept.length > 1 || e.accept[0] !== e.size) ? ` · ${T.acceptOk(e.accept.join("/"))}` : ""}
        {e.zone ? <> · <b>{e.zone}</b></> : e.zones && ` · ${e.zones.join("/")}`}
        {e.src === "manual" && ` · ${T.manual}`}
        {away !== null && <> · <span className={cn(!online && "text-muted-foreground")}>{online ? `🟢 ${T.online}` : T.seen(Math.floor(away / 60000))}</span></>}
        {e.notify !== undefined && <> · <span title={e.notify ? T.pushOn : T.pushOff} aria-label={e.notify ? T.pushOn : T.pushOff}>{e.notify ? "🔔" : "🔕"}</span></>}
        {e.note && ` · ${e.note}`}
        {e.calledAt && <> · <span className={cn(late && "font-bold text-destructive")}>{left !== null ? T.remain(left) : T.ago(mins(e.calledAt))}</span></>}
      </span>
      {children}
    </div>
  );
}

// Görevlinin boşalan yeri / masayı girdiği bölge
function ZoneTabs({ zones, value, onChange }: { zones: string[]; value: string; onChange: (z: string) => void }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-sm text-muted-foreground">{T.zoneQ}</span>
      {zones.map((z) => (
        <Button key={z} size="sm" variant={z === value ? "default" : "secondary"} aria-pressed={z === value} onClick={() => onChange(z)}>{z}</Button>
      ))}
    </div>
  );
}

document.title = T.title;

function HostPage() {
  const confirm = useConfirm();
  const [s, setS] = useState<AdminState>();
  const [err, setErr] = useState("");
  const [qrUrl, setQrUrl] = useState("");
  const [full, setFull] = useState(false);
  const [freeN, setFreeN] = useState("1");
  const [tName, setTName] = useState("");
  const [tCap, setTCap] = useState("");
  const [tMsg, setTMsg] = useState("");
  const [addSize, setAddSize] = useState(2);
  const [addAccept, setAddAccept] = useState([2]);
  const [addNote, setAddNote] = useState("");
  const [addZones, setAddZones] = useState<string[]>([]);
  const [zone, setZone] = useState(""); // bölgeli sırada boşalan yerin / masanın bölgesi
  // Gişe modunda bu cihazın gişesi (hatırlanır); boş: tüm gişeler bu panelden yönetilir
  const [myDesk, setMyDesk] = useState(() => localStorage.getItem(`desk:${ref}`) ?? "");
  const qr = useRef({ at: 0, text: "" });
  const skew = useRef(0);
  // Dinamik konumda görevlinin son konumu; her yoklamayla odaya gider
  const here = useRef<{ lat: number; lng: number } | null>(null);
  const [hereErr, setHereErr] = useState("");

  async function act(body: Record<string, unknown> = {}) {
    try {
      const st = await api<AdminState>(`/api/r/${room}/admin`, { ...body, here: here.current }, { "x-key": key });
      // Değişen QR: sürenin dörtte birinde bir yeni kod (okutana sürenin en az 3/4'ü kalır). Sabit QR: yalnızca değişirse.
      const fixed = st.qr === "static", q = qr.current;
      if (fixed ? st.token !== q.text : q.text.startsWith("s.") || Date.now() - q.at > st.ttl * 250) {
        setQrUrl(`${location.origin}/join?${ref ? `r=${ref}&` : ""}t=${st.token}`);
        qr.current = { at: Date.now(), text: st.token };
      }
      setS(st);
      skew.current = st.now - Date.now();
      setErr("");
      return st;
    } catch (e: any) { setErr(e.message); }
  }

  useEffect(() => {
    let stop = () => {};
    api<{ room: string }>(`/api/resolve?r=${encodeURIComponent(ref)}`)
      // Değişiklikler canlı bağlantıdan "yenile" sinyaliyle gelir; 10 sn'lik yoklama dinamik QR'ı yeniler
      .then((r) => { room = r.room; act(); stop = live(`/api/r/${room}/live`, () => act(), act, { ms: 4000, slow: 10000, hidden: true, hello: { key } }); })
      .catch((e) => setErr(T.badLink(e.message)));
    return () => stop();
  }, []);

  // Konum yalnızca dinamik konumlu sırada izlenir; ayar değişirse panel yeni yoklamada başlar/bırakır
  const dynamic = s?.geo === "dynamic";
  useEffect(() => {
    if (!dynamic) return;
    if (!navigator.geolocation) return setHereErr(geoErrors.unsupported);
    const id = navigator.geolocation.watchPosition((p) => {
      const first = !here.current;
      here.current = { lat: p.coords.latitude, lng: p.coords.longitude };
      setHereErr("");
      if (first) act(); // ziyaretçiler 4 sn beklemesin
    }, () => { here.current = null; setHereErr(geoErrors.denied); }, // eski konum tazeymiş gibi gönderilmesin
    { enableHighAccuracy: true, maximumAge: 10000 });
    return () => { navigator.geolocation.clearWatch(id); here.current = null; };
  }, [dynamic]);

  useEffect(() => {
    if (!s) return;
    setAddSize((n) => Math.min(n, s.maxGroup));
    setAddAccept((a) => a.filter((n) => n <= s.maxGroup));
  }, [s?.maxGroup]);

  async function add() {
    const st = await act({ action: "add", size: addSize, accept: addAccept, note: addNote, zones: addZones });
    if (st?.added) {
      setAddNote("");
      await confirm({ title: T.added(st.added), description: T.tellThem, cancel: false });
    }
  }

  async function freeTable(n: number) {
    if (!(n >= 1)) return;
    const label = [tableLabel({ cap: n, name: tName.trim() }), curZone].filter(Boolean).join(" · ");
    const st = await act({ action: "table", n, name: tName, zone: curZone });
    if (!st) return;
    setTName(""); setTCap("");
    setTMsg(st.seated ? T.seated(label, st.seated) : T.noFit(label));
  }

  const waiting = s?.entries.filter((e) => e.status === "waiting") ?? [];
  const called = s?.entries.filter((e) => e.status === "called") ?? [];
  const fixed = s?.qr === "static";
  const desks = s?.mode === "desks";
  const zones = s?.zones ?? [], curZone = zones.includes(zone) ? zone : zones[0];
  const shownDesks = s && desks ? (s.desks.includes(myDesk) ? [myDesk] : s.desks) : [];
  const pickDesk = (d: string) => { setMyDesk(d); localStorage.setItem(`desk:${ref}`, d); };

  return (
    <Page>
      <div className="flex flex-wrap items-center gap-2">
        <Title className="flex-1">{s?.name ?? T.title}</Title>
        {s && (
          <Button variant={s.paused ? "default" : "secondary"} className="print:hidden" onClick={() => act({ action: s.paused ? "resume" : "pause" })}>
            {s.paused ? <PlayIcon /> : <PauseIcon />} {s.paused ? T.resume : T.pause}
          </Button>
        )}
      </div>
      {s && <p className="text-sm text-muted-foreground print:hidden">{T.waitingSum(waiting.length, waiting.reduce((n, e) => n + e.size, 0))}</p>}
      {s && (s.paused || !s.open || s.full) && (
        <p className="rounded-lg border border-destructive p-3 text-sm font-semibold text-destructive print:hidden">
          {s.paused ? T.pausedNote : !s.open && s.opens ? T.hoursNote(fmtOpens(s.opens)) : T.fullNote(s.cap ?? 0)}
        </p>
      )}
      <ErrorText>{err}</ErrorText>
      {dynamic && (
        <Alert className="border-amber-400 bg-amber-50 text-base print:hidden">
          <AlertTitle className="font-semibold">{T.keepOpenTitle}</AlertTitle>
          <AlertDescription>{T.keepOpen}{fixed && ` ${T.keepOpenPrinted}`}</AlertDescription>
        </Alert>
      )}

      <Card className={cn("print:shadow-none print:ring-0", full && "fixed inset-0 z-50 justify-center rounded-none")}>
        <CardContent className="flex flex-col items-center gap-3 text-center text-base">
          {qrUrl && <QRCodeCanvas value={qrUrl} size={360} level="M" marginSize={0} className="h-auto! max-w-full" />}
          <div>
            <p><b>{SCAN[lang]}</b></p>
            {LANGS.filter((l) => l !== lang).map((l) => <p key={l} lang={l} className="text-sm text-muted-foreground">{SCAN[l]}</p>)}
          </div>
          {fixed && <p className="text-sm text-muted-foreground print:hidden">{T.staticQr}</p>}
          {dynamic && (
            <p className={cn("text-sm print:hidden", hereErr ? "font-semibold text-destructive" : "text-muted-foreground")}>
              {hereErr ? T.hereErr(hereErr) : here.current ? T.hereOn : T.hereWait}
            </p>
          )}
          <div className="flex w-full gap-2 print:hidden">
            <Button variant="secondary" className="flex-1" onClick={() => setFull(!full)}>{T.fullscreen}</Button>
            {fixed && <Button variant="secondary" className="flex-1" onClick={() => print()}>{T.print}</Button>}
          </div>
        </CardContent>
      </Card>

      {s?.tables && (
        <Section title={T.tableFreed}>
          <div className="flex flex-col gap-3">
            {!!zones.length && <ZoneTabs zones={zones} value={curZone} onChange={setZone} />}
            <Input placeholder={T.tableName} maxLength={20} value={tName} onChange={(e) => setTName(e.target.value)} />
            <div className="flex flex-wrap gap-2 *:flex-auto">
              {[2, 4, 6].map((n) => <Button key={n} onClick={() => freeTable(n)}>{T.seats(n)}</Button>)}
              <div className="flex gap-2">
                <Input className="w-20" type="number" min={1} max={50} inputMode="numeric" placeholder={T.capPh} value={tCap} onChange={(e) => setTCap(e.target.value)} />
                <Button variant="secondary" onClick={() => freeTable(+tCap)}>{T.freed}</Button>
              </div>
            </div>
            <p className="text-sm text-muted-foreground">
              {T.tableHint}
              {s.maxEmpty !== null && T.maxEmpty(s.maxEmpty)}
              {" "}{T.joinTables}
            </p>
            {tMsg && <p className="text-sm font-semibold">{tMsg}</p>}
          </div>
          {!!s.freeTables.length && (
            <div className="mt-3">
              <p className="text-sm text-muted-foreground">{T.freeTables}</p>
              {s.freeTables.map((t) => (
                <div key={t.id} className="flex items-center gap-2 border-b py-2 last:border-0">
                  <span className="flex-1"><b>{tableLabel(t)}</b>{t.name && ` · ${T.seats(t.cap)}`}{t.zone && ` · ${t.zone}`} · {T.min(mins(t.at))}</span>
                  <Button variant="secondary" size="sm" onClick={() => act({ action: "untable", id: t.id })}>{T.remove}</Button>
                </div>
              ))}
            </div>
          )}
        </Section>
      )}

      {desks && s && (
        <Section title={T.desksTitle}>
          <div className="flex flex-col gap-3">
            {s.desks.length > 1 && (
              <label className="flex items-center gap-2 text-sm">
                <span className="text-muted-foreground">{T.thisDevice}</span>
                <NativeSelect className="flex-1" value={s.desks.includes(myDesk) ? myDesk : ""} onChange={(e) => pickDesk(e.target.value)}>
                  <NativeSelectOption value="">{T.allDesks}</NativeSelectOption>
                  {s.desks.map((d) => <NativeSelectOption key={d} value={d}>{deskLabel(d)}</NativeSelectOption>)}
                </NativeSelect>
              </label>
            )}
            {shownDesks.map((d) => {
              const cur = called.find((e) => e.desk === d), idle = s.idle.includes(d);
              return (
                <div key={d} className="flex flex-wrap items-center gap-2 border-b pb-3 last:border-0 last:pb-0">
                  <span className="flex-1">
                    <b>{deskLabel(d)}</b>
                    {cur ? <> · <b className="tabular-nums">#{cur.no}</b></> : idle && <span className="text-sm text-muted-foreground"> · {T.idle}</span>}
                  </span>
                  {idle && <Button variant="secondary" size="sm" onClick={() => act({ action: "undesk", desk: d })}>{S.cancel}</Button>}
                  <Button size={shownDesks.length === 1 ? "lg" : "default"} className={cn(shownDesks.length === 1 && "w-full")}
                    disabled={idle && !waiting.length} onClick={() => act({ action: "next", desk: d })}>{T.nextBtn}</Button>
                </div>
              );
            })}
            <p className="text-sm text-muted-foreground">{T.deskHint}</p>
          </div>
        </Section>
      )}

      {s?.mode === "seats" && <Section title={T.freedSeats}>
        {!!zones.length && <div className="mb-3"><ZoneTabs zones={zones} value={curZone} onChange={setZone} /></div>}
        <div className="flex gap-2">
          <Input className="w-24" type="number" min={1} max={500} inputMode="numeric" value={freeN} onChange={(e) => setFreeN(e.target.value)} />
          <Button className="flex-1 whitespace-normal" onClick={() => act({ action: "free", n: +freeN, zone: curZone })}>{T.callNext}</Button>
        </div>
        {zones.filter((z) => s.spots[z]).map((z) => (
          <p key={z} className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
            <span className="flex-1"><b>{z}</b> · {T.available(s.spots[z])}</span>
            <Button variant="secondary" size="sm" onClick={() => act({ action: "setAvailable", n: 0, zone: z })}>{T.reset}</Button>
          </p>
        ))}
        {!zones.length && !!s?.available && (
          <p className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
            <span className="flex-1">{T.available(s.available)}</span>
            <Button variant="secondary" size="sm" onClick={() => act({ action: "setAvailable", n: 0 })}>{T.reset}</Button>
          </p>
        )}
      </Section>}

      <Section title={T.called}>
        {called.map((e) => (
          <Row key={e.id} e={e} wait={s?.wait} skew={skew.current}>
            <Button variant="success" size="sm" onClick={() => act({ action: "arrived", id: e.id })}>{T.arrived}</Button>
            <Button variant="destructive" size="sm" onClick={() => act({ action: "drop", id: e.id })}>{T.noShow}</Button>
          </Row>
        ))}
        {!called.length && <p className="text-muted-foreground">{T.none}</p>}
      </Section>

      <Section title={T.waiting}>
        {waiting.map((e) => (
          <Row key={e.id} e={e} skew={skew.current}>
            {desks && shownDesks.length > 1 ? (
              <DropdownMenu modal={false}>
                <DropdownMenuTrigger asChild><Button variant="secondary" size="sm">{T.call} <ChevronDownIcon /></Button></DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {shownDesks.map((d) => <DropdownMenuItem key={d} onSelect={() => act({ action: "call", id: e.id, desk: d })}>{deskLabel(d)}</DropdownMenuItem>)}
                </DropdownMenuContent>
              </DropdownMenu>
            ) : <Button variant="secondary" size="sm" onClick={() => act({ action: "call", id: e.id, desk: shownDesks[0] })}>{T.call}</Button>}
            <Button variant="secondary" size="sm" onClick={() => act({ action: "drop", id: e.id })}>{T.del}</Button>
          </Row>
        ))}
        {!waiting.length && <p className="text-muted-foreground">{T.empty}</p>}
      </Section>

      <Section title={T.addTitle}>
        <div className="flex flex-col gap-3">
          <div className="flex gap-2">
            <SizeSelect className="w-24 shrink-0" max={s?.maxGroup ?? 8} value={addSize} onChange={(n) => { setAddSize(n); setAddAccept([n]); }} />
            <Input placeholder={T.notePh} maxLength={60} value={addNote} onChange={(e) => setAddNote(e.target.value)} />
          </div>
          {s?.flex && (
            <div>
              <p className="text-sm text-muted-foreground">{T.acceptQ}</p>
              <AcceptPicker size={addSize} value={addAccept} onChange={setAddAccept} />
            </div>
          )}
          {!!zones.length && (
            <div>
              <p className="text-sm text-muted-foreground">{T.addZonesQ}</p>
              <ZonePicker zones={zones} value={addZones} onChange={setAddZones} />
            </div>
          )}
          <Button onClick={add} disabled={!!zones.length && !addZones.length}>{T.add}</Button>
        </div>
      </Section>

      <Button variant="destructive" className="print:hidden" onClick={async () => {
        if (await confirm({ title: T.resetTitle, description: T.resetAsk, action: T.reset, destructive: true })) act({ action: "reset" });
      }}>{T.resetBtn}</Button>
    </Page>
  );
}

mount(<HostPage />);
