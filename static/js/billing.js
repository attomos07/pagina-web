// ============================================
// BILLING - HISTORIAL DE PAGOS + SUSCRIPCIÓN DINÁMICA
// ============================================

const PAGE_SIZE = 7;
let allPayments = [];
let currentPage = 1;
let subscriptionData = null;

document.addEventListener('DOMContentLoaded', function() {
    loadBillingInfo();
    loadPayments();
});

// ============================================
// SUSCRIPCIÓN ACTUAL
// ============================================

async function loadBillingInfo() {
    try {
        const response = await fetch('/api/billing/info', { credentials: 'include' });
        if (!response.ok) throw new Error('Error cargando info de facturación');
        const data = await response.json();
        subscriptionData = data.subscription;
        renderSubscriptionCard(data);
    } catch (error) {
        console.error('Error cargando billing info:', error);
    }
}

function renderSubscriptionCard(data) {
    const { hasPlan, subscription: sub } = data;

    // Status badge
    const statusEl = document.getElementById('subscriptionStatus');
    if (statusEl) {
        statusEl.textContent = sub ? sub.statusDisplay : 'Sin plan';
        statusEl.className = 'subscription-status ' + (sub ? sub.statusClass : 'inactive');
    }

    if (!hasPlan || !sub) {
        document.getElementById('subPlanRow').innerHTML    = '<span class="info-label">Plan:</span><span class="info-value">Sin plan activo</span>';
        document.getElementById('subPriceRow').innerHTML   = '';
        document.getElementById('subNextRow').innerHTML    = '';
        document.getElementById('subMethodRow').innerHTML  = '';
        document.getElementById('cancelBtn').style.display = 'none';
        return;
    }

    // Plan
    setInfoRow('subPlanRow', 'Plan:', `<strong>${sub.planDisplay}</strong> &nbsp;<span style="font-size:0.75rem;color:#6b7280;">(${sub.cycleDisplay})</span>`);

    // Precio (solo si existe)
    if (sub.priceDisplay) {
        setInfoRow('subPriceRow', 'Precio:', sub.priceDisplay);
    } else {
        document.getElementById('subPriceRow').style.display = 'none';
    }

    // Próximo cobro / vencimiento
    if (sub.nextBilling) {
        const label = sub.isTrial ? 'Fin de prueba:' : 'Próximo cobro:';
        const suffix = sub.cancelAtPeriodEnd
            ? ' <span style="color:#ef4444;font-size:0.8rem;">(cancelación pendiente)</span>'
            : '';
        setInfoRow('subNextRow', label, sub.nextBilling + suffix);
    } else {
        document.getElementById('subNextRow').style.display = 'none';
    }

    // Días restantes info
    if (sub.daysRemaining !== undefined && sub.daysRemaining <= 7) {
        setInfoRow('subNextRow', 'Vence en:', `<span style="color:#f59e0b;font-weight:600;">${sub.daysRemaining} días</span>`);
    }

    // Botón cancelar
    const cancelBtn = document.getElementById('cancelBtn');
    if (cancelBtn) {
        if (sub.cancelAtPeriodEnd) {
            cancelBtn.style.display = 'none';
        } else {
            cancelBtn.style.display = '';
        }
    }
}

function setInfoRow(rowId, label, valueHtml) {
    const el = document.getElementById(rowId);
    if (el) {
        el.innerHTML = `<span class="info-label">${label}</span><span class="info-value">${valueHtml}</span>`;
        el.style.display = '';
    }
}

// ============================================
// HISTORIAL DE PAGOS
// ============================================

async function loadPayments() {
    try {
        const response = await fetch('/api/billing/payments', { credentials: 'include' });
        if (response.ok) {
            const data = await response.json();
            allPayments = data.payments || [];
        } else {
            allPayments = [];
        }
    } catch (error) {
        allPayments = [];
    }
    renderTable();
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

    const statusBadge = (s) => {
        const map = {
            succeeded: '<span class="badge-invoiced-yes">✓ Completado</span>',
            failed:    '<span class="badge-invoiced-no">✕ Fallido</span>',
            pending:   '<span style="color:#f59e0b;font-weight:600;">⏳ Pendiente</span>',
            refunded:  '<span style="color:#8b5cf6;font-weight:600;">↩ Reembolsado</span>',
        };
        return map[s] || `<span>${s}</span>`;
    };

    tbody.innerHTML = pageItems.map(p => `
        <tr>
            <td data-label="ID de Pago"><span class="pay-id" title="${p.paymentId}">...${p.paymentId.slice(-8)}</span></td>
            <td data-label="ID de Recibo"><span class="receipt-id">${p.receiptId}</span></td>
            <td data-label="Suscripción"><span class="pay-subscription">${p.subscription}</span></td>
            <td data-label="Mes">${p.month}</td>
            <td data-label="Fecha">${p.paymentDate}</td>
            <td data-label="Cantidad"><span class="pay-amount">${p.amount}</span></td>
            <td data-label="Estado">${statusBadge(p.status)}</td>
            <td><button class="row-menu-btn" onclick="openRowMenu(this, '${p.paymentId}', '${p.chargeId || ''}')">⋮</button></td>
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

// ============================================
// MENÚ DE FILA
// ============================================

function openRowMenu(btn, paymentId, chargeId) {
    document.querySelectorAll('.row-context-menu').forEach(m => m.remove());
    const menu = document.createElement('div');
    menu.className = 'row-context-menu';
    const receiptUrl = chargeId ? `https://dashboard.stripe.com/charges/${chargeId}` : null;
    menu.innerHTML = `
        <button onclick="copyPaymentId('${paymentId}')"><i class="lni lni-files"></i> Copiar ID</button>
        ${receiptUrl ? `<button onclick="window.open('${receiptUrl}','_blank')"><i class="lni lni-download"></i> Ver recibo en Stripe</button>` : ''}
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

// ============================================
// CANCELAR SUSCRIPCIÓN
// ============================================

async function cancelSubscription() {
    if (!confirm('¿Estás seguro de que quieres cancelar tu suscripción? Seguirás teniendo acceso hasta el final del período actual.')) return;

    try {
        showNotification('Procesando cancelación...', 'info');
        const response = await fetch('/api/billing/cancel', {
            method: 'POST',
            credentials: 'include'
        });
        const data = await response.json();
        if (response.ok) {
            showNotification('Suscripción cancelada. Acceso activo hasta fin del período.', 'success');
            setTimeout(() => loadBillingInfo(), 1000);
        } else {
            showNotification(data.error || 'Error al cancelar', 'error');
        }
    } catch (e) {
        showNotification('Error de conexión', 'error');
    }
}

// ============================================
// NOTIFICACIONES
// ============================================

function showNotification(message, type = 'info') {
    const n = document.createElement('div');
    n.className = `notification notification-${type}`;
    const icon = type === 'success' ? 'checkmark-circle' : type === 'error' ? 'warning' : 'information';
    n.innerHTML = `<i class="lni lni-${icon}"></i><span>${message}</span>`;
    document.body.appendChild(n);
    setTimeout(() => n.classList.add('active'), 10);
    setTimeout(() => { n.classList.remove('active'); setTimeout(() => n.remove(), 300); }, 3500);
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