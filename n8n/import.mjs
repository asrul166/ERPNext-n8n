// Memasang credential dan workflow ke n8n dari .env: node n8n/import.mjs
// Rahasia dikirim lewat stdin ke container; tidak pernah ditulis ke disk host.
import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { env } from '../seed/lib.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const workflowDir = fileURLToPath(new URL('./workflows/', import.meta.url));
const CONTAINER = 'bjm-n8n-1';
// Workflow yang diaktifkan (jadwal / error trigger). Cek koneksi hanya manual.
const PUBLISH = ['bjmStokMenipis01', 'bjmErrorHandler1'];

const docker = (args, options = {}) => execFileSync('docker', args, { cwd: root, encoding: 'utf8', ...options });
const compose = (...args) => docker(['compose', '--env-file', '.env', '-f', 'docker/compose.yaml', ...args], { stdio: 'inherit' });
const n8n = (...args) => docker(['exec', CONTAINER, 'n8n', ...args]);

function importJson(command, json) {
  const script = `cat > /tmp/import.json && n8n ${command} --input=/tmp/import.json; code=$?; rm -f /tmp/import.json; exit $code`;
  docker(['exec', '-i', CONTAINER, 'sh', '-c', script], { input: json, stdio: ['pipe', 'inherit', 'inherit'] });
}

async function waitForN8n() {
  const url = `http://localhost:${env.N8N_PORT || 5678}/healthz/readiness`;
  for (let i = 0; i < 60; i += 1) {
    try {
      if ((await fetch(url)).ok) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 2000));
  }
  throw new Error('n8n tidak siap.');
}

if (!env.ERPNEXT_API_KEY || !env.ERPNEXT_API_SECRET) {
  throw new Error('API key ERPNext belum ada di .env. Jalankan dulu: node seed/index.mjs');
}
const telegramReady = Boolean(env.TELEGRAM_BOT_TOKEN && env.TELEGRAM_CHAT_ID);

// Membuat ulang container bila .env berubah (misalnya TELEGRAM_CHAT_ID baru diisi).
compose('up', '-d', '--no-deps', 'n8n');
await waitForN8n();

const credentials = [
  {
    id: 'bjmErpNextAuth01',
    name: 'ERPNext n8n-bot',
    type: 'httpHeaderAuth',
    data: { name: 'Authorization', value: `token ${env.ERPNEXT_API_KEY}:${env.ERPNEXT_API_SECRET}` },
  },
];
if (env.TELEGRAM_BOT_TOKEN) {
  credentials.push({
    id: 'bjmTelegramBot01',
    name: 'Telegram BJM',
    type: 'telegramApi',
    data: { accessToken: env.TELEGRAM_BOT_TOKEN },
  });
}
importJson('import:credentials', JSON.stringify(credentials));

for (const file of readdirSync(workflowDir).filter((f) => f.endsWith('.json'))) {
  importJson('import:workflow', readFileSync(workflowDir + file, 'utf8'));
}

if (telegramReady) {
  for (const id of PUBLISH) {
    try {
      n8n('publish:workflow', `--id=${id}`);
    } catch (err) {
      console.error(`Gagal publish ${id}: ${err.stderr || err.message}`);
    }
  }
  // Perubahan status aktif dari CLI baru berlaku setelah n8n dimulai ulang.
  compose('restart', 'n8n');
  await waitForN8n();
  const active = n8n('list:workflow', '--active=true', '--onlyId').split(/\s+/);
  const inactive = PUBLISH.filter((id) => !active.includes(id));
  if (inactive.length) throw new Error(`Workflow belum aktif: ${inactive.join(', ')}`);
  console.log(`Selesai. Aktif: ${PUBLISH.join(', ')}`);
} else {
  console.log('Selesai, tetapi TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID di .env belum lengkap:');
  console.log('workflow TIDAK diaktifkan. Isi lalu jalankan skrip ini lagi.');
}
