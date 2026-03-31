# MindTrack Backend API

API REST para o sistema MindTrack de controle emocional e bem-estar corporativo.

## 🚀 Funcionalidades

- **Autenticação JWT** com roles (employee/manager)
- **Registro de Emoções** diárias com comentários
- **Metas Pessoais** com acompanhamento de progresso
- **Feedback Anônimo** para sugestões
- **Dashboard Gerencial** com analytics da equipe
- **Logs de Auditoria** e tratamento robusto de erros

## 📋 Pré-requisitos

- Node.js 16+
- SQLite3

## 🛠️ Instalação

1. **Instalar dependências:**
   ```bash
   npm install
   ```

2. **Configurar ambiente:**
   ```bash
   cp .env.example .env
   # Edite o .env com suas configurações
   ```

3. **Executar:**
   ```bash
   npm start
   ```

## 📚 API Endpoints

### Autenticação
- `POST /api/register` - Registrar novo usuário
- `POST /api/login` - Login
- `GET /api/profile` - Perfil do usuário

### Emoções
- `GET /api/emotions` - Listar emoções do usuário
- `POST /api/emotions` - Registrar emoção
- `GET /api/team-emotions` - Emoções da equipe (manager)

### Metas
- `GET /api/goals` - Listar metas
- `POST /api/goals` - Criar meta
- `PUT /api/goals/:id` - Atualizar progresso
- `DELETE /api/goals/:id` - Remover meta

### Feedback
- `POST /api/feedback` - Enviar feedback anônimo
- `GET /api/feedback` - Listar feedbacks (manager)

### Analytics
- `GET /api/analytics/overview` - Visão geral da equipe (manager)

## 🔒 Segurança

- JWT com expiração de 24h
- Bcrypt para hash de senhas
- Headers de segurança
- Validação de entrada
- Controle de acesso por roles

## 📊 Estrutura do Banco

```sql
-- Usuários
CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  type TEXT CHECK(type IN ('employee', 'manager')) NOT NULL
);

-- Emoções
CREATE TABLE emotions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  mood TEXT CHECK(mood IN ('happy', 'good', 'neutral', 'stressed', 'overloaded')) NOT NULL,
  comment TEXT,
  date DATE NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Metas
CREATE TABLE goals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  objective TEXT NOT NULL,
  progress INTEGER DEFAULT 0 CHECK(progress >= 0 AND progress <= 100),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Feedbacks
CREATE TABLE feedback (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  content TEXT NOT NULL,
  date DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

## 🧪 Testes

```bash
# Usuários de teste
# Manager: admin@mindtrack.com / admin123
# Employee: user@mindtrack.com / user123
```

## 📝 Logs

O sistema registra:
- Tentativas de login
- Criação de usuários
- Registros de emoções
- Feedbacks recebidos
- Erros do servidor

## 🚀 Deploy

Para produção:
1. Configure variáveis de ambiente
2. Use um JWT_SECRET forte
3. Configure CORS para seu domínio
4. Use HTTPS
5. Configure logs persistentes

## 🤝 Contribuição

1. Fork o projeto
2. Crie uma branch para sua feature
3. Commit suas mudanças
4. Push para a branch
5. Abra um Pull Request