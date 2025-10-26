// ============================================
// REGISTER JAVASCRIPT - ESPECÍFICO
// ============================================

document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 Register JS cargado correctamente');
    
    // Inicializar funcionalidades específicas del registro
    initRegisterValidation();
    initPasswordStrength();
    initRegisterForm();
    initSocialRegister();
    initAutoFormat();
    initCustomSelect();
    
    console.log('✅ Register funcionalidades inicializadas');
});

// ============================================
// VALIDACIÓN ESPECÍFICA DEL REGISTRO
// ============================================

function initRegisterValidation() {
    const registerForm = document.getElementById('registerForm');
    if (!registerForm) return;
    
    const inputs = registerForm.querySelectorAll('.form-input');
    
    inputs.forEach(input => {
        // Validación en tiempo real al perder el foco
        input.addEventListener('blur', function() {
            validateRegisterField(this);
        });
        
        // Limpiar errores al escribir
        input.addEventListener('input', function() {
            clearFieldError(this);
            
            // Actualizar strength meter mientras se escribe la contraseña
            if (this.id === 'password') {
                updatePasswordStrength(this.value);
            }
        });
    });
}

function validateRegisterField(field) {
    const fieldName = field.name || field.id;
    const value = field.value.trim();
    let isValid = true;
    let errorMessage = '';

    // Limpiar estado previo
    clearFieldError(field);

    // Validaciones según el campo
    switch (fieldName) {
        case 'firstName':
        case 'lastName':
            if (!value) {
                errorMessage = 'Este campo es requerido';
                isValid = false;
            } else if (value.length < 2) {
                errorMessage = 'Debe tener al menos 2 caracteres';
                isValid = false;
            } else if (!/^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]+$/.test(value)) {
                errorMessage = 'Solo se permiten letras';
                isValid = false;
            }
            break;

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
            } else if (value.length < 8) {
                errorMessage = 'La contraseña debe tener al menos 8 caracteres';
                isValid = false;
            } else if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(value)) {
                errorMessage = 'Debe contener mayúsculas, minúsculas y números';
                isValid = false;
            }
            break;

        case 'businessType':
            if (!value) {
                errorMessage = 'Selecciona el giro de tu negocio';
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
// PASSWORD STRENGTH METER
// ============================================

function initPasswordStrength() {
    const passwordInput = document.getElementById('password');
    const strengthContainer = document.getElementById('passwordStrength');
    
    if (passwordInput) {
        passwordInput.addEventListener('input', function() {
            if (this.value) {
                strengthContainer.classList.add('show');
                updatePasswordStrength(this.value);
            } else {
                strengthContainer.classList.remove('show');
            }
        });
        
        passwordInput.addEventListener('focus', function() {
            if (this.value) {
                strengthContainer.classList.add('show');
            }
        });
    }
}

function updatePasswordStrength(password) {
    const strengthMeterFill = document.getElementById('strengthMeterFill');
    const strengthText = document.getElementById('strengthText');
    
    if (!password || !strengthMeterFill || !strengthText) {
        return;
    }

    let strength = 0;
    
    // Criterios de fortaleza
    if (password.length >= 8) strength++;
    if (password.length >= 12) strength++;
    if (/[a-z]/.test(password) && /[A-Z]/.test(password)) strength++;
    if (/\d/.test(password)) strength++;
    if (/[^a-zA-Z0-9]/.test(password)) strength++;

    // Resetear clases
    strengthMeterFill.className = 'strength-meter-fill';
    strengthText.className = 'strength-text';

    // Aplicar nivel de fortaleza
    if (strength <= 2) {
        strengthMeterFill.classList.add('weak');
        strengthText.classList.add('weak');
        strengthText.textContent = 'Débil';
    } else if (strength <= 3) {
        strengthMeterFill.classList.add('medium');
        strengthText.classList.add('medium');
        strengthText.textContent = 'Media';
    } else {
        strengthMeterFill.classList.add('strong');
        strengthText.classList.add('strong');
        strengthText.textContent = 'Fuerte';
    }
}

// ============================================
// TOGGLE DE CONTRASEÑA
// ============================================

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
// MANEJO DEL FORMULARIO DE REGISTRO
// ============================================

function initRegisterForm() {
    const registerForm = document.getElementById('registerForm');
    if (!registerForm) return;
    
    registerForm.addEventListener('submit', handleRegisterSubmit);
    
    // Auto-focus en el campo de nombre al cargar
    const firstNameField = document.getElementById('firstName');
    if (firstNameField) {
        setTimeout(() => {
            firstNameField.focus();
        }, 500);
    }
}

function handleRegisterSubmit(e) {
    e.preventDefault();
    
    const form = e.target;
    const formData = new FormData(form);
    const data = Object.fromEntries(formData);
    
    // Validar todos los campos requeridos
    let isValid = true;
    const requiredFields = ['firstName', 'lastName', 'email', 'password', 'businessType'];
    
    requiredFields.forEach(fieldName => {
        const field = form.querySelector(`[name="${fieldName}"]`);
        if (field && !validateRegisterField(field)) {
            isValid = false;
        }
    });

    // Validar términos y condiciones
    const termsCheckbox = document.getElementById('terms');
    if (!termsCheckbox.checked) {
        showNotification('Debes aceptar los términos y condiciones', 'error');
        isValid = false;
    }
    
    if (!isValid) {
        showNotification('Por favor corrige los errores en el formulario', 'error');
        // Focus en el primer campo con error
        const firstError = form.querySelector('.form-input.error');
        if (firstError) {
            firstError.focus();
        }
        return;
    }
    
    // Mostrar loading
    const submitBtn = form.querySelector('.auth-btn');
    setButtonLoading(submitBtn, true);
    
    // Simular envío al servidor
    simulateRegisterRequest(data, submitBtn);
}

function simulateRegisterRequest(data, button) {
    // Simular tiempo de respuesta del servidor
    setTimeout(() => {
        // Simular diferentes escenarios
        const scenarios = ['success', 'email_exists', 'server_error'];
        const randomScenario = scenarios[0]; // Siempre éxito para demo
        
        switch (randomScenario) {
            case 'success':
                handleRegisterSuccess(data);
                break;
            case 'email_exists':
                handleRegisterError('Este email ya está registrado');
                setButtonLoading(button, false);
                break;
            case 'server_error':
                handleRegisterError('Error del servidor. Inténtalo de nuevo');
                setButtonLoading(button, false);
                break;
        }
    }, 2000);
}

function handleRegisterSuccess(data) {
    console.log('Registro exitoso:', data);
    
    // Mostrar notificación de éxito
    showNotification('¡Cuenta creada exitosamente! Redirigiendo...', 'success');
    
    // Tracking del evento
    trackRegisterEvent('register_success', {
        method: 'email',
        has_company: !!data.company
    });
    
    // Redirigir después de un momento
    setTimeout(() => {
        window.location.href = '/dashboard';
    }, 1500);
}

function handleRegisterError(message) {
    showNotification(message, 'error');
    
    // Tracking del error
    trackRegisterEvent('register_error', {
        method: 'email',
        error: message
    });
    
    // Focus en el campo de email si es error de email existente
    if (message.toLowerCase().includes('email')) {
        const emailField = document.getElementById('email');
        if (emailField) {
            emailField.select();
            emailField.focus();
        }
    }
}

// ============================================
// REGISTRO SOCIAL
// ============================================

function initSocialRegister() {
    // Los botones sociales ya tienen onclick en el HTML
    console.log('🔗 Social register inicializado');
}

function registerWithGoogle() {
    showNotification('Redirigiendo a Google...', 'info');
    
    // Tracking
    trackRegisterEvent('social_register_attempt', { provider: 'google' });
    
    // Aquí integrarías con Google OAuth
    // window.location.href = '/auth/google';
    
    // Simulación para demo
    setTimeout(() => {
        showNotification('Funcionalidad en desarrollo', 'warning');
    }, 1000);
}

function registerWithFacebook() {
    showNotification('Redirigiendo a Facebook...', 'info');
    
    // Tracking
    trackRegisterEvent('social_register_attempt', { provider: 'facebook' });
    
    // Aquí integrarías con Facebook Login
    // window.location.href = '/auth/facebook';
    
    // Simulación para demo
    setTimeout(() => {
        showNotification('Funcionalidad en desarrollo', 'warning');
    }, 1000);
}

// ============================================
// CUSTOM SELECT DROPDOWN CON ANIMACIÓN CASCADA
// ============================================

function initCustomSelect() {
    const selectWrapper = document.querySelector('.custom-select-wrapper');
    const selectInput = document.getElementById('businessType');
    const dropdown = document.getElementById('businessDropdown');
    const searchInput = document.getElementById('businessSearch');
    const optionsContainer = document.getElementById('selectOptionsContainer');
    const options = optionsContainer.querySelectorAll('.select-option');
    const noResults = document.getElementById('selectNoResults');
    
    if (!selectWrapper || !selectInput || !dropdown) {
        console.warn('⚠️ Custom select elements no encontrados');
        return;
    }

    // Toggle dropdown al hacer click en el input
    selectInput.addEventListener('click', function(e) {
        e.stopPropagation();
        toggleDropdown();
    });

    // Búsqueda en tiempo real
    if (searchInput) {
        searchInput.addEventListener('input', function() {
            filterOptions(this.value);
        });

        // Prevenir que el click en search cierre el dropdown
        searchInput.addEventListener('click', function(e) {
            e.stopPropagation();
        });
    }

    // Seleccionar opción
    options.forEach(option => {
        option.addEventListener('click', function(e) {
            e.stopPropagation();
            selectOption(this);
        });
    });

    // Cerrar dropdown al hacer click fuera
    document.addEventListener('click', function(e) {
        if (!selectWrapper.contains(e.target)) {
            closeDropdown();
        }
    });

    // Cerrar con ESC
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape' && selectWrapper.classList.contains('active')) {
            closeDropdown();
        }
    });

    function toggleDropdown() {
        const isActive = selectWrapper.classList.contains('active');
        
        if (isActive) {
            closeDropdown();
        } else {
            openDropdown();
        }
    }

    function openDropdown() {
        selectWrapper.classList.add('active');
        selectInput.classList.add('active');
        
        // Focus en el search input
        if (searchInput) {
            setTimeout(() => {
                searchInput.focus();
            }, 100);
        }

        // Resetear búsqueda y mostrar todas las opciones
        if (searchInput) {
            searchInput.value = '';
        }
        filterOptions('');
        
        // Resetear animaciones de cascada
        const visibleOptions = optionsContainer.querySelectorAll('.select-option:not(.hidden)');
        visibleOptions.forEach((option, index) => {
            option.style.animation = 'none';
            setTimeout(() => {
                option.style.animation = '';
            }, 10);
        });

        // Track evento
        trackRegisterEvent('business_type_dropdown_opened');
    }

    function closeDropdown() {
        selectWrapper.classList.remove('active');
        selectInput.classList.remove('active');
        
        // Limpiar búsqueda
        if (searchInput) {
            searchInput.value = '';
        }
    }

    function filterOptions(searchTerm) {
        const term = searchTerm.toLowerCase().trim();
        let visibleCount = 0;

        options.forEach(option => {
            const text = option.querySelector('span').textContent.toLowerCase();
            const keywords = option.getAttribute('data-keywords') || '';
            const searchableText = text + ' ' + keywords.toLowerCase();
            
            if (searchableText.includes(term)) {
                option.classList.remove('hidden');
                visibleCount++;
            } else {
                option.classList.add('hidden');
            }
        });

        // Mostrar/ocultar mensaje de "no results"
        if (noResults) {
            if (visibleCount === 0 && term !== '') {
                noResults.style.display = 'block';
                optionsContainer.style.display = 'none';
            } else {
                noResults.style.display = 'none';
                optionsContainer.style.display = 'block';
            }
        }

        // Re-aplicar animación cascada a opciones visibles
        const visibleOptions = optionsContainer.querySelectorAll('.select-option:not(.hidden)');
        visibleOptions.forEach((option, index) => {
            option.style.animationDelay = `${index * 0.05}s`;
        });
    }

    function selectOption(option) {
        const value = option.getAttribute('data-value');
        const text = option.querySelector('span').textContent;

        // Actualizar input
        selectInput.value = text;
        selectInput.setAttribute('data-value', value);

        // Marcar opción seleccionada
        options.forEach(opt => opt.classList.remove('selected'));
        option.classList.add('selected');

        // Validar campo
        clearFieldError(selectInput);
        showFieldSuccess(selectInput);

        // Cerrar dropdown
        closeDropdown();

        // Track selección
        trackRegisterEvent('business_type_selected', {
            business_type: value,
            business_name: text
        });

        console.log(`✅ Giro seleccionado: ${text} (${value})`);
    }

    console.log('🎯 Custom select con búsqueda inicializado');
}

// ============================================
// FORMATEO AUTOMÁTICO
// ============================================

function initAutoFormat() {
    // Prevenir espacios en email y convertir a minúsculas
    const emailInput = document.getElementById('email');
    if (emailInput) {
        emailInput.addEventListener('input', function() {
            this.value = this.value.replace(/\s/g, '').toLowerCase();
        });
    }

    // Solo permitir letras en nombres
    const nameInputs = document.querySelectorAll('#firstName, #lastName');
    nameInputs.forEach(input => {
        input.addEventListener('input', function() {
            this.value = this.value.replace(/[^a-zA-ZáéíóúÁÉÍÓÚñÑ\s]/g, '');
        });
    });
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
    // Crear elemento de notificación
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.innerHTML = `
        <div class="notification-content">
            <span class="notification-icon">${getNotificationIcon(type)}</span>
            <span class="notification-message">${message}</span>
            <button class="notification-close" onclick="closeNotification(this.parentElement.parentElement)">×</button>
        </div>
    `;
    
    // Agregar estilos si no existen
    if (!document.getElementById('notification-styles')) {
        addNotificationStyles();
    }
    
    // Agregar al DOM
    document.body.appendChild(notification);
    
    // Mostrar con animación
    setTimeout(() => {
        notification.classList.add('show');
    }, 100);
    
    // Auto-ocultar después de 5 segundos
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
            border-left: 4px solid #06b6d4;
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

function trackRegisterEvent(event, data = {}) {
    console.log(`📊 Register Event: ${event}`, data);
    
    // Integración con Google Analytics
    if (typeof gtag !== 'undefined') {
        gtag('event', event, {
            event_category: 'authentication',
            page_title: 'Register',
            ...data
        });
    }
    
    // Integración con servicios de analytics personalizados
    if (typeof analytics !== 'undefined') {
        analytics.track(event, {
            page: 'register',
            ...data
        });
    }
}

// ============================================
// MANEJO DE ERRORES
// ============================================

window.addEventListener('error', function(e) {
    console.error('Error en register.js:', e.error);
    
    // Mostrar mensaje amigable al usuario
    showNotification('Ocurrió un error inesperado. Por favor recarga la página.', 'error');
    
    // Track error
    trackRegisterEvent('register_javascript_error', {
        message: e.error?.message || 'Unknown error',
        filename: e.filename,
        lineno: e.lineno
    });
});

// ============================================
// KEYBOARD SHORTCUTS
// ============================================

document.addEventListener('keydown', function(e) {
    // Enter en cualquier campo = submit form
    if (e.key === 'Enter' && e.target.classList.contains('form-input')) {
        const form = e.target.closest('form');
        if (form && e.target.id !== 'company') { // No auto-submit en empresa (opcional)
            e.preventDefault();
            form.querySelector('.auth-btn').click();
        }
    }
    
    // Escape = limpiar formulario
    if (e.key === 'Escape') {
        const registerForm = document.getElementById('registerForm');
        if (registerForm) {
            registerForm.reset();
            
            // Limpiar errores
            const errorElements = registerForm.querySelectorAll('.form-error.show');
            errorElements.forEach(error => error.classList.remove('show'));
            
            // Limpiar clases de validación
            const inputs = registerForm.querySelectorAll('.form-input');
            inputs.forEach(input => input.classList.remove('error', 'success'));
            
            // Ocultar password strength
            const strengthContainer = document.getElementById('passwordStrength');
            if (strengthContainer) {
                strengthContainer.classList.remove('show');
            }
        }
    }
});

// ============================================
// INICIALIZACIÓN FINAL
// ============================================

// Track page view cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', function() {
    trackRegisterEvent('register_page_view');
    
    // Track form focus
    const registerForm = document.getElementById('registerForm');
    if (registerForm) {
        registerForm.addEventListener('focus', function() {
            trackRegisterEvent('register_form_focus');
        }, true);
    }
});

// Export funciones si es necesario (para testing)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        validateRegisterField,
        isValidEmail,
        showNotification,
        trackRegisterEvent,
        handleRegisterSubmit,
        updatePasswordStrength
    };
}