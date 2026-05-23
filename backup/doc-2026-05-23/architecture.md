# Architecture

This document describes how the Calories Fighter app is structured today: navigation, data flow, and key modules. It reflects the **local-first** implementation (no live Supabase client).

---

## High-level diagram

```
┌─────────────────────────────────────────────────────────────┐
│                     app/_layout.tsx                          │
│  useFrameworkReady → getSession → isUserOnboarded            │
│  Stack: onboarding | (tabs) | weekly-result* | +not-found    │
└──────────────────────────┬──────────────────────────────────┘
                           │
         ┌─────────────────┴─────────────────┐
         ▼                                   ▼
┌─────────────────┐               ┌─────────────────────────┐
│  onboarding.tsx │               │  app/(tabs)/_layout.tsx │
│  createUser     │               │  Battle | Log | Stats    │
└────────┬────────┘               └───────────┬─────────────┘
         │                                    │
         │                          ┌─────────┼─────────┐
         │                          ▼         ▼         ▼
         │                      index    history   summary
         │                          │
         └──────────────────────────┼──────────────────────────┐
                                    ▼                          ▼
                         ┌──────────────────┐      ┌─────────────────┐
                         │  lib/local-store │      │  lib/overheat   │
                         │  AsyncStorage    │      │  (pure logic)   │
                         └──────────────────┘      └─────────────────┘
                                    ▲
                         ┌──────────┴──────────┐
                         │ components/         │
                         │   OverheatBar.tsx   │
                         └─────────────────────┘
```

\* `weekly-result` route is declared but not implemented as a screen file.

---

## Navigation (Expo Router)

### Root stack (`app/_layout.tsx`)

1. On mount: load session and check `isUserOnboarded(userId)`.
2. Until ready: full-screen loading gradient.
3. Render **either** `onboarding` **or** `(tabs)` in the stack (not both), based on `isOnboarded`.

Onboarding completion uses `router.replace('/(tabs)')`. The root layout does not automatically re-read `isOnboarded` until the next app launch unless the stack is remounted.

### Tab navigator (`app/(tabs)/_layout.tsx`)

| File | Tab title | Icon |
|------|-----------|------|
| `index.tsx` | Battle | Zap |
| `history.tsx` | Log | History |
| `summary.tsx` | Stats | TrendingUp |

Tab bar: dark `#111827`, active tint `#FBBF24`.

---

## Data layer: `lib/local-store.ts`

### Storage

- **Key:** `@calories/local-data`
- **Format:** Single JSON object (`StoreData`)
- **Access pattern:** `loadStore()` → mutate → `saveStore()` on every write

### Store shape

```typescript
interface User {
  display_name, sex, age, weight_kg, height_cm,
  calorie_class_id, monster_name, tdee (cached)
}

interface StoreData {
  userId: string | null;                    // Anonymous device user
  users: Record<string, User>;              // Hunter profile by user id
  weeklyMonsters: WeeklyMonster[];          // One per user per week
  dailyLogs: DailyLog[];
  foodMemory: FoodMemory[];
  weeklyResults: WeeklyResult[];            // Read by Stats; not written in battle flow
  dailyOverheat: Record<string, DailyOverheatRecord>; // Per-user daily state
}
```

### Session model

- `ensureAnonymousSession()` — Creates `userId` if missing.
- `getSession()` — Returns `{ user: { id } }` or `null`.
- No passwords or OAuth; ID is a generated string persisted in AsyncStorage.

### Critical write paths

| Function | Behavior |
|----------|----------|
| `createUser` | Creates profile (weight, class, defaults for height/age/sex) |
| `updateUserProfile` | Stats sheet save; recalculates cached TDEE |
| `createWeeklyMonster` | Creates week monster with `initial_hp` = weekly budget |
| `logFoodAndUpdateMonster` | **Atomic:** append `daily_logs` + reduce `current_hp` |
| `deleteDailyLogAndRestoreHp` | **Atomic:** remove log + restore HP (capped at `initial_hp`) |
| `getDailyLogs` | Filter by user, optional `monsterId`, `logDate`, `limit` |
| `getDailyOverheatState` / `setDailyOverheatState` | Persist displayed overheat band per calendar day |

### Week boundaries

Monday–Sunday week is computed in screen code (`getWeekDates()`):

- Find Monday of current week (ISO date string `YYYY-MM-DD`).
- `weekly_monsters` are keyed by `user_id` + `week_start`.

---

## Metabolism: `lib/metabolism.ts`

Pure functions — no I/O. Used by Stats sheet, Battle (weekly budget), and onboarding.

| Export | Role |
|--------|------|
| `CALORIE_CLASSES` | Class id → deficit % (cut intensity labels) |
| `TDEE_ACTIVITY_MULTIPLIER` | Fixed `1.55` moderate baseline for all classes |
| `computeBMR` | Mifflin–St Jeor from weight, height, age, sex |
| `computeTDEE` | `BMR × activityMultiplier` (always `1.55` in app) |
| `computeTdeeFromProfile` | BMR + fixed multiplier helper |
| `computeWeeklyMonsterHp` | `TDEE × 7 × (1 − deficit%)` |
| `mapOverheatToMonsterState` | COOL/WARM/HOT/OVERHEAT → Stable/Tired/Overheated |

---

## Game logic: `lib/overheat.ts`

Pure functions — no I/O. Used by Battle screen and `OverheatBar`.

| Export | Role |
|--------|------|
| `getDailyTarget(weeklyBudget)` | `weeklyBudget / 7` |
| `getUsagePercent(intake, target)` | `intake / target` (decimal) |
| `computeOverheatState(usage)` | COOL / WARM / HOT / OVERHEAT |
| `hasCrossedThreshold(current, usage)` | Whether band changed |
| `getMonsterExpression(state)` | Emoji + label |
| `pickEmotionText(state, logCount)` | Rotating 1–2 word label |
| `shouldShake(state)` | `none` \| `slight` \| `strong` |

---

## UI components

### `components/OverheatBar.tsx`

**Props:** `usagePercent`, `state`, `todayIntake`, `dailyTarget`

- Bar fill width tracks **live** usage (`usagePercent × 100`, capped at 100% width).
- Gradient colors depend on **displayed** `state` (see game-rules).
- OVERHEAT: red glow overlay + optional `+X%` badge when usage > 100%.

### Battle screen (`app/(tabs)/index.tsx`)

Orchestrates:

1. `useFocusEffect` — session, load/create weekly monster, today’s logs, sync overheat state.
2. Food form — description + calories → `logFoodAndUpdateMonster`.
3. Derived `usagePercent` from `todayLogs` + `dailyTarget`.
4. `useEffect` — new calendar day → reset to COOL; threshold cross → update state + persist.
5. Weekly HP bar (unchanged by overheat).
6. Monster emoji + emotion text from **overheat state** (gray status label hidden in UI).

### History (`app/(tabs)/history.tsx`)

- Loads up to 100 logs for user on focus.
- Delete calls `deleteDailyLog` only (does **not** restore weekly HP on the monster).

### Stats (`app/(tabs)/summary.tsx`)

- **Hunter Sheet:** editable identity, body stats, calorie class; read-only BMR/TDEE/weekly HP preview.
- Monster link: name, state (from today’s overheat), current week HP bar.
- `updateUserProfile` on save; does not alter in-progress weekly monster budget.

---

## Hooks

### `hooks/useFrameworkReady.ts`

Calls web-only `window.frameworkReady?.()` when mounted (Bolt / preview integration). No game logic.

---

## Legacy / unused in runtime app

| Path | Notes |
|------|--------|
| `lib/supabase.ts` | May exist in repo; **not imported** by app screens |
| `supabase/migrations/*.sql` | Original Postgres schema (users, monsters, logs, RLS) |
| `supabase/functions/estimate-food` | Edge function for AI calorie estimate; not called |

`tsconfig.json` excludes `supabase/` from TypeScript compilation.

---

## Event flow: food log (Battle)

```
User taps Add
    │
    ▼
parseCalories(caloriesInput)
    │
    ▼
logFoodAndUpdateMonster(userId, monsterId, food, calories, today)
    │  ├─ daily_logs.push
    │  └─ weekly_monsters.current_hp -= calories
    │
    ▼
upsertFoodMemory(...)
    │
    ▼
setState(monster, todayLogs)
    │
    ▼
usagePercent recalculated from todayLogs
    │
    ├─ Bar updates immediately (live fill)
    └─ If hasCrossedThreshold → update overheatState + emotion + AsyncStorage
```

---

## TypeScript paths

`@/*` → project root (see `tsconfig.json`).

---

## Future integration points

If Supabase (or another API) is reintroduced:

1. Replace or sync `lib/local-store.ts` with remote client.
2. Keep `lib/overheat.ts` unchanged — UI can stay state-driven.
3. Wire `weekly_results` writes at week end.
4. Optionally call `estimate-food` for calorie suggestions.

See [Game rules](./game-rules.md) for formula details that must stay consistent across client and server.
