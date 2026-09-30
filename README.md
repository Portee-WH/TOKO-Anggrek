# TOKO Anggrek · Kendali stok

Dashboard: https://portee-wh.github.io/TOKO-Anggrek/

## Status koneksi

Tampilan web sudah diterbitkan. Koneksi data asli belum aktif karena Google OAuth Client ID dan URL backend belum dikonfigurasi. Tombol demo memakai data contoh. Data asli tidak disimpan di repository ini.

## Aktivasi berikutnya

1. Di Google Cloud, buat project **Dashboard Toko Anggrek**, lalu aktifkan **Google Sheets API**.
2. Buat OAuth Client ID jenis Web Application untuk login Google. Authorized JavaScript origin: `https://portee-wh.github.io`. Buat konfigurasi consent dan test users sesuai akun tim.
3. Buat service account pembaca sheet. Share spreadsheet kepada email akun itu dengan izin Viewer. Simpan private key secara privat, jangan upload ke GitHub atau kirim melalui chat.
4. Deploy folder `backend` ke Cloudflare Worker. Isi variabel `GOOGLE_CLIENT_ID` dan `ALLOWED_ORIGIN` pada `wrangler.jsonc`; origin sudah disesuaikan. Isi secrets `GOOGLE_SERVICE_ACCOUNT_EMAIL`, `GOOGLE_PRIVATE_KEY`, `ALLOWED_EMAILS` di backend. Lihat detail di [PANDUAN.md](PANDUAN.md).
5. Isi `config.js` dengan URL Worker dan OAuth Client ID yang sama. ID client adalah informasi publik; private key hanya ada di backend.
6. Login dengan email tim dan klik Perbarui data. Pastikan akun di luar daftar ditolak. Cocokkan angka dengan sheet sebelum memakai rekomendasi.

## Sumber dan operasional

- Hanya tab **stock toko** dan **sales toko**.
- Pemetaan lokasi awal: stock Location `8` ↔ sales Lokasi `Toko Anggrek`.
- Restock Selasa/Jumat, tiba hari yang sama; cakupan 3/4 hari.
- Kapasitas awal 1.500 pasang. Bobot ruang sepatu/sandal tetap bisa diatur.
- Take out per SKU setelah 60 hari tanpa penjualan. SKU tanpa riwayat masuk Cek umur stok.
- Download CSV mengikuti kalkulasi dan filter aktif.

Backend memvalidasi token Google dan email tim; kolom Pelanggan, No Telp dan Catatan tidak dikirim ke browser. Izin dashboard berbeda dari izin sumber Google Sheets. Sheet yang masih dibagikan kepada siapa saja dengan link tetap dapat diakses langsung melalui linknya.
