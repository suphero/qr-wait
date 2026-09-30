import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import {
  BanIcon, CheckIcon, ChevronDownIcon, ChevronLeftIcon, ChevronRightIcon, ChevronsUpDownIcon, ChevronUpIcon, CopyIcon, EllipsisIcon,
  ExternalLinkIcon, InfinityIcon, KeyRoundIcon, LocateFixedIcon, LockIcon, MailCheckIcon, PencilIcon, RefreshCwIcon, SearchIcon, TicketIcon,
  Trash2Icon, UsersIcon,
} from "lucide-react";
import { useConfirm } from "@/components/confirm";
import { siteUrl, TERMS_VERSION } from "@/components/legal";
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
import { fmtDistL, lang } from "@/lib/i18n";
import { baseMap, L, meters } from "@/lib/leaflet";
import { mount } from "@/lib/mount";
import { cn } from "@/lib/utils";
import { T } from "./admin.i18n";

// Oturum anahtarı /api/login'den; 30 gün geçerli, şifre değişince düşer
let token = localStorage.getItem("session");
const call = <T = any,>(path: string, body?: unknown, method?: string) => api<T>(path, body, { authorization: `Bearer ${token ?? ""}` }, method);
const adm = <T = any,>(path: string, body?: unknown, method?: string) => call<T>("/api/admin/rooms" + path, body, method);
const bare = (link: string) => link.replace(/^https?:\/\//, "");
// Sıra adından adres önerisi: Türkçe ve Kiril harfler Latin'e, diğer aksanlar atılır
const CYR = "абвгдеёжзийклмнопрстуфхцчшщъыьэюя".split(""), LAT = "a b v g d e e zh z i y k l m n o p r s t u f kh ts ch sh shch  y  e yu ya".split(" ");
const slugify = (t: string) => t.toLocaleLowerCase("tr").replace(/[çğıöşü]/g, (c) => "cgiosu"["çğıöşü".indexOf(c)])
  .replace(/[а-яё]/g, (c) => LAT[CYR.indexOf(c)] ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40);

type Pt = { lat: number; lng: number };
type Form = {
  name: string; category: string; private: boolean; slug: string; radius: string; flex: boolean; skip: boolean;
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
function RoomForm({ room, rooms, home, onDone, onCancel, onError }: { room: RoomInfo | null; rooms: RoomInfo[]; home: string; onDone: () => void; onCancel: () => void; onError: (m: string) => void }) {
  const confirm = useConfirm();
  const [f, setF] = useState<Form>({
    name: room?.name ?? "", category: room?.category ?? "diger", private: !!room?.private,
    slug: room?.private ? "" : room?.slug ?? "", // gizli odanın rastgele adresi açık adrese taşınmasın
    radius: String(room?.radius ?? 300), flex: !!room?.flex, skip: !!room?.skip, mode: room?.mode ?? "seats", maxEmpty: String(room?.maxEmpty ?? ""), maxGroup: String(room?.maxGroup ?? 8), qr: room?.qr ?? "dynamic", ttl: String(room?.ttl ?? 90),
  });
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setF((x) => ({ ...x, [k]: v }));
  const modeTouched = useRef(!!room); // yeni sırada tür elle seçilmedikçe kategoriden gelir (restoran → masa)
  const slugTouched = useRef(!!room?.slug && !room.private); // mevcut odanın adresi, ad değişince kendiliğinden değişmesin
  const [pt, setPt] = useState<Pt | null>(room && { lat: room.lat, lng: room.lng });
  const [pos, setPos] = useState(room ? "" : T.pickSpot);
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
    setPos(T.picked(`${pt.lat.toFixed(5)}, ${pt.lng.toFixed(5)}`));
  }, [pt, radius]);

  const pickAndFit = (p: Pt) => { fitNext.current = true; setPt(p); };

  async function search() {
    if (!q.trim()) return;
    try {
      const [r] = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=tr&q=${encodeURIComponent(q.trim())}`).then((x) => x.json());
      if (!r) return setPos(T.addrNotFound);
      pickAndFit({ lat: +r.lat, lng: +r.lon });
    } catch { setPos(T.searchDown); }
  }

  async function submit(ev: FormEvent) {
    ev.preventDefault();
    if (!pt) return onError(T.pickOnMap);
    const { slug, ...rest } = f;
    const body = { ...rest, ...(f.private ? {} : { slug }), radius: +f.radius, maxEmpty: f.maxEmpty === "" ? null : +f.maxEmpty, maxGroup: +f.maxGroup, ttl: +f.ttl, ...pt };
    const prev = rooms.find((r) => r.room === room?.room);
    const changed = prev?.slug && (f.private ? !prev.private : prev.slug !== slug);
    if (changed && !(await confirm({ title: T.slugChangeTitle, description: T.slugChangeDesc, action: T.cont }))) return;
    try {
      await (room ? adm(`/${room.room}`, body, "PUT") : adm("", body));
      onDone();
    } catch (e: any) { onError(e.message); }
  }

  return (
    <Card>
      <CardHeader><CardTitle className="text-lg font-semibold">{room ? T.edit(room.name) : T.newRoom}</CardTitle></CardHeader>
      <CardContent>
        <form ref={formEl} onSubmit={submit} className="flex flex-col gap-5 text-base">
          <Field>
            <FieldLabel htmlFor="name">{T.name}</FieldLabel>
            <Input id="name" required maxLength={60} placeholder={T.namePh} value={f.name}
              onChange={(e) => { set("name", e.target.value); if (!slugTouched.current) set("slug", slugify(e.target.value)); }} />
          </Field>
          <Field>
            <FieldLabel htmlFor="category">{T.category}</FieldLabel>
            <NativeSelect id="category" value={f.category} onChange={(e) => {
              set("category", e.target.value);
              if (!modeTouched.current) set("mode", e.target.value === "restoran" ? "tables" : "seats");
            }}>
              {Object.entries(CATEGORIES).map(([k, [i, t]]) => <NativeSelectOption key={k} value={k}>{i} {t}</NativeSelectOption>)}
            </NativeSelect>
          </Field>
          <Check title={T.hidden} checked={f.private} onChange={(v) => set("private", v)}>
            {T.hiddenDesc}
          </Check>
          {f.private ? (
            <p className="text-sm text-muted-foreground">{room?.private ? T.keepSecret(room.slug ?? "") : T.secretNew}</p>
          ) : (
            <Field>
              <FieldLabel htmlFor="slug">{T.slug}</FieldLabel>
              <Input id="slug" required minLength={3} maxLength={40} pattern="[a-z0-9][a-z0-9\-]*[a-z0-9]" placeholder="antalya-konserve" value={f.slug}
                onChange={(e) => { slugTouched.current = true; set("slug", e.target.value); }} />
              <FieldDescription>{T.slugDesc(`${bare(home)}${f.slug || "…"}`)}</FieldDescription>
            </Field>
          )}
          <Field>
            <FieldLabel htmlFor="q">{T.searchAddr}</FieldLabel>
            <div className="flex gap-2">
              <Input id="q" placeholder={T.searchPh} value={q} onChange={(e) => setQ(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); search(); } }} />
              <Button type="button" onClick={search}>{T.search}</Button>
            </div>
          </Field>
          <div className="flex flex-col gap-2">
            <div ref={mapEl} className="z-0 h-[360px] rounded-lg" />
            <Button type="button" variant="secondary" onClick={async () => {
              try { const c = await locate(); pickAndFit({ lat: c.latitude, lng: c.longitude }); } catch (e: any) { setPos(e.message); }
            }}>{T.useMyLoc}</Button>
            <p className="text-sm text-muted-foreground">{pos}</p>
          </div>
          <Field>
            <FieldLabel htmlFor="radius">{T.radius}</FieldLabel>
            <Input id="radius" type="number" min={50} max={2000} required value={f.radius} onChange={(e) => set("radius", e.target.value)} />
            <FieldDescription>{T.radiusDesc}</FieldDescription>
          </Field>
          <FieldSet className="rounded-lg border p-4">
            <FieldLegend>{T.mode}</FieldLegend>
            <RadioGroup value={f.mode} onValueChange={(v) => { modeTouched.current = true; set("mode", v as Form["mode"]); }} className="gap-4">
              <Field orientation="horizontal">
                <RadioGroupItem value="seats" id="mode-seats" />
                <FieldContent>
                  <FieldLabel htmlFor="mode-seats" className="text-base font-semibold">{T.seats}</FieldLabel>
                  <FieldDescription>{T.seatsDesc}</FieldDescription>
                </FieldContent>
              </Field>
              {f.mode === "seats" && (
                <div className="flex flex-col gap-4 pl-6">
                  <Check title={T.flex} checked={f.flex} onChange={(v) => set("flex", v)}>
                    {T.flexDesc}
                  </Check>
                  <Check title={T.skip} checked={f.skip} onChange={(v) => set("skip", v)}>
                    {T.skipDesc}
                  </Check>
                </div>
              )}
              <Field orientation="horizontal">
                <RadioGroupItem value="tables" id="mode-tables" />
                <FieldContent>
                  <FieldLabel htmlFor="mode-tables" className="text-base font-semibold">{T.tables}</FieldLabel>
                  <FieldDescription>{T.tablesDesc}</FieldDescription>
                </FieldContent>
              </Field>
              {f.mode === "tables" && (
                <Field className="pl-6">
                  <FieldLabel htmlFor="maxEmpty">{T.maxEmptyQ}</FieldLabel>
                  <Input id="maxEmpty" type="number" min={0} max={50} inputMode="numeric" placeholder={T.noLimit} value={f.maxEmpty} onChange={(e) => set("maxEmpty", e.target.value)} />
                  <FieldDescription>{T.maxEmptyDesc}</FieldDescription>
                </Field>
              )}
            </RadioGroup>
          </FieldSet>
          <Field>
            <FieldLabel htmlFor="maxGroup">{T.maxGroupQ}</FieldLabel>
            <Input id="maxGroup" type="number" min={1} max={20} required inputMode="numeric" value={f.maxGroup} onChange={(e) => set("maxGroup", e.target.value)} />
            <FieldDescription>{T.maxGroupDesc}</FieldDescription>
          </Field>
          <FieldSet className="rounded-lg border p-4">
            <FieldLegend>{T.qr}</FieldLegend>
            <RadioGroup value={f.qr} onValueChange={(v) => set("qr", v as Form["qr"])} className="gap-4">
              <Field orientation="horizontal">
                <RadioGroupItem value="dynamic" id="qr-dynamic" />
                <FieldContent>
                  <FieldLabel htmlFor="qr-dynamic" className="text-base font-semibold">{T.dynamic}</FieldLabel>
                  <FieldDescription>{T.dynamicDesc}</FieldDescription>
                </FieldContent>
              </Field>
              {f.qr === "dynamic" && (
                <Field className="pl-6">
                  <FieldLabel htmlFor="ttl">{T.ttlQ}</FieldLabel>
                  <NativeSelect id="ttl" value={f.ttl} onChange={(e) => set("ttl", e.target.value)}>
                    <NativeSelectOption value="60">{T.sec(60)}</NativeSelectOption>
                    <NativeSelectOption value="90">{T.sec(90)}</NativeSelectOption>
                    <NativeSelectOption value="180">{T.min(3)}</NativeSelectOption>
                    <NativeSelectOption value="300">{T.min(5)}</NativeSelectOption>
                  </NativeSelect>
                  <FieldDescription>{T.ttlDesc}</FieldDescription>
                </Field>
              )}
              <Field orientation="horizontal">
                <RadioGroupItem value="static" id="qr-static" />
                <FieldContent>
                  <FieldLabel htmlFor="qr-static" className="text-base font-semibold">{T.static}</FieldLabel>
                  <FieldDescription>{T.staticDesc}</FieldDescription>
                </FieldContent>
              </Field>
            </RadioGroup>
          </FieldSet>
          <div className="flex gap-2">
            <Button type="button" variant="secondary" className="flex-1" onClick={onCancel}>{T.cancel}</Button>
            <Button className="flex-1">{T.save}</Button>
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
      return confirm({ title: T.copyTitle, description: <span className="break-all select-all">{r.link}</span>, cancel: false });
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <TableRow>
      <TableCell className="whitespace-normal">
        <b>{catIcon(r.category)} {r.name}</b>
        <div className="text-sm text-muted-foreground">
          {r.slug ? <a className="underline-offset-2 hover:underline" href={r.page} target="_blank">{r.private ? T.hiddenTag : bare(r.page)}</a> : T.noSlug}
        </div>
        <div className="text-xs text-muted-foreground">
          {[`${r.radius} m`, T.maxPeople(r.maxGroup), r.tables ? `${T.tableTag}${r.maxEmpty !== null ? ` ${T.maxEmptyTag(r.maxEmpty)}` : ""}` : r.flex && T.flexTag, r.skip && T.skipTag,
            r.qr === "static" ? T.staticTag : T.ttlTag(r.ttl)].filter(Boolean).join(" · ")}
        </div>
      </TableCell>
      <TableCell className="text-right tabular-nums">{r.waiting} <span className="text-muted-foreground">{T.peopleOf(r.people)}</span></TableCell>
      <TableCell className="text-right tabular-nums">{r.called}</TableCell>
      {dist !== undefined && <TableCell className="text-right tabular-nums">{fmtDistL(dist)}</TableCell>}
      <TableCell>
        <div className="flex justify-end gap-1">
          <Button size="icon-sm" variant="ghost" title={T.copyLink} onClick={copy}>{copied ? <CheckIcon /> : <CopyIcon />}</Button>
          <Button size="icon-sm" variant="ghost" title={T.openPanel} asChild><a href={r.link} target="_blank"><ExternalLinkIcon /></a></Button>
          <Button size="icon-sm" variant="ghost" title={T.editBtn} onClick={onEdit}><PencilIcon /></Button>
          <DropdownMenu modal={false}>
            <DropdownMenuTrigger asChild><Button size="icon-sm" variant="ghost" title={T.more}><EllipsisIcon /></Button></DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={async () => {
                if (await confirm({ title: T.rotateTitle, description: T.rotateDesc(r.name, r.qr === "static"), action: T.renew }))
                  run(() => adm(`/${r.room}/rotate`, {}));
              }}><RefreshCwIcon /> {T.rotate}</DropdownMenuItem>
              {r.private && (
                <DropdownMenuItem onSelect={async () => {
                  if (await confirm({ title: T.reslugTitle, description: T.reslugDesc(r.name), action: T.renew }))
                    run(() => adm(`/${r.room}/reslug`, {}));
                }}><LockIcon /> {T.reslug}</DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onSelect={async () => {
                if (await confirm({ title: T.delTitle, description: T.delDesc(r.name), action: T.del, destructive: true }))
                  run(() => adm(`/${r.room}`, undefined, "DELETE"));
              }}><Trash2Icon /> {T.del}</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </TableCell>
    </TableRow>
  );
}

type SortKey = "name" | "waiting" | "called" | "dist";
const PAGE = 10;
const norm = (t: string) => t.toLocaleLowerCase(lang);

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
    .map((r) => ({ r, d: me ? meters(me, r) : undefined, hay: norm(`${r.name} ${r.slug ?? ""} ${CATEGORIES[r.category]?.[1] ?? ""} ${r.private ? T.hiddenWord : ""}`) }))
    .filter((x) => words.every((w) => x.hay.includes(w)))
    .sort((a, b) => {
      const v = sort.key === "name" ? a.r.name.localeCompare(b.r.name, lang)
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
          <Input type="search" className="pl-9" placeholder={T.filterPh} value={q} onChange={(e) => { setQ(e.target.value); setPage(0); }} />
        </div>
        <Button variant="secondary" disabled={locating} onClick={nearMe}><LocateFixedIcon /> {locating ? T.locating : me ? T.relocate : T.nearMe}</Button>
      </div>
      <Card className="py-0">
        <Table>
          <TableHeader>
            <TableRow>
              <SortHead k="name" sort={sort} setSort={sortTo}>{T.colQueue}</SortHead>
              <SortHead k="waiting" sort={sort} setSort={sortTo} className="text-right">{T.colWaiting}</SortHead>
              <SortHead k="called" sort={sort} setSort={sortTo} className="text-right">{T.colCalled}</SortHead>
              {me && <SortHead k="dist" sort={sort} setSort={sortTo} className="text-right">{T.colDist}</SortHead>}
              <TableHead className="text-right">{T.colActions}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {shown.map(({ r, d }) => <RoomRow key={r.room} r={r} dist={d} onChange={onChange} onEdit={() => onEdit(r)} onError={onError} />)}
            {!shown.length && (
              <TableRow>
                <TableCell colSpan={me ? 5 : 4} className="py-8 text-center text-muted-foreground">
                  {rooms.length ? T.noMatch : T.noRooms}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
      {rows.length > PAGE && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span className="flex-1">{p * PAGE + 1}–{p * PAGE + shown.length} / {rows.length}</span>
          <Button size="sm" variant="secondary" disabled={p === 0} onClick={() => setPage(p - 1)}><ChevronLeftIcon /> {T.prev}</Button>
          <span className="tabular-nums">{p + 1} / {pages}</span>
          <Button size="sm" variant="secondary" disabled={p >= pages - 1} onClick={() => setPage(p + 1)}>{T.next} <ChevronRightIcon /></Button>
        </div>
      )}
    </div>
  );
}

type Balance = { metered: boolean; suspended: boolean; used: number; free: number; bought: number; granted: number; left: number | null };
type Pkg = { variant: string; tickets: number; price: string };
type Me = { user: string; super: boolean; home: string | false; email?: string | null; verified?: boolean; balance?: Balance; packages?: Pkg[] };
type User = { name: string; at: number; rooms: number; link: string; email: string | null; verified: boolean; suspended: boolean; balance: Balance };
type Config = { turnstile: string; free: number; packages: Pkg[] };

// Cloudflare Turnstile (bot doğrulaması); betik ilk kullanımda yüklenir. Belirteç tek kullanımlık:
// başarısız gönderimden sonra bileşen key değiştirilerek yeniden çizilir.
let turnstile: Promise<any> | undefined;
const loadTurnstile = () => (turnstile ??= new Promise((ok, no) => {
  const s = document.createElement("script");
  s.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
  s.onload = () => ok((window as any).turnstile);
  s.onerror = no;
  document.head.append(s);
}));

function Captcha({ siteKey, onToken }: { siteKey: string; onToken: (t: string) => void }) {
  const el = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let id: string | undefined, gone = false;
    loadTurnstile().then((ts) => {
      if (!gone) id = ts.render(el.current, { sitekey: siteKey, language: lang, callback: onToken, "expired-callback": () => onToken(""), "error-callback": () => onToken("") });
    });
    return () => { gone = true; if (id) (window as any).turnstile.remove(id); };
  }, [siteKey]);
  return <div ref={el} className="min-h-[65px]" />;
}

// Bilet hakkı ve paket satın alma; sınırsız hesaplarda görünmez. Ödeme Lemon Squeezy sayfasında, dönüşte ?paid=1.
function BalanceCard({ me, paid, onError }: { me: Me; paid: boolean; onError: (m: string) => void }) {
  const b = me.balance!, [busy, setBusy] = useState(false);
  if (b.left === null) return null;
  const low = b.left <= 100;
  async function buy(variant: string) {
    setBusy(true);
    try { location.href = (await call<{ url: string }>("/api/admin/checkout", { variant })).url; } catch (e: any) { onError(e.message); setBusy(false); }
  }
  return (
    <Card>
      <CardHeader><CardTitle className="text-lg font-semibold">{T.balanceTitle}: {T.left(Math.max(0, b.left))}</CardTitle></CardHeader>
      <CardContent className="flex flex-col gap-3">
        <p className="text-sm text-muted-foreground">{T.balanceDesc(b.used, b.free)}</p>
        {paid && <p className="font-semibold">{T.paid}</p>}
        {low && <p className="font-semibold text-destructive">{b.left <= 0 ? T.emptyWarn : T.lowWarn}</p>}
        {me.packages?.length ? (
          <div className="flex flex-wrap gap-2">
            {me.packages.map((p) => (
              <Button key={p.variant} variant={low ? "default" : "secondary"} disabled={busy || !me.verified} onClick={() => buy(p.variant)}>
                {T.pack(p.tickets)}{p.price && ` · ${p.price}`}
              </Button>
            ))}
          </div>
        ) : <p className="text-sm text-muted-foreground">{T.noPackages}</p>}
      </CardContent>
    </Card>
  );
}

// Hesabı silme: şifreyle onay, yalnızca sırası kalmamış hesap
function DeleteAccount({ onDeleted, onError }: { onDeleted: () => void; onError: (m: string) => void }) {
  const confirm = useConfirm();
  const [pw, setPw] = useState("");
  async function submit(ev: FormEvent) {
    ev.preventDefault();
    if (!(await confirm({ title: T.deleteAccount, description: T.deleteDesc, action: T.del, destructive: true }))) return;
    try { await call("/api/admin/account/delete", { password: pw }); onDeleted(); } catch (e: any) { onError(e.message); }
  }
  return (
    <Card>
      <CardHeader><CardTitle className="text-lg font-semibold">{T.deleteAccount}</CardTitle></CardHeader>
      <CardContent>
        <form onSubmit={submit} className="flex flex-col gap-4 text-base">
          <p className="text-sm text-muted-foreground">{T.deleteDesc}</p>
          <Field>
            <FieldLabel htmlFor="delpw">{T.deletePw}</FieldLabel>
            <Input id="delpw" type="password" required autoComplete="current-password" value={pw} onChange={(e) => setPw(e.target.value)} />
          </Field>
          <Button variant="destructive">{T.deleteAccount}</Button>
        </form>
      </CardContent>
    </Card>
  );
}

// Kendi şifresini değiştirme; yeni oturum anahtarı döner (eski oturumlar düşer)
function PasswordForm({ onDone, onError }: { onDone: () => void; onError: (m: string) => void }) {
  const [old, setOld] = useState(""), [pw, setPw] = useState("");
  async function submit(ev: FormEvent) {
    ev.preventDefault();
    try {
      const r = await call<{ token: string }>("/api/admin/password", { old, password: pw });
      localStorage.setItem("session", (token = r.token));
      onDone();
    } catch (e: any) { onError(e.message); }
  }
  return (
    <Card>
      <CardHeader><CardTitle className="text-lg font-semibold">{T.changePw}</CardTitle></CardHeader>
      <CardContent>
        <form onSubmit={submit} className="flex flex-col gap-4 text-base">
          <Field>
            <FieldLabel htmlFor="old">{T.oldPw}</FieldLabel>
            <Input id="old" type="password" required autoComplete="current-password" value={old} onChange={(e) => setOld(e.target.value)} />
          </Field>
          <Field>
            <FieldLabel htmlFor="new">{T.newPw}</FieldLabel>
            <Input id="new" type="password" required minLength={8} autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} />
            <FieldDescription>{T.newPwDesc}</FieldDescription>
          </Field>
          <div className="flex gap-2">
            <Button type="button" variant="secondary" className="flex-1" onClick={onDone}>{T.cancel}</Button>
            <Button className="flex-1">{T.save}</Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function RoomsPanel({ me, paid, reloadMe, logout }: { me: Me; paid: boolean; reloadMe: () => Promise<void>; logout: (msg?: string) => void }) {
  const [rooms, setRooms] = useState<RoomInfo[]>([]);
  const [note, setNote] = useState("");
  const [editing, setEditing] = useState<RoomInfo | null | undefined>(); // undefined: form kapalı, null: yeni oda
  const [pwOpen, setPwOpen] = useState(false);
  const [err, setErr] = useState("");
  const formOpen = useRef(false);
  formOpen.current = editing !== undefined;

  async function load() {
    try {
      setRooms(await adm<RoomInfo[]>(""));
      setErr("");
    } catch (e: any) {
      if (e.status === 401) return logout(e.message);
      setErr(e.message);
    }
  }

  useEffect(() => {
    load();
    return poll(() => !formOpen.current && load(), 15000, true);
  }, []);

  // Ödemeden dönüş: webhook birkaç saniyede gelir, bakiye yarım dakika sık yenilenir
  useEffect(() => {
    if (!paid) return;
    const t = setInterval(reloadMe, 3000), stop = setTimeout(() => clearInterval(t), 30000);
    return () => { clearInterval(t); clearTimeout(stop); };
  }, [paid]);

  async function resend() {
    try { await call("/api/admin/verify", {}); setNote(T.resent); } catch (e: any) { setErr(e.message); }
  }

  return (
    <Page className="max-w-5xl">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex-1">
          <Title>{T.queues}</Title>
          {me.home && <a className="text-sm text-muted-foreground underline-offset-2 hover:underline" href={me.home} target="_blank">{bare(me.home)}</a>}
        </div>
        <Button disabled={me.verified === false} onClick={() => setEditing(null)}>{T.addRoom}</Button>
        <Button variant="secondary" title={T.changePw} onClick={() => setPwOpen(!pwOpen)}><KeyRoundIcon /> {T.accountBtn}</Button>
        <Button variant="secondary" onClick={() => logout()}>{T.logout}</Button>
      </div>
      {me.verified === false && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border p-3 text-sm">
          <span className="flex-1">{T.verifyBanner(me.email ?? "")}</span>
          <Button size="sm" variant="secondary" onClick={resend}>{T.resend}</Button>
        </div>
      )}
      {note && <p className="text-sm">{note}</p>}
      <BalanceCard me={me} paid={paid} onError={setErr} />
      {pwOpen && <PasswordForm onDone={() => setPwOpen(false)} onError={setErr} />}
      {pwOpen && <DeleteAccount onDeleted={() => logout(T.deleted)} onError={setErr} />}
      <RoomTable rooms={rooms} onChange={load} onEdit={setEditing} onError={setErr} />
      {editing !== undefined && (
        <RoomForm key={editing?.room ?? "new"} room={editing} rooms={rooms} home={me.home || ""} onError={setErr}
          onDone={() => { setEditing(undefined); load(); }} onCancel={() => setEditing(undefined)} />
      )}
      <ErrorText>{err}</ErrorText>
    </Page>
  );
}

// Süper yönetici: kullanıcıları açar, şifre sıfırlar, siler; hesaplardan önceki sıraları bir kullanıcıya taşır
function UsersPanel({ logout }: { logout: (msg?: string) => void }) {
  const confirm = useConfirm();
  const [data, setData] = useState<{ users: User[]; unowned: number }>({ users: [], unowned: 0 });
  const [form, setForm] = useState<{ user: string; password: string; reset?: string }>();
  const [grant, setGrant] = useState<{ user: string; n: string }>();
  const [err, setErr] = useState("");
  const plan = (u: string, body: object) => run(() => call(`/api/admin/users/${u}/plan`, body));

  async function load() {
    try {
      setData(await call("/api/admin/users"));
      setErr("");
    } catch (e: any) {
      if (e.status === 401) return logout(e.message);
      setErr(e.message);
    }
  }
  async function run(fn: () => Promise<unknown>) {
    try { await fn(); await load(); } catch (e: any) { setErr(e.message); }
  }
  useEffect(() => { load(); }, []);

  async function submit(ev: FormEvent) {
    ev.preventDefault();
    const f = form!;
    await run(async () => {
      await (f.reset ? call(`/api/admin/users/${f.reset}`, { password: f.password }, "PUT") : call("/api/admin/users", f));
      setForm(undefined);
    });
  }

  return (
    <Page className="max-w-3xl">
      <div className="flex items-center gap-2">
        <Title className="flex-1">{T.users}</Title>
        <Button onClick={() => setForm({ user: "", password: "" })}>{T.addUser}</Button>
        <Button variant="secondary" onClick={() => logout()}>{T.logout}</Button>
      </div>
      {data.unowned > 0 && (
        <p className="rounded-lg border p-3 text-sm">
          {T.unowned(data.unowned)}
        </p>
      )}
      <Card className="py-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{T.colUser}</TableHead>
              <TableHead className="text-right">{T.colQueue}</TableHead>
              <TableHead className="text-right">{T.colBalance}</TableHead>
              <TableHead className="text-right">{T.colActions}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.users.map((u) => (
              <TableRow key={u.name}>
                <TableCell className="whitespace-normal">
                  <b>{u.name}</b>
                  <div className="text-sm text-muted-foreground"><a className="underline-offset-2 hover:underline" href={u.link} target="_blank">{bare(u.link)}</a></div>
                  <div className="text-xs text-muted-foreground">
                    {[u.email, !u.verified && `⚠ ${T.unverifiedTag}`, u.suspended && `⛔ ${T.suspendedTag}`].filter(Boolean).join(" · ")}
                  </div>
                </TableCell>
                <TableCell className="text-right tabular-nums">{u.rooms}</TableCell>
                <TableCell className="text-right tabular-nums">
                  {u.balance.metered ? u.balance.left : "∞"} <span className="text-muted-foreground">/ {u.balance.used}</span>
                </TableCell>
                <TableCell>
                  <div className="flex justify-end">
                    <DropdownMenu modal={false}>
                      <DropdownMenuTrigger asChild><Button size="icon-sm" variant="ghost" title={T.more}><EllipsisIcon /></Button></DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onSelect={() => setForm({ user: u.name, password: "", reset: u.name })}><KeyRoundIcon /> {T.setPw}</DropdownMenuItem>
                        <DropdownMenuItem onSelect={() => setGrant({ user: u.name, n: "" })}><TicketIcon /> {T.grant}</DropdownMenuItem>
                        <DropdownMenuItem onSelect={() => plan(u.name, { metered: !u.balance.metered })}><InfinityIcon /> {u.balance.metered ? T.unmeter : T.meter}</DropdownMenuItem>
                        {!u.verified && <DropdownMenuItem onSelect={() => plan(u.name, { verified: true })}><MailCheckIcon /> {T.markVerified}</DropdownMenuItem>}
                        <DropdownMenuItem onSelect={async () => {
                          if (u.suspended || await confirm({ title: T.suspendTitle, description: T.suspendDesc(u.name), action: T.suspend, destructive: true }))
                            plan(u.name, { suspended: !u.suspended });
                        }}><BanIcon /> {u.suspended ? T.unsuspend : T.suspend}</DropdownMenuItem>
                        {data.unowned > 0 && (
                          <DropdownMenuItem onSelect={async () => {
                            if (await confirm({ title: T.adoptTitle, description: T.adoptDesc(data.unowned, u.name, bare(u.link)), action: T.move }))
                              run(() => call(`/api/admin/users/${u.name}/adopt`, {}));
                          }}><UsersIcon /> {T.adopt}</DropdownMenuItem>
                        )}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem variant="destructive" onSelect={async () => {
                          if (await confirm({ title: T.delUserTitle, description: T.delUserDesc(u.name), action: T.del, destructive: true }))
                            run(() => call(`/api/admin/users/${u.name}`, undefined, "DELETE"));
                        }}><Trash2Icon /> {T.del}</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {!data.users.length && (
              <TableRow><TableCell colSpan={4} className="py-8 text-center text-muted-foreground">{T.noUsers}</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
      {grant && (
        <Card>
          <CardHeader><CardTitle className="text-lg font-semibold">{T.grantFor(grant.user)}</CardTitle></CardHeader>
          <CardContent>
            <form className="flex flex-col gap-4 text-base" onSubmit={(ev) => {
              ev.preventDefault();
              plan(grant.user, { grant: +grant.n }).then(() => setGrant(undefined));
            }}>
              <Field>
                <FieldLabel htmlFor="grant">{T.grantN}</FieldLabel>
                <Input id="grant" type="number" required inputMode="numeric" value={grant.n} onChange={(e) => setGrant({ ...grant, n: e.target.value })} />
                <FieldDescription>{T.grantDesc}</FieldDescription>
              </Field>
              <div className="flex gap-2">
                <Button type="button" variant="secondary" className="flex-1" onClick={() => setGrant(undefined)}>{T.cancel}</Button>
                <Button className="flex-1">{T.save}</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}
      {form && (
        <Card>
          <CardHeader><CardTitle className="text-lg font-semibold">{form.reset ? T.setPwFor(form.reset) : T.newUser}</CardTitle></CardHeader>
          <CardContent>
            <form onSubmit={submit} className="flex flex-col gap-4 text-base">
              {!form.reset && (
                <Field>
                  <FieldLabel htmlFor="user">{T.username}</FieldLabel>
                  <Input id="user" required minLength={3} maxLength={40} pattern="[a-z0-9][a-z0-9\-]*[a-z0-9]" placeholder="antalyabb" autoComplete="off"
                    value={form.user} onChange={(e) => setForm({ ...form, user: e.target.value })} />
                  <FieldDescription>{T.userDesc(`${form.user || "…"}.${location.hostname.replace(/^www\./, "")}`)}</FieldDescription>
                </Field>
              )}
              <Field>
                <FieldLabel htmlFor="password">{T.password}</FieldLabel>
                <Input id="password" type="text" required minLength={8} autoComplete="off" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
                <FieldDescription>{T.pwDesc}{form.reset && T.pwResetNote}</FieldDescription>
              </Field>
              <div className="flex gap-2">
                <Button type="button" variant="secondary" className="flex-1" onClick={() => setForm(undefined)}>{T.cancel}</Button>
                <Button className="flex-1">{T.save}</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}
      <ErrorText>{err}</ErrorText>
    </Page>
  );
}

type Mode = "login" | "signup" | "forgot" | "reset";

// E-posta bağlantıları: ?verify=<belirteç>, ?reset=<belirteç>; ödemeden dönüş ?paid=1; tanıtım sitesinden #signup.
// Belirteç okunur okunmaz adres çubuğundan silinir (geçmişte ve paylaşılan ekranda kalmasın).
const params = new URLSearchParams(location.search);
const resetToken = params.get("reset") ?? "", verifyToken = params.get("verify") ?? "", paidBack = params.has("paid");
if (location.search) history.replaceState(null, "", "/admin");

function AdminPage() {
  const [me, setMe] = useState<Me | null>(null);
  const [err, setErr] = useState(""), [note, setNote] = useState("");
  const [mode, setMode] = useState<Mode>(resetToken ? "reset" : location.hash === "#signup" ? "signup" : "login");
  const [f, setF] = useState({ user: "", email: "", password: "" });
  const [agree, setAgree] = useState(false);
  const [cfg, setCfg] = useState<Config | null>(null);
  const [captcha, setCaptcha] = useState(""), [captchaKey, setCaptchaKey] = useState(0);
  const set = (k: keyof typeof f, v: string) => setF((x) => ({ ...x, [k]: v }));

  async function start() {
    try {
      setMe(await call<Me>("/api/admin/me"));
      setErr("");
    } catch (e: any) { logout(e.message); }
  }

  function logout(msg = "") {
    localStorage.removeItem("session");
    token = null;
    setMe(null);
    setErr(msg);
  }

  function go(m: Mode) {
    setMode(m);
    setErr("");
    setNote("");
  }

  useEffect(() => {
    if (verifyToken) {
      api("/api/verify", { token: verifyToken }).then(() => { setNote(T.verifiedMsg); if (token) start(); }, (e) => setErr(e.message));
    } else if (token) start();
  }, []);

  useEffect(() => {
    if ((mode === "signup" || mode === "forgot") && !cfg) api<Config>("/api/config").then(setCfg, (e) => setErr(e.message));
  }, [mode]);

  async function submit(ev: FormEvent) {
    ev.preventDefault();
    setErr("");
    if ((mode === "signup" || mode === "forgot") && !captcha) return setErr(T.captchaWait);
    try {
      if (mode === "login" || mode === "signup") {
        const r = mode === "login"
          ? await api<{ token: string }>("/api/login", { user: f.user, password: f.password })
          : await api<{ token: string }>("/api/signup", { ...f, captcha, lang, terms: agree ? TERMS_VERSION : "" });
        localStorage.setItem("session", (token = r.token));
        set("password", "");
        await start();
      } else if (mode === "forgot") {
        await api("/api/forgot", { email: f.email, captcha });
        go("login");
        setNote(T.forgotSent);
      } else {
        await api("/api/reset", { token: resetToken, password: f.password });
        go("login");
        setNote(T.resetDone);
      }
    } catch (e: any) {
      setErr(e.message);
      setCaptcha("");
      setCaptchaKey((k) => k + 1);
    }
  }

  if (me) return me.super ? <UsersPanel logout={logout} /> : <RoomsPanel me={me} paid={paidBack} reloadMe={start} logout={logout} />;
  const title = { login: T.loginTitle, signup: T.signupTitle, forgot: T.forgotLink, reset: T.resetTitle }[mode];
  const link = (m: Mode, text: string) => <button type="button" className="font-semibold text-primary underline-offset-2 hover:underline" onClick={() => go(m)}>{text}</button>;
  return (
    <Page>
      <Card className="mt-3">
        <CardHeader><Title className="mt-0">{title}</Title></CardHeader>
        <CardContent>
          <form className="flex flex-col gap-4 text-base" onSubmit={submit}>
            {mode === "signup" && cfg && <p className="text-sm text-muted-foreground">{T.signupIntro(cfg.free)}</p>}
            {mode === "forgot" && <p className="text-sm text-muted-foreground">{T.forgotDesc}</p>}
            {(mode === "login" || mode === "signup") && (
              <Field>
                <FieldLabel htmlFor="user">{mode === "login" ? T.loginId : T.username}</FieldLabel>
                <Input id="user" required autoCapitalize="none" autoComplete="username" value={f.user} onChange={(e) => set("user", mode === "signup" ? e.target.value.toLowerCase() : e.target.value)}
                  {...(mode === "signup" && { minLength: 3, maxLength: 40, pattern: "[a-z0-9][a-z0-9\\-]*[a-z0-9]" })} />
                {mode === "signup" && <FieldDescription>{T.signupUserDesc(`${f.user || "…"}.${location.hostname.replace(/^www\./, "")}`)}</FieldDescription>}
              </Field>
            )}
            {(mode === "signup" || mode === "forgot") && (
              <Field>
                <FieldLabel htmlFor="email">{T.email}</FieldLabel>
                <Input id="email" type="email" required autoComplete="email" maxLength={254} value={f.email} onChange={(e) => set("email", e.target.value)} />
              </Field>
            )}
            {mode !== "forgot" && (
              <Field>
                <FieldLabel htmlFor="pw">{mode === "reset" ? T.newPw : T.password}</FieldLabel>
                <Input id="pw" type="password" required autoComplete={mode === "login" ? "current-password" : "new-password"} minLength={mode === "login" ? undefined : 8}
                  value={f.password} onChange={(e) => set("password", e.target.value)} />
                {mode !== "login" && <FieldDescription>{T.signupPwDesc}</FieldDescription>}
              </Field>
            )}
            {mode === "signup" && (
              <Field orientation="horizontal">
                <Checkbox id="agree" required checked={agree} onCheckedChange={(c) => setAgree(c === true)} />
                <FieldLabel htmlFor="agree" className="font-normal"><span>{T.agree(siteUrl("/terms"), siteUrl("/privacy"))}</span></FieldLabel>
              </Field>
            )}
            {(mode === "signup" || mode === "forgot") && cfg?.turnstile && <Captcha key={captchaKey} siteKey={cfg.turnstile} onToken={setCaptcha} />}
            <Button>{{ login: T.login, signup: T.signupBtn, forgot: T.forgotBtn, reset: T.save }[mode]}</Button>
          </form>
          <div className="mt-4 flex flex-col gap-1 text-sm">
            {mode === "login" && <p>{T.noAccount} {link("signup", T.signupLink)}</p>}
            {mode === "login" && <p>{link("forgot", T.forgotLink)}</p>}
            {mode === "signup" && <p>{T.haveAccount} {link("login", T.loginLink)}</p>}
            {(mode === "forgot" || mode === "reset") && <p>{link("login", T.back)}</p>}
          </div>
        </CardContent>
      </Card>
      {note && <p role="status" className="font-semibold">{note}</p>}
      <ErrorText>{err}</ErrorText>
    </Page>
  );
}

document.title = T.docTitle;
mount(<AdminPage />);
