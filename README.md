# ERPNext + n8n: CV. Bangunan Jaya Makmur

Otomasi operasional toko material bangunan **fiktif**. Semua nama, email, dan angka adalah data contoh.

**Status:** ERPNext, data contoh, dan user API sudah teruji. Workflow stok menipis teruji sampai pembuatan Material Request; pengiriman Telegram dan notifikasi error belum diuji.

## Masalah

Stok yang menipis baru ketahuan saat barang sudah habis. Workflow ini tiap pagi memeriksa stok terhadap reorder level, membuat **satu** draf Material Request, dan mengirim **satu** pesan Telegram.

## Arsitektur

```mermaid
flowchart LR
  subgraph Docker network "bjm"
    N[n8n] -- REST, user n8n-bot --> F[ERPNext frontend]
    F --> B[backend / worker / scheduler]
    B --> DB[(MariaDB)]
    B --> R[(Redis)]
    M[Mailpit]
  end
  S[seed/*.mjs] -- REST, Administrator --> F
  N --> T[Telegram]
```

## Menjalankan

Butuh Docker (Compose v2) dan Node.js 20 atau lebih baru.

```bash
node seed/init-env.mjs          # membuat .env dengan password acak
docker compose --env-file .env -f docker/compose.yaml up -d
node seed/index.mjs             # setup company, user API, data contoh
node n8n/import.mjs             # credential dan workflow n8n
```

| Layanan | Alamat | Login |
|---|---|---|
| ERPNext | http://localhost:8081 | `Administrator` / `ADMIN_PASSWORD` di `.env` |
| n8n | http://localhost:5678 | akun owner dibuat saat pertama dibuka |
| Mailpit | http://localhost:8025 | dipakai mulai Fase 7 |

### Telegram

1. Buat bot lewat @BotFather, isi `TELEGRAM_BOT_TOKEN` di `.env`.
2. Buat grup uji, tambahkan bot, kirim `/start@NamaBotKamu` di grup.
3. `node n8n/telegram-chat-id.mjs --simpan`
4. `node n8n/import.mjs` (mengaktifkan workflow terjadwal).

### Menguji

```bash
node seed/verify.mjs                          # ringkasan data
node seed/test-api.mjs                        # hak user n8n-bot
node seed/stock.mjs SMN-PC-50 utama 40        # buat stok menipis
node seed/stock.mjs reset                     # stok awal, hapus Material Request
python n8n/run-workflow.py                    # jalankan stok menipis, ringkas hasil tiap node
python n8n/run-workflow.py bjmCekKoneksi001   # tes koneksi n8n -> ERPNext -> Telegram
```

## Keputusan teknis

- **Kenapa n8n, bukan auto reorder bawaan ERPNext?** ERPNext v16 masih punya fitur itu, dan setup wizard-nya **menyalakannya** secara otomatis. Skrip setup mematikannya agar tidak bentrok. n8n dipilih untuk satu pesan gabungan di Telegram, aturan yang mudah diubah, dan alur lanjutan seperti persetujuan.
- **Aturan:** barang dipesan bila `projected_qty <= reorder_level`, sama dengan ERPNext. Barang tanpa baris `Bin` dianggap stok 0.
- **Anti dobel:** pasangan barang + gudang yang sudah ada di Material Request draf atau belum selesai dilewati.
- **Hak minimal:** user `n8n-bot` hanya membaca data yang perlu dan membuat Material Request; tidak bisa mengubah atau menghapus.
- **Retry** hanya pada request baca. Pembuatan dokumen tidak diulang otomatis.
- **Rahasia** hanya di `.env`. Credential diimpor ke n8n lewat stdin.
- **`encryption_key`** site dibuat saat `create-site`. Tanpa itu, beberapa proses bisa menulis kunci berbeda dan API secret gagal didekripsi.

## Keterbatasan

- Hanya untuk lokal/demo (diturunkan dari `pwd.yml` frappe_docker), bukan produksi.
- `N8N_BLOCK_ENV_ACCESS_IN_NODE=false` supaya chat ID tidak ikut di JSON workflow; akibatnya workflow bisa membaca env container n8n.
- Jika pengiriman Telegram gagal setelah Material Request dibuat, run berikutnya melewati barang itu (sudah ada MR), jadi pesannya tidak dikirim ulang. Notifikasi error juga lewat Telegram: bila Telegram yang mati, tidak ada pemberitahuan.
- Link di pesan Telegram mengarah ke `localhost`, hanya bisa dibuka dari komputer yang menjalankan stack.
- `node n8n/import.mjs` menimpa workflow di n8n dengan isi `n8n/workflows/`. Export dulu perubahan yang dibuat lewat editor.
