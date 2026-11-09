# Subagent Desk

A Claude Code mod that shows a side pane with one live card per subagent Claude starts. Each card has an animated Clawd in its own colour, a name that sticks to the kind of job (the reviewer is always Bob), the subagent's type and model, its tokens and time, the step it's on, and its last two steps.

- `/desk` opens the pane. It also opens by itself when a new batch of subagents starts.
- **Clear** removes finished cards. A new batch clears the last batch's cards by itself.
- The header shows the batch's time and tokens, plus your Pro plan's 5-hour and weekly usage when Claude Code reports them. No money figures.
- The mod only watches. It never changes a tool call or adds anything to Claude's prompt.
- Built for Windows: no shell commands, no hand-built file paths.

## Credits

The Clawd animations are from [clawd-tank](https://github.com/marciogranzotto/clawd-tank) by Marcio Granzotto Rodrigues, MIT licence (`assets/clawd/LICENSE`). To rebuild `hooks/clawd.ts` after changing an SVG: `python -I tools/build-clawd.py`.

The idea for a side panel of live subagent cards was inspired by a video of Johnny Savvy's Progress mod; no code from it is used here — Subagent Desk is built from scratch.
