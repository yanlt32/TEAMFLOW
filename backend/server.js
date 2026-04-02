const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const path = require('path');
const db = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'mindtrack-secret-key-2024';

// CORS - permite todas as origens para teste
app.use(cors());
app.use(express.json());

// Logging
app.use((req, res, next) => {
    console.log(`${req.method} ${req.path}`);
    next();
});

// Servir arquivos estáticos
app.use(express.static(path.join(__dirname, '../frontend')));

// Middleware de autenticação
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
        next();
    });
};

// ========== ROTAS ==========

// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Login
app.post('/api/login', async (req, res) => {
    const { email, password } = req.body;
    
    db.get('SELECT * FROM users WHERE email = ?', [email], async (err, user) => {
        if (err || !user) {
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

// Team members - ROTA CORRIGIDA
app.get('/api/team-members', verifyToken, (req, res) => {
    console.log(`Buscando membros - Tipo usuário: ${req.userType}`);
    
    if (req.userType !== 'manager') {
        return res.status(403).json({ error: 'Acesso negado' });
    }
    
    db.all('SELECT id, name, email, type FROM users WHERE type = ? ORDER BY name', ['employee'], (err, rows) => {
        if (err) {
            console.error('Erro ao buscar membros:', err);
            return res.status(500).json({ error: 'Erro interno' });
        }
        console.log(`${rows.length} membros encontrados`);
        res.json(rows);
    });
});

// Emoções
app.get('/api/emotions', verifyToken, (req, res) => {
    db.all('SELECT * FROM emotions WHERE user_id = ? ORDER BY date DESC', [req.userId], (err, rows) => {
        res.json(rows || []);
    });
});

app.post('/api/emotions', verifyToken, (req, res) => {
    const { mood, comment } = req.body;
    const date = new Date().toISOString().split('T')[0];
    
    db.run(
        'INSERT INTO emotions (user_id, mood, comment, date) VALUES (?, ?, ?, ?)',
        [req.userId, mood, comment, date],
        function(err) {
            if (err) {
                return res.status(500).json({ error: 'Erro ao salvar' });
            }
            res.json({ id: this.lastID, message: 'Salvo' });
        }
    );
});

// Metas
app.get('/api/goals', verifyToken, (req, res) => {
    db.all('SELECT * FROM goals WHERE user_id = ? ORDER BY id DESC', [req.userId], (err, rows) => {
        res.json(rows || []);
    });
});

app.post('/api/goals', verifyToken, (req, res) => {
    const { objective } = req.body;
    db.run(
        'INSERT INTO goals (user_id, objective) VALUES (?, ?)',
        [req.userId, objective],
        function(err) {
            if (err) {
                return res.status(500).json({ error: 'Erro ao criar meta' });
            }
            res.json({ id: this.lastID });
        }
    );
});

// Feedback
app.post('/api/feedback', (req, res) => {
    const { content } = req.body;
    db.run(
        'INSERT INTO feedback (content, date, status) VALUES (?, ?, ?)',
        [content, new Date().toISOString(), 'unread'],
        function(err) {
            if (err) {
                return res.status(500).json({ error: 'Erro ao enviar' });
            }
            res.json({ id: this.lastID });
        }
    );
});

app.get('/api/feedback', verifyToken, (req, res) => {
    if (req.userType !== 'manager') {
        return res.status(403).json({ error: 'Acesso negado' });
    }
    db.all('SELECT * FROM feedback ORDER BY date DESC', [], (err, rows) => {
        res.json(rows || []);
    });
});

app.get('/api/feedback/user', verifyToken, (req, res) => {
    db.all('SELECT * FROM feedback WHERE response IS NOT NULL ORDER BY date DESC', [], (err, rows) => {
        res.json(rows || []);
    });
});

// Rota para detalhes do membro
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
            db.all('SELECT objective, progress FROM goals WHERE user_id = ?', [memberId], (err, goals) => {
                res.json({
                    ...user,
                    emotions: emotions || [],
                    goals: goals || []
                });
            });
        });
    });
});

// Rota padrão para SPA
app.get('*', (req, res) => {
    if (req.path.startsWith('/api/')) {
        return res.status(404).json({ error: 'Rota não encontrada' });
    }
    res.sendFile(path.join(__dirname, '../frontend', 'dashboard.html'), err => {
        if (err) {
            res.sendFile(path.join(__dirname, '../frontend', 'index.html'));
        }
    });
});

// Iniciar servidor
app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
    console.log(`Frontend: http://localhost:${PORT}`);
    console.log(`API: http://localhost:${PORT}/api`);
});