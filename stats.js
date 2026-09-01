'use strict';

/**
 * 统计模块：生成周报 / 月报 / 季报，支持多币种按汇率统一折算。
 * 周从周一开始，周日结束；季度按自然季度（1-3月 / 4-6月 / 7-9月 / 10-12月）。
 * 汇率语义：rate = 1 USD 兑多少 CNY。
 */

const DAY_MS = 24 * 60 * 60 * 1000;

const DEFAULT_RATE = 7.2;

/* ---------------- 日期工具 ---------------- */

function pad(n) {
  return String(n).padStart(2, '0');
}

/** Date -> 'YYYY-MM-DD'（本地时间） */
function toStr(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** 'YYYY-MM-DD' -> Date */
function parse(str) {
  const [y, m, d] = str.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function addDays(d, n) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

/** 所在周的周一 */
function mondayOf(d) {
  const dow = (d.getDay() + 6) % 7;
  return addDays(d, -dow);
}

/** ISO 周数（周一为一周开始） */
function isoWeekNumber(d) {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = (date.getUTCDay() + 6) % 7;
  date.setUTCDate(date.getUTCDate() - dayNum + 3);
  const firstThursday = new Date(Date.UTC(date.getUTCFullYear(), 0, 4));
  const week =
    1 +
    Math.round(
      ((date - firstThursday) / 86400000 - 3 + ((firstThursday.getUTCDay() + 6) % 7)) / 7
    );
  return week;
}

function round2(n) {
  return Math.round(n * 100) / 100;
}

/**
 * 把记录日期归到所属分桶的键：
 * 周报/月报按天（date 本身）；季报归到所在周的周一；年报归到所在月 1 号。
 */
function bucketKey(dateStr, period) {
  if (period === 'quarter') return toStr(mondayOf(parse(dateStr)));
  if (period === 'year') return dateStr.slice(0, 8) + '01';
  return dateStr;
}

/* ---------------- 汇率 ---------------- */

function normalizeRate(rate) {
  const r = Number(rate);
  return Number.isFinite(r) && r > 0 ? r : DEFAULT_RATE;
}

/** 把金额换算到显示币种。rate = 1 USD 兑 CNY */
function convertAmount(amount, fromCurrency, toCurrency, rate) {
  const from = fromCurrency === 'USD' ? 'USD' : 'CNY';
  const to = toCurrency === 'USD' ? 'USD' : 'CNY';
  if (from === to) return amount;
  const r = normalizeRate(rate);
  return to === 'CNY' ? amount * r : amount / r;
}

/* ---------------- 周期范围 ---------------- */

/**
 * 返回某周期的起止日期（含）与上一周期起止日期。
 * @param {'week'|'month'|'quarter'} period
 * @param {string} anchorStr 锚点日期 'YYYY-MM-DD'
 */
function periodRange(period, anchorStr) {
  const anchor = parse(anchorStr);
  if (period === 'week') {
    const start = mondayOf(anchor);
    const end = addDays(start, 6);
    return {
      start: toStr(start),
      end: toStr(end),
      prevStart: toStr(addDays(start, -7)),
      prevEnd: toStr(addDays(start, -1)),
    };
  }
  if (period === 'month') {
    const start = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
    const end = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0);
    const prevStart = new Date(anchor.getFullYear(), anchor.getMonth() - 1, 1);
    const prevEnd = new Date(anchor.getFullYear(), anchor.getMonth(), 0);
    return {
      start: toStr(start),
      end: toStr(end),
      prevStart: toStr(prevStart),
      prevEnd: toStr(prevEnd),
    };
  }
  if (period === 'quarter') {
    const qm = Math.floor(anchor.getMonth() / 3) * 3;
    const start = new Date(anchor.getFullYear(), qm, 1);
    const end = new Date(anchor.getFullYear(), qm + 3, 0);
    const prevStart = new Date(anchor.getFullYear(), qm - 3, 1);
    const prevEnd = new Date(anchor.getFullYear(), qm, 0);
    return {
      start: toStr(start),
      end: toStr(end),
      prevStart: toStr(prevStart),
      prevEnd: toStr(prevEnd),
    };
  }
  if (period === 'year') {
    const start = new Date(anchor.getFullYear(), 0, 1);
    const end = new Date(anchor.getFullYear(), 11, 31);
    const prevStart = new Date(anchor.getFullYear() - 1, 0, 1);
    const prevEnd = new Date(anchor.getFullYear() - 1, 11, 31);
    return {
      start: toStr(start),
      end: toStr(end),
      prevStart: toStr(prevStart),
      prevEnd: toStr(prevEnd),
    };
  }
  throw new Error(`unknown period: ${period}`);
}

/**
 * 周期内的图表分桶（语言无关的结构化数据）：
 * 周 -> 7 天 {date, dow}；月 -> 每天 {date, day}；季度 -> 每周 {date, m, d}；年 -> 每月 {date, m}
 */
function bucketsFor(period, start, end) {
  const s = parse(start);
  const e = parse(end);
  const out = [];
  if (period === 'week') {
    for (let i = 0; i < 7; i++) {
      const d = addDays(s, i);
      out.push({ date: toStr(d), dow: i });
    }
  } else if (period === 'month') {
    for (let d = s; d <= e; d = addDays(d, 1)) {
      out.push({ date: toStr(d), day: d.getDate() });
    }
  } else if (period === 'year') {
    for (let m = 0; m < 12; m++) {
      const d = new Date(s.getFullYear(), m, 1);
      out.push({ date: toStr(d), m: m + 1 });
    }
  } else {
    let w = mondayOf(s);
    while (w <= e) {
      out.push({ date: toStr(w), m: w.getMonth() + 1, d: w.getDate() });
      w = addDays(w, 7);
    }
  }
  return out;
}

/* ---------------- 汇总（含折算） ---------------- */

function summarize(rows, displayCurrency, rate) {
  const r = normalizeRate(rate);
  let expense = 0;
  let income = 0;
  let expenseCount = 0;
  let incomeCount = 0;
  let rawExpCNY = 0;
  let rawExpUSD = 0;
  let rawIncCNY = 0;
  let rawIncUSD = 0;
  const byCatExpense = new Map();
  const byCatIncome = new Map();
  for (const row of rows) {
    const cur = row.currency === 'USD' ? 'USD' : 'CNY';
    const amt = convertAmount(row.amount, cur, displayCurrency, r);
    if (row.type === 'expense') {
      expense += amt;
      expenseCount++;
      if (cur === 'CNY') rawExpCNY += row.amount;
      else rawExpUSD += row.amount;
      byCatExpense.set(row.category, (byCatExpense.get(row.category) || 0) + amt);
    } else {
      income += amt;
      incomeCount++;
      if (cur === 'CNY') rawIncCNY += row.amount;
      else rawIncUSD += row.amount;
      byCatIncome.set(row.category, (byCatIncome.get(row.category) || 0) + amt);
    }
  }
  const toSorted = (map) =>
    [...map.entries()]
      .map(([name, value]) => ({ name, value: round2(value) }))
      .sort((a, b) => b.value - a.value);
  return {
    expense: round2(expense),
    income: round2(income),
    expenseCount,
    incomeCount,
    byCategoryExpense: toSorted(byCatExpense),
    byCategoryIncome: toSorted(byCatIncome),
    rawExpenseCNY: round2(rawExpCNY),
    rawExpenseUSD: round2(rawExpUSD),
    rawIncomeCNY: round2(rawIncCNY),
    rawIncomeUSD: round2(rawIncUSD),
    unified: (rawExpCNY > 0 && rawExpUSD > 0) || (rawIncCNY > 0 && rawIncUSD > 0),
  };
}

/* ---------------- 报表入口 ---------------- */

/**
 * @param {import('better-sqlite3').Database} db
 * @param {'week'|'month'|'quarter'|'year'} period
 * @param {string} anchorStr 'YYYY-MM-DD'
 * @param {{currency?: 'CNY'|'USD', rate?: number}} [opts]
 */
function getReport(db, period, anchorStr, opts = {}) {
  const displayCurrency = opts.currency === 'USD' ? 'USD' : 'CNY';
  const rate = normalizeRate(opts.rate);
  const range = periodRange(period, anchorStr);
  const select = db.prepare(
    'SELECT date, amount, currency, category, type FROM records WHERE date BETWEEN ? AND ?'
  );
  const rows = select.all(range.start, range.end);
  const prevRows = select.all(range.prevStart, range.prevEnd);

  const cur = summarize(rows, displayCurrency, rate);
  const prev = summarize(prevRows, displayCurrency, rate);

  // 折线图分桶（按显示币种折算）
  const buckets = bucketsFor(period, range.start, range.end);
  const byDate = new Map();
  for (const r of rows) {
    const key = bucketKey(r.date, period);
    let b = byDate.get(key);
    if (!b) {
      b = { expense: 0, income: 0 };
      byDate.set(key, b);
    }
    const amt = convertAmount(r.amount, r.currency, displayCurrency, rate);
    if (r.type === 'expense') b.expense += amt;
    else b.income += amt;
  }
  const points = buckets.map((b) => {
    const v = byDate.get(b.date) || { expense: 0, income: 0 };
    return { ...b, expense: round2(v.expense), income: round2(v.income) };
  });

  // 上周对比折线（仅周报）
  let prevPoints = null;
  if (period === 'week') {
    const prevBuckets = bucketsFor('week', range.prevStart, range.prevEnd);
    const prevByDate = new Map();
    for (const r of prevRows) {
      if (r.type === 'expense') {
        const amt = convertAmount(r.amount, r.currency, displayCurrency, rate);
        prevByDate.set(r.date, (prevByDate.get(r.date) || 0) + amt);
      }
    }
    prevPoints = prevBuckets.map((b) => ({
      ...b,
      expense: round2(prevByDate.get(b.date) || 0),
    }));
  }

  const top = cur.byCategoryExpense[0] || null;
  const delta =
    prev.expense > 0 ? Math.round(((cur.expense - prev.expense) / prev.expense) * 100) : null;

  const startDate = parse(range.start);

  return {
    period,
    currency: displayCurrency,
    rate,
    range,
    weekNum: isoWeekNumber(startDate),
    isoYear: addDays(startDate, 3).getFullYear(),
    expenseTotal: cur.expense,
    incomeTotal: cur.income,
    balance: round2(cur.income - cur.expense),
    expenseCount: cur.expenseCount,
    incomeCount: cur.incomeCount,
    prevExpenseTotal: prev.expense,
    prevIncomeTotal: prev.income,
    topCategory: top
      ? { name: top.name, value: top.value, pct: Math.round((top.value / cur.expense) * 100) }
      : null,
    delta,
    points,
    prevPoints,
    byCategoryExpense: cur.byCategoryExpense,
    byCategoryIncome: cur.byCategoryIncome,
    rawExpenseCNY: cur.rawExpenseCNY,
    rawExpenseUSD: cur.rawExpenseUSD,
    rawIncomeCNY: cur.rawIncomeCNY,
    rawIncomeUSD: cur.rawIncomeUSD,
    unified: cur.unified,
  };
}

/** 明细页/速览用的时间段汇总（折算到显示币种） */
function overview(db, start, end, displayCurrency, rate) {
  const rows = db
    .prepare('SELECT amount, currency, category, type FROM records WHERE date BETWEEN ? AND ?')
    .all(start, end);
  const s = summarize(rows, displayCurrency, rate);
  return { expense: s.expense, income: s.income, count: rows.length, unified: s.unified };
}

module.exports = {
  getReport,
  overview,
  periodRange,
  toStr,
  parse,
  addDays,
  mondayOf,
  DEFAULT_RATE,
  normalizeRate,
  convertAmount,
};
