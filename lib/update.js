/**
 * 词库每日更新。
 *
 * 只补新的，不覆盖已有 —— 手动改过的词条不能被冲掉。
 * 网不稳，所以整轮失败不算数，下次再来；单条失败跳过。
 *
 * 数据源是梗Wiki 的公开接口，跟首次打包时用的是同一个。
 */

import { DatabaseSync } from 'node:sqlite';
import { copyFileSync, existsSync, statSync, readdirSync, unlinkSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const DB_PATH = join(HERE, '..', 'data', 'memes.db');
const BASE = 'https://cnmeme.wiki';

/** 多久跑一次。24 小时。 */
export const INTERVAL_MS = 24 * 60 * 60 * 1000;

/** 一轮最多翻多少页列表。30 条一页，300 页 = 9000 条，够覆盖当前全站还留余量。 */
const MAX_PAGES = 300;

/** 一轮最多补多少条详情。首次之后每天通常只有个位数新增。 */
const MAX_NEW = 200;

let running = false;
let lastResult = null;

async function get(path, tries = 3) {
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(BASE + path, { signal: AbortSignal.timeout(25000) });
      if (res.ok) return await res.json();
      if (res.status === 404) return null;
      if (res.status >= 400 && res.status < 500) return null;
    } catch {
      /* 超时或断网，重试 */
    }
    await new Promise((r) => setTimeout(r, 1200 * (i + 1)));
  }
  return null;
}

/** 翻列表，拿到当前全站的 slug 集合。翻不全就返回 null，整轮放弃。 */
async function listAllSlugs(log = () => {}) {
  const slugs = new Set();
  let offset = 0;
  let pages = 0;
  let fails = 0;
  let complete = true;

  while (pages < MAX_PAGES) {
    const j = await get(`/api/v1/public/memes?limit=30&offset=${offset}`);

    if (!j || !Array.isArray(j.items)) {
      fails++;
      // 连续失败太多就停，但已经拿到的照样用
      if (fails >= 3) { complete = false; break; }
      offset += 30;
      pages++;
      continue;
    }
    fails = 0;
    if (j.items.length === 0) break;
    for (const it of j.items) if (it.slug) slugs.add(it.slug);
    pages++;
    offset += 30;
    if (!j.has_more) break;
    await new Promise((r) => setTimeout(r, 120));
  }

  if (slugs.size === 0) return null;   // 一条都没拿到 = 真失败
  if (!complete) log(`（列表翻到 ${slugs.size} 条时网络断了，这轮按已拿到的补）`);
  return slugs;
}

/** 只留最近 N 个备份，其余删掉。 */
function pruneBackups(log = () => {}, keep = 2) {
  try {
    const dir = dirname(DB_PATH);
    const base = 'memes.db.bak-';
    const entries = readdirSync(dir)
      .filter((n) => n.startsWith(base))
      .map((n) => ({ n, t: Number(n.slice(base.length)) || 0 }))
      .sort((a, b) => b.t - a.t);
    for (const e of entries.slice(keep)) {
      try { unlinkSync(join(dir, e.n)); log('删旧备份 ' + e.n); } catch { /* 删不掉就算了 */ }
    }
  } catch { /* 目录读不了就算了 */ }
}

/**
 * 跑一轮更新。
 *
 * @param {{onLog?: (msg: string) => void}} opts
 * @returns {Promise<{added: number, total: number, ok: boolean, error?: string}>}
 */
export async function updateOnce(opts = {}) {
  const log = opts.onLog || (() => {});
  if (running) return { added: 0, total: 0, ok: false, error: 'already running' };
  running = true;

  try {
    if (!existsSync(DB_PATH)) {
      return { added: 0, total: 0, ok: false, error: 'db 不存在' };
    }

    log('翻列表…');
    const remote = await listAllSlugs(log);
    if (!remote) {
      log('列表一条都没拿到，这轮跳过');
      return { added: 0, total: 0, ok: false, error: '列表拿不到' };
    }
    log(`远端 ${remote.size} 条`);

    const db = new DatabaseSync(DB_PATH);
    let local;
    try {
      local = new Set(db.prepare('SELECT slug FROM memes').all().map((r) => r.slug));
    } catch (e) {
      db.close();
      return { added: 0, total: 0, ok: false, error: '读本地失败: ' + e.message };
    }

    const missing = [...remote].filter((s) => s && !local.has(s));
    log(`本地 ${local.size} 条，缺 ${missing.length} 条`);

    if (missing.length === 0) {
      db.prepare("INSERT OR REPLACE INTO meta(key,value) VALUES('last_check',?)")
        .run(new Date().toISOString());
      db.close();
      const total = local.size;
      lastResult = { added: 0, total, ok: true };
      return lastResult;
    }

    // 先备份，出事了能退回去。只留最近 2 个 —— 每天一个 17MB 撑不住。
    try {
      const bak = DB_PATH + '.bak-' + Date.now();
      copyFileSync(DB_PATH, bak);
      log('已备份 ' + bak.split(/[\\/]/).pop());
      pruneBackups(log);
    } catch {
      /* 备份失败不影响更新 */
    }

    const ins = db.prepare(
      'INSERT OR IGNORE INTO memes(title,slug,tags,usage,origin,other,summary,aliases) VALUES(?,?,?,?,?,?,?,?)',
    );

    let added = 0;
    const todo = missing.slice(0, MAX_NEW);
    for (const slug of todo) {
      const j = await get(`/api/v1/public/memes/${encodeURIComponent(slug)}`);
      const it = j && j.item;
      if (!it || !it.title) continue;
      try {
        ins.run(
          it.title,
          it.slug || slug,
          Array.isArray(it.tags) ? it.tags.join('、') : String(it.tags || ''),
          String(it.usage || ''),
          String(it.origin || ''),
          String(it.other || ''),
          String(it.summary || ''),
          Array.isArray(it.aliases) ? it.aliases.join('、') : String(it.aliases || ''),
        );
        added++;
      } catch {
        /* 单条写失败，跳过 */
      }
      if (added % 20 === 0) log(`已补 ${added}/${todo.length}`);
      await new Promise((r) => setTimeout(r, 150));
    }

    const total = db.prepare('SELECT COUNT(*) c FROM memes').get().c;
    db.prepare("INSERT OR REPLACE INTO meta(key,value) VALUES('count',?)").run(String(total));
    db.prepare("INSERT OR REPLACE INTO meta(key,value) VALUES('last_check',?)")
      .run(new Date().toISOString());
    db.close();

    log(`补了 ${added} 条，本地现在 ${total} 条`);
    lastResult = { added, total, ok: true };
    return lastResult;
  } catch (e) {
    log('出错: ' + e.message);
    return { added: 0, total: 0, ok: false, error: e.message };
  } finally {
    running = false;
  }
}

/** 上次更新结果，给设置页看。 */
export function lastUpdate() {
  return lastResult;
}

/** 本地词库规模与最后检查时间。 */
export function dbStatus() {
  if (!existsSync(DB_PATH)) return { exists: false };
  try {
    const db = new DatabaseSync(DB_PATH, { readOnly: true });
    const count = db.prepare('SELECT COUNT(*) c FROM memes').get().c;
    const rows = db.prepare('SELECT key,value FROM meta').all();
    db.close();
    const meta = {};
    for (const r of rows) meta[r.key] = r.value;
    return {
      exists: true,
      count,
      builtAt: meta.built_at || '',
      lastCheck: meta.last_check || '',
      sizeMB: +(statSync(DB_PATH).size / 1048576).toFixed(1),
    };
  } catch {
    return { exists: false };
  }
}

/** 距上次检查够不够 24 小时。首次（没有记录）返回 true。 */
export function isDue() {
  const st = dbStatus();
  if (!st.exists) return false;
  if (!st.lastCheck) return true;
  const last = Date.parse(st.lastCheck);
  if (!Number.isFinite(last)) return true;
  return Date.now() - last >= INTERVAL_MS;
}
