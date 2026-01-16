// Appointments functionality - ACTUALIZADO con vista de TABLA
let appointments = [];
let agents = [];
let currentView = 'list';
let currentFilters = {
    status: 'all',
    agent: 'all',
    date: 'all',
    search: ''
};
let openDropdown = null;

document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 Inicializando página de citas...');
    initializeAppointments();
    setupEventListeners();
    
    // Cerrar dropdowns al hacer clic fuera
    document.addEventListener('click', function(e) {
        if (!e.target.closest('.actions-dropdown')) {
            closeAllDropdowns();
        }
    });
});

async function initializeAppointments() {
    await loadAgents();
    await loadAppointments();
    updateStats();
    renderAppointments();
}

function setupEventListeners() {
    // View toggle
    document.querySelectorAll('.view-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            document.querySelectorAll('.view-btn').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            currentView = this.dataset.view;
            toggleView();
        });
    });

    // Filters
    document.getElementById('statusFilter').addEventListener('change', function() {
        currentFilters.status = this.value;
        renderAppointments();
    });

    document.getElementById('agentFilter').addEventListener('change', function() {
        currentFilters.agent = this.value;
        renderAppointments();
    });

    document.getElementById('dateFilter').addEventListener('change', function() {
        currentFilters.date = this.value;
        renderAppointments();
    });

    document.getElementById('searchInput').addEventListener('input', function() {
        currentFilters.search = this.value.toLowerCase();
        renderAppointments();
    });

    // Create appointment button - Abrir modal
    document.getElementById('createAppointmentBtn').addEventListener('click', function() {
        openCreateAppointmentModal();
    });

    // Calendar navigation
    const prevMonth = document.getElementById('prevMonth');
    const nextMonth = document.getElementById('nextMonth');
    
    if (prevMonth) {
        prevMonth.addEventListener('click', () => changeMonth(-1));
    }
    
    if (nextMonth) {
        nextMonth.addEventListener('click', () => changeMonth(1));
    }
}

// Función para abrir modal de crear cita
function openCreateAppointmentModal() {
    const modal = document.getElementById('appointmentModal');
    const modalTitle = document.getElementById('modalTitle');
    const modalBody = document.getElementById('modalBody');
    
    modalTitle.innerHTML = '<i class="lni lni-calendar-plus" style="color: #06b6d4;"></i> Nueva Cita';
    
    modalBody.innerHTML = `
        <form id="createAppointmentForm" class="appointment-form">
            <div class="form-grid">
                <!-- Cliente -->
                <div class="form-group full-width">
                    <label class="form-label">
                        <i class="lni lni-user"></i>
                        Nombre del Cliente
                    </label>
                    <input type="text" 
                           class="form-input" 
                           id="clientName" 
                           required>
                </div>

                <!-- Teléfono -->
                <div class="form-group">
                    <label class="form-label">
                        <i class="lni lni-phone"></i>
                        Teléfono
                    </label>
                    <input type="tel" 
                           class="form-input" 
                           id="clientPhone">
                </div>

                <!-- Servicio -->
                <div class="form-group">
                    <label class="form-label">
                        <i class="lni lni-briefcase"></i>
                        Servicio
                    </label>
                    <input type="text" 
                           class="form-input" 
                           id="serviceName" 
                           required>
                </div>

                <!-- Trabajador/Especialista -->
                <div class="form-group">
                    <label class="form-label">
                        <i class="lni lni-user"></i>
                        Trabajador/Especialista
                    </label>
                    <input type="text" 
                           class="form-input" 
                           id="workerName">
                </div>

                <!-- Agente - Dropdown personalizado -->
                <div class="form-group">
                    <label class="form-label">
                        <i class="lni lni-database"></i>
                        Agente
                    </label>
                    <div class="custom-dropdown-wrapper" id="agentDropdownWrapper">
                        <input type="text" 
                               class="form-input form-dropdown" 
                               id="agentSelectDisplay" 
                               readonly
                               required>
                        <i class="lni lni-chevron-down dropdown-arrow"></i>
                        <div class="dropdown-menu">
                            <div class="dropdown-options" id="agentOptions"></div>
                        </div>
                    </div>
                    <input type="hidden" id="agentSelect" required>
                </div>

                <!-- Fecha -->
                <div class="form-group">
                    <label class="form-label">
                        <i class="lni lni-calendar"></i>
                        Fecha
                    </label>
                    <input type="date" 
                           class="form-input" 
                           id="appointmentDate" 
                           required>
                </div>

                <!-- Hora - Dropdown personalizado -->
                <div class="form-group">
                    <label class="form-label">
                        <i class="lni lni-clock"></i>
                        Hora
                    </label>
                    <div class="custom-dropdown-wrapper" id="timeDropdownWrapper">
                        <input type="text" 
                               class="form-input form-dropdown" 
                               id="timeSelectDisplay" 
                               readonly
                               required>
                        <i class="lni lni-chevron-down dropdown-arrow"></i>
                        <div class="dropdown-menu">
                            <div class="dropdown-options" id="timeOptions"></div>
                        </div>
                    </div>
                    <input type="hidden" id="appointmentTime" required>
                </div>

                <!-- Estado - Dropdown personalizado -->
                <div class="form-group">
                    <label class="form-label">
                        <i class="lni lni-checkmark-circle"></i>
                        Estado
                    </label>
                    <div class="custom-dropdown-wrapper" id="statusDropdownWrapper">
                        <input type="text" 
                               class="form-input form-dropdown" 
                               id="statusSelectDisplay" 
                               readonly
                               required>
                        <i class="lni lni-chevron-down dropdown-arrow"></i>
                        <div class="dropdown-menu">
                            <div class="dropdown-options" id="statusOptions">
                                <div class="dropdown-option" data-value="pending">
                                    <i class="lni lni-timer"></i>
                                    <span>Pendiente</span>
                                </div>
                                <div class="dropdown-option" data-value="confirmed">
                                    <i class="lni lni-checkmark-circle"></i>
                                    <span>Confirmada</span>
                                </div>
                                <div class="dropdown-option" data-value="completed">
                                    <i class="lni lni-check"></i>
                                    <span>Completada</span>
                                </div>
                                <div class="dropdown-option" data-value="cancelled">
                                    <i class="lni lni-close"></i>
                                    <span>Cancelada</span>
                                </div>
                            </div>
                        </div>
                    </div>
                    <input type="hidden" id="appointmentStatus" value="confirmed" required>
                </div>
            </div>

            <!-- Botones -->
            <div class="form-actions">
                <button type="button" 
                        class="btn-cancel" 
                        onclick="closeAppointmentModal()">
                    <i class="lni lni-close"></i>
                    <span>Cancelar</span>
                </button>
                <button type="submit" 
                        class="btn-submit">
                    <i class="lni lni-checkmark"></i>
                    <span>Crear Cita</span>
                </button>
            </div>
        </form>
    `;
    
    // Inicializar dropdowns personalizados
    initAgentDropdown();
    initTimeDropdown();
    initStatusDropdown();
    
    // Establecer fecha mínima (hoy)
    const dateInput = document.getElementById('appointmentDate');
    const today = new Date().toISOString().split('T')[0];
    dateInput.min = today;
    dateInput.value = today;
    
    // Event listener para el submit del formulario
    document.getElementById('createAppointmentForm').addEventListener('submit', handleCreateAppointment);
    
    modal.classList.add('active');
}

// Inicializar dropdown de agentes
function initAgentDropdown() {
    const wrapper = document.getElementById('agentDropdownWrapper');
    const display = document.getElementById('agentSelectDisplay');
    const hidden = document.getElementById('agentSelect');
    const optionsContainer = document.getElementById('agentOptions');
    
    if (!wrapper || !display || !optionsContainer) return;
    
    // Poblar opciones
    optionsContainer.innerHTML = '';
    agents.forEach(agent => {
        const option = document.createElement('div');
        option.className = 'dropdown-option';
        option.setAttribute('data-value', agent.id);
        option.innerHTML = `
            <i class="lni lni-database"></i>
            <span>${agent.name}</span>
        `;
        optionsContainer.appendChild(option);
    });
    
    setupCustomDropdown(wrapper, display, hidden, 'Selecciona un agente');
}

// Inicializar dropdown de horas
function initTimeDropdown() {
    const wrapper = document.getElementById('timeDropdownWrapper');
    const display = document.getElementById('timeSelectDisplay');
    const hidden = document.getElementById('appointmentTime');
    const optionsContainer = document.getElementById('timeOptions');
    
    if (!wrapper || !display || !optionsContainer) return;
    
    // Generar horas cada 15 minutos
    optionsContainer.innerHTML = '';
    for (let h = 0; h < 24; h++) {
        for (let m = 0; m < 60; m += 15) {
            const hour24 = String(h).padStart(2, '0');
            const minute = String(m).padStart(2, '0');
            const time24 = `${hour24}:${minute}`;
            
            // Convertir a formato 12h
            const hour12 = h === 0 ? 12 : (h > 12 ? h - 12 : h);
            const period = h >= 12 ? 'PM' : 'AM';
            const time12 = `${String(hour12).padStart(2, '0')}:${minute} ${period}`;
            
            const option = document.createElement('div');
            option.className = 'dropdown-option';
            option.setAttribute('data-value', time24);
            option.innerHTML = `
                <i class="lni lni-clock"></i>
                <span>${time12}</span>
            `;
            optionsContainer.appendChild(option);
        }
    }
    
    // Establecer hora actual redondeada
    const now = new Date();
    const currentHour = String(now.getHours()).padStart(2, '0');
    const currentMinute = String(Math.ceil(now.getMinutes() / 15) * 15).padStart(2, '0');
    const defaultTime = `${currentHour}:${currentMinute === '60' ? '00' : currentMinute}`;
    
    setupCustomDropdown(wrapper, display, hidden, 'Selecciona una hora', defaultTime);
}

// Inicializar dropdown de estado
function initStatusDropdown() {
    const wrapper = document.getElementById('statusDropdownWrapper');
    const display = document.getElementById('statusSelectDisplay');
    const hidden = document.getElementById('appointmentStatus');
    
    if (!wrapper || !display) return;
    
    setupCustomDropdown(wrapper, display, hidden, 'Selecciona un estado', 'confirmed');
}

// Configurar dropdown personalizado
function setupCustomDropdown(wrapper, display, hidden, placeholder, defaultValue = '') {
    const dropdown = wrapper.querySelector('.dropdown-menu');
    const options = wrapper.querySelectorAll('.dropdown-option');
    
    // Click en el display para abrir/cerrar
    display.addEventListener('click', function(e) {
        e.stopPropagation();
        
        // Cerrar otros dropdowns
        document.querySelectorAll('.custom-dropdown-wrapper.active').forEach(w => {
            if (w !== wrapper) {
                w.classList.remove('active');
            }
        });
        
        wrapper.classList.toggle('active');
    });
    
    // Click en opciones
    options.forEach(option => {
        option.addEventListener('click', function(e) {
            e.stopPropagation();
            
            const value = this.getAttribute('data-value');
            const text = this.querySelector('span').textContent;
            
            display.value = text;
            hidden.value = value;
            
            // Marcar como seleccionada
            options.forEach(opt => opt.classList.remove('selected'));
            this.classList.add('selected');
            
            wrapper.classList.remove('active');
        });
    });
    
    // Cerrar al hacer click fuera
    document.addEventListener('click', function(e) {
        if (!wrapper.contains(e.target)) {
            wrapper.classList.remove('active');
        }
    });
    
    // Establecer valor por defecto
    if (defaultValue) {
        const defaultOption = wrapper.querySelector(`[data-value="${defaultValue}"]`);
        if (defaultOption) {
            const text = defaultOption.querySelector('span').textContent;
            display.value = text;
            hidden.value = defaultValue;
            defaultOption.classList.add('selected');
        }
    } else {
        display.placeholder = placeholder;
    }
}

// Manejar creación de cita
async function handleCreateAppointment(e) {
    e.preventDefault();
    
    const formData = {
        client: document.getElementById('clientName').value,
        phone: document.getElementById('clientPhone').value,
        service: document.getElementById('serviceName').value,
        worker: document.getElementById('workerName').value,
        agentId: parseInt(document.getElementById('agentSelect').value),
        date: document.getElementById('appointmentDate').value,
        time: document.getElementById('appointmentTime').value,
        status: document.getElementById('appointmentStatus').value
    };
    
    // Validar que se haya seleccionado un agente
    if (!formData.agentId) {
        showNotification('Por favor selecciona un agente', 'error');
        return;
    }
    
    // Mostrar loading en el botón
    const submitBtn = e.target.querySelector('.btn-submit');
    const originalHTML = submitBtn.innerHTML;
    submitBtn.innerHTML = `
        <div class="loading-spinner-small"></div>
        <span>Creando...</span>
    `;
    submitBtn.disabled = true;
    
    try {
        // Simular creación (aquí iría la llamada real al API)
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Agregar la cita a la lista local
        const newAppointment = {
            id: `temp-${Date.now()}`,
            ...formData,
            agentName: agents.find(a => a.id === formData.agentId)?.name || 'Agente desconocido'
        };
        
        appointments.unshift(newAppointment);
        
        // Actualizar la UI
        updateStats();
        renderAppointments();
        hideEmptyState();
        
        // Cerrar modal
        closeAppointmentModal();
        
        // Mostrar notificación de éxito
        showNotification('✅ Cita creada exitosamente', 'success');
        
        console.log('✅ Nueva cita creada:', newAppointment);
        
    } catch (error) {
        console.error('❌ Error al crear cita:', error);
        showNotification('❌ Error al crear la cita', 'error');
        
        // Restaurar botón
        submitBtn.innerHTML = originalHTML;
        submitBtn.disabled = false;
    }
}

async function loadAgents() {
    try {
        console.log('📋 Cargando agentes...');
        const response = await fetch('/api/agents', {
            credentials: 'include'
        });
        
        if (!response.ok) {
            throw new Error('Error al cargar agentes');
        }
        
        const data = await response.json();
        
        if (data.agents) {
            agents = data.agents;
            console.log(`✅ ${agents.length} agentes cargados`);
            populateAgentFilter();
        }
    } catch (error) {
        console.error('❌ Error loading agents:', error);
    }
}

function populateAgentFilter() {
    const agentFilter = document.getElementById('agentFilter');
    
    // Limpiar opciones existentes (excepto "Todos")
    while (agentFilter.options.length > 1) {
        agentFilter.remove(1);
    }
    
    agents.forEach(agent => {
        const option = document.createElement('option');
        option.value = agent.id;
        option.textContent = agent.name;
        agentFilter.appendChild(option);
    });
}

async function loadAppointments() {
    try {
        console.log('📊 Cargando citas desde Google Sheets...');
        
        const response = await fetch('/api/appointments', {
            credentials: 'include'
        });
        
        if (!response.ok) {
            throw new Error(`Error HTTP: ${response.status}`);
        }
        
        const data = await response.json();
        appointments = data.appointments || [];
        
        console.log(`✅ ${appointments.length} citas cargadas desde Sheets`);
        console.log('📋 Citas:', appointments);
        
        // Si no hay citas, mostrar estado vacío
        if (appointments.length === 0) {
            showEmptyState();
        } else {
            hideEmptyState();
        }
        
    } catch (error) {
        console.error('❌ Error cargando citas:', error);
        showNotification('Error al cargar las citas. Verifica que tus agentes tengan Google Sheets conectado.', 'error');
        appointments = [];
        showEmptyState();
    }
}

function showEmptyState() {
    const emptyState = document.getElementById('emptyState');
    const appointmentsList = document.getElementById('appointmentsList');
    
    if (emptyState) emptyState.style.display = 'flex';
    if (appointmentsList) appointmentsList.innerHTML = '';
}

function hideEmptyState() {
    const emptyState = document.getElementById('emptyState');
    if (emptyState) emptyState.style.display = 'none';
}

function updateStats() {
    const today = new Date().toISOString().split('T')[0];
    
    // Citas de hoy
    const todayAppointments = appointments.filter(a => a.date === today).length;
    
    // ✅ Citas canceladas - detectar por status
    const cancelled = appointments.filter(a => a.status === 'cancelled').length;
    
    // ✅ Citas confirmadas (excluyendo las canceladas)
    const confirmed = appointments.filter(a => a.status === 'confirmed').length;
    
    // Total de citas
    const total = appointments.length;
    
    document.getElementById('totalAppointments').textContent = todayAppointments;
    document.getElementById('confirmedAppointments').textContent = confirmed;
    document.getElementById('pendingAppointments').textContent = cancelled;
    document.getElementById('totalClients').textContent = total;
}

function filterAppointments() {
    let filtered = [...appointments];
    
    // Filter by status
    if (currentFilters.status !== 'all') {
        filtered = filtered.filter(a => a.status === currentFilters.status);
    }
    
    // Filter by agent
    if (currentFilters.agent !== 'all') {
        filtered = filtered.filter(a => a.agentId === parseInt(currentFilters.agent));
    }
    
    // Filter by date
    if (currentFilters.date !== 'all') {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        filtered = filtered.filter(a => {
            const appointmentDate = new Date(a.date);
            appointmentDate.setHours(0, 0, 0, 0);
            
            switch (currentFilters.date) {
                case 'today':
                    return appointmentDate.getTime() === today.getTime();
                case 'tomorrow':
                    const tomorrow = new Date(today);
                    tomorrow.setDate(tomorrow.getDate() + 1);
                    return appointmentDate.getTime() === tomorrow.getTime();
                case 'week':
                    const weekEnd = new Date(today);
                    weekEnd.setDate(weekEnd.getDate() + 7);
                    return appointmentDate >= today && appointmentDate <= weekEnd;
                case 'month':
                    const monthEnd = new Date(today);
                    monthEnd.setMonth(monthEnd.getMonth() + 1);
                    return appointmentDate >= today && appointmentDate <= monthEnd;
                default:
                    return true;
            }
        });
    }
    
    // Filter by search
    if (currentFilters.search) {
        filtered = filtered.filter(a => 
            a.client.toLowerCase().includes(currentFilters.search) ||
            a.service.toLowerCase().includes(currentFilters.search) ||
            (a.phone && a.phone.toLowerCase().includes(currentFilters.search)) ||
            a.date.includes(currentFilters.search)
        );
    }
    
    return filtered;
}

function renderAppointments() {
    const filtered = filterAppointments();
    const appointmentsList = document.getElementById('appointmentsList');
    
    if (filtered.length === 0) {
        appointmentsList.innerHTML = `
            <tr>
                <td colspan="9" style="text-align: center; padding: 3rem; color: #6b7280;">
                    <i class="lni lni-search-alt" style="font-size: 3rem; margin-bottom: 1rem; opacity: 0.5; display: block;"></i>
                    <p style="font-size: 1.125rem; font-weight: 600; margin-bottom: 0.5rem;">No se encontraron citas</p>
                    <p style="font-size: 0.875rem;">Intenta ajustar los filtros</p>
                </td>
            </tr>
        `;
        return;
    }
    
    // Ordenar por fecha y hora (más recientes primero)
    filtered.sort((a, b) => {
        const dateA = new Date(a.date + ' ' + a.time);
        const dateB = new Date(b.date + ' ' + b.time);
        return dateB - dateA;
    });
    
    appointmentsList.innerHTML = filtered.map(appointment => createTableRow(appointment)).join('');
}

function createTableRow(appointment) {
    const agent = agents.find(a => a.id === appointment.agentId);
    const agentName = agent ? agent.name : appointment.agentName || 'Agente desconocido';
    
    const date = new Date(appointment.date);
    const formattedDate = date.toLocaleDateString('es-MX', { 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric' 
    });
    
    return `
        <tr>
            <td>
                <div class="table-client">
                    <i class="lni lni-user"></i>
                    <span>${escapeHtml(appointment.client)}</span>
                </div>
            </td>
            <td>
                <div class="table-phone">
                    ${appointment.phone ? `<a href="tel:${appointment.phone}">${escapeHtml(appointment.phone)}</a>` : '-'}
                </div>
            </td>
            <td>
                <div class="table-service">${escapeHtml(appointment.service)}</div>
            </td>
            <td>
                ${appointment.worker ? `
                <div class="table-worker">
                    <i class="lni lni-user"></i>
                    <span>${escapeHtml(appointment.worker)}</span>
                </div>
                ` : '<span style="color: #9ca3af;">-</span>'}
            </td>
            <td>
                <div class="table-date">${formattedDate}</div>
            </td>
            <td>
                <div class="table-time">${formatTime(appointment.time)}</div>
            </td>
            <td>
                <div class="table-agent">
                    <i class="lni lni-database"></i>
                    <span>${escapeHtml(agentName)}</span>
                </div>
            </td>
            <td>
                <span class="appointment-status status-${appointment.status}">
                    ${getStatusText(appointment.status)}
                </span>
            </td>
            <td>
                <div class="actions-dropdown">
                    <button class="actions-btn" onclick="toggleDropdown(event, '${appointment.id}')">
                        <i class="lni lni-more-alt"></i>
                    </button>
                    <div class="actions-menu" id="dropdown-${appointment.id}">
                        ${appointment.sheetUrl ? `
                        <div class="action-item sheet" onclick="openGoogleSheet('${appointment.sheetUrl}')">
                            <i class="lni lni-text-format"></i>
                            <span>Ver en Google Sheet</span>
                        </div>
                        ` : ''}
                        ${appointment.phone ? `
                        <div class="action-item whatsapp" onclick="sendWhatsApp('${appointment.phone}', '${escapeHtml(appointment.client)}')">
                            <i class="lni lni-whatsapp"></i>
                            <span>Enviar WhatsApp</span>
                        </div>
                        ` : ''}
                    </div>
                </div>
            </td>
        </tr>
    `;
}

function toggleDropdown(event, appointmentId) {
    event.stopPropagation();
    
    const dropdown = document.getElementById(`dropdown-${appointmentId}`);
    
    // Cerrar otros dropdowns
    if (openDropdown && openDropdown !== dropdown) {
        openDropdown.classList.remove('active');
    }
    
    // Toggle el dropdown actual
    dropdown.classList.toggle('active');
    openDropdown = dropdown.classList.contains('active') ? dropdown : null;
}

function closeAllDropdowns() {
    document.querySelectorAll('.actions-menu').forEach(menu => {
        menu.classList.remove('active');
    });
    openDropdown = null;
}

function openGoogleSheet(url) {
    window.open(url, '_blank');
    closeAllDropdowns();
}

function sendWhatsApp(phone, clientName) {
    // Limpiar el número de teléfono
    const cleanPhone = phone.replace(/\D/g, '');
    
    // Mensaje predeterminado
    const message = encodeURIComponent(`Hola ${clientName}, te contacto desde Attomos respecto a tu cita.`);
    
    // Abrir WhatsApp
    window.open(`https://wa.me/${cleanPhone}?text=${message}`, '_blank');
    
    closeAllDropdowns();
}

function formatTime(time) {
    // Convertir de formato 24h a 12h con AM/PM
    if (!time) return '';
    
    const [hours, minutes] = time.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour > 12 ? hour - 12 : (hour === 0 ? 12 : hour);
    
    return `${displayHour}:${minutes || '00'} ${ampm}`;
}

function getStatusText(status) {
    const statusMap = {
        'confirmed': 'Confirmada',
        'pending': 'Pendiente',
        'cancelled': 'Cancelada',
        'completed': 'Completada'
    };
    return statusMap[status] || 'Desconocido';
}

function toggleView() {
    const listView = document.getElementById('appointmentsListView');
    const calendarView = document.getElementById('calendarView');
    
    if (currentView === 'list') {
        listView.style.display = 'block';
        calendarView.style.display = 'none';
    } else {
        listView.style.display = 'none';
        calendarView.style.display = 'block';
        renderCalendar();
    }
}

let currentMonth = new Date().getMonth();
let currentYear = new Date().getFullYear();

function renderCalendar() {
    const calendarGrid = document.getElementById('calendarGrid');
    const monthTitle = document.getElementById('calendarMonth');
    
    const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 
                        'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
    
    monthTitle.textContent = `${monthNames[currentMonth]} ${currentYear}`;
    
    calendarGrid.innerHTML = '';
    
    // Day headers
    const dayHeaders = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
    dayHeaders.forEach(day => {
        const header = document.createElement('div');
        header.className = 'calendar-day-header';
        header.textContent = day;
        calendarGrid.appendChild(header);
    });
    
    // Get first day and total days
    const firstDay = new Date(currentYear, currentMonth, 1).getDay();
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    
    // Empty cells before first day
    for (let i = 0; i < firstDay; i++) {
        const emptyCell = document.createElement('div');
        calendarGrid.appendChild(emptyCell);
    }
    
    // Days of month
    for (let day = 1; day <= daysInMonth; day++) {
        const dayCell = document.createElement('div');
        dayCell.className = 'calendar-day';
        
        const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const dayAppointments = appointments.filter(a => a.date === dateStr);
        
        if (dayAppointments.length > 0) {
            dayCell.classList.add('has-appointments');
            
            dayCell.onclick = () => {
                showDayAppointments(dateStr, dayAppointments);
            };
        }
        
        dayCell.innerHTML = `
            <div class="calendar-day-number">${day}</div>
            ${dayAppointments.length > 0 ? `<div class="calendar-day-count">${dayAppointments.length}</div>` : ''}
        `;
        
        calendarGrid.appendChild(dayCell);
    }
}

function showDayAppointments(dateStr, dayAppointments) {
    if (dayAppointments.length === 0) return;
    
    const modal = document.getElementById('appointmentModal');
    const modalBody = document.getElementById('modalBody');
    const modalTitle = document.getElementById('modalTitle');
    
    const date = new Date(dateStr);
    const formattedDate = date.toLocaleDateString('es-MX', { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
    });
    
    modalTitle.textContent = `Citas del ${formattedDate}`;
    
    let appointmentsHtml = `
        <div style="display: flex; flex-direction: column; gap: 1rem;">
    `;
    
    // Ordenar por hora
    dayAppointments.sort((a, b) => a.time.localeCompare(b.time));
    
    dayAppointments.forEach(appointment => {
        const agent = agents.find(a => a.id === appointment.agentId);
        const agentName = agent ? agent.name : appointment.agentName || 'Agente desconocido';
        
        appointmentsHtml += `
            <div style="padding: 1.5rem; background: #f9fafb; border-radius: 12px; border: 2px solid #e5e7eb; cursor: pointer; transition: all 0.3s ease;" 
                 onclick="closeAppointmentModal();"
                 onmouseover="this.style.borderColor='#06b6d4'; this.style.background='#ffffff';"
                 onmouseout="this.style.borderColor='#e5e7eb'; this.style.background='#f9fafb';">
                <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.75rem;">
                    <div>
                        <div style="font-size: 1.125rem; font-weight: 700; color: #1a1a1a; margin-bottom: 0.25rem;">
                            <i class="lni lni-user"></i> ${escapeHtml(appointment.client)}
                        </div>
                        <div style="font-size: 0.875rem; color: #6b7280; font-weight: 600;">
                            ${escapeHtml(appointment.service)}
                        </div>
                    </div>
                    <span class="appointment-status status-${appointment.status}">
                        ${getStatusText(appointment.status)}
                    </span>
                </div>
                <div style="display: flex; gap: 1.5rem; flex-wrap: wrap; font-size: 0.875rem; color: #374151;">
                    <div style="display: flex; align-items: center; gap: 0.5rem;">
                        <i class="lni lni-clock" style="color: #06b6d4;"></i>
                        <span>${formatTime(appointment.time)}</span>
                    </div>
                    ${appointment.worker ? `
                    <div style="display: flex; align-items: center; gap: 0.5rem;">
                        <i class="lni lni-user" style="color: #06b6d4;"></i>
                        <span>${escapeHtml(appointment.worker)}</span>
                    </div>
                    ` : ''}
                    ${appointment.phone ? `
                    <div style="display: flex; align-items: center; gap: 0.5rem;">
                        <i class="lni lni-phone" style="color: #06b6d4;"></i>
                        <span>${escapeHtml(appointment.phone)}</span>
                    </div>
                    ` : ''}
                </div>
                <div style="margin-top: 0.75rem; font-size: 0.75rem; color: #9ca3af;">
                    <i class="lni lni-database"></i> ${escapeHtml(agentName)}
                </div>
            </div>
        `;
    });
    
    appointmentsHtml += `</div>`;
    
    modalBody.innerHTML = appointmentsHtml;
    modal.classList.add('active');
}

function changeMonth(delta) {
    currentMonth += delta;
    
    if (currentMonth > 11) {
        currentMonth = 0;
        currentYear++;
    } else if (currentMonth < 0) {
        currentMonth = 11;
        currentYear--;
    }
    
    renderCalendar();
}

function closeAppointmentModal() {
    const modal = document.getElementById('appointmentModal');
    modal.classList.remove('active');
}

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

// Add CSS animations
const style = document.createElement('style');
style.textContent = `
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