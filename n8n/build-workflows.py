# Sumber workflow n8n. `python n8n/build-workflows.py` menulis ulang n8n/workflows/*.json.
import json, pathlib, uuid

OUT = pathlib.Path(__file__).resolve().parent / 'workflows'
ERROR_ID = 'bjmErrorHandler1'
ERP_CRED = {'httpHeaderAuth': {'id': 'bjmErpNextAuth01', 'name': 'ERPNext n8n-bot'}}
TG_CRED = {'telegramApi': {'id': 'bjmTelegramBot01', 'name': 'Telegram BJM'}}


def node(wf, name, type_, version, x, y, params, **extra):
    return {'parameters': params, 'id': str(uuid.uuid5(uuid.NAMESPACE_URL, wf + name)),
            'name': name, 'type': type_, 'typeVersion': version, 'position': [x, y], **extra}


def get(wf, name, x, y, path, query=None, **extra):
    p = {'url': '={{ $env.ERPNEXT_URL }}' + path, 'authentication': 'genericCredentialType',
         'genericAuthType': 'httpHeaderAuth', 'options': {'timeout': 30000}}
    if query:
        p['sendQuery'] = True
        p['queryParameters'] = {'parameters': [{'name': k, 'value': v} for k, v in query.items()]}
    # Hanya membaca, jadi aman diulang.
    return node(wf, name, 'n8n-nodes-base.httpRequest', 4.2, x, y, p, credentials=ERP_CRED,
                retryOnFail=True, maxTries=3, waitBetweenTries=5000, **extra)


def code(wf, name, x, y, js):
    return node(wf, name, 'n8n-nodes-base.code', 2, x, y, {'jsCode': js.strip()})


def telegram(wf, name, x, y, chat='$env.TELEGRAM_CHAT_ID'):
    return node(wf, name, 'n8n-nodes-base.telegram', 1.2, x, y, {
        'chatId': '={{ ' + chat + ' }}', 'text': '={{ $json.text }}',
        'additionalFields': {'appendAttribution': False, 'parse_mode': 'HTML',
                             'disable_web_page_preview': True}}, credentials=TG_CRED)


def link(target):
    return {'main': [[{'node': target, 'type': 'main', 'index': 0}]]}


def chain(names):
    return {a: link(b) for a, b in zip(names, names[1:])}


def save(filename, wf_id, name, nodes, connections, error_workflow=True):
    settings = {'executionOrder': 'v1', 'timezone': 'Asia/Makassar'}
    if error_workflow:
        settings['errorWorkflow'] = ERROR_ID
    data = {'id': wf_id, 'name': name, 'nodes': nodes, 'connections': connections,
            'settings': settings, 'active': False, 'pinData': {}}
    (OUT / filename).write_text(json.dumps(data, indent=2, ensure_ascii=False) + '\n',
                                encoding='utf-8', newline='\n')


ESC = r"""const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
"""

# ---- Cek koneksi (Fase 4) ----
w = 'cek-koneksi'
nodes = [
    node(w, 'Jalankan Manual', 'n8n-nodes-base.manualTrigger', 1, 0, 0, {}),
    get(w, 'Daftar Item', 220, 0, '/api/resource/Item',
        {'fields': '["name","item_name"]', 'limit_page_length': '5'}),
    code(w, 'Susun Pesan', 440, 0, ESC + r"""
const lines = $input.first().json.data.map((i) => `• ${esc(i.item_name)} (${esc(i.name)})`);
return [{ json: { text: ['<b>Tes koneksi n8n → ERPNext</b>', ...lines].join('\n') } }];
"""),
    telegram(w, 'Kirim Telegram', 660, 0),
]
save('cek-koneksi.json', 'bjmCekKoneksi001', 'BJM - Cek Koneksi', nodes,
     chain([n['name'] for n in nodes]))

# ---- Stok menipis (Fase 5) ----
w = 'stok-menipis'
# Aturan stok menipis, dipakai oleh "stok menipis" dan "laporan harian".
LOW_STOCK = r"""
const key = (item, warehouse) => `${item}|${warehouse}`;

function lowStock(items, bins) {
  const projected = new Map(bins.map((b) => [key(b.item_code, b.warehouse), b.projected_qty]));
  const rows = [];
  for (const item of items) {
    for (const r of item.reorder_levels ?? []) {
      if (r.material_request_type !== 'Purchase') continue;
      const level = r.warehouse_reorder_level;
      let qty = r.warehouse_reorder_qty;
      if (!level && !qty) continue;
      // Belum pernah ada transaksi = tidak ada baris Bin = stok 0.
      const stock = projected.get(key(item.name, r.warehouse)) ?? 0;
      if (stock > level) continue;
      // Sama seperti ERPNext: pesanan harus cukup untuk mengembalikan stok ke atas batas.
      if (stock + qty <= level) qty += level - stock;
      rows.push({
        item_code: item.name, item_name: item.item_name, warehouse: r.warehouse,
        uom: item.stock_uom, company: item.item_defaults?.[0]?.company, stock, level, qty,
      });
    }
  }
  return rows;
}
"""

saring = LOW_STOCK + r"""
const items = $('Detail Item').all().map((i) => i.json.data);
const bins = $('Stok per Gudang').first().json.data;
const open = $('MR Belum Selesai').first().json.data;
const pending = new Set(open.map((r) => key(r.item_code, r.warehouse)));

const rows = lowStock(items, bins).filter((r) => r.qty > 0 && !pending.has(key(r.item_code, r.warehouse)));

// Tidak ada yang perlu dipesan: alur berhenti di sini, tanpa dokumen dan tanpa pesan.
if (!rows.length) return [];

const today = $now.toFormat('yyyy-MM-dd');
const needBy = $now.plus({ days: 7 }).toFormat('yyyy-MM-dd');
const body = {
  material_request_type: 'Purchase',
  company: rows[0].company,
  transaction_date: today,
  schedule_date: needBy,
  items: rows.map((r) => ({
    item_code: r.item_code, qty: r.qty, warehouse: r.warehouse, schedule_date: needBy,
    uom: r.uom, stock_uom: r.uom, conversion_factor: 1,
  })),
};
return [{ json: { body, rows } }];
"""
pesan = ESC + r"""
const rows = $('Saring Stok Menipis').first().json.rows;
const name = $input.first().json.data.name;
const MAX = 30;
const lines = rows.slice(0, MAX).map((r) =>
  `• <b>${esc(r.item_name)}</b> (${esc(r.warehouse)})\n  stok ${r.stock}, batas ${r.level} → minta ${r.qty} ${esc(r.uom)}`);
if (rows.length > MAX) lines.push(`… dan ${rows.length - MAX} baris lagi`);
const url = `${$env.ERPNEXT_PUBLIC_URL}/desk/material-request/${encodeURIComponent(name)}`;
return [{ json: { text: [
  `📦 <b>Stok menipis: ${rows.length} baris</b>`,
  ...lines,
  '',
  `Draf Material Request: ${esc(name)}`,
  url,
].join('\n') } }];
"""
nodes = [
    node(w, 'Tiap Pagi 08.00', 'n8n-nodes-base.scheduleTrigger', 1.2, 0, 0,
         {'rule': {'interval': [{'field': 'days', 'triggerAtHour': 8}]}}),
    node(w, 'Jalankan Manual', 'n8n-nodes-base.manualTrigger', 1, 0, 200, {}),
    get(w, 'Daftar Item', 220, 0, '/api/resource/Item', {
        'filters': '[["disabled","=",0],["is_stock_item","=",1]]', 'limit_page_length': '0'}),
    node(w, 'Pisah per Item', 'n8n-nodes-base.splitOut', 1, 440, 0,
         {'fieldToSplitOut': 'data', 'options': {}}),
    get(w, 'Detail Item', 660, 0, '/api/resource/Item/{{ encodeURIComponent($json.name) }}'),
    get(w, 'Stok per Gudang', 880, 0, '/api/resource/Bin', {
        'fields': '["item_code","warehouse","projected_qty"]', 'limit_page_length': '0'},
        executeOnce=True),
    get(w, 'MR Belum Selesai', 1100, 0, '/api/resource/Material%20Request', {
        'fields': '["name","status","items.item_code","items.warehouse"]',
        'filters': '[["docstatus","<",2],["material_request_type","=","Purchase"],'
                   '["status","not in",["Stopped","Cancelled","Received","Transferred","Issued","Manufactured"]]]',
        'limit_page_length': '0'}, executeOnce=True),
    code(w, 'Saring Stok Menipis', 1320, 0, saring),
    # Tidak diulang otomatis: POST yang diulang bisa membuat dokumen dobel.
    node(w, 'Buat Draf Material Request', 'n8n-nodes-base.httpRequest', 4.2, 1540, 0, {
        'method': 'POST', 'url': '={{ $env.ERPNEXT_URL }}/api/resource/Material%20Request',
        'authentication': 'genericCredentialType', 'genericAuthType': 'httpHeaderAuth',
        'sendBody': True, 'specifyBody': 'json', 'jsonBody': '={{ JSON.stringify($json.body) }}',
        'options': {'timeout': 30000}}, credentials=ERP_CRED),
    code(w, 'Susun Pesan', 1760, 0, pesan),
    telegram(w, 'Kirim Telegram', 1980, 0),
]
conn = chain([n['name'] for n in nodes if n['name'] != 'Jalankan Manual'])
conn['Jalankan Manual'] = link('Daftar Item')
save('stok-menipis.json', 'bjmStokMenipis01', 'BJM - Stok Menipis', nodes, conn)

# ---- Workflow error (Fase 6) ----
w = 'error-handler'
nodes = [
    node(w, 'Saat Workflow Gagal', 'n8n-nodes-base.errorTrigger', 1, 0, 0, {}),
    code(w, 'Susun Pesan', 220, 0, ESC + r"""
const data = $input.first().json;
// Gagal di tengah eksekusi mengisi `execution`; gagal di node trigger mengisi `trigger`.
const error = data.execution?.error ?? data.trigger?.error ?? {};
const nodeName = data.execution?.lastNodeExecuted ?? error.node?.name ?? '(trigger)';
const detail = [error.message, error.description].filter(Boolean).join(' - ') || 'tanpa pesan';
const text = [
  '🚨 <b>Workflow gagal</b>',
  `Workflow: ${esc(data.workflow?.name ?? '?')}`,
  `Node: ${esc(nodeName)}`,
  `Error: ${esc(detail.slice(0, 800))}`,
  `Waktu: ${$now.toFormat('yyyy-MM-dd HH:mm')} WITA`,
  data.execution?.id ? `Eksekusi: #${data.execution.id}` : '',
].filter(Boolean).join('\n');
return [{ json: { text } }];
"""),
    telegram(w, 'Kirim Telegram', 440, 0),
]
save('error-handler.json', ERROR_ID, 'BJM - Notifikasi Error', nodes,
     chain([n['name'] for n in nodes]), error_workflow=False)

RUPIAH = r"""
const rupiah = (n) => (n < 0 ? '-' : '') + 'Rp ' + String(Math.round(Math.abs(n))).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
"""
LOG = '/api/resource/Log%20Pengingat%20Tagihan'
TODAY = "$now.toFormat('yyyy-MM-dd')"


def to(target):
    return [{'node': target, 'type': 'main', 'index': 0}]


# ---- Tagihan jatuh tempo (Fase 7) ----
w = 'tagihan'
pilih = r"""
const invoices = $('Invoice Lewat Tempo').first().json.data;
// Sudah diingatkan dalam 7 hari terakhir (tanggal lebih baru dari H-7) = lewati.
const recent = new Set($input.first().json.data.map((l) => l.sales_invoice));
return invoices.filter((i) => !recent.has(i.name)).map((i) => ({ json: i }));
"""
email = ESC + RUPIAH + r"""
const i = $input.first().json;
const html = [
  `<p>Yth. ${esc(i.customer_name)},</p>`,
  `<p>Tagihan <b>${esc(i.name)}</b> telah melewati jatuh tempo pada ${DateTime.fromISO(i.due_date).toFormat('dd-MM-yyyy')}.</p>`,
  `<p>Sisa tagihan: <b>${rupiah(i.outstanding_amount)}</b></p>`,
  '<p>Mohon segera melakukan pembayaran. Abaikan email ini bila sudah dibayar.</p>',
  '<p>Salam,<br>Bagian Keuangan CV. Bangunan Jaya Makmur</p>',
].join('\n');
const today = $now.toFormat('yyyy-MM-dd');
const log = {
  sales_invoice: i.name, customer: i.customer, email: i.contact_email, reminded_on: today,
  outstanding_amount: i.outstanding_amount, reminder_key: `${i.name}|${today}`,
};
return [{ json: { ...i, subject: `Pengingat tagihan ${i.name} - CV. Bangunan Jaya Makmur`, html, log } }];
"""
rekap = ESC + RUPIAH + r"""
const rows = $input.all().map((i) => i.json);
const section = (title, status) => {
  const list = rows.filter((r) => r.status === status);
  if (!list.length) return [];
  const total = list.reduce((sum, r) => sum + r.outstanding_amount, 0);
  return ['', `<b>${title}: ${list.length}</b> (${rupiah(total)})`,
    ...list.slice(0, 30).map((r) => `• ${esc(r.name)} ${esc(r.customer_name)}: ${rupiah(r.outstanding_amount)}, jatuh tempo ${r.due_date}`)];
};
return [{ json: { text: [
  '🧾 <b>Pengingat tagihan jatuh tempo</b>',
  ...section('Email terkirim', 'terkirim'),
  ...section('Gagal dikirim (tidak diulang selama 7 hari)', 'gagal'),
  ...section('Tanpa alamat email', 'tanpa email'),
].join('\n') } }];
"""


def mark(name, x, y, value, source):
    return code(w, name, x, y, f"return [{{ json: {{ ...{source}, status: '{value}' }} }}];")


nodes = [
    node(w, 'Tiap Pagi 09.00', 'n8n-nodes-base.scheduleTrigger', 1.2, 0, 0,
         {'rule': {'interval': [{'field': 'days', 'triggerAtHour': 9}]}}),
    node(w, 'Jalankan Manual', 'n8n-nodes-base.manualTrigger', 1, 0, 200, {}),
    get(w, 'Invoice Lewat Tempo', 220, 0, '/api/resource/Sales%20Invoice', {
        'fields': '["name","customer","customer_name","contact_email","due_date","outstanding_amount"]',
        'filters': '={{ JSON.stringify([["docstatus","=",1],["outstanding_amount",">",0],["due_date","<",' + TODAY + ']]) }}',
        'order_by': 'due_date asc', 'limit_page_length': '0'}),
    get(w, 'Log 7 Hari Terakhir', 440, 0, LOG, {
        'fields': '["sales_invoice","reminded_on"]',
        'filters': "={{ JSON.stringify([[\"reminded_on\",\">\",$now.minus({days: 7}).toFormat('yyyy-MM-dd')]]) }}",
        'limit_page_length': '0'}),
    code(w, 'Pilih Invoice', 660, 0, pilih),
    node(w, 'Per Invoice', 'n8n-nodes-base.splitInBatches', 3, 880, 0, {'options': {}}),
    node(w, 'Ada Email', 'n8n-nodes-base.if', 2.2, 1100, 100, {'conditions': {
        'options': {'caseSensitive': True, 'leftValue': '', 'typeValidation': 'loose', 'version': 2},
        'combinator': 'and',
        'conditions': [{'id': 'ada-email', 'leftValue': '={{ $json.contact_email }}', 'rightValue': '',
                        'operator': {'type': 'string', 'operation': 'notEmpty', 'singleValue': True}}]},
        'options': {}}),
    code(w, 'Susun Email', 1320, 0, email),
    # Log dulu baru kirim: kegagalan di tengah tidak boleh menghasilkan email dobel.
    node(w, 'Catat Pengingat', 'n8n-nodes-base.httpRequest', 4.2, 1540, 0, {
        'method': 'POST', 'url': '={{ $env.ERPNEXT_URL }}' + LOG,
        'authentication': 'genericCredentialType', 'genericAuthType': 'httpHeaderAuth',
        'sendBody': True, 'specifyBody': 'json', 'jsonBody': '={{ JSON.stringify($json.log) }}',
        'options': {'timeout': 30000}}, credentials=ERP_CRED),
    node(w, 'Kirim Email', 'n8n-nodes-base.emailSend', 2.1, 1760, 0, {
        'fromEmail': '={{ $env.SMTP_FROM }}',
        'toEmail': "={{ $('Susun Email').first().json.contact_email }}",
        'subject': "={{ $('Susun Email').first().json.subject }}",
        'emailFormat': 'html', 'html': "={{ $('Susun Email').first().json.html }}",
        'options': {'appendAttribution': False}},
        credentials={'smtp': {'id': 'bjmSmtpLokal0001', 'name': 'SMTP BJM'}},
        onError='continueErrorOutput'),
    mark('Terkirim', 1980, -100, 'terkirim', "$('Ada Email').first().json"),
    mark('Gagal', 1980, 80, 'gagal', "$('Ada Email').first().json"),
    mark('Tanpa Email', 1320, 280, 'tanpa email', '$input.first().json'),
    code(w, 'Susun Rekap', 1100, -200, rekap),
    telegram(w, 'Rekap ke Keuangan', 1320, -200, '$env.TELEGRAM_FINANCE_CHAT_ID || $env.TELEGRAM_CHAT_ID'),
]
conn = chain(['Tiap Pagi 09.00', 'Invoice Lewat Tempo', 'Log 7 Hari Terakhir', 'Pilih Invoice', 'Per Invoice'])
conn['Jalankan Manual'] = link('Invoice Lewat Tempo')
conn['Per Invoice'] = {'main': [to('Susun Rekap'), to('Ada Email')]}  # [selesai, per item]
conn['Ada Email'] = {'main': [to('Susun Email'), to('Tanpa Email')]}
conn.update(chain(['Susun Email', 'Catat Pengingat', 'Kirim Email']))
conn['Kirim Email'] = {'main': [to('Terkirim'), to('Gagal')]}
for n in ('Terkirim', 'Gagal', 'Tanpa Email'):
    conn[n] = link('Per Invoice')
conn['Susun Rekap'] = link('Rekap ke Keuangan')
save('tagihan-jatuh-tempo.json', 'bjmTagihan000001', 'BJM - Tagihan Jatuh Tempo', nodes, conn)

# ---- Laporan harian (Fase 8) ----
w = 'laporan'
laporan = ESC + RUPIAH + LOW_STOCK + r"""
const date = $('Tanggal Laporan').first().json.tanggal;
const data = (name) => $(name).first().json.data;
const sum = (rows, field) => rows.reduce((total, r) => total + r[field], 0);

const sales = data('Penjualan');       // retur bernilai negatif, dokumen batal tidak ikut
const returns = sales.filter((s) => s.is_return);
const cash = data('Kas Masuk');
const overdue = data('Piutang Lewat Tempo');
const low = lowStock($('Detail Item').all().map((i) => i.json.data), $input.first().json.data);

const lines = [
  `📊 <b>Laporan harian ${date}</b>`,
  '',
  `Penjualan: <b>${rupiah(sum(sales, 'base_grand_total'))}</b> (${sales.length - returns.length} invoice` +
    (returns.length ? `, ${returns.length} retur ${rupiah(sum(returns, 'base_grand_total'))}` : '') + ')',
  `Kas masuk: <b>${rupiah(sum(cash, 'base_received_amount'))}</b> (${cash.length} pembayaran)`,
  `Piutang lewat jatuh tempo: <b>${rupiah(sum(overdue, 'outstanding_amount'))}</b> (${overdue.filter((o) => o.outstanding_amount > 0).length} invoice)`,
  `Barang di bawah batas minimum: <b>${low.length}</b>`,
  ...low.slice(0, 15).map((r) => `• ${esc(r.item_name)} (${esc(r.warehouse)}): ${r.stock} / ${r.level}`),
];
if (low.length > 15) lines.push(`… dan ${low.length - 15} lagi`);
return [{ json: { text: lines.join('\n') } }];
"""
DATE = "$('Tanggal Laporan').first().json.tanggal"


def rows(name, x, doctype, fields, filters):
    return get(w, name, x, 0, f'/api/resource/{doctype}', {
        'fields': fields, 'filters': '={{ JSON.stringify(' + filters + ') }}', 'limit_page_length': '0'},
        executeOnce=True)


nodes = [
    node(w, 'Tiap Sore 17.00', 'n8n-nodes-base.scheduleTrigger', 1.2, 0, 0,
         {'rule': {'interval': [{'field': 'days', 'triggerAtHour': 17}]}}),
    node(w, 'Jalankan Manual', 'n8n-nodes-base.manualTrigger', 1, 0, 200, {}),
    node(w, 'Tanggal Laporan', 'n8n-nodes-base.set', 3.4, 220, 0, {'assignments': {'assignments': [
        {'id': 'tanggal', 'name': 'tanggal', 'type': 'string', 'value': '={{ ' + TODAY + ' }}'}]}, 'options': {}}),
    rows('Penjualan', 440, 'Sales%20Invoice', '["name","base_grand_total","is_return"]',
         f'[["docstatus","=",1],["posting_date","=",{DATE}]]'),
    rows('Kas Masuk', 660, 'Payment%20Entry', '["name","base_received_amount"]',
         f'[["docstatus","=",1],["payment_type","=","Receive"],["posting_date","=",{DATE}]]'),
    rows('Piutang Lewat Tempo', 880, 'Sales%20Invoice', '["name","outstanding_amount"]',
         f'[["docstatus","=",1],["outstanding_amount","!=",0],["due_date","<",{DATE}]]'),
    get(w, 'Daftar Item', 1100, 0, '/api/resource/Item', {
        'filters': '[["disabled","=",0],["is_stock_item","=",1]]', 'limit_page_length': '0'}, executeOnce=True),
    node(w, 'Pisah per Item', 'n8n-nodes-base.splitOut', 1, 1320, 0, {'fieldToSplitOut': 'data', 'options': {}}),
    get(w, 'Detail Item', 1540, 0, '/api/resource/Item/{{ encodeURIComponent($json.name) }}'),
    get(w, 'Stok per Gudang', 1760, 0, '/api/resource/Bin', {
        'fields': '["item_code","warehouse","projected_qty"]', 'limit_page_length': '0'}, executeOnce=True),
    code(w, 'Susun Laporan', 1980, 0, laporan),
    telegram(w, 'Kirim ke Pemilik', 2200, 0, '$env.TELEGRAM_OWNER_CHAT_ID || $env.TELEGRAM_CHAT_ID'),
]
conn = chain([n['name'] for n in nodes if n['name'] != 'Jalankan Manual'])
conn['Jalankan Manual'] = link('Tanggal Laporan')
save('laporan-harian.json', 'bjmLaporanHari01', 'BJM - Laporan Harian', nodes, conn)
