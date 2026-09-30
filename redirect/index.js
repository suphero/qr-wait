// Eski alan adı: sirangeldi.com ve alt alan adları, aynı alt alan adı, yol ve sorguyla kalıcı olarak qrwait.app'e yönlenir
// (antalyabb.sirangeldi.com/bambus?x → antalyabb.qrwait.app/bambus?x). Hash tarayıcıda korunur.
const FROM = "sirangeldi.com", TO = "qrwait.app";

export default {
  fetch(req) {
    const url = new URL(req.url);
    url.hostname = url.hostname.slice(0, -FROM.length) + TO;
    url.protocol = "https:";
    url.port = "";
    return Response.redirect(url, 301);
  },
};
