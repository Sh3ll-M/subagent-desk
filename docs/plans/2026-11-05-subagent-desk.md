# Subagent Desk Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A Windows-safe Claude Code mod that shows one live, animated, named Clawd card per subagent in a side pane.

**Architecture:** Pure logic (agent list reducer, tool-to-step wording, name picking, SVG recolouring) lives in small `.ts` files with no engine calls, so tests drive them directly. `register.tsx` wires engine events (`agent.spawn`, `tool.call`, `turn.step`, `turn.complete`, `agent.list` poll) into one `$.state` atom and draws the pane from it. Clawd SVGs are bundled as a generated `clawd.ts` string table.

**Tech Stack:** Claude Code mod API 2.1.317 (`claude-code` types, `claude-code/testing`), TypeScript/TSX, CSS-keyframe SVG from clawd-tank (MIT).

**Spec:** `C:\Users\Matthew\Documents\claude-mods\docs\2026-11-05-subagent-desk-design.md`

Dev folder (hot reload): `C:\Users\Matthew\.claude\dev-mods\e56e92d5-2198-4f35-9813-58ad946e1fd2\subagent-desk\` (below: `<mod>`). Final home: `C:\Users\Matthew\Documents\claude-mods\plugins\subagent-desk\`. Not a git repo: no commit steps.

## Global Constraints

- No `$.process.run`, no shell commands, no `/.claude/` path splitting, no `$.fs` paths built by hand. Persistence only via `$.state` (per chat) and `$.store` (names, across chats).
- No money figure anywhere. No `prompt.compose` hook, no `context` nudges, never deny or rewrite a tool call: the mod only watches (`tool.call` always `return next(e)` unchanged).
- Mod name `subagent-desk`, pane id `subagent-desk`, pane title `Subagent Desk`, command `/agents`.
- Every Clawd SVG embedded must stay under 131072 characters after recolouring.
- clawd-tank LICENSE bundled at `<mod>/assets/clawd/LICENSE`; README credits https://github.com/marciogranzotto/clawd-tank.

## Review Focus

1. A subagent whose `agent.spawn` the mod never saw (reload mid-run) but whose `tool.call` arrives: adopt it from `$.agent.list()`; unknown ids (engine forks) ignored. Test in Task 4.
2. Nine or more running agents at once: colours may repeat, but nothing crashes and every card draws. Test in Task 2.
3. A description with no recognisable job word ("Do the thing"): falls back to the agent type's name; same input always yields the same name. Test in Task 3.
4. `rateLimits` empty (not on a subscription, or before first reply): header simply omits the usage tile. Test in Task 5.
5. The terminal surface: no `Svg` element, a text crab instead, no throw. Test in Task 5.

---

### Task 1: Scaffold and bundle Clawd SVGs

**Files:**
- Create: `<mod>/.claude-plugin/plugin.json` (`name`, `version` 0.1.0, `description`, `"types": "./types/index.d.ts"`)
- Create: `<mod>/hooks/hooks.json` → `{ "modules": ["./register.tsx"] }`
- Create: `<mod>/assets/clawd/*.svg` (downloaded: `clawd-working-debugger`, `-typing`, `-building`, `-wizard`, `-conducting`, `-beacon`, `-thinking`, `clawd-happy`, `clawd-idle-living`, `clawd-dizzy`, `clawd-working-confused`) and `LICENSE`
- Create: `<mod>/tools/build-clawd.py` (run with `python -I`; reads the SVGs, writes `hooks/clawd.ts`)
- Create: `<mod>/hooks/clawd.ts` (generated)
- Test: `<mod>/hooks/clawd.test.ts`

**Interfaces:**
- Produces: `export type Anim = 'debugger'|'typing'|'building'|'wizard'|'conducting'|'beacon'|'thinking'|'happy'|'idle'|'dizzy'|'confused'`; `export const CLAWD: Record<Anim, string>`; `export const BODY_HEX: string` (the body colour the SVGs use, found while building); `export function clawdSvg(anim: Anim, color: string, px: number): string` (replaces `BODY_HEX` case-insensitively with `color`, sets root `width`/`height` to `px`).

- [ ] Download each SVG through the GitHub contents API `download_url` (branch `master`) into `assets/clawd/`; check each has no `<script`, no `<animate`, no `href="http`.
- [ ] Write failing test `clawdSvg recolours and sizes`: `clawdSvg('typing','#2563eb',48)` contains `#2563eb`, not `BODY_HEX`, contains `width="48"`, length < 131072, contains `@keyframes`.
- [ ] Write `build-clawd.py` and generate `clawd.ts`; strip XML comments and collapse whitespace between tags.
- [ ] Run `claude plugin test <mod>` → PASS.

### Task 2: Agent list reducer

**Files:**
- Create: `<mod>/hooks/agents.ts`, `<mod>/types/index.d.ts`
- Test: `<mod>/hooks/agents.test.ts`

**Interfaces:**
- Produces (in `types/index.d.ts`): `Phase = 'working'|'done'|'failed'`; `Step = { label: string; live: string; anim: Anim }`; `Agent = { id; description; type; model; phase: Phase; startedAt: number; endedAt: number; count: number; steps: Step[] /* last 20 */; tokens: number; name: string; hue: number; round: number; lastStepAt: number }`; `Desk = { agents: Agent[]; round: number }`; contract `'subagent-desk': { desk: Shaped<Desk>; tick: number }`.
- Produces (in `agents.ts`), all pure, returning a new `Desk`:
  - `addAgent(d: Desk, a: { id; description; type; model; name; now }): Desk`: if none working, `round+1` and drop every non-working agent from earlier rounds; hue = first of 8 not used by a working agent, else `count % 8`.
  - `addStep(d, id, step: Step, now): Desk` (count+1, keep last 20, a non-working agent becomes working again).
  - `addTokens(d, id, n): Desk`; `finish(d, id, phase: 'done'|'failed', now): Desk`; `clearFinished(d): Desk`.
  - `HUES: readonly string[]` — 8 colours: `#dc2626 #ea580c #eab308 #16a34a #0d9488 #2563eb #9333ea #db2777`.

- [ ] Write failing tests: `new round clears old finished cards`; `running cards survive clearFinished`; `running agents get distinct hues`; `nine running agents all get a hue 0-7 without throwing`; `steps keep only the last 20`.
- [ ] Implement; run `claude plugin test <mod>` → PASS.

### Task 3: Step wording and names

**Files:**
- Create: `<mod>/hooks/describe.ts`, `<mod>/hooks/names.ts`
- Test: `<mod>/hooks/describe.test.ts`

**Interfaces:**
- Produces: `describe(tool: string, input: Record<string, unknown>): Step | null` — `null` for hidden tools (`SubagentHandback`, `ToolSearch`, `TodoWrite`, `TaskCreate`, `TaskUpdate`, anything starting `mcp__ccd_`). Anim map: Read/Grep/Glob → debugger; Edit/Write/MultiEdit/NotebookEdit → typing; Bash/PowerShell → building; WebSearch/WebFetch → wizard; Agent/Task → conducting; `mcp__*` → beacon; else thinking. `live` text: "Reading x.md", "Editing x.md", "Running: <description or command cut to 60>", "Searching the web: q", "Opening host", "<Connector>: <tool words>". File names taken with a split on both `/` and `\`.
- Produces: `jobKey(type: string, description: string): string` — for `general-purpose`/`fork`/empty type, the first of `review, research, test, fix, build, write, search, plan, design, debug, explore, summar, refactor, docs` found in the lower-cased description; else the type lower-cased; fallback the type.
- Produces: `pickName(key: string, taken: Record<string,string>): string` — returns `taken[key]` if set, else the first name from a fixed list of ~40 3–4 letter names (`Bob, Pip, Zed, Moxy, Dot, Gus, Ivy, Kip, Lou, Mo, Nim, Oz, Peg, Quin, Rex, Sid, Tam, Uma, Vin, Wiz, Yuki, Zoe, Ace, Bea, Cyd, Dex, Eli, Fig, Gem, Hux, Ike, Jo, Kai, Lex, Max, Ned, Ola, Pax, Roo, Taz`) not already a value in `taken`, chosen deterministically from a hash of `key`; `reviews` always maps to `Bob` when free.

- [ ] Write failing tests: `hidden tools return null`; `Windows path gives file name` (`describe('Read',{file_path:'C:\\a\\b\\notes.md'})!.live === 'Reading notes.md'`); `Bash maps to building`; `jobKey finds review in "Review the PR"`; `jobKey falls back to type for "Do the thing"`; `pickName is stable and reuses taken`; `review key gets Bob`.
- [ ] Implement; run tests → PASS.

### Task 4: Engine wiring

**Files:**
- Create: `<mod>/hooks/register.tsx` (events only in this task; drawing in Task 5)
- Test: `<mod>/hooks/register.test.tsx`

**Interfaces:**
- Consumes: Tasks 2 and 3.
- `desk` atom: `atom({ plugin: 'subagent-desk', key: 'desk' }, { agents: [], round: 0 }, { shape: 'desk-1' })`; names in `$.store` key `names` (`Record<jobKey, name>`).
- `session.start`: register `/agents`; start a 500 ms `$.clock.every` tick (writes `tick` atom) only while any agent is working; a 2 s `$.agent.list()` poll while working marks `completed`/`idle` → done, `failed`/`killed` → failed.
- `agent.spawn`: after `next`, with `agentId`, `addAgent` and, if it started a round, `$.ui.open({ id: 'subagent-desk', title: 'Subagent Desk' })`; if that resolves `isPlaced: false`, `$.ui.toast('Subagents started: type /agents to watch them')`.
- `tool.call` with `e.agentId`: `describe` → `addStep` (adopt unseen ids per Review Focus 1). Always `return next(e)`.
- `turn.step` (generator hook, `yield* next(e)`) with `agentId`: add usage total (input+output+cache read+cache write) via `addTokens`; set model from `e.model` (short form "Opus 5.5").
- `turn.complete` with `agentId`: `finish` (`reason` error/refusal or `isAborted` → failed).
- `command.run` `agents`: open the pane, reply `Subagent Desk opened.`
- `ui.press` `clear`: `clearFinished`.

- [ ] Write failing tests (desktop and terminal): `spawn opens the pane and adds a card`; `a subagent tool call becomes its live step`; `SubagentHandback adds no step`; `turn.complete marks done`; `tool.call result passes through unchanged`; `unseen agent id is adopted from agent.list`; `no process.run is ever called` (mock `process.run` to throw).
- [ ] Implement; run `claude plugin test <mod>` → PASS.

### Task 5: The pane

**Files:**
- Modify: `<mod>/hooks/register.tsx` (add `ui.render` for `{ component: 'Pane', requestId: 'subagent-desk' }`)
- Test: `<mod>/hooks/register.test.tsx`

Layout per card (match `docs/reference-cards.png`): left column 9 cols wide: the Clawd `Svg` (`clawdSvg(anim, HUES[hue], 48)`, alt `Clawd <name>`) and the name under it, bold, in the card colour. Right: title + ✓/✗/● mark; `type · model` left, `<tokens> tokens · m:ss` right; status line (`Step n · <live>` while working, `Done · n steps`, `Stopped · n steps`); last two step `live` lines dim; a 3 px bar in the card colour (moving CSS sweep while working, full when done, red when failed). Anim: working → last step's anim; done → `happy` for 4 s after `endedAt`, then `idle`; failed → `dizzy`.
Header: `<n> subagents · <running> running`, total time, total tokens, and when `rateLimits` has readings `5h <p>% · week <p>%`; a `Clear` button (key `clear`). Groups Running / Finished / Stopped with counts, newest first. Terminal: no Svg; a two-line text crab in the card colour.

- [ ] Write failing tests: `card shows name under Clawd` (desktop: Svg alt `Clawd Bob`); `header shows usage percent from rateLimits` (mock `session.usage` with `five_hour` 23.5 → text `5h 24%`); `header omits usage when rateLimits empty`; `no dollar or pound sign anywhere in the pane`; `terminal draws no Svg`; `Clear removes finished cards`.
- [ ] Implement; run `claude plugin test <mod>` and `claude plugin validate <mod>` → PASS, validation passed.

### Task 6: Swap mods and install

- [ ] `claude plugin uninstall helper-desk@benai-mods --scope user` and `chat-inventory@benai-mods --scope user`.
- [ ] Remove the two rows from the benai `mods` pane's `MODS` list (`Documents\benai-mods\plugins\mods\hooks\register.tsx`).
- [ ] After the user has seen it working in this session (hot reload), copy `<mod>` to `Documents\claude-mods\plugins\subagent-desk\`, write `Documents\claude-mods\.claude-plugin\marketplace.json` (name `claude-mods`, one plugin `./plugins/subagent-desk`), `claude plugin marketplace add`, `claude plugin install subagent-desk@claude-mods --scope user`, then remove the dev copy so it doesn't load twice.
- [ ] Write `<mod>/README.md` (what it is, `/agents`, clawd-tank credit).
