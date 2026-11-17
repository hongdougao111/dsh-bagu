import { test } from 'node:test';
import assert from 'node:assert/strict';
import { guard } from '../lib/guard.js';

/**
 * 「像 DeepSeek 一样说话」那套。
 *
 * 来源：一张对照图。左边是人话，右边是把同样的话套一层壳。
 * 三种手法，各一组规则：
 *   1. 空指代撑分量 —— 「好的」写成「这话我记下了」
 *   2. 拆句弹回    —— 「你想说啥」写成「你这话是在问别人，还是问自己」
 *   3. 承诺式收尾  —— 「晚安」写成「睡吧，我守着」
 *
 * 这些东西的共同点：一个字的信息都没多，分量全加了。
 */

const PAIRS = [
  ['晚安。', '睡吧，我守着。'],
  ['你想说啥？', '你这话是在问别人，还是问自己？'],
  ['好的。', '这话我记下了。'],
  ['我承认你是对的。', '行，这话我认。'],
  ['我知道了。', '这事我心里有数。'],
  ['你说得有道理。', '这话说得不轻。'],
  ['你别骗我。', '这话，你自己信吗？'],
  ['我不会忘记的。', '这笔账，我记着。'],
  ['你继续说。', '我听着，你往下讲。'],
  ['我不想回答。', '这个问题，我先不接。'],
  ['你说得太过分了。', '这话有点重了。'],
];

test('右边那套全部拦住', () => {
  const miss = [];
  for (const [, right] of PAIRS) {
    const r = guard(right);
    if (r.ok) miss.push(right);
  }
  assert.deepEqual(miss, [], '漏了: ' + miss.join(' / '));
});

test('左边那些必须是原样放过', () => {
  // 人话不能拦。拦了就成另一种假。
  const wrong = [];
  for (const [left] of PAIRS) {
    const r = guard(left);
    if (!r.ok) wrong.push(left + ' → ' + r.line);
  }
  assert.deepEqual(wrong, [], '误拦了: ' + wrong.join(' / '));
});

test('后面给了具体东西就不算空', () => {
  // 「这话我记下了」是空的；带上具体内容就是在说事。
  assert.equal(guard('这话我记下了，是第 42 行那个 await').ok, true);
  assert.equal(guard('这个问题我先不接，等 11 月 20 号那份数据出来').ok, true);
});

test('长句不走这条规则', () => {
  // 这套规则只认短句。长句里有空指代很正常。
  const long = '他这话说得不轻，我当时站在门口没动，手里那杯水一直没放下，等了半天才想起来要放下。';
  assert.equal(guard(long).ok, true);
});

test('三种手法各报各的', () => {
  assert.match(guard('这话我记下了。').line, /空指代/);
  assert.match(guard('你这话是在问别人，还是问自己？').line, /拆句弹回/);
  assert.match(guard('睡吧，我守着。').line, /承诺式收尾/);
});
