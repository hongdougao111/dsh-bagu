import { test } from 'node:test';
import assert from 'node:assert/strict';
import { guard } from '../lib/guard.js';

/**
 * 霸总腔：句前挂个称呼就绕过去了。
 *
 * 那张图把「鱼八股」前面都加了「女人」两个字，答案是豁然开朗 ——
 * 因为这套语法本来就是霸总小说的。
 *
 * 我的规则全锚 ^ 开头，加个称呼就失效。这跟图里说的正好反过来：
 * 图里是加称呼暴露本质，我这里是加称呼绕过检测。
 */

test('加称呼不能绕过', () => {
  const pairs = [
    ['睡吧，我守着。', '女人，睡吧，我守着。'],
    ['这话我记下了。', '女人，这话我记下了。'],
    ['这话，你自己信吗？', '女人，这话，你自己信吗？'],
    ['这笔账，我记着。', '女人，这笔账，我记着。'],
    ['行，这话我认。', '女人，行，这话我认。'],
    ['你自己掂量。', '女人，你自己掂量。'],
    ['这句话接得漂亮。', '女人，这句话接得漂亮。'],
  ];
  for (const [bare, addressed] of pairs) {
    assert.equal(guard(bare).ok, false, '裸句该拦: ' + bare);
    assert.equal(guard(addressed).ok, false, '加称呼后绕过了: ' + addressed);
  }
});

test('各种称呼都要拦得住', () => {
  const addrs = ['女人', '男人', '丫头', '小鬼', '宝贝', '亲爱的', '老公', '老婆', '傻瓜', '笨蛋'];
  for (const a of addrs) {
    const t = `${a}，这话我记下了。`;
    assert.equal(guard(t).ok, false, '称呼「' + a + '」绕过了');
  }
});

test('短句分量：三种新的', () => {
  assert.equal(guard('你自己掂量。').ok, false);
  assert.equal(guard('这句话接得漂亮。').ok, false);
  assert.equal(guard('行，我不拦你。').ok, false);
});

test('有具体内容的照样放', () => {
  const keep = [
    '睡吧，明天还要早起。',
    '这话说得对，我也这么想。',
    '这笔账记在第三栏，42 块。',
    '你自己看着办吧，我不管了。',
    '你自己掂量，反正我不掺和。',
    '这句话接得漂亮，转场也顺。',
  ];
  for (const t of keep) {
    assert.equal(guard(t).ok, true, '误拦了: ' + t + ' → ' + guard(t).line);
  }
});
