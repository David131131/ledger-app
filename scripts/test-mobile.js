'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { BrowserWindow } = require('electron');
const dbMod = require('../db');
const { identity, startMobileServer } = require('../mobile-server');

async function run() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ledger-mobile-test-'));
  const db = dbMod.openDb(path.join(dir, 'ledger.db'));
  let server;
  let win;
  const stop = async () => {
    if (!server) return;
    const current = server; server = null;
    await new Promise(resolve => { current.close(resolve); current.closeAllConnections(); });
  };
  try {
    let changes = 0;
    server = await startMobileServer(db, { port: 0, onChange: () => changes++ });
    const port = server.address().port;
    const base = `http://127.0.0.1:${port}`;
    const { token, ledgerId } = identity(db);
    const record = { date: '2026-09-27', amount: 12.34, currency: 'CNY', type: 'expense', category: '餐饮', path: '', note: '测试' };
    const body = { ledgerId, requestId: crypto.randomUUID(), record };
    const call = (data, auth = token) => fetch(`${base}/api/records`, { method: 'POST', headers: { Authorization: `Bearer ${auth}`, 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
    assert.equal((await call(body, 'wrong')).status, 401);
    assert.equal((await fetch(`${base}/api/snapshot`)).status, 401);
    assert.equal((await fetch(`${base}/db.js`)).status, 404);
    assert.equal((await call({ ...body, ledgerId: 'another-ledger' })).status, 409);
    assert.equal((await call({ ...body, record: { ...record, date: '2026-02-30' } })).status, 400);
    assert.equal((await call({ ...body, record: { ...record, amount: .001 } })).status, 400);
    assert.equal((await call(null)).status, 400);
    assert.equal((await call({ ...body, record: { ...record, note: 'x'.repeat(20000) } })).status, 413);
    const receipts = await Promise.all(Array.from({ length: 5 }, async () => {
      const response = await call(body); assert.equal(response.status, 200); return response.json();
    }));
    assert.equal(new Set(receipts.map(r => r.id)).size, 1);
    assert.equal(db.prepare('SELECT COUNT(*) n FROM records').get().n, 1);
    assert.equal(changes, 1);
    assert.equal((await call({ ...body, record: { ...record, amount: 99 } })).status, 409);
    // A later deletion must not cause an old phone retry to resurrect the record.
    dbMod.deleteRecord(db, receipts[0].id);
    assert.equal((await call(body)).status, 200);
    assert.equal(db.prepare('SELECT COUNT(*) n FROM records').get().n, 0);
    console.log('[mobile] authentication, validation, atomic deduplication and deletion retry OK');

    win = new BrowserWindow({ show: false, width: 390, height: 844, webPreferences: { partition: `mobile-test-${crypto.randomUUID()}`, contextIsolation: true, nodeIntegration: false, sandbox: true } });
    const js = source => win.webContents.executeJavaScript(source);
    const until = async (expression) => {
      const deadline = Date.now() + 15000;
      while (Date.now() < deadline) {
        if (await js(expression)) return;
        await new Promise(r => setTimeout(r, 50));
      }
      throw new Error(`Timed out: ${expression}`);
    };
    await win.loadURL(base);
    await until(`document.querySelector('#connection').open`);
    await js(`document.querySelector('#token').value = ${JSON.stringify(token)}; document.querySelector('#pair-form').requestSubmit()`);
    await until(`!document.querySelector('#entry-fields').disabled && !document.querySelector('#sync').disabled`);
    await until(`!!navigator.serviceWorker.controller`);
    assert.equal(await js(`document.querySelector('#pair-form').hidden`), true);
    await win.loadURL(base);
    await until(`!document.querySelector('#entry-fields').disabled && !syncing`);
    assert.equal(await js(`document.querySelector('#pair-form').hidden`), true);
    assert.match(await js(`document.querySelector('#device-status').textContent`), /已记住此设备/);
    await js(`document.querySelector('#change-token').click()`);
    await until(`!document.querySelector('#pair-form').hidden`);
    await js(`document.querySelector('#change-token').click()`);
    await until(`document.querySelector('#pair-form').hidden`);
    console.log('[mobile] saved credentials restored on reload, manual change/cancel OK');
    dbMod.insertRecord(db, { ...record, category: '电脑新增' });
    await js('sync()');
    assert.match(await js(`document.querySelector('#records').textContent`), /电脑新增/);
    // Offline: queue a new record, reload using cached shell, preserve the queued write.
    await stop();
    await js(`form.elements.amount.value = '88.88'; form.elements.category.value = '手机离线'; form.requestSubmit()`);
    await until(`document.querySelector('#pending-count').textContent === '1 笔' && !syncing`);
    assert.equal(db.prepare('SELECT COUNT(*) n FROM records').get().n, 1);
    await win.loadURL(base);
    await until(`document.querySelector('#pending-count').textContent === '1 笔' && !syncing`);
    assert.match(await js(`document.querySelector('#records').textContent`), /电脑新增/);
    assert.equal(await js(`document.querySelector('#pair-form').hidden`), true);
    assert.equal(await js(`document.querySelector('#entry-fields').disabled`), false);
    assert.equal(await js('document.documentElement.scrollWidth <= window.innerWidth'), true);
    const screenshot = path.join(dir, 'mobile-offline.png');
    fs.writeFileSync(screenshot, (await win.webContents.capturePage()).toPNG());
    console.log('[mobile] offline cached launch, durable outbox, cached desktop records and 390px layout OK');
    console.log('[mobile] screenshot:', screenshot);
    server = await startMobileServer(db, { port });
    await js('sync()');
    assert.equal(await js('(async () => (await ledgerStore.pending()).length)()'), 0);
    assert.equal(db.prepare("SELECT COUNT(*) n FROM records WHERE category = '手机离线'").get().n, 1);
    assert.match(await js(`document.querySelector('#records').textContent`), /手机离线/);
    // Repeat after restart proves the receipt is persisted in SQLite, not process memory.
    assert.equal((await call(body)).status, 200);
    assert.equal(db.prepare('SELECT COUNT(*) n FROM records').get().n, 2);
    // Rotate credentials: unsynced writes must survive an auth failure.
    dbMod.setSetting(db, 'mobile_token', crypto.randomBytes(32).toString('hex'));
    await js(`form.elements.amount.value = '1.23'; form.elements.category.value = '重新配对'; form.requestSubmit()`);
    await until(`document.querySelector('#pending-count').textContent === '1 笔' && !syncing`);
    assert.equal(db.prepare('SELECT COUNT(*) n FROM records').get().n, 2);
    assert.match(await js(`document.querySelector('#message').textContent`), /密钥无效/);
    assert.equal(await js(`document.querySelector('#pair-form').hidden`), false);
    const newToken = dbMod.getSetting(db, 'mobile_token');
    await js(`document.querySelector('#token').value = ${JSON.stringify(newToken)}; document.querySelector('#pair-form').requestSubmit()`);
    await until(`document.querySelector('#pending-count').textContent === '0 笔' && !syncing`);
    assert.equal(db.prepare('SELECT COUNT(*) n FROM records').get().n, 3);
    assert.equal(await js(`document.querySelector('#pair-form').hidden`), true);
    console.log('[mobile] reconnect writes same SQLite DB, restart retries, revoked token and re-pair OK');
    console.log('[mobile] ALL OK (temporary database only)');
  } finally {
    if (win) win.destroy();
    await stop(); db.close();
    for (const suffix of ['', '-wal', '-shm']) fs.rmSync(path.join(dir, `ledger.db${suffix}`), { force: true });
  }
}
module.exports = { run };
