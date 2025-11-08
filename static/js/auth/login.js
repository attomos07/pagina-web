// ============================================
// LOGIN JAVASCRIPT - CON API REAL
// ============================================

document.addEventListener('DOMContentLoaded', function() {
    console.log('🔐 Login JS cargado correctamente');
    
    // Inicializar funcionalidades específicas del login
    initLoginValidation();
    initPasswordToggle();
    initLoginForm();
    initSocialLogin();
    
    console.log('✅ Login funcionalidades inicializadas');
});

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
        showNotification('Por favor corrige los errores en el formulario', 'error');
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
        const response = await fetch('/auth/login', {
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
    
    // Mostrar notificación de éxito
    showNotification('¡Bienvenido! Redirigiendo al panel...', 'success');
    
    // Tracking del evento
    trackLoginEvent('login_success', {
        method: 'email'
    });
    
    // Redirigir después de un momento
    setTimeout(() => {
        window.location.href = '/dashboard';
    }, 1000);
}

function handleLoginError(message) {
    showNotification(message, 'error');
    
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
// LOGIN SOCIAL
// ============================================

function initSocialLogin() {
    console.log('🔗 Social login inicializado');
}

function loginWithGoogle() {
    showNotification('Redirigiendo a Google...', 'info');
    trackLoginEvent('social_login_attempt', { provider: 'google' });
    
    // Implementar OAuth con Google aquí
    setTimeout(() => {
        showNotification('Funcionalidad en desarrollo', 'warning');
    }, 1000);
}

function loginWithFacebook() {
    showNotification('Redirigiendo a Facebook...', 'info');
    trackLoginEvent('social_login_attempt', { provider: 'facebook' });
    
    // Implementar OAuth con Facebook aquí
    setTimeout(() => {
        showNotification('Funcionalidad en desarrollo', 'warning');
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
// SISTEMA DE NOTIFICACIONES
// ============================================

function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.innerHTML = `
        <div class="notification-content">
            <span class="notification-icon">${getNotificationIcon(type)}</span>
            <span class="notification-message">${message}</span>
            <button class="notification-close" onclick="closeNotification(this.parentElement.parentElement)">×</button>
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
        closeNotification(notification);
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

function closeNotification(notification) {
    notification.classList.remove('show');
    setTimeout(() => {
        if (notification.parentElement) {
            notification.parentElement.removeChild(notification);
        }
    }, 300);
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
            transition: all 0.3s cubic-bezier(0.23, 1, 0.32, 1);
            opacity: 0;
            max-width: 400px;
            border-left: 4px solid #3b82f6;
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
        
        @media (max-width: 480px) {
            .notification {
                right: 10px;
                left: 10px;
                max-width: none;
            }
        }
    `;
    document.head.appendChild(styles);
}

// ============================================
// ANALYTICS Y TRACKING
// ============================================

function trackLoginEvent(event, data = {}) {
    console.log(`🔍 Login Event: ${event}`, data);
    
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
    showNotification('Ocurrió un error inesperado. Por favor recarga la página.', 'error');
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