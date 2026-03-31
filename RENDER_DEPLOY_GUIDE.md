# 🚀 Deploy MindTrack na Render

## Problema com SQLite
O projeto atual usa SQLite, que **não é recomendado para produção na Render** porque:
- Dados são perdidos quando o container reinicia
- Não há persistência entre deploys
- Não suporta múltiplas instâncias

## ✅ Solução Recomendada: Usar PostgreSQL

### 1. Criar PostgreSQL no Render
1. Acesse [Render Dashboard](https://dashboard.render.com)
2. Clique em "New" → "PostgreSQL"
3. Configure:
   - Name: `mindtrack-db`
   - Database: `mindtrack_prod`
   - User: `mindtrack_user`
4. Anote a **Internal Database URL** (será usada como variável de ambiente)

### 2. Modificar o código para usar PostgreSQL

#### Instalar dependências:
```bash
npm install pg sequelize
```

#### Criar arquivo `database-prod.js`:
```javascript
const { Sequelize } = require('sequelize');

const sequelize = new Sequelize(process.env.DATABASE_URL, {
  dialect: 'postgres',
  protocol: 'postgres',
  logging: false,
  dialectOptions: {
    ssl: {
      require: true,
      rejectUnauthorized: false
    }
  }
});

module.exports = sequelize;
```

#### Modificar `server.js`:
```javascript
// Substituir require('./database') por:
const db = process.env.NODE_ENV === 'production'
  ? require('./database-prod')
  : require('./database');
```

### 3. Configurar variáveis de ambiente no Render

No painel do Web Service, adicione:
- `DATABASE_URL` = `postgresql://user:password@host:5432/database`
- `JWT_SECRET` = `sua-chave-secreta-producao`
- `NODE_ENV` = `production`
- `FRONTEND_URL` = `https://seu-app.render.com`

### 4. Deploy Steps

1. **Push para Git**:
```bash
git add .
git commit -m "Prepare for production deploy"
git push origin main
```

2. **Criar Web Service no Render**:
   - New → Web Service
   - Connect your repo
   - Configure:
     - **Runtime**: Node.js
     - **Build Command**: `npm install`
     - **Start Command**: `npm start`
     - **Environment**: Production

3. **Adicionar variáveis de ambiente** (ver seção acima)

4. **Deploy**: Clique em "Create Web Service"

### 5. Verificar Deploy

Após o deploy, acesse:
- **URL do app**: `https://seu-app.render.com`
- **Login**: Use as credenciais de teste ou crie novos usuários

## 🔧 Opção Alternativa: Manter SQLite (Não Recomendado)

Se quiser manter SQLite temporariamente:

1. No Render, adicione variável: `NODE_ENV=production`
2. O banco será criado na primeira execução
3. **⚠️ Dados serão perdidos** em novos deploys

## 📋 Checklist Pré-Deploy

- [ ] Código no GitHub/GitLab
- [ ] PostgreSQL criado no Render
- [ ] Variáveis de ambiente configuradas
- [ ] JWT_SECRET forte definido
- [ ] NODE_ENV=production
- [ ] Testado localmente

## 🐛 Troubleshooting

### Erro de conexão com banco:
- Verifique DATABASE_URL
- Certifique-se que PostgreSQL está ativo

### App não inicia:
- Verifique logs no Render
- Confirme que todas dependências estão em package.json

### Frontend não carrega:
- Verifique FRONTEND_URL
- CORS pode estar bloqueando requisições

## 💡 Dicas de Produção

1. **Backup**: Configure backups automáticos do PostgreSQL
2. **Monitoramento**: Use Render logs e analytics
3. **SSL**: Já vem configurado automaticamente
4. **Scaling**: Render suporta auto-scaling

Precisa de ajuda com alguma dessas etapas?</content>
<parameter name="filePath">c:\Users\ladei\Desktop\database.sql\TEAMFLOW\RENDER_DEPLOY_GUIDE.md