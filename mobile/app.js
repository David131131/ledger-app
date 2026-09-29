'use strict';
const $ = selector => document.querySelector(selector);
let config;
let syncing = false;
let pairing = false;
let editingToken = false;
let credentialsInvalid = false;
let connectionText = '尚未连接电脑';
const form = $('#record-form');
const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const tell = message => { $('#message').textContent = message; };

async function api(route, token, body) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);
  try {
    const response = await fetch(`/api/${route}`, {
      method: body ? 'POST' : 'GET', cache: 'no-store',
      headers: { Authorization: `Bearer ${token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
      body: body ? JSON.stringify(body) : undefined, signal: controller.signal,
    });
    const data = await response.json();
    if (!response.ok) { const err = new Error(data.error || '电脑返回错误'); err.status = response.status; throw err; }
    return data;
  } finally { clearTimeout(timer); }
}

function entry(record, label) {
  const row = document.createElement('div'); row.className = 'entry';
  const left = document.createElement('div');
  const title = document.createElement('strong'); title.textContent = record.category;
  const detail = document.createElement('small'); detail.textContent = [record.date, record.path, record.note, label].filter(Boolean).join(' · ');
  const amount = document.createElement('b'); amount.className = record.type;
  amount.textContent = `${record.type === 'income' ? '+' : '−'}${record.currency === 'USD' ? '$' : '¥'}${Number(record.amount).toFixed(2)}`;
  left.append(title, detail); row.append(left, amount); return row;
}

async function render() {
  const pending = await ledgerStore.pending();
  const snapshot = await ledgerStore.get('snapshot');
  $('#entry-fields').disabled = !config;
  const showPair = !config || editingToken || credentialsInvalid;
  $('#pair-form').hidden = !showPair;
  $('#pair-help').hidden = !showPair;
  $('#change-token').hidden = !config || credentialsInvalid;
  $('#change-token').textContent = editingToken ? '取消更换' : '更换连接密钥';
  $('#connection-title').textContent = credentialsInvalid ? '连接密钥已失效，请更新' : config ? '设备已记住 · 连接设置' : '首次连接电脑';
  $('#device-status').textContent = credentialsInvalid
    ? '电脑上的密钥已更改，请输入新密钥。待同步账单仍保留在手机。'
    : config ? '已记住此设备，下次自动连接。电脑离线时也无需重新登录。'
    : '首次连接后会记住此设备，无需每次输入密钥。';
  $('#pending-count').textContent = `${pending.length} 笔`;
  $('#status').textContent = syncing ? `正在同步 · ${pending.length} 笔待确认` : pending.length ? `${pending.length} 笔待同步 · ${connectionText}` : connectionText;
  $('#sync').disabled = !config || syncing || pairing;
  $('#last-sync').textContent = snapshot ? `电脑数据更新于 ${new Date(snapshot.savedAt).toLocaleString()}` : '首次连接后即可离线记账';
  $('#pending-list').replaceChildren(...pending.sort((a,b) => b.createdAt.localeCompare(a.createdAt)).map(row => entry(row.record, '仅在手机，等待电脑确认')));
  if (!pending.length) $('#pending-list').textContent = '没有待同步账单';
  $('#record-count').textContent = snapshot ? `${snapshot.records.length} / ${snapshot.total} 笔` : '';
  $('#records').replaceChildren(...(snapshot?.records || []).map(row => entry(row, '电脑已保存')));
  if (!snapshot?.records.length) $('#records').textContent = '暂无电脑账单';
}

async function sync() {
  if (!config || syncing || pairing) return;
  syncing = true;
  try {
    await render();
    const rows = await ledgerStore.pending();
    for (const row of rows) {
      if (row.ledgerId !== config.ledgerId) throw new Error('待同步账单属于其他账本，已停止同步');
      const ack = await api('records', config.token, row);
      if (ack.ledgerId !== row.ledgerId || ack.requestId !== row.requestId || !Number.isInteger(ack.id)) throw new Error('电脑确认信息不匹配，账单仍保留在手机');
      await ledgerStore.remove(row.requestId);
    }
    const snapshot = await api('snapshot', config.token);
    if (snapshot.ledgerId !== config.ledgerId) throw new Error('电脑账本已改变，已停止同步，请保留手机数据');
    await ledgerStore.set('snapshot', snapshot);
    credentialsInvalid = false;
    connectionText = '已连接电脑';
    tell('');
  } catch (err) {
    connectionText = '未完成同步';
    if (err.status === 401) { credentialsInvalid = true; $('#connection').open = true; }
    tell(err.status || !['TypeError', 'AbortError'].includes(err.name) ? err.message : '暂时无法连接电脑。待同步账单仍保存在手机，恢复连接后会自动重试。');
  } finally {
    syncing = false;
    await render();
  }
}

$('#pair-form').addEventListener('submit', async event => {
  event.preventDefault();
  if (syncing || pairing) return tell('正在同步，请稍后连接');
  pairing = true;
  const button = $('#pair-form button'); button.disabled = true;
  try {
    const token = $('#token').value.trim();
    const snapshot = await api('snapshot', token);
    const existing = await ledgerStore.get('config');
    if (existing && existing.ledgerId !== snapshot.ledgerId) throw new Error('此地址已绑定其他账本。为避免混账，请使用原账本连接，并先导出待同步记录。');
    const nextConfig = { token, ledgerId: snapshot.ledgerId };
    await ledgerStore.set('config', nextConfig);
    config = nextConfig;
    editingToken = false;
    credentialsInvalid = false;
    await ledgerStore.set('snapshot', snapshot);
    if (navigator.storage?.persist) await navigator.storage.persist().catch(() => false);
    $('#token').value = ''; $('#connection').open = false;
    connectionText = '已连接电脑'; tell('连接成功，可开始记账');
  } catch (err) { tell(err.message); }
  finally { pairing = false; button.disabled = false; await render(); }
  await sync();
});

$('#change-token').addEventListener('click', async () => {
  editingToken = !editingToken;
  if (!editingToken) $('#token').value = '';
  await render();
  if (editingToken) $('#token').focus();
});

form.addEventListener('submit', async event => {
  event.preventDefault();
  if (!config || $('#save').disabled) return;
  $('#save').disabled = true;
  try {
    const record = Object.fromEntries(new FormData(form));
    record.amount = Math.round(Number(record.amount) * 100) / 100;
    record.category = record.category.trim();
    if (!record.category || !Number.isFinite(record.amount) || record.amount < .01 || record.amount > 1e10) throw new Error('请填写有效金额和分类');
    await ledgerStore.add({ requestId: crypto.randomUUID(), ledgerId: config.ledgerId, record, createdAt: new Date().toISOString() });
    form.elements.amount.value = ''; form.elements.path.value = ''; form.elements.note.value = '';
    tell('已保存到手机，等待电脑确认。');
    await render();
    void sync().catch(err => tell(err.message));
  } catch (err) { tell(`保存未完成：${err.message}。请勿关闭页面。`); }
  finally { $('#save').disabled = false; }
});

$('#sync').addEventListener('click', () => { void sync().catch(err => tell(err.message)); });
$('#export').addEventListener('click', async () => {
  try {
    const rows = await ledgerStore.pending();
    const url = URL.createObjectURL(new Blob([JSON.stringify({ version: 1, pending: rows }, null, 2)], { type: 'application/json' }));
    const link = document.createElement('a'); link.href = url; link.download = `做账-待同步-${today()}.json`;
    document.body.append(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 30000);
  } catch (err) { tell(err.message); }
});
window.addEventListener('online', () => { void sync().catch(err => tell(err.message)); });
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) { void sync().catch(err => tell(err.message)); }
});
setInterval(() => { if (!document.hidden) void sync().catch(err => tell(err.message)); }, 15000);

async function init() {
  if (!window.isSecureContext || !('serviceWorker' in navigator)) {
    $('#offline-ready').textContent = '需要通过 HTTPS 打开才能离线使用；请使用电脑配置的安全地址。';
    throw new Error('当前地址不支持安全离线记账');
  }
  form.elements.date.value = today();
  config = await ledgerStore.get('config');
  if (config) connectionText = '已记住设备，正在自动连接';
  $('#connection').open = !config;
  await render();
  // Cached app remains usable even when an update check cannot reach the sleeping computer.
  navigator.serviceWorker.register('/sw.js').then(() => navigator.serviceWorker.ready).then(() => {
    $('#offline-ready').textContent = '离线页面已就绪 · 可添加到主屏幕';
  }).catch(() => { $('#offline-ready').textContent = '离线页面尚未就绪，请保持电脑在线并重新打开一次'; });
  await sync();
}
init().catch(err => tell(`无法初始化手机账本：${err.message}`));
