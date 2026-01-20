// ============================================
// NAVBAR MOBILE MENU - iOS Style
// ============================================

document.addEventListener('DOMContentLoaded', function() {
    console.log('🔧 Navbar script cargado');
    
    const mobileMenuBtn = document.getElementById('mobileMenuBtn');
    const navMenu = document.getElementById('navMenu');
    const navbar = document.getElementById('navbar');
    const body = document.body;

    // Verificar que existen los elementos
    if (!mobileMenuBtn || !navMenu) {
        console.error('❌ Elementos del menú no encontrados');
        return;
    }

    console.log('✅ Elementos del menú encontrados');

    // Asegurar estado inicial cerrado
    mobileMenuBtn.classList.remove('active');
    navMenu.classList.remove('active');
    body.classList.remove('menu-open');

    // Función para abrir menú
    function openMobileMenu() {
        console.log('📱 Abriendo menú móvil...');
        mobileMenuBtn.classList.add('active');
        navMenu.classList.add('active');
        body.classList.add('menu-open');
        mobileMenuBtn.setAttribute('aria-expanded', 'true');
    }

    // Función para cerrar menú
    function closeMobileMenu() {
        console.log('❌ Cerrando menú móvil...');
        mobileMenuBtn.classList.remove('active');
        navMenu.classList.remove('active');
        body.classList.remove('menu-open');
        mobileMenuBtn.setAttribute('aria-expanded', 'false');
    }

    // Toggle del menú al hacer click en el botón
    mobileMenuBtn.addEventListener('click', function(e) {
        e.preventDefault();
        e.stopPropagation();
        
        const isActive = navMenu.classList.contains('active');
        console.log('🔄 Toggle menú - Estado actual:', isActive);
        
        if (isActive) {
            closeMobileMenu();
        } else {
            openMobileMenu();
        }
    });

    // Cerrar menú al hacer click en los links
    const navLinks = navMenu.querySelectorAll('.nav-link');
    navLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            console.log('🔗 Link clickeado:', this.textContent);
            
            const href = this.getAttribute('href');
            
            // Prevenir default solo si es un link vacío
            if (!href || href === '#' || href === '') {
                e.preventDefault();
            }
            
            // Marcar como activo (excepto login y CTA)
            if (!this.classList.contains('nav-cta') && !this.classList.contains('nav-login')) {
                navLinks.forEach(l => {
                    if (!l.classList.contains('nav-cta') && !l.classList.contains('nav-login')) {
                        l.classList.remove('active');
                    }
                });
                this.classList.add('active');
            }
            
            // Cerrar menú con delay para iOS
            setTimeout(() => {
                closeMobileMenu();
            }, 150);
        });
    });

    // Cerrar con click fuera del menú
    document.addEventListener('click', function(e) {
        if (navMenu.classList.contains('active')) {
            const clickedInsideMenu = navMenu.contains(e.target);
            const clickedOnButton = mobileMenuBtn.contains(e.target);
            
            if (!clickedInsideMenu && !clickedOnButton) {
                console.log('👆 Click fuera del menú - cerrando...');
                closeMobileMenu();
            }
        }
    });

    // Cerrar al redimensionar ventana
    let resizeTimer;
    window.addEventListener('resize', function() {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(function() {
            if (window.innerWidth > 768 && navMenu.classList.contains('active')) {
                console.log('📐 Redimensionado - cerrando menú...');
                closeMobileMenu();
            }
        }, 250);
    });

    // Cerrar con tecla ESC
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape' && navMenu.classList.contains('active')) {
            console.log('⌨️ ESC presionado - cerrando menú...');
            closeMobileMenu();
        }
    });

    // Efecto scroll en navbar
    if (navbar) {
        window.addEventListener('scroll', function() {
            if (window.scrollY > 10) {
                navbar.classList.add('scrolled');
            } else {
                navbar.classList.remove('scrolled');
            }
        });
    }

    // Establecer link activo según la página actual
    setActiveNavLink();
    
    console.log('✅ Navbar inicializado correctamente');
});

// Función para establecer el link activo
function setActiveNavLink() {
    const currentPath = window.location.pathname;
    const navLinks = document.querySelectorAll('.nav-link:not(.nav-cta):not(.nav-login)');
    
    // Remover active de todos
    navLinks.forEach(link => link.classList.remove('active'));
    
    let linkActivated = false;
    
    // Buscar coincidencia exacta
    navLinks.forEach(link => {
        const linkHref = link.getAttribute('href');
        if (linkHref === currentPath) {
            link.classList.add('active');
            linkActivated = true;
        }
    });
    
    // Si no hay coincidencia exacta, buscar coincidencia parcial
    if (!linkActivated) {
        navLinks.forEach(link => {
            const linkHref = link.getAttribute('href');
            if (linkHref !== '/' && currentPath.startsWith(linkHref)) {
                link.classList.add('active');
                linkActivated = true;
            }
        });
    }
    
    // Si estamos en home, activar el link de inicio
    if (!linkActivated && (currentPath === '/' || currentPath === '' || currentPath === '/index')) {
        const homeLink = document.querySelector('.nav-link[href="/"]');
        if (homeLink) {
            homeLink.classList.add('active');
        }
    }
    
    console.log(`🎯 Link activo establecido para: ${currentPath}`);
}