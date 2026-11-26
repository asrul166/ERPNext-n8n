# Rencana Proyek: ERPNext + n8n untuk CV. Bangunan Jaya Makmur

Otomasi operasional toko material bangunan: stok menipis, tagihan jatuh tempo, dan laporan harian.

## 0. Konteks

- **Perusahaan:** CV. Bangunan Jaya Makmur, toko material bangunan **fiktif**. Semua data adalah data contoh.
- **Tujuan:** proyek portofolio yang menunjukkan kemampuan ERP sekaligus otomasi dan integrasi.
- **Cara kerja:** dibangun **dari nol** di folder proyek baru. (Memakai ulang instance ERPNext lama di WSL bisa mempersingkat fase 1–2, tapi hasilnya lebih sulit direproduksi.)

### Keputusan

| Hal | Pilihan |
|---|---|
| ERP | ERPNext/Frappe v16 lewat `frappe_docker` |
| Otomasi | n8n self-hosted, Docker |
| Jaringan | n8n dan ERPNext di satu Docker network, saling akses lewat nama service |
| Notifikasi internal | Telegram |
| Pengingat ke pelanggan | Email |
| Akses API | User khusus dengan hak seperlunya, bukan Administrator |
| Bahasa | Bahasa Indonesia |
| Zona waktu | `Asia/Makassar` di ERPNext **dan** n8n |
| Modul | Stock, Buying, Selling, Accounts |

**Di luar cakupan:** HR, CRM, Projects, WhatsApp, dan aplikasi booking/antrean (proyek terpisah).

### Struktur folder

```
erp-n8n-bjm/
├── docker/            # compose / override untuk ERPNext dan n8n
├── n8n/workflows/     # hasil export workflow (.json)
├── seed/              # skrip pengisi data contoh
├── docs/              # diagram, screenshot, catatan
├── .env.example
├── .gitignore         # wajib memuat .env
└── README.md
```

### Cek dokumentasi resmi sebelum mulai

Jangan menebak versi atau perintah instalasi. Cek yang terbaru di:
- `frappe_docker`: https://github.com/frappe/frappe_docker
- ERPNext: https://docs.frappe.io/erpnext
- n8n: https://docs.n8n.io

---

## Fase 1: ERPNext jalan

- [ ] `git init`, buat struktur folder, `.gitignore`, `.env.example`
- [ ] Jalankan ERPNext v16 lewat `frappe_docker` (setup demo cukup untuk lokal, **bukan** untuk produksi)
- [ ] Pastikan data tersimpan di volume
- [ ] Ganti password Administrator bawaan
- [ ] Buat company, mata uang IDR, tahun fiskal, zona waktu, bahasa Indonesia
- [ ] Buat gudang (misalnya Gudang Utama dan Toko)

**Selesai jika:** bisa login, dan data masih ada setelah container di-restart.

## Fase 2: Data contoh yang bisa diulang

Tulis skrip (Node.js atau Python) di `seed/` yang mengisi data lewat REST API.

- [ ] ±20 barang (semen, besi, cat, pipa, dll.) lengkap dengan **reorder level** dan reorder qty per gudang
- [ ] 3–5 supplier, 8–10 pelanggan dengan **email uji**
- [ ] Stok awal, dengan beberapa barang sengaja dekat batas minimum
- [ ] Sales Invoice, sebagian sengaja **lewat jatuh tempo**
- [ ] Skrip aman dijalankan dua kali (tidak membuat data dobel)

Untuk tahap awal skrip boleh memakai API key admin. Key ini hanya untuk seeding, tidak dipakai n8n.

**Selesai jika:** dari instance kosong, satu perintah menghasilkan data yang siap diuji.

## Fase 3: User API

- [ ] Buat user `n8n-bot` dengan role khusus
- [ ] Beri **baca** untuk Item, Bin, Sales Invoice, Payment Entry, Customer
- [ ] Beri **baca + buat** untuk Material Request
- [ ] Tambahkan izin lain hanya saat benar-benar dibutuhkan
- [ ] Generate API key dan secret, simpan di `.env`

Uji:

```bash
curl -H "Authorization: token API_KEY:API_SECRET" \
  "http://localhost:8080/api/resource/Item?limit_page_length=5"
```

Sesuaikan port dengan setup kamu.

**Selesai jika:** request di atas berhasil, dan percobaan menghapus Item dengan key yang sama **ditolak**.

## Fase 4: n8n jalan

- [ ] Tambahkan n8n ke Docker Compose dengan volume persisten
- [ ] Gabungkan ke network ERPNext (cek namanya dengan `docker network ls`)
- [ ] Set `N8N_ENCRYPTION_KEY`, `GENERIC_TIMEZONE=Asia/Makassar`, `TZ=Asia/Makassar`
- [ ] Dari n8n, panggil ERPNext lewat **nama service**, bukan `localhost`
- [ ] Simpan API ERPNext di **Credentials** n8n (Header Auth), jangan ditulis langsung di node
- [ ] Buat bot lewat @BotFather, siapkan grup uji, catat chat ID

Kalau ERPNext membalas "site not found", periksa pengaturan nama site pada service frontend.

**Selesai jika:** satu workflow manual bisa membaca daftar Item dan mengirim pesan ke Telegram.

## Fase 5: Workflow 1, stok menipis (MVP)

**Cek dulu:** ERPNext versi sebelumnya punya fitur auto reorder bawaan (Stock Settings). Pastikan apakah v16 masih punya. Kalau ada, **matikan** supaya tidak bentrok, dan tulis di README kenapa tetap memakai n8n: satu pesan gabungan di Telegram, aturan yang bisa diubah, dan alur lanjutan seperti persetujuan.

**Alur:**

1. Schedule Trigger (misalnya tiap pagi 08.00)
2. Ambil Item beserta reorder level (ada di child table, jadi ambil detail per Item)
3. Ambil stok per gudang dari `Bin` (`projected_qty`)
4. Saring: `projected_qty` di bawah reorder level
5. Cek Material Request yang masih **draf atau belum selesai** untuk barang dan gudang itu, siapa pun pembuatnya. Kalau ada, lewati
6. Buat **satu** draf Material Request (tipe Purchase) berisi semua barang yang lolos
7. Kirim satu pesan Telegram: daftar barang, stok, qty diminta, link dokumen

**Skenario uji:**

- [ ] Stok di atas batas → tidak ada dokumen, tidak ada pesan
- [ ] Satu barang di bawah batas → satu draf MR, satu pesan
- [ ] Dijalankan lagi → tidak ada duplikat
- [ ] Tiga barang di bawah batas → satu MR berisi tiga baris
- [ ] ERPNext dimatikan → error tertangkap, tidak diam saja

**Selesai jika:** semua skenario lolos.

## Fase 6: Workflow error

- [ ] Buat workflow dengan **Error Trigger** yang mengirim nama workflow, node yang gagal, dan pesan error ke Telegram
- [ ] Pasang sebagai error workflow di semua workflow
- [ ] Atur retry pada node HTTP yang aman diulang (yang hanya membaca)

**Selesai jika:** kegagalan yang disengaja pada eksekusi terjadwal memunculkan notifikasi. (Eksekusi manual tidak memicu Error Trigger.)

## Fase 7: Workflow 2, tagihan jatuh tempo

1. Terjadwal tiap pagi
2. Ambil Sales Invoice: `docstatus = 1`, `outstanding_amount > 0`, `due_date` sebelum hari ini
3. Cek kapan terakhir diingatkan. Lewati kalau kurang dari 7 hari
4. Kirim email ke pelanggan
5. Catat tanggal pengingat (misalnya custom field di Sales Invoice, perlu izin tulis yang sempit)
6. Kirim rekap ke Telegram bagian keuangan

**Penting:** selama pengembangan, arahkan SMTP ke kotak uji lokal (misalnya Mailpit) supaya tidak ada email yang terkirim ke orang sungguhan.

**Selesai jika:** invoice lunas tidak diingatkan, dan menjalankan dua kali di hari yang sama tidak mengirim email dobel.

## Fase 8: Workflow 3, laporan harian

Tiap sore kirim ke Telegram pemilik:
- Total penjualan hari ini
- Kas masuk (Payment Entry tipe Receive)
- Total piutang lewat jatuh tempo
- Barang di bawah batas minimum

ERPNext punya Auto Email Report, jadi nilai workflow ini ada pada ringkasan lintas modul yang sampai lewat Telegram.

- [ ] Tetap terkirim dengan angka nol saat tidak ada transaksi
- [ ] Angkanya cocok dengan laporan di ERPNext
- [ ] Retur dan dokumen batal tidak membuat total salah

**Selesai jika:** angka sudah dicocokkan manual untuk minimal satu hari berisi transaksi.

## Fase 9: Kemas untuk portofolio

- [ ] Export semua workflow ke `n8n/workflows/`
- [ ] **Periksa JSON dan riwayat git:** tidak ada token, API secret, password, atau chat ID
- [ ] README: masalah, diagram arsitektur, cara menjalankan, keputusan teknis, keterbatasan
- [ ] Screenshot: canvas tiap workflow, draf Material Request, pesan Telegram
- [ ] Video demo 1–2 menit: stok berkurang → workflow jalan → pesan masuk → dokumen muncul
- [ ] Cover **2400×1260** (rasio 1200:630)
- [ ] Coba setup ulang dari nol mengikuti README sendiri
- [ ] Perbarui kartu ERP di web portofolio: judul, deskripsi, foto, tag, status

## Tambahan (opsional, setelah semua selesai)

- Tombol **Setujui / Tolak** di Telegram untuk Material Request. Telegram Trigger butuh webhook HTTPS publik (tunnel), user bot butuh izin submit, dan hanya akun tertentu yang boleh menekan tombol.
- Deploy ke VPS dengan HTTPS.

## Urutan prioritas

**Fase 1–6** sudah cukup untuk dipajang. Fase 7 dan 8 menambah nilai. Jangan menulis fitur di portofolio sebelum benar-benar jalan.
