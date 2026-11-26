// Fase 3: user khusus untuk n8n dengan hak seperlunya. Aman dijalankan berulang.
import { BASE_URL, call, create, ensure, env, get, setEnv, update } from './lib.mjs';

const ROLE = 'n8n Bot';
export const BOT_USER = 'n8n-bot@example.com';

// Hanya yang dibutuhkan. Tambah izin baru di sini bila sebuah workflow benar-benar memerlukannya.
const PERMISSIONS = {
  Item: ['read'],
  Bin: ['read'],
  'Sales Invoice': ['read'],
  'Payment Entry': ['read'],
  Customer: ['read'],
  'Material Request': ['read', 'create'],
};

// Izin yang secara bawaan bisa ikut menyala dan harus dipastikan mati.
const OTHERS = ['write', 'create', 'delete', 'submit', 'cancel', 'amend', 'report', 'export', 'import', 'share', 'print', 'email'];

const manager = 'frappe.core.page.permission_manager.permission_manager';

async function ensurePermissions() {
  for (const [doctype, allowed] of Object.entries(PERMISSIONS)) {
    const existing = await call(`${manager}.get_permissions`, { doctype, role: ROLE });
    // Lewat Role Permission Manager: izin standar role lain disalin dulu, tidak tertimpa.
    if (!existing.some((p) => p.permlevel === 0)) {
      await call(`${manager}.add`, { parent: doctype, role: ROLE, permlevel: 0 });
    }
    const [current] = await call(`${manager}.get_permissions`, { doctype, role: ROLE });
    for (const ptype of new Set([...allowed, ...OTHERS])) {
      const wanted = allowed.includes(ptype) ? 1 : 0;
      if ((current[ptype] ?? 0) === wanted) continue;
      await call(`${manager}.update`, { doctype, role: ROLE, permlevel: 0, ptype, value: String(wanted) });
    }
  }
}

async function keysWork() {
  if (!env.ERPNEXT_API_KEY || !env.ERPNEXT_API_SECRET) return false;
  const res = await fetch(`${BASE_URL}/api/method/frappe.auth.get_logged_user`, {
    headers: { Authorization: `token ${env.ERPNEXT_API_KEY}:${env.ERPNEXT_API_SECRET}` },
  });
  return res.ok && (await res.json()).message === BOT_USER;
}

export default async function setupApiUser() {
  await ensure('Role', ROLE, { role_name: ROLE, desk_access: 1 });
  await ensurePermissions();

  if (!(await get('User', BOT_USER))) {
    await create('User', {
      email: BOT_USER,
      username: 'n8n-bot',
      first_name: 'n8n-bot',
      send_welcome_email: 0,
      language: 'id',
    });
  }
  // Ditulis ulang setiap run: role user ini persis satu.
  await update('User', BOT_USER, { roles: [{ role: ROLE }] });

  if (await keysWork()) {
    console.log('- API key di .env masih berlaku');
    return;
  }
  const generated = await call('frappe.core.doctype.user.user.generate_keys', { user: BOT_USER });
  const { api_key: apiKey } = await get('User', BOT_USER);
  setEnv('ERPNEXT_API_KEY', apiKey);
  setEnv('ERPNEXT_API_SECRET', generated.api_secret);
  env.ERPNEXT_API_KEY = apiKey;
  env.ERPNEXT_API_SECRET = generated.api_secret;
  console.log('- API key baru ditulis ke .env');
}
