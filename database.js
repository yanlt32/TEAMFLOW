const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

// Use /tmp for Render deployment, ./database for local development
const isProduction = process.env.NODE_ENV === 'production';
const dbDir = isProduction ? '/tmp' : path.join(__dirname, './database');
const dbPath = path.join(dbDir, 'mindtrack.db');

// Ensure database directory exists
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const db = new sqlite3.Database(dbPath);

// Create tables
db.serialize(() => {
  // Users table
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    type TEXT NOT NULL CHECK(type IN ('employee', 'manager'))
  )`);

  // Emotions table
  db.run(`CREATE TABLE IF NOT EXISTS emotions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    mood TEXT NOT NULL CHECK(mood IN ('happy', 'good', 'neutral', 'stressed', 'overloaded')),
    comment TEXT,
    date TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users (id)
  )`);

  // Goals table
  db.run(`CREATE TABLE IF NOT EXISTS goals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    objective TEXT NOT NULL,
    progress INTEGER DEFAULT 0,
    FOREIGN KEY (user_id) REFERENCES users (id)
  )`);

  // Feedback table (anonymous)
  db.run(`CREATE TABLE IF NOT EXISTS feedback (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    content TEXT NOT NULL,
    date TEXT NOT NULL,
    response TEXT,
    status TEXT DEFAULT 'unread'
  )`);

  db.all(`PRAGMA table_info(feedback)`, (err, columns) => {
    if (err) {
      console.error('Erro ao verificar esquema de feedback:', err);
      return;
    }

    const columnNames = columns.map(col => col.name);

    if (!columnNames.includes('response')) {
      db.run(`ALTER TABLE feedback ADD COLUMN response TEXT`, (alterErr) => {
        if (alterErr) console.error('Erro ao adicionar coluna response:', alterErr);
      });
    }

    if (!columnNames.includes('status')) {
      db.run(`ALTER TABLE feedback ADD COLUMN status TEXT DEFAULT 'unread'`, (alterErr) => {
        if (alterErr) {
          console.error('Erro ao adicionar coluna status:', alterErr);
        } else {
          db.run(`UPDATE feedback SET status = 'unread' WHERE status IS NULL`, (updateErr) => {
            if (updateErr) console.error('Erro ao atualizar status existente:', updateErr);
          });
        }
      });
    }
  });

  console.log('Database initialized successfully');
});

module.exports = db;