// ==========================================
// ORDERS.JS — gestión de pedidos (food verticals)
// ==========================================

let orders        = [];
let agents        = [];
let menuProducts  = [];   // productos cargados desde /api/my-business
let currentFilters = { status: 'all', agent: 'all', type: 'all', search: '' };
let openDropdown  = null;

// ==========================================
// INIT
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    initOrders();
    document.addEventListener('click', e => {
        if (!e.target.closest('.actions-dropdown')) closeAllDropdowns();
        if (!e.target.closest('.custom-dropdown-wrapper'))
            document.querySelectorAll('.custom-dropdown-wrapper.active').forEach(d => d.classList.remove('active'));
    });
});

async function initOrders() {
    await Promise.all([loadAgents(), loadMenuProducts()]);
    await loadOrders();
    updateStats();
    renderOrders();
}

// ==========================================
// DATA
// ==========================================

async function loadAgents() {
    try {
        const res = await fetch('/api/agents', { credentials: 'include' });
        if (!res.ok) throw new Error();
        const data = await res.json();
        if (data.agents) { agents = data.agents; populateAgentFilter(); }
    } catch {
        agents = [];
        populateAgentFilter();
    }
}

function populateAgentFilter() {
    const container = document.getElementById('agentFilterOptions');
    if (!container) return;
    container.querySelectorAll('[data-dynamic]').forEach(el => el.remove());
    agents.forEach(a => {
        const div = document.createElement('div');
        div.className = 'dropdown-option';
        div.dataset.dynamic = '1';
        div.dataset.value = a.id;
        div.innerHTML = `<i class="lni lni-database"></i><span>${a.name}</span>`;
        div.onclick = () => selectFilterOption(div, 'selectedAgent', 'agent', String(a.id));
        container.appendChild(div);
    });
}

async function loadOrders() {
    try {
        const res = await fetch('/api/orders', { credentials: 'include' });
        if (!res.ok) throw new Error();
        const data = await res.json();
        orders = data.orders || [];
    } catch (e) {
        console.error('Error cargando pedidos:', e);
        orders = [];
    }
    if (orders.length === 0) showEmptyState();
    else hideEmptyState();
}

// Carga los productos/servicios desde la sucursal activa de Mi Negocio
async function loadMenuProducts() {
    try {
        const res = await fetch('/api/my-business', { credentials: 'include' });
        if (!res.ok) return;
        const data = await res.json();
        const branch = data.activeBranch || data.defaultBranch;
        if (!branch) return;
        const raw = branch.services || [];
        // Normalizar precio: si es promo usar promoPrice, si no price
        menuProducts = raw
            .filter(s => s.title)
            .map(s => ({
                title: s.title,
                price: s.priceType === 'promo' ? (s.promoPrice || s.price || 0) : (s.price || 0),
                description: s.description || '',
                imageUrl: (s.imageUrls && s.imageUrls[0]) || s.imageUrl || '',
            }));
    } catch (e) {
        menuProducts = [];
    }
}

// ==========================================
// STATS
// ==========================================

function updateStats() {
    const pending   = orders.filter(o => o.status === 'pending').length;
    const preparing = orders.filter(o => o.status === 'preparing').length;
    const ready     = orders.filter(o => o.status === 'ready').length;
    const today     = new Date().toISOString().slice(0, 10);
    const todayOrds = orders.filter(o => o.createdAt && o.createdAt.startsWith(today)).length;
    const total     = orders.reduce((s, o) => s + (o.total || 0), 0);

    setText('statPending',   pending);
    setText('statPreparing', preparing);
    setText('statReady',     ready);
    setText('statToday',     todayOrds);
    setText('statTotal',     '$' + total.toFixed(2));
}

function setText(id, val) {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
}

// ==========================================
// RENDER
// ==========================================

function filterOrders() {
    let f = [...orders];
    if (currentFilters.status !== 'all') f = f.filter(o => o.status === currentFilters.status);
    if (currentFilters.agent  !== 'all') f = f.filter(o => String(o.agentId) === currentFilters.agent);
    if (currentFilters.type   !== 'all') f = f.filter(o => o.orderType === currentFilters.type);
    if (currentFilters.search) {
        const s = currentFilters.search;
        f = f.filter(o =>
            o.clientName.toLowerCase().includes(s) ||
            (o.clientPhone && o.clientPhone.includes(s)) ||
            (o.items && itemsToText(o.items).toLowerCase().includes(s))
        );
    }
    return f;
}

function renderOrders() {
    const filtered = filterOrders();
    const tbody    = document.getElementById('ordersList');
    const view     = document.getElementById('ordersTableView');
    if (!tbody) return;

    if (orders.length === 0) { showEmptyState(); if (view) view.style.display = 'none'; return; }
    hideEmptyState();
    if (view) view.style.display = 'block';

    if (filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="9" style="text-align:center;padding:3rem;color:#6b7280;">
            <i class="lni lni-search-alt" style="font-size:3rem;opacity:.5;display:block;margin-bottom:.5rem;"></i>
            <p>Sin pedidos con estos filtros</p></td></tr>`;
        return;
    }

    tbody.innerHTML = filtered.map(createRow).join('');
}

function createRow(o) {
    const itemsText = itemsToText(o.items);

    const typeLabel = {
        delivery:     '🛵 A domicilio',
        pickup:       '🏪 Para llevar',
        dine_in:      '🍽️ En local',
        local_pickup: '📦 Recoger en local',
    };
    const typeCls = {
        delivery:     'type-delivery',
        pickup:       'type-pickup',
        dine_in:      'type-dine_in',
        local_pickup: 'type-local_pickup',
    };

    const payLabel = { cash: '💵 Efectivo', card: '💳 Tarjeta', transfer: '🏦 Transferencia' };
    const payCls   = { cash: 'pay-cash',    card: 'pay-card',   transfer: 'pay-transfer' };
    const payMethod = o.paymentMethod || '';

    // Cambio para efectivo
    let cambioHtml = '';
    if (payMethod === 'cash' && o.cashReceived && o.cashReceived > 0) {
        const cambio = (o.cashReceived - (o.total || 0));
        cambioHtml = `<div class="cambio-info">Pagó $${o.cashReceived.toFixed(2)} · Cambio: <strong>$${cambio.toFixed(2)}</strong></div>`;
    }

    return `
    <tr>
      <td>
        <div class="table-client"><i class="lni lni-user"></i>${escHtml(o.clientName)}</div>
        ${o.clientPhone ? `<div class="table-phone" style="margin-top:.25rem"><a href="tel:${o.clientPhone}">${escHtml(o.clientPhone)}</a></div>` : ''}
      </td>
      <td><div class="table-items">${escHtml(itemsText)}</div></td>
      <td>
        <div class="table-total">$${(o.total||0).toFixed(2)}</div>
        ${payMethod ? `<span class="pay-badge ${payCls[payMethod]||''}">${payLabel[payMethod]||payMethod}</span>` : ''}
        ${cambioHtml}
      </td>
      <td><span class="type-badge ${typeCls[o.orderType]||'type-pickup'}">${typeLabel[o.orderType]||o.orderType}</span></td>
      <td>
        <div class="source-badge">
          <span class="source-badge-icon"><i class="lni lni-${o.source==='agent'?'database':o.source==='ninda'?'cart':'pencil-alt'}"></i></span>
          ${sourceLabel(o.source)}${o.agentName ? ' · '+escHtml(o.agentName) : ''}
        </div>
      </td>
      <td><span class="order-status status-${o.status}">${statusLabel(o.status)}</span></td>
      <td><div class="table-time">${o.createdAt||''}</div></td>
      <td>
        <div class="actions-dropdown">
          <button class="actions-btn" onclick="toggleDropdown(event,${o.id},this)"><i class="lni lni-more-alt"></i></button>
          <div class="actions-menu" id="dropdown-${o.id}">
            ${o.status!=='preparing'&&o.status!=='ready'&&o.status!=='delivered' ? `<div class="action-item preparing" onclick="updateStatus(${o.id},'preparing')"><i class="lni lni-alarm-clock"></i>En preparación</div>` : ''}
            ${o.status!=='ready'&&o.status!=='delivered' ? `<div class="action-item ready" onclick="updateStatus(${o.id},'ready')"><i class="lni lni-checkmark-circle"></i>Listo</div>` : ''}
            ${o.status==='ready'&&o.orderType==='delivery' ? `<div class="action-item delivered" onclick="updateStatus(${o.id},'delivered')"><i class="lni lni-delivery"></i>Entregado</div>` : ''}
            ${o.clientPhone ? `<div class="action-item whatsapp" onclick="sendWhatsApp('${o.clientPhone}','${escHtml(o.clientName)}',${o.id})"><i class="lni lni-whatsapp"></i>WhatsApp</div>` : ''}
            ${o.status!=='cancelled' ? `<div class="action-item cancel" onclick="updateStatus(${o.id},'cancelled')"><i class="lni lni-ban"></i>Cancelar</div>` : ''}
            <div class="action-item delete" onclick="deleteOrder(${o.id},'${escHtml(o.clientName)}')"><i class="lni lni-trash-can"></i>Eliminar</div>
          </div>
        </div>
      </td>
    </tr>`;
}

// ==========================================
// MODAL — NUEVO PEDIDO
// ==========================================

function openOrderModal() {
    const modal = document.getElementById('orderModal');
    document.getElementById('modalTitle').innerHTML =
        '<i class="lni lni-cart" style="color:var(--accent)"></i> Nuevo Pedido';

    document.getElementById('modalBody').innerHTML = `
    <form id="createOrderForm" class="order-form">
      <div class="form-grid">

        <div class="form-group">
          <label class="form-label"><i class="lni lni-user"></i>Nombre del cliente</label>
          <input type="text" class="form-input" id="clientName" placeholder="Nombre completo" required>
        </div>
        <div class="form-group">
          <label class="form-label"><i class="lni lni-phone"></i>Teléfono</label>
          <input type="tel" class="form-input" id="clientPhone" placeholder="+52 662 000 0000">
        </div>

        <div class="form-group">
          <label class="form-label"><i class="lni lni-delivery"></i>Tipo de pedido</label>
          <select class="form-input" id="orderType">
            <option value="pickup">🏪 Para llevar</option>
            <option value="delivery">🛵 A domicilio</option>
            <option value="dine_in">🍽️ En el local</option>
            <option value="local_pickup">📦 Recoger en local</option>
          </select>
        </div>

        <div class="form-group">
          <label class="form-label"><i class="lni lni-timer"></i>Tiempo estimado (min)</label>
          <input type="number" class="form-input" id="estimatedTime" value="30" min="5" max="120">
        </div>

        <div class="form-group full-width" id="deliveryAddressGroup" style="display:none">
          <label class="form-label"><i class="lni lni-map-marker"></i>Dirección de entrega</label>
          <input type="text" class="form-input" id="deliveryAddress" placeholder="Calle, número, colonia">
        </div>

      </div>

      <!-- Items del pedido -->
      <div class="form-group">
        <label class="form-label"><i class="lni lni-package"></i>Productos / Items</label>
        <div class="items-list" id="itemsList"></div>
        <button type="button" class="btn-add-item" onclick="addItemRow()">
          <i class="lni lni-plus"></i> Agregar producto
        </button>
      </div>

      <div class="total-display" id="totalDisplay">
        <i class="lni lni-coin"></i> Total: <strong id="modalTotal">$0.00</strong>
      </div>

      <!-- ── Método de pago ───────────────────────────────── -->
      <div class="form-group full-width">
        <label class="form-label"><i class="lni lni-credit-cards"></i>Método de pago</label>
        <div class="pay-method-toggle" id="payMethodToggle">
          <button type="button" class="pay-method-btn active" data-pay="cash">
            <i class="lni lni-wallet"></i> Efectivo
          </button>
          <button type="button" class="pay-method-btn" data-pay="card">
            <i class="lni lni-credit-cards"></i> Tarjeta
          </button>
          <button type="button" class="pay-method-btn" data-pay="transfer">
            <i class="lni lni-transfer"></i> Transferencia
          </button>
        </div>
        <input type="hidden" id="paymentMethod" value="cash">
      </div>

      <!-- ── Calculadora de cambio (solo efectivo) ────────── -->
      <div class="cash-calculator" id="cashCalculator">
        <div class="cash-calc-row">
          <div class="form-group" style="flex:1">
            <label class="form-label"><i class="lni lni-money-protection"></i>Cliente paga con</label>
            <div class="cash-quick-btns" id="cashQuickBtns">
              <button type="button" class="cash-quick-btn" data-amount="20">$20</button>
              <button type="button" class="cash-quick-btn" data-amount="50">$50</button>
              <button type="button" class="cash-quick-btn" data-amount="100">$100</button>
              <button type="button" class="cash-quick-btn" data-amount="200">$200</button>
              <button type="button" class="cash-quick-btn" data-amount="500">$500</button>
            </div>
            <input type="number" class="form-input" id="cashReceived" placeholder="0.00" step="0.01" min="0">
          </div>
          <div class="cambio-display" id="cambioDisplay" style="display:none">
            <div class="cambio-label">Cambio</div>
            <div class="cambio-amount" id="cambioAmount">$0.00</div>
          </div>
        </div>
      </div>

      <div class="form-group full-width" style="margin-top:-.25rem">
        <label class="form-label"><i class="lni lni-pencil-alt"></i>Notas del pedido</label>
        <textarea class="form-input" id="orderNotes" rows="2" placeholder="Sin cebolla, extra salsa, etc."></textarea>
      </div>

      <div class="form-actions">
        <button type="button" class="btn-cancel-form" onclick="closeOrderModal()">
          <i class="lni lni-close"></i><span>Cancelar</span>
        </button>
        <button type="submit" class="btn-submit">
          <i class="lni lni-checkmark"></i><span>Crear Pedido</span>
        </button>
      </div>
    </form>`;

    // ── Tipo de pedido: mostrar/ocultar dirección ──────────────
    document.getElementById('orderType').addEventListener('change', function () {
        document.getElementById('deliveryAddressGroup').style.display =
            this.value === 'delivery' ? 'block' : 'none';
    });

    // ── Método de pago: toggle ────────────────────────────────
    document.getElementById('payMethodToggle').addEventListener('click', function(e) {
        const btn = e.target.closest('.pay-method-btn');
        if (!btn) return;
        this.querySelectorAll('.pay-method-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        document.getElementById('paymentMethod').value = btn.dataset.pay;
        document.getElementById('cashCalculator').style.display =
            btn.dataset.pay === 'cash' ? 'block' : 'none';
    });

    // ── Botones rápidos de efectivo ───────────────────────────
    document.getElementById('cashQuickBtns').addEventListener('click', function(e) {
        const btn = e.target.closest('.cash-quick-btn');
        if (!btn) return;
        this.querySelectorAll('.cash-quick-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        document.getElementById('cashReceived').value = btn.dataset.amount;
        calcCambio();
    });

    // ── Input manual de efectivo ──────────────────────────────
    document.getElementById('cashReceived').addEventListener('input', function() {
        // Deselect quick buttons if user types manually
        document.querySelectorAll('.cash-quick-btn').forEach(b => b.classList.remove('active'));
        calcCambio();
    });

    addItemRow();
    document.getElementById('createOrderForm').addEventListener('submit', handleCreateOrder);
    modal.classList.add('active');
}

function calcCambio() {
    const total    = parseFloat(document.getElementById('modalTotal').textContent.replace('$','')) || 0;
    const received = parseFloat(document.getElementById('cashReceived').value) || 0;
    const display  = document.getElementById('cambioDisplay');
    const amountEl = document.getElementById('cambioAmount');

    if (received <= 0) { display.style.display = 'none'; return; }

    const cambio = received - total;
    display.style.display = 'flex';

    if (cambio < 0) {
        amountEl.textContent = '-$' + Math.abs(cambio).toFixed(2);
        amountEl.className   = 'cambio-amount cambio-negative';
    } else {
        amountEl.textContent = '$' + cambio.toFixed(2);
        amountEl.className   = 'cambio-amount cambio-positive';
    }
}

function closeOrderModal() {
    document.getElementById('orderModal').classList.remove('active');
}

// ==========================================
// ITEM ROWS — con dropdown de productos del menú
// ==========================================

function addItemRow(data = {}) {
    const list = document.getElementById('itemsList');
    if (!list) return;

    const row = document.createElement('div');
    row.className = 'item-row';

    // Construir opciones del dropdown
    const hasMenu = menuProducts.length > 0;
    const optionsHTML = hasMenu
        ? menuProducts.map(p =>
            `<div class="product-option" data-title="${escHtml(p.title)}" data-price="${p.price}">
                <span class="product-opt-name">${escHtml(p.title)}</span>
                <span class="product-opt-price">$${p.price.toFixed(2)}</span>
             </div>`
          ).join('')
        : `<div class="product-option-empty">Sin productos en Mi Negocio</div>`;

    const selectedName  = data.name  || '';
    const selectedPrice = data.price || '';

    row.innerHTML = `
      <input type="number" class="form-input item-qty" placeholder="Cant." min="1" value="${data.quantity || 1}">

      <div class="product-dropdown-wrapper">
        <input type="text" class="form-input item-name product-dropdown-input"
               placeholder="${hasMenu ? 'Seleccionar producto…' : 'Nombre del producto'}"
               value="${escHtml(selectedName)}" autocomplete="off">
        ${hasMenu ? `<div class="product-dropdown-menu">
          <div class="product-dropdown-search-wrap">
            <i class="lni lni-search-alt"></i>
            <input type="text" class="product-dropdown-search" placeholder="Buscar…">
          </div>
          <div class="product-options-list">${optionsHTML}</div>
        </div>` : ''}
      </div>

      <input type="number" class="form-input item-price" placeholder="Precio" step="0.01" min="0" value="${selectedPrice}">
      <input type="text"   class="form-input item-notes" placeholder="Notas" value="${data.notes || ''}">
      <button type="button" class="btn-remove-item-row" onclick="this.closest('.item-row').remove(); recalcTotal()">
        <i class="lni lni-close"></i>
      </button>`;

    // ── Lógica del dropdown ───────────────────────────────────
    if (hasMenu) {
        const nameInput    = row.querySelector('.product-dropdown-input');
        const menu         = row.querySelector('.product-dropdown-menu');
        const searchInput  = row.querySelector('.product-dropdown-search');
        const optionsList  = row.querySelector('.product-options-list');
        const priceInput   = row.querySelector('.item-price');
        const wrapper      = row.querySelector('.product-dropdown-wrapper');

        // Abrir al hacer focus o click
        nameInput.addEventListener('focus', () => openProductMenu(wrapper));
        nameInput.addEventListener('click', () => openProductMenu(wrapper));

        // Filtrar opciones con búsqueda
        searchInput.addEventListener('input', function () {
            const term = this.value.toLowerCase();
            optionsList.querySelectorAll('.product-option').forEach(opt => {
                opt.style.display = opt.dataset.title.toLowerCase().includes(term) ? '' : 'none';
            });
        });
        searchInput.addEventListener('click', e => e.stopPropagation());

        // Seleccionar opción
        optionsList.addEventListener('click', function (e) {
            const opt = e.target.closest('.product-option');
            if (!opt) return;
            nameInput.value  = opt.dataset.title;
            priceInput.value = opt.dataset.price;
            closeProductMenu(wrapper);
            recalcTotal();
        });

        // Permitir también escritura libre (nombre personalizado)
        nameInput.addEventListener('input', function () {
            openProductMenu(wrapper);
            const term = this.value.toLowerCase();
            optionsList.querySelectorAll('.product-option').forEach(opt => {
                opt.style.display = opt.dataset.title.toLowerCase().includes(term) ? '' : 'none';
            });
        });
    }

    row.querySelectorAll('.item-qty, .item-price').forEach(i =>
        i.addEventListener('input', recalcTotal));
    list.appendChild(row);
}

function openProductMenu(wrapper) {
    // Cerrar otros menús abiertos primero
    document.querySelectorAll('.product-dropdown-wrapper.open').forEach(w => {
        if (w !== wrapper) closeProductMenu(w);
    });
    wrapper.classList.add('open');
    const search = wrapper.querySelector('.product-dropdown-search');
    if (search) { search.value = ''; search.focus(); }
    // Mostrar todas las opciones al abrir
    wrapper.querySelectorAll('.product-option').forEach(o => o.style.display = '');
}

function closeProductMenu(wrapper) {
    wrapper.classList.remove('open');
}

// Cerrar menús al click fuera
document.addEventListener('click', e => {
    if (!e.target.closest('.product-dropdown-wrapper')) {
        document.querySelectorAll('.product-dropdown-wrapper.open').forEach(w => closeProductMenu(w));
    }
});

function recalcTotal() {
    let sum = 0;
    document.querySelectorAll('.item-row').forEach(row => {
        const qty   = parseFloat(row.querySelector('.item-qty')?.value)   || 0;
        const price = parseFloat(row.querySelector('.item-price')?.value) || 0;
        sum += qty * price;
    });
    const el = document.getElementById('modalTotal');
    if (el) el.textContent = '$' + sum.toFixed(2);
    // Recalc cambio live when total changes
    const cashCalc = document.getElementById('cashCalculator');
    if (cashCalc && cashCalc.style.display !== 'none') calcCambio();
}

function collectItems() {
    const items = [];
    document.querySelectorAll('.item-row').forEach(row => {
        const name = row.querySelector('.item-name')?.value.trim();
        if (!name) return;
        items.push({
            name,
            quantity: parseInt(row.querySelector('.item-qty')?.value)    || 1,
            price:    parseFloat(row.querySelector('.item-price')?.value) || 0,
            notes:    row.querySelector('.item-notes')?.value.trim()      || '',
        });
    });
    return items;
}

// ==========================================
// SUBMIT
// ==========================================

async function handleCreateOrder(e) {
    e.preventDefault();
    const items         = collectItems();
    const total         = items.reduce((s, i) => s + i.quantity * i.price, 0);
    const paymentMethod = document.getElementById('paymentMethod').value;
    const cashReceived  = paymentMethod === 'cash'
        ? (parseFloat(document.getElementById('cashReceived').value) || 0)
        : 0;

    // Validar que si es efectivo, el monto sea suficiente
    if (paymentMethod === 'cash' && cashReceived > 0 && cashReceived < total) {
        showNotification('El monto recibido es menor al total del pedido', 'warning');
        return;
    }

    const body = {
        clientName:      document.getElementById('clientName').value.trim(),
        clientPhone:     document.getElementById('clientPhone').value.trim(),
        orderType:       document.getElementById('orderType').value,
        estimatedTime:   parseInt(document.getElementById('estimatedTime').value) || 30,
        deliveryAddress: document.getElementById('deliveryAddress')?.value.trim() || '',
        items,
        total,
        notes:          document.getElementById('orderNotes').value.trim(),
        paymentMethod,
        cashReceived,
        status: 'pending',
    };

    const btn  = e.target.querySelector('.btn-submit');
    const orig = btn.innerHTML;
    btn.innerHTML = `<div class="loading-spinner-small"></div><span>Creando...</span>`;
    btn.disabled  = true;

    try {
        const res = await fetch('/api/orders', {
            method: 'POST', credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });
        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.error || 'Error al crear el pedido');
        }
        closeOrderModal();
        showNotification('Pedido creado exitosamente', 'success');
        await loadOrders(); updateStats(); renderOrders();
    } catch (err) {
        showNotification(err.message, 'error');
        btn.innerHTML = orig;
        btn.disabled  = false;
    }
}

// ==========================================
// ACTIONS
// ==========================================

async function updateStatus(id, status) {
    closeAllDropdowns();
    try {
        const res = await fetch(`/api/orders/${id}/status`, {
            method: 'PATCH', credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status }),
        });
        if (!res.ok) throw new Error('Error actualizando');
        showNotification(`Pedido → ${statusLabel(status)}`, 'success');
        await loadOrders(); updateStats(); renderOrders();
    } catch (err) {
        showNotification(err.message, 'error');
    }
}

function deleteOrder(id, name) {
    closeAllDropdowns();
    showConfirmModal({
        type: 'danger', icon: 'lni-trash-can',
        title: '¿Eliminar pedido?',
        message: `Pedido de <strong>${name}</strong>`,
        list: ['Esta acción no se puede deshacer'],
        confirmText: 'Eliminar',
        onConfirm: async () => {
            const res = await fetch(`/api/orders/${id}`, { method: 'DELETE', credentials: 'include' });
            if (!res.ok) throw new Error('Error eliminando');
            showNotification('Pedido eliminado', 'success');
            await loadOrders(); updateStats(); renderOrders();
        },
    });
}

function sendWhatsApp(phone, name, id) {
    const o   = orders.find(x => x.id == id);
    const items = o ? itemsToText(o.items) : '';
    const msg = encodeURIComponent(`Hola ${name}, tu pedido está listo:\n${items}\nTotal: $${(o?.total||0).toFixed(2)}`);
    window.open(`https://wa.me/${phone.replace(/\D/g,'')}?text=${msg}`, '_blank');
    closeAllDropdowns();
}

// ==========================================
// FILTER HELPERS
// ==========================================

function selectFilterOption(el, labelId, filterKey, value) {
    const text = el.querySelector('span:last-child')?.innerText || el.querySelector('span')?.innerText || '';
    document.getElementById(labelId).innerText = text;
    const parent = el.closest('.dropdown-options');
    parent.querySelectorAll('.dropdown-option').forEach(o => o.classList.remove('selected'));
    el.classList.add('selected');
    currentFilters[filterKey] = value;
    el.closest('.custom-dropdown-wrapper').classList.remove('active');
    renderOrders();
}

document.addEventListener('DOMContentLoaded', () => {
    const searchInput = document.getElementById('searchInput');
    if (searchInput) searchInput.addEventListener('input', function () {
        currentFilters.search = this.value.toLowerCase();
        renderOrders();
    });
});

// ==========================================
// DROPDOWN UTILITIES
// ==========================================

function toggleDropdown(e, id, btn) {
    e.stopPropagation();
    const el = document.getElementById(`dropdown-${id}`);
    if (!el) return;

    // Cerrar anterior
    if (openDropdown && openDropdown !== el) {
        openDropdown.classList.remove('active');
        openDropdown.style.cssText = '';
    }

    const isOpen = el.classList.contains('active');
    el.classList.toggle('active');

    if (!isOpen) {
        // btn siempre es el botón real (pasado como `this`)
        const rect = btn.getBoundingClientRect();
        const menuH = 220; // altura estimada del menú
        const spaceBelow = window.innerHeight - rect.bottom;

        el.style.position = 'fixed';
        el.style.right = (window.innerWidth - rect.right) + 'px';
        el.style.left  = 'auto';
        el.style.zIndex = '9999';

        if (spaceBelow >= menuH) {
            // Hay espacio abajo → mostrar debajo del botón
            el.style.top    = (rect.bottom + 6) + 'px';
            el.style.bottom = 'auto';
        } else {
            // Sin espacio abajo → mostrar encima del botón
            el.style.bottom = (window.innerHeight - rect.top + 6) + 'px';
            el.style.top    = 'auto';
        }

        openDropdown = el;
    } else {
        el.style.cssText = '';
        openDropdown = null;
    }
}

function closeAllDropdowns() {
    document.querySelectorAll('.actions-menu').forEach(m => {
        m.classList.remove('active');
        m.style.cssText = '';
    });
    openDropdown = null;
}

// ==========================================
// EMPTY STATE
// ==========================================

function showEmptyState() {
    const e = document.getElementById('emptyState');
    const v = document.getElementById('ordersTableView');
    if (e) e.style.display = 'flex';
    const t = document.getElementById('ordersList');
    if (t) t.innerHTML = '';
    if (v) v.style.display = 'none';
}

function hideEmptyState() {
    const e = document.getElementById('emptyState');
    const v = document.getElementById('ordersTableView');
    if (e) e.style.display = 'none';
    if (v) v.style.display = 'block';
}

// ==========================================
// CONFIRM MODAL
// ==========================================

function showConfirmModal({ type='danger', icon='lni-trash-can', title, message, list=[], confirmText='Confirmar', onConfirm }) {
    let modal = document.getElementById('confirmModal');
    if (!modal) { modal = document.createElement('div'); modal.id = 'confirmModal'; modal.className = 'confirm-modal'; document.body.appendChild(modal); }
    modal.innerHTML = `
      <div class="confirm-overlay" onclick="closeConfirmModal()"></div>
      <div class="confirm-content">
        <div class="confirm-header">
          <div class="confirm-icon ${type}"><i class="lni ${icon}"></i></div>
          <h3 class="confirm-title">${title}</h3>
          <p class="confirm-message">${message}</p>
        </div>
        <div class="confirm-body">
          ${list.length ? `<div class="confirm-list">${list.map(i=>`<div class="confirm-list-item"><i class="lni lni-close"></i><span>${i}</span></div>`).join('')}</div>` : ''}
          <div class="confirm-actions">
            <button class="btn-confirm-cancel" onclick="closeConfirmModal()"><i class="lni lni-close"></i>Cancelar</button>
            <button class="btn-confirm-action danger" id="confirmActionBtn"><i class="lni lni-checkmark"></i>${confirmText}</button>
          </div>
        </div>
      </div>`;
    modal.classList.add('active');
    document.getElementById('confirmActionBtn').addEventListener('click', async function () {
        this.innerHTML = `<div class="loading-spinner-small"></div>Procesando...`;
        this.disabled = true;
        try { await onConfirm(); closeConfirmModal(); }
        catch (e) { this.disabled = false; this.innerHTML = confirmText; showNotification('Error, intenta de nuevo', 'error'); }
    });
}

function closeConfirmModal() {
    const m = document.getElementById('confirmModal');
    if (m) { m.classList.remove('active'); setTimeout(() => m.remove(), 300); }
}

// ==========================================
// HELPERS
// ==========================================

function itemsToText(items) {
    if (!items || !items.length) return '—';
    return items.map(i => `${i.quantity}x ${i.name}`).join(', ');
}

function statusLabel(s) {
    return { pending:'Pendiente', confirmed:'Confirmado', preparing:'En preparación',
             ready:'Listo', delivered:'Entregado', cancelled:'Cancelado' }[s] || s;
}

function sourceLabel(s) {
    return { manual:'Manual', agent:'WhatsApp Bot', ninda:'Ninda' }[s] || s;
}

function escHtml(t) {
    if (!t) return '';
    return String(t).replace(/[&<>"']/g, m =>
        ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;' }[m]));
}

function showNotification(message, type = 'info') {
    const titles = { success:'Listo', error:'Error', warning:'Aviso', info:'Info' };
    if (typeof Sileo !== 'undefined' && Sileo[type]) {
        Sileo[type]({ title: titles[type], description: message });
    } else {
        const color = type === 'success' ? '#10b981' : type === 'error' ? '#ef4444' : type === 'warning' ? '#f59e0b' : '#06b6d4';
        const d = document.createElement('div');
        d.style.cssText = `position:fixed;top:1.5rem;left:50%;transform:translateX(-50%);background:white;color:#18181b;padding:.75rem 1.25rem;border-radius:20px;z-index:10000;font-weight:600;font-size:.875rem;box-shadow:0 8px 32px rgba(0,0,0,.10);border:1px solid rgba(0,0,0,.08);display:flex;align-items:center;gap:.5rem;`;
        d.innerHTML = `<span style="background:${color}22;color:${color};border-radius:9999px;width:24px;height:24px;display:flex;align-items:center;justify-content:center;font-size:.75rem;">●</span><span>${message}</span>`;
        document.body.appendChild(d);
        setTimeout(() => { d.style.opacity='0'; d.style.transition='opacity .3s'; setTimeout(()=>d.remove(),300); }, 3000);
    }
}