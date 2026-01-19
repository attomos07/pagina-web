// Script para gestionar el estado activo del navbar
document.addEventListener('DOMContentLoaded', function() {
    // Obtener la URL actual
    const currentPath = window.location.pathname;
    
    // Obtener todos los enlaces del navbar
    const navLinks = document.querySelectorAll('.nav-link:not(.nav-login):not(.nav-cta)');
    
    // Remover la clase 'active' de todos los enlaces
    navLinks.forEach(link => {
        link.classList.remove('active');
    });
    
    // Añadir la clase 'active' al enlace correspondiente
    navLinks.forEach(link => {
        const href = link.getAttribute('href');
        
        // Caso especial para la página de inicio
        if (currentPath === '/' && href === '/') {
            link.classList.add('active');
        }
        // Para las demás páginas
        else if (href !== '/' && currentPath.startsWith(href)) {
            link.classList.add('active');
        }
    });
});

// Funcionalidad del menú hamburguesa (mantener el código existente)
const mobileMenuBtn = document.getElementById('mobileMenuBtn');
const navMenu = document.getElementById('navMenu');
const body = document.body;

if (mobileMenuBtn && navMenu) {
    mobileMenuBtn.addEventListener('click', function() {
        // Toggle del menú
        this.classList.toggle('active');
        navMenu.classList.toggle('active');
        body.classList.toggle('menu-open');
        
        // Actualizar aria-expanded
        const isExpanded = this.classList.contains('active');
        this.setAttribute('aria-expanded', isExpanded);
    });
    
    // Cerrar menú al hacer click en un enlace (mobile)
    const navLinks = navMenu.querySelectorAll('.nav-link');
    navLinks.forEach(link => {
        link.addEventListener('click', function() {
            if (window.innerWidth <= 768) {
                mobileMenuBtn.classList.remove('active');
                navMenu.classList.remove('active');
                body.classList.remove('menu-open');
                mobileMenuBtn.setAttribute('aria-expanded', 'false');
            }
        });
    });
}

// Efecto de scroll en el navbar
const navbar = document.getElementById('navbar');
if (navbar) {
    window.addEventListener('scroll', function() {
        if (window.scrollY > 50) {
            navbar.classList.add('scrolled');
        } else {
            navbar.classList.remove('scrolled');
        }
    });
}