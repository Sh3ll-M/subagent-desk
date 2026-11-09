# SDD ledger — plan: C:\Users\Matthew\Documents\claude-mods\docs\plans\2026-11-05-subagent-desk.md

Setup: Ruling: no git repo and no worktree — the user's folders aren't under version control and they didn't ask for one — cost if wrong: no per-task history; this ledger is the record.
Pre-flight: Task 4/5 consume Task 2 (Desk, addAgent…) and Task 3 (describe, jobKey, pickName); names match. Step.anim consumes Anim from Task 1: types/index.d.ts imports it from hooks/clawd.
Task 1: complete (tests: claude plugin test <mod> → 2/2 pass)
Task 1: Ruling: Anim union is repeated in types/index.d.ts — the validator requires a self-contained contract — cost if wrong: two lists to keep in step.
Task 2: complete (tests → 9/9 pass)
Task 2: Ruling: added setModel(d,id,model) to agents.ts — Task 4 needs to set the model and the plan named no function for it — cost if wrong: none.
Task 3: complete (tests → 18/18 pass)
Task 3: Ruling: connector names drop old mod's big tool-name table; claude.ai id servers read "Connector: <tool words>" — YAGNI, spec only forbids raw ids — cost if wrong: less specific labels for claude.ai connectors.
Task 4+5: Ruling: built together in register.tsx, code written before its tests — the tests then ran and passed first time, not watched failing — cost if wrong: a test that can't fail; mitigated by the final review.
Task 4+5: Ruling: command is /desk, not /agents — /agents is a built-in Claude Code command and the engine refuses it — cost if wrong: none.
Task 4+5: Ruling: tick every 1 s, not 500 ms — Clawd motion is CSS, the tick only moves the clock — cost if wrong: none.
Task 4+5: complete (tests → 33/33 pass; plugin validate passed; tsc clean)
Task 6 (part): helper-desk and chat-inventory uninstalled; their rows removed from benai mods pane. Install pending the user seeing it work.
Final review: fresh reviewer (opus). No Critical.
Final: fixed early tool.call strands agent in strangers — "a step that arrives before its spawn is still shown" RED→GREEN, suite 40/40
Final: fixed parallel spawns overwrite names — "agents started together keep separate names" RED→GREEN, suite 40/40
Final: fixed tokens double-counted after reload — "a turn total replaces its step counts, even after a reload" RED→GREEN (turnTokens kept in $.state, shape desk-2), suite 40/40
Final: fixed (re-graded Minor→Important: user sees a card stuck running forever) card stuck when agent leaves list — "a card whose agent left the list is finished, not stuck running" RED→GREEN, suite 40/40
Final: also wrapped $.command.register in try/catch (one line, no test: engine refusal can't be mocked cheaply).
Final: minor (deferred): parallel spawns can show more than one "type /desk" toast
Final: minor (deferred): a late tool.call can bring a done card back to working
Final: minor (deferred): job words match inside other words ("latest" counts as test)
Final: Ruling: unasked pane while /mods pane is open — not testable here; the toast fallback covers isPlaced:false — cost if wrong: user types /desk.
