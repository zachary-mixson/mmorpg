CREATE TABLE IF NOT EXISTS players (
  id SERIAL PRIMARY KEY,
  username VARCHAR(50) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  currency INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ai_weights (
  id SERIAL PRIMARY KEY,
  player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  weights_json JSONB NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  fitness NUMERIC DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Migration: add fitness column if table already exists
ALTER TABLE ai_weights ADD COLUMN IF NOT EXISTS fitness NUMERIC DEFAULT NULL;

CREATE TABLE IF NOT EXISTS upgrades (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  description TEXT NOT NULL,
  price INTEGER NOT NULL,
  type VARCHAR(10) NOT NULL CHECK (type IN ('player', 'bot')),
  stat_key VARCHAR(50) NOT NULL,
  stat_value NUMERIC NOT NULL
);

CREATE TABLE IF NOT EXISTS player_upgrades (
  id SERIAL PRIMARY KEY,
  player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  upgrade_id INTEGER NOT NULL REFERENCES upgrades(id) ON DELETE CASCADE,
  purchased_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Seed player upgrades
INSERT INTO upgrades (name, description, price, type, stat_key, stat_value) VALUES
  ('Move Speed',      'Increases player movement speed',       100, 'player', 'move_speed',      1.2),
  ('Fire Rate',       'Increases player fire rate',            150, 'player', 'fire_rate',        1.3),
  ('Bullet Damage',   'Increases player bullet damage',        200, 'player', 'bullet_damage',    1.5),
  ('Max Health',       'Increases player maximum health',       175, 'player', 'max_health',       1.25),
  ('Shield Duration', 'Increases player shield duration',      250, 'player', 'shield_duration',  1.4),
  ('Dash',            'Unlocks a quick dash ability',          300, 'player', 'dash',             1.0);

-- Seed bot upgrades
INSERT INTO upgrades (name, description, price, type, stat_key, stat_value) VALUES
  ('Reaction Speed',  'Improves bot reaction time',            100, 'bot',    'reaction_speed',   1.2),
  ('Aggression',      'Increases bot aggression level',        125, 'bot',    'aggression',       1.3),
  ('Accuracy',        'Improves bot aiming accuracy',          200, 'bot',    'accuracy',         1.4),
  ('Memory Depth',    'Increases bot memory for tactics',      175, 'bot',    'memory_depth',     2.0),
  ('Health',          'Increases bot maximum health',          150, 'bot',    'health',           1.25),
  ('Fire Rate',       'Increases bot fire rate',               150, 'bot',    'fire_rate',        1.3);
