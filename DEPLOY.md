# Guia de Deploy - MindTrack

## 🚀 Deploy no Render

1. **Criar conta no Render**: https://render.com

2. **Conectar repositório Git**:
   - Faça push do código para GitHub/GitLab
   - Conecte o repositório no Render

3. **Configurar Web Service**:
   - Runtime: Node.js
   - Build Command: `npm install`
   - Start Command: `npm start`
   - Environment Variables:
     - `NODE_ENV=production`
     - `JWT_SECRET=your-production-secret-key`

4. **Configurar Banco de Dados**:
   - O SQLite será criado automaticamente na primeira execução
   - Para produção, considere usar PostgreSQL

## 🌐 Deploy no Vercel

1. **Criar conta no Vercel**: https://vercel.com

2. **Deploy do Backend**:
   - Use Vercel CLI: `npm i -g vercel`
   - `vercel --prod`
   - Configure environment variables

3. **Deploy do Frontend**:
   - Mova arquivos estáticos para uma pasta separada
   - Configure como SPA

## 🐙 Deploy no Railway

1. **Criar conta no Railway**: https://railway.app

2. **Conectar projeto**:
   - Import from GitHub
   - Railway detectará automaticamente Node.js

3. **Configurar variáveis de ambiente**:
   - `JWT_SECRET`
   - `NODE_ENV=production`

## 🔧 Configurações de Produção

### Segurança
- Mude o `JWT_SECRET` para uma chave forte
- Configure HTTPS
- Adicione rate limiting
- Valide inputs no frontend e backend

### Banco de Dados
- Para produção, migre para PostgreSQL/MySQL
- Configure backups automáticos
- Use connection pooling

### Performance
- Adicione compressão (express-compression)
- Configure cache headers
- Otimize queries SQL

## 📱 Acesso ao Sistema

Após deploy, acesse:
- **URL do Deploy**/ (frontend será servido automaticamente)

### Usuários de Teste
- **Funcionário**: joao@empresa.com / 123456
- **Gestor**: maria@empresa.com / 123456

## 🔍 Monitoramento

- Configure logs no Render/Railway
- Monitore uso de recursos
- Configure alertas para erros

## 📈 Próximos Passos

1. Implementar gráficos avançados
2. Adicionar notificações push
3. Criar relatórios mensais
4. Integrar com ferramentas de RH
5. Adicionar testes automatizados