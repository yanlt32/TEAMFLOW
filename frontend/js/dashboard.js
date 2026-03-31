// MindTrack Professional Dashboard
// Detecta automaticamente a porta correta do servidor
const getApiBase = () => {
    // Se estiver em produção (servidor servindo os arquivos)
    if (window.location.protocol !== 'file:') {
        return `${window.location.protocol}//${window.location.hostname}:${window.location.port}/api`;
    }
    
    // Se estiver abrindo o arquivo diretamente, tenta as portas comuns
    const possiblePorts = [3002, 3001, 3000];
    
    // Função para testar porta
    const testPort = async (port) => {
        try {
            const response = await fetch(`http://localhost:${port}/api/health`);
            if (response.ok) {
                return `http://localhost:${port}/api`;
            }
        } catch (e) {
            return null;
        }
        return null;
    };
    
    // Retorna uma Promise que resolve com a URL correta
    return (async () => {
        for (const port of possiblePorts) {
            const url = await testPort(port);
            if (url) return url;
        }
        return 'http://localhost:3002/api'; // fallback
    })();
};

// Inicialização
let API_BASE = 'http://localhost:3002/api'; // valor temporário
const token = localStorage.getItem('token');
const user = JSON.parse(localStorage.getItem('user'));

// Aguarda a detecção da porta
(async function initApiBase() {
    API_BASE = await getApiBase();
    console.log('✅ API configurada para:', API_BASE);
    
    // Recarrega a seção atual se necessário
    const activeSection = document.querySelector('.section:not(.hidden)')?.id;
    if (activeSection) {
        const sectionName = activeSection.replace('Section', '');
        switch(sectionName) {
            case 'feedback':
                loadFeedback();
                break;
            case 'dashboard':
                loadDashboard();
                break;
            case 'history':
                loadHistory();
                break;
            case 'goals':
                loadGoals();
                break;
        }
    }
})();

// Initialize app
document.addEventListener('DOMContentLoaded', function() {
    if (!token) {
        window.location.href = 'index.html';
        return;
    }

    initializeApp();
});

function initializeApp() {
    setupNavigation();
    setupEventListeners();
    updateUserInfo();
    loadDashboard();

    // Hide team nav for all users (removed team functionality)
    const teamNavItem = document.getElementById('teamNav');
    if (teamNavItem) {
        teamNavItem.style.display = 'none';
    }
}

function setupNavigation() {
    const navLinks = document.querySelectorAll('.nav-link');

    navLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();

            // Update active nav
            navLinks.forEach(l => l.classList.remove('active'));
            this.classList.add('active');

            // Show section
            showSection(this.dataset.section);
        });
    });
}

function setupEventListeners() {
    // Logout
    document.getElementById('logoutBtn').addEventListener('click', logout);

    // Mood selection
    document.querySelectorAll('.mood-option').forEach(option => {
        option.addEventListener('click', function() {
            document.querySelectorAll('.mood-option').forEach(opt => opt.classList.remove('selected'));
            this.classList.add('selected');
        });
    });

    // Submit mood
    document.getElementById('submitMood').addEventListener('click', submitMood);

    // Goal form
    document.getElementById('goalForm').addEventListener('submit', addGoal);

    // Feedback
    document.getElementById('submitFeedback').addEventListener('click', submitFeedback);

    const applyFiltersButton = document.getElementById('applyFilters');
    if (applyFiltersButton) {
        applyFiltersButton.addEventListener('click', loadFeedback);
    }
}

function updateUserInfo() {
    document.getElementById('userName').textContent = user.name;
    document.getElementById('userAvatar').textContent = user.name.charAt(0).toUpperCase();
}

function showSection(sectionName) {
    // Hide all sections
    document.querySelectorAll('.section').forEach(section => {
        section.classList.add('hidden');
    });

    // Show selected section
    const targetSection = document.getElementById(sectionName + 'Section');
    if (targetSection) {
        targetSection.classList.remove('hidden');

        // Load section data
        switch(sectionName) {
            case 'dashboard':
                loadDashboard();
                break;
            case 'history':
                loadHistory();
                break;
            case 'goals':
                loadGoals();
                break;
            case 'feedback':
                loadFeedback();
                break;
        }
    }
}

function logout() {
    localStorage.clear();
    window.location.href = 'index.html';
}

// Dashboard Functions
async function loadDashboard() {
    try {
        const emotions = await fetchEmotions();

        // Update stats
        await updateDashboardStats(emotions);

        // Create charts
        createWeeklyChart(emotions);
        createMoodChart(emotions);

        // Load recent activity
        loadRecentActivity(emotions.slice(0, 10));

    } catch (error) {
        console.error('Erro ao carregar dashboard:', error);
    }
}

async function updateDashboardStats(emotions) {
    // Today mood
    const today = new Date().toLocaleDateString('sv-SE');
    const todayEmotion = emotions.find(e => e.date === today);
    document.getElementById('todayMood').textContent = todayEmotion ?
        getMoodEmoji(todayEmotion.mood) : '--';

    // Week average
    const weekEmotions = emotions.slice(0, 7);
    const avg = weekEmotions.length > 0 ?
        Math.round(weekEmotions.reduce((sum, e) => sum + getMoodScore(e.mood), 0) / weekEmotions.length) : 0;
    document.getElementById('weekAverage').textContent = avg > 0 ? `${avg}/5` : '--';

    // Streak
    let streak = 0;
    for (let i = 0; i < emotions.length; i++) {
        if (emotions[i].mood !== 'stressed' && emotions[i].mood !== 'overloaded') {
            streak++;
        } else {
            break;
        }
    }
    document.getElementById('streakCount').textContent = streak;

    // Goals progress
    try {
        const goalsResponse = await fetch(`${API_BASE}/goals`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const goals = await goalsResponse.json();
        const avgProgress = goals.length > 0 ?
            Math.round(goals.reduce((sum, g) => sum + g.progress, 0) / goals.length) : 0;
        document.getElementById('goalsProgress').textContent = `${avgProgress}%`;
    } catch (error) {
        console.error('Erro ao carregar progresso das metas:', error);
        document.getElementById('goalsProgress').textContent = '--%';
    }
}

function createWeeklyChart(emotions) {
    const ctx = document.getElementById('weeklyChart').getContext('2d');

    if (window.weeklyChart instanceof Chart) {
        window.weeklyChart.destroy();
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

    window.weeklyChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: last7Days.map(date => new Date(date).toLocaleDateString('pt-BR', { weekday: 'short' })),
            datasets: [{
                label: 'Nível Emocional',
                data: data,
                borderColor: '#2563eb',
                backgroundColor: 'rgba(37, 99, 235, 0.1)',
                tension: 0.4,
                fill: true
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    max: 5,
                    ticks: {
                        callback: function(value) {
                            return ['😡', '😞', '😐', '🙂', '😄'][value - 1] || '';
                        }
                    }
                }
            },
            plugins: {
                legend: {
                    display: false
                }
            }
        }
    });
}

function createMoodChart(emotions) {
    const ctx = document.getElementById('moodChart').getContext('2d');

    if (window.moodChart instanceof Chart) {
        window.moodChart.destroy();
    }

    const moodCounts = emotions.reduce((acc, emotion) => {
        acc[emotion.mood] = (acc[emotion.mood] || 0) + 1;
        return acc;
    }, {});

    window.moodChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: Object.keys(moodCounts).map(mood => getMoodLabel(mood)),
            datasets: [{
                data: Object.values(moodCounts),
                backgroundColor: [
                    '#10b981',
                    '#84cc16',
                    '#6b7280',
                    '#f59e0b',
                    '#ef4444'
                ]
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom'
                }
            }
        }
    });
}

function loadRecentActivity(emotions) {
    const container = document.getElementById('recentActivity');

    if (emotions.length === 0) {
        container.innerHTML = '<p class="text-center">Nenhum registro encontrado</p>';
        return;
    }

    const moodCounts = {};
    emotions.forEach(emotion => {
        moodCounts[emotion.mood] = (moodCounts[emotion.mood] || 0) + 1;
    });

    const moodOrder = ['happy', 'good', 'neutral', 'stressed', 'overloaded'];
    const aggregated = moodOrder.filter(mood => moodCounts[mood]).map(mood => ({
        mood,
        count: moodCounts[mood]
    }));

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

// Mood Functions
async function submitMood() {
    const selectedMood = document.querySelector('.mood-option.selected');
    if (!selectedMood) {
        showAlert('Selecione um humor', 'warning');
        return;
    }

    const mood = selectedMood.dataset.mood;
    const comment = document.getElementById('comment').value;

    try {
        const response = await fetch(`${API_BASE}/emotions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ mood, comment })
        });

        if (response.ok) {
            showSuggestion(mood);
            document.getElementById('comment').value = '';
            document.querySelectorAll('.mood-option').forEach(opt => opt.classList.remove('selected'));
            showAlert('Humor registrado com sucesso!', 'success');
        } else {
            throw new Error('Erro ao salvar');
        }
    } catch (error) {
        showAlert('Erro ao registrar humor', 'danger');
    }
}

function showSuggestion(mood) {
    const suggestions = {
        happy: 'Continue mantendo o bom humor! 🎉',
        good: 'Ótimo dia! Mantenha o equilíbrio. ✨',
        neutral: 'Que tal organizar suas tarefas para se sentir mais produtivo? 📋',
        stressed: 'Faça uma pausa e respire fundo. Converse com alguém se precisar. 🧘‍♀️',
        overloaded: 'Pausa necessária! Descanse e reorganize suas prioridades. ⏰'
    };

    const suggestionEl = document.getElementById('suggestion');
    document.getElementById('suggestionText').textContent = suggestions[mood];
    suggestionEl.classList.remove('hidden');
}

// History Functions
async function loadHistory() {
    try {
        const emotions = await fetchEmotions();
        const container = document.getElementById('historyList');

        if (emotions.length === 0) {
            container.innerHTML = '<p class="text-center">Nenhum registro encontrado</p>';
            return;
        }

        container.innerHTML = emotions.map(emotion => `
            <div class="emotion-entry">
                <div class="emotion-date">${formatDate(emotion.date)}</div>
                <div class="emotion-mood">
                    <span class="mood-emoji">${getMoodEmoji(emotion.mood)}</span>
                    <span>${getMoodLabel(emotion.mood)}</span>
                </div>
                ${emotion.comment ? `<div class="emotion-comment">${emotion.comment}</div>` : ''}
            </div>
        `).join('');
    } catch (error) {
        console.error('Erro ao carregar histórico:', error);
    }
}

// Goals Functions
async function loadGoals() {
    try {
        const response = await fetch(`${API_BASE}/goals`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const goals = await response.json();

        const container = document.getElementById('goalsList');

        if (goals.length === 0) {
            container.innerHTML = '<p class="text-center">Nenhuma meta definida</p>';
            return;
        }

        container.innerHTML = goals.map(goal => `
            <div class="goal-item">
                <div>
                    <div class="goal-title">${goal.objective}</div>
                    <div class="goal-progress">
                        <div class="progress-bar">
                            <div class="progress-fill" style="width: ${goal.progress}%"></div>
                        </div>
                        <div class="progress-text">${goal.progress}%</div>
                    </div>
                </div>
                <input type="range" min="0" max="100" value="${goal.progress}"
                       onchange="updateGoalProgress(${goal.id}, this.value)">
            </div>
        `).join('');
    } catch (error) {
        console.error('Erro ao carregar metas:', error);
    }
}

async function addGoal(e) {
    e.preventDefault();
    const objective = document.getElementById('goalInput').value;

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

// Feedback functions
let feedbackItems = [];

async function submitFeedback() {
    const content = document.getElementById('feedbackText').value;
    if (!content.trim()) {
        showAlert('Digite seu feedback', 'warning');
        return;
    }

    try {
        const response = await fetch(`${API_BASE}/feedback`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content })
        });

        if (response.ok) {
            document.getElementById('feedbackText').value = '';
            showAlert('Feedback enviado anonimamente!', 'success');
        } else {
            const errorBody = await response.json();
            showAlert(errorBody.error || 'Erro ao enviar feedback', 'danger');
        }
    } catch (error) {
        showAlert('Erro ao enviar feedback', 'danger');
    }
}

async function loadFeedback() {
    const isManager = user && user.type === 'manager';
    const managerSection = document.getElementById('managerFeedback');
    const employeeSection = document.getElementById('employeeFeedback');
    const subtitle = document.getElementById('feedbackSubtitle');

    if (!isManager) {
        if (managerSection) managerSection.classList.add('hidden');
        if (employeeSection) employeeSection.classList.remove('hidden');
        if (subtitle) subtitle.textContent = 'Compartilhe suas sugestões de forma segura e anônima';
        return;
    }

    if (managerSection) managerSection.classList.remove('hidden');
    if (employeeSection) employeeSection.classList.add('hidden');
    if (subtitle) subtitle.textContent = 'Gerencie feedbacks da equipe com estatísticas e filtros';

    try {
        const response = await fetch(`${API_BASE}/feedback`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) {
            throw new Error('Falha ao carregar feedbacks');
        }

        feedbackItems = await response.json();
        updateFeedbackStats(feedbackItems);
        renderFeedbackList();

        const filterButton = document.getElementById('applyFilters');
        if (filterButton) {
            filterButton.onclick = loadFeedback;
        }
    } catch (error) {
        console.error('Erro ao carregar feedback:', error);
        showAlert('Erro ao carregar feedback', 'danger');
    }
}

function filterFeedbackItems() {
    const statusFilter = document.getElementById('feedbackStatusFilter').value;
    const dateFilter = document.getElementById('feedbackDateFilter').value;

    const now = new Date();
    return feedbackItems.filter(item => {
        let statusMatch = true;
        let dateMatch = true;

        if (statusFilter && statusFilter !== 'all') {
            statusMatch = item.status === statusFilter;
        }

        if (dateFilter && dateFilter !== 'all') {
            const itemDate = new Date(item.date);
            let periodStart = new Date(now);

            switch (dateFilter) {
                case 'today':
                    periodStart.setHours(0, 0, 0, 0);
                    break;
                case 'week':
                    periodStart.setDate(now.getDate() - 6);
                    periodStart.setHours(0, 0, 0, 0);
                    break;
                case 'month':
                    periodStart.setMonth(now.getMonth() - 1);
                    periodStart.setHours(0, 0, 0, 0);
                    break;
                case 'quarter':
                    periodStart.setMonth(now.getMonth() - 3);
                    periodStart.setHours(0, 0, 0, 0);
                    break;
                default:
                    periodStart = new Date(0);
            }

            dateMatch = itemDate >= periodStart && itemDate <= now;
        }

        return statusMatch && dateMatch;
    });
}

function updateFeedbackStats(items) {
    const total = items.length;
    const unread = items.filter(item => item.status === 'unread').length;
    const responded = items.filter(item => item.status === 'responded').length;
    const now = new Date();
    const thisMonth = items.filter(item => {
        const itemDate = new Date(item.date);
        return itemDate.getFullYear() === now.getFullYear() && itemDate.getMonth() === now.getMonth();
    }).length;

    document.getElementById('totalFeedback').textContent = total;
    document.getElementById('unreadFeedback').textContent = unread;
    document.getElementById('thisMonthFeedback').textContent = thisMonth;
    document.getElementById('respondedFeedback').textContent = responded;
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
            <div class="feedback-item ${itemStatus === 'unread' ? 'unread' : itemStatus === 'responded' ? 'responded' : ''}" data-id="${item.id}">
                <div class="feedback-header">
                    <div class="feedback-date">${formatDate(item.date)}</div>
                    <div class="feedback-status">
                        <div class="status-badge ${statusClass}">${statusBadge}</div>
                    </div>
                </div>
                <div class="feedback-content">${item.content}</div>
                ${item.response ? `<div class="feedback-content"><strong>Resposta:</strong> ${item.response}</div>` : ''}
                <div class="feedback-actions">
                    <button class="btn-feedback-action btn-mark-read" data-id="${item.id}" data-status="${itemStatus === 'unread' ? 'read' : 'unread'}">
                        <i class="fas fa-envelope-open"></i>
                        ${itemStatus === 'unread' ? 'Marcar como lido' : 'Marcar como não lido'}
                    </button>
                    <button class="btn-feedback-action btn-respond" data-id="${item.id}">
                        <i class="fas fa-reply"></i>
                        ${itemStatus === 'responded' ? 'Atualizar resposta' : 'Responder'}
                    </button>
                </div>
                <div class="response-form" id="responseForm-${item.id}" style="display:none;">
                    <textarea class="response-textarea" id="responseText-${item.id}" placeholder="Digite sua resposta..."></textarea>
                    <div class="response-actions">
                        <button class="btn btn-primary btn-send-response" data-id="${item.id}">Enviar Resposta</button>
                        <button class="btn btn-secondary btn-cancel-response" data-id="${item.id}">Cancelar</button>
                    </div>
                </div>
            </div>
        `;
    }).join('');

    attachFeedbackHandlers();
}

function attachFeedbackHandlers() {
    document.querySelectorAll('.btn-mark-read').forEach(button => {
        button.addEventListener('click', async () => {
            const feedbackId = button.getAttribute('data-id');
            const newStatus = button.getAttribute('data-status');
            await setFeedbackStatus(feedbackId, newStatus);
            await loadFeedback();
        });
    });

    document.querySelectorAll('.btn-respond').forEach(button => {
        button.addEventListener('click', () => {
            const feedbackId = button.getAttribute('data-id');
            const form = document.getElementById(`responseForm-${feedbackId}`);
            if (form) {
                form.style.display = form.style.display === 'none' ? 'block' : 'none';
            }
        });
    });

    document.querySelectorAll('.btn-cancel-response').forEach(button => {
        button.addEventListener('click', () => {
            const feedbackId = button.getAttribute('data-id');
            const form = document.getElementById(`responseForm-${feedbackId}`);
            if (form) {
                form.style.display = 'none';
            }
        });
    });

    document.querySelectorAll('.btn-send-response').forEach(button => {
        button.addEventListener('click', async () => {
            const feedbackId = button.getAttribute('data-id');
            const textarea = document.getElementById(`responseText-${feedbackId}`);
            const responseText = textarea?.value || '';

            if (!responseText.trim()) {
                showAlert('Digite uma resposta antes de enviar', 'warning');
                return;
            }

            await respondFeedback(feedbackId, responseText.trim());
            await loadFeedback();
        });
    });
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
            throw new Error('Falha ao atualizar status de feedback');
        }

        showAlert('Status de feedback atualizado', 'success');
    } catch (error) {
        console.error(error);
        showAlert('Erro ao atualizar status de feedback', 'danger');
        throw error;
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
            throw new Error('Falha ao responder feedback');
        }

        showAlert('Resposta enviada com sucesso', 'success');
    } catch (error) {
        console.error(error);
        showAlert('Erro ao enviar resposta para feedback', 'danger');
        throw error;
    }
}

// Common Functions
async function fetchEmotions() {
    const response = await fetch(`${API_BASE}/emotions`, {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    return await response.json();
}

// Utility Functions
function getMoodEmoji(mood) {
    const emojis = {
        happy: '😄',
        good: '🙂',
        neutral: '😐',
        stressed: '😞',
        overloaded: '😡'
    };
    return emojis[mood] || '😐';
}

function getMoodLabel(mood) {
    const labels = {
        happy: 'Feliz',
        good: 'Bem',
        neutral: 'Neutro',
        stressed: 'Estressado',
        overloaded: 'Sobrecarregado'
    };
    return labels[mood] || 'Neutro';
}

function getMoodScore(mood) {
    const scores = {
        happy: 5,
        good: 4,
        neutral: 3,
        stressed: 2,
        overloaded: 1
    };
    return scores[mood] || 3;
}

function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
    });
}

function showAlert(message, type = 'info') {
    alert(message);
}