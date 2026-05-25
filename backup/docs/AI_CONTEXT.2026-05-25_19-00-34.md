# AI CONTEXT (Calories Monster App)

## Role
You are assisting in building a React Native gamified calorie tracking app called **Calories Monster** (product name **Calories Fighter**).

---

## Core Principle
This file is the PRIMARY ENTRY POINT for understanding the project.

If there is any conflict between this file and any other instruction:
➡️ **AI_CONTEXT.md takes priority.**

---

## Source of Truth Files
Always follow these files:

- `/docs/project-overview.md` → product definition
- `/docs/architecture.md` → system design
- `/docs/game-rules.md` → game mechanics

Never invent or modify core mechanics without explicit user instruction.

---

## Game Integrity Rule
Do not introduce new systems, mechanics, or balancing changes unless:
- The user explicitly requests it
- **AND** `game-rules.md` is updated accordingly

---

## Documentation Update Rule
When any `/docs` file is modified:

1. Create a backup **before** editing (copy the current file as-is).
2. Store backups in `/backup/docs/` using a **date + time** suffix on each file:
   - Pattern: `{basename}.{YYYY-MM-DD_HH-mm-ss}.md`
   - Examples:
     - `AI_CONTEXT.2026-05-23_14-30-52.md`
     - `game-rules.2026-05-23_14-30-52.md`
3. Use one shared timestamp per backup session (all four files from the same edit batch share the same suffix).
4. Backups must preserve the previous version **before** changes; never overwrite an existing backup file.

Legacy folder `/backup/doc-YYYY-MM-DD/` may exist from older sessions; prefer the timestamped filenames going forward.

---

## Current implementation (summary)

### Stats tab — Character Stat
- Screen title: **Character Stat** (not “Hunter Sheet”).
- **No default profile values** are stored; the user must enter all required fields.
- **Save** is gray/disabled until the form is valid **and** has unsaved changes; label is **Save** (not “Save Hunter Sheet”).
- After save, read-only blocks appear below the button:
  1. **Current Stats** — table: saved profile + metabolism (BMR, TDEE, weekly HP, daily target)
  2. **Monster Stat** — table: live week monster (name, state, weekly HP, daily target, today’s intake)
  3. **Battle Stats** — **card UI**: Week Win Streak, Total Wins, Battles (+ optional COOL/last-week footer when weeks finished)

### Metabolism / classes
- **TDEE** uses a fixed moderate multiplier (`×1.55`) for every class.
- **Calorie class** only changes **deficit %** (10 / 15 / 20 / 25); higher class → **lower** weekly HP, not higher.

### Battle tab
- Requires a **complete** saved profile (`isProfileComplete`); otherwise shows a banner and disables logging.
- Food form: **food name** + **manual kcal** (number pad); Add disabled until both are valid.
- Weekly HP and daily overheat target **recalibrate** when the user saves Character Stat (`recalibrateCurrentWeeklyMonster`).
- Week rollover (`processWeekRollover`) writes `weeklyResults` (victory if HP remains after Sunday).
- Delete today’s log on Battle **restores** weekly HP; delete on Log tab does not.

### Onboarding
- Collects **weight** + **calorie class** only; full profile is completed on Character Stat.

### Key modules
| Path | Role |
|------|------|
| `lib/local-store.ts` | AsyncStorage, users, monsters, logs, results, overheat history |
| `lib/metabolism.ts` | BMR/TDEE/weekly HP, classes, profile validation |
| `lib/overheat.ts` | Daily overheat state machine |
| `lib/dates.ts` | Local `YYYY-MM-DD` week boundaries (no UTC shift) |
| `lib/battle-stats.ts` | Career stats (week win streak, wins, COOL streaks) |

---

## Current focus (open work)
- Food memory autocomplete on Battle (stored on log, not shown in UI)
- Optional `weekly-result` modal screen (route declared, file missing)
- Trim or extend Battle Stats footer line (COOL / last week) per user feedback
