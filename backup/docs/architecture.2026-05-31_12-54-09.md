# Architecture

How the Calories Fighter app is structured: navigation, data flow, and key modules. **Local-first** (no live Supabase client).

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
│  createUser       │               │  Battle | Log | Stats    │
│  (weight+class)   │               └───────────┬─────────────┘
└────────┬────────┘                             │
         │                          ┌───────────┼───────────┐
         │                          ▼           ▼           ▼
         │                      index      history    summary
         │                      Battle       Log    Character Stat
         │                          │
         └──────────────────────────┼──────────────────────────┐
                                    ▼                          ▼
              ┌─────────────────────────────────────────────────────┐
              │  lib/local-store  ·  lib/metabolism  ·  lib/overheat │
              │  lib/dates        ·  lib/battle-stats                 │
              └─────────────────────────────────────────────────────┘
                                    ▲
              ┌─────────────────────┴─────────────────────┐
              │  BattleMonsterSprite · FoodThrowEffect    │
              │  OverheatBar (Battle tab UI)              │
              └───────────────────────────────────────────┘
```

\* `weekly-result` route declared; screen file not implemented.

---

## Navigation (Expo Router)

### Root stack (`app/_layout.tsx`)

1. Load session; `isUserOnboarded(userId)` (any stored user record).
2. Show **onboarding** or **(tabs)**.
3. Onboarding completes with `router.replace('/(tabs)')`.

### Tabs (`app/(tabs)/_layout.tsx`)

| File | Tab | Role |
|------|-----|------|
| `index.tsx` | Battle | Food + kcal log, fixed boss HP, overheat |
| `history.tsx` | Log | History |
| `summary.tsx` | Stats | Character Stat |

---

## Data layer: `lib/local-store.ts`

### Storage

- **Key:** `@calories/local-data`
- **Pattern:** `loadStore()` → mutate → `saveStore()`

### Store shape

```typescript
interface User {
  id: string;
  display_name: string | null;
  sex: 'male' | 'female' | null;
  age: number | null;
  weight_kg: number | null;
  height_cm: number | null;
  calorie_class_id: CalorieClassId | null;
  monster_name: string | null;
  tdee: number | null;  // set when profile complete
}

interface StoreData {
  userId: string | null;
  users: Record<string, User>;
  weeklyMonsters: WeeklyMonster[];
  dailyLogs: DailyLog[];
  foodMemory: FoodMemory[];
  weeklyResults: WeeklyResult[];           // written on week rollover
  dailyOverheat: Record<string, DailyOverheatRecord>;  // today's band (quick lookup)
  dailyOverheatHistory: Record<string, Record<string, OverheatState>>;  // userId → date → band
}
```

**No default hunter values** are injected on load. Missing fields stay `null` until the user saves a complete profile.

### Session

- `ensureAnonymousSession()` — device `userId`
- `ensureUserProfile(userId)` — existing user or **empty** profile shell
- `isUserOnboarded(userId)` — user row exists (after onboarding `createUser`)

### Critical write paths

| Function | Behavior |
|----------|----------|
| `createUser` | Onboarding: `weight_kg` + `calorie_class_id` only; other fields `null` |
| `updateUserProfile` | Full required profile; recalculates `tdee`; calls `recalibrateCurrentWeeklyMonster` |
| `recalibrateCurrentWeeklyMonster` | Normalizes current week to fixed boss life (`WEEKLY_BOSS_HP = 8`) |
| `processWeekRollover` | For ended weeks without a result row → append `weeklyResults` (victory if `current_hp > 0`) |
| `getBattleCareerStats` | Aggregates career metrics via `lib/battle-stats.ts` |
| `createWeeklyMonster` | New week row; `initial_hp`/`current_hp` = fixed 8 HP |
| `logFoodAndUpdateMonster` | Atomic food log append; HP unchanged |
| `deleteDailyLogAndRestoreHp` | Battle delete removes row; HP unchanged (name kept for compatibility) |
| `reduceWeeklyMonsterHp` / `resetWeeklyMonsterHp` | Temporary debug helpers (`-1 HP`, reset full HP) |
| `deleteDailyLog` | Log tab delete — row only, HP unchanged |
| `setDailyOverheatState` | Updates `dailyOverheat` + `dailyOverheatHistory[date]` |
| `upsertFoodMemory` | Called after each Battle log (autocomplete not wired) |

### Week boundaries: `lib/dates.ts`

- `formatLocalDate` — `YYYY-MM-DD` in **local** timezone (avoids `toISOString` UTC shift).
- `getWeekDates()` — Monday–Sunday `start` / `end`.
- `isDateInWeek`, `addDays`, `listDatesInclusive` — used for rollover and streaks.

Monster lookup uses date-in-week range plus legacy week-key repair in `recalibrateCurrentWeeklyMonster`.

---

## Metabolism: `lib/metabolism.ts`

| Export | Role |
|--------|------|
| `CALORIE_CLASSES` | Deficit % + cut labels (shared TDEE baseline) |
| `TDEE_ACTIVITY_MULTIPLIER` | `1.55` for all classes |
| `computeBMR` / `computeTDEE` / `computeTdeeFromProfile` | Mifflin–St Jeor pipeline |
| `computeWeeklyMonsterHp` | `TDEE × 7 × (1 − deficit%)` |
| `isProfileComplete` / `getMissingProfileFields` | Required-field validation |
| `mapOverheatToMonsterState` | Overheat → Stable / Tired / Overheated (Stats Monster Stat) |

---

## Overheat: `lib/overheat.ts`

Pure daily state machine + expressions. See [game-rules](./game-rules.md).

---

## Battle career: `lib/battle-stats.ts`

Pure aggregation from `weeklyResults`, `dailyOverheatHistory`, and `dailyLogs`. Exported as `BattleCareerStats`:

| Field | Role |
|-------|------|
| `weekWinStreak` | Consecutive weekly victories (most recent finished weeks first) |
| `monstersDefeated` | Total weekly wins |
| `weeksPlayed` | Finished weeks count |
| `winRatePercent` | Computed; not shown in UI currently |
| `currentCoolStreak` / `bestCoolStreak` | COOL days (&lt; 80% daily target) |
| `coolDaysThisWeek` / `daysTrackedThisWeek` | This week’s COOL vs tracked days |
| `overheatDaysThisWeek` | Days at OVERHEAT band |
| `lastWeekOutcome` | Victory or defeat for last completed week |

`buildBattleCareerStats()` is called from `getBattleCareerStats()` in local-store.

---

## Screen behavior

### Battle (`app/(tabs)/index.tsx`)

1. `processWeekRollover` on focus.
2. If `!isProfileComplete(user)` → banner, no monster budget, logging disabled.
3. Load/recalibrate weekly monster (`initial_hp = 8`); `dailyTarget` is calorie-based from metabolism (`computeWeeklyMonsterHp(...)/7`), not boss HP.
4. **Monster arena:** `FoodThrowEffect` + `BattleMonsterSprite` inside `monsterArena` (overflow visible for throw arc).
5. Food form: name + **manual kcal** → `logFoodAndUpdateMonster` + `upsertFoodMemory`.
6. On successful log: `setFeedPulse(n => n + 1)` — **visual only** (see below).
7. Overheat recompute on log; band cross persists to history.
8. Today’s log delete uses `deleteDailyLogAndRestoreHp` (HP unchanged).
9. Temporary debug buttons adjust boss HP directly (`Debug Hit -1 HP`, `Reset HP Full`).
10. Card-level `Animated` scale on log; shake on HOT/OVERHEAT applies to whole monster card.

#### Feed animation (visual layer — no storage impact)

| Step | Component | Behavior |
|------|-----------|----------|
| 1 | `FoodThrowEffect` | **🍖** (font ~76px) arcs from lower-right toward monster center; `FOOD_THROW_DURATION_MS` = **820** |
| 2 | `BattleMonsterSprite` | After ~78% of throw time, **munch**: open mouth, 3 chomp scale pulses |
| 3 | `feedPulse` | Integer counter in `index.tsx`; increment after `logFoodAndUpdateMonster` succeeds |

User-entered food name is **not** shown on the projectile (always 🍖 for feedback).

#### `BattleMonsterSprite.tsx`

- SVG body/face; **no** static PNG at runtime.
- Idle: patrol **left ↔ right**, `scaleX` flip at turns, hop + breath loops.
- `state: OverheatState` → body color, eyes, mouth (cool green → overheat red).
- `feedPulse` prop retriggers munch sequence.

#### `FoodThrowEffect.tsx`

- Renders only when `pulse > 0`.
- Exports `FOOD_THROW_DURATION_MS` for munch timing sync.

### Stats (`app/(tabs)/summary.tsx`)

1. Form state for all profile fields (empty until user/onboarding partial data).
2. `hasUnsavedChanges` + `formComplete` gate the Save button.
3. On save: `updateUserProfile` → refresh tables + `getBattleCareerStats`.
4. Read-only blocks: **Current Stats** (table), **Monster Stat** (table), **Battle Stats** (cards via `BattleCareerStatsCards`).
5. `processWeekRollover` on focus (same as Battle).

### History (`app/(tabs)/history.tsx`)

- Up to 100 logs; delete uses `deleteDailyLog` (HP **not** restored).

---

## Event flow: profile save

```
User taps Save (Character Stat)
    │
    ▼
updateUserProfile (all required fields)
    ├─ users.* + tdee
    ├─ recalibrateCurrentWeeklyMonster (set/repair fixed 8 HP)
    └─ buildSavedSnapshot → Current Stats table
    │
    ▼
User opens Battle tab
    ├─ processWeekRollover
    ├─ recalibrateCurrentWeeklyMonster (again on load)
    └─ dailyTarget = computeWeeklyMonsterHp(...)/7
```

---

## Event flow: food log (Battle)

```
User taps + (food name + kcal valid)
    │
    ▼
logFoodAndUpdateMonster
    ├─ dailyLogs.push
    ├─ upsertFoodMemory (food name + kcal)
    └─ overheat recompute → maybe setDailyOverheatState (+ history)
    │
    ▼
UI only (same frame, after await)
    ├─ feedPulse++  → FoodThrowEffect (🍖 arc)
    ├─ BattleMonsterSprite munch (synced delay)
    ├─ card scale spring
    └─ clear inputs + refresh todayLogs state
```

---

## Legacy / unused

| Path | Notes |
|------|--------|
| `supabase/` | SQL + `estimate-food` edge function; not called by app |
| `assets/monster/happy.png` | PNG test asset; Battle uses SVG sprite (PNG left commented in `index.tsx`) |

---

## Future integration

1. Sync `local-store` with remote API if needed.
2. Keep `overheat.ts` / `metabolism.ts` as shared rule modules.
3. Implement `weekly-result` modal UI.
4. Food memory autocomplete on Battle.

See [Game rules](./game-rules.md) for formulas.
