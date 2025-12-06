// ============================================
// CHECKOUT JAVASCRIPT - INTEGRACIÓN STRIPE REAL
// ============================================

let STRIPE_PUBLISHABLE_KEY = '';

// Mapeo de códigos de país a códigos telefónicos
const COUNTRY_PHONE_CODES = {
    'MX': '+52',
    'US': '+1',
    'CA': '+1',
    'ES': '+34',
    'AR': '+54',
    'CO': '+57',
    'CL': '+56',
    'PE': '+51'
};

document.addEventListener('DOMContentLoaded', async function() {
    console.log('🛒 Checkout page loaded');
    
    // Cargar clave pública de Stripe desde el backend
    await loadStripePublicKey();
    
    initLogoAnimation();
    initPaymentMethodToggle();
    initCountryDropdown();
    initStripeElements();
    initFormValidation();
    initPaymentForm();
    loadPlanDetails();
});

// ============================================
// CARGAR CLAVE PÚBLICA DE STRIPE
// ============================================

async function loadStripePublicKey() {
    try {
        const response = await fetch('/api/stripe/public-key', {
            credentials: 'include'
        });
        
        if (response.ok) {
            const data = await response.json();
            STRIPE_PUBLISHABLE_KEY = data.publicKey;
            console.log('✅ Stripe public key loaded');
        } else {
            console.error('❌ Error loading Stripe key');
            alert('Error al configurar el sistema de pagos. Por favor recarga la página.');
        }
    } catch (error) {
        console.error('❌ Error:', error);
        alert('Error de conexión. Por favor recarga la página.');
    }
}

// ============================================
// LOGO ANIMATION - ATTMOS
// ============================================

function initLogoAnimation() {
    const lettering = function(el, optionalArg) {
        const text = el.innerHTML;
        const arg = optionalArg || "char";
        const size = window.getComputedStyle(el).getPropertyValue("font-size").substring(0, 2);
        
        if (el.classList.contains('fallback')) return;
        
        if (el.parentNode.getAttribute('aria-hidden') === null) {
            const clone = el.cloneNode(true);
            clone.classList.add('fallback');
            el.setAttribute('aria-hidden', 'true');
            clone.classList.add('hide');
            el.parentNode.insertBefore(clone, el.nextSibling);
        }
        
        el.innerHTML = "";
        
        if (arg === "char") {
            for (let i = 0; i < text.length; i++) {
                const span = document.createElement("span");
                span.innerHTML = text[i];
                if (text[i] == " ") {
                    span.style.margin = "0 " + (size / 10) + "px";
                }
                span.classList.add("char" + (i + 1));
                el.appendChild(span);
            }
        }
    };

    const h1 = document.querySelector(".logo-container h1");
    if (h1) {
        lettering(h1);
    }

    const ring = document.querySelector("path#ring");
    const path = "M45,145 c-50,-10 -60,-40 10,-35 c95,8 150,50 51,46";
    const base = document.querySelector('circle#base');
    const second = document.querySelector('path#second');
    const third = document.querySelector('path#third');

    if (base) {
        base.setAttribute('cx', 80);
        base.setAttribute('cy', 135);
        base.setAttribute('r', 35);
    }

    if (ring) ring.setAttribute('d', path);
    if (second) second.setAttribute('d', path);
    if (third) third.setAttribute('d', path);

    const animate = function() {
        if (ring) ring.classList.add('animate');
        if (second) second.classList.add('animate');
        if (third) third.classList.add('animate');
    };

    setTimeout(animate, 100);
}

// ============================================
// CUSTOM COUNTRY DROPDOWN
// ============================================

function initCountryDropdown() {
    const selectWrapper = document.querySelector('.country-select-wrapper');
    const selectInput = document.getElementById('country');
    const dropdown = document.getElementById('countryDropdown');
    const optionsContainer = document.getElementById('countryOptionsContainer');
    const options = optionsContainer.querySelectorAll('.select-option');
    const phoneCodeInput = document.getElementById('phoneCode');
    const countryCodeInput = document.getElementById('countryCode');
    
    if (!selectWrapper || !selectInput || !dropdown) {
        console.warn('⚠️ Country select elements no encontrados');
        return;
    }

    updatePhoneCode('MX', '+52');

    selectInput.addEventListener('click', function(e) {
        e.stopPropagation();
        toggleDropdown();
    });

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
        
        const visibleOptions = optionsContainer.querySelectorAll('.select-option:not(.hidden)');
        visibleOptions.forEach((option, index) => {
            option.style.animation = 'none';
            setTimeout(() => {
                option.style.animation = '';
            }, 10);
        });

        console.log('🌍 Dropdown de países abierto');
    }

    function closeDropdown() {
        selectWrapper.classList.remove('active');
        selectInput.classList.remove('active');
    }

    function selectOption(option) {
        const value = option.getAttribute('data-value');
        const flag = option.getAttribute('data-flag');
        const code = option.getAttribute('data-code');
        const name = option.getAttribute('data-name');

        selectInput.value = `${flag} ${name}`;
        
        if (countryCodeInput) {
            countryCodeInput.value = value;
        }

        updatePhoneCode(value, code);

        options.forEach(opt => opt.classList.remove('selected'));
        option.classList.add('selected');

        clearError(selectInput);
        closeDropdown();
        checkFormCompletion();

        console.log(`✅ País seleccionado: ${name} (${value}) - Código: ${code}`);
    }
    
    function updatePhoneCode(countryCode, manualCode = null) {
        if (phoneCodeInput) {
            const code = manualCode || COUNTRY_PHONE_CODES[countryCode] || '+52';
            phoneCodeInput.value = code;
            console.log(`📱 Código telefónico actualizado: ${code}`);
        }
    }

    console.log('✅ Country dropdown inicializado');
}

// ============================================
// PAYMENT METHOD TOGGLE
// ============================================

function initPaymentMethodToggle() {
    const methodOptions = document.querySelectorAll('.payment-method-option');
    const cardDetails = document.getElementById('cardDetails');
    const paypalDetails = document.getElementById('paypalDetails');

    methodOptions.forEach(option => {
        option.addEventListener('click', function() {
            methodOptions.forEach(opt => opt.classList.remove('active'));
            this.classList.add('active');

            const radio = this.querySelector('input[type="radio"]');
            radio.checked = true;

            if (radio.value === 'card') {
                cardDetails.style.display = 'block';
                paypalDetails.style.display = 'none';
            } else {
                cardDetails.style.display = 'none';
                paypalDetails.style.display = 'block';
            }
        });
    });
}

// ============================================
// STRIPE ELEMENTS INITIALIZATION
// ============================================

let stripe;
let cardElement;
let cardData = {
    complete: false,
    empty: true
};

function initStripeElements() {
    if (!STRIPE_PUBLISHABLE_KEY) {
        console.error('❌ Stripe key not loaded yet');
        setTimeout(initStripeElements, 500);
        return;
    }

    stripe = Stripe(STRIPE_PUBLISHABLE_KEY);
    
    const elements = stripe.elements({
        appearance: {
            theme: 'stripe',
            variables: {
                colorPrimary: '#06b6d4',
                colorBackground: '#ffffff',
                colorText: '#1a1a1a',
                colorDanger: '#ef4444',
                fontFamily: 'Inter, sans-serif',
                spacingUnit: '4px',
                borderRadius: '10px'
            }
        }
    });

    cardElement = elements.create('card', {
        style: {
            base: {
                fontSize: '16px',
                color: '#1a1a1a',
                fontFamily: 'Inter, sans-serif',
                '::placeholder': {
                    color: '#9ca3af'
                }
            },
            invalid: {
                color: '#ef4444'
            }
        }
    });

    cardElement.mount('#card-element');

    const stripeContainer = document.getElementById('stripe-container');
    const errorElement = document.getElementById('card-errors');

    cardElement.on('focus', () => {
        stripeContainer.classList.add('focused');
        stripeContainer.classList.remove('error');
    });

    cardElement.on('blur', () => {
        stripeContainer.classList.remove('focused');
    });

    cardElement.on('change', (event) => {
        cardData.complete = event.complete || false;
        cardData.empty = event.empty !== false;

        if (event.error) {
            errorElement.innerHTML = `<i class="lni lni-warning"></i> ${event.error.message}`;
            errorElement.classList.add('active');
            stripeContainer.classList.add('error');
        } else {
            errorElement.textContent = '';
            errorElement.classList.remove('active');
            stripeContainer.classList.remove('error');
        }

        checkFormCompletion();
    });

    console.log('✅ Stripe Elements initialized');
}

// ============================================
// FORM VALIDATION
// ============================================

function initFormValidation() {
    const inputs = document.querySelectorAll('.form-input, .form-select');

    inputs.forEach(input => {
        input.addEventListener('blur', function() {
            if (this.hasAttribute('required')) {
                validateInput(this);
            }
        });

        input.addEventListener('input', function() {
            if (this.classList.contains('error')) {
                validateInput(this);
            }
            checkFormCompletion();
        });
    });
}

function validateInput(input) {
    const value = input.value.trim();
    
    if (input.hasAttribute('required') && !value) {
        showError(input, 'Este campo es obligatorio');
        return false;
    }

    if (input.type === 'email' && value) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(value)) {
            showError(input, 'Email inválido');
            return false;
        }
    }

    clearError(input);
    return true;
}

function showError(input, message) {
    input.classList.add('error');
    
    const errorMsg = input.parentElement.querySelector('.error-message');
    if (errorMsg) {
        errorMsg.innerHTML = `<i class="lni lni-warning"></i> ${message}`;
        errorMsg.classList.add('active');
    }
    
    setTimeout(() => {
        input.classList.remove('error');
    }, 500);
    
    setTimeout(() => {
        if (!input.value.trim() && input.hasAttribute('required')) {
            input.classList.add('error');
        }
    }, 510);
}

function clearError(input) {
    input.classList.remove('error');
    
    const errorMsg = input.parentElement.querySelector('.error-message');
    if (errorMsg) {
        errorMsg.classList.remove('active');
    }
}

function checkFormCompletion() {
    const fullName = document.getElementById('fullName')?.value.trim();
    const email = document.getElementById('email')?.value.trim();
    const countryCode = document.getElementById('countryCode')?.value;
    const postalCode = document.getElementById('postalCode')?.value.trim();
    
    const submitButton = document.getElementById('submitButton');
    
    const isFormComplete = fullName && email && countryCode && postalCode && cardData.complete;
    
    if (submitButton) {
        submitButton.disabled = !isFormComplete;
    }
    
    return isFormComplete;
}

// ============================================
// FORM SUBMISSION CON INTEGRACIÓN REAL
// ============================================

function initPaymentForm() {
    const form = document.getElementById('paymentForm');
    
    if (form) {
        form.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            console.log('📝 Form submitted');
            
            const requiredInputs = form.querySelectorAll('[required]');
            let isValid = true;
            let firstErrorField = null;
            
            requiredInputs.forEach(input => {
                if (input.type !== 'checkbox' && input.type !== 'hidden' && !validateInput(input)) {
                    isValid = false;
                    if (!firstErrorField) {
                        firstErrorField = input;
                    }
                }
            });
            
            if (!isValid) {
                alert('Por favor completa todos los campos requeridos correctamente.');
                if (firstErrorField) {
                    firstErrorField.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    firstErrorField.focus();
                }
                return;
            }
            
            if (!cardData.complete) {
                alert('Por favor completa los datos de tu tarjeta.');
                const stripeContainer = document.getElementById('stripe-container');
                stripeContainer.classList.add('error');
                setTimeout(() => {
                    stripeContainer.classList.remove('error');
                }, 500);
                return;
            }
            
            showProcessingModal();
            
            await processPayment();
        });
    }
}

async function processPayment() {
    try {
        console.log('💳 Processing payment...');
        
        // Obtener datos del formulario
        const fullName = document.getElementById('fullName').value.trim();
        const email = document.getElementById('email').value.trim();
        const phoneCode = document.getElementById('phoneCode')?.value.trim() || '';
        const phone = document.getElementById('phone')?.value.trim() || '';
        const fullPhone = phoneCode && phone ? phoneCode + phone.replace(/\s/g, '') : '';
        const countryCode = document.getElementById('countryCode')?.value || 'MX';
        const postalCode = document.getElementById('postalCode').value.trim();
        
        const urlParams = new URLSearchParams(window.location.search);
        const plan = urlParams.get('plan') || 'neutron';
        const billingPeriod = 'monthly'; // Por ahora solo mensual
        
        // Crear checkout session en el backend
        console.log('📤 Creating checkout session...');
        const checkoutResponse = await fetch('/api/stripe/checkout', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            credentials: 'include',
            body: JSON.stringify({
                fullName,
                email,
                phone: fullPhone,
                countryCode,
                postalCode,
                plan,
                billingPeriod
            })
        });
        
        if (!checkoutResponse.ok) {
            const error = await checkoutResponse.json();
            throw new Error(error.error || 'Error al crear sesión de pago');
        }
        
        const checkoutData = await checkoutResponse.json();
        console.log('✅ Checkout session created:', checkoutData);
        
        // Confirmar pago con Stripe
        console.log('💳 Confirming payment with Stripe...');
        const { error: confirmError } = await stripe.confirmCardPayment(
            checkoutData.clientSecret,
            {
                payment_method: {
                    card: cardElement,
                    billing_details: {
                        name: fullName,
                        email: email,
                        phone: fullPhone,
                        address: {
                            country: countryCode,
                            postal_code: postalCode
                        }
                    }
                }
            }
        );
        
        if (confirmError) {
            hideProcessingModal();
            console.error('❌ Payment error:', confirmError);
            alert(`Error: ${confirmError.message}`);
            return;
        }
        
        console.log('✅ Payment confirmed with Stripe');
        
        // Confirmar pago en el backend
        const confirmResponse = await fetch('/api/stripe/confirm', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            credentials: 'include',
            body: JSON.stringify({
                paymentIntentId: checkoutData.clientSecret.split('_secret_')[0],
                plan,
                billingPeriod
            })
        });
        
        if (!confirmResponse.ok) {
            throw new Error('Error al confirmar pago en el servidor');
        }
        
        console.log('✅ Payment confirmed on backend');
        
        hideProcessingModal();
        showSuccessModal();
        
    } catch (error) {
        console.error('❌ Payment error:', error);
        hideProcessingModal();
        alert(`Error procesando el pago: ${error.message}`);
    }
}

// ============================================
// MODALS
// ============================================

function showProcessingModal() {
    const modal = document.getElementById('processingModal');
    if (modal) {
        modal.classList.add('show');
        document.body.style.overflow = 'hidden';
    }
}

function hideProcessingModal() {
    const modal = document.getElementById('processingModal');
    if (modal) {
        modal.classList.remove('show');
        document.body.style.overflow = '';
    }
}

function showSuccessModal() {
    const modal = document.getElementById('successModal');
    if (modal) {
        modal.classList.add('show');
        document.body.style.overflow = 'hidden';
    }
}

// ============================================
// LOAD PLAN DETAILS
// ============================================

function loadPlanDetails() {
    const urlParams = new URLSearchParams(window.location.search);
    const plan = urlParams.get('plan') || 'neutron';
    
    const plans = {
        proton: {
            name: 'Plan Protón',
            price: 149,
            features: [
                '1 Chatbot incluido',
                '1,000 mensajes/mes',
                'Integración WhatsApp',
                'Soporte por email'
            ]
        },
        neutron: {
            name: 'Plan Neutrón',
            price: 255,
            features: [
                '3 Chatbots incluidos',
                '10,000 mensajes/mes',
                'Todas las plataformas',
                'Soporte prioritario'
            ]
        },
        electron: {
            name: 'Plan Electrón',
            price: 799,
            features: [
                'Chatbots ilimitados',
                'Mensajes ilimitados',
                'Todas las funcionalidades',
                'Soporte dedicado 24/7'
            ]
        }
    };
    
    const selectedPlan = plans[plan] || plans.neutron;
    
    const planNameElement = document.getElementById('selectedPlanName');
    if (planNameElement) {
        planNameElement.textContent = selectedPlan.name;
    }
    
    if (selectedPlan.price > 0) {
        const subtotal = selectedPlan.price;
        const tax = subtotal * 0.16;
        const total = subtotal + tax;
        
        const subtotalElement = document.getElementById('subtotal');
        const taxElement = document.getElementById('tax');
        const totalElement = document.getElementById('total');
        
        if (subtotalElement) subtotalElement.textContent = `$${subtotal.toFixed(2)} MXN`;
        if (taxElement) taxElement.textContent = `$${tax.toFixed(2)} MXN`;
        if (totalElement) totalElement.textContent = `$${total.toFixed(2)} MXN`;
    }
    
    const featuresList = document.getElementById('planFeatures');
    if (featuresList) {
        featuresList.innerHTML = selectedPlan.features.map(feature => `
            <li>
                <i class="lni lni-checkmark-circle"></i>
                <span>${feature}</span>
            </li>
        `).join('');
    }
    
    console.log('📋 Plan details loaded:', selectedPlan.name);
}

// ============================================
// KEYBOARD NAVIGATION
// ============================================

document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
        hideProcessingModal();
    }
});

document.querySelectorAll('.form-input, .form-select').forEach(input => {
    input.addEventListener('keypress', function(e) {
        if (e.key === 'Enter' && this.tagName !== 'TEXTAREA') {
            e.preventDefault();
            const formInputs = Array.from(document.querySelectorAll('.form-input, .form-select'));
            const currentIndex = formInputs.indexOf(this);
            if (currentIndex < formInputs.length - 1) {
                formInputs[currentIndex + 1].focus();
            }
        }
    });
});

console.log('✅ Checkout JS initialized');
console.log('🔒 Security: PCI compliant payment processing');
console.log('💳 Stripe integration: READY');