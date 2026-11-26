// Ringkasan kondisi data, untuk memeriksa hasil seed: node seed/verify.mjs
import { COMPANY } from './config.mjs';
import { get, list, login } from './lib.mjs';

await login();

const count = async (doctype) => (await list(doctype)).length;
const counts = {};
for (const d of ['Company', 'Warehouse', 'Item', 'Supplier', 'Customer', 'Contact', 'Stock Entry', 'Sales Invoice', 'Payment Entry', 'Material Request']) {
  counts[d] = await count(d);
}
console.log(counts);

const stock = await get('Stock Settings', 'Stock Settings');
const system = await get('System Settings', 'System Settings');
const company = await get('Company', COMPANY);
console.log({
  auto_indent: stock.auto_indent,
  time_zone: system.time_zone,
  language: system.language,
  currency: company.default_currency,
});

// Pasangan barang+gudang yang saat ini di bawah atau sama dengan reorder level.
const bins = await list('Bin', { fields: ['item_code', 'warehouse', 'projected_qty'] });
const low = [];
let pairs = 0;
for (const { name } of await list('Item')) {
  const item = await get('Item', name);
  for (const r of item.reorder_levels ?? []) {
    pairs += 1;
    const qty = bins.find((b) => b.item_code === name && b.warehouse === r.warehouse)?.projected_qty ?? 0;
    if (qty <= r.warehouse_reorder_level) low.push(`${name} @ ${r.warehouse}: ${qty} <= ${r.warehouse_reorder_level}`);
  }
}
console.log(`${pairs} baris reorder, ${low.length} di bawah batas`, low);

const invoices = await list('Sales Invoice', {
  fields: ['remarks', 'customer', 'posting_date', 'due_date', 'status', 'grand_total', 'outstanding_amount', 'contact_email'],
  orderBy: 'remarks asc',
});
console.table(invoices);
