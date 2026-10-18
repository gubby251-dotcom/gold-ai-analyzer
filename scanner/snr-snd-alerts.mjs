
import fs from "node:fs";

const BASE = (
  process.env.BIQUOTE_BASE_URL || "https://biquote.io/api"
).replace(/\/$/, "");

const PROJECT_ID = process.env.FIREBASE_PROJECT_ID;
const SERVICE_ACCOUNT_JSON = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
const STATE_FILE = "snr-snd-state.json";

const TIMEFRAMES = [
  { name: "M5", interval: "5m", minutes: 5 },
  { name: "M15", interval: "15m", minutes: 15 },
  { name: "M30", interval: "30m", minutes: 30 }
];

function readState() {
  try {
    return JSON.parse(fs.readFileSync(STATE_FILE, "utf8"));
  } catch {
    return { sent: {} };
  }
}

function saveState(state) {
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

function timeMs(value) {
  if (typeof value === "number") {
    return value < 1e12 ? value * 1000 : value;
  }
  const result = Date.parse(value);
  return Number.isFinite(result) ? result : NaN;
}

async function getCandles(interval, minutes) {
  const url =
    `${BASE}/XAUUSD/ohlc?interval=${encodeURIComponent(interval)}&limit=180`;

  const response = await fetch(url, {
    headers: { accept: "application/json" },
    signal: AbortSignal.timeout(20000)
  });

  if (!response.ok) {
    throw new Error(`BiQuote HTTP ${response.status}: ${interval}`);
  }

  const json = await response.json();

  const rows = Array.isArray(json)
    ? json
    : json.bars || json.candles || json.data || json.ohlc;

  if (!Array.isArray(rows)) {
    throw new Error(
      `Format respons candle ${interval} belum dikenali. Periksa respons API BiQuote.`
    );
  }

  const candles = rows.map((row) => ({
    t: timeMs(
      row.openTime ?? row.open_time ?? row.time ??
      row.timestamp ?? row.t ?? row.date
    ),
    o: Number(row.open ?? row.o),
    h: Number(row.high ?? row.h),
    l: Number(row.low ?? row.l),
    c: Number(row.close ?? row.c),
    explicitlyOpen: row.isOpen === true || row.closed === false
  })).filter((x) =>
    Number.isFinite(x.t) &&
    [x.o, x.h, x.l, x.c].every(Number.isFinite) &&
    x.h >= Math.max(x.o, x.c) &&
    x.l <= Math.min(x.o, x.c) &&
    x.h >= x.l &&
    !x.explicitlyOpen
  ).sort((a, b) => a.t - b.t);

  const unique = candles.filter(
    (c, i, arr) => i === 0 || c.t !== arr[i - 1].t
  );

  // Jangan pernah menilai candle yang belum selesai.
  const now = Date.now();
  const closed = unique.filter(
    (c) => c.t + minutes * 60000 <= now
  );

  if (closed.length < 30) {
    throw new Error(
      `Candle tertutup ${interval} kurang atau format waktu API salah: ${closed.length}`
    );
  }

  return closed;
}

function calculateATR(candles, period = 14) {
  if (candles.length < period + 1) return 0;

  const ranges = [];

  for (let i = 1; i < candles.length; i++) {
    const current = candles[i];
    const previous = candles[i - 1];

    ranges.push(Math.max(
      current.h - current.l,
      Math.abs(current.h - previous.c),
      Math.abs(current.l - previous.c)
    ));
  }

  const last = ranges.slice(-period);
  return last.reduce((sum, value) => sum + value, 0) / last.length;
}

function findZones(candles, atr, price) {
  const pivots = [];
  const start = Math.max(2, candles.length - 120);

  // Pivot hanya sah setelah dua candle di sebelah kanannya selesai.
  for (let i = start; i < candles.length - 2; i++) {
    let isHigh = true;
    let isLow = true;

    for (let n = 1; n <= 2; n++) {
      if (
        candles[i].h <= candles[i - n].h ||
        candles[i].h < candles[i + n].h
      ) isHigh = false;

      if (
        candles[i].l >= candles[i - n].l ||
        candles[i].l > candles[i + n].l
      ) isLow = false;
    }

    if (isHigh) pivots.push({ price: candles[i].h, type: "R" });
    if (isLow) pivots.push({ price: candles[i].l, type: "S" });
  }

  const tolerance = Math.max(atr * 0.20, price * 0.00015);

  function cluster(type) {
    const groups = [];

    for (const pivot of pivots
      .filter((p) => p.type === type)
      .sort((a, b) => a.price - b.price)) {
      let group = groups.find(
        (g) => Math.abs(g.sum / g.count - pivot.price) <= tolerance
      );

      if (!group) {
        group = { sum: 0, count: 0 };
        groups.push(group);
      }

      group.sum += pivot.price;
      group.count++;
    }

    return groups
      .filter((g) => g.count >= 2)
      .map((g) => g.sum / g.count);
  }

  const support = cluster("S")
    .filter((level) => level < price)
    .sort((a, b) => b - a)[0] ?? null;

  const resistance = cluster("R")
    .filter((level) => level > price)
    .sort((a, b) => a - b)[0] ?? null;

  return { support, resistance };
}

function scanTimeframe(tf, candles) {
  const atr = calculateATR(candles);

  if (!atr || !Number.isFinite(atr)) return [];

  const last = candles[candles.length - 1];
  const previous = candles[candles.length - 2];
  const zones = findZones(candles, atr, last.c);
  const tolerance = atr * 0.20;
  const events = [];

  if (zones.support !== null) {
    const level = zones.support;

    if (previous.c >= level && last.c < level) {
      events.push({
        tf, type: "BREAKOUT", side: "SELL",
        zone: "SUPPORT", level, candle: last.t, close: last.c
      });
    } else if (
      last.l <= level + tolerance &&
      last.l >= level - tolerance &&
      last.c > level + tolerance &&
      last.c > last.o
    ) {
      events.push({
        tf, type: "HOLD", side: "BUY",
        zone: "DEMAND", level, candle: last.t, close: last.c
      });
    }
  }

  if (zones.resistance !== null) {
    const level = zones.resistance;

    if (previous.c <= level && last.c > level) {
      events.push({
        tf, type: "BREAKOUT", side: "BUY",
        zone: "RESISTANCE", level, candle: last.t, close: last.c
      });
    } else if (
      last.h >= level - tolerance &&
      last.h <= level + tolerance &&
      last.c < level - tolerance &&
      last.c < last.o
    ) {
      events.push({
        tf, type: "HOLD", side: "SELL",
        zone: "SUPPLY", level, candle: last.t, close: last.c
      });
    }
  }

  return events;
}

async function getFirebaseAccessToken() {
  if (!PROJECT_ID || !SERVICE_ACCOUNT_JSON) {
    throw new Error("GitHub Secrets Firebase belum diatur.");
  }

  const { GoogleAuth } = await import("google-auth-library");
  const credentials = JSON.parse(SERVICE_ACCOUNT_JSON);

  const auth = new GoogleAuth({
    credentials,
    scopes: ["https://www.googleapis.com/auth/firebase.messaging"]
  });

  const client = await auth.getClient();
  const result = await client.getAccessToken();

  if (!result.token) throw new Error("Gagal memperoleh token Firebase.");
  return result.token;
}

async function sendNotification(event, accessToken) {
  const title = `SEBU DOLLAR ANALYZER | ${event.type} ${event.tf}`;
  const body =
    `${event.zone} ${event.type === "HOLD" ? "bertahan" : "ditembus"} | ` +
    `${event.side} | Close ${event.close.toFixed(3)} | ` +
    `Level ${event.level.toFixed(3)}`;

  const response = await fetch(
    `https://fcm.googleapis.com/v1/projects/${PROJECT_ID}/messages:send`,
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${accessToken}`,
        "content-type": "application/json"
      },
      body: JSON.stringify({
        message: {
          topic: "snr_snd_alerts",
          notification: { title, body },
          data: {
            tf: event.tf,
            type: event.type,
            side: event.side,
            zone: event.zone,
            candle: String(event.candle),
            level: String(event.level),
            close: String(event.close)
          }
        }
      }),
      signal: AbortSignal.timeout(20000)
    }
  );

  if (!response.ok) {
    throw new Error(`Firebase HTTP ${response.status}: ${await response.text()}`);
  }
}

async function main() {
  const state = readState();
  const found = [];

  for (const tf of TIMEFRAMES) {
    const candles = await getCandles(tf.interval, tf.minutes);
    const events = scanTimeframe(tf.name, candles);

    console.log(`${tf.name}: ${candles.length} candle tertutup; ${events.length} kandidat.`);

    for (const event of events) {
      const key = [
        event.tf, event.type, event.side, event.zone, event.candle
      ].join("|");

      if (state.sent[key]) continue;

      found.push({ key, event });
    }
  }

  if (found.length) {
    const token = await getFirebaseAccessToken();

    for (const item of found) {
      await sendNotification(item.event, token);
      state.sent[item.key] = new Date().toISOString();
      console.log("FCM terkirim:", item.key);
    }
  }

  // Batasi catatan yang disimpan agar tidak terus membesar.
  const entries = Object.entries(state.sent)
    .sort((a, b) => a[1].localeCompare(b[1]))
    .slice(-1000);

  state.sent = Object.fromEntries(entries);
  saveState(state);

  console.log(`Selesai. Notifikasi baru: ${found.length}.`);
}

main().catch((error) => {
  console.error(error?.stack || error);
  process.exitCode = 1;
});
