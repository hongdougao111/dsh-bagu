/**
 * dsh-bagu —— 浏览器半端：设置页「八股检测」
 *
 * 约定：
 *   1. client bundle 不是 ESM，是自注册脚本
 *   2. 进「设置」靠 slots.inject('settings.section', ...)
 *   3. 宿主开 /api/bagu，这页只做 fetch
 *
 * 视觉全部走 --dsw-alias-* 设计变量，跟随主题，不写死颜色。
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

    const SAMPLE = '这不是技术问题，而是认知问题。我们使用了新方法，采用了更好的方式，通过提升效率来优化流程。'

    const CSS = `
[data-bg]{display:flex;flex-direction:column;gap:20px;padding:4px 2px 12px;max-width:660px;
  color:var(--dsw-alias-label-primary,inherit);font-size:13px;line-height:1.5;}

/* 头部 */
[data-bg-head]{display:flex;flex-direction:column;gap:6px;}
[data-bg-title]{font-size:15px;font-weight:600;letter-spacing:-.01em;}
[data-bg-sub]{font-size:12px;line-height:1.6;color:var(--dsw-alias-label-tertiary,#9aa0a6);}

/* 卡片 */
[data-bg-card]{display:flex;flex-direction:column;
  border:1px solid var(--dsw-alias-border-l,rgba(128,128,128,.2));
  border-radius:12px;overflow:hidden;
  background:var(--dsw-alias-bg-elevated,transparent);}
[data-bg-row]{display:flex;align-items:center;gap:12px;padding:12px 14px;}
[data-bg-row]+[data-bg-row]{border-top:1px solid var(--dsw-alias-border-l,rgba(128,128,128,.12));}
[data-bg-grow]{flex:1;min-width:0;}
[data-bg-label]{font-size:13px;font-weight:500;}
[data-bg-note]{font-size:11.5px;line-height:1.55;color:var(--dsw-alias-label-tertiary,#9aa0a6);margin-top:2px;}

/* 分区标题 */
[data-bg-h]{font-size:11px;font-weight:600;letter-spacing:.05em;text-transform:uppercase;
  color:var(--dsw-alias-label-caption,#8b8b8b);margin-bottom:8px;}

/* 开关 */
[data-bg-sw]{flex:none;width:40px;height:23px;border-radius:12px;border:0;cursor:pointer;position:relative;
  background:var(--dsw-alias-fill-secondary,rgba(128,128,128,.3));transition:background .16s;padding:0;}
[data-bg-sw][data-on]{background:var(--dsw-alias-state-business-primary,#3b82f6);}
[data-bg-sw]::after{content:'';position:absolute;top:3px;left:3px;width:17px;height:17px;border-radius:9px;
  background:#fff;transition:transform .16s;}
[data-bg-sw][data-on]::after{transform:translateX(17px);}
[data-bg-sw][disabled]{opacity:.45;cursor:default;}

/* 数字输入 */
[data-bg-num]{width:88px;padding:6px 9px;border-radius:8px;font:inherit;font-size:13px;
  font-variant-numeric:tabular-nums;text-align:right;color:inherit;
  border:1px solid var(--dsw-alias-border-l,rgba(128,128,128,.28));
  background:var(--dsw-alias-bg-base,transparent);}
[data-bg-num]:focus{outline:2px solid var(--dsw-alias-state-business-primary,#3b82f6);outline-offset:-1px;}

/* 文本域 */
[data-bg-in]{width:100%;box-sizing:border-box;resize:vertical;min-height:86px;padding:11px 13px;border:0;
  font:inherit;font-size:13px;line-height:1.65;color:inherit;
  background:var(--dsw-alias-bg-base,transparent);}
[data-bg-in]:focus{outline:none;}

/* 按钮 */
[data-bg-btn]{padding:7px 15px;border-radius:8px;cursor:pointer;font:inherit;font-size:12.5px;font-weight:500;
  border:1px solid var(--dsw-alias-border-l,rgba(128,128,128,.28));
  background:var(--dsw-alias-interactive-bg-hover,rgba(128,128,128,.12));color:inherit;
  transition:background .12s;}
[data-bg-btn]:hover:not([disabled]){background:var(--dsw-alias-interactive-bg-selected,rgba(128,128,128,.2));}
[data-bg-btn][disabled]{opacity:.45;cursor:default;}
[data-bg-btn][data-primary]{background:var(--dsw-alias-state-business-primary,#3b82f6);
  border-color:transparent;color:#fff;}
[data-bg-btn][data-primary]:hover:not([disabled]){filter:brightness(1.08);}

/* 结果 */
[data-bg-out]{padding:12px 14px;white-space:pre-wrap;word-break:break-word;
  font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;
  font-size:11.5px;line-height:1.75;
  background:var(--dsw-alias-bg-base,rgba(128,128,128,.06));
  border-top:1px solid var(--dsw-alias-border-l,rgba(128,128,128,.12));}

/* 状态条 */
[data-bg-msg]{font-size:12px;padding:9px 13px;border-radius:8px;display:flex;gap:8px;align-items:flex-start;
  background:var(--dsw-alias-fill-secondary,rgba(128,128,128,.1));}
[data-bg-msg][data-err]{background:color-mix(in srgb,var(--dsw-alias-state-error-secondary,#dc2626) 12%,transparent);
  color:var(--dsw-alias-state-error-secondary,#dc2626);}
[data-bg-msg][data-ok]{background:color-mix(in srgb,var(--dsw-alias-state-business-primary,#3b82f6) 12%,transparent);
  color:var(--dsw-alias-state-business-tertiary,inherit);}

/* 脚注 */
[data-bg-foot]{font-size:11px;color:var(--dsw-alias-label-dimmed,#7a7a7a);
  font-family:ui-monospace,SFMono-Regular,Menlo,monospace;word-break:break-all;}

/* 加载 */
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
        'data-bg-sw': '',
        'data-on': props.on ? '' : undefined,
        'aria-checked': props.on ? 'true' : 'false',
        role: 'switch',
        'aria-label': props.label,
        disabled: props.disabled,
        onClick: props.onChange,
      })
    }

    function Panel() {
      const [st, setSt] = React.useState(null)
      const [view, setView] = React.useState(null)
      const [busy, setBusy] = React.useState('')
      const [msg, setMsg] = React.useState(null)
      const [text, setText] = React.useState(SAMPLE)
      const [out, setOut] = React.useState('')
      const [full, setFull] = React.useState(false)

      const load = React.useCallback(async () => {
        try {
          const s = await jget('/status')
          setSt(s)
          setView(s.config)
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

      const preview = async () => {
        setBusy('preview'); setMsg(null)
        try {
          const r = await jpost('/preview', { text, full })
          if (r.ok) setOut(r.text)
          else setMsg({ err: true, text: r.error || '没查出结果' })
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
          h('div', { 'data-bg-head': '' },
            h('div', { 'data-bg-title': '' }, '八股检测')),
          msg ? h('div', { 'data-bg-msg': '', 'data-err': msg.err ? '' : undefined }, msg.text) : null,
          h('div', { 'data-bg-skel': '' }),
          h('div', { 'data-bg-skel': '' }))
      }

      const on = view.enabled !== false

      return h('div', { 'data-bg': '' },

        // ── 头部 ─────────────────────────────
        h('div', { 'data-bg-head': '' },
          h('div', { 'data-bg-title': '' }, '八股检测'),
          h('div', { 'data-bg-sub': '' },
            '一句话换个人说还成不成立？成立，就是八股。只读不改写，给坐标不给成品。')),

        // ── 开关 ─────────────────────────────
        h('div', null,
          h('div', { 'data-bg-h': '' }, '开关'),
          h('div', { 'data-bg-card': '' },
            h(Row, {
              label: on ? '已开启' : '已关闭',
              note: on
                ? (st.promptActive ? '提示那一节挂上了，现在生效。' : '已开启，但提示那一节没挂上。')
                : '关掉后整节从系统提示里撤掉，两个工具还在。',
            }, h(Switch, { on, label: '总开关', disabled: busy === 'save', onChange: () => save({ enabled: !on }) })),

            h(Row, {
              label: view.prompt !== false ? '提示那一节：开' : '提示那一节：关',
              note: '关掉只留工具，不往提示里塞话。只想手动查的人用这个。',
            }, h(Switch, {
              on: view.prompt !== false, label: '提示节', disabled: busy === 'save' || !on,
              onChange: () => save({ prompt: view.prompt === false }),
            })))),

        // ── 阈值 ─────────────────────────────
        h('div', null,
          h('div', { 'data-bg-h': '' }, '阈值'),
          h('div', { 'data-bg-card': '' },
            h(Row, {
              label: '留白词下限',
              note: '每千字几个「好像 / 应该 / 大概」才算够。低于这个就报句句在下断言。',
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
              h('div', { 'data-bg-grow': '' },
                h('div', { 'data-bg-note': '' }, '恢复研究给出的默认值。')),
              h('button', {
                'data-bg-btn': '', disabled: busy === 'save',
                onClick: () => save({
                  hedgeFloor: st.defaults.hedgeFloor,
                  structureTimes: st.defaults.structureTimes,
                  concreteFloor: st.defaults.concreteFloor,
                }),
              }, '恢复默认')))),

        // ── 试一下 ───────────────────────────
        h('div', null,
          h('div', { 'data-bg-h': '' }, '试一下'),
          h('div', { 'data-bg-card': '' },
            h('textarea', {
              'data-bg-in': '', value: text, rows: 3,
              placeholder: '粘一段话，短句也行。',
              onChange: (e) => setText(e.target.value),
            }),
            h('div', { 'data-bg-row': '' },
              h('button', {
                'data-bg-btn': '', 'data-primary': '',
                disabled: busy === 'preview', onClick: preview,
              }, busy === 'preview' ? '查着…' : '查一下'),
              h('div', { 'data-bg-grow': '' },
                h('div', { 'data-bg-note': '' }, full ? '完整报告' : '三行摘要')),
              h(Switch, { on: full, label: '完整报告', disabled: false, onChange: () => setFull(!full) })),
            out ? h('div', { 'data-bg-out': '' }, out) : null)),

        // ── 状态 ─────────────────────────────
        msg ? h('div', {
          'data-bg-msg': '',
          'data-err': msg.err ? '' : undefined,
          'data-ok': msg.ok ? '' : undefined,
        }, msg.text) : null,

        // ── 脚注 ─────────────────────────────
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
