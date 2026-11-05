/**
 * dsh-bagu —— 浏览器半端：设置页里的一页（「八股检测」）
 *
 * 约定（抄 dsh-fish-tone 的写法）：
 *   1. client bundle 不是 ESM，是自注册脚本：window.__ModuleLoader__.load({ id, factory })
 *   2. 进「设置」靠 slots.inject('settings.section', ...)
 *   3. 宿主那边开 /api/bagu，这一页只做 fetch
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

    const SAMPLE = '本次修改已完成。首先调整了章节结构，其次新增了规则条款，最后优化了可读性。综上所述，这次改动具有重要意义，希望对你有帮助。'

    const CSS = `
[data-bg-page]{display:flex;flex-direction:column;gap:18px;padding:2px 2px 8px;max-width:640px;}
[data-bg-sec]{display:flex;flex-direction:column;gap:8px;}
[data-bg-h]{font-size:11px;font-weight:600;letter-spacing:.04em;color:var(--dsw-alias-label-tertiary,#9aa0a6);}
[data-bg-row]{display:flex;align-items:center;gap:10px;}
[data-bg-grow]{flex:1;min-width:0;}
[data-bg-note]{font-size:11px;line-height:16px;color:var(--dsw-alias-label-tertiary,#9aa0a6);}
[data-bg-note][data-warn]{color:#d97706;}
[data-bg-sw]{flex:none;width:38px;height:22px;border-radius:11px;border:0;cursor:pointer;position:relative;
  background:var(--dsw-alias-interactive-bg-hover,rgba(128,128,128,.35));transition:background .15s;padding:0;}
[data-bg-sw][data-on]{background:#3b82f6;}
[data-bg-sw]::after{content:'';position:absolute;top:3px;left:3px;width:16px;height:16px;border-radius:8px;
  background:#fff;transition:transform .15s;}
[data-bg-sw][data-on]::after{transform:translateX(16px);}
[data-bg-num]{width:96px;padding:6px 10px;border-radius:8px;font:inherit;font-size:13px;color:inherit;
  border:1px solid var(--dsw-alias-border-default,rgba(128,128,128,.28));
  background:var(--dsw-alias-bg-base,transparent);}
[data-bg-in]{width:100%;box-sizing:border-box;resize:vertical;min-height:90px;padding:10px 12px;
  border-radius:10px;font:inherit;font-size:13px;line-height:20px;color:inherit;
  border:1px solid var(--dsw-alias-border-default,rgba(128,128,128,.28));
  background:var(--dsw-alias-bg-base,transparent);}
[data-bg-btn]{padding:7px 14px;border-radius:8px;cursor:pointer;font:inherit;font-size:13px;
  border:1px solid var(--dsw-alias-border-default,rgba(128,128,128,.28));
  background:var(--dsw-alias-interactive-bg-hover,rgba(128,128,128,.14));color:inherit;}
[data-bg-btn][disabled]{opacity:.5;cursor:default;}
[data-bg-out]{padding:12px 14px;border-radius:10px;font-size:12px;line-height:20px;white-space:pre-wrap;
  font-family:ui-monospace,SFMono-Regular,Menlo,monospace;
  background:var(--dsw-alias-bg-hover,rgba(128,128,128,.10));}
[data-bg-meta]{font-size:11px;color:var(--dsw-alias-label-tertiary,#9aa0a6);}
@media (prefers-color-scheme:dark){[data-bg-sw][data-on]{background:#2563eb;}}
`

    function Panel() {
      const [st, setSt] = React.useState(null)
      const [view, setView] = React.useState(null)
      const [busy, setBusy] = React.useState('')
      const [msg, setMsg] = React.useState('')
      const [bad, setBad] = React.useState(false)
      const [text, setText] = React.useState(SAMPLE)
      const [out, setOut] = React.useState('')

      const load = React.useCallback(async () => {
        try {
          const s = await jget('/status')
          setSt(s)
          setView(s.config)
        } catch (e) {
          setBad(true)
          setMsg('读不到配置：' + (e && e.message ? e.message : String(e)))
        }
      }, [])

      React.useEffect(() => { load() }, [load])

      const save = async (patch) => {
        setBusy('save')
        setMsg('')
        setBad(false)
        try {
          const r = await jpost('/config', patch)
          setView(r.config)
          setSt((old) => (old ? { ...old, config: r.config, promptActive: r.config.enabled && r.config.prompt } : old))
          setMsg('已保存，立刻生效。')
        } catch (e) {
          setBad(true)
          setMsg('保存失败：' + (e && e.message ? e.message : String(e)))
        } finally {
          setBusy('')
        }
      }

      const preview = async () => {
        setBusy('preview')
        setMsg('')
        setBad(false)
        try {
          const r = await jpost('/preview', { text })
          if (r.ok) setOut(r.text)
          else { setBad(true); setMsg(r.error || '没查出结果') }
        } catch (e) {
          setBad(true)
          setMsg('查不了：' + (e && e.message ? e.message : String(e)))
        } finally {
          setBusy('')
        }
      }

      if (!view) {
        return h('div', { 'data-bg-page': '' },
          h('div', { 'data-bg-note': '' }, msg || '正在读配置……'))
      }

      const on = view.enabled !== false

      return h('div', { 'data-bg-page': '' },
        h('div', { 'data-bg-sec': '' },
          h('div', { 'data-bg-h': '' }, '八股检测'),
          h('div', { 'data-bg-note': '' },
            '给一段话数几样东西：具体物、撑场面的话、留白词、结构腔密度。只读不改写，给坐标不给成品。')),

        h('div', { 'data-bg-sec': '' },
          h('div', { 'data-bg-row': '' },
            h('button', {
              'data-bg-sw': '',
              'data-on': on ? '' : undefined,
              'aria-label': on ? '关闭八股检测' : '打开八股检测',
              disabled: busy === 'save',
              onClick: () => save({ enabled: !on }),
            }),
            h('div', { 'data-bg-grow': '' },
              h('div', { style: { fontSize: '13px' } }, on ? '已开启' : '已关闭'),
              h('div', { 'data-bg-note': '' },
                on
                  ? (st && st.promptActive
                    ? '「说话的念头」那一节已经挂进系统提示，现在生效。'
                    : '已开启，但那一节没挂上（关了 prompt 开关，或重载后生效）。')
                  : '关掉以后整节从系统提示里撤掉，两个工具还在，只是不再往提示里塞话。')))),

        h('div', { 'data-bg-sec': '' },
          h('div', { 'data-bg-row': '' },
            h('button', {
              'data-bg-sw': '',
              'data-on': view.prompt !== false ? '' : undefined,
              disabled: busy === 'save',
              'aria-label': '开关系统提示那一节',
              onClick: () => save({ prompt: view.prompt === false }),
            }),
            h('div', { 'data-bg-grow': '' },
              h('div', { style: { fontSize: '13px' } },
                view.prompt !== false ? '系统提示那一节：开' : '系统提示那一节：关'),
              h('div', { 'data-bg-note': '' },
                '关掉只留工具，不往提示里塞「说话的念头」。有些人只想手动查，不想被改说话习惯。')))),

        h('div', { 'data-bg-sec': '' },
          h('div', { 'data-bg-h': '' }, '阈值'),
          h('div', { 'data-bg-row': '' },
            h('div', { 'data-bg-grow': '' },
              h('div', { style: { fontSize: '13px' } }, '留白词下限'),
              h('div', { 'data-bg-note': '' }, '每千字有几个「好像 / 应该 / 大概」才算够。低于这个就报「句句在下断言」。')),
            h('input', {
              'data-bg-num': '', type: 'number', step: '0.1', min: '0',
              value: view.hedgeFloor,
              disabled: busy === 'save',
              onChange: (e) => setView({ ...view, hedgeFloor: e.target.value === '' ? '' : Number(e.target.value) }),
              onBlur: () => { if (view.hedgeFloor !== st.config.hedgeFloor) save({ hedgeFloor: view.hedgeFloor }) },
            })),

          h('div', { 'data-bg-row': '' },
            h('div', { 'data-bg-grow': '' },
              h('div', { style: { fontSize: '13px' } }, '结构腔报警倍数'),
              h('div', { 'data-bg-note': '' }, '密度超过同文体基线的几倍才报。调大更宽容，调小更敏感。')),
            h('input', {
              'data-bg-num': '', type: 'number', step: '0.5', min: '1',
              value: view.structureTimes,
              disabled: busy === 'save',
              onChange: (e) => setView({ ...view, structureTimes: e.target.value === '' ? '' : Number(e.target.value) }),
              onBlur: () => { if (view.structureTimes !== st.config.structureTimes) save({ structureTimes: view.structureTimes }) },
            })),

          h('div', { 'data-bg-row': '' },
            h('div', { 'data-bg-grow': '' },
              h('div', { style: { fontSize: '13px' } }, '具体物下限'),
              h('div', { 'data-bg-note': '' }, '每百字至少几个数字、时间、经历、原话、名字。低于这个就报「这段话你看见的，还是听说的」。')),
            h('input', {
              'data-bg-num': '', type: 'number', step: '0.1', min: '0',
              value: view.concreteFloor,
              disabled: busy === 'save',
              onChange: (e) => setView({ ...view, concreteFloor: e.target.value === '' ? '' : Number(e.target.value) }),
              onBlur: () => { if (view.concreteFloor !== st.config.concreteFloor) save({ concreteFloor: view.concreteFloor }) },
            })),

          h('div', { 'data-bg-row': '' },
            h('button', {
              'data-bg-btn': '',
              disabled: busy === 'save',
              onClick: () => save({
                hedgeFloor: st.defaults.hedgeFloor,
                structureTimes: st.defaults.structureTimes,
                concreteFloor: st.defaults.concreteFloor,
              }),
            }, '恢复默认'))),

        h('div', { 'data-bg-sec': '' },
          h('div', { 'data-bg-h': '' }, '试一下'),
          h('textarea', {
            'data-bg-in': '',
            value: text,
            onChange: (e) => setText(e.target.value),
            rows: 4,
          }),
          h('div', { 'data-bg-row': '' },
            h('button', { 'data-bg-btn': '', disabled: busy === 'preview', onClick: preview },
              busy === 'preview' ? '查着……' : '查一下'),
            h('div', { 'data-bg-grow': '' }),
            h('div', { 'data-bg-meta': '' }, '这段是他验自己用的，不会发出去'))),

        out ? h('div', { 'data-bg-out': '' }, out) : null,

        msg ? h('div', { 'data-bg-note': '', 'data-warn': bad ? '' : undefined }, msg) : null,
        h('div', { 'data-bg-note': '' },
          '改完立刻生效，不用重启。配置存在 ' + String((st && st.configFile) || 'config.json'))
      )
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
        // 宿主不保证 slots 上有 inject：拿到的可能是个空壳，先探一下再用
        if (!slots || typeof slots.inject !== 'function' || typeof slots.register !== 'function') return
        slots.inject('settings.section', () => slots.register(
          { name: 'settings.section', id: 'bagu', order: 35, label: '八股检测' },
          () => h(Panel),
        ))
      },
    }
  },
})
