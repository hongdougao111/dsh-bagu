/**
 * dsh-bagu · 宿主半侧
 *
 * 三件事：
 *   1. 往系统提示里挂一节「说什么」，讲的是念头不是词表（可在设置页关掉）
 *   2. 挂两个只读工具：bagu_check、bagu_ask
 *   3. 开 /api/bagu，给设置页用
 *
 * 刻意不做的事：不自动改写。改要人改。
 */

import { analyze, render } from './analyze.js';
import { readConfig, writeConfig, CONFIG_FILE, DEFAULTS } from './config.js';

export const name = 'dsh-bagu';

export { analyze, render };

/** 当前生效的配置。设置页改了立刻换掉。 */
let live = readConfig();

/** 已挂上去的 prompt 节，改了要先撤再挂。 */
const syncers = new Set();

const PROMPT = `## 说话的念头

开口前先问的不是「这么答对不对」，是「我要说什么」。

两者差得远。前一个问题让你去猜对方想听什么，后一个问题让你去想自己要给什么。

一句话换个人说，还成不成立？成立，就是八股。谁都能说的话，慢慢就没人想看了。
问题不在礼貌，在可替换。

几个具体的：

- **别急着认错。**对方只是问一句，不一定是在说你错。对就说是，别为了顺着改口，把对的也改错了。
- **留一处不确定。**一个「好像 / 应该 / 大概」都没有的段落，是在下断言，不是在说话。
- **具体压过评价。**「挺好的」谁都能说；「骨架在推所以有点飘」只有看过的人才说得出。
- **篇幅别总一样齐。**每段都三句、每句都差不多长，整齐本身就是痕迹。
- **说七分。**话别一次说完。留点让人问。

不硬塞语气词，不为了显得像人而加口癖。加进去的是另一种假。`;

const TOOL_CHECK = `查一段话有多「可替换」。给几个分开的指标和一个判档，不给单一总分，也不自动改写。

指标：
- 具体性（每百字几个数字/时间/经历/原话/名字）
- 抽象度、评价度（意义、价值、本质 / 重要、关键、深刻）
- 留白词密度（好像、应该、大概）
- 结构腔（不是X而是Y 等），以及同一百字里几种句式扎堆

返回里带一组「要你自己答」的问句。答不上来，那处就是摆设。`;

const TOOL_ASK = `只给问句，不给结论。想让人自己看着改、不想被工具改的时候用这个。`;

function toolOutput() {
  return {
    schema: {
      type: 'object',
      additionalProperties: true,
      required: ['ok'],
      properties: {
        ok: { type: 'boolean' },
        text: { type: 'string' },
        detail: { type: 'object' },
      },
    },
    render: (_args, value) => [{ type: 'text', text: String(value?.text ?? '') }],
  };
}

function thresholdsOf(cfg) {
  return {
    hedgeFloor: cfg.hedgeFloor,
    structureTimes: cfg.structureTimes,
    concreteFloor: cfg.concreteFloor,
  };
}

/** 配置变了以后，让已经挂上的 prompt 节跟着换。 */
function applyLive(next) {
  live = next;
  for (const sync of syncers) {
    try { sync(); } catch { /* 单个失败不影响别的 */ }
  }
}

function sendJson(res, status, body) {
  const text = JSON.stringify(body);
  res.statusCode = status;
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.setHeader('cache-control', 'no-store');
  res.end(text);
}

function readBody(req) {
  return new Promise((resolve) => {
    let raw = '';
    req.on('data', (c) => { raw += c; if (raw.length > 1e6) raw = raw.slice(0, 1e6); });
    req.on('end', () => {
      try { resolve(raw ? JSON.parse(raw) : {}); } catch { resolve({}); }
    });
    req.on('error', () => resolve({}));
  });
}

export function apply(root, config = {}) {
  // cordis.patch.yml 里的初始值，只在 config.json 还没写过时作底
  live = readConfig();
  if (config && typeof config === 'object') {
    for (const k of Object.keys(DEFAULTS)) {
      if (config[k] !== undefined && live[k] === DEFAULTS[k]) live[k] = config[k];
    }
  }

  root.inject(['systemPrompt'], (ctx) => {
    let dispose = null;
    const sync = () => {
      if (dispose) { dispose(); dispose = null; }
      if (!live.enabled || !live.prompt) return;
      dispose = ctx.systemPrompt.section({
        name: 'bagu:voice',
        order: live.order,
        text: PROMPT,
      });
    };
    sync();
    syncers.add(sync);
    ctx.effect(() => () => {
      syncers.delete(sync);
      if (dispose) dispose();
    }, 'dsh-bagu: 说话的念头');
  });

  root.inject(['tools'], (ctx) => {
    ctx.tools.register({
      name: 'bagu_check',
      description: TOOL_CHECK,
      parameters: {
        type: 'object',
        properties: {
          text: { type: 'string', description: '要查的整段话。整段传，别自己先切句。' },
        },
        required: ['text'],
      },
      output: toolOutput(),
      execute: async (args) => {
        const src = String(args?.text ?? '');
        if (!src.trim()) return { ok: false, text: '没有收到文字。' };
        const r = analyze(src, thresholdsOf(live));
        return { ok: true, text: render(r), detail: { band: r.band, scores: r.scores } };
      },
    });

    ctx.tools.register({
      name: 'bagu_ask',
      description: TOOL_ASK,
      parameters: {
        type: 'object',
        properties: {
          text: { type: 'string', description: '要问的那段话。' },
        },
        required: ['text'],
      },
      output: toolOutput(),
      execute: async (args) => {
        const src = String(args?.text ?? '');
        if (!src.trim()) return { ok: false, text: '没有收到文字。' };
        const r = analyze(src, thresholdsOf(live));
        const text = r.asks.map((a, i) => `${i + 1}. ${a}`).join('\n');
        return { ok: true, text, detail: { band: r.band } };
      },
    });
  });

  root.inject(['webServer'], (ctx) => {
    const handler = async (req, res) => {
      const url = new URL(req.url, 'http://127.0.0.1');
      const path = url.pathname.replace(/^\/api\/bagu/, '') || '/';

      if (req.method === 'GET' && (path === '/' || path === '/status')) {
        return sendJson(res, 200, {
          ok: true,
          config: live,
          defaults: DEFAULTS,
          promptActive: live.enabled && live.prompt,
          configFile: CONFIG_FILE,
        });
      }

      if (req.method === 'POST' && path === '/config') {
        const body = await readBody(req);
        const next = writeConfig(body);
        applyLive(next);
        return sendJson(res, 200, { ok: true, config: next });
      }

      if (req.method === 'POST' && path === '/preview') {
        const body = await readBody(req);
        const src = String(body?.text ?? '');
        if (!src.trim()) return sendJson(res, 200, { ok: false, error: '没有文字' });
        const r = analyze(src, thresholdsOf(live));
        return sendJson(res, 200, { ok: true, text: render(r), band: r.band, scores: r.scores });
      }

      return sendJson(res, 404, { ok: false, error: `unknown ${req.method} ${path}` });
    };

    const server = ctx.webServer || (typeof ctx.get === 'function' ? ctx.get('webServer') : undefined);
    if (!server || typeof server.register !== 'function') return;
    try {
      ctx.effect(() => server.register({
        kind: 'prefix',
        path: '/api/bagu',
        handler: (req, res) => {
          Promise.resolve(handler(req, res)).catch((e) => {
            try { sendJson(res, 500, { ok: false, error: e?.message ?? String(e) }) } catch { /* 已经走了 */ }
          });
        },
      }), 'dsh-bagu: /api/bagu');
    } catch { /* headless 里没有 webServer 是正常的 */ }
  });
}
