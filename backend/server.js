const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const path = require('path');
const fs = require('fs');
const db = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = 'mindtrack-secret-key-2024';

// CORS - Permitir todas as origens em produção
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Servir arquivos estáticos do frontend
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
        
        res.json({
            token,
            user: { id: user.id, name: user.name, email: user.email, type: user.type }
        });
    });
});

// ============ ROTA TEAM-MEMBERS ============
app.get('/api/team-members', verifyToken, (req, res) => {
    console.log('GET /api/team-members - Usuário:', req.userType);
    
    if (req.userType !== 'manager') {
        return res.status(403).json({ error: 'Acesso negado. Apenas gestores.' });
    }
    
    db.all('SELECT id, name, email, type FROM users WHERE type = ? ORDER BY name', ['employee'], (err, rows) => {
        if (err) {
            console.error('Erro no banco:', err);
            return res.status(500).json({ error: 'Erro ao buscar membros' });
        }
        console.log(`✅ ${rows.length} membros encontrados`);
        res.json(rows || []);
    });
});

// ============ ROTAS DE EMOÇÕES ============
app.get('/api/emotions', verifyToken, (req, res) => {
    db.all('SELECT id, mood, comment, date FROM emotions WHERE user_id = ? ORDER BY date DESC', [req.userId], (err, rows) => {
        if (err) return res.status(500).json({ error: 'Erro ao buscar emoções' });
        res.json(rows || []);
    });
});

app.post('/api/emotions', verifyToken, (req, res) => {
    const { mood, comment } = req.body;
    const date = new Date().toISOString().split('T')[0];
    
    db.run(
        'INSERT INTO emotions (user_id, mood, comment, date) VALUES (?, ?, ?, ?)',
        [req.userId, mood, comment || '', date],
        function(err) {
            if (err) return res.status(500).json({ error: 'Erro ao salvar' });
            res.json({ id: this.lastID, message: 'Salvo' });
        }
    );
});

app.put('/api/emotions/:id', verifyToken, (req, res) => {
    const { mood, comment } = req.body;
    
    db.run(
        'UPDATE emotions SET mood = ?, comment = ? WHERE id = ? AND user_id = ?',
        [mood, comment || '', req.params.id, req.userId],
        function(err) {
            if (err) return res.status(500).json({ error: 'Erro ao atualizar' });
            if (this.changes === 0) return res.status(404).json({ error: 'Não encontrado' });
            res.json({ message: 'Atualizado' });
        }
    );
});

app.delete('/api/emotions/:id', verifyToken, (req, res) => {
    db.run(
        'DELETE FROM emotions WHERE id = ? AND user_id = ?',
        [req.params.id, req.userId],
        function(err) {
            if (err) return res.status(500).json({ error: 'Erro ao deletar' });
            if (this.changes === 0) return res.status(404).json({ error: 'Não encontrado' });
            res.json({ message: 'Deletado' });
        }
    );
});

// ============ ROTAS DE METAS ============
app.get('/api/goals', verifyToken, (req, res) => {
    db.all('SELECT id, objective, progress FROM goals WHERE user_id = ? ORDER BY id DESC', [req.userId], (err, rows) => {
        if (err) return res.status(500).json({ error: 'Erro ao buscar metas' });
        res.json(rows || []);
    });
});

app.post('/api/goals', verifyToken, (req, res) => {
    const { objective } = req.body;
    
    db.run(
        'INSERT INTO goals (user_id, objective, progress) VALUES (?, ?, ?)',
        [req.userId, objective, 0],
        function(err) {
            if (err) return res.status(500).json({ error: 'Erro ao criar meta' });
            res.json({ id: this.lastID, message: 'Meta criada' });
        }
    );
});

app.put('/api/goals/:id', verifyToken, (req, res) => {
    const { progress } = req.body;
    
    db.run(
        'UPDATE goals SET progress = ? WHERE id = ? AND user_id = ?',
        [progress, req.params.id, req.userId],
        function(err) {
            if (err) return res.status(500).json({ error: 'Erro ao atualizar' });
            res.json({ message: 'Progresso atualizado' });
        }
    );
});

// ============ ROTAS DE FEEDBACK ============
app.post('/api/feedback', (req, res) => {
    const { content } = req.body;
    const date = new Date().toISOString();
    
    db.run(
        'INSERT INTO feedback (content, date, status) VALUES (?, ?, ?)',
        [content, date, 'unread'],
        function(err) {
            if (err) return res.status(500).json({ error: 'Erro ao enviar feedback' });
            res.json({ id: this.lastID, message: 'Feedback enviado' });
        }
    );
});

app.get('/api/feedback', verifyToken, (req, res) => {
    if (req.userType !== 'manager') {
        return res.status(403).json({ error: 'Acesso negado' });
    }
    db.all('SELECT id, content, date, status, response FROM feedback ORDER BY date DESC', [], (err, rows) => {
        if (err) return res.status(500).json({ error: 'Erro ao buscar feedbacks' });
        res.json(rows || []);
    });
});

app.get('/api/feedback/user', verifyToken, (req, res) => {
    db.all('SELECT id, content, response, date, status FROM feedback WHERE response IS NOT NULL ORDER BY date DESC LIMIT 50', [], (err, rows) => {
        if (err) return res.status(500).json({ error: 'Erro ao buscar feedbacks' });
        res.json(rows || []);
    });
});

app.put('/api/feedback/:id/respond', verifyToken, (req, res) => {
    if (req.userType !== 'manager') {
        return res.status(403).json({ error: 'Acesso negado' });
    }
    const { response } = req.body;
    
    db.run(
        'UPDATE feedback SET response = ?, status = ?, responded_at = CURRENT_TIMESTAMP WHERE id = ?',
        [response, 'responded', req.params.id],
        function(err) {
            if (err) return res.status(500).json({ error: 'Erro ao responder' });
            res.json({ message: 'Feedback respondido' });
        }
    );
});

app.put('/api/feedback/:id/status', verifyToken, (req, res) => {
    if (req.userType !== 'manager') {
        return res.status(403).json({ error: 'Acesso negado' });
    }
    const { status } = req.body;
    
    db.run(
        'UPDATE feedback SET status = ? WHERE id = ?',
        [status, req.params.id],
        function(err) {
            if (err) return res.status(500).json({ error: 'Erro ao atualizar status' });
            res.json({ message: 'Status atualizado' });
        }
    );
});

// ============ ROTA MEMBER DETAILS ============
app.get('/api/member/:id', verifyToken, (req, res) => {
    if (req.userType !== 'manager') {
        return res.status(403).json({ error: 'Acesso negado' });
    }
    
    const memberId = req.params.id;
    
    db.get('SELECT id, name, email FROM users WHERE id = ?', [memberId], (err, user) => {
        if (err || !user) {
            return res.status(404).json({ error: 'Usuário não encontrado' });
        }
        
        db.all('SELECT mood, comment, date FROM emotions WHERE user_id = ? ORDER BY date DESC', [memberId], (err, emotions) => {
            db.all('SELECT id, objective, progress FROM goals WHERE user_id = ?', [memberId], (err, goals) => {
                res.json({
                    ...user,
                    emotions: emotions || [],
                    goals: goals || []
                });
            });
        });
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
app.listen(PORT, '0.0.0.0', () => {
    console.log(`\n🚀 Servidor MindTrack rodando na porta ${PORT}`);
    console.log(`📡 API: http://localhost:${PORT}/api`);
    console.log(`✅ Rotas disponíveis:`);
    console.log(`   POST /api/login`);
    console.log(`   GET  /api/team-members`);
    console.log(`   GET  /api/emotions`);
    console.log(`   POST /api/emotions`);
    console.log(`   GET  /api/goals`);
    console.log(`   GET  /api/feedback`);
    console.log(`   GET  /api/feedback/user`);
    console.log(`   GET  /api/member/:id`);
    console.log(`   PUT  /api/feedback/:id/respond\n`);
});