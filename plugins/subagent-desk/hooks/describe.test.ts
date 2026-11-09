import { expect, test } from 'claude-code/testing'

import { describe, shortModel } from './describe'
import { jobKey, pickName } from './names'

test('hidden tools return null', async () => {
  for (const tool of ['SubagentHandback', 'ToolSearch', 'TodoWrite', 'TaskCreate', 'TaskUpdate', 'mcp__ccd_turn__update_plan']) {
    expect(describe(tool, {}), tool).toBe(null)
  }
})

test('Windows path gives file name', async () => {
  expect(describe('Read', { file_path: 'C:\\a\\b\\notes.md' })!.live).toBe('Reading notes.md')
  expect(describe('Edit', { file_path: '/x/y/app.ts' })!.live).toBe('Editing app.ts')
})

test('tools map to Clawd animations', async () => {
  expect(describe('Bash', { command: 'ls', description: 'List files' })!.anim).toBe('building')
  expect(describe('Bash', { command: 'ls', description: 'List files' })!.live).toBe('Running: List files')
  expect(describe('Grep', { pattern: 'x' })!.anim).toBe('debugger')
  expect(describe('Write', { file_path: 'a.md' })!.anim).toBe('typing')
  expect(describe('WebFetch', { url: 'https://docs.example.com/p' })!.live).toBe('Opening docs.example.com')
  expect(describe('Agent', { description: 'Sub job' })!.anim).toBe('conducting')
  expect(describe('mcp__notion__notion-search', {})!.anim).toBe('beacon')
  expect(describe('Mystery', {})!.anim).toBe('thinking')
})

test('connectors never show a raw server id', async () => {
  const s = describe('mcp__00000000-0000-0000-0000-00000000000a__search_threads', {})!
  expect(s.live).toBe('Connector: search threads')
  expect(describe('mcp__plugin_demo_fireflies__fireflies_search', {})!.live).toBe('Fireflies: search')
})

test('shortModel', async () => {
  expect(shortModel('claude-opus-5-5')).toBe('Opus 5.5')
  expect(shortModel('claude-haiku-5-5-20261001')).toBe('Haiku 5.5')
  expect(shortModel('haiku')).toBe('Haiku')
})

test('jobKey finds review in "Review the PR"', async () => {
  expect(jobKey('general-purpose', 'Review the PR')).toBe('review')
  expect(jobKey('Explore', 'Review the PR')).toBe('explore')
})

test('jobKey falls back to type for "Do the thing"', async () => {
  expect(jobKey('general-purpose', 'Do the thing')).toBe('general-purpose')
  expect(jobKey('', 'Do the thing')).toBe('subagent')
})

test('pickName is stable and reuses taken', async () => {
  const a = pickName('explore', {}, 0).name
  expect(pickName('explore', {}, 0).name).toBe(a)
  expect(pickName('explore', { explore: ['Zed'] }, 0).name).toBe('Zed')
  const other = pickName('research', { explore: [a] }, 0).name
  expect(other).not.toBe(a)
  expect(other.length >= 2 && other.length <= 4).toBe(true)
})

test('review key gets Bob first', async () => {
  expect(pickName('review', {}, 0).name).toBe('Bob')
  expect(pickName('research', { review: ['Bob'] }, 0).name).not.toBe('Bob')
})

test('a second reviewer at the same time gets its own name, and keeps it', async () => {
  const first = pickName('review', {}, 0)
  const second = pickName('review', first.taken, 1)
  expect(second.name).not.toBe('Bob')
  expect(second.taken.review).toEqual(['Bob', second.name])
  // Next chat: the second reviewer is the same second name again.
  expect(pickName('review', second.taken, 1).name).toBe(second.name)
  expect(pickName('review', second.taken, 0).name).toBe('Bob')
})

test('names saved by the first version (one string per job) still work', async () => {
  expect(pickName('review', { review: 'Bob' } as never, 0).name).toBe('Bob')
})
