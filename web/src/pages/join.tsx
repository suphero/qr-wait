import { useEffect, useRef, useState, type ReactNode } from "react";
import { useConfirm } from "@/components/confirm";
import { AcceptPicker, SizeSelect } from "@/components/group";
import { ErrorText, Page, Title } from "@/components/page";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { api, catIcon, locate, mins, poll, type Me, type Status } from "@/lib/api";
import { geoErrors, lang, orList, pick, pl, tableLabel } from "@/lib/i18n";
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
    keepOpen: "Bu sayfayı açık tutun. Sıra size geldiğinde ekran yeşile döner ve telefon titrer.",
    iosHint: <><b>Ekran kilitliyken de haber almak için:</b> Safari'de Paylaş <b>⎋</b> → <b>Ana Ekrana Ekle</b>'ye dokunun, sonra ana ekrandaki <b>QRWait</b>'i açıp bildirimlere izin verin.</>,
    pushOn: "🔔 Bildirimler açık. Sayfayı kapatsanız veya ekranı kilitleseniz de sıranız gelince haber vereceğiz.",
    pushDenied: "Bildirimler kapalı. Bu sayfayı açık tutun ya da tarayıcı ayarlarından bu siteye bildirim izni verin.",
    gone: "Sıranız kapandı. Yeniden sıraya girmek için görevlinin QR kodunu okutun.",
    notFound: "Sıra bulunamadı. Görevlinin QR kodunu yeniden okutun.",
    howMany: "Kaç kişisiniz?",
    accept: <><b>Kaç yer olursa kabul edersiniz?</b> Birden fazla seçebilirsiniz.</>,
    acceptHint: "Daha az yeri de kabul ederseniz sıranız daha hızlı gelebilir.",
    join: "Sıraya gir",
    geoNote: "Sıraya girebilmek için sıranın bulunduğu yerde olmanız ve konum izni vermeniz gerekir. Konumunuz yalnızca bu kontrol için kullanılır, saklanmaz.",
    yourNo: "Sıra numaranız",
    yourTurn: "Sıra size geldi!",
    tableReady: "Masanız hazır!",
    alloc: (n: number) => <><b>{n} yer</b> ayrıldı. </>,
    show: "Görevliye gidip bu numarayı gösterin.",
    left: (n: number) => `Yaklaşık ${n} dk içinde gelmezseniz sıranız düşebilir.`,
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
    keepOpen: "Keep this page open. When it's your turn, the screen turns green and your phone vibrates.",
    iosHint: <><b>To get notified even when the screen is locked:</b> in Safari tap Share <b>⎋</b> → <b>Add to Home Screen</b>, then open <b>QRWait</b> from your home screen and allow notifications.</>,
    pushOn: "🔔 Notifications are on. We'll let you know when it's your turn, even if you close this page or lock the screen.",
    pushDenied: "Notifications are off. Keep this page open, or allow notifications for this site in your browser settings.",
    gone: "Your place in the queue has ended. Scan the attendant's QR code to join again.",
    notFound: "Queue not found. Scan the attendant's QR code again.",
    howMany: "How many people are you?",
    accept: <><b>How many places would you accept?</b> You can pick more than one.</>,
    acceptHint: "If you also accept fewer places, your turn may come sooner.",
    join: "Join the queue",
    geoNote: "To join, you need to be at the queue's location and allow location access. Your location is only used for this check and is not stored.",
    yourNo: "Your number",
    yourTurn: "It's your turn!",
    tableReady: "Your table is ready!",
    alloc: (n: number) => <><b>{pl(n, { one: "place", other: "places" })}</b> reserved. </>,
    show: "Go to the attendant and show this number.",
    left: (n: number) => `If you don't come within about ${n} min, you may lose your place.`,
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
    keepOpen: "Lassen Sie diese Seite geöffnet. Wenn Sie an der Reihe sind, wird der Bildschirm grün und Ihr Telefon vibriert.",
    iosHint: <><b>Um auch bei gesperrtem Bildschirm benachrichtigt zu werden:</b> Tippen Sie in Safari auf Teilen <b>⎋</b> → <b>Zum Home-Bildschirm</b>, öffnen Sie dann <b>QRWait</b> vom Home-Bildschirm und erlauben Sie Mitteilungen.</>,
    pushOn: "🔔 Benachrichtigungen sind aktiv. Wir melden uns, wenn Sie an der Reihe sind – auch wenn Sie die Seite schließen oder den Bildschirm sperren.",
    pushDenied: "Benachrichtigungen sind deaktiviert. Lassen Sie diese Seite geöffnet oder erlauben Sie Benachrichtigungen für diese Seite in den Browsereinstellungen.",
    gone: "Ihr Platz in der Warteschlange ist beendet. Scannen Sie den QR-Code des Personals, um sich erneut anzustellen.",
    notFound: "Warteschlange nicht gefunden. Scannen Sie den QR-Code des Personals erneut.",
    howMany: "Wie viele Personen sind Sie?",
    accept: <><b>Wie viele Plätze würden Sie akzeptieren?</b> Mehrfachauswahl möglich.</>,
    acceptHint: "Wenn Sie auch weniger Plätze akzeptieren, sind Sie eventuell schneller dran.",
    join: "Anstellen",
    geoNote: "Zum Anstellen müssen Sie am Ort der Warteschlange sein und die Standortfreigabe erlauben. Ihr Standort wird nur für diese Prüfung verwendet und nicht gespeichert.",
    yourNo: "Ihre Nummer",
    yourTurn: "Sie sind dran!",
    tableReady: "Ihr Tisch ist bereit!",
    alloc: (n: number) => <><b>{pl(n, { one: "Platz", other: "Plätze" })}</b> reserviert. </>,
    show: "Gehen Sie zum Personal und zeigen Sie diese Nummer.",
    left: (n: number) => `Wenn Sie nicht innerhalb von etwa ${n} Min. kommen, kann Ihr Platz verfallen.`,
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
    keepOpen: "Не закрывайте эту страницу. Когда подойдёт ваша очередь, экран станет зелёным, а телефон завибрирует.",
    iosHint: <><b>Чтобы получать уведомления и при заблокированном экране:</b> в Safari нажмите «Поделиться» <b>⎋</b> → <b>«На экран „Домой“»</b>, затем откройте <b>QRWait</b> с экрана «Домой» и разрешите уведомления.</>,
    pushOn: "🔔 Уведомления включены. Мы сообщим, когда подойдёт ваша очередь, даже если вы закроете страницу или заблокируете экран.",
    pushDenied: "Уведомления отключены. Не закрывайте эту страницу или разрешите уведомления для этого сайта в настройках браузера.",
    gone: "Ваше место в очереди больше не действует. Чтобы встать снова, отсканируйте QR-код сотрудника.",
    notFound: "Очередь не найдена. Отсканируйте QR-код сотрудника ещё раз.",
    howMany: "Сколько вас человек?",
    accept: <><b>Какое количество мест вам подойдёт?</b> Можно выбрать несколько.</>,
    acceptHint: "Если согласиться и на меньшее число мест, очередь может подойти быстрее.",
    join: "Встать в очередь",
    geoNote: "Чтобы встать в очередь, нужно находиться на месте и разрешить доступ к геолокации. Местоположение используется только для этой проверки и не сохраняется.",
    yourNo: "Ваш номер",
    yourTurn: "Ваша очередь!",
    tableReady: "Ваш столик готов!",
    alloc: (n: number) => <>Зарезервировано: <b>{pl(n, { one: "место", few: "места", many: "мест", other: "места" })}</b>. </>,
    show: "Подойдите к сотруднику и покажите этот номер.",
    left: (n: number) => `Если вы не подойдёте примерно за ${n} мин, место может быть потеряно.`,
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

async function alertUser(id: string, table?: string) {
  navigator.vibrate?.([500, 200, 500, 200, 500]);
  try {
    const a = new AudioContext(), o = a.createOscillator();
    o.connect(a.destination); o.frequency.value = 880; o.start(); o.stop(a.currentTime + 0.8);
  } catch {}
  if (window.Notification?.permission === "granted") {
    const reg = await navigator.serviceWorker?.ready;
    // push ile aynı tag: ikisi birden gelirse tek bildirim görünür
    reg?.showNotification(table ? T.tableReady : T.yourTurn, { body: `${table ? `${table}. ` : ""}${T.notifBody}`, tag: `called-${id}`, icon: "/icons/icon-192.png", vibrate: [500, 200, 500] } as NotificationOptions);
  }
}

function JoinPage() {
  const confirm = useConfirm();
  const [view, setView] = useState<"join" | "wait" | null>(null);
  const [me, setMe] = useState<Me>();
  const [st, setSt] = useState<Status>();
  const [size, setSize] = useState(2);
  const [accept, setAccept] = useState([2]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [hint, setHint] = useState<ReactNode>(T.keepOpen);
  const [pushBtn, setPushBtn] = useState(false);
  const notified = useRef(false), pushShown = useRef(false);

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
      if (s.status === "gone") {
        localStorage.removeItem(slot);
        setMe(undefined);
        setView(null);
        setErr(T.gone);
        return;
      }
      setMe(s);
      setView("wait");
      if (s.status === "called") {
        if (!notified.current) { notified.current = true; alertUser(id, s.table && tableLabel(s.table)); }
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
      const c = await locate(geoErrors);
      const r = await api<{ id: string }>(`/api/r/${room}/join`, { t: token, lat: c.latitude, lng: c.longitude, size, accept, device, lang });
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
  const left = me?.calledAt ? 10 - mins(me.calledAt) : 0;

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
            <Button size="lg" onClick={join} disabled={busy}>{T.join}</Button>
            <p className="text-sm text-muted-foreground">{T.geoNote}</p>
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
                {me.table && <span className="my-2 block text-4xl font-extrabold">{tableLabel(me.table)}</span>}
                {me.alloc && me.alloc !== me.size ? T.alloc(me.alloc) : null}
                {T.show}<br />
                {left > 0 ? T.left(left) : T.now}
              </p>
            ) : (
              <>
                <p>
                  {me.aheadGroups === 0
                    ? <b>{T.next}</b>
                    : T.ahead(me.aheadGroups, me.aheadPeople)}
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
      <p className="mt-4 text-center text-xs text-muted-foreground"><a className="underline" href={siteUrl("/privacy")}>{LEGAL.privacyShort}</a></p>
    </Page>
  );
}

mount(<JoinPage />);
