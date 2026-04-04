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

// ─── helpers Promise ─────────────────────────────────────────────────────────
function runAsync(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.run(sql, params, function (err) {
            if (err) reject(err);
            else resolve({ lastID: this.lastID, changes: this.changes });
        });
    });
}
function allAsync(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.all(sql, params, (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
        });
    });
}
function getAsync(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.get(sql, params, (err, row) => {
            if (err) reject(err);
            else resolve(row);
        });
    });
}

// Adiciona coluna somente se não existir (ignora erro de coluna duplicada)
async function addColumnIfMissing(table, column, definition) {
    try {
        await runAsync(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
        console.log(`  ✅ Coluna '${column}' adicionada`);
    } catch (err) {
        if (err.message && err.message.includes('duplicate column')) {
            // já existe — silencioso
        } else {
            console.error(`  ❌ Erro ao adicionar '${column}':`, err.message);
            throw err;
        }
    }
}

// ─── inicialização (aguardada pelo server.js) ────────────────────────────────
async function initializeDatabase() {
    await runAsync(`CREATE TABLE IF NOT EXISTS users (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        name       TEXT    NOT NULL,
        email      TEXT    UNIQUE NOT NULL,
        password   TEXT    NOT NULL,
        type       TEXT    NOT NULL CHECK(type IN ('employee','manager')),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    await runAsync(`CREATE TABLE IF NOT EXISTS emotions (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id    INTEGER NOT NULL,
        mood       TEXT    NOT NULL CHECK(mood IN ('happy','good','neutral','stressed','overloaded')),
        comment    TEXT,
        date       TEXT    NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
    )`);

    await runAsync(`CREATE TABLE IF NOT EXISTS goals (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id    INTEGER NOT NULL,
        objective  TEXT    NOT NULL,
        progress   INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
    )`);

    await runAsync(`CREATE TABLE IF NOT EXISTS feedback (
        id           INTEGER PRIMARY KEY AUTOINCREMENT,
        content      TEXT     NOT NULL,
        date         DATETIME NOT NULL,
        status       TEXT     DEFAULT 'unread',
        response     TEXT,
        responded_by INTEGER,
        responded_at DATETIME,
        updated_at   DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // Migração: garantir colunas em bancos antigos
    console.log('🔄 Verificando schema do banco...');
    await addColumnIfMissing('feedback', 'status',       "TEXT DEFAULT 'unread'");
    await addColumnIfMissing('feedback', 'response',     'TEXT');
    await addColumnIfMissing('feedback', 'responded_by', 'INTEGER');
    await addColumnIfMissing('feedback', 'responded_at', 'DATETIME');
    await addColumnIfMissing('feedback', 'updated_at',   'DATETIME DEFAULT CURRENT_TIMESTAMP');

    // Sanitizar registros com status NULL
    const fixed = await runAsync("UPDATE feedback SET status = 'unread' WHERE status IS NULL");
    if (fixed.changes > 0) console.log(`  🔄 ${fixed.changes} registro(s) com status NULL corrigido(s)`);

    console.log('✅ Banco de dados pronto');
}

db.getAsync = getAsync;
db.allAsync = allAsync;
db.runAsync = runAsync;

db.on('error', (err) => console.error('❌ Erro no banco:', err.message));

process.on('SIGINT', () => {
    db.close((err) => {
        if (err) console.error('❌ Erro ao fechar banco:', err.message);
        process.exit(0);
    });
});

db._ready = initializeDatabase();
module.exports = db;