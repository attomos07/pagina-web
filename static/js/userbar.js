// ============================================
// USERBAR JAVASCRIPT - FLOATING DESIGN
// ============================================

document.addEventListener('DOMContentLoaded', function() {
    console.log('👤 Userbar flotante cargado correctamente');
    
    initUserbar();
    initNotifications();
    initUserDropdown();
    
    console.log('✅ Userbar funcionalidades inicializadas');
});

// ============================================
// INICIALIZAR USERBAR CON DATOS DE USUARIO
// ============================================

async function initUserbar() {
    try {
        const response = await fetch('/api/me', {
            method: 'GET',
            credentials: 'include'
        });

        if (response.ok) {
            const data = await response.json();
            updateUserbarUI(data.user);
        } else {
            if (response.status === 401) {
                window.location.href = '/login';
            }
        }
    } catch (error) {
        console.error('❌ Error cargando datos de usuario:', error);
    }
}

function updateUserbarUI(user) {
    const userNameElement = document.getElementById('userName');
    if (userNameElement) {
        const businessName = user.firstName || user.company || 'Mi Empresa';
        userNameElement.textContent = businessName;
    }

    const userRoleElement = document.getElementById('userRole');
    if (userRoleElement) {
        const businessType = getBusinessTypeLabel(user.businessType) || 'Negocio';
        userRoleElement.textContent = businessType;
    }

    const userPlanElement = document.getElementById('userPlan');
    if (userPlanElement) {
        const serverPlan = userPlanElement.getAttribute('data-server-plan');
        if (!serverPlan && user.currentPlan) {
            userPlanElement.textContent = getPlanName(user.currentPlan);
        }
    }

    const userInitialsElement = document.getElementById('userInitials');
    const userAvatarImg = document.getElementById('userAvatarImg');
    
    if (user.profileImage && userAvatarImg) {
        userAvatarImg.src = user.profileImage;
        userAvatarImg.style.display = 'block';
        if (userInitialsElement) {
            userInitialsElement.style.display = 'none';
        }
    } else if (userInitialsElement) {
        const name = user.firstName || user.company || 'Usuario';
        const initials = name.split(' ')
            .map(word => word[0])
            .join('')
            .toUpperCase()
            .substring(0, 2);
        userInitialsElement.textContent = initials;
    }

    localStorage.setItem('userData', JSON.stringify(user));
}

// ============================================
// OBTENER NOMBRE DEL PLAN
// ============================================

function getPlanName(planId) {
    const planNames = {
        'gratuito': 'Plan Gratuito',
        'proton': 'Plan Protón',
        'neutron': 'Plan Neutrón',
        'electron': 'Plan Electrón',
        'pending': 'Pago Pendiente'
    };
    return planNames[planId] || 'Plan Gratuito';
}

// ============================================
// MAPEO DE TIPOS DE NEGOCIO A ETIQUETAS
// ============================================

function getBusinessTypeLabel(businessType) {
    const businessTypes = {
        'clinica-dental': 'Clínica Dental',
        'peluqueria': 'Peluquería',
        'restaurante': 'Restaurante',
        'pizzeria': 'Pizzería',
        'escuela': 'Educación',
        'gym': 'Gimnasio',
        'spa': 'Spa & Wellness',
        'consultorio': 'Consultorio Médico',
        'veterinaria': 'Veterinaria',
        'hotel': 'Hotel',
        'tienda': 'Tienda',
        'agencia': 'Agencia',
        'otro': 'Otro'
    };
    return businessTypes[businessType] || businessType || 'Negocio';
}

// ============================================
// NOTIFICACIONES
// ============================================

async function loadAppointmentNotifications() {
    try {
        const res = await fetch('/api/appointments', { credentials: 'include' });
        if (!res.ok) return [];
        const data = await res.json();
        return data.appointments || [];
    } catch (e) {
        console.error('Error cargando citas para notificaciones:', e);
        return [];
    }
}

function buildNotificationsFromAppointments(appointments) {
    const notifications = [];
    const now = new Date();

    const pad = n => String(n).padStart(2, '0');
    const todayStr    = `${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())}`;
    const tomorrowD   = new Date(now); tomorrowD.setDate(tomorrowD.getDate() + 1);
    const tomorrowStr = `${tomorrowD.getFullYear()}-${pad(tomorrowD.getMonth()+1)}-${pad(tomorrowD.getDate())}`;

    const active = appointments.filter(a => a.status !== 'cancelled');

    const todayAppts = active.filter(a => a.date === todayStr);
    todayAppts.forEach(a => {
        const [h, m] = a.time.split(':').map(Number);
        const apptTime = new Date(now);
        apptTime.setHours(h, m, 0, 0);
        const diffMin = (apptTime - now) / 60000;

        if (diffMin > 0 && diffMin <= 60) {
            notifications.push({
                type: 'urgent',
                text: `⏰ Cita con <strong>${a.client}</strong> en ${Math.round(diffMin)} min (${a.time})`,
                time: 'En breve',
                unread: true
            });
        } else if (diffMin > 60) {
            notifications.push({
                type: 'appointment',
                text: `📅 <strong>${a.client}</strong> — ${a.service} a las ${a.time}`,
                time: 'Hoy',
                unread: true
            });
        }
    });

    const tomorrowAppts = active.filter(a => a.date === tomorrowStr);
    if (tomorrowAppts.length > 0) {
        const s = tomorrowAppts.length;
        notifications.push({
            type: 'warning',
            text: `Tienes <strong>${s} cita${s > 1 ? 's' : ''}</strong> programada${s > 1 ? 's' : ''} para mañana`,
            time: 'Mañana',
            unread: true
        });
    }

    return notifications;
}

function renderNotifications(notifications) {
    const list  = document.getElementById('notificationList');
    const badge = document.getElementById('notificationBadge');
    if (!list) return;

    if (notifications.length === 0) {
        list.innerHTML = `
            <div style="padding:32px 20px;text-align:center;color:#9ca3af;">
                <svg viewBox="0 0 24 24" style="width:40px;height:40px;stroke:#d1d5db;stroke-width:1.5;fill:none;margin:0 auto 12px;display:block;">
                    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
                    <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
                </svg>
                <div style="font-size:14px;font-weight:500;">Sin notificaciones</div>
                <div style="font-size:12px;margin-top:4px;">No hay citas próximas</div>
            </div>`;
        if (badge) badge.classList.add('hidden');
        return;
    }

    const icons = {
        urgent: `<svg viewBox="0 0 24 24" style="width:20px;height:20px;stroke:currentColor;stroke-width:2;fill:none;">
                    <circle cx="12" cy="12" r="10"/>
                    <line x1="12" x2="12" y1="8" y2="12"/>
                    <line x1="12" x2="12.01" y1="16" y2="16"/>
                 </svg>`,
        appointment: `<svg viewBox="0 0 24 24" style="width:20px;height:20px;stroke:currentColor;stroke-width:2;fill:none;">
                        <rect width="18" height="18" x="3" y="4" rx="2" ry="2"/>
                        <line x1="16" x2="16" y1="2" y2="6"/>
                        <line x1="8" x2="8" y1="2" y2="6"/>
                        <line x1="3" x2="21" y1="10" y2="10"/>
                      </svg>`,
        warning: `<svg viewBox="0 0 24 24" style="width:20px;height:20px;stroke:currentColor;stroke-width:2;fill:none;">
                    <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/>
                    <line x1="12" x2="12" y1="9" y2="13"/>
                    <line x1="12" x2="12.01" y1="17" y2="17"/>
                  </svg>`
    };

    list.innerHTML = notifications.map(n => `
        <div class="notification-item ${n.unread ? 'unread' : ''}">
            <div class="notification-content">
                <div class="notification-icon">${icons[n.type] || icons.appointment}</div>
                <div class="notification-body">
                    <div class="notification-text">${n.text}</div>
                    <div class="notification-time">${n.time}</div>
                </div>
            </div>
        </div>`).join('');

    const unreadCount = notifications.filter(n => n.unread).length;
    if (badge) {
        if (unreadCount > 0) {
            badge.textContent = unreadCount > 9 ? '9+' : unreadCount;
            badge.classList.remove('hidden');
        } else {
            badge.classList.add('hidden');
        }
    }
}

function initNotifications() {
    const notificationBtn   = document.getElementById('notificationBtn');
    const notificationPanel = document.getElementById('notificationPanel');
    const markAllBtn        = document.getElementById('markAllBtn');
    const notificationBadge = document.getElementById('notificationBadge');

    if (!notificationBtn || !notificationPanel) return;

    loadAppointmentNotifications().then(appointments => {
        const notifications = buildNotificationsFromAppointments(appointments);
        renderNotifications(notifications);
    });

    setInterval(() => {
        loadAppointmentNotifications().then(appointments => {
            const notifications = buildNotificationsFromAppointments(appointments);
            renderNotifications(notifications);
        });
    }, 5 * 60 * 1000);

    const isMobile = window.innerWidth <= 768;

    if (isMobile) {
        notificationBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const userDropdown = document.getElementById('userDropdown');
            if (userDropdown) userDropdown.classList.remove('mobile-active');
            notificationPanel.classList.toggle('mobile-active');
        });

        document.addEventListener('click', (e) => {
            if (!notificationPanel.contains(e.target) && !notificationBtn.contains(e.target)) {
                notificationPanel.classList.remove('mobile-active');
            }
        });
    }

    if (markAllBtn) {
        markAllBtn.addEventListener('click', () => {
            document.querySelectorAll('.notification-item.unread').forEach(item => {
                item.classList.remove('unread');
            });
            if (notificationBadge) notificationBadge.classList.add('hidden');
        });
    }

    document.querySelectorAll('.notification-item').forEach(item => {
        item.addEventListener('click', function() {
            if (this.classList.contains('unread')) {
                this.classList.remove('unread');
                updateBadgeCount();
            }
        });
    });

    function updateBadgeCount() {
        const unreadCount = document.querySelectorAll('.notification-item.unread').length;
        if (notificationBadge) {
            if (unreadCount > 0) {
                notificationBadge.textContent = unreadCount;
                notificationBadge.classList.remove('hidden');
            } else {
                notificationBadge.classList.add('hidden');
            }
        }
    }
}

// ============================================
// USER DROPDOWN
// ============================================

function initUserDropdown() {
    const userAvatar   = document.getElementById('userAvatar');
    const userDropdown = document.getElementById('userDropdown');
    const logoContainer = document.getElementById('logoContainer');

    if (!userAvatar || !userDropdown) return;

    const isMobile = window.innerWidth <= 768;

    if (isMobile) {
        userAvatar.addEventListener('click', (e) => {
            e.stopPropagation();
            const notificationPanel = document.getElementById('notificationPanel');
            if (notificationPanel) notificationPanel.classList.remove('mobile-active');
            userDropdown.classList.toggle('mobile-active');
        });

        document.addEventListener('click', (e) => {
            if (!userDropdown.contains(e.target) && !userAvatar.contains(e.target)) {
                userDropdown.classList.remove('mobile-active');
            }
        });

        userDropdown.querySelectorAll('.dropdown-menu-button').forEach(link => {
            link.addEventListener('click', () => userDropdown.classList.remove('mobile-active'));
        });

    } else {
        // ── FIX: usar clase .is-open en lugar de estilos inline ──────────
        // El bug original: al cerrar se aplicaba element.style.maxHeight='0'
        // (estilo inline). Los estilos inline tienen mayor especificidad que
        // cualquier regla CSS, así que el selector :hover ya no podía
        // sobrescribirlo en visitas posteriores. Con .is-open el CSS mantiene
        // el control completo y el dropdown funciona siempre.
        let isHoveringAvatar   = false;
        let isHoveringDropdown = false;

        const openDropdown  = () => userDropdown.classList.add('is-open');
        const closeDropdown = () => {
            setTimeout(() => {
                if (!isHoveringAvatar && !isHoveringDropdown) {
                    userDropdown.classList.remove('is-open');
                }
            }, 100);
        };

        userAvatar.addEventListener('mouseenter', () => { isHoveringAvatar = true;  openDropdown(); });
        userAvatar.addEventListener('mouseleave', () => { isHoveringAvatar = false; closeDropdown(); });

        userDropdown.addEventListener('mouseenter', () => { isHoveringDropdown = true;  openDropdown(); });
        userDropdown.addEventListener('mouseleave', () => { isHoveringDropdown = false; closeDropdown(); });
    }

    if (logoContainer) {
        logoContainer.addEventListener('click', () => {
            window.location.href = '/dashboard';
        });
    }

    window.addEventListener('resize', () => {
        const nowMobile = window.innerWidth <= 768;
        if (isMobile !== nowMobile) {
            const notificationPanel = document.getElementById('notificationPanel');
            if (notificationPanel) notificationPanel.classList.remove('mobile-active');
            userDropdown.classList.remove('mobile-active');
            userDropdown.classList.remove('is-open');
        }
    });
}

// ============================================
// LOGOUT
// ============================================

function setupLogout() {
    const userbarLogoutBtn = document.getElementById('userbarLogoutBtn');
    if (!userbarLogoutBtn) return;

    userbarLogoutBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        try {
            const response = await fetch('/api/logout', {
                method: 'POST',
                credentials: 'include'
            });
            if (response.ok) {
                localStorage.removeItem('sidebarPinned');
                localStorage.removeItem('userData');
                window.location.href = '/login';
            } else {
                showToast('Error al cerrar sesión. Por favor intenta de nuevo.', 'error');
            }
        } catch (error) {
            showToast('Error al cerrar sesión. Por favor intenta de nuevo.', 'error');
        }
    });
}

document.addEventListener('DOMContentLoaded', setupLogout);

// ============================================
// FUNCIONES DE UTILIDAD
// ============================================

function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    const colors = { info: '#06b6d4', error: '#ef4444', success: '#10b981' };
    toast.style.cssText = `
        position: fixed; top: 24px; right: 24px;
        background: ${colors[type] || colors.info};
        color: white; padding: 16px 24px; border-radius: 12px;
        box-shadow: 0 10px 25px rgba(0,0,0,0.3);
        z-index: 10000; max-width: 400px;
        font-size: 14px; font-weight: 500;`;
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => {
        toast.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(20px)';
        setTimeout(() => document.body.removeChild(toast), 300);
    }, 4000);
}

function getUserData() {
    const userData = localStorage.getItem('userData');
    return userData ? JSON.parse(userData) : null;
}

function updateUserData(key, value) {
    const userData = getUserData();
    if (userData) {
        userData[key] = value;
        localStorage.setItem('userData', JSON.stringify(userData));
        updateUserbarUI(userData);
    }
}

window.userbarUtils = {
    getUserData, updateUserData, updateUserbarUI,
    getBusinessTypeLabel, getPlanName, showToast
};