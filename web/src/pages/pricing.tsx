import { useEffect, useState } from "react";
import { CheckIcon } from "lucide-react";
import { EMAIL } from "@/components/legal";
import { H2, pill, Section, Site, solid } from "@/components/site";
import { Button } from "@/components/ui/button";
import { api, packName, perThousand, type Pkg } from "@/lib/api";
import { lang, pick } from "@/lib/i18n";
import { mount } from "@/lib/mount";
import { cn } from "@/lib/utils";
import "./home.css";

// Herkese açık fiyat sayfası (/pricing). Paketler ve ücretsiz hak /api/config'ten gelir (wrangler.jsonc PACKAGES, src/billing.js FREE);
// buradaki metinler kullanım koşullarıyla (pages/terms.tsx) aynı kuralları anlatmalı.
type Pair = [string, string];
const T = pick<{
  title: string; heroTitle: string; heroText: string;
  free: string; freePrice: string; freeNote: string; signup: string;
  tickets: (n: string) => string; per1000: (p: string) => string; best: string; buy: string; once: string;
  loading: string; loadFail: string; noPackages: string;
  ticketTitle: string; ticketText: string; examples: Pair[];
  allTitle: string; all: string[];
  faqTitle: string; faq: Pair[];
  moreTitle: string; moreText: string;
}>({
  tr: {
    title: "Fiyatlar · QR Wait",
    heroTitle: "Abonelik yok. Sıraya giren kadar ödeyin.",
    heroText: "Her yeni sıra kaydı 1 bilet. Biletleri paketle alırsınız, son kullanma tarihi yoktur. Sezon bitince ödemeye devam etmezsiniz.",
    free: "Ücretsiz",
    freePrice: "$0",
    freeNote: "Hesap açınca bir kez. Kredi kartı gerekmez.",
    signup: "Ücretsiz hesap aç",
    tickets: (n) => `${n} bilet`,
    per1000: (p) => `1000 bilet ${p}`,
    best: "En avantajlı",
    buy: "Satın al",
    once: "Tek seferlik ödeme",
    loading: "Paketler yükleniyor…",
    loadFail: "Paketler yüklenemedi. Sayfayı yenileyin.",
    noPackages: "Bilet paketleri yakında. Şimdilik bilet için bize yazın.",
    ticketTitle: "Bilet ne demek?",
    ticketText: "Sıralarınıza giren her yeni kayıt 1 bilet harcar: QR koduyla giren de, görevlinin elle eklediği de. Grup kaç kişi olursa olsun tek bilettir.",
    examples: [
      ["4 kişilik aile sıraya girer", "1 bilet"],
      ["Görevli telefonu olmayan birini ekler", "1 bilet"],
      ["Aynı telefon sayfayı yeniden açar", "Bilet harcanmaz"],
      ["Sırayı izleyen, durum sayfasına bakan", "Bilet harcanmaz"],
    ],
    allTitle: "Her pakette her şey var",
    all: [
      "20 sıraya kadar, her biri kendi adresi ve durum sayfasıyla",
      "Tarayıcıda açılan görevli paneli, kurulum yok",
      "Koltuk ve masa modları, esnek gruplar",
      "Konum kontrolü ve yenilenen QR kod",
      "Sıra gelince telefona bildirim",
      "Türkçe, İngilizce, Almanca ve Rusça ziyaretçi sayfaları",
    ],
    faqTitle: "Sık sorulanlar",
    faq: [
      ["Biletlerin süresi dolar mı?", "Hayır. Satın aldığınız biletler hesabınız açık olduğu sürece kullanılabilir; sezon dışında bekler."],
      ["Bilet bitince ne olur?", "Sıralarınız yeni kişi almaz, sıradaki kayıtlar etkilenmez. Bakiye azaldığında ve bittiğinde e-postayla haber veririz; yönetim ekranından anında yükleyebilirsiniz."],
      ["Nasıl ödenir, fatura gelir mi?", "Ödeme Lemon Squeezy güvenli ödeme sayfasında kartla alınır. Satıcı Lemon Squeezy'dir; faturayı e-postanıza gönderir. Geçerli KDV ya da satış vergisi ödeme sayfasında gösterilir. Fiyatlar ABD doları (USD) cinsindendir."],
      ["İade var mı?", "Hiç kullanılmamış bir paket, satın alındıktan sonraki 14 gün içinde iade edilir. Kısmen kullanılmış paketler ve ücretsiz biletler iade edilmez."],
      ["Aynı paketi birden fazla alabilir miyim?", "Evet. Biletler bakiyenize eklenir, paketler toplanır."],
    ],
    moreTitle: "Daha fazlası mı lazım?",
    moreText: "Belediye, zincir işletme ya da çok noktalı kurulumlar için yıllık fiyat ve fatura seçeneklerini konuşalım.",
  },
  en: {
    title: "Pricing · QR Wait",
    heroTitle: "No subscription. Pay for the people who join.",
    heroText: "Every new queue entry uses 1 ticket. You buy tickets in packs and they never expire. When the season ends, you stop paying.",
    free: "Free",
    freePrice: "$0",
    freeNote: "Once, when you sign up. No credit card needed.",
    signup: "Sign up for free",
    tickets: (n) => `${n} tickets`,
    per1000: (p) => `${p} per 1000 tickets`,
    best: "Best value",
    buy: "Buy",
    once: "One-time payment",
    loading: "Loading packs…",
    loadFail: "Couldn't load packs. Please refresh the page.",
    noPackages: "Ticket packs are coming soon. For now, contact us for tickets.",
    ticketTitle: "What's a ticket?",
    ticketText: "Every new entry in your queues uses 1 ticket, whether they scanned the QR code or an attendant added them. A group is one ticket, however many people it has.",
    examples: [
      ["A family of 4 joins the queue", "1 ticket"],
      ["An attendant adds someone without a phone", "1 ticket"],
      ["The same phone reopens the page", "No ticket"],
      ["Someone checks the status page", "No ticket"],
    ],
    allTitle: "Everything in every pack",
    all: [
      "Up to 20 queues, each with its own address and status page",
      "Attendant panel in the browser, no installation",
      "Seat and table modes, flexible groups",
      "Location check and rotating QR code",
      "Phone notification when it's their turn",
      "Visitor pages in English, Turkish, German and Russian",
    ],
    faqTitle: "Questions",
    faq: [
      ["Do tickets expire?", "No. Tickets you buy stay usable as long as your account is open; they wait through the off-season."],
      ["What happens when I run out?", "Your queues stop accepting new people; existing entries aren't affected. We email you when the balance is low and when it runs out, and you can top up instantly in the admin panel."],
      ["How do I pay? Do I get an invoice?", "You pay by card on Lemon Squeezy's secure checkout. Lemon Squeezy is the merchant of record and emails you the invoice. Any applicable VAT or sales tax is shown at checkout. Prices are in US dollars (USD)."],
      ["Can I get a refund?", "A completely unused pack is refunded within 14 days of purchase. Partly used packs and free tickets aren't refundable."],
      ["Can I buy the same pack more than once?", "Yes. Tickets are added to your balance, so packs stack."],
    ],
    moreTitle: "Need more?",
    moreText: "For municipalities, chains or multi-site setups, let's talk about annual pricing and invoicing options.",
  },
  de: {
    title: "Preise · QR Wait",
    heroTitle: "Kein Abo. Sie zahlen für die, die sich anstellen.",
    heroText: "Jeder neue Eintrag in einer Warteschlange verbraucht 1 Ticket. Tickets kaufen Sie in Paketen, sie verfallen nie. Endet die Saison, zahlen Sie nichts weiter.",
    free: "Kostenlos",
    freePrice: "$0",
    freeNote: "Einmalig bei der Registrierung. Keine Kreditkarte nötig.",
    signup: "Kostenlos registrieren",
    tickets: (n) => `${n} Tickets`,
    per1000: (p) => `${p} pro 1000 Tickets`,
    best: "Bester Preis",
    buy: "Kaufen",
    once: "Einmalzahlung",
    loading: "Pakete werden geladen…",
    loadFail: "Pakete konnten nicht geladen werden. Bitte laden Sie die Seite neu.",
    noPackages: "Ticketpakete folgen bald. Kontaktieren Sie uns vorerst für Tickets.",
    ticketTitle: "Was ist ein Ticket?",
    ticketText: "Jeder neue Eintrag in Ihren Warteschlangen verbraucht 1 Ticket – egal ob per QR-Code oder vom Personal hinzugefügt. Eine Gruppe ist ein Ticket, egal wie groß sie ist.",
    examples: [
      ["Eine vierköpfige Familie stellt sich an", "1 Ticket"],
      ["Das Personal fügt jemanden ohne Handy hinzu", "1 Ticket"],
      ["Dasselbe Handy öffnet die Seite erneut", "Kein Ticket"],
      ["Jemand sieht sich die Statusseite an", "Kein Ticket"],
    ],
    allTitle: "Alles in jedem Paket",
    all: [
      "Bis zu 20 Warteschlangen, jede mit eigener Adresse und Statusseite",
      "Personal-Panel im Browser, ohne Installation",
      "Platz- und Tischmodus, flexible Gruppen",
      "Standortprüfung und wechselnder QR-Code",
      "Benachrichtigung aufs Handy, wenn man dran ist",
      "Besucherseiten auf Deutsch, Englisch, Türkisch und Russisch",
    ],
    faqTitle: "Häufige Fragen",
    faq: [
      ["Verfallen Tickets?", "Nein. Gekaufte Tickets bleiben nutzbar, solange Ihr Konto besteht; sie warten auch die Nebensaison ab."],
      ["Was passiert, wenn die Tickets aufgebraucht sind?", "Ihre Warteschlangen nehmen keine neuen Personen mehr auf; bestehende Einträge bleiben. Wir benachrichtigen Sie per E-Mail, wenn das Guthaben niedrig und wenn es aufgebraucht ist, und Sie können im Verwaltungsbereich sofort aufladen."],
      ["Wie bezahle ich, bekomme ich eine Rechnung?", "Sie zahlen per Karte über die sichere Kassenseite von Lemon Squeezy. Lemon Squeezy ist Verkäufer (Merchant of Record) und schickt Ihnen die Rechnung per E-Mail. Anfallende Mehrwert- oder Umsatzsteuer wird an der Kasse angezeigt. Preise in US-Dollar (USD)."],
      ["Gibt es eine Erstattung?", "Ein vollständig ungenutztes Paket wird innerhalb von 14 Tagen nach dem Kauf erstattet. Teilweise genutzte Pakete und kostenlose Tickets sind nicht erstattungsfähig."],
      ["Kann ich ein Paket mehrmals kaufen?", "Ja. Tickets werden Ihrem Guthaben gutgeschrieben, Pakete addieren sich."],
    ],
    moreTitle: "Sie brauchen mehr?",
    moreText: "Für Kommunen, Ketten oder Installationen an vielen Standorten sprechen wir gern über Jahrespreise und Rechnungsoptionen.",
  },
  ru: {
    title: "Цены · QR Wait",
    heroTitle: "Без подписки. Платите за тех, кто встал в очередь.",
    heroText: "Каждая новая запись в очереди — 1 билет. Билеты покупаются пакетами и не сгорают. Закончился сезон — вы больше не платите.",
    free: "Бесплатно",
    freePrice: "$0",
    freeNote: "Один раз при регистрации. Карта не нужна.",
    signup: "Зарегистрироваться бесплатно",
    tickets: (n) => `${n} билетов`,
    per1000: (p) => `${p} за 1000 билетов`,
    best: "Выгоднее всего",
    buy: "Купить",
    once: "Разовый платёж",
    loading: "Загрузка пакетов…",
    loadFail: "Не удалось загрузить пакеты. Обновите страницу.",
    noPackages: "Пакеты билетов скоро появятся. Пока напишите нам.",
    ticketTitle: "Что такое билет?",
    ticketText: "Каждая новая запись в ваших очередях расходует 1 билет — и по QR-коду, и добавленная сотрудником вручную. Группа — это один билет, сколько бы в ней ни было человек.",
    examples: [
      ["Семья из 4 человек встаёт в очередь", "1 билет"],
      ["Сотрудник добавляет человека без телефона", "1 билет"],
      ["Тот же телефон снова открывает страницу", "Без билета"],
      ["Кто-то смотрит страницу статуса", "Без билета"],
    ],
    allTitle: "В каждом пакете — всё",
    all: [
      "До 20 очередей, у каждой свой адрес и страница статуса",
      "Панель сотрудника в браузере, без установки",
      "Режимы мест и столов, гибкие группы",
      "Проверка местоположения и меняющийся QR-код",
      "Уведомление на телефон, когда подошла очередь",
      "Страницы для посетителей на русском, английском, немецком и турецком",
    ],
    faqTitle: "Частые вопросы",
    faq: [
      ["Билеты сгорают?", "Нет. Купленные билеты можно использовать, пока открыт ваш аккаунт; они дождутся следующего сезона."],
      ["Что будет, когда билеты закончатся?", "Очереди перестанут принимать новых людей, текущие записи сохранятся. Мы напишем на почту, когда баланс будет на исходе и когда он закончится; пополнить можно сразу в панели управления."],
      ["Как оплатить, будет ли счёт?", "Оплата картой на защищённой странице Lemon Squeezy. Продавцом выступает Lemon Squeezy, он присылает счёт на почту. Применимый НДС или налог с продаж показывается при оплате. Цены в долларах США (USD)."],
      ["Можно ли вернуть деньги?", "Полностью неиспользованный пакет возвращается в течение 14 дней после покупки. Частично использованные пакеты и бесплатные билеты не возвращаются."],
      ["Можно купить один пакет несколько раз?", "Да. Билеты добавляются к балансу, пакеты суммируются."],
    ],
    moreTitle: "Нужно больше?",
    moreText: "Для муниципалитетов, сетей и точек в нескольких местах обсудим годовые цены и варианты выставления счетов.",
  },
});
document.title = T.title;

const num = (n: number) => n.toLocaleString(lang);

function Plan({ name, sub, price, note, cta, href, best }: { name: string; sub?: string; price: string; note: string; cta: string; href: string; best?: boolean }) {
  return (
    <li className={cn("relative flex flex-col gap-1 rounded-[20px] border-2 p-6", best ? "border-ink bg-ticket" : "border-line bg-white")}>
      {best && <span className="absolute -top-3 left-6 rounded-full bg-ink px-3 py-0.5 text-sm font-semibold text-white">{T.best}</span>}
      <h3 className="text-xl font-semibold">{name}</h3>
      {sub && <p className="-mt-1 mb-1 font-semibold text-ink-soft">{sub}</p>}
      <p className="text-[2.75rem] leading-none font-extrabold tracking-[-0.03em] tabular-nums">{price}</p>
      <p className="mb-5 text-ink-soft">{note}</p>
      <Button asChild className={cn(pill, "mt-auto justify-center", best && solid)}><a href={href}>{cta}</a></Button>
    </li>
  );
}

function Plans() {
  const [cfg, setCfg] = useState<{ free: number; packages: Pkg[] } | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => { api("/api/config").then(setCfg, () => setFailed(true)); }, []);
  if (failed) return <p className="font-semibold text-destructive">{T.loadFail}</p>;
  if (!cfg) return <p className="text-ink-soft">{T.loading}</p>;
  // 1000 bilet başı en ucuz paket vurgulanır
  const unit = (p: Pkg) => { const n = perThousand(p); return n ? Number(n.slice(1)) : Infinity; };
  const best = cfg.packages.length > 1 ? cfg.packages.reduce((a, b) => (unit(b) < unit(a) ? b : a)) : null;
  return (
    <>
      <ul className="m-0 grid list-none gap-4 p-0 sm:grid-cols-2 lg:grid-cols-5">
        <Plan name={T.free} sub={T.tickets(num(cfg.free))} price={T.freePrice} note={T.freeNote} cta={T.signup} href="/admin#signup" />
        {cfg.packages.map((p) => {
          const u = perThousand(p), name = packName(p), tickets = T.tickets(num(p.tickets));
          return <Plan key={p.variant} name={name ?? tickets} sub={name ? tickets : undefined} price={p.price} note={u ? `${T.per1000(u)}. ${T.once}.` : `${T.once}.`}
            cta={T.buy} href="/admin#bilet" best={p === best} />;
        })}
      </ul>
      {!cfg.packages.length && <p className="mt-4 text-ink-soft">{T.noPackages}</p>}
    </>
  );
}

function PricingPage() {
  return (
    <Site>
      <div className="pt-12 pb-12 md:pb-16">
        <h1 className="mb-6 max-w-[18ch] text-[clamp(2.5rem,6vw,4.25rem)] leading-[1.02] font-extrabold tracking-[-0.035em]">{T.heroTitle}</h1>
        <p className="mb-12 max-w-[46ch] text-xl text-ink-soft">{T.heroText}</p>
        <Plans />
      </div>

      <Section>
        <div className="grid items-start gap-10 md:grid-cols-2 md:gap-12">
          <div>
            <H2 className="mb-4">{T.ticketTitle}</H2>
            <p className="text-ink-soft">{T.ticketText}</p>
          </div>
          <dl className="m-0 border-t border-line">
            {T.examples.map(([t, d]) => (
              <div key={t} className="flex items-baseline justify-between gap-4 border-b border-line py-4">
                <dt>{t}</dt>
                <dd className="m-0 font-semibold whitespace-nowrap">{d}</dd>
              </div>
            ))}
          </dl>
        </div>
      </Section>

      <Section>
        <H2>{T.allTitle}</H2>
        <ul className="m-0 grid list-none gap-x-12 gap-y-4 p-0 md:grid-cols-2">
          {T.all.map((x) => <li key={x} className="flex gap-3"><CheckIcon aria-hidden="true" className="mt-1 size-5 shrink-0 text-success" />{x}</li>)}
        </ul>
      </Section>

      <Section>
        <H2>{T.faqTitle}</H2>
        <dl className="m-0 grid md:grid-cols-2 md:gap-x-12">
          {T.faq.map(([q, a]) => (
            <div key={q} className="border-b border-line py-5">
              <dt className="text-[1.15rem] font-semibold">{q}</dt>
              <dd className="mt-1 text-ink-soft">{a}</dd>
            </div>
          ))}
        </dl>
      </Section>

      <section className="mt-10 mb-20 rounded-[20px] bg-ink px-6 py-10 text-white md:rounded-[28px] md:px-12 md:py-16">
        <H2 className="mb-4">{T.moreTitle}</H2>
        <p className="mb-8 max-w-[46ch] text-[1.15rem] text-[#C9D2E3]">{T.moreText}</p>
        <a className="inline-block text-[clamp(1.4rem,4vw,2.4rem)] font-extrabold tracking-[-0.02em] break-all text-ticket underline decoration-3 underline-offset-6" href={`mailto:${EMAIL}`}>{EMAIL}</a>
      </section>
    </Site>
  );
}

mount(<PricingPage />);
