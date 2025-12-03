// ============================================
// USERBAR JAVASCRIPT - MANEJO DE DATOS DE USUARIO
// ============================================

document.addEventListener('DOMContentLoaded', function() {
    console.log('👤 Userbar JS cargado correctamente');
    
    // Inicializar userbar con datos del usuario
    initUserbar();
    initNotifications();
    initUserbarMobile();
    
    console.log('✅ Userbar funcionalidades inicializadas');
});

// ============================================
// INICIALIZAR USERBAR CON DATOS DE USUARIO
// ============================================

async function initUserbar() {
    try {
        // Obtener datos del usuario desde la API
        const response = await fetch('/api/me', {
            method: 'GET',
            credentials: 'include'
        });

        if (response.ok) {
            const data = await response.json();
            updateUserbarUI(data.user);
            console.log('✅ Datos de usuario cargados:', data.user);
        } else {
            console.warn('⚠️ No se pudieron cargar los datos del usuario');
            // Redirigir al login si no está autenticado
            if (response.status === 401) {
                window.location.href = '/login';
            }
        }
    } catch (error) {
        console.error('❌ Error cargando datos de usuario:', error);
    }
}

function updateUserbarUI(user) {
    // Actualizar nombre de la empresa
    const companyNameElement = document.querySelector('.company-name');
    if (companyNameElement) {
        // Usar firstName (que contiene BusinessName) o company como fallback
        const businessName = user.firstName || user.company || 'Mi Empresa';
        companyNameElement.textContent = businessName;
    }

    // Actualizar tipo de negocio (categoría)
    const businessTypeElement = document.querySelector('.business-type');
    if (businessTypeElement) {
        const businessType = getBusinessTypeLabel(user.businessType) || 'Negocio';
        businessTypeElement.textContent = businessType;
    }

    // Actualizar imagen de perfil (si existe)
    const profileImage = document.querySelector('.profile-image img');
    if (profileImage && user.profileImage) {
        profileImage.src = user.profileImage;
        profileImage.alt = user.firstName || 'Perfil';
    }

    // Guardar datos en localStorage para acceso rápido
    localStorage.setItem('userData', JSON.stringify(user));
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

function initNotifications() {
    const notificationBtn = document.getElementById('notificationBtn');
    const notificationPanel = document.getElementById('notificationPanel');
    const markAllBtn = document.getElementById('markAllBtn');
    const notificationBadge = document.getElementById('notificationBadge');

    if (!notificationBtn || !notificationPanel) return;

    const isMobile = window.innerWidth <= 768;

    // Mobile: Tap to toggle notifications
    if (isMobile) {
        notificationBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            notificationPanel.classList.toggle('mobile-active');
        });

        // Close notification panel when clicking outside
        document.addEventListener('click', (e) => {
            if (!notificationPanel.contains(e.target) && !notificationBtn.contains(e.target)) {
                notificationPanel.classList.remove('mobile-active');
            }
        });
    }

    // Mark all notifications as read
    if (markAllBtn) {
        markAllBtn.addEventListener('click', () => {
            const unreadItems = document.querySelectorAll('.notification-item.unread');
            unreadItems.forEach(item => {
                item.classList.remove('unread');
            });
            if (notificationBadge) {
                notificationBadge.classList.add('hidden');
            }
        });
    }

    // Mark individual notification as read on click
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
// USERBAR MOBILE
// ============================================

function initUserbarMobile() {
    const userbar = document.getElementById('userbar');
    const profileSection = document.getElementById('profileSection');
    const userDropdown = document.getElementById('userDropdown');

    if (!userbar || !profileSection || !userDropdown) return;

    let isMobile = window.innerWidth <= 768;

    // Mobile: Tap to toggle userbar menu
    if (isMobile) {
        profileSection.addEventListener('click', (e) => {
            e.stopPropagation();
            userbar.classList.toggle('mobile-menu-active');
        });

        // Close userbar menu when clicking outside
        document.addEventListener('click', (e) => {
            if (!userbar.contains(e.target)) {
                userbar.classList.remove('mobile-menu-active');
            }
        });

        // Close menu when clicking on a link
        const userMenuLinks = userDropdown.querySelectorAll('.menu-button');
        userMenuLinks.forEach(link => {
            link.addEventListener('click', () => {
                userbar.classList.remove('mobile-menu-active');
            });
        });
    }

    // Handle window resize
    window.addEventListener('resize', () => {
        const wasMobile = isMobile;
        isMobile = window.innerWidth <= 768;

        // Reset states when switching between mobile/desktop
        if (wasMobile !== isMobile) {
            const notificationPanel = document.getElementById('notificationPanel');
            if (notificationPanel) {
                notificationPanel.classList.remove('mobile-active');
            }
            userbar.classList.remove('mobile-menu-active');
        }
    });
}

// ============================================
// LOGOUT
// ============================================

function setupLogout() {
    const userbarLogoutBtn = document.getElementById('userbarLogoutBtn');
    
    if (userbarLogoutBtn) {
        userbarLogoutBtn.addEventListener('click', async () => {
            try {
                const response = await fetch('/api/logout', {
                    method: 'POST',
                    credentials: 'include'
                });

                if (response.ok) {
                    // Limpiar localStorage
                    localStorage.removeItem('sidebarPinned');
                    localStorage.removeItem('userData');
                    
                    // Redirigir al login
                    window.location.href = '/login';
                } else {
                    console.error('Error al cerrar sesión');
                    alert('Error al cerrar sesión. Por favor intenta de nuevo.');
                }
            } catch (error) {
                console.error('Error:', error);
                alert('Error al cerrar sesión. Por favor intenta de nuevo.');
            }
        });
    }
}

// Inicializar logout al cargar
document.addEventListener('DOMContentLoaded', setupLogout);

// ============================================
// FUNCIONES DE UTILIDAD
// ============================================

// Obtener datos del usuario desde localStorage (para acceso rápido)
function getUserData() {
    const userData = localStorage.getItem('userData');
    return userData ? JSON.parse(userData) : null;
}

// Actualizar un dato específico del usuario
function updateUserData(key, value) {
    const userData = getUserData();
    if (userData) {
        userData[key] = value;
        localStorage.setItem('userData', JSON.stringify(userData));
        updateUserbarUI(userData);
    }
}

// Exportar funciones para uso global
window.userbarUtils = {
    getUserData,
    updateUserData,
    updateUserbarUI,
    getBusinessTypeLabel
};