import { expect, test } from 'claude-code/testing'

import { BODY_HEX, CLAWD, clawdSvg } from './clawd'

test('clawdSvg recolours and sizes', async () => {
  const svg = clawdSvg('typing', '#2563eb', 48)
  expect(svg).toContain('#2563eb')
  expect(svg.toLowerCase()).not.toContain(BODY_HEX.toLowerCase())
  expect(svg).toContain('width="48"')
  expect(svg).toContain('height="48"')
  expect(svg).toContain('@keyframes')
  expect(svg.length < 131072).toBe(true)
})

test('every animation is bundled and script-free', async () => {
  for (const anim of ['debugger', 'typing', 'building', 'wizard', 'conducting', 'beacon', 'thinking', 'happy', 'idle', 'dizzy', 'confused'] as const) {
    const svg = CLAWD[anim]
    expect(svg.startsWith('<svg'), anim).toBe(true)
    expect(svg.includes('<script'), anim).toBe(false)
  }
})
