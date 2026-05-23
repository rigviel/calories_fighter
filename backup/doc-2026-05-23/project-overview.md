# Calories Fighter — Project Overview

**Calories Fighter** (also referred to as *Calories Monster* in product docs) is a gamified calorie-tracking app built with **Expo** and **React Native**. Users fight a weekly monster by logging food: calories reduce the monster’s HP. A separate **Daily Overheat** system tracks how close today’s intake is to the daily budget and drives the monster’s mood.

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

1. **Onboarding** — Weight + calorie class → profile and weekly calorie budget.
2. **Weekly battle** — Log meals with name + calories → monster HP drops for the week.
3. **Daily overheat** — Same logs feed a daily usage bar and monster expressions (COOL → OVERHEAT).
4. **History & stats** — Review all logs; edit hunter profile, class, and metabolism on the Stats sheet.

---

## App screens

| Route | Tab / stack | Purpose |
|-------|-------------|---------|
| `app/onboarding.tsx` | Stack (first launch) | Weight, difficulty selection, profile creation |
| `app/(tabs)/index.tsx` | **Battle** | Monster, weekly HP, overheat bar, food logging |
| `app/(tabs)/history.tsx` | **Log** | All food entries, delete |
| `app/(tabs)/summary.tsx` | **Stats** | Hunter Sheet: profile, class, BMR/TDEE, monster link |
| `app/_layout.tsx` | Root | Onboarding vs tabs gate, splash loading |
| `app/+not-found.tsx` | — | 404 |

Root layout also registers `weekly-result` as a modal route; that screen file is not present in the repo yet.

---

## Tech stack

- **UI:** React Native `StyleSheet`, `expo-linear-gradient`, `lucide-react-native` icons
- **Animations:** `react-native-reanimated` / `Animated` (monster scale, shake on HOT/OVERHEAT)
- **State:** React hooks (`useState`, `useCallback`, `useMemo`, `useFocusEffect`)
- **Persistence:** Single JSON blob at `@calories/local-data`

---

## Project structure

```
calories/
├── app/                    # Expo Router screens
│   ├── _layout.tsx         # Root stack + onboarding gate
│   ├── onboarding.tsx
│   └── (tabs)/
│       ├── _layout.tsx     # Bottom tabs
│       ├── index.tsx       # Battle (main game)
│       ├── history.tsx
│       └── summary.tsx
├── components/
│   └── OverheatBar.tsx     # Daily overheat progress UI
├── lib/
│   ├── local-store.ts      # AsyncStorage CRUD
│   └── overheat.ts         # Daily state machine + expressions
├── hooks/
│   └── useFrameworkReady.ts
├── docs/                   # This documentation
└── supabase/               # Legacy SQL + edge function (not wired to app)
```

---

## Getting started

```bash
npm install
npm run dev          # Start Expo dev server
npm run typecheck    # TypeScript check
npm run build:web    # Static web export → dist/
```

No `.env` or Supabase keys are required for the current local-only build.

---

## Design language

- **Background:** Dark slate gradients (`#0F172A` → `#111827`)
- **Accent:** Amber/gold (`#FBBF24`) for CTAs and tab active state
- **Cards:** `#1F2937` surfaces, `#374151` borders
- **Semantic:** Green (safe HP), yellow/orange (overheat), red (danger / overheat glow)

---

## Current limitations

- Data is **device-local** only (no sync, no accounts beyond anonymous ID).
- **Food calories** are entered manually (no AI estimate in the live app).
- **Weekly results** / win tracking UI exists on Stats but `weekly_results` are not written by the battle flow yet.
- **Food memory** is stored on log but not used for auto-fill in the Battle UI.
- Re-onboarding or multi-profile is not supported.

---

## Related docs

- [Architecture](./architecture.md) — Data model, navigation, and module boundaries
- [Game rules](./game-rules.md) — HP, overheat thresholds, expressions, and formulas
