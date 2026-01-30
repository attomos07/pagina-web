// ============================================
// LOGIN JAVASCRIPT - CON API REAL Y GOOGLE OAUTH
// ============================================

document.addEventListener('DOMContentLoaded', function () {
    console.log('🔐 Login JS cargado correctamente');

    // Inicializar funcionalidades
    initLoginValidation();
    // initPasswordToggle();  <--- ELIMINADO: Ya lo manejas con el onclick en el HTML
    initLoginForm();
    initSocialLogin();
    checkURLParams();

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
        input.addEventListener('blur', function () {
            validateLoginField(this);
        });

        input.addEventListener('input', function () {
            clearFieldError(this);
        });
    });
}

function validateLoginField(field) {
    const fieldName = field.name || field.id;
    const value = field.value.trim();
    let isValid = true;
    let errorMessage = '';

    clearFieldError(field);

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

    if (!isValid) {
        showFieldError(field, errorMessage);
    } else {
        showFieldSuccess(field);
    }

    return isValid;
}


// Esta función es llamada directamente desde el HTML con onclick="togglePassword('password')"
function togglePassword(fieldId) {
    const field = document.getElementById(fieldId);
    // Buscamos el icono usando el ID específico
    const icon = document.getElementById(fieldId + 'ToggleIcon');

    if (!field || !icon) return;

    if (field.type === 'password') {
        // MOSTRAR CONTRASEÑA
        field.type = 'text';

        // Quitamos el ojo normal
        icon.classList.remove('lni-eye');
        // Ponemos el ojo tachado (slash)
        icon.classList.add('lni-eye-slash');

    } else {
        // OCULTAR CONTRASEÑA
        field.type = 'password';

        // Quitamos el ojo tachado
        icon.classList.remove('lni-eye-slash'); // y también removemos 'off' por si acaso quedó caché
        icon.classList.remove('lni-eye-off');
        // Ponemos el ojo normal
        icon.classList.add('lni-eye');
    }
}

// ============================================
// MANEJO DEL FORMULARIO DE LOGIN
// ============================================

function initLoginForm() {
    const loginForm = document.getElementById('loginForm');
    if (!loginForm) return;

    loginForm.addEventListener('submit', handleLoginSubmit);

}

async function handleLoginSubmit(e) {
    e.preventDefault();

    const form = e.target;
    const formData = new FormData(form);

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
        const firstError = form.querySelector('.form-input.error');
        if (firstError) {
            firstError.focus();
        }
        return;
    }

    const data = {
        email: formData.get('email'),
        password: formData.get('password')
    };

    const submitBtn = form.querySelector('.auth-btn');
    setButtonLoading(submitBtn, true);

    try {
        const response = await fetch('/api/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(data),
            credentials: 'include'
        });

        const result = await response.json();

        if (response.ok) {
            handleLoginSuccess(result);
        } else {
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
    showNotificationIOS('¡Inicio de sesión exitoso!', 'success');

    trackLoginEvent('login_success', { method: 'email' });

    setTimeout(() => {
        // Redirigir según lo que diga el backend o por defecto al dashboard
        window.location.href = data.redirect || '/dashboard';
    }, 1500);
}

function handleLoginError(message) {
    showNotificationIOS(message, 'error');

    trackLoginEvent('login_error', {
        method: 'email',
        error: message
    });

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
    window.location.href = '/api/auth/google/login';
}

function loginWithFacebook() {
    showNotificationIOS('Redirigiendo a Facebook...', 'info');
    trackLoginEvent('social_login_attempt', { provider: 'facebook' });
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
    if (!document.getElementById('notification-ios-styles')) {
        addNotificationIOSStyles();
    }

    let container = document.getElementById('notification-ios-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'notification-ios-container';
        document.body.appendChild(container);
    }

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
    void notification.offsetWidth;

    requestAnimationFrame(() => {
        notification.classList.add('notification-ios-show');
    });

    setTimeout(() => {
        notification.classList.remove('notification-ios-show');
        notification.classList.add('notification-ios-hide');
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
        .notification-ios-success { background: #10B981; box-shadow: 0 8px 24px rgba(16, 185, 129, 0.35); }
        .notification-ios-error { background: #EF4444; box-shadow: 0 8px 24px rgba(239, 68, 68, 0.35); }
        .notification-ios-warning { background: #F59E0B; box-shadow: 0 8px 24px rgba(245, 158, 11, 0.35); }
        .notification-ios-info { background: #06B6D4; box-shadow: 0 8px 24px rgba(6, 182, 212, 0.35); }
        .notification-ios-content { display: flex; align-items: center; justify-content: center; gap: 12px; }
        .notification-ios-icon { flex-shrink: 0; display: flex; align-items: center; justify-content: center; width: 26px; height: 26px; }
        .notification-ios-message { color: white; font-weight: 700; font-size: 16px; letter-spacing: 0.5px; line-height: 1.4; }
        @keyframes notificationSlideIn {
            0% { opacity: 0; transform: translateY(-50px) scale(0.9); }
            60% { opacity: 1; transform: translateY(5px) scale(1.02); }
            100% { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes notificationSlideOut {
            0% { opacity: 1; transform: translateY(0) scale(1); }
            40% { opacity: 0.8; transform: translateY(10px) scale(0.98); }
            100% { opacity: 0; transform: translateY(50px) scale(0.9); }
        }
        @keyframes iconBounce {
            0% { transform: rotate(0deg) scale(1); }
            20% { transform: rotate(72deg) scale(1.1); }
            40% { transform: rotate(144deg) scale(1.05); }
            60% { transform: rotate(216deg) scale(1.1); }
            80% { transform: rotate(288deg) scale(1.05); }
            100% { transform: rotate(360deg) scale(1); }
        }
        .notification-ios-show { animation: notificationSlideIn 0.6s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards; }
        .notification-ios-show .notification-ios-icon { animation: iconBounce 0.8s cubic-bezier(0.34, 1.56, 0.64, 1) forwards; }
        .notification-ios-hide { animation: notificationSlideOut 0.5s cubic-bezier(0.55, 0.085, 0.68, 0.53) forwards; }
        @media (max-width: 768px) { #notification-ios-container { top: 100px; } }
        @media (max-width: 480px) { 
            #notification-ios-container { top: 80px; left: 10px; right: 10px; } 
            .notification-ios { padding: 16px 20px; }
            .notification-ios-message { font-size: 15px; }
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

window.addEventListener('error', function (e) {
    console.error('Error en login.js:', e.error);
    showNotificationIOS('Ocurrió un error inesperado. Por favor recarga la página.', 'error');
    trackLoginEvent('login_javascript_error', {
        message: e.error?.message || 'Unknown error'
    });
});

// ============================================
// KEYBOARD SHORTCUTS
// ============================================

document.addEventListener('keydown', function (e) {
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