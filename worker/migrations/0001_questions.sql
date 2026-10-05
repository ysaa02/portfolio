-- Questions visitors ask the chatbot. No IP address or other identifiers are stored.
CREATE TABLE questions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  asked_at TEXT NOT NULL DEFAULT (datetime('now')),
  question TEXT NOT NULL,
  section TEXT
);
