// Data contoh. Semua nama, alamat email, dan angka adalah fiktif.

export const ITEM_GROUPS = ['Semen & Agregat', 'Besi & Logam', 'Cat & Pelapis', 'Pipa & Sanitair', 'Kayu & Atap', 'Perlengkapan'];
export const UOMS = ['Sak', 'Batang', 'Kaleng', 'Lembar', 'Buah', 'Roll', 'Dus', 'Kg', 'Kubik'];

// utama / toko: [reorder level, reorder qty, stok awal]. Stok awal selalu di atas level;
// beberapa sengaja hanya sedikit di atasnya.
export const ITEMS = [
  { code: 'SMN-PC-50', name: 'Semen Portland 50 kg', group: 'Semen & Agregat', uom: 'Sak', buy: 58000, sell: 66000, supplier: 'PT Semen Nusantara Contoh', utama: [50, 200, 55], toko: [10, 40, 30] },
  { code: 'SMN-PTH-40', name: 'Semen Putih 40 kg', group: 'Semen & Agregat', uom: 'Sak', buy: 90000, sell: 105000, supplier: 'PT Semen Nusantara Contoh', utama: [10, 30, 35] },
  { code: 'PSR-CR', name: 'Pasir Cor', group: 'Semen & Agregat', uom: 'Kubik', buy: 250000, sell: 310000, supplier: 'UD Sumber Material Contoh', utama: [5, 20, 18] },
  { code: 'KRL-23', name: 'Kerikil 2/3', group: 'Semen & Agregat', uom: 'Kubik', buy: 280000, sell: 345000, supplier: 'UD Sumber Material Contoh', utama: [5, 20, 15] },
  { code: 'BSI-08', name: 'Besi Beton Polos 8 mm', group: 'Besi & Logam', uom: 'Batang', buy: 38000, sell: 45000, supplier: 'CV Baja Timur Contoh', utama: [100, 300, 340] },
  { code: 'BSI-10', name: 'Besi Beton Polos 10 mm', group: 'Besi & Logam', uom: 'Batang', buy: 58000, sell: 68000, supplier: 'CV Baja Timur Contoh', utama: [80, 250, 84] },
  { code: 'BSI-12', name: 'Besi Beton Ulir 12 mm', group: 'Besi & Logam', uom: 'Batang', buy: 92000, sell: 108000, supplier: 'CV Baja Timur Contoh', utama: [50, 150, 190] },
  { code: 'KWT-BDR', name: 'Kawat Bendrat', group: 'Besi & Logam', uom: 'Kg', buy: 17000, sell: 22000, supplier: 'CV Baja Timur Contoh', utama: [20, 50, 60], toko: [5, 15, 12] },
  { code: 'PKU-05', name: 'Paku Kayu 5 cm', group: 'Besi & Logam', uom: 'Kg', buy: 16000, sell: 21000, supplier: 'CV Baja Timur Contoh', utama: [15, 50, 45], toko: [5, 15, 14] },
  { code: 'CAT-TMB-25', name: 'Cat Tembok Putih 25 kg', group: 'Cat & Pelapis', uom: 'Kaleng', buy: 640000, sell: 750000, supplier: 'PT Warna Cerah Contoh', utama: [8, 24, 20], toko: [3, 10, 8] },
  { code: 'CAT-KYB-1', name: 'Cat Kayu & Besi 1 kg', group: 'Cat & Pelapis', uom: 'Kaleng', buy: 62000, sell: 78000, supplier: 'PT Warna Cerah Contoh', utama: [12, 36, 40], toko: [6, 18, 7] },
  { code: 'PLM-TMB', name: 'Plamir Tembok 5 kg', group: 'Cat & Pelapis', uom: 'Kaleng', buy: 45000, sell: 58000, supplier: 'PT Warna Cerah Contoh', utama: [10, 30, 28] },
  { code: 'PPA-AW-12', name: 'Pipa PVC AW 1/2 inci', group: 'Pipa & Sanitair', uom: 'Batang', buy: 24000, sell: 31000, supplier: 'PT Pipa Jaya Contoh', utama: [30, 100, 95], toko: [10, 30, 25] },
  { code: 'PPA-AW-3', name: 'Pipa PVC AW 3 inci', group: 'Pipa & Sanitair', uom: 'Batang', buy: 105000, sell: 128000, supplier: 'PT Pipa Jaya Contoh', utama: [15, 40, 17] },
  { code: 'KRN-AIR', name: 'Kran Air 1/2 inci', group: 'Pipa & Sanitair', uom: 'Buah', buy: 18000, sell: 27000, supplier: 'PT Pipa Jaya Contoh', utama: [20, 60, 70], toko: [8, 24, 20] },
  { code: 'TRP-9', name: 'Triplek 9 mm', group: 'Kayu & Atap', uom: 'Lembar', buy: 88000, sell: 105000, supplier: 'UD Sumber Material Contoh', utama: [25, 75, 80] },
  { code: 'SNG-GLB', name: 'Seng Gelombang 180 cm', group: 'Kayu & Atap', uom: 'Lembar', buy: 52000, sell: 65000, supplier: 'UD Sumber Material Contoh', utama: [40, 120, 130] },
  { code: 'KRM-40', name: 'Keramik Lantai 40x40', group: 'Perlengkapan', uom: 'Dus', buy: 54000, sell: 67000, supplier: 'UD Sumber Material Contoh', utama: [30, 100, 110], toko: [10, 30, 24] },
  { code: 'KBL-NYM', name: 'Kabel NYM 2x1,5 mm', group: 'Perlengkapan', uom: 'Roll', buy: 410000, sell: 485000, supplier: 'UD Sumber Material Contoh', utama: [5, 15, 14] },
  { code: 'LEM-PPA', name: 'Lem Pipa PVC', group: 'Perlengkapan', uom: 'Buah', buy: 7000, sell: 11000, supplier: 'PT Pipa Jaya Contoh', utama: [24, 72, 80], toko: [12, 36, 30] },
];

export const SUPPLIERS = [
  'PT Semen Nusantara Contoh',
  'CV Baja Timur Contoh',
  'PT Warna Cerah Contoh',
  'PT Pipa Jaya Contoh',
  'UD Sumber Material Contoh',
];

export const CUSTOMERS = [
  ['Toko Sinar Harapan', 'sinar.harapan@example.com'],
  ['CV Karya Mandiri', 'karya.mandiri@example.com'],
  ['PT Griya Lestari', 'griya.lestari@example.com'],
  ['UD Maju Bersama', 'maju.bersama@example.com'],
  ['Bapak Andi (Kontraktor)', 'andi.kontraktor@example.com'],
  ['Ibu Sari Renovasi', 'sari.renovasi@example.com'],
  ['CV Anugerah Bangun', 'anugerah.bangun@example.com'],
  ['Koperasi Warga Sejahtera', 'koperasi.sejahtera@example.com'],
  ['PT Cipta Hunian', 'cipta.hunian@example.com'],
];

// age: dibuat berapa hari lalu. term: hari sampai jatuh tempo.
// age > term berarti sudah lewat jatuh tempo. paid: dilunasi (Payment Entry).
export const INVOICES = [
  { id: 'SI-01', customer: 'Toko Sinar Harapan', age: 60, term: 30, lines: [['SMN-PC-50', 40], ['BSI-10', 25]] },
  { id: 'SI-02', customer: 'CV Karya Mandiri', age: 45, term: 14, lines: [['CAT-TMB-25', 4], ['PLM-TMB', 6]] },
  { id: 'SI-03', customer: 'PT Griya Lestari', age: 30, term: 14, lines: [['KRM-40', 35], ['SMN-PTH-40', 3]] },
  { id: 'SI-04', customer: 'UD Maju Bersama', age: 20, term: 7, lines: [['PPA-AW-3', 6], ['LEM-PPA', 10]] },
  { id: 'SI-05', customer: 'Bapak Andi (Kontraktor)', age: 10, term: 7, lines: [['SNG-GLB', 30], ['PKU-05', 5]] },
  { id: 'SI-06', customer: 'Ibu Sari Renovasi', age: 40, term: 14, paid: true, lines: [['TRP-9', 8], ['CAT-KYB-1', 4]] },
  { id: 'SI-07', customer: 'CV Anugerah Bangun', age: 5, term: 30, lines: [['BSI-12', 20], ['KWT-BDR', 6]] },
  { id: 'SI-08', customer: 'Koperasi Warga Sejahtera', age: 3, term: 14, lines: [['SMN-PC-50', 15], ['PSR-CR', 2]] },
  { id: 'SI-09', customer: 'PT Cipta Hunian', age: 0, term: 30, lines: [['KBL-NYM', 3], ['KRN-AIR', 10]] },
  { id: 'SI-10', customer: 'Toko Sinar Harapan', age: 0, term: 0, paid: true, lines: [['PPA-AW-12', 12]] },
];
