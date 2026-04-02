const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const path = require('path');
const db = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'mindtrack-secret-key-2024';

// Configuração de CORS para produção
const allowedOrigins = [
    'http://localhost:3000',
    'http://localhost:3001',
    'http://localhost:3002',
    'http://127.0.0.1:3000',
    'https://mindtrack-pvqu.onrender.com',
    process.env.FRONTEND_URL
].filter(Boolean);

// CORS middleware configurado corretamente
app.use(cors({
    origin: function(origin, callback) {
        // Permitir requisições sem origem (como mobile apps ou curl)
        if (!origin) return callback(null, true);
        
        if (allowedOrigins.indexOf(origin) !== -1 || process.env.NODE_ENV !== 'production') {
            callback(null, true);
        } else {
            console.log('Origem bloqueada pelo CORS:', origin);
            callback(null, true); // Em desenvolvimento, permite todas
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

// Body parser middleware
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ extended: true }));

// Security headers
app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    next();
});

// Request logging
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path} - Origin: ${req.headers.origin || 'same-origin'}`);
    next();
});

// Static files
const frontendPath = path.join(__dirname, '../frontend');
app.use(express.static(frontendPath));

// ============================================
// JWT MIDDLEWARE
// ============================================
const verifyToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'Token não fornecido', code: 'TOKEN_MISSING' });
    }

    jwt.verify(token, JWT_SECRET, (err, decoded) => {
        if (err) {
            return res.status(403).json({ error: 'Token inválido', code: 'TOKEN_INVALID' });
        }
        req.userId = decoded.id;
        req.userType = decoded.type;
        req.user = decoded;
        next();
    });
};

const requireRole = (roles) => {
    return (req, res, next) => {
        if (!roles.includes(req.userType)) {
            return res.status(403).json({ error: 'Acesso negado', code: 'INSUFFICIENT_PERMISSIONS' });
        }
        next();
    };
};

// ============================================
// HEALTH CHECK
// ============================================
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'OK', 
        timestamp: new Date().toISOString(), 
        version: '1.0.0', 
        port: PORT,
        environment: process.env.NODE_ENV || 'development'
    });
});

// Rota de configuração para o frontend
app.get('/api/config', (req, res) => {
    const baseUrl = process.env.RENDER_EXTERNAL_URL || `http://localhost:${PORT}`;
    res.json({
        apiUrl: `${baseUrl}/api`,
        port: PORT,
        version: '1.0.0',
        environment: process.env.NODE_ENV || 'development'
    });
});

// ============================================
// AUTH ROUTES
// ============================================
app.post('/api/register', async (req, res) => {
    try {
        const { name, email, password, type } = req.body;
        if (!name || !email || !password || !type) {
            return res.status(400).json({ error: 'Todos os campos são obrigatórios' });
        }
        if (!['employee', 'manager'].includes(type)) {
            return res.status(400).json({ error: 'Tipo de usuário inválido' });
        }
        if (password.length < 6) {
            return res.status(400).json({ error: 'Senha deve ter pelo menos 6 caracteres' });
        }

        const hashedPassword = await bcrypt.hash(password, 12);
        db.run('INSERT INTO users (name, email, password, type) VALUES (?, ?, ?, ?)',
            [name.trim(), email.toLowerCase().trim(), hashedPassword, type],
            function(err) {
                if (err) {
                    if (err.message.includes('UNIQUE constraint failed')) {
                        return res.status(409).json({ error: 'Email já cadastrado' });
                    }
                    throw err;
                }
                res.status(201).json({ id: this.lastID, message: 'Usuário criado com sucesso' });
            });
    } catch (error) {
        console.error('Erro ao registrar:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

app.post('/api/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            return res.status(400).json({ error: 'Email e senha são obrigatórios' });
        }

        db.get('SELECT id, name, email, type, password FROM users WHERE email = ?', [email.toLowerCase().trim()], async (err, user) => {
            if (err || !user) {
                return res.status(401).json({ error: 'Credenciais inválidas' });
            }
            const isValid = await bcrypt.compare(password, user.password);
            if (!isValid) {
                return res.status(401).json({ error: 'Credenciais inválidas' });
            }
            const token = jwt.sign({ id: user.id, email: user.email, type: user.type, name: user.name }, JWT_SECRET, { expiresIn: '24h' });
            res.json({ token, user: { id: user.id, name: user.name, email: user.email, type: user.type } });
        });
    } catch (error) {
        console.error('Erro no login:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

app.get('/api/profile', verifyToken, (req, res) => {
    db.get('SELECT id, name, email, type FROM users WHERE id = ?', [req.userId], (err, user) => {
        if (err || !user) return res.status(404).json({ error: 'Usuário não encontrado' });
        res.json(user);
    });
});

// ============================================
// EMOTIONS ROUTES
// ============================================
app.get('/api/emotions', verifyToken, (req, res) => {
    db.all('SELECT id, mood, comment, date FROM emotions WHERE user_id = ? ORDER BY date DESC', [req.userId], (err, rows) => {
        if (err) return res.status(500).json({ error: 'Erro ao buscar emoções' });
        res.json(rows || []);
    });
});

app.post('/api/emotions', verifyToken, (req, res) => {
    const { mood, comment } = req.body;
    const validMoods = ['happy', 'good', 'neutral', 'stressed', 'overloaded'];
    if (!validMoods.includes(mood)) {
        return res.status(400).json({ error: 'Humor inválido' });
    }
    const date = new Date().toISOString().split('T')[0];
    db.run('INSERT INTO emotions (user_id, mood, comment, date) VALUES (?, ?, ?, ?)',
        [req.userId, mood, comment?.trim() || null, date],
        function(err) {
            if (err) return res.status(500).json({ error: 'Erro ao salvar emoção' });
            res.status(201).json({ id: this.lastID, message: 'Emoção registrada' });
        });
});

app.put('/api/emotions/:id', verifyToken, (req, res) => {
    const { mood, comment } = req.body;
    const validMoods = ['happy', 'good', 'neutral', 'stressed', 'overloaded'];
    if (!validMoods.includes(mood)) {
        return res.status(400).json({ error: 'Humor inválido' });
    }
    db.run('UPDATE emotions SET mood = ?, comment = ? WHERE id = ? AND user_id = ?',
        [mood, comment?.trim() || null, req.params.id, req.userId],
        function(err) {
            if (err) return res.status(500).json({ error: 'Erro ao atualizar' });
            if (this.changes === 0) return res.status(404).json({ error: 'Emoção não encontrada' });
            res.json({ message: 'Atualizado com sucesso' });
        });
});

app.delete('/api/emotions/:id', verifyToken, (req, res) => {
    db.run('DELETE FROM emotions WHERE id = ? AND user_id = ?', [req.params.id, req.userId], function(err) {
        if (err) return res.status(500).json({ error: 'Erro ao excluir' });
        if (this.changes === 0) return res.status(404).json({ error: 'Emoção não encontrada' });
        res.json({ message: 'Excluído com sucesso' });
    });
});

// Team emotions (manager only)
app.get('/api/team-emotions', verifyToken, requireRole(['manager']), (req, res) => {
    const dateLimit = new Date();
    dateLimit.setDate(dateLimit.getDate() - 30);
    db.all(`SELECT e.id, e.mood, e.comment, e.date, u.name, u.email FROM emotions e JOIN users u ON e.user_id = u.id WHERE e.date >= ? ORDER BY e.date DESC`,
        [dateLimit.toISOString().split('T')[0]], (err, rows) => {
            if (err) return res.status(500).json({ error: 'Erro ao buscar emoções da equipe' });
            res.json(rows || []);
        });
});

// Team members list (manager only)
app.get('/api/team-members', verifyToken, requireRole(['manager']), (req, res) => {
    db.all('SELECT id, name, email, type FROM users WHERE type = ? ORDER BY name', ['employee'], (err, rows) => {
        if (err) return res.status(500).json({ error: 'Erro ao buscar membros' });
        res.json(rows || []);
    });
});

// Get member details (manager only)
app.get('/api/member/:id', verifyToken, requireRole(['manager']), (req, res) => {
    const memberId = req.params.id;
    db.all(`SELECT u.name, u.email, u.type, e.mood, e.comment, e.date FROM users u LEFT JOIN emotions e ON u.id = e.user_id WHERE u.id = ? ORDER BY e.date DESC`, [memberId], (err, rows) => {
        if (err || rows.length === 0) return res.status(404).json({ error: 'Membro não encontrado' });
        db.all('SELECT id, objective, progress FROM goals WHERE user_id = ? ORDER BY id DESC', [memberId], (err, goals) => {
            const member = {
                id: memberId,
                name: rows[0].name,
                email: rows[0].email,
                type: rows[0].type,
                emotions: rows.filter(r => r.mood).map(r => ({ mood: r.mood, comment: r.comment, date: r.date })),
                goals: goals || []
            };
            res.json(member);
        });
    });
});

// ============================================
// GOALS ROUTES
// ============================================
app.get('/api/goals', verifyToken, (req, res) => {
    db.all('SELECT id, objective, progress FROM goals WHERE user_id = ? ORDER BY id DESC', [req.userId], (err, rows) => {
        if (err) return res.status(500).json({ error: 'Erro ao buscar metas' });
        res.json(rows || []);
    });
});

app.post('/api/goals', verifyToken, (req, res) => {
    const { objective } = req.body;
    if (!objective?.trim()) return res.status(400).json({ error: 'Objetivo é obrigatório' });
    db.run('INSERT INTO goals (user_id, objective) VALUES (?, ?)', [req.userId, objective.trim()], function(err) {
        if (err) return res.status(500).json({ error: 'Erro ao criar meta' });
        res.status(201).json({ id: this.lastID, message: 'Meta criada' });
    });
});

app.put('/api/goals/:id', verifyToken, (req, res) => {
    const { progress } = req.body;
    if (typeof progress !== 'number' || progress < 0 || progress > 100) {
        return res.status(400).json({ error: 'Progresso deve ser entre 0 e 100' });
    }
    db.run('UPDATE goals SET progress = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?', 
        [progress, req.params.id, req.userId], function(err) {
            if (err) return res.status(500).json({ error: 'Erro ao atualizar' });
            if (this.changes === 0) return res.status(404).json({ error: 'Meta não encontrada' });
            res.json({ message: 'Meta atualizada' });
        });
});

app.delete('/api/goals/:id', verifyToken, (req, res) => {
    db.run('DELETE FROM goals WHERE id = ? AND user_id = ?', [req.params.id, req.userId], function(err) {
        if (err) return res.status(500).json({ error: 'Erro ao deletar' });
        if (this.changes === 0) return res.status(404).json({ error: 'Meta não encontrada' });
        res.json({ message: 'Meta removida' });
    });
});

// ============================================
// FEEDBACK ROUTES
// ============================================
app.post('/api/feedback', (req, res) => {
    const { content } = req.body;
    if (!content?.trim()) return res.status(400).json({ error: 'Conteúdo é obrigatório' });
    const date = new Date().toISOString();
    db.run('INSERT INTO feedback (content, date, status) VALUES (?, ?, ?)', [content.trim(), date, 'unread'], function(err) {
        if (err) return res.status(500).json({ error: 'Erro ao enviar feedback' });
        res.status(201).json({ id: this.lastID, message: 'Feedback enviado' });
    });
});

app.get('/api/feedback', verifyToken, requireRole(['manager']), (req, res) => {
    db.all('SELECT id, content, date, status, response FROM feedback ORDER BY date DESC', [], (err, rows) => {
        if (err) return res.status(500).json({ error: 'Erro ao buscar feedbacks' });
        res.json(rows || []);
    });
});

app.get('/api/feedback/user', verifyToken, (req, res) => {
    db.all('SELECT id, content, response, date, status FROM feedback WHERE response IS NOT NULL ORDER BY date DESC LIMIT 20', [], (err, rows) => {
        if (err) return res.status(500).json({ error: 'Erro ao buscar feedbacks' });
        res.json(rows || []);
    });
});

app.put('/api/feedback/:id/status', verifyToken, requireRole(['manager']), (req, res) => {
    const { status } = req.body;
    if (!['unread', 'read', 'responded'].includes(status)) {
        return res.status(400).json({ error: 'Status inválido' });
    }
    db.run('UPDATE feedback SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [status, req.params.id], function(err) {
        if (err) return res.status(500).json({ error: 'Erro ao atualizar status' });
        if (this.changes === 0) return res.status(404).json({ error: 'Feedback não encontrado' });
        res.json({ message: 'Status atualizado', id: req.params.id, status });
    });
});

app.put('/api/feedback/:id/respond', verifyToken, requireRole(['manager']), (req, res) => {
    const { response } = req.body;
    if (!response?.trim()) return res.status(400).json({ error: 'Resposta é obrigatória' });
    db.run('UPDATE feedback SET response = ?, status = ?, responded_by = ?, responded_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [response.trim(), 'responded', req.userId, req.params.id],
        function(err) {
            if (err) return res.status(500).json({ error: 'Erro ao responder' });
            if (this.changes === 0) return res.status(404).json({ error: 'Feedback não encontrado' });
            res.json({ message: 'Feedback respondido', id: req.params.id });
        });
});

// ============================================
// ANALYTICS ROUTES
// ============================================
app.get('/api/analytics/overview', verifyToken, requireRole(['manager']), (req, res) => {
    db.get('SELECT COUNT(*) as total FROM users', [], (err, userCount) => {
        if (err) return res.status(500).json({ error: 'Erro ao buscar analytics' });
        const dateLimit = new Date();
        dateLimit.setDate(dateLimit.getDate() - 30);
        db.all('SELECT mood, COUNT(*) as count FROM emotions WHERE date >= ? GROUP BY mood', [dateLimit.toISOString().split('T')[0]], (err, moodStats) => {
            if (err) return res.status(500).json({ error: 'Erro ao buscar estatísticas' });
            db.all('SELECT content, date FROM feedback ORDER BY date DESC LIMIT 5', [], (err, feedback) => {
                res.json({ totalUsers: userCount.total, moodStats: moodStats || [], recentFeedback: feedback || [] });
            });
        });
    });
});

// ============================================
// ERROR HANDLING
// ============================================
app.use('/api/*', (req, res) => {
    console.log(`⚠️ Rota não encontrada: ${req.method} ${req.path}`);
    res.status(404).json({ error: 'Rota não encontrada', path: req.path });
});

// Serve frontend
app.get('*', (req, res) => {
    if (req.path.startsWith('/api/')) return;
    res.sendFile(path.join(frontendPath, 'dashboard.html'), (err) => {
        if (err) {
            res.sendFile(path.join(frontendPath, 'index.html'));
        }
    });
});

app.use((err, req, res, next) => {
    console.error('Erro não tratado:', err);
    res.status(500).json({ error: 'Erro interno do servidor' });
});

// ============================================
// START SERVER
// ============================================
const startServer = (port) => {
    const server = app.listen(port, () => {
        console.log(`\n🚀 Servidor MindTrack rodando na porta ${port}`);
        console.log(`📊 Ambiente: ${process.env.NODE_ENV || 'development'}`);
        console.log(`🔗 Health check: http://localhost:${port}/api/health`);
        console.log(`🌐 Frontend: http://localhost:${port}\n`);
        console.log('👤 Credenciais de teste:');
        console.log('   Admin: admin@mindtrack.com / admin123');
        console.log('   Funcionário: pedro@mindtrack.com / senha123');
    }).on('error', (err) => {
        if (err.code === 'EADDRINUSE') {
            console.log(`⚠️ Porta ${port} ocupada, tentando porta ${port + 1}...`);
            startServer(port + 1);
        } else {
            console.error('Erro no servidor:', err);
            process.exit(1);
        }
    });
};

startServer(PORT);

process.on('SIGINT', () => {
    console.log('\n📴 Encerrando servidor...');
    db.close((err) => {
        if (err) console.error('Erro ao fechar banco:', err);
        else console.log('✅ Banco de dados fechado');
        process.exit(0);
    });
});