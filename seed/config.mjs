// Identitas perusahaan contoh (fiktif).
export const COMPANY = 'CV. Bangunan Jaya Makmur';
export const ABBR = 'BJM';
export const TIMEZONE = 'Asia/Makassar';

const year = new Intl.DateTimeFormat('en-CA', { timeZone: TIMEZONE, year: 'numeric' }).format(new Date());
export const FISCAL_YEAR = { start: `${year}-01-01`, end: `${year}-12-31` };

export const WAREHOUSES = ['Gudang Utama', 'Toko'];
export const warehouseName = (label) => `${label} - ${ABBR}`;
