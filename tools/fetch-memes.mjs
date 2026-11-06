// 抓梗Wiki 的词条，存本地。只用公开接口，不需要凭证。
//
// 网络不稳，超时很常见。要点：区分「真的空了」和「这一页没抓到」。
// 前者停，后者跳过继续。

const BASE = 'https://cnmeme.wiki';
const OUT = process.argv[2] || 'memes.json';
const PAGES = Number(process.argv[3] || 20);
const START = Number(process.argv[4] || 0);
const { writeFileSync, readFileSync, existsSync } = await import('node:fs');

async function get(path, tries = 5) {
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(BASE + path, { signal: AbortSignal.timeout(30000) });
      if (res.ok) return { ok: true, data: await res.json() };
      if (res.status >= 400 && res.status < 500) return { ok: true, data: null };
    } catch { /* 超时，重试 */ }
    await new Promise((r) => setTimeout(r, 2000 * (i + 1)));
  }
  return { ok: false, data: null };   // 抓不到，不是空的
}

const seen = existsSync(OUT) ? JSON.parse(readFileSync(OUT, 'utf8')) : [];
const have = new Set(seen.map((x) => x.slug));

let offset = START;
let pages = 0;
let fails = 0;

while (pages < PAGES) {
  const { ok, data } = await get(`/api/v1/public/memes?limit=30&offset=${offset}`);

  if (!ok) {
    fails++;
    console.log(`[offset=${offset}] 抓不到，跳过（累计失败 ${fails}）`);
    offset += 30;
    pages++;
    if (fails >= 4) { console.log('连续失败太多，停'); break; }
    continue;
  }

  if (!data || !data.items || data.items.length === 0) {
    console.log(`[offset=${offset}] 真的空了，停`);
    break;
  }

  fails = 0;
  pages++;
  let added = 0;
  for (const it of data.items) {
    if (have.has(it.slug)) continue;
    seen.push(it);
    have.add(it.slug);
    added++;
  }
  console.log(`[offset=${offset}] 拿到 ${data.items.length}，新增 ${added}，累计 ${seen.length}，more=${data.has_more}`);
  writeFileSync(OUT, JSON.stringify(seen, null, 1));   // 每页都存，断了不丢
  offset += 30;
  if (!data.has_more) { console.log('没有更多了'); break; }
  await new Promise((r) => setTimeout(r, 700));
}

writeFileSync(OUT, JSON.stringify(seen, null, 1));
console.log(`\n存到 ${OUT}，共 ${seen.length} 条`);
