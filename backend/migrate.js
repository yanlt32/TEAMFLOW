/**
 * migrate.js
 * Execute UMA VEZ no servidor para corrigir o schema do banco.
 * Uso: node migrate.js
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const dbDir = path.join(__dirname, '../database');
const dbPath = path.join(dbDir, 'mindtrack.db');

if (!fs.existsSync(dbPath)) {
    console.error('❌ Banco de dados não encontrado em:', dbPath);
    process.exit(1);
}

console.log('📂 Conectando ao banco:', dbPath);
const db = new sqlite3.Database(dbPath);

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

async function addColumnIfMissing(table, column, definition) {
    try {
        await runAsync(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
        console.log(`  ✅ Coluna '${column}' adicionada`);
    } catch (err) {
        if (err.message.includes('duplicate column')) {
            console.log(`  ℹ️  Coluna '${column}' já existe`);
        } else {
            console.error(`  ❌ Erro ao adicionar coluna '${column}':`, err.message);
            throw err;
        }
    }
}

async function migrate() {
    console.log('\n🔧 Iniciando migração...\n');

    // 1. Verificar schema atual da tabela feedback
    const columns = await allAsync("PRAGMA table_info(feedback)");
    console.log('📋 Colunas atuais da tabela feedback:');
    columns.forEach(c => console.log(`   - ${c.name} (${c.type})`));
    console.log('');

    // 2. Adicionar colunas faltantes
    console.log('➕ Verificando/adicionando colunas necessárias:');
    await addColumnIfMissing('feedback', 'status',       "TEXT DEFAULT 'unread'");
    await addColumnIfMissing('feedback', 'response',     'TEXT');
    await addColumnIfMissing('feedback', 'responded_by', 'INTEGER');
    await addColumnIfMissing('feedback', 'responded_at', 'DATETIME');
    await addColumnIfMissing('feedback', 'updated_at',   'DATETIME DEFAULT CURRENT_TIMESTAMP');

    // 3. Corrigir registros com status NULL
    const fixed = await runAsync(
        "UPDATE feedback SET status = 'unread' WHERE status IS NULL"
    );
    if (fixed.changes > 0) {
        console.log(`\n🔄 ${fixed.changes} registro(s) com status NULL corrigidos para 'unread'`);
    }

    // 4. Verificar schema final
    const finalColumns = await allAsync("PRAGMA table_info(feedback)");
    console.log('\n✅ Schema final da tabela feedback:');
    finalColumns.forEach(c => console.log(`   - ${c.name} (${c.type}) default=${c.dflt_value}`));

    // 5. Verificar dados existentes
    const rows = await allAsync("SELECT id, status, response FROM feedback LIMIT 5");
    if (rows.length > 0) {
        console.log('\n📊 Amostra dos dados (primeiros 5):');
        rows.forEach(r => console.log(`   id=${r.id} status=${r.status} response=${r.response ? 'sim' : 'null'}`));
    }

    console.log('\n🎉 Migração concluída com sucesso!\n');
}

migrate()
    .catch(err => {
        console.error('\n❌ Migração falhou:', err);
        process.exit(1);
    })
    .finally(() => {
        db.close();
    });