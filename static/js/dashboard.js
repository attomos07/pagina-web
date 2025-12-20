// Dashboard functionality (sin sección de agentes)
let costChart = null;
let mostRequestedPieChart = null;
let leastRequestedPieChart = null;
let servicesData = null;

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
    loadAgentStats(); // Solo cargar estadísticas
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

// Cargar solo estadísticas de agentes (para los stat cards)
async function loadAgentStats() {
    try {
        const response = await fetch('/api/agents');
        const data = await response.json();

        if (data.agents && data.agents.length > 0) {
            const activeCount = data.agents.filter(a => a.deployStatus === 'running').length;
            updateStatCard('activeAgentsCount', activeCount);
        } else {
            updateStatCard('activeAgentsCount', 0);
        }
    } catch (error) {
        console.error('Error loading agent stats:', error);
        updateStatCard('activeAgentsCount', 0);
    }
}

// Actualizar tarjeta de estadística
function updateStatCard(elementId, value) {
    const element = document.getElementById(elementId);
    if (!element) return;
    
    element.textContent = value;
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
        const response = await fetch(`/api/billing/data?days=${days}`);
        
        if (!response.ok) {
            throw new Error('Error fetching billing data');
        }
        
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

function updateCostSummary(summary, days) {
    const currency = document.getElementById('currencySelect')?.value || 'MXN';
    const symbol = getCurrencySymbol(currency);
    const convertedCost = convertCurrency(summary.cost, currency);
    
    document.getElementById('totalCost').textContent = symbol + convertedCost.toFixed(2) + ' ' + currency;
}

function updateCostChart(timeline) {
    if (!costChart) return;
    
    const currency = document.getElementById('currencySelect')?.value || 'MXN';
    const convertedCosts = timeline.costs.map(cost => convertCurrency(cost, currency));
    
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
// SERVICES STATISTICS FUNCTIONALITY
// ============================================

async function loadServicesStatistics() {
    try {
        const response = await fetch('/api/services/statistics');
        
        if (!response.ok) {
            throw new Error('Error fetching services statistics');
        }
        
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

function renderServiceBars(containerId, services, isLeast = false) {
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
    
    const maxCount = Math.max(...services.map(s => s.count));
    
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
    
    return {
        mostRequested,
        leastRequested
    };
}

// ============================================
// PIE CHARTS FUNCTIONALITY
// ============================================

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
    
    const labels = services.map(s => s.name);
    const data = services.map(s => s.count);
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
    
    if (isLeast) {
        leastRequestedPieChart = chart;
    } else {
        mostRequestedPieChart = chart;
    }
    
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
// EXPORT FUNCTIONS
// ============================================

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
            ...servicesData.mostRequested.map(service => {
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
            ...servicesData.leastRequested.map(service => {
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