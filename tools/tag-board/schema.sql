CREATE TABLE IF NOT EXISTS comments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tag_id TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'comment',
  author TEXT NOT NULL,
  body TEXT NOT NULL,
  delete_token TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);
CREATE INDEX IF NOT EXISTS comments_tag ON comments (tag_id, created_at);

CREATE TABLE IF NOT EXISTS profiles (
  id TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  community TEXT NOT NULL,
  gender TEXT,
  age INTEGER,
  occupation TEXT,
  occupation_th TEXT,
  origin TEXT,
  neighborhood TEXT,
  stay TEXT,
  interface_language TEXT,
  politeness_register TEXT,
  intro TEXT,
  intro_en TEXT,
  image_prompt TEXT
);

CREATE TABLE IF NOT EXISTS profile_tags (
  profile_id TEXT NOT NULL,
  tag_id TEXT NOT NULL,
  direction TEXT NOT NULL,
  PRIMARY KEY (profile_id, tag_id, direction)
);

CREATE TABLE IF NOT EXISTS profile_images (
  profile_id TEXT PRIMARY KEY,
  mime TEXT NOT NULL,
  data TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS tag_ideas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  label_en TEXT NOT NULL,
  label_th TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL,
  typical_giver TEXT NOT NULL DEFAULT 'either',
  emoji TEXT NOT NULL DEFAULT '',
  author TEXT NOT NULL,
  delete_token TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);
