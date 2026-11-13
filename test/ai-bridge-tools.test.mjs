import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, existsSync, unlinkSync } from 'node:fs';

// 真机反馈（v0.12.1）：设置页打开「AI 接梗」后，bagu_guard 一碰到命中梗库的
// 文本就抛 TypeError: Cannot read properties of undefined (reading 'length')。
// 根因：index.js 里 import 的 bridge 来自 memes.js，返回 {hits, usage, origin, tags}，
// 但 AI 分支按 bridge.js 同名函数的返回 {same, by, tags} 去读 r.same.length。
// 顺带：bagu_meme 的 AI 分支还引用了未定义变量 list（ReferenceError）。
// 这里搭假宿主把两个工具的 execute 真跑一遍，锁住修复。

/** 假宿主：收集注册的工具，可注入假 llm，可模拟一次 agent/request 拿路由。 */
async function boot(cfg, { llm } = {}) {
  const { apply } = await import('../lib/index.js');
  const tools = {};
  const reqHandlers = [];
  const root = {
    inject(deps, fn) {
      fn({
        systemPrompt: {
          section() { return () => {}; },
          context() { return () => {}; },
        },
        tools: { register(t) { tools[t.name] = t; } },
        webServer: { register() { return () => {}; } },
        effect(fn) { return fn(); },
        on(evt, h) { if (evt === 'agent/request') reqHandlers.push(h); },
        llm,
      });
    },
  };
  const bak = existsSync('./config.json') ? readFileSync('./config.json', 'utf8') : null;
  writeFileSync('./config.json', JSON.stringify(cfg));
  try {
    apply(root, {});
  } finally {
    if (bak !== null) writeFileSync('./config.json', bak);
    else if (existsSync('./config.json')) unlinkSync('./config.json');
  }
  const setRoute = async () => {
    for (const h of reqHandlers) await h({}, async () => ({ provider: 'p', model: 'm' }));
  };
  return { tools, setRoute };
}

/** 假 llm：记下请求，吐一句固定接话。 */
function fakeLlm(line) {
  const seen = [];
  return {
    seen,
    stream(req) {
      seen.push(req);
      return (async function* () { yield { delta: line }; })();
    },
  };
}

const CFG = { enabled: true, memes: true, aiBridge: true, autoMeme: false, autoUpdate: false };
// 「康神开播了」在内置库里是精确标题；「真正的」能片段命中，两个都覆盖。
const MEME_TEXT = '康神开播了，你才是真正的英雄';
const PLAIN_TEXT = '帮我看看这个报错';

test('bagu_guard：AI 接梗开着 + 命中梗，不抛 TypeError，拼出接话', async () => {
  const llm = fakeLlm('这波是纯路人局');
  const { tools, setRoute } = await boot(CFG, { llm });
  await setRoute();
  const out = await tools.bagu_guard.execute({ text: MEME_TEXT });
  assert.equal(out.ok, true);
  assert.match(out.text, /｜接：这波是纯路人局$/, '该带上 AI 拼的接话，实际: ' + out.text);
  // 传给模型的是 {same, by, tags} 映射后的内容：same 里得有命中的梗名
  assert.ok(llm.seen.length >= 1, '该调一次模型');
  const prompt = llm.seen[0].messages[0].content;
  assert.match(prompt, /康神开播了/, 'same 列表没进 prompt，映射没生效');
});

test('bagu_guard：AI 接梗开着 + 没命中梗，正常 OK 不调模型', async () => {
  const llm = fakeLlm('不该被用到');
  const { tools, setRoute } = await boot(CFG, { llm });
  await setRoute();
  const out = await tools.bagu_guard.execute({ text: PLAIN_TEXT });
  assert.equal(out.ok, true);
  assert.equal(out.text, 'OK');
  assert.equal(llm.seen.length, 0, '没梗不该调模型');
});

test('bagu_guard：AI 接梗开着但拿不到 llm/路由，退回族提示不抛错', async () => {
  const { tools } = await boot(CFG, {});
  const out = await tools.bagu_guard.execute({ text: MEME_TEXT });
  assert.equal(out.ok, true);
  assert.match(out.text, /\[梗\] 对方提到：/, '该退回族提示，实际: ' + out.text);
});

test('bagu_guard：AI 接梗关着，行为不变', async () => {
  const llm = fakeLlm('不该被用到');
  const { tools, setRoute } = await boot({ ...CFG, aiBridge: false }, { llm });
  await setRoute();
  const out = await tools.bagu_guard.execute({ text: MEME_TEXT });
  assert.equal(out.ok, true);
  assert.match(out.text, /^OK｜\[梗\] 对方提到：/);
  assert.equal(llm.seen.length, 0, '关着不该调模型');
});

test('bagu_meme：AI 接梗开着 + 命中梗，不抛 ReferenceError(list)', async () => {
  const llm = fakeLlm('康神这波稳了');
  const { tools, setRoute } = await boot(CFG, { llm });
  await setRoute();
  const out = await tools.bagu_meme.execute({ text: MEME_TEXT });
  assert.equal(out.ok, true);
  assert.equal(out.text, '康神这波稳了');
});

test('bagu_meme：AI 接梗开着但没路由，退回族提示不抛错', async () => {
  const { tools } = await boot(CFG, {});
  const out = await tools.bagu_meme.execute({ text: MEME_TEXT });
  assert.equal(out.ok, true);
  assert.match(out.text, /\[梗\] 对方提到：/, '实际: ' + out.text);
});

test('bagu_meme：q 查词路径不受影响', async () => {
  const { tools } = await boot(CFG, {});
  const out = await tools.bagu_meme.execute({ q: '康神开播了' });
  assert.equal(out.ok, true);
  assert.match(out.text, /^康神开播了：/);
});