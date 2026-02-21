// ==========================================
// VARIABLES GLOBALES Y ESTADO
// ==========================================
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

// ==========================================
// INICIALIZACIÓN
// ==========================================
document.addEventListener('DOMContentLoaded', function () {
    console.log('🚀 Inicializando página de citas...');
    initializeAppointments();
    setupEventListeners();

    // Cerrar dropdowns de acciones (los de la tabla) al hacer clic fuera
    document.addEventListener('click', function (e) {
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
    // 1. Alternar Vistas (Lista vs Calendario)
    document.querySelectorAll('.view-btn').forEach(btn => {
        btn.addEventListener('click', function () {
            document.querySelectorAll('.view-btn').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            currentView = this.dataset.view;
            toggleView();
        });
    });

    // 2. Filtros
    document.getElementById('statusFilter')?.addEventListener('change', function () {
        currentFilters.status = this.value;
        renderAppointments();
    });

    document.getElementById('agentFilter')?.addEventListener('change', function () {
        currentFilters.agent = this.value;
        renderAppointments();
    });

    document.getElementById('dateFilter')?.addEventListener('change', function () {
        currentFilters.date = this.value;
        renderAppointments();
    });

    document.getElementById('searchInput')?.addEventListener('input', function () {
        currentFilters.search = this.value.toLowerCase();
        renderAppointments();
    });

    // 3. Navegación del Calendario
    const prevMonth = document.getElementById('prevMonth');
    const nextMonth = document.getElementById('nextMonth');

    if (prevMonth) prevMonth.addEventListener('click', () => changeMonth(-1));
    if (nextMonth) nextMonth.addEventListener('click', () => changeMonth(1));
}

// ==========================================
// LÓGICA DEL MODAL "NUEVA CITA"
// ==========================================

function openAppointmentModal() {
    const modal = document.getElementById('appointmentModal');
    const modalTitle = document.getElementById('modalTitle');
    const modalBody = document.getElementById('modalBody');

    modalTitle.innerHTML = '<i class="lni lni-calendar-plus" style="color: #06b6d4;"></i> Nueva Cita';

    modalBody.innerHTML = `
        <form id="createAppointmentForm" class="appointment-form">
            <div class="form-grid">
                <div class="form-group full-width">
                    <label class="form-label"><i class="lni lni-user"></i> Nombre del Cliente</label>
                    <input type="text" class="form-input" id="clientName" required>
                </div>

                <div class="form-group">
                    <label class="form-label"><i class="lni lni-phone"></i> Teléfono</label>
                    <input type="tel" class="form-input" id="clientPhone">
                </div>

                <div class="form-group">
                    <label class="form-label"><i class="lni lni-briefcase"></i> Servicio</label>
                    <input type="text" class="form-input" id="serviceName" required>
                </div>

                <div class="form-group">
                    <label class="form-label"><i class="lni lni-user"></i> Trabajador/Especialista</label>
                    <input type="text" class="form-input" id="workerName">
                </div>

                <div class="form-group">
                    <label class="form-label"><i class="lni lni-database"></i> Agente</label>
                    <div class="custom-dropdown-wrapper" id="agentDropdownWrapper">
                        <input type="text" class="form-input form-dropdown" id="agentSelectDisplay" readonly required placeholder="Selecciona un agente">
                        <i class="lni lni-chevron-down dropdown-arrow"></i>
                        <div class="dropdown-menu">
                            <div class="dropdown-options" id="agentOptions"></div>
                        </div>
                    </div>
                    <input type="hidden" id="agentSelect" required>
                </div>

                <div class="form-group">
                    <label class="form-label"><i class="lni lni-calendar"></i> Fecha</label>
                    <input type="date" class="form-input" id="appointmentDate" required>
                </div>

                <div class="form-group">
                    <label class="form-label"><i class="lni lni-clock"></i> Hora</label>
                    <div class="custom-dropdown-wrapper" id="timeDropdownWrapper">
                        <input type="text" class="form-input form-dropdown" id="timeSelectDisplay" readonly required>
                        <i class="lni lni-chevron-down dropdown-arrow"></i>
                        <div class="dropdown-menu">
                            <div class="dropdown-options" id="timeOptions"></div>
                        </div>
                    </div>
                    <input type="hidden" id="appointmentTime" required>
                </div>

                <input type="hidden" id="appointmentStatus" value="confirmed">
            </div>

            <div class="form-actions">
                <button type="button" class="btn-cancel" onclick="closeAppointmentModal()">
                    <i class="lni lni-close"></i> <span>Cancelar</span>
                </button>
                <button type="submit" class="btn-submit">
                    <i class="lni lni-checkmark"></i> <span>Crear Cita</span>
                </button>
            </div>
        </form>
    `;

    initAgentDropdown();
    initTimeDropdown();

    const dateInput = document.getElementById('appointmentDate');
    const today = new Date().toISOString().split('T')[0];
    dateInput.min = today;
    dateInput.value = today;

    document.getElementById('createAppointmentForm').addEventListener('submit', handleCreateAppointment);

    modal.classList.add('active');
}

function closeAppointmentModal() {
    const modal = document.getElementById('appointmentModal');
    modal.classList.remove('active');
}

// ==========================================
// MANEJO DE FORMULARIO (SUBMIT)
// ==========================================
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

    if (!formData.agentId) {
        showNotification('Por favor selecciona un agente', 'error');
        return;
    }

    const submitBtn = e.target.querySelector('.btn-submit');
    const originalHTML = submitBtn.innerHTML;
    submitBtn.innerHTML = `<div class="loading-spinner-small"></div> <span>Creando...</span>`;
    submitBtn.disabled = true;

    try {
        await new Promise(resolve => setTimeout(resolve, 800));

        const newAppointment = {
            id: `temp-${Date.now()}`,
            ...formData,
            agentName: agents.find(a => a.id === formData.agentId)?.name || 'Agente desconocido'
        };

        appointments.unshift(newAppointment);

        updateStats();
        renderAppointments();
        hideEmptyState();
        closeAppointmentModal();

        showNotification('✅ Cita creada exitosamente', 'success');

    } catch (error) {
        console.error('❌ Error al crear cita:', error);
        showNotification('❌ Error al crear la cita', 'error');
        submitBtn.innerHTML = originalHTML;
        submitBtn.disabled = false;
    }
}

// ==========================================
// DROPDOWNS PERSONALIZADOS
// ==========================================

function setupCustomDropdown(wrapper, display, hidden, placeholder, defaultValue = '') {
    display.onclick = function (e) {
        e.stopPropagation();
        document.querySelectorAll('.custom-dropdown-wrapper.active').forEach(w => {
            if (w !== wrapper) w.classList.remove('active');
        });
        wrapper.classList.toggle('active');
    };

    const menu = wrapper.querySelector('.dropdown-menu');
    menu.onclick = function (e) {
        const option = e.target.closest('.dropdown-option');
        if (!option) return;
        e.stopPropagation();

        const value = option.getAttribute('data-value');
        if (!value) return;

        const text = option.querySelector('span').innerText;
        display.value = text;
        hidden.value = value;

        wrapper.querySelectorAll('.dropdown-option').forEach(opt => opt.classList.remove('selected'));
        option.classList.add('selected');
        wrapper.classList.remove('active');
    };

    document.addEventListener('click', function (e) {
        if (!wrapper.contains(e.target)) {
            wrapper.classList.remove('active');
        }
    });

    if (defaultValue) {
        hidden.value = defaultValue;
    } else {
        display.placeholder = placeholder;
    }
}

function initAgentDropdown() {
    const wrapper = document.getElementById('agentDropdownWrapper');
    const display = document.getElementById('agentSelectDisplay');
    const hidden = document.getElementById('agentSelect');
    const container = document.getElementById('agentOptions');

    if (!wrapper || !display || !container) return;

    container.innerHTML = '';

    if (agents && agents.length > 0) {
        agents.forEach(agent => {
            const div = document.createElement('div');
            div.className = 'dropdown-option';
            div.setAttribute('data-value', agent.id);
            div.innerHTML = `<i class="lni lni-database"></i> <span>${agent.name}</span>`;
            container.appendChild(div);
        });
    } else {
        container.innerHTML = '<div class="dropdown-option"><span>Cargando agentes...</span></div>';
    }

    setupCustomDropdown(wrapper, display, hidden, 'Selecciona un agente');
}

function initTimeDropdown() {
    const wrapper = document.getElementById('timeDropdownWrapper');
    const display = document.getElementById('timeSelectDisplay');
    const hidden = document.getElementById('appointmentTime');
    const container = document.getElementById('timeOptions');

    if (!wrapper || !display || !container) return;

    container.innerHTML = '';
    for (let h = 0; h < 24; h++) {
        for (let m = 0; m < 60; m += 15) {
            const h24 = String(h).padStart(2, '0');
            const mStr = String(m).padStart(2, '0');
            const val = `${h24}:${mStr}`;

            const h12 = h === 0 ? 12 : (h > 12 ? h - 12 : h);
            const ampm = h >= 12 ? 'PM' : 'AM';
            const label = `${String(h12).padStart(2, '0')}:${mStr} ${ampm}`;

            const div = document.createElement('div');
            div.className = 'dropdown-option';
            div.setAttribute('data-value', val);
            div.innerHTML = `<i class="lni lni-clock"></i> <span>${label}</span>`;
            container.appendChild(div);
        }
    }

    const now = new Date();
    const curH = String(now.getHours()).padStart(2, '0');
    const curM = String(Math.ceil(now.getMinutes() / 15) * 15).padStart(2, '0');
    const defVal = `${curH}:${curM === '60' ? '00' : curM}`;

    setupCustomDropdown(wrapper, display, hidden, 'Selecciona hora', defVal);
}

function initStatusDropdown() {
    const wrapper = document.getElementById('statusDropdownWrapper');
    const display = document.getElementById('statusSelectDisplay');
    const hidden = document.getElementById('appointmentStatus');
    if (!wrapper) return;
    setupCustomDropdown(wrapper, display, hidden, 'Selecciona estado', 'confirmed');
}

// ==========================================
// CARGA DE DATOS
// ==========================================

async function loadAgents() {
    try {
        const response = await fetch('/api/agents', { credentials: 'include' });
        if (!response.ok) throw new Error('Error API Agentes');
        const data = await response.json();
        if (data.agents) {
            agents = data.agents;
            populateAgentFilter();
        }
    } catch (error) {
        console.warn('⚠️ Fallo carga de agentes, usando backup local.');
        agents = [
            { id: 1, name: 'Respaldo 1' },
            { id: 2, name: 'Respaldo 2' }
        ];
        populateAgentFilter();
    }
}

function populateAgentFilter() {
    const filter = document.getElementById('agentFilter');
    if (!filter) return;

    while (filter.options.length > 1) filter.remove(1);

    agents.forEach(agent => {
        const opt = document.createElement('option');
        opt.value = agent.id;
        opt.textContent = agent.name;
        filter.appendChild(opt);
    });
}

async function loadAppointments() {
    try {
        const response = await fetch('/api/appointments', { credentials: 'include' });
        if (!response.ok) throw new Error('Error API Citas');
        const data = await response.json();
        appointments = data.appointments || [];
        if (appointments.length === 0) showEmptyState();
        else hideEmptyState();
    } catch (error) {
        console.error('❌ Error cargando citas:', error);
        appointments = [];
        showEmptyState();
    }
}

// ==========================================
// RENDERIZADO
// ==========================================

function showEmptyState() {
    const empty = document.getElementById('emptyState');
    const list = document.getElementById('appointmentsList');
    if (empty) empty.style.display = 'flex';
    if (list) list.innerHTML = '';
}

function hideEmptyState() {
    const empty = document.getElementById('emptyState');
    if (empty) empty.style.display = 'none';
}

function updateStats() {
    const today = new Date().toISOString().split('T')[0];
    const todayCount = appointments.filter(a => a.date === today).length;
    const cancelled = appointments.filter(a => a.status === 'cancelled').length;
    const confirmed = appointments.filter(a => a.status === 'confirmed').length;
    const total = appointments.length;

    if (document.getElementById('totalAppointments')) document.getElementById('totalAppointments').textContent = todayCount;
    if (document.getElementById('confirmedAppointments')) document.getElementById('confirmedAppointments').textContent = confirmed;
    if (document.getElementById('pendingAppointments')) document.getElementById('pendingAppointments').textContent = cancelled;
    if (document.getElementById('totalClients')) document.getElementById('totalClients').textContent = total;
}

function filterAppointments() {
    let filtered = [...appointments];

    if (currentFilters.status !== 'all') {
        filtered = filtered.filter(a => a.status === currentFilters.status);
    }

    if (currentFilters.agent !== 'all') {
        filtered = filtered.filter(a => a.agentId === parseInt(currentFilters.agent));
    }

    if (currentFilters.date !== 'all') {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        filtered = filtered.filter(a => {
            const d = new Date(a.date);
            d.setHours(0, 0, 0, 0);
            const dTime = d.getTime();
            const tTime = today.getTime();

            switch (currentFilters.date) {
                case 'today': return dTime === tTime;
                case 'tomorrow': return dTime === tTime + 86400000;
                case 'week': return dTime >= tTime && dTime <= tTime + (86400000 * 7);
                case 'month':
                    return d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear();
                default: return true;
            }
        });
    }

    if (currentFilters.search) {
        const s = currentFilters.search;
        filtered = filtered.filter(a =>
            a.client.toLowerCase().includes(s) ||
            a.service.toLowerCase().includes(s) ||
            (a.phone && a.phone.includes(s))
        );
    }

    return filtered;
}

function renderAppointments() {
    const filtered = filterAppointments();
    const list = document.getElementById('appointmentsList');

    if (!list) return;

    if (filtered.length === 0 && appointments.length > 0) {
        list.innerHTML = `
            <tr><td colspan="9" style="text-align: center; padding: 3rem; color: #6b7280;">
                <i class="lni lni-search-alt" style="font-size: 3rem; opacity: 0.5; display:block; margin-bottom:0.5rem;"></i>
                <p>No se encontraron citas con estos filtros</p>
            </td></tr>`;
        return;
    }

    filtered.sort((a, b) => new Date(b.date + ' ' + b.time) - new Date(a.date + ' ' + a.time));

    list.innerHTML = filtered.map(createTableRow).join('');
}

function createTableRow(appt) {
    const agent = agents.find(a => a.id === appt.agentId);
    const agentName = agent ? agent.name : (appt.agentName || 'Desconocido');

    const [y, m, d] = appt.date.split('-');
    const dateObj = new Date(y, m - 1, d);
    const dateStr = dateObj.toLocaleDateString('es-MX', { year: 'numeric', month: 'short', day: 'numeric' });

    return `
        <tr>
            <td>
                <div class="table-client"><i class="lni lni-user"></i> <span>${escapeHtml(appt.client)}</span></div>
            </td>
            <td>
                <div class="table-phone">${appt.phone ? `<a href="tel:${appt.phone}">${escapeHtml(appt.phone)}</a>` : '-'}</div>
            </td>
            <td><div class="table-service">${escapeHtml(appt.service)}</div></td>
            <td>
                ${appt.worker ? `<div class="table-worker"><i class="lni lni-user"></i> ${escapeHtml(appt.worker)}</div>` : '-'}
            </td>
            <td><div class="table-date">${dateStr}</div></td>
            <td><div class="table-time">${formatTime(appt.time)}</div></td>
            <td>
                <div class="agent-tag">
                    <span class="agent-tag-icon"><i class="lni lni-database"></i></span>
                    ${escapeHtml(agentName)}
                </div>
            </td>
            <td><span class="appointment-status status-${appt.status}">${getStatusText(appt.status)}</span></td>
            <td>
                <div class="actions-dropdown">
                    <button class="actions-btn" onclick="toggleDropdown(event, '${appt.id}')">
                        <i class="lni lni-more-alt"></i>
                    </button>
                    <div class="actions-menu" id="dropdown-${appt.id}">
                        ${appt.sheetUrl ? `<div class="action-item sheet" onclick="openGoogleSheet('${appt.sheetUrl}')"><i class="lni lni-text-format"></i> Ver Sheet</div>` : ''}
                        ${appt.phone ? `<div class="action-item whatsapp" onclick="sendWhatsApp('${appt.phone}', '${escapeHtml(appt.client)}')"><i class="lni lni-whatsapp"></i> WhatsApp</div>` : ''}
                    </div>
                </div>
            </td>
        </tr>
    `;
}

// ==========================================
// CALENDARIO
// ==========================================
let currentMonth = new Date().getMonth();
let currentYear = new Date().getFullYear();

function toggleView() {
    const list = document.getElementById('appointmentsListView');
    const cal = document.getElementById('calendarView');

    if (currentView === 'list') {
        list.style.display = 'block';
        cal.style.display = 'none';
    } else {
        list.style.display = 'none';
        cal.style.display = 'block';
        renderCalendar();
    }
}

function renderCalendar() {
    const grid = document.getElementById('calendarGrid');
    const title = document.getElementById('calendarMonth');
    if (!grid) return;

    const months = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
    title.textContent = `${months[currentMonth]} ${currentYear}`;
    grid.innerHTML = '';

    ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'].forEach(d => {
        const div = document.createElement('div');
        div.className = 'calendar-day-header';
        div.textContent = d;
        grid.appendChild(div);
    });

    const firstDay = new Date(currentYear, currentMonth, 1).getDay();
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();

    for (let i = 0; i < firstDay; i++) grid.appendChild(document.createElement('div'));

    for (let d = 1; d <= daysInMonth; d++) {
        const cell = document.createElement('div');
        cell.className = 'calendar-day';

        const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        const count = appointments.filter(a => a.date === dateStr).length;

        if (count > 0) {
            cell.classList.add('has-appointments');
            cell.onclick = () => showDayAppointments(dateStr);
        }

        cell.innerHTML = `<div class="calendar-day-number">${d}</div>` +
            (count > 0 ? `<div class="calendar-day-count">${count}</div>` : '');
        grid.appendChild(cell);
    }
}

function changeMonth(delta) {
    currentMonth += delta;
    if (currentMonth > 11) { currentMonth = 0; currentYear++; }
    else if (currentMonth < 0) { currentMonth = 11; currentYear--; }
    renderCalendar();
}

function showDayAppointments(dateStr) {
    const modal = document.getElementById('appointmentModal');
    const title = document.getElementById('modalTitle');
    const body = document.getElementById('modalBody');

    const d = new Date(dateStr);
    title.textContent = `Citas: ${d.toLocaleDateString('es-MX')}`;

    const dayAppts = appointments.filter(a => a.date === dateStr);
    dayAppts.sort((a, b) => a.time.localeCompare(b.time));

    body.innerHTML = `<div style="display:flex; flex-direction:column; gap:1rem;">` +
        dayAppts.map(a => `
            <div style="padding:1rem; border:1px solid #eee; border-radius:8px; background:#f9fafb;">
                <strong>${formatTime(a.time)}</strong> - ${escapeHtml(a.client)}<br>
                <small>${escapeHtml(a.service)}</small>
            </div>
        `).join('') + `</div>
        <div class="form-actions" style="margin-top:1rem;">
            <button class="btn-cancel" onclick="closeAppointmentModal()">Cerrar</button>
        </div>`;

    modal.classList.add('active');
}

// ==========================================
// UTILIDADES Y ACCIONES
// ==========================================

function toggleDropdown(event, id) {
    event.stopPropagation();
    const el = document.getElementById(`dropdown-${id}`);
    if (openDropdown && openDropdown !== el) openDropdown.classList.remove('active');
    el.classList.toggle('active');
    openDropdown = el.classList.contains('active') ? el : null;
}

function closeAllDropdowns() {
    document.querySelectorAll('.actions-menu').forEach(m => m.classList.remove('active'));
    openDropdown = null;
}

function openGoogleSheet(url) {
    window.open(url, '_blank');
    closeAllDropdowns();
}

function sendWhatsApp(phone, name) {
    const num = phone.replace(/\D/g, '');
    const msg = encodeURIComponent(`Hola ${name}, te contacto respecto a tu cita.`);
    window.open(`https://wa.me/${num}?text=${msg}`, '_blank');
    closeAllDropdowns();
}

function formatTime(t) {
    if (!t) return '';
    const [h, m] = t.split(':');
    const hh = parseInt(h);
    const ampm = hh >= 12 ? 'PM' : 'AM';
    const h12 = hh > 12 ? hh - 12 : (hh === 0 ? 12 : hh);
    return `${h12}:${m} ${ampm}`;
}

function getStatusText(s) {
    const map = { confirmed: 'Confirmada', pending: 'Pendiente', cancelled: 'Cancelada', completed: 'Completada' };
    return map[s] || s;
}

function escapeHtml(text) {
    if (!text) return '';
    return String(text).replace(/[&<>"']/g, function (m) {
        return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[m];
    });
}

function showNotification(msg, type = 'info') {
    const div = document.createElement('div');
    const color = type === 'success' ? '#10b981' : (type === 'error' ? '#ef4444' : '#06b6d4');
    div.style.cssText = `position:fixed; top:2rem; right:2rem; background:${color}; color:white; padding:1rem 1.5rem; border-radius:12px; z-index:10000; font-weight:600; box-shadow: 0 4px 12px rgba(0,0,0,0.15); display:flex; gap:0.5rem; align-items:center; animation: slideIn 0.3s ease;`;
    div.innerHTML = `<i class="lni lni-${type === 'success' ? 'checkmark-circle' : 'warning'}"></i> ${msg}`;
    document.body.appendChild(div);
    setTimeout(() => {
        div.style.opacity = '0';
        div.style.transform = 'translateX(100%)';
        div.style.transition = 'all 0.3s ease';
        setTimeout(() => div.remove(), 300);
    }, 3000);
}

const styleSheet = document.createElement("style");
styleSheet.innerText = `
@keyframes slideIn { from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
`;
document.head.appendChild(styleSheet);