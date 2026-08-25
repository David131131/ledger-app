'use strict';

/**
 * 数据库模块：负责打开 SQLite 数据库、建表（含迁移）以及增删改查。
 * 账单表结构：
 *   id           编号（自增主键）
 *   date         日期（YYYY-MM-DD）
 *   amount       金额
 *   currency     币种（CNY / USD）
 *   category     分类（餐饮/购物/工资……）
 *   type         收入/支出（income / expense）
 *   path         消费路径（在哪里花的钱，可选）
 *   note         备注
 *   created_time 创建时间
 * 设置表 settings：key-value，保存语言、显示货币、汇率等。
 */

const Database = require('better-sqlite3');

const SCHEMA = `
CREATE TABLE IF NOT EXISTS records (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  date         TEXT    NOT NULL,
  amount       REAL    NOT NULL CHECK (amount > 0),
  currency     TEXT    NOT NULL DEFAULT 'CNY' CHECK (currency IN ('CNY', 'USD')),
  category     TEXT    NOT NULL,
  type         TEXT    NOT NULL CHECK (type IN ('expense', 'income')),
  path         TEXT    NOT NULL DEFAULT '',
  note         TEXT    NOT NULL DEFAULT '',
  created_time TEXT    NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_records_date ON records (date);
CREATE INDEX IF NOT EXISTS idx_records_type ON records (type);
CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
`;

function openDb(dbPath) {
  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.exec(SCHEMA);
  migrate(db);
  return db;
}

/** 旧库升级：给 records 表补 currency 列 */
function migrate(db) {
  const cols = db.prepare('PRAGMA table_info(records)').all().map((c) => c.name);
  if (!cols.includes('currency')) {
    db.exec("ALTER TABLE records ADD COLUMN currency TEXT NOT NULL DEFAULT 'CNY'");
  }
}

/** 本地时间字符串：YYYY-MM-DD HH:MM:SS */
function localNow() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return (
    `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ` +
    `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`
  );
}

/* ---------------- 账单 CRUD ---------------- */

function insertRecord(db, rec) {
  const stmt = db.prepare(
    `INSERT INTO records (date, amount, currency, category, type, path, note, created_time)
     VALUES (@date, @amount, @currency, @category, @type, @path, @note, @created)`
  );
  const info = stmt.run({
    date: rec.date,
    amount: rec.amount,
    currency: rec.currency,
    category: rec.category,
    type: rec.type,
    path: rec.path || '',
    note: rec.note || '',
    created: localNow(),
  });
  return { id: Number(info.lastInsertRowid) };
}

function updateRecord(db, id, rec) {
  const info = db
    .prepare(
      `UPDATE records
       SET date = @date, amount = @amount, currency = @currency, category = @category,
           type = @type, path = @path, note = @note
       WHERE id = @id`
    )
    .run({
      id,
      date: rec.date,
      amount: rec.amount,
      currency: rec.currency,
      category: rec.category,
      type: rec.type,
      path: rec.path || '',
      note: rec.note || '',
    });
  return { ok: info.changes > 0 };
}

function deleteRecord(db, id) {
  const info = db.prepare('DELETE FROM records WHERE id = ?').run(id);
  return { ok: info.changes > 0 };
}

/** 查询某时间段内的所有记录，按日期倒序（同日按创建顺序倒序） */
function listRecords(db, start, end) {
  return db
    .prepare(
      'SELECT * FROM records WHERE date BETWEEN ? AND ? ORDER BY date DESC, id DESC'
    )
    .all(start, end);
}

/** 带筛选条件的记录查询（关键词 / 分类 / 类型 / 币种 / 日期区间） */
function queryRecords(db, f = {}) {
  const where = ['date BETWEEN ? AND ?'];
  const params = [String(f.start), String(f.end)];
  const kw = String(f.keyword || '').trim();
  if (kw) {
    where.push('(category LIKE ? OR path LIKE ? OR note LIKE ?)');
    const like = `%${kw}%`;
    params.push(like, like, like);
  }
  if (f.category) {
    where.push('category = ?');
    params.push(String(f.category));
  }
  if (f.type === 'expense' || f.type === 'income') {
    where.push('type = ?');
    params.push(f.type);
  }
  if (f.currency === 'CNY' || f.currency === 'USD') {
    where.push('currency = ?');
    params.push(f.currency);
  }
  return db
    .prepare(
      `SELECT * FROM records WHERE ${where.join(' AND ')} ORDER BY date DESC, id DESC LIMIT 1000`
    )
    .all(...params);
}

/** 全部分类（按使用频次排序），用于筛选下拉框 */
function listCategories(db) {
  return db
    .prepare('SELECT category FROM records GROUP BY category ORDER BY COUNT(*) DESC, category')
    .all()
    .map((r) => r.category);
}

/* ---------------- 设置 ---------------- */

function getSetting(db, key, fallback = null) {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
  return row ? row.value : fallback;
}

function setSetting(db, key, value) {
  db.prepare(
    'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value'
  ).run(key, String(value));
}

function getAllSettings(db) {
  const rows = db.prepare('SELECT key, value FROM settings').all();
  const out = {};
  for (const r of rows) out[r.key] = r.value;
  return out;
}

module.exports = {
  openDb,
  localNow,
  insertRecord,
  updateRecord,
  deleteRecord,
  listRecords,
  queryRecords,
  listCategories,
  getSetting,
  setSetting,
  getAllSettings,
};
