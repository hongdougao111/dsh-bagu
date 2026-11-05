/**
 * dsh-bagu · 宿主半侧
 *
 * 三件事：挂一节提示、挂两个只读工具、开 /api/bagu。
 *
 * 省 token 是这个插件的设计约束，不是优化项：
 *   - 提示词压到 150 字以内，每次会话都要烧
 *   - 工具描述压到 60 字以内，每次调用都在上下文里
 *   - 默认输出三行以内；要看细节传 full: true
 *
 * 所有判断都在本地正则里做完，不调模型 —— 这是零 token 成本的那一半。
 */

import { analyze } from './analyze.js';
import { render, renderBrief } from './render.js';
import { readConfig, writeConfig, CONFIG_FILE, DEFAULTS } from './config.js';

export const name = 'dsh-bagu';

export { analyze, render, renderBrief };

let live = readConfig();
const syncers = new Set();

/** 150 字。每次会话注入，多一个字都是白烧。 */
const PROMPT = `一句话换个人说还成不成立？成立，就是八股。

- 别急着认错。对方问一句，不等于你在说错。
- 留一处不确定。全篇一个「大概」都没有，是在下断言。
- 具体压过评价。「骨架在推所以有点飘」只有看过的人才说得出。
- 别每句一样长。整齐本身就是痕迹。`;

/** 60 字。 */
const TOOL_CHECK = `查一段话有多可替换：具体物、抽象词、留白、同义轮换、结构腔。只报不给改。默认三行，full 给详细报告。`;

const TOOL_ASK = `只要问句，不要结论。`;

function toolOutput() {
  return {
    schema: {
      type: 'object',
      additionalProperties: true,
      required: ['ok'],
      properties: {
        ok: { type: 'boolean' },
        text: { type: 'string' },
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
          text: { type: 'string', description: '整段话。' },
          full: { type: 'boolean', description: 'true 给详细报告。默认三行。' },
        },
        required: ['text'],
      },
      output: toolOutput(),
      execute: async (args) => {
        const src = String(args?.text ?? '');
        if (!src.trim()) return { ok: false, text: '没有文字。' };
        const r = analyze(src, thresholdsOf(live));
        return { ok: true, text: render(r, { full: args?.full === true }) };
      },
    });

    ctx.tools.register({
      name: 'bagu_ask',
      description: TOOL_ASK,
      parameters: {
        type: 'object',
        properties: {
          text: { type: 'string', description: '整段话。' },
          n: { type: 'number', description: '几条，默认 3，最多 6。' },
        },
        required: ['text'],
      },
      output: toolOutput(),
      execute: async (args) => {
        const src = String(args?.text ?? '');
        if (!src.trim()) return { ok: false, text: '没有文字。' };
        const r = analyze(src, thresholdsOf(live));
        const n = Math.min(6, Math.max(1, Number(args?.n) || 3));
        return { ok: true, text: r.asks.slice(0, n).map((a, i) => `${i + 1}. ${a}`).join('\n') };
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
        return sendJson(res, 200, { ok: true, text: render(r, { full: body?.full === true }), band: r.band });
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
            try { sendJson(res, 500, { ok: false, error: e?.message ?? String(e) }) } catch { /* 已走 */ }
          });
        },
      }), 'dsh-bagu: /api/bagu');
    } catch { /* headless 没有 webServer 正常 */ }
  });
}
