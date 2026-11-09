// Subagent Desk: a side pane with one live Clawd card per subagent.
// It only watches: every tool call passes on unchanged, and nothing is added to Claude's prompt.
import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Agent, Desk } from '../types'
import { HUES, addAgent, addStep, addTokens, clearFinished, endTurn, finish, setModel } from './agents'
import { clawdSvg } from './clawd'
import type { Anim } from './clawd'
import { describe, shortModel } from './describe'
import { jobKey, normalise, pickName } from './names'

const PANE = 'subagent-desk'
const TITLE = 'Subagent Desk'
const TICK_MS = 1000
const POLL_MS = 2000
const HAPPY_MS = 4000
// The Clawd drawings leave room round the crab for its props, so it is drawn large.
const CLAWD_PX = 88
const LEFT_COLS = 13
// Columns the docked pane asks for.
const PANE_COLS = 56
const BAR_H = 4
const GOOD = '#16a34a'
const BAD = '#dc2626'
const ACCENT = '#d97757'

const EMPTY: Desk = { agents: [], round: 0 }
const desk = atom({ plugin: 'subagent-desk', key: 'desk' } as const, EMPTY, { shape: 'desk-2' })
const tick = atom({ plugin: 'subagent-desk', key: 'tick' } as const, 0)

// Module variables reset on a reload; the cards themselves live in $.state.
let ticker: { cancel: () => void } | null = null
let poller: { cancel: () => void } | null = null
// Ids the engine runs but $.agent.list() does not name (its own forks): left out.
const strangers = new Set<string>()
// Working cards the list stopped naming, and for how many polls in a row.
const missing = new Map<string, number>()
// Name picks run one at a time, so agents started together don't overwrite each other's names.
let naming: Promise<unknown> = Promise.resolve()

type Usage = { input_tokens?: number; output_tokens?: number; cache_read_input_tokens?: number; cache_creation_input_tokens?: number }
const total = (u: Usage | null | undefined) =>
  u ? (u.input_tokens ?? 0) + (u.output_tokens ?? 0) + (u.cache_read_input_tokens ?? 0) + (u.cache_creation_input_tokens ?? 0) : 0

const anyWorking = (d: Desk) => d.agents.some(a => a.phase === 'working')

function nameFor($: EngineInterface, type: string, description: string): Promise<string> {
  const run = naming.then(() => pickAndSave($, type, description))
  naming = run.catch(() => undefined)
  return run
}

async function pickAndSave($: EngineInterface, type: string, description: string): Promise<string> {
  const key = jobKey(type, description)
  let saved: unknown = {}
  try {
    saved = await $.store.get('names')
  } catch {
    // No store: names still pick the same way from the job.
  }
  // How many agents of this job are already running: the nth one gets the job's nth name.
  const n = (await read($, desk)).agents.filter(a => a.phase === 'working' && jobKey(a.type, a.description) === key).length
  const { name, taken } = pickName(key, normalise(saved), n)
  if (JSON.stringify(taken) !== JSON.stringify(normalise(saved))) await $.store.set('names', taken).catch(() => undefined)
  return name
}

function syncTimers($: EngineInterface, d: Desk) {
  if (anyWorking(d)) {
    ticker ??= $.clock.every(TICK_MS, () => {
      void update($, tick, n => n + 1).catch(() => undefined)
    })
    poller ??= $.clock.every(POLL_MS, () => {
      void poll($).catch(() => undefined)
    })
  } else {
    ticker?.cancel()
    poller?.cancel()
    ticker = null
    poller = null
  }
}

async function change($: EngineInterface, fn: (d: Desk) => Desk) {
  let next = EMPTY
  await update($, desk, d => (next = fn(d)))
  syncTimers($, next)
  return next
}

async function openPane($: EngineInterface, asked: boolean) {
  const r = await $.ui.open({ id: PANE, title: TITLE, columns: PANE_COLS })
  if (!asked && !r.isPlaced) {
    try {
      $.ui.toast('Subagents started: type /desk to watch them')
    } catch {
      // A toast is only a hint.
    }
  }
}

// The agent list catches ends the events missed.
async function poll($: EngineInterface) {
  const list = await $.agent.list()
  const now = await $.clock.now()
  const listed = new Set(list.map(a => a.id))
  await change($, d => {
    let out = d
    for (const a of list) {
      const done = a.status === 'completed' || a.status === 'idle'
      const failed = a.status === 'failed' || a.status === 'killed'
      if (done || failed) out = finish(out, a.id, failed ? 'failed' : 'done', now)
    }
    // A working card the list has stopped naming for two polls ended without us hearing: finish it.
    for (const a of d.agents) {
      if (a.phase !== 'working' || listed.has(a.id)) {
        missing.delete(a.id)
        continue
      }
      const n = (missing.get(a.id) ?? 0) + 1
      missing.set(a.id, n)
      if (n >= 2) {
        missing.delete(a.id)
        out = finish(out, a.id, 'done', now)
      }
    }
    return out
  })
}

// A subagent whose spawn this module never saw (a reload mid-run): take it from the list.
async function adopt($: EngineInterface, id: string) {
  // The desk first: a spawn that landed after an early call has cleared the id.
  if ((await read($, desk)).agents.some(a => a.id === id)) return true
  if (strangers.has(id)) return false
  const a = (await $.agent.list()).find(x => x.id === id)
  if (!a) {
    strangers.add(id)
    return false
  }
  const name = await nameFor($, a.type, a.description)
  const now = await $.clock.now()
  await change($, d => addAgent(d, { id, description: a.description, type: a.type, model: '', name, now }))
  return true
}

/** The animation a card plays now. */
function animOf(a: Agent, now: number): Anim {
  if (a.phase === 'failed') return 'dizzy'
  if (a.phase === 'done') return now - a.endedAt < HAPPY_MS ? 'happy' : 'idle'
  return a.steps[a.steps.length - 1]?.anim ?? 'thinking'
}

const mmss = (ms: number) => {
  const s = Math.max(0, Math.floor(ms / 1000))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = String(s % 60).padStart(2, '0')
  return h ? `${h}:${String(m).padStart(2, '0')}:${sec}` : `${m}:${sec}`
}
const tokenText = (n: number) => (n < 1000 ? String(n) : n < 1_000_000 ? `${Math.round(n / 1000)}k` : `${(n / 1_000_000).toFixed(1)}M`)
const cut = (t: string, n: number) => (n <= 0 ? '' : t.length > n ? `${t.slice(0, Math.max(0, n - 1))}…` : t)

/** A thin bar in the card colour: a sweep while working, full when over. */
function barSvg(phase: Agent['phase'], color: string, w: number, seat: number) {
  const fill = phase === 'failed' ? BAD : color
  const piece = Math.max(30, Math.round(w * 0.3))
  const body =
    phase === 'working'
      ? `<rect class="mv" width="${piece}" height="${BAR_H}" rx="${BAR_H / 2}" fill="${fill}"/>`
      : `<rect width="${w}" height="${BAR_H}" rx="${BAR_H / 2}" fill="${fill}"/>`
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${BAR_H}" viewBox="0 0 ${w} ${BAR_H}"><style>.mv{animation:mv${seat} 1.6s ease-in-out infinite}@keyframes mv${seat}{from{transform:translateX(-${piece}px)}to{transform:translateX(${w}px)}}@media (prefers-reduced-motion: reduce){.mv{animation:none}}</style><rect width="${w}" height="${BAR_H}" rx="${BAR_H / 2}" fill="${fill}" opacity=".18"/>${body}</svg>`
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    try {
      await $.command.register({ name: 'desk', description: 'Open the Subagent Desk: one live card per subagent', immediate: true })
    } catch {
      // The pane still opens by itself when subagents start.
    }
    syncTimers($, await read($, desk).catch(() => EMPTY))
    return next(e)
  })

  on('command.run', { command: 'desk' }, async $ => {
    await openPane($, true)
    return { text: 'Subagent Desk opened.' }
  })

  on('agent.spawn', async ($, e, next) => {
    const r = await next(e)
    const id = (r as { agentId?: string }).agentId
    if (!id) return r
    try {
      const before = await read($, desk)
      const name = await nameFor($, e.subagentType, e.description)
      const now = await $.clock.now()
      const model = shortModel(String(e.model ?? (r as { model?: string }).model ?? ''))
      await change($, d => addAgent(d, { id, description: e.description, type: e.subagentType, model, name, now }))
      strangers.delete(id)
      if (!anyWorking(before)) await openPane($, false)
    } catch {
      // The card is a view: a failure here never stops the spawn.
    }
    return r
  })

  // Watch only: the call always runs as it came.
  on('tool.call', async ($, e, next) => {
    const id = e.agentId
    if (id) {
      const step = describe(e.tool as string, e as unknown as Record<string, unknown>)
      if (step) {
        void (async () => {
          if (!(await adopt($, id))) return
          const now = await $.clock.now()
          await change($, d => addStep(d, id, step, now))
        })().catch(() => undefined)
      }
    }
    return next(e)
  })

  // Each model request of a subagent: its model and tokens, live.
  on('turn.step', async function* ($, e, next) {
    const r = yield* next(e)
    const id = e.agentId
    if (id) {
      const n = total(r.usage as Usage | undefined)
      void change($, d => addTokens(setModel(d, id, shortModel(e.model)), id, n)).catch(() => undefined)
    }
    return r
  })

  on('turn.complete', async ($, e, next) => {
    const r = await next(e)
    const id = e.agentId
    if (id) {
      try {
        // The turn's own total replaces the steps counted so far (kept in $.state, so a reload can't double it).
        const turnTotal = total(e.usage as Usage | undefined)
        const failed = e.reason === 'error' || e.reason === 'refusal' || e.isAborted
        const now = await $.clock.now()
        await change($, d => finish(endTurn(setModel(d, id, shortModel(e.usage?.model ?? '')), id, turnTotal), id, failed ? 'failed' : 'done', now))
      } catch {
        // The card stays as it was.
      }
    }
    return r
  })

  on('ui.press', { plugin: 'subagent-desk', element: 'clear' }, async ($, e) => {
    await change($, clearFinished)
    return { element: e.element }
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const els = $.ui.resolve(e)
    const { Box, Text, Button } = els
    const Svg = e.surface !== 'terminal' && 'Svg' in els ? els.Svg : null
    const d = await read($, desk)
    await read($, tick)
    const now = await $.clock.now()
    const width = Math.max(32, e.props.bodyColumns)
    const cw = width - 4 - LEFT_COLS

    const running = d.agents.filter(a => a.phase === 'working')
    const finished = d.agents.filter(a => a.phase === 'done')
    const stopped = d.agents.filter(a => a.phase === 'failed')

    let limits: string[] = []
    try {
      const u = await $.session.usage()
      limits = u.rateLimits
        .filter(l => l.kind === 'five_hour' || l.kind === 'seven_day')
        .map(l => `${l.kind === 'five_hour' ? '5h' : 'week'} ${Math.round(l.percentUsed)}%`)
    } catch {
      // No reading: the tile stays out.
    }

    const tokensAll = d.agents.reduce((n, a) => n + a.tokens, 0)
    const start = d.agents.length ? Math.min(...d.agents.map(a => a.startedAt)) : now
    const end = running.length ? now : Math.max(start, ...d.agents.map(a => a.endedAt))
    const tiles: { label: string; value: string }[] = d.agents.length
      ? [
          { label: 'Time', value: mmss(end - start) },
          { label: 'Tokens', value: tokenText(tokensAll) },
        ]
      : []
    if (limits.length) tiles.push({ label: 'Pro usage', value: limits.join(' · ') })
    const tileW = tiles.length ? Math.floor((width - (tiles.length - 1)) / tiles.length) : width

    const crab = (a: Agent) => {
      const color = HUES[a.hue % HUES.length]!
      const art = Svg ? (
        <Svg source={clawdSvg(animOf(a, now), color, CLAWD_PX)} alt={`Clawd ${a.name}`} width={CLAWD_PX} height={CLAWD_PX} />
      ) : (
        <Box flexDirection="column">
          <Text color={color}>{a.phase === 'failed' ? ' x_x' : a.phase === 'done' ? ' ^_^' : now % 2000 < 1000 ? ' ▟█▙' : ' ▜█▛'}</Text>
          <Text color={color}>{'  ▘▝'}</Text>
        </Box>
      )
      return (
        <Box key={`crab-${a.id}`} flexDirection="column" alignItems="center" width={LEFT_COLS} flexShrink={0}>
          {art}
          <Text bold color={color} wrap="truncate-end">
            {a.name}
          </Text>
        </Box>
      )
    }

    const card = (a: Agent) => {
      const color = HUES[a.hue % HUES.length]!
      const live = a.phase === 'working'
      const mark = live ? '●' : a.phase === 'done' ? '✓' : '✗'
      const markColor = a.phase === 'failed' ? BAD : live ? color : GOOD
      const time = mmss((live ? now : a.endedAt) - a.startedAt)
      const meta = `${tokenText(a.tokens)} tokens · ${time}`
      const who = [a.type, a.model].filter(Boolean).join(' · ')
      const current = a.steps[a.steps.length - 1]
      const plural = a.count === 1 ? '' : 's'
      const lead = live ? `Step ${a.count} · ${current?.live ?? 'Getting started'}` : a.phase === 'done' ? `Done · ${a.count} step${plural}` : `Stopped · ${a.count} step${plural}`
      const history = (live ? a.steps.slice(0, -1) : a.steps).slice(-2)
      const barPx = Math.max(60, Math.floor(cw * 6.5))
      return (
        <Box key={`card-${a.id}`} flexDirection="row" width={width} marginBottom={1} borderStyle="round" borderColor={live ? color : undefined} borderDimColor={!live} paddingX={1} paddingY={1}>
          {crab(a)}
          <Box flexDirection="column" width={cw}>
            <Box flexDirection="row" justifyContent="space-between" width={cw}>
              <Box width={cw - 2}>
                <Text bold wrap="truncate-end">
                  {cut(a.description, cw - 2)}
                </Text>
              </Box>
              <Text bold color={markColor}>
                {mark}
              </Text>
            </Box>
            <Box flexDirection="row" justifyContent="space-between" width={cw}>
              <Text dimColor wrap="truncate-end">
                {cut(who, Math.max(4, cw - meta.length - 1))}
              </Text>
              <Text dimColor>{meta}</Text>
            </Box>
            <Box marginTop={1} width={cw}>
              <Text bold={live} color={live ? ACCENT : a.phase === 'done' ? GOOD : BAD} wrap="truncate-end">
                {cut(lead, cw)}
              </Text>
            </Box>
            {history.map((st, i) => (
              <Text key={`h-${a.id}-${i}`} dimColor wrap="truncate-end">
                {cut(`  ${st.live}`, cw)}
              </Text>
            ))}
            <Box key={`bar-${a.id}`} width={cw} marginTop={1}>
              {Svg ? (
                <Svg source={barSvg(a.phase, color, barPx, a.hue)} alt={live ? 'Working' : a.phase === 'done' ? 'Done' : 'Stopped'} width={barPx} height={BAR_H} />
              ) : (
                <Text color={a.phase === 'failed' ? BAD : color}>{'━'.repeat(Math.max(4, cw))}</Text>
              )}
            </Box>
          </Box>
        </Box>
      )
    }

    const group = (id: string, title: string, members: Agent[], fill: string) =>
      members.length ? (
        <Box key={`grp-${id}`} flexDirection="column" width={width} marginTop={1}>
          <Box key={`head-${id}`} width={width} backgroundColor={fill} paddingX={1} marginBottom={1}>
            <Text bold color="#ffffff" backgroundColor={fill}>
              {`${title} · ${members.length}`.padEnd(Math.max(1, width - 2))}
            </Text>
          </Box>
          {[...members].reverse().map(card)}
        </Box>
      ) : null

    const headline = d.agents.length ? `${d.agents.length} subagent${d.agents.length === 1 ? '' : 's'}${running.length ? ` · ${running.length} running` : ''}` : 'No subagents yet'
    return (
      <Box flexDirection="column" width={width}>
        <Box key="header" flexDirection="row" justifyContent="space-between" width={width} marginBottom={1}>
          <Text bold color={running.length ? ACCENT : undefined}>
            {headline}
          </Text>
          {finished.length + stopped.length ? <Button key="clear" label="Clear" dimColor onPress={() => undefined} /> : null}
        </Box>
        {tiles.length ? (
          <Box key="tiles" flexDirection="row" gap={1} width={width} marginBottom={1}>
            {tiles.map(t => (
              <Box key={`tile-${t.label}`} flexDirection="column" borderStyle="round" paddingX={1} width={tileW}>
                <Text dimColor wrap="truncate-end">
                  {t.label}
                </Text>
                <Text bold color={ACCENT} wrap="truncate-end">
                  {t.value}
                </Text>
              </Box>
            ))}
          </Box>
        ) : null}
        {d.agents.length ? null : <Text dimColor>Cards show up here when Claude starts a subagent.</Text>}
        {group('running', 'Running', running, GOOD)}
        {group('finished', 'Finished', finished, '#ca8a04')}
        {group('stopped', 'Stopped', stopped, BAD)}
      </Box>
    )
  })
}
