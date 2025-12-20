// ============================================
// CHATBOTS.JS - FUNCIONALIDADES ESPECÍFICAS
// ============================================

document.addEventListener('DOMContentLoaded', function() {
    console.log('🤖 Chatbots page loaded');
    
    // Inicializar funcionalidades específicas de chatbots
    initPlatformAnimations();
    initChatbotCards();
    initDemoButtons();
    initMockupVideos();
    initPlatformsSlider();
    
    // Inicializar FAQ (heredada de index.js)
    if (typeof window.ChatBotHub?.initFAQ === 'function') {
        window.ChatBotHub.initFAQ();
    }
    
    console.log('✅ Chatbots functionality initialized');
});

// ============================================
// PLATFORM ANIMATIONS
// ============================================
function initPlatformAnimations() {
    const platformSections = document.querySelectorAll('.platform-section');
    const platformBlocks = document.querySelectorAll('.platform-block');
    
    if (platformSections.length === 0 && platformBlocks.length === 0) return;
    
    const observerOptions = {
        threshold: 0.2,
        rootMargin: '0px 0px -100px 0px'
    };

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
                
                // Animar cards dentro de la sección con delay
                const cards = entry.target.querySelectorAll('.chatbot-card');
                cards.forEach((card, index) => {
                    setTimeout(() => {
                        card.classList.add('visible');
                    }, index * 150);
                });
            }
        });
    }, observerOptions);

    // Observar secciones de plataforma
    platformSections.forEach(section => {
        observer.observe(section);
    });
    
    // Observar bloques de plataforma (si existen)
    platformBlocks.forEach(block => {
        observer.observe(block);
    });
}

// ============================================
// CHATBOT CARDS INTERACTIONS
// ============================================
function initChatbotCards() {
    const chatbotCards = document.querySelectorAll('.chatbot-card');
    
    if (chatbotCards.length === 0) return;
    
    chatbotCards.forEach(card => {
        // Hover effect mejorado
        card.addEventListener('mouseenter', function() {
            this.classList.add('hovered');
            
            // Pausar video si existe
            const video = this.querySelector('video');
            if (video) {
                video.style.animationPlayState = 'paused';
            }
        });
        
        card.addEventListener('mouseleave', function() {
            this.classList.remove('hovered');
            
            // Reanudar video si existe
            const video = this.querySelector('video');
            if (video) {
                video.style.animationPlayState = 'running';
            }
        });
        
        // Click effect
        card.addEventListener('click', function(e) {
            // No procesar si se hizo click en el botón demo
            if (e.target.closest('.demo-btn')) return;
            
            this.classList.add('clicked');
            
            setTimeout(() => {
                this.classList.remove('clicked');
            }, 200);
            
            // Analytics tracking
            trackChatbotCardClick(this);
        });
    });
}

// ============================================
// DEMO BUTTONS FUNCTIONALITY
// ============================================
function initDemoButtons() {
    const demoButtons = document.querySelectorAll('.demo-btn');
    
    if (demoButtons.length === 0) return;
    
    demoButtons.forEach(button => {
        button.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            
            const card = this.closest('.chatbot-card');
            const chatbotName = card?.querySelector('.chatbot-name')?.textContent || 'Unknown';
            const platformSection = card?.closest('.platform-section');
            const platformName = platformSection?.querySelector('.platform-title')?.textContent || 'Unknown';
            
            // Animación de click
            this.style.transform = 'scale(0.95)';
            setTimeout(() => {
                this.style.transform = 'scale(1)';
            }, 150);
            
            // Tracking
            trackDemoButtonClick(chatbotName, platformName);
            
            // Generar mensaje personalizado para WhatsApp
            const message = generateDemoMessage(chatbotName, platformName);
            openWhatsAppWithMessage(message);
        });
    });
}

// ============================================
// MOCKUP VIDEOS FUNCTIONALITY
// ============================================
function initMockupVideos() {
    const mockupVideos = document.querySelectorAll('.phone-screen-video');
    
    if (mockupVideos.length === 0) return;
    
    const videoObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            const video = entry.target;
            
            if (entry.isIntersecting) {
                // Añadir delay para mejor experiencia
                setTimeout(() => {
                    video.play().catch(e => {
                        console.log('Error playing mockup video:', e);
                        // Ocultar video si no puede reproducirse
                        video.style.opacity = '0';
                    });
                }, 300);
            } else {
                video.pause();
            }
        });
    }, { 
        threshold: 0.3,
        rootMargin: '0px 0px -100px 0px'
    });

    mockupVideos.forEach(video => {
        videoObserver.observe(video);
        
        // Configuración de video optimizada
        video.setAttribute('preload', 'metadata');
        video.setAttribute('playsinline', 'true');
        video.muted = true;
        video.loop = true;
        
        // Manejar errores de carga
        video.addEventListener('error', function(e) {
            console.log('Error loading mockup video:', e);
            this.style.display = 'none';
            
            // Mostrar imagen de fallback si existe
            const fallbackImg = this.nextElementSibling;
            if (fallbackImg && fallbackImg.classList.contains('mockup-image')) {
                fallbackImg.style.display = 'block';
            }
        });
        
        // Optimización para móviles
        if (window.ChatBotHub?.isMobileDevice?.() || window.innerWidth <= 768) {
            video.setAttribute('preload', 'none');
        }
    });
}

// ============================================
// PLATFORMS SLIDER FUNCTIONALITY
// ============================================
function initPlatformsSlider() {
    const sliderContainer = document.querySelector('.platforms-slider');
    
    if (!sliderContainer) return;
    
    // Pausar animación al hover
    sliderContainer.addEventListener('mouseenter', function() {
        this.style.animationPlayState = 'paused';
    });
    
    sliderContainer.addEventListener('mouseleave', function() {
        this.style.animationPlayState = 'running';
    });
    
    // Intersection Observer para pausar cuando no está visible
    const sliderObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.style.animationPlayState = 'running';
            } else {
                entry.target.style.animationPlayState = 'paused';
            }
        });
    }, { threshold: 0.1 });
    
    sliderObserver.observe(sliderContainer);
    
    // Manejar videos del slider
    const sliderVideos = document.querySelectorAll('.slider-video');
    
    sliderVideos.forEach(video => {
        video.setAttribute('preload', 'metadata');
        video.setAttribute('playsinline', 'true');
        
        const videoObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    video.play().catch(e => console.log('Error playing slider video:', e));
                } else {
                    video.pause();
                }
            });
        }, { threshold: 0.5 });
        
        videoObserver.observe(video);
        
        video.addEventListener('error', (e) => {
            console.log('Error cargando video del slider:', e);
            video.style.display = 'none';
        });
    });
}

// ============================================
// PLATFORM ICON INTERACTIONS
// ============================================
function initPlatformIconInteractions() {
    const platformIcons = document.querySelectorAll('.platform-icon-large');
    
    platformIcons.forEach(icon => {
        icon.addEventListener('mouseenter', function() {
            this.style.transform = 'scale(1.1) rotate(5deg)';
        });
        
        icon.addEventListener('mouseleave', function() {
            this.style.transform = 'scale(1) rotate(0deg)';
        });
        
        icon.addEventListener('click', function() {
            this.style.transform = 'scale(0.95)';
            setTimeout(() => {
                this.style.transform = 'scale(1.1) rotate(5deg)';
            }, 150);
        });
    });
}

// ============================================
// UTILITY FUNCTIONS ESPECÍFICAS
// ============================================
function generateDemoMessage(chatbotName, platformName) {
    const messages = {
        'WhatsApp': `¡Hola! Me interesa el demo del chatbot para ${chatbotName} en WhatsApp Business. ¿Pueden mostrármelo?`,
        'Facebook': `¡Hola! Quisiera ver el demo del chatbot para ${chatbotName} en Facebook Messenger. ¿Está disponible?`,
        'Instagram': `¡Hola! Me gustaría conocer el demo del chatbot para ${chatbotName} en Instagram Direct. ¿Pueden ayudarme?`,
        'Telegram': `¡Hola! Estoy interesado en el demo del bot para ${chatbotName} en Telegram. ¿Pueden mostrármelo?`,
        'Web': `¡Hola! Me interesa el demo del widget de ${chatbotName} para sitio web. ¿Pueden demostrármelo?`
    };
    
    return messages[platformName] || `¡Hola! Me interesa el demo del chatbot para ${chatbotName}. ¿Pueden ayudarme?`;
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
function trackChatbotCardClick(card) {
    const chatbotName = card.querySelector('.chatbot-name')?.textContent || 'Unknown';
    const platformSection = card.closest('.platform-section');
    const platformName = platformSection?.querySelector('.platform-title')?.textContent || 'Unknown';
    
    console.log(`Chatbot card clicked: ${chatbotName} on ${platformName}`);
    
    if (typeof gtag !== 'undefined') {
        gtag('event', 'chatbot_card_click', {
            'chatbot_name': chatbotName,
            'platform': platformName,
            'event_category': 'engagement',
            'event_label': `${platformName}-${chatbotName}`
        });
    }
}

function trackDemoButtonClick(chatbotName, platformName) {
    console.log(`Demo button clicked: ${chatbotName} on ${platformName}`);
    
    if (typeof gtag !== 'undefined') {
        gtag('event', 'demo_request', {
            'chatbot_name': chatbotName,
            'platform': platformName,
            'event_category': 'conversion',
            'event_label': `demo-${platformName}-${chatbotName}`
        });
    }
}

// ============================================
// PERFORMANCE OPTIMIZATIONS
// ============================================
function optimizeChatbotsPageForMobile() {
    if (window.innerWidth <= 768) {
        // Reducir cantidad de videos activos en móvil
        const videos = document.querySelectorAll('.phone-screen-video');
        videos.forEach((video, index) => {
            if (index > 2) { // Solo mantener activos los primeros 3
                video.setAttribute('preload', 'none');
                video.pause();
            }
        });
        
        // Simplificar animaciones del slider
        const slider = document.querySelector('.platforms-slider');
        if (slider) {
            slider.style.animationDuration = '80s';
        }
    }
}

// ============================================
// INITIALIZATION ON LOAD
// ============================================
window.addEventListener('load', () => {
    initPlatformIconInteractions();
    optimizeChatbotsPageForMobile();
    
    // Verificar si todos los videos críticos se cargaron
    setTimeout(() => {
        const videos = document.querySelectorAll('.phone-screen-video');
        videos.forEach(video => {
            if (video.readyState === 0) {
                console.warn('Video no cargado:', video.src);
            }
        });
    }, 2000);
});

window.addEventListener('resize', window.ChatBotHub?.debounce?.(optimizeChatbotsPageForMobile, 250));

console.log('📱 Chatbots.js loaded successfully');