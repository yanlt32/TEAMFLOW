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

  // Tabela de feedback (anônimo) - VERSÃO COMPLETA
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
    
    // Verificar colunas existentes
    const hasStatus = columns.some(col => col.name === 'status');
    const hasResponse = columns.some(col => col.name === 'response');
    const hasRespondedBy = columns.some(col => col.name === 'responded_by');
    const hasRespondedAt = columns.some(col => col.name === 'responded_at');
    const hasUpdatedAt = columns.some(col => col.name === 'updated_at');

    // Adicionar coluna status se não existir
    if (!hasStatus) {
      console.log('Adicionando coluna status na tabela feedback...');
      db.run(`ALTER TABLE feedback ADD COLUMN status TEXT DEFAULT 'unread'`, (alterErr) => {
        if (alterErr) {
          console.warn('Erro ao adicionar coluna status:', alterErr.message);
        } else {
          console.log('✅ Coluna status adicionada com sucesso');
        }
      });
    }

    // Adicionar coluna response se não existir
    if (!hasResponse) {
      console.log('Adicionando coluna response na tabela feedback...');
      db.run(`ALTER TABLE feedback ADD COLUMN response TEXT`, (alterErr) => {
        if (alterErr) {
          console.warn('Erro ao adicionar coluna response:', alterErr.message);
        } else {
          console.log('✅ Coluna response adicionada com sucesso');
        }
      });
    }

    // Adicionar coluna responded_by se não existir
    if (!hasRespondedBy) {
      console.log('Adicionando coluna responded_by na tabela feedback...');
      db.run(`ALTER TABLE feedback ADD COLUMN responded_by INTEGER`, (alterErr) => {
        if (alterErr) {
          console.warn('Erro ao adicionar coluna responded_by:', alterErr.message);
        } else {
          console.log('✅ Coluna responded_by adicionada com sucesso');
        }
      });
    }

    // Adicionar coluna responded_at se não existir
    if (!hasRespondedAt) {
      console.log('Adicionando coluna responded_at na tabela feedback...');
      db.run(`ALTER TABLE feedback ADD COLUMN responded_at DATETIME`, (alterErr) => {
        if (alterErr) {
          console.warn('Erro ao adicionar coluna responded_at:', alterErr.message);
        } else {
          console.log('✅ Coluna responded_at adicionada com sucesso');
        }
      });
    }

    // Adicionar coluna updated_at se não existir (SEM DEFAULT VALUE para evitar erro)
    if (!hasUpdatedAt) {
      console.log('Adicionando coluna updated_at na tabela feedback...');
      db.run(`ALTER TABLE feedback ADD COLUMN updated_at DATETIME`, (alterErr) => {
        if (alterErr) {
          console.warn('Erro ao adicionar coluna updated_at:', alterErr.message);
        } else {
          console.log('✅ Coluna updated_at adicionada com sucesso');
          // Após adicionar a coluna, atualizar registros existentes com a data atual
          db.run(`UPDATE feedback SET updated_at = CURRENT_TIMESTAMP WHERE updated_at IS NULL`, (updateErr) => {
            if (updateErr) {
              console.warn('Erro ao atualizar valores de updated_at:', updateErr.message);
            } else {
              console.log('✅ Valores de updated_at inicializados com sucesso');
            }
          });
        }
      });
    }

    console.log('✅ Verificação da tabela feedback concluída');
  });

  // Criar índices para melhor performance
  db.run(`CREATE INDEX IF NOT EXISTS idx_emotions_user_id ON emotions(user_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_emotions_date ON emotions(date)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_goals_user_id ON goals(user_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_feedback_status ON feedback(status)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_feedback_date ON feedback(date)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)`);

  console.log('✅ Banco de dados inicializado com sucesso');
});

// Função de utilidade para executar queries com Promise
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

// Tratamento de erros do banco de dados
db.on('error', (err) => {
  console.error('Erro no banco de dados:', err.message);
});

// Encerramento gracioso
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