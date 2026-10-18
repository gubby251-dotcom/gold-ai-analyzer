/**
 * Cloudflare Worker backend for SEBU DOLLAR ANALYZER.
 * Secrets (Cloudflare Worker > Settings > Variables and Secrets):
 *   OPENAI_API_KEY (required for POST /vision)
 *   OANDA_TOKEN (required to add multi-timeframe OANDA candles to vision analysis)
 * Optional plain-text variables:
 *   OANDA_ENV = live | practice (default live)
 *   OANDA_INSTRUMENT = XAU_USD (default XAU_USD)
 *   ALLOWED_ORIGIN = https://YOUR-USERNAME.github.io (recommended)
 * Never put secret values in index.html or commit them to GitHub.
 */
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = request.headers.get("Origin") || "";
    const allowedOrigin = env.ALLOWED_ORIGIN || "*";
    const corsOrigin = allowedOrigin === "*" || origin === allowedOrigin ? (allowedOrigin === "*" ? "*" : origin) : "null";
    const cors = {
      "Access-Control-Allow-Origin": corsOrigin,
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Vary": "Origin",
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store"
    };
    if (request.method === "OPTIONS") return new Response(null, { headers: cors });
    if (corsOrigin === "null") return json({ error: "Origin tidak diizinkan. Atur ALLOWED_ORIGIN sesuai domain GitHub Pages." }, 403, cors);

    if (url.pathname.endsWith("/vision") || url.pathname === "/vision") {
      if (request.method !== "POST") return json({ error: "Gunakan POST untuk analisis screenshot." }, 405, cors);
      if (!env.OPENAI_API_KEY) return json({ error: "Secret OPENAI_API_KEY belum disetel di Cloudflare Worker." }, 500, cors);
      let body;
      try { body = await request.json(); } catch { return json({ error: "JSON request tidak valid." }, 400, cors); }
      const allowedTypes = new Set(["image/png", "image/jpeg", "image/webp"]);
      if (!allowedTypes.has(body?.mimeType) || typeof body?.imageBase64 !== "string") return json({ error: "Kirim screenshot PNG, JPEG, atau WEBP." }, 400, cors);
      if (body.imageBase64.length > 11_200_000) return json({ error: "Ukuran screenshot terlalu besar; maksimal sekitar 8 MB." }, 413, cors);
      const symbol = "XAU/USD";
      let mtf = "Data candle multi-timeframe tidak tersedia; analisis hanya berdasarkan gambar yang terlihat.";
      try { mtf = env.OANDA_TOKEN ? await getMultiTimeframe(env) : await getBiQuoteMultiTimeframe(); }
      catch (e) { mtf = `Pengambilan candle multi-timeframe gagal (${String(e).slice(0,180)}). Jangan mengarang tren timeframe lain; tandai tidak tersedia.`; }
      const prompt = `Anda adalah analis teknikal XAU/USD. Analisis screenshot chart yang dilampirkan dengan hati-hati dan gunakan candle multi-timeframe asli jika disediakan di bawah. Jawab dalam bahasa Indonesia dengan bagian berikut:
1) APA YANG BENAR-BENAR TERLIHAT: timeframe yang terbaca pada gambar, harga/level yang terbaca jelas; tulis "tidak terbaca" bila buram/terpotong. Jangan menebak angka dari gambar.
2) TREN PER TIMEFRAME: M5, M15, M30, H1, H4 satu per satu, gunakan candle OANDA yang diberikan jika tersedia; sebut bullish/bearish/sideways dan alasan singkat. Jika data timeframe tidak tersedia, tulis "data tidak tersedia", jangan simpulkan dari screenshot timeframe lain.
3) SETUP PER TIMEFRAME: untuk setiap timeframe yang datanya cukup, tampilkan arah BUY/SELL atau TIDAK ADA SETUP, Entry, Stop Loss, Take Profit, dan RR 1:1. Jangan memberi setup hanya karena dipaksa; jika kondisi atau level tidak cukup jelas, tulis "TIDAK ADA SETUP VALID".
4) DASAR ENTRY: sebutkan struktur/pola/level yang mendukung, invalidasi, serta konflik antar-timeframe.
Aturan numerik: RR 1:1 wajib. BUY: SL di bawah Entry dan TP sama jaraknya di atas Entry. SELL: SL di atas Entry dan TP sama jaraknya di bawah Entry. Hitung TP = Entry + (Entry-SL) untuk BUY; TP = Entry - (SL-Entry) untuk SELL. Semua level harus konsisten dengan harga XAU/USD dan sumber data. Jika data screenshot dan candle bertentangan, jelaskan perbedaannya. Jangan menyatakan ini kepastian atau menjamin profit. Ini analisis informasional, bukan instruksi transaksi otomatis.

Candle OANDA tertutup (OHLC, waktu UTC; maksimal 60 candle terakhir per timeframe):
${mtf}`;
      const imageUrl = `data:${body.mimeType};base64,${body.imageBase64}`;
      try {
        const ai = await fetch("https://api.openai.com/v1/responses", {
          method: "POST",
          headers: { "Authorization": `Bearer ${env.OPENAI_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: env.OPENAI_VISION_MODEL || "gpt-4.1-mini",
            input: [{ role: "user", content: [
              { type: "input_text", text: prompt },
              { type: "input_image", image_url: imageUrl, detail: "high" }
            ] }],
            max_output_tokens: 2200
          })
        });
        const result = await ai.json();
        if (!ai.ok) return json({ error: result?.error?.message || `OpenAI API error ${ai.status}` }, 502, cors);
        const analysis = (result.output || []).flatMap(item => item.content || []).filter(c => c.type === "output_text").map(c => c.text).join("\n").trim();
        if (!analysis) return json({ error: "AI tidak mengembalikan teks analisis." }, 502, cors);
        return json({ analysis, model: env.OPENAI_VISION_MODEL || "gpt-4.1-mini", multiTimeframeData: env.OANDA_TOKEN ? "OANDA" : "BiQuote" }, 200, cors);
      } catch (e) { return json({ error: "Gagal menghubungi layanan AI.", detail: String(e).slice(0, 200) }, 502, cors); }
    }

    // Existing OANDA candle proxy route retained.
    if (request.method !== "GET") return json({ error: "Method not allowed" }, 405, cors);
    if (!env.OANDA_TOKEN) return json({ error: "OANDA_TOKEN belum disetel pada Worker secret." }, 500, cors);
    const allowed = new Set(["M5", "M15", "M30", "H1", "H4"]);
    const granularity = url.searchParams.get("granularity") || "M30";
    const count = Math.min(300, Math.max(30, Number(url.searchParams.get("count") || 180)));
    if (!allowed.has(granularity)) return json({ error: "Timeframe tidak didukung." }, 400, cors);
    try {
      const payload = await getOandaCandles(env, granularity, count);
      return json({ instrument: env.OANDA_INSTRUMENT || "XAU_USD", granularity, count: payload.length, candles: payload }, 200, cors);
    } catch (err) { return json({ error: String(err).slice(0, 240) }, 502, cors); }
  }
};

async function getOandaCandles(env, granularity, count) {
  const envName = (env.OANDA_ENV || "live").toLowerCase();
  const host = envName === "practice" ? "https://api-fxpractice.oanda.com" : "https://api-fxtrade.oanda.com";
  const instrument = env.OANDA_INSTRUMENT || "XAU_USD";
  const endpoint = `${host}/v3/instruments/${encodeURIComponent(instrument)}/candles?granularity=${granularity}&count=${count}&price=M`;
  const upstream = await fetch(endpoint, { headers: { "Authorization": `Bearer ${env.OANDA_TOKEN}`, "Accept": "application/json" } });
  const payload = await upstream.json();
  if (!upstream.ok) throw new Error(payload?.errorMessage || `OANDA API error ${upstream.status}`);
  return (payload.candles || []).filter(c => c.complete).map(c => ({ time: c.time, open: Number(c.mid.o), high: Number(c.mid.h), low: Number(c.mid.l), close: Number(c.mid.c) })).filter(c => [c.open,c.high,c.low,c.close].every(Number.isFinite));
}
async function getMultiTimeframe(env) {
  const frames = [["M5", "M5"], ["M15", "M15"], ["M30", "M30"], ["H1", "H1"], ["H4", "H4"]];
  const parts = await Promise.all(frames.map(async ([label, granularity]) => {
    const candles = await getOandaCandles(env, granularity, 60);
    return `${label}: ${JSON.stringify(candles.slice(-35))}`;
  }));
  return parts.join("\n");
}
async function getBiQuoteMultiTimeframe() {
  const frames = [["M5", "5m"], ["M15", "15m"], ["M30", "30m"], ["H1", "1h"], ["H4", "4h"]];
  const parts = await Promise.all(frames.map(async ([label, interval]) => {
    const response = await fetch(`https://biquote.io/api/XAUUSD/ohlc?interval=${interval}&limit=45`, { headers: { "Accept": "application/json" }, cf: { cacheTtl: 0 } });
    if (!response.ok) throw new Error(`BiQuote ${label} HTTP ${response.status}`);
    const payload = await response.json();
    const bars = (Array.isArray(payload.bars) ? payload.bars : Array.isArray(payload.candles) ? payload.candles : [])
      .filter(c => c.isOpen !== true)
      .map(c => ({ time: c.openTime || c.time || c.timestamp || null, open: Number(c.open), high: Number(c.high), low: Number(c.low), close: Number(c.close) }))
      .filter(c => [c.open,c.high,c.low,c.close].every(Number.isFinite)).slice(-35);
    if (bars.length < 12) throw new Error(`Candle BiQuote ${label} kurang dari 12`);
    return `${label}: ${JSON.stringify(bars)}`;
  }));
  return parts.join("\n");
}
function json(data, status, headers) { return new Response(JSON.stringify(data), { status, headers }); }
