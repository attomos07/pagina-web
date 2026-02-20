// My Agents Page functionality

let agents = [];

// Inicializar página
document.addEventListener('DOMContentLoaded', function () {
    console.log('🚀 My Agents JS cargado');
    loadAgents();
    initializeDropdowns();
    initializeCreateAgentButton();
});

// Inicializar botón de crear agente
function initializeCreateAgentButton() {
    const createBtn = document.querySelector('.btn-primary[href="/onboarding"]');
    if (createBtn) {
        createBtn.addEventListener('click', function (e) {
            e.preventDefault();
            openOnboardingModal();
        });
    }
}

// Abrir modal de onboarding
function openOnboardingModal() {
    // Crear modal si no existe
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

    // Mostrar modal
    modal.classList.add('active');

    // Cargar contenido del onboarding
    loadOnboardingContent();
}

// Cerrar modal de onboarding
function closeOnboardingModal() {
    const modal = document.getElementById('onboardingModal');
    if (modal) {
        modal.classList.remove('active');
        // Recargar agentes al cerrar
        setTimeout(() => {
            loadAgents();
        }, 300);
    }
}

// Cargar contenido del onboarding
async function loadOnboardingContent() {
    const modalBody = document.getElementById('onboardingModalBody');
    if (!modalBody) return;

    try {
        const response = await fetch('/onboarding');
        if (!response.ok) throw new Error('Error al cargar onboarding');

        const html = await response.text();

        // Extraer solo el contenido principal del onboarding
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        const mainContainer = doc.querySelector('.main-container');

        if (mainContainer) {
            modalBody.innerHTML = mainContainer.innerHTML;

            // Cargar el script de onboarding
            const script = document.createElement('script');
            script.src = '/static/js/onboarding.js';
            script.onload = function () {
                console.log('✅ Script de onboarding cargado');

                // Reinicializar eventos después de cargar el script
                setTimeout(() => {
                    reinitializeOnboardingEvents();
                }, 100);
            };
            document.body.appendChild(script);
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

// Reinicializar eventos del onboarding en el modal
function reinitializeOnboardingEvents() {
    console.log('🔄 Reinicializando eventos del onboarding en modal');

    // Reinicializar selección de red social
    const socialInputs = document.querySelectorAll('input[name="social"]');
    const btnStep1 = document.getElementById('btnStep1');

    if (socialInputs.length > 0 && btnStep1) {
        // Limpiar eventos anteriores
        const newBtnStep1 = btnStep1.cloneNode(true);
        btnStep1.parentNode.replaceChild(newBtnStep1, btnStep1);

        socialInputs.forEach(input => {
            input.addEventListener('change', function () {
                console.log('✅ Red social seleccionada:', this.value);
                newBtnStep1.disabled = false;
            });
        });

        // Evento para el botón de continuar
        newBtnStep1.addEventListener('click', function () {
            console.log('🔘 Botón Continuar clickeado');

            // Obtener red social seleccionada
            const selectedSocial = document.querySelector('input[name="social"]:checked');
            if (!selectedSocial) {
                alert('Por favor selecciona una red social');
                return;
            }

            console.log('📱 Red social confirmada:', selectedSocial.value);

            // Llamar a la función nextStep del onboarding si existe
            if (typeof window.onboardingNextStep === 'function') {
                window.onboardingNextStep();
            } else {
                // Si no existe, simular el cambio de paso manualmente
                document.getElementById('step1').classList.remove('active');
                document.getElementById('step2').classList.add('active');

                // Actualizar barra de progreso
                updateModalProgressBar(2);

                console.log('✅ Paso cambiado a Step 2');
            }
        });

        console.log('✅ Event listeners de red social añadidos');
    }
}

// Función para actualizar la barra de progreso en el modal
function updateModalProgressBar(currentStep) {
    const progressSteps = document.querySelectorAll('.progress-step');
    const progressPercentage = document.getElementById('progressPercentage');
    const totalSteps = 3;
    const totalCircles = progressSteps.length;

    const circlesPerStep = totalCircles / totalSteps;
    const targetCircles = Math.ceil((currentStep - 1) * circlesPerStep) + 1;

    progressSteps.forEach((step, index) => {
        step.classList.remove('active', 'completed', 'cascading');

        if (index < targetCircles - 1) {
            step.classList.add('completed');
        } else if (index === targetCircles - 1) {
            step.classList.add('active');
        }
    });

    const previousCircles = Math.ceil(((currentStep - 2) * circlesPerStep)) + 1;
    const startCascade = Math.max(0, previousCircles);

    for (let i = startCascade; i < targetCircles; i++) {
        setTimeout(() => {
            if (progressSteps[i]) {
                progressSteps[i].classList.add('cascading');
                setTimeout(() => {
                    progressSteps[i].classList.remove('cascading');
                    if (i < targetCircles - 1) {
                        progressSteps[i].classList.add('completed');
                    } else {
                        progressSteps[i].classList.add('active');
                    }
                }, 600);
            }
        }, i * 80);
    }

    if (progressPercentage) {
        const targetProgress = ((currentStep - 1) / 2) * 100;
        const currentProgress = parseInt(progressPercentage.textContent) || 0;
        animatePercentage(currentProgress, targetProgress, progressPercentage);
    }
}

function animatePercentage(start, end, element) {
    const duration = 600;
    const startTime = performance.now();

    function update(currentTime) {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);

        const easeOutCubic = 1 - Math.pow(1 - progress, 3);
        const current = Math.round(start + (end - start) * easeOutCubic);

        element.textContent = current + '%';

        if (progress < 1) {
            requestAnimationFrame(update);
        }
    }

    requestAnimationFrame(update);
}

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
            <div class="agent-robot-icon">
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
            <span class="agent-name">${escapeHtml(agent.name)}</span>
        </div>
    </td>
    <td>
        <span class="agent-id-badge">#${agent.id}</span>
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
    document.addEventListener('click', function (event) {
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

// Toggle status del agente - CON MODAL
async function toggleAgentStatus(agentId, currentStatus) {
    const agent = agents.find(a => a.id === agentId);
    if (!agent) return;

    const action = currentStatus ? 'pausar' : 'activar';
    const actionTitle = currentStatus ? 'Pausar' : 'Activar';

    showConfirmModal({
        type: 'warning',
        icon: currentStatus ? 'lni-pause' : 'lni-play',
        title: `¿${actionTitle} Agente?`,
        message: `Estás a punto de ${action} el agente "<strong>${escapeHtml(agent.name)}</strong>"`,
        list: currentStatus ? [
            'El agente dejará de responder mensajes',
            'Los clientes no recibirán atención automática',
            'Puedes reactivarlo cuando quieras'
        ] : [
            'El agente volverá a responder mensajes',
            'Se reanudará la atención automática',
            'Los clientes podrán interactuar nuevamente'
        ],
        confirmText: `${actionTitle} Agente`,
        confirmClass: 'warning',
        onConfirm: async () => {
            try {
                const response = await fetch(`/api/agents/${agentId}/toggle`, {
                    method: 'PATCH',
                    credentials: 'include'
                });

                if (!response.ok) {
                    throw new Error('Error al cambiar estado del agente');
                }

                await loadAgents();
                showNotification(`✅ Agente ${action === 'pausar' ? 'pausado' : 'activado'} exitosamente`, 'success');
            } catch (error) {
                console.error('❌ Error:', error);
                showNotification('❌ Error al cambiar el estado del agente', 'error');
            }
        }
    });
}

// Confirmar eliminación de agente - CON MODAL
function confirmDeleteAgent(agentId) {
    const agent = agents.find(a => a.id === agentId);
    if (!agent) return;

    showConfirmModal({
        type: 'danger',
        icon: 'lni-trash-can',
        title: '¿Eliminar Agente?',
        message: `Estás a punto de eliminar el agente "<strong>${escapeHtml(agent.name)}</strong>"`,
        list: [
            'El bot de WhatsApp',
            'Todas las configuraciones',
            'El historial de conversaciones'
        ],
        confirmText: 'Eliminar Agente',
        confirmClass: 'danger',
        onConfirm: () => deleteAgent(agentId)
    });
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
        showNotification('✅ Agente eliminado exitosamente', 'success');
    } catch (error) {
        console.error('❌ Error:', error);
        showNotification('❌ Error al eliminar el agente', 'error');
    }
}

// Mostrar modal de confirmación
function showConfirmModal(options) {
    const {
        type = 'warning',
        icon = 'lni-warning',
        title = '¿Estás seguro?',
        message = '',
        list = [],
        confirmText = 'Confirmar',
        confirmClass = 'danger',
        onConfirm = () => { }
    } = options;

    // Crear modal si no existe
    let modal = document.getElementById('confirmModal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'confirmModal';
        modal.className = 'confirm-modal';
        document.body.appendChild(modal);
    }

    // Renderizar contenido
    modal.innerHTML = `
        <div class="confirm-overlay" onclick="closeConfirmModal()"></div>
        <div class="confirm-content">
            <div class="confirm-header">
                <div class="confirm-icon ${type}">
                    <i class="lni ${icon}"></i>
                </div>
                <h3 class="confirm-title">${title}</h3>
                <p class="confirm-message">${message}</p>
            </div>
            <div class="confirm-body">
                ${list.length > 0 ? `
                    <div class="confirm-list">
                        ${list.map(item => `
                            <div class="confirm-list-item">
                                <i class="lni lni-close"></i>
                                <span>${item}</span>
                            </div>
                        `).join('')}
                    </div>
                ` : ''}
                <div class="confirm-actions">
                    <button class="btn-confirm-cancel" onclick="closeConfirmModal()">
                        <i class="lni lni-close"></i>
                        <span>Cancelar</span>
                    </button>
                    <button class="btn-confirm-action ${confirmClass}" id="confirmActionBtn">
                        <i class="lni lni-checkmark"></i>
                        <span>${confirmText}</span>
                    </button>
                </div>
            </div>
        </div>
    `;

    // Mostrar modal
    modal.classList.add('active');

    // Event listener para confirmar
    document.getElementById('confirmActionBtn').addEventListener('click', async function () {
        // Mostrar loading
        this.innerHTML = `
            <div class="loading-spinner-small"></div>
            <span>Procesando...</span>
        `;
        this.disabled = true;

        try {
            await onConfirm();
            closeConfirmModal();
        } catch (error) {
            console.error('Error en confirmación:', error);
            this.disabled = false;
            this.innerHTML = `
                <i class="lni lni-checkmark"></i>
                <span>${confirmText}</span>
            `;
        }
    });
}

// Cerrar modal de confirmación
function closeConfirmModal() {
    const modal = document.getElementById('confirmModal');
    if (modal) {
        modal.classList.remove('active');
        setTimeout(() => modal.remove(), 300);
    }
}

// Mostrar notificación
function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        top: 2rem;
        right: 2rem;
        background: ${type === 'success' ? '#10b981' : type === 'error' ? '#ef4444' : '#06b6d4'};
        color: white;
        padding: 1rem 1.5rem;
        border-radius: 12px;
        box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2);
        z-index: 10000;
        display: flex;
        align-items: center;
        gap: 0.75rem;
        font-weight: 600;
        animation: slideIn 0.3s ease;
    `;

    notification.innerHTML = `
        <i class="lni lni-${type === 'success' ? 'checkmark-circle' : type === 'error' ? 'warning' : 'information'}"></i>
        <span>${message}</span>
    `;

    document.body.appendChild(notification);

    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

// Mostrar estado vacío
function showEmptyState() {
    const emptyState = document.getElementById('emptyState');
    const tableContainer = document.getElementById('agentsTableContainer');

    if (emptyState) emptyState.style.display = 'block';
    if (tableContainer) tableContainer.style.display = 'none';

    updateStats([]);

    // También interceptar el botón del empty state
    const emptyStateBtn = emptyState.querySelector('.btn-primary');
    if (emptyStateBtn) {
        emptyStateBtn.addEventListener('click', function (e) {
            e.preventDefault();
            openOnboardingModal();
        });
    }
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
    const onboardingOpen = document.querySelector('.onboarding-modal.active');
    if (!currentlyOpen && !onboardingOpen) {
        await loadAgents();
    }
}, 30000);

// Hacer la función global para que sea accesible
window.reinitializeOnboardingEvents = reinitializeOnboardingEvents;

// CSS para animaciones y spinner
const style = document.createElement('style');
style.textContent = `
    .loading-spinner-small {
        width: 16px;
        height: 16px;
        border: 2px solid rgba(255, 255, 255, 0.3);
        border-top: 2px solid white;
        border-radius: 50%;
        animation: spin 1s linear infinite;
    }
    
    @keyframes slideIn {
        from { transform: translateX(400px); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
    }
    
    @keyframes slideOut {
        from { transform: translateX(0); opacity: 1; }
        to { transform: translateX(400px); opacity: 0; }
    }
`;
document.head.appendChild(style);