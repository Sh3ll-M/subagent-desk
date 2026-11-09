// Turns one tool call into a step in plain words, and picks the Clawd animation for it.
import type { Step } from '../types'

// Housekeeping calls that never show as steps.
const HIDDEN = new Set(['SubagentHandback', 'ToolSearch', 'TodoWrite', 'TaskCreate', 'TaskUpdate', 'TaskList', 'TaskGet'])

const oneLine = (t: string) => t.replace(/\s+/g, ' ').trim()
const cut = (t: string, n: number) => (t.length > n ? `${t.slice(0, n - 1)}…` : t)
/** The last part of a path, split on / and \ alike. */
const fileName = (p: string) => p.split(/[\\/]/).filter(Boolean).pop() ?? p
const words = (s: string) =>
  s
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map(w => w.toLowerCase())
const titleCase = (s: string) => words(s).map(w => w[0]!.toUpperCase() + w.slice(1)).join(' ')

/** A random id rather than a name: claude.ai connectors show one as their server. */
const isIdServer = (s: string) => /^[0-9a-f]{8}-[0-9a-f-]*$/i.test(s)

function connector(tool: string): Step {
  const [, server = '', ...rest] = tool.split('__')
  const toolName = rest.join('_')
  const name = isIdServer(server) ? 'Connector' : titleCase(server.replace(/^plugin_[^_]+_/, '').replace(/^claude_ai_/i, '')) || 'Connector'
  const w = words(toolName)
  if (w.length > 1 && w[0] === name.split(' ')[0]!.toLowerCase()) w.shift()
  const action = w.join(' ')
  return { label: `${name} · ${action}`, live: `${name}: ${action}`, anim: 'beacon' }
}

export function describe(tool: string, input: Record<string, unknown>): Step | null {
  if (HIDDEN.has(tool) || tool.startsWith('mcp__ccd_')) return null
  if (tool.startsWith('mcp__')) return connector(tool)
  const s = (k: string) => (typeof input[k] === 'string' ? oneLine(input[k] as string) : '')
  const file = (verb: string, key = 'file_path'): Step => {
    const name = fileName(s(key)) || 'a file'
    return { label: name, live: `${verb} ${name}`, anim: verb === 'Reading' ? 'debugger' : 'typing' }
  }
  switch (tool) {
    case 'Read':
      return file('Reading')
    case 'Write':
      return file('Writing')
    case 'Edit':
    case 'MultiEdit':
      return file('Editing')
    case 'NotebookEdit':
      return file('Editing', 'notebook_path')
    case 'Grep':
    case 'Glob': {
      const pat = cut(s('pattern'), 40)
      return { label: pat ? `Search "${pat}"` : 'Search files', live: pat ? `Searching for "${pat}"` : 'Searching files', anim: 'debugger' }
    }
    case 'Bash':
    case 'PowerShell': {
      const what = s('description') || cut(s('command'), 60) || 'a command'
      return { label: what, live: `Running: ${what}`, anim: 'building' }
    }
    case 'WebSearch':
      return { label: s('query') || 'web search', live: `Searching the web: ${cut(s('query'), 50)}`, anim: 'wizard' }
    case 'WebFetch': {
      let host = 'a web page'
      try {
        host = new URL(s('url')).host
      } catch {
        // Not a URL: keep the plain words.
      }
      return { label: host, live: `Opening ${host}`, anim: 'wizard' }
    }
    case 'Agent':
    case 'Task': {
      const d = s('description')
      return { label: d || 'Start a subagent', live: d ? `Starting a helper: ${d}` : 'Starting a helper', anim: 'conducting' }
    }
    case 'Skill':
      return { label: s('skill') || 'a skill', live: `Using the ${s('skill') || 'a'} skill`, anim: 'thinking' }
    default:
      return { label: tool, live: `Using ${tool}`, anim: 'thinking' }
  }
}

/** "claude-opus-5-5" reads "Opus 5.5"; "haiku" reads "Haiku". */
export function shortModel(model: string): string {
  const hit = /(opus|sonnet|haiku|fable)(?:[-_ ](\d+))?(?:[-_.](\d+))?/i.exec(model)
  if (!hit) return model
  const fam = hit[1]![0]!.toUpperCase() + hit[1]!.slice(1).toLowerCase()
  return hit[2] ? `${fam} ${hit[2]}${hit[3] && hit[3].length <= 2 ? `.${hit[3]}` : ''}` : fam
}
