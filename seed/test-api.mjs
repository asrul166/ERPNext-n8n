// Menguji hak user n8n-bot: yang dibutuhkan lolos, yang lain ditolak. node seed/test-api.mjs
import { BASE_URL, env } from './lib.mjs';

const headers = {
  Authorization: `token ${env.ERPNEXT_API_KEY}:${env.ERPNEXT_API_SECRET}`,
  'Content-Type': 'application/json',
  Accept: 'application/json',
};

const cases = [
  ['GET', 'Item?limit_page_length=5', 200],
  ['GET', 'Item/SMN-PC-50', 200],
  ['GET', 'Bin?limit_page_length=5', 200],
  ['GET', 'Sales Invoice?limit_page_length=5', 200],
  ['GET', 'Payment Entry?limit_page_length=5', 200],
  ['GET', 'Customer?limit_page_length=5', 200],
  ['GET', 'Material Request?limit_page_length=5', 200],
  ['DELETE', 'Item/SMN-PC-50', 403],
  ['PUT', 'Item/SMN-PC-50', 403, { description: 'tidak boleh' }],
  ['POST', 'Item', 403, { item_code: 'UJI-TOLAK', item_group: 'Perlengkapan', stock_uom: 'Buah' }],
  ['PUT', 'Customer/PT Cipta Hunian', 403, { customer_name: 'tidak boleh' }],
  ['GET', 'User/Administrator', 403],
  ['GET', 'Purchase Order?limit_page_length=1', 403],
];

let failed = 0;

// Frappe selalu mengizinkan user melihat dirinya sendiri; yang diuji: tidak lebih dari itu.
const users = (await (await fetch(`${BASE_URL}/api/resource/User?limit_page_length=0`, { headers })).json()).data ?? [];
const onlySelf = users.every((u) => u.name.startsWith('n8n-bot@'));
if (!onlySelf) failed += 1;
console.log(`${onlySelf ? 'LOLOS' : 'GAGAL'}  daftar User hanya berisi diri sendiri (${users.length})`);
for (const [method, path, expected, body] of cases) {
  const res = await fetch(`${BASE_URL}/api/resource/${path.replaceAll(' ', '%20')}`, {
    method,
    headers,
    body: body && JSON.stringify(body),
  });
  const ok = res.status === expected;
  if (!ok) failed += 1;
  console.log(`${ok ? 'LOLOS' : 'GAGAL'}  ${method.padEnd(6)} ${path} -> ${res.status} (harap ${expected})`);
}
console.log(failed ? `${failed} kasus gagal` : 'Semua kasus lolos');
process.exitCode = failed ? 1 : 0;
