import { useEffect, useState } from "react";
import { ErrorText, Page, Title } from "@/components/page";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { api, catIcon, poll, type Status } from "@/lib/api";
import { mount } from "@/lib/mount";

const ref = new URLSearchParams(location.search).get("r") ?? "";
const base = location.hostname.split(".").slice(1).join(".");
const home = base.includes(".") ? `https://${base}/` : "/"; // alt alan adındaysak ana siteye

function StatusPage() {
  const [s, setS] = useState<Status>();
  const [mine, setMine] = useState(false);
  const [updated, setUpdated] = useState("Yükleniyor…");
  const [err, setErr] = useState("");

  useEffect(() => {
    let stop = () => {};
    api<{ room: string }>(`/api/resolve?r=${encodeURIComponent(ref)}`).then(({ room }) => {
      setMine(!!localStorage.getItem("ticket:" + room));
      const refresh = async () => {
        try {
          const st = await api<Status>(`/api/r/${room}/status`);
          document.title = `${st.name} · Sıra durumu`;
          setS(st);
          setUpdated(`Son güncelleme ${new Date().toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })}. Sayfa kendini yeniler.`);
          setErr("");
        } catch (e: any) { setErr(e.message); }
      };
      refresh();
      stop = poll(refresh, 15000);
    }).catch(() => {
      setUpdated("");
      setErr("Bu adreste bir sıra bulunamadı. Adresi kontrol edin.");
    });
    return () => stop();
  }, []);

  return (
    <Page>
      <Title>{s ? `${catIcon(s.category)} ${s.name}` : "Sıra durumu"}</Title>
      <p className="text-sm text-muted-foreground">{updated}</p>

      {mine && (
        <a href={ref ? `/join?r=${ref}` : "/join"} className="rounded-xl bg-success p-4 text-success-foreground">
          <b>Bu telefonla sıradasınız.</b><br />Sıranızı görmek için dokunun.
        </a>
      )}

      {s && (
        <>
          <Card>
            <CardContent className="text-center">
              <div className="text-7xl leading-tight font-extrabold text-primary tabular-nums">{s.waiting}</div>
              <p>{s.waiting ? <>grup sırada bekliyor, toplam <b>{s.people}</b> kişi</> : "Şu an sırada bekleyen yok."}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-lg font-semibold">Şu an çağrılanlar</CardTitle></CardHeader>
            <CardContent className="flex flex-col gap-3 text-base">
              {s.called.length ? (
                <div className="flex flex-wrap gap-2">
                  {s.called.map((n) => (
                    <span key={n} className="rounded-lg bg-success px-4 py-1 text-2xl font-extrabold text-success-foreground tabular-nums">{n}</span>
                  ))}
                </div>
              ) : <p className="text-muted-foreground">Şu an çağrılan yok.</p>}
              <p className="text-sm text-muted-foreground">
                {[s.lastNo && `Son çağrılan: ${s.lastNo}`, s.next && `Sıradaki: ${s.next}`].filter(Boolean).join(". ")}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-lg font-semibold">Nasıl sıraya girerim?</CardTitle></CardHeader>
            <CardContent className="flex flex-col gap-3 text-base">
              <p>Oraya vardığınızda görevlinin ekranındaki QR kodu telefonunuzun kamerasıyla okutun. Sıraya girmek için orada olmanız gerekir, uzaktan sıraya girilemez.</p>
              <Button variant="secondary" asChild>
                <a href={`https://www.google.com/maps/dir/?api=1&destination=${s.lat},${s.lng}`} target="_blank" rel="noopener">Yol tarifi al</a>
              </Button>
            </CardContent>
          </Card>
        </>
      )}

      <ErrorText>{err}</ErrorText>
      <p className="text-center text-sm text-muted-foreground"><a className="underline" href={home}>Sıran Geldi</a> ile çalışır</p>
    </Page>
  );
}

mount(<StatusPage />);
