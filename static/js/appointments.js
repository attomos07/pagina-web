// Appointments functionality - ACTUALIZADO para Google Sheets
let appointments = [];
let agents = [];
let currentView = 'list';
let currentFilters = {
    status: 'all',
    agent: 'all',
    date: 'all',
    search: ''
};

document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 Inicializando página de citas...');
    initializeAppointments();
    setupEventListeners();
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

    // Create appointment button
    document.getElementById('createAppointmentBtn').addEventListener('click', function() {
        showNotification('Las citas se crean automáticamente desde WhatsApp', 'info');
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

    // Modal overlay close
    const modalOverlay = document.querySelector('.modal-overlay');
    if (modalOverlay) {
        modalOverlay.addEventListener('click', closeAppointmentModal);
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
    
    // Citas confirmadas
    const confirmed = appointments.filter(a => a.status === 'confirmed').length;
    
    // Citas canceladas
    const cancelled = appointments.filter(a => a.status === 'cancelled').length;
    
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
            <div style="text-align: center; padding: 3rem; color: #6b7280;">
                <i class="lni lni-search-alt" style="font-size: 3rem; margin-bottom: 1rem; opacity: 0.5;"></i>
                <p style="font-size: 1.125rem; font-weight: 600;">No se encontraron citas</p>
                <p style="font-size: 0.875rem; margin-top: 0.5rem;">Intenta ajustar los filtros</p>
            </div>
        `;
        return;
    }
    
    // Ordenar por fecha y hora (más recientes primero)
    filtered.sort((a, b) => {
        const dateA = new Date(a.date + ' ' + a.time);
        const dateB = new Date(b.date + ' ' + b.time);
        return dateB - dateA;
    });
    
    appointmentsList.innerHTML = filtered.map(appointment => createAppointmentCard(appointment)).join('');
}

function createAppointmentCard(appointment) {
    const agent = agents.find(a => a.id === appointment.agentId);
    const agentName = agent ? agent.name : appointment.agentName || 'Agente desconocido';
    
    const date = new Date(appointment.date);
    const formattedDate = date.toLocaleDateString('es-MX', { 
        weekday: 'short', 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric' 
    });
    
    return `
        <div class="appointment-card" onclick='showAppointmentDetails(${JSON.stringify(appointment)})'>
            <div class="appointment-header">
                <div class="appointment-client">
                    <i class="lni lni-user"></i>
                    <span>${escapeHtml(appointment.client)}</span>
                </div>
                <span class="appointment-status status-${appointment.status}">
                    ${getStatusText(appointment.status)}
                </span>
            </div>
            
            <div class="appointment-body">
                <div class="appointment-info">
                    <div class="info-item">
                        <i class="lni lni-cut"></i>
                        <span>${escapeHtml(appointment.service)}</span>
                    </div>
                    
                    ${appointment.worker ? `
                    <div class="info-item">
                        <i class="lni lni-user"></i>
                        <span>Con: ${escapeHtml(appointment.worker)}</span>
                    </div>
                    ` : ''}
                    
                    <div class="info-item">
                        <i class="lni lni-calendar"></i>
                        <span>${formattedDate}</span>
                    </div>
                    
                    <div class="info-item">
                        <i class="lni lni-clock"></i>
                        <span>${formatTime(appointment.time)}</span>
                    </div>
                    
                    ${appointment.phone ? `
                    <div class="info-item">
                        <i class="lni lni-phone"></i>
                        <span>${escapeHtml(appointment.phone)}</span>
                    </div>
                    ` : ''}
                </div>
                
                <div class="appointment-agent">
                    <i class="lni lni-database"></i>
                    <span>${escapeHtml(agentName)}</span>
                </div>
            </div>
            
            ${appointment.sheetUrl ? `
            <div class="appointment-footer">
                <a href="${appointment.sheetUrl}" target="_blank" class="sheet-link" onclick="event.stopPropagation()">
                    <i class="lni lni-text-format"></i>
                    <span>Ver en Google Sheets</span>
                </a>
            </div>
            ` : ''}
        </div>
    `;
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

function showAppointmentDetails(appointment) {
    const modal = document.getElementById('appointmentModal');
    const modalBody = document.getElementById('modalBody');
    const modalTitle = document.getElementById('modalTitle');
    
    const agent = agents.find(a => a.id === appointment.agentId);
    const agentName = agent ? agent.name : appointment.agentName || 'Agente desconocido';
    
    const date = new Date(appointment.date);
    const formattedDate = date.toLocaleDateString('es-MX', { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
    });
    
    modalTitle.textContent = 'Detalles de la Cita';
    
    modalBody.innerHTML = `
        <div class="appointment-details">
            <div class="detail-section">
                <h4><i class="lni lni-user"></i> Cliente</h4>
                <p>${escapeHtml(appointment.client)}</p>
            </div>
            
            ${appointment.phone ? `
            <div class="detail-section">
                <h4><i class="lni lni-phone"></i> Teléfono</h4>
                <p><a href="tel:${appointment.phone}">${escapeHtml(appointment.phone)}</a></p>
            </div>
            ` : ''}
            
            <div class="detail-section">
                <h4><i class="lni lni-cut"></i> Servicio</h4>
                <p>${escapeHtml(appointment.service)}</p>
            </div>
            
            ${appointment.worker ? `
            <div class="detail-section">
                <h4><i class="lni lni-user"></i> Trabajador</h4>
                <p>${escapeHtml(appointment.worker)}</p>
            </div>
            ` : ''}
            
            <div class="detail-section">
                <h4><i class="lni lni-calendar"></i> Fecha</h4>
                <p>${formattedDate}</p>
            </div>
            
            <div class="detail-section">
                <h4><i class="lni lni-clock"></i> Hora</h4>
                <p>${formatTime(appointment.time)} (${appointment.duration || 60} minutos)</p>
            </div>
            
            <div class="detail-section">
                <h4><i class="lni lni-database"></i> Agente</h4>
                <p>${escapeHtml(agentName)}</p>
            </div>
            
            <div class="detail-section">
                <h4><i class="lni lni-checkmark-circle"></i> Estado</h4>
                <p><span class="appointment-status status-${appointment.status}">${getStatusText(appointment.status)}</span></p>
            </div>
            
            ${appointment.sheetUrl ? `
            <div class="detail-section">
                <h4><i class="lni lni-text-format"></i> Google Sheet</h4>
                <p>
                    <a href="${appointment.sheetUrl}" target="_blank" class="sheet-link">
                        Abrir en Google Sheets
                        <i class="lni lni-arrow-right"></i>
                    </a>
                </p>
                <p style="font-size: 0.875rem; color: #6b7280; margin-top: 0.5rem;">
                    Celda: ${appointment.sheetCell}
                </p>
            </div>
            ` : ''}
        </div>
        
        <div class="modal-actions" style="margin-top: 2rem; display: flex; gap: 1rem; justify-content: flex-end;">
            <button class="btn-secondary" onclick="closeAppointmentModal()">
                Cerrar
            </button>
        </div>
    `;
    
    modal.classList.add('active');
}

function closeAppointmentModal() {
    const modal = document.getElementById('appointmentModal');
    modal.classList.remove('active');
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
                 onclick="closeAppointmentModal(); setTimeout(() => showAppointmentDetails(${JSON.stringify(appointment).replace(/"/g, '&quot;')}), 100);"
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
    
    .appointment-card {
        background: white;
        border-radius: 12px;
        padding: 1.5rem;
        border: 2px solid #e5e7eb;
        cursor: pointer;
        transition: all 0.3s ease;
        margin-bottom: 1rem;
    }
    
    .appointment-card:hover {
        border-color: #06b6d4;
        box-shadow: 0 4px 12px rgba(6, 182, 212, 0.15);
        transform: translateY(-2px);
    }
    
    .appointment-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 1rem;
        padding-bottom: 1rem;
        border-bottom: 1px solid #e5e7eb;
    }
    
    .appointment-client {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        font-size: 1.125rem;
        font-weight: 700;
        color: #1a1a1a;
    }
    
    .appointment-client i {
        color: #06b6d4;
        font-size: 1.25rem;
    }
    
    .appointment-status {
        padding: 0.375rem 0.875rem;
        border-radius: 9999px;
        font-size: 0.75rem;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.05em;
    }
    
    .status-confirmed {
        background: #d1fae5;
        color: #065f46;
    }
    
    .status-pending {
        background: #fef3c7;
        color: #92400e;
    }
    
    .status-cancelled {
        background: #fee2e2;
        color: #991b1b;
    }
    
    .status-completed {
        background: #e0e7ff;
        color: #3730a3;
    }
    
    .appointment-body {
        display: flex;
        flex-direction: column;
        gap: 1rem;
    }
    
    .appointment-info {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
        gap: 0.75rem;
    }
    
    .info-item {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        font-size: 0.875rem;
        color: #374151;
    }
    
    .info-item i {
        color: #06b6d4;
        font-size: 1rem;
    }
    
    .appointment-agent {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        font-size: 0.75rem;
        color: #9ca3af;
        padding-top: 0.75rem;
        border-top: 1px solid #e5e7eb;
    }
    
    .appointment-footer {
        margin-top: 1rem;
        padding-top: 1rem;
        border-top: 1px solid #e5e7eb;
    }
    
    .sheet-link {
        display: inline-flex;
        align-items: center;
        gap: 0.5rem;
        font-size: 0.875rem;
        color: #06b6d4;
        text-decoration: none;
        font-weight: 600;
        transition: all 0.2s ease;
    }
    
    .sheet-link:hover {
        color: #0891b2;
        text-decoration: underline;
    }
    
    .sheet-link i {
        font-size: 1rem;
    }
    
    .appointment-details {
        display: flex;
        flex-direction: column;
        gap: 1.5rem;
    }
    
    .detail-section h4 {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        font-size: 0.875rem;
        font-weight: 700;
        color: #6b7280;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        margin-bottom: 0.5rem;
    }
    
    .detail-section h4 i {
        color: #06b6d4;
    }
    
    .detail-section p {
        font-size: 1rem;
        color: #1a1a1a;
        margin: 0;
    }
    
    .detail-section a {
        color: #06b6d4;
        text-decoration: none;
        font-weight: 600;
    }
    
    .detail-section a:hover {
        text-decoration: underline;
    }
`;
document.head.appendChild(style);