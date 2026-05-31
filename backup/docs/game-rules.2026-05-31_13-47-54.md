# Game Rules

Rules and formulas as implemented in Calories Fighter. Two parallel systems:

1. **Weekly Boss HP** — Monday–Sunday fixed boss life pool (**8 HP**).
2. **Daily Overheat** — Today’s intake vs daily target; drives face and overheat bar.

---

## 1. Player profile

### Required fields (Character Stat)

There are **no stored defaults** (no auto “Hunter”, age 30, etc.). The user must enter:

| Field | Rules |
|-------|--------|
| **Name** | Non-empty trimmed string |
| **Sex** | Male or Female |
| **Age** | **13–120** years |
| **Weight** | **40–300** kg |
| **Height** | **100–250** cm |
| **Calorie class** | One of casual / balanced / warrior / berserker |

Optional: **monster name** (blank → auto name from user id).

**Save** is enabled only when all required fields are valid **and** the form differs from the last saved profile.

### Onboarding (partial profile)

- Collects **weight** + **calorie class** only.
- Other fields remain empty until Character Stat save.

### Calorie class (deficit only)

TDEE uses one shared moderate baseline (**×1.55**) for every class. Class only changes **deficit %**, so a higher tier always means a **lower** weekly HP—not a higher one.

| ID | Label | Cut style | Deficit % |
|----|--------|-----------|-----------|
| `casual` | Casual | Gentle cut | 10% |
| `balanced` | Balanced | Moderate cut | 15% |
| `warrior` | Warrior | Strong cut | 20% |
| `berserker` | Berserker | Aggressive cut | 25% |

Legacy ids (`beginner`, `elite`, `maintenance`) map to nearest class on load.

### BMR (Mifflin–St Jeor)

```
Men:   BMR = round(10×W + 6.25×H − 5×A + 5)
Women: BMR = round(10×W + 6.25×H − 5×A − 161)
```

### TDEE

```
TDEE = round(BMR × 1.55)
```

Class does **not** change TDEE.

---

## 2. Weekly Boss HP system

### Weekly boss life (fixed)

```
WEEKLY_BOSS_HP = 8
```

### Profile save vs week

When the user taps **Save** on Character Stat:

- `tdee` and weekly calorie budget are recalculated (for overheat only).
- The **current week’s** monster HP is normalized to fixed boss life (`initial_hp = 8`, bounded `current_hp`).

### Weekly monster

- One row per user per calendar week (Monday `week_start` – Sunday `week_end`).
- Created on first Battle visit of the week if missing.

### Logging food (Battle tab)

User enters **food name** and **calories (kcal)** manually. Add is disabled until both are valid.

`logFoodAndUpdateMonster` stores the log row (and food memory) but does **not** change boss HP.

**Visual feedback on Add (does not change stored data):** a **🍖** emoji flies toward the monster (~820ms), then the sprite **munches**. The thrown icon is always 🍖 regardless of what the user typed in the food field.

### Delete log

| Where | HP |
|--------|-----|
| **Battle** tab | Row removed; HP unchanged |
| **Log** tab | Row removed; HP **unchanged** |

### Daily hit evaluation (pending hits)

At app focus (Battle or Stats), `processDayHitEvaluation` runs for each **completed** calendar day (before today) not yet recorded in `dailyHitRecords`:

| Condition | Result |
|-----------|--------|
| `usage < 100%` of daily target | +1 `pending_hits` on that week's monster |
| `usage ≥ 100%` (HOT at 100% or OVERHEAT) | No pending hit |

Boss HP is **never** changed by daily evaluation. The user spends banked hits on the Battle tab via **Apply Hit** (`applyPendingHit` → `current_hp -= 1`).

Each day is evaluated once (when the app next runs after that day ends). Re-opening the app does not re-award or revoke hits for the same date.

### Weekly consistency bonus

Stored on the current week's `WeeklyMonster` row:

| Field | Role |
|-------|------|
| `weekly_success_count` | Count of successful on-target days this week (not required to be consecutive) |
| `weekly_bonus_granted` | `true` after the one-time bonus hit for that week |

When a **new** successful day is evaluated (same `usage < 100%` rule as daily pending hits):

1. `weekly_success_count += 1`
2. If `weekly_success_count >= 4` and `weekly_bonus_granted === false` → `pending_hits += 1` and `weekly_bonus_granted = true`

The bonus is **in addition to** the normal +1 pending hit for that day (on the 4th success, the user gets +2 pending hits total that evaluation: daily + bonus).

On **new week** (`createWeeklyMonster`), both fields reset to `0` / `false`. Logic lives in `lib/weekly-consistency-bonus.ts`, invoked from `processDayHitEvaluation`.

### Weekly HP bar

- Segmented life bar with one slot per HP (`8` slots at full).
- HP bar color styling is visual/theme-driven and not tied to calorie thresholds.

Weekly HP does **not** control the Battle monster’s look; **overheat** does (sprite color/face + emotion label below).

---

## 3. Daily Overheat

### Daily target

```
dailyTarget = round(computeWeeklyMonsterHp(tdee, deficit%) / 7)
```

### Usage

```
usagePercent = todayIntake / dailyTarget
```

### States

| State | Condition |
|--------|-----------|
| **COOL** | usage &lt; 80% |
| **WARM** | usage &lt; 85% |
| **HOT** | usage ≤ 100% |
| **OVERHEAT** | usage &gt; 100% |

Emoji/text update on **band cross** only; bar fill updates every log.

End-of-day band is stored in `dailyOverheatHistory` (and today’s pointer in `dailyOverheat`).

---

## 4. Week outcome & Battle Stats (career)

### When a week is finalized

On app focus (Battle or Stats), `processWeekRollover` runs for weeks whose `week_end` is before today and have no `weeklyResults` row yet.

| Outcome | Condition |
|---------|-----------|
| **victory** (`monster_defeated`) | `current_hp > 0` at week end — boss still has life |
| **defeat** | `current_hp ≤ 0` — boss life exhausted |

### Week win streak

Consecutive **victory** outcomes when finished weeks are sorted by `week_start` descending (most recent first). Any defeat breaks the streak.

### Battle Stats UI (Stats tab, below Monster Stat)

Card-based layout (not a table):

| Card / element | Metric | Meaning |
|----------------|--------|---------|
| **Week Win Streak** (full-width) | `weekWinStreak` | Consecutive weekly victories |
| **Total Wins** (half) | `monstersDefeated` | All-time weekly wins |
| **Battles** (half) | `weeksPlayed` | Finished weeks played |
| Empty state | — | Shown when `weeksPlayed === 0` |
| Footer line (optional) | COOL + last week | `currentCoolStreak`, `bestCoolStreak`, `coolDaysThisWeek` / `daysTrackedThisWeek`, `lastWeekOutcome` |

COOL days are derived from `dailyOverheatHistory` when present, else computed from that day’s logs and the week’s `initial_hp`.

---

## 5. Stats tab blocks (after Save)

### Current Stats (table)
Saved profile + metabolism: BMR, TDEE, weekly monster HP, daily target.

### Monster Stat (table)
Monster name, sheet state (Stable / Tired / Overheated from today’s overheat), weekly boss HP current/max, daily target, today’s intake and % of target.

### Battle Stats (cards)
Career metrics — see §4.

---

## 6. Battle tab gating

- If profile is incomplete → banner: complete Character Stat and Save.
- Food logging disabled until profile is complete.
- No fallback TDEE/HP numbers.

---

## 7. Monster expression (Battle)

Battle shows an **animated SVG sprite** (`BattleMonsterSprite`), not a static image. Emotion label text still comes from `pickEmotionText` (e.g. Calm, Warning, STOP).

| Overheat | Sprite look | Card shake | Emotion label examples | Stats “sheet” state |
|----------|-------------|------------|------------------------|---------------------|
| COOL | Green, happy mouth | None | Calm, Good, Stable | Stable |
| WARM | Yellow, neutral mouth | None | OK, Careful | Stable |
| HOT | Orange, worried eyes, sweat | Slight | Warning, Focus | Tired |
| OVERHEAT | Red, dizzy eyes, stress marks | Strong | STOP, Danger | Overheated |

**On food log:** 🍖 throw + munch animation (see §2 logging food). Commented PNG/emoji fallbacks exist in code for rollback only.

---

## 8. Quick reference

| Concept | Formula |
|---------|---------|
| BMR | Mifflin–St Jeor |
| TDEE | `round(BMR × 1.55)` |
| Weekly calorie budget | `round(TDEE × 7 × (1 − deficit%))` |
| Weekly boss HP | `8` (fixed) |
| Daily target | `round(weeklyCalorieBudget / 7)` |
| Pending hit earned | Completed day with `usage < 100%` |
| Weekly consistency bonus | 4 successful days in one week → +1 extra `pending_hits` (once per week) |
| HP changes | **Apply Hit** only (spends 1 pending hit → −1 boss HP); debug reset restores full HP |
| Victory | Boss HP &gt; 0 after Sunday (recorded on rollover) |
| Week win streak | Consecutive `victory` in `weeklyResults` (newest weeks first) |
| COOL day | Daily usage &lt; 80% of target |

---

## 9. Design intent

- **Weekly boss HP** = battle life layer (currently fixed); reduced only by spending **pending hits**.
- **Pending hits** = reward for on-target days; banked until the user taps **Apply Hit**.
- **Daily overheat** = same-day feedback.
- **Separate systems** — COOL today ≠ high weekly HP remaining.
- **Higher calorie class** = deeper deficit, not more calories.

---

## Related

- [Project overview](./project-overview.md)
- [Architecture](./architecture.md)
- [AI context](./AI_CONTEXT.md)
