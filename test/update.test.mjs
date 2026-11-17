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

test('按「距上次超过 20 小时」判，不跟整点绑', () => {
  // 死在整点上那套在 DSH 上不成立：DSH 不是常驻服务，四点不一定会开着。
  assert.match(INDEX, /20 \* 60 \* 60 \* 1000/, '得有 20 小时的时间闸');
  assert.doesNotMatch(INDEX, /live\.updateHour/, '不该再读小时配置');
});

test('刚跑过就不重复跑', () => {
  // 判据从「同一天」改成「20 小时内」。原来按日期判，跨零点会重跑一次。
  assert.match(INDEX, /stale/, '得算过不过期');
  assert.doesNotMatch(INDEX, /toDateString\(\)/, '不该再按日期判');
});

test('翻页断了就整轮不补，别拿半截算缺口', () => {
  // 实测踩过：只翻到 240 条就断，提示「缺 72 条」，其实那是前 240 条范围内的缺口，
  // 全站缺口可能多得多。半截结果不能当缺口用。
  assert.match(UPDATE, /complete = false/, '得有完成标记');
  assert.match(UPDATE, /if \(!complete\)/, '断了要单独处理');
  assert.doesNotMatch(UPDATE, /这轮按已拿到的补/, '不许拿半截结果去补');
});

test('某一页失败先重试同一页，不跳过', () => {
  // 跳过一页等于在缺口上挖洞：那一页的词条永远不会被算成「缺」。
  assert.match(UPDATE, /fails < 3/, '重试要有次数');
  assert.match(UPDATE, /continue;\s*\/\/ offset/, '重试时不能让 offset 动');
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
