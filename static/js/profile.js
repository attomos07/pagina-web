// ============================================
// PROFILE JAVASCRIPT
// ============================================

document.addEventListener('DOMContentLoaded', function () {
    console.log('🔧 Profile JS cargado correctamente');

    initProfileData();
    initCustomSelect();
    initLocationDropdowns();
    initSchedule();
    initHolidays();
    initSaveButton();

    console.log('✅ Profile funcionalidades inicializadas');
});

// ============================================
// DATA COLLECTIONS
// ============================================

const COUNTRIES = [
    { value: 'mexico', name: 'México', icon: 'lni-flag-mx' },
    { value: 'usa', name: 'Estados Unidos', icon: 'lni-flag-us' },
    { value: 'canada', name: 'Canadá', icon: 'lni-flag-ca' },
    { value: 'spain', name: 'España', icon: 'lni-flag-es' },
    { value: 'argentina', name: 'Argentina', icon: 'lni-flag-ar' }
];

const STATES_MEXICO = [
    'Aguascalientes', 'Baja California', 'Baja California Sur', 'Campeche', 'Chiapas',
    'Chihuahua', 'Ciudad de México', 'Coahuila', 'Colima', 'Durango', 'Guanajuato',
    'Guerrero', 'Hidalgo', 'Jalisco', 'México', 'Michoacán', 'Morelos', 'Nayarit',
    'Nuevo León', 'Oaxaca', 'Puebla', 'Querétaro', 'Quintana Roo', 'San Luis Potosí',
    'Sinaloa', 'Sonora', 'Tabasco', 'Tamaulipas', 'Tlaxcala', 'Veracruz', 'Yucatán', 'Zacatecas'
];

const CITIES_SONORA = [
    'Hermosillo', 'Ciudad Obregón', 'Nogales', 'San Luis Río Colorado', 'Navojoa',
    'Guaymas', 'Empalme', 'Agua Prieta', 'Caborca', 'Cananea', 'Puerto Peñasco',
    'Huatabampo', 'Etchojoa', 'Magdalena', 'Santa Ana'
];

const MONTHS = [
    { value: '01', name: 'Enero' },
    { value: '02', name: 'Febrero' },
    { value: '03', name: 'Marzo' },
    { value: '04', name: 'Abril' },
    { value: '05', name: 'Mayo' },
    { value: '06', name: 'Junio' },
    { value: '07', name: 'Julio' },
    { value: '08', name: 'Agosto' },
    { value: '09', name: 'Septiembre' },
    { value: '10', name: 'Octubre' },
    { value: '11', name: 'Noviembre' },
    { value: '12', name: 'Diciembre' }
];

// ============================================
// LOAD PROFILE DATA
// ============================================

async function initProfileData() {
    try {
        const res = await fetch('/api/profile');
        const profile = await res.json();

        setInputValue('businessNameInput', profile.business.name);
        setInputValue('descriptionInput', profile.business.description);
        setInputValue('websiteInput', profile.business.website);
        setInputValue('emailInput', profile.business.email);

        const typeInput = document.getElementById('businessTypeInput');
        typeInput.value = profile.business.typeName;
        typeInput.setAttribute('data-value', profile.business.type);

        setInputValue('addressInput', profile.location.address);
        setInputValue('numberInput', profile.location.number);
        setInputValue('neighborhoodInput', profile.location.neighborhood);
        setInputValue('postalCodeInput', profile.location.postalCode);
        setInputValue('betweenStreetsInput', profile.location.betweenStreets);

        document.getElementById('countryInput').value = profile.location.country;
        document.getElementById('stateInput').value = profile.location.state;
        document.getElementById('cityInput').value = profile.location.city;

        setInputValue('countryInputDisplay', profile.location.country);
        setInputValue('stateInputDisplay', profile.location.state);
        setInputValue('cityInputDisplay', profile.location.city);
        updateDropdownSelection('countryInputWrapper', profile.location.country);
        updateDropdownSelection('stateInputWrapper', profile.location.state);
        updateDropdownSelection('cityInputWrapper', profile.location.city);

        setInputValue('facebookInput', profile.social.facebook);
        setInputValue('instagramInput', profile.social.instagram);
        setInputValue('twitterInput', profile.social.twitter);
        setInputValue('linkedinInput', profile.social.linkedin);

        applySchedule(profile.schedule);
        applyHolidays(profile.holidays);

        console.log('📊 Profile real loaded:', profile);
    } catch (e) {
        console.error('Error loading profile', e);
    }
}

function updateDropdownSelection(wrapperId, value) {
    const wrapper = document.getElementById(wrapperId);
    if (!wrapper) return;

    const options = wrapper.querySelectorAll('.select-option');
    options.forEach(opt => {
        if (opt.getAttribute('data-value') === value || opt.querySelector('span')?.textContent === value) {
            opt.classList.add('selected');
        } else {
            opt.classList.remove('selected');
        }
    });
}

function applySchedule(schedule) {
    Object.entries(schedule).forEach(([day, data]) => {
        const checkbox = document.getElementById(`day-${day}`);
        const open = document.getElementById(`time-${day}-open`);
        const close = document.getElementById(`time-${day}-close`);

        if (!checkbox) return;

        checkbox.checked = data.isOpen;
        if (open) open.value = data.open;
        if (close) close.value = data.close;
    });
}

function applyHolidays(holidays = []) {
    holidays.forEach(h => {
        addHoliday();

        const last = document.querySelector('.holiday-item:last-child');
        last.querySelector('[data-field="month"]').value = h.month;
        last.querySelector('[data-field="day"]').value = h.day;
        last.querySelector('[data-field="name"]').value = h.name;
    });
}

function setInputValue(elementId, value) {
    const element = document.getElementById(elementId);
    if (element) {
        element.value = value || '';
    }
}

// ============================================
// CUSTOM SELECT FUNCTIONALITY
// ============================================

function initCustomSelect() {
    const selectWrapper = document.getElementById('businessTypeWrapper');
    const selectInput = document.getElementById('businessTypeInput');
    const dropdown = document.getElementById('businessTypeDropdown');
    const searchInput = document.getElementById('businessTypeSearch');
    const optionsContainer = document.getElementById('businessTypeOptions');
    const options = optionsContainer?.querySelectorAll('.select-option');

    if (!selectWrapper || !selectInput || !dropdown) {
        console.warn('⚠️ Custom select elements no encontrados');
        return;
    }

    selectInput.addEventListener('click', function (e) {
        e.stopPropagation();
        toggleDropdown();
    });

    if (searchInput) {
        searchInput.addEventListener('input', function () {
            filterOptions(this.value);
        });

        searchInput.addEventListener('click', function (e) {
            e.stopPropagation();
        });
    }

    options?.forEach(option => {
        option.addEventListener('click', function (e) {
            e.stopPropagation();
            selectOption(this);
        });
    });

    document.addEventListener('click', function (e) {
        if (!selectWrapper.contains(e.target)) {
            closeDropdown();
        }
    });

    function toggleDropdown() {
        const isActive = selectWrapper.classList.contains('active');
        if (isActive) { closeDropdown(); } else { openDropdown(); }
    }

    function openDropdown() {
        selectWrapper.classList.add('active');
        if (searchInput) {
            setTimeout(() => { searchInput.focus(); }, 100);
            searchInput.value = '';
        }
        filterOptions('');
    }

    function closeDropdown() {
        selectWrapper.classList.remove('active');
        if (searchInput) { searchInput.value = ''; }
    }

    function filterOptions(searchTerm) {
        const term = searchTerm.toLowerCase().trim();
        options?.forEach(option => {
            const text = option.querySelector('span')?.textContent.toLowerCase() || '';
            if (text.includes(term)) {
                option.classList.remove('hidden');
            } else {
                option.classList.add('hidden');
            }
        });
    }

    function selectOption(option) {
        const value = option.getAttribute('data-value');
        const text = option.querySelector('span')?.textContent;

        selectInput.value = text;
        selectInput.setAttribute('data-value', value);

        options?.forEach(opt => opt.classList.remove('selected'));
        option.classList.add('selected');

        closeDropdown();
        console.log(`✅ Giro seleccionado: ${text} (${value})`);
    }

    console.log('🎯 Custom select inicializado');
}

// ============================================
// LOCATION DROPDOWNS (Country, State, City)
// ============================================

function initLocationDropdowns() {
    createLocationDropdown('countryInput', COUNTRIES, 'Selecciona un país');
    createLocationDropdown('stateInput', STATES_MEXICO.map(s => ({ value: s.toLowerCase().replace(/\s+/g, '-'), name: s })), 'Selecciona un estado');
    createLocationDropdown('cityInput', CITIES_SONORA.map(c => ({ value: c.toLowerCase().replace(/\s+/g, '-'), name: c })), 'Selecciona una ciudad');
}

function createLocationDropdown(inputId, options, placeholder) {
    const input = document.getElementById(inputId);
    if (!input) return;

    const wrapper = document.createElement('div');
    wrapper.className = 'custom-select-wrapper';
    wrapper.id = `${inputId}Wrapper`;

    const displayInput = document.createElement('input');
    displayInput.type = 'text';
    displayInput.className = 'info-input form-select';
    displayInput.id = `${inputId}Display`;
    displayInput.placeholder = placeholder;
    displayInput.readOnly = true;
    displayInput.value = input.value;

    const arrow = document.createElement('i');
    arrow.className = 'lni lni-chevron-down select-arrow';

    const dropdown = document.createElement('div');
    dropdown.className = 'select-dropdown';

    const searchContainer = document.createElement('div');
    searchContainer.className = 'select-search-container';
    searchContainer.innerHTML = `
        <i class="lni lni-search-alt search-icon"></i>
        <input type="text" class="select-search" placeholder="Buscar..." autocomplete="off">
    `;

    const optionsContainer = document.createElement('div');
    optionsContainer.className = 'select-options-container';

    options.forEach(opt => {
        const option = document.createElement('div');
        option.className = 'select-option';
        option.setAttribute('data-value', opt.value);
        option.innerHTML = `
            ${opt.icon ? `<i class="lni ${opt.icon}"></i>` : '<i class="lni lni-map-marker"></i>'}
            <span>${opt.name}</span>
        `;
        optionsContainer.appendChild(option);
    });

    dropdown.appendChild(searchContainer);
    dropdown.appendChild(optionsContainer);
    wrapper.appendChild(displayInput);
    wrapper.appendChild(arrow);
    wrapper.appendChild(dropdown);

    input.parentNode.insertBefore(wrapper, input);
    input.style.display = 'none';

    const searchInput = searchContainer.querySelector('.select-search');
    const selectOptions = optionsContainer.querySelectorAll('.select-option');

    displayInput.addEventListener('click', function (e) {
        e.stopPropagation();
        toggleLocationDropdown(wrapper, searchInput);
    });

    searchInput.addEventListener('input', function () {
        filterLocationOptions(this.value, selectOptions);
    });

    searchInput.addEventListener('click', function (e) {
        e.stopPropagation();
    });

    selectOptions.forEach(option => {
        option.addEventListener('click', function (e) {
            e.stopPropagation();
            selectLocationOption(this, displayInput, input, wrapper, selectOptions);
        });
    });

    document.addEventListener('click', function (e) {
        if (!wrapper.contains(e.target)) {
            closeLocationDropdown(wrapper);
        }
    });
}

function toggleLocationDropdown(wrapper, searchInput) {
    const isActive = wrapper.classList.contains('active');

    document.querySelectorAll('.custom-select-wrapper.active').forEach(w => {
        if (w !== wrapper) { w.classList.remove('active'); }
    });

    if (isActive) {
        closeLocationDropdown(wrapper);
    } else {
        wrapper.classList.add('active');
        setTimeout(() => searchInput.focus(), 100);
        searchInput.value = '';
        const options = wrapper.querySelectorAll('.select-option');
        options.forEach(opt => opt.classList.remove('hidden'));
    }
}

function closeLocationDropdown(wrapper) {
    wrapper.classList.remove('active');
    const searchInput = wrapper.querySelector('.select-search');
    if (searchInput) searchInput.value = '';
}

function filterLocationOptions(searchTerm, options) {
    const term = searchTerm.toLowerCase().trim();
    options.forEach(option => {
        const text = option.querySelector('span')?.textContent.toLowerCase() || '';
        if (text.includes(term)) {
            option.classList.remove('hidden');
        } else {
            option.classList.add('hidden');
        }
    });
}

function selectLocationOption(option, displayInput, hiddenInput, wrapper, allOptions) {
    const value = option.getAttribute('data-value');
    const text = option.querySelector('span')?.textContent;

    displayInput.value = text;
    hiddenInput.value = text;
    hiddenInput.setAttribute('data-value', value);

    allOptions.forEach(opt => opt.classList.remove('selected'));
    option.classList.add('selected');

    closeLocationDropdown(wrapper);
}

// ============================================
// SCHEDULE FUNCTIONALITY
// ============================================

function initSchedule() {
    const days = [
        { name: 'Lunes', key: 'monday' },
        { name: 'Martes', key: 'tuesday' },
        { name: 'Miércoles', key: 'wednesday' },
        { name: 'Jueves', key: 'thursday' },
        { name: 'Viernes', key: 'friday' },
        { name: 'Sábado', key: 'saturday' },
        { name: 'Domingo', key: 'sunday' }
    ];

    const scheduleList = document.getElementById('scheduleList');
    if (!scheduleList) return;

    scheduleList.innerHTML = '';

    days.forEach(day => {
        const dayDiv = document.createElement('div');
        dayDiv.className = 'schedule-day';
        dayDiv.innerHTML = `
            <div class="day-name">${day.name}</div>
            <div class="day-toggle">
                <label class="toggle-switch">
                    <input type="checkbox" id="day-${day.key}" checked>
                    <span class="toggle-slider"></span>
                </label>
                <span class="toggle-label">Abierto</span>
            </div>
            <div class="day-times">
                <input type="time" class="time-input" id="time-${day.key}-open" value="09:00" style="display: none;">
                <span class="time-separator">-</span>
                <input type="time" class="time-input" id="time-${day.key}-close" value="20:00" style="display: none;">
            </div>
        `;
        scheduleList.appendChild(dayDiv);

        const checkbox = dayDiv.querySelector(`#day-${day.key}`);
        checkbox.addEventListener('change', function () {
            if (this.checked) {
                dayDiv.classList.remove('closed');
            } else {
                dayDiv.classList.add('closed');
            }
        });

        const openInput = dayDiv.querySelector(`#time-${day.key}-open`);
        const closeInput = dayDiv.querySelector(`#time-${day.key}-close`);
        createTimePicker(openInput, '09:00');
        createTimePicker(closeInput, '20:00');
    });
}

function createTimePicker(input, defaultValue = '09:00') {
    const wrapper = document.createElement('div');
    wrapper.className = 'time-picker-wrapper';

    const convert24to12 = (time24) => {
        const [hours24, minutes] = time24.split(':');
        const h = parseInt(hours24);
        const period = h >= 12 ? 'PM' : 'AM';
        const hours12 = h === 0 ? 12 : (h > 12 ? h - 12 : h);
        return { hours: String(hours12).padStart(2, '0'), minutes, period };
    };

    const convert12to24 = (hours12, minutes, period) => {
        let h = parseInt(hours12);
        if (period === 'AM' && h === 12) h = 0;
        if (period === 'PM' && h !== 12) h += 12;
        return `${String(h).padStart(2, '0')}:${minutes}`;
    };

    const initialTime = convert24to12(defaultValue);

    const display = document.createElement('div');
    display.className = 'time-input-display';
    display.innerHTML = `
        <span class="time-display-value">${initialTime.hours}:${initialTime.minutes} ${initialTime.period}</span>
        <i class="lni lni-chevron-down" style="font-size: 14px; color: #06b6d4;"></i>
    `;

    const dropdown = document.createElement('div');
    dropdown.className = 'time-dropdown';

    const content = document.createElement('div');
    content.className = 'time-dropdown-content';

    const hourColumn = document.createElement('div');
    hourColumn.className = 'time-column';
    hourColumn.innerHTML = '<div class="time-column-title">Hora</div><div class="time-scroll" id="hours"></div>';

    const minuteColumn = document.createElement('div');
    minuteColumn.className = 'time-column';
    minuteColumn.innerHTML = '<div class="time-column-title">Min</div><div class="time-scroll" id="minutes"></div>';

    const periodColumn = document.createElement('div');
    periodColumn.className = 'time-column';
    periodColumn.innerHTML = '<div class="time-column-title">Periodo</div><div class="time-scroll" id="period"></div>';

    const hourScroll = hourColumn.querySelector('#hours');
    const minuteScroll = minuteColumn.querySelector('#minutes');
    const periodScroll = periodColumn.querySelector('#period');

    for (let i = 1; i <= 12; i++) {
        const hour = String(i).padStart(2, '0');
        const option = document.createElement('div');
        option.className = 'time-option';
        option.textContent = hour;
        option.dataset.value = hour;
        hourScroll.appendChild(option);
    }

    [0, 15, 30, 45].forEach(min => {
        const minute = String(min).padStart(2, '0');
        const option = document.createElement('div');
        option.className = 'time-option';
        option.textContent = minute;
        option.dataset.value = minute;
        minuteScroll.appendChild(option);
    });

    ['AM', 'PM'].forEach(p => {
        const option = document.createElement('div');
        option.className = 'time-option';
        option.textContent = p;
        option.dataset.value = p;
        periodScroll.appendChild(option);
    });

    content.appendChild(hourColumn);
    content.appendChild(minuteColumn);
    content.appendChild(periodColumn);
    dropdown.appendChild(content);
    wrapper.appendChild(display);
    wrapper.appendChild(dropdown);

    input.parentNode.insertBefore(wrapper, input);
    input.style.display = 'none';
    input.value = defaultValue;

    let selectedHour = initialTime.hours;
    let selectedMinute = initialTime.minutes;
    let selectedPeriod = initialTime.period;

    hourScroll.querySelector(`[data-value="${selectedHour}"]`).classList.add('selected');
    minuteScroll.querySelector(`[data-value="${selectedMinute}"]`).classList.add('selected');
    periodScroll.querySelector(`[data-value="${selectedPeriod}"]`).classList.add('selected');

    display.addEventListener('click', function (e) {
        e.stopPropagation();
        const isOpen = dropdown.classList.contains('show');

        document.querySelectorAll('.time-dropdown.show').forEach(d => d.classList.remove('show'));
        document.querySelectorAll('.time-input-display.active').forEach(d => d.classList.remove('active'));

        if (!isOpen) {
            dropdown.classList.add('show');
            display.classList.add('active');
        }
    });

    hourScroll.addEventListener('click', function (e) {
        if (e.target.classList.contains('time-option')) {
            hourScroll.querySelectorAll('.time-option').forEach(o => o.classList.remove('selected'));
            e.target.classList.add('selected');
            selectedHour = e.target.dataset.value;
            updateTime();
        }
    });

    minuteScroll.addEventListener('click', function (e) {
        if (e.target.classList.contains('time-option')) {
            minuteScroll.querySelectorAll('.time-option').forEach(o => o.classList.remove('selected'));
            e.target.classList.add('selected');
            selectedMinute = e.target.dataset.value;
            updateTime();
        }
    });

    periodScroll.addEventListener('click', function (e) {
        if (e.target.classList.contains('time-option')) {
            periodScroll.querySelectorAll('.time-option').forEach(o => o.classList.remove('selected'));
            e.target.classList.add('selected');
            selectedPeriod = e.target.dataset.value;
            updateTime();
        }
    });

    function updateTime() {
        const displayTime = `${selectedHour}:${selectedMinute} ${selectedPeriod}`;
        display.querySelector('.time-display-value').textContent = displayTime;
        input.value = convert12to24(selectedHour, selectedMinute, selectedPeriod);
    }

    document.addEventListener('click', function (e) {
        if (!wrapper.contains(e.target)) {
            dropdown.classList.remove('show');
            display.classList.remove('active');
        }
    });
}

// ============================================
// HOLIDAYS FUNCTIONALITY
// ============================================

let holidayCounter = 0;

function initHolidays() {
    const btnAddHoliday = document.getElementById('btnAddHoliday');
    if (btnAddHoliday) {
        btnAddHoliday.addEventListener('click', addHoliday);
    }
}

function addHoliday() {
    const container = document.getElementById('holidaysList');
    if (!container) return;

    holidayCounter++;
    const id = `holiday-${holidayCounter}`;

    const div = document.createElement('div');
    div.className = 'holiday-item';
    div.dataset.id = id;

    div.innerHTML = `
        <div class="holiday-date-selector">
            <div class="holiday-dropdown-group" id="month-${id}"></div>
            <div class="holiday-dropdown-group" id="day-${id}"></div>
            <div class="holiday-name-group">
                <input type="text" class="holiday-name-input" data-field="name" placeholder="Nombre del día festivo">
            </div>
        </div>
        <button type="button" class="btn-remove-holiday" data-remove="${id}">
            <i class="lni lni-trash-can"></i>
        </button>
    `;

    container.appendChild(div);

    createHolidayDropdown(`month-${id}`, MONTHS, 'Mes', id);

    const days = [];
    for (let i = 1; i <= 31; i++) {
        days.push({ value: String(i).padStart(2, '0'), name: String(i) });
    }
    createHolidayDropdown(`day-${id}`, days, 'Día', id);

    div.querySelector('.btn-remove-holiday').addEventListener('click', function () {
        removeHoliday(id);
    });

    console.log(`✅ Día festivo agregado: ${id}`);
}

function createHolidayDropdown(containerId, options, placeholder, holidayId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const wrapper = document.createElement('div');
    wrapper.className = 'custom-select-wrapper';

    const displayInput = document.createElement('input');
    displayInput.type = 'text';
    displayInput.className = 'info-input form-select';
    displayInput.placeholder = placeholder;
    displayInput.readOnly = true;
    displayInput.dataset.holidayId = holidayId;
    displayInput.dataset.field = containerId.includes('month') ? 'month' : 'day';

    const arrow = document.createElement('i');
    arrow.className = 'lni lni-chevron-down select-arrow';

    const dropdown = document.createElement('div');
    dropdown.className = 'select-dropdown';

    const optionsContainer = document.createElement('div');
    optionsContainer.className = 'select-options-container';

    options.forEach(opt => {
        const option = document.createElement('div');
        option.className = 'select-option';
        option.setAttribute('data-value', opt.value);
        option.innerHTML = `
            <i class="lni lni-calendar"></i>
            <span>${opt.name}</span>
        `;
        optionsContainer.appendChild(option);
    });

    dropdown.appendChild(optionsContainer);
    wrapper.appendChild(displayInput);
    wrapper.appendChild(arrow);
    wrapper.appendChild(dropdown);
    container.appendChild(wrapper);

    const selectOptions = optionsContainer.querySelectorAll('.select-option');

    displayInput.addEventListener('click', function (e) {
        e.stopPropagation();
        toggleHolidayDropdown(wrapper);
    });

    selectOptions.forEach(option => {
        option.addEventListener('click', function (e) {
            e.stopPropagation();
            selectHolidayOption(this, displayInput, wrapper, selectOptions);
        });
    });

    document.addEventListener('click', function (e) {
        if (!wrapper.contains(e.target)) {
            closeHolidayDropdown(wrapper);
        }
    });
}

function toggleHolidayDropdown(wrapper) {
    const isActive = wrapper.classList.contains('active');

    document.querySelectorAll('.custom-select-wrapper.active').forEach(w => {
        if (w !== wrapper) { w.classList.remove('active'); }
    });

    if (isActive) {
        closeHolidayDropdown(wrapper);
    } else {
        wrapper.classList.add('active');
    }
}

function closeHolidayDropdown(wrapper) {
    wrapper.classList.remove('active');
}

function selectHolidayOption(option, displayInput, wrapper, allOptions) {
    const value = option.getAttribute('data-value');
    const text = option.querySelector('span')?.textContent;

    displayInput.value = text;
    displayInput.setAttribute('data-value', value);

    allOptions.forEach(opt => opt.classList.remove('selected'));
    option.classList.add('selected');

    closeHolidayDropdown(wrapper);
}

function removeHoliday(id) {
    const element = document.querySelector(`[data-id="${id}"]`);
    if (element) {
        element.style.animation = 'fadeOut 0.3s ease';
        setTimeout(() => element.remove(), 300);
        console.log(`🗑️ Día festivo eliminado: ${id}`);
    }
}

function collectHolidaysData() {
    const holidayItems = document.querySelectorAll('.holiday-item');
    const holidays = [];

    holidayItems.forEach(item => {
        const monthInput = item.querySelector('[data-field="month"]');
        const dayInput = item.querySelector('[data-field="day"]');
        const nameInput = item.querySelector('[data-field="name"]');

        const month = monthInput?.getAttribute('data-value');
        const day = dayInput?.getAttribute('data-value');
        const name = nameInput?.value;

        if (month && day && name) {
            holidays.push({ month, day, name, date: `${day}/${month}` });
        }
    });

    return holidays;
}

// ============================================
// SAVE BUTTON FUNCTIONALITY
// ============================================

function initSaveButton() {
    const saveBtn = document.getElementById('saveProfileBtn');
    if (saveBtn) {
        saveBtn.addEventListener('click', saveProfile);
    }
}

async function saveProfile() {
    const saveBtn = document.getElementById('saveProfileBtn');
    const originalText = saveBtn.innerHTML;

    saveBtn.innerHTML = `
        <div class="loading-spinner"></div>
        <span>Guardando...</span>
    `;
    saveBtn.disabled = true;

    const profileData = {
        business: {
            name: document.getElementById('businessNameInput').value,
            type: document.getElementById('businessTypeInput').getAttribute('data-value'),
            description: document.getElementById('descriptionInput').value,
            website: document.getElementById('websiteInput').value,
            email: document.getElementById('emailInput').value
        },
        schedule: collectScheduleData(),
        holidays: collectHolidaysData(),
        location: {
            address: document.getElementById('addressInput').value,
            betweenStreets: document.getElementById('betweenStreetsInput').value,
            number: document.getElementById('numberInput').value,
            neighborhood: document.getElementById('neighborhoodInput').value,
            city: document.getElementById('cityInput').value,
            state: document.getElementById('stateInput').value,
            country: document.getElementById('countryInput').value,
            postalCode: document.getElementById('postalCodeInput').value
        },
        social: {
            facebook: document.getElementById('facebookInput').value,
            instagram: document.getElementById('instagramInput').value,
            twitter: document.getElementById('twitterInput').value,
            linkedin: document.getElementById('linkedinInput').value
        }
    };

    try {
        const response = await fetch('/api/profile', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(profileData)
        });

        const result = await response.json();

        saveBtn.innerHTML = originalText;
        saveBtn.disabled = false;

        if (response.ok && result.success) {
            showNotification('¡Cambios guardados exitosamente!', 'success');
            console.log('✅ Perfil guardado:', result);
        } else {
            if (response.status === 404) {
                showNotification('⚠️ Primero debes crear un agente', 'warning');
            } else {
                throw new Error(result.error || 'Error desconocido');
            }
        }
    } catch (error) {
        console.error('❌ Error:', error);
        saveBtn.innerHTML = originalText;
        saveBtn.disabled = false;
        showNotification(error.message || 'Error al guardar', 'error');
    }
}

function collectScheduleData() {
    const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
    const schedule = {};

    days.forEach(day => {
        const checkbox = document.getElementById(`day-${day}`);
        const openInput = document.getElementById(`time-${day}-open`);
        const closeInput = document.getElementById(`time-${day}-close`);

        schedule[day] = {
            isOpen: checkbox ? checkbox.checked : false,
            open: openInput ? openInput.value : '09:00',
            close: closeInput ? closeInput.value : '20:00'
        };
    });

    return schedule;
}

// ============================================
// NOTIFICATION VIA SILEO
// ============================================

function initSileoViewport() {
    if (!document.getElementById('sileo-vp')) {
        const vp = document.createElement('div');
        vp.id = 'sileo-vp';
        vp.setAttribute('role', 'region');
        vp.setAttribute('aria-live', 'polite');
        document.body.appendChild(vp);
        initRenderer();
    }
}

function showNotification(message, type = 'info') {
    initSileoViewport();
    const titles = {
        success: 'Guardado',
        error:   'Error',
        warning: 'Aviso',
        info:    'Información'
    };
    const opts = { title: titles[type] || 'Aviso', description: message };
    if (Sileo[type]) {
        Sileo[type](opts);
    } else {
        Sileo.info(opts);
    }
}

// ============================================
// ANIMATIONS
// ============================================

// (fadeIn/fadeOut are handled by profile.css keyframes)