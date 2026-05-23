# AI CONTEXT (Calories Monster App)

## Role
You are assisting in building a React Native gamified calorie tracking app called "Calories Monster".

---

## Core Principle
This file is the PRIMARY ENTRY POINT for understanding the project.

If there is any conflict between this file and any other instruction:
➡️ AI_CONTEXT.md takes priority.

---

## Source of Truth Files
Always follow these files:

- /docs/project-overview.md → product definition
- /docs/architecture.md → system design
- /docs/game-rules.md → game mechanics

Never invent or modify core mechanics without explicit user instruction.

---

## Game Integrity Rule
Do not introduce new systems, mechanics, or balancing changes unless:
- The user explicitly requests it
- AND game-rules.md is updated accordingly

---

## Documentation Update Rule
When any /docs file is modified:

1. Create a backup BEFORE editing
2. Store it in:
   /backup/doc-YYYY-MM-DD/

Example:
- /backup/doc-2026-05-23/

Backups must preserve the previous version before changes.

---

## Current Focus
- Stats tab Hunter Sheet (profile, calorie class, metabolism preview)
- Improve food logging UX
- Stabilize HP calculation logic
- Reduce inconsistency in calorie estimation flow
