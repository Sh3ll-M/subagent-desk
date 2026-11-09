// The desk's list of subagents. Pure functions: each returns a new Desk.
import type { Agent, Desk, Phase, Step } from '../types'

/** Card colours, easy to tell apart on light and dark. */
export const HUES: readonly string[] = ['#dc2626', '#ea580c', '#eab308', '#16a34a', '#0d9488', '#2563eb', '#9333ea', '#db2777']
const MAX_STEPS = 20

const working = (d: Desk) => d.agents.filter(a => a.phase === 'working')

function freeHue(d: Desk): number {
  const used = new Set(working(d).map(a => a.hue))
  for (let h = 0; h < HUES.length; h++) if (!used.has(h)) return h
  return d.agents.length % HUES.length
}

const patch = (d: Desk, id: string, fn: (a: Agent) => Agent): Desk => ({ ...d, agents: d.agents.map(a => (a.id === id ? fn(a) : a)) })

/** Adds a subagent. A spawn while none are running starts a new round and clears the last round's cards. */
export function addAgent(d: Desk, a: { id: string; description: string; type: string; model: string; name: string; now: number }): Desk {
  if (d.agents.some(x => x.id === a.id)) return d
  const fresh = working(d).length === 0
  const round = fresh ? d.round + 1 : d.round
  const kept = fresh ? [] : d.agents
  const base: Desk = { agents: kept, round }
  const agent: Agent = {
    id: a.id,
    description: a.description || 'Subagent',
    type: a.type || 'subagent',
    model: a.model,
    phase: 'working',
    startedAt: a.now,
    endedAt: 0,
    count: 0,
    steps: [],
    tokens: 0,
    turnTokens: 0,
    name: a.name,
    hue: freeHue(base),
    round,
  }
  return { agents: [...kept, agent], round }
}

export function addStep(d: Desk, id: string, step: Step, _now: number): Desk {
  return patch(d, id, a => ({ ...a, count: a.count + 1, steps: [...a.steps, step].slice(-MAX_STEPS), phase: 'working', endedAt: 0 }))
}

export function addTokens(d: Desk, id: string, n: number): Desk {
  return n > 0 ? patch(d, id, a => ({ ...a, tokens: a.tokens + n, turnTokens: a.turnTokens + n })) : d
}

/** A turn ended with its own token total: it replaces what the steps counted. */
export function endTurn(d: Desk, id: string, turnTotal: number): Desk {
  return turnTotal > 0 ? patch(d, id, a => ({ ...a, tokens: Math.max(0, a.tokens - a.turnTokens) + turnTotal, turnTokens: 0 })) : patch(d, id, a => ({ ...a, turnTokens: 0 }))
}

export function setModel(d: Desk, id: string, model: string): Desk {
  return model ? patch(d, id, a => (a.model === model ? a : { ...a, model })) : d
}

export function finish(d: Desk, id: string, phase: Exclude<Phase, 'working'>, now: number): Desk {
  return patch(d, id, a => (a.phase === 'working' ? { ...a, phase, endedAt: now } : a))
}

/** Removes every card that is not running. */
export function clearFinished(d: Desk): Desk {
  return { ...d, agents: working(d) }
}
