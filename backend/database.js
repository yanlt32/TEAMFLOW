const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const dbDir = path.join(__dirname, '../database');
if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
    console.log('📁 Diretório database criado:', dbDir);
}

const dbPath = path.join(dbDir, 'mindtrack.db');
console.log('📂 Banco de dados em:', dbPath);

const db = new sqlite3.Database(dbPath);

db.run('PRAGMA foreign_keys = ON');

// Adiciona coluna se não existir (sem erro se já existir)
function addColumnIfMissing(table, column, definition) {
    return new Promise((resolve) => {
        db.run(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`, (err) => {
            if (err && !err.message.includes('duplicate column')) {
                console.error(`Erro ao adicionar coluna ${column}:`, err.message);
            } else if (!err) {
                console.log(`✅ Coluna ${column} adicionada à tabela ${table}`);
            }
            resolve();
        });
    });
}

async function initializeDatabase() {
    return new Promise((resolve, reject) => {
        db.serialize(async () => {
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
            )`, async (err) => {
                if (err) {
                    console.error('Erro ao criar tabela feedback:', err);
                    reject(err);
                    return;
                }

                // Garantir colunas em bancos antigos — aguardar todas antes de resolver
                await addColumnIfMissing('feedback', 'status', "TEXT DEFAULT 'unread'");
                await addColumnIfMissing('feedback', 'response', 'TEXT');
                await addColumnIfMissing('feedback', 'responded_by', 'INTEGER');
                await addColumnIfMissing('feedback', 'responded_at', 'DATETIME');
                await addColumnIfMissing('feedback', 'updated_at', 'DATETIME DEFAULT CURRENT_TIMESTAMP');

                console.log('✅ Tabelas criadas/verificadas com sucesso');
                resolve();
            });
        });
    });
}

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
        db.run(sql, params, function (err) {
            if (err) reject(err);
            else resolve({ lastID: this.lastID, changes: this.changes });
        });
    });
};

db.on('error', (err) => {
    console.error('❌ Erro no banco de dados:', err.message);
});

process.on('SIGINT', () => {
    console.log('📴 Fechando conexão com o banco de dados...');
    db.close((err) => {
        if (err) console.error('❌ Erro ao fechar banco:', err.message);
        else console.log('✅ Conexão com banco de dados fechada');
        process.exit(0);
    });
});

// Exportar db junto com a Promise de inicialização
db._ready = initializeDatabase();

module.exports = db;