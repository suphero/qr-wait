import { useEffect, useRef, useState, type ReactNode } from "react";
import { useConfirm } from "@/components/confirm";
import { AcceptPicker, SizeSelect } from "@/components/group";
import { ErrorText, Page, Title } from "@/components/page";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { api, catIcon, locate, mins, orList, poll, type Me, type Status } from "@/lib/api";
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

async function alertUser(id: string) {
  navigator.vibrate?.([500, 200, 500, 200, 500]);
  try {
    const a = new AudioContext(), o = a.createOscillator();
    o.connect(a.destination); o.frequency.value = 880; o.start(); o.stop(a.currentTime + 0.8);
  } catch {}
  if (window.Notification?.permission === "granted") {
    const reg = await navigator.serviceWorker?.ready;
    // push ile aynı tag: ikisi birden gelirse tek bildirim görünür
    reg?.showNotification("Sıra size geldi!", { body: "Görevliye gidip numaranızı gösterin.", tag: `called-${id}`, icon: "/icons/icon-192.png", vibrate: [500, 200, 500] } as NotificationOptions);
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
  const [hint, setHint] = useState<ReactNode>("Bu sayfayı açık tutun. Sıra size geldiğinde ekran yeşile döner ve telefon titrer.");
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
      setHint(<><b>Ekran kilitliyken de haber almak için:</b> Safari'de Paylaş <b>⎋</b> → <b>Ana Ekrana Ekle</b>'ye dokunun, sonra ana ekrandaki <b>Sıran Geldi</b>'yi açıp bildirimlere izin verin.</>);
      return;
    }
    if (Notification.permission === "granted") {
      if (await enablePush(id)) setHint("🔔 Bildirimler açık. Sayfayı kapatsanız veya ekranı kilitleseniz de sıranız gelince haber vereceğiz.");
      return;
    }
    if (Notification.permission === "denied") {
      setHint("Bildirimler kapalı. Bu sayfayı açık tutun ya da tarayıcı ayarlarından bu siteye bildirim izni verin.");
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
        setErr("Sıranız kapandı. Yeniden sıraya girmek için görevlinin QR kodunu okutun.");
        return;
      }
      setMe(s);
      setView("wait");
      if (s.status === "called") {
        if (!notified.current) { notified.current = true; alertUser(id); }
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
    }).catch(() => setErr("Sıra bulunamadı. Görevlinin QR kodunu yeniden okutun."));
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
      const c = await locate();
      const r = await api<{ id: string }>(`/api/r/${room}/join`, { t: token, lat: c.latitude, lng: c.longitude, size, accept, device });
      localStorage.setItem(slot, r.id);
      await perm;
      history.replaceState(null, "", ref ? `?r=${ref}` : location.pathname); // süresi dolacak token'ı adres çubuğundan kaldır
      await refresh();
    } catch (e: any) { setErr(e.message); }
    setBusy(false);
  }

  async function leave() {
    if (!(await confirm({ title: "Sıradan çıkmak istediğinize emin misiniz?", action: "Sıradan çık", destructive: true }))) return;
    await api(`/api/r/${room}/leave`, { id: localStorage.getItem(slot) }).catch(() => {});
    localStorage.removeItem(slot);
    location.reload();
  }

  const name = me?.name ?? st?.name;
  const soon = me?.status === "waiting" && me.aheadGroups <= 2;
  const left = me?.calledAt ? 10 - mins(me.calledAt) : 0;

  return (
    <Page>
      <Title className={cn(called && "text-success-foreground")}>{name ? `${st ? `${catIcon(st.category)} ` : ""}${name}` : "Sıra"}</Title>

      {view === "join" && (
        <Card>
          <CardContent className="flex flex-col gap-4 text-base">
            <Label className="flex-col items-stretch gap-2 text-base font-normal">
              Kaç kişisiniz?
              <SizeSelect max={st?.maxGroup ?? 8} value={size} onChange={(n) => { setSize(n); setAccept([n]); }} />
            </Label>
            {st?.flex && (
              <div>
                <p><b>Kaç yer olursa kabul edersiniz?</b> Birden fazla seçebilirsiniz.</p>
                <AcceptPicker size={size} value={accept} onChange={setAccept} />
                <p className="text-sm text-muted-foreground">Daha az yeri de kabul ederseniz sıranız daha hızlı gelebilir.</p>
              </div>
            )}
            <Button size="lg" onClick={join} disabled={busy}>Sıraya gir</Button>
            <p className="text-sm text-muted-foreground">Sıraya girebilmek için sıranın bulunduğu yerde olmanız ve konum izni vermeniz gerekir. Konumunuz yalnızca bu kontrol için kullanılır, saklanmaz.</p>
          </CardContent>
        </Card>
      )}

      {view === "wait" && me && (
        <Card className={cn(soon && "bg-amber-100", called && "bg-transparent text-success-foreground ring-0")}>
          <CardContent className="flex flex-col gap-3 text-center text-base">
            <p className={cn("text-sm", called ? "text-green-100" : "text-muted-foreground")}>Sıra numaranız</p>
            <div className={cn("text-8xl leading-tight font-extrabold tabular-nums", !called && "text-primary")}>{me.no}</div>
            {called ? (
              <p>
                <b>Sıra size geldi!</b><br />
                {me.alloc && me.alloc !== me.size ? <><b>{me.alloc} yer</b> ayrıldı. </> : null}
                Görevliye gidip bu numarayı gösterin.<br />
                {left > 0 ? `Yaklaşık ${left} dk içinde gelmezseniz sıranız düşebilir.` : "Lütfen hemen gelin."}
              </p>
            ) : (
              <>
                <p>
                  {me.aheadGroups === 0
                    ? <b>Sıradaki sizsiniz, hazır olun.</b>
                    : <>Önünüzde <b>{me.aheadGroups}</b> grup (<b>{me.aheadPeople}</b> kişi) var.</>}
                  {(me.accept.length > 1 || me.accept[0] !== me.size) && (
                    <><br /><span className="text-sm text-muted-foreground">{me.size} kişi, {orList(me.accept)} yer kabul ediyorsunuz.</span></>
                  )}
                </p>
                <p className="text-sm text-muted-foreground">{hint}</p>
                {pushBtn && (
                  <Button variant="secondary" onClick={async () => {
                    await Notification.requestPermission();
                    setPushBtn(false);
                    pushShown.current = false;
                    pushUI(localStorage.getItem(slot)!);
                  }}>🔔 Bildirimleri aç</Button>
                )}
              </>
            )}
            <Button variant="secondary" onClick={leave}>Sıradan çık</Button>
          </CardContent>
        </Card>
      )}

      <ErrorText>{err}</ErrorText>
    </Page>
  );
}

mount(<JoinPage />);
