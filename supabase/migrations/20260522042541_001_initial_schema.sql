/*
  # Calories Fighter Database Schema

  ## Core Tables
  1. users - User profiles with weight and settings
  2. difficulties - Predefined difficulty levels (Beginner, Warrior, Elite, Maintenance)
  3. weekly_monsters - Weekly monsters with HP tracking
  4. food_memory - Stored food entries for local estimation lookup
  5. daily_logs - Daily food entries and calorie intake
  6. weekly_results - Weekly battle outcomes and badges

  ## Security
  - Enable RLS on all tables
  - Users can only access their own data
*/

CREATE TABLE IF NOT EXISTS difficulties (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  label text NOT NULL,
  deficit_percentage numeric NOT NULL,
  description text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT auth.uid(),
  weight_kg numeric NOT NULL,
  tdee numeric NOT NULL,
  current_difficulty_id uuid REFERENCES difficulties(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile"
  ON users FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON users FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON users FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

CREATE TABLE IF NOT EXISTS weekly_monsters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  week_start date NOT NULL,
  week_end date NOT NULL,
  initial_hp numeric NOT NULL,
  current_hp numeric NOT NULL,
  difficulty_id uuid REFERENCES difficulties(id),
  status text DEFAULT 'active',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, week_start)
);

ALTER TABLE weekly_monsters ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own monsters"
  ON weekly_monsters FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own monsters"
  ON weekly_monsters FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own monsters"
  ON weekly_monsters FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS food_memory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  food_name text NOT NULL,
  calories numeric NOT NULL,
  protein_g numeric,
  carbs_g numeric,
  fat_g numeric,
  serving_size text,
  times_logged integer DEFAULT 1,
  last_used timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, food_name)
);

ALTER TABLE food_memory ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own food memory"
  ON food_memory FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own food memory"
  ON food_memory FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own food memory"
  ON food_memory FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS daily_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  monster_id uuid NOT NULL REFERENCES weekly_monsters(id) ON DELETE CASCADE,
  food_description text NOT NULL,
  calories numeric NOT NULL,
  protein_g numeric,
  carbs_g numeric,
  fat_g numeric,
  log_date date NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, monster_id, log_date, food_description)
);

ALTER TABLE daily_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own logs"
  ON daily_logs FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own logs"
  ON daily_logs FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own logs"
  ON daily_logs FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS weekly_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  monster_id uuid NOT NULL REFERENCES weekly_monsters(id) ON DELETE CASCADE,
  week_start date NOT NULL,
  total_calories numeric NOT NULL,
  target_calories numeric NOT NULL,
  outcome text NOT NULL,
  badge_earned text,
  streak integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE weekly_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own results"
  ON weekly_results FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own results"
  ON weekly_results FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

INSERT INTO difficulties (name, label, deficit_percentage, description) VALUES
  ('beginner', 'Beginner Fighter', 10, '~10% deficit - Safe mode, easiest monster'),
  ('warrior', 'Warrior Mode', 17.5, '~15-20% deficit - Balanced risk/reward'),
  ('elite', 'Elite Fighter', 22.5, '~20-25% deficit - Hardest monster, faster progress'),
  ('maintenance', 'Maintenance Mode', 0, 'No deficit - Habit building and stability')
ON CONFLICT (name) DO NOTHING;
