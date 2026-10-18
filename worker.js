/**
 * Cloudflare Worker — secure OANDA candle proxy for SEBU DOLLAR ANALYZER
 * Set secrets in Worker settings:
 *   OANDA_TOKEN = personal access token from OANDA
 * Optional vars:
 *   OANDA_ENV = "practice" or "live" (default "live")
 *
 * Deploy this Worker, then set CONFIG.OANDA_PROXY_URL in index.html to its URL.
 * Never commit the token or paste it into index.html.
 */
export default {
  async fetch(request, env) {
    const cors = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store"
    };
    if (request.method === "OPTIONS") return new Response(null, { headers: cors });
    if (request.method !== "GET") return json({ error: "Method not allowed" }, 405, cors);
    if (!env.OANDA_TOKEN) return json({ error: "OANDA_TOKEN belum disetel pada Worker secret." }, 500, cors);

    const incoming = new URL(request.url);
    const allowed = new Set(["M5", "M15", "M30", "H1", "H4"]);
    const granularity = incoming.searchParams.get("granularity") || "M30";
    const count = Math.min(300, Math.max(30, Number(incoming.searchParams.get("count") || 180)));
    if (!allowed.has(granularity)) return json({ error: "Timeframe tidak didukung." }, 400, cors);

    const envName = (env.OANDA_ENV || "live").toLowerCase();
    const host = envName === "practice" ? "https://api-fxpractice.oanda.com" : "https://api-fxtrade.oanda.com";
    // OANDA commonly identifies spot gold as XAU_USD, but instrument availability depends on account/region.
    const instrument = env.OANDA_INSTRUMENT || "XAU_USD";
    const endpoint = `${host}/v3/instruments/${encodeURIComponent(instrument)}/candles?granularity=${granularity}&count=${count}&price=M`;
    try {
      const upstream = await fetch(endpoint, {
        headers: { "Authorization": `Bearer ${env.OANDA_TOKEN}`, "Accept": "application/json" }
      });
      const payload = await upstream.json();
      if (!upstream.ok) {
        return json({ error: payload?.errorMessage || `OANDA API error ${upstream.status}`, instrument, granularity }, upstream.status, cors);
      }
      const candles = (payload.candles || []).filter(c => c.complete).map(c => ({
        time: c.time,
        open: Number(c.mid.o),
        high: Number(c.mid.h),
        low: Number(c.mid.l),
        close: Number(c.mid.c)
      })).filter(c => Object.values(c).every(v => typeof v === "string" || Number.isFinite(v)));
      return json({ instrument, granularity, count: candles.length, candles }, 200, cors);
    } catch (err) {
      return json({ error: "Tidak dapat terhubung ke OANDA.", detail: String(err) }, 502, cors);
    }
  }
};
function json(data, status, headers) {
  return new Response(JSON.stringify(data), { status, headers });
}
