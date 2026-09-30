import type { ReactNode } from "react";
import { Page } from "@/components/page";
import { pick } from "@/lib/i18n";

// Yasal metinler (pages/privacy.tsx, pages/terms.tsx): tarayıcı dilinde, tr/en/de/ru.
// Metin değişince UPDATED ve TERMS_VERSION güncellenir; hesap açarken kabul edilen sürüm kullanıcı kaydında saklanır.
export const EMAIL = "hello@qrwait.app";
export const TERMS_VERSION = "2026-09-30";
const UPDATED = new Date(`${TERMS_VERSION}T12:00:00Z`);

// Kullanıcı adresinde (antalyabb.qrwait.app) yasal sayfalar ana alan adındadır
const base = location.hostname.split(".").slice(1).join(".");
export const siteUrl = (path: string) => (base.includes(".") ? `https://${base}${path}` : path);

export const Mail = () => <a href={`mailto:${EMAIL}`}>{EMAIL}</a>;

// Bağlantı adları: sayfa başlıkları ve diğer sayfalardaki alt bağlantılar
export const LEGAL = pick({
  tr: { privacy: "Gizlilik Politikası ve KVKK Aydınlatma Metni", privacyShort: "Gizlilik", terms: "Kullanım Koşulları", updated: "Son güncelleme", lang: "tr-TR" },
  en: { privacy: "Privacy Policy", privacyShort: "Privacy", terms: "Terms of Use", updated: "Last updated", lang: "en-GB" },
  de: { privacy: "Datenschutzerklärung", privacyShort: "Datenschutz", terms: "Nutzungsbedingungen", updated: "Zuletzt aktualisiert", lang: "de-DE" },
  ru: { privacy: "Политика конфиденциальности", privacyShort: "Конфиденциальность", terms: "Условия использования", updated: "Последнее обновление", lang: "ru-RU" },
});

// Bölüm: başlık + paragraf ya da madde listesi
export type Section = { h: string; p?: ReactNode[]; ul?: ReactNode[] };

export function LegalPage({ title, sections }: { title: string; sections: Section[] }) {
  document.title = `${title} · QRWait`;
  return (
    <Page className="max-w-3xl leading-relaxed [&_a]:underline [&_h2]:mt-6 [&_h2]:text-xl [&_h2]:font-semibold [&_li]:mt-1 [&_ul]:list-disc [&_ul]:pl-6">
      <p className="mt-3 text-sm"><a href={siteUrl("/")}>← QRWait</a></p>
      <h1 className="text-3xl font-bold text-primary">{title}</h1>
      <p className="text-sm text-muted-foreground">{LEGAL.updated}: {UPDATED.toLocaleDateString(LEGAL.lang, { dateStyle: "long" })}</p>
      {sections.map((s, i) => (
        <section key={s.h}>
          <h2>{i + 1}. {s.h}</h2>
          {s.p?.map((x, j) => <p key={j} className="mt-2">{x}</p>)}
          {s.ul && <ul>{s.ul.map((x, j) => <li key={j}>{x}</li>)}</ul>}
        </section>
      ))}
      <p className="mt-8 text-sm text-muted-foreground">
        <a href={siteUrl("/privacy")}>{LEGAL.privacy}</a> · <a href={siteUrl("/terms")}>{LEGAL.terms}</a>
      </p>
    </Page>
  );
}
