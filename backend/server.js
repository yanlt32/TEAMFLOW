const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const path = require('path');
const fs = require('fs');
const db = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'mindtrack-secret-key-2024';

// CORS
app.use(cors({
    origin: [
        'https://mindtrack-pqvu.onrender.com',
        'https://mindtrack-api-pqvu.onrender.com',
        'http://localhost:3000',
        'http://localhost:3001',
        'http://127.0.0.1:3000'
    ],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
    credentials: true,
    optionsSuccessStatus: 200
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Servir frontend
const frontendPath = path.join(__dirname, '../frontend');
if (fs.existsSync(frontendPath)) {
    app.use(express.static(frontendPath));
    console.log('📁 Frontend sendo servido de:', frontendPath);
} else {
    console.log('⚠️ Pasta frontend não encontrada em:', frontendPath);
}

// Logging
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
    next();
});

// ============ MIDDLEWARE ============
const verifyToken = (req, res, next) => {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'Token não fornecido' });
    }

    jwt.verify(token, JWT_SECRET, (err, decoded) => {
        if (err) {
            return res.status(403).json({ error: 'Token inválido' });
        }
        req.userId = decoded.id;
        req.userType = decoded.type;
        req.user = decoded;
        next();
    });
};

// ============ ROTAS PÚBLICAS ============
app.get('/api/health', (req, res) => {
    res.json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'development'
    });
});

app.post('/api/login', async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ error: 'Email e senha são obrigatórios' });
    }

    console.log('Login attempt:', email);

    db.get('SELECT * FROM users WHERE email = ?', [email], async (err, user) => {
        if (err) {
            console.error('Erro na consulta:', err);
            return res.status(500).json({ error: 'Erro interno' });
        }

        if (!user) {
            return res.status(401).json({ error: 'Credenciais inválidas' });
        }

        const valid = await bcrypt.compare(password, user.password);
        if (!valid) {
            return res.status(401).json({ error: 'Credenciais inválidas' });
        }

        const token = jwt.sign(
            { id: user.id, email: user.email, type: user.type, name: user.name },
            JWT_SECRET,
            { expiresIn: '24h' }
        );

        console.log(`💫 Login bem-sucedido: ${email} (${user.type})`);
        res.json({
            token,
            user: { id: user.id, name: user.name, email: user.email, type: user.type }
        });
    });
});

app.get('/api/profile', verifyToken, (req, res) => {
    db.get('SELECT id, name, email, type FROM users WHERE id = ?', [req.userId], (err, user) => {
        if (err) {
            console.error('Erro ao buscar perfil:', err);
            return res.status(500).json({ error: 'Erro interno' });
        }
        if (!user) {
            return res.status(404).json({ error: 'Usuário não encontrado' });
        }
        res.json({ user });
    });
});

// ============ TEAM MEMBERS ============
app.get('/api/team-members', verifyToken, (req, res) => {
    if (req.userType !== 'manager') {
        return res.status(403).json({ error: 'Acesso negado. Apenas gestores.' });
    }

    db.all('SELECT id, name, email, type FROM users WHERE type = ? ORDER BY name', ['employee'], (err, rows) => {
        if (err) {
            console.error('Erro no banco:', err);
            return res.status(500).json({ error: 'Erro ao buscar membros' });
        }
        res.json(rows || []);
    });
});

// ============ EMOÇÕES ============
app.get('/api/emotions', verifyToken, (req, res) => {
    db.all('SELECT id, mood, comment, date FROM emotions WHERE user_id = ? ORDER BY date DESC', [req.userId], (err, rows) => {
        if (err) {
            console.error('Erro ao buscar emoções:', err);
            return res.status(500).json({ error: 'Erro ao buscar emoções' });
        }
        res.json(rows || []);
    });
});

app.post('/api/emotions', verifyToken, (req, res) => {
    const { mood, comment } = req.body;

    if (!mood) {
        return res.status(400).json({ error: 'Humor é obrigatório' });
    }

    const date = new Date().toISOString().split('T')[0];

    db.run(
        'INSERT INTO emotions (user_id, mood, comment, date) VALUES (?, ?, ?, ?)',
        [req.userId, mood, comment || '', date],
        function (err) {
            if (err) {
                console.error('Erro ao salvar emoção:', err);
                return res.status(500).json({ error: 'Erro ao salvar' });
            }
            res.json({ id: this.lastID, message: 'Salvo' });
        }
    );
});

app.put('/api/emotions/:id', verifyToken, (req, res) => {
    const { mood, comment } = req.body;

    db.run(
        'UPDATE emotions SET mood = ?, comment = ? WHERE id = ? AND user_id = ?',
        [mood, comment || '', req.params.id, req.userId],
        function (err) {
            if (err) {
                console.error('Erro ao atualizar emoção:', err);
                return res.status(500).json({ error: 'Erro ao atualizar' });
            }
            if (this.changes === 0) return res.status(404).json({ error: 'Não encontrado' });
            res.json({ message: 'Atualizado' });
        }
    );
});

app.delete('/api/emotions/:id', verifyToken, (req, res) => {
    let query = 'DELETE FROM emotions WHERE id = ?';
    const params = [req.params.id];

    if (req.userType !== 'manager') {
        query += ' AND user_id = ?';
        params.push(req.userId);
    }

    db.run(query, params, function (err) {
        if (err) {
            console.error('Erro ao deletar emoção:', err);
            return res.status(500).json({ error: 'Erro ao deletar' });
        }
        if (this.changes === 0) return res.status(404).json({ error: 'Não encontrado' });
        res.json({ message: 'Deletado' });
    });
});

// ============ METAS ============
app.get('/api/goals', verifyToken, (req, res) => {
    db.all('SELECT id, objective, progress FROM goals WHERE user_id = ? ORDER BY id DESC', [req.userId], (err, rows) => {
        if (err) {
            console.error('Erro ao buscar metas:', err);
            return res.status(500).json({ error: 'Erro ao buscar metas' });
        }
        res.json(rows || []);
    });
});

app.post('/api/goals', verifyToken, (req, res) => {
    const { objective } = req.body;

    if (!objective) {
        return res.status(400).json({ error: 'Objetivo é obrigatório' });
    }

    db.run(
        'INSERT INTO goals (user_id, objective, progress) VALUES (?, ?, ?)',
        [req.userId, objective, 0],
        function (err) {
            if (err) {
                console.error('Erro ao criar meta:', err);
                return res.status(500).json({ error: 'Erro ao criar meta' });
            }
            res.json({ id: this.lastID, message: 'Meta criada' });
        }
    );
});

app.put('/api/goals/:id', verifyToken, (req, res) => {
    const { progress } = req.body;

    db.run(
        'UPDATE goals SET progress = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?',
        [progress, req.params.id, req.userId],
        function (err) {
            if (err) {
                console.error('Erro ao atualizar meta:', err);
                return res.status(500).json({ error: 'Erro ao atualizar' });
            }
            res.json({ message: 'Progresso atualizado' });
        }
    );
});

app.delete('/api/goals/:id', verifyToken, (req, res) => {
    db.run(
        'DELETE FROM goals WHERE id = ? AND user_id = ?',
        [req.params.id, req.userId],
        function (err) {
            if (err) {
                console.error('Erro ao deletar meta:', err);
                return res.status(500).json({ error: 'Erro ao deletar' });
            }
            if (this.changes === 0) return res.status(404).json({ error: 'Meta não encontrada' });
            res.json({ message: 'Meta removida com sucesso' });
        }
    );
});

// ============ FEEDBACK ============
app.post('/api/feedback', verifyToken, (req, res) => {
    const { content } = req.body;

    if (!content || !content.trim()) {
        return res.status(400).json({ error: 'Conteúdo é obrigatório' });
    }

    const date = new Date().toISOString();

    db.run(
        'INSERT INTO feedback (content, date, status) VALUES (?, ?, ?)',
        [content.trim(), date, 'unread'],
        function (err) {
            if (err) {
                console.error('Erro ao inserir feedback:', err);
                return res.status(500).json({ error: 'Erro ao enviar feedback' });
            }
            res.json({ id: this.lastID, message: 'Feedback enviado' });
        }
    );
});

app.get('/api/feedback', verifyToken, (req, res) => {
    if (req.userType !== 'manager') {
        return res.status(403).json({ error: 'Acesso negado' });
    }

    db.all('SELECT id, content, date, status, response FROM feedback ORDER BY date DESC', [], (err, rows) => {
        if (err) {
            console.error('Erro ao buscar feedbacks:', err);
            return res.status(500).json({ error: 'Erro ao buscar feedbacks' });
        }
        res.json(rows || []);
    });
});

app.get('/api/feedback/user', verifyToken, (req, res) => {
    db.all(
        'SELECT id, content, response, date, status FROM feedback WHERE response IS NOT NULL ORDER BY date DESC LIMIT 50',
        [],
        (err, rows) => {
            if (err) {
                console.error('Erro ao buscar feedbacks do usuário:', err);
                return res.status(500).json({ error: 'Erro ao buscar respostas' });
            }
            res.json(rows || []);
        }
    );
});

// ⚠️  ROTA CORRIGIDA: removido responded_at (causava erro 500 em bancos antigos)
// O database.js agora garante que a coluna existe antes do servidor aceitar requisições
app.put('/api/feedback/:id/respond', verifyToken, (req, res) => {
    if (req.userType !== 'manager') {
        return res.status(403).json({ error: 'Acesso negado' });
    }

    const { response } = req.body;

    if (!response || !response.trim()) {
        return res.status(400).json({ error: 'Resposta é obrigatória' });
    }

    db.run(
        'UPDATE feedback SET response = ?, status = ?, responded_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [response.trim(), 'responded', req.params.id],
        function (err) {
            if (err) {
                console.error('Erro SQL ao responder feedback:', err.message);
                return res.status(500).json({ error: 'Erro ao responder', details: err.message });
            }
            if (this.changes === 0) {
                return res.status(404).json({ error: 'Feedback não encontrado' });
            }
            res.json({ message: 'Feedback respondido' });
        }
    );
});

app.put('/api/feedback/:id/status', verifyToken, (req, res) => {
    if (req.userType !== 'manager') {
        return res.status(403).json({ error: 'Acesso negado' });
    }

    const { status } = req.body;
    const allowedStatuses = ['unread', 'read', 'responded'];

    if (!status || !allowedStatuses.includes(status)) {
        return res.status(400).json({ error: `Status inválido. Use: ${allowedStatuses.join(', ')}` });
    }

    db.run(
        'UPDATE feedback SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [status, req.params.id],
        function (err) {
            if (err) {
                console.error('Erro SQL ao atualizar status de feedback:', err.message);
                return res.status(500).json({ error: 'Erro ao atualizar status', details: err.message });
            }
            if (this.changes === 0) {
                return res.status(404).json({ error: 'Feedback não encontrado' });
            }
            res.json({ message: 'Status atualizado' });
        }
    );
});

// ============ MEMBER DETAILS ============
app.get('/api/member/:id', verifyToken, (req, res) => {
    if (req.userType !== 'manager') {
        return res.status(403).json({ error: 'Acesso negado' });
    }

    const memberId = req.params.id;

    db.get('SELECT id, name, email FROM users WHERE id = ?', [memberId], (err, user) => {
        if (err) {
            console.error('Erro ao buscar usuário:', err);
            return res.status(500).json({ error: 'Erro interno' });
        }
        if (!user) {
            return res.status(404).json({ error: 'Usuário não encontrado' });
        }

        db.all('SELECT mood, comment, date FROM emotions WHERE user_id = ? ORDER BY date DESC', [memberId], (err, emotions) => {
            if (err) {
                console.error('Erro ao buscar emoções do membro:', err);
                return res.status(500).json({ error: 'Erro ao buscar emoções' });
            }

            db.all('SELECT id, objective, progress FROM goals WHERE user_id = ?', [memberId], (err, goals) => {
                if (err) {
                    console.error('Erro ao buscar metas do membro:', err);
                    return res.status(500).json({ error: 'Erro ao buscar metas' });
                }

                res.json({
                    ...user,
                    emotions: emotions || [],
                    goals: goals || []
                });
            });
        });
    });
});

// ============ ANALYTICS ============
app.get('/api/team-analytics', verifyToken, (req, res) => {
    if (req.userType !== 'manager') {
        return res.status(403).json({ error: 'Acesso negado' });
    }

    db.get('SELECT COUNT(*) as total FROM users WHERE type = ?', ['employee'], (err, count) => {
        if (err) {
            console.error('Erro ao buscar contagem:', err);
            return res.status(500).json({ error: 'Erro interno' });
        }

        db.all('SELECT mood, COUNT(*) as count FROM emotions GROUP BY mood', [], (err, moods) => {
            if (err) {
                console.error('Erro ao buscar moods:', err);
                return res.status(500).json({ error: 'Erro interno' });
            }

            res.json({
                totalEmployees: count?.total || 0,
                moodDistribution: moods || []
            });
        });
    });
});

// ============ UNLOCK CHECK-IN ============
app.post('/api/unlock-checkin/:userId', verifyToken, (req, res) => {
    if (req.userType !== 'manager') {
        return res.status(403).json({ error: 'Acesso negado: apenas gestores podem desbloquear' });
    }

    const userId = req.params.userId;
    console.log(`🔓 Gestor ${req.userId} desbloqueou check-in do usuário ${userId}`);

    res.json({
        message: 'Check-in desbloqueado com sucesso',
        userId: userId,
        timestamp: new Date().toISOString()
    });
});

// ============ FALLBACK ============
app.get('*', (req, res) => {
    if (req.path.startsWith('/api/')) {
        console.log('⚠️ Rota API não encontrada:', req.path);
        return res.status(404).json({ error: `Rota API não encontrada: ${req.path}` });
    }

    const dashboardPath = path.join(frontendPath, 'dashboard.html');
    const indexPath = path.join(frontendPath, 'index.html');

    if (fs.existsSync(dashboardPath)) {
        res.sendFile(dashboardPath);
    } else if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
    } else {
        res.status(404).send('Página não encontrada');
    }
});

// ============ INICIAR SERVIDOR ============
// Aguardar banco de dados estar pronto antes de ouvir requisições
db._ready
    .then(() => {
        app.listen(PORT, '0.0.0.0', () => {
            console.log(`\n🚀 Servidor MindTrack rodando na porta ${PORT}`);
            console.log(`📡 API: http://localhost:${PORT}/api`);
            console.log(`✅ Rotas disponíveis:`);
            console.log(`   POST /api/login`);
            console.log(`   GET  /api/profile`);
            console.log(`   GET  /api/team-members`);
            console.log(`   GET  /api/emotions`);
            console.log(`   POST /api/emotions`);
            console.log(`   PUT  /api/emotions/:id`);
            console.log(`   DELETE /api/emotions/:id`);
            console.log(`   GET  /api/goals`);
            console.log(`   POST /api/goals`);
            console.log(`   PUT  /api/goals/:id`);
            console.log(`   DELETE /api/goals/:id`);
            console.log(`   GET  /api/feedback`);
            console.log(`   POST /api/feedback`);
            console.log(`   GET  /api/feedback/user`);
            console.log(`   PUT  /api/feedback/:id/respond`);
            console.log(`   PUT  /api/feedback/:id/status`);
            console.log(`   GET  /api/member/:id`);
            console.log(`   GET  /api/team-analytics`);
            console.log(`   POST /api/unlock-checkin/:userId\n`);
        });
    })
    .catch((err) => {
        console.error('❌ Falha ao inicializar banco de dados. Servidor não iniciado.', err);
        process.exit(1);
    });