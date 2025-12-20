// Billing page functionality

document.addEventListener('DOMContentLoaded', function() {
    initializeFilterTabs();
});

// Filter tabs functionality
function initializeFilterTabs() {
    const filterTabs = document.querySelectorAll('.filter-tab');
    const transactionRows = document.querySelectorAll('.transaction-row');
    const emptyState = document.getElementById('emptyState');

    filterTabs.forEach(tab => {
        tab.addEventListener('click', function() {
            // Remove active class from all tabs
            filterTabs.forEach(t => t.classList.remove('active'));
            
            // Add active class to clicked tab
            this.classList.add('active');

            // Get filter value
            const filter = this.getAttribute('data-filter');

            // Filter transactions
            let visibleCount = 0;
            transactionRows.forEach(row => {
                const status = row.getAttribute('data-status');
                
                if (filter === 'all') {
                    row.style.display = '';
                    visibleCount++;
                } else if (status === filter) {
                    row.style.display = '';
                    visibleCount++;
                } else {
                    row.style.display = 'none';
                }
            });

            // Show/hide empty state
            if (visibleCount === 0) {
                emptyState.style.display = 'block';
            } else {
                emptyState.style.display = 'none';
            }
        });
    });
}

// Copy transaction ID to clipboard
function copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => {
        // Show success notification
        showNotification('ID copiado al portapapeles', 'success');
    }).catch(err => {
        console.error('Error al copiar:', err);
        showNotification('Error al copiar', 'error');
    });
}

// Download receipt
function downloadReceipt(transactionId) {
    console.log('Downloading receipt for:', transactionId);
    
    // Simular descarga (en producción, esto haría una petición al servidor)
    showNotification('Descargando recibo...', 'info');
    
    // Aquí iría la lógica real para descargar el recibo
    setTimeout(() => {
        showNotification('Recibo descargado exitosamente', 'success');
    }, 1500);
}

// Cancel subscription
function cancelSubscription() {
    if (confirm('¿Estás seguro de que quieres cancelar tu suscripción? Esta acción no se puede deshacer.')) {
        console.log('Cancelling subscription...');
        
        // Aquí iría la lógica para cancelar la suscripción
        showNotification('Procesando cancelación...', 'info');
        
        // Simular proceso
        setTimeout(() => {
            showNotification('Suscripción cancelada exitosamente', 'success');
        }, 2000);
    }
}

// Show notification
function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    
    const icon = type === 'success' ? 'checkmark-circle' : 
                 type === 'error' ? 'warning' : 
                 'information';
    
    notification.innerHTML = `
        <i class="lni lni-${icon}"></i>
        <span>${message}</span>
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => notification.classList.add('active'), 10);
    
    setTimeout(() => {
        notification.classList.remove('active');
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

// Add notification styles if not already present
if (!document.getElementById('notification-styles')) {
    const style = document.createElement('style');
    style.id = 'notification-styles';
    style.textContent = `
        .notification {
            position: fixed;
            top: 20px;
            right: 20px;
            background: white;
            padding: 1rem 1.5rem;
            border-radius: 12px;
            box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
            display: flex;
            align-items: center;
            gap: 0.75rem;
            z-index: 10000;
            transform: translateX(400px);
            transition: transform 0.3s ease;
            border-left: 4px solid #06b6d4;
        }
        
        .notification.active {
            transform: translateX(0);
        }
        
        .notification-success {
            border-left-color: #10b981;
        }
        
        .notification-success i {
            color: #10b981;
            font-size: 24px;
        }
        
        .notification-error {
            border-left-color: #ef4444;
        }
        
        .notification-error i {
            color: #ef4444;
            font-size: 24px;
        }
        
        .notification-info {
            border-left-color: #06b6d4;
        }
        
        .notification-info i {
            color: #06b6d4;
            font-size: 24px;
        }
        
        .notification span {
            font-weight: 600;
            color: #1a1a1a;
        }
        
        @media (max-width: 768px) {
            .notification {
                right: 10px;
                left: 10px;
                transform: translateY(-100px);
            }
            
            .notification.active {
                transform: translateY(0);
            }
        }
    `;
    document.head.appendChild(style);
}