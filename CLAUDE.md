@AGENTS.md

## Claude Code specifics

- Use plan mode for each milestone in `docs/TASKS.md`: show the plan, wait for approval when the milestone touches contracts, keys or money, then build.
- Load the NEAR agent skills before touching NEAR, Intents or NEAR AI code.
- Run `/ship-check` (in `.claude/commands/`) at every milestone end and before submission.
- When a doc page and this repo disagree, quote both and ask.
