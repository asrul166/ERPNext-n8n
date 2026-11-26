// Fase 1: setup wizard, gudang, dan pengaturan dasar. Aman dijalankan berulang.
import { COMPANY, ABBR, FISCAL_YEAR, TIMEZONE, WAREHOUSES, warehouseName } from './config.mjs';
import { call, ensure, get, list, update } from './lib.mjs';

export default async function setup() {
  if (await get('Company', COMPANY)) {
    console.log('- setup wizard sudah selesai, dilewati');
  } else {
    const [language] = await list('Language', {
      filters: [['name', '=', 'id']],
      fields: ['language_name'],
    });
    console.log('- menjalankan setup wizard (beberapa menit)...');
    await call('frappe.desk.page.setup_wizard.setup_wizard.setup_complete', {
      args: {
        language: language.language_name,
        country: 'Indonesia',
        timezone: TIMEZONE,
        currency: 'IDR',
        company_name: COMPANY,
        company_abbr: ABBR,
        chart_of_accounts: 'Standard',
        fy_start_date: FISCAL_YEAR.start,
        fy_end_date: FISCAL_YEAR.end,
        enable_telemetry: 0,
      },
    });
    if (!(await get('Company', COMPANY))) {
      throw new Error('Setup wizard selesai tetapi company tidak terbentuk.');
    }
  }

  await update('System Settings', 'System Settings', { time_zone: TIMEZONE, language: 'id' });
  await update('User', 'Administrator', { language: 'id', time_zone: TIMEZONE });

  // Setup wizard ERPNext menyalakan auto reorder bawaan. Matikan: pemesanan ulang ditangani n8n.
  await update('Stock Settings', 'Stock Settings', { auto_indent: 0, reorder_email_notify: 0 });

  const [root] = await list('Warehouse', {
    filters: [
      ['company', '=', COMPANY],
      ['is_group', '=', 1],
      ['parent_warehouse', '=', ''],
    ],
  });
  for (const label of WAREHOUSES) {
    await ensure('Warehouse', warehouseName(label), {
      warehouse_name: label,
      company: COMPANY,
      parent_warehouse: root?.name,
    });
  }
  console.log(`- gudang: ${WAREHOUSES.join(', ')}`);
}
