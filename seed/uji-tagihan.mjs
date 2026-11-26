// Uji workflow tagihan jatuh tempo (butuh Mailpit). Menghapus isi Mailpit dan log pengingat.
//   node seed/uji-tagihan.mjs
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { call, env, list, login, update } from './lib.mjs';

const LOG = 'Log Pengingat Tagihan';
const MAILPIT = `http://localhost:${env.MAILPIT_PORT || 8025}/api/v1`;
const root = fileURLToPath(new URL('..', import.meta.url));

await login();

const run = () => execFileSync('python', ['n8n/run-workflow.py', 'bjmTagihan000001'], { cwd: root, encoding: 'utf8' });
const mails = async () => (await (await fetch(`${MAILPIT}/messages?limit=200`)).json()).messages;
const logs = () => list(LOG, { fields: ['name', 'sales_invoice', 'reminded_on'] });
const invoices = await list('Sales Invoice', { fields: ['name', 'remarks', 'contact_email'] });
const idOf = (invoiceName) => invoices.find((i) => i.name === invoiceName)?.remarks.replace('SEED-BJM:', '');
const reminded = async () => (await logs()).map((l) => idOf(l.sales_invoice)).sort();

let failed = 0;
const check = (label, actual, expected) => {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failed += 1;
  console.log(`${ok ? 'LOLOS' : 'GAGAL'}  ${label}: ${JSON.stringify(actual)}${ok ? '' : ` (harap ${JSON.stringify(expected)})`}`);
};
const daysAgo = (days) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Makassar' }).format(new Date(Date.now() - days * 86_400_000));

for (const l of await logs()) await call('frappe.client.delete', { doctype: LOG, name: l.name });
await fetch(`${MAILPIT}/messages`, { method: 'DELETE' });

const overdue = ['SI-01', 'SI-02', 'SI-03', 'SI-04', 'SI-05'];
run();
const first = await mails();
check('run 1: invoice yang diingatkan', await reminded(), overdue);
check('run 1: jumlah email', first.length, 5);
const emailOf = (id) => invoices.find((i) => i.remarks === `SEED-BJM:${id}`).contact_email;
check('run 1: penerima', first.map((m) => m.To[0].Address).sort(), overdue.map(emailOf).sort());

run();
check('run 2 (hari yang sama): email tidak bertambah', (await mails()).length, 5);
check('run 2: log tidak bertambah', (await logs()).length, 5);

// Batas 7 hari: log berumur 6 hari masih dilewati, 7 hari diingatkan lagi.
const target = (await logs()).find((l) => idOf(l.sales_invoice) === 'SI-01');
const backdate = (days) => update(LOG, target.name, { reminded_on: daysAgo(days) });
await backdate(6);
run();
check('log berumur 6 hari: tidak dikirim', (await mails()).length, 5);
// Kunci unik berisi tanggal asli; samakan dengan tanggal mundur agar log hari ini bisa dibuat.
await update(LOG, target.name, { reminded_on: daysAgo(7), reminder_key: `${target.sales_invoice}|${daysAgo(7)}` });
run();
const after = await mails();
check('log berumur 7 hari: dikirim lagi', after.length, 6);
check('penerima kiriman ulang', after[0].To[0].Address, emailOf('SI-01'));

console.log(failed ? `${failed} pemeriksaan gagal` : 'Semua pemeriksaan lolos');
process.exitCode = failed ? 1 : 0;
