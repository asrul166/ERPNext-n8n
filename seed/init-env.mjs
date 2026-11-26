// Membuat .env dari .env.example dengan rahasia acak. Tidak menimpa .env yang sudah ada.
import { randomBytes } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const envPath = fileURLToPath(new URL('../.env', import.meta.url));
const examplePath = fileURLToPath(new URL('../.env.example', import.meta.url));

if (existsSync(envPath)) {
  console.log('.env sudah ada, tidak diubah.');
} else {
  let text = readFileSync(examplePath, 'utf8');
  for (const key of ['DB_ROOT_PASSWORD', 'ADMIN_PASSWORD', 'N8N_ENCRYPTION_KEY']) {
    const value = randomBytes(24).toString('base64url');
    // Awalan huruf: nilai yang diawali "-" bisa dikira opsi oleh perintah bench.
    text = text.replace(new RegExp(`^${key}=.*$`, 'm'), `${key}=k${value}`);
  }
  writeFileSync(envPath, text);
  console.log('.env dibuat. Password Administrator ada di ADMIN_PASSWORD.');
}
