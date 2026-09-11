CREATE TABLE action_budget (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  platform TEXT NOT NULL,
  action_type TEXT NOT NULL,
  window_date TEXT NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  UNIQUE (platform, action_type, window_date)
);
