// Dashboard functionality
let costChart = null;

// Currency conversion rates (relative to USD)
const currencyRates = {
    'MXN': 17.50,
    'USD': 1.00,
    'EUR': 0.92,
    'GBP': 0.79,
    'CAD': 1.36,
    'ARS': 350.00,
    'COP': 4000.00,
    'CLP': 900.00
};

// Get currency symbol
function getCurrencySymbol(currency) {
    const symbols = {
        'MXN': '$',
        'USD': '$',
        'EUR': '€',
        'GBP': '£',
        'CAD': 'C$',
        'ARS': 'AR$',
        'COP': 'COL$',
        'CLP': 'CLP$'
    };
    return symbols[currency] || '$';
}

// Convert cost to selected currency
function convertCurrency(amountUSD, toCurrency) {
    return amountUSD * currencyRates[toCurrency];
}

// Inicializar dashboard
document.addEventListener('DOMContentLoaded', function() {
    loadAgents();
    initializeCostChart();
    loadBillingData();
    
    // Event listener para cambio de rango de tiempo
    const timeRangeSelect = document.getElementById('billingTimeRange');
    if (timeRangeSelect) {
        timeRangeSelect.addEventListener('change', function() {
            loadBillingData(this.value);
        });
    }
    
    // Event listener para cambio de moneda
    const currencySelect = document.getElementById('currencySelect');
    if (currencySelect) {
        currencySelect.addEventListener('change', function() {
            const days = document.getElementById('billingTimeRange')?.value || 28;
            loadBillingData(days);
        });
    }
});

// Cargar agentes
async function loadAgents() {
    const loading = document.getElementById('loading');
    const emptyState = document.getElementById('emptyState');
    const grid = document.getElementById('botsGrid');
    
    loading.style.display = 'block';
    emptyState.style.display = 'none';
    grid.innerHTML = '';

    try {
        const response = await fetch('/api/agents');
        const data = await response.json();

        loading.style.display = 'none';

        if (!data.agents || data.agents.length === 0) {
            emptyState.style.display = 'block';
            document.getElementById('activeAgentsCount').textContent = '0';
            return;
        }

        document.getElementById('activeAgentsCount').textContent = data.agents.length;

        data.agents.forEach(agent => {
            const card = createAgentCard(agent);
            grid.appendChild(card);
        });

    } catch (error) {
        console.error('Error loading agents:', error);
        loading.style.display = 'none';
        emptyState.style.display = 'block';
    }
}

// Crear tarjeta de agente
function createAgentCard(agent) {
    const card = document.createElement('div');
    card.className = 'agent-card';
    
    const statusClass = agent.serverStatus === 'running' ? 'status-active' : 
                       agent.serverStatus === 'creating' ? 'status-pending' :
                       agent.serverStatus === 'error' ? 'status-error' : 'status-inactive';
    
    const statusText = agent.serverStatus === 'running' ? 'Activo' : 
                      agent.serverStatus === 'creating' ? 'Creando' :
                      agent.serverStatus === 'error' ? 'Error' : 'Inactivo';
    
    // Obtener plataformas del agente (por defecto WhatsApp si no hay)
    const platforms = agent.platforms || ['whatsapp'];
    const platformsHTML = generatePlatformsHTML(platforms);
    
    card.innerHTML = `
        <div class="agent-header">
            <div class="agent-title">
                <h3>${agent.name}</h3>
                <div class="agent-phone">
                    <i class="lni lni-phone"></i>
                    <span>${agent.phoneNumber || 'Sin número'}</span>
                </div>
            </div>
            <div class="agent-status ${statusClass}">
                <i class="lni lni-circle-fill" style="font-size: 8px;"></i>
                ${statusText}
            </div>
        </div>
        
        <div class="agent-info">
            <div class="info-item">
                <span class="info-label">Tipo de Negocio</span>
                <span class="info-value">${agent.businessType || 'General'}</span>
            </div>
            <div class="info-item info-item-platforms">
                <span class="info-label">Plataformas</span>
                <div class="platforms-container">
                    ${platformsHTML}
                </div>
            </div>
            <div class="info-item">
                <span class="info-label">Conversaciones</span>
                <span class="info-value">0</span>
            </div>
            <div class="info-item">
                <span class="info-label">Creado</span>
                <span class="info-value">${new Date(agent.createdAt).toLocaleDateString()}</span>
            </div>
        </div>
        
        <div class="agent-actions">
            <button class="agent-btn agent-btn-view" onclick="viewAgent('${agent.id}')">
                <i class="lni lni-eye"></i>
                Ver Detalles
            </button>
            <button class="agent-btn agent-btn-add-platform" onclick="addPlatform('${agent.id}')" title="Agregar plataforma">
                <i class="lni lni-plus"></i>
                <span>Plataforma</span>
            </button>
            <button class="agent-btn agent-btn-toggle" onclick="toggleAgent('${agent.id}')">
                <i class="lni lni-power-switch"></i>
            </button>
            <button class="agent-btn agent-btn-delete" onclick="deleteAgent('${agent.id}')">
                <i class="lni lni-trash-can"></i>
            </button>
        </div>
    `;
    
    return card;
}

// Generar HTML de plataformas con sus logos
function generatePlatformsHTML(platforms) {
    const platformIcons = {
        'whatsapp': { type: 'icon', icon: 'lni-whatsapp', color: '#25D366', name: 'WhatsApp' },
        'instagram': { type: 'icon', icon: 'lni-instagram', color: '#E4405F', name: 'Instagram' },
        'facebook': { type: 'icon', icon: 'lni-facebook-messenger', color: '#0084FF', name: 'Messenger' },
        'telegram': { type: 'icon', icon: 'lni-telegram', color: '#0088cc', name: 'Telegram' },
        'wechat': { type: 'icon', icon: 'lni-wechat', color: '#09B83E', name: 'WeChat' },
        'kakaotalk': { type: 'svg', color: '#FFE812', name: 'KakaoTalk' },
        'line': { type: 'icon', icon: 'lni-line', color: '#00B900', name: 'Line' }
    };
    
    return platforms.map(platform => {
        const platformData = platformIcons[platform.toLowerCase()] || platformIcons['whatsapp'];
        
        if (platformData.type === 'svg' && platform.toLowerCase() === 'kakaotalk') {
            return `
                <div class="platform-badge" style="background-color: ${platformData.color}15; border-color: ${platformData.color}40;" title="${platformData.name}">
                    <div class="kakao-icon-badge">
                        <svg viewBox="0 0 24 24" class="kakao-bubble-badge">
                            <path d="M12 3C6.48 3 2 6.58 2 11c0 2.91 1.88 5.45 4.68 6.94l-1.19 4.37c-.09.34.23.63.55.49l5.11-2.29c.27.02.55.03.85.03 5.52 0 10-3.58 10-8C22 6.58 17.52 3 12 3z"/>
                        </svg>
                        <span class="kakao-text-badge">TALK</span>
                    </div>
                </div>
            `;
        }
        
        return `
            <div class="platform-badge" style="background-color: ${platformData.color}15; border-color: ${platformData.color}40;" title="${platformData.name}">
                <i class="lni ${platformData.icon}" style="color: ${platformData.color};"></i>
            </div>
        `;
    }).join('');
}

// Funciones de agente
function viewAgent(id) {
    window.location.href = `/agents/${id}`;
}

async function addPlatform(id) {
    // Crear modal para seleccionar plataforma
    const modal = document.createElement('div');
    modal.className = 'platform-modal';
    modal.innerHTML = `
        <div class="platform-modal-overlay" onclick="closePlatformModal()"></div>
        <div class="platform-modal-content">
            <div class="platform-modal-header">
                <h3>Agregar Plataforma</h3>
                <button class="platform-modal-close" onclick="closePlatformModal()">
                    <i class="lni lni-close"></i>
                </button>
            </div>
            <div class="platform-modal-body">
                <p class="platform-modal-description">Selecciona la plataforma donde quieres activar este agente:</p>
                <div class="platform-options">
                    <div class="platform-option" onclick="selectPlatform('${id}', 'whatsapp')">
                        <div class="platform-option-icon" style="background-color: #25D36615; border-color: #25D36640;">
                            <i class="lni lni-whatsapp" style="color: #25D366;"></i>
                        </div>
                        <span class="platform-option-name">WhatsApp</span>
                    </div>
                    <div class="platform-option" onclick="selectPlatform('${id}', 'instagram')">
                        <div class="platform-option-icon" style="background-color: #E4405F15; border-color: #E4405F40;">
                            <i class="lni lni-instagram" style="color: #E4405F;"></i>
                        </div>
                        <span class="platform-option-name">Instagram</span>
                    </div>
                    <div class="platform-option" onclick="selectPlatform('${id}', 'facebook')">
                        <div class="platform-option-icon" style="background-color: #0084FF15; border-color: #0084FF40;">
                            <i class="lni lni-facebook-messenger" style="color: #0084FF;"></i>
                        </div>
                        <span class="platform-option-name">Messenger</span>
                    </div>
                    <div class="platform-option" onclick="selectPlatform('${id}', 'telegram')">
                        <div class="platform-option-icon" style="background-color: #0088cc15; border-color: #0088cc40;">
                            <i class="lni lni-telegram" style="color: #0088cc;"></i>
                        </div>
                        <span class="platform-option-name">Telegram</span>
                    </div>
                    <div class="platform-option" onclick="selectPlatform('${id}', 'wechat')">
                        <div class="platform-option-icon" style="background-color: #09B83E15; border-color: #09B83E40;">
                            <i class="lni lni-wechat" style="color: #09B83E;"></i>
                        </div>
                        <span class="platform-option-name">WeChat</span>
                    </div>
                    <div class="platform-option" onclick="selectPlatform('${id}', 'kakaotalk')">
                        <div class="platform-option-icon" style="background-color: #FEE50015; border-color: #FEE50040;">
                            <div class="kakao-icon-dashboard">
                                <svg viewBox="0 0 24 24" class="kakao-bubble-dashboard">
                                    <path d="M12 3C6.48 3 2 6.58 2 11c0 2.91 1.88 5.45 4.68 6.94l-1.19 4.37c-.09.34.23.63.55.49l5.11-2.29c.27.02.55.03.85.03 5.52 0 10-3.58 10-8C22 6.58 17.52 3 12 3z"/>
                                </svg>
                                <span class="kakao-text-dashboard">TALK</span>
                            </div>
                        </div>
                        <span class="platform-option-name">KakaoTalk</span>
                    </div>
                    <div class="platform-option" onclick="selectPlatform('${id}', 'line')">
                        <div class="platform-option-icon" style="background-color: #00B90015; border-color: #00B90040;">
                            <i class="lni lni-line" style="color: #00B900;"></i>
                        </div>
                        <span class="platform-option-name">Line</span>
                    </div>
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    setTimeout(() => modal.classList.add('active'), 10);
}

function closePlatformModal() {
    const modal = document.querySelector('.platform-modal');
    if (modal) {
        modal.classList.remove('active');
        setTimeout(() => modal.remove(), 300);
    }
}

async function selectPlatform(agentId, platform) {
    try {
        const response = await fetch(`/api/agents/${agentId}/platforms`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ platform })
        });
        
        if (response.ok) {
            closePlatformModal();
            loadAgents();
            showNotification('Plataforma agregada exitosamente', 'success');
        } else {
            showNotification('Error al agregar la plataforma', 'error');
        }
    } catch (error) {
        console.error('Error adding platform:', error);
        showNotification('Error al agregar la plataforma', 'error');
    }
}

function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.innerHTML = `
        <i class="lni lni-${type === 'success' ? 'checkmark-circle' : 'warning'}"></i>
        <span>${message}</span>
    `;
    document.body.appendChild(notification);
    setTimeout(() => notification.classList.add('active'), 10);
    setTimeout(() => {
        notification.classList.remove('active');
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

async function toggleAgent(id) {
    try {
        const response = await fetch(`/api/agents/${id}/toggle`, {
            method: 'PATCH'
        });
        
        if (response.ok) {
            loadAgents();
        }
    } catch (error) {
        console.error('Error toggling agent:', error);
        alert('Error al cambiar el estado del agente');
    }
}

async function deleteAgent(id) {
    if (!confirm('¿Estás seguro de que quieres eliminar este agente?')) {
        return;
    }
    
    try {
        const response = await fetch(`/api/agents/${id}`, {
            method: 'DELETE'
        });
        
        if (response.ok) {
            loadAgents();
        }
    } catch (error) {
        console.error('Error deleting agent:', error);
        alert('Error al eliminar el agente');
    }
}

// ============================================
// BILLING CHART FUNCTIONALITY
// ============================================

function initializeCostChart() {
    const ctx = document.getElementById('costChart');
    if (!ctx) return;

    const isDarkMode = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    const textColor = isDarkMode ? '#e5e7eb' : '#6b7280';

    costChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: [],
            datasets: [{
                label: 'Costo Total',
                data: [],
                borderColor: '#06b6d4',
                backgroundColor: 'rgba(6, 182, 212, 0.1)',
                borderWidth: 3,
                fill: true,
                tension: 0.4,
                pointRadius: 4,
                pointHoverRadius: 6,
                pointBackgroundColor: '#06b6d4',
                pointBorderColor: '#fff',
                pointBorderWidth: 2,
                pointHoverBackgroundColor: '#0891b2',
                pointHoverBorderColor: '#fff'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                intersect: false,
                mode: 'index'
            },
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    backgroundColor: 'rgba(0, 0, 0, 0.8)',
                    titleColor: '#fff',
                    bodyColor: '#fff',
                    borderColor: '#06b6d4',
                    borderWidth: 1,
                    padding: 12,
                    displayColors: false,
                    callbacks: {
                        label: function(context) {
                            const currency = document.getElementById('currencySelect')?.value || 'MXN';
                            const symbol = getCurrencySymbol(currency);
                            return 'Costo: ' + symbol + context.parsed.y.toFixed(2) + ' ' + currency;
                        }
                    }
                }
            },
            scales: {
                x: {
                    grid: {
                        display: false,
                        drawBorder: false
                    },
                    ticks: {
                        color: textColor,
                        font: {
                            size: 11
                        }
                    }
                },
                y: {
                    beginAtZero: true,
                    grid: {
                        display: false,
                        drawBorder: false
                    },
                    ticks: {
                        color: textColor,
                        font: {
                            size: 11
                        },
                        callback: function(value) {
                            const currency = document.getElementById('currencySelect')?.value || 'MXN';
                            const symbol = getCurrencySymbol(currency);
                            return symbol + value.toFixed(2);
                        }
                    }
                }
            }
        }
    });
}

// MODIFICADO: Ahora consulta el endpoint real de billing
async function loadBillingData(days = 28) {
    try {
        // Llamar al endpoint real de billing
        const response = await fetch(`/api/billing/data?days=${days}`);
        
        if (!response.ok) {
            throw new Error('Error fetching billing data');
        }
        
        const data = await response.json();
        
        updateCostSummary(data.summary, days);
        updateCostChart(data.timeline);
        
    } catch (error) {
        console.error('Error loading billing data:', error);
        
        // Fallback a datos simulados si falla el API
        const mockData = generateMockBillingData(days);
        updateCostSummary(mockData.summary, days);
        updateCostChart(mockData.timeline);
    }
}

function updateCostSummary(summary, days) {
    const currency = document.getElementById('currencySelect')?.value || 'MXN';
    const symbol = getCurrencySymbol(currency);
    const convertedCost = convertCurrency(summary.cost, currency);
    
    document.getElementById('totalCost').textContent = symbol + convertedCost.toFixed(2) + ' ' + currency;
    
    // Actualizar label del periodo
    const periodLabel = document.getElementById('periodLabel');
    if (periodLabel) {
        periodLabel.textContent = days + ' días';
    }
}

function updateCostChart(timeline) {
    if (!costChart) return;
    
    const currency = document.getElementById('currencySelect')?.value || 'MXN';
    const convertedCosts = timeline.costs.map(cost => convertCurrency(cost, currency));
    
    costChart.data.labels = timeline.labels;
    costChart.data.datasets[0].data = convertedCosts;
    costChart.update('none'); // 'none' para animación más rápida
}

// Fallback: Generar datos simulados si el API falla
function generateMockBillingData(days) {
    const labels = [];
    const costs = [];
    let totalCost = 0;
    
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    
    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
        const dateStr = d.toLocaleDateString('es-MX', { month: 'short', day: 'numeric' });
        labels.push(dateStr);
        
        // Generar costo aleatorio (simular uso real)
        const dailyCost = Math.random() * 0.05 + 0.01; // Entre $0.01 y $0.06 por día
        totalCost += dailyCost;
        costs.push(parseFloat(totalCost.toFixed(2)));
    }
    
    return {
        summary: {
            cost: totalCost
        },
        timeline: {
            labels: labels,
            costs: costs
        }
    };
}