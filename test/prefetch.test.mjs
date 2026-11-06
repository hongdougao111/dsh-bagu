import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// 预查注入是「会玩梗」的关键：用户消息一进来就先查好塞进上下文，
// 不等模型主动调工具。这里测的是「注册了、能算出来、没梗不算」。
//
// lastUserText / payloadText 是 index.js 里的内部函数，不导出。
// 所以这里用搭假宿主 + 读注册出来的 context 函数来测。

const SRC = readFileSync('lib/index.js', 'utf8');

test('lastUserText 和 payloadText 都有定义', () => {
  // 曾经踩过的坑：函数被引用但没定义，抛 ReferenceError 被 try/catch 吞成空，
  // 外面看不出来，预查永远不命中。
  assert.match(SRC, /function lastUserText\(/, 'lastUserText 没定义');
  assert.match(SRC, /function payloadText\(/, 'payloadText 没定义');
  const refs = (SRC.match(/lastUserText\(/g) || []).length;
  const defs = (SRC.match(/function lastUserText\(/g) || []).length;
  assert.ok(defs >= 1, '有引用 ' + refs + ' 处，定义 ' + defs + ' 处');
});

test('注册了 bagu:prefetch', async () => {
  const { apply } = await import('../lib/index.js');
  const ctxs = [];
  const root = {
    inject(deps, fn) {
      if (deps.includes('llm')) return;
      fn({
        systemPrompt: {
          section() { return () => {} },
          context(o) { ctxs.push(o); return () => {} },
        },
        tools: { register() {} },
        webServer: { register() { return () => {} } },
        effect(fn) { return fn() },
      });
    },
  };
  // memes 默认关，先开
  const fs = await import('node:fs');
  const had = fs.existsSync('./config.json');
  const bak = had ? fs.readFileSync('./config.json', 'utf8') : null;
  fs.writeFileSync('./config.json', JSON.stringify({ enabled: true, memes: true, autoMeme: true }));
  try {
    apply(root, {});
  } finally {
    if (bak !== null) fs.writeFileSync('./config.json', bak);
    else fs.unlinkSync('./config.json');
  }
  assert.ok(ctxs.length > 0, '没注册 context');
  const c = ctxs[0];
  assert.equal(c.name, 'bagu:prefetch');
  assert.equal(typeof c.text, 'function', 'text 得是函数，才能每轮现算');
});

test('有梗的消息能算出注入文本', async () => {
  const { apply } = await import('../lib/index.js');
  const ctxs = [];
  const root = {
    inject(deps, fn) {
      if (deps.includes('llm')) return;
      fn({
        systemPrompt: {
          section() { return () => {} },
          context(o) { ctxs.push(o); return () => {} },
        },
        tools: { register() {} },
        webServer: { register() { return () => {} } },
        effect(fn) { return fn() },
      });
    },
  };
  const fs = await import('node:fs');
  const bak = fs.existsSync('./config.json') ? fs.readFileSync('./config.json', 'utf8') : null;
  fs.writeFileSync('./config.json', JSON.stringify({ enabled: true, memes: true, autoMeme: true }));
  try {
    apply(root, {});
    const c = ctxs[0];
    const fake = {
      agent: {
        session: {
          snapshotEvents: () => [
            { type: 'user/message', payload: { content: '康神开播了' } },
          ],
        },
      },
    };
    const out = c.text(fake);
    assert.ok(out.length > 0, '含梗的消息该算出注入文本');
    assert.match(out, /康神开播了/, '该提到命中的梗');

    // 不含梗的不注入
    const fake2 = {
      agent: {
        session: {
          snapshotEvents: () => [
            { type: 'user/message', payload: { content: '帮我看看这个报错' } },
          ],
        },
      },
    };
    assert.equal(c.text(fake2), '', '不含梗不该注入');
  } finally {
    if (bak !== null) fs.writeFileSync('./config.json', bak);
    else if (fs.existsSync('./config.json')) fs.unlinkSync('./config.json');
  }
});

test('取不到 session 时返回空，不崩', async () => {
  const { apply } = await import('../lib/index.js');
  const ctxs = [];
  const root = {
    inject(deps, fn) {
      if (deps.includes('llm')) return;
      fn({
        systemPrompt: {
          section() { return () => {} },
          context(o) { ctxs.push(o); return () => {} },
        },
        tools: { register() {} },
        webServer: { register() { return () => {} } },
        effect(fn) { return fn() },
      });
    },
  };
  const fs = await import('node:fs');
  const bak = fs.existsSync('./config.json') ? fs.readFileSync('./config.json', 'utf8') : null;
  fs.writeFileSync('./config.json', JSON.stringify({ enabled: true, memes: true, autoMeme: true }));
  try {
    apply(root, {});
    const c = ctxs[0];
    for (const bad of [null, {}, { agent: {} }, { agent: { session: {} } }]) {
      assert.doesNotThrow(() => c.text(bad), '崩在 ' + JSON.stringify(bad));
      assert.equal(c.text(bad), '');
    }
  } finally {
    if (bak !== null) fs.writeFileSync('./config.json', bak);
    else if (fs.existsSync('./config.json')) fs.unlinkSync('./config.json');
  }
});
