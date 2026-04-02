const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '../database/mindtrack.db');
const db = new sqlite3.Database(dbPath);

// Criar tabelas
db.serialize(() => {
  // Tabela de usuários
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    type TEXT NOT NULL CHECK(type IN ('employee', 'manager')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // Tabela de emoções
  db.run(`CREATE TABLE IF NOT EXISTS emotions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    mood TEXT NOT NULL CHECK(mood IN ('happy', 'good', 'neutral', 'stressed', 'overloaded')),
    comment TEXT,
    date TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
  )`);

  // Tabela de metas
  db.run(`CREATE TABLE IF NOT EXISTS goals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    objective TEXT NOT NULL,
    progress INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
  )`);

  // Tabela de feedback (anônimo)
  db.run(`CREATE TABLE IF NOT EXISTS feedback (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    content TEXT NOT NULL,
    date DATETIME NOT NULL,
    status TEXT DEFAULT 'unread',
    response TEXT,
    responded_by INTEGER,
    responded_at DATETIME,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // Migração para bancos de dados existentes
  db.all(`PRAGMA table_info(feedback)`, (err, columns) => {
    if (err) {
      console.error('Erro ao verificar estrutura da tabela feedback:', err.message);
      return;
    }

    if (!columns || columns.length === 0) {
      console.log('Tabela feedback não encontrada, será criada automaticamente');
      return;
    }

    console.log('Verificando estrutura da tabela feedback...');
    
    const hasStatus = columns.some(col => col.name === 'status');
    const hasResponse = columns.some(col => col.name === 'response');
    const hasRespondedBy = columns.some(col => col.name === 'responded_by');
    const hasRespondedAt = columns.some(col => col.name === 'responded_at');
    const hasUpdatedAt = columns.some(col => col.name === 'updated_at');

    if (!hasStatus) {
      db.run(`ALTER TABLE feedback ADD COLUMN status TEXT DEFAULT 'unread'`);
    }
    if (!hasResponse) {
      db.run(`ALTER TABLE feedback ADD COLUMN response TEXT`);
    }
    if (!hasRespondedBy) {
      db.run(`ALTER TABLE feedback ADD COLUMN responded_by INTEGER`);
    }
    if (!hasRespondedAt) {
      db.run(`ALTER TABLE feedback ADD COLUMN responded_at DATETIME`);
    }
    if (!hasUpdatedAt) {
      db.run(`ALTER TABLE feedback ADD COLUMN updated_at DATETIME`, () => {
        db.run(`UPDATE feedback SET updated_at = CURRENT_TIMESTAMP WHERE updated_at IS NULL`);
      });
    }
  });

  // Criar índices
  db.run(`CREATE INDEX IF NOT EXISTS idx_emotions_user_id ON emotions(user_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_emotions_date ON emotions(date)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_goals_user_id ON goals(user_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_feedback_status ON feedback(status)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_feedback_date ON feedback(date)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)`);

  console.log('✅ Banco de dados inicializado com sucesso');
});

// Funções Promise
db.getAsync = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, result) => {
      if (err) reject(err);
      else resolve(result);
    });
  });
};

db.allAsync = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
};

db.runAsync = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) reject(err);
      else resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
};

db.on('error', (err) => {
  console.error('Erro no banco de dados:', err.message);
});

process.on('SIGINT', () => {
  console.log('Fechando conexão com o banco de dados...');
  db.close((err) => {
    if (err) {
      console.error('Erro ao fechar banco de dados:', err.message);
    } else {
      console.log('✅ Conexão com banco de dados fechada');
    }
    process.exit(0);
  });
});

module.exports = db;