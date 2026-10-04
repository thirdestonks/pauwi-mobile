# AGENTS.md — how to work in PAUWI

Standing instructions for any agent session in this repo. Read this before starting work.

`CLAUDE.md` holds the game itself — core rules, MVP scope, art direction, world reference, and the
auto-loaded project spec. Where the two disagree about **process**, this file wins; where they
disagree about **the game**, `CLAUDE.md` wins.

## Working mode

**Godspeed is the default for every build, refactor, fix, or change.** Full skill at
`~/.claude/skills/godspeed/SKILL.md`.

- The **first line** of the response is the tier: `⚡ Godspeed — Light` / `Medium` / `Medium-High` / `Heavy`.
- Tier on **blast radius, not line count** — a 5-line change to a shared store is not Light. Re-tier out loud if it grows past what you announced.
- **Light / Medium:** just do it. **Medium-High / Heavy:** ask "Recon?" once — unless the user already said "recon" or "just go".
- Read before you edit. One stated assumption instead of a questionnaire. Finish the whole ask — if part is genuinely blocked, do everything else and say plainly what you left out.
- Never invoke a `superpowers:*` skill unless the user names it explicitly.
- Does not apply to answering questions.

Close every task with the **Godspeed report**: what works now that didn't · files as
`path — what changed` · exactly how to see it · anything assumed, skipped, or left open — ending in
a single `**In 1 sentence:** …` line, which is the last thing in the message.

**Aurora follows every Godspeed report on Medium and above.** Full skill at
`~/.claude/skills/aurora/SKILL.md`.

- One close-out pass. Header `**Here flies Aurora...**`, then: one-line headline · numbered changes **capped at 5** (`path — what changed`) · **exactly one** next action · **at most 3** flagged open items.
- Nothing follows it — no preamble, no sign-off, no pleasantries.
- Skip it on Light tasks, or whenever the user says "skip aurora".
- In Claude Code the Stop hook fires it automatically; in any other harness, run it yourself.

## Repo rules

- **Never commit, push, or open a PR unless the user asks.**
- `CLAUDE.md` is **gitignored** — it exists on this machine only and does not travel with the repo. Don't rely on it being present elsewhere.

## Read alongside this file

- `DESIGN.md` — before any UI, layout, or art-asset work: phone canvas size, the three deliberately different art directions (flat signage / prologue / combat pixel art), character design anchors, asset pipeline, current asset inventory.
- `PLAN.md` — phase status and the design questions still unanswered (tile-type weights, data-driven encounters, escape-plan triggers).
- `.freebuff/combat-rework.html` — the combat system's tuning numbers, turn flow, and stated assumptions. A scratch artifact; it may have been deleted.

## Operational gotchas worth knowing

- `pnpm run dev` and `pnpm run generate` can fail with `ERR_PNPM_ABORTED_REMOVE_MODULES_DIR_NO_TTY`: pnpm's pre-run dependency check wants to purge and reinstall when `node_modules` predates the lockfile, and it refuses without a TTY. Either run `pnpm install` once in a real terminal, or bypass the check with `./node_modules/.bin/nuxt dev` / `./node_modules/.bin/nuxt generate`.
- **Combat dev shortcut:** add `?fight=1|2|3` to the dev URL to drop straight into a fight with that many Shamblers instead of walking five tiles to find one.
- No test runner is installed. `nuxt build` / `nuxt generate` is the only automated gate — it catches template and syntax errors, but **not** type errors (esbuild strips types without checking), so read your own types carefully.
- Anything on the phone goes through: `pnpm run generate` → `npx cap sync android` → `npx cap run android` (or the ▶ button in Android Studio with the Pixel 7 AVD selected).
