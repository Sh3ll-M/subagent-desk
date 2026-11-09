# Subagent Desk: design

A Claude Code mod, rebuilt from scratch for Windows, that shows a side panel with one live card per subagent. It replaces Ben AI's `helper-desk` (and later absorbs the useful parts of `chat-inventory`).

## Why

When Claude starts subagents during a chat, the user can't see what they are doing. They want to watch them work: what each one is on, how long it has taken, how many tokens it has used. The old Helper Desk drew the right kind of cards but carried a lot the user doesn't want, and it was written for macOS.

## Who

Matthew: UK, Windows 11, Claude Code desktop app (Code tab), Claude Pro subscription. Uses Claude Code for experimenting, not heavy production work.

## Goals

1. A side panel listing every subagent started in the current chat, one card each.
2. Each card shows (matching `reference-cards.png` in this folder: a still of the old helper-desk panel from Ben AI's video, so the old `register.tsx` card layout is the visual starting point, minus cost and the progress bar):
   - task name (the subagent's description) and a status mark: running, done (✓) or failed (✗)
   - agent type and model, e.g. `Explore · Opus 5.5`
   - tokens used and elapsed time, e.g. `312k tokens · 1:21`
   - a status line: while running, the step it is on now ("Reading research.md"); when finished, "Done · 6 steps"
   - its last two steps underneath, in plain words
   - a small pixel crab in a colour unique among running agents, and a thin bar along the card's bottom in the same colour (animated while running, full when done, red when failed)
2a. **A name for each crab.** Every crab gets a short, fun 3–4 letter name shown under it (Bob, Pip, Zed, Moxy...). The name belongs to the kind of job, so the same kind of subagent always gets the same name in every chat. The user's example: the one that always does reviews is always Bob. Names are keyed by agent type, and by the main word in the task (review, research, test...) for general-purpose agents. The choices are remembered in the mod's store, so they stay the same across chats and restarts.
2b. **Clawd bots from clawd-tank.** The crabs are the animated Clawd SVGs from https://github.com/marciogranzotto/clawd-tank (`assets/svg-animations/`, MIT licence; bundle the files used plus its LICENSE, and credit it in the README). They are pure CSS-keyframe SVGs, no scripts, 2–25 KB each, well under the Svg size limit. Each card's bot plays the animation that matches its subagent's current tool, following clawd-tank's own mapping: Read/Grep/Glob → debugger, Edit/Write → typing, Bash → building, WebSearch/WebFetch → wizard, Agent → conducting, MCP connectors → beacon, otherwise thinking. When the subagent is done, the bot plays happy, then idle. When stopped, it plays dizzy or confused. Each bot is recoloured to its card's colour by swapping the body hex, so no two running bots share a colour. In the terminal, where SVGs can't draw, it falls back to a small text crab.
2c. **Hide internal steps.** Housekeeping tool calls like `SubagentHandback` never show as steps.
3. **Cleaning up.** The list must not grow forever. When a new round of subagents starts, finished and stopped cards from earlier rounds are cleared. A **Clear** button in the header removes finished cards at any time. Running cards are never removed.
4. Cards grouped under Running, Finished, Stopped headings with counts.
4. A header showing: number of subagents, total elapsed time, total subagent tokens. If the engine exposes the Pro plan's usage-limit status to mods, show that too; if not, leave it out.
5. The panel appears by itself when the first subagent of a round starts, including when another mod's pane (such as `/mods`) is open. If the engine only allows one pane at a time, the builder picks whichever is clearest: bring this pane to the front, or show a one-line band above the prompt with a button that opens it.
6. A slash command to open it on demand (`/agents` or similar; builder's call, must not clash with built-ins).
7. Works on Windows: no `mkdir -p`, `rm`, `open`, `pbcopy`, `python3`, or splitting paths on `/.claude/`. Any file paths are built with the engine's own facilities and work with backslashes.

## Non-goals (for this version)

- The purple task progress bar above the prompt: dropped.
- Any instructions added to Claude's system prompt, and any "make a plan" nudges injected into tool results: dropped. The mod only watches.
- Chat Inventory features (connectors, files, skills): a later phase, possibly as extra sections in this same panel.
- The `/mods` on/off switchboard integration: not needed.

## Anti-goals (failure even if it "works")

- Any money figure, in any currency. The user is on a flat subscription.
- Changing Claude's behaviour in any way (extra prompts, nudges, blocked or delayed tool calls).
- Panel that silently never appears.
- Mac-only commands or paths that break on Windows.

## Constraints

- Claude Code mod (plugin with a `hooks/hooks.json` `modules` entry and a TypeScript register module), as in the existing mods.
- Lives in its own folder: `C:\Users\Matthew\Documents\claude-mods\` as a local marketplace, installed at user scope. Replaces `helper-desk@benai-mods`, which gets uninstalled. `chat-inventory@benai-mods` also gets uninstalled now (user doesn't like how it works; its features come back later in this mod).
- The builder does the uninstall and install. Order: uninstall `helper-desk@benai-mods` and `chat-inventory@benai-mods` first (so the old pane, prompt additions and plan nudges don't muddle testing), then add the `claude-mods` marketplace and install the new mod.
- Desktop surface first; terminal rendering should not crash but can be plain.

## Decided by the user

- Build for Windows. Start with the subagent panel. Keep the look of the reference screenshot. No costs. Header: count, time, tokens (+ usage limit if available).

## Left to the builder (marked as my calls)

- Exact mod name and command name (proposed: `subagent-desk`, `/agents`).
- How "current step" text is worded per tool type (reuse the old describe() idea: Read → "Reading x.md", Bash → its description, connectors → friendly name).
- Crab art and colours (old design is fine to reimplement).
- How the panel gets to the front when another pane is open, after checking what the engine allows.
- The name list (a few dozen short, friendly names) and how a job's main word is picked from its description.
- What counts as a "round" (my call: a new subagent starts while none are running).
- Persistence (my call): cards live in the engine's per-chat `$.state`, so they survive a plugin reload but not an app restart. No on-disk storage layer.
- Status groups (from the old mod): failed and killed agents go under Stopped; token totals include cache reads and writes.
- Tests: write the mod's test file in the same style as the existing mods and run it.
