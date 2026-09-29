import { QRCodeCanvas } from "qrcode.react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useConfirm } from "@/components/confirm";
import { AcceptPicker, SizeSelect } from "@/components/group";
import { ErrorText, Page, Title } from "@/components/page";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { api, mins, poll, tableName, type AdminState, type Entry } from "@/lib/api";
import { mount } from "@/lib/mount";
import { cn } from "@/lib/utils";

// Hash: "<slug veya id>.<anahtar>" ya da yalnızca "<anahtar>". Eski <slug>.sirangeldi.com/host#<anahtar> linki
// yeni adrese ?r=<slug> ile yönlenir.
const hash = location.hash.slice(1), dot = hash.indexOf(".");
const ref = dot < 0 ? new URLSearchParams(location.search).get("r") ?? "" : hash.slice(0, dot), key = hash.slice(dot + 1);
let room = ""; // açılışta çözülen oda id'si; slug sonradan değişse de açık panel çalışmaya devam eder

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Card className="print:hidden">
      <CardHeader><CardTitle className="text-lg font-semibold">{title}</CardTitle></CardHeader>
      <CardContent className="text-base">{children}</CardContent>
    </Card>
  );
}

// Yer bilgisi: çağrılanda ayrılan yer, bekleyende (kişi sayısından farklıysa) kabul edilen yerler
function Row({ e, children }: { e: Entry; children: ReactNode }) {
  const late = e.calledAt && mins(e.calledAt) >= 10;
  return (
    <div className="flex items-center gap-2 border-b py-2 last:border-0">
      <b className="min-w-[3.5em] tabular-nums">#{e.no}</b>
      <span className="flex-1">
        {e.size} kişi
        {e.table ? <> · <b>{tableName(e.table)}</b>{e.table.name && ` (${e.table.cap} kişilik)`}</>
          : e.status === "called" ? e.alloc != null && <> · <b>{e.alloc} yer</b></>
          : e.accept && (e.accept.length > 1 || e.accept[0] !== e.size) ? ` · ${e.accept.join("/")} yer olur` : ""}
        {e.src === "manual" && " · elle"}
        {e.note && ` · ${e.note}`}
        {e.calledAt && <> · <span className={cn(late && "font-bold text-destructive")}>{mins(e.calledAt)} dk önce</span></>}
      </span>
      {children}
    </div>
  );
}

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
  const qr = useRef({ at: 0, text: "" });

  async function act(body: Record<string, unknown> = {}) {
    try {
      const st = await api<AdminState>(`/api/r/${room}/admin`, body, { "x-key": key });
      // Değişen QR: sürenin dörtte birinde bir yeni kod (okutana sürenin en az 3/4'ü kalır). Sabit QR: yalnızca değişirse.
      const fixed = st.qr === "static", q = qr.current;
      if (fixed ? st.token !== q.text : q.text.startsWith("s.") || Date.now() - q.at > st.ttl * 250) {
        setQrUrl(`${location.origin}/join?${ref ? `r=${ref}&` : ""}t=${st.token}`);
        qr.current = { at: Date.now(), text: st.token };
      }
      setS(st);
      setErr("");
      return st;
    } catch (e: any) { setErr(e.message); }
  }

  useEffect(() => {
    let stop = () => {};
    api<{ room: string }>(`/api/resolve?r=${encodeURIComponent(ref)}`)
      .then((r) => { room = r.room; act(); stop = poll(act, 4000, true); })
      .catch((e) => setErr(`Geçersiz görevli bağlantısı: ${e.message}`));
    return () => stop();
  }, []);

  useEffect(() => {
    if (!s) return;
    setAddSize((n) => Math.min(n, s.maxGroup));
    setAddAccept((a) => a.filter((n) => n <= s.maxGroup));
  }, [s?.maxGroup]);

  async function add() {
    const st = await act({ action: "add", size: addSize, accept: addAccept, note: addNote });
    if (st?.added) {
      setAddNote("");
      await confirm({ title: `Sıra numarası: ${st.added}`, description: "Kişiye söyleyin.", cancel: false });
    }
  }

  async function freeTable(n: number) {
    if (!(n >= 1)) return;
    const label = tableName({ id: "", at: 0, cap: n, name: tName.trim() });
    const st = await act({ action: "table", n, name: tName });
    if (!st) return;
    setTName(""); setTCap("");
    setTMsg(st.seated ? `${label} → #${st.seated} çağrıldı.` : `${label} için uygun grup yok. Boş masalarda bekliyor, uygun grup gelince otomatik çağrılır.`);
  }

  const waiting = s?.entries.filter((e) => e.status === "waiting") ?? [];
  const called = s?.entries.filter((e) => e.status === "called") ?? [];
  const fixed = s?.qr === "static";

  return (
    <Page>
      <Title>{s?.name ?? "Görevli paneli"}</Title>
      {s && <p className="text-sm text-muted-foreground print:hidden">{waiting.length} grup / {waiting.reduce((n, e) => n + e.size, 0)} kişi bekliyor</p>}
      <ErrorText>{err}</ErrorText>

      <Card className={cn("print:shadow-none print:ring-0", full && "fixed inset-0 z-50 justify-center rounded-none")}>
        <CardContent className="flex flex-col items-center gap-3 text-center text-base">
          {qrUrl && <QRCodeCanvas value={qrUrl} size={360} level="M" marginSize={0} className="h-auto! max-w-full" />}
          <p><b>Sıraya girmek için telefon kameranızla okutun</b></p>
          {fixed && <p className="text-sm text-muted-foreground print:hidden">Bu QR sabittir, değişmez. Yazdırıp sıranın başına asabilirsiniz.</p>}
          <div className="flex w-full gap-2 print:hidden">
            <Button variant="secondary" className="flex-1" onClick={() => setFull(!full)}>Tam ekran QR</Button>
            {fixed && <Button variant="secondary" className="flex-1" onClick={() => print()}>Yazdır</Button>}
          </div>
        </CardContent>
      </Card>

      {s?.tables && (
        <Section title="Masa boşaldı">
          <div className="flex flex-col gap-3">
            <Input placeholder="Masa adı / no (isteğe bağlı, ör. 7 veya Bahçe 3)" maxLength={20} value={tName} onChange={(e) => setTName(e.target.value)} />
            <div className="flex flex-wrap gap-2 *:flex-auto">
              {[2, 4, 6].map((n) => <Button key={n} onClick={() => freeTable(n)}>{n} kişilik</Button>)}
              <div className="flex gap-2">
                <Input className="w-20" type="number" min={1} max={50} inputMode="numeric" placeholder="kişi" value={tCap} onChange={(e) => setTCap(e.target.value)} />
                <Button variant="secondary" onClick={() => freeTable(+tCap)}>Boşaldı</Button>
              </div>
            </div>
            <p className="text-sm text-muted-foreground">
              Sıradaki gruplardan masaya sığan ilk grup çağrılır.
              {s.maxEmpty !== null && ` Masada en fazla ${s.maxEmpty} boş sandalye kalacak şekilde.`}
              {" "}Birleştirdiğiniz masaları toplam kişi sayısıyla girin.
            </p>
            {tMsg && <p className="text-sm font-semibold">{tMsg}</p>}
          </div>
          {!!s.freeTables.length && (
            <div className="mt-3">
              <p className="text-sm text-muted-foreground">Boş masalar (uygun grup bekliyor)</p>
              {s.freeTables.map((t) => (
                <div key={t.id} className="flex items-center gap-2 border-b py-2 last:border-0">
                  <span className="flex-1"><b>{tableName(t)}</b>{t.name && ` · ${t.cap} kişilik`} · {mins(t.at)} dk</span>
                  <Button variant="secondary" size="sm" onClick={() => act({ action: "untable", id: t.id })}>Kaldır</Button>
                </div>
              ))}
            </div>
          )}
        </Section>
      )}

      {s && !s.tables && <Section title="Boşalan yer sayısı">
        <div className="flex gap-2">
          <Input className="w-24" type="number" min={1} max={500} inputMode="numeric" value={freeN} onChange={(e) => setFreeN(e.target.value)} />
          <Button className="flex-1 whitespace-normal" onClick={() => act({ action: "free", n: +freeN })}>Yer boşaldı, sıradakileri çağır</Button>
        </div>
        {!!s?.available && (
          <p className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
            <span className="flex-1">Ayrılmayı bekleyen boş yer: <b>{s.available}</b> (sıradaki grup sığmıyor)</span>
            <Button variant="secondary" size="sm" onClick={() => act({ action: "setAvailable", n: 0 })}>Sıfırla</Button>
          </p>
        )}
      </Section>}

      <Section title="Çağrılanlar">
        {called.map((e) => (
          <Row key={e.id} e={e}>
            <Button variant="success" size="sm" onClick={() => act({ action: "arrived", id: e.id })}>Geldi</Button>
            <Button variant="destructive" size="sm" onClick={() => act({ action: "drop", id: e.id })}>Gelmedi</Button>
          </Row>
        ))}
        {!called.length && <p className="text-muted-foreground">Yok</p>}
      </Section>

      <Section title="Bekleyenler">
        {waiting.map((e) => (
          <Row key={e.id} e={e}>
            <Button variant="secondary" size="sm" onClick={() => act({ action: "call", id: e.id })}>Çağır</Button>
            <Button variant="secondary" size="sm" onClick={() => act({ action: "drop", id: e.id })}>Sil</Button>
          </Row>
        ))}
        {!waiting.length && <p className="text-muted-foreground">Sıra boş</p>}
      </Section>

      <Section title="Elle ekle (telefonu olmayanlar için)">
        <div className="flex flex-col gap-3">
          <div className="flex gap-2">
            <SizeSelect className="w-24 shrink-0" max={s?.maxGroup ?? 8} value={addSize} onChange={(n) => { setAddSize(n); setAddAccept([n]); }} />
            <Input placeholder="Not (ör. şapkalı amca)" maxLength={60} value={addNote} onChange={(e) => setAddNote(e.target.value)} />
          </div>
          {s?.flex && (
            <div>
              <p className="text-sm text-muted-foreground">Kaç yer olursa kabul ediyorlar?</p>
              <AcceptPicker size={addSize} value={addAccept} onChange={setAddAccept} />
            </div>
          )}
          <Button onClick={add}>Sıraya ekle</Button>
        </div>
      </Section>

      <Button variant="destructive" className="print:hidden" onClick={async () => {
        if (await confirm({ title: "Sırayı sıfırla", description: "Tüm sıra silinecek. Emin misiniz?", action: "Sıfırla", destructive: true })) act({ action: "reset" });
      }}>Sırayı sıfırla (gün sonu)</Button>
    </Page>
  );
}

mount(<HostPage />);
