// MindTrack Professional Dashboard

let API_BASE = 'http://localhost:3000/api';
let token = null;
let user = null;
let editingMood = false;
let currentMoodId = null;
let checkinLocked = false;
let checkinLockExpiry = null;

let weeklyChartInstance = null;
let moodChartInstance = null;
let teamMoodChartInstance = null;
let teamEvolutionChartInstance = null;

// ============ INICIALIZAÇÃO ============
document.addEventListener('DOMContentLoaded', async function () {
    token = localStorage.getItem('token');
    user = JSON.parse(localStorage.getItem('user'));

    console.log('👤 Usuário carregado:', user);
    console.log('🔑 Token:', token ? 'Presente' : 'Ausente');

    if (window.APP_CONFIG) {
        API_BASE = window.APP_CONFIG.API_URL;
    } else {
        await new Promise(resolve => {
            window.addEventListener('apiConfigLoaded', function (e) {
                API_BASE = e.detail.apiUrl;
                resolve();
            });
        });
    }

    console.log('✅ API configurada para:', API_BASE);

    if (!token || !user) {
        console.warn('❌ Sem token ou usuário');
        window.location.href = 'index.html';
        return;
    }

    console.log('📋 Tipo de usuário (localStorage):', user.type);
    initializeApp();
});

function initializeApp() {
    console.log('🔧 Inicializando app como:', user?.type === 'manager' ? 'ADMINISTRADOR' : 'FUNCIONÁRIO');

    document.body.setAttribute('data-user-type', user?.type || 'employee');

    setupNavigation();
    setupEventListeners();
    updateUserInfo();
    loadCheckinLock();

    if (user.type === 'manager') {
        console.log('👨‍💼 Configurando interface de ADMINISTRADOR');

        document.querySelectorAll('.employee-only').forEach(el => {
            el.style.setProperty('display', 'none', 'important');
            el.classList.add('hidden');
        });

        document.querySelectorAll('.manager-only').forEach(el => {
            el.style.setProperty('display', 'block', 'important');
            el.classList.remove('hidden');
        });

        document.querySelectorAll('.nav-item.employee-only').forEach(el => {
            el.style.setProperty('display', 'none', 'important');
        });

        document.querySelectorAll('.nav-item.manager-only').forEach(el => {
            el.style.setProperty('display', 'flex', 'important');
        });

        const teamLink = document.querySelector('[data-section="team"]');
        if (teamLink) {
            document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
            teamLink.classList.add('active');
        }

        const teamSection = document.getElementById('teamSection');
        if (teamSection) {
            teamSection.style.setProperty('display', 'block', 'important');
            teamSection.classList.remove('hidden');
        }

        loadTeamMembers();
        loadTeamAnalytics();
    } else {
        console.log('👨‍💼 Configurando interface de FUNCIONÁRIO');

        document.querySelectorAll('.employee-only').forEach(el => {
            el.style.setProperty('display', 'block', 'important');
            el.classList.remove('hidden');
        });

        document.querySelectorAll('.manager-only').forEach(el => {
            el.style.setProperty('display', 'none', 'important');
            el.classList.add('hidden');
        });

        document.querySelectorAll('.nav-item.manager-only').forEach(el => {
            el.style.setProperty('display', 'none', 'important');
        });

        document.querySelectorAll('.nav-item.employee-only').forEach(el => {
            el.style.setProperty('display', 'flex', 'important');
        });

        const dashboardLink = document.querySelector('[data-section="dashboard"]');
        if (dashboardLink) {
            document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
            dashboardLink.classList.add('active');
        }

        loadDashboard();
        checkTodayMood();
    }
}

// ============ CHECK-IN LOCK ============
function loadCheckinLock() {
    const savedLock = localStorage.getItem(`checkin_lock_${user?.id}`);
    if (savedLock) {
        try {
            const lockData = JSON.parse(savedLock);
            if (new Date(lockData.expiry) > new Date()) {
                checkinLocked = true;
                checkinLockExpiry = new Date(lockData.expiry);
            } else {
                localStorage.removeItem(`checkin_lock_${user?.id}`);
                checkinLocked = false;
            }
        } catch (e) {
            localStorage.removeItem(`checkin_lock_${user?.id}`);
            checkinLocked = false;
        }
    }
}

function setCheckinLock() {
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + 1);
    const lockData = {
        locked: true,
        expiry: expiryDate.toISOString(),
        date: new Date().toLocaleDateString('sv-SE')
    };
    localStorage.setItem(`checkin_lock_${user?.id}`, JSON.stringify(lockData));
    checkinLocked = true;
    checkinLockExpiry = expiryDate;
}

function unlockCheckin() {
    localStorage.removeItem(`checkin_lock_${user?.id}`);
    checkinLocked = false;
    checkinLockExpiry = null;
}

window.unlockUserCheckin = async function (userId) {
    try {
        console.log(`🔓 Desbloqueando check-in para usuário ${userId}...`);

        const response = await fetch(`${API_BASE}/unlock-checkin/${userId}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Erro ao desbloquear check-in');
        }

        localStorage.removeItem(`checkin_lock_${userId}`);

        if (user?.id === userId) {
            checkinLocked = false;
            checkinLockExpiry = null;
            checkTodayMood();
            showAlert('✅ Check-in desbloqueado! Você pode fazer novo registro agora.', 'success');
        } else {
            showAlert('✅ Check-in desbloqueado para o usuário!', 'success');
            setTimeout(() => {
                loadTeamMembers();
                loadTeamAnalytics();
            }, 500);
        }
    } catch (error) {
        console.error('❌ Erro ao desbloquear check-in:', error);
        showAlert(`Erro: ${error.message}`, 'danger');
    }
};

// ============ NAVEGAÇÃO ============
function setupNavigation() {
    const navLinks = document.querySelectorAll('.nav-link');
    navLinks.forEach(link => {
        link.addEventListener('click', function (e) {
            e.preventDefault();
            navLinks.forEach(l => l.classList.remove('active'));
            this.classList.add('active');
            showSection(this.dataset.section);
        });
    });
}

function setupEventListeners() {
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) logoutBtn.addEventListener('click', logout);

    document.querySelectorAll('.mood-option').forEach(option => {
        option.addEventListener('click', function () {
            if (!editingMood) {
                document.querySelectorAll('.mood-option').forEach(opt => opt.classList.remove('selected'));
                this.classList.add('selected');
            }
        });
    });

    const submitMoodBtn = document.getElementById('submitMood');
    if (submitMoodBtn) submitMoodBtn.addEventListener('click', submitMood);

    const editMoodBtn = document.getElementById('editMoodBtn');
    if (editMoodBtn) editMoodBtn.addEventListener('click', updateMood);

    const cancelEditBtn = document.getElementById('cancelEditBtn');
    if (cancelEditBtn) cancelEditBtn.addEventListener('click', cancelEdit);

    const goalForm = document.getElementById('goalForm');
    if (goalForm) goalForm.addEventListener('submit', addGoal);

    const submitFeedbackBtn = document.getElementById('submitFeedback');
    if (submitFeedbackBtn) submitFeedbackBtn.addEventListener('click', submitFeedback);

    const applyFiltersBtn = document.getElementById('applyFilters');
    if (applyFiltersBtn) applyFiltersBtn.addEventListener('click', renderFeedbackList);
}

function updateUserInfo() {
    const userNameSpan = document.getElementById('userName');
    const userAvatarDiv = document.getElementById('userAvatar');
    const userRoleSpan = document.getElementById('userRole');

    if (!user) return;

    const userName = user.name || 'Usuário';
    const userInitial = (user.name || 'U').charAt(0).toUpperCase();

    if (userNameSpan) userNameSpan.textContent = userName;
    if (userAvatarDiv) userAvatarDiv.textContent = userInitial;
    if (userRoleSpan) {
        userRoleSpan.textContent = user.type === 'manager' ? 'Administrador' : 'Funcionário';
        userRoleSpan.style.fontSize = '11px';
        userRoleSpan.style.backgroundColor = '#f3f4f6';
        userRoleSpan.style.padding = '2px 8px';
        userRoleSpan.style.borderRadius = '20px';
        userRoleSpan.style.marginLeft = '8px';
    }
}

function showSection(sectionName) {
    const allowedSections = {
        'employee': ['dashboard', 'checkin', 'history', 'goals', 'feedback'],
        'manager': ['team', 'teamAnalytics', 'feedback']
    };

    const userType = user?.type || 'employee';
    const permitted = allowedSections[userType] || allowedSections['employee'];

    if (!permitted.includes(sectionName)) {
        console.warn(`❌ Acesso negado à seção: ${sectionName}`);
        return;
    }

    document.querySelectorAll('.section').forEach(section => {
        section.classList.add('hidden');
        section.style.display = 'none';
    });

    const targetSection = document.getElementById(sectionName + 'Section');
    if (targetSection) {
        targetSection.classList.remove('hidden');
        targetSection.style.setProperty('display', 'block', 'important');

        switch (sectionName) {
            case 'dashboard': if (user.type !== 'manager') loadDashboard(); break;
            case 'history': if (user.type !== 'manager') loadHistory(); break;
            case 'goals': if (user.type !== 'manager') loadGoals(); break;
            case 'feedback': loadFeedback(); break;
            case 'team': if (user.type === 'manager') loadTeamMembers(); break;
            case 'teamAnalytics': if (user.type === 'manager') loadTeamAnalytics(); break;
            case 'checkin': loadCheckin(); break;
        }
    }
}

function logout() {
    localStorage.clear();
    window.location.href = 'index.html';
}

// ============ CHECK-IN ============
async function checkTodayMood() {
    try {
        const submitBtn = document.getElementById('submitMood');
        const editBtn = document.getElementById('editMoodBtn');
        const cancelBtn = document.getElementById('cancelEditBtn');
        const checkinMessage = document.getElementById('checkinMessage');
        const checkinSubtitle = document.getElementById('checkinSubtitle');
        const moodSelector = document.getElementById('moodSelector');

        if (checkinLocked) {
            if (checkinSubtitle) checkinSubtitle.textContent = 'Check-in realizado com sucesso!';
            if (checkinMessage) {
                const expiryDate = checkinLockExpiry
                    ? new Date(checkinLockExpiry).toLocaleDateString('pt-BR')
                    : 'amanhã';
                checkinMessage.classList.remove('hidden');
                checkinMessage.innerHTML = `<i class="fas fa-lock"></i> Você já realizou seu check-in hoje. Próximo disponível em: <strong>${expiryDate}</strong>`;
                checkinMessage.classList.add('alert-success');
            }
            if (moodSelector) moodSelector.style.opacity = '0.5';
            if (submitBtn) submitBtn.classList.add('hidden');
            if (editBtn) editBtn.classList.add('hidden');
            if (cancelBtn) cancelBtn.classList.add('hidden');
            return;
        }

        const emotions = await fetchEmotions();
        const today = new Date().toLocaleDateString('sv-SE');
        const todayEmotion = emotions.find(e => e.date === today);

        if (moodSelector) moodSelector.style.opacity = '1';

        if (todayEmotion) {
            currentMoodId = todayEmotion.id;
            if (checkinSubtitle) checkinSubtitle.textContent = 'Você já registrou seu humor hoje. Deseja alterar?';
            if (checkinMessage) {
                checkinMessage.classList.remove('hidden');
                checkinMessage.innerHTML = `<i class="fas fa-info-circle"></i> Humor registrado hoje: <strong>${getMoodLabel(todayEmotion.mood)} ${getMoodEmoji(todayEmotion.mood)}</strong>`;
                checkinMessage.classList.add('alert-info');
            }
            if (submitBtn) submitBtn.classList.add('hidden');
            if (editBtn) editBtn.classList.remove('hidden');
            if (cancelBtn) cancelBtn.classList.remove('hidden');

            document.querySelectorAll('.mood-option').forEach(opt => {
                opt.classList.toggle('selected', opt.dataset.mood === todayEmotion.mood);
            });

            const commentField = document.getElementById('comment');
            if (commentField && todayEmotion.comment) commentField.value = todayEmotion.comment;
        } else {
            currentMoodId = null;
            if (checkinSubtitle) checkinSubtitle.textContent = 'Como você está se sentindo hoje?';
            if (checkinMessage) checkinMessage.classList.add('hidden');
            if (submitBtn) submitBtn.classList.remove('hidden');
            if (editBtn) editBtn.classList.add('hidden');
            if (cancelBtn) cancelBtn.classList.add('hidden');

            const commentField = document.getElementById('comment');
            if (commentField) commentField.value = '';
        }
    } catch (error) {
        console.error('Erro ao verificar humor de hoje:', error);
    }
}

async function submitMood() {
    if (checkinLocked) {
        showAlert('Check-in já realizado hoje! Volte amanhã.', 'warning');
        return;
    }

    const selectedMood = document.querySelector('.mood-option.selected');
    if (!selectedMood) {
        showAlert('Selecione um humor', 'warning');
        return;
    }

    const mood = selectedMood.dataset.mood;
    const comment = document.getElementById('comment')?.value || '';

    try {
        const response = await fetch(`${API_BASE}/emotions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ mood, comment })
        });

        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.error || 'Erro ao registrar');
        }

        showSuggestion(mood);
        if (document.getElementById('comment')) document.getElementById('comment').value = '';
        document.querySelectorAll('.mood-option').forEach(opt => opt.classList.remove('selected'));
        showAlert('Humor registrado com sucesso!', 'success');

        setCheckinLock();
        checkTodayMood();
        loadDashboard();

        setTimeout(() => {
            const dashboardLink = document.querySelector('.nav-link[data-section="dashboard"]');
            if (dashboardLink) dashboardLink.click();
        }, 2000);
    } catch (error) {
        console.error('Erro ao registrar humor:', error);
        showAlert('Erro ao registrar humor', 'danger');
    }
}

async function updateMood() {
    if (!currentMoodId) return;

    const selectedMood = document.querySelector('.mood-option.selected');
    if (!selectedMood) {
        showAlert('Selecione um humor', 'warning');
        return;
    }

    const mood = selectedMood.dataset.mood;
    const comment = document.getElementById('comment')?.value || '';

    try {
        const response = await fetch(`${API_BASE}/emotions/${currentMoodId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ mood, comment })
        });

        if (!response.ok) throw new Error('Erro ao atualizar');

        showAlert('Humor atualizado com sucesso!', 'success');
        cancelEdit();
        checkTodayMood();
        loadDashboard();
    } catch (error) {
        showAlert('Erro ao atualizar humor', 'danger');
    }
}

async function deleteEmotion(emotionId) {
    if (!confirm('Tem certeza que deseja excluir este registro?')) return;

    try {
        const response = await fetch(`${API_BASE}/emotions/${emotionId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (response.ok) {
            showAlert('Registro excluído com sucesso!', 'success');
            loadHistory();
            loadDashboard();
            checkTodayMood();
            return;
        }

        if (response.status === 404) {
            showAlert('Registro não encontrado.', 'warning');
            return;
        }

        throw new Error('Erro ao excluir');
    } catch (error) {
        console.error('Erro ao excluir emoção:', error);
        showAlert('Erro ao excluir registro', 'danger');
    }
}

function cancelEdit() {
    editingMood = false;
    currentMoodId = null;
    document.querySelectorAll('.mood-option').forEach(opt => opt.classList.remove('selected'));
    const commentField = document.getElementById('comment');
    if (commentField) commentField.value = '';
    checkTodayMood();
}

function editTodayMood() {
    editingMood = true;
    const submitBtn = document.getElementById('submitMood');
    const editBtn = document.getElementById('editMoodBtn');
    const cancelBtn = document.getElementById('cancelEditBtn');
    if (submitBtn) submitBtn.classList.add('hidden');
    if (editBtn) editBtn.classList.remove('hidden');
    if (cancelBtn) cancelBtn.classList.remove('hidden');
}

function showSuggestion(mood) {
    const suggestions = {
        happy: 'Continue mantendo o bom humor! 🎉',
        good: 'Ótimo dia! Mantenha o equilíbrio. ✨',
        neutral: 'Que tal organizar suas tarefas para se sentir mais produtivo? 📋',
        stressed: 'Faça uma pausa e respire fundo. 🧘‍♀️',
        overloaded: 'Pausa necessária! Descanse e reorganize suas prioridades. ⏰'
    };

    const suggestionEl = document.getElementById('suggestion');
    if (suggestionEl) {
        const suggestionText = document.getElementById('suggestionText');
        if (suggestionText) suggestionText.textContent = suggestions[mood] || '';
        suggestionEl.classList.remove('hidden');
        setTimeout(() => suggestionEl.classList.add('hidden'), 5000);
    }
}

function loadCheckin() {
    checkTodayMood();
}

// ============ DASHBOARD ============
async function loadDashboard() {
    try {
        const emotions = await fetchEmotions();
        await updateDashboardStats(emotions);
        createWeeklyChart(emotions);
        createMoodChart(emotions);
        loadRecentActivity(emotions.slice(0, 10));
    } catch (error) {
        console.error('Erro ao carregar dashboard:', error);
    }
}

async function updateDashboardStats(emotions) {
    const today = new Date().toLocaleDateString('sv-SE');
    const todayEmotion = emotions.find(e => e.date === today);

    const todayMoodEl = document.getElementById('todayMood');
    if (todayMoodEl) todayMoodEl.textContent = todayEmotion ? getMoodEmoji(todayEmotion.mood) : '--';

    const weekEmotions = emotions.slice(0, 7);
    const avg = weekEmotions.length > 0
        ? Math.round(weekEmotions.reduce((sum, e) => sum + getMoodScore(e.mood), 0) / weekEmotions.length)
        : 0;
    const weekAverageEl = document.getElementById('weekAverage');
    if (weekAverageEl) weekAverageEl.textContent = avg > 0 ? `${avg}/5` : '--';

    let streak = 0;
    for (let i = 0; i < emotions.length; i++) {
        if (emotions[i].mood !== 'stressed' && emotions[i].mood !== 'overloaded') streak++;
        else break;
    }
    const streakCountEl = document.getElementById('streakCount');
    if (streakCountEl) streakCountEl.textContent = streak;

    try {
        const goalsResponse = await fetch(`${API_BASE}/goals`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!goalsResponse.ok) throw new Error('Falha ao carregar metas');
        const goals = await goalsResponse.json();
        const avgProgress = goals.length > 0
            ? Math.round(goals.reduce((sum, g) => sum + g.progress, 0) / goals.length)
            : 0;
        const goalsProgressEl = document.getElementById('goalsProgress');
        if (goalsProgressEl) goalsProgressEl.textContent = `${avgProgress}%`;
    } catch (error) {
        const goalsProgressEl = document.getElementById('goalsProgress');
        if (goalsProgressEl) goalsProgressEl.textContent = '--%';
    }
}

function createWeeklyChart(emotions) {
    const canvas = document.getElementById('weeklyChart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    if (weeklyChartInstance) {
        try { weeklyChartInstance.destroy(); } catch (e) { }
        weeklyChartInstance = null;
    }

    const last7Days = [];
    for (let i = 6; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        last7Days.push(date.toISOString().split('T')[0]);
    }

    const data = last7Days.map(date => {
        const emotion = emotions.find(e => e.date === date);
        return emotion ? getMoodScore(emotion.mood) : null;
    });

    weeklyChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: last7Days.map(date => new Date(date + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'short' })),
            datasets: [{
                label: 'Nível Emocional',
                data,
                borderColor: '#2563eb',
                backgroundColor: 'rgba(37, 99, 235, 0.1)',
                borderWidth: 3,
                tension: 0.4,
                fill: true,
                spanGaps: true,
                pointBackgroundColor: '#2563eb',
                pointBorderColor: '#fff',
                pointBorderWidth: 2,
                pointRadius: 6,
                pointHoverRadius: 8
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: function (context) {
                            const value = context.raw;
                            if (value === null) return 'Sem registro';
                            const moods = ['😡 Muito Ruim', '😞 Ruim', '😐 Neutro', '🙂 Bom', '😄 Excelente'];
                            return moods[value - 1] || `Nível ${value}`;
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true, max: 5, min: 0,
                    grid: { color: '#e5e5e5' },
                    ticks: {
                        callback: function (value) {
                            const moods = ['😡', '😞', '😐', '🙂', '😄'];
                            return moods[value - 1] || value;
                        }
                    }
                },
                x: { grid: { display: false } }
            }
        }
    });
}

function createMoodChart(emotions) {
    const canvas = document.getElementById('moodChart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    if (moodChartInstance) {
        try { moodChartInstance.destroy(); } catch (e) { }
        moodChartInstance = null;
    }

    const moodCounts = { happy: 0, good: 0, neutral: 0, stressed: 0, overloaded: 0 };
    emotions.forEach(e => { if (moodCounts[e.mood] !== undefined) moodCounts[e.mood]++; });

    moodChartInstance = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Feliz', 'Bem', 'Neutro', 'Estressado', 'Sobrecarregado'],
            datasets: [{
                data: [moodCounts.happy, moodCounts.good, moodCounts.neutral, moodCounts.stressed, moodCounts.overloaded],
                backgroundColor: ['#10b981', '#84cc16', '#6b7280', '#f59e0b', '#ef4444'],
                borderWidth: 0,
                hoverOffset: 10
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { position: 'bottom' } },
            cutout: '60%'
        }
    });
}

function loadRecentActivity(emotions) {
    const container = document.getElementById('recentActivity');
    if (!container) return;

    if (emotions.length === 0) {
        container.innerHTML = '<div class="no-data"><i class="fas fa-chart-line"></i><p>Nenhum registro encontrado</p></div>';
        return;
    }

    const moodCounts = {};
    emotions.forEach(emotion => {
        moodCounts[emotion.mood] = (moodCounts[emotion.mood] || 0) + 1;
    });

    const moodOrder = ['happy', 'good', 'neutral', 'stressed', 'overloaded'];
    const aggregated = moodOrder.filter(mood => moodCounts[mood]).map(mood => ({ mood, count: moodCounts[mood] }));

    container.innerHTML = aggregated.map(item => `
        <div class="emotion-entry">
            <div class="emotion-mood">
                <span class="mood-emoji">${getMoodEmoji(item.mood)}</span>
                <span>${getMoodLabel(item.mood)}</span>
                <span class="mood-count">(${item.count})</span>
            </div>
        </div>
    `).join('');
}

// ============ HISTÓRICO ============
async function loadHistory() {
    try {
        const emotions = await fetchEmotions();
        const container = document.getElementById('historyList');
        if (!container) return;

        if (emotions.length === 0) {
            container.innerHTML = '<div class="no-data"><i class="fas fa-history"></i><p>Nenhum registro encontrado</p></div>';
            return;
        }

        container.innerHTML = emotions.map(emotion => `
            <div class="emotion-entry">
                <div class="emotion-date">${formatDate(emotion.date)}</div>
                <div class="emotion-mood">
                    <span class="mood-emoji">${getMoodEmoji(emotion.mood)}</span>
                    <span>${getMoodLabel(emotion.mood)}</span>
                </div>
                ${emotion.comment ? `<div class="emotion-comment">${escapeHtml(emotion.comment)}</div>` : ''}
                <button class="delete-btn" onclick="deleteEmotion(${emotion.id})" title="Excluir registro">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        `).join('');
    } catch (error) {
        console.error('Erro ao carregar histórico:', error);
    }
}

// ============ METAS ============
async function loadGoals() {
    try {
        const response = await fetch(`${API_BASE}/goals`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!response.ok) throw new Error('Falha ao carregar metas');
        const goals = await response.json();

        const container = document.getElementById('goalsList');
        const completedContainer = document.getElementById('completedGoalsList');
        if (!container) return;

        const activeGoals = goals.filter(g => g.progress < 100);
        const completedGoals = goals.filter(g => g.progress === 100);

        if (activeGoals.length === 0 && completedGoals.length === 0) {
            container.innerHTML = '<div class="no-data"><i class="fas fa-bullseye"></i><p>Nenhuma meta definida</p></div>';
            if (completedContainer) completedContainer.innerHTML = '';
            return;
        }

        container.innerHTML = activeGoals.length === 0
            ? '<div class="no-data"><i class="fas fa-check-circle"></i><p>Todas as metas foram concluídas!</p></div>'
            : activeGoals.map(goal => `
                <div class="goal-item">
                    <div class="goal-header">
                        <div class="goal-title">${escapeHtml(goal.objective)}</div>
                        <button class="delete-btn" onclick="deleteGoal(${goal.id})" title="Remover meta" style="background:none;border:none;color:#ef4444;cursor:pointer;font-size:16px;">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                    <div class="goal-progress">
                        <div class="progress-bar"><div class="progress-fill" style="width:${goal.progress}%"></div></div>
                        <div class="progress-text">${goal.progress}%</div>
                    </div>
                    <input type="range" min="0" max="100" value="${goal.progress}"
                           onchange="updateGoalProgress(${goal.id}, this.value)" style="width:100%;margin-top:8px;">
                </div>
            `).join('');

        const completedCard = document.getElementById('completedGoalsCard');
        if (completedContainer) {
            if (completedGoals.length === 0) {
                completedContainer.innerHTML = '';
                if (completedCard) completedCard.style.display = 'none';
            } else {
                if (completedCard) completedCard.style.display = 'block';
                completedContainer.innerHTML = completedGoals.map(goal => `
                    <div class="goal-item completed" style="opacity:0.7;">
                        <div class="goal-header">
                            <div class="goal-title"><i class="fas fa-check" style="color:#10b981;margin-right:8px;"></i>${escapeHtml(goal.objective)}</div>
                            <button class="delete-btn" onclick="deleteGoal(${goal.id})" title="Remover meta" style="background:none;border:none;color:#ef4444;cursor:pointer;font-size:16px;">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                        <div class="goal-progress">
                            <div class="progress-bar"><div class="progress-fill" style="width:100%"></div></div>
                            <div class="progress-text">100%</div>
                        </div>
                    </div>
                `).join('');
            }
        }
    } catch (error) {
        console.error('Erro ao carregar metas:', error);
    }
}

async function addGoal(e) {
    e.preventDefault();
    const objective = document.getElementById('goalInput')?.value?.trim();
    if (!objective) return;

    try {
        const response = await fetch(`${API_BASE}/goals`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ objective })
        });

        if (response.ok) {
            document.getElementById('goalInput').value = '';
            loadGoals();
            showAlert('Meta adicionada com sucesso!', 'success');
        }
    } catch (error) {
        showAlert('Erro ao adicionar meta', 'danger');
    }
}

async function updateGoalProgress(id, progress) {
    try {
        await fetch(`${API_BASE}/goals/${id}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ progress: parseInt(progress) })
        });
        showAlert('Progresso atualizado!', 'success');
        loadGoals();
    } catch (error) {
        showAlert('Erro ao atualizar progresso', 'danger');
    }
}

async function deleteGoal(id) {
    if (!confirm('Tem certeza que deseja remover esta meta?')) return;

    try {
        const response = await fetch(`${API_BASE}/goals/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (response.ok) {
            showAlert('Meta removida com sucesso!', 'success');
            loadGoals();
            loadDashboard();
            return;
        }
        throw new Error('Erro ao remover');
    } catch (error) {
        console.error('Erro ao deletar meta:', error);
        showAlert('Erro ao remover meta', 'danger');
    }
}

// ============ EQUIPE (MANAGER) ============
async function loadTeamMembers() {
    try {
        const response = await fetch(`${API_BASE}/team-members`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!response.ok) throw new Error('Falha ao carregar equipe');
        const members = await response.json();
        renderTeamMembers(members);
        calculateTeamStats(members);
    } catch (error) {
        console.error('Erro ao carregar equipe:', error);
        showAlert('Erro ao carregar lista de funcionários', 'danger');
    }
}

function renderTeamMembers(members) {
    const container = document.getElementById('teamMembersList');
    if (!container) return;

    if (members.length === 0) {
        container.innerHTML = '<div class="no-data"><i class="fas fa-users"></i><p>Nenhum funcionário cadastrado</p></div>';
        return;
    }

    container.innerHTML = members.map(member => `
        <div class="team-card" onclick="showMemberDetails(${member.id})">
            <div class="team-card-header">
                <h3>${escapeHtml(member.name)}</h3>
                <p>${escapeHtml(member.email)}</p>
                <div class="team-mood-badge" id="memberMood-${member.id}">😐</div>
            </div>
            <div class="team-card-content">
                <div class="team-stats">
                    <div class="team-stat">
                        <div class="team-stat-value" id="memberMoodCount-${member.id}">0</div>
                        <div class="team-stat-label">Registros</div>
                    </div>
                    <div class="team-stat">
                        <div class="team-stat-value" id="memberGoalsCount-${member.id}">0</div>
                        <div class="team-stat-label">Metas</div>
                    </div>
                    <div class="team-stat">
                        <div class="team-stat-value" id="memberAvgMood-${member.id}">0</div>
                        <div class="team-stat-label">Média</div>
                    </div>
                </div>
                <button class="btn-unlock-checkin" onclick="event.stopPropagation(); unlockUserCheckin(${member.id})"
                    style="margin-top:12px;width:100%;background:#f59e0b;color:white;border:none;padding:6px;border-radius:8px;cursor:pointer;">
                    <i class="fas fa-unlock-alt"></i> Desbloquear Check-in
                </button>
            </div>
        </div>
    `).join('');

    members.forEach(member => loadMemberStats(member.id));
}

async function loadMemberStats(memberId) {
    try {
        const response = await fetch(`${API_BASE}/member/${memberId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!response.ok) return;

        const data = await response.json();
        const emotions = data.emotions || [];
        const goals = data.goals || [];
        const avgScore = emotions.length > 0
            ? Math.round(emotions.reduce((sum, e) => sum + getMoodScore(e.mood), 0) / emotions.length)
            : 0;
        const lastMood = emotions.length > 0 ? emotions[0].mood : 'neutral';

        const moodCountEl = document.getElementById(`memberMoodCount-${memberId}`);
        const goalsCountEl = document.getElementById(`memberGoalsCount-${memberId}`);
        const avgMoodEl = document.getElementById(`memberAvgMood-${memberId}`);
        const moodBadgeEl = document.getElementById(`memberMood-${memberId}`);

        if (moodCountEl) moodCountEl.textContent = emotions.length;
        if (goalsCountEl) goalsCountEl.textContent = goals.length;
        if (avgMoodEl) avgMoodEl.textContent = avgScore;
        if (moodBadgeEl) moodBadgeEl.textContent = getMoodEmoji(lastMood);
    } catch (error) {
        console.error('Erro ao carregar stats do membro:', error);
    }
}

async function calculateTeamStats(members) {
    let totalEmotions = 0, totalGoals = 0, totalMoodScore = 0, membersWithMood = 0;

    for (const member of members) {
        try {
            const response = await fetch(`${API_BASE}/member/${member.id}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!response.ok) continue;

            const data = await response.json();
            const emotions = data.emotions || [];
            const goals = data.goals || [];
            totalEmotions += emotions.length;
            totalGoals += goals.length;
            if (emotions.length > 0) {
                totalMoodScore += emotions.reduce((sum, e) => sum + getMoodScore(e.mood), 0) / emotions.length;
                membersWithMood++;
            }
        } catch (error) {
            console.error('Erro ao calcular stats:', error);
        }
    }

    const totalEl = document.getElementById('teamTotalMembers');
    const emotionsEl = document.getElementById('teamTotalEmotions');
    const goalsEl = document.getElementById('teamTotalGoals');
    const avgEl = document.getElementById('teamAvgMood');

    if (totalEl) totalEl.textContent = members.length;
    if (emotionsEl) emotionsEl.textContent = totalEmotions;
    if (goalsEl) goalsEl.textContent = totalGoals;
    if (avgEl) avgEl.textContent = membersWithMood > 0 ? (totalMoodScore / membersWithMood).toFixed(1) : '0';
}

async function loadTeamAnalytics() {
    try {
        const response = await fetch(`${API_BASE}/team-members`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!response.ok) {
            showAlert('Erro ao carregar análises da equipe', 'danger');
            return;
        }

        const members = await response.json();
        let allEmotions = [], completedGoals = 0, activeMembers = 0, totalCheckins = 0;
        const memberMoodData = {};

        for (const member of members) {
            const memberData = await fetch(`${API_BASE}/member/${member.id}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!memberData.ok) continue;

            const data = await memberData.json();
            const emotions = data.emotions || [];
            const goals = data.goals || [];
            allEmotions.push(...emotions);
            completedGoals += goals.filter(g => g.progress === 100).length;
            if (emotions.length > 0) activeMembers++;
            totalCheckins += emotions.length;
            memberMoodData[member.name] = emotions;
        }

        const moodCounts = { happy: 0, good: 0, neutral: 0, stressed: 0, overloaded: 0 };
        allEmotions.forEach(e => { if (moodCounts[e.mood] !== undefined) moodCounts[e.mood]++; });

        const teamCtx = document.getElementById('teamMoodChart')?.getContext('2d');
        if (teamCtx) {
            if (teamMoodChartInstance) { try { teamMoodChartInstance.destroy(); } catch (e) { } }
            teamMoodChartInstance = new Chart(teamCtx, {
                type: 'doughnut',
                data: {
                    labels: ['Feliz', 'Bem', 'Neutro', 'Estressado', 'Sobrecarregado'],
                    datasets: [{
                        data: [moodCounts.happy, moodCounts.good, moodCounts.neutral, moodCounts.stressed, moodCounts.overloaded],
                        backgroundColor: ['#10b981', '#84cc16', '#6b7280', '#f59e0b', '#ef4444'],
                        borderWidth: 0,
                        hoverOffset: 10
                    }]
                },
                options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } }, cutout: '60%' }
            });
        }

        const evolutionCtx = document.getElementById('teamEvolutionChart')?.getContext('2d');
        if (evolutionCtx && members.length > 0) {
            if (teamEvolutionChartInstance) { try { teamEvolutionChartInstance.destroy(); } catch (e) { } }

            const last7Days = [];
            for (let i = 6; i >= 0; i--) {
                const date = new Date();
                date.setDate(date.getDate() - i);
                last7Days.push(date.toISOString().split('T')[0]);
            }

            const dailyAverages = last7Days.map(date => {
                let totalScore = 0, count = 0;
                members.forEach(member => {
                    const memberEmotions = memberMoodData[member.name] || [];
                    const dayEmotion = memberEmotions.find(e => e.date === date);
                    if (dayEmotion) { totalScore += getMoodScore(dayEmotion.mood); count++; }
                });
                return count > 0 ? totalScore / count : null;
            });

            teamEvolutionChartInstance = new Chart(evolutionCtx, {
                type: 'line',
                data: {
                    labels: last7Days.map(date => new Date(date + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'short' })),
                    datasets: [{
                        label: 'Média Emocional da Equipe',
                        data: dailyAverages,
                        borderColor: '#10b981',
                        backgroundColor: 'rgba(16, 185, 129, 0.1)',
                        borderWidth: 3,
                        tension: 0.4,
                        fill: true,
                        spanGaps: true,
                        pointBackgroundColor: '#10b981',
                        pointBorderColor: '#fff',
                        pointBorderWidth: 2,
                        pointRadius: 4,
                        pointHoverRadius: 6
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { display: true, position: 'top' },
                        tooltip: {
                            callbacks: {
                                label: function (context) {
                                    const value = context.raw;
                                    if (value === null) return 'Sem registros';
                                    const moods = ['😡', '😞', '😐', '🙂', '😄'];
                                    return `Média: ${value.toFixed(1)} ${moods[Math.round(value) - 1] || ''}`;
                                }
                            }
                        }
                    },
                    scales: {
                        y: {
                            beginAtZero: true, max: 5, min: 0,
                            grid: { color: '#e5e5e5' },
                            title: { display: true, text: 'Nível Emocional' }
                        },
                        x: { grid: { display: false }, title: { display: true, text: 'Dias' } }
                    }
                }
            });
        }

        const engagementRate = members.length > 0 ? Math.round((activeMembers / members.length) * 100) : 0;
        const avgCheckins = members.length > 0 ? Math.round(totalCheckins / members.length) : 0;

        const engEl = document.getElementById('engagementRate');
        const avgCheckEl = document.getElementById('avgCheckins');
        const activeMembersEl = document.getElementById('activeMembers');
        const goalsCompletedEl = document.getElementById('goalsCompleted');

        if (engEl) engEl.textContent = `${engagementRate}%`;
        if (avgCheckEl) avgCheckEl.textContent = avgCheckins;
        if (activeMembersEl) activeMembersEl.textContent = activeMembers;
        if (goalsCompletedEl) goalsCompletedEl.textContent = completedGoals;
    } catch (error) {
        console.error('Erro ao carregar analytics:', error);
    }
}

async function showMemberDetails(memberId) {
    try {
        const response = await fetch(`${API_BASE}/member/${memberId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!response.ok) throw new Error('Falha ao carregar detalhes');
        const member = await response.json();

        const modalHtml = `
            <div class="modal active" id="memberModal" onclick="closeModal(event)">
                <div class="modal-content" onclick="event.stopPropagation()">
                    <div class="modal-header">
                        <h2><i class="fas fa-user"></i> ${escapeHtml(member.name)}</h2>
                        <button class="modal-close" onclick="closeModal()">&times;</button>
                    </div>
                    <div class="modal-body">
                        <div class="stats-grid" style="margin-bottom:24px;">
                            <div class="stat-card"><div class="stat-value">${member.emotions.length}</div><div class="stat-label">Total Registros</div></div>
                            <div class="stat-card"><div class="stat-value">${member.goals.length}</div><div class="stat-label">Metas</div></div>
                            <div class="stat-card"><div class="stat-value">${member.emotions.length > 0 ? Math.round(member.emotions.reduce((sum, e) => sum + getMoodScore(e.mood), 0) / member.emotions.length) : 0}/5</div><div class="stat-label">Média Emocional</div></div>
                        </div>
                        <div class="card">
                            <div class="card-header"><h3 class="card-title">Histórico de Emoções</h3></div>
                            <div class="card-content">
                                <div class="emotion-timeline">
                                    ${member.emotions.length > 0
                ? member.emotions.map(e => `
                                            <div class="emotion-entry">
                                                <div class="emotion-date">${formatDate(e.date)}</div>
                                                <div class="emotion-mood">
                                                    <span class="mood-emoji">${getMoodEmoji(e.mood)}</span>
                                                    <span>${getMoodLabel(e.mood)}</span>
                                                </div>
                                                ${e.comment ? `<div class="emotion-comment">${escapeHtml(e.comment)}</div>` : ''}
                                            </div>`).join('')
                : '<div class="no-data">Nenhum registro emocional</div>'}
                                </div>
                            </div>
                        </div>
                        <div class="card">
                            <div class="card-header"><h3 class="card-title">Metas de Desenvolvimento</h3></div>
                            <div class="card-content">
                                <div class="goals-list">
                                    ${member.goals.length > 0
                ? member.goals.map(g => `
                                            <div class="goal-item">
                                                <div class="goal-title">${escapeHtml(g.objective)}</div>
                                                <div class="goal-progress">
                                                    <div class="progress-bar"><div class="progress-fill" style="width:${g.progress}%"></div></div>
                                                    <div class="progress-text">${g.progress}%</div>
                                                </div>
                                            </div>`).join('')
                : '<div class="no-data">Nenhuma meta definida</div>'}
                                </div>
                            </div>
                        </div>
                        <button class="btn btn-warning" onclick="unlockUserCheckin(${memberId}); closeModal();"
                            style="width:100%;margin-top:16px;background:#f59e0b;color:white;">
                            <i class="fas fa-unlock-alt"></i> Desbloquear Check-in
                        </button>
                    </div>
                </div>
            </div>`;

        document.body.insertAdjacentHTML('beforeend', modalHtml);
    } catch (error) {
        console.error('Erro ao carregar detalhes:', error);
        showAlert('Erro ao carregar detalhes do funcionário', 'danger');
    }
}

function closeModal(event) {
    const modal = document.getElementById('memberModal');
    if (modal && (!event || event.target === modal || event.target.classList.contains('modal-close'))) {
        modal.remove();
    }
}

// ============ FEEDBACK ============
let feedbackItems = [];

async function submitFeedback() {
    const content = document.getElementById('feedbackText')?.value?.trim();
    if (!content) {
        showAlert('Digite seu feedback', 'warning');
        return;
    }

    try {
        const response = await fetch(`${API_BASE}/feedback`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ content })
        });

        if (response.ok) {
            document.getElementById('feedbackText').value = '';
            showAlert('Feedback enviado com sucesso!', 'success');
            loadUserResponses();
        } else {
            const err = await response.json();
            throw new Error(err.error || 'Erro ao enviar');
        }
    } catch (error) {
        showAlert('Erro ao enviar feedback', 'danger');
    }
}

async function loadUserResponses() {
    try {
        const response = await fetch(`${API_BASE}/feedback/user`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        const responsesSection = document.getElementById('employeeResponses');
        const responsesContainer = document.getElementById('responsesList');

        if (!response.ok) {
            if (responsesSection) responsesSection.classList.add('hidden');
            return;
        }

        const userFeedbacks = await response.json();
        if (!responsesSection || !responsesContainer) return;

        if (userFeedbacks.length > 0) {
            responsesSection.classList.remove('hidden');
            responsesContainer.innerHTML = userFeedbacks.map(f => {
                const responseHtml = f.response
                    ? `<div class="feedback-response">
                        <strong><i class="fas fa-reply"></i> Resposta do Gestor:</strong>
                        <div style="margin-top:8px;padding:12px;background:#f0fdf4;border-radius:8px;border-left:3px solid #10b981;">
                            ${escapeHtml(f.response)}
                        </div>
                       </div>`
                    : `<div class="alert alert-info" style="margin-top:8px;padding:8px 12px;">
                        <i class="fas fa-clock"></i> Aguardando resposta do gestor...
                       </div>`;

                return `<div class="feedback-item responded">
                    <div class="feedback-header">
                        <div class="feedback-date">${formatDate(f.date)}</div>
                        <div class="status-badge ${f.response ? 'status-responded' : 'status-unread'}">
                            ${f.response ? 'Respondido' : 'Aguardando resposta'}
                        </div>
                    </div>
                    <div class="feedback-content"><strong>Seu feedback:</strong> ${escapeHtml(f.content)}</div>
                    ${responseHtml}
                </div>`;
            }).join('');
        } else {
            responsesSection.classList.add('hidden');
        }
    } catch (error) {
        console.error('Erro ao carregar respostas:', error);
    }
}

async function loadFeedback() {
    const isManager = user && user.type === 'manager';
    const managerSection = document.getElementById('managerFeedback');
    const employeeSection = document.getElementById('employeeFeedback');
    const responsesSection = document.getElementById('employeeResponses');
    const subtitle = document.getElementById('feedbackSubtitle');

    if (!isManager) {
        if (managerSection) managerSection.classList.add('hidden');
        if (employeeSection) employeeSection.classList.remove('hidden');
        if (subtitle) subtitle.textContent = 'Compartilhe suas sugestões e veja as respostas dos gestores';
        loadUserResponses();
        return;
    }

    if (managerSection) managerSection.classList.remove('hidden');
    if (employeeSection) employeeSection.classList.add('hidden');
    if (responsesSection) responsesSection.classList.add('hidden');
    if (subtitle) subtitle.textContent = 'Gerencie feedbacks da equipe';

    try {
        const response = await fetch(`${API_BASE}/feedback`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!response.ok) throw new Error('Falha ao carregar feedbacks');
        feedbackItems = await response.json();
        updateFeedbackStats(feedbackItems);
        renderFeedbackList();
        attachFeedbackHandlers();
    } catch (error) {
        console.error('Erro ao carregar feedback:', error);
        showAlert('Erro ao carregar feedback', 'danger');
    }
}

function filterFeedbackItems() {
    const statusFilter = document.getElementById('feedbackStatusFilter')?.value;
    const dateFilter = document.getElementById('feedbackDateFilter')?.value;
    const now = new Date();

    return feedbackItems.filter(item => {
        let statusMatch = true, dateMatch = true;

        if (statusFilter && statusFilter !== 'all') statusMatch = item.status === statusFilter;

        if (dateFilter && dateFilter !== 'all') {
            const itemDate = new Date(item.date);
            let periodStart = new Date(now);
            switch (dateFilter) {
                case 'today': periodStart.setHours(0, 0, 0, 0); break;
                case 'week': periodStart.setDate(now.getDate() - 6); periodStart.setHours(0, 0, 0, 0); break;
                case 'month': periodStart.setMonth(now.getMonth() - 1); periodStart.setHours(0, 0, 0, 0); break;
                case 'quarter': periodStart.setMonth(now.getMonth() - 3); periodStart.setHours(0, 0, 0, 0); break;
                default: periodStart = new Date(0);
            }
            dateMatch = itemDate >= periodStart && itemDate <= now;
        }

        return statusMatch && dateMatch;
    });
}

function updateFeedbackStats(items) {
    const total = items.length;
    const unread = items.filter(i => i.status === 'unread').length;
    const responded = items.filter(i => i.status === 'responded').length;
    const now = new Date();
    const thisMonth = items.filter(i => {
        const d = new Date(i.date);
        return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
    }).length;

    const totalEl = document.getElementById('totalFeedback');
    const unreadEl = document.getElementById('unreadFeedback');
    const monthEl = document.getElementById('thisMonthFeedback');
    const respondedEl = document.getElementById('respondedFeedback');

    if (totalEl) totalEl.textContent = total;
    if (unreadEl) unreadEl.textContent = unread;
    if (monthEl) monthEl.textContent = thisMonth;
    if (respondedEl) respondedEl.textContent = responded;
}

function renderFeedbackList() {
    const container = document.getElementById('feedbackList');
    const noData = document.getElementById('noFeedbackMessage');
    const filteredItems = filterFeedbackItems();
    if (!container || !noData) return;

    if (filteredItems.length === 0) {
        container.innerHTML = '';
        noData.classList.remove('hidden');
        return;
    }

    noData.classList.add('hidden');
    container.innerHTML = filteredItems.map(item => {
        const itemStatus = item.status || 'unread';
        const statusBadge = itemStatus === 'unread' ? 'Não lido' : itemStatus === 'responded' ? 'Respondido' : 'Lido';
        const statusClass = itemStatus === 'unread' ? 'status-unread' : itemStatus === 'responded' ? 'status-responded' : 'status-read';

        return `
            <div class="feedback-item ${itemStatus === 'unread' ? 'unread' : ''}" data-id="${item.id}">
                <div class="feedback-header">
                    <div class="feedback-date">${formatDate(item.date)}</div>
                    <div class="feedback-status"><div class="status-badge ${statusClass}">${statusBadge}</div></div>
                </div>
                <div class="feedback-content">${escapeHtml(item.content)}</div>
                ${item.response
                ? `<div class="feedback-response">
                        <strong><i class="fas fa-reply"></i> Resposta:</strong>
                        <div style="margin-top:8px;padding:8px;background:#f0fdf4;border-radius:8px;">${escapeHtml(item.response)}</div>
                   </div>`
                : ''}
                <div class="feedback-actions">
                    <button class="btn-feedback-action btn-mark-read" data-id="${item.id}" data-status="${itemStatus === 'unread' ? 'read' : 'unread'}">
                        <i class="fas fa-envelope-open"></i> ${itemStatus === 'unread' ? 'Marcar como lido' : 'Marcar como não lido'}
                    </button>
                    <button class="btn-feedback-action btn-respond" data-id="${item.id}">
                        <i class="fas fa-reply"></i> ${itemStatus === 'responded' ? 'Atualizar resposta' : 'Responder'}
                    </button>
                </div>
                <div class="response-form" id="responseForm-${item.id}" style="display:none;">
                    <textarea class="response-textarea" id="responseText-${item.id}" placeholder="Digite sua resposta...">${item.response || ''}</textarea>
                    <div class="response-actions">
                        <button class="btn btn-primary btn-send-response" data-id="${item.id}">Enviar Resposta</button>
                        <button class="btn btn-secondary btn-cancel-response" data-id="${item.id}">Cancelar</button>
                    </div>
                </div>
            </div>`;
    }).join('');
}

function attachFeedbackHandlers() {
    const container = document.getElementById('feedbackList');
    if (!container || container._feedbackHandlersAttached) return;

    container.addEventListener('click', async (e) => {
        if (e.target.closest('.btn-mark-read')) {
            const button = e.target.closest('.btn-mark-read');
            const feedbackId = button.getAttribute('data-id');
            const newStatus = button.getAttribute('data-status');
            await setFeedbackStatus(feedbackId, newStatus);
            // Atualizar localmente sem reload completo
            const item = feedbackItems.find(f => String(f.id) === String(feedbackId));
            if (item) item.status = newStatus;
            updateFeedbackStats(feedbackItems);
            renderFeedbackList();
        }

        if (e.target.closest('.btn-respond')) {
            const feedbackId = e.target.closest('.btn-respond').getAttribute('data-id');
            const form = document.getElementById(`responseForm-${feedbackId}`);
            if (form) form.style.display = form.style.display === 'none' ? 'block' : 'none';
        }

        if (e.target.closest('.btn-cancel-response')) {
            const feedbackId = e.target.closest('.btn-cancel-response').getAttribute('data-id');
            const form = document.getElementById(`responseForm-${feedbackId}`);
            if (form) form.style.display = 'none';
        }

        if (e.target.closest('.btn-send-response')) {
            const feedbackId = e.target.closest('.btn-send-response').getAttribute('data-id');
            const textarea = document.getElementById(`responseText-${feedbackId}`);
            const responseText = textarea?.value?.trim() || '';
            if (!responseText) {
                showAlert('Digite uma resposta antes de enviar', 'warning');
                return;
            }
            await respondFeedback(feedbackId, responseText);
            // Atualizar localmente sem reload completo
            const item = feedbackItems.find(f => String(f.id) === String(feedbackId));
            if (item) { item.response = responseText; item.status = 'responded'; }
            updateFeedbackStats(feedbackItems);
            renderFeedbackList();
        }
    });

    container._feedbackHandlersAttached = true;
}

async function setFeedbackStatus(id, status) {
    try {
        const response = await fetch(`${API_BASE}/feedback/${id}/status`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ status })
        });
        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.error || 'Falha ao atualizar status');
        }
        showAlert('Status atualizado', 'success');
    } catch (error) {
        console.error(error);
        showAlert('Erro ao atualizar status', 'danger');
    }
}

async function respondFeedback(id, responseText) {
    try {
        const response = await fetch(`${API_BASE}/feedback/${id}/respond`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ response: responseText })
        });
        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.error || 'Falha ao responder');
        }
        showAlert('Resposta enviada com sucesso', 'success');
    } catch (error) {
        console.error(error);
        showAlert('Erro ao enviar resposta', 'danger');
    }
}

// ============ UTILITÁRIOS ============
async function fetchEmotions() {
    try {
        const response = await fetch(`${API_BASE}/emotions`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!response.ok) return [];
        return await response.json();
    } catch (error) {
        console.error('Erro ao buscar emoções:', error);
        return [];
    }
}

function getMoodEmoji(mood) {
    const emojis = { happy: '😄', good: '🙂', neutral: '😐', stressed: '😞', overloaded: '😡' };
    return emojis[mood] || '😐';
}

function getMoodLabel(mood) {
    const labels = { happy: 'Feliz', good: 'Bem', neutral: 'Neutro', stressed: 'Estressado', overloaded: 'Sobrecarregado' };
    return labels[mood] || 'Neutro';
}

function getMoodScore(mood) {
    const scores = { happy: 5, good: 4, neutral: 3, stressed: 2, overloaded: 1 };
    return scores[mood] || 3;
}

function formatDate(dateString) {
    if (!dateString) return '';
    const parts = String(dateString).split('T')[0].split('-');
    if (parts.length === 3) {
        const date = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
        return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
    }
    return dateString;
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function showAlert(message, type = 'info') {
    alert(message);
}

// Expor funções globalmente
window.updateGoalProgress = updateGoalProgress;
window.deleteGoal = deleteGoal;
window.showMemberDetails = showMemberDetails;
window.closeModal = closeModal;
window.editTodayMood = editTodayMood;
window.deleteEmotion = deleteEmotion;