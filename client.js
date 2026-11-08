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
[data-bg]{display:flex;flex-direction:column;gap:26px;padding:8px 4px 20px;max-width:680px;
  color:var(--dsw-alias-label-primary,inherit);font-size:13.5px;
  line-height:1.55;-webkit-font-smoothing:antialiased;}

/* 顶部 */
[data-bg-head]{display:flex;flex-direction:column;gap:5px;padding-bottom:16px;
  border-bottom:1px solid var(--dsw-alias-border-l,rgba(128,128,128,.16));}
[data-bg-title]{font-size:17px;font-weight:600;letter-spacing:-.015em;}
[data-bg-sub]{font-size:12.5px;line-height:1.65;
  color:var(--dsw-alias-label-tertiary,#9aa0a6);max-width:52ch;}

/* 分区 */
[data-bg-h]{display:flex;align-items:center;gap:8px;font-size:12px;font-weight:600;
  letter-spacing:.02em;color:var(--dsw-alias-label-secondary,#6b7280);margin-bottom:10px;}
[data-bg-h]::before{content:'';width:3px;height:12px;border-radius:2px;
  background:var(--dsw-alias-state-business-primary,#3b82f6);opacity:.75;}
[data-bg-sec]{display:flex;flex-direction:column;}

/* 卡片 */
[data-bg-card]{display:flex;flex-direction:column;
  border:1px solid var(--dsw-alias-border-l,rgba(128,128,128,.18));
  border-radius:14px;overflow:hidden;
  background:var(--dsw-alias-bg-elevated,rgba(128,128,128,.03));
  box-shadow:0 1px 2px rgba(0,0,0,.03);}
[data-bg-row]{display:flex;align-items:center;gap:14px;padding:14px 16px;min-height:52px;
  transition:background .12s;}
[data-bg-row]:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(128,128,128,.04));}
[data-bg-row]+[data-bg-row]{border-top:1px solid var(--dsw-alias-border-l,rgba(128,128,128,.1));}
[data-bg-grow]{flex:1;min-width:0;}
[data-bg-label]{font-size:13.5px;font-weight:500;letter-spacing:-.005em;}
[data-bg-note]{font-size:11.5px;line-height:1.6;
  color:var(--dsw-alias-label-tertiary,#9aa0a6);margin-top:3px;max-width:46ch;}
[data-bg-off] [data-bg-label],[data-bg-off] [data-bg-note]{opacity:.5;}

/* 开关 */
[data-bg-sw]{flex:none;width:44px;height:25px;border-radius:13px;border:0;cursor:pointer;
  position:relative;padding:0;transition:background .18s ease;
  background:var(--dsw-alias-fill-secondary,rgba(128,128,128,.28));}
[data-bg-sw][data-on]{background:var(--dsw-alias-state-business-primary,#3b82f6);}
[data-bg-sw]::after{content:'';position:absolute;top:3px;left:3px;width:19px;height:19px;
  border-radius:10px;background:#fff;transition:transform .18s cubic-bezier(.3,.8,.4,1);
  box-shadow:0 1px 3px rgba(0,0,0,.18);}
[data-bg-sw][data-on]::after{transform:translateX(19px);}
[data-bg-sw][disabled]{opacity:.4;cursor:default;}

/* 输入 */
[data-bg-num]{width:84px;padding:7px 10px;border-radius:9px;font:inherit;font-size:13.5px;
  font-variant-numeric:tabular-nums;text-align:right;color:inherit;
  border:1px solid var(--dsw-alias-border-l,rgba(128,128,128,.24));
  background:var(--dsw-alias-bg-base,transparent);transition:border-color .12s;}
[data-bg-num]:hover:not([disabled]){border-color:var(--dsw-alias-border-l,rgba(128,128,128,.4));}
[data-bg-num][data-wide]{width:210px;text-align:left;font-variant-numeric:normal;}
[data-bg-num]:focus{outline:none;border-color:var(--dsw-alias-state-business-primary,#3b82f6);
  box-shadow:0 0 0 3px color-mix(in srgb,var(--dsw-alias-state-business-primary,#3b82f6) 18%,transparent);}

[data-bg-in]{width:100%;box-sizing:border-box;resize:vertical;min-height:88px;
  padding:13px 15px;border:0;font:inherit;font-size:13.5px;line-height:1.7;color:inherit;
  background:transparent;}
[data-bg-in]:focus{outline:none;}
[data-bg-in]::placeholder{color:var(--dsw-alias-label-dimmed,#a1a1aa);}

/* 滑杆 */
[data-bg-range]{-webkit-appearance:none;appearance:none;width:190px;height:5px;border-radius:3px;
  background:var(--dsw-alias-fill-secondary,rgba(128,128,128,.26));outline:none;cursor:pointer;
  transition:background .12s;}
[data-bg-range]:hover:not([disabled]){background:var(--dsw-alias-fill-secondary,rgba(128,128,128,.36));}
[data-bg-range]::-webkit-slider-thumb{-webkit-appearance:none;width:18px;height:18px;border-radius:9px;
  background:var(--dsw-alias-state-business-primary,#3b82f6);cursor:pointer;border:0;
  box-shadow:0 1px 4px rgba(0,0,0,.2);transition:transform .1s;}
[data-bg-range]::-webkit-slider-thumb:active{transform:scale(1.15);}
[data-bg-range]:disabled{opacity:.4;cursor:default;}
[data-bg-tone]{flex:none;min-width:52px;text-align:right;font-size:12.5px;font-variant-numeric:tabular-nums;
  color:var(--dsw-alias-label-tertiary,#9aa0a6);}

/* 按钮 */
[data-bg-btn]{padding:8px 16px;border-radius:9px;cursor:pointer;font:inherit;font-size:12.5px;
  font-weight:500;letter-spacing:-.005em;
  border:1px solid var(--dsw-alias-border-l,rgba(128,128,128,.24));
  background:transparent;color:inherit;transition:all .12s;}
[data-bg-btn]:hover:not([disabled]){background:var(--dsw-alias-interactive-bg-hover,rgba(128,128,128,.08));
  border-color:var(--dsw-alias-border-l,rgba(128,128,128,.4));}
[data-bg-btn][disabled]{opacity:.4;cursor:default;}
[data-bg-btn][data-primary]{background:var(--dsw-alias-state-business-primary,#3b82f6);
  border-color:transparent;color:#fff;box-shadow:0 1px 3px rgba(59,130,246,.3);}
[data-bg-btn][data-primary]:hover:not([disabled]){filter:brightness(.94);}

/* 样本 chip */
[data-bg-chips]{display:flex;flex-wrap:wrap;gap:7px;padding:13px 16px 4px;}
[data-bg-chip]{padding:5px 11px;border-radius:20px;cursor:pointer;font-size:11.5px;
  border:1px solid var(--dsw-alias-border-l,rgba(128,128,128,.2));
  background:transparent;color:var(--dsw-alias-label-secondary,#71717a);
  transition:all .12s;}
[data-bg-chip]:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(128,128,128,.08));
  border-color:var(--dsw-alias-border-l,rgba(128,128,128,.36));
  color:var(--dsw-alias-label-primary,inherit);}

/* 判定 */
[data-bg-verdict]{display:flex;align-items:center;gap:10px;padding:13px 16px;
  font-size:13px;font-weight:500;border-top:1px solid var(--dsw-alias-border-l,rgba(128,128,128,.1));}
[data-bg-verdict][data-pass]{background:color-mix(in srgb,var(--dsw-alias-state-business-primary,#3b82f6) 8%,transparent);
  color:var(--dsw-alias-state-business-tertiary,#1d4ed8);}
[data-bg-verdict][data-block]{background:color-mix(in srgb,var(--dsw-alias-state-error-secondary,#dc2626) 8%,transparent);
  color:var(--dsw-alias-state-error-secondary,#dc2626);}
[data-bg-dot]{flex:none;width:7px;height:7px;border-radius:4px;background:currentColor;
  box-shadow:0 0 0 3px color-mix(in srgb,currentColor 15%,transparent);}
[data-bg-verdict-text]{flex:1;min-width:0;}

/* 提示条 */
[data-bg-msg]{font-size:12.5px;padding:10px 14px;border-radius:10px;
  background:var(--dsw-alias-fill-secondary,rgba(128,128,128,.08));}
[data-bg-msg][data-err]{background:color-mix(in srgb,var(--dsw-alias-state-error-secondary,#dc2626) 10%,transparent);
  color:var(--dsw-alias-state-error-secondary,#dc2626);}
[data-bg-msg][data-ok]{background:color-mix(in srgb,var(--dsw-alias-state-business-primary,#3b82f6) 10%,transparent);
  color:var(--dsw-alias-state-business-tertiary,#1d4ed8);}

/* 页脚 */
[data-bg-foot]{font-size:11px;color:var(--dsw-alias-label-dimmed,#a1a1aa);
  font-family:ui-monospace,SFMono-Regular,Menlo,monospace;word-break:break-all;opacity:.7;}

/* 骨架 */
[data-bg-skel]{height:68px;border-radius:14px;
  background:linear-gradient(90deg,var(--dsw-alias-fill-secondary,rgba(128,128,128,.06)) 25%,
    var(--dsw-alias-interactive-bg-hover,rgba(128,128,128,.12)) 37%,
    var(--dsw-alias-fill-secondary,rgba(128,128,128,.06)) 63%);
  background-size:400% 100%;animation:bg-shimmer 1.5s ease infinite;}
@keyframes bg-shimmer{0%{background-position:100% 50%}100%{background-position:0 50%}}

/* 库信息小标 */
[data-bg-badge]{display:inline-flex;align-items:center;gap:5px;padding:2px 8px;border-radius:10px;
  font-size:11px;font-weight:500;letter-spacing:0;
  background:color-mix(in srgb,var(--dsw-alias-state-business-primary,#3b82f6) 10%,transparent);
  color:var(--dsw-alias-state-business-tertiary,#1d4ed8);}
`;
    function toneLabel(v) {
      const n = Number(v) || 0
      if (n <= 20) return '很收着'
      if (n <= 45) return '有点度'
      if (n <= 70) return '跟着玩'
      return '放得开'
    }
    function toneNote(v) {
      const n = Number(v) || 0
      if (n <= 20) return '只接正面的、自嘲的。带贬义的外号不复读，不跟着起哄。'
      if (n <= 45) return '损发挥可以，损长相、损身体不行。别人先开的头，接半句。'
      if (n <= 70) return '社区玩什么就接什么，不自己发明。分寸跟着对方的调子走。'
      return '带刺的也能接。但对方认真了就立刻停。'
    }

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
            'AI 要发出去的文字，先过一道 —— 聊天、评论、邮件、commit、PR、文档、注释都算。',
            st.memeTotal
              ? h('div', { style: { marginTop: '8px' } },
                  h('span', { 'data-bg-badge': '' }, '梗库 ' + st.memeTotal + ' 条 · 梗Wiki'))
              : null)),

        // ── 挡不挡 ───────────────────────────
        h('div', { 'data-bg-sec': '' },
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
            })))),

        // ── 玩梗 ────────────────────────────
        h('div', { 'data-bg-sec': '' },
          h('div', { 'data-bg-h': '' }, '玩梗'),
          h('div', { 'data-bg-card': '' },
            h(Row, {
              label: view.memes !== false ? '梗库：开' : '梗库：关',
              note: st.memeTotal
                ? `内置 ${st.memeTotal} 条词条。对方抛出梗来，模型不用去猜、不用联网搜。`
                : '内置词条库，装了就有。',
            }, h(Switch, {
              on: view.memes !== false, label: '梗库', disabled: busy === 'save' || !on,
              onChange: () => save({ memes: view.memes === false }),
            })),

            h(Row, {
              label: view.autoMeme !== false ? '每轮自动查：开' : '每轮自动查：关',
              note: '开 = 你一说含梗的话，查好的结果就塞进上下文，模型直接接。' +
                    '关 = 只在模型主动查的时候才查。',
            }, h(Switch, {
              on: view.autoMeme !== false, label: '自动查梗',
              disabled: busy === 'save' || !on || view.memes === false,
              onChange: () => save({ autoMeme: view.autoMeme === false }),
            })),

            h(Row, {
              label: view.autoUpdate !== false ? '每天更新词库：开' : '每天更新词库：关',
              note: st.lastCheck
                ? `上次查过：${st.lastCheck}。现在 ${st.memeTotal} 条。`
                : `光大不更新会变旧。现在 ${st.memeTotal} 条，开了就每天去看一眼新词条。`,
            }, h(Switch, {
              on: view.autoUpdate !== false, label: '每天更新',
              disabled: busy === 'save' || !on || view.memes === false,
              onChange: () => save({ autoUpdate: view.autoUpdate === false }),
            })),

            view.autoUpdate !== false ? h('div', { 'data-bg-row': '' },
              h('div', { 'data-bg-grow': '' },
                h('div', { 'data-bg-label': '' }, '每天几点'),
                h('div', { 'data-bg-note': '' },
                  '凌晨机器闲着，四点最稳。更新只补新词条，不动你改过的。')),
              h('select', {
                'data-bg-num': '', 'data-wide': '', value: String(view.updateHour ?? 4),
                disabled: busy === 'save',
                onChange: (e) => save({ updateHour: Number(e.target.value) }),
              },
                Array.from({ length: 24 }, (_, i) =>
                  h('option', { key: i, value: String(i) },
                    String(i).padStart(2, '0') + ':00')))) : null,

            h(Row, {
              label: view.toneSwitch ? '尺度：自己定' : '尺度：交给模型',
              note: view.toneSwitch
                ? '下面这个滑杆管着它能玩多野。'
                : '关着时模型看场合自己判断。想手动接管就打开。',
            }, h(Switch, {
              on: view.toneSwitch === true, label: '尺度开关',
              disabled: busy === 'save' || !on || view.memes === false,
              onChange: () => save({ toneSwitch: view.toneSwitch !== true }),
            })),

            view.toneSwitch ? h('div', { 'data-bg-row': '' },
              h('div', { 'data-bg-grow': '' },
                h('div', { 'data-bg-label': '' }, toneLabel(view.toneLevel)),
                h('div', { 'data-bg-note': '' }, toneNote(view.toneLevel))),
              h('input', {
                'data-bg-range': '', type: 'range', min: '0', max: '100', step: '5',
                value: view.toneLevel ?? 50, disabled: busy === 'save',
                onChange: (e) => setView({ ...view, toneLevel: Number(e.target.value) }),
                onMouseUp: (e) => save({ toneLevel: Number(e.target.value) }),
                onTouchEnd: (e) => save({ toneLevel: Number(e.target.value) }),
              }),
              h('div', { 'data-bg-tone': '' }, String(view.toneLevel ?? 50))) : null)),

        // ── AI 接梗（默认走会话模型，不用填 key）──────────
        h('div', { 'data-bg-sec': '' },
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

        // ── 试一段 ──────────────────────────
        h('div', { 'data-bg-sec': '' },
          h('div', { 'data-bg-h': '' }, '试一段'),
          h('div', { 'data-bg-card': '' },
            h('div', { 'data-bg-chips': '' },
              SAMPLES.map((s, i) => h('button', {
                key: i, 'data-bg-chip': '',
                onClick: () => { setText(s.text); setVerdict(null) },
              }, s.label))),
            h('textarea', {
              'data-bg-in': '', value: text, rows: 3,
              placeholder: '粘一段准备发出去的文字。聊天、commit、邮件都行。',
              onChange: (e) => { setText(e.target.value); setVerdict(null) },
            }),
            h('div', { 'data-bg-row': '' },
              h('button', {
                'data-bg-btn': '', 'data-primary': '',
                disabled: busy === 'check', onClick: check,
              }, busy === 'check' ? '过着…' : '过一遍'),
              h('div', { 'data-bg-grow': '' },
                h('div', { 'data-bg-note': '' }, verdict
                  ? (verdict.pass ? '能发。直接发就行。' : '打回了。按下面那句改。')
                  : '粘一段准备发出去的文字，看看能不能过'))),
            verdict ? h('div', {
              'data-bg-verdict': '',
              'data-pass': verdict.pass ? '' : undefined,
              'data-block': verdict.pass ? undefined : '',
            },
              h('div', { 'data-bg-dot': '' }),
              h('div', { 'data-bg-verdict-text': '' }, verdict.line),
            ) : null)),

        // ── 阈值 ────────────────────────────
        h('div', { 'data-bg-sec': '' },
          h('div', { 'data-bg-h': '' }, '阈值'),
          h('div', { 'data-bg-card': '' },
            h(Row, {
              label: '留白词下限',
              note: '每千字几个「好像 / 应该 / 大概」。低于这个就报句句在下断言。',
            }, num('hedgeFloor')),
            h(Row, {
              label: '结构腔倍数',
              note: '超过同文体基线的几倍才报。调大更宽容。',
            }, num('structureTimes')),
            h(Row, {
              label: '具体物下限',
              note: '每百字至少几个数字、时间、经历、原话、名字。',
            }, num('concreteFloor')),
            h('div', { 'data-bg-row': '' },
              h('div', { 'data-bg-grow': '' }, h('div', { 'data-bg-note': '' }, '恢复默认。')),
              h('button', {
                'data-bg-btn': '', disabled: busy === 'save',
                onClick: () => save({
                  hedgeFloor: st.defaults.hedgeFloor,
                  structureTimes: st.defaults.structureTimes,
                  concreteFloor: st.defaults.concreteFloor,
                }),
              }, '恢复默认')))),

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
