# Game Rules

Rules and formulas as implemented in Calories Fighter. Two parallel systems:

1. **Weekly HP** — Monday–Sunday “boss” calorie pool.
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

## 2. Weekly HP system

### Weekly budget (monster max HP)

```
weeklyBudget = round(TDEE × 7 × (1 − deficit%))
```

**Example (TDEE 2,018, Casual −10%):** `round(2018 × 7 × 0.9) ≈ 12,713` kcal/week.

### Profile save vs week

When the user taps **Save** on Character Stat:

- `tdee` and weekly budget are recalculated.
- The **current week’s** monster is **recalibrated**: `initial_hp` = new budget; `current_hp` = new budget minus calories already logged this week.

### Weekly monster

- One row per user per calendar week (Monday `week_start` – Sunday `week_end`).
- Created on first Battle visit of the week if missing.

### Logging food (Battle tab)

User enters **food name** and **calories (kcal)** manually. Add is disabled until both are valid.

```
current_hp = max(0, current_hp − calories)
```

Log + HP update happen in one atomic write (`logFoodAndUpdateMonster`). Food name and kcal are also stored in `foodMemory` for future autocomplete (UI not wired).

### Delete log

| Where | HP |
|--------|-----|
| **Battle** tab | Restores HP: `min(initial_hp, current_hp + calories)` |
| **Log** tab | Row removed; HP **unchanged** |

### Weekly HP bar colors

| HP left | Color |
|---------|--------|
| > 70% | Green `#22C55E` |
| 30–70% | Amber `#FBBF24` |
| < 30% | Red `#EF4444` |

Weekly HP does **not** control the Battle emoji; overheat does.

---

## 3. Daily Overheat

### Daily target

```
dailyTarget = monster.initial_hp / 7
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
| **victory** (`monster_defeated`) | `current_hp > 0` at week end — user stayed under weekly budget |
| **defeat** | `current_hp ≤ 0` — weekly pool exhausted |

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
Monster name, sheet state (Stable / Tired / Overheated from today’s overheat), weekly HP current/max, daily target, today’s intake and % of target.

### Battle Stats (cards)
Career metrics — see §4.

---

## 6. Battle tab gating

- If profile is incomplete → banner: complete Character Stat and Save.
- Food logging disabled until profile is complete.
- No fallback TDEE/HP numbers.

---

## 7. Monster expression (Battle)

| Overheat | Emoji | Shake | Stats “sheet” state |
|----------|-------|-------|---------------------|
| COOL / WARM | 😊 / 😐 | None | Stable |
| HOT | 😰 | Slight | Tired |
| OVERHEAT | 🤯 | Strong | Overheated |

---

## 8. Quick reference

| Concept | Formula |
|---------|---------|
| BMR | Mifflin–St Jeor |
| TDEE | `round(BMR × 1.55)` |
| Weekly HP | `round(TDEE × 7 × (1 − deficit%))` |
| Daily target | `weeklyHP / 7` |
| HP after eat | `current_hp − calories` |
| Victory | Weekly HP &gt; 0 after Sunday (recorded on rollover) |
| Week win streak | Consecutive `victory` in `weeklyResults` (newest weeks first) |
| COOL day | Daily usage &lt; 80% of target |

---

## 9. Design intent

- **Weekly HP** = weekly discipline (boss fight).
- **Daily overheat** = same-day feedback.
- **Separate systems** — COOL today ≠ high weekly HP remaining.
- **Higher calorie class** = deeper deficit, not more calories.

---

## Related

- [Project overview](./project-overview.md)
- [Architecture](./architecture.md)
- [AI context](./AI_CONTEXT.md)
