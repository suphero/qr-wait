import { resolve } from "node:path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";
import { langPath, pagePath, SEO, SITE_LANGS, USE_PAGES, type SitePage } from "./web/src/lib/seo";

const web = resolve(import.meta.dirname, "web");

// Sayfalar: her biri web/src/pages/<ad>.tsx'i yükleyen bir HTML'e derlenir (dist/<ad>.html).
// HTML dosyası repoda yok; başlık ve <head> ekleri burada.
// Tanıtım sitesi sayfalarının yazı tipi (components/site.tsx)
const FONT = `<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,400;12..96,600;12..96,800&display=swap" rel="stylesheet">`;
// Arama motoru ve link önizlemesi (WhatsApp, X, LinkedIn) etiketleri; yalnızca ana alan adındaki tanıtım sayfaları
const SITE = "https://qrwait.app";
const seo = (path: string, title: string, description: string) => `<meta name="description" content="${description}">
<link rel="canonical" href="${SITE}${path}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="QRWait">
<meta property="og:url" content="${SITE}${path}">
<meta property="og:title" content="${title}">
<meta property="og:description" content="${description}">
<meta property="og:image" content="${SITE}/og.png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">`;
// Panel, sıraya giriş ve sıra durumu sayfaları dizine girmesin (her sıranın sayfası ince ve geçici içerik)
const NOINDEX = `<meta name="robots" content="noindex">`;
// Ana sayfa için yapılandırılmış veri: Google'a ürünün ne olduğunu ve ücretsiz başlangıcı anlatır
const LD = `<script type="application/ld+json">${JSON.stringify({
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "QRWait",
  url: SITE,
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web",
  description: "Virtual queue with a QR code, no app. Visitors scan, join and get notified when it's their turn.",
  inLanguage: ["tr", "en", "de", "ru"],
  offers: { "@type": "Offer", price: "0", priceCurrency: "USD", description: "First 1000 tickets free" },
})}</script>`;
// Dillerin birbirine bağlanması: Google her dilin kendi adresini bilir, x-default İngilizce kök
const alternates = (path: string) => [
  ...SITE_LANGS.map((l) => `<link rel="alternate" hreflang="${l}" href="${SITE}${langPath(l, path)}">`),
  `<link rel="alternate" hreflang="x-default" href="${SITE}${path}">`,
].join("\n");
const APP: Record<string, Page> = {
  join: { title: "QRWait", head: `<link rel="manifest" href="/manifest.json">\n<meta name="theme-color" content="#1B2A4A">\n${NOINDEX}` },
  host: { title: "Attendant panel", head: NOINDEX },
  status: { title: "Queue status", head: NOINDEX },
  admin: { title: "QRWait · Admin", head: NOINDEX },
};
// Tanıtım sitesi: her dil ve sayfa için ayrı HTML. İngilizce kökte (pricing.html → /pricing, ana sayfa home.html → / Worker'da),
// diğer diller klasörde (tr/pricing.html → /tr/pricing, tr/index.html → /tr/). Senaryo sayfaları pages/usecase.tsx'i yükler.
// data-site: sayfanın dili adresten gelir (lib/i18n.ts), telefonun dilinden değil
type Page = { title: string; head?: string; body?: string; src?: string; lang?: string };
const sitePage = (l: (typeof SITE_LANGS)[number], p: SitePage): Page => {
  const [title, desc] = SEO[l][p], path = pagePath(p), legal = p === "privacy" || p === "terms";
  return {
    title, lang: l, src: (USE_PAGES as readonly string[]).includes(p) ? "usecase" : p, body: legal ? undefined : "bg-paper",
    head: [seo(langPath(l, path), title, desc), alternates(path), p === "home" && LD, !legal && FONT].filter(Boolean).join("\n"),
  };
};
const PAGES: Record<string, Page> = {
  ...APP,
  ...Object.fromEntries(SITE_LANGS.flatMap((l) => (Object.keys(SEO[l]) as SitePage[]).map((p) =>
    [l === "en" ? p : `${l}/${p === "home" ? "index" : p}`, sitePage(l, p)]))),
};

// Site haritası: tanıtım sayfalarının her dildeki adresi, dil karşılıklarıyla (derlemede dist/sitemap.xml)
const sitemap = () => `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${(Object.keys(SEO.en) as SitePage[]).flatMap((p) => SITE_LANGS.map((l) => `  <url><loc>${SITE}${langPath(l, pagePath(p))}</loc>
${SITE_LANGS.map((a) => `    <xhtml:link rel="alternate" hreflang="${a}" href="${SITE}${langPath(a, pagePath(p))}"/>`).join("\n")}
  </url>`)).join("\n")}
</urlset>
`;

const html = (name: string) => {
  const p = PAGES[name];
  return `<!doctype html>
<html lang="${p.lang ?? "en"}"${p.lang ? " data-site" : ""}>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<link rel="icon" href="/icons/icon.svg" type="image/svg+xml">
<link rel="icon" href="/icons/icon-32.png" sizes="32x32">
<link rel="apple-touch-icon" href="/icons/apple-touch-icon.png">
${p.head ? `${p.head}\n` : ""}<title>${p.title}</title>
</head>
<body${p.body ? ` class="${p.body}"` : ""}>
<div id="root"></div>
<script type="module" src="/src/pages/${p.src ?? name}.tsx"></script>
</body>
</html>
`;
};

const entry = (name: string) => resolve(web, `${name}.html`);
const pageOf = (id: string) => Object.keys(PAGES).find((n) => entry(n) === id);

// HTML'leri bellekte üretir. Geliştirmede Worker'ın yaptığını da taklit eder: "/join" → join, "/" → home, "/tr/" → tr/index
// (üretimde bu yönlendirmeyi Cloudflare Assets ve src/index.js yapar)
const pages = (): Plugin => ({
  name: "pages",
  enforce: "pre",
  resolveId: (id) => (pageOf(id) ? id : undefined),
  load: (id) => { const n = pageOf(id); return n && html(n); },
  generateBundle() { this.emitFile({ type: "asset", fileName: "sitemap.xml", source: sitemap() }); },
  configureServer(server) {
    server.middlewares.use(async (req, res, next) => {
      const url = req.url ?? "/", path = url.split("?")[0].replace(/\.html$/, "");
      const name = [path === "/" ? "home" : path.slice(1), `${path.slice(1).replace(/\/$/, "")}/index`].find((n) => PAGES[n]);
      if (!name) return next();
      res.setHeader("content-type", "text/html; charset=utf-8");
      res.end(await server.transformIndexHtml(url, html(name)));
    });
  },
});

export default defineConfig({
  root: web,
  plugins: [react(), tailwindcss(), pages()],
  resolve: { alias: { "@": resolve(web, "src") } },
  build: {
    outDir: resolve(import.meta.dirname, "dist"),
    emptyOutDir: true,
    rollupOptions: { input: Object.fromEntries(Object.keys(PAGES).map((n) => [n, entry(n)])) },
  },
  // `npm run dev:ui`: arayüz Vite'tan (anında yenileme), API `npm run dev` ile açık Worker'dan
  server: { proxy: { "/api": "http://localhost:8787" } },
});
