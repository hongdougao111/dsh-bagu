/**
 * dsh-bagu —— 浏览器半端：设置页「八股检测」
 *
 * 插件管的是「AI 要对外发出去的一切文字」：
 * 聊天、评论、邮件、commit、PR、review、issue、文档、代码注释。
 * 所以设置页的重点是「这道门开不开、多严」，不是「查报告」。
 *
 * 视觉走 --dsw-alias-* 设计变量，跟随主题。
 */
window.__ModuleLoader__.load({
  id: 'dsh-bagu',
  factory: (require) => {
    const React = require('react')
    const h = React.createElement
    const API = '/api/bagu'

    const asJson = async (res) => {
      if (res.ok) return res.json()
      throw new Error('HTTP ' + res.status)
    }
    const jget = async (p) => asJson(await fetch(API + p, { credentials: 'same-origin' }))
    const jpost = async (p, body) => asJson(await fetch(API + p, {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body || {}),
    }))

    // 每种场景一条：该拦的放前面，真话的放后面
    const SAMPLES = [
      { label: '聊天', text: '这条我认！首先态度要正，其次内容要实，最后要持续更新。' },
      { label: '评论', text: '感谢分享！这个视频通过生动有趣的方式展示了相关内容，受益匪浅。' },
      { label: 'commit', text: 'feat: 优化了用户模块的代码结构，提升了可维护性' },
      { label: 'review', text: '整体实现思路清晰，代码结构合理，建议后续可以进一步优化。' },
      { label: '邮件', text: '您好，关于您反馈的问题，我们已进行核实，现回复如下：经查证，该问题属于系统正常现象。' },
      { label: '注释', text: '// 初始化计数器\nlet total = 0;\n// 遍历每个商品' },
      { label: '真话', text: '卖卡卖完了随便写了' },
      { label: '真话', text: '第 42 行那个 await 少了一层，函数本身没返回 promise' },
    ]

    const CSS = `
[data-bg]{display:flex;flex-direction:column;gap:20px;padding:4px 2px 12px;max-width:660px;
  color:var(--dsw-alias-label-primary,inherit);font-size:13px;line-height:1.5;}

[data-bg-head]{display:flex;flex-direction:column;gap:6px;}
[data-bg-title]{font-size:15px;font-weight:600;letter-spacing:-.01em;}
[data-bg-sub]{font-size:12px;line-height:1.6;color:var(--dsw-alias-label-tertiary,#9aa0a6);}

[data-bg-card]{display:flex;flex-direction:column;
  border:1px solid var(--dsw-alias-border-l,rgba(128,128,128,.2));
  border-radius:12px;overflow:hidden;
  background:var(--dsw-alias-bg-elevated,transparent);}
[data-bg-row]{display:flex;align-items:center;gap:12px;padding:12px 14px;}
[data-bg-row]+[data-bg-row]{border-top:1px solid var(--dsw-alias-border-l,rgba(128,128,128,.12));}
[data-bg-grow]{flex:1;min-width:0;}
[data-bg-label]{font-size:13px;font-weight:500;}
[data-bg-note]{font-size:11.5px;line-height:1.55;color:var(--dsw-alias-label-tertiary,#9aa0a6);margin-top:2px;}
[data-bg-h]{font-size:11px;font-weight:600;letter-spacing:.05em;text-transform:uppercase;
  color:var(--dsw-alias-label-caption,#8b8b8b);margin-bottom:8px;}

[data-bg-sw]{flex:none;width:40px;height:23px;border-radius:12px;border:0;cursor:pointer;position:relative;
  background:var(--dsw-alias-fill-secondary,rgba(128,128,128,.3));transition:background .16s;padding:0;}
[data-bg-sw][data-on]{background:var(--dsw-alias-state-business-primary,#3b82f6);}
[data-bg-sw]::after{content:'';position:absolute;top:3px;left:3px;width:17px;height:17px;border-radius:9px;
  background:#fff;transition:transform .16s;}
[data-bg-sw][data-on]::after{transform:translateX(17px);}
[data-bg-sw][disabled]{opacity:.45;cursor:default;}

[data-bg-num][data-wide]{width:200px;text-align:left;font-variant-numeric:normal;}
[data-bg-num]{width:88px;padding:6px 9px;border-radius:8px;font:inherit;font-size:13px;
  font-variant-numeric:tabular-nums;text-align:right;color:inherit;
  border:1px solid var(--dsw-alias-border-l,rgba(128,128,128,.28));
  background:var(--dsw-alias-bg-base,transparent);}
[data-bg-num]:focus{outline:2px solid var(--dsw-alias-state-business-primary,#3b82f6);outline-offset:-1px;}

[data-bg-in]{width:100%;box-sizing:border-box;resize:vertical;min-height:76px;padding:11px 13px;border:0;
  font:inherit;font-size:13px;line-height:1.65;color:inherit;
  background:var(--dsw-alias-bg-base,transparent);}
[data-bg-in]:focus{outline:none;}

[data-bg-btn]{padding:7px 15px;border-radius:8px;cursor:pointer;font:inherit;font-size:12.5px;font-weight:500;
  border:1px solid var(--dsw-alias-border-l,rgba(128,128,128,.28));
  background:var(--dsw-alias-interactive-bg-hover,rgba(128,128,128,.12));color:inherit;
  transition:background .12s;}
[data-bg-btn]:hover:not([disabled]){background:var(--dsw-alias-interactive-bg-selected,rgba(128,128,128,.2));}
[data-bg-btn][disabled]{opacity:.45;cursor:default;}
[data-bg-btn][data-primary]{background:var(--dsw-alias-state-business-primary,#3b82f6);
  border-color:transparent;color:#fff;}

[data-bg-chips]{display:flex;flex-wrap:wrap;gap:6px;padding:10px 14px 0;}
[data-bg-chip]{padding:4px 10px;border-radius:14px;cursor:pointer;font-size:11.5px;
  border:1px solid var(--dsw-alias-border-l,rgba(128,128,128,.24));
  background:transparent;color:var(--dsw-alias-label-secondary,#555);}
[data-bg-chip]:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(128,128,128,.1));}

[data-bg-verdict]{display:flex;align-items:center;gap:10px;padding:11px 14px;
  font-size:13px;font-weight:500;
  border-top:1px solid var(--dsw-alias-border-l,rgba(128,128,128,.12));}
[data-bg-verdict][data-pass]{background:color-mix(in srgb,var(--dsw-alias-state-business-primary,#3b82f6) 9%,transparent);
  color:var(--dsw-alias-state-business-tertiary,#1d4ed8);}
[data-bg-verdict][data-block]{background:color-mix(in srgb,var(--dsw-alias-state-error-secondary,#dc2626) 9%,transparent);
  color:var(--dsw-alias-state-error-secondary,#dc2626);}
[data-bg-dot]{flex:none;width:7px;height:7px;border-radius:4px;background:currentColor;}
[data-bg-verdict-text]{flex:1;min-width:0;}

[data-bg-msg]{font-size:12px;padding:9px 13px;border-radius:8px;
  background:var(--dsw-alias-fill-secondary,rgba(128,128,128,.1));}
[data-bg-msg][data-err]{background:color-mix(in srgb,var(--dsw-alias-state-error-secondary,#dc2626) 12%,transparent);
  color:var(--dsw-alias-state-error-secondary,#dc2626);}
[data-bg-msg][data-ok]{background:color-mix(in srgb,var(--dsw-alias-state-business-primary,#3b82f6) 12%,transparent);
  color:var(--dsw-alias-state-business-tertiary,inherit);}

[data-bg-foot]{font-size:11px;color:var(--dsw-alias-label-dimmed,#7a7a7a);
  font-family:ui-monospace,SFMono-Regular,Menlo,monospace;word-break:break-all;}

[data-bg-skel]{height:64px;border-radius:12px;
  background:linear-gradient(90deg,var(--dsw-alias-fill-secondary,rgba(128,128,128,.08)) 25%,
    var(--dsw-alias-interactive-bg-hover,rgba(128,128,128,.14)) 37%,
    var(--dsw-alias-fill-secondary,rgba(128,128,128,.08)) 63%);
  background-size:400% 100%;animation:bg-shimmer 1.4s ease infinite;}
@keyframes bg-shimmer{0%{background-position:100% 50%}100%{background-position:0 50%}}
`

    function Row(props) {
      return h('div', { 'data-bg-row': '' },
        h('div', { 'data-bg-grow': '' },
          h('div', { 'data-bg-label': '' }, props.label),
          props.note ? h('div', { 'data-bg-note': '' }, props.note) : null),
        props.children)
    }

    function Switch(props) {
      return h('button', {
        'data-bg-sw': '', 'data-on': props.on ? '' : undefined,
        role: 'switch', 'aria-checked': props.on ? 'true' : 'false',
        'aria-label': props.label, disabled: props.disabled, onClick: props.onChange,
      })
    }

    function Panel() {
      const [st, setSt] = React.useState(null)
      const [view, setView] = React.useState(null)
      const [busy, setBusy] = React.useState('')
      const [msg, setMsg] = React.useState(null)
      const [text, setText] = React.useState(SAMPLES[0].text)
      const [verdict, setVerdict] = React.useState(null)

      const load = React.useCallback(async () => {
        try {
          const s = await jget('/status')
          setSt(s); setView(s.config)
        } catch (e) {
          setMsg({ err: true, text: '读不到配置：' + (e && e.message ? e.message : String(e)) })
        }
      }, [])

      React.useEffect(() => { load() }, [load])

      const save = async (patch) => {
        setBusy('save'); setMsg(null)
        try {
          const r = await jpost('/config', patch)
          setView(r.config)
          setSt((old) => (old ? { ...old, config: r.config, promptActive: r.config.enabled && r.config.prompt } : old))
          setMsg({ ok: true, text: '已保存，立刻生效。' })
        } catch (e) {
          setMsg({ err: true, text: '保存失败：' + (e && e.message ? e.message : String(e)) })
        } finally { setBusy('') }
      }

      const check = async () => {
        setBusy('check'); setMsg(null); setVerdict(null)
        try {
          const r = await jpost('/guard', { text, strict: view.strict })
          if (r.line !== undefined) setVerdict({ pass: r.ok, line: r.line, why: r.why, hint: r.hint })
          else setMsg({ err: true, text: r.error || '查不了' })
        } catch (e) {
          setMsg({ err: true, text: '查不了：' + (e && e.message ? e.message : String(e)) })
        } finally { setBusy('') }
      }

      const num = (key) => h('input', {
        'data-bg-num': '', type: 'number', step: '0.1', min: '0',
        value: view[key], disabled: busy === 'save',
        onChange: (e) => setView({ ...view, [key]: e.target.value === '' ? '' : Number(e.target.value) }),
        onBlur: () => { if (view[key] !== st.config[key]) save({ [key]: view[key] }) },
      })

      if (!view) {
        return h('div', { 'data-bg': '' },
          h('div', { 'data-bg-head': '' }, h('div', { 'data-bg-title': '' }, '八股检测')),
          msg ? h('div', { 'data-bg-msg': '', 'data-err': '' }, msg.text) : null,
          h('div', { 'data-bg-skel': '' }),
          h('div', { 'data-bg-skel': '' }))
      }

      const on = view.enabled !== false

      return h('div', { 'data-bg': '' },

        h('div', { 'data-bg-head': '' },
          h('div', { 'data-bg-title': '' }, '八股检测'),
          h('div', { 'data-bg-sub': '' },
            'AI 要对外发出去的文字，先过一道。聊天、评论、邮件、commit、PR、文档、注释，都算。')),

        // ── 挡不挡 ───────────────────────────
        h('div', null,
          h('div', { 'data-bg-h': '' }, '挡不挡'),
          h('div', { 'data-bg-card': '' },
            h(Row, {
              label: on ? '开着' : '关了',
              note: on ? 'AI 要发出去的话会先过一遍。' : '关掉后不拦，工具还在，只是不再往提示里塞话。',
            }, h(Switch, { on, label: '总开关', disabled: busy === 'save', onChange: () => save({ enabled: !on }) })),

            h(Row, {
              label: view.strict ? '严格：轻的也拦' : '正常：只拦明显的',
              note: view.strict
                ? '破折号、只有评价没有具体东西，这些也打回。'
                : '只拦模板三连、对举、同义轮换、空转、空形容词这类硬信号。',
            }, h(Switch, {
              on: view.strict === true, label: '严格模式', disabled: busy === 'save' || !on,
              onChange: () => save({ strict: view.strict !== true }),
            })),

            h(Row, {
              label: view.prompt !== false ? '提示那一节：开' : '提示那一节：关',
              note: '关掉只留工具，不往系统提示里塞话。',
            }, h(Switch, {
              on: view.prompt !== false, label: '提示节', disabled: busy === 'save' || !on,
              onChange: () => save({ prompt: view.prompt === false }),
            })),

            h(Row, {
              label: view.memes ? '梗库：开' : '梗库：关',
              note: '开 = 多一个接梗工具，看对方说了什么梗，给出同族能接的。' +
                    '它判的是「这个梗过气了没」，跟八股无关，所以默认关。',
            }, h(Switch, {
              on: view.memes === true, label: '梗库', disabled: busy === 'save' || !on,
              onChange: () => save({ memes: view.memes !== true }),
            })))),

        // ── AI 接梗（默认走会话模型，不用填 key）──────────
        h('div', null,
          h('div', { 'data-bg-h': '' }, 'AI 接梗'),
          h('div', { 'data-bg-card': '' },
            h(Row, {
              label: view.aiBridge ? 'AI 接梗：开' : 'AI 接梗：关',
              note: '开 = 每条要接梗的消息都调一次模型，拼一句具体的接话。默认走 DSH 会话自己的模型，不用填 key；失败才退回本地族提示。',
            }, h(Switch, {
              on: view.aiBridge === true, label: 'AI 接梗',
              disabled: busy === 'save' || !on || view.memes !== true,
              onChange: () => save({ aiBridge: view.aiBridge !== true }),
            })),

            h(Row, {
              label: '用哪个模型',
              note: st.route
                ? `当前会话：${st.route.provider} / ${st.route.model}。不用填 key。`
                : '当前会话：还没拿到。DSH 会话里发一句话之后就能拿到。',
            }, h('div', { 'data-bg-note': '', style: { flex: 'none' } },
              st.route ? st.route.model : '—')),

            h(Row, {
              label: view.aiUseOwn ? '另配接口：开' : '另配接口：关',
              note: '会话模型用不了时才需要（没有会话、或者想换更便宜的模型）。',
            }, h(Switch, {
              on: view.aiUseOwn === true, label: '另配接口',
              disabled: busy === 'save' || !on || view.aiBridge !== true,
              onChange: () => save({ aiUseOwn: view.aiUseOwn !== true }),
            })),

            view.aiUseOwn ? h('div', { 'data-bg-row': '' },
              h('div', { 'data-bg-grow': '' },
                h('div', { 'data-bg-label': '' }, '接口地址'),
                h('div', { 'data-bg-note': '' }, 'OpenAI 兼容的 /v1 端点。')),
              h('input', {
                'data-bg-num': '', 'data-wide': '', type: 'text',
                value: view.aiBaseUrl || '', placeholder: 'https://api.openai.com/v1',
                disabled: busy === 'save',
                onChange: (e) => setView({ ...view, aiBaseUrl: e.target.value }),
                onBlur: () => { if (view.aiBaseUrl !== st.config.aiBaseUrl) save({ aiBaseUrl: view.aiBaseUrl }) },
              })) : null,

            view.aiUseOwn ? h('div', { 'data-bg-row': '' },
              h('div', { 'data-bg-grow': '' },
                h('div', { 'data-bg-label': '' }, '模型名'),
                h('div', { 'data-bg-note': '' }, '比如 gpt-4o-mini、deepseek-chat。')),
              h('input', {
                'data-bg-num': '', 'data-wide': '', type: 'text',
                value: view.aiModel || '', placeholder: 'gpt-4o-mini',
                disabled: busy === 'save',
                onChange: (e) => setView({ ...view, aiModel: e.target.value }),
                onBlur: () => { if (view.aiModel !== st.config.aiModel) save({ aiModel: view.aiModel }) },
              })) : null,

            view.aiUseOwn ? h('div', { 'data-bg-row': '' },
              h('div', { 'data-bg-grow': '' },
                h('div', { 'data-bg-label': '' }, 'API Key'),
                h('div', { 'data-bg-note': '' }, '明文存在插件目录的 config.json。')),
              h('input', {
                'data-bg-num': '', 'data-wide': '', type: 'password',
                value: view.aiApiKey || '', placeholder: 'sk-...',
                disabled: busy === 'save',
                onChange: (e) => setView({ ...view, aiApiKey: e.target.value }),
                onBlur: () => { if (view.aiApiKey !== st.config.aiApiKey) save({ aiApiKey: view.aiApiKey }) },
              })) : null)),

        msg ? h('div', {
          'data-bg-msg': '', 'data-err': msg.err ? '' : undefined, 'data-ok': msg.ok ? '' : undefined,
        }, msg.text) : null,

        h('div', { 'data-bg-foot': '' }, String(st.configFile || 'config.json')))
    }

    return {
      inject: ['slots'],
      apply(ctx) {
        const style = document.createElement('style')
        style.setAttribute('data-plugin-css', 'dsh-bagu')
        style.textContent = CSS
        document.head.appendChild(style)
        ctx.effect(() => () => style.remove(), 'dsh-bagu: 设置页样式')

        const slots = (typeof ctx.get === 'function' ? ctx.get('slots') : undefined) || ctx.slots
        if (!slots || typeof slots.inject !== 'function' || typeof slots.register !== 'function') return
        slots.inject('settings.section', () => slots.register(
          { name: 'settings.section', id: 'bagu', order: 35, label: '八股检测' },
          () => h(Panel),
        ))
      },
    }
  },
})
