/**
 * AI 接梗：让模型根据族提示拼一句具体的接话。
 *
 * 这是整个插件里唯一会调模型的地方，所以单独立一个文件，默认关。
 * 关着的时候走 bridge.js 的本地路径，零成本。
 *
 * 成本：每条要发出去的消息，多一次 chat 请求。
 * 养鱼那种要质量的场景值得；日常聊天不值得。
 */

/**
 * 拼一句接话。
 *
 * @param {string} text 对方说的话
 * @param {{by: string[], same: string[], tags: string[]}} hint bridge() 的结果
 * @param {{baseUrl: string, model: string, apiKey: string}} cfg
 * @param {{timeoutMs?: number}} opts
 * @returns {Promise<string|null>} 接话；失败返回 null，调用方退回本地提示
 */
export async function aiBridge(text, hint, cfg, opts = {}) {
  if (!cfg || !cfg.baseUrl || !cfg.model || !cfg.apiKey) return null;
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
    '写一句接话，要求：',
    '- 一句话，25 字以内',
    '- 顺着对方的梗往下接，别解释梗是什么意思',
    '- 不要用「学到了」「受益匪浅」这类套话',
    '- 直接输出那句话，不要引号，不要说明',
  ].filter(Boolean).join('\n');

  try {
    const res = await fetch(`${cfg.baseUrl.replace(/\/+$/, '')}/chat/completions`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${cfg.apiKey}`,
      },
      body: JSON.stringify({
        model: cfg.model,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 80,
        temperature: 0.7,
      }),
      signal: AbortSignal.timeout(opts.timeoutMs || 15000),
    });
    if (!res.ok) return null;
    const j = await res.json();
    const line = String(j?.choices?.[0]?.message?.content || '').trim();
    if (!line || line.length > 80) return null;
    // 去掉模型可能加的引号和前缀
    return line.replace(/^[「"'`]+|[」"'`]+$/g, '').replace(/^(接话|回复)[：:]\s*/,'').trim() || null;
  } catch {
    return null;
  }
}
