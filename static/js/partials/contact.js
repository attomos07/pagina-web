// ============================================
// CONTACT.JS - FUNCIONALIDADES ESPECÍFICAS
// ============================================

document.addEventListener('DOMContentLoaded', function() {
    console.log('📞 Contact page loaded');
    
    // Inicializar funcionalidades específicas de contacto
    initContactMethods();
    initContactForm();
    initMapFunctionality();
    initConsultationCard();
    
    // Inicializar FAQ (heredada de index.js)
    if (typeof window.ChatBotHub?.initFAQ === 'function') {
        window.ChatBotHub.initFAQ();
    }
    
    console.log('✅ Contact functionality initialized');
});

// ============================================
// CONTACT METHODS INTERACTIONS
// ============================================
function initContactMethods() {
    const contactMethods = document.querySelectorAll('.contact-method');
    
    if (contactMethods.length === 0) return;
    
    contactMethods.forEach(method => {
        // Hover effects
        method.addEventListener('mouseenter', function() {
            this.classList.add('hovered');
            
            // Animar icono
            const icon = this.querySelector('.method-icon');
            if (icon) {
                icon.style.transform = 'scale(1.1) rotate(5deg)';
            }
        });
        
        method.addEventListener('mouseleave', function() {
            this.classList.remove('hovered');
            
            // Restaurar icono
            const icon = this.querySelector('.method-icon');
            if (icon) {
                icon.style.transform = 'scale(1) rotate(0deg)';
            }
        });
        
        // Click tracking
        method.addEventListener('click', function(e) {
            // No procesar si se hizo click en el botón
            if (e.target.closest('.contact-btn')) return;
            
            const methodTitle = this.querySelector('.method-title')?.textContent || 'Unknown';
            trackContactMethodClick(methodTitle);
        });
    });
    
    // Botones de contacto específicos
    initContactButtons();
}

// ============================================
// CONTACT BUTTONS FUNCTIONALITY
// ============================================
function initContactButtons() {
    // Botón de WhatsApp
    const whatsappBtns = document.querySelectorAll('.whatsapp-btn');
    whatsappBtns.forEach(btn => {
        btn.addEventListener('click', function(e) {
            e.preventDefault();
            
            animateButton(this);
            trackContactAction('whatsapp', 'button_click');
            
            const message = '¡Hola! Me pongo en contacto desde su página web. Me interesa conocer más sobre sus servicios de chatbots.';
            openWhatsAppWithMessage(message);
        });
    });
    
    // Botón de Email
    const emailBtns = document.querySelectorAll('.email-btn');
    emailBtns.forEach(btn => {
        btn.addEventListener('click', function(e) {
            e.preventDefault();
            
            animateButton(this);
            trackContactAction('email', 'button_click');
            
            // Crear subject y body para el email
            const subject = encodeURIComponent('Consulta sobre ChatBots - Desde página web');
            const body = encodeURIComponent('Hola,\n\nMe pongo en contacto desde su página web porque me interesa conocer más sobre sus servicios de chatbots.\n\n[Describa aquí su consulta]\n\nSaludos');
            
            window.location.href = `mailto:hello@chatbothub.com?subject=${subject}&body=${body}`;
        });
    });
    
    // Botón de Teléfono
    const phoneBtns = document.querySelectorAll('.phone-btn');
    phoneBtns.forEach(btn => {
        btn.addEventListener('click', function(e) {
            e.preventDefault();
            
            animateButton(this);
            trackContactAction('phone', 'button_click');
            
            window.location.href = 'tel:+526621234567';
        });
    });
    
    // Botón de Calendario
    const calendarBtns = document.querySelectorAll('.calendar-btn');
    calendarBtns.forEach(btn => {
        btn.addEventListener('click', function(e) {
            e.preventDefault();
            
            animateButton(this);
            trackContactAction('calendar', 'button_click');
            
            // Por ahora redirigir a WhatsApp para agendar
            const message = '¡Hola! Me gustaría agendar una consultoría gratuita de 30 minutos. ¿Qué horarios tienen disponibles?';
            openWhatsAppWithMessage(message);
        });
    });
}

// ============================================
// CONTACT FORM FUNCTIONALITY
// ============================================
function initContactForm() {
    const contactForm = document.getElementById('contactForm');
    
    if (!contactForm) return;
    
    // Form validation en tiempo real
    initFormValidation(contactForm);
    
    // Submit handler
    contactForm.addEventListener('submit', function(e) {
        e.preventDefault();
        
        if (validateForm(this)) {
            processContactForm(this);
        }
    });
    
    // Platform checkboxes interactions
    initPlatformCheckboxes();
}

// ============================================
// FORM VALIDATION
// ============================================
function initFormValidation(form) {
    const requiredFields = form.querySelectorAll('input[required], textarea[required]');
    
    requiredFields.forEach(field => {
        // Validation on blur
        field.addEventListener('blur', function() {
            validateField(this);
        });
        
        // Clear validation on input
        field.addEventListener('input', function() {
            if (this.classList.contains('error')) {
                this.classList.remove('error');
                clearFieldError(this);
            }
        });
    });
    
    // Email validation específica
    const emailField = form.querySelector('input[type="email"]');
    if (emailField) {
        emailField.addEventListener('blur', function() {
            validateEmail(this);
        });
    }
}

function validateField(field) {
    const value = field.value.trim();
    
    if (field.hasAttribute('required') && !value) {
        showFieldError(field, 'Este campo es obligatorio');
        return false;
    }
    
    if (field.type === 'email' && value) {
        return validateEmail(field);
    }
    
    clearFieldError(field);
    return true;
}

function validateEmail(field) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const isValid = emailRegex.test(field.value);
    
    if (!isValid) {
        showFieldError(field, 'Por favor ingrese un email válido');
        return false;
    }
    
    clearFieldError(field);
    return true;
}

function validateForm(form) {
    const requiredFields = form.querySelectorAll('input[required], textarea[required]');
    let isValid = true;
    
    requiredFields.forEach(field => {
        if (!validateField(field)) {
            isValid = false;
        }
    });
    
    // Validar términos y condiciones
    const privacyCheckbox = form.querySelector('input[name="privacy"]');
    if (privacyCheckbox && !privacyCheckbox.checked) {
        showFieldError(privacyCheckbox, 'Debe aceptar los términos y condiciones');
        isValid = false;
    }
    
    return isValid;
}

function showFieldError(field, message) {
    field.classList.add('error');
    
    // Remover error anterior si existe
    clearFieldError(field);
    
    // Crear mensaje de error
    const errorDiv = document.createElement('div');
    errorDiv.className = 'field-error';
    errorDiv.textContent = message;
    
    // Insertar después del campo
    field.parentNode.insertBefore(errorDiv, field.nextSibling);
}

function clearFieldError(field) {
    const errorDiv = field.parentNode.querySelector('.field-error');
    if (errorDiv) {
        errorDiv.remove();
    }
}

// ============================================
// FORM PROCESSING
// ============================================
function processContactForm(form) {
    const formData = new FormData(form);
    const data = Object.fromEntries(formData);
    
    // Mostrar loading state
    const submitBtn = form.querySelector('.submit-btn');
    const originalText = submitBtn.textContent;
    submitBtn.textContent = 'Enviando...';
    submitBtn.disabled = true;
    
    // Recopilar plataformas seleccionadas
    const platforms = Array.from(form.querySelectorAll('input[name="platforms"]:checked'))
                           .map(cb => cb.value);
    
    // Crear mensaje para WhatsApp
    const whatsappMessage = createWhatsAppMessage(data, platforms);
    
    // Simular delay de envío
    setTimeout(() => {
        // Tracking
        trackFormSubmission(data, platforms);
        
        // Restaurar botón
        submitBtn.textContent = originalText;
        submitBtn.disabled = false;
        
        // Mostrar mensaje de éxito
        showSuccessMessage();
        
        // Abrir WhatsApp con el mensaje
        openWhatsAppWithMessage(whatsappMessage);
        
        // Reset form
        form.reset();
        
    }, 1500);
}

function createWhatsAppMessage(data, platforms) {
    let message = `¡Hola! Me interesa información sobre sus chatbots.\n\n`;
    message += `*Información de Contacto:*\n`;
    message += `• Nombre: ${data.name}\n`;
    message += `• Email: ${data.email}\n`;
    if (data.phone) message += `• Teléfono: ${data.phone}\n`;
    if (data.company) message += `• Empresa: ${data.company}\n`;
    if (data.industry) message += `• Industria: ${data.industry}\n`;
    
    if (platforms.length > 0) {
        message += `\n*Plataformas de Interés:*\n• ${platforms.join(', ')}\n`;
    }
    
    if (data.budget) message += `\n*Presupuesto:* ${data.budget}\n`;
    
    message += `\n*Mensaje:*\n${data.message}`;
    
    return message;
}

// ============================================
// PLATFORM CHECKBOXES
// ============================================
function initPlatformCheckboxes() {
    const checkboxes = document.querySelectorAll('input[name="platforms"]');
    
    checkboxes.forEach(checkbox => {
        checkbox.addEventListener('change', function() {
            const label = this.closest('.checkbox-label');
            
            if (this.checked) {
                label.classList.add('checked');
                animateCheckbox(label, 'check');
            } else {
                label.classList.remove('checked');
                animateCheckbox(label, 'uncheck');
            }
            
            trackPlatformSelection(this.value, this.checked);
        });
    });
}

// ============================================
// MAP FUNCTIONALITY
// ============================================
function initMapFunctionality() {
    const mapBtn = document.querySelector('.map-btn');
    const mapContainer = document.querySelector('.map-container');
    
    if (mapBtn) {
        mapBtn.addEventListener('click', function() {
            animateButton(this);
            openMap();
        });
    }
    
    // Map hover effect
    if (mapContainer) {
        mapContainer.addEventListener('mouseenter', function() {
            this.style.transform = 'scale(1.02)';
        });
        
        mapContainer.addEventListener('mouseleave', function() {
            this.style.transform = 'scale(1)';
        });
    }
}

function openMap() {
    const mapsURL = 'https://www.google.com/maps/search/?api=1&query=Hermosillo,+Sonora,+Mexico';
    window.open(mapsURL, '_blank');
    
    trackContactAction('map', 'open_location');
}

// ============================================
// CONSULTATION CARD
// ============================================
function initConsultationCard() {
    const consultationBtns = document.querySelectorAll('.consultation-btn');
    
    consultationBtns.forEach(btn => {
        btn.addEventListener('click', function(e) {
            e.preventDefault();
            
            animateButton(this);
            trackContactAction('consultation', 'request');
            
            const message = '¡Hola! Me gustaría agendar la consultoría gratuita de 30 minutos que ofrecen. ¿Qué disponibilidad tienen?';
            openWhatsAppWithMessage(message);
        });
    });
}

// ============================================
// UTILITY FUNCTIONS
// ============================================
function animateButton(button) {
    button.style.transform = 'scale(0.95)';
    setTimeout(() => {
        button.style.transform = 'scale(1)';
    }, 150);
}

function animateCheckbox(label, action) {
    const icon = label.querySelector('.platform-icon');
    if (icon) {
        if (action === 'check') {
            icon.style.transform = 'scale(1.2) rotate(10deg)';
            icon.style.color = '#25D366';
        } else {
            icon.style.transform = 'scale(1) rotate(0deg)';
            icon.style.color = '';
        }
        
        setTimeout(() => {
            icon.style.transform = 'scale(1) rotate(0deg)';
        }, 300);
    }
}

function showSuccessMessage() {
    // Crear mensaje de éxito
    const successDiv = document.createElement('div');
    successDiv.className = 'success-message';
    successDiv.innerHTML = `
        <div class="success-content">
            <i class="lni lni-checkmark-circle"></i>
            <h3>¡Mensaje enviado!</h3>
            <p>Te contactaremos pronto por WhatsApp</p>
        </div>
    `;
    
    // Añadir al body
    document.body.appendChild(successDiv);
    
    // Animar entrada
    setTimeout(() => {
        successDiv.classList.add('show');
    }, 100);
    
    // Remover después de 5 segundos
    setTimeout(() => {
        successDiv.classList.remove('show');
        setTimeout(() => {
            successDiv.remove();
        }, 300);
    }, 5000);
}

function openWhatsAppWithMessage(customMessage) {
    const phoneNumber = '5491234567890';
    const encodedMessage = encodeURIComponent(customMessage);
    const whatsappURL = `https://wa.me/${phoneNumber}?text=${encodedMessage}`;
    window.open(whatsappURL, '_blank');
}

// ============================================
// ANALYTICS Y TRACKING
// ============================================
function trackContactMethodClick(method) {
    console.log(`Contact method clicked: ${method}`);
    
    if (typeof gtag !== 'undefined') {
        gtag('event', 'contact_method_click', {
            'method': method,
            'event_category': 'contact',
            'event_label': method.toLowerCase()
        });
    }
}

function trackContactAction(type, action) {
    console.log(`Contact action: ${type} - ${action}`);
    
    if (typeof gtag !== 'undefined') {
        gtag('event', 'contact_action', {
            'action_type': type,
            'action_name': action,
            'event_category': 'contact',
            'event_label': `${type}-${action}`
        });
    }
}

function trackFormSubmission(data, platforms) {
    console.log('Form submitted:', data);
    
    if (typeof gtag !== 'undefined') {
        gtag('event', 'form_submission', {
            'form_type': 'contact',
            'industry': data.industry || 'not_specified',
            'budget': data.budget || 'not_specified',
            'platforms_count': platforms.length,
            'platforms': platforms.join(','),
            'event_category': 'conversion',
            'event_label': 'contact_form'
        });
    }
}

function trackPlatformSelection(platform, checked) {
    console.log(`Platform ${checked ? 'selected' : 'deselected'}: ${platform}`);
    
    if (typeof gtag !== 'undefined') {
        gtag('event', 'platform_selection', {
            'platform': platform,
            'action': checked ? 'select' : 'deselect',
            'event_category': 'engagement',
            'event_label': `platform-${platform}`
        });
    }
}

console.log('📞 Contact.js loaded successfully');