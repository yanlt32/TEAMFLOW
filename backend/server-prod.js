const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const path = require('path');
const db = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

// Middleware
app.use(cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true
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

// Request logging middleware
app.use((req, res, next) => {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] ${req.method} ${req.path} - IP: ${req.ip}`);
    next();
});

// ============================================
// STATIC FILES SERVING - FIXED
// ============================================
// Serve static files from frontend folder
const frontendPath = path.join(__dirname, '../frontend');
app.use(express.static(frontendPath));

// ============================================
// API ROUTES (must come BEFORE catch-all route)
// ============================================

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'development',
        port: PORT
    });
});

// Endpoint para informar a porta atual ao frontend
app.get('/api/config', (req, res) => {
    res.json({
        apiUrl: `http://localhost:${PORT}`,
        port: PORT,
        version: '1.0.0'
    });
});

// JWT verification middleware
const verifyToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({
            error: 'Token de acesso não fornecido',
            code: 'TOKEN_MISSING'
        });
    }

    jwt.verify(token, JWT_SECRET, (err, decoded) => {
        if (err) {
            return res.status(403).json({
                error: 'Token inválido',
                code: 'TOKEN_INVALID'
            });
        }
        req.user = decoded;
        next();
    });
};

// Role verification middleware
const requireRole = (roles) => {
    return (req, res, next) => {
        if (!req.user || !roles.includes(req.user.type)) {
            return res.status(403).json({
                error: 'Acesso negado',
                code: 'ACCESS_DENIED'
            });
        }
        next();
    };
};

// ============================================
// AUTH ROUTES
// ============================================

// Register endpoint
app.post('/api/register', async (req, res) => {
    try {
        const { name, email, password, type } = req.body;

        if (!name || !email || !password || !type) {
            return res.status(400).json({
                error: 'Todos os campos são obrigatórios',
                code: 'MISSING_FIELDS'
            });
        }

        if (!['employee', 'manager'].includes(type)) {
            return res.status(400).json({
                error: 'Tipo de usuário inválido',
                code: 'INVALID_USER_TYPE'
            });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        db.run(
            'INSERT INTO users (name, email, password, type) VALUES (?, ?, ?, ?)',
            [name, email.toLowerCase(), hashedPassword, type],
            function(err) {
                if (err) {
                    if (err.message.includes('UNIQUE constraint failed')) {
                        return res.status(409).json({
                            error: 'Email já cadastrado',
                            code: 'EMAIL_EXISTS'
                        });
                    }
                    console.error('Register error:', err);
                    return res.status(500).json({
                        error: 'Erro ao registrar usuário',
                        code: 'INTERNAL_ERROR'
                    });
                }

                res.status(201).json({
                    id: this.lastID,
                    message: 'Usuário criado com sucesso'
                });
            }
        );
    } catch (error) {
        console.error('Register error:', error);
        res.status(500).json({
            error: 'Erro interno do servidor',
            code: 'INTERNAL_ERROR'
        });
    }
});

// Login endpoint
app.post('/api/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({
                error: 'Email e senha são obrigatórios',
                code: 'MISSING_CREDENTIALS'
            });
        }

        db.get('SELECT * FROM users WHERE email = ?', [email.toLowerCase()], async (err, user) => {
            if (err) {
                console.error('Login query error:', err);
                return res.status(500).json({
                    error: 'Erro interno do servidor',
                    code: 'INTERNAL_ERROR'
                });
            }

            if (!user) {
                return res.status(401).json({
                    error: 'Credenciais inválidas',
                    code: 'INVALID_CREDENTIALS'
                });
            }

            const isValidPassword = await bcrypt.compare(password, user.password);
            if (!isValidPassword) {
                return res.status(401).json({
                    error: 'Credenciais inválidas',
                    code: 'INVALID_CREDENTIALS'
                });
            }

            const token = jwt.sign(
                {
                    id: user.id,
                    email: user.email,
                    type: user.type,
                    name: user.name
                },
                JWT_SECRET,
                { expiresIn: '24h' }
            );

            res.json({
                token,
                user: {
                    id: user.id,
                    name: user.name,
                    email: user.email,
                    type: user.type
                }
            });
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({
            error: 'Erro interno do servidor',
            code: 'INTERNAL_ERROR'
        });
    }
});

// Profile routes
app.get('/api/profile', verifyToken, (req, res) => {
    db.get('SELECT id, name, email, type FROM users WHERE id = ?', [req.user.id], (err, user) => {
        if (err) {
            return res.status(500).json({
                error: 'Erro ao buscar perfil',
                code: 'INTERNAL_ERROR'
            });
        }

        if (!user) {
            return res.status(404).json({
                error: 'Usuário não encontrado',
                code: 'USER_NOT_FOUND'
            });
        }

        res.json(user);
    });
});

// ============================================
// EMOTIONS ROUTES
// ============================================

app.get('/api/emotions', verifyToken, (req, res) => {
    db.all(`
        SELECT id, mood, comment, date
        FROM emotions
        WHERE user_id = ?
        ORDER BY date DESC
    `, [req.user.id], (err, rows) => {
        if (err) {
            return res.status(500).json({
                error: 'Erro ao buscar emoções',
                code: 'INTERNAL_ERROR'
            });
        }
        res.json(rows);
    });
});

app.post('/api/emotions', verifyToken, (req, res) => {
    const { mood, comment } = req.body;

    if (!mood) {
        return res.status(400).json({
            error: 'Humor é obrigatório',
            code: 'MISSING_MOOD'
        });
    }

    const validMoods = ['happy', 'good', 'neutral', 'stressed', 'overloaded'];
    if (!validMoods.includes(mood)) {
        return res.status(400).json({
            error: 'Humor inválido',
            code: 'INVALID_MOOD'
        });
    }

    const date = new Date().toISOString().split('T')[0];

    db.run(`
        INSERT INTO emotions (user_id, mood, comment, date)
        VALUES (?, ?, ?, ?)
    `, [req.user.id, mood, comment || '', date], function(err) {
        if (err) {
            return res.status(500).json({
                error: 'Erro ao salvar emoção',
                code: 'INTERNAL_ERROR'
            });
        }

        res.status(201).json({
            id: this.lastID,
            mood,
            comment,
            date
        });
    });
});

// Team emotions (manager only)
app.get('/api/team-emotions', verifyToken, requireRole(['manager']), (req, res) => {
    const dateLimit = new Date();
    dateLimit.setDate(dateLimit.getDate() - 30);

    db.all(`
        SELECT e.id, e.mood, e.comment, e.date, u.name, u.email, e.user_id
        FROM emotions e
        JOIN users u ON e.user_id = u.id
        WHERE e.date >= ?
        ORDER BY e.date DESC
    `,
    [dateLimit.toISOString().split('T')[0]],
    (err, rows) => {
        if (err) {
            return res.status(500).json({
                error: 'Erro ao buscar emoções da equipe',
                code: 'INTERNAL_ERROR'
            });
        }
        res.json(rows);
    });
});

// Get member details (manager only)
app.get('/api/member/:id', verifyToken, requireRole(['manager']), (req, res) => {
    const memberId = req.params.id;

    db.all(`
        SELECT u.name, u.email, u.type, e.mood, e.comment, e.date
        FROM users u
        LEFT JOIN emotions e ON u.id = e.user_id
        WHERE u.id = ?
        ORDER BY e.date DESC
    `, [memberId], (err, rows) => {
        if (err) {
            return res.status(500).json({
                error: 'Erro ao buscar detalhes do membro',
                code: 'INTERNAL_ERROR'
            });
        }

        if (rows.length === 0) {
            return res.status(404).json({
                error: 'Membro não encontrado',
                code: 'MEMBER_NOT_FOUND'
            });
        }

        db.all(`
            SELECT objective, progress
            FROM goals
            WHERE user_id = ?
            ORDER BY id DESC
        `, [memberId], (err, goals) => {
            if (err) {
                return res.status(500).json({
                    error: 'Erro ao buscar metas do membro',
                    code: 'INTERNAL_ERROR'
                });
            }

            const member = {
                id: memberId,
                name: rows[0].name,
                email: rows[0].email,
                type: rows[0].type,
                emotions: rows.filter(row => row.mood).map(row => ({
                    mood: row.mood,
                    comment: row.comment,
                    date: row.date
                })),
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
    db.all(`
        SELECT id, objective, progress
        FROM goals
        WHERE user_id = ?
        ORDER BY id DESC
    `, [req.user.id], (err, rows) => {
        if (err) {
            return res.status(500).json({
                error: 'Erro ao buscar metas',
                code: 'INTERNAL_ERROR'
            });
        }
        res.json(rows || []);
    });
});

app.post('/api/goals', verifyToken, (req, res) => {
    const { objective, progress } = req.body;

    if (!objective) {
        return res.status(400).json({
            error: 'Objetivo é obrigatório',
            code: 'MISSING_OBJECTIVE'
        });
    }

    db.run(`
        INSERT INTO goals (user_id, objective, progress)
        VALUES (?, ?, ?)
    `, [req.user.id, objective, progress || 0], function(err) {
        if (err) {
            return res.status(500).json({
                error: 'Erro ao salvar meta',
                code: 'INTERNAL_ERROR'
            });
        }

        res.status(201).json({
            id: this.lastID,
            objective,
            progress: progress || 0
        });
    });
});

app.put('/api/goals/:id', verifyToken, (req, res) => {
    const { progress } = req.body;
    const goalId = req.params.id;

    if (progress === undefined || progress < 0 || progress > 100) {
        return res.status(400).json({
            error: 'Progresso deve ser entre 0 e 100',
            code: 'INVALID_PROGRESS'
        });
    }

    db.run(`
        UPDATE goals
        SET progress = ?
        WHERE id = ? AND user_id = ?
    `, [progress, goalId, req.user.id], function(err) {
        if (err) {
            return res.status(500).json({
                error: 'Erro ao atualizar meta',
                code: 'INTERNAL_ERROR'
            });
        }

        if (this.changes === 0) {
            return res.status(404).json({
                error: 'Meta não encontrada',
                code: 'GOAL_NOT_FOUND'
            });
        }

        res.json({ id: goalId, progress });
    });
});

app.delete('/api/goals/:id', verifyToken, (req, res) => {
    const goalId = req.params.id;

    db.run(`
        DELETE FROM goals
        WHERE id = ? AND user_id = ?
    `, [goalId, req.user.id], function(err) {
        if (err) {
            return res.status(500).json({
                error: 'Erro ao deletar meta',
                code: 'INTERNAL_ERROR'
            });
        }

        if (this.changes === 0) {
            return res.status(404).json({
                error: 'Meta não encontrada',
                code: 'GOAL_NOT_FOUND'
            });
        }

        res.json({ message: 'Meta removida com sucesso' });
    });
});

// ============================================
// FEEDBACK ROUTES
// ============================================

app.get('/api/feedback', verifyToken, requireRole(['manager']), (req, res) => {
    const { limit = 50, offset = 0, status, fromDate, toDate } = req.query;

    let query = 'SELECT id, content, date, status, response FROM feedback';
    const params = [];
    const filters = [];

    if (status && ['unread', 'read', 'responded'].includes(status)) {
        filters.push('status = ?');
        params.push(status);
    }

    if (fromDate) {
        filters.push('date >= ?');
        params.push(fromDate);
    }

    if (toDate) {
        filters.push('date <= ?');
        params.push(toDate);
    }

    if (filters.length) {
        query += ' WHERE ' + filters.join(' AND ');
    }

    query += ' ORDER BY date DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit, 10));
    params.push(parseInt(offset, 10));

    db.all(query, params, (err, rows) => {
        if (err) {
            return res.status(500).json({
                error: 'Erro ao buscar feedback',
                code: 'INTERNAL_ERROR'
            });
        }
        res.json(rows || []);
    });
});

app.post('/api/feedback', (req, res) => {
    const { content } = req.body;

    if (!content) {
        return res.status(400).json({
            error: 'Conteúdo é obrigatório',
            code: 'MISSING_CONTENT'
        });
    }

    const date = new Date().toISOString();

    db.run(`
        INSERT INTO feedback (content, date, status)
        VALUES (?, ?, ?)
    `, [content, date, 'unread'], function(err) {
        if (err) {
            return res.status(500).json({
                error: 'Erro ao salvar feedback',
                code: 'INTERNAL_ERROR'
            });
        }

        res.status(201).json({
            id: this.lastID,
            content,
            date,
            status: 'unread'
        });
    });
});

app.put('/api/feedback/:id/status', verifyToken, requireRole(['manager']), (req, res) => {
    const feedbackId = req.params.id;
    const { status } = req.body;

    if (!['unread', 'read', 'responded'].includes(status)) {
        return res.status(400).json({
            error: 'Status inválido',
            code: 'INVALID_STATUS'
        });
    }

    db.run(
        'UPDATE feedback SET status = ? WHERE id = ?',
        [status, feedbackId],
        function(err) {
            if (err) {
                return res.status(500).json({
                    error: 'Erro ao atualizar status',
                    code: 'INTERNAL_ERROR'
                });
            }

            if (this.changes === 0) {
                return res.status(404).json({
                    error: 'Feedback não encontrado',
                    code: 'FEEDBACK_NOT_FOUND'
                });
            }

            res.json({ message: 'Status atualizado', id: feedbackId, status });
        }
    );
});

app.put('/api/feedback/:id/respond', verifyToken, requireRole(['manager']), (req, res) => {
    const feedbackId = req.params.id;
    const { response } = req.body;

    if (!response?.trim()) {
        return res.status(400).json({
            error: 'Resposta é obrigatória',
            code: 'MISSING_RESPONSE'
        });
    }

    db.run(
        'UPDATE feedback SET response = ?, status = ? WHERE id = ?',
        [response.trim(), 'responded', feedbackId],
        function(err) {
            if (err) {
                return res.status(500).json({
                    error: 'Erro ao responder feedback',
                    code: 'INTERNAL_ERROR'
                });
            }

            if (this.changes === 0) {
                return res.status(404).json({
                    error: 'Feedback não encontrado',
                    code: 'FEEDBACK_NOT_FOUND'
                });
            }

            res.json({ message: 'Feedback respondido', id: feedbackId, response: response.trim() });
        }
    );
});

// ============================================
// ANALYTICS ROUTES
// ============================================

app.get('/api/analytics/overview', verifyToken, requireRole(['manager']), (req, res) => {
    db.get('SELECT COUNT(*) as total FROM users', [], (err, userCount) => {
        if (err) {
            return res.status(500).json({
                error: 'Erro ao buscar analytics',
                code: 'INTERNAL_ERROR'
            });
        }

        const dateLimit = new Date();
        dateLimit.setDate(dateLimit.getDate() - 30);

        db.all(`
            SELECT mood, COUNT(*) as count
            FROM emotions
            WHERE date >= ?
            GROUP BY mood
        `, [dateLimit.toISOString().split('T')[0]], (err, moodStats) => {
            if (err) {
                return res.status(500).json({
                    error: 'Erro ao buscar estatísticas',
                    code: 'INTERNAL_ERROR'
                });
            }

            db.all(`
                SELECT content, date
                FROM feedback
                ORDER BY date DESC
                LIMIT 5
            `, [], (err, feedback) => {
                if (err) {
                    return res.status(500).json({
                        error: 'Erro ao buscar feedback',
                        code: 'INTERNAL_ERROR'
                    });
                }

                res.json({
                    totalUsers: userCount.total,
                    moodStats: moodStats || [],
                    recentFeedback: feedback || []
                });
            });
        });
    });
});

// ============================================
// TEAM MEMBERS LIST (manager only)
// ============================================

app.get('/api/team-members', verifyToken, requireRole(['manager']), (req, res) => {
    db.all(`
        SELECT id, name, email, type
        FROM users
        WHERE type = 'employee'
        ORDER BY name
    `, [], (err, rows) => {
        if (err) {
            return res.status(500).json({
                error: 'Erro ao buscar membros da equipe',
                code: 'INTERNAL_ERROR'
            });
        }
        res.json(rows || []);
    });
});

// ============================================
// ERROR HANDLING
// ============================================

// API 404 handler - for unmatched API routes
app.use('/api/*', (req, res) => {
    res.status(404).json({
        error: 'Rota não encontrada',
        code: 'ROUTE_NOT_FOUND'
    });
});

// Serve index.html for all non-API routes (SPA support)
app.get('*', (req, res) => {
    // Check if the request is for an API route (already handled above)
    if (req.path.startsWith('/api/')) {
        return;
    }
    
    // Serve index.html for all other routes
    const indexPath = path.join(frontendPath, 'index.html');
    res.sendFile(indexPath, (err) => {
        if (err) {
            console.error('Error serving index.html:', err);
            res.status(500).send('Error loading application');
        }
    });
});

// General error handling middleware
app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);
    res.status(500).json({
        error: 'Erro interno do servidor',
        code: 'INTERNAL_ERROR'
    });
});

// ============================================
// START SERVER
// ============================================

let activePort = PORT;

const startServer = (port) => {
    const server = app.listen(port, () => {
        activePort = port;
        console.log(`\n🚀 MindTrack server running on port ${port}`);
        console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
        console.log(`🔗 Health check: http://localhost:${port}/api/health`);
        console.log(`🌐 Frontend: http://localhost:${port}\n`);
        
        // Atualiza a variável global da porta
        process.env.ACTIVE_PORT = port;
    }).on('error', (err) => {
        if (err.code === 'EADDRINUSE') {
            console.log(`⚠️  Port ${port} is busy, trying port ${port + 1}...`);
            startServer(port + 1);
        } else {
            console.error('Server error:', err);
            process.exit(1);
        }
    });
};

startServer(PORT);

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\n📴 Shutting down server...');
    db.close((err) => {
        if (err) {
            console.error('Error closing database:', err);
        } else {
            console.log('✅ Database closed');
        }
        process.exit(0);
    });
});

// Exportar a porta ativa para uso em outros módulos
module.exports = { app, getPort: () => activePort };