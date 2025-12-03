// ============================================
// CHECKOUT JAVASCRIPT
// ============================================

document.addEventListener('DOMContentLoaded', function() {
    console.log('🛒 Checkout page loaded');
    
    initLogoAnimation();
    initPaymentMethodToggle();
    initCardFormatting();
    initFormValidation();
    initPaymentForm();
    loadPlanDetails();
});

// ============================================
// LOGO ANIMATION
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
// CARD FORMATTING
// ============================================

function initCardFormatting() {
    const cardNumberInput = document.getElementById('cardNumber');
    const cardExpiryInput = document.getElementById('cardExpiry');
    const cardCVVInput = document.getElementById('cardCVV');
    const cardBrandIcon = document.getElementById('cardBrand');

    // Format card number
    if (cardNumberInput) {
        cardNumberInput.addEventListener('input', function(e) {
            let value = e.target.value.replace(/\s/g, '');
            let formattedValue = value.match(/.{1,4}/g)?.join(' ') || value;
            e.target.value = formattedValue;

            // Detect card brand
            detectCardBrand(value, cardBrandIcon);
        });
    }

    // Format expiry date
    if (cardExpiryInput) {
        cardExpiryInput.addEventListener('input', function(e) {
            let value = e.target.value.replace(/\D/g, '');
            if (value.length >= 2) {
                value = value.slice(0, 2) + '/' + value.slice(2, 4);
            }
            e.target.value = value;
        });
    }

    // CVV only numbers
    if (cardCVVInput) {
        cardCVVInput.addEventListener('input', function(e) {
            e.target.value = e.target.value.replace(/\D/g, '');
        });
    }
}

function detectCardBrand(number, iconElement) {
    if (!iconElement) return;

    const firstDigit = number.charAt(0);
    const firstTwoDigits = number.slice(0, 2);

    let brand = '';
    let color = '#06b6d4';

    if (firstDigit === '4') {
        brand = 'VISA';
        color = '#1434CB';
    } else if (['51', '52', '53', '54', '55'].includes(firstTwoDigits)) {
        brand = 'MC';
        color = '#EB001B';
    } else if (['34', '37'].includes(firstTwoDigits)) {
        brand = 'AMEX';
        color = '#006FCF';
    }

    if (brand) {
        iconElement.innerHTML = `<span style="font-weight: 800; color: ${color}; font-size: 0.75rem;">${brand}</span>`;
    } else {
        iconElement.innerHTML = '';
    }
}

// ============================================
// FORM VALIDATION
// ============================================

function initFormValidation() {
    const inputs = document.querySelectorAll('.form-input, .form-select');

    inputs.forEach(input => {
        input.addEventListener('blur', function() {
            validateInput(this);
        });

        input.addEventListener('input', function() {
            if (this.classList.contains('error')) {
                validateInput(this);
            }
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

    if (input.id === 'cardNumber' && value) {
        const cardNumber = value.replace(/\s/g, '');
        if (cardNumber.length < 13 || cardNumber.length > 19) {
            showError(input, 'Número de tarjeta inválido');
            return false;
        }
    }

    if (input.id === 'cardExpiry' && value) {
        const parts = value.split('/');
        if (parts.length !== 2 || parts[0].length !== 2 || parts[1].length !== 2) {
            showError(input, 'Formato inválido (MM/AA)');
            return false;
        }
    }

    if (input.id === 'cardCVV' && value) {
        if (value.length < 3 || value.length > 4) {
            showError(input, 'CVV inválido');
            return false;
        }
    }

    clearError(input);
    return true;
}

function showError(input, message) {
    input.classList.add('error');
    input.style.borderColor = '#ef4444';
    
    let errorMsg = input.parentElement.querySelector('.error-message');
    if (!errorMsg) {
        errorMsg = document.createElement('span');
        errorMsg.className = 'error-message';
        errorMsg.style.color = '#ef4444';
        errorMsg.style.fontSize = '0.875rem';
        errorMsg.style.marginTop = '0.25rem';
        input.parentElement.appendChild(errorMsg);
    }
    errorMsg.textContent = message;
}

function clearError(input) {
    input.classList.remove('error');
    input.style.borderColor = '';
    
    const errorMsg = input.parentElement.querySelector('.error-message');
    if (errorMsg) {
        errorMsg.remove();
    }
}

// ============================================
// FORM SUBMISSION
// ============================================

function initPaymentForm() {
    const form = document.getElementById('paymentForm');
    
    if (form) {
        form.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            // Validate all required fields
            const requiredInputs = form.querySelectorAll('[required]');
            let isValid = true;
            
            requiredInputs.forEach(input => {
                if (!validateInput(input)) {
                    isValid = false;
                }
            });
            
            if (!isValid) {
                alert('Por favor completa todos los campos requeridos correctamente.');
                return;
            }
            
            // Show processing modal
            showProcessingModal();
            
            // Simulate payment processing
            await processPayment();
        });
    }
}

function showProcessingModal() {
    const modal = document.getElementById('processingModal');
    if (modal) {
        modal.classList.add('show');
    }
}

function hideProcessingModal() {
    const modal = document.getElementById('processingModal');
    if (modal) {
        modal.classList.remove('show');
    }
}

function showSuccessModal() {
    const modal = document.getElementById('successModal');
    if (modal) {
        modal.classList.add('show');
    }
}

async function processPayment() {
    try {
        // Simulate API call
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        // Here you would make actual payment API call
        // const response = await fetch('/api/process-payment', {...});
        
        hideProcessingModal();
        showSuccessModal();
        
        console.log('✅ Payment processed successfully');
        
    } catch (error) {
        console.error('❌ Payment error:', error);
        hideProcessingModal();
        alert('Error procesando el pago. Por favor intenta nuevamente.');
    }
}

// ============================================
// LOAD PLAN DETAILS
// ============================================

function loadPlanDetails() {
    // Get plan from URL params
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
            price: 0,
            features: [
                'Chatbots ilimitados',
                'Mensajes ilimitados',
                'Todas las funcionalidades',
                'Soporte dedicado 24/7'
            ]
        }
    };
    
    const selectedPlan = plans[plan] || plans.neutron;
    
    // Update UI
    document.getElementById('selectedPlanName').textContent = selectedPlan.name;
    
    if (selectedPlan.price > 0) {
        const subtotal = selectedPlan.price;
        const tax = subtotal * 0.16;
        const total = subtotal + tax;
        
        document.getElementById('subtotal').textContent = `$${subtotal.toFixed(2)}`;
        document.getElementById('tax').textContent = `$${tax.toFixed(2)}`;
        document.getElementById('total').textContent = `$${total.toFixed(2)}`;
    } else {
        document.getElementById('subtotal').textContent = 'Personalizado';
        document.getElementById('tax').textContent = '-';
        document.getElementById('total').textContent = 'Contactar';
    }
    
    // Update features
    const featuresList = document.getElementById('planFeatures');
    if (featuresList) {
        featuresList.innerHTML = selectedPlan.features.map(feature => `
            <li>
                <i class="lni lni-checkmark-circle"></i>
                <span>${feature}</span>
            </li>
        `).join('');
    }
}

console.log('✅ Checkout JS initialized');