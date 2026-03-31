// MindTrack Professional Dashboard
const API_BASE = (window.location.protocol === 'http:' || window.location.protocol === 'https:')
    ? `${window.location.origin}/api`
    : 'http://localhost:3000/api';
const token = localStorage.getItem('token');
const user = JSON.parse(localStorage.getItem('user'));

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
        loadRecentActivity(emotions.slice(0, 10)); // Show more for aggregation

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

    // Week average (simplified)
    const weekEmotions = emotions.slice(0, 7);
    const avg = weekEmotions.length > 0 ?
        Math.round(weekEmotions.reduce((sum, e) => sum + getMoodScore(e.mood), 0) / weekEmotions.length) : 0;
    document.getElementById('weekAverage').textContent = avg > 0 ? `${avg}/5` : '--';

    // Streak (simplified)
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

    // Destroy existing chart if it exists
    if (window.weeklyChart instanceof Chart) {
        window.weeklyChart.destroy();
    }

    // Get last 7 days
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

    // Destroy existing chart if it exists
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
                    '#10b981', // happy
                    '#84cc16', // good
                    '#6b7280', // neutral
                    '#f59e0b', // stressed
                    '#ef4444'  // overloaded
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

    // Aggregate moods by type
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
        loadGoals(); // Reload goals to show updated progress
    } catch (error) {
        showAlert('Erro ao atualizar progresso', 'danger');
    }
}

// Feedback Functions
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
        }
    } catch (error) {
        showAlert('Erro ao enviar feedback', 'danger');
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
    // Simple alert implementation
    alert(message);
}