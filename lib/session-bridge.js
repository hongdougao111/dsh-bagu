/**
 * AI 接梗 —— 用 DSH 会话自己的模型，不填 key。
 *
 * 插件在 ctx 里能拿到 llm 服务，用它调模型，走的是宿主已经配好的 provider/model/套餐。
 * 所以不用 API key，也不用另填接口地址。
 *
 * 但要拿到「当前用哪个 provider/model」，得从 agent/request 这个 waterfall 里取。
 * 拿不到就退回纯本地的族提示 —— 不因为链路不通让消息发不出去。
 */

/** 从 agent/request 拿到当前路由。拿不到就返回 null。 */
export function captureRoute(ctx) {
  let route = null;
  try {
    ctx.on('agent/request', async (payload, next) => {
      const resolved = await next();
      if (resolved && resolved.provider && resolved.model) {
        route = { provider: resolved.provider, model: resolved.model };
      }
      return resolved;
    });
  } catch {
    /* 没有这个事件就算了 */
  }
  return () => route;
}

/**
 * 调会话自己的模型拼一句接话。
 *
 * @param {object} llm DSH 的 llm 服务
 * @param {{provider:string, model:string}|null} route
 * @param {string} text 对方说的话
 * @param {{same:string[], by:string[], tags:string[]}} hint
 * @param {{timeoutMs?: number}} opts
 * @returns {Promise<string|null>}
 */
export async function sessionBridge(llm, route, text, hint, opts = {}) {
  if (!llm || typeof llm.stream !== 'function') return null;
  if (!route || !route.provider || !route.model) return null;
  if (!hint || (!hint.same.length && !hint.by.length)) return null;

  const fam = hint.by.length ? hint.by : hint.same;
  const prompt = [
    '你在中文互联网的评论区里接话。',
    '',
    `对方说：${text}`,
    `这段话涉及这些梗：${hint.same.join('、') || '（没点名）'}`,
    `同族还可以提到：${fam.join('、')}`,
    hint.tags.length ? `这一类是：${hint.tags.join('/')}` : '',
    '',
    '写一句接话：',
    '- 一句话，25 字以内',
    '- 顺着对方的梗往下接，别解释梗是什么意思',
    '- 不要用「学到了」「受益匪浅」这类套话',
    '- 直接输出那句话，不要引号，不要说明',
  ].filter(Boolean).join('\n');

  try {
    const request = {
      provider: route.provider,
      model: route.model,
      messages: [{ role: 'user', content: prompt }],
      maxTokens: 80,
      temperature: 0.7,
      stream: true,
    };

    // 有 prepareCall 就先准备，没有就直接 stream
    const call = typeof llm.prepareCall === 'function'
      ? await llm.prepareCall(request, AbortSignal.timeout(opts.timeoutMs || 20000))
      : null;

    const stream = call && typeof call.stream === 'function'
      ? call.stream(request)
      : llm.stream(request);

    let out = '';
    for await (const chunk of stream) {
      const d = chunk && (chunk.delta || (chunk.content && chunk.content.text));
      if (typeof d === 'string') out += d;
      if (out.length > 200) break;
    }

    const line = out.trim().replace(/^[「"'`]+|[」"'`]+$/g, '').replace(/^(接话|回复)[：:]\s*/, '').trim();
    return line && line.length <= 80 ? line : null;
  } catch {
    return null;
  }
}
