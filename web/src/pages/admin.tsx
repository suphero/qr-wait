import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import {
  CheckIcon, ChevronDownIcon, ChevronLeftIcon, ChevronRightIcon, ChevronsUpDownIcon, ChevronUpIcon, CopyIcon, EllipsisIcon,
  ExternalLinkIcon, LocateFixedIcon, LockIcon, PencilIcon, RefreshCwIcon, SearchIcon, Trash2Icon,
} from "lucide-react";
import { useConfirm } from "@/components/confirm";
import { ErrorText, Page, Title } from "@/components/page";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Field, FieldContent, FieldDescription, FieldLabel, FieldLegend, FieldSet } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { api, CATEGORIES, catIcon, locate, poll, type RoomInfo } from "@/lib/api";
import { baseMap, fmtDist, L, meters } from "@/lib/leaflet";
import { mount } from "@/lib/mount";
import { cn } from "@/lib/utils";

let pw = sessionStorage.getItem("pw");
const adm = <T = any,>(path: string, body?: unknown, method?: string) => api<T>("/api/admin/rooms" + path, body, { "x-admin": pw ?? "" }, method);
const slugify = (t: string) => t.toLocaleLowerCase("tr").replace(/[çğıöşü]/g, (c) => "cgiosu"["çğıöşü".indexOf(c)])
  .normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40);

type Pt = { lat: number; lng: number };
type Form = {
  name: string; category: string; private: boolean; slug: string; radius: string; flex: boolean;
  mode: "seats" | "tables"; maxEmpty: string; maxGroup: string; qr: "dynamic" | "static"; ttl: string;
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
    radius: String(room?.radius ?? 300), flex: !!room?.flex, mode: room?.mode ?? "seats", maxEmpty: String(room?.maxEmpty ?? ""), maxGroup: String(room?.maxGroup ?? 8), qr: room?.qr ?? "dynamic", ttl: String(room?.ttl ?? 90),
  });
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setF((x) => ({ ...x, [k]: v }));
  const modeTouched = useRef(!!room); // yeni sırada tür elle seçilmedikçe kategoriden gelir (restoran → masa)
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
    const body = { ...rest, ...(f.private ? {} : { slug }), radius: +f.radius, maxEmpty: f.maxEmpty === "" ? null : +f.maxEmpty, maxGroup: +f.maxGroup, ttl: +f.ttl, ...pt };
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
            <NativeSelect id="category" value={f.category} onChange={(e) => {
              set("category", e.target.value);
              if (!modeTouched.current) set("mode", e.target.value === "restoran" ? "tables" : "seats");
            }}>
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
          <FieldSet className="rounded-lg border p-4">
            <FieldLegend>Sıra türü</FieldLegend>
            <RadioGroup value={f.mode} onValueChange={(v) => { modeTouched.current = true; set("mode", v as Form["mode"]); }} className="gap-4">
              <Field orientation="horizontal">
                <RadioGroupItem value="seats" id="mode-seats" />
                <FieldContent>
                  <FieldLabel htmlFor="mode-seats" className="text-base font-semibold">Yer sayısı</FieldLabel>
                  <FieldDescription>Görevli boşalan yer sayısını girer, sıradaki gruplar sığdıkça çağrılır. Plaj, iskele, gişe, bekleme salonu.</FieldDescription>
                </FieldContent>
              </Field>
              {f.mode === "seats" && (
                <div className="pl-6">
                  <Check title="Esnek yer seçimi" checked={f.flex} onChange={(v) => set("flex", v)}>
                    Gruplar kişi sayısından az yeri de kabul edebilir. Örneğin plajda 4 kişilik grup 2 veya 4 şezlonga razı olabilir. Otobüs ya da gişe sıralarında kapalı bırakın.
                  </Check>
                </div>
              )}
              <Field orientation="horizontal">
                <RadioGroupItem value="tables" id="mode-tables" />
                <FieldContent>
                  <FieldLabel htmlFor="mode-tables" className="text-base font-semibold">Masa</FieldLabel>
                  <FieldDescription>Görevli "4 kişilik masa boşaldı" der, masaya sığan ilk grup masa adıyla çağrılır. Masa bölünmez; uygun grup yoksa masa bekler. Restoran, kafe.</FieldDescription>
                </FieldContent>
              </Field>
              {f.mode === "tables" && (
                <Field className="pl-6">
                  <FieldLabel htmlFor="maxEmpty">Masada en fazla kaç boş sandalye kalabilir?</FieldLabel>
                  <Input id="maxEmpty" type="number" min={0} max={50} inputMode="numeric" placeholder="Sınır yok" value={f.maxEmpty} onChange={(e) => set("maxEmpty", e.target.value)} />
                  <FieldDescription>Örneğin 1: 4 kişilik masaya 3-4 kişi, 2 kişilik masaya 1-2 kişi alınır. Boş bırakırsanız masaya sığan her grup alınır. Görevli "Çağır" ile bu sınırı aşabilir.</FieldDescription>
                </Field>
              )}
            </RadioGroup>
          </FieldSet>
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

function RoomRow({ r, dist, onChange, onEdit, onError }: { r: RoomInfo; dist?: number; onChange: () => Promise<void>; onEdit: () => void; onError: (m: string) => void }) {
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
    <TableRow>
      <TableCell className="whitespace-normal">
        <b>{catIcon(r.category)} {r.name}</b>
        <div className="text-sm text-muted-foreground">{r.private ? "🔒 gizli" : r.slug ? r.slug : "⚠ adres yok, Düzenle ile ekleyin"}</div>
        <div className="text-xs text-muted-foreground">
          {r.radius} m · en fazla {r.maxGroup} kişi{r.tables ? ` · masa${r.maxEmpty !== null ? ` (en fazla ${r.maxEmpty} boş)` : ""}` : r.flex ? " · esnek yer" : ""} · {r.qr === "static" ? "sabit QR" : `QR ${r.ttl} sn`}
        </div>
      </TableCell>
      <TableCell className="text-right tabular-nums">{r.waiting} <span className="text-muted-foreground">/ {r.people} kişi</span></TableCell>
      <TableCell className="text-right tabular-nums">{r.called}</TableCell>
      {dist !== undefined && <TableCell className="text-right tabular-nums">{fmtDist(dist)}</TableCell>}
      <TableCell>
        <div className="flex justify-end gap-1">
          <Button size="icon-sm" variant="ghost" title="Görevli linkini kopyala" onClick={copy}>{copied ? <CheckIcon /> : <CopyIcon />}</Button>
          <Button size="icon-sm" variant="ghost" title="Paneli aç" asChild><a href={r.link} target="_blank"><ExternalLinkIcon /></a></Button>
          <Button size="icon-sm" variant="ghost" title="Düzenle" onClick={onEdit}><PencilIcon /></Button>
          <DropdownMenu modal={false}>
            <DropdownMenuTrigger asChild><Button size="icon-sm" variant="ghost" title="Diğer"><EllipsisIcon /></Button></DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={async () => {
                if (await confirm({ title: "Görevli linki yenilensin mi?", description: `"${r.name}" için yeni görevli linki oluşturulacak. Eski link ve ${r.qr === "static" ? "basılı QR'lar" : "ekrandaki QR"} hemen çalışmaz hale gelir. Devam?`, action: "Yenile" }))
                  run(() => adm(`/${r.room}/rotate`, {}));
              }}><RefreshCwIcon /> Linki yenile</DropdownMenuItem>
              {r.private && (
                <DropdownMenuItem onSelect={async () => {
                  if (await confirm({ title: "Gizli adres yenilensin mi?", description: `"${r.name}" için yeni gizli adres oluşturulacak. Eski adres, görevli linki ve ekrandaki QR hemen çalışmaz hale gelir; sıradakilerin açık sayfaları çalışmaya devam eder. Devam?`, action: "Yenile" }))
                    run(() => adm(`/${r.room}/reslug`, {}));
                }}><LockIcon /> Gizli adresi yenile</DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onSelect={async () => {
                if (await confirm({ title: "Sıra silinsin mi?", description: `"${r.name}" silinecek. Sıradaki herkes düşer. Emin misiniz?`, action: "Sil", destructive: true }))
                  run(() => adm(`/${r.room}`, undefined, "DELETE"));
              }}><Trash2Icon /> Sil</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </TableCell>
    </TableRow>
  );
}

type SortKey = "name" | "waiting" | "called" | "dist";
const PAGE = 10;
const norm = (t: string) => t.toLocaleLowerCase("tr");

// Tıklanınca sıralayan başlık; aynı sütuna tekrar tıklamak yönü çevirir
function SortHead({ k, sort, setSort, className, children }: { k: SortKey; sort: { key: SortKey; asc: boolean }; setSort: (s: { key: SortKey; asc: boolean }) => void; className?: string; children: ReactNode }) {
  const on = sort.key === k;
  const Icon = !on ? ChevronsUpDownIcon : sort.asc ? ChevronUpIcon : ChevronDownIcon;
  return (
    <TableHead className={className} aria-sort={on ? (sort.asc ? "ascending" : "descending") : "none"}>
      <button type="button" className="inline-flex items-center gap-1 hover:text-primary" onClick={() => setSort({ key: k, asc: on ? !sort.asc : k === "name" || k === "dist" })}>
        {children}<Icon className={cn("size-3.5", !on && "opacity-40")} />
      </button>
    </TableHead>
  );
}

function RoomTable({ rooms, onChange, onEdit, onError }: { rooms: RoomInfo[]; onChange: () => Promise<void>; onEdit: (r: RoomInfo) => void; onError: (m: string) => void }) {
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<{ key: SortKey; asc: boolean }>({ key: "name", asc: true });
  const [page, setPage] = useState(0);
  const [me, setMe] = useState<Pt | null>(null);
  const [locating, setLocating] = useState(false);

  const words = norm(q).split(/\s+/).filter(Boolean);
  const rows = rooms
    .map((r) => ({ r, d: me ? meters(me, r) : undefined, hay: norm(`${r.name} ${r.slug ?? ""} ${CATEGORIES[r.category]?.[1] ?? ""} ${r.private ? "gizli" : ""}`) }))
    .filter((x) => words.every((w) => x.hay.includes(w)))
    .sort((a, b) => {
      const v = sort.key === "name" ? a.r.name.localeCompare(b.r.name, "tr")
        : sort.key === "dist" ? (a.d ?? 0) - (b.d ?? 0)
        : a.r[sort.key] - b.r[sort.key];
      return sort.asc ? v : -v;
    });
  const pages = Math.max(1, Math.ceil(rows.length / PAGE));
  const p = Math.min(page, pages - 1); // silme/arama sonrası boş sayfada kalma
  const shown = rows.slice(p * PAGE, (p + 1) * PAGE);
  const sortTo = (s: typeof sort) => { setSort(s); setPage(0); };

  async function nearMe() {
    setLocating(true);
    try {
      const c = await locate();
      setMe({ lat: c.latitude, lng: c.longitude });
      sortTo({ key: "dist", asc: true });
    } catch (e: any) { onError(e.message); }
    finally { setLocating(false); }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        <div className="relative min-w-48 flex-1">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input type="search" className="pl-9" placeholder="Ad, adres veya kategori ara" value={q} onChange={(e) => { setQ(e.target.value); setPage(0); }} />
        </div>
        <Button variant="secondary" disabled={locating} onClick={nearMe}><LocateFixedIcon /> {locating ? "Konum alınıyor…" : me ? "Konumu yenile" : "Yakınımdakiler"}</Button>
      </div>
      <Card className="py-0">
        <Table>
          <TableHeader>
            <TableRow>
              <SortHead k="name" sort={sort} setSort={sortTo}>Sıra</SortHead>
              <SortHead k="waiting" sort={sort} setSort={sortTo} className="text-right">Bekleyen</SortHead>
              <SortHead k="called" sort={sort} setSort={sortTo} className="text-right">Çağrılan</SortHead>
              {me && <SortHead k="dist" sort={sort} setSort={sortTo} className="text-right">Mesafe</SortHead>}
              <TableHead className="text-right">İşlemler</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {shown.map(({ r, d }) => <RoomRow key={r.room} r={r} dist={d} onChange={onChange} onEdit={() => onEdit(r)} onError={onError} />)}
            {!shown.length && (
              <TableRow>
                <TableCell colSpan={me ? 5 : 4} className="py-8 text-center text-muted-foreground">
                  {rooms.length ? "Aramaya uyan sıra yok." : "Henüz sıra yok. + Yeni sıra ile ilk sıranızı oluşturun."}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
      {rows.length > PAGE && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span className="flex-1">{p * PAGE + 1}–{p * PAGE + shown.length} / {rows.length}</span>
          <Button size="sm" variant="secondary" disabled={p === 0} onClick={() => setPage(p - 1)}><ChevronLeftIcon /> Önceki</Button>
          <span className="tabular-nums">{p + 1} / {pages}</span>
          <Button size="sm" variant="secondary" disabled={p >= pages - 1} onClick={() => setPage(p + 1)}>Sonraki <ChevronRightIcon /></Button>
        </div>
      )}
    </div>
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
    <Page className="max-w-5xl">
      <div className="flex items-center gap-2">
        <Title className="flex-1">Sıralar</Title>
        <Button onClick={() => setEditing(null)}>+ Yeni sıra</Button>
        <Button variant="secondary" onClick={() => logout()}>Çıkış</Button>
      </div>
      <RoomTable rooms={rooms} onChange={load} onEdit={setEditing} onError={setErr} />
      {editing !== undefined && (
        <RoomForm key={editing?.room ?? "new"} room={editing} rooms={rooms} onError={setErr}
          onDone={() => { setEditing(undefined); load(); }} onCancel={() => setEditing(undefined)} />
      )}
      <ErrorText>{err}</ErrorText>
    </Page>
  );
}

mount(<AdminPage />);
