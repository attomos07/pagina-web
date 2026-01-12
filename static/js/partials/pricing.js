// ============================================
// PRICING.JS - FUNCIONALIDADES COMPLETAS
// ============================================

let plansData = null;

document.addEventListener('DOMContentLoaded', function() {
    console.log('💰 Pricing page loaded');
    
    // Inicializar todas las funcionalidades
    initNavbar();
    initParticles();
    loadPlansData();
    initBillingToggle();
    initPricingAnimations();
    initPricingInteractions();
    initComparisonTable();
    initFAQ();
    setActiveNavLink();
    
    console.log('✅ Pricing functionality initialized');
});

// ============================================
// CARGAR DATOS DE PLANES DESDE LA API
// ============================================

async function loadPlansData() {
    try {
        const response = await fetch('/api/plans-data', {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
            },
            credentials: 'include'
        });
        
        const data = await response.json();
        
        if (!response.ok || !data.success) {
            console.warn('⚠️ No se pudieron cargar precios de Stripe, usando valores del HTML');
            return;
        }
        
        plansData = data.plans;
        console.log('✅ Datos de planes cargados:', plansData);
        
        // Actualizar precios en las tarjetas existentes
        updatePricingCards();
        
    } catch (error) {
        console.error('❌ Error cargando planes:', error);
        // Mantener los precios estáticos del HTML si falla la carga
    }
}

// ============================================
// ACTUALIZAR TARJETAS DE PRECIOS CON DATOS DE STRIPE
// ============================================

function updatePricingCards() {
    if (!plansData) return;
    
    plansData.forEach(plan => {
        const planCard = document.querySelector(`.pricing-card[data-plan="${plan.id}"]`);
        if (!planCard) return;
        
        const priceElement = planCard.querySelector('.price-amount');
        if (!priceElement) return;
        
        // Actualizar atributos de precio
        const monthlyPrice = plan.monthly.amount || 0;
        const annualPrice = plan.annual.amount || 0;
        
        priceElement.setAttribute('data-monthly', monthlyPrice);
        priceElement.setAttribute('data-annual', annualPrice);
        
        // Actualizar el texto mostrado según el billing toggle actual
        const billingToggle = document.getElementById('billingToggle');
        const isAnnual = billingToggle && billingToggle.checked;
        
        priceElement.textContent = `${isAnnual ? annualPrice : monthlyPrice}`;
        
        console.log(`💰 Precio actualizado para ${plan.id}: Monthly=${monthlyPrice}, Annual=${annualPrice}`);
    });
}

// ============================================
// NAVBAR FUNCTIONALITY
// ============================================
function initNavbar() {
    const mobileMenuBtn = document.getElementById('mobileMenuBtn');
    const navMenu = document.getElementById('navMenu');
    const navbar = document.getElementById('navbar');

    if (mobileMenuBtn && navMenu) {
        mobileMenuBtn.classList.remove('active');
        navMenu.classList.remove('active');
        document.body.classList.remove('menu-open');
    }

    window.addEventListener('scroll', function() {
        if (navbar) {
            if (window.scrollY > 50) {
                navbar.classList.add('scrolled');
            } else {
                navbar.classList.remove('scrolled');
            }
        }
    });

    function closeMobileMenu() {
        if (mobileMenuBtn && navMenu) {
            mobileMenuBtn.classList.remove('active');
            navMenu.classList.remove('active');
            document.body.classList.remove('menu-open');
        }
    }

    if (mobileMenuBtn && navMenu) {
        mobileMenuBtn.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            
            const isMenuActive = navMenu.classList.contains('active');
            
            if (isMenuActive) {
                closeMobileMenu();
            } else {
                mobileMenuBtn.classList.add('active');
                navMenu.classList.add('active');
                document.body.classList.add('menu-open');
            }
        });
    }

    const navLinks = document.querySelectorAll('.nav-link');
    navLinks.forEach(link => {
        link.addEventListener('click', function() {
            closeMobileMenu();
        });
    });

    document.addEventListener('click', function(e) {
        if (navMenu && navMenu.classList.contains('active')) {
            const clickedInsideMenu = navMenu.contains(e.target);
            const clickedOnButton = mobileMenuBtn && mobileMenuBtn.contains(e.target);
            
            if (!clickedInsideMenu && !clickedOnButton) {
                closeMobileMenu();
            }
        }
    });

    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            if (navMenu && navMenu.classList.contains('active')) {
                closeMobileMenu();
            }
        }
    });
}

function setActiveNavLink() {
    const navLinks = document.querySelectorAll('.nav-link:not(.nav-cta):not(.nav-login)');
    
    navLinks.forEach(link => link.classList.remove('active'));
    
    const pricingLink = document.querySelector('.nav-link[href="/pricing"]');
    if (pricingLink) {
        pricingLink.classList.add('active');
    }
}

// ============================================
// PARTICLES SYSTEM
// ============================================
function initParticles() {
    const canvas = document.getElementById('particles-canvas');
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    let particles = [];
    let mouse = { x: null, y: null, radius: 150 };

    canvas.width = canvas.parentElement.offsetWidth;
    canvas.height = canvas.parentElement.offsetHeight;

    canvas.parentElement.addEventListener('mousemove', (e) => {
        const rect = canvas.getBoundingClientRect();
        mouse.x = e.clientX - rect.left;
        mouse.y = e.clientY - rect.top;
    });

    canvas.parentElement.addEventListener('mouseout', () => {
        mouse.x = null;
        mouse.y = null;
    });

    window.addEventListener('resize', () => {
        canvas.width = canvas.parentElement.offsetWidth;
        canvas.height = canvas.parentElement.offsetHeight;
        init();
    });

    class Particle {
        constructor(x, y) {
            this.x = x;
            this.y = y;
            this.size = Math.random() * 2.5 + 1.5;
            this.vx = (Math.random() - 0.5) * 0.5;
            this.vy = (Math.random() - 0.5) * 0.5;
            
            const colors = [
                'rgba(6, 182, 212, ',
                'rgba(8, 145, 178, ',
                'rgba(34, 211, 238, ',
                'rgba(14, 165, 233, '
            ];
            this.color = colors[Math.floor(Math.random() * colors.length)];
        }

        draw() {
            ctx.fillStyle = this.color + '0.9)';
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
            ctx.closePath();
            ctx.fill();
            
            ctx.fillStyle = this.color + '0.5)';
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.size + 3, 0, Math.PI * 2);
            ctx.closePath();
            ctx.fill();
        }

        update() {
            this.x += this.vx;
            this.y += this.vy;

            if (this.x < -10) this.x = canvas.width + 10;
            if (this.x > canvas.width + 10) this.x = -10;
            if (this.y < -10) this.y = canvas.height + 10;
            if (this.y > canvas.height + 10) this.y = -10;

            if (mouse.x != null && mouse.y != null) {
                let dx = mouse.x - this.x;
                let dy = mouse.y - this.y;
                let distance = Math.sqrt(dx * dx + dy * dy);

                if (distance < mouse.radius) {
                    let force = (mouse.radius - distance) / mouse.radius;
                    let angle = Math.atan2(dy, dx);
                    this.vx -= Math.cos(angle) * force * 0.3;
                    this.vy -= Math.sin(angle) * force * 0.3;
                }
            }

            const maxSpeed = 1.2;
            const speed = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
            if (speed > maxSpeed) {
                this.vx = (this.vx / speed) * maxSpeed;
                this.vy = (this.vy / speed) * maxSpeed;
            }

            this.vx *= 0.98;
            this.vy *= 0.98;

            if (Math.abs(this.vx) < 0.1) this.vx += (Math.random() - 0.5) * 0.08;
            if (Math.abs(this.vy) < 0.1) this.vy += (Math.random() - 0.5) * 0.08;
        }
    }

    function init() {
        particles = [];
        const numberOfParticles = Math.floor((canvas.width * canvas.height) / 10000);
        
        for (let i = 0; i < numberOfParticles; i++) {
            let x = Math.random() * canvas.width;
            let y = Math.random() * canvas.height;
            particles.push(new Particle(x, y));
        }
    }

    function connect() {
        for (let a = 0; a < particles.length; a++) {
            for (let b = a + 1; b < particles.length; b++) {
                let dx = particles[a].x - particles[b].x;
                let dy = particles[a].y - particles[b].y;
                let distance = Math.sqrt(dx * dx + dy * dy);

                if (distance < 120) {
                    let opacity = 1 - (distance / 120);
                    
                    ctx.strokeStyle = `rgba(6, 182, 212, ${opacity * 0.5})`;
                    ctx.lineWidth = opacity * 2;
                    ctx.beginPath();
                    ctx.moveTo(particles[a].x, particles[a].y);
                    ctx.lineTo(particles[b].x, particles[b].y);
                    ctx.stroke();
                }
            }
        }
    }

    function animate() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        for (let i = 0; i < particles.length; i++) {
            particles[i].update();
            particles[i].draw();
        }
        
        connect();
        requestAnimationFrame(animate);
    }

    init();
    animate();
    
    console.log('✅ Sistema de partículas inicializado');
}

// ============================================
// BILLING TOGGLE FUNCTIONALITY
// ============================================
function initBillingToggle() {
    const billingToggle = document.getElementById('billingToggle');
    
    if (!billingToggle) return;
    
    billingToggle.addEventListener('change', function() {
        const isYearly = this.checked;
        const allPrices = document.querySelectorAll('.price-amount');
        
        // Animar cambio de precios
        allPrices.forEach(price => {
            price.style.transform = 'scale(0.8)';
            price.style.opacity = '0.5';
        });
        
        setTimeout(() => {
            allPrices.forEach(price => {
                const monthly = price.getAttribute('data-monthly');
                const annual = price.getAttribute('data-annual');
                
                if (monthly && annual) {
                    price.textContent = isYearly ? `$${annual}` : `$${monthly}`;
                }
                
                price.style.transform = 'scale(1)';
                price.style.opacity = '1';
            });
        }, 200);
        
        // Actualizar labels
        const monthlyLabel = document.querySelector('.toggle-label.monthly');
        const annualLabel = document.querySelector('.toggle-label.annual');
        
        if (isYearly) {
            monthlyLabel.style.color = '#6b7280';
            annualLabel.style.color = '#06b6d4';
        } else {
            monthlyLabel.style.color = '#06b6d4';
            annualLabel.style.color = '#6b7280';
        }
        
        trackBillingToggle(isYearly ? 'yearly' : 'monthly');
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
// PRICING PLAN INTERACTIONS
// ============================================
function initPricingInteractions() {
    const planButtons = document.querySelectorAll('.plan-button');
    const pricingCards = document.querySelectorAll('.pricing-card');
    
    planButtons.forEach(button => {
        button.addEventListener('click', function(e) {
            e.preventDefault();
            
            const planCard = this.closest('.pricing-card');
            if (!planCard) return;
            
            const planName = planCard.querySelector('.plan-name')?.textContent || 'Unknown';
            const planPrice = planCard.querySelector('.price-amount')?.textContent || '$0';
            
            this.style.transform = 'scale(0.95)';
            setTimeout(() => {
                this.style.transform = 'scale(1)';
            }, 150);
            
            trackPlanSelection(planName, planPrice);
            
            const buttonText = this.textContent.toLowerCase();
            if (buttonText.includes('contactar')) {
                handleContactSales(planName);
            } else {
                handlePlanSelection(planName, planPrice);
            }
        });
    });
    
    pricingCards.forEach(card => {
        card.addEventListener('mouseenter', function() {
            this.classList.add('hovered');
        });
        
        card.addEventListener('mouseleave', function() {
            this.classList.remove('hovered');
        });
    });
}

function handleContactSales(planName) {
    const message = `¡Hola! Me interesa el plan ${planName} de chatbots. ¿Pueden contactarme para más detalles?`;
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
    
    makeTableResponsive(table);
    
    const featureRows = table.querySelectorAll('tbody tr');
    featureRows.forEach(row => {
        row.addEventListener('mouseenter', function() {
            this.classList.add('highlighted');
        });
        
        row.addEventListener('mouseleave', function() {
            this.classList.remove('highlighted');
        });
    });
    
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
// FAQ FUNCTIONALITY
// ============================================
function initFAQ() {
    const faqItems = document.querySelectorAll('.faq-item');
    
    faqItems.forEach(item => {
        const question = item.querySelector('.faq-question');
        
        question.addEventListener('click', function() {
            const wasActive = item.classList.contains('active');
            
            faqItems.forEach(otherItem => {
                otherItem.classList.remove('active');
            });
            
            if (!wasActive) {
                item.classList.add('active');
            }
        });
    });
}

// ============================================
// UTILITY FUNCTIONS
// ============================================
function openWhatsAppWithMessage(customMessage) {
    const phoneNumber = '528123092839';
    const encodedMessage = encodeURIComponent(customMessage);
    const whatsappURL = `https://wa.me/${phoneNumber}?text=${encodedMessage}`;
    window.open(whatsappURL, '_blank');
}

function openWhatsApp() {
    const message = '¡Hola! Me gustaría obtener más información sobre los planes de chatbots.';
    openWhatsAppWithMessage(message);
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
}

console.log('💰 Pricing.js loaded successfully');