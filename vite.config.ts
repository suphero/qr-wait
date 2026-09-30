import { resolve } from "node:path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";

const web = resolve(import.meta.dirname, "web");

// Sayfalar: her biri web/src/pages/<ad>.tsx'i yükleyen bir HTML'e derlenir (dist/<ad>.html).
// HTML dosyası repoda yok; başlık ve <head> ekleri burada.
const PAGES: Record<string, { title: string; head?: string; body?: string }> = {
  home: {
    title: "Sıran Geldi · Uygulamasız sıra sistemi",
    head: `<meta name="description" content="Plajlar, iskeleler, hizmet noktaları ve etkinlikler için QR kodlu sıra sistemi. Uygulama indirmeden sıraya gir, sıran gelince telefonun haber versin.">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,400;12..96,600;12..96,800&display=swap" rel="stylesheet">`,
    body: "bg-paper",
  },
  join: { title: "Sıran Geldi", head: `<link rel="manifest" href="/manifest.json">\n<meta name="theme-color" content="#1B2A4A">` },
  host: { title: "Görevli Paneli" },
  status: { title: "Sıra durumu" },
  admin: { title: "Sıran Geldi · Yönetim" },
  privacy: { title: "Gizlilik · Sıran Geldi" },
  terms: { title: "Kullanım Koşulları · Sıran Geldi" },
};

const html = (name: string) => {
  const p = PAGES[name];
  return `<!doctype html>
<html lang="tr">
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
<script type="module" src="/src/pages/${name}.tsx"></script>
</body>
</html>
`;
};

const entry = (name: string) => resolve(web, `${name}.html`);
const pageOf = (id: string) => Object.keys(PAGES).find((n) => entry(n) === id);

// HTML'leri bellekte üretir. Geliştirmede Worker'ın yaptığını da taklit eder: "/join" → join, "/" → home
// (üretimde bu yönlendirmeyi Cloudflare Assets ve src/index.js yapar)
const pages = (): Plugin => ({
  name: "pages",
  enforce: "pre",
  resolveId: (id) => (pageOf(id) ? id : undefined),
  load: (id) => { const n = pageOf(id); return n && html(n); },
  configureServer(server) {
    server.middlewares.use(async (req, res, next) => {
      const url = req.url ?? "/", path = url.split("?")[0].replace(/\.html$/, "");
      const name = path === "/" ? "home" : path.slice(1);
      if (!PAGES[name]) return next();
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
