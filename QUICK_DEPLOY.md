# 🚀 Deploy Rápido MindTrack na Render

## ⚡ Deploy Simples (SQLite - Para Teste/Demo)

### ✅ PRÉ-REQUISITOS
- Conta no [Render](https://render.com)
- Repositório no GitHub/GitLab (já feito!)

### 1. Preparar o código
```bash
# Commit das mudanças
git add .
git commit -m "Prepare for Render deploy"
git push origin main
```

### 2. Criar Web Service no Render
1. Acesse [dashboard.render.com](https://dashboard.render.com)
2. Clique **"New"** → **"Web Service"**
3. Conecte seu repositório GitHub/GitLab

### 3. Configurar o serviço
- **Runtime**: `Node.js`
- **Build Command**: `npm install`
- **Start Command**: `npm start` (ou `node server.js`)
- **Root Directory**: `` (vazio - usar raiz do projeto)

### 4. Adicionar variáveis de ambiente
```
NODE_ENV=production
JWT_SECRET=sua-chave-secreta-muito-forte-aqui
FRONTEND_URL=https://SEU-APP-NAME.render.com
```

### 5. Deploy
- Clique **"Create Web Service"**
- Aguarde o build (5-10 minutos)
- Acesse a URL gerada

## 🔑 Credenciais de Teste
Após o deploy, use:
- **Email**: `admin@mindtrack.com`
- **Senha**: `admin123`

## 📊 Verificar se está funcionando
1. Acesse a URL do Render
2. Página de login deve aparecer
3. Faça login com as credenciais acima
4. Dashboard deve carregar

## ⚠️ Limitações do SQLite
- Dados são perdidos em novos deploys
- Não recomendado para produção real
- Use apenas para teste/demo

## 🔄 Próximos Passos (Produção)
Para produção real, migre para PostgreSQL seguindo o guia em `RENDER_DEPLOY_GUIDE.md`

## 🐛 Problemas Comuns
- **Erro 404**: Verifique se Root Directory está vazio (raiz)
- **Build falha**: Verifique se package.json tem todas dependências
- **App não inicia**: Verifique logs no Render dashboard

---
**🎉 Agora vai funcionar!** O problema era que o Render esperava os arquivos na raiz do projeto.</content>
<parameter name="filePath">c:\Users\ladei\Desktop\database.sql\TEAMFLOW\QUICK_DEPLOY.md