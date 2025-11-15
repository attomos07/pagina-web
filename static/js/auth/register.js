// ============================================
// REGISTER JAVASCRIPT - CON API REAL Y ANIMACIÓN iOS
// ============================================

document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 Register JS cargado correctamente');
    
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
        input.addEventListener('blur', function() {
            validateRegisterField(this);
        });
        
        input.addEventListener('input', function() {
            clearFieldError(this);
            
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

    clearFieldError(field);

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
    
    if (password.length >= 8) strength++;
    if (password.length >= 12) strength++;
    if (/[a-z]/.test(password) && /[A-Z]/.test(password)) strength++;
    if (/\d/.test(password)) strength++;
    if (/[^a-zA-Z0-9]/.test(password)) strength++;

    strengthMeterFill.className = 'strength-meter-fill';
    strengthText.className = 'strength-text';

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
    
    const firstNameField = document.getElementById('firstName');
    if (firstNameField) {
        setTimeout(() => {
            firstNameField.focus();
        }, 500);
    }
}

async function handleRegisterSubmit(e) {
    e.preventDefault();
    
    const form = e.target;
    const formData = new FormData(form);
    
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
        showNotificationIOS('Debes aceptar los términos y condiciones', 'error');
        isValid = false;
    }
    
    if (!isValid) {
        showNotificationIOS('Por favor corrige los errores en el formulario', 'error');
        const firstError = form.querySelector('.form-input.error');
        if (firstError) {
            firstError.focus();
        }
        return;
    }
    
    // Preparar datos - obtener el valor real del select personalizado
    const businessTypeInput = document.getElementById('businessType');
    const businessTypeValue = businessTypeInput.getAttribute('data-value') || businessTypeInput.value;
    
    const data = {
        firstName: formData.get('firstName'),
        lastName: formData.get('lastName'),
        email: formData.get('email'),
        password: formData.get('password'),
        company: formData.get('company') || '',
        businessType: businessTypeValue
    };
    
    // Mostrar loading
    const submitBtn = form.querySelector('.auth-btn');
    setButtonLoading(submitBtn, true);
    
    try {
        // Enviar petición al servidor
        const response = await fetch('/api/register', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(data),
            credentials: 'include' // Importante para cookies
        });

        const result = await response.json();

        if (response.ok) {
            // Registro exitoso
            handleRegisterSuccess(result);
        } else {
            // Error en registro
            handleRegisterError(result.error || 'Error al crear la cuenta');
            setButtonLoading(submitBtn, false);
        }
    } catch (error) {
        console.error('Error en registro:', error);
        handleRegisterError('Error de conexión. Intenta de nuevo.');
        setButtonLoading(submitBtn, false);
    }
}

function handleRegisterSuccess(data) {
    console.log('Registro exitoso:', data);
    
    // Mostrar notificación de éxito con animación iOS
    showNotificationIOS('¡Cuenta creada exitosamente!', 'success');
    
    trackRegisterEvent('register_success', {
        method: 'email',
        has_company: !!data.user.company
    });
    
    // Redirigir al dashboard
    setTimeout(() => {
        window.location.href = '/dashboard';
    }, 1500);
}

function handleRegisterError(message) {
    showNotificationIOS(message, 'error');
    
    trackRegisterEvent('register_error', {
        method: 'email',
        error: message
    });
    
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
    console.log('🔗 Social register inicializado');
}

function registerWithGoogle() {
    showNotificationIOS('Redirigiendo a Google...', 'info');
    trackRegisterEvent('social_register_attempt', { provider: 'google' });
    setTimeout(() => {
        showNotificationIOS('Funcionalidad en desarrollo', 'warning');
    }, 1000);
}

function registerWithFacebook() {
    showNotificationIOS('Redirigiendo a Facebook...', 'info');
    trackRegisterEvent('social_register_attempt', { provider: 'facebook' });
    setTimeout(() => {
        showNotificationIOS('Funcionalidad en desarrollo', 'warning');
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

    selectInput.addEventListener('click', function(e) {
        e.stopPropagation();
        toggleDropdown();
    });

    if (searchInput) {
        searchInput.addEventListener('input', function() {
            filterOptions(this.value);
        });

        searchInput.addEventListener('click', function(e) {
            e.stopPropagation();
        });
    }

    options.forEach(option => {
        option.addEventListener('click', function(e) {
            e.stopPropagation();
            selectOption(this);
        });
    });

    document.addEventListener('click', function(e) {
        if (!selectWrapper.contains(e.target)) {
            closeDropdown();
        }
    });

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
        
        if (searchInput) {
            setTimeout(() => {
                searchInput.focus();
            }, 100);
        }

        if (searchInput) {
            searchInput.value = '';
        }
        filterOptions('');
        
        const visibleOptions = optionsContainer.querySelectorAll('.select-option:not(.hidden)');
        visibleOptions.forEach((option, index) => {
            option.style.animation = 'none';
            setTimeout(() => {
                option.style.animation = '';
            }, 10);
        });

        trackRegisterEvent('business_type_dropdown_opened');
    }

    function closeDropdown() {
        selectWrapper.classList.remove('active');
        selectInput.classList.remove('active');
        
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

        if (noResults) {
            if (visibleCount === 0 && term !== '') {
                noResults.style.display = 'block';
                optionsContainer.style.display = 'none';
            } else {
                noResults.style.display = 'none';
                optionsContainer.style.display = 'block';
            }
        }

        const visibleOptions = optionsContainer.querySelectorAll('.select-option:not(.hidden)');
        visibleOptions.forEach((option, index) => {
            option.style.animationDelay = `${index * 0.05}s`;
        });
    }

    function selectOption(option) {
        const value = option.getAttribute('data-value');
        const text = option.querySelector('span').textContent;

        selectInput.value = text;
        selectInput.setAttribute('data-value', value);

        options.forEach(opt => opt.classList.remove('selected'));
        option.classList.add('selected');

        clearFieldError(selectInput);
        showFieldSuccess(selectInput);

        closeDropdown();

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
    const emailInput = document.getElementById('email');
    if (emailInput) {
        emailInput.addEventListener('input', function() {
            this.value = this.value.replace(/\s/g, '').toLowerCase();
        });
    }

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

function trackRegisterEvent(event, data = {}) {
    console.log(`📊 Register Event: ${event}`, data);
    
    if (typeof gtag !== 'undefined') {
        gtag('event', event, {
            event_category: 'authentication',
            page_title: 'Register',
            ...data
        });
    }
}

// ============================================
// MANEJO DE ERRORES
// ============================================

window.addEventListener('error', function(e) {
    console.error('Error en register.js:', e.error);
    showNotificationIOS('Ocurrió un error inesperado. Por favor recarga la página.', 'error');
    trackRegisterEvent('register_javascript_error', {
        message: e.error?.message || 'Unknown error'
    });
});

// ============================================
// KEYBOARD SHORTCUTS
// ============================================

document.addEventListener('keydown', function(e) {
    if (e.key === 'Enter' && e.target.classList.contains('form-input')) {
        const form = e.target.closest('form');
        if (form && e.target.id !== 'company') {
            e.preventDefault();
            form.querySelector('.auth-btn').click();
        }
    }
    
    if (e.key === 'Escape') {
        const registerForm = document.getElementById('registerForm');
        if (registerForm) {
            registerForm.reset();
            
            const errorElements = registerForm.querySelectorAll('.form-error.show');
            errorElements.forEach(error => error.classList.remove('show'));
            
            const inputs = registerForm.querySelectorAll('.form-input');
            inputs.forEach(input => input.classList.remove('error', 'success'));
            
            const strengthContainer = document.getElementById('passwordStrength');
            if (strengthContainer) {
                strengthContainer.classList.remove('show');
            }
        }
    }
});
