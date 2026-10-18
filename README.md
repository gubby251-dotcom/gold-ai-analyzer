# SEBU DOLLAR ANALYZER — News Analysis + Chart Layout Fix

Versi ini mempertahankan bagian analisis dan widget NEWS & ANALISA FUNDAMENTAL XAU/USD dari versi sebelumnya, serta merapikan area bawah chart agar tulisan tidak saling menimpa.

## Perbaikan chart
- Menghapus kredit `Chart by TradingView` buatan sendiri yang menduplikasi kredit bawaan widget.
- Menghilangkan baris keterangan kedua yang berpotensi menumpuk dengan status chart.
- Membuat area widget chart memiliki tinggi yang konsisten dan overflow tersembunyi.
- Mempertahankan satu baris status sumber chart/data di bawah chart.

## Deploy GitHub Pages
1. Ekstrak ZIP.
2. Ganti `index.html`, `worker.js`, dan `README.md` di repo dengan file versi ini.
3. Commit perubahan dan tunggu GitHub Pages selesai memperbarui.

Catatan: widget TradingView tetap membutuhkan koneksi internet. Harga/candle BiQuote dan chart TradingView OANDA dapat berbeda karena sumber feed berbeda.

## Navigasi News
- Tab **News** ditambahkan di navigasi bawah, tepat di sebelah **Analisa**.
- Menekan tab News akan menggulir langsung ke bagian kalender ekonomi global (semua negara dan semua tingkat dampak), berita pasar, dan panduan dampak fundamental XAU/USD.
- News menggunakan widget TradingView dan memerlukan internet; ini bukan pembacaan/interpretasi AI otomatis setiap headline.

## Cakupan News
- Filter negara dan filter tingkat dampak di kalender ekonomi dihapus agar widget menampilkan agenda global dan semua tingkat dampak yang didukung TradingView.
- Feed berita pasar berasal dari widget TradingView. Halaman tidak mengarang headline atau nilai Actual/Forecast. Periksa sumber dan waktu publikasi; relevansi berita terhadap XAU/USD tetap perlu dinilai.


## News USD-focused
- Kalender ekonomi difilter ke Amerika Serikat (`countryFilter: us`) dan tidak membatasi tingkat dampak.
- Feed berita memakai simbol DXY (`TVC:DXY`) untuk fokus pada berita terkait US Dollar.
- Feed DXY bukan jaminan setiap berita USD tercakup; widget dan ketersediaan data dikendalikan TradingView.

## Screenshot Analyzer AI Vision (fitur baru)
- Bagian **Analisa Gambar Chart · AI Vision** sekarang menerima screenshot PNG/JPEG/WEBP, tombol **Analisis Screenshot dengan AI**, URL backend, status, dan hasil analisis.
- Worker menerima `POST /vision`, mengirim gambar ke OpenAI Responses API melalui secret server-side, dan meminta hasil per timeframe M5/M15/M30/H1/H4 dengan Entry, SL, TP, RR 1:1.
- Worker mengambil candle multi-timeframe dari BiQuote secara otomatis. Jika `OANDA_TOKEN` tersedia, Worker memakai candle OANDA. Timeframe yang datanya gagal tidak boleh ditebak oleh AI.
- **Wajib konfigurasi sebelum fitur bisa berjalan:** deploy `worker.js` ke Cloudflare Workers; di Settings → Variables and Secrets tambahkan secret `OPENAI_API_KEY`. API AI mungkin berbayar sesuai pemakaian/kuota. Jangan pernah menulis API key di `index.html` atau GitHub.
- Opsional: set `ALLOWED_ORIGIN` ke origin GitHub Pages Anda, misalnya `https://USERNAME.github.io` (tanpa path) untuk membatasi origin browser. Untuk produksi, aktifkan rate limiting di Cloudflare agar endpoint publik tidak disalahgunakan.
- Di aplikasi, isi URL Worker yang berakhiran `/vision`, lalu tekan **Simpan URL**. Pilih screenshot, tekan **Analisis Screenshot dengan AI**.
- AI dapat salah membaca gambar. Level hanya estimasi analitis; cocokkan dengan chart broker dan jangan anggap sebagai jaminan atau eksekusi otomatis.
