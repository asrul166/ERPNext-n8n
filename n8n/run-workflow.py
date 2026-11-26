# Menjalankan workflow lewat CLI n8n dan meringkas hasil tiap node.
import json, pathlib, subprocess, sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
CONTAINER = subprocess.run(
    ['docker', 'compose', '--env-file', '.env', '-f', 'docker/compose.yaml', 'ps', '-q', 'n8n'],
    cwd=ROOT, capture_output=True, text=True, check=True).stdout.strip()
sys.stdout.reconfigure(encoding='utf-8')

wf = sys.argv[1] if len(sys.argv) > 1 else 'bjmStokMenipis01'
proc = subprocess.run(
    ['docker', 'exec', '-e', 'N8N_RUNNERS_BROKER_PORT=5690', CONTAINER, 'n8n', 'execute', f'--id={wf}', '--rawOutput'],
    capture_output=True, text=True, encoding='utf-8')
out = proc.stdout
start = out.find('{')
try:
    data = json.JSONDecoder().raw_decode(out[start:])[0]
except Exception:
    print('exit', proc.returncode)
    print(out[-3000:])
    print(proc.stderr[-2000:])
    sys.exit(1)

result = data['data']['resultData']
for name, runs in result['runData'].items():
    run = runs[-1]
    main = (run.get('data') or {}).get('main') or [[]]
    items = main[0] or []
    error = run.get('error')
    print(f"{name}: {len(items)} item" + (f"  ERROR: {error.get('message')} | {error.get('description')}" if error else ''))
    if name == 'Saring Stok Menipis' and items:
        for r in items[0]['json']['rows']:
            print('    ', r['item_code'], r['warehouse'], 'stok', r['stock'], 'batas', r['level'], 'minta', r['qty'])
    if name == 'Buat Draf Material Request' and items:
        print('    ', items[0]['json']['data']['name'])
    if name in ('Susun Pesan', 'Susun Rekap', 'Susun Laporan') and items:
        print(items[0]['json']['text'])
