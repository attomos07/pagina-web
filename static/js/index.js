// ============================================
// MAIN JAVASCRIPT - CON CARRUSEL DE PLATAFORMAS
// ============================================

document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 ChatBot Hub cargado correctamente');
    
    // Inicializar todas las funcionalidades
    initNavbar();
    initHeroAnimations();
    initTypewriterEffect();
    initSectionFadeIn();
    initSocialPlatforms();
    initPlatformsCarousel();
    initFAQ();
    initPricingAnimations();
    initVideoControls();
    initTooltips();
    initCustomPricingPlan();
    initAtomAnimations();
    initBillingToggle();
    
    console.log('✅ Todas las funcionalidades inicializadas');
});

// ============================================
// TYPEWRITER EFFECT FOR HERO TITLE
// ============================================
function initTypewriterEffect() {
    const heroTitle = document.querySelector('.hero-title');
    
    if (!heroTitle) {
        console.log('⚠️ Hero title no encontrado');
        return;
    }
    
    const originalText = heroTitle.textContent;
    heroTitle.textContent = '';
    heroTitle.style.opacity = '1';
    
    // Agregar el cursor parpadeante
    const cursor = document.createElement('span');
    cursor.className = 'typewriter-cursor';
    cursor.textContent = '|';
    heroTitle.appendChild(cursor);
    
    // Agregar estilos para el cursor
    const style = document.createElement('style');
    style.textContent = `
        .typewriter-cursor {
            animation: blink 0.7s infinite;
            margin-left: 2px;
        }
        
        @keyframes blink {
            0%, 49% { opacity: 1; }
            50%, 100% { opacity: 0; }
        }
    `;
    document.head.appendChild(style);
    
    let charIndex = 0;
    const typingSpeed = 100; // Velocidad más lenta (era 50ms, ahora 100ms)
    
    function typeNextChar() {
        if (charIndex < originalText.length) {
            // Insertar el carácter antes del cursor
            const textNode = document.createTextNode(originalText.charAt(charIndex));
            heroTitle.insertBefore(textNode, cursor);
            charIndex++;
            setTimeout(typeNextChar, typingSpeed);
        }
    }
    
    // Iniciar el efecto después de un pequeño delay
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
        console.log('✅ Navbar inicializado - menú cerrado');
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

    function openMobileMenu() {
        if (mobileMenuBtn && navMenu) {
            mobileMenuBtn.classList.add('active');
            navMenu.classList.add('active');
            document.body.classList.add('menu-open');
            console.log('📱 Menú móvil abierto');
        }
    }

    function closeMobileMenu() {
        if (mobileMenuBtn && navMenu) {
            mobileMenuBtn.classList.remove('active');
            navMenu.classList.remove('active');
            document.body.classList.remove('menu-open');
            console.log('❌ Menú móvil cerrado');
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
                openMobileMenu();
            }
        });
    }

    const navLinks = document.querySelectorAll('.nav-link');
    navLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            const href = this.getAttribute('href');
            
            if (!href || href === '#' || href === '') {
                e.preventDefault();
            }
            
            if (!this.classList.contains('nav-cta') && !this.classList.contains('nav-login')) {
                document.querySelectorAll('.nav-link:not(.nav-cta):not(.nav-login)').forEach(l => {
                    l.classList.remove('active');
                });
                this.classList.add('active');
                
                localStorage.setItem('activeNavLink', href);
            }
            
            closeMobileMenu();
        });
    });
    
    const savedActiveLink = localStorage.getItem('activeNavLink');
    if (savedActiveLink && savedActiveLink === window.location.pathname) {
        const linkToActivate = document.querySelector(`.nav-link[href="${savedActiveLink}"]`);
        if (linkToActivate && !linkToActivate.classList.contains('nav-cta') && !linkToActivate.classList.contains('nav-login')) {
            document.querySelectorAll('.nav-link:not(.nav-cta):not(.nav-login)').forEach(l => {
                l.classList.remove('active');
            });
            linkToActivate.classList.add('active');
        }
    }

    document.addEventListener('click', function(e) {
        if (navMenu && navMenu.classList.contains('active')) {
            const clickedInsideMenu = navMenu.contains(e.target);
            const clickedOnButton = mobileMenuBtn && mobileMenuBtn.contains(e.target);
            
            if (!clickedInsideMenu && !clickedOnButton) {
                closeMobileMenu();
            }
        }
    });

    let resizeTimer;
    window.addEventListener('resize', function() {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(function() {
            if (window.innerWidth > 768) {
                closeMobileMenu();
            }
        }, 250);
    });

    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            if (navMenu && navMenu.classList.contains('active')) {
                closeMobileMenu();
            }
        }
    });

    setActiveNavLink();
}

function setActiveNavLink() {
    const currentPath = window.location.pathname;
    const navLinks = document.querySelectorAll('.nav-link:not(.nav-cta):not(.nav-login)');
    
    navLinks.forEach(link => link.classList.remove('active'));
    
    let linkActivated = false;
    
    navLinks.forEach(link => {
        const linkHref = link.getAttribute('href');
        if (linkHref === currentPath) {
            link.classList.add('active');
            linkActivated = true;
        }
    });
    
    if (!linkActivated) {
        navLinks.forEach(link => {
            const linkHref = link.getAttribute('href');
            if (linkHref !== '/' && currentPath.startsWith(linkHref)) {
                link.classList.add('active');
                linkActivated = true;
            }
        });
    }
    
    if (!linkActivated && (currentPath === '/' || currentPath === '' || currentPath === '/index')) {
        const homeLink = document.querySelector('.nav-link[href="/"]');
        if (homeLink) {
            homeLink.classList.add('active');
        }
    }
    
    console.log(`✅ Link activo establecido para: ${currentPath}`);
}

// ============================================
// HERO SECTION ANIMATIONS
// ============================================
function initHeroAnimations() {
    const heroBtn = document.querySelector('.hero-btn');
    
    if (heroBtn) {
        heroBtn.addEventListener('click', function() {
            console.log('🎯 Botón Hero clickeado - Explorar Chatbots');
            
            this.style.transform = 'scale(0.95)';
            setTimeout(() => {
                this.style.transform = 'scale(1)';
            }, 150);
            
            const platformsSection = document.querySelector('.platforms-section');
            if (platformsSection) {
                platformsSection.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });
            }
            
            trackButtonClick('hero_explore_chatbots');
        });
    }
    
    const heroElements = document.querySelectorAll('.hero-content');
    
    const heroObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.style.animationPlayState = 'running';
            }
        });
    }, { threshold: 0.1 });

    heroElements.forEach(element => {
        heroObserver.observe(element);
    });
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
// PLATFORMS CAROUSEL - CORREGIDO
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