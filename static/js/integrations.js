// ============================================
// INTEGRATIONS JAVASCRIPT - ACTUALIZADO
// ============================================

document.addEventListener('DOMContentLoaded', function() {
    console.log('🔧 Integrations JS cargado correctamente');
    
    initAgentSelector();
    initGoogleIntegration();
    initGeminiIntegration();
    initMetaIntegration();
    
    console.log('✅ Integrations funcionalidades inicializadas');
});

// ============================================
// GLOBAL STATE
// ============================================

let selectedAgentId = null;
let selectedAgent = null;
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
        option.setAttribute('data-bot-type', agent.botType);
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
    
    selectDisplay.addEventListener('click', function(e) {
        e.stopPropagation();
        toggleAgentDropdown();
    });
    
    options.forEach(option => {
        option.addEventListener('click', function(e) {
            e.stopPropagation();
            selectAgent(this);
        });
    });
    
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
    const botType = option.getAttribute('data-bot-type');
    const agentName = option.textContent;
    
    selectedAgentId = parseInt(agentId);
    selectedAgent = agents.find(a => a.id === selectedAgentId);
    
    const selectDisplay = document.getElementById('agentSelectDisplay');
    selectDisplay.textContent = agentName;
    
    const allOptions = document.querySelectorAll('.select-option');
    allOptions.forEach(opt => opt.classList.remove('selected'));
    option.classList.add('selected');
    
    closeAgentDropdown();
    
    console.log(`✅ Agente seleccionado: ${agentName} (ID: ${agentId}, Tipo: ${botType})`);
    
    showIntegrationsGrid();
    
    // Mostrar/ocultar tarjetas según el tipo de bot
    showIntegrationsByBotType(botType);
    
    // Load integration statuses
    await loadGoogleIntegrationStatus(selectedAgentId);
    
    if (botType === 'atomic') {
        await loadGeminiStatus(selectedAgentId);
    } else if (botType === 'orbital') {
        await loadMetaCredentialsStatus(selectedAgentId);
    }
}

function showIntegrationsByBotType(botType) {
    const geminiCard = document.getElementById('geminiCard');
    const metaCard = document.getElementById('metaCard');
    
    if (botType === 'atomic') {
        // Plan gratuito - AtomicBot
        if (geminiCard) geminiCard.style.display = 'block';
        if (metaCard) metaCard.style.display = 'none';
        console.log('📱 Mostrando integraciones para AtomicBot (plan gratuito)');
    } else if (botType === 'orbital') {
        // Plan de pago - OrbitalBot
        if (geminiCard) geminiCard.style.display = 'none';
        if (metaCard) metaCard.style.display = 'block';
        console.log('🚀 Mostrando integraciones para OrbitalBot (plan de pago)');
    }
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
// META WHATSAPP INTEGRATION
// ============================================

function initMetaIntegration() {
    const toggleToken = document.getElementById('toggleMetaToken');
    const toggleVerify = document.getElementById('toggleMetaVerify');
    const saveButton = document.getElementById('btnSaveMetaCredentials');
    const updateButton = document.getElementById('btnUpdateMetaCredentials');
    const removeButton = document.getElementById('btnRemoveMetaCredentials');
    
    if (toggleToken) {
        toggleToken.addEventListener('click', () => toggleMetaVisibility('metaAccessToken', 'toggleMetaToken'));
    }
    
    if (toggleVerify) {
        toggleVerify.addEventListener('click', () => toggleMetaVisibility('metaVerifyToken', 'toggleMetaVerify'));
    }
    
    // Enable save button when all fields have content
    const inputs = ['metaPhoneNumberId', 'metaAccessToken', 'metaWabaId', 'metaVerifyToken'];
    inputs.forEach(inputId => {
        const input = document.getElementById(inputId);
        if (input) {
            input.addEventListener('input', function() {
                if (saveButton) {
                    const allFilled = inputs.every(id => {
                        const el = document.getElementById(id);
                        return el && el.value.trim();
                    });
                    saveButton.disabled = !allFilled;
                }
            });
        }
    });
    
    if (saveButton) {
        saveButton.addEventListener('click', saveMetaCredentials);
    }
    
    if (updateButton) {
        updateButton.addEventListener('click', enableMetaEdit);
    }
    
    if (removeButton) {
        removeButton.addEventListener('click', removeMetaCredentials);
    }
}

function toggleMetaVisibility(inputId, buttonId) {
    const input = document.getElementById(inputId);
    const button = document.getElementById(buttonId);
    const icon = button.querySelector('i');
    
    if (input.type === 'password') {
        input.type = 'text';
        icon.className = 'lni lni-eye-off';
    } else {
        input.type = 'password';
        icon.className = 'lni lni-eye';
    }
}

async function loadMetaCredentialsStatus(agentId) {
    console.log(`📊 Cargando estado de Meta para agente ${agentId}...`);
    
    try {
        const response = await fetch(`/api/meta/credentials/status/${agentId}`, {
            method: 'GET',
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error('Error al cargar estado de Meta');
        }

        const data = await response.json();
        console.log('✅ Estado de Meta:', data);
        
        updateMetaCredentialsUI(data);
        
    } catch (error) {
        console.error('Error cargando estado de Meta:', error);
        // Mostrar como no configurado en caso de error
        updateMetaCredentialsUI({ has_credentials: false, connected: false });
    }
}

function updateMetaCredentialsUI(data) {
    const statusBadge = document.getElementById('metaStatus');
    const connectionInfo = document.getElementById('metaConnectionInfo');
    const credentialsForm = document.getElementById('metaCredentialsForm');
    const saveActions = document.getElementById('metaActions');
    const manageActions = document.getElementById('metaManageActions');
    
    const inputs = {
        phoneNumberId: document.getElementById('metaPhoneNumberId'),
        accessToken: document.getElementById('metaAccessToken'),
        wabaId: document.getElementById('metaWabaId'),
        verifyToken: document.getElementById('metaVerifyToken')
    };
    
    const toggleButtons = {
        token: document.getElementById('toggleMetaToken'),
        verify: document.getElementById('toggleMetaVerify')
    };
    
    if (data.has_credentials && data.connected) {
        // Credenciales configuradas
        if (statusBadge) {
            statusBadge.className = 'status-badge connected';
            statusBadge.innerHTML = `
                <span class="status-indicator"></span>
                Configurado
            `;
        }
        
        // Disable inputs y mostrar valores enmascarados
        Object.values(inputs).forEach(input => {
            if (input) {
                input.value = '••••••••••••••••';
                input.disabled = true;
            }
        });
        
        Object.values(toggleButtons).forEach(btn => {
            if (btn) btn.disabled = true;
        });
        
        // Mostrar información de conexión
        if (connectionInfo) {
            connectionInfo.style.display = 'block';
            
            const displayNumber = document.getElementById('metaDisplayNumber');
            const verifiedName = document.getElementById('metaVerifiedName');
            const connectedAt = document.getElementById('metaConnectedAt');
            
            if (displayNumber && data.display_number) {
                displayNumber.textContent = data.display_number;
            }
            
            if (verifiedName && data.verified_name) {
                verifiedName.textContent = data.verified_name;
            }
            
            if (connectedAt && data.connected_at) {
                const date = new Date(data.connected_at);
                connectedAt.textContent = formatDate(date);
            }
        }
        
        if (saveActions) saveActions.style.display = 'none';
        if (manageActions) manageActions.style.display = 'flex';
        
    } else {
        // Sin credenciales configuradas
        if (statusBadge) {
            statusBadge.className = 'status-badge disconnected';
            statusBadge.innerHTML = `
                <span class="status-indicator"></span>
                No configurado
            `;
        }
        
        // Enable inputs
        Object.values(inputs).forEach(input => {
            if (input) {
                input.value = '';
                input.disabled = false;
            }
        });
        
        Object.values(toggleButtons).forEach(btn => {
            if (btn) btn.disabled = false;
        });
        
        if (connectionInfo) connectionInfo.style.display = 'none';
        if (saveActions) saveActions.style.display = 'flex';
        if (manageActions) manageActions.style.display = 'none';
    }
}

async function saveMetaCredentials() {
    if (!selectedAgentId) {
        showNotification('Por favor selecciona un agente primero', 'error');
        return;
    }
    
    const phoneNumberId = document.getElementById('metaPhoneNumberId').value.trim();
    const accessToken = document.getElementById('metaAccessToken').value.trim();
    const wabaId = document.getElementById('metaWabaId').value.trim();
    const verifyToken = document.getElementById('metaVerifyToken').value.trim();
    
    if (!phoneNumberId || !accessToken || !wabaId || !verifyToken) {
        showNotification('Por favor completa todos los campos', 'error');
        return;
    }
    
    console.log(`💾 Guardando credenciales de Meta para agente ${selectedAgentId}...`);
    
    const saveButton = document.getElementById('btnSaveMetaCredentials');
    const originalText = saveButton.innerHTML;
    
    saveButton.innerHTML = `
        <div class="loading-spinner"></div>
        <span>Guardando...</span>
    `;
    saveButton.disabled = true;
    
    try {
        const response = await fetch(`/api/meta/credentials/save/${selectedAgentId}`, {
            method: 'POST',
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                phone_number_id: phoneNumberId,
                access_token: accessToken,
                waba_id: wabaId,
                verify_token: verifyToken
            })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Error al guardar credenciales');
        }

        console.log('✅ Credenciales de Meta guardadas');
        showNotification('Credenciales guardadas exitosamente', 'success');
        
        await loadMetaCredentialsStatus(selectedAgentId);
        
    } catch (error) {
        console.error('Error guardando credenciales:', error);
        showNotification(error.message || 'Error al guardar credenciales', 'error');
        
        saveButton.innerHTML = originalText;
        saveButton.disabled = false;
    }
}

function enableMetaEdit() {
    const inputs = {
        phoneNumberId: document.getElementById('metaPhoneNumberId'),
        accessToken: document.getElementById('metaAccessToken'),
        wabaId: document.getElementById('metaWabaId'),
        verifyToken: document.getElementById('metaVerifyToken')
    };
    
    const toggleButtons = {
        token: document.getElementById('toggleMetaToken'),
        verify: document.getElementById('toggleMetaVerify')
    };
    
    const saveActions = document.getElementById('metaActions');
    const manageActions = document.getElementById('metaManageActions');
    const connectionInfo = document.getElementById('metaConnectionInfo');
    
    Object.values(inputs).forEach(input => {
        if (input) {
            input.value = '';
            input.disabled = false;
        }
    });
    
    Object.values(toggleButtons).forEach(btn => {
        if (btn) btn.disabled = false;
    });
    
    if (connectionInfo) connectionInfo.style.display = 'none';
    if (saveActions) saveActions.style.display = 'flex';
    if (manageActions) manageActions.style.display = 'none';
    
    if (inputs.phoneNumberId) inputs.phoneNumberId.focus();
}

async function removeMetaCredentials() {
    if (!selectedAgentId) {
        showNotification('Por favor selecciona un agente primero', 'error');
        return;
    }
    
    if (!confirm('¿Estás seguro de que quieres eliminar las credenciales de Meta? El agente dejará de funcionar con WhatsApp Business API.')) {
        return;
    }
    
    console.log(`🗑️  Eliminando credenciales de Meta para agente ${selectedAgentId}...`);
    
    try {
        const response = await fetch(`/api/meta/credentials/remove/${selectedAgentId}`, {
            method: 'DELETE',
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error('Error al eliminar credenciales');
        }

        console.log('✅ Credenciales de Meta eliminadas');
        showNotification('Credenciales eliminadas exitosamente', 'success');
        
        await loadMetaCredentialsStatus(selectedAgentId);
        
    } catch (error) {
        console.error('Error eliminando credenciales:', error);
        showNotification('Error al eliminar credenciales', 'error');
    }
}

// ============================================
// GEMINI INTEGRATION (Plan gratuito)
// ============================================

function initGeminiIntegration() {
    const apiKeyInput = document.getElementById('geminiApiKeyInput');
    const toggleButton = document.getElementById('toggleGeminiKey');
    const saveButton = document.getElementById('btnSaveGeminiKey');
    const updateButton = document.getElementById('btnUpdateGeminiKey');
    const removeButton = document.getElementById('btnRemoveGeminiKey');
    
    if (toggleButton) {
        toggleButton.addEventListener('click', toggleGeminiKeyVisibility);
    }
    
    if (apiKeyInput) {
        apiKeyInput.addEventListener('input', function() {
            if (saveButton) {
                saveButton.disabled = !this.value.trim();
            }
        });
    }
    
    if (saveButton) {
        saveButton.addEventListener('click', saveGeminiApiKey);
    }
    
    if (updateButton) {
        updateButton.addEventListener('click', enableGeminiEdit);
    }
    
    if (removeButton) {
        removeButton.addEventListener('click', removeGeminiApiKey);
    }
}

function toggleGeminiKeyVisibility() {
    const input = document.getElementById('geminiApiKeyInput');
    const button = document.getElementById('toggleGeminiKey');
    const icon = button.querySelector('i');
    
    if (input.type === 'password') {
        input.type = 'text';
        icon.className = 'lni lni-eye-off';
    } else {
        input.type = 'password';
        icon.className = 'lni lni-eye';
    }
}

async function loadGeminiStatus(agentId) {
    console.log(`📊 Cargando estado de Gemini para agente ${agentId}...`);
    
    try {
        const apiKeyInput = document.getElementById('geminiApiKeyInput');
        const toggleButton = document.getElementById('toggleGeminiKey');
        const statusBadge = document.getElementById('geminiStatus');
        const saveActions = document.getElementById('geminiActions');
        const manageActions = document.getElementById('geminiManageActions');
        
        // Enable inputs cuando se selecciona un agente
        if (apiKeyInput) apiKeyInput.disabled = false;
        if (toggleButton) toggleButton.disabled = false;
        
        // Llamar al endpoint para verificar si tiene API key
        const response = await fetch(`/api/gemini/status/${agentId}`, {
            method: 'GET',
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error('Error al cargar estado de Gemini');
        }

        const data = await response.json();
        const hasApiKey = data.has_api_key || false;
        
        console.log('✅ Estado de Gemini:', data);
        
        if (hasApiKey) {
            if (statusBadge) {
                statusBadge.className = 'status-badge connected';
                statusBadge.innerHTML = `
                    <span class="status-indicator"></span>
                    Configurado
                `;
            }
            
            if (apiKeyInput) {
                apiKeyInput.value = '••••••••••••••••';
                apiKeyInput.disabled = true;
            }
            if (toggleButton) toggleButton.disabled = true;
            
            if (saveActions) saveActions.style.display = 'none';
            if (manageActions) manageActions.style.display = 'flex';
        } else {
            if (statusBadge) {
                statusBadge.className = 'status-badge disconnected';
                statusBadge.innerHTML = `
                    <span class="status-indicator"></span>
                    No configurado
                `;
            }
            
            if (apiKeyInput) {
                apiKeyInput.value = '';
                apiKeyInput.disabled = false;
            }
            if (toggleButton) toggleButton.disabled = false;
            
            if (saveActions) saveActions.style.display = 'flex';
            if (manageActions) manageActions.style.display = 'none';
        }
        
    } catch (error) {
        console.error('Error cargando estado de Gemini:', error);
        
        // En caso de error, mostrar como no configurado
        const statusBadge = document.getElementById('geminiStatus');
        const saveActions = document.getElementById('geminiActions');
        const manageActions = document.getElementById('geminiManageActions');
        
        if (statusBadge) {
            statusBadge.className = 'status-badge disconnected';
            statusBadge.innerHTML = `
                <span class="status-indicator"></span>
                No configurado
            `;
        }
        
        if (saveActions) saveActions.style.display = 'flex';
        if (manageActions) manageActions.style.display = 'none';
    }
}

async function saveGeminiApiKey() {
    if (!selectedAgentId) {
        showNotification('Por favor selecciona un agente primero', 'error');
        return;
    }
    
    const apiKeyInput = document.getElementById('geminiApiKeyInput');
    const apiKey = apiKeyInput.value.trim();
    
    if (!apiKey) {
        showNotification('Por favor ingresa una API Key válida', 'error');
        return;
    }
    
    if (!apiKey.startsWith('AIzaSy')) {
        showNotification('La API Key debe comenzar con "AIzaSy"', 'error');
        return;
    }
    
    console.log(`💾 Guardando Gemini API Key para agente ${selectedAgentId}...`);
    
    const saveButton = document.getElementById('btnSaveGeminiKey');
    const originalText = saveButton.innerHTML;
    
    saveButton.innerHTML = `
        <div class="loading-spinner"></div>
        <span>Guardando...</span>
    `;
    saveButton.disabled = true;
    
    try {
        const response = await fetch(`/api/gemini/save-key/${selectedAgentId}`, {
            method: 'POST',
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ apiKey })
        });

        if (!response.ok) {
            throw new Error('Error al guardar API Key');
        }

        console.log('✅ Gemini API Key guardada');
        showNotification('API Key guardada exitosamente', 'success');
        
        await loadGeminiStatus(selectedAgentId);
        
    } catch (error) {
        console.error('Error guardando API Key:', error);
        showNotification('Error al guardar API Key', 'error');
        
        saveButton.innerHTML = originalText;
        saveButton.disabled = false;
    }
}

function enableGeminiEdit() {
    const apiKeyInput = document.getElementById('geminiApiKeyInput');
    const toggleButton = document.getElementById('toggleGeminiKey');
    const saveActions = document.getElementById('geminiActions');
    const manageActions = document.getElementById('geminiManageActions');
    
    if (apiKeyInput) {
        apiKeyInput.value = '';
        apiKeyInput.disabled = false;
        apiKeyInput.focus();
    }
    if (toggleButton) toggleButton.disabled = false;
    
    if (saveActions) saveActions.style.display = 'flex';
    if (manageActions) manageActions.style.display = 'none';
}

async function removeGeminiApiKey() {
    if (!selectedAgentId) {
        showNotification('Por favor selecciona un agente primero', 'error');
        return;
    }
    
    if (!confirm('¿Estás seguro de que quieres eliminar la API Key de Gemini? El agente dejará de usar IA.')) {
        return;
    }
    
    console.log(`🗑️  Eliminando Gemini API Key para agente ${selectedAgentId}...`);
    
    try {
        const response = await fetch(`/api/gemini/remove-key/${selectedAgentId}`, {
            method: 'DELETE',
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error('Error al eliminar API Key');
        }

        console.log('✅ Gemini API Key eliminada');
        showNotification('API Key eliminada exitosamente', 'success');
        
        await loadGeminiStatus(selectedAgentId);
        
    } catch (error) {
        console.error('Error eliminando API Key:', error);
        showNotification('Error al eliminar API Key', 'error');
    }
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
        
        const btnConnect = document.getElementById('btnConnectGoogle');
        if (btnConnect && !data.connected) {
            btnConnect.disabled = false;
        }
        
    } catch (error) {
        console.error('Error cargando estado de integración:', error);
        
        const btnConnect = document.getElementById('btnConnectGoogle');
        if (btnConnect) {
            btnConnect.disabled = false;
        }
    }
}

function updateGoogleIntegrationUI(data) {
    const statusBadge = document.getElementById('googleStatus');
    const sheetsStatusBadge = document.getElementById('googleSheetsStatus');
    const connectionInfo = document.getElementById('googleConnectionInfo');
    const sheetsConnectionInfo = document.getElementById('googleSheetsConnectionInfo');
    const connectActions = document.getElementById('googleActions');
    const manageActions = document.getElementById('googleManageActions');
    const calendarEmail = document.getElementById('calendarEmail');
    const sheetLink = document.getElementById('sheetLink');
    const connectedAt = document.getElementById('connectedAt');
    const sheetsConnectedAt = document.getElementById('sheetsConnectedAt');
    
    if (data.connected) {
        // Update status badges
        if (statusBadge) {
            statusBadge.className = 'status-badge connected';
            statusBadge.innerHTML = `
                <span class="status-indicator"></span>
                Conectado
            `;
        }
        
        if (sheetsStatusBadge) {
            sheetsStatusBadge.className = 'status-badge connected';
            sheetsStatusBadge.innerHTML = `
                <span class="status-indicator"></span>
                Conectado
            `;
        }
        
        // Show connection info
        if (connectionInfo) {
            connectionInfo.style.display = 'block';
            
            if (calendarEmail && data.calendar_id) {
                calendarEmail.textContent = data.calendar_id;
            }
            
            if (connectedAt && data.connected_at) {
                const date = new Date(data.connected_at);
                connectedAt.textContent = formatDate(date);
            }
        }
        
        if (sheetsConnectionInfo) {
            sheetsConnectionInfo.style.display = 'block';
            
            if (sheetLink && data.sheet_id) {
                const sheetUrl = `https://docs.google.com/spreadsheets/d/${data.sheet_id}/edit`;
                sheetLink.href = sheetUrl;
            }
            
            if (sheetsConnectedAt && data.connected_at) {
                const date = new Date(data.connected_at);
                sheetsConnectedAt.textContent = formatDate(date);
            }
        }
        
        // Show manage actions, hide connect actions
        if (connectActions) connectActions.style.display = 'none';
        if (manageActions) manageActions.style.display = 'flex';
        
    } else {
        // Update status badges
        if (statusBadge) {
            statusBadge.className = 'status-badge disconnected';
            statusBadge.innerHTML = `
                <span class="status-indicator"></span>
                No conectado
            `;
        }
        
        if (sheetsStatusBadge) {
            sheetsStatusBadge.className = 'status-badge disconnected';
            sheetsStatusBadge.innerHTML = `
                <span class="status-indicator"></span>
                No conectado
            `;
        }
        
        // Hide connection info
        if (connectionInfo) connectionInfo.style.display = 'none';
        if (sheetsConnectionInfo) sheetsConnectionInfo.style.display = 'none';
        
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
        
        const pollTimer = setInterval(async () => {
            if (popup.closed) {
                clearInterval(pollTimer);
                console.log('🔄 Ventana OAuth cerrada, verificando estado...');
                
                await new Promise(resolve => setTimeout(resolve, 1000));
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
    
    if (diff < 60000) return 'Hace un momento';
    if (diff < 3600000) {
        const minutes = Math.floor(diff / 60000);
        return `Hace ${minutes} minuto${minutes > 1 ? 's' : ''}`;
    }
    if (diff < 86400000) {
        const hours = Math.floor(diff / 3600000);
        return `Hace ${hours} hora${hours > 1 ? 's' : ''}`;
    }
    if (diff < 604800000) {
        const days = Math.floor(diff / 86400000);
        return `Hace ${days} día${days > 1 ? 's' : ''}`;
    }
    
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