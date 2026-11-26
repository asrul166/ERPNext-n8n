# Demo dan bahan portofolio

## Video demo (1–2 menit)

Persiapan: `node seed/stock.mjs reset`, lalu buka tiga jendela: ERPNext, n8n (workflow *BJM - Stok Menipis*), dan grup Telegram.

| Detik | Yang ditampilkan | Perintah / aksi | Narasi |
|---|---|---|---|
| 0–15 | Cover | | "Toko material fiktif; stok menipis sering ketahuan terlambat." |
| 15–35 | Stok Semen di ERPNext (laporan Stock Balance) | | "Batas minimum semen 50 sak, stok masih 55." |
| 35–50 | Terminal | `node seed/stock.mjs SMN-PC-50 utama 40` | "Stok turun menjadi 40." |
| 50–70 | Canvas n8n | klik *Execute workflow* | "n8n memeriksa semua barang dan permintaan yang masih berjalan." |
| 70–90 | Grup Telegram | | "Satu pesan, dengan tautan dokumen." |
| 90–105 | Draf Material Request di ERPNext | klik tautan | "Draf sudah siap diperiksa dan disetujui." |
| 105–120 | Canvas n8n | *Execute workflow* sekali lagi | "Dijalankan lagi: tidak ada dokumen dobel." |

Setelah merekam: `node seed/stock.mjs reset`.

## Screenshot

Sudah ada di [screenshots/](screenshots/): draf Material Request, empat canvas workflow, kotak masuk dan isi email di Mailpit. Cover: [cover.png](cover.png) (sumber: `cover.html`).

Masih perlu diambil sendiri dari Telegram:

- [ ] Pesan stok menipis
- [ ] Rekap pengingat tagihan
- [ ] Laporan harian
- [ ] Notifikasi error

Sebelum diunggah, potong atau tutup nama akun, foto profil, dan nomor telepon yang ikut terlihat.

## Draf kartu portofolio

**Judul:** Otomasi Operasional Toko Material Bangunan (ERPNext + n8n)

**Deskripsi:** Proyek portofolio dengan perusahaan fiktif. ERPNext v16 sebagai sumber data, n8n sebagai otomasi: draf permintaan pembelian saat stok menipis, email pengingat tagihan jatuh tempo, laporan harian ke Telegram, dan notifikasi bila otomasi gagal. n8n mengakses ERPNext lewat user dengan hak terbatas, dan seluruh lingkungan bisa dibangun ulang dari skrip.

**Tag:** ERPNext, Frappe, n8n, Docker, REST API, Telegram Bot, Otomasi

**Status:** Selesai sebagai demo lokal (belum di-deploy)
