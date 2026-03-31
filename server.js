const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const db = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

// CORS: allow localhost dev and deployment origin(s)
const allowedOrigins = [
    process.env.FRONTEND_URL,
    process.env.ALLOWED_ORIGIN,
    'http://localhost:3000',
    'https://mindtrack-pqvu.onrender.com'
].filter(Boolean);

app.use(cors({
    origin: (origin, callback) => {
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            callback(new Error(`CORS policy violation: origin ${origin} not allowed`));
        }
    },
    credentials: true
}));
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ extended: true }));

// Auto-seed default users in production if table empty
const seedUsers = async () => {
    db.get('SELECT COUNT(*) as count FROM users', async (err, row) => {
        if (err) {
            console.error('Seed check error:', err);
            return;
        }

        if (row.count === 0) {
            try {
                const managerPassword = await bcrypt.hash('admin123', 12);
                const employeePassword = await bcrypt.hash('user123', 12);

                db.run(`INSERT OR IGNORE INTO users (name, email, password, type) VALUES (?, ?, ?, ?), (?, ?, ?, ?), (?, ?, ?, ?), (?, ?, ?, ?)`,
                    ['Administrador', 'admin@mindtrack.com', managerPassword, 'manager',
                     'João Silva', 'joao@empresa.com', employeePassword, 'employee',
                     'Maria Santos', 'maria@empresa.com', employeePassword, 'employee',
                     'Pedro Costa', 'pedro@empresa.com', employeePassword, 'employee'],
                    (insertErr) => {
                        if (insertErr) {
                            console.error('Error seeding users:', insertErr);
                        } else {
                            console.log('✅ Usuários de seed criados (fallback).');
                        }
                    });
            } catch (hashError) {
                console.error('Error hashing initial passwords:', hashError);
            }
        }
    });
};

seedUsers();

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

// Static files
app.use(express.static('./frontend'));

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'development'
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

// Auth routes
app.post('/api/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({
                error: 'Email e senha são obrigatórios',
                code: 'MISSING_CREDENTIALS'
            });
        }

        // Find user
        db.get('SELECT * FROM users WHERE email = ?', [email], async (err, user) => {
            if (err) {
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

            // Check password
            const isValidPassword = await bcrypt.compare(password, user.password);
            if (!isValidPassword) {
                return res.status(401).json({
                    error: 'Credenciais inválidas',
                    code: 'INVALID_CREDENTIALS'
                });
            }

            // Generate JWT
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

// Emotions routes
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

    const date = new Date().toLocaleDateString('sv-SE'); // YYYY-MM-DD format in local timezone

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

    // Get member info and emotions
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

        // Get member goals
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
                goals: goals
            };

            res.json(member);
        });
    });
});

// Goals routes
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
        res.json(rows);
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

// Feedback routes (anonymous)
app.get('/api/feedback', verifyToken, requireRole(['manager']), (req, res) => {
    db.all(`
        SELECT id, content, date
        FROM feedback
        ORDER BY date DESC
    `, [], (err, rows) => {
        if (err) {
            return res.status(500).json({
                error: 'Erro ao buscar feedback',
                code: 'INTERNAL_ERROR'
            });
        }
        res.json(rows);
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
        INSERT INTO feedback (content, date)
        VALUES (?, ?)
    `, [content, date], function(err) {
        if (err) {
            return res.status(500).json({
                error: 'Erro ao salvar feedback',
                code: 'INTERNAL_ERROR'
            });
        }

        res.status(201).json({
            id: this.lastID,
            content,
            date
        });
    });
});

// Analytics overview (manager only)
app.get('/api/analytics/overview', verifyToken, requireRole(['manager']), (req, res) => {
    // Get total users
    db.get('SELECT COUNT(*) as total FROM users', [], (err, userCount) => {
        if (err) {
            return res.status(500).json({
                error: 'Erro ao buscar analytics',
                code: 'INTERNAL_ERROR'
            });
        }

        // Get emotions in last 30 days
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

            // Get recent feedback
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
                    moodStats,
                    recentFeedback: feedback
                });
            });
        });
    });
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);
    res.status(500).json({
        error: 'Erro interno do servidor',
        code: 'INTERNAL_ERROR'
    });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({
        error: 'Rota não encontrada',
        code: 'ROUTE_NOT_FOUND'
    });
});

// Start server
app.listen(PORT, () => {
    console.log(`🚀 MindTrack server running on port ${PORT}`);
    console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`🔗 Health check: http://localhost:${PORT}/api/health`);
});