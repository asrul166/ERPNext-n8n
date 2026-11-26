// Mencari chat ID tanpa menempel token ke mana pun: node n8n/telegram-chat-id.mjs [--simpan]
// Sebelumnya: tambahkan bot ke grup uji, lalu kirim "/start@NamaBotKamu" di grup itu.
import { env, setEnv } from '../seed/lib.mjs';

if (!env.TELEGRAM_BOT_TOKEN) throw new Error('Isi TELEGRAM_BOT_TOKEN di .env dulu.');

const res = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/getUpdates`);
const body = await res.json();
if (!body.ok) throw new Error(`Telegram menolak: ${body.description}`);

const chats = new Map();
for (const update of body.result) {
  const chat = (update.message ?? update.my_chat_member ?? update.channel_post)?.chat;
  if (chat) chats.set(chat.id, `${chat.type}: ${chat.title ?? chat.username ?? chat.first_name}`);
}
if (!chats.size) {
  console.log('Belum ada pesan. Kirim "/start@NamaBotKamu" di grup, lalu jalankan lagi.');
  process.exit(0);
}
for (const [id, label] of chats) console.log(`${id}  (${label})`);

if (process.argv.includes('--simpan')) {
  const groups = [...chats].filter(([, label]) => label.startsWith('group') || label.startsWith('supergroup'));
  if (groups.length !== 1) {
    console.log('Tidak disimpan: harus tepat satu grup. Isi TELEGRAM_CHAT_ID di .env secara manual.');
  } else {
    setEnv('TELEGRAM_CHAT_ID', String(groups[0][0]));
    console.log('TELEGRAM_CHAT_ID disimpan ke .env');
  }
}
