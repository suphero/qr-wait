import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { RadioGroup as RadioGroupPrimitive } from "radix-ui";
import {
  BanIcon, CheckIcon, ChevronDownIcon, ChevronLeftIcon, ChevronRightIcon, ChevronsUpDownIcon, ChevronUpIcon, CopyIcon, EllipsisIcon,
  ChartColumnIcon, ExternalLinkIcon, InfinityIcon, KeyRoundIcon, LocateFixedIcon, LockIcon, MailCheckIcon, MailIcon, PencilIcon, RefreshCwIcon, SearchIcon, TicketIcon,
  Trash2Icon, UserIcon, UsersIcon,
} from "lucide-react";
import { useConfirm } from "@/components/confirm";
import { onLangChange } from "@/components/lang";
import { siteUrl, TERMS_VERSION } from "@/components/legal";
import { ErrorText, Page, Title } from "@/components/page";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Field, FieldContent, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { api, CATEGORIES, catIcon, locate, packName, perThousand, poll, type Geo, type Mode as QueueMode, type Pkg, type RoomInfo, type Stats } from "@/lib/api";
import { fmtDistL, lang } from "@/lib/i18n";
import { baseMap, L, meters } from "@/lib/leaflet";
import { mount, signupRef } from "@/lib/mount";
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
  mode: QueueMode; desks: string; zones: string; maxEmpty: string; maxGroup: string; qr: "dynamic" | "static"; ttl: string; geo: Geo;
  timed: "off" | "on"; wait: string;
  limited: "off" | "on"; from: string; to: string; cap: string;
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

// Formun bir bölümü: başlıklı kart
function Section({ title, className, children }: { title: string; className?: string; children: ReactNode }) {
  return (
    <Card className={cn("gap-3", className)}>
      <CardHeader><CardTitle className="text-base font-semibold">{title}</CardTitle></CardHeader>
      <CardContent className="flex flex-col gap-4 text-base">{children}</CardContent>
    </Card>
  );
}

// Etiket solda, kısa alan (sayı, seçim) sağda; açıklama altta
function Inline({ id, label, desc, children }: { id: string; label: string; desc?: ReactNode; children: ReactNode }) {
  return (
    <Field>
      <div className="flex items-center justify-between gap-3">
        <FieldLabel htmlFor={id}>{label}</FieldLabel>
        <div className="w-36 shrink-0">{children}</div>
      </div>
      {desc && <FieldDescription>{desc}</FieldDescription>}
    </Field>
  );
}

// Sabit konumlu sıranın noktası: adres arama, harita, kabul dairesi. Yalnızca sabit konum kontrolünde görünür.
function SpotPicker({ pt, setPt, radius }: { pt: Pt | null; setPt: (p: Pt) => void; radius: number }) {
  const [pos, setPos] = useState(pt ? "" : T.pickSpot);
  const [q, setQ] = useState("");
  const mapEl = useRef<HTMLDivElement>(null);
  const m = useRef<{ map?: L.Map; marker?: L.Marker; circle?: L.Circle }>({});
  const fitNext = useRef(!!pt); // nokta aramadan/konumdan ya da mevcut odadan geldiyse haritayı daireye sığdır

  useEffect(() => {
    const map = baseMap(mapEl.current!).setView([39, 35], 6);
    map.on("click", (e) => setPt({ lat: e.latlng.lat, lng: e.latlng.lng }));
    m.current.map = map;
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

  return (
    <>
      <Field>
        <FieldLabel htmlFor="q">{T.searchAddr}</FieldLabel>
        <div className="flex gap-2">
          <Input id="q" placeholder={T.searchPh} value={q} onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); search(); } }} />
          <Button type="button" onClick={search}>{T.search}</Button>
        </div>
      </Field>
      <div className="flex flex-col gap-2">
        <div ref={mapEl} className="z-0 h-[280px] rounded-lg" />
        <Button type="button" variant="secondary" onClick={async () => {
          try { const c = await locate(); pickAndFit({ lat: c.latitude, lng: c.longitude }); } catch (e: any) { setPos(e.message); }
        }}>{T.useMyLoc}</Button>
        <p className="text-sm text-muted-foreground">{pos}</p>
      </div>
    </>
  );
}

// Yan yana seçenekler (radyo grubu, ok tuşlarıyla gezilir); yalnızca seçilenin açıklaması ve ek alanları görünür
function Choice<V extends string>({ label, value, onChange, items }: {
  label: string; value: V; onChange: (v: V) => void; items: { v: V; title: string; desc: ReactNode; extra?: ReactNode }[];
}) {
  const cur = items.find((i) => i.v === value);
  return (
    <div className="flex flex-col gap-3">
      <RadioGroupPrimitive.Root aria-label={label} value={value} onValueChange={(v) => onChange(v as V)}
        className="grid auto-cols-fr grid-flow-col gap-1 rounded-lg bg-muted p-1">
        {items.map(({ v, title }) => (
          <RadioGroupPrimitive.Item key={v} value={v}
            className="rounded-md px-2 py-1.5 text-sm font-medium text-muted-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring data-[state=checked]:bg-background data-[state=checked]:font-semibold data-[state=checked]:text-primary data-[state=checked]:shadow-sm">
            {title}
          </RadioGroupPrimitive.Item>
        ))}
      </RadioGroupPrimitive.Root>
      {cur && <p className="text-sm text-muted-foreground">{cur.desc}</p>}
      {cur?.extra}
    </div>
  );
}

// Yeni + düzenle sayfası (#yeni, #duzenle-<id>). room: düzenlenen oda, yoksa yeni oda.
function RoomForm({ room, rooms, home, onDone, onCancel, onError }: { room: RoomInfo | null; rooms: RoomInfo[]; home: string; onDone: () => void; onCancel: () => void; onError: (m: string) => void }) {
  const confirm = useConfirm();
  const [f, setF] = useState<Form>({
    name: room?.name ?? "", category: room?.category ?? "diger", private: !!room?.private,
    slug: room?.private ? "" : room?.slug ?? "", // gizli odanın rastgele adresi açık adrese taşınmasın
    radius: String(room?.radius ?? 300), flex: !!room?.flex, skip: !!room?.skip, mode: room?.mode ?? "seats", desks: room?.desks?.join(", ") || "1, 2", zones: room?.zones?.join(", ") ?? "", maxEmpty: String(room?.maxEmpty ?? ""), maxGroup: String(room?.maxGroup ?? 8), qr: room?.qr ?? "dynamic", ttl: String(room?.ttl ?? 90),
    geo: room?.geo ?? "fixed",
    timed: room?.wait ? "on" : "off", wait: String(room?.wait ?? 10),
    limited: room?.hours ? "on" : "off", from: room?.hours?.from ?? "09:00", to: room?.hours?.to ?? "18:00", cap: String(room?.cap ?? ""),
  });
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setF((x) => ({ ...x, [k]: v }));
  const modeTouched = useRef(!!room); // yeni sırada tür elle seçilmedikçe kategoriden gelir (restoran → masa)
  const slugTouched = useRef(!!room?.slug && !room.private); // mevcut odanın adresi, ad değişince kendiliğinden değişmesin
  const [pt, setPt] = useState<Pt | null>(room?.lat != null ? { lat: room.lat, lng: room.lng! } : null);
  const fixed = f.geo === "fixed";

  async function submit(ev: FormEvent) {
    ev.preventDefault();
    if (fixed && !pt) return onError(T.pickOnMap);
    const { slug, timed, limited, from, to, ...rest } = f;
    // Nokta yalnızca sabit konumda anlamlı; diğerlerinde sıra haritada görünmez
    const body = { ...rest, ...(f.private ? {} : { slug }), radius: +f.radius, maxEmpty: f.maxEmpty === "" ? null : +f.maxEmpty, maxGroup: +f.maxGroup, ttl: +f.ttl, wait: timed === "on" ? +f.wait : null,
      hours: limited === "on" ? { from, to } : null, cap: f.cap === "" ? null : +f.cap, tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
      ...(fixed ? pt : {}) };
    const prev = rooms.find((r) => r.room === room?.room);
    const changed = prev?.slug && (f.private ? !prev.private : prev.slug !== slug);
    if (changed && !(await confirm({ title: T.slugChangeTitle, description: T.slugChangeDesc, action: T.cont }))) return;
    try {
      await (room ? adm(`/${room.room}`, body, "PUT") : adm("", body));
      onDone();
    } catch (e: any) { onError(e.message); }
  }

  const radiusField = (desc: string) => (
    <Inline id="radius" label={T.radius} desc={desc}>
      <Input id="radius" type="number" min={50} max={2000} required value={f.radius} onChange={(e) => set("radius", e.target.value)} />
    </Inline>
  );

  const warn = f.qr === "static" && f.geo === "dynamic" && <p className="rounded-lg border border-amber-400 bg-amber-50 p-3 text-sm">{T.staticHostWarn}</p>;

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="ghost" onClick={onCancel}><ChevronLeftIcon /> {T.queues}</Button>
        <Title className="mt-0 flex-1">{room ? T.edit(room.name) : T.newRoom}</Title>
      </div>

      {/* Geniş ekranda iki sütun: solda kimlik ve konum (harita), sağda sıra kuralları */}
      <div className="grid items-start gap-4 lg:grid-cols-2">
        <div className="flex flex-col gap-4">
          <Section title={T.secBasics}>
            <div className="grid gap-4 sm:grid-cols-[1fr_12rem]">
              <Field>
                <FieldLabel htmlFor="name">{T.name}</FieldLabel>
                <Input id="name" required maxLength={60} placeholder={T.namePh} value={f.name}
                  onChange={(e) => { set("name", e.target.value); if (!slugTouched.current) set("slug", slugify(e.target.value)); }} />
              </Field>
              <Field>
                <FieldLabel htmlFor="category">{T.category}</FieldLabel>
                <NativeSelect id="category" value={f.category} onChange={(e) => {
                  set("category", e.target.value);
                  if (!modeTouched.current) set("mode", e.target.value === "restoran" ? "tables" : ["gise", "resmi"].includes(e.target.value) ? "desks" : "seats");
                }}>
                  {Object.entries(CATEGORIES).map(([k, [i, t]]) => <NativeSelectOption key={k} value={k}>{i} {t}</NativeSelectOption>)}
                </NativeSelect>
              </Field>
            </div>
            {f.private ? (
              <p className="text-sm text-muted-foreground">{room?.private ? T.keepSecret(room.slug ?? "") : T.secretNew}</p>
            ) : (
              <Field>
                <FieldLabel htmlFor="slug">{T.slug}</FieldLabel>
                <Input id="slug" required minLength={3} maxLength={40} pattern="(?!..--)[a-z0-9][a-z0-9\-]*[a-z0-9]" placeholder="antalya-konserve" value={f.slug}
                  onChange={(e) => { slugTouched.current = true; set("slug", e.target.value); }} />
                <FieldDescription>{T.slugDesc(`${bare(home)}${f.slug || "…"}`)}</FieldDescription>
              </Field>
            )}
            <Check title={T.hidden} checked={f.private} onChange={(v) => set("private", v)}>
              {T.hiddenDesc}
            </Check>
          </Section>

          <Section title={T.geo}>
            <Choice label={T.geo} value={f.geo} onChange={(v) => set("geo", v)} items={[
              { v: "fixed", title: T.geoFixed, desc: T.geoFixedDesc, extra: <>
                <SpotPicker pt={pt} setPt={setPt} radius={+f.radius || 300} />
                {radiusField(T.radiusDesc)}
              </> },
              { v: "dynamic", title: T.geoDynamic, desc: T.geoDynamicDesc, extra: radiusField(T.radiusHostDesc) },
              { v: "off", title: T.geoOff, desc: T.geoOffDesc },
            ]} />
            {warn}
          </Section>

          <Section title={T.joinSec}>
            <Choice label={T.joinSec} value={f.limited} onChange={(v) => set("limited", v)} items={[
              { v: "off", title: T.always, desc: T.alwaysDesc },
              { v: "on", title: T.hoursOn, desc: T.hoursOnDesc, extra: (
                <div className="grid grid-cols-2 gap-4">
                  <Field>
                    <FieldLabel htmlFor="from">{T.fromL}</FieldLabel>
                    <Input id="from" type="time" required value={f.from} onChange={(e) => set("from", e.target.value)} />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="to">{T.toL}</FieldLabel>
                    <Input id="to" type="time" required value={f.to} onChange={(e) => set("to", e.target.value)} />
                  </Field>
                </div>
              ) },
            ]} />
            <Inline id="cap" label={T.capQ} desc={T.capDesc}>
              <Input id="cap" type="number" min={1} max={1000} inputMode="numeric" placeholder={T.noLimit} value={f.cap} onChange={(e) => set("cap", e.target.value)} />
            </Inline>
          </Section>
        </div>

        <div className="flex flex-col gap-4">
          <Section title={T.mode}>
            <Choice label={T.mode} value={f.mode} onChange={(v) => { modeTouched.current = true; set("mode", v); }} items={[
              { v: "seats", title: T.seats, desc: T.seatsDesc, extra: <>
                <Check title={T.flex} checked={f.flex} onChange={(v) => set("flex", v)}>{T.flexDesc}</Check>
                <Check title={T.skip} checked={f.skip} onChange={(v) => set("skip", v)}>{T.skipDesc}</Check>
              </> },
              { v: "tables", title: T.tables, desc: T.tablesDesc, extra: (
                <Inline id="maxEmpty" label={T.maxEmptyQ} desc={T.maxEmptyDesc}>
                  <Input id="maxEmpty" type="number" min={0} max={50} inputMode="numeric" placeholder={T.noLimit} value={f.maxEmpty} onChange={(e) => set("maxEmpty", e.target.value)} />
                </Inline>
              ) },
              { v: "desks", title: T.desks, desc: T.desksDesc, extra: (
                <Field>
                  <FieldLabel htmlFor="desks">{T.desksQ}</FieldLabel>
                  <Input id="desks" required maxLength={700} value={f.desks} onChange={(e) => set("desks", e.target.value)} />
                  <FieldDescription>{T.desksDescF}</FieldDescription>
                </Field>
              ) },
            ]} />
            {f.mode !== "desks" && (
              <Field>
                <FieldLabel htmlFor="zones">{T.zonesQ}</FieldLabel>
                <Input id="zones" maxLength={250} placeholder={T.zonesPh} value={f.zones} onChange={(e) => set("zones", e.target.value)} />
                <FieldDescription>{T.zonesDesc}</FieldDescription>
              </Field>
            )}
            <Inline id="maxGroup" label={T.maxGroupQ} desc={T.maxGroupDesc}>
              <Input id="maxGroup" type="number" min={1} max={20} required inputMode="numeric" value={f.maxGroup} onChange={(e) => set("maxGroup", e.target.value)} />
            </Inline>
          </Section>

          <Section title={T.waitSec}>
            <Choice label={T.waitSec} value={f.timed} onChange={(v) => set("timed", v)} items={[
              { v: "off", title: T.waitOff, desc: T.waitOffDesc },
              { v: "on", title: T.waitOn, desc: T.waitOnDesc, extra: (
                <Inline id="waitMin" label={T.waitQ}>
                  <NativeSelect id="waitMin" value={f.wait} onChange={(e) => set("wait", e.target.value)}>
                    {[3, 5, 10, 15, 20, 30].map((n) => <NativeSelectOption key={n} value={String(n)}>{T.min(n)}</NativeSelectOption>)}
                  </NativeSelect>
                </Inline>
              ) },
            ]} />
          </Section>

          <Section title={T.qr}>
            <Choice label={T.qr} value={f.qr} onChange={(v) => set("qr", v)} items={[
              { v: "dynamic", title: T.dynamic, desc: T.dynamicDesc, extra: (
                <Inline id="ttl" label={T.ttlQ} desc={T.ttlDesc}>
                  <NativeSelect id="ttl" value={f.ttl} onChange={(e) => set("ttl", e.target.value)}>
                    <NativeSelectOption value="60">{T.sec(60)}</NativeSelectOption>
                    <NativeSelectOption value="90">{T.sec(90)}</NativeSelectOption>
                    <NativeSelectOption value="180">{T.min(3)}</NativeSelectOption>
                    <NativeSelectOption value="300">{T.min(5)}</NativeSelectOption>
                  </NativeSelect>
                </Inline>
              ) },
              { v: "static", title: T.static, desc: T.staticDesc },
            ]} />
            {warn}
          </Section>
        </div>
      </div>

      <div className="sticky bottom-0 -mx-4 flex justify-end gap-2 border-t bg-background px-4 py-3">
        <Button type="button" variant="secondary" className="min-w-32" onClick={onCancel}>{T.cancel}</Button>
        <Button className="min-w-32">{T.save}</Button>
      </div>
    </form>
  );
}

function RoomRow({ r, dist, onChange, onEdit, onStats, onError }: { r: RoomInfo; dist?: number; onChange: () => Promise<void>; onEdit: () => void; onStats: () => void; onError: (m: string) => void }) {
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
          {[r.geo === "off" ? T.geoOffTag : r.geo === "dynamic" ? T.geoHostTag(r.radius) : `${r.radius} m`, T.maxPeople(r.maxGroup), r.tables ? `${T.tableTag}${r.maxEmpty !== null ? ` ${T.maxEmptyTag(r.maxEmpty)}` : ""}` : r.mode === "desks" ? T.deskTag(r.desks.length) : r.flex && T.flexTag, !!r.zones?.length && T.zoneTag(r.zones.join("/")), r.skip && T.skipTag, r.wait && T.waitTag(r.wait), r.hours && `${r.hours.from}–${r.hours.to}`, r.cap && T.capTag(r.cap), r.paused && T.pausedTag,
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
          <Button size="icon-sm" variant="ghost" title={T.statsBtn} onClick={onStats}><ChartColumnIcon /></Button>
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

function RoomTable({ rooms, onChange, onEdit, onStats, onError }: { rooms: RoomInfo[]; onChange: () => Promise<void>; onEdit: (r: RoomInfo) => void; onStats: (r: RoomInfo) => void; onError: (m: string) => void }) {
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<{ key: SortKey; asc: boolean }>({ key: "name", asc: true });
  const [page, setPage] = useState(0);
  const [me, setMe] = useState<Pt | null>(null);
  const [locating, setLocating] = useState(false);

  const words = norm(q).split(/\s+/).filter(Boolean);
  const rows = rooms
    .map((r) => ({ r, d: me && r.lat != null ? meters(me, { lat: r.lat, lng: r.lng! }) : undefined, hay: norm(`${r.name} ${r.slug ?? ""} ${CATEGORIES[r.category]?.[1] ?? ""} ${r.private ? T.hiddenWord : ""}`) }))
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
            {shown.map(({ r, d }) => <RoomRow key={r.room} r={r} dist={d} onChange={onChange} onEdit={() => onEdit(r)} onStats={() => onStats(r)} onError={onError} />)}
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

type Order = { id: string; tickets: number; status: "paid" | "refunded"; total: string; at: number };
type Balance = { metered: boolean; suspended: boolean; used: number; free: number; bought: number; granted: number; left: number | null; orders?: Order[] };
type Me = { user: string; super: boolean; home: string | false; email?: string | null; verified?: boolean; balance?: Balance; packages?: Pkg[] };
type User = { name: string; at: number; rooms: number; link: string; email: string | null; verified: boolean; suspended: boolean; balance: Balance; ref: { src: string; page: string } | null };
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

// Başlıkta her zaman görünen bakiye; sayaçlı hesapta yükleme sayfasına götürür
function BalanceChip({ me, onTopUp }: { me: Me; onTopUp: () => void }) {
  const b = me.balance;
  if (!b) return null;
  if (b.left === null) return <span className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm"><TicketIcon className="size-4" /> {T.unlimited}</span>;
  return (
    <Button variant={b.left <= 100 ? "destructive" : "secondary"} onClick={onTopUp} title={T.topUp}>
      <TicketIcon /> {T.left(Math.max(0, b.left))} · {T.topUp}
    </Button>
  );
}

// Bilet yükleme sayfası (/admin#bilet): bakiye, paketler, satın alımlar. Ödeme Lemon Squeezy sayfasında, dönüşte ?paid=1.
function TicketsPage({ me, paid, onBack, onError }: { me: Me; paid: boolean; onBack: () => void; onError: (m: string) => void }) {
  const b = me.balance!, [busy, setBusy] = useState(false);
  async function buy(variant: string) {
    setBusy(true);
    try { location.href = (await call<{ url: string }>("/api/admin/checkout", { variant })).url; } catch (e: any) { onError(e.message); setBusy(false); }
  }
  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="ghost" onClick={onBack}><ChevronLeftIcon /> {T.queues}</Button>
        <Title className="mt-0 flex-1">{T.topUp}</Title>
      </div>
      <Card>
        <CardHeader><CardTitle className="text-2xl font-bold">{b.left === null ? T.unlimited : T.left(Math.max(0, b.left))}</CardTitle></CardHeader>
        <CardContent className="flex flex-col gap-2">
          <p className="text-sm text-muted-foreground">{T.balanceDesc(b.used, b.free)}</p>
          {b.left !== null && <p className="text-sm text-muted-foreground">{T.breakdown(b.free, b.bought, b.granted, b.used)}</p>}
          {paid && <p className="font-semibold">{T.paid}</p>}
          {b.left !== null && b.left <= 100 && <p className="font-semibold text-destructive">{b.left <= 0 ? T.emptyWarn : T.lowWarn}</p>}
          {me.verified === false && <p className="text-sm font-semibold">{T.verifyFirst}</p>}
        </CardContent>
      </Card>
      {b.left !== null && (me.packages?.length ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {me.packages.map((p) => {
            const n = perThousand(p), name = packName(p);
            return (
              <Card key={p.variant}>
                <CardContent className="flex h-full flex-col gap-2">
                  {name && <span className="text-sm font-semibold text-muted-foreground">{name}</span>}
                  <b className="text-xl">{T.pack(p.tickets)}</b>
                  <span className="text-2xl font-bold text-primary">{p.price}</span>
                  {n && <span className="text-sm text-muted-foreground">{T.perThousand(n)}</span>}
                  <Button className="mt-auto" disabled={busy || !me.verified} onClick={() => buy(p.variant)}>{T.buy}</Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : <p className="text-sm text-muted-foreground">{T.noPackages}</p>)}
      {b.left !== null && <p className="text-sm text-muted-foreground">{T.buyNote}</p>}
      {!!b.orders?.length && (
        <Card className="py-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{T.orderDate}</TableHead>
                <TableHead className="text-right">{T.colBalance}</TableHead>
                <TableHead className="text-right">{T.orderTotal}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {b.orders.map((o) => (
                <TableRow key={o.id}>
                  <TableCell>{new Date(o.at).toLocaleDateString(lang)} <span className="text-xs text-muted-foreground">#{o.id}</span></TableCell>
                  <TableCell className={cn("text-right tabular-nums", o.status === "refunded" && "line-through")}>{o.tickets.toLocaleString(lang)}</TableCell>
                  <TableCell className="text-right">{o.total}{o.status === "refunded" && ` · ${T.refunded}`}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </>
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

// Kendi e-postasını ekleme ya da değiştirme: yeni adrese onay bağlantısı gider, açılana kadar eski adres geçerli kalır
function EmailForm({ me, onSent, onError }: { me: Me; onSent: (email: string) => void; onError: (m: string) => void }) {
  const [email, setEmail] = useState(""), [pw, setPw] = useState("");
  async function submit(ev: FormEvent) {
    ev.preventDefault();
    try {
      await call("/api/admin/email", { email, password: pw });
      onSent(email.trim().toLowerCase());
      setEmail(""); setPw("");
    } catch (e: any) { onError(e.message); }
  }
  return (
    <Card>
      <CardHeader><CardTitle className="text-lg font-semibold">{me.email ? T.changeEmail : T.addEmail}</CardTitle></CardHeader>
      <CardContent>
        <form onSubmit={submit} className="flex flex-col gap-4 text-base">
          {me.email && <p className="text-sm text-muted-foreground">{T.currentEmail(me.email)}</p>}
          <Field>
            <FieldLabel htmlFor="newemail">{T.newEmail}</FieldLabel>
            <Input id="newemail" type="email" required autoComplete="email" maxLength={254} value={email} onChange={(e) => setEmail(e.target.value)} />
            <FieldDescription>{T.newEmailDesc}</FieldDescription>
          </Field>
          <Field>
            <FieldLabel htmlFor="emailpw">{T.oldPw}</FieldLabel>
            <Input id="emailpw" type="password" required autoComplete="current-password" value={pw} onChange={(e) => setPw(e.target.value)} />
          </Field>
          <Button>{T.sendLink}</Button>
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
      setOld(""); setPw("");
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
          <Button>{T.save}</Button>
        </form>
      </CardContent>
    </Card>
  );
}

// Kullanıcı adını (ve alt alan adını) değiştirme; yeni oturum anahtarı döner. Eski adres yeni adrese yönlenir.
function RenameForm({ me, onDone, onError }: { me: Me; onDone: (name: string) => void; onError: (m: string) => void }) {
  const confirm = useConfirm();
  const [name, setName] = useState(""), [pw, setPw] = useState("");
  // Kullanıcı adreslerinin alan adı (demo-isletme.qrwait.app → qrwait.app); alan adı yoksa bu site
  const host = me.home && me.home.startsWith(`https://${me.user}.`) ? new URL(me.home).hostname.slice(me.user.length + 1) : location.hostname;
  async function submit(ev: FormEvent) {
    ev.preventDefault();
    if (!(await confirm({ title: T.renameTitle, description: T.renameConfirm(me.user, name, host), action: T.renameBtn }))) return;
    try {
      const r = await call<{ token: string }>("/api/admin/rename", { user: name, password: pw });
      localStorage.setItem("session", (token = r.token));
      setName(""); setPw("");
      onDone(name);
    } catch (e: any) { onError(e.message); }
  }
  return (
    <Card>
      <CardHeader><CardTitle className="text-lg font-semibold">{T.renameTitle}</CardTitle></CardHeader>
      <CardContent>
        <form onSubmit={submit} className="flex flex-col gap-4 text-base">
          <Field>
            <FieldLabel htmlFor="newuser">{T.newUsername}</FieldLabel>
            <Input id="newuser" required minLength={3} maxLength={40} pattern="(?!..--)[a-z0-9][a-z0-9\-]*[a-z0-9]" autoCapitalize="none" autoComplete="off"
              value={name} onChange={(e) => setName(e.target.value.toLowerCase())} />
            <FieldDescription>{T.renameDesc(`${name || "…"}.${host}`)}</FieldDescription>
          </Field>
          <Field>
            <FieldLabel htmlFor="renamepw">{T.oldPw}</FieldLabel>
            <Input id="renamepw" type="password" required autoComplete="current-password" value={pw} onChange={(e) => setPw(e.target.value)} />
          </Field>
          <Button>{T.renameBtn}</Button>
        </form>
      </CardContent>
    </Card>
  );
}

// Hesap sayfası (#hesap): adres ve e-posta özeti, e-posta ve şifre değiştirme, hesabı silme
function AccountPage({ me, onBack, onDeleted, reloadMe, onError }: { me: Me; onBack: () => void; onDeleted: () => void; reloadMe: () => Promise<void>; onError: (m: string) => void }) {
  const [note, setNote] = useState("");
  const done = (m: string) => { setNote(m); onError(""); window.scrollTo(0, 0); };
  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="ghost" onClick={onBack}><ChevronLeftIcon /> {T.queues}</Button>
        <Title className="mt-0 flex-1">{T.accountBtn}</Title>
      </div>
      {note && <p role="status" className="text-sm font-semibold">{note}</p>}
      <Card>
        <CardContent className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-[auto_1fr]">
          <span className="text-muted-foreground">{T.username}</span>
          <span className="font-semibold">{me.user}</span>
          {me.home && <><span className="text-muted-foreground">{T.address}</span><a className="break-all underline-offset-2 hover:underline" href={me.home} target="_blank">{bare(me.home)}</a></>}
          <span className="text-muted-foreground">{T.email}</span>
          <span>{me.email ? <>{me.email}{me.verified === false && <span className="text-muted-foreground"> · ⚠ {T.unverifiedTag}</span>}</> : <span className="text-muted-foreground">—</span>}</span>
        </CardContent>
      </Card>
      <EmailForm me={me} onSent={(e) => done(T.emailSent(e))} onError={onError} />
      <PasswordForm onDone={() => done(T.pwChanged)} onError={onError} />
      <RenameForm me={me} onDone={async (n) => { await reloadMe(); done(T.renamed(n)); }} onError={onError} />
      <DeleteAccount onDeleted={onDeleted} onError={onError} />
    </>
  );
}

// Saat dilimine göre bugünden n gün önceki tarih ("2026-09-02"); dönem süzgeci için
const dayAgo = (tz: string, n: number) => new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(Date.now() - n * 864e5);
const avgMin = (d: { waitMs: number; called: number }) => (d.called ? Math.round(d.waitMs / d.called / 60000) : null);
const SUMS = ["joined", "manual", "called", "waitMs", "served", "noShow", "expired", "left", "removed"] as const;

// Bir sıranın günlük sayıları: özet, saatlere göre katılım, günlük tablo, CSV
function StatsPage({ room, onBack, onError }: { room: RoomInfo; onBack: () => void; onError: (m: string) => void }) {
  const [data, setData] = useState<Stats>();
  const [range, setRange] = useState(30);
  const [tip, setTip] = useState<number | null>(null); // üzerine gelinen saat

  useEffect(() => { call<Stats>(`/api/admin/rooms/${room.room}/stats`).then(setData, (e) => onError(e.message)); }, [room.room]);

  const days = (data?.days ?? []).filter((d) => d.day > dayAgo(data!.tz, range));
  const sum = Object.fromEntries(SUMS.map((k) => [k, days.reduce((n, d) => n + d[k], 0)])) as Record<(typeof SUMS)[number], number>;
  const hours = Array.from({ length: 24 }, (_, h) => days.reduce((n, d) => n + d.hours[h], 0));
  const peak = Math.max(1, ...hours);
  const avg = avgMin(sum);

  function csv() {
    const head = [T.date, T.joined, T.manual, T.served, T.noShow, T.expired, T.leftSelf, T.removed, `${T.avgWait} (min)`];
    const rows = days.map((d) => [d.day, d.joined, d.manual, d.served, d.noShow, d.expired, d.left, d.removed, avgMin(d) ?? ""]);
    const text = [head, ...rows].map((r) => r.map((x) => `"${String(x).replaceAll('"', '""')}"`).join(",")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob(["﻿" + text], { type: "text/csv;charset=utf-8" }));
    a.download = `qrwait-${room.slug ?? room.room}-${range}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  const tiles: [string, ReactNode][] = [
    [T.joined, sum.joined], [T.served, sum.served], [T.noShow, sum.noShow + sum.expired], [T.leftSelf, sum.left],
    [T.avgWait, avg === null ? "–" : T.minShort(avg)],
  ];

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="ghost" onClick={onBack}><ChevronLeftIcon /> {T.queues}</Button>
        <Title className="mt-0 flex-1">{T.statsTitle}: {room.name}</Title>
        <div className="w-32">
          <NativeSelect aria-label={T.statsTitle} value={String(range)} onChange={(e) => setRange(+e.target.value)}>
            {[7, 30, 90].map((n) => <NativeSelectOption key={n} value={String(n)}>{T.days(n)}</NativeSelectOption>)}
          </NativeSelect>
        </div>
        <Button variant="secondary" disabled={!days.length} onClick={csv}>{T.csv}</Button>
      </div>

      {data && !days.length && <p className="text-muted-foreground">{T.noStats}</p>}
      {!!days.length && <>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          {tiles.map(([label, v]) => (
            <Card key={label} className="gap-1 py-4">
              <CardContent>
                <div className="text-sm text-muted-foreground">{label}</div>
                <div className="text-2xl font-bold tabular-nums">{v}</div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card>
          <CardHeader><CardTitle className="text-base font-semibold">{T.byHour}</CardTitle></CardHeader>
          <CardContent>
            <div className="relative">
              <div className="flex h-36 items-end gap-0.5 border-b" onMouseLeave={() => setTip(null)}>
                {hours.map((n, h) => (
                  // Vuruş alanı sütunun tamamı; görünen çubuk değere göre
                  <div key={h} className="flex h-full flex-1 cursor-default items-end" onMouseEnter={() => setTip(h)}
                    role="img" aria-label={`${String(h).padStart(2, "0")}:00 · ${n}`}>
                    <div className={cn("w-full rounded-t-[4px] bg-primary transition-opacity", tip !== null && tip !== h && "opacity-50")}
                      style={{ height: n ? `${Math.max(2, (n / peak) * 100)}%` : 0 }} />
                  </div>
                ))}
              </div>
              {tip !== null && (
                <div className="pointer-events-none absolute -top-2 rounded-md border bg-background px-2 py-1 text-xs shadow-sm tabular-nums"
                  style={{ left: `clamp(0px, calc(${((tip + 0.5) / 24) * 100}% - 3rem), calc(100% - 6rem))` }}>
                  {String(tip).padStart(2, "0")}:00–{String((tip + 1) % 24).padStart(2, "0")}:00 · <b>{hours[tip]}</b>
                </div>
              )}
              <div className="mt-1 flex text-xs text-muted-foreground tabular-nums">
                {hours.map((_, h) => <span key={h} className="flex-1 text-center">{h % 3 === 0 ? String(h).padStart(2, "0") : ""}</span>)}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base font-semibold">{T.daily}</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{T.date}</TableHead>
                  <TableHead className="text-right">{T.joined}</TableHead>
                  <TableHead className="text-right">{T.served}</TableHead>
                  <TableHead className="text-right">{T.noShow}</TableHead>
                  <TableHead className="text-right">{T.leftSelf}</TableHead>
                  <TableHead className="text-right">{T.avgWait}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {[...days].reverse().map((d) => (
                  <TableRow key={d.day}>
                    <TableCell className="tabular-nums">{new Date(`${d.day}T12:00:00`).toLocaleDateString(lang, { weekday: "short", day: "numeric", month: "short" })}</TableCell>
                    <TableCell className="text-right tabular-nums">{d.joined}{d.manual ? <span className="text-muted-foreground"> ({T.manual} {d.manual})</span> : null}</TableCell>
                    <TableCell className="text-right tabular-nums">{d.served}</TableCell>
                    <TableCell className="text-right tabular-nums">{d.noShow + d.expired}{d.expired ? <span className="text-muted-foreground"> ({T.expired} {d.expired})</span> : null}</TableCell>
                    <TableCell className="text-right tabular-nums">{d.left}</TableCell>
                    <TableCell className="text-right tabular-nums">{avgMin(d) === null ? "–" : T.minShort(avgMin(d)!)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
        <p className="text-sm text-muted-foreground">{T.statsNote(data!.tz)}</p>
      </>}
    </>
  );
}

// notice: girişli açılan e-posta bağlantısının sonucu ("E-postanız doğrulandı")
function RoomsPanel({ me, paid, notice, reloadMe, logout }: { me: Me; paid: boolean; notice: string; reloadMe: () => Promise<void>; logout: (msg?: string) => void }) {
  const [rooms, setRooms] = useState<RoomInfo[] | null>(null); // null: henüz yüklenmedi
  const [note, setNote] = useState(notice);
  const [err, setErr] = useState("");
  const [tickets, setTickets] = useState(location.hash === "#bilet" || paid); // bilet yükleme sayfası
  // Hesap sayfası: #hesap
  // Sıra formu kendi sayfasında: #yeni, #duzenle-<oda id>
  const [hash, setHash] = useState(location.hash);
  const editId = hash.startsWith("#duzenle-") ? hash.slice(9) : null;
  const statsId = hash.startsWith("#istatistik-") ? hash.slice(12) : null;
  const statsRoom = statsId ? rooms?.find((r) => r.room === statsId) : undefined;
  const editing = hash === "#yeni" ? null : editId ? rooms?.find((r) => r.room === editId) : undefined; // undefined: form kapalı, null: yeni oda
  const formOpen = useRef(false);
  formOpen.current = hash === "#yeni" || !!editId || !!statsId; // açıkken liste yenilenmez
  const account = hash === "#hesap";

  // #bilet adresi paylaşılabilir (e-postadaki bağlantı), geri tuşu sıralara döner
  useEffect(() => {
    const on = () => { setTickets(location.hash === "#bilet"); setHash(location.hash); window.scrollTo(0, 0); };
    addEventListener("hashchange", on);
    return () => removeEventListener("hashchange", on);
  }, []);
  const go = (h: string) => { location.hash = h; setHash(h && `#${h}`); setTickets(h === "bilet"); window.scrollTo(0, 0); };
  const openTickets = (v: boolean) => go(v ? "bilet" : "");
  // Silinmiş ya da başkasının sırası: listeye dön
  useEffect(() => { if (rooms && ((editId && !editing) || (statsId && !statsRoom))) go(""); }, [editId, statsId, rooms]);
  const low = me.balance?.left != null && me.balance.left <= 100;

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

  if (statsId) return (
    <Page className="max-w-5xl">
      {statsRoom && <StatsPage room={statsRoom} onBack={() => go("")} onError={setErr} />}
      <ErrorText>{err}</ErrorText>
    </Page>
  );

  if (formOpen.current) return (
    <Page className="max-w-6xl">
      {editing !== undefined && (
        <RoomForm key={editing?.room ?? "new"} room={editing} rooms={rooms ?? []} home={me.home || ""} onError={setErr}
          onDone={() => { go(""); load(); }} onCancel={() => go("")} />
      )}
      <ErrorText>{err}</ErrorText>
    </Page>
  );

  if (account) return (
    <Page className="max-w-3xl">
      <AccountPage me={me} onBack={() => go("")} onDeleted={() => logout(T.deleted)} reloadMe={reloadMe} onError={setErr} />
      <ErrorText>{err}</ErrorText>
    </Page>
  );

  if (tickets) return (
    <Page className="max-w-5xl">
      <TicketsPage me={me} paid={paid} onBack={() => openTickets(false)} onError={setErr} />
      <ErrorText>{err}</ErrorText>
    </Page>
  );

  return (
    <Page className="max-w-5xl">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex-1">
          <Title>{T.queues}</Title>
          {me.home && <a className="text-sm text-muted-foreground underline-offset-2 hover:underline" href={me.home} target="_blank">{bare(me.home)}</a>}
        </div>
        <BalanceChip me={me} onTopUp={() => openTickets(true)} />
        <Button disabled={me.verified === false} onClick={() => go("yeni")}>{T.addRoom}</Button>
        <Button variant="secondary" onClick={() => go("hesap")}><UserIcon /> {T.accountBtn}</Button>
        <Button variant="secondary" onClick={() => logout()}>{T.logout}</Button>
      </div>
      {!me.email && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border p-3 text-sm">
          <span className="flex-1">{T.noEmailBanner}</span>
          <Button size="sm" variant="secondary" onClick={() => go("hesap")}><MailIcon /> {T.addEmail}</Button>
        </div>
      )}
      {me.verified === false && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border p-3 text-sm">
          <span className="flex-1">{T.verifyBanner(me.email ?? "")}</span>
          <Button size="sm" variant="secondary" onClick={resend}>{T.resend}</Button>
        </div>
      )}
      {note && <p className="text-sm">{note}</p>}
      {low && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-destructive p-3 text-sm">
          <span className="flex-1 font-semibold text-destructive">{me.balance!.left! <= 0 ? T.emptyWarn : T.lowWarn}</span>
          <Button size="sm" onClick={() => openTickets(true)}>{T.topUp}</Button>
        </div>
      )}
      <RoomTable rooms={rooms ?? []} onChange={load} onEdit={(r) => go(`duzenle-${r.room}`)} onStats={(r) => go(`istatistik-${r.room}`)} onError={setErr} />
      <ErrorText>{err}</ErrorText>
    </Page>
  );
}

// Süper yönetici: kullanıcıları açar, şifre sıfırlar, siler; hesaplardan önceki sıraları bir kullanıcıya taşır
function UsersPanel({ logout }: { logout: (msg?: string) => void }) {
  const confirm = useConfirm();
  const [data, setData] = useState<{ users: User[]; unowned: number }>({ users: [], unowned: 0 });
  const [form, setForm] = useState<{ user: string; password: string; email?: string; reset?: string }>();
  const [grant, setGrant] = useState<{ user: string; n: string }>();
  const [mailFor, setMailFor] = useState<{ user: string; email: string }>();
  const [renameFor, setRenameFor] = useState<{ user: string; name: string }>();
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
      await (f.reset ? call(`/api/admin/users/${f.reset}`, { password: f.password }, "PUT") : call("/api/admin/users", { user: f.user, password: f.password, email: f.email || undefined }));
      setForm(undefined);
    });
  }

  return (
    <Page className="max-w-3xl">
      <div className="flex items-center gap-2">
        <Title className="flex-1">{T.users}</Title>
        <Button onClick={() => setForm({ user: "", password: "", email: "" })}>{T.addUser}</Button>
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
                  {u.ref && <div className="text-xs text-muted-foreground" title={T.refTitle}>↪ {u.ref.src} · {u.ref.page}</div>}
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
                        <DropdownMenuItem onSelect={() => setRenameFor({ user: u.name, name: "" })}><PencilIcon /> {T.renameTitle}</DropdownMenuItem>
                        <DropdownMenuItem onSelect={() => setMailFor({ user: u.name, email: u.email ?? "" })}><MailIcon /> {T.setEmail}</DropdownMenuItem>
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
      {renameFor && (
        <Card>
          <CardHeader><CardTitle className="text-lg font-semibold">{T.renameFor(renameFor.user)}</CardTitle></CardHeader>
          <CardContent>
            <form className="flex flex-col gap-4 text-base" onSubmit={(ev) => {
              ev.preventDefault();
              run(() => call(`/api/admin/users/${renameFor.user}/rename`, { user: renameFor.name }).then(() => setRenameFor(undefined)));
            }}>
              <Field>
                <FieldLabel htmlFor="rname">{T.newUsername}</FieldLabel>
                <Input id="rname" required minLength={3} maxLength={40} pattern="(?!..--)[a-z0-9][a-z0-9\-]*[a-z0-9]" autoComplete="off"
                  value={renameFor.name} onChange={(e) => setRenameFor({ ...renameFor, name: e.target.value.toLowerCase() })} />
                <FieldDescription>{T.renameAdminDesc}</FieldDescription>
              </Field>
              <div className="flex gap-2">
                <Button type="button" variant="secondary" className="flex-1" onClick={() => setRenameFor(undefined)}>{T.cancel}</Button>
                <Button className="flex-1">{T.save}</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}
      {mailFor && (
        <Card>
          <CardHeader><CardTitle className="text-lg font-semibold">{T.setEmailFor(mailFor.user)}</CardTitle></CardHeader>
          <CardContent>
            <form className="flex flex-col gap-4 text-base" onSubmit={(ev) => {
              ev.preventDefault();
              plan(mailFor.user, { email: mailFor.email }).then(() => setMailFor(undefined));
            }}>
              <Field>
                <FieldLabel htmlFor="umail">{T.email}</FieldLabel>
                <Input id="umail" type="email" required maxLength={254} autoComplete="off" value={mailFor.email} onChange={(e) => setMailFor({ ...mailFor, email: e.target.value })} />
                <FieldDescription>{T.setEmailDesc}</FieldDescription>
              </Field>
              <div className="flex gap-2">
                <Button type="button" variant="secondary" className="flex-1" onClick={() => setMailFor(undefined)}>{T.cancel}</Button>
                <Button className="flex-1">{T.save}</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}
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
                  <Input id="user" required minLength={3} maxLength={40} pattern="(?!..--)[a-z0-9][a-z0-9\-]*[a-z0-9]" placeholder="antalyabb" autoComplete="off"
                    value={form.user} onChange={(e) => setForm({ ...form, user: e.target.value })} />
                  <FieldDescription>{T.userDesc(`${form.user || "…"}.${location.hostname.replace(/^www\./, "")}`)}</FieldDescription>
                </Field>
              )}
              {!form.reset && (
                <Field>
                  <FieldLabel htmlFor="umail">{T.emailOptional}</FieldLabel>
                  <Input id="umail" type="email" maxLength={254} autoComplete="off" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                  <FieldDescription>{T.setEmailDesc}</FieldDescription>
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

// E-posta bağlantıları: ?verify=<belirteç>, ?reset=<belirteç>, ?email=<belirteç> (yeni adresin onayı); ödemeden dönüş ?paid=1; tanıtım sitesinden #signup.
// Belirteç okunur okunmaz adres çubuğundan silinir (geçmişte ve paylaşılan ekranda kalmasın).
const params = new URLSearchParams(location.search);
const resetToken = params.get("reset") ?? "", verifyToken = params.get("verify") ?? "", emailToken = params.get("email") ?? "", paidBack = params.has("paid");
if (location.search) history.replaceState(null, "", `/admin${paidBack ? "#bilet" : location.hash}`);

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
      const m = await call<Me>("/api/admin/me");
      setMe(m);
      // Üst çubuktan dil değişince hesaba da yazılır: hesap e-postaları o dilde gelir
      onLangChange(m.super ? undefined : (l) => call("/api/admin/lang", { lang: l }));
      setErr("");
    } catch (e: any) { logout(e.message); }
  }

  function logout(msg = "") {
    localStorage.removeItem("session");
    token = null;
    onLangChange();
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
    } else if (emailToken) {
      api<{ email: string }>("/api/email", { token: emailToken }).then((r) => { setNote(T.emailChanged(r.email)); if (token) start(); }, (e) => setErr(e.message));
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
          : await api<{ token: string }>("/api/signup", { ...f, captcha, lang, terms: agree ? TERMS_VERSION : "", ref: signupRef() });
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

  if (me) return me.super ? <UsersPanel logout={logout} /> : <RoomsPanel me={me} paid={paidBack} notice={note} reloadMe={start} logout={logout} />;
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
                  {...(mode === "signup" && { minLength: 3, maxLength: 40, pattern: "(?!..--)[a-z0-9][a-z0-9\\-]*[a-z0-9]" })} />
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
