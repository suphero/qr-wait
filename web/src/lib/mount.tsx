import { StrictMode, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { ConfirmProvider } from "@/components/confirm";
import "@/index.css";

// Google Analytics (GA4) — tüm sayfalar mount() ile açıldığı için tek yerden
const GA_ID = "G-BPEZ8M7B76";
if (!GA_ID.includes("X") && location.hostname !== "localhost") {
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

export function mount(page: ReactNode) {
  createRoot(document.getElementById("root")!).render(
    <StrictMode><ConfirmProvider>{page}</ConfirmProvider></StrictMode>,
  );
}
