// 抓全量详情，拿到 keywords。列表接口不返回，只能逐条取。
// 3180 条 × 约 3 秒 = 2.5 小时。断点续传，每抓一批就存。

const BASE = 'https://cnmeme.wiki';
const INDEX = process.argv[2] || '/tmp/memes.json';
const OUT = process.argv[3] || '/tmp/memes-full.json';
const BATCH = Number(process.argv[4] || 100);

const { readFileSync, writeFileSync, existsSync } = await import('node:fs');

const all = JSON.parse(readFileSync(INDEX, 'utf8'));
const done = existsSync(OUT) ? JSON.parse(readFileSync(OUT, 'utf8')) : [];
const have = new Set(done.map((x) => x.slug));

console.log(`索引 ${all.length} 条，已抓 ${done.length} 条`);

async function detail(slug) {
  for (let i = 0; i < 3; i++) {
    try {
      const res = await fetch(`${BASE}/api/v1/public/memes/${encodeURIComponent(slug)}`, {
        signal: AbortSignal.timeout(20000),
      });
      if (res.ok) {
        const j = await res.json();
        return j.item || null;
      }
      if (res.status === 404) return null;
    } catch { /* 重试 */ }
    await new Promise((r) => setTimeout(r, 800 * (i + 1)));
  }
  return null;
}

let n = 0;
for (const m of all) {
  if (have.has(m.slug)) continue;
  if (n >= BATCH) break;
  const d = await detail(m.slug);
  if (d) {
    done.push({
      slug: d.slug,
      title: d.title,
      summary: (d.summary || '').slice(0, 120),
      tags: d.tags || [],
      aliases: d.aliases || [],
      keywords: d.keywords || [],
    });
    have.add(d.slug);
  }
  n++;
  if (n % 20 === 0) {
    writeFileSync(OUT, JSON.stringify(done));
    console.log(`已抓 ${done.length} / ${all.length}（本轮 ${n}）`);
  }
  await new Promise((r) => setTimeout(r, 120));
}

writeFileSync(OUT, JSON.stringify(done));
const withKw = done.filter((x) => (x.keywords || []).length >= 2).length;
console.log(`\n完成：${done.length} 条，其中有锚点的 ${withKw} 条`);
