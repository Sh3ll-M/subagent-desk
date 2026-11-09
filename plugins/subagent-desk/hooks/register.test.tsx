import { expect, mock, test } from 'claude-code/testing'

type On = Parameters<NonNullable<Parameters<typeof test>[2]>>[1]
type Agent = { id: string; description: string; type: string; status: string }

/** Mocks every $ call the mod makes. */
function rig(on: On, opts: { limits?: { kind: string; percentUsed: number }[]; listed?: Agent[] } = {}) {
  const ids = ['agent-a1', 'agent-a2', 'agent-a3']
  const agents: Agent[] = [...(opts.listed ?? [])]
  const opened: string[] = []
  const toasts: string[] = []
  const store: Record<string, unknown> = {}
  let ran = 0
  on('session.start', async ($, e) => ({ cwd: e.cwd }) as never)
  on('command.register', async () => ({ value: undefined }) as never)
  const clock = mock.clock(on, { now: 1_000_000 })
  on('agent.spawn', async ($, e) => {
    const { description, subagentType } = e as { description: string; subagentType: string }
    const id = ids[agents.length]!
    agents.push({ id, description, type: subagentType, status: 'running' })
    return { model: 'claude-opus-5-5', agentId: id } as never
  })
  on('agent.list', async () => ({ value: agents.map(a => ({ ...a })) }) as never)
  const openArgs: { columns?: number }[] = []
  on('ui.open', async ($, e) => {
    opened.push((e as { id: string }).id)
    openArgs.push(e as { columns?: number })
    return { value: { isPlaced: true } } as never
  })
  on('ui.toast', async ($, e) => {
    toasts.push((e as { text: string }).text)
    return { value: undefined } as never
  })
  on('store.get', async ($, e) => ({ value: store[(e as { key: string }).key] }) as never)
  on('store.set', async ($, e) => {
    const { key, value } = e as { key: string; value: unknown }
    store[key] = value
    return { value: undefined } as never
  })
  on('session.usage', async () => ({ value: { startedAt: 0, context: {}, rateLimits: opts.limits ?? [] } }) as never)
  on('process.run', async () => {
    ran += 1
    throw new Error('the mod must not run processes')
  })
  on('tool.call', async () => ({ result: 'tool ran' }) as never)
  on('turn.complete', async () => ({ text: '' }) as never)
  on('ui.render', async ($, e) => {
    const { Box } = $.ui.resolve(e)
    return (<Box />) as never
  })
  return { agents, opened, openArgs, toasts, store, clock, ran: () => ran }
}

const props = (bodyColumns = 70) => ({ title: 'Subagent Desk', isFocused: false, bodyColumns, placement: 'dock', scroll: {}, view: {} }) as never
const mount = ($: Parameters<NonNullable<Parameters<typeof test>[2]>>[0], surface: 'desktop' | 'terminal') =>
  $.ui.mount({ plugin: 'subagent-desk', surface, component: 'Pane', requestId: 'subagent-desk', props: props() })
const spawn = ($: Parameters<NonNullable<Parameters<typeof test>[2]>>[0], description: string, subagentType = 'general-purpose', n = 1) =>
  $.agent.spawn({ tool_use_id: `s${n}`, prompt: 'Do it.', description, subagentType } as never)
const callTool = ($: Parameters<NonNullable<Parameters<typeof test>[2]>>[0]) => $.tool.call as unknown as (input: unknown) => Promise<unknown>

for (const surface of ['desktop', 'terminal'] as const) {
  test(`spawn opens the pane and adds a named card (${surface})`, { timeoutMs: 30000 }, async ($, on) => {
    const r = rig(on)
    await $.session.start({ source: 'startup', cwd: '/x', surface, isInteractive: true } as never)
    await spawn($, 'Review the PR')
    await r.clock.settle()
    expect(r.opened, 'pane opened by itself').toContain('subagent-desk')
    const v = await mount($, surface)
    expect(await v.find({ text: /Review the PR/ }), 'card title').toBeDefined()
    expect(await v.find({ type: 'Text', text: /^Bob$/ }), 'the reviewer is Bob').toBeDefined()
    expect(await v.find({ text: /general-purpose · Opus 5\.5/ }), 'type and model').toBeDefined()
    expect(await v.find({ type: 'Text', text: /^Running · 1/ }), 'Running group').toBeDefined()
    if (surface === 'desktop') {
      const clawd = (await v.findAll({ type: 'Svg' })).find(s => String(s.props.alt) === 'Clawd Bob')
      expect(clawd, 'Clawd drawn with its name').toBeDefined()
      expect(String(clawd!.props.source), 'recoloured to the card colour').toContain('#dc2626')
    } else {
      expect(await v.findAll({ type: 'Svg' }), 'no Svg on the terminal').toHaveLength(0)
    }
  })

  test(`a subagent tool call becomes its live step, housekeeping does not (${surface})`, { timeoutMs: 30000 }, async ($, on) => {
    const r = rig(on)
    await $.session.start({ source: 'startup', cwd: '/x', surface, isInteractive: true } as never)
    await spawn($, 'Read the notes', 'Explore')
    const said = await callTool($)({ tool: 'Read', tool_use_id: 'c1', file_path: 'C:\\Users\\m\\notes.md', agentId: 'agent-a1' })
    await callTool($)({ tool: 'SubagentHandback', tool_use_id: 'c2', agentId: 'agent-a1' })
    await r.clock.settle()
    expect(JSON.stringify(said), 'the call passes through unchanged').toContain('tool ran')
    const v = await mount($, surface)
    expect(await v.find({ text: /Step 1 · Reading notes\.md/ }), 'live step').toBeDefined()
    expect(await v.find({ text: /SubagentHandback/ }), 'housekeeping hidden').toBeUndefined()
  })

  test(`turn.complete marks done with its tokens; Clear removes it (${surface})`, { timeoutMs: 30000 }, async ($, on) => {
    const r = rig(on)
    await $.session.start({ source: 'startup', cwd: '/x', surface, isInteractive: true } as never)
    await spawn($, 'Research cats', 'general-purpose')
    await r.clock.advance(5000)
    const usage = { input_tokens: 1000, output_tokens: 500, cache_read_input_tokens: 30000, cache_creation_input_tokens: 2000, model: 'claude-opus-5-5' }
    await $.turn.complete({ answer: 'ok', agentId: 'agent-a1', reason: 'answer', durationMs: 1, isAborted: false, turnId: 't1', usage } as never)
    await r.clock.settle()
    const v = await mount($, surface)
    expect(await v.find({ type: 'Text', text: /^Finished · 1/ }), 'Finished group').toBeDefined()
    expect(await v.find({ text: /34k tokens · 0:05/ }), 'tokens and time').toBeDefined()
    expect(await v.find({ text: /Done · 0 steps/ }), 'done line').toBeDefined()
    await v.press({ key: 'clear' })
    expect(await v.find({ text: /Research cats/ }), 'cleared').toBeUndefined()
  })

  test(`header shows Pro usage, never money (${surface})`, { timeoutMs: 30000 }, async ($, on) => {
    const r = rig(on, { limits: [{ kind: 'five_hour', percentUsed: 23.5 }, { kind: 'seven_day', percentUsed: 7 }] })
    await $.session.start({ source: 'startup', cwd: '/x', surface, isInteractive: true } as never)
    await spawn($, 'Write the docs')
    await r.clock.settle()
    const v = await mount($, surface)
    expect(await v.find({ text: /5h 24% · week 7%/ }), 'usage tile').toBeDefined()
    expect(await v.find({ text: /[$£€]/ }), 'no money anywhere').toBeUndefined()
    expect(r.ran(), 'no process.run').toBe(0)
  })

  test(`no usage tile without readings (${surface})`, { timeoutMs: 30000 }, async ($, on) => {
    const r = rig(on)
    await $.session.start({ source: 'startup', cwd: '/x', surface, isInteractive: true } as never)
    await spawn($, 'Write the docs')
    await r.clock.settle()
    const v = await mount($, surface)
    expect(await v.find({ text: /Pro usage/ }), 'tile left out').toBeUndefined()
  })

  test(`an agent whose spawn was missed is adopted from the list (${surface})`, { timeoutMs: 30000 }, async ($, on) => {
    const r = rig(on, { listed: [{ id: 'agent-old', description: 'Test the build', type: 'general-purpose', status: 'running' }] })
    await $.session.start({ source: 'startup', cwd: '/x', surface, isInteractive: true } as never)
    await callTool($)({ tool: 'Bash', tool_use_id: 'b1', command: 'npm test', description: 'Run tests', agentId: 'agent-old' })
    await callTool($)({ tool: 'Bash', tool_use_id: 'b2', command: 'ls', agentId: 'engine-fork' })
    await r.clock.settle()
    const v = await mount($, surface)
    expect(await v.find({ text: /Test the build/ }), 'adopted').toBeDefined()
    expect(await v.find({ text: /Running: Run tests/ }), 'its step').toBeDefined()
    expect(await v.find({ text: /engine-fork/ }), 'unknown ids left out').toBeUndefined()
  })

  test(`a step that arrives before its spawn is still shown (${surface})`, { timeoutMs: 30000 }, async ($, on) => {
    const r = rig(on)
    await $.session.start({ source: 'startup', cwd: '/x', surface, isInteractive: true } as never)
    // The list doesn't name agent-a1 yet, so this first call can't be placed.
    await callTool($)({ tool: 'Read', tool_use_id: 'c0', file_path: '/a/early.md', agentId: 'agent-a1' })
    await r.clock.settle()
    await spawn($, 'Read the notes', 'Explore')
    await callTool($)({ tool: 'Read', tool_use_id: 'c1', file_path: '/a/later.md', agentId: 'agent-a1' })
    await r.clock.settle()
    const v = await mount($, surface)
    expect(await v.find({ text: /Reading later\.md/ }), 'later steps show').toBeDefined()
  })

  test(`agents started together keep separate names (${surface})`, { timeoutMs: 30000 }, async ($, on) => {
    const r = rig(on)
    await $.session.start({ source: 'startup', cwd: '/x', surface, isInteractive: true } as never)
    await Promise.all([spawn($, 'Review the PR', 'general-purpose', 1), spawn($, 'Research cats', 'general-purpose', 2), spawn($, 'Test the build', 'general-purpose', 3)])
    await r.clock.settle()
    const names = r.store.names as Record<string, string[]>
    expect(Object.keys(names).sort(), 'every job remembered').toEqual(['research', 'review', 'test'])
    expect(new Set(Object.values(names).flat()).size, 'no two jobs share a name').toBe(3)
    expect(names.review).toEqual(['Bob'])
  })

  test(`two reviewers at once: Bob and a friend (${surface})`, { timeoutMs: 30000 }, async ($, on) => {
    const r = rig(on)
    await $.session.start({ source: 'startup', cwd: '/x', surface, isInteractive: true } as never)
    await spawn($, 'Review the API', 'general-purpose', 1)
    await spawn($, 'Review the UI', 'general-purpose', 2)
    await r.clock.settle()
    const names = (r.store.names as Record<string, string[]>).review!
    expect(names[0]).toBe('Bob')
    expect(names.length).toBe(2)
    expect(names[1]).not.toBe('Bob')
  })

  test(`the pane asks for a narrow dock and a big Clawd (${surface})`, { timeoutMs: 30000 }, async ($, on) => {
    const r = rig(on)
    await $.session.start({ source: 'startup', cwd: '/x', surface, isInteractive: true } as never)
    await spawn($, 'Review the PR')
    await r.clock.settle()
    expect(r.openArgs[0]?.columns, 'narrow dock').toBe(56)
    if (surface === 'desktop') {
      const v = await mount($, surface)
      const clawd = (await v.findAll({ type: 'Svg' })).find(s => String(s.props.alt).startsWith('Clawd'))!
      expect(Number(clawd.props.width) >= 80, 'big crab').toBe(true)
    }
  })

  test(`a card whose agent left the list is finished, not stuck running (${surface})`, { timeoutMs: 30000 }, async ($, on) => {
    const r = rig(on)
    await $.session.start({ source: 'startup', cwd: '/x', surface, isInteractive: true } as never)
    await spawn($, 'Vanishing job', 'Explore')
    await r.clock.settle()
    r.agents.length = 0
    await r.clock.advance(5000)
    const v = await mount($, surface)
    expect(await v.find({ type: 'Text', text: /^Running/ }), 'no longer running').toBeUndefined()
    expect(await v.find({ type: 'Text', text: /^Finished · 1/ }), 'finished').toBeDefined()
  })

  test(`a new round clears the last round's finished cards (${surface})`, { timeoutMs: 30000 }, async ($, on) => {
    const r = rig(on)
    await $.session.start({ source: 'startup', cwd: '/x', surface, isInteractive: true } as never)
    await spawn($, 'First job', 'Explore', 1)
    await $.turn.complete({ answer: 'ok', agentId: 'agent-a1', reason: 'answer', durationMs: 1, isAborted: false, turnId: 't1' } as never)
    await spawn($, 'Second job', 'Explore', 2)
    await r.clock.settle()
    const v = await mount($, surface)
    expect(await v.find({ text: /First job/ }), 'old card gone').toBeUndefined()
    expect(await v.find({ text: /Second job/ }), 'new card').toBeDefined()
  })
}

test('/desk opens the pane', { timeoutMs: 30000 }, async ($, on) => {
  const r = rig(on)
  await $.session.start({ source: 'startup', cwd: '/x', surface: 'desktop', isInteractive: true } as never)
  const said = await $.command.run({ command: 'desk', args: '' } as never)
  expect(JSON.stringify(said)).toContain('Subagent Desk opened')
  expect(r.opened).toContain('subagent-desk')
})
