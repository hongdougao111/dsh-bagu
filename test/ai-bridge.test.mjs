import { test } from 'node:test';
import assert from 'node:assert/strict';
import { aiBridge } from '../lib/ai-bridge.js';

test('没配 key 时直接返回 null，不发请求', async () => {
  const r = await aiBridge('测试', { same: ['a'], by: [], tags: [] }, { baseUrl: '', model: '', apiKey: '' });
  assert.equal(r, null);
});

test('没梗可接时返回 null', async () => {
  const r = await aiBridge('测试', { same: [], by: [], tags: [] },
    { baseUrl: 'https://x/v1', model: 'm', apiKey: 'k' });
  assert.equal(r, null);
});

test('网络挂了返回 null，不抛', async () => {
  const r = await aiBridge('测试', { same: ['a'], by: ['b'], tags: [] },
    { baseUrl: 'https://127.0.0.1:1/v1', model: 'm', apiKey: 'k' }, { timeoutMs: 3000 });
  assert.equal(r, null);
});

test('缺 baseUrl/model/key 任一项都返回 null', async () => {
  const hint = { same: ['a'], by: ['b'], tags: [] };
  assert.equal(await aiBridge('x', hint, { baseUrl: '', model: 'm', apiKey: 'k' }), null);
  assert.equal(await aiBridge('x', hint, { baseUrl: 'u', model: '', apiKey: 'k' }), null);
  assert.equal(await aiBridge('x', hint, { baseUrl: 'u', model: 'm', apiKey: '' }), null);
});
