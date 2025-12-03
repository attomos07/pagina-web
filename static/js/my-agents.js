// My Agents Page functionality - Simplified Version

// Inicializar página
document.addEventListener('DOMContentLoaded', function() {
    // Mantener las estadísticas en 0
    updateStats(0, 0, 0);
});

// Actualizar estadísticas
function updateStats(active, total, platforms) {
    document.getElementById('activeAgentsCount').textContent = active;
    document.getElementById('totalAgentsCount').textContent = total;
    document.getElementById('platformsCount').textContent = platforms;
}