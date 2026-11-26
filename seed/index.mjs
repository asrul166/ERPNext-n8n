// Satu perintah: node seed/index.mjs
import setup from './00-setup.mjs';
import seedData from './20-data.mjs';
import { BASE_URL, login, waitForSite } from './lib.mjs';

console.log(`Menunggu ERPNext di ${BASE_URL} ...`);
await waitForSite();
await login();

console.log('Setup perusahaan');
await setup();
console.log('Data contoh');
await seedData();
console.log('Selesai.');
