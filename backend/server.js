const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const path = require('path');
const fs = require('fs');
const db = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'mindtrack-secret-key-2024';

// Configuração de CORS
app.use(cors({
    origin: '*', // Permite todas as origens para teste
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept']
}));

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
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
    next();
});

// Static files
const frontendPath = path.join(__dirname, '../frontend');
if (fs.existsSync(frontendPath)) {
    app.use(express.static(frontendPath));
    console.log(`📁 Servindo arquivos estáticos de: ${frontendPath}`);
}
app.use(express.static(path.join(__dirname, '../')));

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

// ============================================
// AUTH ROUTES
// ============================================
app.post('/api/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            return res.status(400).json({ error: 'Email e senha são obrigatórios' });
        }

        db.get('SELECT id, name, email, type, password FROM users WHERE email = ?', [email.toLowerCase().trim()], async (err, user) => {
            if (err) {
                console.error('Erro na consulta:', err);
                return res.status(500).json({ error: 'Erro interno do servidor' });
            }
            if (!user) {
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

// ============================================
// TEAM MEMBERS ROUTE - CORRIGIDA
// ============================================
app.get('/api/team-members', verifyToken, (req, res) => {
    console.log(`🔍 Buscando membros da equipe - Usuário: ${req.userId}, Tipo: ${req.userType}`);
    
    // Verificar se é manager
    if (req.userType !== 'manager') {
        console.log(`❌ Acesso negado: ${req.userType} não é manager`);
        return res.status(403).json({ error: 'Acesso negado. Apenas gestores podem acessar.' });
    }
    
    db.all('SELECT id, name, email, type FROM users WHERE type = ? ORDER BY name', ['employee'], (err, rows) => {
        if (err) {
            console.error('Erro ao buscar membros:', err);
            return res.status(500).json({ error: 'Erro ao buscar membros da equipe' });
        }
        console.log(`✅ ${rows.length} membros da equipe encontrados`);
        res.json(rows || []);
    });
});

// ============================================
// EMOTIONS ROUTES
// ============================================
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
    const validMoods = ['happy', 'good', 'neutral', 'stressed', 'overloaded'];
    if (!validMoods.includes(mood)) {
        return res.status(400).json({ error: 'Humor inválido' });
    }
    const date = new Date().toISOString().split('T')[0];
    db.run('INSERT INTO emotions (user_id, mood, comment, date) VALUES (?, ?, ?, ?)',
        [req.userId, mood, comment?.trim() || null, date],
        function(err) {
            if (err) {
                console.error('Erro ao salvar emoção:', err);
                return res.status(500).json({ error: 'Erro ao salvar emoção' });
            }
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
            if (err) {
                console.error('Erro ao atualizar:', err);
                return res.status(500).json({ error: 'Erro ao atualizar' });
            }
            if (this.changes === 0) return res.status(404).json({ error: 'Emoção não encontrada' });
            res.json({ message: 'Atualizado com sucesso' });
        });
});

app.delete('/api/emotions/:id', verifyToken, (req, res) => {
    db.run('DELETE FROM emotions WHERE id = ? AND user_id = ?', [req.params.id, req.userId], function(err) {
        if (err) {
            console.error('Erro ao excluir:', err);
            return res.status(500).json({ error: 'Erro ao excluir' });
        }
        if (this.changes === 0) return res.status(404).json({ error: 'Emoção não encontrada' });
        res.json({ message: 'Excluído com sucesso' });
    });
});

// ============================================
// MEMBER DETAILS ROUTE
// ============================================
app.get('/api/member/:id', verifyToken, (req, res) => {
    if (req.userType !== 'manager') {
        return res.status(403).json({ error: 'Acesso negado. Apenas gestores podem acessar.' });
    }
    
    const memberId = req.params.id;
    db.get('SELECT id, name, email, type FROM users WHERE id = ?', [memberId], (err, user) => {
        if (err || !user) {
            return res.status(404).json({ error: 'Membro não encontrado' });
        }
        
        db.all('SELECT mood, comment, date FROM emotions WHERE user_id = ? ORDER BY date DESC', [memberId], (err, emotions) => {
            db.all('SELECT id, objective, progress FROM goals WHERE user_id = ? ORDER BY id DESC', [memberId], (err, goals) => {
                const member = {
                    id: user.id,
                    name: user.name,
                    email: user.email,
                    type: user.type,
                    emotions: emotions || [],
                    goals: goals || []
                };
                res.json(member);
            });
        });
    });
});

// ============================================
// GOALS ROUTES
// ============================================
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
    if (!objective?.trim()) return res.status(400).json({ error: 'Objetivo é obrigatório' });
    db.run('INSERT INTO goals (user_id, objective) VALUES (?, ?)', [req.userId, objective.trim()], function(err) {
        if (err) {
            console.error('Erro ao criar meta:', err);
            return res.status(500).json({ error: 'Erro ao criar meta' });
        }
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
            if (err) {
                console.error('Erro ao atualizar meta:', err);
                return res.status(500).json({ error: 'Erro ao atualizar' });
            }
            if (this.changes === 0) return res.status(404).json({ error: 'Meta não encontrada' });
            res.json({ message: 'Meta atualizada' });
        });
});

app.delete('/api/goals/:id', verifyToken, (req, res) => {
    db.run('DELETE FROM goals WHERE id = ? AND user_id = ?', [req.params.id, req.userId], function(err) {
        if (err) {
            console.error('Erro ao deletar meta:', err);
            return res.status(500).json({ error: 'Erro ao deletar' });
        }
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
        if (err) {
            console.error('Erro ao enviar feedback:', err);
            return res.status(500).json({ error: 'Erro ao enviar feedback' });
        }
        res.status(201).json({ id: this.lastID, message: 'Feedback enviado' });
    });
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
    db.all('SELECT id, content, response, date, status FROM feedback WHERE response IS NOT NULL ORDER BY date DESC LIMIT 20', [], (err, rows) => {
        if (err) {
            console.error('Erro ao buscar feedbacks do usuário:', err);
            return res.status(500).json({ error: 'Erro ao buscar feedbacks' });
        }
        res.json(rows || []);
    });
});

app.put('/api/feedback/:id/status', verifyToken, (req, res) => {
    if (req.userType !== 'manager') {
        return res.status(403).json({ error: 'Acesso negado' });
    }
    const { status } = req.body;
    if (!['unread', 'read', 'responded'].includes(status)) {
        return res.status(400).json({ error: 'Status inválido' });
    }
    db.run('UPDATE feedback SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [status, req.params.id], function(err) {
        if (err) {
            console.error('Erro ao atualizar status:', err);
            return res.status(500).json({ error: 'Erro ao atualizar status' });
        }
        if (this.changes === 0) return res.status(404).json({ error: 'Feedback não encontrado' });
        res.json({ message: 'Status atualizado', id: req.params.id, status });
    });
});

app.put('/api/feedback/:id/respond', verifyToken, (req, res) => {
    if (req.userType !== 'manager') {
        return res.status(403).json({ error: 'Acesso negado' });
    }
    const { response } = req.body;
    if (!response?.trim()) return res.status(400).json({ error: 'Resposta é obrigatória' });
    db.run('UPDATE feedback SET response = ?, status = ?, responded_by = ?, responded_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [response.trim(), 'responded', req.userId, req.params.id],
        function(err) {
            if (err) {
                console.error('Erro ao responder feedback:', err);
                return res.status(500).json({ error: 'Erro ao responder' });
            }
            if (this.changes === 0) return res.status(404).json({ error: 'Feedback não encontrado' });
            res.json({ message: 'Feedback respondido', id: req.params.id });
        });
});

// ============================================
// TEAM ANALYTICS ROUTE
// ============================================
app.get('/api/team-analytics', verifyToken, (req, res) => {
    if (req.userType !== 'manager') {
        return res.status(403).json({ error: 'Acesso negado' });
    }
    
    db.all('SELECT COUNT(*) as total FROM users WHERE type = ?', ['employee'], (err, totalUsers) => {
        db.all('SELECT mood, COUNT(*) as count FROM emotions GROUP BY mood', [], (err, moodStats) => {
            res.json({
                totalEmployees: totalUsers ? totalUsers.total : 0,
                moodDistribution: moodStats || []
            });
        });
    });
});

// ============================================
// ERROR HANDLING
// ============================================
app.use('/api/*', (req, res) => {
    console.log(`⚠️ Rota não encontrada: ${req.method} ${req.path}`);
    res.status(404).json({ error: `Rota não encontrada: ${req.path}` });
});

// Serve frontend
app.get('*', (req, res) => {
    if (req.path.startsWith('/api/')) return;
    
    const indexPath = path.join(frontendPath, 'dashboard.html');
    const loginPath = path.join(frontendPath, 'index.html');
    
    if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
    } else if (fs.existsSync(loginPath)) {
        res.sendFile(loginPath);
    } else {
        res.status(404).send('Página não encontrada');
    }
});

// ============================================
// START SERVER
// ============================================
app.listen(PORT, () => {
    console.log(`\n🚀 Servidor MindTrack rodando na porta ${PORT}`);
    console.log(`📊 Ambiente: ${process.env.NODE_ENV || 'development'}`);
    console.log(`🔗 Health check: http://localhost:${PORT}/api/health`);
    console.log(`🌐 Frontend: http://localhost:${PORT}\n`);
    console.log('👤 Credenciais de teste:');
    console.log('   Admin: admin@mindtrack.com / admin123');
    console.log('   Funcionário: pedro@mindtrack.com / senha123');
    console.log('\n📡 Rotas disponíveis:');
    console.log('   POST /api/login');
    console.log('   GET  /api/team-members');
    console.log('   GET  /api/emotions');
    console.log('   POST /api/emotions');
    console.log('   GET  /api/goals');
    console.log('   GET  /api/feedback');
    console.log('   GET  /api/feedback/user\n');
});

process.on('SIGINT', () => {
    console.log('\n📴 Encerrando servidor...');
    db.close((err) => {
        if (err) console.error('Erro ao fechar banco:', err);
        else console.log('✅ Banco de dados fechado');
        process.exit(0);
    });
});