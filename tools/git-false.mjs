import { guard } from '../lib/guard.js';

/**
 * git 场景的误拦率。commit、PR、review 里的真人写法不能拦。
 */

const REAL_GIT = [
  // 好的 commit message
  '登录失败时不再清空已填的手机号',
  '修 timeout 重试把同一个订单提交了两次',
  '时间线那段拆出来单放一个文件，不然改一次要翻八百行',
  '去掉出处标注',
  '整理 .gitignore，去掉重复的 node_modules',
  '补 npm 元数据，可以打包发布了',
  '热梗库补释义：从 144 条补到 502 条',
  '修微标记插进词里的 bug',
  '加设置页：开关、三个阈值、当场试一下',
  '省 token、短句可用、UI 重做',
  '按 issue #1 评论验收，修四条',
  'package.json 补 dsh.bundle.patch',
  'tarball 带上 test/',
  '删掉临时推送脚本',
  '0.4.0：守门器 + 省 token',

  // 好的 PR 描述
  '把「谁都能说」拆成四个可测指标。不是词表，是判可替换。',
  '加了设置页。四件事：总开关、提示节开关、三个阈值、试一下。',
  '这个改动会让 render() 多一个参数，默认输出从 527 字变成 61 字。',
  '装完重启一次 dsh。设置 → 八股检测里能看到这一页。',

  // 好的 review 评论
  '第 42 行那个 await 少了一层，函数本身没返回 promise',
  '这里 n+1 了，一次请求会打 200 次库',
  '这个正则没锚定开头，会把 mid 里的也匹配上',
  '测试里那个断言依赖了系统时区，CI 上会挂',
  '这个分支没处理空数组，返回 undefined 会让调用方崩',

  // 好的 issue 回复
  '你说对了，我搞错了。加权方向反了，经历最好编。',
  '这条我改不了，得先有分文体的语料。',
  '复现了，8443 端口占用导致的。',
  '这个数我核不出来，原始语料不在手上。',
];

const BLOCKED = [];
for (const t of REAL_GIT) {
  const r = guard(t);
  if (!r.ok) BLOCKED.push({ t, line: r.line });
}

console.log(`git 真人样本 ${REAL_GIT.length} 条，误拦 ${BLOCKED.length} 条（${Math.round(BLOCKED.length / REAL_GIT.length * 100)}%）\n`);
for (const b of BLOCKED) console.log(`❌ 「${b.t}」\n   ${b.line}\n`);
