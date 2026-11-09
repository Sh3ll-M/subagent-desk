import { expect, test } from 'claude-code/testing'

import type { Desk } from '../types'
import { HUES, addAgent, addStep, addTokens, clearFinished, endTurn, finish } from './agents'

test('a turn total replaces its step counts, even after a reload', async () => {
  let d = addAgent({ agents: [], round: 0 }, { id: 'a', description: 'a', type: 'Explore', model: '', name: 'Bob', now: 0 })
  d = addTokens(d, 'a', 400)
  d = addTokens(d, 'a', 600)
  // The turn's own total is 1500: the 1000 counted step by step is replaced, not added to.
  d = endTurn(d, 'a', 1500)
  expect(d.agents[0]!.tokens).toBe(1500)
  // A second turn adds on top of the first.
  d = addTokens(d, 'a', 100)
  d = endTurn(d, 'a', 300)
  expect(d.agents[0]!.tokens).toBe(1800)
})

const empty: Desk = { agents: [], round: 0 }
const add = (d: Desk, id: string, now = 0) => addAgent(d, { id, description: id, type: 'Explore', model: '', name: 'Bob', now })
const step = { label: 'a.md', live: 'Reading a.md', anim: 'debugger' as const }

test('new round clears old finished cards', async () => {
  let d = add(empty, 'a')
  d = finish(d, 'a', 'done', 5)
  d = add(d, 'b', 10)
  expect(d.agents.map(a => a.id)).toEqual(['b'])
  expect(d.round).toBe(2)
})

test('a spawn during a running round keeps the round', async () => {
  let d = add(empty, 'a')
  d = add(d, 'b')
  expect(d.round).toBe(1)
  expect(d.agents.length).toBe(2)
})

test('running cards survive clearFinished', async () => {
  let d = add(add(empty, 'a'), 'b')
  d = finish(d, 'a', 'failed', 3)
  d = clearFinished(d)
  expect(d.agents.map(a => a.id)).toEqual(['b'])
})

test('running agents get distinct hues', async () => {
  let d = empty
  for (const id of ['a', 'b', 'c']) d = add(d, id)
  expect(new Set(d.agents.map(a => a.hue)).size).toBe(3)
})

test('nine running agents all get a hue 0-7 without throwing', async () => {
  let d = empty
  for (let i = 0; i < 9; i++) d = add(d, `x${i}`)
  expect(d.agents.length).toBe(9)
  for (const a of d.agents) expect(a.hue >= 0 && a.hue < HUES.length).toBe(true)
})

test('steps keep only the last 20 and count every call', async () => {
  let d = add(empty, 'a')
  for (let i = 0; i < 25; i++) d = addStep(d, 'a', { ...step, label: `f${i}` }, i)
  const a = d.agents[0]!
  expect(a.steps.length).toBe(20)
  expect(a.count).toBe(25)
  expect(a.steps[19]!.label).toBe('f24')
})

test('a finished agent that takes a new step is working again', async () => {
  let d = finish(add(empty, 'a'), 'a', 'done', 5)
  d = addStep(d, 'a', step, 6)
  expect(d.agents[0]!.phase).toBe('working')
  expect(d.agents[0]!.endedAt).toBe(0)
})
