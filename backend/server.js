const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
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

// Headers de segurança
app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    next();
});

// Middleware de logging de requisições
app.use((req, res, next) => {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] ${req.method} ${req.path} - IP: ${req.ip}`);
    next();
});

// Arquivos estáticos
app.use(express.static('../frontend'));

// Middleware de verificação de token JWT
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
                error: 'Token inválido ou expirado',
                code: 'TOKEN_INVALID'
            });
        }

        req.userId = decoded.id;
        req.userType = decoded.type;
        req.user = decoded;
        next();
    });
};

// Controle de acesso baseado em papel (role-based access control)
const requireRole = (roles) => {
    return (req, res, next) => {
        if (!roles.includes(req.userType)) {
            return res.status(403).json({
                error: 'Acesso negado. Permissões insuficientes.',
                code: 'INSUFFICIENT_PERMISSIONS'
            });
        }
        next();
    };
};

// ROTAS DA API

// Verificação de saúde do servidor
app.get('/api/health', (req, res) => {
    res.json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        version: '1.0.0'
    });
});

// Registrar novo usuário (apenas admin em produção)
app.post('/api/register', async (req, res) => {
    try {
        const { name, email, password, type } = req.body;

        // Validação
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

        if (password.length < 6) {
            return res.status(400).json({
                error: 'A senha deve ter pelo menos 6 caracteres',
                code: 'PASSWORD_TOO_SHORT'
            });
        }

        const hashedPassword = await bcrypt.hash(password, 12);

        db.run(
            'INSERT INTO users (name, email, password, type) VALUES (?, ?, ?, ?)',
            [name.trim(), email.toLowerCase().trim(), hashedPassword, type],
            function(err) {
                if (err) {
                    if (err.message.includes('UNIQUE constraint failed')) {
                        return res.status(409).json({
                            error: 'Email já cadastrado',
                            code: 'EMAIL_EXISTS'
                        });
                    }
                    throw err;
                }

                console.log(`Novo usuário criado: ${name} (${email}) - Tipo: ${type}`);

                res.status(201).json({
                    id: this.lastID,
                    message: 'Usuário criado com sucesso'
                });
            }
        );
    } catch (error) {
        console.error('Erro ao registrar usuário:', error);
        res.status(500).json({
            error: 'Erro interno do servidor',
            code: 'INTERNAL_ERROR'
        });
    }
});

// Login
app.post('/api/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({
                error: 'Email e senha são obrigatórios',
                code: 'MISSING_CREDENTIALS'
            });
        }

        db.get(
            'SELECT id, name, email, type FROM users WHERE email = ?',
            [email.toLowerCase().trim()],
            async (err, user) => {
                if (err) {
                    console.error('Erro na consulta de login:', err);
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

                // Buscar a senha hash
                db.get('SELECT password FROM users WHERE id = ?', [user.id], async (err, userWithPassword) => {
                    if (err || !userWithPassword) {
                        return res.status(500).json({
                            error: 'Erro interno do servidor',
                            code: 'INTERNAL_ERROR'
                        });
                    }

                    const isValidPassword = await bcrypt.compare(password, userWithPassword.password);

                    if (!isValidPassword) {
                        return res.status(401).json({
                            error: 'Credenciais inválidas',
                            code: 'INVALID_CREDENTIALS'
                        });
                    }

                    // Gerar token JWT
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

                    console.log(`Login bem-sucedido: ${user.name} (${user.email})`);

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
            }
        );
    } catch (error) {
        console.error('Erro no login:', error);
        res.status(500).json({
            error: 'Erro interno do servidor',
            code: 'INTERNAL_ERROR'
        });
    }
});

// Obter perfil do usuário
app.get('/api/profile', verifyToken, (req, res) => {
    db.get(
        'SELECT id, name, email, type FROM users WHERE id = ?',
        [req.userId],
        (err, user) => {
            if (err) {
                return res.status(500).json({
                    error: 'Erro interno do servidor',
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
        }
    );
});

// Rotas de Emoções
app.get('/api/emotions', verifyToken, (req, res) => {
    const { limit = 50, offset = 0 } = req.query;

    db.all(
        'SELECT id, mood, comment, date FROM emotions WHERE user_id = ? ORDER BY date DESC LIMIT ? OFFSET ?',
        [req.userId, parseInt(limit), parseInt(offset)],
        (err, rows) => {
            if (err) {
                return res.status(500).json({
                    error: 'Erro ao buscar emoções',
                    code: 'INTERNAL_ERROR'
                });
            }
            res.json(rows);
        }
    );
});

app.post('/api/emotions', verifyToken, (req, res) => {
    const { mood, comment } = req.body;
    const date = new Date().toISOString().split('T')[0];

    // Validação
    const validMoods = ['happy', 'good', 'neutral', 'stressed', 'overloaded'];
    if (!validMoods.includes(mood)) {
        return res.status(400).json({
            error: 'Humor inválido',
            code: 'INVALID_MOOD'
        });
    }

    db.run(
        'INSERT INTO emotions (user_id, mood, comment, date) VALUES (?, ?, ?, ?)',
        [req.userId, mood, comment?.trim() || null, date],
        function(err) {
            if (err) {
                return res.status(500).json({
                    error: 'Erro ao salvar emoção',
                    code: 'INTERNAL_ERROR'
                });
            }

            console.log(`Emoção registrada: User ${req.userId} - ${mood}`);

            res.status(201).json({
                id: this.lastID,
                message: 'Emoção registrada com sucesso'
            });
        }
    );
});

// Emoções da equipe (apenas para gerentes)
app.get('/api/team-emotions', verifyToken, requireRole(['manager']), (req, res) => {
    const { days = 30 } = req.query;
    const dateLimit = new Date();
    dateLimit.setDate(dateLimit.getDate() - parseInt(days));

    db.all(
        `SELECT e.id, e.mood, e.comment, e.date, u.name, u.email
         FROM emotions e
         JOIN users u ON e.user_id = u.id
         WHERE e.date >= ?
         ORDER BY e.date DESC`,
        [dateLimit.toISOString().split('T')[0]],
        (err, rows) => {
            if (err) {
                return res.status(500).json({
                    error: 'Erro ao buscar emoções da equipe',
                    code: 'INTERNAL_ERROR'
                });
            }
            res.json(rows);
        }
    );
});

// Obter detalhes de um membro da equipe (emoções, metas, etc.)
app.get('/api/member/:id', verifyToken, requireRole(['manager']), (req, res) => {
    const memberId = req.params.id;

    // Buscar informações do membro e emoções
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

        // Buscar metas do membro
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

// Rotas de Metas
app.get('/api/goals', verifyToken, (req, res) => {
    db.all(
        'SELECT id, objective, progress FROM goals WHERE user_id = ? ORDER BY id DESC',
        [req.userId],
        (err, rows) => {
            if (err) {
                return res.status(500).json({
                    error: 'Erro ao buscar metas',
                    code: 'INTERNAL_ERROR'
                });
            }
            res.json(rows);
        }
    );
});

app.post('/api/goals', verifyToken, (req, res) => {
    const { objective } = req.body;

    if (!objective?.trim()) {
        return res.status(400).json({
            error: 'Objetivo é obrigatório',
            code: 'MISSING_OBJECTIVE'
        });
    }

    db.run(
        'INSERT INTO goals (user_id, objective) VALUES (?, ?)',
        [req.userId, objective.trim()],
        function(err) {
            if (err) {
                return res.status(500).json({
                    error: 'Erro ao criar meta',
                    code: 'INTERNAL_ERROR'
                });
            }

            console.log(`Meta criada: User ${req.userId} - ${objective}`);

            res.status(201).json({
                id: this.lastID,
                message: 'Meta criada com sucesso'
            });
        }
    );
});

app.put('/api/goals/:id', verifyToken, (req, res) => {
    const { progress } = req.body;
    const goalId = req.params.id;

    if (typeof progress !== 'number' || progress < 0 || progress > 100) {
        return res.status(400).json({
            error: 'Progresso deve ser um número entre 0 e 100',
            code: 'INVALID_PROGRESS'
        });
    }

    db.run(
        'UPDATE goals SET progress = ? WHERE id = ? AND user_id = ?',
        [progress, goalId, req.userId],
        function(err) {
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

            res.json({
                message: 'Meta atualizada com sucesso',
                changes: this.changes
            });
        }
    );
});

app.delete('/api/goals/:id', verifyToken, (req, res) => {
    db.run(
        'DELETE FROM goals WHERE id = ? AND user_id = ?',
        [req.params.id, req.userId],
        function(err) {
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

            res.json({
                message: 'Meta removida com sucesso'
            });
        }
    );
});

// Rotas de Feedback (ANÔNIMO)
app.post('/api/feedback', (req, res) => {
    const { content } = req.body;

    if (!content?.trim()) {
        return res.status(400).json({
            error: 'Conteúdo do feedback é obrigatório',
            code: 'MISSING_CONTENT'
        });
    }

    const date = new Date().toISOString();

    db.run(
        'INSERT INTO feedback (content, date, status) VALUES (?, ?, ?)',
        [content.trim(), date, 'unread'],
        function(err) {
            if (err) {
                return res.status(500).json({
                    error: 'Erro ao enviar feedback',
                    code: 'INTERNAL_ERROR'
                });
            }

            console.log(`Feedback anônimo recebido: ${content.substring(0, 50)}...`);

            res.status(201).json({
                id: this.lastID,
                message: 'Feedback enviado com sucesso'
            });
        }
    );
});

// Listar feedbacks (apenas para gerentes)
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
                error: 'Erro ao buscar feedbacks',
                code: 'INTERNAL_ERROR'
            });
        }
        res.json(rows || []);
    });
});

// ATUALIZAR STATUS DO FEEDBACK (Marcar como lido/não lido/respondido)
app.put('/api/feedback/:id/status', verifyToken, requireRole(['manager']), (req, res) => {
    const feedbackId = req.params.id;
    const { status } = req.body;

    // Validar status
    if (!['unread', 'read', 'responded'].includes(status)) {
        return res.status(400).json({
            error: 'Status inválido. Use: unread, read ou responded',
            code: 'INVALID_STATUS'
        });
    }

    db.run(
        'UPDATE feedback SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [status, feedbackId],
        function(err) {
            if (err) {
                console.error('Erro ao atualizar status do feedback:', err);
                return res.status(500).json({
                    error: 'Erro ao atualizar status do feedback',
                    code: 'INTERNAL_ERROR'
                });
            }

            if (this.changes === 0) {
                return res.status(404).json({
                    error: 'Feedback não encontrado',
                    code: 'FEEDBACK_NOT_FOUND'
                });
            }

            console.log(`Feedback ${feedbackId} atualizado para status: ${status}`);

            res.json({ 
                message: 'Status atualizado com sucesso', 
                id: feedbackId, 
                status 
            });
        }
    );
});

// RESPONDER FEEDBACK
app.put('/api/feedback/:id/respond', verifyToken, requireRole(['manager']), (req, res) => {
    const feedbackId = req.params.id;
    const { response } = req.body;

    // Validar resposta
    if (!response?.trim()) {
        return res.status(400).json({
            error: 'Resposta é obrigatória',
            code: 'MISSING_RESPONSE'
        });
    }

    // Atualizar feedback com resposta e marcar como respondido
    db.run(
        'UPDATE feedback SET response = ?, status = ?, responded_by = ?, responded_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [response.trim(), 'responded', req.userId, feedbackId],
        function(err) {
            if (err) {
                console.error('Erro ao responder feedback:', err);
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

            console.log(`Feedback ${feedbackId} respondido por ${req.user.name || req.userId}`);

            res.json({ 
                message: 'Feedback respondido com sucesso', 
                id: feedbackId, 
                response: response.trim() 
            });
        }
    );
});

// Rotas de Análise (apenas para gerentes)
app.get('/api/analytics/overview', verifyToken, requireRole(['manager']), (req, res) => {
    // Obter estatísticas gerais da equipe
    const queries = {
        totalUsers: 'SELECT COUNT(*) as count FROM users',
        totalEmotions: 'SELECT COUNT(*) as count FROM emotions',
        recentEmotions: 'SELECT COUNT(*) as count FROM emotions WHERE date >= date("now", "-7 days")',
        avgMoodScore: `
            SELECT AVG(
                CASE
                    WHEN mood = 'happy' THEN 5
                    WHEN mood = 'good' THEN 4
                    WHEN mood = 'neutral' THEN 3
                    WHEN mood = 'stressed' THEN 2
                    WHEN mood = 'overloaded' THEN 1
                    ELSE 3
                END
            ) as avg_score
            FROM emotions
            WHERE date >= date("now", "-30 days")
        `
    };

    const results = {};

    db.get(queries.totalUsers, [], (err, row) => {
        if (err) return handleAnalyticsError(err, res);
        results.totalUsers = row.count;

        db.get(queries.totalEmotions, [], (err, row) => {
            if (err) return handleAnalyticsError(err, res);
            results.totalEmotions = row.count;

            db.get(queries.recentEmotions, [], (err, row) => {
                if (err) return handleAnalyticsError(err, res);
                results.recentEmotions = row.count;

                db.get(queries.avgMoodScore, [], (err, row) => {
                    if (err) return handleAnalyticsError(err, res);
                    results.avgMoodScore = Math.round((row.avg_score || 0) * 10) / 10;

                    res.json(results);
                });
            });
        });
    });
});

function handleAnalyticsError(err, res) {
    console.error('Erro na análise:', err);
    res.status(500).json({
        error: 'Erro ao gerar análise',
        code: 'ANALYTICS_ERROR'
    });
}

// Middleware de tratamento de erros
app.use((err, req, res, next) => {
    console.error('Erro não tratado:', err);
    res.status(500).json({
        error: 'Erro interno do servidor',
        code: 'INTERNAL_ERROR'
    });
});

// Handler para rotas não encontradas (404)
app.use((req, res) => {
    res.status(404).json({
        error: 'Rota não encontrada',
        code: 'ROUTE_NOT_FOUND'
    });
});

// Encerramento gracioso do servidor
process.on('SIGINT', () => {
    console.log('Encerrando servidor...');
    db.close((err) => {
        if (err) {
            console.error('Erro ao fechar banco de dados:', err);
        } else {
            console.log('Banco de dados fechado com sucesso.');
        }
        process.exit(0);
    });
});

// Iniciar servidor
app.listen(PORT, () => {
    console.log(`🚀 Servidor MindTrack rodando na porta ${PORT}`);
    console.log(`📊 Ambiente: ${process.env.NODE_ENV || 'development'}`);
    console.log(`🔒 JWT Secret configurado: ${JWT_SECRET ? 'Sim' : 'Não'}`);
    console.log(`📝 Feedback endpoints disponíveis:`);
    console.log(`   - POST   /api/feedback         (Enviar feedback anônimo)`);
    console.log(`   - GET    /api/feedback         (Listar feedbacks - gerente)`);
    console.log(`   - PUT    /api/feedback/:id/status  (Atualizar status - gerente)`);
    console.log(`   - PUT    /api/feedback/:id/respond (Responder feedback - gerente)`);
});