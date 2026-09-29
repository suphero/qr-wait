import L from "leaflet";
import "leaflet/dist/leaflet.css";
import icon from "leaflet/dist/images/marker-icon.png";
import icon2x from "leaflet/dist/images/marker-icon-2x.png";
import shadow from "leaflet/dist/images/marker-shadow.png";

// Paketleyici altında Leaflet varsayılan işaretçi görsellerini CSS yolundan bulamaz
L.Icon.Default.mergeOptions({ iconUrl: icon, iconRetinaUrl: icon2x, shadowUrl: shadow });

export function baseMap(el: HTMLElement, opts: L.MapOptions = {}) {
  const map = L.map(el, opts);
  L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution: "© OpenStreetMap" }).addTo(map);
  return map;
}

// Haversine mesafesi, metre
export function meters(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const t = Math.PI / 180, h = Math.sin((b.lat - a.lat) * t / 2) ** 2 + Math.cos(a.lat * t) * Math.cos(b.lat * t) * Math.sin((b.lng - a.lng) * t / 2) ** 2;
  return 2 * 6371e3 * Math.asin(Math.sqrt(h));
}

export const fmtDist = (m: number) => (m < 1000 ? `${Math.max(10, Math.round(m / 10) * 10)} m` : `${(m / 1000).toFixed(1).replace(".", ",")} km`);

export { L };
