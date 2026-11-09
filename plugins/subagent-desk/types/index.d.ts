/** A Clawd animation; the same union as hooks/clawd.ts's Anim. */
export type Anim = 'debugger' | 'typing' | 'building' | 'wizard' | 'conducting' | 'beacon' | 'thinking' | 'happy' | 'idle' | 'dizzy' | 'confused'

export type Phase = 'working' | 'done' | 'failed'

/** One tool call of a subagent, in plain words, with the Clawd animation it plays. */
export type Step = { label: string; live: string; anim: Anim }

export type Agent = {
  id: string
  description: string
  type: string
  /** Short model name, "Opus 5.5"; empty until known. */
  model: string
  phase: Phase
  startedAt: number
  endedAt: number
  /** Tool calls made in all. */
  count: number
  /** The last 20 steps, oldest first. */
  steps: Step[]
  tokens: number
  /** Tokens the live turn has counted step by step; the turn's own total replaces them at its end. */
  turnTokens: number
  /** The crab's name, "Bob". */
  name: string
  /** Index into HUES. */
  hue: number
  round: number
}

export type Desk = { agents: Agent[]; round: number }

declare module 'claude-code' {
  interface PluginState {
    'subagent-desk': { desk: Shaped<Desk>; tick: number }
  }
}
