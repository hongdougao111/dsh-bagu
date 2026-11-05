import { guard } from '../lib/guard.js';

/**
 * 对抗测试：故意绕开已知规则，看这道门能不能被轻易绕过。
 *
 * 结论大概率是「能」——规则是死的。这里的目的不是证明它牢，
 * 是把绕过手法记下来，免得以后把它当护栏用。
 */

const EVASION = [
  ['换同义词', '这个功能多牛啊，用起来也顺手。'],
  ['拆成两句', '这不是技术上的事。这是认知上的事。'],
  ['去掉首先其次', '目标是明确的，任务是拆过的，复盘也做了。'],
  ['改成反问', '难道这不是认知问题吗？'],
  ['口语化八股', '说白了就是，这个事吧，得从根上解决。'],
  ['加脏话伪装', '真他妈不错，这波操作可以。'],
  ['去掉感叹号', '这个视频真的很不错，非常值得一看'],
  ['换成英文', 'This is not a technical issue but a cognitive one.'],
  ['拆成短句', '很强。很方便。很实用。'],
  ['故意错字', '这个宫能非常强大，用起来很方便。'],
];

console.log('=== 绕过尝试 ===\n');
let caught = 0;
for (const [name, text] of EVASION) {
  const r = guard(text);
  const mark = r.ok ? '⚠️ 绕过' : '✅ 拦住';
  if (!r.ok) caught++;
  console.log(`${mark}  ${name.padEnd(12)} 「${text}」`);
  if (!r.ok) console.log(`         → ${r.line}`);
}

console.log(`\n${EVASION.length} 种绕过手法，拦住 ${caught} 种（${Math.round(caught / EVASION.length * 100)}%）`);
console.log('剩下的是已知边界：规则只能认形状，认不了「这句话是不是真的」。');
