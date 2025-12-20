// Agent Details Page functionality

let agentId = null;
let agent = null;
let qrPollInterval = null;

// Initialize page
document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 Agent Details JS loaded');
    
    // Extract agent ID from URL: /agents/{id}
    const pathParts = window.location.pathname.split('/');
    agentId = pathParts[pathParts.length - 1];
    
    if (!agentId || agentId === 'agents') {
        console.error('❌ No agent ID found in URL');
        window.location.href = '/my-agents';
        return;
    }
    
    console.log('📋 Agent ID:', agentId);
    loadAgentDetails();
    startQRPolling();
});

// Load agent details
async function loadAgentDetails() {
    try {
        const response = await fetch(`/api/agents/${agentId}`, {
            credentials: 'include'
        });

        if (!response.ok) {
            throw new Error('Error loading agent details');
        }

        const data = await response.json();
        agent = data.agent;
        
        console.log('📊 Agent data:', agent);
        
        renderAgentDetails(agent);
        loadQRCode();
    } catch (error) {
        console.error('❌ Error:', error);
        alert('Error loading agent details');
        window.location.href = '/my-agents';
    }
}

// Render agent details
function renderAgentDetails(agent) {
    // Header
    document.getElementById('agentName').textContent = agent.name;
    document.getElementById('agentId').textContent = `ID: ${agent.id}`;
    updateStatusBadge(agent);
    
    // Toggle button
    const toggleIcon = document.getElementById('toggleIcon');
    const toggleText = document.getElementById('toggleText');
    if (agent.isActive) {
        toggleIcon.className = 'lni lni-pause';
        toggleText.textContent = 'Pause';
    } else {
        toggleIcon.className = 'lni lni-play';
        toggleText.textContent = 'Activate';
    }
    
    // Basic Info
    document.getElementById('infoName').textContent = agent.name;
    document.getElementById('infoPhone').textContent = agent.phoneNumber || 'Not configured';
    document.getElementById('infoBusinessType').textContent = formatBusinessType(agent.businessType);
    document.getElementById('infoPort').textContent = agent.port || '--';
    
    // Configuration
    if (agent.config) {
        document.getElementById('configTone').textContent = formatTone(agent.config.tone);
        
        const languages = [...(agent.config.languages || []), ...(agent.config.additionalLanguages || [])];
        document.getElementById('configLanguages').textContent = languages.length > 0 
            ? languages.join(', ') 
            : 'Not configured';
        
        document.getElementById('configWelcome').textContent = 
            agent.config.welcomeMessage || 'No welcome message configured';
        
        // Schedule
        renderSchedule(agent.config.schedule);
        
        // Services
        renderServices(agent.config.services);
        
        // Workers
        renderWorkers(agent.config.workers);
    }
}

// Update status badge
function updateStatusBadge(agent) {
    const statusBadge = document.getElementById('agentStatus');
    statusBadge.className = 'status-badge';
    
    if (agent.deployStatus === 'running' && agent.isActive) {
        statusBadge.classList.add('active');
        statusBadge.innerHTML = '<span class="status-dot"></span><span>Active</span>';
    } else if (agent.deployStatus === 'pending' || agent.deployStatus === 'deploying') {
        statusBadge.classList.add('pending');
        statusBadge.innerHTML = '<span class="status-dot"></span><span>Deploying</span>';
    } else if (agent.deployStatus === 'error') {
        statusBadge.classList.add('inactive');
        statusBadge.innerHTML = '<span class="status-dot"></span><span>Error</span>';
    } else {
        statusBadge.classList.add('inactive');
        statusBadge.innerHTML = '<span class="status-dot"></span><span>Inactive</span>';
    }
}

// Load QR Code
async function loadQRCode() {
    // Only load QR for atomic bots (WhatsApp Web)
    if (agent.botType !== 'atomic') {
        const qrSection = document.getElementById('qrSection');
        qrSection.style.display = 'none';
        return;
    }
    
    try {
        const response = await fetch(`/api/agents/${agentId}/qr`, {
            credentials: 'include'
        });

        const data = await response.json();
        
        if (response.ok && data.qrCode) {
            displayQRCode(data.qrCode);
        } else if (data.connected) {
            displayConnectedMessage();
        } else {
            displayQRLoading(data.message || 'Waiting for QR code...');
        }
    } catch (error) {
        console.error('❌ Error loading QR:', error);
        displayQRError();
    }
}

// Display QR Code
function displayQRCode(qrCode) {
    const qrContainer = document.getElementById('qrContainer');
    qrContainer.innerHTML = `
        <div class="qr-code">
            <pre>${escapeHtml(qrCode)}</pre>
        </div>
        <div class="qr-info">
            <i class="lni lni-timer"></i>
            <span>QR code refreshes automatically</span>
        </div>
    `;
}

// Display connected message
function displayConnectedMessage() {
    const qrContainer = document.getElementById('qrContainer');
    qrContainer.innerHTML = `
        <div class="qr-connected">
            <div class="connected-icon">
                <i class="lni lni-checkmark-circle"></i>
            </div>
            <h3>WhatsApp Connected!</h3>
            <p>Your bot is connected and running</p>
        </div>
    `;
    
    // Stop polling when connected
    if (qrPollInterval) {
        clearInterval(qrPollInterval);
        qrPollInterval = null;
    }
}

// Display QR loading state
function displayQRLoading(message) {
    const qrContainer = document.getElementById('qrContainer');
    qrContainer.innerHTML = `
        <div class="qr-loading">
            <div class="loading-spinner"></div>
            <p>${escapeHtml(message)}</p>
        </div>
    `;
}

// Display QR error
function displayQRError() {
    const qrContainer = document.getElementById('qrContainer');
    qrContainer.innerHTML = `
        <div class="qr-error">
            <i class="lni lni-warning"></i>
            <p>Could not load QR code</p>
            <button class="btn-secondary btn-sm" onclick="loadQRCode()">
                <i class="lni lni-reload"></i>
                Retry
            </button>
        </div>
    `;
}

// Start QR polling (every 5 seconds)
function startQRPolling() {
    // Only poll if atomic bot
    if (!agent || agent.botType !== 'atomic') return;
    
    qrPollInterval = setInterval(() => {
        loadQRCode();
    }, 5000);
}

// Render schedule
function renderSchedule(schedule) {
    if (!schedule) {
        document.getElementById('scheduleGrid').innerHTML = '<p class="no-data">No schedule configured</p>';
        return;
    }
    
    const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
    const dayNames = {
        monday: 'Monday',
        tuesday: 'Tuesday',
        wednesday: 'Wednesday',
        thursday: 'Thursday',
        friday: 'Friday',
        saturday: 'Saturday',
        sunday: 'Sunday'
    };
    
    const scheduleHTML = days.map(day => {
        const daySchedule = schedule[day];
        if (!daySchedule) return '';
        
        return `
            <div class="schedule-item">
                <div class="schedule-day">${dayNames[day]}</div>
                <div class="schedule-time">
                    ${daySchedule.open 
                        ? `${daySchedule.start} - ${daySchedule.end}`
                        : '<span class="closed">Closed</span>'
                    }
                </div>
            </div>
        `;
    }).join('');
    
    document.getElementById('scheduleGrid').innerHTML = scheduleHTML || '<p class="no-data">No schedule configured</p>';
}

// Render services
function renderServices(services) {
    if (!services || services.length === 0) {
        document.getElementById('servicesList').innerHTML = '<p class="no-data">No services configured</p>';
        return;
    }
    
    const servicesHTML = services.map(service => `
        <div class="service-item">
            <div class="service-header">
                <h4>${escapeHtml(service.title)}</h4>
                <span class="service-price">${formatPrice(service)}</span>
            </div>
            <p class="service-description">${escapeHtml(service.description)}</p>
        </div>
    `).join('');
    
    document.getElementById('servicesList').innerHTML = servicesHTML;
}

// Render workers
function renderWorkers(workers) {
    if (!workers || workers.length === 0) {
        document.getElementById('workersList').innerHTML = '<p class="no-data">No staff configured</p>';
        return;
    }
    
    const workersHTML = workers.map(worker => `
        <div class="worker-item">
            <div class="worker-header">
                <div class="worker-avatar">
                    <i class="lni lni-user"></i>
                </div>
                <div class="worker-info">
                    <h4>${escapeHtml(worker.name)}</h4>
                    <p class="worker-schedule">${worker.startTime} - ${worker.endTime}</p>
                </div>
            </div>
            <div class="worker-days">
                ${formatWorkDays(worker.days)}
            </div>
        </div>
    `).join('');
    
    document.getElementById('workersList').innerHTML = workersHTML;
}

// Format price based on price type
function formatPrice(service) {
    if (service.priceType === 'promo' && service.promoPrice) {
        return `<del>$${service.price}</del> $${service.promoPrice}`;
    }
    return `$${service.price}`;
}

// Format work days
function formatWorkDays(days) {
    if (!days || days.length === 0) return 'No days configured';
    
    const dayAbbr = {
        monday: 'Mon',
        tuesday: 'Tue',
        wednesday: 'Wed',
        thursday: 'Thu',
        friday: 'Fri',
        saturday: 'Sat',
        sunday: 'Sun'
    };
    
    return days.map(day => `<span class="day-badge">${dayAbbr[day] || day}</span>`).join('');
}

// Format business type
function formatBusinessType(type) {
    if (!type) return 'Not specified';
    return type.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
}

// Format tone
function formatTone(tone) {
    if (!tone) return 'Not specified';
    return tone.charAt(0).toUpperCase() + tone.slice(1);
}

// Toggle agent status
async function toggleAgentStatus() {
    if (!agent) return;
    
    const action = agent.isActive ? 'pause' : 'activate';
    
    if (!confirm(`Are you sure you want to ${action} this agent?`)) {
        return;
    }
    
    try {
        const response = await fetch(`/api/agents/${agentId}/toggle`, {
            method: 'PATCH',
            credentials: 'include'
        });
        
        if (!response.ok) {
            throw new Error('Error toggling agent status');
        }
        
        await loadAgentDetails();
        alert(`Agent ${action}d successfully`);
    } catch (error) {
        console.error('❌ Error:', error);
        alert('Error changing agent status. Please try again.');
    }
}

// Escape HTML
function escapeHtml(text) {
    if (!text) return '';
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return String(text).replace(/[&<>"']/g, m => map[m]);
}

// Cleanup on page unload
window.addEventListener('beforeunload', function() {
    if (qrPollInterval) {
        clearInterval(qrPollInterval);
    }
});