# Dashboard stok toko Portee

Proyek untuk satu toko, memakai tab **stock toko** dan **sales toko** pada sheet yang Anda berikan. Kapasitas awal **1.500 pasang**, restock **Selasa dan Jumat**, tiba hari yang sama. Dashboard khusus tim dengan login Google. HTML publik di GitHub Pages; data dilindungi backend Cloudflare Worker dan daftar email yang diizinkan.

## Status proyek

Kode dan demo siap dicoba. **Belum dipublikasikan dan belum tersambung ke data toko.** Aktivasi memerlukan akun GitHub, Cloudflare, Google Cloud, OAuth Client ID, akun pembaca sheet, dan daftar email tim. Jangan mengirim private key atau kredensial melalui chat.

## Coba tampilan

Di folder proyek, jalankan `python3 -m http.server 8080`, buka `http://localhost:8080`, lalu klik **Lihat demo dengan data contoh**. Demo ditandai jelas dan hasil download berawalan DEMO. Tidak memerlukan koneksi sheet.

## Cara hitung

- Rata-rata awal = QTY penjualan COMPLETED selama 30 hari lengkap sebelum hari ini / 30. Zona waktu Asia/Jakarta. Penjualan hari ini dipakai untuk tanggal terakhir terjual, tetapi dikeluarkan dari rata-rata karena hari belum lengkap.
- Kedatangan Selasa mencakup 3 hari sampai Jumat; Jumat mencakup 4 hari sampai Selasa. Tanggal kedatangan bisa dipilih, harus Selasa/Jumat dan tidak di masa lalu.
- Target stok = pembulatan ke atas (rata-rata × (hari siklus + hari pengaman)). Pengaman awal 1 hari dan bisa diubah.
- Available perkiraan saat tiba = maksimum(0, Available sekarang − rata-rata × hari menunggu kedatangan). Kebutuhan = pembulatan ke atas maksimum(0, target − Available perkiraan saat tiba).
- Kapasitas menggunakan **On Hand**, termasuk Reserved; stok tersedia menggunakan **Available**. Ruang kosong dihitung dari stok aktual sekarang, tanpa mengasumsikan penjualan sebelum kiriman sudah terjadi. Ini sengaja konservatif untuk gudang terbatas.
- Qty disarankan diurutkan dari SKU paling cepat terjual dan dibatasi ruang kosong. Jika stok penuh, qty disarankan nol walaupun kebutuhan ada. Kandidat take out belum dianggap sudah keluar.
- Bobot sepatu dan sandal awal 1:1 karena ukuran ruang sebenarnya belum tersedia. Kapasitas 1.500 berarti perkiraan pasang. Setelah bobot diubah, kapasitas dan stok diukur sebagai unit ruang relatif, bukan pasang fisik.
- Artikel dirangkum dari awalan huruf + angka SKU, contoh PLH0102. Aturan ini perlu dikonfirmasi dengan standar SKU Anda. Restock selalu dihitung per SKU/warna/ukuran.
- Take out: On Hand >0, sudah 60 hari atau lebih sejak penjualan COMPLETED terakhir, qty dapat dipindah = maksimum(0, minimum(Available, On Hand − Reserved)).
- SKU tanpa riwayat penjualan masuk **Cek umur stok**, bukan otomatis take out. Dua tab tidak memiliki tanggal pertama masuk. Tanggal ini diperlukan agar barang baru tidak salah dikeluarkan.
- Riwayat kurang lengkap, stok kosong berkepanjangan, retur, kiriman berjalan, dan musim ramai dapat membuat proyeksi kurang tepat. Pengiriman berjalan belum dikurangi karena tidak ada sumber transfer terverifikasi. Dashboard memberi rekomendasi, tidak memindahkan stok atau membuat PO otomatis.
- CSV mengikuti tampilan dan pencarian aktif, dengan toko, tanggal kalkulasi, kedatangan dan cakupan. Buka/import UTF-8 di Excel atau Google Sheets. Angka menggunakan format sumber Inggris untuk teks; backend meminta nilai numerik asli.

## Aktivasi GitHub dan login

1. Buat repository baru, misalnya `toko-dashboard`. Upload **isi** folder ini ke akar repository, termasuk folder `.github`. Jangan upload `node_modules`, `.env`, `.dev.vars`, private key, atau JSON kredensial.
2. Buka Settings → Pages → Source → **GitHub Actions**. Workflow yang disertakan menguji kalkulasi dan mempublikasikan hanya lima file web. Backend dan panduan tidak masuk berkas publikasi web. URL biasanya `https://portee-wh.github.io/TOKO-Anggrek/`.
3. Di Google Cloud, buat project, aktifkan **Google Sheets API**, lalu buat service account khusus pembaca. Buat key JSON dan simpan secara privat di komputer Anda.
4. Bagikan sheet kepada alamat email service account sebagai **Viewer**. Login dashboard tidak otomatis membuat sheet menjadi privat. Sheet saat diperiksa dapat dibaca siapa saja dengan link; apabila ingin membatasi sumber juga, ubah General access menjadi Restricted sambil mempertahankan akses tim dan service account. Lakukan dengan mempertimbangkan proses lain yang masih memakai sheet.
5. Konfigurasikan Google Auth Platform / OAuth consent untuk penggunaan Anda, tambahkan email tim sebagai test users bila aplikasi masih Testing. Buat **OAuth Client ID → Web application**. Authorized JavaScript origins = `https://portee-wh.github.io` (tanpa path repository). Untuk demo lokal login, tambahkan `http://localhost:8080`.
6. Siapkan Cloudflare Worker. Di folder `backend`, jalankan `npm install` dan `npx wrangler login`. Ubah `wrangler.jsonc`: `GOOGLE_CLIENT_ID` = OAuth Client ID, `ALLOWED_ORIGIN` = origin GitHub Pages, `SHEET_ID` sudah terisi.
7. Masukkan secret lewat prompt terminal, satu per satu:

   ```sh
   npx wrangler secret put GOOGLE_SERVICE_ACCOUNT_EMAIL
   npx wrangler secret put GOOGLE_PRIVATE_KEY
   npx wrangler secret put ALLOWED_EMAILS
   ```

   Email service account dan `private_key` berasal dari JSON yang tadi disimpan; private key harus berisi seluruh bagian BEGIN/END PRIVATE KEY. `ALLOWED_EMAILS` berisi email pengguna dashboard dipisahkan koma. Email pengguna dan email service account memiliki peran berbeda. Secret tetap di backend.
8. Jalankan `npm run deploy` dalam folder backend. Catat URL Worker HTTPS.
9. Ubah `config.js`: `apiBase` = URL Worker tanpa slash akhir, `googleClientId` = OAuth Client ID. Pemetaan awal stok `Location=8` ↔ sales `Lokasi=Toko Anggrek` berasal dari sampel sumber; konfirmasi sebelum operasional. Bila berbeda, sesuaikan `storeId` dan `storeName`.
10. Commit perubahan `config.js`, tunggu workflow Pages selesai, lalu masuk dengan email tim. Akun di luar daftar harus ditolak. Periksa sample qty, omzet, lokasi, dan tanggal terhadap sheet sebelum pemakaian.

OAuth Client ID dan URL backend boleh berada di kode publik. **Private key dan daftar email tim tetap di secret backend.** Token login hanya disimpan dalam memori tab, tidak di localStorage. Token kedaluwarsa memerlukan login ulang. Backend memvalidasi tanda tangan Google dengan JOSE, issuer, audience, expiry, verified email, dan allowlist. Tidak memakai password buatan di browser. Refresh memuat data terbaru; tidak ada notifikasi email/WhatsApp otomatis.

## Pemeriksaan yang dijalankan

`npm test` memeriksa siklus 3/4 hari, batas kapasitas 1.500, prioritas SKU dan bobot ruang, take out 60 hari, pengecualian penjualan hari ini dari rata-rata, filter status/toko, pesanan unik, angka sumber, penolakan duplikat SKU, serta perlindungan formula CSV.

Login nyata, akses Sheets API, deployment GitHub/Cloudflare, dan bobot ruang belum bisa diuji sebelum akun dan konfigurasi Anda diaktifkan.

## Referensi teknis resmi

- GitHub Pages: https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages
- Verifikasi login Google: https://developers.google.com/identity/gsi/web/guides/verify-google-id-token
- Pembacaan Sheets API: https://developers.google.com/workspace/sheets/api/guides/values
