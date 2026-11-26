// Alat bantu uji/demo:
//   node seed/stock.mjs SMN-PC-50 utama 40   -> jadikan stok fisik = 40
//   node seed/stock.mjs reset                -> kembalikan stok awal, hapus Material Request
import { COMPANY, WAREHOUSES, warehouseName } from './config.mjs';
import { ITEMS } from './data.mjs';
import { call, create, list, login, submit } from './lib.mjs';

const WAREHOUSE_KEYS = { utama: warehouseName(WAREHOUSES[0]), toko: warehouseName(WAREHOUSES[1]) };

async function setStock(itemCode, key, target) {
  const item = ITEMS.find((i) => i.code === itemCode);
  const warehouse = WAREHOUSE_KEYS[key];
  if (!item || !warehouse || !Number.isFinite(target) || target < 0) {
    throw new Error('Pakai: node seed/stock.mjs <KODE> <utama|toko> <qty>  atau  reset');
  }
  const [bin] = await list('Bin', {
    filters: [
      ['item_code', '=', itemCode],
      ['warehouse', '=', warehouse],
    ],
    fields: ['actual_qty'],
  });
  const diff = target - (bin?.actual_qty ?? 0);
  if (diff === 0) return;
  const receipt = diff > 0;
  const entry = await create('Stock Entry', {
    stock_entry_type: receipt ? 'Material Receipt' : 'Material Issue',
    company: COMPANY,
    remarks: 'SEED-BJM:uji',
    items: [
      {
        item_code: itemCode,
        qty: Math.abs(diff),
        [receipt ? 't_warehouse' : 's_warehouse']: warehouse,
        ...(receipt ? { basic_rate: item.buy } : {}),
      },
    ],
  });
  await submit('Stock Entry', entry.name);
  console.log(`${itemCode} @ ${warehouse}: ${target - diff} -> ${target}`);
}

async function reset() {
  for (const mr of await list('Material Request', { fields: ['name', 'docstatus'] })) {
    if (mr.docstatus === 1) await call('frappe.client.cancel', { doctype: 'Material Request', name: mr.name });
    await call('frappe.client.delete', { doctype: 'Material Request', name: mr.name });
    console.log(`hapus ${mr.name}`);
  }
  for (const item of ITEMS) {
    for (const key of Object.keys(WAREHOUSE_KEYS)) {
      if (item[key]) await setStock(item.code, key, item[key][2]);
    }
  }
  console.log('Stok kembali ke kondisi awal.');
}

await login();
const [first, key, qty] = process.argv.slice(2);
if (first === 'reset') await reset();
else await setStock(first, key, Number(qty ?? NaN));
