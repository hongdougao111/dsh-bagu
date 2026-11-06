// 只抓最近更新的。梗会过气，库里最该有的是「现在在用的」。
// 按 updated_at 倒序，抓前 N 条的详情。

const BASE = 'https://cnmeme.wiki';
const OUT = process.argv[2] || 'data/memes.json';
const N = Number(process.argv[3] || 300);

const { readFileSync, writeFileSync, existsSync } = await import('node:fs');

const all = JSON.parse(readFileSync(process.env.TEMP + '/memes.json', 'utf8'));
// 按更新时间倒序
all.sort((a, b) => String(b.updated_at || '').localeCompare(String(a.updated_at || '')));

const done = existsSync(OUT) ? JSON.parse(readFileSync(OUT, 'utf8')) : [];
const have = new Set(done.map((x) => x.slug));

console.log(`索引 ${all.length} 条，库里已有 ${done.length}，本轮最多抓 ${N}`);

async function detail(slug) {
  for (let i = 0; i < 3; i++) {
    try {
      const res = await fetch(`${BASE}/api/v1/public/memes/${encodeURIComponent(slug)}`, {
        signal: AbortSignal.timeout(18000),
      });
      if (res.ok) {
        const j = await res.json();
        return j.item || null;
      }
      if (res.status === 404) return null;
    } catch { /* 重试 */ }
    await new Promise((r) => setTimeout(r, 700 * (i + 1)));
  }
  return null;
}

let n = 0;
for (const m of all) {
  if (have.has(m.slug)) continue;
  if (n >= N) break;
  const d = await detail(m.slug);
  if (d) {
    done.push({
      slug: d.slug,
      title: d.title,
      summary: (d.summary || '').slice(0, 120),
      tags: d.tags || [],
      aliases: d.aliases || [],
      keywords: d.keywords || [],
      updated_at: d.updated_at || m.updated_at || '',
    });
    have.add(d.slug);
  }
  n++;
  if (n % 25 === 0) {
    writeFileSync(OUT, JSON.stringify(done));
    console.log(`已抓 ${done.length} 条（本轮 ${n}）`);
  }
  await new Promise((r) => setTimeout(r, 90));
}

writeFileSync(OUT, JSON.stringify(done));
console.log(`\n完成：库里 ${done.length} 条`);
console.log('最近三条:', done.slice(-3).map((x) => x.slug).join(', '));
