// ============================================
// INTEGRATIONS JAVASCRIPT
// ============================================

document.addEventListener('DOMContentLoaded', function() {
    console.log('🔧 Integrations JS cargado correctamente');
    
    initAgentSelector();
    initGoogleIntegration();
    
    console.log('✅ Integrations funcionalidades inicializadas');
});

// ============================================
// GLOBAL STATE
// ============================================

let selectedAgentId = null;
let agents = [];

// ============================================
// AGENT SELECTOR
// ============================================

async function initAgentSelector() {
    console.log('📊 Cargando agentes...');
    
    try {
        const response = await fetch('/api/agents', {
            method: 'GET',
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error('Error al cargar agentes');
        }

        const data = await response.json();
        
        // Corregir: el endpoint devuelve { agents: [...] }
        agents = data.agents || [];
        
        console.log(`✅ ${agents.length} agentes cargados`, agents);

        if (agents.length === 0) {
            showNoAgentsState();
            return;
        }

        populateAgentSelector(agents);
        setupAgentSelectorEvents();
        
    } catch (error) {
        console.error('Error cargando agentes:', error);
        showNotification('Error al cargar agentes', 'error');
        showNoAgentsState();
    }
}

function populateAgentSelector(agents) {
    const optionsContainer = document.getElementById('agentSelectOptions');
    
    if (!optionsContainer) return;
    
    optionsContainer.innerHTML = '';
    
    agents.forEach(agent => {
        const option = document.createElement('div');
        option.className = 'select-option';
        option.setAttribute('data-agent-id', agent.id);
        option.textContent = agent.name;
        
        optionsContainer.appendChild(option);
    });
}

function setupAgentSelectorEvents() {
    const selectWrapper = document.getElementById('agentSelect');
    const selectDisplay = document.getElementById('agentSelectDisplay');
    const dropdown = document.getElementById('agentSelectDropdown');
    const options = document.querySelectorAll('.select-option');
    
    if (!selectWrapper || !selectDisplay || !dropdown) return;
    
    // Toggle dropdown
    selectDisplay.addEventListener('click', function(e) {
        e.stopPropagation();
        toggleAgentDropdown();
    });
    
    // Select option
    options.forEach(option => {
        option.addEventListener('click', function(e) {
            e.stopPropagation();
            selectAgent(this);
        });
    });
    
    // Close dropdown when clicking outside
    document.addEventListener('click', function(e) {
        if (!selectWrapper.contains(e.target)) {
            closeAgentDropdown();
        }
    });
}

function toggleAgentDropdown() {
    const selectWrapper = document.getElementById('agentSelect');
    const isActive = selectWrapper.classList.contains('active');
    
    if (isActive) {
        closeAgentDropdown();
    } else {
        openAgentDropdown();
    }
}

function openAgentDropdown() {
    const selectWrapper = document.getElementById('agentSelect');
    selectWrapper.classList.add('active');
}

function closeAgentDropdown() {
    const selectWrapper = document.getElementById('agentSelect');
    selectWrapper.classList.remove('active');
}

async function selectAgent(option) {
    const agentId = option.getAttribute('data-agent-id');
    const agentName = option.textContent;
    
    selectedAgentId = parseInt(agentId);
    
    // Update display
    const selectDisplay = document.getElementById('agentSelectDisplay');
    selectDisplay.textContent = agentName;
    
    // Update selected state
    const allOptions = document.querySelectorAll('.select-option');
    allOptions.forEach(opt => opt.classList.remove('selected'));
    option.classList.add('selected');
    
    closeAgentDropdown();
    
    console.log(`✅ Agente seleccionado: ${agentName} (ID: ${agentId})`);
    
    // Show integrations grid and hide empty state
    showIntegrationsGrid();
    
    // Load integration status for selected agent
    await loadGoogleIntegrationStatus(selectedAgentId);
}

function showIntegrationsGrid() {
    const grid = document.getElementById('integrationsGrid');
    const emptyState = document.getElementById('emptyState');
    
    if (grid) grid.style.display = 'grid';
    if (emptyState) emptyState.classList.remove('active');
}

function showNoAgentsState() {
    const grid = document.getElementById('integrationsGrid');
    const emptyState = document.getElementById('emptyState');
    const noAgentsState = document.getElementById('noAgentsState');
    const agentSelector = document.querySelector('.agent-selector');
    
    if (grid) grid.style.display = 'none';
    if (emptyState) emptyState.classList.remove('active');
    if (noAgentsState) noAgentsState.style.display = 'block';
    if (agentSelector) agentSelector.style.display = 'none';
}

// ============================================
// GOOGLE INTEGRATION
// ============================================

function initGoogleIntegration() {
    const btnConnect = document.getElementById('btnConnectGoogle');
    const btnDisconnect = document.getElementById('btnDisconnectGoogle');
    const btnReconnect = document.getElementById('btnReconnectGoogle');
    
    if (btnConnect) {
        btnConnect.addEventListener('click', connectGoogle);
    }
    
    if (btnDisconnect) {
        btnDisconnect.addEventListener('click', disconnectGoogle);
    }
    
    if (btnReconnect) {
        btnReconnect.addEventListener('click', connectGoogle);
    }
}

async function loadGoogleIntegrationStatus(agentId) {
    console.log(`📊 Cargando estado de integración para agente ${agentId}...`);
    
    try {
        const response = await fetch(`/api/google/status/${agentId}`, {
            method: 'GET',
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error('Error al cargar estado de integración');
        }

        const data = await response.json();
        console.log('✅ Estado de integración:', data);
        
        updateGoogleIntegrationUI(data);
        
        // Enable connect button now that we have an agent selected
        const btnConnect = document.getElementById('btnConnectGoogle');
        if (btnConnect && !data.connected) {
            btnConnect.disabled = false;
        }
        
    } catch (error) {
        console.error('Error cargando estado de integración:', error);
        
        // Still enable the connect button
        const btnConnect = document.getElementById('btnConnectGoogle');
        if (btnConnect) {
            btnConnect.disabled = false;
        }
    }
}

function updateGoogleIntegrationUI(data) {
    const statusBadge = document.getElementById('googleStatus');
    const connectionInfo = document.getElementById('googleConnectionInfo');
    const connectActions = document.getElementById('googleActions');
    const manageActions = document.getElementById('googleManageActions');
    const calendarLink = document.getElementById('calendarLink');
    const sheetLink = document.getElementById('sheetLink');
    const connectedAt = document.getElementById('connectedAt');
    
    if (data.connected) {
        // Update status badge
        if (statusBadge) {
            statusBadge.className = 'status-badge connected';
            statusBadge.innerHTML = `
                <span class="status-indicator"></span>
                Conectado
            `;
        }
        
        // Show connection info
        if (connectionInfo) {
            connectionInfo.style.display = 'block';
            
            // Update calendar link
            if (calendarLink && data.calendar_id) {
                const calendarUrl = `https://calendar.google.com/calendar/u/0/r?cid=${encodeURIComponent(data.calendar_id)}`;
                calendarLink.href = calendarUrl;
            }
            
            // Update sheet link
            if (sheetLink && data.sheet_id) {
                const sheetUrl = `https://docs.google.com/spreadsheets/d/${data.sheet_id}/edit`;
                sheetLink.href = sheetUrl;
            }
            
            // Update connected date
            if (connectedAt && data.connected_at) {
                const date = new Date(data.connected_at);
                connectedAt.textContent = formatDate(date);
            }
        }
        
        // Show manage actions, hide connect actions
        if (connectActions) connectActions.style.display = 'none';
        if (manageActions) manageActions.style.display = 'flex';
        
    } else {
        // Update status badge
        if (statusBadge) {
            statusBadge.className = 'status-badge disconnected';
            statusBadge.innerHTML = `
                <span class="status-indicator"></span>
                No conectado
            `;
        }
        
        // Hide connection info
        if (connectionInfo) {
            connectionInfo.style.display = 'none';
        }
        
        // Show connect actions, hide manage actions
        if (connectActions) connectActions.style.display = 'flex';
        if (manageActions) manageActions.style.display = 'none';
    }
}

async function connectGoogle() {
    if (!selectedAgentId) {
        showNotification('Por favor selecciona un agente primero', 'error');
        return;
    }
    
    console.log(`🔗 Iniciando conexión de Google para agente ${selectedAgentId}...`);
    
    try {
        // Get auth URL from API
        const response = await fetch(`/api/google/connect?agent_id=${selectedAgentId}`, {
            method: 'GET',
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error('Error al obtener URL de autorización');
        }

        const data = await response.json();
        
        if (!data.auth_url) {
            throw new Error('No se recibió URL de autorización');
        }
        
        // Open OAuth window
        const width = 600;
        const height = 700;
        const left = (window.screen.width - width) / 2;
        const top = (window.screen.height - height) / 2;
        
        const popup = window.open(
            data.auth_url,
            'GoogleOAuth',
            `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes`
        );
        
        if (!popup) {
            showNotification('Por favor permite ventanas emergentes para continuar', 'error');
            return;
        }
        
        // Poll for popup close
        const pollTimer = setInterval(async () => {
            if (popup.closed) {
                clearInterval(pollTimer);
                console.log('🔄 Ventana OAuth cerrada, verificando estado...');
                
                // Wait a bit for the callback to complete
                await new Promise(resolve => setTimeout(resolve, 1000));
                
                // Reload integration status
                await loadGoogleIntegrationStatus(selectedAgentId);
            }
        }, 500);
        
    } catch (error) {
        console.error('Error conectando Google:', error);
        showNotification('Error al conectar con Google', 'error');
    }
}

async function disconnectGoogle() {
    if (!selectedAgentId) {
        showNotification('Por favor selecciona un agente primero', 'error');
        return;
    }
    
    // Confirm disconnection
    if (!confirm('¿Estás seguro de que quieres desconectar Google? Esto eliminará el acceso a tu calendario y hoja de cálculo.')) {
        return;
    }
    
    console.log(`🔌 Desconectando Google para agente ${selectedAgentId}...`);
    
    const btnDisconnect = document.getElementById('btnDisconnectGoogle');
    const originalText = btnDisconnect.innerHTML;
    
    btnDisconnect.innerHTML = `
        <div class="loading-spinner"></div>
        <span>Desconectando...</span>
    `;
    btnDisconnect.disabled = true;
    
    try {
        const response = await fetch(`/api/google/disconnect/${selectedAgentId}`, {
            method: 'POST',
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error('Error al desconectar Google');
        }

        const data = await response.json();
        console.log('✅ Google desconectado:', data);
        
        showNotification('Google desconectado exitosamente', 'success');
        
        // Reload integration status
        await loadGoogleIntegrationStatus(selectedAgentId);
        
    } catch (error) {
        console.error('Error desconectando Google:', error);
        showNotification('Error al desconectar Google', 'error');
        
        btnDisconnect.innerHTML = originalText;
        btnDisconnect.disabled = false;
    }
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

function formatDate(date) {
    const now = new Date();
    const diff = now - date;
    
    // Less than 1 minute
    if (diff < 60000) {
        return 'Hace un momento';
    }
    
    // Less than 1 hour
    if (diff < 3600000) {
        const minutes = Math.floor(diff / 60000);
        return `Hace ${minutes} minuto${minutes > 1 ? 's' : ''}`;
    }
    
    // Less than 1 day
    if (diff < 86400000) {
        const hours = Math.floor(diff / 3600000);
        return `Hace ${hours} hora${hours > 1 ? 's' : ''}`;
    }
    
    // Less than 1 week
    if (diff < 604800000) {
        const days = Math.floor(diff / 86400000);
        return `Hace ${days} día${days > 1 ? 's' : ''}`;
    }
    
    // Format as date
    const options = { year: 'numeric', month: 'short', day: 'numeric' };
    return date.toLocaleDateString('es-MX', options);
}

// ============================================
// NOTIFICATION SYSTEM
// ============================================

function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.style.cssText = `
        position: fixed;
        top: 100px;
        right: 20px;
        background: ${type === 'success' ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)' : 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)'};
        color: white;
        padding: 1rem 1.5rem;
        border-radius: 12px;
        box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
        font-weight: 600;
        z-index: 10000;
        animation: slideInRight 0.4s ease;
        min-width: 300px;
        display: flex;
        align-items: center;
        gap: 0.75rem;
    `;
    
    const icon = type === 'success' ? '✓' : '✕';
    notification.innerHTML = `
        <span style="font-size: 1.25rem;">${icon}</span>
        <span>${message}</span>
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.animation = 'slideOutRight 0.4s ease';
        setTimeout(() => notification.remove(), 400);
    }, 3000);
}

// Add CSS for animations
const style = document.createElement('style');
style.textContent = `
    @keyframes slideInRight {
        from {
            transform: translateX(400px);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
    
    @keyframes slideOutRight {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(400px);
            opacity: 0;
        }
    }
`;
document.head.appendChild(style);

console.log('🎯 Integrations ready!');