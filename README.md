# SEBU DOLLAR ANALYZER — GitHub Pages + TradingView OANDA + BiQuote

## Konfigurasi sumber data
- Chart interaktif: TradingView, simbol `OANDA:XAUUSD`.
- Harga live di kartu utama: BiQuote `https://biquote.io/api/XAUUSD?allowStale=false`.
- Candle yang dipakai untuk indikator internal: BiQuote OHLC `https://biquote.io/api/XAUUSD/ohlc`.
- Tidak memerlukan token OANDA atau Cloudflare Worker untuk rancangan ini. GitHub Pages dapat meng-host `index.html`.

## Pasang melalui HP
1. Buka repository `gold-ai-analyzer` di GitHub.
2. Buka `index.html` lalu Edit (ikon pensil), atau unggah file `index.html` dari paket ini untuk menggantikan file lama.
3. Commit perubahan ke branch `main`.
4. Buka URL GitHub Pages dan refresh. Jika masih tampilan lama, bersihkan cache browser atau buka ulang tab.

## Catatan data
- TradingView chart dan BiQuote live/ohlc adalah sumber terpisah. Harga, high/low, waktu pembaruan dan candle dapat berbeda.
- BiQuote mendokumentasikan endpoint publik untuk tick dan OHLC, tetapi ketersediaan feed dapat berubah. Aplikasi akan menampilkan status gagal jika endpoint tidak memberi data valid.
- Widget chart TradingView disediakan oleh TradingView dan berjalan sebagai embed eksternal.
- Analisa teknikal adalah perhitungan indikator sederhana, bukan jaminan hasil trading.
- Screenshot analyzer saat ini baru mendukung pratinjau lokal; AI vision belum tersambung.
- `worker.js` tidak dipakai dalam konfigurasi ini dan boleh tetap berada di repo, tetapi tidak diperlukan untuk menampilkan chart/harga dengan rancangan ini.
