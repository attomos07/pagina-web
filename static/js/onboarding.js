// ============================================
// ONBOARDING JAVASCRIPT
// ============================================

document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 Onboarding inicializado');
    
    initializeStep1();
    initializeStep2();
    
    console.log('✅ Onboarding listo');
});

// ===========================================
// STATE MANAGEMENT
// ===========================================

let agentData = {
    metaDocument: null,
    config: {
        welcomeMessage: '',
        schedule: {},
        services: [],
        staff: [],
        promotions: [],
        facilities: [],
        customFields: {}
    }
};

let currentStep = 1;
let uploadedFile = null;

// ===========================================
// STEP NAVIGATION
// ===========================================

function nextStep(step) {
    // Validar paso actual antes de avanzar
    if (!validateCurrentStep()) {
        return;
    }
    
    // Guardar datos del paso actual
    saveStepData();
    
    // Cambiar paso
    currentStep = step;
    showStep(step);
    
    // Si es el paso 3, generar resumen
    if (step === 3) {
        generateSummary();
    }
}

function previousStep(step) {
    currentStep = step;
    showStep(step);
}

function showStep(step) {
    // Ocultar todos los pasos
    document.querySelectorAll('.step').forEach(s => s.classList.remove('active'));
    
    // Mostrar paso actual
    document.querySelector(`.step-${step}`).classList.add('active');
    
    // Actualizar progress bar
    document.querySelectorAll('.progress-step').forEach((s, index) => {
        if (index + 1 < step) {
            s.classList.add('completed');
            s.classList.remove('active');
        } else if (index + 1 === step) {
            s.classList.add('active');
            s.classList.remove('completed');
        } else {
            s.classList.remove('active', 'completed');
        }
    });
    
    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function validateCurrentStep() {
    if (currentStep === 1) {
        if (!uploadedFile) {
            showNotification('Por favor sube el documento de verificación', 'error');
            return false;
        }
    } else if (currentStep === 2) {
        const form = document.getElementById('agentConfigForm');
        const agentName = document.getElementById('agentName').value.trim();
        const phoneNumber = document.getElementById('phoneNumber').value.trim();
        const welcomeMessage = document.getElementById('welcomeMessage').value.trim();
        
        if (!agentName) {
            showNotification('Por favor ingresa el nombre del agente', 'error');
            return false;
        }
        
        if (!phoneNumber) {
            showNotification('Por favor ingresa el número de WhatsApp', 'error');
            return false;
        }
        
        if (!welcomeMessage) {
            showNotification('Por favor ingresa el mensaje de bienvenida', 'error');
            return false;
        }
        
        if (agentData.config.services.length === 0) {
            showNotification('Por favor agrega al menos un servicio', 'error');
            return false;
        }
        
        if (agentData.config.staff.length === 0) {
            showNotification('Por favor agrega al menos un miembro del personal', 'error');
            return false;
        }
    }
    
    return true;
}

function saveStepData() {
    if (currentStep === 2) {
        // Guardar información básica
        agentData.name = document.getElementById('agentName').value.trim();
        agentData.phoneNumber = document.getElementById('phoneNumber').value.trim();
        agentData.config.welcomeMessage = document.getElementById('welcomeMessage').value.trim();
        
        // Guardar horarios
        saveSchedule();
        
        // Guardar facilidades
        saveFacilities();
    }
}

// ===========================================
// STEP 1: FILE UPLOAD
// ===========================================

function initializeStep1() {
    const uploadArea = document.getElementById('uploadArea');
    const fileInput = document.getElementById('metaDocument');
    
    // Click to upload
    uploadArea.addEventListener('click', function(e) {
        if (e.target !== fileInput) {
            fileInput.click();
        }
    });
    
    // Drag and drop
    uploadArea.addEventListener('dragover', function(e) {
        e.preventDefault();
        uploadArea.classList.add('dragover');
    });
    
    uploadArea.addEventListener('dragleave', function() {
        uploadArea.classList.remove('dragover');
    });
    
    uploadArea.addEventListener('drop', function(e) {
        e.preventDefault();
        uploadArea.classList.remove('dragover');
        
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            handleFileUpload(files[0]);
        }
    });
    
    // File input change
    fileInput.addEventListener('change', function(e) {
        if (e.target.files.length > 0) {
            handleFileUpload(e.target.files[0]);
        }
    });

    // Cambio temporal: Habilitar botón sin restricciones
    document.getElementById('btnStep1').disabled = false
}

function handleFileUpload(file) {
    // Validar tipo de archivo
    const validTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg'];
    if (!validTypes.includes(file.type)) {
        showNotification('Tipo de archivo no válido. Solo PDF, JPG o PNG', 'error');
        return;
    }
    
    // Validar tamaño (5MB max)
    if (file.size > 5 * 1024 * 1024) {
        showNotification('El archivo es demasiado grande. Máximo 5MB', 'error');
        return;
    }
    
    uploadedFile = file;
    
    // Mostrar preview
    showFilePreview(file);
    
    // Simular upload (en producción, subir a servidor)
    simulateUpload();
    
    // Habilitar botón siguiente
    document.getElementById('btnStep1').disabled = false;
}

function showFilePreview(file) {
    document.getElementById('uploadArea').style.display = 'none';
    document.getElementById('filePreview').style.display = 'block';
    document.getElementById('fileName').textContent = file.name;
    document.getElementById('fileSize').textContent = formatFileSize(file.size);
}

function simulateUpload() {
    const progressBar = document.getElementById('uploadProgress');
    const progressFill = progressBar.querySelector('.progress-bar-fill');
    
    progressBar.style.display = 'block';
    
    let progress = 0;
    const interval = setInterval(() => {
        progress += 10;
        progressFill.style.width = progress + '%';
        
        if (progress >= 100) {
            clearInterval(interval);
            setTimeout(() => {
                progressBar.style.display = 'none';
                showNotification('Documento cargado exitosamente', 'success');
            }, 500);
        }
    }, 100);
    
    // Guardar como base64 para enviar al servidor
    const reader = new FileReader();
    reader.onload = function(e) {
        agentData.metaDocument = e.target.result;
    };
    reader.readAsDataURL(file);
}

function removeFile() {
    uploadedFile = null;
    agentData.metaDocument = null;
    document.getElementById('filePreview').style.display = 'none';
    document.getElementById('uploadArea').style.display = 'block';
    document.getElementById('metaDocument').value = '';
    document.getElementById('btnStep1').disabled = true;
}

function formatFileSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    else if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
    else return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
}

// ===========================================
// STEP 2: CONFIGURATION FORM
// ===========================================

function initializeStep2() {
    // Inicializar horarios
    initializeSchedule();
    
    // Agregar primer servicio por defecto
    addService();
    
    // Agregar primer miembro del personal por defecto
    addStaffMember();
}

// SCHEDULE
function initializeSchedule() {
    const days = [
        { name: 'Lunes', key: 'monday' },
        { name: 'Martes', key: 'tuesday' },
        { name: 'Miércoles', key: 'wednesday' },
        { name: 'Jueves', key: 'thursday' },
        { name: 'Viernes', key: 'friday' },
        { name: 'Sábado', key: 'saturday' },
        { name: 'Domingo', key: 'sunday' }
    ];
    
    const scheduleGrid = document.getElementById('scheduleGrid');
    
    days.forEach(day => {
        const dayElement = document.createElement('div');
        dayElement.className = 'schedule-day';
        dayElement.innerHTML = `
            <div class="schedule-day-name">${day.name}</div>
            <div class="schedule-toggle">
                <input type="checkbox" id="schedule-${day.key}" checked>
                <label for="schedule-${day.key}">Abierto</label>
            </div>
            <div class="schedule-times">
                <input type="time" id="schedule-${day.key}-open" value="09:00">
                <span>-</span>
                <input type="time" id="schedule-${day.key}-close" value="20:00">
            </div>
        `;
        
        scheduleGrid.appendChild(dayElement);
        
        // Toggle times visibility
        const checkbox = dayElement.querySelector(`#schedule-${day.key}`);
        const times = dayElement.querySelector('.schedule-times');
        
        checkbox.addEventListener('change', function() {
            if (this.checked) {
                times.style.display = 'flex';
            } else {
                times.style.display = 'none';
            }
        });
    });
}

function saveSchedule() {
    const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
    
    days.forEach(day => {
        const checkbox = document.getElementById(`schedule-${day}`);
        const openTime = document.getElementById(`schedule-${day}-open`);
        const closeTime = document.getElementById(`schedule-${day}-close`);
        
        agentData.config.schedule[day] = {
            isOpen: checkbox.checked,
            open: openTime.value,
            close: closeTime.value
        };
    });
}

// SERVICES
let serviceCounter = 0;

function addService() {
    const container = document.getElementById('servicesContainer');
    const serviceId = `service-${serviceCounter++}`;
    
    const serviceElement = document.createElement('div');
    serviceElement.className = 'service-item';
    serviceElement.dataset.id = serviceId;
    serviceElement.innerHTML = `
        <div class="item-header">
            <span class="item-title">Servicio #${serviceCounter}</span>
            <button type="button" class="btn-remove-item" onclick="removeService('${serviceId}')">
                <i class="lni lni-trash-can"></i>
            </button>
        </div>
        <div class="item-fields">
            <div class="form-group">
                <label>Nombre del Servicio *</label>
                <input type="text" class="form-input" data-field="name" placeholder="Ej: Corte Tradicional" required>
            </div>
            <div class="field-row">
                <div class="form-group">
                    <label>Precio ($) *</label>
                    <input type="number" class="form-input" data-field="price" placeholder="300" min="0" step="0.01" required>
                </div>
                <div class="form-group">
                    <label>Duración (minutos)</label>
                    <input type="number" class="form-input" data-field="duration" placeholder="60" min="15" step="15" value="60">
                </div>
            </div>
            <div class="form-group">
                <label>Descripción</label>
                <textarea class="form-textarea" data-field="description" rows="2" placeholder="Descripción breve del servicio"></textarea>
            </div>
        </div>
    `;
    
    container.appendChild(serviceElement);
}

function removeService(serviceId) {
    const element = document.querySelector(`[data-id="${serviceId}"]`);
    if (element) {
        element.remove();
    }
}

function getServices() {
    const services = [];
    const serviceElements = document.querySelectorAll('.service-item');
    
    serviceElements.forEach(element => {
        const name = element.querySelector('[data-field="name"]').value.trim();
        const price = parseFloat(element.querySelector('[data-field="price"]').value) || 0;
        const duration = parseInt(element.querySelector('[data-field="duration"]').value) || 60;
        const description = element.querySelector('[data-field="description"]').value.trim();
        
        if (name && price > 0) {
            services.push({ name, price, duration, description });
        }
    });
    
    return services;
}

// STAFF
let staffCounter = 0;

function addStaffMember() {
    const container = document.getElementById('staffContainer');
    const staffId = `staff-${staffCounter++}`;
    
    const staffElement = document.createElement('div');
    staffElement.className = 'staff-item';
    staffElement.dataset.id = staffId;
    staffElement.innerHTML = `
        <div class="item-header">
            <span class="item-title">Personal #${staffCounter}</span>
            <button type="button" class="btn-remove-item" onclick="removeStaff('${staffId}')">
                <i class="lni lni-trash-can"></i>
            </button>
        </div>
        <div class="item-fields">
            <div class="field-row">
                <div class="form-group">
                    <label>Nombre *</label>
                    <input type="text" class="form-input" data-field="name" placeholder="Ej: Carlos" required>
                </div>
                <div class="form-group">
                    <label>Rol *</label>
                    <input type="text" class="form-input" data-field="role" placeholder="Ej: Barbero Senior" required>
                </div>
            </div>
            <div class="form-group">
                <label>Especialidades (separadas por coma)</label>
                <input type="text" class="form-input" data-field="specialties" placeholder="Ej: Fade, Diseños, Barba">
            </div>
        </div>
    `;
    
    container.appendChild(staffElement);
}

function removeStaff(staffId) {
    const element = document.querySelector(`[data-id="${staffId}"]`);
    if (element) {
        element.remove();
    }
}

function getStaff() {
    const staff = [];
    const staffElements = document.querySelectorAll('.staff-item');
    
    staffElements.forEach(element => {
        const name = element.querySelector('[data-field="name"]').value.trim();
        const role = element.querySelector('[data-field="role"]').value.trim();
        const specialtiesStr = element.querySelector('[data-field="specialties"]').value.trim();
        const specialties = specialtiesStr ? specialtiesStr.split(',').map(s => s.trim()) : [];
        
        if (name && role) {
            staff.push({ name, role, specialties, availability: agentData.config.schedule });
        }
    });
    
    return staff;
}

// PROMOTIONS
let promotionCounter = 0;

function addPromotion() {
    const container = document.getElementById('promotionsContainer');
    const promotionId = `promotion-${promotionCounter++}`;
    
    const promotionElement = document.createElement('div');
    promotionElement.className = 'promotion-item';
    promotionElement.dataset.id = promotionId;
    promotionElement.innerHTML = `
        <div class="item-header">
            <span class="item-title">Promoción #${promotionCounter}</span>
            <button type="button" class="btn-remove-item" onclick="removePromotion('${promotionId}')">
                <i class="lni lni-trash-can"></i>
            </button>
        </div>
        <div class="item-fields">
            <div class="form-group">
                <label>Nombre de la Promoción</label>
                <input type="text" class="form-input" data-field="name" placeholder="Ej: Martes de Estudiantes">
            </div>
            <div class="field-row">
                <div class="form-group">
                    <label>Descuento</label>
                    <input type="text" class="form-input" data-field="discount" placeholder="Ej: $250 o 20%">
                </div>
                <div class="form-group">
                    <label>Días Válidos</label>
                    <input type="text" class="form-input" data-field="validDays" placeholder="Ej: Martes">
                </div>
            </div>
            <div class="form-group">
                <label>Descripción</label>
                <textarea class="form-textarea" data-field="description" rows="2" placeholder="Detalles de la promoción"></textarea>
            </div>
        </div>
    `;
    
    container.appendChild(promotionElement);
}

function removePromotion(promotionId) {
    const element = document.querySelector(`[data-id="${promotionId}"]`);
    if (element) {
        element.remove();
    }
}

function getPromotions() {
    const promotions = [];
    const promotionElements = document.querySelectorAll('.promotion-item');
    
    promotionElements.forEach(element => {
        const name = element.querySelector('[data-field="name"]').value.trim();
        const discount = element.querySelector('[data-field="discount"]').value.trim();
        const validDaysStr = element.querySelector('[data-field="validDays"]').value.trim();
        const validDays = validDaysStr ? validDaysStr.split(',').map(d => d.trim()) : [];
        const description = element.querySelector('[data-field="description"]').value.trim();
        
        if (name) {
            promotions.push({ name, discount, validDays, description });
        }
    });
    
    return promotions;
}

// FACILITIES
function saveFacilities() {
    const facilities = [];
    const checkboxes = document.querySelectorAll('input[name="facility"]:checked');
    
    checkboxes.forEach(checkbox => {
        facilities.push(checkbox.value);
    });
    
    agentData.config.facilities = facilities;
}

// ===========================================
// STEP 3: SUMMARY
// ===========================================

function generateSummary() {
    // Actualizar datos antes de mostrar resumen
    agentData.config.services = getServices();
    agentData.config.staff = getStaff();
    agentData.config.promotions = getPromotions();
    
    const container = document.getElementById('summaryContainer');
    
    let html = `
        <div class="summary-section">
            <h3><i class="lni lni-information"></i> Información Básica</h3>
            <div class="summary-item">
                <span class="summary-label">Nombre del Bot:</span>
                <span class="summary-value">${agentData.name}</span>
            </div>
            <div class="summary-item">
                <span class="summary-label">Número de WhatsApp:</span>
                <span class="summary-value">${agentData.phoneNumber}</span>
            </div>
            <div class="summary-item">
                <span class="summary-label">Mensaje de Bienvenida:</span>
                <span class="summary-value">${agentData.config.welcomeMessage}</span>
            </div>
        </div>
        
        <div class="summary-section">
            <h3><i class="lni lni-calendar"></i> Horario de Atención</h3>
            ${generateScheduleSummary()}
        </div>
        
        <div class="summary-section">
            <h3><i class="lni lni-briefcase"></i> Servicios (${agentData.config.services.length})</h3>
            <ul class="summary-list">
                ${agentData.config.services.map(s => `<li>${s.name} - $${s.price}</li>`).join('')}
            </ul>
        </div>
        
        <div class="summary-section">
            <h3><i class="lni lni-users"></i> Personal (${agentData.config.staff.length})</h3>
            <ul class="summary-list">
                ${agentData.config.staff.map(s => `<li>${s.name} - ${s.role}</li>`).join('')}
            </ul>
        </div>
    `;
    
    if (agentData.config.promotions.length > 0) {
        html += `
            <div class="summary-section">
                <h3><i class="lni lni-tag"></i> Promociones (${agentData.config.promotions.length})</h3>
                <ul class="summary-list">
                    ${agentData.config.promotions.map(p => `<li>${p.name}</li>`).join('')}
                </ul>
            </div>
        `;
    }
    
    if (agentData.config.facilities.length > 0) {
        html += `
            <div class="summary-section">
                <h3><i class="lni lni-car"></i> Facilidades</h3>
                <ul class="summary-list">
                    ${agentData.config.facilities.map(f => `<li>${f}</li>`).join('')}
                </ul>
            </div>
        `;
    }
    
    container.innerHTML = html;
}

function generateScheduleSummary() {
    const dayNames = {
        monday: 'Lunes',
        tuesday: 'Martes',
        wednesday: 'Miércoles',
        thursday: 'Jueves',
        friday: 'Viernes',
        saturday: 'Sábado',
        sunday: 'Domingo'
    };
    
    let html = '<ul class="summary-list">';
    
    Object.keys(agentData.config.schedule).forEach(day => {
        const schedule = agentData.config.schedule[day];
        if (schedule.isOpen) {
            html += `<li>${dayNames[day]}: ${schedule.open} - ${schedule.close}</li>`;
        }
    });
    
    html += '</ul>';
    return html;
}

// ===========================================
// CREATE BOT
// ===========================================

async function createAgent() {
    const btn = document.getElementById('btnCreateAgent');
    btn.disabled = true;
    
    // Mostrar loading
    document.getElementById('loadingOverlay').style.display = 'flex';
    
    try {
        // Obtener business type del usuario
        const userResponse = await fetch('/api/me', {
            credentials: 'include'
        });
        
        if (!userResponse.ok) {
            throw new Error('No autenticado');
        }
        
        const userData = await userResponse.json();
        
        // Preparar datos para enviar
        const requestData = {
            name: agentData.name,
            phoneNumber: agentData.phoneNumber,
            businessType: userData.user.businessType,
            metaDocument: agentData.metaDocument,
            config: agentData.config
        };
        
        console.log('Creando agente con datos:', requestData);
        
        // Enviar al servidor
        const response = await fetch('/api/agents', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            credentials: 'include',
            body: JSON.stringify(requestData)
        });
        
        const result = await response.json();
        
        if (response.ok) {
            // Éxito
            document.getElementById('loadingOverlay').style.display = 'none';
            document.getElementById('successModal').style.display = 'flex';
        } else {
            throw new Error(result.error || 'Error al crear el agente');
        }
        
    } catch (error) {
        console.error('Error creando bot:', error);
        document.getElementById('loadingOverlay').style.display = 'none';
        showNotification(error.message || 'Error al crear el agente. Intenta de nuevo.', 'error');
        btn.disabled = false;
    }
}

// ===========================================
// NOTIFICATIONS
// ===========================================

function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.innerHTML = `
        <div class="notification-content">
            <span class="notification-icon">${getNotificationIcon(type)}</span>
            <span class="notification-message">${message}</span>
            <button class="notification-close" onclick="this.parentElement.parentElement.remove()">×</button>
        </div>
    `;
    
    if (!document.getElementById('notification-styles')) {
        addNotificationStyles();
    }
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.classList.add('show');
    }, 100);
    
    setTimeout(() => {
        notification.remove();
    }, 5000);
}

function getNotificationIcon(type) {
    const icons = {
        success: '✅',
        error: '❌',
        warning: '⚠️',
        info: 'ℹ️'
    };
    return icons[type] || icons.info;
}

function addNotificationStyles() {
    const styles = document.createElement('style');
    styles.id = 'notification-styles';
    styles.textContent = `
        .notification {
            position: fixed;
            top: 100px;
            right: 20px;
            background: white;
            border-radius: 12px;
            box-shadow: 0 10px 40px rgba(0, 0, 0, 0.1);
            z-index: 10000;
            transform: translateX(100%);
            transition: all 0.3s ease;
            opacity: 0;
            max-width: 400px;
            border-left: 4px solid #667eea;
        }
        .notification.show {
            transform: translateX(0);
            opacity: 1;
        }
        .notification-success {
            border-left-color: #10b981;
        }
        .notification-error {
            border-left-color: #ef4444;
        }
        .notification-warning {
            border-left-color: #f59e0b;
        }
        .notification-content {
            padding: 1rem 1.5rem;
            display: flex;
            align-items: center;
            gap: 0.75rem;
        }
        .notification-icon {
            font-size: 1.2rem;
            flex-shrink: 0;
        }
        .notification-message {
            flex: 1;
            font-weight: 500;
            color: #374151;
        }
        .notification-close {
            background: none;
            border: none;
            font-size: 1.5rem;
            cursor: pointer;
            color: #6b7280;
            padding: 0;
            width: 20px;
            height: 20px;
            display: flex;
            align-items: center;
            justify-content: center;
            border-radius: 50%;
            transition: all 0.2s ease;
        }
        .notification-close:hover {
            background: #f3f4f6;
            color: #374151;
        }
    `;
    document.head.appendChild(styles);
}

console.log('✅ Onboarding JavaScript cargado');