import { useEffect, useState, type ReactNode } from "react";
import { ErrorText, Page, Title } from "@/components/page";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { api, catIcon, poll, type PublicRoom, type Status } from "@/lib/api";
import { lang, pick, waitText, word } from "@/lib/i18n";
import { LEGAL } from "@/components/legal";
import { mount } from "@/lib/mount";

// antalyabb.sirangeldi.com/bambus ya da /status?r=bambus; kullanıcı alt alan adından (yoksa ?u=)
const q = new URLSearchParams(location.search), path = location.pathname.slice(1);
const ref = q.get("r") ?? (path === "status" ? "" : path), user = q.get("u") ?? "";
const base = location.hostname.split(".").slice(1).join(".");
const home = base.includes(".") ? `https://${base}/` : "/"; // alt alan adındaysak ana siteye

const T = pick({
  tr: {
    title: "Sıra durumu",
    queues: "Sıralar",
    loading: "Yükleniyor…",
    updated: (t: string) => `Son güncelleme ${t}. Sayfa kendini yeniler.`,
    notFound: "Bu adreste bir sıra bulunamadı. Adresi kontrol edin.",
    noQueues: "Henüz sıra yok.",
    mine: <><b>Bu telefonla sıradasınız.</b><br />Sıranızı görmek için dokunun.</>,
    waiting: (_: number, people: number) => <>grup sırada bekliyor, toplam <b>{people}</b> kişi</>,
    nobody: "Şu an sırada bekleyen yok.",
    calledTitle: "Şu an çağrılanlar",
    noneCalled: "Şu an çağrılan yok.",
    last: (n: number) => `Son çağrılan: ${n}`,
    next: (n: number) => `Sıradaki: ${n}`,
    howTitle: "Nasıl sıraya girerim?",
    how: "Oraya vardığınızda görevlinin ekranındaki QR kodu telefonunuzun kamerasıyla okutun. Sıraya girmek için orada olmanız gerekir, uzaktan sıraya girilemez.",
    directions: "Yol tarifi al",
    powered: (a: ReactNode) => <>{a} ile çalışır</>,
  },
  en: {
    title: "Queue status",
    queues: "Queues",
    loading: "Loading…",
    updated: (t: string) => `Last updated ${t}. This page refreshes automatically.`,
    notFound: "No queue was found at this address. Please check the address.",
    noQueues: "No queues yet.",
    mine: <><b>You're in the queue on this phone.</b><br />Tap to see your place.</>,
    waiting: (groups: number, people: number) => <>{word(groups, { one: "group", other: "groups" })} waiting, <b>{people}</b> {word(people, { one: "person", other: "people" })} in total</>,
    nobody: "Nobody is waiting right now.",
    calledTitle: "Now called",
    noneCalled: "Nobody has been called yet.",
    last: (n: number) => `Last called: ${n}`,
    next: (n: number) => `Next: ${n}`,
    howTitle: "How do I join?",
    how: "When you arrive, scan the QR code on the attendant's screen with your phone camera. You need to be there to join; you can't join remotely.",
    directions: "Get directions",
    powered: (a: ReactNode) => <>Powered by {a}</>,
  },
  de: {
    title: "Warteschlangenstatus",
    queues: "Warteschlangen",
    loading: "Wird geladen…",
    updated: (t: string) => `Zuletzt aktualisiert um ${t}. Die Seite aktualisiert sich automatisch.`,
    notFound: "Unter dieser Adresse wurde keine Warteschlange gefunden. Bitte prüfen Sie die Adresse.",
    noQueues: "Noch keine Warteschlangen.",
    mine: <><b>Sie stehen mit diesem Telefon in der Warteschlange.</b><br />Tippen Sie, um Ihren Platz zu sehen.</>,
    waiting: (groups: number, people: number) => <>{word(groups, { one: "Gruppe wartet", other: "Gruppen warten" })}, insgesamt <b>{people}</b> {word(people, { one: "Person", other: "Personen" })}</>,
    nobody: "Derzeit wartet niemand.",
    calledTitle: "Jetzt aufgerufen",
    noneCalled: "Derzeit ist niemand aufgerufen.",
    last: (n: number) => `Zuletzt aufgerufen: ${n}`,
    next: (n: number) => `Als Nächstes: ${n}`,
    howTitle: "Wie stelle ich mich an?",
    how: "Scannen Sie vor Ort den QR-Code auf dem Bildschirm des Personals mit der Handykamera. Sie müssen vor Ort sein, aus der Ferne ist kein Anstellen möglich.",
    directions: "Route planen",
    powered: (a: ReactNode) => <>Betrieben mit {a}</>,
  },
  ru: {
    title: "Состояние очереди",
    queues: "Очереди",
    loading: "Загрузка…",
    updated: (t: string) => `Обновлено в ${t}. Страница обновляется автоматически.`,
    notFound: "По этому адресу очередь не найдена. Проверьте адрес.",
    noQueues: "Очередей пока нет.",
    mine: <><b>Вы в очереди с этого телефона.</b><br />Нажмите, чтобы увидеть своё место.</>,
    waiting: (groups: number, people: number) => <>{word(groups, { one: "группа ждёт", few: "группы ждут", many: "групп ждут", other: "группы ждут" })} в очереди, всего <b>{people}</b> {word(people, { one: "человек", few: "человека", many: "человек", other: "человека" })}</>,
    nobody: "Сейчас никто не ждёт.",
    calledTitle: "Сейчас вызваны",
    noneCalled: "Пока никого не вызвали.",
    last: (n: number) => `Последний вызванный: ${n}`,
    next: (n: number) => `Следующий: ${n}`,
    howTitle: "Как встать в очередь?",
    how: "На месте отсканируйте камерой телефона QR-код на экране сотрудника. Встать в очередь можно только находясь на месте, удалённо нельзя.",
    directions: "Проложить маршрут",
    powered: (a: ReactNode) => <>Работает на {a}</>,
  },
});

function StatusPage() {
  const [s, setS] = useState<Status>();
  const [list, setList] = useState<PublicRoom[]>(); // kullanıcı sayfası (antalyabb.sirangeldi.com): sıraları
  const [mine, setMine] = useState(false);
  const [updated, setUpdated] = useState(T.loading);
  const [err, setErr] = useState("");

  useEffect(() => {
    let stop = () => {};
    api<{ room?: string; account?: string }>(`/api/resolve?r=${encodeURIComponent(ref)}&u=${encodeURIComponent(user)}`).then(({ room, account }) => {
      if (account) {
        api<PublicRoom[]>(`/api/rooms?u=${account}`).then(setList, (e) => setErr(e.message));
        setUpdated("");
        return;
      }
      setMine(!!localStorage.getItem("ticket:" + room));
      const refresh = async () => {
        try {
          const st = await api<Status>(`/api/r/${room}/status`);
          document.title = `${st.name} · ${T.title}`;
          setS(st);
          setUpdated(T.updated(new Date().toLocaleTimeString(lang, { hour: "2-digit", minute: "2-digit" })));
          setErr("");
        } catch (e: any) { setErr(e.message); }
      };
      refresh();
      stop = poll(refresh, 15000);
    }).catch(() => {
      setUpdated("");
      setErr(T.notFound);
    });
    return () => stop();
  }, []);

  return (
    <Page>
      <Title>{s ? `${catIcon(s.category)} ${s.name}` : list ? T.queues : T.title}</Title>
      {updated && <p className="text-sm text-muted-foreground">{updated}</p>}

      {list && (
        <Card className="py-2">
          <CardContent className="flex flex-col divide-y">
            {list.map((r) => (
              <a key={r.link} href={r.link} className="flex flex-col py-3">
                <b>{catIcon(r.category)} {r.name}</b>
                <span className="text-sm text-muted-foreground">{waitText(r)}</span>
              </a>
            ))}
            {!list.length && <p className="py-3 text-muted-foreground">{T.noQueues}</p>}
          </CardContent>
        </Card>
      )}

      {mine && (
        <a href={ref ? `/join?r=${ref}` : "/join"} className="rounded-xl bg-success p-4 text-success-foreground">
          {T.mine}
        </a>
      )}

      {s && (
        <>
          <Card>
            <CardContent className="text-center">
              <div className="text-7xl leading-tight font-extrabold text-primary tabular-nums">{s.waiting}</div>
              <p>{s.waiting ? T.waiting(s.waiting, s.people) : T.nobody}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-lg font-semibold">{T.calledTitle}</CardTitle></CardHeader>
            <CardContent className="flex flex-col gap-3 text-base">
              {s.called.length ? (
                <div className="flex flex-wrap gap-2">
                  {s.called.map((n) => (
                    <span key={n} className="rounded-lg bg-success px-4 py-1 text-2xl font-extrabold text-success-foreground tabular-nums">{n}</span>
                  ))}
                </div>
              ) : <p className="text-muted-foreground">{T.noneCalled}</p>}
              <p className="text-sm text-muted-foreground">
                {[s.lastNo && T.last(s.lastNo), s.next && T.next(s.next)].filter(Boolean).join(". ")}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-lg font-semibold">{T.howTitle}</CardTitle></CardHeader>
            <CardContent className="flex flex-col gap-3 text-base">
              <p>{T.how}</p>
              <Button variant="secondary" asChild>
                <a href={`https://www.google.com/maps/dir/?api=1&destination=${s.lat},${s.lng}`} target="_blank" rel="noopener">{T.directions}</a>
              </Button>
            </CardContent>
          </Card>
        </>
      )}

      <ErrorText>{err}</ErrorText>
      <p className="text-center text-sm text-muted-foreground">{T.powered(<a className="underline" href={home}>Sıran Geldi</a>)} · <a className="underline" href={`${home}privacy`}>{LEGAL.privacyShort}</a></p>
    </Page>
  );
}

mount(<StatusPage />);
