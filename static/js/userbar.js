// ============================================
// USERBAR JAVASCRIPT - FLOATING DESIGN
// ============================================

document.addEventListener('DOMContentLoaded', function() {
    console.log('👤 Userbar flotante cargado correctamente');
    
    // Inicializar todas las funcionalidades
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
    // Actualizar nombre de usuario en dropdown
    const userNameElement = document.getElementById('userName');
    if (userNameElement) {
        const businessName = user.firstName || user.company || 'Mi Empresa';
        userNameElement.textContent = businessName;
    }

    // Actualizar rol/tipo de negocio
    const userRoleElement = document.getElementById('userRole');
    if (userRoleElement) {
        const businessType = getBusinessTypeLabel(user.businessType) || 'Negocio';
        userRoleElement.textContent = businessType;
    }

    // Actualizar iniciales del avatar
    const userInitialsElement = document.getElementById('userInitials');
    const userAvatarImg = document.getElementById('userAvatarImg');
    
    if (user.profileImage && userAvatarImg) {
        // Si tiene imagen de perfil, mostrar imagen
        userAvatarImg.src = user.profileImage;
        userAvatarImg.style.display = 'block';
        if (userInitialsElement) {
            userInitialsElement.style.display = 'none';
        }
    } else if (userInitialsElement) {
        // Si no tiene imagen, mostrar iniciales
        const name = user.firstName || user.company || 'Usuario';
        const initials = name.split(' ')
            .map(word => word[0])
            .join('')
            .toUpperCase()
            .substring(0, 2);
        userInitialsElement.textContent = initials;
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
            
            // Cerrar user dropdown si está abierto
            const userDropdown = document.getElementById('userDropdown');
            if (userDropdown) {
                userDropdown.classList.remove('mobile-active');
            }
            
            // Toggle notification panel
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
// USER DROPDOWN
// ============================================

function initUserDropdown() {
    const userAvatar = document.getElementById('userAvatar');
    const userDropdown = document.getElementById('userDropdown');
    const logoContainer = document.getElementById('logoContainer');

    if (!userAvatar || !userDropdown) return;

    const isMobile = window.innerWidth <= 768;

    // Mobile: Tap to toggle user dropdown
    if (isMobile) {
        userAvatar.addEventListener('click', (e) => {
            e.stopPropagation();
            
            // Cerrar notification panel si está abierto
            const notificationPanel = document.getElementById('notificationPanel');
            if (notificationPanel) {
                notificationPanel.classList.remove('mobile-active');
            }
            
            // Toggle user dropdown
            userDropdown.classList.toggle('mobile-active');
        });

        // Close user dropdown when clicking outside
        document.addEventListener('click', (e) => {
            if (!userDropdown.contains(e.target) && !userAvatar.contains(e.target)) {
                userDropdown.classList.remove('mobile-active');
            }
        });

        // Close dropdown when clicking on a link
        const dropdownLinks = userDropdown.querySelectorAll('.dropdown-menu-button');
        dropdownLinks.forEach(link => {
            link.addEventListener('click', () => {
                userDropdown.classList.remove('mobile-active');
            });
        });
    } else {
        // Desktop: Hover to show dropdown
        let isHoveringAvatar = false;
        let isHoveringDropdown = false;

        userAvatar.addEventListener('mouseenter', () => {
            isHoveringAvatar = true;
        });

        userAvatar.addEventListener('mouseleave', () => {
            isHoveringAvatar = false;
            setTimeout(() => {
                if (!isHoveringAvatar && !isHoveringDropdown) {
                    userDropdown.style.maxHeight = '0';
                    userDropdown.style.opacity = '0';
                }
            }, 100);
        });

        userDropdown.addEventListener('mouseenter', () => {
            isHoveringDropdown = true;
        });

        userDropdown.addEventListener('mouseleave', () => {
            isHoveringDropdown = false;
            setTimeout(() => {
                if (!isHoveringAvatar && !isHoveringDropdown) {
                    userDropdown.style.maxHeight = '0';
                    userDropdown.style.opacity = '0';
                }
            }, 100);
        });
    }

    // Logo click - ir al dashboard
    if (logoContainer) {
        logoContainer.addEventListener('click', () => {
            window.location.href = '/dashboard';
        });
    }

    // Handle window resize
    window.addEventListener('resize', () => {
        const wasMobile = isMobile;
        const nowMobile = window.innerWidth <= 768;

        // Reset states when switching between mobile/desktop
        if (wasMobile !== nowMobile) {
            const notificationPanel = document.getElementById('notificationPanel');
            if (notificationPanel) {
                notificationPanel.classList.remove('mobile-active');
            }
            userDropdown.classList.remove('mobile-active');
        }
    });
}

// ============================================
// LOGOUT
// ============================================

function setupLogout() {
    const userbarLogoutBtn = document.getElementById('userbarLogoutBtn');
    
    if (userbarLogoutBtn) {
        userbarLogoutBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            
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
                    showToast('Error al cerrar sesión. Por favor intenta de nuevo.', 'error');
                }
            } catch (error) {
                console.error('Error:', error);
                showToast('Error al cerrar sesión. Por favor intenta de nuevo.', 'error');
            }
        });
    }
}

// Inicializar logout al cargar
document.addEventListener('DOMContentLoaded', setupLogout);

// ============================================
// FUNCIONES DE UTILIDAD
// ============================================

// Mostrar toast/notificación
function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    const colors = {
        info: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
        error: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
        success: 'linear-gradient(135deg, #10b981 0%, #059669 100%)'
    };
    
    toast.style.cssText = `
        position: fixed; 
        top: 24px; 
        right: 24px;
        background: ${colors[type] || colors.info};
        color: white; 
        padding: 16px 24px; 
        border-radius: 12px;
        box-shadow: 0 10px 25px rgba(0, 0, 0, 0.3);
        z-index: 10000; 
        max-width: 400px;
        font-size: 14px;
        font-weight: 500;
    `;
    toast.textContent = message;
    document.body.appendChild(toast);
    
    setTimeout(() => {
        toast.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(20px)';
        setTimeout(() => document.body.removeChild(toast), 300);
    }, 4000);
}

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
    getBusinessTypeLabel,
    showToast
};