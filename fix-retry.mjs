import { readFileSync, writeFileSync } from 'node:fs';
const f = 'lib/update.js';
let s = readFileSync(f, 'utf8');

// 实跑 780 秒只翻了 240 条就断，然后「按已拿到的补」。
// 问题是断太早时，缺口只覆盖前 240 条，算出来的「缺 72 条」是假的 —— 全站缺口可能更多。
//
// 改成：某一页失败就退回去重试同一页，最多重试 3 次；还不行才跳过这一页继续往后。
const old = `    if (!j || !Array.isArray(j.items)) {
      fails++;
      // 连续失败太多就停，但已经拿到的照样用
      if (fails >= 3) { complete = false; break; }
      offset += 30;
      pages++;
      continue;
    }`;

const neu = `    if (!j || !Array.isArray(j.items)) {
      fails++;
      // 关键：失败时不要立刻跳过这一页 —— 那等于在缺口上挖洞。
      // 先退回去重试同一页（get 内部已经重试 3 次），还不行才跳过。
      if (fails < 3) {
        await new Promise((r) => setTimeout(r, 2000 * fails));
        continue;   // offset / pages 都不动，重试同一页
      }
      // 连续三页都拿不到才放弃
      complete = false;
      break;
    }`;

if (!s.includes(old)) { console.log('MISS'); process.exit(1); }
s = s.replace(old, neu);
console.log('ok 失败重试同一页');

// 翻页间隔 120ms 太急，网络差的时候容易触发断线。放宽到 200ms。
s = s.replace(`await new Promise((r) => setTimeout(r, 120));`, `await new Promise((r) => setTimeout(r, 200));`);
console.log('ok 间隔 200ms');

writeFileSync(f, s);
