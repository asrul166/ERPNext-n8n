// Mencocokkan angka workflow laporan harian dengan laporan bawaan ERPNext.
//   node seed/uji-laporan.mjs                     # hari ini dan hari tanpa transaksi (hanya membaca ERPNext)
//   node seed/uji-laporan.mjs --transaksi-uji     # plus retur dan pembatalan; HANYA di instance uji,
//                                                 # karena meninggalkan dokumen yang tidak bisa dihapus
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { COMPANY, TIMEZONE } from './config.mjs';
import { call, create, list, login, submit } from './lib.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const UJI_ID = 'bjmUjiLaporan001';
const dayOf = (date) => new Intl.DateTimeFormat('en-CA', { timeZone: TIMEZONE }).format(date);
const today = dayOf(new Date());
const tomorrow = dayOf(new Date(Date.now() + 86_400_000));

const sh = (cmd, args, options = {}) => execFileSync(cmd, args, { cwd: root, encoding: 'utf8', ...options });
const container = sh('docker', ['compose', '--env-file', '.env', '-f', 'docker/compose.yaml', 'ps', '-q', 'n8n']).trim();

/** Menjalankan salinan workflow laporan dengan tanggal tertentu, mengembalikan angkanya. */
function workflowNumbers(date) {
  const wf = JSON.parse(readFileSync(new URL('../n8n/workflows/laporan-harian.json', import.meta.url), 'utf8'));
  wf.id = UJI_ID;
  wf.name = 'UJI - Laporan Harian';
  wf.nodes.find((n) => n.name === 'Tanggal Laporan').parameters.assignments.assignments[0].value = date;
  sh('docker', ['exec', '-i', container, 'sh', '-c', 'cat > /tmp/w.json && n8n import:workflow --input=/tmp/w.json; rm -f /tmp/w.json'], {
    input: JSON.stringify(wf),
  });
  const output = sh('python', ['n8n/run-workflow.py', UJI_ID]);
  if (!/Kirim ke Pemilik: 1 item\s*$/m.test(output)) throw new Error(`Pesan tidak terkirim:\n${output}`);
  const number = (label) => {
    const m = output.match(new RegExp(`${label}: <b>(-?)(?:Rp )?([\\d.]+)</b>`));
    if (!m) throw new Error(`"${label}" tidak ada di pesan:\n${output}`);
    return Number(m[1] + m[2].replaceAll('.', ''));
  };
  return {
    penjualan: number('Penjualan'),
    kas: number('Kas masuk'),
    piutang: number('Piutang lewat jatuh tempo'),
    stok: number('Barang di bawah batas minimum'),
  };
}

const report = async (name, filters) =>
  (await call('frappe.desk.query_report.run', { report_name: name, filters, ignore_prepared_report: 1 })).result.filter(
    (row) => !Array.isArray(row), // baris total berbentuk array
  );
const sum = (rows, field) => Math.round(rows.reduce((total, r) => total + (r[field] ?? 0), 0));

/** Angka yang sama, diambil dari laporan bawaan ERPNext. */
async function erpNumbers(date) {
  const period = { company: COMPANY, from_date: date, to_date: date };
  const sales = await report('Sales Register', period);
  const cashAccounts = new Set(
    (await list('Account', { filters: [['company', '=', COMPANY], ['account_type', 'in', ['Cash', 'Bank']]] })).map((a) => a.name),
  );
  const ledger = (await report('General Ledger', { ...period, group_by: '' })).filter(
    (r) => cashAccounts.has(r.account) && r.voucher_type === 'Payment Entry',
  );
  const receivable = (
    await report('Accounts Receivable', { company: COMPANY, report_date: date, ageing_based_on: 'Due Date', range: '30, 60, 90, 120' })
  ).filter((r) => r.voucher_type === 'Sales Invoice' && r.due_date < date);
  const stock = (await report('Stock Projected Qty', { company: COMPANY })).filter(
    (r) => r.re_order_level > 0 && r.projected_qty <= r.re_order_level,
  );
  return {
    penjualan: sum(sales, 'grand_total'),
    kas: sum(ledger, 'debit'),
    piutang: sum(receivable, 'outstanding'),
    stok: stock.length,
  };
}

let failed = 0;
async function compare(label, date) {
  const [n8n, erp] = [workflowNumbers(date), await erpNumbers(date)];
  const ok = JSON.stringify(n8n) === JSON.stringify(erp);
  if (!ok) failed += 1;
  console.log(`${ok ? 'COCOK' : 'BEDA '}  ${label} (${date})\n       n8n    ${JSON.stringify(n8n)}\n       ERPNext ${JSON.stringify(erp)}`);
  return n8n;
}

async function invoice(qty) {
  const doc = await create('Sales Invoice', {
    company: COMPANY,
    customer: 'PT Cipta Hunian',
    update_stock: 0,
    remarks: 'SEED-BJM:uji',
    items: [{ item_code: 'SMN-PC-50', qty, rate: 66000 }],
  });
  await submit('Sales Invoice', doc.name);
  return doc.name;
}

await login();
const base = await compare('hari ini', today);
const zero = await compare('hari tanpa transaksi', tomorrow);
if (zero.penjualan !== 0 || zero.kas !== 0) failed += 1;

if (process.argv.includes('--transaksi-uji')) {
  // Retur sebagian: 10 sak dijual, 4 diretur -> penjualan bersih +6 sak.
  const sold = await invoice(10);
  const draft = await call('erpnext.accounts.doctype.sales_invoice.sales_invoice.make_sales_return', { source_name: sold });
  draft.items[0].qty = -4;
  const ret = await create('Sales Invoice', { ...draft, remarks: 'SEED-BJM:uji' });
  await submit('Sales Invoice', ret.name);

  // Invoice dibatalkan: tidak boleh terhitung.
  await call('frappe.client.cancel', { doctype: 'Sales Invoice', name: await invoice(7) });

  // Pembayaran dibatalkan: tidak boleh terhitung sebagai kas masuk.
  const paid = await invoice(3);
  const entry = await call('erpnext.accounts.doctype.payment_entry.payment_entry.get_payment_entry', {
    dt: 'Sales Invoice',
    dn: paid,
  });
  const payment = await create('Payment Entry', { ...entry, reference_no: 'SEED-BJM:uji', reference_date: today });
  await submit('Payment Entry', payment.name);
  await call('frappe.client.cancel', { doctype: 'Payment Entry', name: payment.name });

  const after = await compare('setelah retur dan pembatalan', today);
  const expected = base.penjualan + (10 - 4 + 3) * 66000;
  const ok = after.penjualan === expected && after.kas === base.kas;
  if (!ok) failed += 1;
  console.log(`${ok ? 'LOLOS' : 'GAGAL'}  penjualan naik tepat 9 sak (${expected}) dan kas masuk tetap`);

  // Retur atas invoice yang sudah lewat jatuh tempo.
  const [overdue] = await list('Sales Invoice', { filters: [['remarks', '=', 'SEED-BJM:SI-03']] });
  const creditDraft = await call('erpnext.accounts.doctype.sales_invoice.sales_invoice.make_sales_return', {
    source_name: overdue.name,
  });
  creditDraft.items = [{ ...creditDraft.items[0], qty: -5 }];
  const credit = await create('Sales Invoice', { ...creditDraft, remarks: 'SEED-BJM:uji' });
  await submit('Sales Invoice', credit.name);
  await compare('setelah retur invoice lewat tempo', today);
}

console.log(failed ? `${failed} pemeriksaan gagal` : 'Semua pemeriksaan lolos');
process.exitCode = failed ? 1 : 0;
