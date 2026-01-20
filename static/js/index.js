// ============================================
// MAIN JAVASCRIPT - CON CARRUSEL DE PLATAFORMAS Y PRECIOS DINÁMICOS
// ============================================

let plansData = null;

document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 ChatBot Hub cargado correctamente');
    
    // Inicializar todas las funcionalidades
    initParticles();
    initHeroButtons();
    initTypewriterEffect();
    initSectionFadeIn();
    initSocialPlatforms();
    initPlatformsCarousel();
    initFAQ();
    loadPlansDataForIndex(); // ← Nueva función para cargar precios
    initPricingAnimations();
    initVideoControls();
    initTooltips();
    initCustomPricingPlan();
    initAtomAnimations();
    initBillingToggle();
    
    console.log('✅ Todas las funcionalidades inicializadas');
});

// ============================================
// CARGAR DATOS DE PLANES DESDE LA API (PARA INDEX)
// ============================================

async function loadPlansDataForIndex() {
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
        console.log('✅ Datos de planes cargados para index:', plansData);
        
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
        
        priceElement.textContent = `$${isAnnual ? annualPrice : monthlyPrice}`;
        
        console.log(`💰 Precio actualizado para ${plan.id}: Monthly=$${monthlyPrice}, Annual=$${annualPrice}`);
    });
}

// ============================================
// TYPEWRITER EFFECT FOR HERO TITLE
// ============================================
function initTypewriterEffect() {
    const heroTitle = document.querySelector('.hero-title');
    
    if (!heroTitle) {
        console.log('⚠️ Hero title no encontrado');
        return;
    }
    
    // Guardar el contenido original
    const originalHTML = heroTitle.innerHTML;
    
    // Crear estilos para el cursor si no existen
    if (!document.getElementById('typewriter-styles')) {
        const style = document.createElement('style');
        style.id = 'typewriter-styles';
        style.textContent = `
            .typewriter-cursor {
                display: inline-block;
                animation: blink 0.7s infinite;
                margin-left: 2px;
                color: #06b6d4;
                font-weight: 700;
            }
            
            @keyframes blink {
                0%, 49% { opacity: 1; }
                50%, 100% { opacity: 0; }
            }
            
            .hero-title {
                min-height: 1.2em;
            }
        `;
        document.head.appendChild(style);
    }
    
    // Limpiar y preparar
    heroTitle.innerHTML = '';
    heroTitle.style.visibility = 'visible';
    
    // Crear contenedor de texto
    const textContainer = document.createElement('span');
    textContainer.style.display = 'inline';
    heroTitle.appendChild(textContainer);
    
    // Crear cursor
    const cursor = document.createElement('span');
    cursor.className = 'typewriter-cursor';
    cursor.textContent = '|';
    heroTitle.appendChild(cursor);
    
    let charIndex = 0;
    const typingSpeed = 60;
    
    function typeNextChar() {
        if (charIndex < originalHTML.length) {
            textContainer.innerHTML = originalHTML.substring(0, charIndex + 1);
            charIndex++;
            setTimeout(typeNextChar, typingSpeed);
        } else {
            // Remover cursor después de terminar
            setTimeout(() => {
                if (cursor && cursor.parentNode) {
                    cursor.remove();
                }
            }, 1000);
        }
    }
    
    // Iniciar después de un delay
    setTimeout(typeNextChar, 800);
    
    console.log('✅ Efecto typewriter inicializado');
}

// ============================================
// FADE-IN ANIMATION FOR ALL SECTIONS
// ============================================
function initSectionFadeIn() {
    // Seleccionar todas las secciones principales excepto el hero
    const sections = document.querySelectorAll('.social-platforms-section, .platforms-section, .pricing-section, .faq-section');
    
    if (sections.length === 0) {
        console.log('⚠️ No se encontraron secciones para animar');
        return;
    }
    
    // Agregar estilo inicial a cada sección
    sections.forEach(section => {
        section.style.opacity = '0';
        section.style.transform = 'translateY(30px)';
        section.style.transition = 'opacity 1s cubic-bezier(0.23, 1, 0.32, 1), transform 1s cubic-bezier(0.23, 1, 0.32, 1)';
    });
    
    // Crear observer para detectar cuando las secciones entran en viewport
    const sectionObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.style.opacity = '1';
                entry.target.style.transform = 'translateY(0)';
                sectionObserver.unobserve(entry.target);
            }
        });
    }, { 
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    });
    
    // Observar cada sección
    sections.forEach(section => {
        sectionObserver.observe(section);
    });
    
    console.log('✅ Fade-in animations para secciones inicializadas');
}





// ============================================
// ATOM ANIMATIONS
// ============================================
function initAtomAnimations() {
    const atoms = document.querySelectorAll('.atome-decoration');
    
    if (atoms.length === 0) {
        console.log('⚠️ Átomos decorativos no encontrados');
        return;
    }
    
    const atomObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            const atomWrap = entry.target.querySelector('.atome-wrap');
            const circles = entry.target.querySelectorAll('.circle');
            
            if (entry.isIntersecting) {
                if (atomWrap) atomWrap.style.animationPlayState = 'running';
                circles.forEach(circle => {
                    circle.style.animationPlayState = 'running';
                });
            } else {
                if (atomWrap) atomWrap.style.animationPlayState = 'paused';
                circles.forEach(circle => {
                    circle.style.animationPlayState = 'paused';
                });
            }
        });
    }, { threshold: 0.1 });

    atoms.forEach(atom => {
        atomObserver.observe(atom);
    });
    
    console.log('✅ Animaciones de átomos inicializadas');
}

// ============================================
// SOCIAL PLATFORMS SECTION
// ============================================
function initSocialPlatforms() {
    const socialItems = document.querySelectorAll('.social-platform-item');
    
    socialItems.forEach(item => {
        item.addEventListener('click', function() {
            const platform = this.getAttribute('data-platform');
            const platformName = this.querySelector('.social-platform-name').textContent;
            
            console.log(`🎯 Plataforma seleccionada: ${platform} - ${platformName}`);
            
            this.style.transform = 'scale(0.95)';
            setTimeout(() => {
                this.style.transform = 'scale(1)';
            }, 150);
            
            trackSocialPlatformClick(platform, platformName);
            
            const platformsCarousel = document.getElementById('platformsCarousel');
            if (platformsCarousel) {
                const targetSlide = platformsCarousel.querySelector(`[data-platform="${platform}"]`);
                if (targetSlide) {
                    const slideIndex = Array.from(platformsCarousel.children).indexOf(targetSlide);
                    if (window.goToSlide) {
                        window.goToSlide(slideIndex);
                    }
                }
                
                platformsCarousel.scrollIntoView({
                    behavior: 'smooth',
                    block: 'center'
                });
            }
        });
    });
    
    console.log('✅ Social platforms inicializadas');
}

// ============================================
// PLATFORMS CAROUSEL
// ============================================
function initPlatformsCarousel() {
    const carousel = document.getElementById('platformsCarousel');
    const prevBtn = document.getElementById('carouselPrev');
    const nextBtn = document.getElementById('carouselNext');
    
    if (!carousel || !prevBtn || !nextBtn) {
        console.log('⚠️ Elementos del carrusel no encontrados');
        return;
    }
    
    const slides = carousel.querySelectorAll('.platform-slide');
    let currentSlide = 0;
    
    function updateCarousel() {
        // Remover clases de todos los slides
        slides.forEach((slide, index) => {
            slide.classList.remove('active', 'prev');
            
            if (index === currentSlide) {
                slide.classList.add('active');
            } else if (index < currentSlide) {
                slide.classList.add('prev');
            }
        });
        
        // Actualizar botones
        prevBtn.style.opacity = currentSlide === 0 ? '0.5' : '1';
        prevBtn.style.pointerEvents = currentSlide === 0 ? 'none' : 'auto';
        
        nextBtn.style.opacity = currentSlide === slides.length - 1 ? '0.5' : '1';
        nextBtn.style.pointerEvents = currentSlide === slides.length - 1 ? 'none' : 'auto';
        
        trackCarouselNavigation(currentSlide);
    }
    
    function goToSlide(index) {
        if (index >= 0 && index < slides.length) {
            currentSlide = index;
            updateCarousel();
        }
    }
    
    window.goToSlide = goToSlide;
    
    prevBtn.addEventListener('click', () => {
        if (currentSlide > 0) {
            currentSlide--;
            updateCarousel();
        }
    });
    
    nextBtn.addEventListener('click', () => {
        if (currentSlide < slides.length - 1) {
            currentSlide++;
            updateCarousel();
        }
    });
    
    let startX = 0;
    let currentX = 0;
    let isDragging = false;
    
    carousel.addEventListener('touchstart', (e) => {
        startX = e.touches[0].clientX;
        isDragging = true;
    });
    
    carousel.addEventListener('touchmove', (e) => {
        if (!isDragging) return;
        currentX = e.touches[0].clientX;
    });
    
    carousel.addEventListener('touchend', () => {
        if (!isDragging) return;
        isDragging = false;
        
        const diff = startX - currentX;
        
        if (Math.abs(diff) > 50) {
            if (diff > 0 && currentSlide < slides.length - 1) {
                currentSlide++;
            } else if (diff < 0 && currentSlide > 0) {
                currentSlide--;
            }
            updateCarousel();
        }
    });
    
    window.addEventListener('resize', debounce(updateCarousel, 250));
    
    // Inicializar el primer slide como activo
    updateCarousel();
    console.log('✅ Carrusel de plataformas inicializado');
}

// ============================================
// FAQ SECTION
// ============================================
function initFAQ() {
    const faqItems = document.querySelectorAll('.faq-item');
    
    faqItems.forEach(item => {
        const question = item.querySelector('.faq-question');
        
        question.addEventListener('click', function() {
            const isActive = item.classList.contains('active');
            
            faqItems.forEach(otherItem => {
                if (otherItem !== item) {
                    otherItem.classList.remove('active');
                }
            });
            
            if (!isActive) {
                item.classList.add('active');
            } else {
                item.classList.remove('active');
            }
        });
    });
    
    console.log('✅ FAQ inicializado');
}

// ============================================
// PRICING ANIMATIONS
// ============================================
function initPricingAnimations() {
    const pricingCards = document.querySelectorAll('.pricing-card');
    
    const pricingObserver = new IntersectionObserver((entries) => {
        entries.forEach((entry, index) => {
            if (entry.isIntersecting) {
                setTimeout(() => {
                    entry.target.style.opacity = '1';
                    entry.target.style.transform = 'translateY(0)';
                }, index * 100);
                
                pricingObserver.unobserve(entry.target);
            }
        });
    }, { threshold: 0.1 });

    pricingCards.forEach(card => {
        card.style.opacity = '0';
        card.style.transform = 'translateY(30px)';
        card.style.transition = 'all 0.6s cubic-bezier(0.23, 1, 0.32, 1)';
        pricingObserver.observe(card);
    });
    
    const planButtons = document.querySelectorAll('.plan-button');
    planButtons.forEach(button => {
        button.addEventListener('click', function() {
            const card = this.closest('.pricing-card');
            const planName = card.querySelector('.plan-name').textContent;
            const priceAmount = card.querySelector('.price-amount').textContent;
            
            console.log(`💳 Plan seleccionado: ${planName} - ${priceAmount}`);
            
            trackPlanSelection(planName, priceAmount);
            
            this.style.transform = 'scale(0.95)';
            setTimeout(() => {
                this.style.transform = 'scale(1)';
            }, 150);
        });
    });
    
    console.log('✅ Pricing animations inicializadas');
}

// ============================================
// VIDEO CONTROLS
// ============================================
function initVideoControls() {
    const videos = document.querySelectorAll('.phone-screen-video');
    
    videos.forEach(video => {
        video.setAttribute('playsinline', '');
        video.setAttribute('muted', '');
        video.setAttribute('loop', '');
        
        const playPromise = video.play();
        
        if (playPromise !== undefined) {
            playPromise.catch(error => {
                console.log('Video autoplay prevented:', error);
                
                video.addEventListener('click', () => {
                    if (video.paused) {
                        video.play();
                    } else {
                        video.pause();
                    }
                });
            });
        }
    });
    
    console.log('✅ Controles de video inicializados');
}

// ============================================
// TOOLTIPS
// ============================================
function initTooltips() {
    const elements = document.querySelectorAll('[data-tooltip]');
    
    elements.forEach(element => {
        element.addEventListener('mouseenter', function() {
            const tooltipText = this.getAttribute('data-tooltip');
            const tooltip = document.createElement('div');
            tooltip.className = 'custom-tooltip';
            tooltip.textContent = tooltipText;
            document.body.appendChild(tooltip);
            
            const rect = this.getBoundingClientRect();
            tooltip.style.top = `${rect.top - tooltip.offsetHeight - 10}px`;
            tooltip.style.left = `${rect.left + (rect.width / 2) - (tooltip.offsetWidth / 2)}px`;
            
            this.tooltipElement = tooltip;
        });
        
        element.addEventListener('mouseleave', function() {
            if (this.tooltipElement) {
                this.tooltipElement.remove();
                this.tooltipElement = null;
            }
        });
    });
}

// ============================================
// WHATSAPP FLOAT BUTTON
// ============================================
function openWhatsApp() {
    const phoneNumber = '+528123092839';
    let message = '¡Hola! Me gustaría obtener más información sobre los chatbots de IA. ';
    
    const customPriceData = window.getCurrentCustomPrice?.();
    
    if (customPriceData) {
        message += `\n\nEstoy interesado en un plan personalizado:\n`;
        message += `- Tipo: ${customPriceData.planType}\n`;
        message += `- Almacenamiento: ${customPriceData.gb} GB\n`;
        message += `- Precio calculado: $${customPriceData.price} MXN/mes`;
        
        trackWhatsAppClick(customPriceData);
    } else {
        trackWhatsAppClick(null);
    }
    
    const encodedMessage = encodeURIComponent(message);
    const whatsappUrl = `https://wa.me/${phoneNumber}?text=${encodedMessage}`;
    
    window.open(whatsappUrl, '_blank');
    
    console.log('📱 WhatsApp abierto con mensaje:', message);
}

// ============================================
// BILLING TOGGLE (MONTHLY/ANNUAL)
// ============================================
function initBillingToggle() {
    const billingToggle = document.getElementById('billingToggle');
    const monthlyLabel = document.querySelector('.billing-label.monthly');
    const annualLabel = document.querySelector('.billing-label.annual');
    const priceAmounts = document.querySelectorAll('.price-amount[data-monthly][data-annual]');
    
    if (!billingToggle) return;
    
    billingToggle.addEventListener('change', function() {
        const isAnnual = this.checked;
        
        if (monthlyLabel && annualLabel) {
            if (isAnnual) {
                monthlyLabel.style.color = '#9ca3af';
                annualLabel.style.color = '#06b6d4';
            } else {
                monthlyLabel.style.color = '#06b6d4';
                annualLabel.style.color = '#9ca3af';
            }
        }
        
        priceAmounts.forEach(priceElement => {
            const monthlyPrice = priceElement.getAttribute('data-monthly');
            const annualPrice = priceElement.getAttribute('data-annual');
            
            if (isAnnual) {
                priceElement.textContent = `$${annualPrice}`;
                const periodElement = priceElement.nextElementSibling;
                if (periodElement && periodElement.classList.contains('price-period')) {
                    periodElement.textContent = 'por año';
                }
            } else {
                priceElement.textContent = `$${monthlyPrice}`;
                const periodElement = priceElement.nextElementSibling;
                if (periodElement && periodElement.classList.contains('price-period')) {
                    periodElement.textContent = 'por mes';
                }
            }
        });
        
        console.log(`💰 Billing cambiado a: ${isAnnual ? 'Anual' : 'Mensual'}`);
    });
    
    console.log('✅ Billing toggle inicializado');
}

// ============================================
// CUSTOM PRICING PLAN (ELECTRÓN)
// ============================================
function initCustomPricingPlan() {
    const electronCard = document.querySelector('[data-plan="electron"]');
    
    if (!electronCard) return;
    
    const priceDisplay = electronCard.querySelector('.price-amount');
    
    const planTypes = {
        basic: { name: 'Básico', basePrice: 50, pricePerGB: 10 },
        standard: { name: 'Estándar', basePrice: 100, pricePerGB: 8 },
        premium: { name: 'Premium', basePrice: 200, pricePerGB: 6 }
    };
    
    let currentPlanType = 'standard';
    let currentGB = 10;
    
    function calculatePrice() {
        const plan = planTypes[currentPlanType];
        return plan.basePrice + (currentGB * plan.pricePerGB);
    }
    
    function updateDisplay() {
        const price = calculatePrice();
        priceDisplay.textContent = `$${price}`;
    }
    
    window.getCurrentCustomPrice = function() {
        return {
            planType: planTypes[currentPlanType].name,
            gb: currentGB,
            price: calculatePrice()
        };
    };
    
    electronCard.addEventListener('click', function() {
        console.log('⚙️ Plan Electrón clickeado - Configuración personalizada');
    });
    
    updateDisplay();
    console.log('✅ Custom pricing plan inicializado');
}

// ============================================
// SISTEMA DE PARTÍCULAS ANIMADAS
// ============================================
function initParticles() {
    const canvas = document.getElementById('particles-canvas');
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    let particles = [];
    let mouse = { x: null, y: null, radius: 150 };

    // Configurar canvas
    canvas.width = canvas.parentElement.offsetWidth;
    canvas.height = canvas.parentElement.offsetHeight;

    // Eventos de mouse
    canvas.parentElement.addEventListener('mousemove', (e) => {
        const rect = canvas.getBoundingClientRect();
        mouse.x = e.clientX - rect.left;
        mouse.y = e.clientY - rect.top;
    });

    canvas.parentElement.addEventListener('mouseout', () => {
        mouse.x = null;
        mouse.y = null;
    });

    // Redimensionar canvas
    window.addEventListener('resize', () => {
        canvas.width = canvas.parentElement.offsetWidth;
        canvas.height = canvas.parentElement.offsetHeight;
        init();
    });

    // Clase Partícula
    class Particle {
        constructor(x, y) {
            this.x = x;
            this.y = y;
            this.size = Math.random() * 2.5 + 1.5;
            this.vx = (Math.random() - 0.5) * 0.5;
            this.vy = (Math.random() - 0.5) * 0.5;
            
            // Colores cyan/blue más visibles en fondo blanco
            const colors = [
                'rgba(6, 182, 212, ',      // cyan principal
                'rgba(8, 145, 178, ',      // cyan oscuro
                'rgba(34, 211, 238, ',     // cyan claro
                'rgba(14, 165, 233, '      // sky blue
            ];
            this.color = colors[Math.floor(Math.random() * colors.length)];
        }

        draw() {
            ctx.fillStyle = this.color + '0.9)';
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
            ctx.closePath();
            ctx.fill();
            
            // Añadir brillo más visible
            ctx.fillStyle = this.color + '0.5)';
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.size + 3, 0, Math.PI * 2);
            ctx.closePath();
            ctx.fill();
        }

        update() {
            this.x += this.vx;
            this.y += this.vy;

            // Rebote en bordes
            if (this.x < -10) this.x = canvas.width + 10;
            if (this.x > canvas.width + 10) this.x = -10;
            if (this.y < -10) this.y = canvas.height + 10;
            if (this.y > canvas.height + 10) this.y = -10;

            // Interacción con mouse
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

            // Límite de velocidad
            const maxSpeed = 1.2;
            const speed = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
            if (speed > maxSpeed) {
                this.vx = (this.vx / speed) * maxSpeed;
                this.vy = (this.vy / speed) * maxSpeed;
            }

            // Fricción
            this.vx *= 0.98;
            this.vy *= 0.98;

            // Movimiento aleatorio mínimo
            if (Math.abs(this.vx) < 0.1) this.vx += (Math.random() - 0.5) * 0.08;
            if (Math.abs(this.vy) < 0.1) this.vy += (Math.random() - 0.5) * 0.08;
        }
    }

    // Inicializar partículas
    function init() {
        particles = [];
        const numberOfParticles = Math.floor((canvas.width * canvas.height) / 10000);
        
        for (let i = 0; i < numberOfParticles; i++) {
            let x = Math.random() * canvas.width;
            let y = Math.random() * canvas.height;
            particles.push(new Particle(x, y));
        }
    }

    // Conectar partículas cercanas
    function connect() {
        for (let a = 0; a < particles.length; a++) {
            for (let b = a + 1; b < particles.length; b++) {
                let dx = particles[a].x - particles[b].x;
                let dy = particles[a].y - particles[b].y;
                let distance = Math.sqrt(dx * dx + dy * dy);

                if (distance < 120) {
                    let opacity = 1 - (distance / 120);
                    
                    // Líneas más visibles en fondo blanco
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

    // Animar
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
// BOTONES DEL HERO
// ============================================
function initHeroButtons() {
    const primaryBtn = document.querySelector('.hero-btn-primary');
    
    if (primaryBtn) {
        primaryBtn.addEventListener('click', function() {
            console.log('🚀 Crear mi Agente clickeado');
            
            // Animación de click
            this.style.transform = 'scale(0.95)';
            setTimeout(() => {
                this.style.transform = 'translateY(-3px)';
            }, 150);
            
            // Scroll a la sección de plataformas
            const platformsSection = document.querySelector('.social-platforms-section');
            if (platformsSection) {
                platformsSection.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });
            }
        });
    }
    
    console.log('✅ Botones del hero inicializados');
}

// ============================================
// SMOOTH SCROLL
// ============================================
document.addEventListener('DOMContentLoaded', function() {
    const smoothScrollLinks = document.querySelectorAll('a[href^="#"]');
    
    smoothScrollLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            
            const targetId = this.getAttribute('href');
            const targetElement = document.querySelector(targetId);
            
            if (targetElement) {
                targetElement.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });
            }
        });
    });
});

function handleImageError(img) {
    img.style.display = 'none';
    console.log('Error cargando imagen:', img.src);
}

function initLazyLoading() {
    const images = document.querySelectorAll('img[data-src]');
    
    const imageObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const img = entry.target;
                img.src = img.dataset.src;
                img.removeAttribute('data-src');
                imageObserver.unobserve(img);
            }
        });
    });

    images.forEach(img => imageObserver.observe(img));
}

function preloadImages() {
    const criticalImages = [
        '/static/images/mockup.png',
        '/static/images/attomos-logo.png'
    ];
    
    criticalImages.forEach(imageSrc => {
        const img = new Image();
        img.src = imageSrc;
    });
}

document.addEventListener('DOMContentLoaded', initLazyLoading);

// ============================================
// PERFORMANCE OPTIMIZATIONS
// ============================================

function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

function throttle(func, limit) {
    let inThrottle;
    return function() {
        const args = arguments;
        const context = this;
        if (!inThrottle) {
            func.apply(context, args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    }
}

// ============================================
// ANALYTICS Y TRACKING
// ============================================
function trackButtonClick(buttonType) {
    console.log(`Botón clickeado para tracking: ${buttonType}`);
    
    if (typeof gtag !== 'undefined') {
        gtag('event', 'button_click', {
            'button_type': buttonType,
            'event_category': 'engagement',
            'event_label': buttonType
        });
    }
}

function trackSocialPlatformClick(platform, platformName) {
    console.log(`Plataforma social clickeada: ${platform} - ${platformName}`);
    
    if (typeof gtag !== 'undefined') {
        gtag('event', 'social_platform_click', {
            'platform': platform,
            'platform_name': platformName,
            'event_category': 'social_platforms',
            'event_label': platform
        });
    }
}

function trackCarouselNavigation(slideIndex) {
    console.log(`Carrusel navegado a slide: ${slideIndex}`);
    
    if (typeof gtag !== 'undefined') {
        gtag('event', 'carousel_navigation', {
            'slide_index': slideIndex,
            'event_category': 'carousel',
            'event_label': `slide_${slideIndex}`
        });
    }
}

function trackWhatsAppClick(planData) {
    console.log('WhatsApp clickeado', planData);
    
    if (typeof gtag !== 'undefined') {
        gtag('event', 'whatsapp_click', {
            'has_plan_data': !!planData,
            'plan_type': planData?.planType || 'none',
            'event_category': 'contact',
            'event_label': 'whatsapp_float'
        });
    }
}

function trackPlanSelection(planName, planPrice) {
    console.log(`Plan seleccionado para tracking: ${planName} - ${planPrice}`);
    
    if (typeof gtag !== 'undefined') {
        gtag('event', 'plan_selection', {
            'plan_name': planName,
            'plan_price': planPrice,
            'event_category': 'pricing',
            'event_label': planName
        });
    }
    
    if (planName.includes('Electrón')) {
        const customData = window.getCurrentCustomPrice?.();
        if (customData) {
            console.log('Custom plan data:', customData);
            
            if (typeof gtag !== 'undefined') {
                gtag('event', 'custom_plan_config', {
                    'plan_type': customData.planType,
                    'gb_selected': customData.gb,
                    'calculated_price': customData.price,
                    'event_category': 'pricing',
                    'event_label': 'custom_plan'
                });
            }
        }
    }
}

// ============================================
// RESPONSIVE UTILITIES
// ============================================

function isMobileDevice() {
    return window.innerWidth <= 768;
}

function optimizeMobileExperience() {
    if (isMobileDevice()) {
        const videos = document.querySelectorAll('video');
        videos.forEach(video => {
            video.setAttribute('preload', 'none');
        });
        
        const atomWraps = document.querySelectorAll('.atome-wrap');
        atomWraps.forEach(wrap => {
            wrap.style.animationDuration = '15s';
        });
        
        console.log('📱 Experiencia móvil optimizada');
    }
}

window.addEventListener('load', optimizeMobileExperience);
window.addEventListener('resize', debounce(optimizeMobileExperience, 250));

// ============================================
// ERROR HANDLING
// ============================================

window.addEventListener('error', function(e) {
    console.error('Error global capturado:', e.error);
    
    if (typeof gtag !== 'undefined') {
        gtag('event', 'exception', {
            'description': e.error?.message || 'Unknown error',
            'fatal': false
        });
    }
});

// ============================================
// INITIALIZATION COMPLETE
// ============================================

function verifyInitialization() {
    const requiredElements = [
        '#mobileMenuBtn',
        '#navMenu',
        '.nav-link',
        '.hero-section',
        '.social-platforms-section',
        '.platforms-carousel'
    ];
    
    let allElementsFound = true;
    
    requiredElements.forEach(selector => {
        const elements = document.querySelectorAll(selector);
        if (elements.length === 0) {
            console.warn(`Elementos no encontrados: ${selector}`);
            allElementsFound = false;
        }
    });
    
    if (allElementsFound) {
        console.log('✅ Todos los elementos críticos encontrados');
    } else {
        console.warn('⚠️ Algunos elementos críticos no se encontraron');
    }
}

window.addEventListener('load', () => {
    setTimeout(verifyInitialization, 100);
});

// Export functions if needed
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        openWhatsApp,
        debounce,
        throttle,
        trackPlanSelection,
        trackSocialPlatformClick,
        trackCarouselNavigation,
        trackButtonClick,
        trackWhatsAppClick,
        isMobileDevice
    };
}