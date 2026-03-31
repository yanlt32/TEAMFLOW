const db = require('./database');
const bcrypt = require('bcryptjs');

async function seedDatabase() {
    console.log('🌱 Iniciando seed do banco de dados...');

    try {
        // Hash passwords
        const managerPassword = await bcrypt.hash('admin123', 12);
        const employeePassword = await bcrypt.hash('user123', 12);

        // Insert test users
        db.run(`
            INSERT OR IGNORE INTO users (name, email, password, type)
            VALUES
                ('Administrador', 'admin@mindtrack.com', ?, 'manager'),
                ('João Silva', 'joao@empresa.com', ?, 'employee'),
                ('Maria Santos', 'maria@empresa.com', ?, 'employee'),
                ('Pedro Costa', 'pedro@empresa.com', ?, 'employee')
        `, [managerPassword, employeePassword, employeePassword, employeePassword]);

        // Insert sample emotions
        const emotions = [
            [2, 'happy', 'Dia produtivo e tranquilo!', '2024-01-15'],
            [2, 'good', 'Reunião positiva com a equipe', '2024-01-14'],
            [2, 'neutral', 'Dia normal, sem grandes emoções', '2024-01-13'],
            [3, 'stressed', 'Muito trabalho acumulado', '2024-01-15'],
            [3, 'good', 'Consegui entregar o projeto', '2024-01-14'],
            [4, 'overloaded', 'Preciso de férias urgentemente', '2024-01-15'],
            [4, 'neutral', 'Dia corrido mas ok', '2024-01-14']
        ];

        for (const emotion of emotions) {
            db.run(`
                INSERT OR IGNORE INTO emotions (user_id, mood, comment, date)
                VALUES (?, ?, ?, ?)
            `, emotion);
        }

        // Insert sample goals
        const goals = [
            [2, 'Melhorar comunicação com a equipe', 75],
            [2, 'Completar certificação técnica', 60],
            [3, 'Organizar rotina de trabalho', 40],
            [3, 'Aprender nova tecnologia', 25],
            [4, 'Reduzir tempo em reuniões improdutivas', 80]
        ];

        for (const goal of goals) {
            db.run(`
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
            'Interface muito intuitiva e profissional.'
        ];

        for (const feedback of feedbacks) {
            db.run(`
                INSERT OR IGNORE INTO feedback (content, date)
                VALUES (?, datetime('now', '-' || (RANDOM() % 30) || ' days'))
            `, [feedback]);
        }

        console.log('✅ Seed concluído com sucesso!');
        console.log('👤 Usuários de teste criados:');
        console.log('   Manager: admin@mindtrack.com / admin123');
        console.log('   Employee: joao@empresa.com / user123');
        console.log('   Employee: maria@empresa.com / user123');
        console.log('   Employee: pedro@empresa.com / user123');

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