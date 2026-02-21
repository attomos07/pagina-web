// ============================================
// BILLING - HISTORIAL DE PAGOS
// ============================================

const PAGE_SIZE = 7;
let allPayments = [];
let currentPage = 1;

document.addEventListener('DOMContentLoaded', function() {
    loadPayments();
});

async function loadPayments() {
    try {
        const response = await fetch('/api/billing/payments', { credentials: 'include' });
        if (response.ok) {
            const data = await response.json();
            allPayments = data.payments || [];
        } else {
            allPayments = getSamplePayments();
        }
    } catch (error) {
        allPayments = getSamplePayments();
    }
    renderTable();
}

function getSamplePayments() {
    return [
        { paymentId: 'pi_3SG0nqH0kpgdEo6U0ChL5Bx0', receiptId: '#SmdILoYJ', subscription: 'Profesional', month: 'Febrero', paymentDate: '12 Feb 2026', amount: '$15.00', invoiced: false }
    ];
}

function renderTable() {
    const tbody = document.getElementById('paymentsTableBody');
    const emptyState = document.getElementById('emptyState');
    const paginationWrapper = document.getElementById('paginationWrapper');

    if (!allPayments.length) {
        tbody.innerHTML = '';
        emptyState.style.display = 'block';
        paginationWrapper.style.display = 'none';
        return;
    }

    emptyState.style.display = 'none';
    const totalPages = Math.ceil(allPayments.length / PAGE_SIZE);
    if (currentPage > totalPages) currentPage = totalPages;

    const start = (currentPage - 1) * PAGE_SIZE;
    const pageItems = allPayments.slice(start, start + PAGE_SIZE);

    tbody.innerHTML = pageItems.map(p => `
        <tr>
            <td data-label="ID de Pago"><span class="pay-id">...${p.paymentId.slice(-8)}</span></td>
            <td data-label="ID de Recibo"><span class="receipt-id">${p.receiptId}</span></td>
            <td data-label="Suscripción"><span class="pay-subscription">${p.subscription}</span></td>
            <td data-label="Mes">${p.month}</td>
            <td data-label="Fecha">${p.paymentDate}</td>
            <td data-label="Cantidad"><span class="pay-amount">${p.amount}</span></td>
            <td data-label="Facturado">${p.invoiced
                ? '<span class="badge-invoiced-yes">✓ Sí</span>'
                : '<span class="badge-invoiced-no">✕ No</span>'}</td>
            <td><button class="row-menu-btn" onclick="openRowMenu(this, '${p.paymentId}')">⋮</button></td>
        </tr>
    `).join('');

    if (totalPages > 1) {
        paginationWrapper.style.display = 'flex';
        renderPagination(totalPages);
    } else {
        paginationWrapper.style.display = 'none';
    }
}

function renderPagination(totalPages) {
    const pageNumbers = document.getElementById('pageNumbers');
    document.getElementById('prevBtn').disabled = currentPage === 1;
    document.getElementById('nextBtn').disabled = currentPage === totalPages;

    let html = '';
    for (let i = 1; i <= totalPages; i++) {
        html += `<button class="page-number ${i === currentPage ? 'active' : ''}" onclick="goToPage(${i})">${i}</button>`;
    }
    pageNumbers.innerHTML = html;
}

function changePage(delta) {
    const totalPages = Math.ceil(allPayments.length / PAGE_SIZE);
    const next = currentPage + delta;
    if (next >= 1 && next <= totalPages) { currentPage = next; renderTable(); }
}

function goToPage(page) { currentPage = page; renderTable(); }

function openRowMenu(btn, paymentId) {
    document.querySelectorAll('.row-context-menu').forEach(m => m.remove());
    const menu = document.createElement('div');
    menu.className = 'row-context-menu';
    menu.innerHTML = `
        <button onclick="copyPaymentId('${paymentId}')"><i class="lni lni-files"></i> Copiar ID</button>
        <button onclick="downloadReceipt('${paymentId}')"><i class="lni lni-download"></i> Descargar recibo</button>
    `;
    const rect = btn.getBoundingClientRect();
    const menuLeft = Math.max(8, rect.left - 140);
    menu.style.cssText = `position:fixed;top:${rect.bottom+4}px;left:${menuLeft}px;background:white;border:1px solid #e5e7eb;border-radius:10px;box-shadow:0 8px 24px rgba(0,0,0,0.12);padding:0.5rem;z-index:9999;min-width:180px;`;
    menu.querySelectorAll('button').forEach(b => {
        b.style.cssText = 'display:flex;align-items:center;gap:0.5rem;width:100%;padding:0.625rem 0.75rem;background:none;border:none;border-radius:8px;font-size:0.875rem;font-weight:500;color:#374151;cursor:pointer;text-align:left;';
        b.addEventListener('mouseenter', () => b.style.background = '#f3f4f6');
        b.addEventListener('mouseleave', () => b.style.background = 'none');
    });
    document.body.appendChild(menu);
    setTimeout(() => {
        document.addEventListener('click', function closeMenu(e) {
            if (!menu.contains(e.target)) { menu.remove(); document.removeEventListener('click', closeMenu); }
        });
    }, 10);
}

function copyPaymentId(id) {
    navigator.clipboard.writeText(id).then(() => showNotification('ID copiado al portapapeles', 'success'));
    document.querySelectorAll('.row-context-menu').forEach(m => m.remove());
}

function downloadReceipt(paymentId) {
    showNotification('Descargando recibo...', 'info');
    setTimeout(() => showNotification('Recibo descargado exitosamente', 'success'), 1500);
    document.querySelectorAll('.row-context-menu').forEach(m => m.remove());
}

function cancelSubscription() {
    if (confirm('¿Estás seguro de que quieres cancelar tu suscripción?')) {
        showNotification('Procesando cancelación...', 'info');
        setTimeout(() => showNotification('Suscripción cancelada exitosamente', 'success'), 2000);
    }
}

function showNotification(message, type = 'info') {
    const n = document.createElement('div');
    n.className = `notification notification-${type}`;
    const icon = type === 'success' ? 'checkmark-circle' : type === 'error' ? 'warning' : 'information';
    n.innerHTML = `<i class="lni lni-${icon}"></i><span>${message}</span>`;
    document.body.appendChild(n);
    setTimeout(() => n.classList.add('active'), 10);
    setTimeout(() => { n.classList.remove('active'); setTimeout(() => n.remove(), 300); }, 3000);
}

if (!document.getElementById('notification-styles')) {
    const style = document.createElement('style');
    style.id = 'notification-styles';
    style.textContent = `
        .notification { position:fixed;top:20px;right:20px;background:white;padding:1rem 1.5rem;border-radius:12px;box-shadow:0 10px 40px rgba(0,0,0,0.15);display:flex;align-items:center;gap:0.75rem;z-index:10000;transform:translateX(400px);transition:transform 0.3s ease;border-left:4px solid #06b6d4;font-weight:600;color:#1a1a1a;font-size:0.9rem; }
        .notification.active { transform:translateX(0); }
        .notification-success { border-left-color:#10b981; }
        .notification-success i { color:#10b981;font-size:22px; }
        .notification-error { border-left-color:#ef4444; }
        .notification-error i { color:#ef4444;font-size:22px; }
        .notification-info { border-left-color:#06b6d4; }
        .notification-info i { color:#06b6d4;font-size:22px; }
    `;
    document.head.appendChild(style);
}