// Fase 2: barang, supplier, pelanggan, stok awal, invoice. Aman dijalankan berulang:
// master dicek lewat nama, transaksi lewat penanda tetap di field remarks / reference_no.
import { COMPANY, TIMEZONE, WAREHOUSES, warehouseName } from './config.mjs';
import { CUSTOMERS, INVOICES, ITEMS, ITEM_GROUPS, SUPPLIERS, UOMS } from './data.mjs';
import { call, create, ensure, get, list, submit } from './lib.mjs';

const MARK = 'SEED-BJM';
const WAREHOUSE_KEYS = { utama: warehouseName(WAREHOUSES[0]), toko: warehouseName(WAREHOUSES[1]) };

const today = new Intl.DateTimeFormat('en-CA', { timeZone: TIMEZONE }).format(new Date());

function addDays(date, days) {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

async function ensureFiscalYear(date) {
  const covering = await list('Fiscal Year', {
    filters: [
      ['year_start_date', '<=', date],
      ['year_end_date', '>=', date],
    ],
  });
  if (covering.length) return;
  const year = date.slice(0, 4);
  await create('Fiscal Year', { year, year_start_date: `${year}-01-01`, year_end_date: `${year}-12-31` });
}

async function seedMasters() {
  for (const uom of UOMS) await ensure('UOM', uom, { uom_name: uom });

  const [rootGroup] = await list('Item Group', {
    filters: [
      ['is_group', '=', 1],
      ['parent_item_group', '=', ''],
    ],
  });
  for (const group of ITEM_GROUPS) {
    await ensure('Item Group', group, { item_group_name: group, parent_item_group: rootGroup.name });
  }

  for (const name of SUPPLIERS) {
    await ensure('Supplier', name, { supplier_name: name, supplier_type: 'Company' });
  }

  for (const [name, email] of CUSTOMERS) {
    // email_id saat insert membuat ERPNext otomatis membuat kontak utama.
    await ensure('Customer', name, { customer_name: name, customer_type: 'Company', email_id: email });
  }

  for (const item of ITEMS) {
    const reorderLevels = Object.entries(WAREHOUSE_KEYS)
      .filter(([key]) => item[key])
      .map(([key, warehouse]) => ({
        warehouse,
        warehouse_reorder_level: item[key][0],
        warehouse_reorder_qty: item[key][1],
        material_request_type: 'Purchase',
      }));
    await ensure('Item', item.code, {
      item_code: item.code,
      item_name: item.name,
      item_group: item.group,
      stock_uom: item.uom,
      is_stock_item: 1,
      valuation_rate: item.buy,
      standard_rate: item.sell,
      reorder_levels: reorderLevels,
      item_defaults: [{ company: COMPANY, default_warehouse: WAREHOUSE_KEYS.utama, default_supplier: item.supplier }],
    });
  }
  console.log(`- ${ITEMS.length} barang, ${SUPPLIERS.length} supplier, ${CUSTOMERS.length} pelanggan`);
}

/** Cari dokumen berpenanda; submit jika masih draf (sisa run yang gagal). */
async function once(doctype, field, marker, build) {
  const [found] = await list(doctype, {
    filters: [
      [field, '=', marker],
      ['docstatus', '<', 2],
    ],
    fields: ['name', 'docstatus'],
  });
  if (found) {
    if (found.docstatus === 0) await submit(doctype, found.name);
    return found.name;
  }
  const doc = await create(doctype, await build());
  await submit(doctype, doc.name);
  return doc.name;
}

async function seedOpeningStock() {
  const marker = `${MARK}:stok-awal`;
  await once('Stock Entry', 'remarks', marker, () => ({
    stock_entry_type: 'Material Receipt',
    company: COMPANY,
    remarks: marker,
    items: Object.entries(WAREHOUSE_KEYS).flatMap(([key, warehouse]) =>
      ITEMS.filter((i) => i[key]).map((i) => ({
        item_code: i.code,
        qty: i[key][2],
        t_warehouse: warehouse,
        basic_rate: i.buy,
      })),
    ),
  }));
  console.log('- stok awal');
}

async function seedInvoices() {
  const prices = Object.fromEntries(ITEMS.map((i) => [i.code, i.sell]));

  for (const inv of INVOICES) {
    const marker = `${MARK}:${inv.id}`;
    const postingDate = addDays(today, -inv.age);
    await ensureFiscalYear(postingDate);

    const name = await once('Sales Invoice', 'remarks', marker, () => ({
      company: COMPANY,
      customer: inv.customer,
      set_posting_time: 1,
      posting_date: postingDate,
      due_date: addDays(postingDate, inv.term),
      update_stock: 0,
      remarks: marker,
      items: inv.lines.map(([code, qty]) => ({ item_code: code, qty, rate: prices[code] })),
    }));

    if (!inv.paid) continue;
    const invoice = await get('Sales Invoice', name);
    if (Number(invoice.outstanding_amount) <= 0) continue;

    await once('Payment Entry', 'reference_no', marker, async () => {
      const draft = await call('erpnext.accounts.doctype.payment_entry.payment_entry.get_payment_entry', {
        dt: 'Sales Invoice',
        dn: name,
      });
      // SI-06 dibayar seminggu setelah terbit, penjualan hari ini dibayar hari ini.
      const paidOn = addDays(postingDate, Math.min(inv.age, 7));
      return { ...draft, posting_date: paidOn, reference_no: marker, reference_date: paidOn };
    });
  }
  console.log(`- ${INVOICES.length} sales invoice`);
}

export default async function seedData() {
  await seedMasters();
  await ensureFiscalYear(today);
  await seedOpeningStock();
  await seedInvoices();
}
