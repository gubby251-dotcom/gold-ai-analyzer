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
