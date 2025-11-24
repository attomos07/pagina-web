// My Agents Page functionality - Table Version

// Inicializar página
document.addEventListener('DOMContentLoaded', function() {
    loadAgents();
    
    // Cerrar dropdown al hacer clic fuera
    document.addEventListener('click', function(e) {
        if (!e.target.closest('.action-btn-menu')) {
            closeAllDropdowns();
        }
    });
});

// Cargar agentes
async function loadAgents() {
    const loading = document.getElementById('loading');
    const emptyState = document.getElementById('emptyState');
    const tableContainer = document.getElementById('agentsTableContainer');
    const tbody = document.getElementById('agentsTableBody');
    
    loading.style.display = 'block';
    emptyState.style.display = 'none';
    tableContainer.style.display = 'none';
    tbody.innerHTML = '';

    try {
        const response = await fetch('/api/agents');
        const data = await response.json();

        loading.style.display = 'none';

        if (!data.agents || data.agents.length === 0) {
            emptyState.style.display = 'block';
            updateStats(0, 0, 0);
            return;
        }

        // Expandir agentes por plataforma
        const agentPlatforms = [];
        data.agents.forEach(agent => {
            const platforms = agent.platforms || ['whatsapp'];
            platforms.forEach(platform => {
                agentPlatforms.push({
                    ...agent,
                    currentPlatform: platform
                });
            });
        });

        const activeCount = data.agents.filter(a => a.deployStatus === 'running').length;
        const totalCount = data.agents.length;
        const platformsCount = countUniquePlatforms(data.agents);
        
        updateStats(activeCount, totalCount, platformsCount);

        agentPlatforms.forEach(agentPlatform => {
            const row = createAgentRow(agentPlatform);
            tbody.appendChild(row);
        });

        tableContainer.style.display = 'block';

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
            platforms.add('whatsapp');
        }
    });
    return platforms.size;
}

// Crear fila de agente
function createAgentRow(agentPlatform) {
    const tr = document.createElement('tr');
    
    const statusClass = agentPlatform.deployStatus === 'running' ? 'status-active' : 
                       agentPlatform.deployStatus === 'deploying' ? 'status-pending' :
                       agentPlatform.deployStatus === 'error' ? 'status-error' : 'status-inactive';
    
    const statusText = agentPlatform.deployStatus === 'running' ? 'Activo' : 
                      agentPlatform.deployStatus === 'deploying' ? 'Desplegando' :
                      agentPlatform.deployStatus === 'error' ? 'Error' : 'Inactivo';
    
    const platformData = getPlatformData(agentPlatform.currentPlatform);
    const dropdownId = `dropdown-${agentPlatform.id}-${agentPlatform.currentPlatform}`;
    
    tr.innerHTML = `
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
                    </svg>
                </div>
                <div class="agent-info-text">
                    <span class="agent-name-text">${agentPlatform.name}</span>
                    <span class="agent-business-type">${agentPlatform.businessType || 'General'}</span>
                </div>
            </div>
        </td>
        <td>
            <div class="platform-cell">
                ${generatePlatformIcon(platformData)}
                <span class="platform-name">${platformData.name}</span>
            </div>
        </td>
        <td>
            <span class="status-badge ${statusClass}">
                <i class="lni lni-circle-fill"></i>
                ${statusText}
            </span>
        </td>
        <td>
            <div class="phone-number">
                <i class="lni lni-phone"></i>
                <span>${agentPlatform.phoneNumber || 'Sin número'}</span>
            </div>
        </td>
        <td>${new Date(agentPlatform.createdAt).toLocaleDateString('es-ES', { 
            year: 'numeric', 
            month: 'short', 
            day: 'numeric' 
        })}</td>
        <td>
            <div class="actions-cell">
                <button class="action-btn action-btn-view" title="Ver detalles">
                    <i class="lni lni-eye"></i>
                </button>
                <div style="position: relative;">
                    <button class="action-btn action-btn-menu" data-dropdown="${dropdownId}" title="Más opciones">
                        <i class="lni lni-more-alt"></i>
                    </button>
                    <div class="dropdown-menu" id="${dropdownId}">
                        <button class="dropdown-item" data-action="edit">
                            <i class="lni lni-pencil"></i>
                            Editar Configuración
                        </button>
                        <button class="dropdown-item" data-action="analytics">
                            <i class="lni lni-bar-chart"></i>
                            Ver Analíticas
                        </button>
                        <button class="dropdown-item" data-action="duplicate">
                            <i class="lni lni-files"></i>
                            Duplicar Configuración
                        </button>
                        <button class="dropdown-item dropdown-item-delete" data-action="delete">
                            <i class="lni lni-trash-can"></i>
                            Eliminar Plataforma
                        </button>
                    </div>
                </div>
            </div>
        </td>
    `;
    
    // Agregar event listeners después de crear el elemento
    const viewBtn = tr.querySelector('.action-btn-view');
    viewBtn.addEventListener('click', () => viewAgent(agentPlatform.id));
    
    const menuBtn = tr.querySelector('.action-btn-menu');
    menuBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const dropdown = document.getElementById(dropdownId);
        closeAllDropdowns();
        if (dropdown) {
            dropdown.classList.add('active');
        }
    });
    
    // Event listeners para las opciones del dropdown
    const editBtn = tr.querySelector('[data-action="edit"]');
    editBtn.addEventListener('click', () => {
        closeAllDropdowns();
        editAgentPlatform(agentPlatform.id, agentPlatform.currentPlatform, agentPlatform.name);
    });
    
    const analyticsBtn = tr.querySelector('[data-action="analytics"]');
    analyticsBtn.addEventListener('click', () => {
        closeAllDropdowns();
        viewAnalytics(agentPlatform.id, agentPlatform.currentPlatform);
    });
    
    const duplicateBtn = tr.querySelector('[data-action="duplicate"]');
    duplicateBtn.addEventListener('click', () => {
        closeAllDropdowns();
        duplicatePlatform(agentPlatform.id, agentPlatform.currentPlatform);
    });
    
    const deleteBtn = tr.querySelector('[data-action="delete"]');
    deleteBtn.addEventListener('click', () => {
        closeAllDropdowns();
        deletePlatform(agentPlatform.id, agentPlatform.currentPlatform, agentPlatform.name);
    });
    
    return tr;
}

// Obtener datos de plataforma
function getPlatformData(platform) {
    const platforms = {
        'whatsapp': { icon: 'lni-whatsapp', color: '#25D366', name: 'WhatsApp' },
        'instagram': { icon: 'lni-instagram', color: '#E4405F', name: 'Instagram' },
        'facebook': { icon: 'lni-facebook-messenger', color: '#0084FF', name: 'Messenger' },
        'telegram': { icon: 'lni-telegram', color: '#0088cc', name: 'Telegram' },
        'wechat': { icon: 'lni-wechat', color: '#09B83E', name: 'WeChat' },
        'kakaotalk': { svg: true, color: '#FFE812', name: 'KakaoTalk' },
        'line': { icon: 'lni-line', color: '#00B900', name: 'Line' }
    };
    
    return platforms[platform.toLowerCase()] || platforms['whatsapp'];
}

// Generar icono de plataforma
function generatePlatformIcon(platformData) {
    if (platformData.svg && platformData.name === 'KakaoTalk') {
        return `
            <div class="platform-icon-wrapper" style="background-color: ${platformData.color}15; border-color: ${platformData.color}40;">
                <div class="kakao-icon">
                    <svg viewBox="0 0 24 24" class="kakao-bubble">
                        <path d="M12 3C6.48 3 2 6.58 2 11c0 2.91 1.88 5.45 4.68 6.94l-1.19 4.37c-.09.34.23.63.55.49l5.11-2.29c.27.02.55.03.85.03 5.52 0 10-3.58 10-8C22 6.58 17.52 3 12 3z"/>
                    </svg>
                    <span class="kakao-text">TALK</span>
                </div>
            </div>
        `;
    }
    
    return `
        <div class="platform-icon-wrapper" style="background-color: ${platformData.color}15; border-color: ${platformData.color}40;">
            <i class="lni ${platformData.icon}" style="color: ${platformData.color};"></i>
        </div>
    `;
}

// Cerrar todos los dropdowns
function closeAllDropdowns() {
    document.querySelectorAll('.dropdown-menu').forEach(menu => {
        menu.classList.remove('active');
    });
}

// Ver agente
function viewAgent(id) {
    window.location.href = `/agents/${id}`;
}

// Editar configuración de plataforma
function editAgentPlatform(agentId, platform, agentName) {
    closeAllDropdowns();
    
    const modal = document.createElement('div');
    modal.className = 'edit-modal';
    modal.innerHTML = `
        <div class="edit-modal-overlay" onclick="closeEditModal()"></div>
        <div class="edit-modal-content">
            <div class="edit-modal-header">
                <h3>Editar ${getPlatformData(platform).name}</h3>
                <button class="edit-modal-close" onclick="closeEditModal()">
                    <i class="lni lni-close"></i>
                </button>
            </div>
            <form class="edit-form" onsubmit="saveAgentPlatformConfig(event, '${agentId}', '${platform}')">
                <div class="form-group">
                    <label class="form-label">Nombre del Agente</label>
                    <input type="text" class="form-input" value="${agentName}" disabled>
                </div>
                <div class="form-group">
                    <label class="form-label">Mensaje de Bienvenida</label>
                    <textarea class="form-textarea" name="welcomeMessage" placeholder="Escribe el mensaje de bienvenida..."></textarea>
                </div>
                <div class="form-group">
                    <label class="form-label">Número de Contacto</label>
                    <input type="text" class="form-input" name="phoneNumber" placeholder="+52 123 456 7890">
                </div>
                <div class="form-group">
                    <label class="form-label">Horario de Atención</label>
                    <input type="text" class="form-input" name="schedule" placeholder="Lun-Vie 9:00-18:00">
                </div>
                <div class="form-actions">
                    <button type="button" class="form-btn form-btn-cancel" onclick="closeEditModal()">
                        <i class="lni lni-close"></i>
                        Cancelar
                    </button>
                    <button type="submit" class="form-btn form-btn-save">
                        <i class="lni lni-checkmark"></i>
                        Guardar Cambios
                    </button>
                </div>
            </form>
        </div>
    `;
    document.body.appendChild(modal);
    setTimeout(() => modal.classList.add('active'), 10);
}

// Cerrar modal de edición
function closeEditModal() {
    const modal = document.querySelector('.edit-modal');
    if (modal) {
        modal.classList.remove('active');
        setTimeout(() => modal.remove(), 300);
    }
}

// Guardar configuración
async function saveAgentPlatformConfig(event, agentId, platform) {
    event.preventDefault();
    
    const formData = new FormData(event.target);
    const config = {
        platform: platform,
        welcomeMessage: formData.get('welcomeMessage'),
        phoneNumber: formData.get('phoneNumber'),
        schedule: formData.get('schedule')
    };
    
    try {
        const response = await fetch(`/api/agents/${agentId}/platforms/${platform}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(config)
        });
        
        if (response.ok) {
            closeEditModal();
            showNotification('Configuración actualizada exitosamente', 'success');
            loadAgents();
        } else {
            showNotification('Error al actualizar la configuración', 'error');
        }
    } catch (error) {
        console.error('Error updating config:', error);
        showNotification('Error al actualizar la configuración', 'error');
    }
}

// Ver analíticas
function viewAnalytics(agentId, platform) {
    closeAllDropdowns();
    showNotification(`Analíticas de ${getPlatformData(platform).name} próximamente`, 'info');
}

// Duplicar plataforma
function duplicatePlatform(agentId, platform) {
    closeAllDropdowns();
    showNotification(`Función de duplicar próximamente`, 'info');
}

// Eliminar plataforma
function deletePlatform(agentId, platform, agentName) {
    closeAllDropdowns();
    
    const modal = document.createElement('div');
    modal.className = 'delete-modal';
    modal.innerHTML = `
        <div class="delete-modal-overlay" onclick="closeDeleteModal()"></div>
        <div class="delete-modal-content">
            <div class="delete-modal-header">
                <div class="delete-modal-icon">
                    <i class="lni lni-warning"></i>
                </div>
                <h3>¿Eliminar Plataforma?</h3>
            </div>
            <p class="delete-modal-description">
                ¿Estás seguro de que deseas eliminar <span class="delete-modal-agent-name">${getPlatformData(platform).name}</span> 
                de <span class="delete-modal-agent-name">"${agentName}"</span>? 
                Esta acción no se puede deshacer.
            </p>
            <div class="delete-modal-actions">
                <button class="delete-modal-btn delete-modal-btn-cancel" onclick="closeDeleteModal()">
                    <i class="lni lni-close"></i>
                    Cancelar
                </button>
                <button class="delete-modal-btn delete-modal-btn-confirm" onclick="confirmDeletePlatform('${agentId}', '${platform}')">
                    <i class="lni lni-trash-can"></i>
                    Eliminar
                </button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    setTimeout(() => modal.classList.add('active'), 10);
}

// Cerrar modal de eliminación
function closeDeleteModal() {
    const modal = document.querySelector('.delete-modal');
    if (modal) {
        modal.classList.remove('active');
        setTimeout(() => modal.remove(), 300);
    }
}

// Confirmar eliminación
async function confirmDeletePlatform(agentId, platform) {
    try {
        const response = await fetch(`/api/agents/${agentId}/platforms/${platform}`, {
            method: 'DELETE'
        });
        
        if (response.ok) {
            closeDeleteModal();
            showNotification('Plataforma eliminada exitosamente', 'success');
            loadAgents();
        } else {
            showNotification('Error al eliminar la plataforma', 'error');
        }
    } catch (error) {
        console.error('Error deleting platform:', error);
        showNotification('Error al eliminar la plataforma', 'error');
    }
}

// Mostrar notificación
function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.innerHTML = `
        <i class="lni lni-${type === 'success' ? 'checkmark-circle' : type === 'error' ? 'warning' : 'information'}"></i>
        <span>${message}</span>
    `;
    document.body.appendChild(notification);
    setTimeout(() => notification.classList.add('active'), 10);
    setTimeout(() => {
        notification.classList.remove('active');
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}