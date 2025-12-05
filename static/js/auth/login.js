// ============================================
// LOGIN JAVASCRIPT - CON API REAL Y GOOGLE OAUTH
// ============================================

document.addEventListener('DOMContentLoaded', function() {
    console.log('🔐 Login JS cargado correctamente');
    
    // Inicializar funcionalidades específicas del login
    initLoginValidation();
    initPasswordToggle();
    initLoginForm();
    initSocialLogin();
    checkURLParams(); // Verificar errores de OAuth
    
    console.log('✅ Login funcionalidades inicializadas');
});

// ============================================
// VERIFICAR PARÁMETROS DE URL (ERRORES DE OAUTH)
// ============================================

function checkURLParams() {
    const urlParams = new URLSearchParams(window.location.search);
    const error = urlParams.get('error');
    
    if (error) {
        let errorMessage = 'Error en autenticación con Google';
        
        switch (error) {
            case 'invalid_state':
                errorMessage = 'Error de seguridad. Por favor intenta de nuevo.';
                break;
            case 'no_code':
                errorMessage = 'No se recibió autorización de Google';
                break;
            case 'token_exchange_failed':
                errorMessage = 'Error al procesar la autenticación';
                break;
            case 'user_info_failed':
                errorMessage = 'No se pudo obtener tu información de Google';
                break;
            case 'user_creation_failed':
                errorMessage = 'Error al crear tu cuenta';
                break;
            case 'token_generation_failed':
                errorMessage = 'Error al iniciar sesión';
                break;
        }
        
        showNotificationIOS(errorMessage, 'error');
        
        // Limpiar URL
        window.history.replaceState({}, document.title, window.location.pathname);
    }
}

// ============================================
// VALIDACIÓN ESPECÍFICA DEL LOGIN
// ============================================

function initLoginValidation() {
    const loginForm = document.getElementById('loginForm');
    if (!loginForm) return;
    
    const inputs = loginForm.querySelectorAll('.form-input');
    
    inputs.forEach(input => {
        // Validación en tiempo real al perder el foco
        input.addEventListener('blur', function() {
            validateLoginField(this);
        });
        
        // Limpiar errores al escribir
        input.addEventListener('input', function() {
            clearFieldError(this);
        });
    });
}

function validateLoginField(field) {
    const fieldName = field.name || field.id;
    const value = field.value.trim();
    let isValid = true;
    let errorMessage = '';

    // Limpiar estado previo
    clearFieldError(field);

    // Validaciones según el campo
    switch (fieldName) {
        case 'email':
            if (!value) {
                errorMessage = 'El email es requerido';
                isValid = false;
            } else if (!isValidEmail(value)) {
                errorMessage = 'Ingresa un email válido';
                isValid = false;
            }
            break;

        case 'password':
            if (!value) {
                errorMessage = 'La contraseña es requerida';
                isValid = false;
            } else if (value.length < 6) {
                errorMessage = 'La contraseña debe tener al menos 6 caracteres';
                isValid = false;
            }
            break;
    }

    // Mostrar estado de validación
    if (!isValid) {
        showFieldError(field, errorMessage);
    } else {
        showFieldSuccess(field);
    }

    return isValid;
}

// ============================================
// TOGGLE DE CONTRASEÑAS
// ============================================

function initPasswordToggle() {
    const passwordToggle = document.querySelector('.password-toggle');
    
    if (passwordToggle) {
        passwordToggle.addEventListener('click', function() {
            const passwordField = document.getElementById('password');
            const icon = document.getElementById('passwordToggleIcon');
            
            if (passwordField && icon) {
                if (passwordField.type === 'password') {
                    passwordField.type = 'text';
                    icon.className = 'lni lni-eye-off';
                } else {
                    passwordField.type = 'password';
                    icon.className = 'lni lni-eye';
                }
            }
        });
    }
}

// Función global para toggle (llamada desde HTML)
function togglePassword(fieldId) {
    const field = document.getElementById(fieldId);
    const icon = document.getElementById(fieldId + 'ToggleIcon');
    
    if (field && icon) {
        if (field.type === 'password') {
            field.type = 'text';
            icon.className = 'lni lni-eye-off';
        } else {
            field.type = 'password';
            icon.className = 'lni lni-eye';
        }
    }
}

// ============================================
// MANEJO DEL FORMULARIO DE LOGIN
// ============================================

function initLoginForm() {
    const loginForm = document.getElementById('loginForm');
    if (!loginForm) return;
    
    loginForm.addEventListener('submit', handleLoginSubmit);
    
    // Auto-focus en el campo email al cargar
    const emailField = document.getElementById('email');
    if (emailField) {
        setTimeout(() => {
            emailField.focus();
        }, 500);
    }
}

async function handleLoginSubmit(e) {
    e.preventDefault();
    
    const form = e.target;
    const formData = new FormData(form);
    
    // Validar todos los campos requeridos
    let isValid = true;
    const requiredFields = ['email', 'password'];
    
    requiredFields.forEach(fieldName => {
        const field = form.querySelector(`[name="${fieldName}"]`);
        if (field && !validateLoginField(field)) {
            isValid = false;
        }
    });
    
    if (!isValid) {
        showNotificationIOS('Por favor corrige los errores en el formulario', 'error');
        // Focus en el primer campo con error
        const firstError = form.querySelector('.form-input.error');
        if (firstError) {
            firstError.focus();
        }
        return;
    }
    
    // Preparar datos
    const data = {
        email: formData.get('email'),
        password: formData.get('password')
    };
    
    // Mostrar loading
    const submitBtn = form.querySelector('.auth-btn');
    setButtonLoading(submitBtn, true);
    
    try {
        // Enviar petición al servidor
        const response = await fetch('/api/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(data),
            credentials: 'include' // Importante para cookies
        });

        const result = await response.json();

        if (response.ok) {
            // Login exitoso
            handleLoginSuccess(result);
        } else {
            // Error en login
            handleLoginError(result.error || 'Error al iniciar sesión');
            setButtonLoading(submitBtn, false);
        }
    } catch (error) {
        console.error('Error en login:', error);
        handleLoginError('Error de conexión. Intenta de nuevo.');
        setButtonLoading(submitBtn, false);
    }
}

function handleLoginSuccess(data) {
    console.log('Login exitoso:', data);
    
    // Mostrar notificación de éxito con animación iOS
    showNotificationIOS('¡Inicio de sesión exitoso!', 'success');
    
    // Tracking del evento
    trackLoginEvent('login_success', {
        method: 'email'
    });
    
    // Redirigir después de un momento
    setTimeout(() => {
        window.location.href = '/dashboard';
    }, 1500);
}

function handleLoginError(message) {
    showNotificationIOS(message, 'error');
    
    // Tracking del error
    trackLoginEvent('login_error', {
        method: 'email',
        error: message
    });
    
    // Focus en el campo de contraseña para reintento
    const passwordField = document.getElementById('password');
    if (passwordField) {
        passwordField.select();
        passwordField.focus();
    }
}

// ============================================
// LOGIN SOCIAL - GOOGLE OAUTH
// ============================================

function initSocialLogin() {
    console.log('🔗 Social login inicializado');
}

function loginWithGoogle() {
    showNotificationIOS('Redirigiendo a Google...', 'info');
    trackLoginEvent('social_login_attempt', { provider: 'google' });
    
    // Redirigir a la ruta de Google OAuth
    window.location.href = '/api/auth/google/login';
}

function loginWithFacebook() {
    showNotificationIOS('Redirigiendo a Facebook...', 'info');
    trackLoginEvent('social_login_attempt', { provider: 'facebook' });
    
    // Implementar OAuth con Facebook aquí
    setTimeout(() => {
        showNotificationIOS('Funcionalidad en desarrollo', 'warning');
    }, 1000);
}

// ============================================
// FUNCIONES DE UTILIDAD
// ============================================

function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

function showFieldError(field, message) {
    field.classList.add('error');
    field.classList.remove('success');
    
    const errorElement = document.getElementById(field.name + 'Error') || 
                        document.getElementById(field.id + 'Error');
    
    if (errorElement) {
        errorElement.textContent = message;
        errorElement.classList.add('show');
    }
}

function showFieldSuccess(field) {
    field.classList.add('success');
    field.classList.remove('error');
}

function clearFieldError(field) {
    field.classList.remove('error', 'success');
    
    const errorElement = document.getElementById(field.name + 'Error') || 
                        document.getElementById(field.id + 'Error');
    
    if (errorElement) {
        errorElement.textContent = '';
        errorElement.classList.remove('show');
    }
}

function setButtonLoading(button, isLoading) {
    const btnText = button.querySelector('.btn-text');
    const btnLoading = button.querySelector('.btn-loading');
    
    if (isLoading) {
        button.disabled = true;
        btnText.style.display = 'none';
        btnLoading.style.display = 'flex';
    } else {
        button.disabled = false;
        btnText.style.display = 'block';
        btnLoading.style.display = 'none';
    }
}

// ============================================
// SISTEMA DE NOTIFICACIONES ESTILO iOS
// ============================================

function showNotificationIOS(message, type = 'info') {
    // Asegurar que los estilos estén cargados
    if (!document.getElementById('notification-ios-styles')) {
        addNotificationIOSStyles();
    }
    
    // Crear contenedor si no existe
    let container = document.getElementById('notification-ios-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'notification-ios-container';
        document.body.appendChild(container);
    }
    
    // Crear notificación
    const notification = document.createElement('div');
    notification.className = `notification-ios notification-ios-${type}`;
    
    const iconHTML = getNotificationIconHTML(type);
    
    notification.innerHTML = `
        <div class="notification-ios-content">
            <div class="notification-ios-icon">${iconHTML}</div>
            <span class="notification-ios-message">${message}</span>
        </div>
    `;
    
    container.appendChild(notification);
    
    // Forzar reflow para activar animación
    void notification.offsetWidth;
    
    // Activar animación de entrada
    requestAnimationFrame(() => {
        notification.classList.add('notification-ios-show');
    });
    
    // Remover después de 2500ms con animación de salida
    setTimeout(() => {
        notification.classList.remove('notification-ios-show');
        notification.classList.add('notification-ios-hide');
        
        // Remover del DOM después de la animación
        setTimeout(() => {
            if (notification.parentElement) {
                notification.parentElement.removeChild(notification);
            }
        }, 500);
    }, 2500);
}

function getNotificationIconHTML(type) {
    const icons = {
        success: `
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" fill="white"/>
                <path d="M9 12l2 2 4-4" stroke="#10B981" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
        `,
        error: `
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" fill="white"/>
                <path d="M15 9l-6 6M9 9l6 6" stroke="#EF4444" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
        `,
        warning: `
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" fill="white"/>
                <path d="M12 8v4M12 16h.01" stroke="#F59E0B" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
        `,
        info: `
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" fill="white"/>
                <path d="M12 16v-4M12 8h.01" stroke="#06B6D4" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
        `
    };
    return icons[type] || icons.info;
}

function addNotificationIOSStyles() {
    const styles = document.createElement('style');
    styles.id = 'notification-ios-styles';
    styles.textContent = `
        /* Contenedor de notificaciones */
        #notification-ios-container {
            position: fixed;
            top: 120px;
            left: 20px;
            right: 20px;
            z-index: 10000;
            pointer-events: none;
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 12px;
        }
        
        /* Notificación base */
        .notification-ios {
            background: #10B981;
            box-shadow: 0 8px 24px rgba(16, 185, 129, 0.35);
            border-radius: 16px;
            padding: 18px 24px;
            backdrop-filter: blur(10px);
            -webkit-backdrop-filter: blur(10px);
            will-change: transform, opacity;
            pointer-events: auto;
            max-width: 500px;
            width: 100%;
            opacity: 0;
            transform: translateY(-50px) scale(0.9);
        }
        
        /* Variantes de color */
        .notification-ios-success {
            background: #10B981;
            box-shadow: 0 8px 24px rgba(16, 185, 129, 0.35);
        }
        
        .notification-ios-error {
            background: #EF4444;
            box-shadow: 0 8px 24px rgba(239, 68, 68, 0.35);
        }
        
        .notification-ios-warning {
            background: #F59E0B;
            box-shadow: 0 8px 24px rgba(245, 158, 11, 0.35);
        }
        
        .notification-ios-info {
            background: #06B6D4;
            box-shadow: 0 8px 24px rgba(6, 182, 212, 0.35);
        }
        
        /* Contenido */
        .notification-ios-content {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 12px;
        }
        
        /* Icono */
        .notification-ios-icon {
            flex-shrink: 0;
            display: flex;
            align-items: center;
            justify-content: center;
            width: 26px;
            height: 26px;
        }
        
        /* Mensaje */
        .notification-ios-message {
            color: white;
            font-weight: 700;
            font-size: 16px;
            letter-spacing: 0.5px;
            line-height: 1.4;
        }
        
        /* Animación de entrada - iOS style */
        @keyframes notificationSlideIn {
            0% {
                opacity: 0;
                transform: translateY(-50px) scale(0.9);
            }
            60% {
                opacity: 1;
                transform: translateY(5px) scale(1.02);
            }
            100% {
                opacity: 1;
                transform: translateY(0) scale(1);
            }
        }
        
        /* Animación de salida - iOS style */
        @keyframes notificationSlideOut {
            0% {
                opacity: 1;
                transform: translateY(0) scale(1);
            }
            40% {
                opacity: 0.8;
                transform: translateY(10px) scale(0.98);
            }
            100% {
                opacity: 0;
                transform: translateY(50px) scale(0.9);
            }
        }
        
        /* Animación del icono */
        @keyframes iconBounce {
            0% {
                transform: rotate(0deg) scale(1);
            }
            20% {
                transform: rotate(72deg) scale(1.1);
            }
            40% {
                transform: rotate(144deg) scale(1.05);
            }
            60% {
                transform: rotate(216deg) scale(1.1);
            }
            80% {
                transform: rotate(288deg) scale(1.05);
            }
            100% {
                transform: rotate(360deg) scale(1);
            }
        }
        
        /* Aplicar animaciones */
        .notification-ios-show {
            animation: notificationSlideIn 0.6s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards;
        }
        
        .notification-ios-show .notification-ios-icon {
            animation: iconBounce 0.8s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
        }
        
        .notification-ios-hide {
            animation: notificationSlideOut 0.5s cubic-bezier(0.55, 0.085, 0.68, 0.53) forwards;
        }
        
        /* Responsive */
        @media (max-width: 768px) {
            #notification-ios-container {
                top: 100px;
            }
        }
        
        @media (max-width: 480px) {
            #notification-ios-container {
                top: 80px;
                left: 10px;
                right: 10px;
            }
            
            .notification-ios {
                padding: 16px 20px;
            }
            
            .notification-ios-message {
                font-size: 15px;
            }
        }
    `;
    document.head.appendChild(styles);
}

// ============================================
// ANALYTICS Y TRACKING
// ============================================

function trackLoginEvent(event, data = {}) {
    console.log(`📊 Login Event: ${event}`, data);
    
    if (typeof gtag !== 'undefined') {
        gtag('event', event, {
            event_category: 'authentication',
            page_title: 'Login',
            ...data
        });
    }
}

// ============================================
// MANEJO DE ERRORES
// ============================================

window.addEventListener('error', function(e) {
    console.error('Error en login.js:', e.error);
    showNotificationIOS('Ocurrió un error inesperado. Por favor recarga la página.', 'error');
    trackLoginEvent('login_javascript_error', {
        message: e.error?.message || 'Unknown error'
    });
});

// ============================================
// KEYBOARD SHORTCUTS
// ============================================

document.addEventListener('keydown', function(e) {
    if (e.key === 'Enter' && e.target.classList.contains('form-input')) {
        const form = e.target.closest('form');
        if (form) {
            e.preventDefault();
            form.querySelector('.auth-btn').click();
        }
    }
    
    if (e.key === 'Escape') {
        const loginForm = document.getElementById('loginForm');
        if (loginForm) {
            loginForm.reset();
            const errorElements = loginForm.querySelectorAll('.form-error.show');
            errorElements.forEach(error => error.classList.remove('show'));
            const inputs = loginForm.querySelectorAll('.form-input');
            inputs.forEach(input => input.classList.remove('error', 'success'));
        }
    }
});