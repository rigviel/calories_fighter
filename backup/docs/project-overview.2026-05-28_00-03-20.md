# Calories Fighter — Project Overview

**Calories Fighter** (also *Calories Monster* in AI docs) is a gamified calorie-tracking app built with **Expo** and **React Native**. Users fight a weekly monster by logging food: calories reduce the monster’s HP. A separate **Daily Overheat** system tracks how close today’s intake is to the daily budget and drives the monster’s mood.

---

## Product summary

| Aspect | Detail |
|--------|--------|
| **Platform** | iOS, Android, Web (Expo) |
| **Framework** | Expo SDK 54, React 19, React Native 0.81 |
| **Routing** | [Expo Router](https://docs.expo.dev/router/introduction/) (file-based) |
| **Data** | **Local only** — `@react-native-async-storage/async-storage` |
| **Backend** | None in the running app (Supabase schema/functions exist as legacy reference only) |

---

## Core gameplay loops

1. **Onboarding** — Weight + calorie class (partial profile only).
2. **Character Stat** — Enter full profile (name, sex, age, weight, height, class); **Save** unlocks metabolism and battle budgets.
3. **Weekly battle** — Log food name + kcal → monster weekly HP drops; **🍖** flies in and the sprite munches (visual feedback).
4. **Daily overheat** — Same logs feed daily usage bar and monster sprite mood (COOL → OVERHEAT).
5. **Week end** — If weekly HP remains after Sunday, count as **monster defeated**; results stored in `weeklyResults`.
6. **History** — Review logs; delete from Log tab does not restore weekly HP.

---

## App screens

| Route | Tab / stack | Purpose |
|-------|-------------|---------|
| `app/onboarding.tsx` | Stack (first launch) | Weight + calorie class |
| `app/(tabs)/index.tsx` | **Battle** | Animated monster, weekly HP, overheat bar, food + kcal logging, 🍖 feed animation |
| `app/(tabs)/history.tsx` | **Log** | Food history, delete |
| `app/(tabs)/summary.tsx` | **Stats** | **Character Stat** form + Current / Monster / Battle Stats |
| `app/_layout.tsx` | Root | Onboarding vs tabs gate |
| `app/+not-found.tsx` | — | 404 |

`weekly-result` is registered in the root stack but has no screen file yet.

---

## Battle tab (UX highlights)

| Element | Description |
|---------|-------------|
| **Monster** | SVG sprite walks left/right; color and face match overheat band |
| **Emotion label** | Text under sprite (Calm → STOP) from `overheatState` |
| **Food log** | Name + manual kcal; **+** disabled until valid |
| **Feed FX** | **🍖** (~76px) thrown toward monster (~820ms), then munch animation |
| **Overheat bar** | Daily usage vs target |
| **Weekly HP bar** | Remaining weekly calorie budget |

Game rules and storage are unchanged by feed animation — the user’s typed food name is what gets saved.

---

## Stats tab layout (Character Stat)

**Editable (above Save):**
- Name, sex, age, weight, height, calorie class, optional monster name
- Validation banner when required fields are missing
- **Save** — active (yellow) only when form is complete **and** changed

**Read-only (below Save, after first successful save):**

| Block | UI | Contents |
|--------|-----|-----------|
| **Current Stats** | Table | Saved profile + BMR, TDEE, weekly monster HP, daily target |
| **Monster Stat** | Table + mini HP bar | Live monster name, sheet state, weekly HP, daily target, today’s intake |
| **Battle Stats** | **Cards** | Week Win Streak (hero card), Total Wins, Battles; empty state until first week ends |

**Battle Stats card layout:**
- Full-width card: ⚡ **Week Win Streak** (consecutive weekly victories)
- Two half cards: 🏆 **Total Wins** | 🎯 **Battles**
- Before any finished week: empty state — “Complete your first week to see results”
- After ≥1 finished week: small footer with COOL streak, best COOL, COOL days this week, last week outcome

---

## Tech stack

- **UI:** React Native `StyleSheet`, `expo-linear-gradient`, `lucide-react-native`, `react-native-svg`
- **Animations:** React Native `Animated` — sprite walk/breath/munch, 🍖 throw arc, card shake (HOT/OVERHEAT), log scale pop
- **State:** React hooks (`useState`, `useCallback`, `useMemo`, `useFocusEffect`)
- **Persistence:** Single JSON blob at `@calories/local-data`

---

## Project structure

```
calories/
├── app/
│   ├── _layout.tsx
│   ├── onboarding.tsx
│   └── (tabs)/
│       ├── index.tsx       # Battle (+ feedPulse)
│       ├── history.tsx     # Log
│       └── summary.tsx     # Character Stat
├── assets/
│   └── monster/
│       └── happy.png       # Legacy test asset (not used at runtime)
├── components/
│   ├── BattleMonsterSprite.tsx  # SVG monster + walk/munch
│   ├── FoodThrowEffect.tsx      # 🍖 throw animation
│   └── OverheatBar.tsx
├── lib/
│   ├── local-store.ts
│   ├── metabolism.ts
│   ├── overheat.ts
│   ├── dates.ts
│   └── battle-stats.ts
├── hooks/
│   └── useFrameworkReady.ts
├── docs/
└── supabase/               # Legacy (not wired)
```

---

## Getting started

```bash
npm install
npm run dev
npm run typecheck
npm run build:web
```

No `.env` or Supabase keys required for the local-only build.

---

## Design language

- **Background:** Dark slate gradients (`#0F172A` → `#111827`)
- **Accent:** Amber/gold (`#FBBF24`) for CTAs and active Save
- **Cards:** `#1F2937` surfaces, `#374151` borders
- **Semantic:** Green (safe HP / victory), yellow–orange (overheat), red (danger)

---

## Current limitations

- Data is **device-local** only (anonymous session ID).
- **Food calories** are manual entry (no live AI estimate).
- **Food memory** is saved on log but not used for autocomplete on Battle.
- **Feed animation** always shows 🍖, not the user’s food name or a custom icon per item.
- Re-onboarding / multi-profile not supported.
- `weekly-result` modal UI not implemented (week outcomes appear in Battle Stats).

---

## Related docs

- [Architecture](./architecture.md)
- [Game rules](./game-rules.md)
- [AI context](./AI_CONTEXT.md)
