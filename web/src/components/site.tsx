import type { ReactNode } from "react";
import { LEGAL } from "@/components/legal";
import { Button } from "@/components/ui/button";
import { LangSwitch } from "@/components/lang";
import { pick, sitePath } from "@/lib/i18n";
import { cn } from "@/lib/utils";

// Tanıtım sitesinin (pages/home.tsx, pages/pricing.tsx, pages/usecase.tsx) ortak kabuğu: başlık, alt bilgi, bölüm ve buton stilleri.
// Bu sayfaların HTML'i vite.config.ts'te Bricolage Grotesque yazı tipini yükler ve body'ye bg-paper verir.
export const SITE = pick({
  tr: { admin: "Yönetici girişi", pricing: "Fiyatlar" },
  en: { admin: "Admin login", pricing: "Pricing" },
  de: { admin: "Admin-Anmeldung", pricing: "Preise" },
  ru: { admin: "Вход для администратора", pricing: "Цены" },
});

// Kullanım senaryosu sayfaları (pages/usecase.tsx): adres ve bu dildeki adı. Her sayfanın alt bilgisinden bağlanır.
export type Use = "restaurant-waitlist" | "beach-queue" | "event-queue" | "service-desk-queue";
export const USES = pick<[Use, string][]>({
  tr: [["restaurant-waitlist", "Restoran bekleme listesi"], ["beach-queue", "Plaj ve havuz sırası"], ["event-queue", "Etkinlik giriş sırası"], ["service-desk-queue", "Hizmet noktası sırası"]],
  en: [["restaurant-waitlist", "Restaurant waitlist"], ["beach-queue", "Beach & pool queue"], ["event-queue", "Event entry queue"], ["service-desk-queue", "Service desk queue"]],
  de: [["restaurant-waitlist", "Restaurant-Warteliste"], ["beach-queue", "Strand & Pool"], ["event-queue", "Einlass bei Events"], ["service-desk-queue", "Schalter & Praxen"]],
  ru: [["restaurant-waitlist", "Лист ожидания для ресторана"], ["beach-queue", "Пляж и бассейн"], ["event-queue", "Вход на мероприятие"], ["service-desk-queue", "Пункт обслуживания"]],
});

// Hap biçimli lacivert kenarlı butonlar
export const pill = "h-auto rounded-full border-2 border-ink bg-transparent px-5 py-3.5 text-base leading-none font-semibold text-ink hover:bg-ink/5";
export const solid = "bg-ink text-white hover:bg-ink/90";

export function Section({ id, className, children }: { id?: string; className?: string; children: ReactNode }) {
  return <section id={id} className={cn("border-t border-line py-14 md:py-20", className)}>{children}</section>;
}
export function H2({ className, children }: { className?: string; children: ReactNode }) {
  return <h2 className={cn("mb-10 max-w-[20ch] text-[clamp(1.9rem,4vw,2.75rem)] leading-[1.1] font-extrabold tracking-[-0.03em]", className)}>{children}</h2>;
}

export function Site({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto max-w-[1080px] px-5 font-display text-[1.0625rem] leading-relaxed text-ink [font-optical-sizing:auto] [&_:focus-visible]:rounded [&_:focus-visible]:outline-3 [&_:focus-visible]:outline-offset-3 [&_:focus-visible]:outline-success">
      <header className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 py-5">
        <a className="text-[1.35rem] font-extrabold tracking-[-0.02em] no-underline" href={sitePath("/")}>
          qrwait<span aria-hidden="true" className="ml-[.12em] inline-block size-[.5em] rounded-full bg-success" />
        </a>
        <nav className="flex items-center gap-4">
          <a href={sitePath("/pricing")} className="font-semibold whitespace-nowrap no-underline hover:underline">{SITE.pricing}</a>
          <Button asChild className={cn(pill, "px-4 py-2.5 text-[.95rem]")}><a href="/admin">{SITE.admin}</a></Button>
        </nav>
      </header>

      <main>{children}</main>

      <footer className="flex flex-wrap justify-between gap-4 pt-6 pb-10 text-[.95rem] text-ink-soft">
        <nav className="flex w-full flex-wrap gap-x-4 gap-y-2">
          {USES.map(([u, name]) => <a key={u} href={sitePath(`/${u}`)} className="underline">{name}</a>)}
        </nav>
        <span>© 2026 QRWait</span>
        <span className="flex flex-wrap gap-4">
          <a href={sitePath("/pricing")} className="underline">{SITE.pricing}</a>
          <a href={sitePath("/privacy")} className="underline">{LEGAL.privacyShort}</a>
          <a href={sitePath("/terms")} className="underline">{LEGAL.terms}</a>
          <a href="/admin" className="underline">{SITE.admin}</a>
          <LangSwitch />
        </span>
      </footer>
    </div>
  );
}
