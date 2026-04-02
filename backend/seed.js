const db = require('./database');
const bcrypt = require('bcryptjs');

async function seedDatabase() {
    console.log('🌱 Iniciando seed do banco de dados...');

    try {
        // Hash passwords
        const adminPassword = await bcrypt.hash('admin123', 12);
        const employeePassword = await bcrypt.hash('senha123', 12);

        // Insert test users
        await db.runAsync(`
            INSERT OR IGNORE INTO users (name, email, password, type)
            VALUES 
                ('Administrador', 'admin@mindtrack.com', ?, 'manager'),
                ('João Silva', 'joao@empresa.com', ?, 'employee'),
                ('Maria Santos', 'maria@empresa.com', ?, 'employee'),
                ('Pedro Costa', 'pedro@mindtrack.com', ?, 'employee')
        `, [adminPassword, employeePassword, employeePassword, employeePassword]);

        // Get users IDs
        const users = await db.allAsync('SELECT id, name FROM users WHERE type = "employee"');
        
        const today = new Date().toISOString().split('T')[0];
        const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
        
        // Insert sample emotions for each user
        for (const user of users) {
            await db.runAsync(`
                INSERT OR IGNORE INTO emotions (user_id, mood, comment, date)
                VALUES 
                    (?, 'happy', 'Ótimo dia! Muito produtivo.', ?),
                    (?, 'good', 'Bom dia, algumas dificuldades mas superei.', ?),
                    (?, 'neutral', 'Dia normal, sem grandes emoções.', ?)
            `, [user.id, today, user.id, yesterday, user.id, new Date(Date.now() - 172800000).toISOString().split('T')[0]]);
        }

        // Insert sample goals
        const goals = [
            [2, 'Melhorar comunicação com a equipe', 75],
            [2, 'Completar certificação técnica', 60],
            [3, 'Organizar rotina de trabalho', 40],
            [3, 'Aprender nova tecnologia', 25],
            [4, 'Reduzir tempo em reuniões improdutivas', 80],
            [4, 'Aumentar produtividade diária', 50]
        ];

        for (const goal of goals) {
            await db.runAsync(`
                INSERT OR IGNORE INTO goals (user_id, objective, progress)
                VALUES (?, ?, ?)
            `, goal);
        }

        // Insert sample feedback
        const feedbacks = [
            'Sistema muito útil para acompanhar o bem-estar da equipe!',
            'Gostaria de mais opções de humor no check-in diário.',
            'O dashboard gerencial é excelente para insights.',
            'Poderia ter lembretes automáticos para o check-in.',
            'Interface muito intuitiva e profissional.',
            'A funcionalidade de metas PDI é muito boa.',
            'O gráfico de evolução semanal ajuda a visualizar o progresso.'
        ];

        for (const feedback of feedbacks) {
            const randomDays = Math.floor(Math.random() * 30);
            const feedbackDate = new Date(Date.now() - (randomDays * 86400000)).toISOString();
            await db.runAsync(`
                INSERT INTO feedback (content, date, status)
                VALUES (?, ?, ?)
            `, [feedback, feedbackDate, randomDays < 10 ? 'unread' : 'read']);
        }

        console.log('✅ Seed concluído com sucesso!');
        console.log('\n👤 Usuários de teste criados:');
        console.log('   Manager: admin@mindtrack.com / admin123');
        console.log('   Employee: joao@empresa.com / senha123');
        console.log('   Employee: maria@empresa.com / senha123');
        console.log('   Employee: pedro@mindtrack.com / senha123');
        console.log('\n📊 Dados de exemplo inseridos:');
        console.log('   - Emoções registradas');
        console.log('   - Metas PDI criadas');
        console.log('   - Feedbacks anônimos');

    } catch (error) {
        console.error('❌ Erro durante o seed:', error);
    } finally {
        db.close();
    }
}

// Run seed if called directly
if (require.main === module) {
    seedDatabase();
}

module.exports = seedDatabase;