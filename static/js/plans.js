// Plans page functionality

document.addEventListener('DOMContentLoaded', function() {
    const billingToggle = document.getElementById('billingToggle');
    const priceAmounts = document.querySelectorAll('.price-amount');

    // Toggle between monthly and annual billing
    if (billingToggle) {
        billingToggle.addEventListener('change', function() {
            const isAnnual = this.checked;
            
            priceAmounts.forEach(priceElement => {
                const monthly = priceElement.getAttribute('data-monthly');
                const annual = priceElement.getAttribute('data-annual');
                
                if (monthly && annual) {
                    if (isAnnual) {
                        // Mostrar precio anual (ya con descuento del 20%)
                        priceElement.textContent = '$' + annual;
                    } else {
                        // Mostrar precio mensual
                        priceElement.textContent = '$' + monthly;
                    }
                }
            });
        });
    }

    // Handle plan button clicks
    const planButtons = document.querySelectorAll('.plan-button');
    planButtons.forEach(button => {
        button.addEventListener('click', function() {
            if (this.classList.contains('upgrade')) {
                handleUpgrade(this.closest('.pricing-card').getAttribute('data-plan'));
            } else if (this.classList.contains('secondary')) {
                handleContactSales();
            }
        });
    });
});

function handleUpgrade(plan) {
    // Aquí iría la lógica para actualizar el plan
    console.log('Upgrading to plan:', plan);
    
    // Mostrar confirmación
    if (confirm(`¿Deseas actualizar tu plan a ${plan}?`)) {
        // Redirigir a la página de checkout o procesamiento
        window.location.href = `/checkout?plan=${plan}`;
    }
}

function handleContactSales() {
    // Aquí iría la lógica para contactar ventas
    console.log('Contact sales clicked');
    
    // Redirigir a formulario de contacto o abrir modal
    window.location.href = '/contact-sales';
}