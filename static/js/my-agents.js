// My Agents Page functionality

let agents = [];

// Inicializar página
document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 My Agents JS cargado');
    loadAgents();
    initializeDropdowns();
});

// Cargar agentes desde el backend
async function loadAgents() {
    try {
        const response = await fetch('/api/agents', {
            credentials: 'include'
        });

        if (!response.ok) {
            throw new Error('Error al cargar agentes');
        }

        const data = await response.json();
        agents = data.agents || [];
        
        console.log('📊 Agentes cargados:', agents);
        
        updateStats(agents);
        renderAgentsTable(agents);
    } catch (error) {
        console.error('❌ Error:', error);
        showEmptyState();
    }
}

// Actualizar estadísticas
function updateStats(agents) {
    const activeCount = agents.filter(a => a.isActive && a.deployStatus === 'running').length;
    const totalCount = agents.length;
    const platformsCount = totalCount > 0 ? 1 : 0;
    
    document.getElementById('activeAgentsCount').textContent = activeCount;
    document.getElementById('totalAgentsCount').textContent = totalCount;
    document.getElementById('platformsCount').textContent = platformsCount;
}

// Renderizar tabla de agentes
function renderAgentsTable(agents) {
    const emptyState = document.getElementById('emptyState');
    const tableContainer = document.getElementById('agentsTableContainer');
    
    if (agents.length === 0) {
        if (emptyState) emptyState.style.display = 'block';
        if (tableContainer) tableContainer.style.display = 'none';
        return;
    }
    
    if (emptyState) emptyState.style.display = 'none';
    if (tableContainer) tableContainer.style.display = 'block';
    
    const tbody = document.getElementById('agentsTableBody');
    if (!tbody) {
        console.error('❌ No se encontró tbody con id="agentsTableBody"');
        return;
    }
    
    const rows = agents.map(agent => createAgentRow(agent));
    tbody.innerHTML = rows.join('');
    
    console.log('✅ Tabla renderizada con', agents.length, 'agentes');
}

// Crear fila de agente
function createAgentRow(agent) {
    const phone = agent.phoneNumber || 'Sin número';
    const statusBadge = getStatusBadge(agent);
    
    return `<tr data-agent-id="${agent.id}">
    <td>
        <div class="agent-name-cell">
            <div class="agent-avatar">
                <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <line x1="24" y1="6" x2="24" y2="10" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                    <circle cx="24" cy="5" r="1.5" fill="currentColor"/>
                    <rect x="14" y="10" width="20" height="16" rx="4" stroke="currentColor" stroke-width="2" fill="none"/>
                    <circle cx="19" cy="16" r="2" fill="currentColor"/>
                    <circle cx="29" cy="16" r="2" fill="currentColor"/>
                    <path d="M 18 21 Q 24 23 30 21" stroke="currentColor" stroke-width="2" stroke-linecap="round" fill="none"/>
                    <rect x="16" y="26" width="16" height="12" rx="3" stroke="currentColor" stroke-width="2" fill="none"/>
                    <circle cx="24" cy="31" r="2" stroke="currentColor" stroke-width="1.5" fill="none"/>
                    <circle cx="24" cy="31" r="0.8" fill="currentColor"/>
                    <rect x="10" y="28" width="4" height="8" rx="2" stroke="currentColor" stroke-width="2" fill="none"/>
                    <rect x="34" y="28" width="4" height="8" rx="2" stroke="currentColor" stroke-width="2" fill="none"/>
                    <rect x="18" y="38" width="4" height="4" rx="1.5" stroke="currentColor" stroke-width="2" fill="none"/>
                    <rect x="26" y="38" width="4" height="4" rx="1.5" stroke="currentColor" stroke-width="2" fill="none"/>
                </svg>
            </div>
            <div class="agent-info">
                <div class="agent-name">${escapeHtml(agent.name)}</div>
                <div class="agent-id">ID: ${agent.id}</div>
            </div>
        </div>
    </td>
    <td>
        <div class="platform-badge">
            <i class="lni lni-whatsapp"></i>
            <span>WhatsApp</span>
        </div>
    </td>
    <td>
        <div class="phone-number">
            <i class="lni lni-phone"></i>
            <span>${escapeHtml(phone)}</span>
        </div>
    </td>
    <td>${statusBadge}</td>
    <td class="actions-cell">
        <div class="actions-menu">
            <button class="actions-trigger" onclick="toggleDropdown(event, ${agent.id})">
                <i class="lni lni-more-alt"></i>
            </button>
            <div class="actions-dropdown" id="dropdown-${agent.id}">
                <button class="dropdown-item view" onclick="viewAgentDetails(${agent.id})">
                    <i class="lni lni-eye"></i>
                    <span>Ver Detalles</span>
                </button>
                <button class="dropdown-item pause" onclick="toggleAgentStatus(${agent.id}, ${agent.isActive})">
                    <i class="lni lni-${agent.isActive ? 'pause' : 'play'}"></i>
                    <span>${agent.isActive ? 'Pausar' : 'Activar'}</span>
                </button>
                <button class="dropdown-item delete" onclick="confirmDeleteAgent(${agent.id})">
                    <i class="lni lni-trash-can"></i>
                    <span>Eliminar</span>
                </button>
            </div>
        </div>
    </td>
</tr>`;
}

// Obtener badge de estado
function getStatusBadge(agent) {
    if (agent.deployStatus === 'running' && agent.isActive) {
        return `<div class="status-badge active">
                <span class="status-dot"></span>
                <span>Activo</span>
            </div>`;
    } else if (agent.deployStatus === 'pending' || agent.deployStatus === 'deploying') {
        return `<div class="status-badge pending">
                <span class="status-dot"></span>
                <span>Desplegando</span>
            </div>`;
    } else if (agent.deployStatus === 'error') {
        return `<div class="status-badge inactive">
                <span class="status-dot"></span>
                <span>Error</span>
            </div>`;
    } else {
        return `<div class="status-badge inactive">
                <span class="status-dot"></span>
                <span>Inactivo</span>
            </div>`;
    }
}

// Toggle dropdown con animación smooth
function toggleDropdown(event, agentId) {
    event.stopPropagation();
    
    const dropdown = document.getElementById(`dropdown-${agentId}`);
    if (!dropdown) return;
    
    const allDropdowns = document.querySelectorAll('.actions-dropdown');
    
    // Cerrar todos los otros dropdowns
    allDropdowns.forEach(d => {
        if (d !== dropdown && d.classList.contains('show')) {
            d.classList.remove('show');
        }
    });
    
    // Toggle el dropdown actual
    dropdown.classList.toggle('show');
}

// Inicializar event listeners para dropdowns
function initializeDropdowns() {
    // Cerrar dropdowns al hacer click fuera
    document.addEventListener('click', function(event) {
        if (!event.target.closest('.actions-menu')) {
            const allDropdowns = document.querySelectorAll('.actions-dropdown');
            allDropdowns.forEach(d => d.classList.remove('show'));
        }
    });
    
    console.log('✅ Dropdowns inicializados');
}

// Ver detalles del agente
function viewAgentDetails(agentId) {
    console.log('👁️ Ver detalles del agente:', agentId);
    window.location.href = `/agents/${agentId}`;
}

// Toggle status del agente
async function toggleAgentStatus(agentId, currentStatus) {
    try {
        const action = currentStatus ? 'pausar' : 'activar';
        
        if (!confirm(`¿Estás seguro de que deseas ${action} este agente?`)) {
            return;
        }
        
        const response = await fetch(`/api/agents/${agentId}/toggle`, {
            method: 'PATCH',
            credentials: 'include'
        });
        
        if (!response.ok) {
            throw new Error('Error al cambiar estado del agente');
        }
        
        await loadAgents();
        alert(`Agente ${action === 'pausar' ? 'pausado' : 'activado'} exitosamente`);
    } catch (error) {
        console.error('❌ Error:', error);
        alert('Error al cambiar el estado del agente. Por favor intenta de nuevo.');
    }
}

// Confirmar eliminación de agente
function confirmDeleteAgent(agentId) {
    const agent = agents.find(a => a.id === agentId);
    if (!agent) return;
    
    const confirmed = confirm(
        `¿Estás seguro de que deseas eliminar el agente "${agent.name}"?\n\n` +
        `Esta acción no se puede deshacer y eliminará:\n` +
        `• El bot de WhatsApp\n` +
        `• Todas las configuraciones\n` +
        `• El historial de conversaciones`
    );
    
    if (confirmed) {
        deleteAgent(agentId);
    }
}

// Eliminar agente
async function deleteAgent(agentId) {
    try {
        const response = await fetch(`/api/agents/${agentId}`, {
            method: 'DELETE',
            credentials: 'include'
        });
        
        if (!response.ok) {
            throw new Error('Error al eliminar agente');
        }
        
        await loadAgents();
        alert('Agente eliminado exitosamente');
    } catch (error) {
        console.error('❌ Error:', error);
        alert('Error al eliminar el agente. Por favor intenta de nuevo.');
    }
}

// Mostrar estado vacío
function showEmptyState() {
    const emptyState = document.getElementById('emptyState');
    const tableContainer = document.getElementById('agentsTableContainer');
    
    if (emptyState) emptyState.style.display = 'block';
    if (tableContainer) tableContainer.style.display = 'none';
    
    updateStats([]);
}

// Escape HTML para prevenir XSS
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

// Recargar agentes cada 30 segundos
setInterval(async () => {
    const currentlyOpen = document.querySelector('.actions-dropdown.show');
    if (!currentlyOpen) {
        await loadAgents();
    }
}, 30000);