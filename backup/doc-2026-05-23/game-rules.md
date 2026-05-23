# Game Rules

Rules and formulas as implemented in the Calories Fighter app. Two independent systems run in parallel:

1. **Weekly HP** — Monster health for the current Monday–Sunday week.
2. **Daily Overheat** — How much of today’s calorie target you’ve used; drives the monster face and overheat bar.

---

## 1. Player profile

### Player identity (Stats tab — editable)

| Field | Rules |
|-------|--------|
| **Name** | Optional; default **Hunter** |
| **Sex** | Male or Female (Mifflin–St Jeor) |
| **Age** | **13–120** years |

### Body stats (Stats tab — editable)

| Field | Rules |
|-------|--------|
| **Weight** | **40–300 kg**; frequent weigh-ins |
| **Height** | **100–250 cm**; rare updates |

Defaults at first onboarding (if not collected): age **30**, height **170 cm**, sex **male**.

### Calorie class (single selector)

Picks **deficit %** only. TDEE uses one shared moderate-activity baseline for every class (`×1.55`), so a higher class always means a **lower** weekly calorie budget—not a higher one.

| ID | Label | Cut style | Deficit % |
|----|--------|-----------|-----------|
| `casual` | Casual | Gentle cut | 10% |
| `balanced` | Balanced | Moderate cut | 15% (default) |
| `warrior` | Warrior | Strong cut | 20% |
| `berserker` | Berserker | Aggressive cut | 25% |

Legacy difficulty ids (`beginner`, `elite`, `maintenance`) migrate to the nearest class on load.

### BMR (read-only, Mifflin–St Jeor)

```
Men:   BMR = 10 × weightKg + 6.25 × heightCm − 5 × age + 5
Women: BMR = 10 × weightKg + 6.25 × heightCm − 5 × age − 161
```

(Result rounded to integer kcal/day.)

### TDEE (read-only)

```
TDEE = round(BMR × 1.55)
```

Uses a fixed **moderate activity** multiplier (`1.55`) for all calorie classes. Class choice does not change TDEE—only weekly deficit %.

Example (male, 70 kg, 170 cm, 30 yr): BMR ≈ **1,619** → TDEE ≈ **2,509** kcal/day.

---

## 2. Weekly HP system

### Weekly calorie budget (monster max HP)

```
weeklyBudget = TDEE × 7 × (1 − deficitDecimal)
```

Where `deficitDecimal = deficit_percentage / 100`.

**Example (Warrior class, −20% deficit, TDEE 2,509):**

```
weeklyBudget = round(2509 × 7 × (1 − 0.20)) ≈ 14,050 kcal
```

**Example (same TDEE, Casual −10% vs Berserker −25%):** Casual ≈ **15,807** kcal/week; Berserker ≈ **13,172** kcal/week.

Profile edits recalculate TDEE immediately on the Stats sheet; the **current week’s monster HP** is unchanged until the next Monday (new monster creation).

### Weekly monster

- Created once per user per **calendar week** (Monday `week_start` – Sunday `week_end`).
- `initial_hp` = `current_hp` = `weeklyBudget` at creation.
- Stored in local `weeklyMonsters[]`.

### Logging food (weekly impact)

Each log with `calories` C:

```
current_hp = max(0, current_hp − C)
```

- HP **cannot go below 0**.
- Logs are tied to `log_date` (today) and `monster_id`.

### Deleting a log (Battle tab only)

```
current_hp = min(initial_hp, current_hp + C)
```

Restores calories from that entry. Deleting from the **Log** tab removes the row but does **not** restore weekly HP in the current implementation.

### Weekly HP bar (visual only)

HP bar width = `(current_hp / initial_hp) × 100%`

| HP remaining | Bar color |
|--------------|-----------|
| > 70% | Green `#22C55E` |
| 30–70% | Amber `#FBBF24` |
| < 30% | Red `#EF4444` |

The weekly HP bar does **not** control the monster emoji; overheat does.

---

## 3. Daily Overheat system

### Daily target

```
dailyTarget = weeklyBudget / 7
            = monster.initial_hp / 7
```

Same example: **14,050 / 7 ≈ 2,007 kcal/day**

### Today’s intake

```
todayIntake = sum(calories) for all daily_logs where log_date = today
```

Resets implicitly when the calendar date changes (only today’s logs count).

### Usage percent

```
usagePercent = todayIntake / dailyTarget    (decimal; 0.8 = 80%)
displayPercent = usagePercent × 100         (shown on bar label)
```

---

## 4. Overheat state machine

Computed from **usagePercent**:

| State | Condition | Usage display |
|--------|-----------|----------------|
| **COOL** | `usagePercent < 0.8` | 0% – 79.9% |
| **WARM** | `usagePercent < 0.85` | 80% – 84.9% |
| **HOT** | `usagePercent ≤ 1.0` | 85% – 100% |
| **OVERHEAT** | else | > 100% |

### Threshold behavior (monster mood)

The monster **emoji and emotion text only update when crossing into a new band**, not on every log within the same band.

- Example: At 82% (WARM), logging more food that stays under 85% keeps the same face.
- Crossing 85% → HOT updates face, shake, and emotion text.
- State is saved per user per day in `dailyOverheat` and resets to **COOL** on a new calendar day (midnight / next app open on new date).

The **overheat bar fill** still updates on every log to reflect live `usagePercent`.

---

## 5. Monster expression chart (overheat-driven)

| State | Emoji | Label (code)* | Shake | Emotion text (rotates) | Text color |
|--------|-------|---------------|-------|-------------------------|------------|
| **COOL** | 😊 | Happy | None | Calm · Good · Stable | Green |
| **WARM** | 😐 | Alert | None | OK · Careful · Not bad | Amber |
| **HOT** | 😰 | Stressed | Slight | Warning · Focus · Too much | Orange |
| **OVERHEAT** | 🤯 | Panic | Strong | STOP · Danger · Overload | Red |

\* Gray **label** under the emoji is hidden in the UI; emoji + colored emotion text are shown.

Emotion text picks from the list using `todayLogs.length % 3` when the state changes or on load.

---

## 6. Overheat bar UI

| State | Bar appearance |
|--------|----------------|
| **COOL** | Yellow gradient `#FDE68A` → `#FBBF24`; fill grows with usage (0–80%+) |
| **WARM** | Light orange → orange |
| **HOT** | Orange → deep orange |
| **OVERHEAT** | Orange → red, full track glow, red overlay; `+X%` if over 100% |

Bar track label: **Daily Overheat** + rounded **displayPercent**.

Subtext: `{todayIntake} / {dailyTarget} kcal today`

---

## 7. Food logging (Battle tab)

### Inputs

- **Food name** (required, non-empty)
- **Calories** (required, positive integer)

### On submit

1. Append `daily_log` for today.
2. Reduce weekly `current_hp`.
3. Save food to `food_memory` (for future use; not shown in autocomplete yet).
4. Recalculate overheat usage; update bar; maybe update monster if threshold crossed.
5. Play brief monster scale animation.

### Defaults if profile missing

- Weight **70 kg**, height **170 cm**, age **30**, sex **male**
- Class fallback: **balanced** (−15%)
- TDEE fallback: computed from defaults (~**2,350** kcal/day) or stored `user.tdee`

---

## 8. Stats tab (Hunter Sheet) & Log tab

### Stats tab — RPG character sheet

**Editable:** name, sex, age, weight, height, calorie class, optional monster name.

**Read-only (live preview from form + class):** BMR, TDEE, weekly monster HP formula result.

**Monster link:**

| Field | Source |
|-------|--------|
| Monster name | User input or auto `Gloom-XXXX` style from user id |
| Monster state | **Stable** (COOL/WARM), **Tired** (HOT), **Overheated** (OVERHEAT) from today’s overheat |
| Current HP | This week’s `weekly_monsters` row |
| Evolution | Placeholder (future) |

Saving the sheet updates `users` in AsyncStorage and recalculates cached `tdee`. Does not retroactively change the current week’s `initial_hp`.

### Log tab

- Shows up to **100** most recent logs for the user.
- Sorted by `created_at` descending.

---

## 9. Quick reference formulas

| Concept | Formula |
|---------|---------|
| BMR | Mifflin–St Jeor (see §1) |
| TDEE | `round(BMR × activityMultiplier)` |
| Weekly budget (HP) | `round(TDEE × 7 × (1 − deficit%))` |
| Daily target | `weeklyBudget / 7` |
| Usage % | `(todayIntake / dailyTarget) × 100` |
| HP after eating | `current_hp − calories` |
| HP after delete (Battle) | `min(initial_hp, current_hp + calories)` |

---

## 10. Design intent

- **Weekly HP** = long-term “boss fight” for the week (stay under weekly calories).
- **Daily Overheat** = short-term feedback so each day feels reactive (monster gets stressed as you approach today’s limit).
- Systems are **intentionally separate**: you can be COOL today but low weekly HP, or HOT today with plenty of weekly HP left.

---

## Related

- [Project overview](./project-overview.md)
- [Architecture](./architecture.md)
