'use strict';

// The phone writes through the running desktop's database connection, never a second ledger.
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const dbMod = require('./db');

const PORT = 47831;
function fail(status, message) { const e = new Error(message); e.status = status; throw e; }

function validate(raw) {
  if (!raw || typeof raw !== 'object') fail(400, '账单格式无效');
  const date = String(raw.date || '');
  const parsed = new Date(`${date}T12:00:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(+parsed) || parsed.toISOString().slice(0, 10) !== date) fail(400, '日期无效');
  const amount = Number(raw.amount);
  if (!Number.isFinite(amount) || amount < 0.01 || amount > 1e10) fail(400, '金额须在 0.01 到 100 亿之间');
  if (!['CNY', 'USD'].includes(raw.currency) || !['income', 'expense'].includes(raw.type)) fail(400, '币种或类型无效');
  const rec = { date, amount: Math.round(amount * 100) / 100, currency: raw.currency, type: raw.type };
  for (const key of ['category', 'path', 'note']) {
    rec[key] = String(raw[key] || '').trim();
    if (rec[key].length > (key === 'note' ? 2000 : 100)) fail(400, '分类、路径或备注过长');
  }
  if (!rec.category) fail(400, '请填写分类');
  return rec;
}

function identity(db) {
  for (const [key, value] of [['mobile_ledger_id', crypto.randomUUID()], ['mobile_token', crypto.randomBytes(32).toString('hex')]]) {
    if (!dbMod.getSetting(db, key)) dbMod.setSetting(db, key, value);
  }
  db.exec(`CREATE TABLE IF NOT EXISTS mobile_receipts (
    request_id TEXT PRIMARY KEY, payload TEXT NOT NULL, record_id INTEGER NOT NULL
  )`);
  return { ledgerId: dbMod.getSetting(db, 'mobile_ledger_id'), token: dbMod.getSetting(db, 'mobile_token') };
}

function json(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(body));
}

async function readBody(req) {
  let size = 0;
  const chunks = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 16384) fail(413, '请求过大');
    chunks.push(chunk);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); }
  catch (_) { fail(400, '请求格式无效'); }
}

async function startMobileServer(db, { port = PORT, onChange = () => {} } = {}) {
  const { ledgerId } = identity(db);
  const insert = db.transaction((body) => {
    if (body.ledgerId !== ledgerId) fail(409, '连接的电脑账本已改变，已停止同步以保护待同步账单');
    if (typeof body.requestId !== 'string' || !/^[a-f0-9-]{36}$/i.test(body.requestId)) fail(400, '请求编号无效');
    const rec = validate(body.record);
    const payload = JSON.stringify(rec);
    const previous = db.prepare('SELECT * FROM mobile_receipts WHERE request_id = ?').get(body.requestId);
    if (previous) {
      if (previous.payload !== payload) fail(409, '请求编号冲突，请保留待同步数据');
      return { id: previous.record_id, duplicate: true, requestId: body.requestId, ledgerId };
    }
    const { id } = dbMod.insertRecord(db, rec);
    db.prepare('INSERT INTO mobile_receipts VALUES (?, ?, ?)').run(body.requestId, payload, id);
    return { id, requestId: body.requestId, ledgerId };
  });
  const assets = new Map([
    ['/', ['index.html', 'text/html']], ['/index.html', ['index.html', 'text/html']],
    ['/app.js', ['app.js', 'text/javascript']], ['/store.js', ['store.js', 'text/javascript']],
    ['/style.css', ['style.css', 'text/css']], ['/sw.js', ['sw.js', 'text/javascript']],
    ['/manifest.webmanifest', ['manifest.webmanifest', 'application/manifest+json']],
    ['/icon.svg', ['icon.svg', 'image/svg+xml']],
  ]);
  const server = http.createServer(async (req, res) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'");
    try {
      const url = new URL(req.url, 'http://localhost');
      if (url.pathname.startsWith('/api/')) {
        // No CORS, cookies or URL credentials. Cross-site forms cannot supply the bearer header.
        const expected = Buffer.from(`Bearer ${dbMod.getSetting(db, 'mobile_token')}`);
        const actual = Buffer.from(req.headers.authorization || '');
        if (actual.length !== expected.length || !crypto.timingSafeEqual(actual, expected)) fail(401, '连接密钥无效，请在电脑查看密钥后重新连接');
        if (req.method === 'GET' && url.pathname === '/api/snapshot') {
          const records = db.prepare('SELECT * FROM records ORDER BY date DESC, id DESC LIMIT 1000').all();
          const total = db.prepare('SELECT COUNT(*) AS n FROM records').get().n;
          return json(res, 200, { ledgerId, records, total, savedAt: new Date().toISOString() });
        }
        if (req.method === 'POST' && url.pathname === '/api/records') {
          if (!(req.headers['content-type'] || '').startsWith('application/json')) fail(415, '需要 JSON 请求');
          const body = await readBody(req);
          if (!body || typeof body !== 'object') fail(400, '请求格式无效');
          const result = insert(body);
          json(res, 200, result);
          if (!result.duplicate) onChange();
          return;
        }
        fail(404, '接口不存在');
      }
      if (req.method !== 'GET' && req.method !== 'HEAD') fail(405, '不支持此方法');
      const asset = assets.get(url.pathname);
      if (!asset) fail(404, '页面不存在');
      const data = fs.readFileSync(path.join(__dirname, 'mobile', asset[0]));
      res.writeHead(200, { 'Content-Type': `${asset[1]}; charset=utf-8`, 'Cache-Control': 'no-cache' });
      res.end(req.method === 'HEAD' ? undefined : data);
    } catch (err) {
      if (!res.headersSent) json(res, err.status || 500, { error: err.status ? err.message : '电脑保存失败，请稍后重试；待同步记录仍保留在手机' });
    }
  });
  server.requestTimeout = 15000;
  server.headersTimeout = 10000;
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', resolve);
  });
  return server;
}

module.exports = { PORT, identity, validate, startMobileServer };
