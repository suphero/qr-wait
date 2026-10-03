import { useEffect, useRef, useState, type ReactNode } from "react";
import { useConfirm } from "@/components/confirm";
import { AcceptPicker, SizeSelect, ZonePicker } from "@/components/group";
import { ErrorText, Page, Title } from "@/components/page";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { api, catIcon, locate, poll, type Me, type Status } from "@/lib/api";
import { closedText, deskLabel, fmtWait, geoErrors, lang, orList, pick, pl, S, tableLabel } from "@/lib/i18n";
import { LEGAL, siteUrl } from "@/components/legal";
import { mount } from "@/lib/mount";
import { cn } from "@/lib/utils";

const q = new URLSearchParams(location.search);
const ref = q.get("r") ?? "", token = q.get("t");
let room = "", slot = ""; // açılışta slug/alt alan adından çözülür
let device = localStorage.getItem("device");
if (!device) localStorage.setItem("device", device = crypto.randomUUID());
navigator.serviceWorker?.register("/sw.js");
const isIOS = /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
const standalone = (navigator as any).standalone || matchMedia("(display-mode: standalone)").matches;

const T = pick({
  tr: {
    queue: "Sıra",
    ownQueue: "Siz de sıra mı yönetiyorsunuz? QR Wait'i ücretsiz kurun →",
    keepOpen: "Bu sayfayı açık tutun. Sıra size geldiğinde ekran yeşile döner ve telefon titrer.",
    iosHint: <><b>Ekran kilitliyken de haber almak için:</b> Safari'de Paylaş <b>⎋</b> → <b>Ana Ekrana Ekle</b>'ye dokunun, sonra ana ekrandaki <b>QR Wait</b>'i açıp bildirimlere izin verin.</>,
    pushOn: "🔔 Bildirimler açık. Sayfayı kapatsanız veya ekranı kilitleseniz de sıranız gelince haber vereceğiz.",
    pushDenied: "Bildirimler kapalı. Bu sayfayı açık tutun ya da tarayıcı ayarlarından bu siteye bildirim izni verin.",
    gone: "Sıranız kapandı. Yeniden sıraya girmek için görevlinin QR kodunu okutun.",
    notFound: "Sıra bulunamadı. Görevlinin QR kodunu yeniden okutun.",
    howMany: "Kaç kişisiniz?",
    accept: <><b>Kaç yer olursa kabul edersiniz?</b> Birden fazla seçebilirsiniz.</>,
    acceptHint: "Daha az yeri de kabul ederseniz sıranız daha hızlı gelebilir.",
    zonesQ: <><b>Hangi bölgeler olur?</b> Birden fazla seçebilirsiniz.</>,
    zonesHint: "Birden fazla bölge seçerseniz sıranız daha hızlı gelebilir.",
    zoneWaiting: (n: number) => (n ? `${n} grup bekliyor` : "bekleyen yok"),
    zonesMine: (list: string) => `Bölge: ${list}`,
    join: "Sıraya gir",
    geoNote: "Sıraya girebilmek için sıranın bulunduğu yerde olmanız ve konum izni vermeniz gerekir. Konumunuz yalnızca bu kontrol için kullanılır, saklanmaz.",
    geoNoteHost: "Sıraya girebilmek için QR kodunu gösteren görevlinin yakınında olmanız ve konum izni vermeniz gerekir. Konumunuz yalnızca bu kontrol için kullanılır, saklanmaz.",
    yourNo: "Sıra numaranız",
    yourTurn: "Sıra size geldi!",
    tableReady: "Masanız hazır!",
    alloc: (n: number) => <><b>{n} yer</b> ayrıldı. </>,
    show: "Görevliye gidip bu numarayı gösterin.",
    within: "Bu süre içinde gelmezseniz sıranız düşer ve sıradakine geçer.",
    timeUp: "Süreniz doldu.",
    expired: "Belirlenen sürede gelmediğiniz için sıradan çıkarıldınız. Yeniden sıraya girmek için görevlinin QR kodunu okutun.",
    waitNote: (n: number) => `Sıranız geldiğinde ${n} dakika içinde görevliye gitmeniz gerekir, yoksa sıranız düşer.`,
    now: "Lütfen hemen gelin.",
    next: "Sıradaki sizsiniz, hazır olun.",
    ahead: (g: number, p: number) => <>Önünüzde <b>{g}</b> grup (<b>{p}</b> kişi) var.</>,
    accepting: (size: number, list: string) => `${size} kişi, ${list} yer kabul ediyorsunuz.`,
    enablePush: "🔔 Bildirimleri aç",
    leave: "Sıradan çık",
    leaveAsk: "Sıradan çıkmak istediğinize emin misiniz?",
    cancel: "Vazgeç",
    notifBody: "Görevliye gidip numaranızı gösterin.",
  },
  en: {
    queue: "Queue",
    ownQueue: "Running a queue? Set up QR Wait for free →",
    keepOpen: "Keep this page open. When it's your turn, the screen turns green and your phone vibrates.",
    iosHint: <><b>To get notified even when the screen is locked:</b> in Safari tap Share <b>⎋</b> → <b>Add to Home Screen</b>, then open <b>QR Wait</b> from your home screen and allow notifications.</>,
    pushOn: "🔔 Notifications are on. We'll let you know when it's your turn, even if you close this page or lock the screen.",
    pushDenied: "Notifications are off. Keep this page open, or allow notifications for this site in your browser settings.",
    gone: "Your place in the queue has ended. Scan the attendant's QR code to join again.",
    notFound: "Queue not found. Scan the attendant's QR code again.",
    howMany: "How many people are you?",
    accept: <><b>How many places would you accept?</b> You can pick more than one.</>,
    acceptHint: "If you also accept fewer places, your turn may come sooner.",
    zonesQ: <><b>Which areas are fine for you?</b> You can choose more than one.</>,
    zonesHint: "If you choose more than one area, your turn may come sooner.",
    zoneWaiting: (n: number) => (n ? `${pl(n, { one: "group", other: "groups" })} waiting` : "nobody waiting"),
    zonesMine: (list: string) => `Area: ${list}`,
    join: "Join the queue",
    geoNote: "To join, you need to be at the queue's location and allow location access. Your location is only used for this check and is not stored.",
    geoNoteHost: "To join, you need to be near the attendant showing the QR code and allow location access. Your location is only used for this check and is not stored.",
    yourNo: "Your number",
    yourTurn: "It's your turn!",
    tableReady: "Your table is ready!",
    alloc: (n: number) => <><b>{pl(n, { one: "place", other: "places" })}</b> reserved. </>,
    show: "Go to the attendant and show this number.",
    within: "If you don't come within this time, you lose your place and it goes to the next group.",
    timeUp: "Your time is up.",
    expired: "You were removed from the queue because you didn't arrive in time. Scan the attendant's QR code to join again.",
    waitNote: (n: number) => `When it's your turn, you have ${n} minutes to reach the attendant, otherwise you lose your place.`,
    now: "Please come right away.",
    next: "You're next, get ready.",
    ahead: (g: number, p: number) => <><b>{pl(g, { one: "group", other: "groups" })}</b> (<b>{pl(p, { one: "person", other: "people" })}</b>) ahead of you.</>,
    accepting: (size: number, list: string) => `${pl(size, { one: "person", other: "people" })}, accepting ${list} places.`,
    enablePush: "🔔 Turn on notifications",
    leave: "Leave the queue",
    leaveAsk: "Are you sure you want to leave the queue?",
    cancel: "Cancel",
    notifBody: "Go to the attendant and show your number.",
  },
  de: {
    queue: "Warteschlange",
    ownQueue: "Sie verwalten eine Warteschlange? QR Wait kostenlos einrichten →",
    keepOpen: "Lassen Sie diese Seite geöffnet. Wenn Sie an der Reihe sind, wird der Bildschirm grün und Ihr Telefon vibriert.",
    iosHint: <><b>Um auch bei gesperrtem Bildschirm benachrichtigt zu werden:</b> Tippen Sie in Safari auf Teilen <b>⎋</b> → <b>Zum Home-Bildschirm</b>, öffnen Sie dann <b>QR Wait</b> vom Home-Bildschirm und erlauben Sie Mitteilungen.</>,
    pushOn: "🔔 Benachrichtigungen sind aktiv. Wir melden uns, wenn Sie an der Reihe sind – auch wenn Sie die Seite schließen oder den Bildschirm sperren.",
    pushDenied: "Benachrichtigungen sind deaktiviert. Lassen Sie diese Seite geöffnet oder erlauben Sie Benachrichtigungen für diese Seite in den Browsereinstellungen.",
    gone: "Ihr Platz in der Warteschlange ist beendet. Scannen Sie den QR-Code des Personals, um sich erneut anzustellen.",
    notFound: "Warteschlange nicht gefunden. Scannen Sie den QR-Code des Personals erneut.",
    howMany: "Wie viele Personen sind Sie?",
    accept: <><b>Wie viele Plätze würden Sie akzeptieren?</b> Mehrfachauswahl möglich.</>,
    acceptHint: "Wenn Sie auch weniger Plätze akzeptieren, sind Sie eventuell schneller dran.",
    zonesQ: <><b>Welche Bereiche passen für Sie?</b> Mehrfachauswahl möglich.</>,
    zonesHint: "Wenn Sie mehrere Bereiche wählen, sind Sie eventuell schneller dran.",
    zoneWaiting: (n: number) => (n ? `${pl(n, { one: "Gruppe", other: "Gruppen" })} warten` : "niemand wartet"),
    zonesMine: (list: string) => `Bereich: ${list}`,
    join: "Anstellen",
    geoNote: "Zum Anstellen müssen Sie am Ort der Warteschlange sein und die Standortfreigabe erlauben. Ihr Standort wird nur für diese Prüfung verwendet und nicht gespeichert.",
    geoNoteHost: "Zum Anstellen müssen Sie in der Nähe der Person sein, die den QR-Code zeigt, und die Standortfreigabe erlauben. Ihr Standort wird nur für diese Prüfung verwendet und nicht gespeichert.",
    yourNo: "Ihre Nummer",
    yourTurn: "Sie sind dran!",
    tableReady: "Ihr Tisch ist bereit!",
    alloc: (n: number) => <><b>{pl(n, { one: "Platz", other: "Plätze" })}</b> reserviert. </>,
    show: "Gehen Sie zum Personal und zeigen Sie diese Nummer.",
    within: "Wenn Sie nicht innerhalb dieser Zeit kommen, verfällt Ihr Platz und geht an die Nächsten.",
    timeUp: "Ihre Zeit ist abgelaufen.",
    expired: "Sie wurden aus der Warteschlange entfernt, weil Sie nicht rechtzeitig gekommen sind. Scannen Sie den QR-Code des Personals, um sich erneut anzustellen.",
    waitNote: (n: number) => `Wenn Sie an der Reihe sind, haben Sie ${n} Minuten, um zum Personal zu kommen, sonst verfällt Ihr Platz.`,
    now: "Bitte kommen Sie sofort.",
    next: "Sie sind als Nächstes dran, halten Sie sich bereit.",
    ahead: (g: number, p: number) => <>Vor Ihnen: <b>{pl(g, { one: "Gruppe", other: "Gruppen" })}</b> (<b>{pl(p, { one: "Person", other: "Personen" })}</b>).</>,
    accepting: (size: number, list: string) => `${pl(size, { one: "Person", other: "Personen" })}, Sie akzeptieren ${list} Plätze.`,
    enablePush: "🔔 Benachrichtigungen einschalten",
    leave: "Warteschlange verlassen",
    leaveAsk: "Möchten Sie die Warteschlange wirklich verlassen?",
    cancel: "Abbrechen",
    notifBody: "Gehen Sie zum Personal und zeigen Sie Ihre Nummer.",
  },
  ru: {
    queue: "Очередь",
    ownQueue: "Управляете очередью? Подключите QR Wait бесплатно →",
    keepOpen: "Не закрывайте эту страницу. Когда подойдёт ваша очередь, экран станет зелёным, а телефон завибрирует.",
    iosHint: <><b>Чтобы получать уведомления и при заблокированном экране:</b> в Safari нажмите «Поделиться» <b>⎋</b> → <b>«На экран „Домой“»</b>, затем откройте <b>QR Wait</b> с экрана «Домой» и разрешите уведомления.</>,
    pushOn: "🔔 Уведомления включены. Мы сообщим, когда подойдёт ваша очередь, даже если вы закроете страницу или заблокируете экран.",
    pushDenied: "Уведомления отключены. Не закрывайте эту страницу или разрешите уведомления для этого сайта в настройках браузера.",
    gone: "Ваше место в очереди больше не действует. Чтобы встать снова, отсканируйте QR-код сотрудника.",
    notFound: "Очередь не найдена. Отсканируйте QR-код сотрудника ещё раз.",
    howMany: "Сколько вас человек?",
    accept: <><b>Какое количество мест вам подойдёт?</b> Можно выбрать несколько.</>,
    acceptHint: "Если согласиться и на меньшее число мест, очередь может подойти быстрее.",
    zonesQ: <><b>Какие зоны вам подходят?</b> Можно выбрать несколько.</>,
    zonesHint: "Если выбрать несколько зон, очередь может подойти быстрее.",
    zoneWaiting: (n: number) => (n ? `ждут: ${pl(n, { one: "группа", few: "группы", many: "групп", other: "группы" })}` : "никто не ждёт"),
    zonesMine: (list: string) => `Зона: ${list}`,
    join: "Встать в очередь",
    geoNote: "Чтобы встать в очередь, нужно находиться на месте и разрешить доступ к геолокации. Местоположение используется только для этой проверки и не сохраняется.",
    geoNoteHost: "Чтобы встать в очередь, нужно находиться рядом с сотрудником, который показывает QR-код, и разрешить доступ к геолокации. Местоположение используется только для этой проверки и не сохраняется.",
    yourNo: "Ваш номер",
    yourTurn: "Ваша очередь!",
    tableReady: "Ваш столик готов!",
    alloc: (n: number) => <>Зарезервировано: <b>{pl(n, { one: "место", few: "места", many: "мест", other: "места" })}</b>. </>,
    show: "Подойдите к сотруднику и покажите этот номер.",
    within: "Если не подойдёте за это время, место перейдёт следующим.",
    timeUp: "Время вышло.",
    expired: "Вы выбыли из очереди, потому что не подошли вовремя. Чтобы встать снова, отсканируйте QR-код сотрудника.",
    waitNote: (n: number) => `Когда подойдёт ваша очередь, у вас будет ${n} мин, чтобы подойти к сотруднику, иначе место будет потеряно.`,
    now: "Пожалуйста, подойдите сейчас.",
    next: "Вы следующий, будьте готовы.",
    ahead: (g: number, p: number) => <>Перед вами: <b>{pl(g, { one: "группа", few: "группы", many: "групп", other: "группы" })}</b> (<b>{pl(p, { one: "человек", few: "человека", many: "человек", other: "человека" })}</b>).</>,
    accepting: (size: number, list: string) => `${pl(size, { one: "человек", few: "человека", many: "человек", other: "человека" })}, подходит мест: ${list}.`,
    enablePush: "🔔 Включить уведомления",
    leave: "Выйти из очереди",
    leaveAsk: "Вы уверены, что хотите выйти из очереди?",
    cancel: "Отмена",
    notifBody: "Подойдите к сотруднику и покажите свой номер.",
  },
});

// Push aboneliği: sayfa kapalıyken / ekran kilitliyken de haber verebilmek için.
// iOS'ta PushManager yalnızca ana ekrana eklenmiş uygulamada vardır.
async function enablePush(id: string) {
  if (!window.PushManager || Notification.permission !== "granted") return false;
  try {
    const reg = await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      const { key } = await api<{ key: string | null }>("/api/vapid");
      if (!key) return false;
      const raw = Uint8Array.from(atob(key.replaceAll("-", "+").replaceAll("_", "/")), (c) => c.charCodeAt(0));
      sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: raw });
    }
    await api(`/api/r/${room}/push`, { id, sub: sub.toJSON() });
    return true;
  } catch { return false; }
}

// place: masa ya da gişe adı; table: masa modunda başlık "Masanız hazır"
async function alertUser(id: string, place?: string, table = false) {
  navigator.vibrate?.([500, 200, 500, 200, 500]);
  try {
    const a = new AudioContext(), o = a.createOscillator();
    o.connect(a.destination); o.frequency.value = 880; o.start(); o.stop(a.currentTime + 0.8);
  } catch {}
  if (window.Notification?.permission === "granted") {
    const reg = await navigator.serviceWorker?.ready;
    // push ile aynı tag: ikisi birden gelirse tek bildirim görünür
    reg?.showNotification(table ? T.tableReady : T.yourTurn, { body: `${place ? `${place}. ` : ""}${T.notifBody}`, tag: `called-${id}`, icon: "/icons/icon-192.png", vibrate: [500, 200, 500] } as NotificationOptions);
  }
}

function JoinPage() {
  const confirm = useConfirm();
  const [view, setView] = useState<"join" | "wait" | null>(null);
  const [me, setMe] = useState<Me>();
  const [st, setSt] = useState<Status>();
  const [size, setSize] = useState(2);
  const [accept, setAccept] = useState([2]);
  const [zones, setZones] = useState<string[]>([]); // bölgeli sırada ziyaretçi kendisi seçer, varsayılan yok
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [hint, setHint] = useState<ReactNode>(T.keepOpen);
  const [pushBtn, setPushBtn] = useState(false);
  const notified = useRef(false), pushShown = useRef(false);
  const due = useRef<number | null>(null); // süreli sırada gelme süresinin bittiği an
  const [, tick] = useState(0);

  // Bekleme ekranındaki bildirim durumu; sayfa açılışında bir kez
  async function pushUI(id: string) {
    if (pushShown.current) return;
    pushShown.current = true;
    if (!window.PushManager) {
      if (!isIOS || standalone) return;
      // Ana ekrandaki uygulama Safari'den ayrı depolama kullanır: bilet adres üzerinden taşınır (ana ekrana eklerken o anki adres kaydedilir)
      history.replaceState(null, "", `?${ref ? `r=${ref}&` : ""}k=${id}`);
      setHint(T.iosHint);
      return;
    }
    if (Notification.permission === "granted") {
      if (await enablePush(id)) setHint(T.pushOn);
      return;
    }
    if (Notification.permission === "denied") {
      setHint(T.pushDenied);
      return;
    }
    setPushBtn(true);
  }

  async function refresh() {
    const id = localStorage.getItem(slot);
    if (!id) return setView(token ? "join" : null);
    try {
      const s = await api<Me>(`/api/r/${room}/me?id=${encodeURIComponent(id)}`);
      setErr("");
      if (s.status === "gone" || s.status === "expired") {
        localStorage.removeItem(slot);
        setMe(undefined);
        setView(null);
        setErr(s.status === "expired" ? T.expired : T.gone);
        return;
      }
      // Bitiş anı bu cihazın saatine göre: sunucu kalan süreyi gönderir
      due.current = s.remaining === null ? null : Date.now() + s.remaining;
      setMe(s);
      setView("wait");
      if (s.status === "called") {
        if (!notified.current) { notified.current = true; alertUser(id, [s.table && tableLabel(s.table), s.desk && deskLabel(s.desk), s.zone].filter(Boolean).join(" · "), !!s.table); }
      } else pushUI(id);
    } catch (e: any) { setErr(e.message); }
  }

  useEffect(() => {
    let stop = () => {};
    api<{ room: string }>(`/api/resolve?r=${encodeURIComponent(ref)}`).then((r) => {
      room = r.room;
      slot = "ticket:" + room;
      // iOS ana ekran uygulaması ilk açılışta bileti adresten alır (bkz. pushUI)
      if (q.get("k") && !localStorage.getItem(slot)) localStorage.setItem(slot, q.get("k")!);
      api<Status>(`/api/r/${room}/status`).then((s) => {
        setSt(s);
        setSize((n) => Math.min(n, s.maxGroup));
        setAccept((a) => [Math.min(a[0], s.maxGroup)]);
      }).catch(() => {});
      refresh();
      stop = poll(refresh, 10000, true);
    }).catch(() => setErr(T.notFound));
    return () => stop();
  }, []);

  const called = me?.status === "called";
  const closed = st ? closedText(st) : null; // yeni katılım kapalıysa nedeni
  // Geri sayım her saniye; süre dolunca sunucunun düşürdüğü hemen görülsün diye yenilenir
  const timed = called && due.current !== null;
  useEffect(() => {
    if (!timed) return;
    let done = false;
    const t = setInterval(() => {
      tick((n) => n + 1);
      if (!done && Date.now() >= due.current!) { done = true; setTimeout(refresh, 2000); }
    }, 1000);
    return () => clearInterval(t);
  }, [timed]);
  // Çağrılınca ekranın tamamı yeşil, numara ve mesaj beyaz
  useEffect(() => {
    document.body.classList.toggle("bg-success", called);
    document.body.classList.toggle("text-success-foreground", called);
  }, [called]);

  async function join() {
    setBusy(true); setErr("");
    try {
      // Bildirim izni kullanıcı hareketi gerektirir, bu yüzden burada istenir
      const perm = window.PushManager && Notification.requestPermission();
      // Durum henüz gelmediyse konum yine istenir; gerekmiyorsa sunucu yok sayar
      const c = st?.geo === "off" ? null : await locate(geoErrors);
      const r = await api<{ id: string }>(`/api/r/${room}/join`, { t: token, lat: c?.latitude, lng: c?.longitude, size, accept, zones, device, lang });
      localStorage.setItem(slot, r.id);
      await perm;
      history.replaceState(null, "", ref ? `?r=${ref}` : location.pathname); // süresi dolacak token'ı adres çubuğundan kaldır
      await refresh();
    } catch (e: any) { setErr(e.message); }
    setBusy(false);
  }

  async function leave() {
    if (!(await confirm({ title: T.leaveAsk, action: T.leave, cancel: T.cancel, destructive: true }))) return;
    await api(`/api/r/${room}/leave`, { id: localStorage.getItem(slot) }).catch(() => {});
    localStorage.removeItem(slot);
    location.reload();
  }

  const name = me?.name ?? st?.name;
  const soon = me?.status === "waiting" && me.aheadGroups <= 2;
  const left = timed ? Math.max(0, Math.ceil((due.current! - Date.now()) / 1000)) : 0;
  const clock = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, "0")}`;

  return (
    <Page>
      <Title className={cn(called && "text-success-foreground")}>{name ? `${st ? `${catIcon(st.category)} ` : ""}${name}` : T.queue}</Title>

      {view === "join" && (
        <Card>
          <CardContent className="flex flex-col gap-4 text-base">
            <Label className="flex-col items-stretch gap-2 text-base font-normal">
              {T.howMany}
              <SizeSelect max={st?.maxGroup ?? 8} value={size} onChange={(n) => { setSize(n); setAccept([n]); }} />
            </Label>
            {st?.flex && (
              <div>
                <p>{T.accept}</p>
                <AcceptPicker size={size} value={accept} onChange={setAccept} />
                <p className="text-sm text-muted-foreground">{T.acceptHint}</p>
              </div>
            )}
            {!!st?.zones.length && (
              <div>
                <p>{T.zonesQ}</p>
                <ZonePicker zones={st.zones.map((z) => z.name)} value={zones} onChange={setZones}
                  note={(n) => { const z = st.zones.find((x) => x.name === n)!; return z.eta ? S.eta(fmtWait(z.eta)) : T.zoneWaiting(z.waiting); }} />
                <p className="text-sm text-muted-foreground">{T.zonesHint}</p>
              </div>
            )}
            {st?.eta && !st.zones.length && !closed && <p className="font-semibold">{S.eta(fmtWait(st.eta))}</p>}
            {closed && <p className="font-semibold text-destructive">{closed}</p>}
            <Button size="lg" onClick={join} disabled={busy || !!closed || (!!st?.zones.length && !zones.length)}>{T.join}</Button>
            {st?.wait && <p className="text-sm text-muted-foreground">{T.waitNote(st.wait)}</p>}
            {st?.geo !== "off" && <p className="text-sm text-muted-foreground">{st?.geo === "dynamic" ? T.geoNoteHost : T.geoNote}</p>}
          </CardContent>
        </Card>
      )}

      {view === "wait" && me && (
        <Card className={cn(soon && "bg-amber-100", called && "bg-transparent text-success-foreground ring-0")}>
          <CardContent className="flex flex-col gap-3 text-center text-base">
            <p className={cn("text-sm", called ? "text-green-100" : "text-muted-foreground")}>{T.yourNo}</p>
            <div className={cn("text-8xl leading-tight font-extrabold tabular-nums", !called && "text-primary")}>{me.no}</div>
            {called ? (
              <p>
                <b>{me.table ? T.tableReady : T.yourTurn}</b><br />
                {(me.table || me.desk || me.zone) && <span className="my-2 block text-4xl font-extrabold">{me.table ? tableLabel(me.table) : me.desk ? deskLabel(me.desk) : me.zone}</span>}
                {me.table && me.zone && <span className="mb-2 block text-2xl font-bold">{me.zone}</span>}
                {me.alloc && me.alloc !== me.size ? T.alloc(me.alloc) : null}
                {T.show}<br />
                {!timed && T.now}
              </p>
            ) : null}
            {called && timed ? (
              <div>
                <div className="text-6xl leading-tight font-extrabold tabular-nums" role="timer" aria-live="off">{left > 0 ? clock : "0:00"}</div>
                <p>{left > 0 ? T.within : <b>{T.timeUp}</b>}</p>
              </div>
            ) : null}
            {!called && (
              <>
                <p>
                  {me.aheadGroups === 0
                    ? <b>{T.next}</b>
                    : T.ahead(me.aheadGroups, me.aheadPeople)}
                  {me.eta && <><br /><b>{S.eta(fmtWait(me.eta))}</b></>}
                  {me.zones && <><br /><span className="text-sm text-muted-foreground">{T.zonesMine(me.zones.join(", "))}</span></>}
                  {(me.accept.length > 1 || me.accept[0] !== me.size) && (
                    <><br /><span className="text-sm text-muted-foreground">{T.accepting(me.size, orList(me.accept))}</span></>
                  )}
                </p>
                <p className="text-sm text-muted-foreground">{hint}</p>
                {pushBtn && (
                  <Button variant="secondary" onClick={async () => {
                    await Notification.requestPermission();
                    setPushBtn(false);
                    pushShown.current = false;
                    pushUI(localStorage.getItem(slot)!);
                  }}>{T.enablePush}</Button>
                )}
              </>
            )}
            <Button variant="secondary" onClick={leave}>{T.leave}</Button>
          </CardContent>
        </Card>
      )}

      <ErrorText>{err}</ErrorText>
      {/* Sırada bekleyen her ziyaretçi olası bir işletme; utm ile Analytics'te hangi sayfadan geldiği görünür */}
      <p className="mt-6 text-center text-sm"><a className="font-medium underline" href={siteUrl("/?utm_source=qrwait&utm_medium=join")}>{T.ownQueue}</a></p>
      <p className="mt-2 text-center text-xs text-muted-foreground"><a className="underline" href={siteUrl("/privacy")}>{LEGAL.privacyShort}</a></p>
    </Page>
  );
}

mount(<JoinPage />);
