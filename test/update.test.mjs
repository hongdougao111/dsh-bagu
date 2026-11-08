import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

const UPDATE = readFileSync('lib/update.js', 'utf8');
const INDEX = readFileSync('lib/index.js', 'utf8');

test('定时器必须 unref，不然挂住进程', () => {
  // 实际踩过：加了 setInterval 之后测试从 2 秒变成卡死 90 秒才超时。
  // unref 让定时器不阻止 Node 退出，宿主不调清理函数时也不拖后腿。
  assert.match(INDEX, /\.unref\(\)/, 'setTimeout / setInterval 得 unref');
  assert.match(INDEX, /first\.unref/, '一次性的也得 unref');
});

test('备份要轮转，不能只增不减', () => {
  // 每个备份 17MB，一天一个，一年 6GB。
  assert.match(UPDATE, /pruneBackups/, '得有清理函数');
  assert.match(UPDATE, /keep = 2/, '只留最近 2 个');
  assert.match(UPDATE, /pruneBackups\(log\)/, '写完备份要调一下');
});

test('更新按小时对齐，不跟启动时刻漂', () => {
  // 用 setInterval(24h) 会跟着启动时刻走，早上开机就永远早上更新。
  assert.match(INDEX, /getHours\(\)/, '得看当前小时');
  assert.match(INDEX, /live\.updateHour/, '得读配置里的小时');
});

test('同一天不重复跑', () => {
  assert.match(INDEX, /toDateString\(\)/, '得比日期，跑过就跳过');
});

test('列表接口拿不到总数，翻页要容错', () => {
  // 接口只返回 items / limit / offset / has_more，没有 total。
  // 中途一页失败不该整轮作废。
  assert.match(UPDATE, /has_more/);
  assert.match(UPDATE, /fails >= 3/, '连续失败才停');
  assert.match(UPDATE, /slugs\.size === 0/, '一条都没拿到才算失败');
});

test('MAX_PAGES 够覆盖全站', () => {
  const m = UPDATE.match(/const MAX_PAGES = (\d+)/);
  assert.ok(m, '找不到 MAX_PAGES');
  const pages = Number(m[1]);
  // 6845 条 / 30 = 229 页
  assert.ok(pages >= 240, `MAX_PAGES=${pages} 翻不完 6845 条`);
});

test('只补新的，不覆盖已有', () => {
  assert.match(UPDATE, /INSERT OR IGNORE INTO memes/, '不能 REPLACE，会冲掉手动改过的');
});
