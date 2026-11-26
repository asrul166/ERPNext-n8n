// Util bersama untuk skrip seed: baca .env dan panggil REST API ERPNext.
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const ENV_PATH = fileURLToPath(new URL('../.env', import.meta.url));

export function readEnv() {
  const env = {};
  for (const line of readFileSync(ENV_PATH, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) env[m[1]] = m[2];
  }
  return env;
}

export function setEnv(key, value) {
  let text = readFileSync(ENV_PATH, 'utf8');
  const line = `${key}=${value}`;
  const re = new RegExp(`^${key}=.*$`, 'm');
  text = re.test(text) ? text.replace(re, () => line) : `${text.trimEnd()}\n${line}\n`;
  writeFileSync(ENV_PATH, text);
}

export const env = readEnv();
export const BASE_URL = env.ERPNEXT_PUBLIC_URL || `http://localhost:${env.ERPNEXT_PORT || 8081}`;

export class ApiError extends Error {
  constructor(status, method, path, body) {
    super(`${method} ${path} -> ${status}: ${body}`);
    this.status = status;
  }
}

let cookie = '';

async function request(method, path, { body, headers = {}, auth } = {}) {
  const res = await fetch(BASE_URL + path, {
    method,
    headers: {
      Accept: 'application/json',
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(auth ? { Authorization: auth } : cookie ? { Cookie: cookie } : {}),
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  if (!res.ok) {
    let detail = text.slice(0, 600);
    try {
      const j = JSON.parse(text);
      detail = j.exception || j._server_messages || j.message || detail;
    } catch {}
    throw new ApiError(res.status, method, path, detail);
  }
  return { res, data: text ? JSON.parse(text) : {} };
}

export async function login() {
  const { res } = await request('POST', '/api/method/login', {
    body: { usr: 'Administrator', pwd: env.ADMIN_PASSWORD },
  });
  cookie = res.headers
    .getSetCookie()
    .map((c) => c.split(';')[0])
    .join('; ');
}

export async function call(method, args = {}) {
  const { data } = await request('POST', `/api/method/${method}`, { body: args });
  return data.message;
}

const resourcePath = (doctype, name) =>
  `/api/resource/${encodeURIComponent(doctype)}` + (name ? `/${encodeURIComponent(name)}` : '');

export async function list(doctype, { filters, fields = ['name'], orderBy } = {}) {
  const query = new URLSearchParams({ fields: JSON.stringify(fields), limit_page_length: '0' });
  if (filters) query.set('filters', JSON.stringify(filters));
  if (orderBy) query.set('order_by', orderBy);
  const { data } = await request('GET', `${resourcePath(doctype)}?${query}`);
  return data.data;
}

export async function get(doctype, name) {
  try {
    const { data } = await request('GET', resourcePath(doctype, name));
    return data.data;
  } catch (err) {
    if (err.status === 404) return null;
    throw err;
  }
}

export async function create(doctype, doc) {
  const { data } = await request('POST', resourcePath(doctype), { body: doc });
  return data.data;
}

export async function update(doctype, name, doc) {
  const { data } = await request('PUT', resourcePath(doctype, name), { body: doc });
  return data.data;
}

export async function submit(doctype, name) {
  return update(doctype, name, { docstatus: 1 });
}

/** Membuat dokumen hanya jika `name` belum ada. */
export async function ensure(doctype, name, doc) {
  return (await get(doctype, name)) ?? create(doctype, doc);
}

export async function waitForSite(timeoutMs = 15 * 60_000) {
  const start = Date.now();
  let lastError;
  while (Date.now() - start < timeoutMs) {
    try {
      await request('GET', '/api/method/ping');
      return;
    } catch (err) {
      lastError = err;
      await new Promise((r) => setTimeout(r, 5000));
    }
  }
  throw new Error(`ERPNext tidak merespons di ${BASE_URL}: ${lastError?.message}`);
}
