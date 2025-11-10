// Dashboard functionality
let costChart = null;
let mostRequestedPieChart = null;
let leastRequestedPieChart = null;
let servicesData = null; // Para guardar los datos y usarlos en exportación

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
    loadServicesStatistics();
    
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
            updateStatCard('activeAgentsCount', 0, 0);
            return;
        }

        const activeCount = data.agents.filter(a => a.serverStatus === 'running').length;
        const totalCount = data.agents.length;
        updateStatCard('activeAgentsCount', activeCount, totalCount);

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

// Actualizar tarjeta de estadística con anillo circular
function updateStatCard(elementId, value, total) {
    const element = document.getElementById(elementId);
    if (!element) return;
    
    element.textContent = value;
    
    // Los anillos siempre están completos (sin porcentaje visual)
    const statCard = element.closest('.stat-card');
    const progressCircle = statCard?.querySelector('.circle-progress');
    
    if (progressCircle) {
        // Anillo completamente lleno
        progressCircle.style.strokeDashoffset = 0;
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
            <div class="info-item">
                <span class="info-label">Conversaciones</span>
                <span class="info-value">0</span>
            </div>
            <div class="info-item info-item-platforms">
                <span class="info-label">Plataformas</span>
                <div class="platforms-container">
                    ${platformsHTML}
                </div>
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

async function deleteAgent(id) {
    // Obtener información del agente para mostrar en el modal
    let agentName = 'este agente';
    try {
        const response = await fetch('/api/agents');
        const data = await response.json();
        const agent = data.agents?.find(a => a.id === id);
        if (agent) {
            agentName = agent.name;
        }
    } catch (error) {
        console.error('Error fetching agent info:', error);
    }
    
    // Crear modal de confirmación
    const modal = document.createElement('div');
    modal.className = 'delete-modal';
    modal.innerHTML = `
        <div class="delete-modal-overlay" onclick="closeDeleteModal()"></div>
        <div class="delete-modal-content">
            <div class="delete-modal-header">
                <div class="delete-modal-icon">
                    <i class="lni lni-warning"></i>
                </div>
                <h3>¿Eliminar Agente?</h3>
            </div>
            <p class="delete-modal-description">
                ¿Estás seguro de que deseas eliminar <span class="delete-modal-agent-name">"${agentName}"</span>? 
                Esta acción no se puede deshacer y se perderán todos los datos asociados.
            </p>
            <div class="delete-modal-actions">
                <button class="delete-modal-btn delete-modal-btn-cancel" onclick="closeDeleteModal()">
                    <i class="lni lni-close"></i>
                    Cancelar
                </button>
                <button class="delete-modal-btn delete-modal-btn-confirm" onclick="confirmDeleteAgent('${id}')">
                    <i class="lni lni-trash-can"></i>
                    Eliminar
                </button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    setTimeout(() => modal.classList.add('active'), 10);
}

function closeDeleteModal() {
    const modal = document.querySelector('.delete-modal');
    if (modal) {
        modal.classList.remove('active');
        setTimeout(() => modal.remove(), 300);
    }
}

async function confirmDeleteAgent(id) {
    try {
        const response = await fetch(`/api/agents/${id}`, {
            method: 'DELETE'
        });
        
        if (response.ok) {
            closeDeleteModal();
            showNotification('Agente eliminado exitosamente', 'success');
            loadAgents();
        } else {
            showNotification('Error al eliminar el agente', 'error');
        }
    } catch (error) {
        console.error('Error deleting agent:', error);
        showNotification('Error al eliminar el agente', 'error');
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
    costChart.update('none');
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

// ============================================
// SERVICES STATISTICS FUNCTIONALITY (NUEVO)
// ============================================

async function loadServicesStatistics() {
    try {
        // Llamar al endpoint real de servicios
        const response = await fetch('/api/services/statistics');
        
        if (!response.ok) {
            throw new Error('Error fetching services statistics');
        }
        
        const data = await response.json();
        servicesData = data; // Guardar para exportación
        
        renderServiceBars('mostRequestedServicesContainer', data.mostRequested, false);
        renderServiceBars('leastRequestedServicesContainer', data.leastRequested, true);
        
        // Renderizar gráficos de pastel
        renderPieChart('mostRequestedPieChart', 'mostRequestedLegend', 'mostRequestedTotal', data.mostRequested, false);
        renderPieChart('leastRequestedPieChart', 'leastRequestedLegend', 'leastRequestedTotal', data.leastRequested, true);
        
    } catch (error) {
        console.error('Error loading services statistics:', error);
        
        // Fallback a datos simulados si falla el API
        const mockData = generateMockServicesData();
        servicesData = mockData; // Guardar para exportación
        
        renderServiceBars('mostRequestedServicesContainer', mockData.mostRequested, false);
        renderServiceBars('leastRequestedServicesContainer', mockData.leastRequested, true);
        
        // Renderizar gráficos de pastel
        renderPieChart('mostRequestedPieChart', 'mostRequestedLegend', 'mostRequestedTotal', mockData.mostRequested, false);
        renderPieChart('leastRequestedPieChart', 'leastRequestedLegend', 'leastRequestedTotal', mockData.leastRequested, true);
    }
}

function renderServiceBars(containerId, services, isLeast = false) {
    const container = document.getElementById(containerId);
    if (!container) return;
    
    // Limpiar contenedor
    container.innerHTML = '';
    
    if (!services || services.length === 0) {
        container.innerHTML = `
            <div class="service-chart-empty">
                <i class="lni lni-pie-chart"></i>
                <p>No hay datos disponibles</p>
            </div>
        `;
        return;
    }
    
    // Calcular el máximo para normalizar las barras
    const maxCount = Math.max(...services.map(s => s.count));
    
    // Renderizar cada barra
    services.forEach(service => {
        const percentage = (service.count / maxCount) * 100;
        
        const barItem = document.createElement('div');
        barItem.className = 'service-bar-item';
        barItem.innerHTML = `
            <div class="service-bar-label">${service.name}</div>
            <div class="service-bar-wrapper">
                <div class="service-bar-track">
                    <div class="service-bar-fill" style="width: 0%;">
                        <span class="service-bar-value">${percentage.toFixed(0)}%</span>
                    </div>
                </div>
                <div class="service-count">${service.count}</div>
            </div>
        `;
        
        container.appendChild(barItem);
        
        // Animar la barra después de un pequeño delay
        setTimeout(() => {
            const fillBar = barItem.querySelector('.service-bar-fill');
            if (fillBar) {
                fillBar.style.width = percentage + '%';
            }
        }, 100);
    });
}

// Generar datos simulados de servicios
function generateMockServicesData() {
    const allServices = [
        { name: 'Corte de Cabello', count: 145 },
        { name: 'Manicure', count: 132 },
        { name: 'Pedicure', count: 98 },
        { name: 'Tinte', count: 87 },
        { name: 'Depilación', count: 76 },
        { name: 'Masaje', count: 65 },
        { name: 'Facial', count: 54 },
        { name: 'Maquillaje', count: 43 },
        { name: 'Extensiones', count: 21 },
        { name: 'Keratina', count: 15 }
    ];
    
    // Top 5 más pedidos
    const mostRequested = allServices.slice(0, 5);
    
    // Top 5 menos pedidos (pero al revés para mostrarlo de mayor a menor)
    const leastRequested = allServices.slice(-5).reverse();
    
    return {
        mostRequested,
        leastRequested
    };
}

// ============================================
// PIE CHARTS FUNCTIONALITY (NUEVO)
// ============================================

// Colores para los gráficos de pastel
const pieColors = [
    '#06b6d4', // Cyan
    '#8b5cf6', // Púrpura
    '#10b981', // Verde
    '#f59e0b', // Amarillo
    '#ef4444', // Rojo
    '#ec4899', // Rosa
    '#6366f1', // Índigo
    '#14b8a6', // Teal
    '#f97316', // Naranja
    '#a855f7'  // Púrpura claro
];

function renderPieChart(canvasId, legendId, totalId, services, isLeast = false) {
    const canvas = document.getElementById(canvasId);
    const legendContainer = document.getElementById(legendId);
    const totalBadge = document.getElementById(totalId);
    
    if (!canvas || !legendContainer || !totalBadge) return;
    
    if (!services || services.length === 0) {
        canvas.parentElement.innerHTML = `
            <div class="service-chart-empty">
                <i class="lni lni-pie-chart"></i>
                <p>No hay datos disponibles</p>
            </div>
        `;
        return;
    }
    
    // Calcular total
    const total = services.reduce((sum, service) => sum + service.count, 0);
    totalBadge.textContent = `${total} Total`;
    
    // Preparar datos
    const labels = services.map(s => s.name);
    const data = services.map(s => s.count);
    const colors = services.map((_, index) => pieColors[index % pieColors.length]);
    
    // Destruir gráfico anterior si existe
    if (isLeast && leastRequestedPieChart) {
        leastRequestedPieChart.destroy();
    } else if (!isLeast && mostRequestedPieChart) {
        mostRequestedPieChart.destroy();
    }
    
    // Crear gráfico
    const chart = new Chart(canvas, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: data,
                backgroundColor: colors,
                borderWidth: 3,
                borderColor: '#fff',
                hoverOffset: 15
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    backgroundColor: 'rgba(0, 0, 0, 0.8)',
                    titleColor: '#fff',
                    bodyColor: '#fff',
                    borderColor: colors[0],
                    borderWidth: 1,
                    padding: 12,
                    displayColors: true,
                    callbacks: {
                        label: function(context) {
                            const value = context.parsed;
                            const percentage = ((value / total) * 100).toFixed(1);
                            return ` ${context.label}: ${value} (${percentage}%)`;
                        }
                    }
                }
            },
            cutout: '65%',
            animation: {
                animateRotate: true,
                animateScale: true,
                duration: 1000,
                easing: 'easeOutQuart'
            }
        }
    });
    
    // Guardar referencia del gráfico
    if (isLeast) {
        leastRequestedPieChart = chart;
    } else {
        mostRequestedPieChart = chart;
    }
    
    // Renderizar leyenda personalizada
    renderPieLegend(legendContainer, services, colors, total);
}

function renderPieLegend(container, services, colors, total) {
    container.innerHTML = '';
    
    services.forEach((service, index) => {
        const percentage = ((service.count / total) * 100).toFixed(1);
        
        const legendItem = document.createElement('div');
        legendItem.className = 'pie-legend-item';
        legendItem.innerHTML = `
            <div class="pie-legend-color" style="background-color: ${colors[index]};"></div>
            <div class="pie-legend-info">
                <span class="pie-legend-label">${service.name}</span>
                <div class="pie-legend-value">
                    <span class="pie-legend-percentage">${percentage}%</span>
                    <span class="pie-legend-count">(${service.count})</span>
                </div>
            </div>
        `;
        
        container.appendChild(legendItem);
    });
}

// ============================================
// EXPORT FUNCTIONS (NUEVO)
// ============================================

function exportToExcel() {
    if (!servicesData) {
        showNotification('No hay datos para exportar', 'error');
        return;
    }
    
    try {
        // Crear workbook
        const wb = XLSX.utils.book_new();
        
        // Preparar datos de servicios más pedidos
        const mostRequestedData = [
            ['Servicios Más Pedidos'],
            ['Servicio', 'Cantidad', 'Porcentaje'],
            ...servicesData.mostRequested.map(service => {
                const total = servicesData.mostRequested.reduce((sum, s) => sum + s.count, 0);
                const percentage = ((service.count / total) * 100).toFixed(1) + '%';
                return [service.name, service.count, percentage];
            }),
            [],
            ['Total', servicesData.mostRequested.reduce((sum, s) => sum + s.count, 0)]
        ];
        
        // Preparar datos de servicios menos pedidos
        const leastRequestedData = [
            ['Servicios Menos Pedidos'],
            ['Servicio', 'Cantidad', 'Porcentaje'],
            ...servicesData.leastRequested.map(service => {
                const total = servicesData.leastRequested.reduce((sum, s) => sum + s.count, 0);
                const percentage = ((service.count / total) * 100).toFixed(1) + '%';
                return [service.name, service.count, percentage];
            }),
            [],
            ['Total', servicesData.leastRequested.reduce((sum, s) => sum + s.count, 0)]
        ];
        
        // Crear hojas
        const wsMostRequested = XLSX.utils.aoa_to_sheet(mostRequestedData);
        const wsLeastRequested = XLSX.utils.aoa_to_sheet(leastRequestedData);
        
        // Agregar hojas al workbook
        XLSX.utils.book_append_sheet(wb, wsMostRequested, 'Más Pedidos');
        XLSX.utils.book_append_sheet(wb, wsLeastRequested, 'Menos Pedidos');
        
        // Generar archivo
        const fileName = `servicios_${new Date().toISOString().split('T')[0]}.xlsx`;
        XLSX.writeFile(wb, fileName);
        
        showNotification('Excel exportado exitosamente', 'success');
    } catch (error) {
        console.error('Error exporting to Excel:', error);
        showNotification('Error al exportar a Excel', 'error');
    }
}

function exportToPDF() {
    if (!servicesData) {
        showNotification('No hay datos para exportar', 'error');
        return;
    }
    
    try {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        
        // Título
        doc.setFontSize(20);
        doc.setTextColor(6, 182, 212);
        doc.text('Reporte de Servicios', 20, 20);
        
        // Fecha
        doc.setFontSize(10);
        doc.setTextColor(100);
        doc.text(`Fecha: ${new Date().toLocaleDateString('es-MX')}`, 20, 30);
        
        // Servicios más pedidos
        doc.setFontSize(16);
        doc.setTextColor(0);
        doc.text('Servicios Más Pedidos', 20, 45);
        
        let yPos = 55;
        const mostTotal = servicesData.mostRequested.reduce((sum, s) => sum + s.count, 0);
        
        doc.setFontSize(10);
        servicesData.mostRequested.forEach((service, index) => {
            const percentage = ((service.count / mostTotal) * 100).toFixed(1);
            doc.setTextColor(80);
            doc.text(`${index + 1}. ${service.name}`, 25, yPos);
            doc.setTextColor(6, 182, 212);
            doc.text(`${service.count} (${percentage}%)`, 150, yPos);
            yPos += 8;
        });
        
        // Total servicios más pedidos
        yPos += 5;
        doc.setFontSize(12);
        doc.setTextColor(0);
        doc.text(`Total: ${mostTotal}`, 25, yPos);
        
        // Servicios menos pedidos
        yPos += 20;
        doc.setFontSize(16);
        doc.text('Servicios Menos Pedidos', 20, yPos);
        
        yPos += 10;
        const leastTotal = servicesData.leastRequested.reduce((sum, s) => sum + s.count, 0);
        
        doc.setFontSize(10);
        servicesData.leastRequested.forEach((service, index) => {
            const percentage = ((service.count / leastTotal) * 100).toFixed(1);
            doc.setTextColor(80);
            doc.text(`${index + 1}. ${service.name}`, 25, yPos);
            doc.setTextColor(139, 92, 246);
            doc.text(`${service.count} (${percentage}%)`, 150, yPos);
            yPos += 8;
        });
        
        // Total servicios menos pedidos
        yPos += 5;
        doc.setFontSize(12);
        doc.setTextColor(0);
        doc.text(`Total: ${leastTotal}`, 25, yPos);
        
        // Footer
        const pageHeight = doc.internal.pageSize.height;
        doc.setFontSize(8);
        doc.setTextColor(150);
        doc.text('Generado por Attomos Dashboard', 20, pageHeight - 10);
        
        // Guardar PDF
        const fileName = `servicios_${new Date().toISOString().split('T')[0]}.pdf`;
        doc.save(fileName);
        
        showNotification('PDF exportado exitosamente', 'success');
    } catch (error) {
        console.error('Error exporting to PDF:', error);
        showNotification('Error al exportar a PDF', 'error');
    }
}