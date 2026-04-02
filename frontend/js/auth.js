// auth.js - Autenticação do MindTrack

let API_BASE = 'http://localhost:3000/api';

document.addEventListener('DOMContentLoaded', async function() {
    // Aguardar configuração da API
    if (window.APP_CONFIG) {
        API_BASE = window.APP_CONFIG.API_URL;
    } else {
        await new Promise(resolve => {
            window.addEventListener('apiConfigLoaded', function(e) {
                API_BASE = e.detail.apiUrl;
                resolve();
            });
        });
    }
    
    console.log('📡 API Base:', API_BASE);
    
    // Verificar se já está logado
    const token = localStorage.getItem('token');
    if (token) {
        window.location.href = 'dashboard.html';
        return;
    }
    
    setupPasswordToggle();
    setupFormValidation();
    
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', handleLogin);
    }
});

async function handleLogin(e) {
    e.preventDefault();

    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;

    hideError();

    if (!email || !password) {
        showError('Por favor, preencha todos os campos.');
        return;
    }

    if (!isValidEmail(email)) {
        showError('Por favor, insira um email válido.');
        return;
    }

    const submitBtn = document.querySelector('#loginForm button[type="submit"]');
    const originalText = submitBtn.innerHTML;
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Entrando...';
    submitBtn.disabled = true;

    try {
        // CORREÇÃO: Rota correta é /api/login, não /api/auth/login
        const response = await fetch(`${API_BASE}/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ email, password })
        });

        const data = await response.json();

        if (response.ok) {
            localStorage.setItem('token', data.token);
            localStorage.setItem('user', JSON.stringify(data.user));

            submitBtn.innerHTML = '<i class="fas fa-check"></i> Sucesso!';
            submitBtn.classList.add('btn-success');

            setTimeout(() => {
                window.location.href = 'dashboard.html';
            }, 1000);
        } else {
            let errorMessage = 'Erro ao fazer login.';
            if (data.error === 'Credenciais inválidas') {
                errorMessage = 'Email ou senha incorretos.';
            } else if (data.error === 'Usuário não encontrado') {
                errorMessage = 'Usuário não encontrado.';
            } else if (data.message) {
                errorMessage = data.message;
            }
            showError(errorMessage);
            submitBtn.innerHTML = originalText;
            submitBtn.disabled = false;
        }
    } catch (error) {
        console.error('Login error:', error);
        showError('Erro de conexão. Verifique se o servidor está rodando.');
        submitBtn.innerHTML = originalText;
        submitBtn.disabled = false;
    }
}

function setupPasswordToggle() {
    const passwordToggle = document.getElementById('passwordToggle');
    const passwordInput = document.getElementById('password');

    if (passwordToggle) {
        passwordToggle.addEventListener('click', function() {
            const type = passwordInput.type === 'password' ? 'text' : 'password';
            passwordInput.type = type;
            const icon = this.querySelector('i');
            icon.className = type === 'password' ? 'fas fa-eye' : 'fas fa-eye-slash';
        });
    }
}

function setupFormValidation() {
    const emailInput = document.getElementById('email');
    if (emailInput) {
        emailInput.addEventListener('blur', function() {
            if (this.value && !isValidEmail(this.value)) {
                this.classList.add('error');
            } else {
                this.classList.remove('error');
            }
        });

        emailInput.addEventListener('input', function() {
            if (this.classList.contains('error') && isValidEmail(this.value)) {
                this.classList.remove('error');
            }
        });
    }
}

function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

function showError(message) {
    const errorDiv = document.getElementById('error');
    const errorMessage = document.getElementById('errorMessage');
    if (errorDiv && errorMessage) {
        errorMessage.textContent = message;
        errorDiv.classList.remove('hidden');
    }
}

function hideError() {
    const errorDiv = document.getElementById('error');
    if (errorDiv) {
        errorDiv.classList.add('hidden');
    }
}