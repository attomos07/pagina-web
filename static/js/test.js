// ============================================
// STATE
// ============================================
let currentAgentId = null;
let integrationStatus = null;

// ============================================
// INITIALIZE
// ============================================
document.addEventListener('DOMContentLoaded', function() {
    loadAgents();
    setDefaultDateTimes();
    
    // Form submit handler
    document.getElementById('appointmentForm').addEventListener('submit', function(e) {
        e.preventDefault();
        createAppointment();
    });

    // Agent select change handler
    document.getElementById('agentSelect').addEventListener('change', function() {
        currentAgentId = this.value;
        if (currentAgentId) {
            loadIntegrationStatus();
        }
    });

    // Check for success/error in URL
    checkURLParams();
});

// ============================================
// LOAD AGENTS
// ============================================
async function loadAgents() {
    try {
        const response = await fetch('/api/agents', {
            credentials: 'include'
        });

        if (!response.ok) {
            throw new Error('Error cargando agentes');
        }

        const data = await response.json();
        const select = document.getElementById('agentSelect');
        
        select.innerHTML = '<option value="">Selecciona un agente...</option>';
        
        if (data.agents && data.agents.length > 0) {
            data.agents.forEach(agent => {
                const option = document.createElement('option');
                option.value = agent.id;
                option.textContent = `${agent.name} (ID: ${agent.id})`;
                select.appendChild(option);
            });

            // Auto-select first agent
            select.value = data.agents[0].id;
            currentAgentId = data.agents[0].id;
            loadIntegrationStatus();
        } else {
            select.innerHTML = '<option value="">No hay agentes disponibles</option>';
            showAlert('No tienes agentes creados. Crea un agente primero.', 'error');
        }
    } catch (error) {
        console.error('Error:', error);
        showAlert('Error cargando agentes: ' + error.message, 'error');
    }
}

// ============================================
// LOAD INTEGRATION STATUS
// ============================================
async function loadIntegrationStatus() {
    if (!currentAgentId) {
        showAlert('Por favor selecciona un agente', 'error');
        return;
    }

    const statusBox = document.getElementById('statusBox');
    const loadBtn = document.getElementById('loadStatusBtn');

    statusBox.className = 'status-box loading';
    statusBox.innerHTML = '<i class="lni lni-spinner status-icon"></i> Cargando estado...';
    loadBtn.disabled = true;

    try {
        const response = await fetch(`/api/google/status/${currentAgentId}`, {
            credentials: 'include'
        });

        if (!response.ok) {
            throw new Error('Error cargando estado');
        }

        const data = await response.json();
        integrationStatus = data;
        
        updateStatusDisplay(data);
        
    } catch (error) {
        console.error('Error:', error);
        statusBox.className = 'status-box disconnected';
        statusBox.innerHTML = '<i class="lni lni-cross-circle status-icon"></i> Error cargando estado: ' + error.message;
        showAlert('Error: ' + error.message, 'error');
    } finally {
        loadBtn.disabled = false;
    }
}

// ============================================
// UPDATE STATUS DISPLAY
// ============================================
function updateStatusDisplay(data) {
    const statusBox = document.getElementById('statusBox');
    const connectionInfo = document.getElementById('connectionInfo');
    const connectBtn = document.getElementById('connectBtn');
    const disconnectBtn = document.getElementById('disconnectBtn');
    const createAppointmentBtn = document.getElementById('createAppointmentBtn');

    if (data.connected) {
        // CONECTADO
        statusBox.className = 'status-box connected';
        statusBox.innerHTML = `
            <i class="lni lni-checkmark-circle status-icon"></i>
            <strong>Google Conectado</strong><br>
            <small>Calendar y Sheets configurados automáticamente</small>
        `;

        connectionInfo.style.display = 'block';
        document.getElementById('calendarIdDisplay').textContent = data.calendar_id || 'N/A';
        document.getElementById('sheetIdDisplay').textContent = data.sheet_id || 'N/A';
        
        if (data.connected_at) {
            const date = new Date(data.connected_at);
            document.getElementById('connectedAtDisplay').textContent = date.toLocaleString();
        }

        if (data.calendar_url) {
            const calendarLink = document.getElementById('calendarLink');
            calendarLink.href = data.calendar_url;
        }

        if (data.sheet_url) {
            const sheetLink = document.getElementById('sheetLink');
            sheetLink.href = data.sheet_url;
        }

        connectBtn.style.display = 'none';
        disconnectBtn.style.display = 'inline-flex';
        createAppointmentBtn.disabled = false;

    } else {
        // NO CONECTADO
        statusBox.className = 'status-box disconnected';
        statusBox.innerHTML = `
            <i class="lni lni-unlink status-icon"></i>
            <strong>No Conectado</strong><br>
            <small>Conecta Google Calendar y Sheets para usar esta funcionalidad</small>
        `;

        connectionInfo.style.display = 'none';
        connectBtn.style.display = 'inline-flex';
        disconnectBtn.style.display = 'none';
        createAppointmentBtn.disabled = true;
    }
}

// ============================================
// CONNECT GOOGLE
// ============================================
async function connectGoogle() {
    if (!currentAgentId) {
        showAlert('Por favor selecciona un agente', 'error');
        return;
    }

    const connectBtn = document.getElementById('connectBtn');
    connectBtn.disabled = true;
    connectBtn.innerHTML = '<span class="spinner"></span> Conectando...';

    try {
        const response = await fetch(`/api/google/connect?agent_id=${currentAgentId}`, {
            credentials: 'include'
        });

        if (!response.ok) {
            throw new Error('Error iniciando conexión');
        }

        const data = await response.json();

        if (data.auth_url) {
            // Redirigir a Google OAuth
            showAlert('Redirigiendo a Google para autorizar...', 'success');
            setTimeout(() => {
                window.location.href = data.auth_url;
            }, 1000);
        } else {
            throw new Error('No se recibió URL de autorización');
        }

    } catch (error) {
        console.error('Error:', error);
        showAlert('Error conectando: ' + error.message, 'error');
        connectBtn.disabled = false;
        connectBtn.innerHTML = '<i class="lni lni-link"></i> Conectar Google';
    }
}

// ============================================
// DISCONNECT GOOGLE
// ============================================
async function disconnectGoogle() {
    if (!currentAgentId) {
        showAlert('Por favor selecciona un agente', 'error');
        return;
    }

    if (!confirm('¿Estás seguro de desconectar Google Calendar y Sheets? Se perderán las referencias pero los datos permanecerán en Google.')) {
        return;
    }

    const disconnectBtn = document.getElementById('disconnectBtn');
    disconnectBtn.disabled = true;
    disconnectBtn.innerHTML = '<span class="spinner"></span> Desconectando...';

    try {
        const response = await fetch(`/api/google/disconnect/${currentAgentId}`, {
            method: 'POST',
            credentials: 'include'
        });

        if (!response.ok) {
            throw new Error('Error desconectando');
        }

        showAlert('Google desconectado exitosamente', 'success');
        loadIntegrationStatus();

    } catch (error) {
        console.error('Error:', error);
        showAlert('Error: ' + error.message, 'error');
        disconnectBtn.disabled = false;
        disconnectBtn.innerHTML = '<i class="lni lni-unlink"></i> Desconectar Google';
    }
}

// ============================================
// CREATE APPOINTMENT
// ============================================
async function createAppointment() {
    if (!currentAgentId) {
        showAlert('Por favor selecciona un agente', 'error');
        return;
    }

    const title = document.getElementById('appointmentTitle').value;
    const description = document.getElementById('appointmentDescription').value;
    const startTime = document.getElementById('appointmentStart').value;
    const endTime = document.getElementById('appointmentEnd').value;
    const clientName = document.getElementById('clientName').value;
    const clientEmail = document.getElementById('clientEmail').value;
    const clientPhone = document.getElementById('clientPhone').value;

    if (!title || !startTime || !endTime || !clientName) {
        showAlert('Por favor completa los campos requeridos', 'error');
        return;
    }

    const createBtn = document.getElementById('createAppointmentBtn');
    createBtn.disabled = true;
    createBtn.innerHTML = '<span class="spinner"></span> Creando...';

    const payload = {
        agent_id: parseInt(currentAgentId),
        title: title,
        description: description,
        start_time: new Date(startTime).toISOString(),
        end_time: new Date(endTime).toISOString(),
        client_name: clientName,
        client_email: clientEmail,
        client_phone: clientPhone
    };

    try {
        const response = await fetch('/api/google/appointments', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            credentials: 'include',
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Error creando cita');
        }

        const data = await response.json();

        showAlert('✅ Cita creada exitosamente en Calendar y Sheet!', 'success');
        console.log('Event ID:', data.event_id);

        // Reset form
        document.getElementById('appointmentForm').reset();
        setDefaultDateTimes();

    } catch (error) {
        console.error('Error:', error);
        showAlert('Error creando cita: ' + error.message, 'error');
    } finally {
        createBtn.disabled = false;
        createBtn.innerHTML = '<i class="lni lni-plus"></i> Crear Cita de Prueba';
    }
}

// ============================================
// HELPERS
// ============================================
function setDefaultDateTimes() {
    const now = new Date();
    const start = new Date(now.getTime() + 60 * 60 * 1000); // +1 hora
    const end = new Date(start.getTime() + 60 * 60 * 1000); // +1 hora más

    document.getElementById('appointmentStart').value = formatDateTimeLocal(start);
    document.getElementById('appointmentEnd').value = formatDateTimeLocal(end);
}

function formatDateTimeLocal(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
}

function showAlert(message, type = 'success') {
    const alertsContainer = document.getElementById('alerts');
    const alert = document.createElement('div');
    alert.className = `alert alert-${type}`;
    
    const icon = type === 'success' ? 'lni-checkmark-circle' : 'lni-cross-circle';
    alert.innerHTML = `
        <i class="lni ${icon}"></i>
        <span>${message}</span>
    `;
    
    alertsContainer.appendChild(alert);
    
    setTimeout(() => {
        alert.style.opacity = '0';
        setTimeout(() => alert.remove(), 300);
    }, 5000);
}

function checkURLParams() {
    const urlParams = new URLSearchParams(window.location.search);
    
    if (urlParams.get('success') === 'true') {
        const agentId = urlParams.get('agent_id');
        const calendarId = urlParams.get('calendar_id');
        const sheetId = urlParams.get('sheet_id');
        
        showAlert('🎉 Google conectado exitosamente! Calendar y Sheet creados automáticamente.', 'success');
        
        if (agentId) {
            currentAgentId = agentId;
            document.getElementById('agentSelect').value = agentId;
            loadIntegrationStatus();
        }
        
        // Clean URL
        window.history.replaceState({}, document.title, window.location.pathname);
    }
    
    if (urlParams.get('error')) {
        const error = urlParams.get('error');
        showAlert('Error en la conexión: ' + error, 'error');
        window.history.replaceState({}, document.title, window.location.pathname);
    }
}