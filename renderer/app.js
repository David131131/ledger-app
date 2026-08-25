'use strict';

/* ================= 工具 ================= */

const $ = (sel) => document.querySelector(sel);

function pad(n) { return String(n).padStart(2, '0'); }

function toStr(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

let toastTimer = null;
function toast(msg) {
  const el = $('#toast');
  el.textContent = msg;
  el.classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.add('hidden'), 2400);
}

/* ================= i18n ================= */

const EXP_CATS = {
  zh: ['餐饮', '交通', '购物', '居住', '娱乐', '医疗', '教育', '通讯', '人情', '其他'],
  en: ['Food & Dining', 'Transport', 'Shopping', 'Housing', 'Entertainment', 'Medical', 'Education', 'Telecom', 'Gifts', 'Other'],
};
const INC_CATS = {
  zh: ['工资', '奖金', '兼职', '理财', '红包', '其他'],
  en: ['Salary', 'Bonus', 'Part-time', 'Investment', 'Red Packet', 'Other'],
};

const I18N = {
  zh: {
    'app.brand': '📒 做账',
    'nav.add': '记一笔',
    'nav.records': '明细',
    'nav.week': '周报',
    'nav.month': '月报',
    'nav.quarter': '季报',
    'type.expense': '支出',
    'type.income': '收入',
    'type.expenseLabel': '支出',
    'type.incomeLabel': '收入',
    'add.title': '记一笔',
    'add.date': '日期',
    'add.category': '分类',
    'add.categoryPh': '如：餐饮 / 购物',
    'add.path': '消费路径',
    'add.pathPh': '如：淘宝 / 楼下超市（可选）',
    'add.note': '备注',
    'add.notePh': '（可选）',
    'add.save': '保存',
    'add.overviewTitle': '本月速览',
    'add.overviewExpense': '本月支出',
    'add.overviewIncome': '本月收入',
    'add.overviewBalance': '本月结余',
    'add.overviewCount': '本月笔数',
    'add.overviewTip': '数据保存在本机 SQLite 数据库（WAL 模式），离线可用。',
    'records.backThisMonth': '回到本月',
    'records.balance': '结余',
    'records.count': '笔数',
    'records.id': '编号',
    'records.amount': '金额',
    'records.type': '类型',
    'records.created': '创建时间',
    'records.actions': '操作',
    'records.empty': '该时间段暂无记录',
    'records.edit': '编辑',
    'records.delete': '删除',
    'records.editTitle': '编辑记录',
    'records.saveEdit': '保存修改',
    'records.confirmDelete': '确定删除这条记录吗？删除后不可恢复。',
    'records.monthLabel': '{y}年{m}月',
    'report.backThis': '回到本期',
    'report.pieTitle': '分类占比',
    'report.chartWeek': '本周 / 上周支出对比',
    'report.chartMonth': '每日支出 / 收入趋势',
    'report.chartQuarter': '每周支出 / 收入趋势',
    'report.seriesCurWeek': '本周支出',
    'report.seriesPrevWeek': '上周支出',
    'report.seriesExpense': '支出',
    'report.seriesIncome': '收入',
    'report.statExpense': '总支出',
    'report.statIncome': '总收入',
    'report.statBalance': '结余',
    'report.statTop': '主要消费分类',
    'report.statDelta': '支出环比（{prev}）',
    'report.statExpenseSub': '{n} 笔',
    'report.statIncomeSub': '{n} 笔',
    'report.balanceSub': '收入 − 支出',
    'report.topSub': '{money} · 占 {pct}%',
    'report.noExpense': '本期无支出',
    'report.deltaSub': '{prev}支出 ¥{money}',
    'report.noData': '暂无数据',
    'report.flat': '持平',
    'report.approx': '≈',
    'settings.title': '设置 / Settings',
    'settings.lang': '语言 / Language',
    'settings.currency': '显示货币 / Display currency',
    'settings.rate': '当日汇率 / Exchange rate',
    'settings.refresh': '刷新汇率',
    'settings.clearManual': '清除手动',
    'settings.ratePh': '手动设置 1 USD = ? CNY',
    'settings.rateTip': '混合币种的账单会按此汇率统一折算，并以 ≈ 标注近似值。',
    'settings.data': '数据 / Data',
    'settings.exportCsv': '导出 CSV',
    'settings.backupDb': '备份数据库',
    'settings.dataTip': 'CSV 带 UTF-8 BOM，可用 Excel/Numbers 直接打开；数据库备份为完整快照。',
    'settings.source.online': '联网',
    'settings.source.fallback': '离线缓存',
    'settings.source.manual': '手动',
    'settings.source.default': '默认',
    'settings.rateUpdated': '更新于',
    'settings.rateNever': '未获取过',
    'common.cancel': '取消',
    'common.close': '关闭',
    'common.save': '保存',
    'toast.saved': '已保存 ✓',
    'toast.updated': '已更新 ✓',
    'toast.deleted': '已删除',
    'toast.amountInvalid': '请输入正确的金额',
    'toast.loadRecordsFailed': '加载明细失败：{msg}',
    'toast.deleteFailed': '删除失败：{msg}',
    'toast.updateFailed': '更新失败：{msg}',
    'toast.reportFailed': '生成报表失败：{msg}',
    'toast.rateRefreshed': '汇率已更新：1 USD ≈ {rate} CNY',
    'toast.rateFailed': '联网获取失败（{msg}），继续使用当前汇率 {rate}',
    'toast.rateSaved': '手动汇率已保存：1 USD ≈ {rate} CNY',
    'toast.rateCleared': '已恢复使用联网/缓存汇率',
    'toast.rateInvalid': '请输入有效的汇率数字',
    'toast.exportDone': '已导出 {count} 条记录：{path}',
    'toast.exportFailed': '导出失败：{msg}',
    'toast.backupDone': '已备份数据库：{path}',
    'toast.backupFailed': '备份失败：{msg}',
  },
  en: {
    'app.brand': '📒 Ledger',
    'nav.add': 'Add',
    'nav.records': 'Records',
    'nav.week': 'Weekly',
    'nav.month': 'Monthly',
    'nav.quarter': 'Quarterly',
    'type.expense': 'Expense',
    'type.income': 'Income',
    'type.expenseLabel': 'Expense',
    'type.incomeLabel': 'Income',
    'add.title': 'Add Entry',
    'add.date': 'Date',
    'add.category': 'Category',
    'add.categoryPh': 'e.g. Food / Shopping',
    'add.path': 'Where',
    'add.pathPh': 'e.g. Taobao / grocery store (optional)',
    'add.note': 'Note',
    'add.notePh': '(optional)',
    'add.save': 'Save',
    'add.overviewTitle': 'This Month',
    'add.overviewExpense': 'Expense',
    'add.overviewIncome': 'Income',
    'add.overviewBalance': 'Balance',
    'add.overviewCount': 'Entries',
    'add.overviewTip': 'Data is stored in a local SQLite database (WAL mode), fully offline.',
    'records.backThisMonth': 'Back to this month',
    'records.balance': 'Balance',
    'records.count': 'Entries',
    'records.id': '#',
    'records.amount': 'Amount',
    'records.type': 'Type',
    'records.created': 'Created',
    'records.actions': 'Actions',
    'records.empty': 'No records in this period',
    'records.edit': 'Edit',
    'records.delete': 'Delete',
    'records.editTitle': 'Edit Entry',
    'records.saveEdit': 'Save Changes',
    'records.confirmDelete': 'Delete this record? This cannot be undone.',
    'records.monthLabel': '{m} {y}',
    'report.backThis': 'Back to current period',
    'report.pieTitle': 'By Category',
    'report.chartWeek': 'This Week vs Last Week',
    'report.chartMonth': 'Daily Spending / Income',
    'report.chartQuarter': 'Weekly Spending / Income',
    'report.seriesCurWeek': 'This Week',
    'report.seriesPrevWeek': 'Last Week',
    'report.seriesExpense': 'Spending',
    'report.seriesIncome': 'Income',
    'report.statExpense': 'Total Expense',
    'report.statIncome': 'Total Income',
    'report.statBalance': 'Balance',
    'report.statTop': 'Top Category',
    'report.statDelta': 'vs {prev}',
    'report.statExpenseSub': '{n} entries',
    'report.statIncomeSub': '{n} entries',
    'report.balanceSub': 'Income − Expense',
    'report.topSub': '{money} · {pct}%',
    'report.noExpense': 'No expense this period',
    'report.deltaSub': '{prev} expense ¥{money}',
    'report.noData': 'No data',
    'report.flat': 'flat',
    'report.approx': '≈',
    'settings.title': 'Settings / 设置',
    'settings.lang': 'Language / 语言',
    'settings.currency': 'Display Currency / 显示货币',
    'settings.rate': 'Exchange Rate / 当日汇率',
    'settings.refresh': 'Refresh Rate',
    'settings.clearManual': 'Clear Manual',
    'settings.ratePh': 'Manual rate: 1 USD = ? CNY',
    'settings.rateTip': 'Mixed-currency bills are converted at this rate and marked with ≈ as approximate.',
    'settings.data': 'Data / 数据',
    'settings.exportCsv': 'Export CSV',
    'settings.backupDb': 'Back Up Database',
    'settings.dataTip': 'CSV includes a UTF-8 BOM and opens directly in Excel/Numbers; the backup is a full database snapshot.',
    'settings.source.online': 'Online',
    'settings.source.fallback': 'Offline cache',
    'settings.source.manual': 'Manual',
    'settings.source.default': 'Default',
    'settings.rateUpdated': 'Updated',
    'settings.rateNever': 'Never fetched',
    'common.cancel': 'Cancel',
    'common.close': 'Close',
    'common.save': 'Save',
    'toast.saved': 'Saved ✓',
    'toast.updated': 'Updated ✓',
    'toast.deleted': 'Deleted',
    'toast.amountInvalid': 'Please enter a valid amount',
    'toast.loadRecordsFailed': 'Failed to load records: {msg}',
    'toast.deleteFailed': 'Failed to delete: {msg}',
    'toast.updateFailed': 'Failed to update: {msg}',
    'toast.reportFailed': 'Failed to build report: {msg}',
    'toast.rateRefreshed': 'Rate updated: 1 USD ≈ {rate} CNY',
    'toast.rateFailed': 'Fetch failed ({msg}); keeping rate {rate}',
    'toast.rateSaved': 'Manual rate saved: 1 USD ≈ {rate} CNY',
    'toast.rateCleared': 'Now using online/cached rate',
    'toast.rateInvalid': 'Please enter a valid rate',
    'toast.exportDone': 'Exported {count} records: {path}',
    'toast.exportFailed': 'Export failed: {msg}',
    'toast.backupDone': 'Database backed up: {path}',
    'toast.backupFailed': 'Backup failed: {msg}',
  },
};

function t(key, params) {
  let s = (I18N[state.lang] && I18N[state.lang][key]) || I18N.zh[key] || key;
  if (params) {
    for (const k of Object.keys(params)) s = s.replace(`{${k}}`, String(params[k]));
  }
  return s;
}

function applyI18n() {
  document.title = state.lang === 'zh' ? '做账' : 'Ledger';
  document.documentElement.lang = state.lang === 'zh' ? 'zh-CN' : 'en';
  document.querySelectorAll('[data-i18n]').forEach((el) => {
    el.textContent = t(el.dataset.i18n);
  });
  document.querySelectorAll('[data-i18n-ph]').forEach((el) => {
    el.placeholder = t(el.dataset.i18nPh);
  });
  document.querySelectorAll('[data-i18n-title]').forEach((el) => {
    el.title = t(el.dataset.i18nTitle);
  });
  rebuildCategoryLists();
}

function rebuildCategoryLists() {
  const exp = EXP_CATS[state.lang];
  const inc = INC_CATS[state.lang];
  $('#cat-expense').innerHTML = exp.map((c) => `<option value="${esc(c)}"></option>`).join('');
  $('#cat-income').innerHTML = inc.map((c) => `<option value="${esc(c)}"></option>`).join('');
}

/* ================= 货币 ================= */

const CUR = {
  CNY: { symbol: '¥', name: 'CNY' },
  USD: { symbol: '$', name: 'USD' },
};

/** 金额：¥1,234.56 */
function fmtMoney(v, currency) {
  const c = CUR[currency] || CUR.CNY;
  const sign = v < 0 ? '-' : '';
  return `${sign}${c.symbol}${Math.abs(v).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** 不带符号：1,234.56 */
function fmtNum(v) {
  return v.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** 文案金额：920 / 920.5 / 920.55 */
function fmtPlain(n) {
  return n.toFixed(2).replace(/\.?0+$/, '');
}

/* ================= 状态 ================= */

const today = new Date();

const state = {
  tab: 'add',
  reportPeriod: 'week',
  formType: 'expense',   // 记账表单：支出/收入
  formCurrency: 'CNY',   // 记账表单：币种
  editType: 'expense',
  editCurrency: 'CNY',
  pieMode: 'expense',
  editingId: null,
  lang: 'zh',
  currency: 'CNY',
  rate: { value: 7.2, source: 'default', updatedAt: '', manual: '' },
  anchors: {
    week: today,
    month: new Date(today.getFullYear(), today.getMonth(), 1),
    quarter: new Date(today.getFullYear(), Math.floor(today.getMonth() / 3) * 3, 1),
    records: new Date(today.getFullYear(), today.getMonth(), 1),
  },
  charts: { line: null, pie: null },
  lastReport: null,
};

const EXPENSE_COLOR = '#ef4444';
const INCOME_COLOR = '#10b981';
const PALETTE = ['#f87171', '#fb923c', '#fbbf24', '#34d399', '#22d3ee', '#818cf8', '#c084fc', '#e879f9', '#94a3b8', '#f472b6'];

/* ================= 总结文案（双语 + 统一货币） ================= */

const PERIOD_NAMES = {
  zh: { week: ['本周', '上周'], month: ['本月', '上月'], quarter: ['本季度', '上季度'] },
  en: { week: ['this week', 'last week'], month: ['this month', 'last month'], quarter: ['this quarter', 'last quarter'] },
};

/**
 * 生成总结文案，混合币种时标注 ≈ 并给出折算明细。
 * 例（zh）：“本周总消费约 ¥1,339.00。主要消费来自购物，占91%。相比上周增加272%。
 *          按当日汇率 1 USD ≈ 7.2000 CNY 折算（其中支出含 $100.00 ≈ ¥720.00）。”
 */
function buildSummaryText(report, lang) {
  const zh = lang === 'zh';
  const [curName, prevName] = PERIOD_NAMES[zh ? 'zh' : 'en'][report.period] || PERIOD_NAMES.zh[report.period];
  const parts = [];
  const approx = report.unified ? (zh ? '约 ' : '≈ ') : '';
  const money = (v) => fmtMoney(v, report.currency);

  if (report.expenseTotal > 0) {
    parts.push(
      zh
        ? `${curName}总消费${approx}${money(report.expenseTotal)}`
        : `Total spending ${curName}: ${approx}${money(report.expenseTotal)}`
    );
    if (report.topCategory) {
      const top = report.topCategory;
      parts.push(
        zh
          ? `主要消费来自${top.name}，占${top.pct}%`
          : `Main spending came from ${top.name}, accounting for ${top.pct}%`
      );
    }
  } else {
    parts.push(zh ? `${curName}暂无消费记录` : `No spending recorded ${curName}`);
  }

  if (report.expenseTotal > 0) {
    if (report.delta !== null) {
      if (report.delta > 0) {
        parts.push(zh ? `相比${prevName}增加${report.delta}%` : `Up ${report.delta}% compared with ${prevName}`);
      } else if (report.delta < 0) {
        parts.push(zh ? `相比${prevName}减少${-report.delta}%` : `Down ${-report.delta}% compared with ${prevName}`);
      } else {
        parts.push(zh ? `与${prevName}持平` : `Same as ${prevName}`);
      }
    } else {
      parts.push(zh ? `${prevName}暂无消费记录` : `No spending recorded ${prevName}`);
    }
  }

  if (report.unified) {
    const rateTxt = Number(report.rate).toFixed(4);
    parts.push(
      zh
        ? `按当日汇率 1 USD ≈ ${rateTxt} CNY 折算`
        : `Converted at today's rate 1 USD ≈ ${rateTxt} CNY`
    );
    // 折算明细（只列出与显示币种不同的部分）
    const others = [];
    const sym = (c) => (c === 'CNY' ? '¥' : '$');
    if (report.currency === 'CNY') {
      if (report.rawExpenseUSD > 0) {
        others.push(`${sym('USD')}${fmtNum(report.rawExpenseUSD)} ≈ ¥${fmtNum(report.rawExpenseUSD * report.rate)}`);
      }
      if (report.rawIncomeUSD > 0) {
        others.push(`${sym('USD')}${fmtNum(report.rawIncomeUSD)} ≈ ¥${fmtNum(report.rawIncomeUSD * report.rate)}`);
      }
    } else {
      if (report.rawExpenseCNY > 0) {
        others.push(`¥${fmtNum(report.rawExpenseCNY)} ≈ $${fmtNum(report.rawExpenseCNY / report.rate)}`);
      }
      if (report.rawIncomeCNY > 0) {
        others.push(`¥${fmtNum(report.rawIncomeCNY)} ≈ $${fmtNum(report.rawIncomeCNY / report.rate)}`);
      }
    }
    if (others.length > 0) {
      parts.push(zh ? `其中 ${others.join('、')}` : `including ${others.join(', ')}`);
    }
  }

  return parts.join('。') + '。';
}

/* ================= 页面切换 ================= */

function switchTab(tab, period) {
  state.tab = tab;
  document.querySelectorAll('.page').forEach((p) => p.classList.remove('active'));
  document.querySelectorAll('.tab').forEach((b) => {
    const isActive = b.dataset.tab === tab && (!b.dataset.period || b.dataset.period === period);
    b.classList.toggle('active', isActive);
  });
  $('#page-add').classList.toggle('active', tab === 'add');
  $('#page-records').classList.toggle('active', tab === 'records');
  $('#page-report').classList.toggle('active', tab === 'report');

  if (tab === 'add') refreshOverview();
  else if (tab === 'records') renderRecords();
  else if (tab === 'report') {
    state.reportPeriod = period;
    renderReport();
  }
}

/* ================= 记一笔 ================= */

function setFormType(type) {
  state.formType = type;
  document.querySelectorAll('#type-switch .seg').forEach((b) =>
    b.classList.toggle('active', b.dataset.type === type)
  );
  $('#f-category').setAttribute('list', type === 'expense' ? 'cat-expense' : 'cat-income');
}

function setFormCurrency(cur, silent) {
  state.formCurrency = cur;
  $('#f-currency-symbol').textContent = CUR[cur].symbol;
  document.querySelectorAll('#f-currency-switch .seg').forEach((b) =>
    b.classList.toggle('active', b.dataset.cur === cur)
  );
}

async function submitAdd(e) {
  e.preventDefault();
  const amount = parseFloat($('#f-amount').value);
  if (!Number.isFinite(amount) || amount <= 0) return toast(t('toast.amountInvalid'));
  try {
    await window.api.addRecord({
      date: $('#f-date').value,
      amount,
      currency: state.formCurrency,
      category: $('#f-category').value.trim() || (state.lang === 'zh' ? '其他' : 'Other'),
      type: state.formType,
      path: $('#f-path').value.trim(),
      note: $('#f-note').value.trim(),
    });
    toast(t('toast.saved'));
    $('#f-amount').value = '';
    $('#f-path').value = '';
    $('#f-note').value = '';
    $('#f-amount').focus();
    refreshOverview();
  } catch (err) {
    toast(`保存失败：${err.message}`);
  }
}

async function refreshOverview() {
  try {
    const a = new Date(today.getFullYear(), today.getMonth(), 1);
    const end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    const ov = await window.api.overview({ start: toStr(a), end: toStr(end) }, state.currency, state.rate.value);
    const approx = ov.unified ? t('report.approx') : '';
    $('#ov-expense').textContent = `${approx}${fmtMoney(ov.expense, state.currency)}`;
    $('#ov-income').textContent = `${approx}${fmtMoney(ov.income, state.currency)}`;
    const bal = ov.income - ov.expense;
    $('#ov-balance').textContent = `${approx}${fmtMoney(bal, state.currency)}`;
    $('#ov-balance').className = bal >= 0 ? 'c-income' : 'c-expense';
    $('#ov-count').textContent = ov.count;
  } catch (err) {
    console.error(err);
  }
}

/* ================= 明细 ================= */

function monthRange(anchor) {
  const start = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
  const end = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0);
  return { start, end };
}

function monthLabel(anchor) {
  const zh = state.lang === 'zh';
  if (zh) return t('records.monthLabel', { y: anchor.getFullYear(), m: anchor.getMonth() + 1 });
  const name = new Date(anchor.getFullYear(), anchor.getMonth(), 1).toLocaleDateString('en-US', { month: 'long' });
  return t('records.monthLabel', { y: anchor.getFullYear(), m: name });
}

async function renderRecords() {
  const anchor = state.anchors.records;
  const { start, end } = monthRange(anchor);
  $('#rec-title').textContent = monthLabel(anchor);

  try {
    const [rows, ov] = await Promise.all([
      window.api.listRecords({ start: toStr(start), end: toStr(end) }),
      window.api.overview({ start: toStr(start), end: toStr(end) }, state.currency, state.rate.value),
    ]);
    const approx = ov.unified ? t('report.approx') : '';
    $('#rec-expense').textContent = `${approx}${fmtMoney(ov.expense, state.currency)}`;
    $('#rec-income').textContent = `${approx}${fmtMoney(ov.income, state.currency)}`;
    const bal = ov.income - ov.expense;
    $('#rec-balance').textContent = `${approx}${fmtMoney(bal, state.currency)}`;
    $('#rec-balance').className = bal >= 0 ? 'c-income' : 'c-expense';
    $('#rec-count').textContent = ov.count;

    const tbody = $('#records-tbody');
    if (rows.length === 0) {
      tbody.innerHTML = '';
      $('#records-empty').classList.remove('hidden');
      return;
    }
    $('#records-empty').classList.add('hidden');
    tbody.innerHTML = rows.map((r) => {
      const isExpense = r.type === 'expense';
      const recCur = r.currency === 'USD' ? 'USD' : 'CNY';
      const converted =
        recCur === state.currency
          ? ''
          : ` <span class="converted">(${fmtMoney(recCur === 'CNY' ? r.amount / state.rate.value : r.amount * state.rate.value, state.currency)})</span>`;
      return `<tr>
        <td>${r.id}</td>
        <td>${esc(r.date)}</td>
        <td class="${isExpense ? 'c-expense' : 'c-income'}">${isExpense ? '-' : '+'}${fmtMoney(r.amount, recCur)}${converted}</td>
        <td>${esc(r.category)}</td>
        <td>${isExpense ? t('type.expense') : t('type.income')}</td>
        <td>${esc(r.path) || '<span style="color:#c0c6d1">—</span>'}</td>
        <td title="${esc(r.note)}">${esc(r.note) || '<span style="color:#c0c6d1">—</span>'}</td>
        <td>${esc(r.created_time)}</td>
        <td><div class="row-actions">
          <button class="link-btn" data-edit="${r.id}">${t('records.edit')}</button>
          <button class="link-btn danger" data-del="${r.id}">${t('records.delete')}</button>
        </div></td>
      </tr>`;
    }).join('');

    tbody.querySelectorAll('[data-edit]').forEach((btn) =>
      btn.addEventListener('click', () => openEdit(Number(btn.dataset.edit), rows))
    );
    tbody.querySelectorAll('[data-del]').forEach((btn) =>
      btn.addEventListener('click', () => removeRecord(Number(btn.dataset.del)))
    );
  } catch (err) {
    toast(t('toast.loadRecordsFailed', { msg: err.message }));
  }
}

async function removeRecord(id) {
  if (!confirm(t('records.confirmDelete'))) return;
  try {
    await window.api.deleteRecord(id);
    toast(t('toast.deleted'));
    renderRecords();
  } catch (err) {
    toast(t('toast.deleteFailed', { msg: err.message }));
  }
}

function shiftRecordsMonth(delta) {
  const a = state.anchors.records;
  state.anchors.records = new Date(a.getFullYear(), a.getMonth() + delta, 1);
  renderRecords();
}

/* ================= 编辑弹窗 ================= */

function openEdit(id, rows) {
  const r = rows.find((x) => x.id === id);
  if (!r) return;
  state.editingId = id;
  state.editType = r.type;
  state.editCurrency = r.currency === 'USD' ? 'USD' : 'CNY';
  $('#e-amount').value = r.amount;
  $('#e-date').value = r.date;
  $('#e-category').value = r.category;
  $('#e-path').value = r.path || '';
  $('#e-note').value = r.note || '';
  $('#e-currency-symbol').textContent = CUR[state.editCurrency].symbol;
  document.querySelectorAll('#edit-type-switch .seg').forEach((b) =>
    b.classList.toggle('active', b.dataset.type === r.type)
  );
  document.querySelectorAll('#e-currency-switch .seg').forEach((b) =>
    b.classList.toggle('active', b.dataset.cur === state.editCurrency)
  );
  $('#e-category').setAttribute('list', r.type === 'expense' ? 'cat-expense' : 'cat-income');
  $('#modal').classList.remove('hidden');
  $('#e-amount').focus();
}

function closeEdit() {
  $('#modal').classList.add('hidden');
  state.editingId = null;
}

async function submitEdit(e) {
  e.preventDefault();
  const amount = parseFloat($('#e-amount').value);
  if (!Number.isFinite(amount) || amount <= 0) return toast(t('toast.amountInvalid'));
  try {
    await window.api.updateRecord(state.editingId, {
      date: $('#e-date').value,
      amount,
      currency: state.editCurrency,
      category: $('#e-category').value.trim() || (state.lang === 'zh' ? '其他' : 'Other'),
      type: state.editType,
      path: $('#e-path').value.trim(),
      note: $('#e-note').value.trim(),
    });
    toast(t('toast.updated'));
    closeEdit();
    renderRecords();
    refreshOverview();
  } catch (err) {
    toast(t('toast.updateFailed', { msg: err.message }));
  }
}

/* ================= 报表 ================= */

function shiftAnchor(delta) {
  const p = state.reportPeriod;
  const a = state.anchors[p];
  if (p === 'week') {
    const x = new Date(a);
    x.setDate(x.getDate() + delta * 7);
    state.anchors[p] = x;
  } else if (p === 'month') {
    state.anchors[p] = new Date(a.getFullYear(), a.getMonth() + delta, 1);
  } else {
    state.anchors[p] = new Date(a.getFullYear(), a.getMonth() + delta * 3, 1);
  }
  renderReport();
}

function resetAnchor() {
  state.anchors[state.reportPeriod] = new Date();
  renderReport();
}

function disposeCharts() {
  for (const key of Object.keys(state.charts)) {
    if (state.charts[key]) {
      state.charts[key].dispose();
      state.charts[key] = null;
    }
  }
}

function periodLabel(report) {
  const zh = state.lang === 'zh';
  const [sy, sm, sd] = report.range.start.split('-').map(Number);
  const [, em, ed] = report.range.end.split('-').map(Number);
  if (zh) {
    if (report.period === 'week') return `${report.isoYear}年 第${report.weekNum}周（${sm}月${sd}日 - ${em}月${ed}日）`;
    if (report.period === 'month') return `${sy}年${sm}月`;
    const q = Math.floor((sm - 1) / 3) + 1;
    return `${sy}年 第${q}季度（${sm}月 - ${em}月）`;
  }
  const mName = (m) => new Date(2000, m - 1, 1).toLocaleDateString('en-US', { month: 'short' });
  if (report.period === 'week') return `Week ${report.weekNum}, ${report.isoYear} (${mName(sm)} ${sd} - ${mName(em)} ${ed})`;
  if (report.period === 'month') return `${mName(sm)} ${sy}`;
  const q = Math.floor((sm - 1) / 3) + 1;
  return `Q${q} ${sy} (${mName(sm)} - ${mName(em)})`;
}

function xLabels(points, period) {
  const zh = state.lang === 'zh';
  const weekNames = zh
    ? ['周一', '周二', '周三', '周四', '周五', '周六', '周日']
    : ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  if (period === 'week') return points.map((p) => weekNames[p.dow]);
  if (period === 'month') return points.map((p) => (zh ? `${p.day}日` : `${p.day}`));
  return points.map((p) => `${p.m}/${p.d}`);
}

function buildLineOption(points, prevPoints, period, currency) {
  const sym = CUR[currency].symbol;
  const labels = xLabels(points, period);
  const series = [];
  if (period === 'week') {
    series.push(
      {
        name: t('report.seriesCurWeek'),
        type: 'line',
        smooth: true,
        symbolSize: 7,
        data: points.map((p) => p.expense),
        itemStyle: { color: EXPENSE_COLOR },
        lineStyle: { width: 3, color: EXPENSE_COLOR },
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: 'rgba(239,68,68,0.22)' },
            { offset: 1, color: 'rgba(239,68,68,0)' },
          ]),
        },
      },
      {
        name: t('report.seriesPrevWeek'),
        type: 'line',
        smooth: true,
        symbol: 'none',
        data: (prevPoints || []).map((p) => p.expense),
        itemStyle: { color: '#94a3b8' },
        lineStyle: { width: 2, type: 'dashed', color: '#94a3b8' },
      }
    );
  } else {
    series.push(
      {
        name: t('report.seriesExpense'),
        type: 'line',
        smooth: true,
        symbolSize: 6,
        data: points.map((p) => p.expense),
        itemStyle: { color: EXPENSE_COLOR },
        lineStyle: { width: 3, color: EXPENSE_COLOR },
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: 'rgba(239,68,68,0.18)' },
            { offset: 1, color: 'rgba(239,68,68,0)' },
          ]),
        },
      },
      {
        name: t('report.seriesIncome'),
        type: 'line',
        smooth: true,
        symbolSize: 6,
        data: points.map((p) => p.income),
        itemStyle: { color: INCOME_COLOR },
        lineStyle: { width: 3, color: INCOME_COLOR },
      }
    );
  }
  const hasData = points.some((p) => p.expense > 0 || p.income > 0) ||
    (prevPoints || []).some((p) => p.expense > 0);
  return {
    title: hasData ? undefined : { text: t('report.noData'), left: 'center', top: 'middle', textStyle: { color: '#98a2b3', fontSize: 14 } },
    tooltip: {
      trigger: 'axis',
      valueFormatter: (v) => (v == null ? '-' : `${sym}${fmtNum(v)}`),
    },
    legend: { top: 0, right: 0, textStyle: { color: '#667085' } },
    grid: { left: 8, right: 16, top: 36, bottom: 8, containLabel: true },
    xAxis: {
      type: 'category',
      data: labels,
      boundaryGap: false,
      axisLine: { lineStyle: { color: '#e6e9f0' } },
      axisTick: { show: false },
      axisLabel: { color: '#667085' },
    },
    yAxis: {
      type: 'value',
      name: currency,
      nameTextStyle: { color: '#98a2b3' },
      splitLine: { lineStyle: { color: '#f1f3f7' } },
      axisLabel: { color: '#98a2b3' },
    },
    series,
  };
}

function buildPieOption(items, total, currency) {
  const sym = CUR[currency].symbol;
  const hasData = items.length > 0 && total > 0;
  return {
    title: hasData ? undefined : { text: t('report.noData'), left: 'center', top: 'middle', textStyle: { color: '#98a2b3', fontSize: 14 } },
    color: PALETTE,
    tooltip: { trigger: 'item', valueFormatter: (v) => `${sym}${fmtNum(v)}` },
    legend: { bottom: 0, textStyle: { color: '#667085' }, icon: 'circle' },
    graphic: hasData ? [{
      type: 'text',
      left: 'center',
      top: '40%',
      style: { text: `${sym}${fmtPlain(total)}`, textAlign: 'center', fontSize: 18, fontWeight: 700, fill: '#1f2430' },
    }, {
      type: 'text',
      left: 'center',
      top: '48%',
      style: { text: t('report.pieTitle'), textAlign: 'center', fontSize: 12, fill: '#98a2b3' },
    }] : [],
    series: [{
      type: 'pie',
      radius: ['42%', '68%'],
      center: ['50%', '44%'],
      avoidLabelOverlap: true,
      itemStyle: { borderColor: '#fff', borderWidth: 2, borderRadius: 4 },
      label: { formatter: '{b}\n{d}%', color: '#667085' },
      data: items.map((c) => ({ name: c.name, value: c.value })),
    }],
  };
}

async function renderReport() {
  const p = state.reportPeriod;
  disposeCharts();
  try {
    const report = await window.api.getReport(p, toStr(state.anchors[p]), state.currency, state.rate.value);
    state.lastReport = report;

    $('#rp-title').textContent = periodLabel(report);
    $('#rp-today').textContent = t('report.backThis');
    $('#summary-sentence').textContent = buildSummaryText(report, state.lang);
    $('#line-title').textContent =
      p === 'week' ? t('report.chartWeek') : p === 'month' ? t('report.chartMonth') : t('report.chartQuarter');
    $('#pie-expense').textContent = t('type.expense');
    $('#pie-income').textContent = t('type.income');

    // 统计卡片
    const approx = report.unified ? t('report.approx') : '';
    const prevName = PERIOD_NAMES[state.lang][p][1];
    const deltaTxt = report.delta === null
      ? '<span style="color:#98a2b3">—</span>'
      : (report.delta > 0
        ? `<span class="c-expense">+${report.delta}%</span>`
        : report.delta < 0
          ? `<span class="c-income">${report.delta}%</span>`
          : `<span style="color:#98a2b3">${t('report.flat')}</span>`);
    $('#stat-cards').innerHTML = `
      <div class="card stat-card"><div class="label">${t('report.statExpense')}</div><div class="value c-expense">${approx}${fmtMoney(report.expenseTotal, state.currency)}</div><div class="sub">${t('report.statExpenseSub', { n: report.expenseCount })}</div></div>
      <div class="card stat-card"><div class="label">${t('report.statIncome')}</div><div class="value c-income">${approx}${fmtMoney(report.incomeTotal, state.currency)}</div><div class="sub">${t('report.statIncomeSub', { n: report.incomeCount })}</div></div>
      <div class="card stat-card"><div class="label">${t('report.statBalance')}</div><div class="value ${report.balance >= 0 ? 'c-income' : 'c-expense'}">${approx}${fmtMoney(report.balance, state.currency)}</div><div class="sub">${t('report.balanceSub')}</div></div>
      <div class="card stat-card"><div class="label">${t('report.statTop')}</div><div class="value" style="font-size:18px">${report.topCategory ? esc(report.topCategory.name) : '—'}</div><div class="sub">${report.topCategory ? t('report.topSub', { money: fmtMoney(report.topCategory.value, state.currency), pct: report.topCategory.pct }) : t('report.noExpense')}</div></div>
      <div class="card stat-card"><div class="label">${t('report.statDelta', { prev: prevName })}</div><div class="value">${deltaTxt}</div><div class="sub">${t('report.deltaSub', { prev: prevName, money: fmtNum(report.prevExpenseTotal) })}</div></div>
    `;

    // 折线图
    state.charts.line = echarts.init($('#chart-line'));
    state.charts.line.setOption(buildLineOption(report.points, report.prevPoints, p, state.currency));

    // 饼图
    state.charts.pie = echarts.init($('#chart-pie'));
    renderPie(report);
  } catch (err) {
    toast(t('toast.reportFailed', { msg: err.message }));
    console.error(err);
  }
}

function renderPie(report) {
  if (!state.charts.pie || !report) return;
  const isExpense = state.pieMode === 'expense';
  const items = isExpense ? report.byCategoryExpense : report.byCategoryIncome;
  const total = isExpense ? report.expenseTotal : report.incomeTotal;
  state.charts.pie.setOption(buildPieOption(items, total, state.currency), true);
  $('#pie-expense').classList.toggle('active', isExpense);
  $('#pie-income').classList.toggle('active', !isExpense);
}

/* ================= 设置 ================= */

function renderRateDisplay() {
  const { value, source, updatedAt, manual } = state.rate;
  const srcName = t(`settings.source.${source}`);
  const updated = updatedAt ? `${t('settings.rateUpdated')} ${updatedAt}` : t('settings.rateNever');
  const manualNote = manual ? ` · ${t('settings.source.manual')}` : '';
  $('#rate-display').textContent =
    `1 USD ≈ ${Number(value).toFixed(4)} CNY · ${srcName}${manualNote} · ${updated}`;
  $('#btn-clear-rate').classList.toggle('hidden', !manual);
  if (manual) $('#rate-manual').value = manual;
}

function openSettings() {
  renderRateDisplay();
  document.querySelectorAll('#set-lang .seg').forEach((b) =>
    b.classList.toggle('active', b.dataset.lang === state.lang)
  );
  document.querySelectorAll('#set-currency .seg').forEach((b) =>
    b.classList.toggle('active', b.dataset.cur === state.currency)
  );
  $('#modal-settings').classList.remove('hidden');
}

function closeSettings() {
  $('#modal-settings').classList.add('hidden');
}

async function changeLang(lang) {
  if (lang === state.lang) return;
  state.lang = lang;
  applyI18n();
  try { await window.api.setSetting('lang', lang); } catch (err) { console.error(err); }
  switchTab(state.tab, state.reportPeriod);
}

async function changeCurrency(cur) {
  if (cur === state.currency) return;
  state.currency = cur;
  try { await window.api.setSetting('currency', cur); } catch (err) { console.error(err); }
  switchTab(state.tab, state.reportPeriod);
}

async function refreshRateNow() {
  try {
    const r = await window.api.refreshRate();
    if (r.ok) {
      state.rate = { value: r.rate, source: r.source, updatedAt: r.updatedAt, manual: '' };
      toast(t('toast.rateRefreshed', { rate: Number(r.rate).toFixed(4) }));
    } else {
      state.rate = { value: r.rate, source: r.source, updatedAt: r.updatedAt, manual: state.rate.manual };
      toast(t('toast.rateFailed', { msg: r.error, rate: Number(r.rate).toFixed(4) }));
    }
    renderRateDisplay();
    switchTab(state.tab, state.reportPeriod);
  } catch (err) {
    toast(t('toast.rateFailed', { msg: err.message, rate: Number(state.rate.value).toFixed(4) }));
  }
}

async function saveManualRate() {
  const v = parseFloat($('#rate-manual').value);
  if (!Number.isFinite(v) || v <= 0) return toast(t('toast.rateInvalid'));
  try {
    const r = await window.api.setSetting('rate_manual', String(v));
    state.rate = { value: r.rate, source: r.source, updatedAt: r.updatedAt, manual: String(v) };
    toast(t('toast.rateSaved', { rate: Number(v).toFixed(4) }));
    renderRateDisplay();
    switchTab(state.tab, state.reportPeriod);
  } catch (err) {
    toast(t('toast.rateInvalid'));
  }
}

async function clearManualRate() {
  try {
    const r = await window.api.setSetting('rate_manual', '');
    state.rate = { value: r.rate, source: r.source, updatedAt: r.updatedAt, manual: '' };
    $('#rate-manual').value = '';
    toast(t('toast.rateCleared'));
    renderRateDisplay();
    switchTab(state.tab, state.reportPeriod);
  } catch (err) {
    console.error(err);
  }
}

async function exportCsv() {
  try {
    const r = await window.api.exportCsv();
    if (r.canceled) return;
    toast(t('toast.exportDone', { count: r.count, path: r.path }));
  } catch (err) {
    toast(t('toast.exportFailed', { msg: err.message }));
  }
}

async function backupDb() {
  try {
    const r = await window.api.backupDb();
    if (r.canceled) return;
    toast(t('toast.backupDone', { path: r.path }));
  } catch (err) {
    toast(t('toast.backupFailed', { msg: err.message }));
  }
}

/* ================= 事件绑定 ================= */

function bindEvents() {
  document.querySelectorAll('.tab').forEach((b) =>
    b.addEventListener('click', () => switchTab(b.dataset.tab, b.dataset.period))
  );

  $('#form-add').addEventListener('submit', submitAdd);
  document.querySelectorAll('#type-switch .seg').forEach((b) =>
    b.addEventListener('click', () => setFormType(b.dataset.type))
  );
  document.querySelectorAll('#f-currency-switch .seg').forEach((b) =>
    b.addEventListener('click', () => setFormCurrency(b.dataset.cur))
  );

  $('#rec-prev').addEventListener('click', () => shiftRecordsMonth(-1));
  $('#rec-next').addEventListener('click', () => shiftRecordsMonth(1));
  $('#rec-today').addEventListener('click', () => {
    state.anchors.records = new Date();
    renderRecords();
  });

  $('#form-edit').addEventListener('submit', submitEdit);
  document.querySelectorAll('#edit-type-switch .seg').forEach((b) =>
    b.addEventListener('click', () => {
      state.editType = b.dataset.type;
      document.querySelectorAll('#edit-type-switch .seg').forEach((x) =>
        x.classList.toggle('active', x === b)
      );
      $('#e-category').setAttribute('list', b.dataset.type === 'expense' ? 'cat-expense' : 'cat-income');
    })
  );
  document.querySelectorAll('#e-currency-switch .seg').forEach((b) =>
    b.addEventListener('click', () => {
      state.editCurrency = b.dataset.cur;
      $('#e-currency-symbol').textContent = CUR[b.dataset.cur].symbol;
      document.querySelectorAll('#e-currency-switch .seg').forEach((x) =>
        x.classList.toggle('active', x === b)
      );
    })
  );
  $('#edit-cancel').addEventListener('click', closeEdit);
  $('#modal .modal-mask').addEventListener('click', closeEdit);

  $('#rp-prev').addEventListener('click', () => shiftAnchor(-1));
  $('#rp-next').addEventListener('click', () => shiftAnchor(1));
  $('#rp-today').addEventListener('click', resetAnchor);
  $('#pie-expense').addEventListener('click', () => {
    state.pieMode = 'expense';
    renderPie(state.lastReport);
  });
  $('#pie-income').addEventListener('click', () => {
    state.pieMode = 'income';
    renderPie(state.lastReport);
  });

  // 设置
  $('#btn-settings').addEventListener('click', openSettings);
  $('#settings-close').addEventListener('click', closeSettings);
  $('#settings-mask').addEventListener('click', closeSettings);
  document.querySelectorAll('#set-lang .seg').forEach((b) =>
    b.addEventListener('click', () => changeLang(b.dataset.lang))
  );
  document.querySelectorAll('#set-currency .seg').forEach((b) =>
    b.addEventListener('click', () => changeCurrency(b.dataset.cur))
  );
  $('#btn-refresh-rate').addEventListener('click', refreshRateNow);
  $('#btn-save-rate').addEventListener('click', saveManualRate);
  $('#btn-clear-rate').addEventListener('click', clearManualRate);
  $('#btn-export-csv').addEventListener('click', exportCsv);
  $('#btn-backup-db').addEventListener('click', backupDb);

  window.addEventListener('resize', () => {
    for (const key of Object.keys(state.charts)) {
      if (state.charts[key]) state.charts[key].resize();
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeEdit();
      closeSettings();
    }
  });
}

/* ================= 启动 ================= */

async function init() {
  $('#f-date').value = toStr(today);
  bindEvents();
  try {
    const s = await window.api.getSettings();
    state.lang = s.lang === 'en' ? 'en' : 'zh';
    state.currency = s.currency === 'USD' ? 'USD' : 'CNY';
    state.rate = {
      value: Number(s.rate) || 7.2,
      source: s.source || 'default',
      updatedAt: s.updatedAt || '',
      manual: s.rateManual || '',
    };
  } catch (err) {
    console.error('加载设置失败:', err);
  }
  setFormCurrency(state.currency);
  applyI18n();
  refreshOverview();
}

/* 供冒烟测试使用 */
window.zz = {
  t,
  summaryFor: buildSummaryText,
  fmtMoney,
};

init();
