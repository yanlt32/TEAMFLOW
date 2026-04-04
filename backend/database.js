const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

// Garantir que o diretório database existe
const dbDir = path.join(__dirname, '../database');
if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
    console.log('📁 Diretório database criado:', dbDir);
}

const dbPath = path.join(dbDir, 'mindtrack.db');
console.log('📂 Banco de dados em:', dbPath);

const db = new sqlite3.Database(dbPath);

// Habilitar chaves estrangeiras
db.run('PRAGMA foreign_keys = ON');

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

    // Tabela de feedback
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

    // Garantir que colunas recentes existam em bases antigas
    db.serialize(() => {
        const requiredFeedbackColumns = ['status', 'response', 'responded_by', 'responded_at', 'updated_at'];
        db.all("PRAGMA table_info(feedback)", [], (err, rows) => {
            if (err) {
                console.error('Erro ao verificar schema de feedback:', err);
                return;
            }
            const existingColumns = rows.map(column => column.name);
            requiredFeedbackColumns.forEach(column => {
                if (!existingColumns.includes(column)) {
                    const alterSql = `ALTER TABLE feedback ADD COLUMN ${column} TEXT`;
                    if (column === 'response' || column === 'responded_by' || column === 'responded_at') {
                        db.run(alterSql, err => {
                            if (err) console.error(`Erro ao adicionar coluna ${column}:`, err);
                            else console.log(`✅ Coluna ${column} adicionada à tabela feedback`);
                        });
                    } else {
                        db.run(`ALTER TABLE feedback ADD COLUMN ${column} TEXT DEFAULT 'unread'`, err => {
                            if (err) console.error(`Erro ao adicionar coluna ${column}:`, err);
                            else console.log(`✅ Coluna ${column} adicionada à tabela feedback`);
                        });
                    }
                }
            });
        });
    });

    console.log('✅ Tabelas criadas/verificadas com sucesso');
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
    console.error('❌ Erro no banco de dados:', err.message);
});

// Fechar conexão graceful
process.on('SIGINT', () => {
    console.log('📴 Fechando conexão com o banco de dados...');
    db.close((err) => {
        if (err) console.error('❌ Erro ao fechar banco:', err.message);
        else console.log('✅ Conexão com banco de dados fechada');
        process.exit(0);
    });
});

module.exports = db;