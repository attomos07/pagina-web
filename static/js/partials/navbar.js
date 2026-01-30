// ============================================
// NAVBAR MOBILE MENU - iOS Style & Active Logic
// ============================================

document.addEventListener('DOMContentLoaded', function () {
    console.log('🔧 Navbar: Inicializando...');

    const mobileMenuBtn = document.getElementById('mobileMenuBtn');
    const navMenu = document.getElementById('navMenu');
    const navbar = document.getElementById('navbar');
    const body = document.body;

    if (!mobileMenuBtn || !navMenu) {
        console.error('❌ Error: No se encontraron los elementos del DOM');
        return;
    }

    // --- 1. GESTIÓN DEL MENÚ MÓVIL (iOS Style) ---

    function openMobileMenu() {
        mobileMenuBtn.classList.add('active');
        navMenu.classList.add('active');
        body.classList.add('menu-open');
        mobileMenuBtn.setAttribute('aria-expanded', 'true');
    }

    function closeMobileMenu() {
        mobileMenuBtn.classList.remove('active');
        navMenu.classList.remove('active');
        body.classList.remove('menu-open');
        mobileMenuBtn.setAttribute('aria-expanded', 'false');
    }

    // Toggle con click
    mobileMenuBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const isActive = navMenu.classList.contains('active');
        isActive ? closeMobileMenu() : openMobileMenu();
    });

    // Cerrar al hacer click en un link
    const allLinks = document.querySelectorAll('.nav-link');
    allLinks.forEach(link => {
        link.addEventListener('click', () => {
            // Cerramos con un pequeño delay para dejar que la animación de iOS se aprecie
            setTimeout(closeMobileMenu, 150);
        });
    });

    // Cerrar con tecla ESC
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeMobileMenu();
    });

    // Cerrar al redimensionar (si pasa a desktop)
    window.addEventListener('resize', () => {
        if (window.innerWidth > 768) closeMobileMenu();
    });

    // --- 2. EFECTO SCROLL ---
    window.addEventListener('scroll', () => {
        if (navbar) {
            window.scrollY > 10
                ? navbar.classList.add('scrolled')
                : navbar.classList.remove('scrolled');
        }
    });

    // --- 3. LÓGICA DE ESTADO ACTIVO (FIX: Agentes vs Blog) ---
    setActiveNavLink();

    console.log('✅ Navbar: Inicializado correctamente');
});

function setActiveNavLink() {
    // Obtenemos el pathname y lo normalizamos
    // - minúsculas
    // - sin "/" final
    const currentPath = window.location.pathname
        .toLowerCase()
        .replace(/\/$/, "");

    // Seleccionamos solo los links reales del menú
    const navLinks = document.querySelectorAll(
        '.nav-menu .nav-link:not(.nav-cta):not(.nav-login)'
    );

    let matchFound = false;

    navLinks.forEach(link => {
        // Limpiamos cualquier estado previo
        link.classList.remove('active');

        // Normalizamos el href del link
        const linkHref = link.getAttribute('href')
            .toLowerCase()
            .replace(/\/$/, "");

        // Match exacto: /blog === /blog
        const isExactMatch = currentPath === linkHref;

        // Match por subruta: /blog/post-1 → /blog
        // Excluimos "/" para que no coincida con todo
        const isSubPageMatch =
            linkHref !== "" &&
            linkHref !== "/" &&
            currentPath.startsWith(linkHref + "/");

        if (isExactMatch || isSubPageMatch) {
            link.classList.add('active');
            matchFound = true;
            return; // ⛔ evita que otro link se active
        }
    });

    // Fallback solo para el home real "/"
    if (!matchFound && (currentPath === "" || currentPath === "/")) {
        const homeLink = document.querySelector('.nav-link[href="/"]');
        if (homeLink) {
            homeLink.classList.add('active');
        }
    }
}

