import { StrictMode, useState, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { ConfirmProvider } from "@/components/confirm";
import { siteUrl } from "@/components/legal";
import { Button } from "@/components/ui/button";
import { pick } from "@/lib/i18n";
import "@/index.css";

// Google Analytics (GA4) — tüm sayfalar mount() ile açıldığı için tek yerden.
// Çerez bıraktığı için yalnızca ziyaretçi izin verirse yüklenir (KVKK açık rıza, GDPR); karar localStorage "consent"ta.
const GA_ID = "G-BPEZ8M7B76";
const consent = () => { try { return localStorage.getItem("consent"); } catch { return null; } };

function loadGA() {
  if (GA_ID.includes("X") || location.hostname === "localhost") return;
  const s = document.createElement("script");
  s.async = true;
  s.src = `https://www.googletagmanager.com/gtag/js?id=${GA_ID}`;
  document.head.append(s);
  const w = window as any;
  w.dataLayer = w.dataLayer || [];
  w.gtag = function () { w.dataLayer.push(arguments); };
  w.gtag("js", new Date());
  w.gtag("config", GA_ID);
}
if (consent() === "yes") loadGA();

const C = pick({
  tr: { text: "Siteyi geliştirmek için Google Analytics çerezleriyle anonim kullanım istatistikleri toplamak istiyoruz.", yes: "Kabul et", no: "Reddet", more: "Ayrıntılar" },
  en: { text: "We'd like to use Google Analytics cookies to collect anonymous usage statistics and improve the site.", yes: "Accept", no: "Decline", more: "Details" },
  de: { text: "Wir möchten Google-Analytics-Cookies verwenden, um anonyme Nutzungsstatistiken zu erheben und die Website zu verbessern.", yes: "Akzeptieren", no: "Ablehnen", more: "Details" },
  ru: { text: "Мы хотим использовать файлы cookie Google Analytics для сбора анонимной статистики и улучшения сайта.", yes: "Принять", no: "Отклонить", more: "Подробнее" },
});

function Consent() {
  const [open, setOpen] = useState(consent() === null);
  if (!open) return null;
  const choose = (v: "yes" | "no") => {
    try { localStorage.setItem("consent", v); } catch {}
    setOpen(false);
    if (v === "yes") loadGA();
  };
  return (
    <div role="dialog" aria-label="Çerez" className="fixed inset-x-0 bottom-0 z-[1000] border-t bg-background/95 p-3 text-sm shadow-lg backdrop-blur">
      <div className="mx-auto flex max-w-3xl flex-wrap items-center gap-2">
        <p className="min-w-60 flex-1">{C.text} <a className="underline" href={siteUrl("/privacy")}>{C.more}</a></p>
        <Button size="sm" variant="secondary" onClick={() => choose("no")}>{C.no}</Button>
        <Button size="sm" onClick={() => choose("yes")}>{C.yes}</Button>
      </div>
    </div>
  );
}

export function mount(page: ReactNode) {
  createRoot(document.getElementById("root")!).render(
    <StrictMode><ConfirmProvider>{page}</ConfirmProvider><Consent /></StrictMode>,
  );
}
