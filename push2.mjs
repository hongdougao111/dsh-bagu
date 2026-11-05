import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const REPO = 'hongdougao111/dsh-bagu';
const DIR = process.argv[2];

const gh = (args, input) => {
  const opts = { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 };
  const a = Array.isArray(args) ? args : [args];
  if (input !== undefined) {
    opts.input = input;
    return execFileSync('gh', ['api', ...a, '--input', '-'], opts);
  }
  return execFileSync('gh', ['api', ...a], opts);
};
const j = (s) => JSON.parse(s);

const FILES = [
  'lib/lexicon.js', 'lib/analyze.js', 'lib/guard.js', 'lib/render.js', 'lib/index.js',
  'lib/config.js', 'client.js',
  'test/analyze.test.mjs', 'test/guard.test.mjs', 'test/client.test.mjs', 'test/config.test.mjs',
  'tools/audit.mjs', 'tools/missrate.mjs', 'tools/falserate.mjs', 'tools/evasion.mjs',
  'package.json', 'dsh-plugin.json', 'cordis.patch.yml', 'README.md',
];

const parent = j(gh([`/repos/${REPO}/git/refs/heads/main`, '--jq', '.object.sha'])).trim
  ? JSON.parse(j(gh([`/repos/${REPO}/git/refs/heads/main`])).trim()).object.sha
  : null;

// 简化：不绕弯，直接拿
const ref = j(gh([`/repos/${REPO}/git/refs/heads/main`]));
const parentSha = ref.object.sha;
const baseTree = j(gh([`/repos/${REPO}/git/commits/${parentSha}`])).tree.sha;
console.log('parent', parentSha.slice(0, 8));

const tree = [];
for (const f of FILES) {
  const buf = readFileSync(join(DIR, f));
  const body = JSON.stringify({ content: buf.toString('base64'), encoding: 'base64' });
  const r = j(gh(['--method', 'POST', `/repos/${REPO}/git/blobs`], body));
  tree.push({ path: f, mode: '100644', type: 'blob', sha: r.sha });
}
console.log('blobs 建好:', tree.length);

const t = j(gh(['--method', 'POST', `/repos/${REPO}/git/trees`],
  JSON.stringify({ base_tree: baseTree, tree })));
console.log('tree', t.sha.slice(0, 8));

const MSG = `0.4.0：从「查报告工具」改成「守门器」

定位改了：不是给人自查，是给 AI 对外说话前拦一道。
DSH 会话、QQ 机器人、B站评论都算。

新增 lib/guard.js：
- 只回 OK 或一行改法（40 字内），不写报告
- 按严重度排，只报第一条 —— 报三条 agent 会挑最轻的改
- 拦 12 类：模板三连、单列首先、对举四种、反问对举、套话整句、
  同义轮换、八股词、三段并列、开头总结、空夸、同构短句排比、破折号

新增 bagu_guard 工具 + /api/bagu/guard 接口。

三组样本跑下来（数字在 tools/ 里可复现）：
- 真实场景 25 条：漏 0，误拦 0
- AI 八股 35 条：拦住 35（100%）
- 真人原话 51 条：误拦 0（0%）
- 对抗测试 10 种绕过：拦住 6 种（60%）

剩下 4 种绕过是已知边界，写进 README 了。

设置页跟着改：样本从 4 条到 5 条，覆盖会话/评论/机器人三种场景。

测试 41 → 50。`;

const c = j(gh(['--method', 'POST', `/repos/${REPO}/git/commits`], JSON.stringify({
  message: MSG, tree: t.sha, parents: [parentSha],
  author: { name: 'hongdougao111', email: '337357470+hongdougao111@users.noreply.github.com' },
})));
console.log('commit', c.sha.slice(0, 8));

j(gh(['--method', 'PATCH', `/repos/${REPO}/git/refs/heads/main`],
  JSON.stringify({ sha: c.sha })));
console.log('main ->', c.sha.slice(0, 8));
