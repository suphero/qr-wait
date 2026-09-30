// Bilet hakkı ve ödeme. Her yeni bilet (QR ile giriş ya da görevlinin elle eklemesi) sıra sahibinin bakiyesinden 1 düşer.
// Hesap açan kullanıcıya FREE bilet ücretsiz; üstü Lemon Squeezy'den tek seferlik paketlerle alınır, kredi bitmez.
// Paketler wrangler.jsonc'ta PACKAGES: [{ variant: "<Lemon Squeezy varyant id>", tickets: 5000, price: "$9" }].
// price yalnızca gösterim; tahsil edilen tutar Lemon Squeezy'deki varyant fiyatıdır.
import { DurableObject } from "cloudflare:workers";
import { fail } from "./i18n.js";
import { mail } from "./mail.js";
import { hmacHex, same } from "./util.js";

export const FREE = 1000;
const LOW = 100; // kalan hak bu sayıya inince sahibine e-posta

// .dev.vars'ta değerler metin olduğundan JSON metni de kabul edilir
export function packages(env) {
  let list = env.PACKAGES;
  try { if (typeof list === "string") list = JSON.parse(list); } catch { list = []; }
  return (Array.isArray(list) ? list : []).map((p) => ({ variant: String(p.variant), tickets: Number(p.tickets), price: String(p.price ?? "") }))
    .filter((p) => p.variant && p.tickets > 0);
}

// Kullanıcı başına bir DO (ACCOUNT.getByName(<kullanıcı>)): bakiye ve siparişler. Oda her yeni bilette spend() çağırır;
// tek Registry sıcak yola girmez. Yeni hesap sayaçlı başlar (bir adım yarıda kalırsa kimse bedava sınırsız kalmasın);
// süper yöneticinin açtığı ve bilet hakkından önceki kullanıcılar açıkça sınırsız yapılır (metered: false).
export class Account extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    ctx.blockConcurrencyWhile(async () => {
      this.a = (await ctx.storage.get("a")) ?? { metered: true, used: 0, bought: 0, granted: 0, orders: {} };
    });
  }

  save() { return this.ctx.storage.put("a", this.a); }
  left() { return FREE + this.a.bought + this.a.granted - this.a.used; }

  // metered, suspended, email, lang, user
  async set(fields) {
    Object.assign(this.a, fields);
    await this.save();
  }

  balance() {
    const a = this.a;
    return {
      metered: a.metered, suspended: !!a.suspended, used: a.used, free: FREE, bought: a.bought, granted: a.granted,
      left: a.metered ? this.left() : null,
      orders: Object.entries(a.orders).map(([id, o]) => ({ id, ...o })).sort((x, y) => y.at - x.at),
    };
  }

  async spend() {
    const a = this.a;
    if (a.suspended) throw fail("suspended");
    if (a.metered && this.left() <= 0) throw fail("quota");
    a.used++;
    await this.save();
    const n = this.left();
    if (a.metered && a.email && (n === LOW || n === 0)) {
      // Sayfa isteğini bozmasın; eşik tam bu bilette geçildiği için her eşikte bir kez gider
      await mail(this.env, { to: a.email, lang: a.lang, kind: n ? "low" : "empty", user: a.user, link: `https://${this.env.BASE_DOMAIN}/admin#bilet`, n })
        .catch((e) => console.error("mail", e.message));
    }
  }

  // Süper yöneticinin elle verdiği (eksi: geri aldığı) hak
  async grant(n) {
    this.a.granted += n;
    await this.save();
  }

  // Lemon Squeezy siparişi; aynı webhook tekrar gelirse ikinci kez yüklenmez. İade edilen sipariş hakkı geri alır.
  async order(id, tickets, status, total) {
    const o = this.a.orders[id];
    if (status === "paid" && !o) {
      this.a.orders[id] = { tickets, status, total, at: Date.now() };
      this.a.bought += tickets;
    } else if (status === "refunded" && o?.status === "paid") {
      o.status = "refunded";
      this.a.bought -= o.tickets;
    } else return;
    await this.save();
  }

  async destroy() {
    await this.ctx.storage.deleteAll();
    this.a = { metered: true, used: 0, bought: 0, granted: 0, orders: {} };
  }
}

// Lemon Squeezy ödeme sayfası; custom.user webhook'ta bakiyenin yükleneceği hesabı söyler
export async function checkout(env, origin, user, email, variant) {
  const p = packages(env).find((x) => x.variant === String(variant));
  if (!p || !env.LEMON_API_KEY || !env.LEMON_STORE_ID) throw fail("payOff");
  const r = await fetch("https://api.lemonsqueezy.com/v1/checkouts", {
    method: "POST",
    headers: { accept: "application/vnd.api+json", "content-type": "application/vnd.api+json", authorization: `Bearer ${env.LEMON_API_KEY}` },
    body: JSON.stringify({
      data: {
        type: "checkouts",
        attributes: {
          checkout_data: { email: email ?? undefined, custom: { user } },
          product_options: { redirect_url: `${origin}/admin?paid=1` },
        },
        relationships: {
          store: { data: { type: "stores", id: String(env.LEMON_STORE_ID) } },
          variant: { data: { type: "variants", id: p.variant } },
        },
      },
    }),
  });
  if (!r.ok) {
    console.error("lemon checkout", r.status, (await r.text()).slice(0, 300));
    throw fail("payDown");
  }
  return (await r.json()).data.attributes.url;
}

// POST /api/lemon: X-Signature = ham gövdenin HMAC-SHA256'sı (LEMON_WEBHOOK_SECRET). Bakiyeyi yalnızca imzalı istek değiştirir;
// kaç bilet yükleneceği gövdedeki tutardan değil varyant id'sinden (PACKAGES) okunur.
// Test modu siparişleri LEMON_TEST=1 değilse yok sayılır. 2xx dışı yanıtta Lemon Squeezy yeniden dener.
export async function webhook(req, env) {
  const raw = await req.text();
  if (!env.LEMON_WEBHOOK_SECRET || !same(req.headers.get("x-signature") ?? "", await hmacHex(env.LEMON_WEBHOOK_SECRET, raw)))
    return new Response("invalid signature", { status: 401 });
  const { meta, data } = JSON.parse(raw);
  const ev = meta?.event_name, user = meta?.custom_data?.user;
  if (!["order_created", "order_refunded"].includes(ev) || !user) return new Response("ignored");
  if (meta.test_mode && env.LEMON_TEST !== "1") return new Response("test mode ignored");
  const a = data.attributes, item = a.first_order_item ?? {};
  const p = packages(env).find((x) => x.variant === String(item.variant_id));
  if (!p) {
    console.error("lemon webhook: bilinmeyen varyant", item.variant_id, data.id);
    return new Response("unknown variant");
  }
  const status = a.status === "refunded" ? "refunded" : a.status === "paid" ? "paid" : null;
  if (status) await env.ACCOUNT.getByName(String(user)).order(String(data.id), p.tickets * (Number(item.quantity) || 1), status, a.total_formatted ?? "");
  return new Response("ok");
}
