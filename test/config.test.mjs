import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, rmSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DEFAULTS, readConfig, writeConfig, CONFIG_FILE } from '../lib/config.js';

const here = dirname(fileURLToPath(import.meta.url));

function clearConfig() {
  try { rmSync(CONFIG_FILE); } catch { /* 本来就没有 */ }
}

test('默认值齐全', () => {
  assert.equal(DEFAULTS.enabled, true);
  assert.equal(DEFAULTS.prompt, true);
  assert.equal(typeof DEFAULTS.hedgeFloor, 'number');
  assert.equal(typeof DEFAULTS.structureTimes, 'number');
  assert.equal(typeof DEFAULTS.concreteFloor, 'number');
});

test('没有配置文件时返回默认值', () => {
  clearConfig();
  const c = readConfig();
  assert.equal(c.enabled, true);
  assert.equal(c.hedgeFloor, DEFAULTS.hedgeFloor);
});

test('写进去再读出来一致', () => {
  clearConfig();
  const next = writeConfig({ hedgeFloor: 1.5, structureTimes: 5 });
  assert.equal(next.hedgeFloor, 1.5);
  assert.equal(next.structureTimes, 5);
  const back = readConfig();
  assert.equal(back.hedgeFloor, 1.5);
  assert.equal(back.structureTimes, 5);
  clearConfig();
});

test('不认识的字头被忽略', () => {
  clearConfig();
  const next = writeConfig({ 乱写的: 1, enabled: false });
  assert.equal(next.enabled, false);
  assert.equal('乱写的' in next, false);
  clearConfig();
});

test('布尔字段强制成布尔', () => {
  clearConfig();
  const next = writeConfig({ enabled: 0, prompt: 'yes' });
  assert.equal(next.enabled, false);
  assert.equal(next.prompt, true);
  clearConfig();
});

test('数值字段夹到合法范围', () => {
  clearConfig();
  const a = writeConfig({ hedgeFloor: -3, structureTimes: 0.1, concreteFloor: -1 });
  assert.equal(a.hedgeFloor, 0);
  assert.equal(a.structureTimes, 1);
  assert.equal(a.concreteFloor, 0);

  const b = writeConfig({ order: 99999 });
  assert.equal(b.order, 999);
  clearConfig();
});

test('非数字不当成合法输入', () => {
  clearConfig();
  writeConfig({ hedgeFloor: 2 });
  const next = writeConfig({ hedgeFloor: '不是数字' });
  assert.equal(next.hedgeFloor, 2, '非法值应该保留旧值');
  clearConfig();
});

test('配置文件可读时不会崩', () => {
  clearConfig();
  mkdirSync(dirname(CONFIG_FILE), { recursive: true });
  writeFileSync(CONFIG_FILE, '{ 这不是 json', 'utf8');
  const c = readConfig();
  assert.equal(c.enabled, true, '坏文件应该退回默认值');
  clearConfig();
});

test('config.json 不该被 git 跟踪', () => {
  const gitignore = join(here, '..', '.gitignore');
  if (!existsSync(gitignore)) return; // 还没建就跳过
  const s = readFileSync(gitignore, 'utf8');
  assert.ok(s.includes('config.json'), '.gitignore 应忽略 config.json');
});
