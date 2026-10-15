# Pembaruan SIPANDAI v4.9 — Logo nomor 6

Paket ini berasal dari frontend SIPANDAI v4.9 dan telah mengganti logo di halaman login, sidebar/header, laporan cetak, favicon, ikon Apple, dan PWA.

**Cara memasang:** ekstrak ZIP, lalu salin seluruh file dan folder `icons/` ke root repository `hildasiti/sipandai`. Ganti file lama dan commit semuanya sekaligus. File `PANDUAN_LOGO_6.md` hanya petunjuk, tidak wajib diunggah.

Domain `sipandai.idrisiyyah.my.id`, URL Worker di `config.js`, backend Apps Script, dan Spreadsheet **tidak berubah**.

Service Worker memakai cache versi baru `sipandai-static-v4.9-logo6`. Setelah deploy, refresh halaman. Bila aplikasi PWA yang sudah terpasang masih menunjukkan ikon lama pada layar utama, tutup aplikasi dan buka kembali; jika diperlukan hapus instalasi lama lalu pasang ulang dari website.

Pastikan unggahan menyertakan `index.html`, `app.js`, `styles.css`, `config.js`, `sw.js`, `manifest.webmanifest`, `CNAME`, dan seluruh isi `icons/`.

Pengujian: periksa login, navigasi, ikon tab, cetak, lalu buka Pengaturan → Pasang Aplikasi. Tidak perlu mengganti `Code.gs` ataupun Worker.
