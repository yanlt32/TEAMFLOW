# MindTrack - Sistema de Controle Emocional e Bem-Estar Corporativo

[![Node.js](https://img.shields.io/badge/Node.js-18+-green.svg)](https://nodejs.org/)
[![SQLite](https://img.shields.io/badge/SQLite-3-blue.svg)](https://www.sqlite.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Um sistema completo para monitoramento emocional, bem-estar e produtividade em empresas, alinhado com as normas NR-1 e práticas ITIL.

## 🎯 Funcionalidades

### Para Funcionários
- ✅ **Check-in Diário de Humor** com 5 níveis (feliz, bom, neutro, estressado, sobrecarregado)
- ✅ **Registro de Metas Pessoais** com acompanhamento de progresso
- ✅ **Histórico Completo** de registros emocionais
- ✅ **Feedback Anônimo** para sugestões à empresa
- ✅ **Dashboard Pessoal** com gráficos e insights

### Para Gestores
- ✅ **Dashboard Gerencial** com visão da equipe
- ✅ **Análise de Tendências** emocionais da equipe
- ✅ **Relatórios de Feedback** anônimos
- ✅ **Monitoramento de Bem-Estar** coletivo
- ✅ **Alertas e Insights** sobre saúde emocional

### Recursos Técnicos
- 🔐 **Autenticação JWT** com roles (employee/manager)
- 📊 **Analytics em Tempo Real** com gráficos interativos
- 🎨 **Interface Moderna** e responsiva
- 📱 **Design Mobile-First**
- 🔒 **Segurança Avançada** (bcrypt, headers de segurança)
- 📝 **Logs de Auditoria** completos

## 🚀 Instalação e Execução

### Pré-requisitos
- Node.js 16+
- Git

### 1. Clone o Repositório
```bash
git clone https://github.com/your-org/mindtrack.git
cd mindtrack
```

### 2. Backend Setup
```bash
cd backend
npm install
cp .env.example .env  # Configure suas variáveis de ambiente
npm run seed         # Popula o banco com dados de teste
npm start           # Inicia o servidor
```

### 3. Frontend
Abra `frontend/index.html` no navegador ou use um servidor local:
```bash
# No diretório raiz
python -m http.server 8080
# Acesse: http://localhost:8080/frontend/
```

## 👥 Usuários de Teste

Após executar o seed, use estas credenciais:

### Gestor
- **Email:** admin@mindtrack.com
- **Senha:** admin123

### Funcionários
- **João Silva:** joao@empresa.com / user123
- **Maria Santos:** maria@empresa.com / user123
- **Pedro Costa:** pedro@empresa.com / user123

## 📊 Estrutura do Projeto

```
mindtrack/
├── backend/                 # API REST
│   ├── server.js           # Servidor Express
│   ├── database.js         # Configuração SQLite
│   ├── seed.js            # Dados de teste
│   ├── package.json       # Dependências backend
│   └── README.md          # Documentação backend
├── frontend/               # Interface Web
│   ├── index.html         # Página de login
│   ├── dashboard.html     # Dashboard principal
│   ├── css/
│   │   └── styles.css     # Estilos modernos
│   └── js/
│       ├── auth.js        # Autenticação
│       └── dashboard.js   # Lógica do dashboard
└── README.md              # Esta documentação
```

## 🛠️ Tecnologias Utilizadas

### Backend
- **Node.js** + **Express.js** - API REST
- **SQLite3** - Banco de dados
- **JWT** - Autenticação
- **bcryptjs** - Hash de senhas
- **CORS** - Controle de origem

### Frontend
- **HTML5** + **CSS3** + **JavaScript ES6**
- **Chart.js** - Gráficos interativos
- **Font Awesome** - Ícones
- **Google Fonts** - Tipografia

## 🔒 Segurança

- Autenticação JWT com expiração
- Hash de senhas com bcrypt
- Headers de segurança (XSS, CSRF)
- Validação de entrada
- Controle de acesso por roles
- Logs de auditoria

## 📈 Funcionalidades Planejadas

- [ ] Notificações push
- [ ] Relatórios PDF
- [ ] API móvel
- [ ] Integração com Slack/Teams
- [ ] Machine Learning para insights
- [ ] Multi-idioma

## 🤝 Contribuição

1. Fork o projeto
2. Crie uma branch (`git checkout -b feature/nova-funcionalidade`)
3. Commit suas mudanças (`git commit -am 'Adiciona nova funcionalidade'`)
4. Push para a branch (`git push origin feature/nova-funcionalidade`)
5. Abra um Pull Request

## 📝 Licença

Este projeto está sob a licença MIT. Veja o arquivo [LICENSE](LICENSE) para detalhes.

## 📞 Suporte

Para suporte, entre em contato:
- **Email:** suporte@mindtrack.com
- **Issues:** [GitHub Issues](https://github.com/your-org/mindtrack/issues)

## 🙏 Agradecimentos

- Norma Regulamentadora NR-1 (Segurança e Saúde no Trabalho)
- Práticas ITIL para gestão de serviços
- Comunidade open source

---

**MindTrack** - Cuidando do bem-estar emocional da sua equipe! 💙

## 📈 Próximas Funcionalidades

- Gráficos avançados no dashboard
- Notificações push
- Relatórios mensais
- Integração com ferramentas de RH
- API para integração externa