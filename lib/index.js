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
import { guard } from './guard.js';
import { findMemes, lookup, loadMemes } from './memes.js';
import { bridge, bridgeHint } from './bridge.js';
import { aiBridge } from './ai-bridge.js';
import { captureRoute, sessionBridge } from './session-bridge.js';
import { readConfig, writeConfig, CONFIG_FILE, DEFAULTS } from './config.js';

export const name = 'dsh-bagu';

export { analyze, render, renderBrief };

let live = readConfig();
const syncers = new Set();

/** 每次会话都注入，多一个字都是白烧。 */
const PROMPT = `要发出去的话，先过 bagu_guard。被打回就改，别硬发。`;

/** 60 字。 */
/** 一个工具，三种模式。描述只占一份。 */
const TOOL_GUARD = `发出去之前过一遍。默认只回 OK 或一行改法。mode=report 给详细报告，mode=ask 给问句。`;

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

  /** 会话自己的路由（provider/model），从 agent/request 抓。抓不到就 null。 */
  let getRoute = () => null;
  root.inject(['llm'], (ctx) => {
    getRoute = captureRoute(ctx);
  });

  root.inject(['tools'], (ctx) => {
    // 一个工具，三种模式。mode 缺省是守门（日常路径），另外两个是调试用。
    if (live.memes) {
      ctx.tools.register({
        name: 'bagu_meme',
        description: '接梗用：看对方说了什么梗，给出同族能接的。也能查单个词什么意思。',
        parameters: {
          type: 'object',
          properties: {
            text: { type: 'string', description: '对方说的话。给了就找能接的梗。' },
            q: { type: 'string', description: '单个词，查它什么意思。' },
          },
        },
        output: toolOutput(),
        execute: async (args) => {
          const q = String(args?.q ?? '').trim();
          if (q) {
            const rows = lookup(q);
            const entry = rows && rows[0];
            if (!entry) return { ok: true, text: `没查到「${q}」` };
            const body = String(entry.summary || '')
              .replace(/\s+/g, ' ')
              .replace(/^(?:含义|来源|用法|简介|解释)\s*/g, '')
              .slice(0, 100);
            return { ok: true, text: `${entry.title}：${body}` };
          }
          const src = String(args?.text ?? '').trim();
          if (!src) return { ok: false, text: '给 text（对方说的话）或 q（要查的词）。' };
          const list = loadMemes();
          const hint = bridgeHint(src, list);

          // aiBridge 开着就走模型拼一句。两条路，先试会话自己的，再试自己配的 key。
          if (live.aiBridge) {
            const r = bridge(src, list);
            if (r.same.length || r.by.length) {
              // 路子一：DSH 会话自己的模型（不用填 key）
              const llm = ctx.llm || (typeof ctx.get === 'function' ? ctx.get('llm') : undefined);
              if (llm) {
                const viaSession = await sessionBridge(llm, getRoute(), src, r);
                if (viaSession) return { ok: true, text: viaSession };
              }
              // 路子二：另配的 OpenAI 兼容端点（aiUseOwn 开着才走）
              if (live.aiUseOwn && live.aiBaseUrl && live.aiModel && live.aiApiKey) {
                const viaApi = await aiBridge(src, r, {
                  baseUrl: live.aiBaseUrl, model: live.aiModel, apiKey: live.aiApiKey,
                });
                if (viaApi) return { ok: true, text: viaApi };
              }
            }
          }
          return { ok: true, text: hint || '没接的。' };
        },
      });
    }

    ctx.tools.register({
      name: 'bagu_guard',
      description: TOOL_GUARD,
      parameters: {
        type: 'object',
        properties: {
          text: { type: 'string', description: '要发出去的那段话。' },
          mode: {
            type: 'string',
            enum: ['guard', 'report', 'ask'],
            description: 'guard 只回 OK/一行改法（默认）；report 给详细报告；ask 只给问句。',
          },
          strict: { type: 'boolean', description: '连轻微信号也拦。' },
          full: { type: 'boolean', description: 'mode=report 时给完整输出。' },
          n: { type: 'number', description: 'mode=ask 时几条问句，默认 3，最多 6。' },
        },
        required: ['text'],
      },
      output: toolOutput(),
      execute: async (args) => {
        const src = String(args?.text ?? '');
        const mode = args?.mode || 'guard';

        if (!src.trim()) {
          return { ok: true, text: mode === 'guard' ? 'OK' : '没有文字。' };
        }

        if (mode === 'report') {
          const r = analyze(src, thresholdsOf(live));
          return { ok: true, text: render(r, { full: args?.full === true }) };
        }

        if (mode === 'ask') {
          const r = analyze(src, thresholdsOf(live));
          const n = Math.min(6, Math.max(1, Number(args?.n) || 3));
          return { ok: true, text: r.asks.slice(0, n).map((a, i) => `${i + 1}. ${a}`).join('\n') };
        }

        const g = guard(src, { strict: args?.strict ?? live.strict });
        // 梗库是选装的，默认关。开着就在结果后面附一句，不改判定。
        if (live.memes) {
          // 接梗：不是「这段用了哪些梗」，是「顺着这些能接什么」
          const hint = bridgeHint(src, loadMemes());
          if (hint) return { ok: true, text: `${g.line}｜${hint}` };
        }
        return { ok: true, text: g.line };
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
          route: getRoute(),
          configFile: CONFIG_FILE,
        });
      }

      if (req.method === 'POST' && path === '/config') {
        const body = await readBody(req);
        const next = writeConfig(body);
        applyLive(next);
        return sendJson(res, 200, { ok: true, config: next });
      }

      if (req.method === 'POST' && path === '/guard') {
        const body = await readBody(req);
        const src = String(body?.text ?? '');
        if (!src.trim()) return sendJson(res, 200, { ok: true, line: 'OK' });
        const g = guard(src, { strict: body?.strict ?? live.strict });
        return sendJson(res, 200, { ok: g.ok, line: g.line, why: g.why, hint: g.hint });
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
