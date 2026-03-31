// Professional Authentication
const API_BASE = 'http://localhost:3000/api';

document.addEventListener('DOMContentLoaded', function() {
    setupPasswordToggle();
    setupFormValidation();
});

document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;

    // Clear previous errors
    hideError();

    // Basic validation
    if (!email || !password) {
        showError('Por favor, preencha todos os campos.');
        return;
    }

    if (!isValidEmail(email)) {
        showError('Por favor, insira um email válido.');
        return;
    }

    // Show loading state
    const submitBtn = document.querySelector('#loginForm button[type="submit"]');
    const originalText = submitBtn.innerHTML;
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Entrando...';
    submitBtn.disabled = true;

    try {
        const response = await fetch(`${API_BASE}/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ email, password })
        });

        const data = await response.json();

        if (response.ok) {
            // Success - store token and redirect
            localStorage.setItem('token', data.token);
            localStorage.setItem('user', JSON.stringify(data.user));

            // Show success message briefly
            submitBtn.innerHTML = '<i class="fas fa-check"></i> Sucesso!';
            submitBtn.classList.add('btn-success');

            setTimeout(() => {
                window.location.href = 'dashboard.html';
            }, 1000);

        } else {
            // Handle different error types
            let errorMessage = 'Erro ao fazer login.';

            if (data.error) {
                switch (data.error) {
                    case 'Invalid credentials':
                        errorMessage = 'Email ou senha incorretos.';
                        break;
                    case 'User not found':
                        errorMessage = 'Usuário não encontrado.';
                        break;
                    default:
                        errorMessage = data.error;
                }
            }

            showError(errorMessage);
            submitBtn.innerHTML = originalText;
            submitBtn.disabled = false;
        }
    } catch (error) {
        console.error('Login error:', error);
        showError('Erro de conexão. Verifique sua internet e tente novamente.');
        submitBtn.innerHTML = originalText;
        submitBtn.disabled = false;
    }
});

function setupPasswordToggle() {
    const passwordToggle = document.getElementById('passwordToggle');
    const passwordInput = document.getElementById('password');

    passwordToggle.addEventListener('click', function() {
        const type = passwordInput.type === 'password' ? 'text' : 'password';
        passwordInput.type = type;

        const icon = this.querySelector('i');
        icon.className = type === 'password' ? 'fas fa-eye' : 'fas fa-eye-slash';
    });
}

function setupFormValidation() {
    const emailInput = document.getElementById('email');

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

function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

function showError(message) {
    const errorDiv = document.getElementById('error');
    const errorMessage = document.getElementById('errorMessage');

    errorMessage.textContent = message;
    errorDiv.classList.remove('hidden');
    errorDiv.classList.add('fade-in');
}

function hideError() {
    const errorDiv = document.getElementById('error');
    errorDiv.classList.add('hidden');
}

// Add loading animation styles dynamically
const style = document.createElement('style');
style.textContent = `
    .password-input-container {
        position: relative;
    }

    .password-toggle {
        position: absolute;
        right: 12px;
        top: 50%;
        transform: translateY(-50%);
        background: none;
        border: none;
        color: var(--text-secondary);
        cursor: pointer;
        padding: 4px;
    }

    .password-toggle:hover {
        color: var(--primary-color);
    }

    .btn-full {
        width: 100%;
        justify-content: center;
    }

    .login-card {
        background: var(--surface);
        border-radius: 16px;
        box-shadow: 0 20px 25px -5px rgb(0 0 0 / 0.1), 0 10px 10px -5px rgb(0 0 0 / 0.04);
        padding: 48px;
        max-width: 480px;
        width: 100%;
        margin: 40px auto;
        border: 1px solid var(--border);
    }

    .login-header {
        text-align: center;
        margin-bottom: 32px;
    }

    .logo-section {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 12px;
        margin-bottom: 16px;
    }

    .logo-icon {
        font-size: 32px;
        color: var(--primary-color);
    }

    .login-header h1 {
        font-size: 28px;
        font-weight: 700;
        color: var(--text-primary);
        margin: 0;
    }

    .login-subtitle {
        color: var(--text-secondary);
        font-size: 16px;
        margin: 8px 0 16px 0;
        font-weight: 500;
    }

    .login-description {
        color: var(--text-secondary);
        font-size: 14px;
        line-height: 1.5;
        margin-bottom: 24px;
    }

    .login-features {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 16px;
        margin-bottom: 32px;
    }

    .feature {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 12px;
        background: var(--background);
        border-radius: 8px;
        font-size: 12px;
        color: var(--text-secondary);
    }

    .feature i {
        color: var(--primary-color);
    }

    .login-form {
        margin-bottom: 24px;
    }

    .login-footer {
        text-align: center;
        padding-top: 24px;
        border-top: 1px solid var(--border);
    }

    .login-footer p {
        color: var(--text-secondary);
        font-size: 12px;
        margin: 0;
    }

    .login-footer i {
        color: var(--primary-color);
        margin-right: 8px;
    }

    .form-input.error {
        border-color: var(--danger-color);
        box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.1);
    }

    @media (max-width: 480px) {
        .login-card {
            padding: 24px;
            margin: 20px;
        }

        .login-features {
            grid-template-columns: 1fr;
        }

        .login-header h1 {
            font-size: 24px;
        }
    }
`;
document.head.appendChild(style);