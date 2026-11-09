// Each kind of job gets a short name that sticks: the reviewer is always Bob.

const NAMES = ['Bob', 'Pip', 'Zed', 'Moxy', 'Dot', 'Gus', 'Ivy', 'Kip', 'Lou', 'Mo', 'Nim', 'Oz', 'Peg', 'Quin', 'Rex', 'Sid', 'Tam', 'Uma', 'Vin', 'Wiz', 'Yuki', 'Zoe', 'Ace', 'Bea', 'Cyd', 'Dex', 'Eli', 'Fig', 'Gem', 'Hux', 'Ike', 'Jo', 'Kai', 'Lex', 'Max', 'Ned', 'Ola', 'Pax', 'Roo', 'Taz']

// Job words looked for in a general helper's task, first match wins.
const JOBS = ['review', 'research', 'test', 'fix', 'build', 'write', 'search', 'plan', 'design', 'debug', 'explore', 'summar', 'refactor', 'docs']
const GENERAL = new Set(['general-purpose', 'fork', 'claude', ''])

/** What kind of job this is: the agent type, or for a general helper the main job word in its task. */
export function jobKey(type: string, description: string): string {
  const t = type.trim().toLowerCase()
  if (!GENERAL.has(t)) return t
  const d = description.toLowerCase()
  const hit = JOBS.find(j => d.includes(j))
  return hit ?? (t || 'subagent')
}

function hash(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619)
  return h >>> 0
}

/** Saved names per job: the first agent of a job gets the first, a second one running alongside it the second. */
export type Taken = Record<string, string[]>

/** Reads what the store holds; the first version kept one string per job. */
export function normalise(raw: unknown): Taken {
  const out: Taken = {}
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof v === 'string') out[k] = [v]
    else if (Array.isArray(v)) out[k] = v.filter((x): x is string => typeof x === 'string')
  }
  return out
}

/**
 * The name for the `n`th agent of a job running at once: the one it had before, else a free one
 * picked from the job's own hash and kept. Returns the updated table to save.
 */
export function pickName(key: string, raw: Taken | Record<string, string>, n: number): { name: string; taken: Taken } {
  const taken = normalise(raw)
  const list = taken[key] ?? []
  if (list[n]) return { name: list[n]!, taken }
  const used = new Set(Object.values(taken).flat())
  let name = ''
  if (key === 'review' && !used.has('Bob')) name = 'Bob'
  else {
    // Bob is kept for the reviewer.
    const pool = NAMES.filter(x => x !== 'Bob')
    const start = hash(`${key}#${list.length}`) % pool.length
    name = pool[start]!
    for (let i = 0; i < pool.length; i++) {
      const c = pool[(start + i) % pool.length]!
      if (!used.has(c)) {
        name = c
        break
      }
    }
  }
  return { name, taken: { ...taken, [key]: [...list, name] } }
}
