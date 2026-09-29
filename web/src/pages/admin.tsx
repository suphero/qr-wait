import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { useConfirm } from "@/components/confirm";
import { ErrorText, Page, Title } from "@/components/page";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldContent, FieldDescription, FieldLabel, FieldLegend, FieldSet } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { api, CATEGORIES, catIcon, locate, poll, type RoomInfo } from "@/lib/api";
import { baseMap, L } from "@/lib/leaflet";
import { mount } from "@/lib/mount";

let pw = sessionStorage.getItem("pw");
const adm = <T = any,>(path: string, body?: unknown, method?: string) => api<T>("/api/admin/rooms" + path, body, { "x-admin": pw ?? "" }, method);
const slugify = (t: string) => t.toLocaleLowerCase("tr").replace(/[çğıöşü]/g, (c) => "cgiosu"["çğıöşü".indexOf(c)])
  .normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40);

type Pt = { lat: number; lng: number };
type Form = {
  name: string; category: string; private: boolean; slug: string; radius: string; flex: boolean;
  maxGroup: string; qr: "dynamic" | "static"; ttl: string;
};

// Onay kutusu + başlık + açıklama
function Check({ checked, onChange, title, children }: { checked: boolean; onChange: (v: boolean) => void; title: string; children: ReactNode }) {
  return (
    <Field orientation="horizontal">
      <Checkbox id={title} checked={checked} onCheckedChange={(c) => onChange(c === true)} />
      <FieldContent>
        <FieldLabel htmlFor={title} className="text-base font-semibold">{title}</FieldLabel>
        <FieldDescription>{children}</FieldDescription>
      </FieldContent>
    </Field>
  );
}

// Yeni + düzenle formu. room: düzenlenen oda, yoksa yeni oda.
function RoomForm({ room, rooms, onDone, onCancel, onError }: { room: RoomInfo | null; rooms: RoomInfo[]; onDone: () => void; onCancel: () => void; onError: (m: string) => void }) {
  const confirm = useConfirm();
  const [f, setF] = useState<Form>({
    name: room?.name ?? "", category: room?.category ?? "diger", private: !!room?.private,
    slug: room?.private ? "" : room?.slug ?? "", // gizli odanın rastgele adresi açık adrese taşınmasın
    radius: String(room?.radius ?? 300), flex: !!room?.flex, maxGroup: String(room?.maxGroup ?? 8), qr: room?.qr ?? "dynamic", ttl: String(room?.ttl ?? 90),
  });
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setF((x) => ({ ...x, [k]: v }));
  const slugTouched = useRef(!!room?.slug && !room.private); // mevcut odanın adresi, ad değişince kendiliğinden değişmesin
  const [pt, setPt] = useState<Pt | null>(room && { lat: room.lat, lng: room.lng });
  const [pos, setPos] = useState(room ? "" : "Haritada sıranın kurulacağı yerin ortasına dokunun. İşaretçiyi sürükleyerek ince ayar yapabilirsiniz.");
  const [q, setQ] = useState("");
  const mapEl = useRef<HTMLDivElement>(null), formEl = useRef<HTMLFormElement>(null);
  const m = useRef<{ map?: L.Map; marker?: L.Marker; circle?: L.Circle }>({});
  const fitNext = useRef(!!room); // nokta aramadan/konumdan ya da mevcut odadan geldiyse haritayı daireye sığdır

  const radius = +f.radius || 300;

  useEffect(() => {
    const map = baseMap(mapEl.current!).setView([39, 35], 6);
    map.on("click", (e) => setPt({ lat: e.latlng.lat, lng: e.latlng.lng }));
    m.current.map = map;
    formEl.current?.scrollIntoView({ behavior: "smooth" });
    return () => { map.remove(); m.current = {}; };
  }, []);

  // İşaretçi ve kabul dairesi seçilen noktayı ve yarıçapı izler
  useEffect(() => {
    const c = m.current;
    if (!pt || !c.map) return;
    if (!c.marker) {
      c.marker = L.marker(pt, { draggable: true }).addTo(c.map).on("dragend", () => setPt(c.marker!.getLatLng()));
      c.circle = L.circle(pt, { radius }).addTo(c.map);
    }
    c.marker.setLatLng(pt);
    c.circle!.setLatLng(pt).setRadius(radius);
    if (fitNext.current) { fitNext.current = false; c.map.fitBounds(c.circle!.getBounds()); }
    setPos(`Seçilen nokta: ${pt.lat.toFixed(5)}, ${pt.lng.toFixed(5)}`);
  }, [pt, radius]);

  const pickAndFit = (p: Pt) => { fitNext.current = true; setPt(p); };

  async function search() {
    if (!q.trim()) return;
    try {
      const [r] = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=tr&q=${encodeURIComponent(q.trim())}`).then((x) => x.json());
      if (!r) return setPos("Adres bulunamadı, farklı yazmayı deneyin.");
      pickAndFit({ lat: +r.lat, lng: +r.lon });
    } catch { setPos("Adres araması şu an çalışmıyor, haritadan seçin."); }
  }

  async function submit(ev: FormEvent) {
    ev.preventDefault();
    if (!pt) return onError("Haritadan sıranın konumunu seçin.");
    const { slug, ...rest } = f;
    const body = { ...rest, ...(f.private ? {} : { slug }), radius: +f.radius, maxGroup: +f.maxGroup, ttl: +f.ttl, ...pt };
    const prev = rooms.find((r) => r.room === room?.room);
    const changed = prev?.slug && (f.private ? !prev.private : prev.slug !== slug);
    if (changed && !(await confirm({ title: "Adres değişecek", description: "Adres değişirse eski görevli linki ve ekrandaki QR çalışmaz. Görevlilere yeni linki göndermeniz gerekir. Devam?", action: "Devam" }))) return;
    try {
      await (room ? adm(`/${room.room}`, body, "PUT") : adm("", body));
      onDone();
    } catch (e: any) { onError(e.message); }
  }

  return (
    <Card>
      <CardHeader><CardTitle className="text-lg font-semibold">{room ? `Düzenle: ${room.name}` : "Yeni sıra"}</CardTitle></CardHeader>
      <CardContent>
        <form ref={formEl} onSubmit={submit} className="flex flex-col gap-5 text-base">
          <Field>
            <FieldLabel htmlFor="name">Sıra adı</FieldLabel>
            <Input id="name" required maxLength={60} placeholder="ör. Konyaaltı Halk Plajı, Kadıköy İskelesi" value={f.name}
              onChange={(e) => { set("name", e.target.value); if (!slugTouched.current) set("slug", slugify(e.target.value)); }} />
          </Field>
          <Field>
            <FieldLabel htmlFor="category">Kategori</FieldLabel>
            <NativeSelect id="category" value={f.category} onChange={(e) => set("category", e.target.value)}>
              {Object.entries(CATEGORIES).map(([k, [i, t]]) => <NativeSelectOption key={k} value={k}>{i} {t}</NativeSelectOption>)}
            </NativeSelect>
          </Field>
          <Check title="Gizli sıra" checked={f.private} onChange={(v) => set("private", v)}>
            Tanıtım sitesindeki haritada ve listede görünmez. Web adresi tahmin edilemeyecek rastgele bir değer olur; yalnızca linki paylaştığınız kişiler ulaşabilir.
          </Check>
          {f.private ? (
            <p className="text-sm text-muted-foreground">{room?.private ? `Mevcut gizli adres korunur: ${room.slug}` : "Kaydedince rastgele bir adres üretilir."}</p>
          ) : (
            <Field>
              <FieldLabel htmlFor="slug">Web adresi (slug)</FieldLabel>
              <Input id="slug" required minLength={3} maxLength={40} pattern="[a-z0-9][a-z0-9\-]*[a-z0-9]" placeholder="antalya-konserve" value={f.slug}
                onChange={(e) => { slugTouched.current = true; set("slug", e.target.value); }} />
              <FieldDescription>Küçük harf, rakam ve tire. Sıranın web adresi olur: <b>{f.slug || "…"}</b></FieldDescription>
            </Field>
          )}
          <Field>
            <FieldLabel htmlFor="q">Adres ara</FieldLabel>
            <div className="flex gap-2">
              <Input id="q" placeholder="ör. Konyaaltı, Antalya" value={q} onChange={(e) => setQ(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); search(); } }} />
              <Button type="button" onClick={search}>Ara</Button>
            </div>
          </Field>
          <div className="flex flex-col gap-2">
            <div ref={mapEl} className="z-0 h-[360px] rounded-lg" />
            <Button type="button" variant="secondary" onClick={async () => {
              try { const c = await locate(); pickAndFit({ lat: c.latitude, lng: c.longitude }); } catch (e: any) { setPos(e.message); }
            }}>Şu anki konumumu kullan</Button>
            <p className="text-sm text-muted-foreground">{pos}</p>
          </div>
          <Field>
            <FieldLabel htmlFor="radius">Kabul yarıçapı (metre)</FieldLabel>
            <Input id="radius" type="number" min={50} max={2000} required value={f.radius} onChange={(e) => set("radius", e.target.value)} />
            <FieldDescription>Ziyaretçiler yalnızca dairenin içindeyken sıraya girebilir. Telefon GPS'i 20-50 m sapabilir, daireyi alandan biraz geniş tutun.</FieldDescription>
          </Field>
          <Check title="Esnek yer seçimi" checked={f.flex} onChange={(v) => set("flex", v)}>
            Gruplar kişi sayısından az yeri de kabul edebilir. Örneğin plajda 4 kişilik grup 2 veya 4 şezlonga razı olabilir. Otobüs ya da gişe sıralarında kapalı bırakın.
          </Check>
          <Field>
            <FieldLabel htmlFor="maxGroup">Bir grupta en fazla kaç kişi olabilir?</FieldLabel>
            <Input id="maxGroup" type="number" min={1} max={20} required inputMode="numeric" value={f.maxGroup} onChange={(e) => set("maxGroup", e.target.value)} />
            <FieldDescription>Sıraya girerken ve elle eklerken 1'den bu sayıya kadar seçilebilir. Tek kişilik sıralarda (gişe, muayene) 1 yapın.</FieldDescription>
          </Field>
          <FieldSet className="rounded-lg border p-4">
            <FieldLegend>QR kodu</FieldLegend>
            <RadioGroup value={f.qr} onValueChange={(v) => set("qr", v as Form["qr"])} className="gap-4">
              <Field orientation="horizontal">
                <RadioGroupItem value="dynamic" id="qr-dynamic" />
                <FieldContent>
                  <FieldLabel htmlFor="qr-dynamic" className="text-base font-semibold">Değişen QR (önerilen)</FieldLabel>
                  <FieldDescription>Görevli ekranında gösterilir ve sürekli yenilenir. Fotoğrafı çekilip sonradan kullanılamaz.</FieldDescription>
                </FieldContent>
              </Field>
              {f.qr === "dynamic" && (
                <Field className="pl-6">
                  <FieldLabel htmlFor="ttl">Her kod ne kadar geçerli?</FieldLabel>
                  <NativeSelect id="ttl" value={f.ttl} onChange={(e) => set("ttl", e.target.value)}>
                    <NativeSelectOption value="60">60 saniye</NativeSelectOption>
                    <NativeSelectOption value="90">90 saniye</NativeSelectOption>
                    <NativeSelectOption value="180">3 dakika</NativeSelectOption>
                    <NativeSelectOption value="300">5 dakika</NativeSelectOption>
                  </NativeSelect>
                  <FieldDescription>Ekran, sürenin dörtte birinde yeni kod gösterir. Okutan kişiye formu doldurmak için en az sürenin dörtte üçü kalır. İnternet ya da konum yavaşsa uzatın.</FieldDescription>
                </Field>
              )}
              <Field orientation="horizontal">
                <RadioGroupItem value="static" id="qr-static" />
                <FieldContent>
                  <FieldLabel htmlFor="qr-static" className="text-base font-semibold">Sabit QR</FieldLabel>
                  <FieldDescription>Görevli ekranı gerekmez: kodu yazdırıp asabilirsiniz. Kod değişmez, bu yüzden sıraya girişi yalnızca konum kontrolü sınırlar. "Linki yenile" eski basılı kodu geçersiz kılar.</FieldDescription>
                </FieldContent>
              </Field>
            </RadioGroup>
          </FieldSet>
          <div className="flex gap-2">
            <Button type="button" variant="secondary" className="flex-1" onClick={onCancel}>Vazgeç</Button>
            <Button className="flex-1">Kaydet</Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function RoomCard({ r, onChange, onEdit, onError }: { r: RoomInfo; onChange: () => Promise<void>; onEdit: () => void; onError: (m: string) => void }) {
  const confirm = useConfirm();
  const [copied, setCopied] = useState(false);

  async function run(fn: () => Promise<unknown>) {
    try { await fn(); await onChange(); } catch (e: any) { onError(e.message); }
  }
  async function copy() {
    try { await navigator.clipboard.writeText(r.link); } catch {
      return confirm({ title: "Bağlantıyı kopyalayın", description: <span className="break-all select-all">{r.link}</span>, cancel: false });
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <Card>
      <CardContent className="flex flex-col gap-2 text-base">
        <p>
          <b>{catIcon(r.category)} {r.name}</b>{" "}
          <span className="text-sm text-muted-foreground">{r.private ? "🔒 gizli" : r.slug ? r.slug : "⚠ adres yok, Düzenle ile ekleyin"}</span>
        </p>
        <p className="text-sm text-muted-foreground">
          {r.waiting} grup / {r.people} kişi bekliyor · {r.called} çağrıldı · {r.radius} m · en fazla {r.maxGroup} kişi{r.flex ? " · esnek yer" : ""} · {r.qr === "static" ? "sabit QR" : `QR ${r.ttl} sn`}
        </p>
        <div className="flex flex-wrap gap-2 *:flex-auto">
          <Button onClick={copy}>{copied ? "Kopyalandı ✓" : "Görevli linkini kopyala"}</Button>
          <Button variant="secondary" asChild><a href={r.link} target="_blank">Paneli aç</a></Button>
          <Button variant="secondary" onClick={onEdit}>Düzenle</Button>
          <Button variant="secondary" onClick={async () => {
            if (await confirm({ title: "Görevli linki yenilensin mi?", description: `"${r.name}" için yeni görevli linki oluşturulacak. Eski link ve ${r.qr === "static" ? "basılı QR'lar" : "ekrandaki QR"} hemen çalışmaz hale gelir. Devam?`, action: "Yenile" }))
              run(() => adm(`/${r.room}/rotate`, {}));
          }}>Linki yenile</Button>
          {r.private && (
            <Button variant="secondary" onClick={async () => {
              if (await confirm({ title: "Gizli adres yenilensin mi?", description: `"${r.name}" için yeni gizli adres oluşturulacak. Eski adres, görevli linki ve ekrandaki QR hemen çalışmaz hale gelir; sıradakilerin açık sayfaları çalışmaya devam eder. Devam?`, action: "Yenile" }))
                run(() => adm(`/${r.room}/reslug`, {}));
            }}>Gizli adresi yenile</Button>
          )}
          <Button variant="destructive" onClick={async () => {
            if (await confirm({ title: "Sıra silinsin mi?", description: `"${r.name}" silinecek. Sıradaki herkes düşer. Emin misiniz?`, action: "Sil", destructive: true }))
              run(() => adm(`/${r.room}`, undefined, "DELETE"));
          }}>Sil</Button>
        </div>
      </CardContent>
    </Card>
  );
}

function AdminPage() {
  const [authed, setAuthed] = useState(false);
  const [rooms, setRooms] = useState<RoomInfo[]>([]);
  const [editing, setEditing] = useState<RoomInfo | null | undefined>(); // undefined: form kapalı, null: yeni oda
  const [err, setErr] = useState("");
  const [pwInput, setPwInput] = useState("");
  const formOpen = useRef(false);
  formOpen.current = editing !== undefined;

  async function load() {
    try {
      setRooms(await adm<RoomInfo[]>(""));
      setErr("");
      setAuthed(true);
    } catch (e: any) {
      if (e.message === "Hatalı şifre") return logout(e.message);
      setErr(e.message);
    }
  }

  function logout(msg = "") {
    sessionStorage.removeItem("pw");
    pw = null;
    setAuthed(false);
    setEditing(undefined);
    setErr(msg);
  }

  useEffect(() => {
    if (pw) load();
    return poll(() => pw && !formOpen.current && load(), 15000, true);
  }, []);

  if (!authed) {
    return (
      <Page>
        <Card className="mt-3">
          <CardHeader><Title className="mt-0">Yönetim girişi</Title></CardHeader>
          <CardContent>
            <form className="flex flex-col gap-4 text-base" onSubmit={(ev) => { ev.preventDefault(); sessionStorage.setItem("pw", (pw = pwInput)); load(); }}>
              <Field>
                <FieldLabel htmlFor="pw">Yönetici şifresi</FieldLabel>
                <Input id="pw" type="password" required autoComplete="current-password" value={pwInput} onChange={(e) => setPwInput(e.target.value)} />
              </Field>
              <Button>Giriş</Button>
            </form>
          </CardContent>
        </Card>
        <ErrorText>{err}</ErrorText>
      </Page>
    );
  }

  return (
    <Page>
      <div className="flex items-center gap-2">
        <Title className="flex-1">Sıralar</Title>
        <Button variant="secondary" onClick={() => logout()}>Çıkış</Button>
      </div>
      <Button onClick={() => setEditing(null)}>+ Yeni sıra</Button>
      {rooms.map((r) => <RoomCard key={r.room} r={r} onChange={load} onEdit={() => setEditing(r)} onError={setErr} />)}
      {!rooms.length && <p className="text-muted-foreground">Henüz sıra yok. + Yeni sıra ile ilk sıranızı oluşturun.</p>}
      {editing !== undefined && (
        <RoomForm key={editing?.room ?? "new"} room={editing} rooms={rooms} onError={setErr}
          onDone={() => { setEditing(undefined); load(); }} onCancel={() => setEditing(undefined)} />
      )}
      <ErrorText>{err}</ErrorText>
    </Page>
  );
}

mount(<AdminPage />);
