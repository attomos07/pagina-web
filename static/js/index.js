// ============================================
// MAIN JAVASCRIPT - CON CARRUSEL DE PLATAFORMAS
// ============================================

document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 ChatBot Hub cargado correctamente');
    
    // Inicializar todas las funcionalidades
    initNavbar();
    initHeroAnimations();
    initSocialPlatforms();
    initPlatformsCarousel();
    initFAQ();
    initPricingAnimations();
    initVideoControls();
    initTooltips();
    initCustomPricingPlan();
    initAtomAnimations();
    
    console.log('✅ Todas las funcionalidades inicializadas');
});

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
            
            // Permitir navegación normal
            if (!href || href === '#' || href === '') {
                e.preventDefault();
            }
            
            // Actualizar clase active - excluir botones especiales
            if (!this.classList.contains('nav-cta') && !this.classList.contains('nav-login')) {
                document.querySelectorAll('.nav-link:not(.nav-cta):not(.nav-login)').forEach(l => {
                    l.classList.remove('active');
                });
                this.classList.add('active');
                
                // Guardar en localStorage para persistencia
                localStorage.setItem('activeNavLink', href);
            }
            
            closeMobileMenu();
        });
    });
    
    // Restaurar link activo al cargar la página
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
    
    // Remover active de todos los links
    navLinks.forEach(link => link.classList.remove('active'));
    
    let linkActivated = false;
    
    // Buscar coincidencia exacta primero
    navLinks.forEach(link => {
        const linkHref = link.getAttribute('href');
        if (linkHref === currentPath) {
            link.classList.add('active');
            linkActivated = true;
        }
    });
    
    // Si no hay coincidencia exacta, buscar coincidencias parciales
    if (!linkActivated) {
        navLinks.forEach(link => {
            const linkHref = link.getAttribute('href');
            // Para rutas como /chatbots, /pricing, /contact
            if (linkHref !== '/' && currentPath.startsWith(linkHref)) {
                link.classList.add('active');
                linkActivated = true;
            }
        });
    }
    
    // Si aún no hay link activo y estamos en home
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
    
    console.log('⚛️ Animaciones de átomos decorativos inicializadas (superior derecha y inferior derecha)');
}

// ============================================
// SOCIAL PLATFORMS FUNCTIONALITY
// ============================================
function initSocialPlatforms() {
    const socialItems = document.querySelectorAll('.social-platform-item');
    
    if (socialItems.length === 0) {
        console.log('⚠️ Items de redes sociales no encontrados');
        return;
    }
    
    socialItems.forEach(item => {
        item.addEventListener('click', function() {
            const platform = this.getAttribute('data-platform');
            const platformName = this.querySelector('.social-platform-name')?.textContent || 'Unknown';
            
            this.style.transform = 'scale(0.95)';
            setTimeout(() => {
                this.style.transform = '';
            }, 150);
            
            trackSocialPlatformClick(platform, platformName);
            scrollToPlatformSection(platform);
            
            console.log(`🌐 Plataforma social clickeada: ${platformName}`);
        });
        
        item.addEventListener('mouseenter', function() {
            const icon = this.querySelector('.social-platform-icon');
            if (icon) {
                icon.style.transform = 'scale(1.15) rotate(5deg)';
            }
        });
        
        item.addEventListener('mouseleave', function() {
            const icon = this.querySelector('.social-platform-icon');
            if (icon) {
                icon.style.transform = 'scale(1) rotate(0deg)';
            }
        });
    });
    
    const socialObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.style.animationPlayState = 'running';
            }
        });
    }, { threshold: 0.1 });

    socialItems.forEach(item => {
        socialObserver.observe(item);
    });
    
    console.log('✅ Plataformas sociales inicializadas');
}

function scrollToPlatformSection(platform) {
    const platformSlide = document.querySelector(`.platform-slide[data-platform="${platform}"]`);
    if (platformSlide && window.carouselManager) {
        const slides = document.querySelectorAll('.platform-slide');
        const slideIndex = Array.from(slides).indexOf(platformSlide);
        
        if (slideIndex !== -1) {
            setTimeout(() => {
                window.carouselManager.goToSlide(slideIndex);
                
                const platformsSection = document.querySelector('.platforms-section');
                if (platformsSection) {
                    platformsSection.scrollIntoView({
                        behavior: 'smooth',
                        block: 'center'
                    });
                }
            }, 300);
        }
    }
}

// ============================================
// PLATFORMS CAROUSEL
// ============================================
function initPlatformsCarousel() {
    const carousel = document.getElementById('platformsCarousel');
    const prevBtn = document.getElementById('carouselPrev');
    const nextBtn = document.getElementById('carouselNext');
    const indicatorsContainer = document.getElementById('carouselIndicators');
    
    if (!carousel || !prevBtn || !nextBtn || !indicatorsContainer) {
        console.log('⚠️ Elementos del carrusel no encontrados');
        return;
    }
    
    const slides = carousel.querySelectorAll('.platform-slide');
    let currentSlide = 0;
    let isTransitioning = false;
    let autoplayInterval = null;
    
    // Asegurar que solo el primer slide esté activo al inicio
    slides.forEach((slide, index) => {
        slide.classList.remove('active', 'prev');
        if (index === 0) {
            slide.classList.add('active');
        }
    });
    
    // Crear indicadores
    slides.forEach((_, index) => {
        const indicator = document.createElement('div');
        indicator.classList.add('carousel-indicator');
        if (index === 0) indicator.classList.add('active');
        indicator.addEventListener('click', () => goToSlide(index));
        indicatorsContainer.appendChild(indicator);
    });
    
    const indicators = indicatorsContainer.querySelectorAll('.carousel-indicator');
    
    function updateSlides() {
        slides.forEach((slide, index) => {
            slide.classList.remove('active', 'prev');
            
            if (index === currentSlide) {
                slide.classList.add('active');
            } else if (index < currentSlide) {
                slide.classList.add('prev');
            }
        });
        
        indicators.forEach((indicator, index) => {
            indicator.classList.toggle('active', index === currentSlide);
        });
    }
    
    function goToSlide(index) {
        if (isTransitioning) return;
        if (index < 0 || index >= slides.length) return;
        if (index === currentSlide) return;
        
        isTransitioning = true;
        currentSlide = index;
        updateSlides();
        
        trackCarouselNavigation(currentSlide);
        
        setTimeout(() => {
            isTransitioning = false;
        }, 600);
        
        resetAutoplay();
    }
    
    function nextSlide() {
        const nextIndex = (currentSlide + 1) % slides.length;
        goToSlide(nextIndex);
    }
    
    function prevSlide() {
        const prevIndex = (currentSlide - 1 + slides.length) % slides.length;
        goToSlide(prevIndex);
    }
    
    function startAutoplay() {
        autoplayInterval = setInterval(nextSlide, 5000);
    }
    
    function stopAutoplay() {
        if (autoplayInterval) {
            clearInterval(autoplayInterval);
            autoplayInterval = null;
        }
    }
    
    function resetAutoplay() {
        stopAutoplay();
        startAutoplay();
    }
    
    // Event listeners
    prevBtn.addEventListener('click', prevSlide);
    nextBtn.addEventListener('click', nextSlide);
    
    // Teclado
    document.addEventListener('keydown', (e) => {
        if (isCarouselInView()) {
            if (e.key === 'ArrowLeft') prevSlide();
            if (e.key === 'ArrowRight') nextSlide();
        }
    });
    
    // Touch/swipe support
    let touchStartX = 0;
    let touchEndX = 0;
    
    carousel.addEventListener('touchstart', (e) => {
        touchStartX = e.changedTouches[0].screenX;
    }, { passive: true });
    
    carousel.addEventListener('touchend', (e) => {
        touchEndX = e.changedTouches[0].screenX;
        handleSwipe();
    }, { passive: true });
    
    function handleSwipe() {
        const swipeThreshold = 50;
        const diff = touchStartX - touchEndX;
        
        if (Math.abs(diff) > swipeThreshold) {
            if (diff > 0) {
                nextSlide();
            } else {
                prevSlide();
            }
        }
    }
    
    // Pausar autoplay cuando el usuario interactúa
    carousel.addEventListener('mouseenter', stopAutoplay);
    carousel.addEventListener('mouseleave', startAutoplay);
    
    // Observer para pausar cuando no está visible
    const carouselObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                startAutoplay();
            } else {
                stopAutoplay();
            }
        });
    }, { threshold: 0.3 });
    
    carouselObserver.observe(carousel);
    
    function isCarouselInView() {
        const rect = carousel.getBoundingClientRect();
        return rect.top < window.innerHeight && rect.bottom > 0;
    }
    
    // Inicializar
    updateSlides();
    startAutoplay();
    
    // Exponer funciones globalmente
    window.carouselManager = {
        goToSlide,
        nextSlide,
        prevSlide,
        getCurrentSlide: () => currentSlide
    };
    
    console.log('🎠 Carrusel de plataformas inicializado');
}

// ============================================
// FAQ FUNCTIONALITY
// ============================================
function initFAQ() {
    const faqItems = document.querySelectorAll('.faq-item');
    
    if (faqItems.length === 0) return;
    
    faqItems.forEach(item => {
        const question = item.querySelector('.faq-question');
        
        if (question) {
            question.addEventListener('click', function() {
                const isCurrentlyActive = item.classList.contains('active');
                
                faqItems.forEach(otherItem => {
                    if (otherItem !== item) {
                        otherItem.classList.remove('active');
                    }
                });
                
                if (isCurrentlyActive) {
                    item.classList.remove('active');
                } else {
                    item.classList.add('active');
                }
            });
        }
    });
}

// ============================================
// PRICING ANIMATIONS
// ============================================
function initPricingAnimations() {
    const pricingCards = document.querySelectorAll('.pricing-card');
    const faqElements = document.querySelectorAll('.faq-item');
    
    const animationObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.style.animationPlayState = 'running';
            }
        });
    }, {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    });

    pricingCards.forEach(card => {
        animationObserver.observe(card);
    });
    
    faqElements.forEach(element => {
        animationObserver.observe(element);
    });
}

// ============================================
// CUSTOM PRICING PLAN - PLANES PROTÓN, NEUTRÓN, ELECTRÓN
// ============================================
function initCustomPricingPlan() {
    const planTypeButtons = document.querySelectorAll('.plan-type-btn');
    const gbSlider = document.getElementById('gbSlider');
    const gbValue = document.getElementById('gbValue');
    const customPrice = document.getElementById('customPrice');
    
    if (!gbSlider || !gbValue || !customPrice) {
        console.log('⚠️ Elementos de pricing personalizado no encontrados');
        return;
    }
    
    const basePrices = {
        neutron: 255,
        proton: 655
    };
    
    const pricingConfig = {
        gbPricing: {
            neutron: {
                base: 40,
                pricePerGB: 2.50
            },
            proton: {
                base: 40,
                pricePerGB: 3.50
            }
        }
    };
    
    let currentPlanType = 'neutron';
    
    function calculateCustomPrice() {
        const selectedGB = parseInt(gbSlider.value);
        const planConfig = pricingConfig.gbPricing[currentPlanType];
        const basePrice = basePrices[currentPlanType];
        
        const additionalGB = Math.max(0, selectedGB - planConfig.base);
        const additionalCost = additionalGB * planConfig.pricePerGB;
        const totalPrice = basePrice + additionalCost;
        
        return Math.round(totalPrice);
    }
    
    function updatePriceDisplay() {
        const newPrice = calculateCustomPrice();
        customPrice.textContent = `$${newPrice}`;
    }
    
    planTypeButtons.forEach(button => {
        button.addEventListener('click', function() {
            planTypeButtons.forEach(btn => btn.classList.remove('active'));
            this.classList.add('active');
            currentPlanType = this.getAttribute('data-plan-type');
            updatePriceDisplay();
            
            this.style.transform = 'scale(0.95)';
            setTimeout(() => {
                this.style.transform = 'scale(1)';
            }, 150);
        });
    });
    
    gbSlider.addEventListener('input', function() {
        gbValue.textContent = this.value;
        updatePriceDisplay();
    });
    
    gbValue.textContent = gbSlider.value;
    updatePriceDisplay();
    
    window.getCurrentCustomPrice = function() {
        return {
            planType: currentPlanType,
            gb: parseInt(gbSlider?.value || 40),
            price: calculateCustomPrice()
        };
    };
}

// ============================================
// VIDEO CONTROLS
// ============================================
function initVideoControls() {
    const allVideos = document.querySelectorAll('video');
    
    const videoObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            const video = entry.target;
            if (entry.isIntersecting) {
                video.play().catch(e => console.log('Error playing video:', e));
            } else {
                video.pause();
            }
        });
    }, { threshold: 0.1 });

    allVideos.forEach(video => {
        videoObserver.observe(video);
        
        video.addEventListener('loadeddata', () => {
            if (video.getBoundingClientRect().top < window.innerHeight) {
                video.play().catch(e => console.log('Error playing video:', e));
            }
        });
        
        video.addEventListener('error', (e) => {
            console.log('Error cargando video:', e);
            video.style.display = 'none';
        });

        video.setAttribute('preload', 'metadata');
        video.setAttribute('playsinline', 'true');
    });
}

// ============================================
// TOOLTIPS FUNCTIONALITY
// ============================================
function initTooltips() {
    const tooltips = document.querySelectorAll('.info-tooltip');
    
    if (tooltips.length === 0) return;
    
    tooltips.forEach(tooltip => {
        tooltip.addEventListener('touchstart', function(e) {
            e.preventDefault();
            
            tooltips.forEach(otherTooltip => {
                if (otherTooltip !== tooltip) {
                    otherTooltip.classList.remove('tooltip-active');
                }
            });
            
            this.classList.toggle('tooltip-active');
        });

        tooltip.addEventListener('mouseenter', function() {
            this.classList.add('tooltip-active');
        });

        tooltip.addEventListener('mouseleave', function() {
            this.classList.remove('tooltip-active');
        });
    });

    document.addEventListener('click', function(e) {
        if (!e.target.closest('.info-tooltip')) {
            tooltips.forEach(tooltip => {
                tooltip.classList.remove('tooltip-active');
            });
        }
    });
}

// ============================================
// WHATSAPP FUNCTIONALITY
// ============================================
function openWhatsApp() {
    const phoneNumber = '5491234567890';
    let message = '¡Hola! Me interesa conocer más sobre sus chatbots. ¿Pueden ayudarme?';
    
    const customPlanData = window.getCurrentCustomPrice?.();
    if (customPlanData) {
        message += ` Estoy interesado en el plan ${customPlanData.planType} con ${customPlanData.gb}GB por $${customPlanData.price}/mes.`;
    }
    
    const encodedMessage = encodeURIComponent(message);
    const whatsappURL = `https://wa.me/${phoneNumber}?text=${encodedMessage}`;
    
    trackWhatsAppClick(customPlanData);
    
    window.open(whatsappURL, '_blank');
}

// ============================================
// PRICING PLAN INTERACTIONS
// ============================================
function initPricingInteractions() {
    const planButtons = document.querySelectorAll('.plan-button');
    
    planButtons.forEach(button => {
        button.addEventListener('click', function(e) {
            e.preventDefault();
            
            const planCard = this.closest('.pricing-card');
            if (!planCard) return;
            
            const planName = planCard.querySelector('.plan-name')?.textContent || 'Unknown';
            const planPrice = planCard.querySelector('.plan-price')?.textContent || '$0';
            
            this.style.transform = 'scale(0.95)';
            setTimeout(() => {
                this.style.transform = 'scale(1)';
            }, 150);
            
            trackPlanSelection(planName, planPrice);
            
            const buttonText = this.textContent.toLowerCase();
            if (buttonText.includes('contactar')) {
                openWhatsApp();
            } else if (buttonText.includes('gratis')) {
                console.log(`Iniciando registro gratuito para ${planName}`);
            } else {
                console.log(`Procesando pago para ${planName} - ${planPrice}`);
            }
        });
    });
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

window.addEventListener('load', () => {
    const allVideos = document.querySelectorAll('video');
    allVideos.forEach(video => {
        const rect = video.getBoundingClientRect();
        if (rect.top >= 0 && rect.bottom <= window.innerHeight) {
            video.play().catch(e => console.log('Error playing video on load:', e));
        }
    });

    initPricingInteractions();
    preloadImages();
    optimizeMobileExperience();
});

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