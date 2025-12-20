// ============================================
// PRICING.JS - FUNCIONALIDADES ESPECÍFICAS
// ============================================

document.addEventListener('DOMContentLoaded', function() {
    console.log('💰 Pricing page loaded');
    
    // Inicializar funcionalidades específicas de pricing
    initBillingToggle();
    initPricingAnimations();
    initCustomPricingPlan();
    initPricingInteractions();
    initComparisonTable();
    initEnterpriseSection();
    
    // Inicializar FAQ (heredada de index.js)
    if (typeof window.ChatBotHub?.initFAQ === 'function') {
        window.ChatBotHub.initFAQ();
    }
    
    console.log('✅ Pricing functionality initialized');
});

// ============================================
// BILLING TOGGLE FUNCTIONALITY
// ============================================
function initBillingToggle() {
    const billingToggle = document.getElementById('billingToggle');
    
    if (!billingToggle) return;
    
    billingToggle.addEventListener('change', function() {
        const monthlyPrices = document.querySelectorAll('.price-amount.monthly');
        const yearlyPrices = document.querySelectorAll('.price-amount.yearly');
        const isYearly = this.checked;
        
        // Animar cambio de precios
        const allPrices = document.querySelectorAll('.price-amount');
        allPrices.forEach(price => {
            price.style.transform = 'scale(0.8)';
            price.style.opacity = '0.5';
        });
        
        setTimeout(() => {
            if (isYearly) {
                monthlyPrices.forEach(price => price.style.display = 'none');
                yearlyPrices.forEach(price => price.style.display = 'inline');
            } else {
                monthlyPrices.forEach(price => price.style.display = 'inline');
                yearlyPrices.forEach(price => price.style.display = 'none');
            }
            
            // Animar entrada
            allPrices.forEach(price => {
                price.style.transform = 'scale(1)';
                price.style.opacity = '1';
            });
        }, 200);
        
        // Tracking
        trackBillingToggle(isYearly ? 'yearly' : 'monthly');
        
        // Actualizar custom pricing si existe
        updateCustomPricingDisplay();
    });
}

// ============================================
// PRICING ANIMATIONS
// ============================================
function initPricingAnimations() {
    const pricingCards = document.querySelectorAll('.pricing-card');
    const comparisonTable = document.querySelector('.comparison-table');
    
    const animationObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                if (entry.target.classList.contains('pricing-card')) {
                    entry.target.classList.add('animate-in');
                } else if (entry.target.classList.contains('comparison-table')) {
                    animateTableRows(entry.target);
                }
            }
        });
    }, {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    });

    pricingCards.forEach((card, index) => {
        // Añadir delay basado en índice
        card.style.animationDelay = `${index * 100}ms`;
        animationObserver.observe(card);
    });
    
    if (comparisonTable) {
        animationObserver.observe(comparisonTable);
    }
}

function animateTableRows(table) {
    const rows = table.querySelectorAll('tbody tr');
    rows.forEach((row, index) => {
        setTimeout(() => {
            row.classList.add('animate-in');
        }, index * 100);
    });
}

// ============================================
// CUSTOM PRICING PLAN FUNCTIONALITY
// ============================================
function initCustomPricingPlan() {
    const planTypeButtons = document.querySelectorAll('.plan-type-btn');
    const gbSlider = document.getElementById('gbSlider');
    const gbValue = document.getElementById('gbValue');
    const msgSlider = document.getElementById('msgSlider');
    const msgValue = document.getElementById('msgValue');
    const customPrice = document.getElementById('customPrice');
    
    if (!gbSlider || !gbValue || !customPrice) {
        console.log('Custom pricing elements not found');
        return;
    }
    
    // Configuración de precios
    const pricingConfig = {
        basePrices: {
            universal: { monthly: 255, yearly: 204 },
            ecommerce: { monthly: 655, yearly: 524 }
        },
        gbPricing: {
            universal: { base: 40, pricePerGB: 2.50 },
            ecommerce: { base: 40, pricePerGB: 3.50 }
        },
        msgPricing: {
            universal: { base: 10000, pricePerThousand: 0.05 },
            ecommerce: { base: 5000, pricePerThousand: 0.08 }
        }
    };
    
    let currentPlanType = 'universal';
    let isYearlyBilling = false;
    
    // Función para calcular el precio personalizado
    function calculateCustomPrice() {
        const selectedGB = parseInt(gbSlider.value);
        const selectedMsg = parseInt(msgSlider?.value || 10000);
        const planConfig = pricingConfig.gbPricing[currentPlanType];
        const msgConfig = pricingConfig.msgPricing[currentPlanType];
        const basePrice = pricingConfig.basePrices[currentPlanType];
        
        // Calcular costo adicional por GB
        const additionalGB = Math.max(0, selectedGB - planConfig.base);
        const gbCost = additionalGB * planConfig.pricePerGB;
        
        // Calcular costo adicional por mensajes
        const additionalMsg = Math.max(0, selectedMsg - msgConfig.base);
        const msgCost = (additionalMsg / 1000) * msgConfig.pricePerThousand;
        
        // Precio base según billing
        const billing = isYearlyBilling ? 'yearly' : 'monthly';
        const finalPrice = basePrice[billing] + gbCost + msgCost;
        
        return Math.round(finalPrice);
    }
    
    // Función para actualizar el precio mostrado
    function updateCustomPricingDisplay() {
        const newPrice = calculateCustomPrice();
        
        // Animar cambio de precio
        customPrice.style.transform = 'scale(0.8)';
        setTimeout(() => {
            customPrice.textContent = `$${newPrice}`;
            customPrice.style.transform = 'scale(1)';
        }, 150);
    }
    
    // Event listeners para los botones de tipo de plan
    planTypeButtons.forEach(button => {
        button.addEventListener('click', function() {
            planTypeButtons.forEach(btn => btn.classList.remove('active'));
            this.classList.add('active');
            currentPlanType = this.getAttribute('data-plan-type');
            
            // Animación del botón
            this.style.transform = 'scale(0.95)';
            setTimeout(() => {
                this.style.transform = 'scale(1)';
            }, 150);
            
            updateCustomPricingDisplay();
            trackCustomPlanChange('plan_type', currentPlanType);
        });
    });
    
    // Event listeners para sliders
    if (gbSlider) {
        gbSlider.addEventListener('input', function() {
            gbValue.textContent = this.value;
            updateCustomPricingDisplay();
            
            // Debounced tracking
            clearTimeout(window.gbTrackingTimeout);
            window.gbTrackingTimeout = setTimeout(() => {
                trackCustomPlanChange('storage', this.value);
            }, 500);
        });
    }
    
    if (msgSlider) {
        msgSlider.addEventListener('input', function() {
            const value = parseInt(this.value);
            msgValue.textContent = formatNumber(value);
            updateCustomPricingDisplay();
            
            // Debounced tracking
            clearTimeout(window.msgTrackingTimeout);
            window.msgTrackingTimeout = setTimeout(() => {
                trackCustomPlanChange('messages', value);
            }, 500);
        });
    }
    
    // Detectar cambios en billing toggle
    const billingToggle = document.getElementById('billingToggle');
    if (billingToggle) {
        billingToggle.addEventListener('change', function() {
            isYearlyBilling = this.checked;
            updateCustomPricingDisplay();
        });
    }
    
    // Inicializar valores
    if (gbValue) gbValue.textContent = gbSlider.value;
    if (msgValue && msgSlider) msgValue.textContent = formatNumber(msgSlider.value);
    updateCustomPricingDisplay();
    
    // Función global para obtener el precio actual
    window.getCurrentCustomPrice = function() {
        return {
            planType: currentPlanType,
            gb: parseInt(gbSlider?.value || 40),
            messages: parseInt(msgSlider?.value || 10000),
            billing: isYearlyBilling ? 'yearly' : 'monthly',
            price: calculateCustomPrice()
        };
    };
}

// ============================================
// PRICING PLAN INTERACTIONS
// ============================================
function initPricingInteractions() {
    const planButtons = document.querySelectorAll('.plan-button');
    const pricingCards = document.querySelectorAll('.pricing-card');
    
    // Plan buttons
    planButtons.forEach(button => {
        button.addEventListener('click', function(e) {
            e.preventDefault();
            
            const planCard = this.closest('.pricing-card');
            if (!planCard) return;
            
            const planName = planCard.querySelector('.plan-name')?.textContent || 'Unknown';
            const planPrice = planCard.querySelector('.price-amount:not([style*="display: none"])')?.textContent || '$0';
            
            // Animación de click
            this.style.transform = 'scale(0.95)';
            setTimeout(() => {
                this.style.transform = 'scale(1)';
            }, 150);
            
            // Tracking del plan seleccionado
            trackPlanSelection(planName, planPrice);
            
            // Manejar diferentes tipos de botones
            const buttonText = this.textContent.toLowerCase();
            if (buttonText.includes('contactar')) {
                handleContactSales(planName);
            } else if (buttonText.includes('gratis')) {
                handleFreeTrial(planName);
            } else {
                handlePlanSelection(planName, planPrice);
            }
        });
    });
    
    // Card hover effects
    pricingCards.forEach(card => {
        card.addEventListener('mouseenter', function() {
            this.classList.add('hovered');
            
            // Scale effect suave
            this.style.transform = 'scale(1.02)';
        });
        
        card.addEventListener('mouseleave', function() {
            this.classList.remove('hovered');
            this.style.transform = 'scale(1)';
        });
    });
}

function handleContactSales(planName) {
    let message = '¡Hola! Me interesa el plan Personalizado de chatbots.';
    
    if (planName === 'Personalizado') {
        const customData = window.getCurrentCustomPrice?.();
        if (customData) {
            message += ` Me gustaría una configuración de ${customData.gb}GB, ${formatNumber(customData.messages)} mensajes/mes, plan base ${customData.planType}, facturación ${customData.billing === 'yearly' ? 'anual' : 'mensual'}. El precio estimado es $${customData.price}/mes.`;
        }
    }
    
    message += ' ¿Pueden contactarme para más detalles?';
    
    openWhatsAppWithMessage(message);
}

function handleFreeTrial(planName) {
    const message = `¡Hola! Me interesa comenzar la prueba gratuita del plan ${planName}. ¿Pueden ayudarme con el proceso?`;
    openWhatsAppWithMessage(message);
}

function handlePlanSelection(planName, planPrice) {
    const message = `¡Hola! Me interesa contratar el plan ${planName} (${planPrice}/mes). ¿Pueden darme más información sobre el proceso?`;
    openWhatsAppWithMessage(message);
}

// ============================================
// COMPARISON TABLE
// ============================================
function initComparisonTable() {
    const table = document.querySelector('.comparison-table');
    if (!table) return;
    
    // Hacer la tabla responsive
    makeTableResponsive(table);
    
    // Highlight features on hover
    const featureRows = table.querySelectorAll('tbody tr');
    featureRows.forEach(row => {
        row.addEventListener('mouseenter', function() {
            this.classList.add('highlighted');
        });
        
        row.addEventListener('mouseleave', function() {
            this.classList.remove('highlighted');
        });
    });
    
    // Column highlights
    const headers = table.querySelectorAll('th:not(.feature-column)');
    headers.forEach((header, index) => {
        header.addEventListener('mouseenter', function() {
            highlightColumn(table, index + 1);
        });
        
        header.addEventListener('mouseleave', function() {
            unhighlightColumns(table);
        });
    });
}

function makeTableResponsive(table) {
    const wrapper = table.parentElement;
    if (wrapper && wrapper.classList.contains('comparison-table-wrapper')) {
        
        // Touch scroll indicators
        const scrollIndicator = document.createElement('div');
        scrollIndicator.className = 'scroll-indicator';
        scrollIndicator.textContent = '← Desliza para ver más →';
        wrapper.appendChild(scrollIndicator);
        
        wrapper.addEventListener('scroll', function() {
            const maxScroll = this.scrollWidth - this.clientWidth;
            const currentScroll = this.scrollLeft;
            
            if (currentScroll > 10) {
                scrollIndicator.style.opacity = '0';
            } else {
                scrollIndicator.style.opacity = '1';
            }
        });
    }
}

function highlightColumn(table, columnIndex) {
    const cells = table.querySelectorAll(`td:nth-child(${columnIndex + 1}), th:nth-child(${columnIndex + 1})`);
    cells.forEach(cell => {
        cell.classList.add('column-highlighted');
    });
}

function unhighlightColumns(table) {
    const highlightedCells = table.querySelectorAll('.column-highlighted');
    highlightedCells.forEach(cell => {
        cell.classList.remove('column-highlighted');
    });
}

// ============================================
// ENTERPRISE SECTION
// ============================================
function initEnterpriseSection() {
    const enterpriseBtn = document.querySelector('.enterprise-btn');
    const enterpriseFeatures = document.querySelectorAll('.enterprise-feature');
    
    if (enterpriseBtn) {
        enterpriseBtn.addEventListener('click', function(e) {
            e.preventDefault();
            
            animateButton(this);
            trackContactAction('enterprise', 'sales_contact');
            
            const message = '¡Hola! Me interesa conocer más sobre las soluciones Enterprise para chatbots. ¿Pueden contactarme un especialista?';
            openWhatsAppWithMessage(message);
        });
    }
    
    // Animate enterprise features on scroll
    if (enterpriseFeatures.length > 0) {
        const observer = new IntersectionObserver((entries) => {
            entries.forEach((entry, index) => {
                if (entry.isIntersecting) {
                    setTimeout(() => {
                        entry.target.classList.add('animate-in');
                    }, index * 100);
                }
            });
        }, { threshold: 0.5 });
        
        enterpriseFeatures.forEach(feature => {
            observer.observe(feature);
        });
    }
}

// ============================================
// UTILITY FUNCTIONS
// ============================================
function formatNumber(num) {
    if (num >= 1000) {
        return (num / 1000).toFixed(0) + 'K';
    }
    return num.toString();
}

function animateButton(button) {
    button.style.transform = 'scale(0.95)';
    setTimeout(() => {
        button.style.transform = 'scale(1)';
    }, 150);
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
function trackBillingToggle(billingType) {
    console.log(`Billing changed to: ${billingType}`);
    
    if (typeof gtag !== 'undefined') {
        gtag('event', 'billing_toggle', {
            'billing_type': billingType,
            'event_category': 'pricing',
            'event_label': billingType
        });
    }
}

function trackPlanSelection(planName, planPrice) {
    console.log(`Plan selected: ${planName} - ${planPrice}`);
    
    if (typeof gtag !== 'undefined') {
        gtag('event', 'plan_selection', {
            'plan_name': planName,
            'plan_price': planPrice,
            'event_category': 'pricing',
            'event_label': planName
        });
    }
    
    // Tracking especial para plan personalizado
    if (planName === 'Personalizado') {
        const customData = window.getCurrentCustomPrice?.();
        if (customData) {
            gtag('event', 'custom_plan_config', {
                'plan_type': customData.planType,
                'gb_selected': customData.gb,
                'messages_selected': customData.messages,
                'billing_type': customData.billing,
                'calculated_price': customData.price,
                'event_category': 'pricing',
                'event_label': 'custom_plan'
            });
        }
    }
}

function trackCustomPlanChange(configType, value) {
    console.log(`Custom plan ${configType} changed to: ${value}`);
    
    if (typeof gtag !== 'undefined') {
        gtag('event', 'custom_plan_change', {
            'config_type': configType,
            'config_value': value,
            'event_category': 'pricing',
            'event_label': `custom-${configType}`
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

// ============================================
// MOBILE OPTIMIZATIONS
// ============================================
function optimizePricingForMobile() {
    if (window.innerWidth <= 768) {
        // Simplificar animaciones en móvil
        const cards = document.querySelectorAll('.pricing-card');
        cards.forEach(card => {
            card.style.animationDuration = '0.3s';
        });
        
        // Ajustar sliders para touch
        const sliders = document.querySelectorAll('input[type="range"]');
        sliders.forEach(slider => {
            slider.style.height = '20px';
        });
    }
}

// ============================================
// INITIALIZATION ON LOAD
// ============================================
window.addEventListener('load', () => {
    optimizePricingForMobile();
    
    // Verificar que todos los elementos estén cargados
    setTimeout(() => {
        const customPrice = document.getElementById('customPrice');
        if (customPrice && customPrice.textContent === '$0') {
            console.warn('Custom pricing not initialized properly');
        }
    }, 1000);
});

window.addEventListener('resize', window.ChatBotHub?.debounce?.(optimizePricingForMobile, 250));

console.log('💰 Pricing.js loaded successfully');