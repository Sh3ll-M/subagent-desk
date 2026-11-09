# Subagent Desk

A [Claude Code](https://claude.com/claude-code) mod that gives you a live side panel showing every subagent Claude spins up — what each one's doing, how long it's taken, and how many tokens it's used.

<!-- screenshot: docs/screenshot.png -->

## Why

When Claude starts subagents mid-chat, they work out of sight. Subagent Desk puts them on a little desk where you can watch: one card per subagent, with an animated Clawd crab, a name that sticks to the kind of job (the reviewer is always Bob, Pip does research, and so on), its type and model, tokens and elapsed time, and its current and recent steps.

- `/desk` opens the pane. It also opens itself the moment a new batch of subagents starts.
- **Clear** removes finished cards, and a new batch clears the last one automatically — the list never grows forever.
- The header shows the batch's time and tokens, plus your Claude Pro plan's 5-hour and weekly usage, when Claude Code reports them. No money figures, anywhere.
- The mod only watches. It never blocks, delays, or rewrites a tool call, and never adds anything to Claude's own prompt.
- Built and tested for Windows.

## Install

```
/plugin marketplace add Sh3ll-M/subagent-desk
/plugin install subagent-desk@claude-mods
```

Then run `/desk` to open the panel.

## Credits

The Clawd animations are from [clawd-tank](https://github.com/marciogranzotto/clawd-tank) by Marcio Granzotto Rodrigues, MIT licence (bundled at `plugins/subagent-desk/assets/clawd/LICENSE`).

The idea of a side panel showing live subagent cards was inspired by a video of Johnny Savvy's Progress mod — no code from it is used here; Subagent Desk is built from scratch.
