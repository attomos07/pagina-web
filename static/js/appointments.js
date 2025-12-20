// Appointments functionality
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
        showNotification('Función de crear cita próximamente', 'info');
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
        const response = await fetch('/api/agents');
        const data = await response.json();
        
        if (data.agents) {
            agents = data.agents;
            populateAgentFilter();
        }
    } catch (error) {
        console.error('Error loading agents:', error);
    }
}

function populateAgentFilter() {
    const agentFilter = document.getElementById('agentFilter');
    
    agents.forEach(agent => {
        const option = document.createElement('option');
        option.value = agent.id;
        option.textContent = agent.name;
        agentFilter.appendChild(option);
    });
}

async function loadAppointments() {
    try {
        const response = await fetch('/api/appointments');
        
        if (response.ok) {
            const data = await response.json();
            appointments = data.appointments || [];
        } else {
            // Mock data si no hay endpoint
            appointments = generateMockAppointments();
        }
    } catch (error) {
        console.error('Error loading appointments:', error);
        appointments = generateMockAppointments();
    }
}

function generateMockAppointments() {
    const services = ['Corte de Cabello', 'Manicure', 'Pedicure', 'Tinte', 'Facial', 'Masaje'];
    const statuses = ['confirmed', 'pending', 'completed', 'cancelled'];
    const clients = ['María García', 'Juan Pérez', 'Ana López', 'Carlos Ruiz', 'Laura Martínez', 'Pedro Sánchez'];
    
    const mockAppointments = [];
    const today = new Date();
    
    for (let i = 0; i < 20; i++) {
        const date = new Date(today);
        date.setDate(date.getDate() + Math.floor(Math.random() * 30) - 15);
        
        const hours = 9 + Math.floor(Math.random() * 9);
        const minutes = Math.random() > 0.5 ? '00' : '30';
        
        mockAppointments.push({
            id: i + 1,
            client: clients[Math.floor(Math.random() * clients.length)],
            service: services[Math.floor(Math.random() * services.length)],
            date: date.toISOString().split('T')[0],
            time: `${hours.toString().padStart(2, '0')}:${minutes}`,
            status: statuses[Math.floor(Math.random() * statuses.length)],
            agentId: agents.length > 0 ? agents[Math.floor(Math.random() * agents.length)].id : 1,
            phone: '+52 ' + Math.floor(Math.random() * 9000000000 + 1000000000),
            duration: 60,
            notes: 'Cliente regular, prefiere estilista específico'
        });
    }
    
    return mockAppointments.sort((a, b) => new Date(b.date + ' ' + b.time) - new Date(a.date + ' ' + a.time));
}

function updateStats() {
    const total = appointments.length;
    const confirmed = appointments.filter(a => a.status === 'confirmed').length;
    const pending = appointments.filter(a => a.status === 'pending').length;
    const uniqueClients = new Set(appointments.map(a => a.client)).size;
    
    document.getElementById('totalAppointments').textContent = total;
    document.getElementById('confirmedAppointments').textContent = confirmed;
    document.getElementById('pendingAppointments').textContent = pending;
    document.getElementById('totalClients').textContent = uniqueClients;
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
            a.date.includes(currentFilters.search)
        );
    }
    
    return filtered;
}

function renderAppointments() {
    const filtered = filterAppointments();
    const container = document.getElementById('appointmentsList');
    const emptyState = document.getElementById('emptyState');
    
    if (filtered.length === 0) {
        container.innerHTML = '';
        emptyState.style.display = 'block';
        return;
    }
    
    emptyState.style.display = 'none';
    container.innerHTML = '';
    
    filtered.forEach(appointment => {
        const card = createAppointmentCard(appointment);
        container.appendChild(card);
    });
}

function createAppointmentCard(appointment) {
    const card = document.createElement('div');
    card.className = 'appointment-card';
    card.onclick = () => showAppointmentDetails(appointment);
    
    const date = new Date(appointment.date + ' ' + appointment.time);
    const formattedDate = date.toLocaleDateString('es-MX', { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
    });
    
    const agent = agents.find(a => a.id === appointment.agentId);
    const agentName = agent ? agent.name : 'Agente desconocido';
    
    card.innerHTML = `
        <div class="appointment-header">
            <div class="appointment-info">
                <div class="appointment-client">
                    <i class="lni lni-user"></i>
                    ${appointment.client}
                </div>
                <div class="appointment-service">${appointment.service}</div>
            </div>
            <span class="appointment-status status-${appointment.status}">
                ${getStatusText(appointment.status)}
            </span>
        </div>
        <div class="appointment-details">
            <div class="detail-item">
                <i class="lni lni-calendar"></i>
                <span>${formattedDate}</span>
            </div>
            <div class="detail-item">
                <i class="lni lni-clock"></i>
                <span>${appointment.time}</span>
            </div>
            <div class="detail-item">
                <i class="lni lni-timer"></i>
                <span>${appointment.duration} min</span>
            </div>
            <div class="detail-item">
                <i class="lni lni-phone"></i>
                <span>${appointment.phone}</span>
            </div>
        </div>
    `;
    
    return card;
}

function getStatusText(status) {
    const statusMap = {
        'confirmed': 'Confirmada',
        'pending': 'Pendiente',
        'cancelled': 'Cancelada',
        'completed': 'Completada'
    };
    return statusMap[status] || status;
}

function showAppointmentDetails(appointment) {
    const modal = document.getElementById('appointmentModal');
    const modalBody = document.getElementById('modalBody');
    
    const date = new Date(appointment.date + ' ' + appointment.time);
    const formattedDate = date.toLocaleDateString('es-MX', { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
    });
    
    const agent = agents.find(a => a.id === appointment.agentId);
    const agentName = agent ? agent.name : 'Agente desconocido';
    
    modalBody.innerHTML = `
        <div style="display: flex; flex-direction: column; gap: 1.5rem;">
            <div>
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                    <h4 style="font-size: 1.25rem; color: #1a1a1a; font-weight: 700;">
                        <i class="lni lni-user"></i> ${appointment.client}
                    </h4>
                    <span class="appointment-status status-${appointment.status}">
                        ${getStatusText(appointment.status)}
                    </span>
                </div>
            </div>
            
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem;">
                <div>
                    <div style="font-size: 0.75rem; color: #6b7280; font-weight: 600; margin-bottom: 0.5rem; text-transform: uppercase;">Servicio</div>
                    <div style="font-size: 1rem; color: #1a1a1a; font-weight: 600;">${appointment.service}</div>
                </div>
                
                <div>
                    <div style="font-size: 0.75rem; color: #6b7280; font-weight: 600; margin-bottom: 0.5rem; text-transform: uppercase;">Fecha</div>
                    <div style="font-size: 1rem; color: #1a1a1a; font-weight: 600;">${formattedDate}</div>
                </div>
                
                <div>
                    <div style="font-size: 0.75rem; color: #6b7280; font-weight: 600; margin-bottom: 0.5rem; text-transform: uppercase;">Hora</div>
                    <div style="font-size: 1rem; color: #1a1a1a; font-weight: 600;">${appointment.time}</div>
                </div>
                
                <div>
                    <div style="font-size: 0.75rem; color: #6b7280; font-weight: 600; margin-bottom: 0.5rem; text-transform: uppercase;">Duración</div>
                    <div style="font-size: 1rem; color: #1a1a1a; font-weight: 600;">${appointment.duration} minutos</div>
                </div>
                
                <div>
                    <div style="font-size: 0.75rem; color: #6b7280; font-weight: 600; margin-bottom: 0.5rem; text-transform: uppercase;">Teléfono</div>
                    <div style="font-size: 1rem; color: #1a1a1a; font-weight: 600;">${appointment.phone}</div>
                </div>
                
                <div>
                    <div style="font-size: 0.75rem; color: #6b7280; font-weight: 600; margin-bottom: 0.5rem; text-transform: uppercase;">Agente</div>
                    <div style="font-size: 1rem; color: #1a1a1a; font-weight: 600;">${agentName}</div>
                </div>
            </div>
            
            ${appointment.notes ? `
            <div>
                <div style="font-size: 0.75rem; color: #6b7280; font-weight: 600; margin-bottom: 0.5rem; text-transform: uppercase;">Notas</div>
                <div style="padding: 1rem; background: #f9fafb; border-radius: 10px; font-size: 0.875rem; color: #374151;">
                    ${appointment.notes}
                </div>
            </div>
            ` : ''}
            
            <div style="display: flex; gap: 1rem; padding-top: 1rem; border-top: 1px solid #e5e7eb;">
                ${appointment.status === 'pending' ? `
                    <button onclick="updateAppointmentStatus(${appointment.id}, 'confirmed')" class="btn-primary" style="flex: 1;">
                        <i class="lni lni-checkmark"></i>
                        <span>Confirmar</span>
                    </button>
                    <button onclick="updateAppointmentStatus(${appointment.id}, 'cancelled')" class="btn-secondary" style="flex: 1;">
                        <i class="lni lni-close"></i>
                        <span>Cancelar</span>
                    </button>
                ` : appointment.status === 'confirmed' ? `
                    <button onclick="updateAppointmentStatus(${appointment.id}, 'completed')" class="btn-primary" style="flex: 1;">
                        <i class="lni lni-checkmark-circle"></i>
                        <span>Marcar Completada</span>
                    </button>
                ` : ''}
            </div>
        </div>
    `;
    
    modal.classList.add('active');
}

function closeAppointmentModal() {
    const modal = document.getElementById('appointmentModal');
    modal.classList.remove('active');
}

async function updateAppointmentStatus(appointmentId, newStatus) {
    try {
        // Aquí iría la llamada a la API
        // await fetch(`/api/appointments/${appointmentId}/status`, { method: 'PATCH', body: JSON.stringify({ status: newStatus }) });
        
        // Mock update
        const appointment = appointments.find(a => a.id === appointmentId);
        if (appointment) {
            appointment.status = newStatus;
            updateStats();
            renderAppointments();
            closeAppointmentModal();
            showNotification(`Cita ${getStatusText(newStatus).toLowerCase()} correctamente`, 'success');
        }
    } catch (error) {
        console.error('Error updating appointment:', error);
        showNotification('Error al actualizar la cita', 'error');
    }
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
            
            // Click handler para mostrar citas del día
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
    
    dayAppointments.forEach(appointment => {
        const agent = agents.find(a => a.id === appointment.agentId);
        const agentName = agent ? agent.name : 'Agente desconocido';
        
        appointmentsHtml += `
            <div style="padding: 1.5rem; background: #f9fafb; border-radius: 12px; border: 2px solid #e5e7eb; cursor: pointer; transition: all 0.3s ease;" 
                 onclick="closeAppointmentModal(); setTimeout(() => showAppointmentDetails(${JSON.stringify(appointment).replace(/"/g, '&quot;')}), 100);"
                 onmouseover="this.style.borderColor='#06b6d4'; this.style.background='#ffffff';"
                 onmouseout="this.style.borderColor='#e5e7eb'; this.style.background='#f9fafb';">
                <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.75rem;">
                    <div>
                        <div style="font-size: 1.125rem; font-weight: 700; color: #1a1a1a; margin-bottom: 0.25rem;">
                            <i class="lni lni-user"></i> ${appointment.client}
                        </div>
                        <div style="font-size: 0.875rem; color: #6b7280; font-weight: 600;">
                            ${appointment.service}
                        </div>
                    </div>
                    <span class="appointment-status status-${appointment.status}">
                        ${getStatusText(appointment.status)}
                    </span>
                </div>
                <div style="display: flex; gap: 1.5rem; flex-wrap: wrap; font-size: 0.875rem; color: #374151;">
                    <div style="display: flex; align-items: center; gap: 0.5rem;">
                        <i class="lni lni-clock" style="color: #06b6d4;"></i>
                        <span>${appointment.time}</span>
                    </div>
                    <div style="display: flex; align-items: center; gap: 0.5rem;">
                        <i class="lni lni-timer" style="color: #06b6d4;"></i>
                        <span>${appointment.duration} min</span>
                    </div>
                    <div style="display: flex; align-items: center; gap: 0.5rem;">
                        <i class="lni lni-phone" style="color: #06b6d4;"></i>
                        <span>${appointment.phone}</span>
                    </div>
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