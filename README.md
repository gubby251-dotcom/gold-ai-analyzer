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
