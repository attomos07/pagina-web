// Dashboard functionality (sin sección de agentes)
let costChart = null;
let mostRequestedPieChart = null;
let leastRequestedPieChart = null;
let servicesData = null;

// Cache de onboarding para acelerar recargas
let onboardingHTMLCache = null;
let onboardingScriptLoaded = false;

// Estado base del onboarding (mismo shape que en onboarding.js)
const defaultAgentData = () => ({
    social: '',
    businessType: '',
    name: '',
    phoneNumber: '',
    useDifferentPhone: false,
    config: {
        welcomeMessage: '',
        aiPersonality: '',
        tone: 'formal',
        customTone: '',
        languages: [],
        additionalLanguages: [],
        specialInstructions: '',
        schedule: {
            monday: { open: true, start: '09:00', end: '18:00' },
            tuesday: { open: true, start: '09:00', end: '18:00' },
            wednesday: { open: true, start: '09:00', end: '18:00' },
            thursday: { open: true, start: '09:00', end: '18:00' },
            friday: { open: true, start: '09:00', end: '18:00' },
            saturday: { open: false, start: '09:00', end: '14:00' },
            sunday: { open: false, start: '09:00', end: '14:00' }
        },
        holidays: [],
        services: [],
        workers: []
    },
    location: {
        address: '',
        postalCode: '',
        betweenStreets: '',
        number: '',
        neighborhood: '',
        city: '',
        state: '',
        country: ''
    },
    social_media: {
        facebook: '',
        instagram: '',
        twitter: '',
        linkedin: ''
    }
});

// Currency conversion rates (relative to USD)
const currencyRates = {
    MXN: 17.50,
    USD: 1.00,
    EUR: 0.92,
    GBP: 0.79,
    CAD: 1.36,
    ARS: 350.0,
    COP: 4000.0,
    CLP: 900.0
};
function getCurrencySymbol(currency) {
    const symbols = { MXN: '$', USD: '$', EUR: '€', GBP: '£', CAD: 'C$', ARS: 'AR$', COP: 'COL$', CLP: 'CLP$' };
    return symbols[currency] || '$';
}
function convertCurrency(amountUSD, toCurrency) {
    return amountUSD * (currencyRates[toCurrency] || 1);
}

// View states
let billingView = 'line'; // 'line', 'bar', 'table'
let billingTimelineData = null; // cached timeline for view switching

// =================== VIEW TOGGLE FUNCTIONS ===================

function setBillingView(view) {
    billingView = view;

    // Update toggle button states
    document.querySelectorAll('#billingViewToggle .view-toggle-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.view === view);
    });

    const chartContainer = document.getElementById('costChartContainer');
    const tableContainer = document.getElementById('costTableContainer');

    if (view === 'table') {
        chartContainer.style.display = 'none';
        tableContainer.style.display = 'block';
        if (billingTimelineData) renderBillingTable(billingTimelineData);
    } else {
        chartContainer.style.display = 'block';
        tableContainer.style.display = 'none';
        if (costChart) {
            costChart.config.type = view === 'bar' ? 'bar' : 'line';
            if (view === 'bar') {
                costChart.data.datasets[0].fill = false;
                costChart.data.datasets[0].tension = 0;
                costChart.data.datasets[0].backgroundColor = 'rgba(6, 182, 212, 0.7)';
                costChart.data.datasets[0].borderColor = '#06b6d4';
                costChart.data.datasets[0].borderWidth = 1;
                costChart.data.datasets[0].pointRadius = 0;
            } else {
                costChart.data.datasets[0].fill = true;
                costChart.data.datasets[0].tension = 0.4;
                costChart.data.datasets[0].backgroundColor = 'rgba(6, 182, 212, 0.1)';
                costChart.data.datasets[0].borderColor = '#06b6d4';
                costChart.data.datasets[0].borderWidth = 3;
                costChart.data.datasets[0].pointRadius = 4;
            }
            costChart.update();
        }
    }
}

function renderBillingTable(timeline) {
    const container = document.getElementById('costTableContainer');
    if (!container || !timeline) return;

    const currency = document.getElementById('currencySelect')?.value || 'MXN';
    const symbol = getCurrencySymbol(currency);

    let prevCost = 0;
    const rows = timeline.labels.map((label, i) => {
        const cumulative = convertCurrency(timeline.costs[i], currency);
        const daily = i === 0 ? cumulative : cumulative - convertCurrency(timeline.costs[i - 1], currency);
        return { label, cumulative, daily };
    });

    container.innerHTML = `
        <div class="data-table-wrapper">
            <table class="data-table">
                <thead>
                    <tr>
                        <th>Fecha</th>
                        <th>Costo Diario</th>
                        <th>Costo Acumulado</th>
                    </tr>
                </thead>
                <tbody>
                    ${rows.map(row => `
                        <tr>
                            <td>${row.label}</td>
                            <td class="cost-cell">${symbol}${row.daily.toFixed(4)} ${currency}</td>
                            <td class="cost-cell-accent">${symbol}${row.cumulative.toFixed(4)} ${currency}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    `;
}

function setUnifiedView(section, view) {
    const barsViewId   = section === 'most' ? 'mostBarsView'  : 'leastBarsView';
    const pieViewId    = section === 'most' ? 'mostPieView'   : 'leastPieView';
    const tableViewId  = section === 'most' ? 'mostTableView' : 'leastTableView';
    const data         = section === 'most' ? servicesData?.mostRequested : servicesData?.leastRequested;
    const isLeast      = section === 'least';

    // Update toggle buttons
    document.querySelectorAll(`[data-section="${section}"].view-toggle-btn`).forEach(btn => {
        btn.classList.toggle('active', btn.dataset.view === view);
    });

    // Hide all panels
    [barsViewId, pieViewId, tableViewId].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.display = 'none';
    });

    if (view === 'bars') {
        const panel = document.getElementById(barsViewId);
        if (panel) panel.style.display = '';
        const containerId = section === 'most' ? 'mostRequestedServicesContainer' : 'leastRequestedServicesContainer';
        renderServiceBars(containerId, data, isLeast);

    } else if (view === 'pie') {
        const panel = document.getElementById(pieViewId);
        if (panel) panel.style.display = '';
        const canvasId = section === 'most' ? 'mostRequestedPieChart' : 'leastRequestedPieChart';
        const legendId = section === 'most' ? 'mostRequestedLegend'   : 'leastRequestedLegend';
        const totalId  = section === 'most' ? 'mostRequestedTotal'     : 'leastRequestedTotal';
        renderPieChart(canvasId, legendId, totalId, data, isLeast);

    } else if (view === 'table') {
        const panel = document.getElementById(tableViewId);
        if (panel) {
            panel.style.display = '';
            renderServiceTable(panel, data, isLeast);
        }
    }
}


function renderServiceTable(container, services, isLeast = false) {
    if (!services || services.length === 0) {
        container.innerHTML = `<div class="service-chart-empty"><i class="lni lni-pie-chart"></i><p>No hay datos disponibles</p></div>`;
        return;
    }
    const total = services.reduce((sum, s) => sum + s.count, 0);
    const accentClass = isLeast ? 'purple' : 'cyan';
    container.innerHTML = `
        <div class="data-table-wrapper">
            <table class="data-table service-data-table">
                <thead>
                    <tr>
                        <th>#</th>
                        <th>Servicio</th>
                        <th>Solicitudes</th>
                        <th>Porcentaje</th>
                    </tr>
                </thead>
                <tbody>
                    ${services.map((s, i) => {
                        const pct = ((s.count / total) * 100).toFixed(1);
                        return `
                        <tr>
                            <td class="rank-cell">${i + 1}</td>
                            <td>${s.name}</td>
                            <td class="count-cell ${accentClass}">${s.count}</td>
                            <td>
                                <div class="pct-bar-mini">
                                    <div class="pct-bar-fill-mini ${accentClass}" style="width:${pct}%"></div>
                                    <span>${pct}%</span>
                                </div>
                            </td>
                        </tr>`;
                    }).join('')}
                </tbody>
                <tfoot>
                    <tr><td colspan="2"><strong>Total</strong></td><td class="count-cell ${accentClass}"><strong>${total}</strong></td><td></td></tr>
                </tfoot>
            </table>
        </div>
    `;
}



document.addEventListener('DOMContentLoaded', function () {
    console.log('dashboard.js listo');
    loadAgentStats();
    initializeCostChart();
    loadBillingData();
    loadServicesStatistics();
    initializeCreateAgentButton();

    const timeRangeSelect = document.getElementById('billingTimeRange');
    if (timeRangeSelect) {
        timeRangeSelect.addEventListener('change', function () {
            loadBillingData(this.value);
        });
    }

    const currencySelect = document.getElementById('currencySelect');
    if (currencySelect) {
        currencySelect.addEventListener('change', function () {
            const days = document.getElementById('billingTimeRange')?.value || 28;
            loadBillingData(days);
        });
    }
});

// ================== Onboarding en modal (Dashboard) ==================
function initializeCreateAgentButton() {
    const createBtn =
        document.getElementById('createAgentBtnDashboard') ||
        document.querySelector('.page-header .btn-primary[href="/onboarding"]');
    if (createBtn) {
        console.log('Botón Crear Agente encontrado');
        createBtn.addEventListener('click', function (e) {
            e.preventDefault();
            console.log('🟢 Crear Agente (dashboard) -> abrir modal');
            openOnboardingModal();
        });
    } else {
        console.warn('⚠️ No se encontró el botón Crear Agente');
    }
}

// Abrir modal
function openOnboardingModal() {
    let modal = document.getElementById('onboardingModal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'onboardingModal';
        modal.className = 'onboarding-modal';
        modal.innerHTML = `
      <div class="onboarding-overlay" onclick="closeOnboardingModal()"></div>
      <div class="onboarding-modal-content">
        <div class="onboarding-modal-header">
          <h2 class="onboarding-modal-title">
            <i class="lni lni-rocket"></i>
            Crear Nuevo Agente
          </h2>
          <button class="btn-close-onboarding" onclick="closeOnboardingModal()">
            <i class="lni lni-close"></i>
          </button>
        </div>
        <div class="onboarding-modal-body" id="onboardingModalBody">
          <div style="display: flex; justify-content: center; align-items: center; padding: 3rem;">
            <div class="loading-spinner"></div>
            <div class="loading-text" style="margin-left: 1rem;">Cargando formulario...</div>
          </div>
        </div>
      </div>
    `;
        document.body.appendChild(modal);
    }

    modal.style.position = 'fixed';
    modal.style.inset = '0';
    modal.style.zIndex = '10000';
    modal.style.display = 'flex';
    modal.style.alignItems = 'center';
    modal.style.justifyContent = 'center';
    modal.style.opacity = '1';
    modal.style.visibility = 'visible';

    document.documentElement.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';

    modal.classList.add('active');
    loadOnboardingContent();
}

// Cerrar modal
function closeOnboardingModal() {
    const modal = document.getElementById('onboardingModal');
    if (modal) {
        modal.classList.remove('active');
        modal.style.display = 'none';
        modal.style.visibility = 'hidden';
        modal.style.opacity = '0';
    }
    document.documentElement.style.overflow = '';
    document.body.style.overflow = '';
}
window.closeOnboardingModal = closeOnboardingModal;

// Cargar contenido (cacheado) y reinit
async function loadOnboardingContent() {
    const modalBody = document.getElementById('onboardingModalBody');
    if (!modalBody) return;

    try {
        let html;
        if (onboardingHTMLCache) {
            html = onboardingHTMLCache;
        } else {
            const response = await fetch('/onboarding');
            if (!response.ok) throw new Error('Error al cargar onboarding');
            html = await response.text();
            onboardingHTMLCache = html;
        }

        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        const mainContainer = doc.querySelector('.main-container');

        if (mainContainer) {
            modalBody.innerHTML = mainContainer.innerHTML;

            if (!onboardingScriptLoaded) {
                const script = document.createElement('script');
                script.src = '/static/js/onboarding.js';
                script.onload = () => {
                    onboardingScriptLoaded = true;
                    setTimeout(() => reinitializeOnboardingEvents(), 50);
                };
                document.body.appendChild(script);
            } else {
                setTimeout(() => reinitializeOnboardingEvents(), 20);
            }
        } else {
            modalBody.innerHTML = `
        <div style="text-align: center; padding: 2rem;">
          <i class="lni lni-warning" style="font-size: 3rem; color: #ef4444;"></i>
          <h3 style="margin: 1rem 0; color: #1a1a1a;">No se pudo cargar el formulario</h3>
          <p style="color: #6b7280; margin-bottom: 1.5rem;">Intenta nuevamente</p>
          <button class="btn-primary" onclick="loadOnboardingContent()">
            <i class="lni lni-reload"></i>
            <span>Reintentar</span>
          </button>
        </div>
      `;
        }
    } catch (error) {
        console.error('❌ Error cargando onboarding:', error);
        modalBody.innerHTML = `
      <div style="text-align: center; padding: 3rem;">
        <i class="lni lni-warning" style="font-size: 3rem; color: #ef4444;"></i>
        <h3 style="margin: 1rem 0; color: #1a1a1a;">Error al cargar el formulario</h3>
        <p style="color: #6b7280; margin-bottom: 1.5rem;">Por favor, intenta de nuevo</p>
        <button class="btn-primary" onclick="loadOnboardingContent()">
          <i class="lni lni-reload"></i>
          <span>Reintentar</span>
        </button>
      </div>
    `;
    }
}

// Reinicializar usando el onboarding original
function reinitializeOnboardingEvents() {
    console.log('🔄 Reinicializando eventos del onboarding en modal (dashboard)');

    if (typeof window.agentData !== 'undefined') window.agentData = defaultAgentData();
    if (typeof window.currentStep !== 'undefined') window.currentStep = 1;
    if (typeof window.currentSection !== 'undefined') window.currentSection = 1;
    if (typeof window.selectedSocial !== 'undefined') window.selectedSocial = '';

    const modal = document.getElementById('onboardingModal');
    const modalContent = modal?.querySelector('.onboarding-modal-content');
    if (modalContent) {
        modalContent.style.maxWidth = '1100px';
        modalContent.style.width = '95vw';
        modalContent.style.maxHeight = '90vh';
        modalContent.style.overflow = 'hidden';
    }
    const modalBody = document.getElementById('onboardingModalBody');
    if (modalBody) {
        modalBody.style.maxHeight = '82vh';
        modalBody.style.overflowY = 'auto';
        modalBody.scrollTop = 0;
    }

    if (typeof fetchUserData === 'function') fetchUserData();
    if (typeof initializeSocialSelection === 'function') initializeSocialSelection();
    if (typeof initializeNavigationButtons === 'function') initializeNavigationButtons();
    if (typeof initializeSectionNavigation === 'function') initializeSectionNavigation();
    if (typeof initializeToneSelection === 'function') initializeToneSelection();
    if (typeof initializeLanguageSelection === 'function') initializeLanguageSelection();
    if (typeof initializeRichEditor === 'function') initializeRichEditor();
    if (typeof initializePhoneToggle === 'function') initializePhoneToggle();
    if (typeof initializeSchedule === 'function') initializeSchedule();
    if (typeof initializeHolidays === 'function') initializeHolidays();
    if (typeof initializeServices === 'function') initializeServices();
    if (typeof initializeWorkers === 'function') initializeWorkers();
    if (typeof initializeLocationDropdowns === 'function') initializeLocationDropdowns();
    if (typeof initializeSocialMediaInputs === 'function') initializeSocialMediaInputs();

    setTimeout(() => {
        if (typeof initBusinessTimePickers === 'function') initBusinessTimePickers();
        if (typeof initHolidayDatePickers === 'function') initHolidayDatePickers();
        if (typeof initWorkerTimePickers === 'function') initWorkerTimePickers();
    }, 100);

    if (typeof updateStepDisplay === 'function') updateStepDisplay();
    if (typeof updateProgressBar === 'function') updateProgressBar();
}

// ================== Fin onboarding modal ==================


// Cargar estadísticas de agentes
async function loadAgentStats() {
    try {
        const response = await fetch('/api/agents');
        const data = await response.json();

        if (data.agents && data.agents.length > 0) {
            const activeCount = data.agents.filter((a) => a.deployStatus === 'running').length;
            updateStatCard('activeAgentsCount', activeCount);
        } else {
            updateStatCard('activeAgentsCount', 0);
        }
    } catch (error) {
        console.error('Error loading agent stats:', error);
        updateStatCard('activeAgentsCount', 0);
    }
}
function updateStatCard(elementId, value) {
    const element = document.getElementById(elementId);
    if (!element) return;
    element.textContent = value;
}

// BILLING CHART
function initializeCostChart() {
    const ctx = document.getElementById('costChart');
    if (!ctx) return;

    const isDarkMode = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    const textColor = isDarkMode ? '#e5e7eb' : '#6b7280';

    costChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: [],
            datasets: [
                {
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
                    pointHoverBackgroundColor: '#06b6d4',
                    pointHoverBorderColor: '#fff'
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { intersect: false, mode: 'index' },
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: 'rgba(0, 0, 0, 0.8)',
                    titleColor: '#fff',
                    bodyColor: '#fff',
                    borderColor: '#06b6d4',
                    borderWidth: 1,
                    padding: 12,
                    displayColors: false,
                    callbacks: {
                        label: function (context) {
                            const currency = document.getElementById('currencySelect')?.value || 'MXN';
                            const symbol = getCurrencySymbol(currency);
                            return 'Costo: ' + symbol + context.parsed.y.toFixed(2) + ' ' + currency;
                        }
                    }
                }
            },
            scales: {
                x: {
                    grid: { display: false, drawBorder: false },
                    ticks: { color: textColor, font: { size: 11 } }
                },
                y: {
                    beginAtZero: true,
                    grid: { display: false, drawBorder: false },
                    ticks: {
                        color: textColor,
                        font: { size: 11 },
                        callback: function (value) {
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
        const response = await fetch(`/api/billing/data?days=${days}`);

        if (!response.ok) throw new Error('Error fetching billing data');

        const data = await response.json();
        updateCostSummary(data.summary, days);
        updateCostChart(data.timeline);
    } catch (error) {
        console.error('Error loading billing data:', error);
        const mockData = generateMockBillingData(days);
        updateCostSummary(mockData.summary, days);
        updateCostChart(mockData.timeline);
    }
}

function updateCostSummary(summary) {
    const currency = document.getElementById('currencySelect')?.value || 'MXN';
    const symbol = getCurrencySymbol(currency);
    const convertedCost = convertCurrency(summary.cost, currency);
    document.getElementById('totalCost').textContent = symbol + convertedCost.toFixed(2) + ' ' + currency;
}

function updateCostChart(timeline) {
    billingTimelineData = timeline; // cache for table view
    if (billingView === 'table') {
        renderBillingTable(timeline);
        return;
    }
    if (!costChart) return;
    const currency = document.getElementById('currencySelect')?.value || 'MXN';
    const convertedCosts = timeline.costs.map((cost) => convertCurrency(cost, currency));
    costChart.data.labels = timeline.labels;
    costChart.data.datasets[0].data = convertedCosts;
    costChart.update('none');
}

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

        const dailyCost = Math.random() * 0.05 + 0.01;
        totalCost += dailyCost;
        costs.push(parseFloat(totalCost.toFixed(2)));
    }

    return {
        summary: { cost: totalCost },
        timeline: { labels: labels, costs: costs }
    };
}

// SERVICES STATISTICS
async function loadServicesStatistics() {
    try {
        const response = await fetch('/api/services/statistics');

        if (!response.ok) throw new Error('Error fetching services statistics');

        const data = await response.json();
        servicesData = data;

        renderServiceBars('mostRequestedServicesContainer', data.mostRequested, false);
        renderServiceBars('leastRequestedServicesContainer', data.leastRequested, true);

        renderPieChart('mostRequestedPieChart', 'mostRequestedLegend', 'mostRequestedTotal', data.mostRequested, false);
        renderPieChart('leastRequestedPieChart', 'leastRequestedLegend', 'leastRequestedTotal', data.leastRequested, true);
    } catch (error) {
        console.error('Error loading services statistics:', error);

        const mockData = generateMockServicesData();
        servicesData = mockData;

        renderServiceBars('mostRequestedServicesContainer', mockData.mostRequested, false);
        renderServiceBars('leastRequestedServicesContainer', mockData.leastRequested, true);

        renderPieChart('mostRequestedPieChart', 'mostRequestedLegend', 'mostRequestedTotal', mockData.mostRequested, false);
        renderPieChart('leastRequestedPieChart', 'leastRequestedLegend', 'leastRequestedTotal', mockData.leastRequested, true);
    }
}

function renderServiceBars(containerId, services) {
    const container = document.getElementById(containerId);
    if (!container) return;

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

    const maxCount = Math.max(...services.map((s) => s.count));

    services.forEach((service) => {
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

        setTimeout(() => {
            const fillBar = barItem.querySelector('.service-bar-fill');
            if (fillBar) {
                fillBar.style.width = percentage + '%';
            }
        }, 100);
    });
}

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

    const mostRequested = allServices.slice(0, 5);
    const leastRequested = allServices.slice(-5).reverse();

    return { mostRequested, leastRequested };
}

// PIE CHARTS
const pieColors = [
    '#06b6d4', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444',
    '#ec4899', '#6366f1', '#14b8a6', '#f97316', '#a855f7'
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

    const total = services.reduce((sum, service) => sum + service.count, 0);
    totalBadge.textContent = `${total} Total`;

    const labels = services.map((s) => s.name);
    const data = services.map((s) => s.count);
    const colors = services.map((_, index) => pieColors[index % pieColors.length]);

    if (isLeast && leastRequestedPieChart) {
        leastRequestedPieChart.destroy();
    } else if (!isLeast && mostRequestedPieChart) {
        mostRequestedPieChart.destroy();
    }

    const chart = new Chart(canvas, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [
                {
                    data: data,
                    backgroundColor: colors,
                    borderWidth: 3,
                    borderColor: '#fff',
                    hoverOffset: 15
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: 'rgba(0, 0, 0, 0.8)',
                    titleColor: '#fff',
                    bodyColor: '#fff',
                    borderColor: colors[0],
                    borderWidth: 1,
                    padding: 12,
                    displayColors: true,
                    callbacks: {
                        label: function (context) {
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

    if (isLeast) leastRequestedPieChart = chart;
    else mostRequestedPieChart = chart;

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

// EXPORTS
function exportToExcel() {
    if (!servicesData) {
        showNotification('No hay datos para exportar', 'error');
        return;
    }

    try {
        const wb = XLSX.utils.book_new();

        const mostRequestedData = [
            ['Servicios Más Pedidos'],
            ['Servicio', 'Cantidad', 'Porcentaje'],
            ...servicesData.mostRequested.map((service) => {
                const total = servicesData.mostRequested.reduce((sum, s) => sum + s.count, 0);
                const percentage = ((service.count / total) * 100).toFixed(1) + '%';
                return [service.name, service.count, percentage];
            }),
            [],
            ['Total', servicesData.mostRequested.reduce((sum, s) => sum + s.count, 0)]
        ];

        const leastRequestedData = [
            ['Servicios Menos Pedidos'],
            ['Servicio', 'Cantidad', 'Porcentaje'],
            ...servicesData.leastRequested.map((service) => {
                const total = servicesData.leastRequested.reduce((sum, s) => sum + s.count, 0);
                const percentage = ((service.count / total) * 100).toFixed(1) + '%';
                return [service.name, service.count, percentage];
            }),
            [],
            ['Total', servicesData.leastRequested.reduce((sum, s) => sum + s.count, 0)]
        ];

        const wsMostRequested = XLSX.utils.aoa_to_sheet(mostRequestedData);
        const wsLeastRequested = XLSX.utils.aoa_to_sheet(leastRequestedData);

        XLSX.utils.book_append_sheet(wb, wsMostRequested, 'Más Pedidos');
        XLSX.utils.book_append_sheet(wb, wsLeastRequested, 'Menos Pedidos');

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

        doc.setFontSize(20);
        doc.setTextColor(6, 182, 212);
        doc.text('Reporte de Servicios', 20, 20);

        doc.setFontSize(10);
        doc.setTextColor(100);
        doc.text(`Fecha: ${new Date().toLocaleDateString('es-MX')}`, 20, 30);

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

        yPos += 5;
        doc.setFontSize(12);
        doc.setTextColor(0);
        doc.text(`Total: ${mostTotal}`, 25, yPos);

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

        yPos += 5;
        doc.setFontSize(12);
        doc.setTextColor(0);
        doc.text(`Total: ${leastTotal}`, 25, yPos);

        const pageHeight = doc.internal.pageSize.height;
        doc.setFontSize(8);
        doc.setTextColor(150);
        doc.text('Generado por Attomos Dashboard', 20, pageHeight - 10);

        const fileName = `servicios_${new Date().toISOString().split('T')[0]}.pdf`;
        doc.save(fileName);

        showNotification('PDF exportado exitosamente', 'success');
    } catch (error) {
        console.error('Error exporting to PDF:', error);
        showNotification('Error al exportar a PDF', 'error');
    }
}

// Notifications
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