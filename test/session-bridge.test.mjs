import { test } from 'node:test';
import assert from 'node:assert/strict';
import { captureRoute, sessionBridge } from '../lib/session-bridge.js';

test('captureRoute：没事件系统时不崩', () => {
  const get = captureRoute({});
  assert.equal(get(), null);
});

test('captureRoute：注册后能拿到 provider/model', async () => {
  let handler = null;
  const ctx = { on(evt, fn) { if (evt === 'agent/request') handler = fn; } };
  const get = captureRoute(ctx);
  assert.equal(get(), null);
  // 模拟一次 agent/request
  await handler({}, async () => ({ provider: 'deepseek', model: 'deepseek-chat' }));
  assert.deepEqual(get(), { provider: 'deepseek', model: 'deepseek-chat' });
});

test('sessionBridge：没有 llm 返回 null', async () => {
  const r = await sessionBridge(null, { provider: 'a', model: 'b' }, 'x', { same: ['y'], by: [], tags: [] });
  assert.equal(r, null);
});

test('sessionBridge：没有 route 返回 null', async () => {
  const llm = { stream() {} };
  const r = await sessionBridge(llm, null, 'x', { same: ['y'], by: [], tags: [] });
  assert.equal(r, null);
});

test('sessionBridge：没梗可接返回 null', async () => {
  const llm = { stream() {} };
  const r = await sessionBridge(llm, { provider: 'a', model: 'b' }, 'x', { same: [], by: [], tags: [] });
  assert.equal(r, null);
});

test('sessionBridge：stream 抛错返回 null，不抛', async () => {
  const llm = { stream() { throw new Error('boom'); } };
  const r = await sessionBridge(llm, { provider: 'a', model: 'b' }, 'x', { same: ['y'], by: [], tags: [] });
  assert.equal(r, null);
});

test('sessionBridge：stream 返回空返回 null', async () => {
  const llm = { stream() { return (async function* () {})(); } };
  const r = await sessionBridge(llm, { provider: 'a', model: 'b' }, 'x', { same: ['y'], by: [], tags: [] });
  assert.equal(r, null);
});

test('sessionBridge：能拼出接话', async () => {
  const llm = {
    stream() {
      return (async function* () {
        yield { delta: '这不就是' };
        yield { delta: '反向空耳那期嘛' };
      })();
    },
  };
  const r = await sessionBridge(llm, { provider: 'a', model: 'b' }, 'x',
    { same: ['瞎问虾猜'], by: ['反向空耳'], tags: [] });
  assert.equal(r, '这不就是反向空耳那期嘛');
});

test('sessionBridge：模型加了引号要剥掉', async () => {
  const llm = {
    stream() {
      return (async function* () {
        yield { delta: '「反向空耳那期」' };
      })();
    },
  };
  const r = await sessionBridge(llm, { provider: 'a', model: 'b' }, 'x',
    { same: ['瞎问虾猜'], by: ['反向空耳'], tags: [] });
  assert.equal(r, '反向空耳那期');
});
