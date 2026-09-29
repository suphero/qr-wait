import { useEffect, useRef, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { api, catIcon, locate, type PublicRoom } from "@/lib/api";
import { baseMap, L, meters } from "@/lib/leaflet";
import { mount } from "@/lib/mount";
import { cn } from "@/lib/utils";
import "./home.css";

const green = "#15803D", yellow = "#FFE27A";
const esc = (s: unknown) => String(s ?? "").replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const fmtDist = (m: number) => (m < 1000 ? `${Math.max(10, Math.round(m / 10) * 10)} m` : `${(m / 1000).toFixed(1).replace(".", ",")} km`);
const waitText = (r: PublicRoom) => (r.waiting ? `${r.waiting} grup, ${r.people} kişi bekliyor` : "Şu an sıra yok");

// Hap biçimli lacivert kenarlı butonlar
const pill = "h-auto rounded-full border-2 border-ink bg-transparent px-5 py-3.5 text-base leading-none font-semibold text-ink hover:bg-ink/5";
const solid = "bg-ink text-white hover:bg-ink/90";

function Section({ id, className, children }: { id?: string; className?: string; children: ReactNode }) {
  return <section id={id} className={cn("border-t border-line py-14 md:py-20", className)}>{children}</section>;
}
function H2({ className, children }: { className?: string; children: ReactNode }) {
  return <h2 className={cn("mb-10 max-w-[20ch] text-[clamp(1.9rem,4vw,2.75rem)] leading-[1.1] font-extrabold tracking-[-0.03em]", className)}>{children}</h2>;
}

// Fişteki tek animasyon: sıra ilerler, sonunda yeşile döner. Hareket azaltma tercihinde son hali gösterilir.
const STEPS = ["Önünüzde 3 grup var", "Önünüzde 2 grup var", "Önünüzde 1 grup var", "Sıradaki sizsiniz, hazır olun"];
const DONE = "Sıran geldi! Görevliye numaranı göster.";
function Ticket() {
  const [state, setState] = useState(STEPS[0]);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  function play() {
    timers.current.forEach(clearTimeout);
    setState(STEPS[0]);
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return setState(DONE);
    timers.current = [...STEPS.map((t, i) => setTimeout(() => setState(t), 900 + i * 1100)), setTimeout(() => setState(DONE), 900 + STEPS.length * 1100)];
  }
  useEffect(() => { play(); return () => timers.current.forEach(clearTimeout); }, []);
  const go = state === DONE;
  return (
    <button type="button" onClick={play} aria-label="Örnek sıra fişi, yeniden oynatmak için dokunun"
      className={cn("ticket relative w-[min(340px,100%)] cursor-pointer justify-self-center rounded-md px-8 pt-7 pb-8 text-left transition-[background,color,transform] duration-500",
        go ? "scale-[1.03] rotate-0 bg-success text-white" : "-rotate-3 bg-ticket text-ink")}>
      <span className="text-[.95rem] font-semibold opacity-75">Konyaaltı Halk Plajı</span>
      <div className="mt-2 mb-3 text-[7.5rem] leading-none font-extrabold tracking-[-0.05em] tabular-nums">47</div>
      <p aria-live="polite" className="min-h-[3.2em] border-t-2 border-dashed border-current/35 pt-3.5 text-xl font-semibold">{state}</p>
    </button>
  );
}

// Yakındaki sıralar: harita + mesafeye göre liste
function Nearby() {
  const [rooms, setRooms] = useState<PublicRoom[]>([]);
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [me, setMe] = useState<{ lat: number; lng: number } | null>(null);
  const [note, setNote] = useState("Sıra durumunu görmek için bir yere dokun. Konumunu paylaşırsan en yakındakiler üstte görünür.");
  const [locating, setLocating] = useState(false);
  const mapEl = useRef<HTMLDivElement>(null);
  const m = useRef<{ map?: L.Map; me?: L.CircleMarker; markers: Record<string, L.Marker> }>({ markers: {} });

  async function load(fit: boolean) {
    let list: PublicRoom[];
    try { list = await api<PublicRoom[]>("/api/rooms"); } catch { return setFailed(true); }
    setFailed(false);
    setRooms(list);
    setLoaded(true);
    if (fit && list.length) m.current.map?.fitBounds(L.latLngBounds(list.map((r) => [r.lat, r.lng])), { padding: [30, 30] });
    return list;
  }

  async function sortByMe(list = rooms) {
    setLocating(true);
    try {
      const c = await locate();
      const here = { lat: c.latitude, lng: c.longitude }, x = m.current;
      setMe(here);
      x.me ? x.me.setLatLng(here) : (x.me = L.circleMarker(here, { radius: 7, color: "#fff", weight: 3, fillColor: "#2563EB", fillOpacity: 1 }).bindTooltip("Buradasın").addTo(x.map!));
      const nearest = list.map((r) => ({ r, d: meters(here, r) })).sort((a, b) => a.d - b.d)[0];
      if (nearest && nearest.d > 50000) {
        // Uzaktaysa haritayı kıtalar ölçeğine açma, sıralarda kal
        setNote(`Yakınında henüz sıra yok. En yakını ${fmtDist(nearest.d)} uzakta.`);
        return;
      }
      if (nearest) x.map!.fitBounds(L.latLngBounds([[here.lat, here.lng], [nearest.r.lat, nearest.r.lng]]), { padding: [40, 40], maxZoom: 16 });
      setNote("En yakındakiler üstte. Sıra durumunu görmek için bir yere dokun.");
    } catch (e: any) { setNote(e.message); }
    finally { setLocating(false); }
  }

  useEffect(() => {
    m.current.map = baseMap(mapEl.current!, { scrollWheelZoom: false }).setView([36.86, 30.73], 13);
    load(true).then((list) => navigator.permissions?.query({ name: "geolocation" })
      .then((p) => { if (p.state === "granted") sortByMe(list ?? []); }).catch(() => {}));
    const t = setInterval(() => !document.hidden && load(false), 60000);
    return () => { clearInterval(t); m.current.map?.remove(); m.current = { markers: {} }; };
  }, []);

  // Kategori ikonu, dolgu rengi bekleme durumu (sarı: sıra var, yeşil: sıra yok)
  useEffect(() => {
    const x = m.current;
    for (const r of rooms) {
      const popup = `<b>${catIcon(r.category)} ${esc(r.name)}</b><br>${waitText(r)}<br><a href="${esc(r.link)}">Sıra durumunu gör</a>`;
      const icon = L.divIcon({ className: "", html: `<span class="pin" style="background:${r.waiting ? yellow : green}">${catIcon(r.category)}</span>`, iconSize: [34, 34], iconAnchor: [17, 17], popupAnchor: [0, -14] });
      const k = r.slug ?? r.link;
      x.markers[k] ? x.markers[k].setIcon(icon).setPopupContent(popup)
        : (x.markers[k] = L.marker([r.lat, r.lng], { icon, title: r.name }).bindPopup(popup).addTo(x.map!));
    }
  }, [rooms]);

  const list = rooms.map((r) => ({ r, d: me ? meters(me, r) : 0 }))
    .sort((a, b) => (me ? a.d - b.d : a.r.name.localeCompare(b.r.name, "tr")));
  // Listede bir sıranın üzerine gelince haritada göster
  const show = (r: PublicRoom) => m.current.markers[r.slug ?? r.link]?.openPopup();

  return (
    <Section id="yakin">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-4">
        <H2 className="m-0">Yakınındaki sıralar</H2>
        <Button className={pill} disabled={locating} onClick={() => sortByMe()}>Konumuma göre sırala</Button>
      </div>
      <p className="mb-6 text-ink-soft">{note}</p>
      <div className="grid gap-4 md:grid-cols-[1.4fr_1fr] md:gap-6">
        <div ref={mapEl} role="region" aria-label="Sıraların haritası" className="z-0 h-[300px] rounded-[20px] border border-line md:h-[480px]" />
        <ol aria-live="polite" className="m-0 list-none overflow-y-auto border-t border-line p-0 md:max-h-[480px]">
          {failed ? <li className="font-semibold text-destructive">Sıralar yüklenemedi. Sayfayı yenileyin.</li>
            : !loaded ? <li className="text-ink-soft">Sıralar yükleniyor…</li>
            : !list.length ? <li className="text-ink-soft">Henüz sıra yok.</li>
            : list.map(({ r, d }) => (
              <li key={r.link}>
                <a href={r.link} onMouseOver={() => show(r)} onFocus={() => show(r)}
                  className="flex items-center justify-between gap-3 border-b border-line px-1 py-3.5 no-underline hover:bg-white focus-visible:bg-white">
                  <span>
                    <b className="block text-[1.1rem]">{catIcon(r.category)} {r.name}</b>
                    <span className={cn("text-[.95rem]", r.waiting ? "text-ink-soft" : "font-semibold text-success")}>{waitText(r)}</span>
                  </span>
                  {d ? <span className="text-[1.15rem] font-extrabold whitespace-nowrap tabular-nums">{fmtDist(d)}</span> : null}
                </a>
              </li>
            ))}
        </ol>
      </div>
    </Section>
  );
}

function HomePage() {
  return (
    <div className="mx-auto max-w-[1080px] px-5 font-display text-[1.0625rem] leading-relaxed text-ink [font-optical-sizing:auto] [&_:focus-visible]:rounded [&_:focus-visible]:outline-3 [&_:focus-visible]:outline-offset-3 [&_:focus-visible]:outline-success">
      <header className="flex items-center justify-between py-5">
        <a className="text-[1.35rem] font-extrabold tracking-[-0.02em] no-underline" href="/">
          sıran geldi<span aria-hidden="true" className="ml-[.12em] inline-block size-[.5em] rounded-full bg-success" />
        </a>
        <Button asChild className={cn(pill, "px-4 py-2.5 text-[.95rem]")}><a href="/admin">Yönetici girişi</a></Button>
      </header>

      <main>
        <div className="grid items-center gap-10 pt-12 pb-16 md:grid-cols-[1.15fr_1fr] md:gap-12 md:pb-24">
          <div>
            <h1 className="mb-6 text-[clamp(2.5rem,6vw,4.25rem)] leading-[1.02] font-extrabold tracking-[-0.035em]">Sıranı al, gerisini telefonun beklesin.</h1>
            <p className="mb-8 max-w-[34ch] text-xl text-ink-soft">Plajda, iskelede, hizmet noktasında. QR kodu okut, sıraya gir, sıran gelince telefonun titresin. Uygulama indirmen gerekmez.</p>
            <div className="flex flex-wrap gap-3">
              <Button asChild className={cn(pill, solid)}><a href="#yakin">Yakınımdaki sıraları bul</a></Button>
              <Button asChild className={pill}><a href="#iletisim">Kendi sıranızı kuralım</a></Button>
            </div>
          </div>
          <Ticket />
        </div>

        <Nearby />

        <Section id="nasil">
          <H2>Kuyrukta dikilmek yok</H2>
          <ol className="steps m-0 grid list-none gap-7 p-0 md:grid-cols-3 md:gap-10">
            <li><h3 className="mb-1.5 text-xl font-semibold tracking-[-0.01em]">QR kodu okut</h3><p className="text-ink-soft">Görevlinin ekranındaki kodu telefonunun kamerasıyla okut. Açılan sayfada kaç kişi olduğunu seç, sıraya gir.</p></li>
            <li><h3 className="mb-1.5 text-xl font-semibold tracking-[-0.01em]">Sıranı takip et</h3><p className="text-ink-soft">Önünde kaç kişi kaldığını anlık gör. Bu arada gölgede otur, çayını iç, sıranı kimse kapmaz.</p></li>
            <li><h3 className="mb-1.5 text-xl font-semibold tracking-[-0.01em]">Sıran gelince gel</h3><p className="text-ink-soft">Telefonun titrer, ekran yeşile döner. Görevliye numaranı göster, yerine geç.</p></li>
          </ol>
        </Section>

        <Section>
          <H2>Beklemenin olduğu her yerde</H2>
          <dl className="m-0 grid md:grid-cols-2 md:gap-x-12">
            {[
              ["Plajlar ve havuzlar", "Şezlong ve alan kapasitesi dolduğunda yer kavgası yerine düzenli sıra. Gruplar kaç şezlonga razı olduğunu seçer, 4 kişi 2 şezlongla da yerleşebilir."],
              ["İskele ve otobüs kuyrukları", "Araç geldiğinde koltuk sayısı kadar kişi çağrılır, kalanlar yerinden kalkmaz."],
              ["Belediye hizmet noktaları", "Gişe önünde yığılma olmadan, sırası gelen gelir."],
              ["Etkinlik ve festival girişleri", "Kapıda bekleyen kalabalık yerine telefondan takip edilen giriş sırası."],
              ["Özel işletmeler", "Beach club, restoran, klinik. Müşteriniz beklerken alanınızı dolaşsın."],
              ["Uzaktan sıra durumu", "Her noktanın kendi adresi var. Yola çıkmadan önce ne kadar kalabalık olduğunu gör."],
            ].map(([t, d]) => (
              <div key={t} className="border-b border-line py-5">
                <dt className="text-[1.15rem] font-semibold">{t}</dt>
                <dd className="mt-1 text-ink-soft">{d}</dd>
              </div>
            ))}
          </dl>
        </Section>

        <Section>
          <H2>Herkese aynı kural</H2>
          <div className="grid gap-x-12 gap-y-9 md:grid-cols-2">
            {[
              ["Evden sıraya girilmez", "Sıraya girmek için orada olmak gerekir. Telefonun konumu kontrol edilir."],
              ["Ekran görüntüsü işe yaramaz", "QR kod saniyeler içinde yenilenir. Gruplara atılan fotoğrafla sıraya girilemez."],
              ["Bir telefon, bir sıra", "Aynı telefonla ikinci numara alınamaz. Grup büyüklüğünün de üst sınırı var."],
              ["Telefonu olmayan dışarıda kalmaz", "Görevli, akıllı telefonu olmayanları tek dokunuşla sıraya ekler ve numarasını söyler."],
            ].map(([t, d]) => (
              <div key={t} className="border-l-4 border-ticket-edge pl-5">
                <h3 className="mb-1.5 text-xl font-semibold tracking-[-0.01em]">{t}</h3>
                <p className="text-ink-soft">{d}</p>
              </div>
            ))}
          </div>
        </Section>

        <Section>
          <div className="grid items-start gap-10 md:grid-cols-2 md:gap-12">
            <H2 className="m-0">Yönetmesi de kolay</H2>
            <ul className="m-0 grid gap-3 pl-[1.2em] text-ink-soft [list-style:disc]">
              <li>Kaç kişi ayrıldığını girin, sistem sıradakileri kendisi çağırır.</li>
              <li>Gelmeyeni tek dokunuşla düşürün, yeri sıradakine geçsin.</li>
              <li>Her nokta haritadan seçilir, kendi web adresini alır.</li>
              <li>Görevli paneli tablette ya da telefonda açılır, kurulum gerekmez.</li>
            </ul>
          </div>
        </Section>

        <section id="iletisim" className="mt-10 mb-20 rounded-[20px] bg-ink px-6 py-10 text-white md:rounded-[28px] md:px-12 md:py-16">
          <H2 className="mb-4">Kendi sıranızı kuralım</H2>
          <p className="mb-8 max-w-[46ch] text-[1.15rem] text-[#C9D2E3]">Plajınız, işletmeniz ya da etkinliğiniz için sıra sistemi kurmak isterseniz yazın. Kurulumu birlikte yapalım.</p>
          <a className="inline-block text-[clamp(1.4rem,4vw,2.4rem)] font-extrabold tracking-[-0.02em] break-all text-ticket underline decoration-3 underline-offset-6" href="mailto:iletisim@sirangeldi.com">iletisim@sirangeldi.com</a>
        </section>
      </main>

      <footer className="flex flex-wrap justify-between gap-4 pt-6 pb-10 text-[.95rem] text-ink-soft">
        <span>© 2026 Sıran Geldi</span>
        <a href="/admin" className="underline">Yönetici girişi</a>
      </footer>
    </div>
  );
}

mount(<HomePage />);
