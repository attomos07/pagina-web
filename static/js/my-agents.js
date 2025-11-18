// My Agents Page functionality

// Inicializar página
document.addEventListener('DOMContentLoaded', function() {
    loadAgents();
});

// Cargar agentes
async function loadAgents() {
    const loading = document.getElementById('loading');
    const emptyState = document.getElementById('emptyState');
    const grid = document.getElementById('agentsGrid');
    
    loading.style.display = 'block';
    emptyState.style.display = 'none';
    grid.innerHTML = '';

    try {
        const response = await fetch('/api/agents');
        const data = await response.json();

        loading.style.display = 'none';

        if (!data.agents || data.agents.length === 0) {
            emptyState.style.display = 'block';
            updateStats(0, 0, 0);
            return;
        }

        const activeCount = data.agents.filter(a => a.deployStatus === 'running').length;
        const totalCount = data.agents.length;
        const platformsCount = countUniquePlatforms(data.agents);
        
        updateStats(activeCount, totalCount, platformsCount);

        data.agents.forEach(agent => {
            const card = createAgentCard(agent);
            grid.appendChild(card);
        });

    } catch (error) {
        console.error('Error loading agents:', error);
        loading.style.display = 'none';
        emptyState.style.display = 'block';
        updateStats(0, 0, 0);
    }
}

// Actualizar estadísticas
function updateStats(active, total, platforms) {
    document.getElementById('activeAgentsCount').textContent = active;
    document.getElementById('totalAgentsCount').textContent = total;
    document.getElementById('platformsCount').textContent = platforms;
}

// Contar plataformas únicas
function countUniquePlatforms(agents) {
    const platforms = new Set();
    agents.forEach(agent => {
        if (agent.platforms) {
            agent.platforms.forEach(p => platforms.add(p));
        } else {
            platforms.add('whatsapp'); // Default
        }
    });
    return platforms.size;
}

// Crear tarjeta de agente
function createAgentCard(agent) {
    const card = document.createElement('div');
    card.className = 'agent-card';
    
    const statusClass = agent.deployStatus === 'running' ? 'status-active' : 
                       agent.deployStatus === 'deploying' ? 'status-pending' :
                       agent.deployStatus === 'error' ? 'status-error' : 'status-inactive';
    
    const statusText = agent.deployStatus === 'running' ? 'Activo' : 
                      agent.deployStatus === 'deploying' ? 'Desplegando' :
                      agent.deployStatus === 'error' ? 'Error' : 'Inactivo';
    
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
            <button class="agent-btn agent-btn-delete" onclick="deleteAgent('${agent.id}', '${agent.name}')">
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

async function deleteAgent(id, name) {
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
                ¿Estás seguro de que deseas eliminar <span class="delete-modal-agent-name">"${name}"</span>? 
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