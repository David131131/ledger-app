'use strict';

const path = require('path');
const fs = require('fs');
const { app, BrowserWindow, ipcMain, Menu, dialog, nativeTheme } = require('electron');
const dbMod = require('./db');
const stats = require('./stats');
const exportMod = require('./export');

const IS_SMOKE = process.argv.includes('--smoke-test');
let db = null;
let mainWindow = null;

/* ---------------- 输入校验 ---------------- */

function validateRecord(raw) {
  const date = String(raw && raw.date ? raw.date : '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return { error: '日期格式不正确' };
  const amount = Number(raw.amount);
  if (!Number.isFinite(amount) || amount <= 0) return { error: '金额必须是大于 0 的数字' };
  const category = String(raw.category || '').trim();
  if (!category) return { error: '请填写分类' };
  const type = raw.type === 'income' ? 'income' : 'expense';
  const currency = raw.currency === 'USD' ? 'USD' : 'CNY';
  return {
    rec: {
      date,
      amount: Math.round(amount * 100) / 100,
      currency,
      category,
      type,
      path: String(raw.path || '').trim(),
      note: String(raw.note || '').trim(),
    },
  };
}

/* ---------------- 汇率 ---------------- */

async function fetchTodayRate() {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch('https://open.er-api.com/v6/latest/USD', {
      signal: controller.signal,
    });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();
    const rate = Number(data && data.rates && data.rates.CNY);
    if (!Number.isFinite(rate) || rate <= 0) throw new Error('汇率数据无效');
    return rate;
  } finally {
    clearTimeout(timer);
  }
}

/** 有效汇率：手动 > 联网缓存 > 默认 */
function effectiveRate() {
  const manual = parseFloat(dbMod.getSetting(db, 'rate_manual', ''));
  if (Number.isFinite(manual) && manual > 0) {
    return { rate: manual, source: 'manual', updatedAt: '' };
  }
  const stored = parseFloat(dbMod.getSetting(db, 'usd_cny_rate', ''));
  if (Number.isFinite(stored) && stored > 0) {
    return {
      rate: stored,
      source: dbMod.getSetting(db, 'rate_source', 'online'),
      updatedAt: dbMod.getSetting(db, 'rate_updated_at', ''),
    };
  }
  return { rate: stats.DEFAULT_RATE, source: 'default', updatedAt: '' };
}

async function refreshRate() {
  try {
    const rate = await fetchTodayRate();
    dbMod.setSetting(db, 'usd_cny_rate', String(Math.round(rate * 10000) / 10000));
    dbMod.setSetting(db, 'rate_source', 'online');
    dbMod.setSetting(db, 'rate_updated_at', dbMod.localNow());
    dbMod.setSetting(db, 'rate_manual', '');
    return { ok: true, ...effectiveRate() };
  } catch (err) {
    return { ok: false, error: String(err && err.message ? err.message : err), ...effectiveRate() };
  }
}

function getSettingsPayload() {
  let budgetCategories = [];
  try {
    const raw = JSON.parse(dbMod.getSetting(db, 'budget_categories', '[]'));
    if (Array.isArray(raw)) budgetCategories = raw;
  } catch (_) {}
  const budgetTotal = parseFloat(dbMod.getSetting(db, 'budget_total', '')) || 0;
  return {
    lang: dbMod.getSetting(db, 'lang', 'zh'),
    currency: dbMod.getSetting(db, 'currency', 'CNY'),
    rateManual: dbMod.getSetting(db, 'rate_manual', ''),
    budgetTotal,
    budgetCategories,
    ...effectiveRate(),
  };
}

/* ---------------- 菜单（双语） ---------------- */

const MENU_TEXT = {
  zh: {
    app: '做账', about: '关于 做账', hide: '隐藏', quit: '退出',
    edit: '编辑', undo: '撤销', redo: '重做', cut: '剪切', copy: '复制',
    paste: '粘贴', selectAll: '全选',
    view: '视图', reload: '重新加载', devtools: '开发者工具',
  },
  en: {
    app: 'Ledger', about: 'About Ledger', hide: 'Hide', quit: 'Quit',
    edit: 'Edit', undo: 'Undo', redo: 'Redo', cut: 'Cut', copy: 'Copy',
    paste: 'Paste', selectAll: 'Select All',
    view: 'View', reload: 'Reload', devtools: 'Developer Tools',
  },
};

function createMenu(lang) {
  const t = MENU_TEXT[lang === 'en' ? 'en' : 'zh'];
  const menu = Menu.buildFromTemplate([
    {
      label: t.app,
      submenu: [
        { role: 'about', label: t.about },
        { type: 'separator' },
        { role: 'hide', label: t.hide },
        { role: 'quit', label: t.quit },
      ],
    },
    {
      label: t.edit,
      submenu: [
        { role: 'undo', label: t.undo },
        { role: 'redo', label: t.redo },
        { type: 'separator' },
        { role: 'cut', label: t.cut },
        { role: 'copy', label: t.copy },
        { role: 'paste', label: t.paste },
        { role: 'selectAll', label: t.selectAll },
      ],
    },
    {
      label: t.view,
      submenu: [
        { role: 'reload', label: t.reload },
        { role: 'toggleDevTools', label: t.devtools },
      ],
    },
  ]);
  Menu.setApplicationMenu(menu);
}

/* ---------------- IPC ---------------- */

function registerIpc() {
  ipcMain.handle('records:add', (_e, raw) => {
    const v = validateRecord(raw);
    if (v.error) throw new Error(v.error);
    return dbMod.insertRecord(db, v.rec);
  });
  ipcMain.handle('records:update', (_e, id, raw) => {
    const v = validateRecord(raw);
    if (v.error) throw new Error(v.error);
    return dbMod.updateRecord(db, Number(id), v.rec);
  });
  ipcMain.handle('records:delete', (_e, id) => dbMod.deleteRecord(db, Number(id)));
  ipcMain.handle('records:list', (_e, range) =>
    dbMod.listRecords(db, String(range.start), String(range.end))
  );
  ipcMain.handle('records:query', (_e, filters) => dbMod.queryRecords(db, filters || {}));
  ipcMain.handle('records:categories', () => dbMod.listCategories(db));
  ipcMain.handle('records:overview', (_e, range, currency, rate) =>
    stats.overview(db, String(range.start), String(range.end), currency, rate)
  );
  ipcMain.handle('report:get', (_e, { period, anchor, currency, rate }) =>
    stats.getReport(db, period, anchor, { currency, rate })
  );

  ipcMain.handle('settings:get', () => getSettingsPayload());
  ipcMain.handle('settings:set', (_e, key, value) => {
    if (key === 'lang') {
      if (value !== 'zh' && value !== 'en') throw new Error('语言设置无效');
      dbMod.setSetting(db, 'lang', value);
      createMenu(value);
      if (mainWindow) mainWindow.setTitle(value === 'en' ? 'Ledger' : '做账');
      return { ok: true };
    }
    if (key === 'currency') {
      if (value !== 'CNY' && value !== 'USD') throw new Error('货币设置无效');
      dbMod.setSetting(db, 'currency', value);
      return { ok: true };
    }
    if (key === 'rate_manual') {
      if (value !== '') {
        const n = Number(value);
        if (!Number.isFinite(n) || n <= 0) throw new Error('汇率必须是大于 0 的数字');
      }
      dbMod.setSetting(db, 'rate_manual', value === '' ? '' : String(value));
      return { ok: true, ...effectiveRate() };
    }
    if (key === 'budget_total') {
      const n = Number(value);
      if (!Number.isFinite(n) || n < 0) throw new Error('预算必须是大于等于 0 的数字');
      dbMod.setSetting(db, 'budget_total', String(n));
      return { ok: true };
    }
    if (key === 'budget_categories') {
      let arr;
      try {
        arr = JSON.parse(value);
      } catch (_) {
        throw new Error('预算格式无效');
      }
      if (!Array.isArray(arr) || arr.length > 50) throw new Error('预算格式无效');
      for (const it of arr) {
        if (!it || typeof it.name !== 'string' || !it.name.trim() ||
            !Number.isFinite(Number(it.amount)) || Number(it.amount) <= 0) {
          throw new Error('预算格式无效');
        }
      }
      dbMod.setSetting(db, 'budget_categories', JSON.stringify(arr));
      return { ok: true };
    }
    throw new Error('未知设置项');
  });
  ipcMain.handle('rate:refresh', () => refreshRate());

  // 数据导出 / 备份
  ipcMain.handle('data:exportCsv', async () => {
    const zh = dbMod.getSetting(db, 'lang', 'zh') !== 'en';
    const rows = db
      .prepare(
        'SELECT id, date, amount, currency, category, type, path, note, created_time FROM records ORDER BY date DESC, id DESC'
      )
      .all();
    const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
      title: zh ? '导出账单 CSV' : 'Export Records as CSV',
      defaultPath: path.join(app.getPath('documents'), exportMod.timestampName(zh ? '做账账单' : 'ledger', 'csv')),
      filters: [{ name: 'CSV', extensions: ['csv'] }],
    });
    if (canceled || !filePath) return { canceled: true };
    fs.writeFileSync(filePath, exportMod.recordsToCsv(rows), 'utf8');
    return { ok: true, path: filePath, count: rows.length };
  });
  ipcMain.handle('data:backupDb', async () => {
    const zh = dbMod.getSetting(db, 'lang', 'zh') !== 'en';
    const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
      title: zh ? '备份数据库' : 'Back Up Database',
      defaultPath: path.join(app.getPath('documents'), exportMod.timestampName(zh ? '做账备份' : 'ledger-backup', 'db')),
      filters: [{ name: zh ? 'SQLite 数据库' : 'SQLite Database', extensions: ['db'] }],
    });
    if (canceled || !filePath) return { canceled: true };
    await db.backup(filePath);
    return { ok: true, path: filePath };
  });
}

/* ---------------- 窗口 ---------------- */

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 1080,
    minHeight: 700,
    title: '做账',
    backgroundColor: nativeTheme.shouldUseDarkColors ? '#0e1116' : '#f3f5f9',
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  mainWindow = win;
  win.once('ready-to-show', () => win.show());
  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));
}

/* ---------------- 冒烟测试 ---------------- */

async function runSmoke() {
  const os = require('os');
  const tmpBase = path.join(os.tmpdir(), `zuozhang-smoke-${process.pid}.db`);
  console.log('[smoke] db:', tmpBase);
  try {
    db = dbMod.openDb(tmpBase);
    const { toStr, addDays, mondayOf } = stats;
    const today = new Date();
    const todayStr = toStr(today);
    const RATE = 7.2;

    // 构造覆盖两个周期、两种币种的数据
    const monday = mondayOf(today);
    const entries = [
      // 本周（含 USD）
      { date: toStr(addDays(monday, 0)), amount: 300, currency: 'CNY', category: '购物', type: 'expense' },
      { date: toStr(addDays(monday, 2)), amount: 120, currency: 'CNY', category: '餐饮', type: 'expense' },
      { date: toStr(addDays(monday, 4)), amount: 200, currency: 'CNY', category: '购物', type: 'expense' },
      { date: toStr(addDays(monday, 5)), amount: 100, currency: 'USD', category: '购物', type: 'expense' },
      { date: toStr(addDays(monday, 1)), amount: 1500, currency: 'CNY', category: '工资', type: 'income' },
      // 上周（含 USD）
      { date: toStr(addDays(monday, -7)), amount: 200, currency: 'CNY', category: '购物', type: 'expense' },
      { date: toStr(addDays(monday, -6)), amount: 50, currency: 'USD', category: '交通', type: 'expense' },
      // 本月其他日期
      { date: toStr(new Date(today.getFullYear(), today.getMonth(), 1)), amount: 100, currency: 'CNY', category: '餐饮', type: 'expense' },
      { date: toStr(new Date(today.getFullYear(), today.getMonth(), 5)), amount: 400, currency: 'CNY', category: '购物', type: 'expense' },
      // 上月
      { date: toStr(new Date(today.getFullYear(), today.getMonth() - 1, 15)), amount: 300, currency: 'CNY', category: '购物', type: 'expense' },
      // 本季度/上季度
      {
        date: toStr(new Date(today.getFullYear(), Math.floor(today.getMonth() / 3) * 3, 2)),
        amount: 500, currency: 'CNY', category: '购物', type: 'expense',
      },
      {
        date: toStr(new Date(today.getFullYear(), Math.floor(today.getMonth() / 3) * 3 - 3, 3)),
        amount: 200, currency: 'CNY', category: '购物', type: 'expense',
      },
    ];
    for (const e of entries) dbMod.insertRecord(db, { ...e, path: '', note: '' });

    let failures = 0;
    const check = (cond, msg) => {
      if (cond) console.log(`  ✓ ${msg}`);
      else {
        failures++;
        console.error(`  ✗ ${msg}`);
      }
    };
    const near = (a, b) => Math.abs(a - b) < 0.011;
    const disp = (e) => (e.currency === 'USD' ? e.amount * RATE : e.amount);

    for (const period of ['week', 'month', 'quarter', 'year']) {
      console.log(`\n[smoke] === ${period} (display CNY, rate ${RATE}) ===`);
      const range = stats.periodRange(period, todayStr);
      const report = stats.getReport(db, period, todayStr, { currency: 'CNY', rate: RATE });

      const inRange = entries.filter((e) => e.date >= range.start && e.date <= range.end);
      const expRows = inRange.filter((e) => e.type === 'expense');
      const incRows = inRange.filter((e) => e.type === 'income');
      const expSum = expRows.reduce((a, e) => a + disp(e), 0);
      const incSum = incRows.reduce((a, e) => a + disp(e), 0);
      const expCats = new Map();
      for (const e of expRows) expCats.set(e.category, (expCats.get(e.category) || 0) + disp(e));
      const topCat = [...expCats.entries()].sort((a, b) => b[1] - a[1])[0];
      const prevIn = entries.filter((e) => e.date >= range.prevStart && e.date <= range.prevEnd);
      const prevExp = prevIn.filter((e) => e.type === 'expense').reduce((a, e) => a + disp(e), 0);
      const expDelta = prevExp > 0 ? Math.round(((expSum - prevExp) / prevExp) * 100) : null;
      const hasCNY = expRows.concat(incRows).some((e) => e.currency === 'CNY');
      const hasUSD = expRows.concat(incRows).some((e) => e.currency === 'USD');

      check(near(report.expenseTotal, expSum), `expenseTotal=${report.expenseTotal} 期望 ${Math.round(expSum * 100) / 100}`);
      check(near(report.incomeTotal, incSum), `incomeTotal=${report.incomeTotal} 期望 ${incSum}`);
      check(report.expenseCount === expRows.length, `expenseCount=${report.expenseCount}`);
      if (expSum > 0 && topCat) {
        check(report.topCategory && report.topCategory.name === topCat[0], `topCategory=${report.topCategory && report.topCategory.name} 期望 ${topCat[0]}`);
        check(report.topCategory.pct === Math.round((topCat[1] / expSum) * 100), `topPct=${report.topCategory.pct}%`);
      }
      check(report.delta === expDelta, `delta=${report.delta} 期望 ${expDelta}`);
      check(report.unified === (hasCNY && hasUSD), `unified=${report.unified} 期望 ${hasCNY && hasUSD}`);
      check(
        near(report.rawExpenseUSD, expRows.filter((e) => e.currency === 'USD').reduce((a, e) => a + e.amount, 0)),
        `rawExpenseUSD=${report.rawExpenseUSD}`
      );
      check(Number.isInteger(report.weekNum) && Number.isInteger(report.isoYear), `weekNum=${report.weekNum} isoYear=${report.isoYear}`);
      const expectedLen =
        period === 'week'
          ? 7
          : period === 'month'
            ? new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate()
            : period === 'year'
              ? 12
              : null; // 季度为 13 或 14 周
      check(
        expectedLen === null
          ? report.points.length === 13 || report.points.length === 14
          : report.points.length === expectedLen,
        `points.length=${report.points.length}`
      );
      check(Array.isArray(report.byCategoryExpense) && report.byCategoryExpense.length > 0, `byCategoryExpense=${report.byCategoryExpense.length} 项`);
      if (period === 'week') check(report.prevPoints && report.prevPoints.length === 7, 'prevPoints=7（周报对比线）');
      console.log(`  范围: ${range.start} ~ ${range.end} | 总支出 ${report.expenseTotal} | 混合币种 ${report.unified}`);
    }

    // USD 显示币种反向折算
    console.log('\n[smoke] === display USD ===');
    const usdReport = stats.getReport(db, 'week', todayStr, { currency: 'USD', rate: RATE });
    const rangeW = stats.periodRange('week', todayStr);
    const weekExp = entries.filter((e) => e.date >= rangeW.start && e.date <= rangeW.end && e.type === 'expense');
    const usdSum = weekExp.reduce((a, e) => a + (e.currency === 'CNY' ? e.amount / RATE : e.amount), 0);
    check(near(usdReport.expenseTotal, usdSum), `USD expenseTotal=${usdReport.expenseTotal} 期望 ${Math.round(usdSum * 100) / 100}`);
    check(usdReport.currency === 'USD', 'currency=USD');

    // CRUD 链路（含币种）
    console.log('\n[smoke] === CRUD ===');
    const { id } = dbMod.insertRecord(db, { date: todayStr, amount: 88.8, currency: 'USD', category: '测试', type: 'expense', path: 'p', note: 'n' });
    check(Number.isInteger(id) && id > 0, `insert -> id=${id}`);
    const found = dbMod.listRecords(db, todayStr, todayStr).find((r) => r.id === id);
    check(!!found && found.currency === 'USD', 'listRecords 查询到新记录且币种=USD');
    dbMod.updateRecord(db, id, { date: todayStr, amount: 99.9, currency: 'CNY', category: '测试改', type: 'income', path: '', note: '改' });
    const updated = dbMod.listRecords(db, todayStr, todayStr).find((r) => r.id === id);
    check(updated.amount === 99.9 && updated.currency === 'CNY' && updated.type === 'income', 'update 生效（含币种）');
    dbMod.deleteRecord(db, id);
    check(!dbMod.listRecords(db, todayStr, todayStr).some((r) => r.id === id), 'delete 生效');

    // 导出 / 备份
    console.log('\n[smoke] === export & backup ===');
    const csvRows = [
      { id: 1, date: '2026-08-25', amount: 12.5, currency: 'USD', category: '购物', type: 'expense', path: '', note: '', created_time: '2026-08-25 10:00:00' },
      { id: 2, date: '2026-08-25', amount: 99, currency: 'CNY', category: '餐饮, 早餐', type: 'expense', path: '淘宝', note: '带"引号"', created_time: '2026-08-25 11:00:00' },
    ];
    const csv = exportMod.recordsToCsv(csvRows);
    check(csv.startsWith('\uFEFF'), 'CSV 带 UTF-8 BOM');
    check(csv.split('\r\n').length === 4, 'CSV 行数正确（表头 + 2 行 + 结尾空段）');
    check(csv.includes('"餐饮, 早餐"'), 'CSV 含逗号字段被引号包裹');
    check(csv.includes('"带""引号"""'), 'CSV 引号转义正确');
    check(/做账账单-\d{8}-\d{6}\.csv/.test(exportMod.timestampName('做账账单', 'csv')), '时间戳文件名格式');
    const backupPath = tmpBase + '.bak';
    await db.backup(backupPath);
    const backupDb = dbMod.openDb(backupPath);
    const backupCount = backupDb.prepare('SELECT COUNT(*) AS n FROM records').get().n;
    const liveCount = db.prepare('SELECT COUNT(*) AS n FROM records').get().n;
    backupDb.close();
    check(backupCount === liveCount, `db.backup 快照一致 (${backupCount} 条)`);
    try { fs.unlinkSync(backupPath); } catch (_) {}

    // 筛选查询
    console.log('\n[smoke] === query filters ===');
    const qAll = dbMod.queryRecords(db, { start: '2000-01-01', end: '2100-12-31' });
    check(qAll.length === entries.length, `无筛选返回全部 (${qAll.length})`);
    const qKw = dbMod.queryRecords(db, { start: '2000-01-01', end: '2100-12-31', keyword: '购物' });
    check(qKw.length > 0 && qKw.every((r) => r.category.includes('购物')), `关键词筛选命中 ${qKw.length} 条`);
    const qType = dbMod.queryRecords(db, { start: '2000-01-01', end: '2100-12-31', type: 'income' });
    check(qType.length > 0 && qType.every((r) => r.type === 'income'), `类型筛选 income=${qType.length} 条`);
    const qCur = dbMod.queryRecords(db, { start: '2000-01-01', end: '2100-12-31', currency: 'USD' });
    check(qCur.length > 0 && qCur.every((r) => r.currency === 'USD'), `币种筛选 USD=${qCur.length} 条`);
    const qCombo = dbMod.queryRecords(db, { start: rangeW.start, end: rangeW.end, keyword: '购物', type: 'expense', currency: 'USD' });
    check(qCombo.length === 1 && qCombo[0].amount === 100, `组合筛选命中 1 条`);
    const cats = dbMod.listCategories(db);
    check(Array.isArray(cats) && cats.includes('购物') && cats.includes('餐饮'), `分类列表 (${cats.length} 项)`);

    // 预算设置
    console.log('\n[smoke] === budget settings ===');
    dbMod.setSetting(db, 'budget_total', '1000');
    dbMod.setSetting(db, 'budget_categories', JSON.stringify([{ name: '购物', amount: 500 }]));
    const payload = getSettingsPayload();
    check(payload.budgetTotal === 1000, 'budget_total=1000');
    check(Array.isArray(payload.budgetCategories) && payload.budgetCategories[0].name === '购物', 'budget_categories 解析正确');

    // 设置存取 + 有效汇率优先级
    console.log('\n[smoke] === settings & rate ===');
    dbMod.setSetting(db, 'lang', 'en');
    check(dbMod.getSetting(db, 'lang') === 'en', 'settings set/get lang');
    dbMod.setSetting(db, 'rate_manual', '7.5');
    let eff = effectiveRate();
    check(eff.rate === 7.5 && eff.source === 'manual', `manual rate override: ${eff.rate}`);
    dbMod.setSetting(db, 'rate_manual', '');
    dbMod.setSetting(db, 'usd_cny_rate', '7.19');
    dbMod.setSetting(db, 'rate_source', 'online');
    eff = effectiveRate();
    check(eff.rate === 7.19 && eff.source === 'online', `stored online rate: ${eff.rate}`);
    check(getSettingsPayload().currency === 'CNY' && getSettingsPayload().lang === 'en', 'settings payload');
    try {
      const online = await refreshRate();
      if (online.ok) console.log(`  ✓ 联网汇率获取成功: 1 USD = ${online.rate} CNY（来源 ${online.source}）`);
      else console.log(`  - 联网汇率获取失败（可接受，网络环境）: ${online.error}；回退 ${online.rate}`);
    } catch (err) {
      console.log(`  - 联网汇率测试异常（可接受）: ${err.message}`);
    }

    // 渲染层检查（隐藏窗口）
    console.log('\n[smoke] === renderer ===');
    const win = new BrowserWindow({
      show: false,
      webPreferences: {
        preload: path.join(__dirname, 'preload.js'),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
      },
    });
    const pageErrors = [];
    win.webContents.on('console-message', (_e, level, message) => {
      const isError = typeof level === 'string' ? level === 'error' : level >= 3;
      if (isError) pageErrors.push(message);
    });
    await win.loadFile(path.join(__dirname, 'renderer', 'index.html'));
    await new Promise((r) => setTimeout(r, 500));
    const ui = await win.webContents.executeJavaScript(
      `({
        hasApi: typeof window.api === 'object' && typeof window.api.getSettings === 'function',
        hasEcharts: typeof echarts !== 'undefined',
        hasAddPage: !!document.querySelector('#page-add'),
        hasSettingsModal: !!document.querySelector('#modal-settings'),
        hasT: typeof window.zz !== 'undefined' && typeof window.zz.t === 'function',
        summaryZh: window.zz ? window.zz.summaryFor({
          period: 'week', currency: 'CNY', rate: 7.2, expenseTotal: 1339, incomeTotal: 0,
          topCategory: { name: '购物', value: 1220, pct: 91 }, delta: 148, unified: true,
          rawExpenseCNY: 620, rawExpenseUSD: 100, rawIncomeCNY: 0, rawIncomeUSD: 0,
          prevExpenseTotal: 360,
        }, 'zh') : '',
        summaryEn: window.zz ? window.zz.summaryFor({
          period: 'week', currency: 'CNY', rate: 7.2, expenseTotal: 1339, incomeTotal: 0,
          topCategory: { name: '购物', value: 1220, pct: 91 }, delta: 148, unified: true,
          rawExpenseCNY: 620, rawExpenseUSD: 100, rawIncomeCNY: 0, rawIncomeUSD: 0,
          prevExpenseTotal: 360,
        }, 'en') : '',
      })`
    );
    check(ui.hasApi, 'preload API 注入成功');
    check(ui.hasEcharts, 'ECharts 已加载');
    check(ui.hasAddPage && ui.hasSettingsModal, '页面 DOM 完整（含设置弹窗）');
    check(ui.hasT, 'i18n 函数已暴露');
    check(ui.summaryZh.includes('总消费') && ui.summaryZh.includes('≈') && ui.summaryZh.includes('折算'), `中文总结: ${ui.summaryZh}`);
    check(ui.summaryEn.includes('Total spending') && ui.summaryEn.includes('≈'), `英文总结: ${ui.summaryEn}`);
    check(pageErrors.length === 0, `页面无控制台错误${pageErrors.length ? '：' + pageErrors.join(' | ') : ''}`);

    // 访问报表页验证图表真实渲染（折线 + 饼图 + 排行）
    const rpt = await win.webContents.executeJavaScript(`
      (async () => {
        document.querySelector('.tab[data-tab="report"][data-period="week"]').click();
        await new Promise((r) => setTimeout(r, 1500));
        return {
          canvases: document.querySelectorAll('#chart-line canvas, #chart-pie canvas, #chart-rank canvas').length,
          rankTitle: document.querySelector('#rank-title').textContent,
          budgetHidden: document.querySelector('#budget-card').classList.contains('hidden'),
          statCards: document.querySelectorAll('#stat-cards .stat-card').length,
          lineTitle: document.querySelector('#line-title').textContent,
        };
      })()
    `);
    check(rpt.canvases === 3, `报表页渲染出 3 张图表 (${rpt.canvases})`);
    check(rpt.statCards === 5, `统计卡片 5 张 (${rpt.statCards})`);
    check(rpt.rankTitle.length > 0, `排行图标题: ${rpt.rankTitle}`);
    check(rpt.budgetHidden === true, '周报不显示预算卡');
    check(typeof rpt.lineTitle === 'string' && rpt.lineTitle.length > 0, `折线图标题: ${rpt.lineTitle}`);

    // 设置面板：切换语言/货币时高亮应跟随移动
    const seg = await win.webContents.executeJavaScript(`
      (async () => {
        document.querySelector('#btn-settings').click();
        await new Promise((r) => setTimeout(r, 300));
        const langBefore = document.querySelector('#set-lang .seg.active')?.dataset.lang;
        document.querySelector('#set-lang .seg[data-lang="zh"]').click();
        await new Promise((r) => setTimeout(r, 500));
        const langAfter = document.querySelector('#set-lang .seg.active')?.dataset.lang;
        const curBefore = document.querySelector('#set-currency .seg.active')?.dataset.cur;
        document.querySelector('#set-currency .seg[data-cur="USD"]').click();
        await new Promise((r) => setTimeout(r, 500));
        const curAfter = document.querySelector('#set-currency .seg.active')?.dataset.cur;
        document.querySelector('#settings-close').click();
        return { langBefore, langAfter, curBefore, curAfter };
      })()
    `);
    check(seg.langAfter === 'zh', `语言高亮随点击移动: ${seg.langBefore} -> ${seg.langAfter}`);
    check(seg.curAfter === 'USD', `货币高亮随点击移动: ${seg.curBefore} -> ${seg.curAfter}`);
    win.destroy();

    console.log(failures === 0 ? '\n[smoke] ALL OK' : `\n[smoke] FAILED (${failures})`);
    db.close();
    for (const suffix of ['', '-wal', '-shm']) {
      try { fs.unlinkSync(tmpBase + suffix); } catch (_) {}
    }
    app.exit(failures === 0 ? 0 : 1);
  } catch (err) {
    console.error('[smoke] ERROR:', err);
    try { db && db.close(); } catch (_) {}
    app.exit(1);
  }
}

/* ---------------- 启动 ---------------- */

// 单实例锁：双击多次不会开多个窗口，第二次启动会聚焦已有窗口
if (!IS_SMOKE) {
  const gotLock = app.requestSingleInstanceLock();
  if (!gotLock) {
    app.quit();
  } else {
    app.on('second-instance', () => {
      if (mainWindow) {
        if (mainWindow.isMinimized()) mainWindow.restore();
        mainWindow.show();
        mainWindow.focus();
      }
    });
  }
}

app.whenReady().then(() => {
  registerIpc();
  if (IS_SMOKE) {
    runSmoke();
    return;
  }
  // macOS：Dock 图标（即使 Electron 包被重装后也保持自定义图标）
  if (process.platform === 'darwin' && app.dock) {
    const iconPng = path.join(__dirname, 'assets', 'icon.png');
    if (fs.existsSync(iconPng)) {
      app.dock.setIcon(iconPng);
    }
  }
  try {
    db = dbMod.openDb(path.join(app.getPath('userData'), 'ledger.db'));
  } catch (err) {
    dialog.showErrorBox('打开数据库失败', String(err && err.stack ? err.stack : err));
    app.exit(1);
    return;
  }
  const lang = dbMod.getSetting(db, 'lang', 'zh');
  createMenu(lang);
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

process.on('uncaughtException', (err) => {
  console.error('[main] uncaughtException:', err);
});
