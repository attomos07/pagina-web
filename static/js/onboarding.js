// ============================================
// STATE MANAGEMENT
// ============================================
let currentStep = 1;
let currentSection = 1;
let selectedSocial = '';
let userBusinessType = '';
let agentData = {
  social: '',
  businessType: '',
  name: '',
  phoneNumber: '',
  useDifferentPhone: false,
  config: {
    welcomeMessage: '',
    aiPersonality: '',
    tone: 'formal',
    customTone: '',
    languages: [],
    additionalLanguages: [],
    specialInstructions: '',
    schedule: {
      monday: { open: true, start: '09:00', end: '18:00' },
      tuesday: { open: true, start: '09:00', end: '18:00' },
      wednesday: { open: true, start: '09:00', end: '18:00' },
      thursday: { open: true, start: '09:00', end: '18:00' },
      friday: { open: true, start: '09:00', end: '18:00' },
      saturday: { open: false, start: '09:00', end: '14:00' },
      sunday: { open: false, start: '09:00', end: '14:00' }
    },
    holidays: [],
    services: [],
    workers: []
  },
  location: {
    address: '',
    postalCode: '',
    betweenStreets: '',
    number: '',
    neighborhood: '',
    city: '',
    state: '',
    country: ''
  },
  social_media: {
    facebook: '',
    instagram: '',
    twitter: '',
    linkedin: ''
  }
};

// Section definitions
const SECTIONS = [
  { id: 1, name: 'Información Básica', icon: 'lni-information', containerId: 'section-basic' },
  { id: 2, name: 'Ubicación', icon: 'lni-map-marker', containerId: 'section-location' },
  { id: 3, name: 'Redes Sociales', icon: 'lni-share-alt', containerId: 'section-social' },
  { id: 4, name: 'Personalidad', icon: 'lni-comments', containerId: 'section-personality' },
  { id: 5, name: 'Horarios', icon: 'lni-calendar', containerId: 'section-schedule' },
  { id: 6, name: 'Días Festivos', icon: 'lni-gift', containerId: 'section-holidays' },
  { id: 7, name: 'Servicios', icon: 'lni-package', containerId: 'section-services' },
  { id: 8, name: 'Trabajadores', icon: 'lni-users', containerId: 'section-workers' }
];

// Location data
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

const CITIES_MEXICO = {
  'sonora': ['Hermosillo', 'Ciudad Obregón', 'Nogales', 'San Luis Río Colorado', 'Navojoa', 
             'Guaymas', 'Empalme', 'Agua Prieta', 'Caborca', 'Cananea', 'Puerto Peñasco'],
  'default': ['Ciudad de México', 'Guadalajara', 'Monterrey', 'Puebla', 'Tijuana', 
              'León', 'Juárez', 'Zapopan', 'Mérida', 'Cancún']
};

// ============================================
// INITIALIZE
// ============================================
document.addEventListener('DOMContentLoaded', function() {
  fetchUserData();
  initializeSocialSelection();
  initializeNavigationButtons();
  initializeSectionNavigation();
  initializeToneSelection();
  initializeLanguageSelection();
  initializeRichEditor();
  initializePhoneToggle();
  initializeSchedule();
  initializeHolidays();
  initializeServices();
  initializeWorkers();
  initializeLocationDropdowns();
  initializeSocialMediaInputs();
  
  // Inicializar custom pickers
  setTimeout(() => {
    initBusinessTimePickers();
    initHolidayDatePickers();
    initWorkerTimePickers();
  }, 100);
});

// ============================================
// SECTION NAVIGATION
// ============================================
function initializeSectionNavigation() {
  const navigationContainer = document.getElementById('sectionNavigation');
  if (!navigationContainer) return;

  // Crear botones de navegación de secciones
  navigationContainer.innerHTML = '';
  SECTIONS.forEach(section => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `section-nav-btn ${section.id === 1 ? 'active' : ''}`;
    btn.dataset.sectionId = section.id;
    btn.innerHTML = `
      <i class="lni ${section.icon}"></i>
      <span>${section.name}</span>
    `;
    btn.addEventListener('click', () => navigateToSection(section.id));
    navigationContainer.appendChild(btn);
  });

  // Eventos para botones "Siguiente" de cada sección
  document.querySelectorAll('.btn-next-section').forEach(btn => {
    btn.addEventListener('click', () => {
      if (currentSection < SECTIONS.length) {
        navigateToSection(currentSection + 1);
      }
    });
  });

  // Eventos para botones "Anterior" de cada sección
  document.querySelectorAll('.btn-prev-section').forEach(btn => {
    btn.addEventListener('click', () => {
      if (currentSection > 1) {
        navigateToSection(currentSection - 1);
      }
    });
  });
}

function navigateToSection(sectionId) {
  if (sectionId < 1 || sectionId > SECTIONS.length) return;

  currentSection = sectionId;

  // Ocultar todas las secciones
  SECTIONS.forEach(section => {
    const container = document.getElementById(section.containerId);
    if (container) {
      container.classList.remove('active');
    }
  });

  // Mostrar sección actual
  const currentSectionData = SECTIONS.find(s => s.id === sectionId);
  if (currentSectionData) {
    const container = document.getElementById(currentSectionData.containerId);
    if (container) {
      container.classList.add('active');
      
      // Mostrar u ocultar botón "Anterior" según la sección
      const prevBtn = container.querySelector('.btn-prev-section');
      if (prevBtn) {
        if (sectionId === 1) {
          prevBtn.style.display = 'none';
        } else {
          prevBtn.style.display = 'flex';
        }
      }
    }
  }

  // Actualizar botones de navegación
  document.querySelectorAll('.section-nav-btn').forEach(btn => {
    const btnSectionId = parseInt(btn.dataset.sectionId);
    btn.classList.remove('active', 'completed');
    
    if (btnSectionId === sectionId) {
      btn.classList.add('active');
    } else if (btnSectionId < sectionId) {
      btn.classList.add('completed');
    }
  });

  // Scroll al inicio del contenedor
  window.scrollTo(0, 0);
}

// ============================================
// CUSTOM TIME PICKER - BUSINESS HOURS
// ============================================
function initBusinessTimePickers() {
  console.log('🕐 Inicializando Time Pickers del negocio...');
  
  const timeInputs = document.querySelectorAll('.time-input');
  
  timeInputs.forEach(input => {
    const parent = input.closest('.schedule-day');
    if (parent && !input.dataset.useCustom) {
      convertToCustomTimePicker(input);
    }
  });
}

function convertToCustomTimePicker(nativeInput) {
  const wrapper = document.createElement('div');
  wrapper.className = 'custom-time-wrapper';
  
  const customInput = document.createElement('input');
  customInput.type = 'text';
  customInput.className = 'time-input-custom';
  customInput.value = formatTimeDisplay(nativeInput.value || '09:00');
  customInput.readOnly = true;
  
  if (nativeInput.disabled) {
    customInput.disabled = true;
    wrapper.classList.add('disabled');
  }
  
  const arrow = document.createElement('i');
  arrow.className = 'lni lni-chevron-down time-arrow';
  
  const dropdown = document.createElement('div');
  dropdown.className = 'time-dropdown';
  
  const columnsContainer = document.createElement('div');
  columnsContainer.className = 'time-picker-columns';
  
  const initialTime = parseTime(nativeInput.value || '09:00');
  
  const hoursColumn = createTimeColumn('Hora', generateHours(), initialTime.hour);
  const minutesColumn = createTimeColumn('Min', generateMinutes(), initialTime.minute);
  const periodColumn = createTimeColumn('', ['AM', 'PM'], initialTime.period);
  
  columnsContainer.appendChild(hoursColumn);
  columnsContainer.appendChild(minutesColumn);
  columnsContainer.appendChild(periodColumn);
  
  const footer = document.createElement('div');
  footer.className = 'time-picker-footer';
  
  const cancelBtn = document.createElement('button');
  cancelBtn.type = 'button';
  cancelBtn.className = 'time-picker-btn time-picker-cancel';
  cancelBtn.textContent = 'Cancelar';
  cancelBtn.onclick = (e) => {
    e.stopPropagation();
    closeBusinessDropdown(wrapper);
  };
  
  const confirmBtn = document.createElement('button');
  confirmBtn.type = 'button';
  confirmBtn.className = 'time-picker-btn time-picker-confirm';
  confirmBtn.textContent = 'Aceptar';
  confirmBtn.onclick = (e) => {
    e.stopPropagation();
    applyBusinessTime(wrapper, nativeInput, customInput, hoursColumn, minutesColumn, periodColumn);
  };
  
  footer.appendChild(cancelBtn);
  footer.appendChild(confirmBtn);
  
  dropdown.appendChild(columnsContainer);
  dropdown.appendChild(footer);
  
  customInput.addEventListener('click', (e) => {
    if (!customInput.disabled) {
      e.stopPropagation();
      toggleBusinessDropdown(wrapper);
    }
  });
  
  document.addEventListener('click', (e) => {
    if (!wrapper.contains(e.target)) {
      closeBusinessDropdown(wrapper);
    }
  });
  
  wrapper.appendChild(customInput);
  wrapper.appendChild(arrow);
  wrapper.appendChild(dropdown);
  
  nativeInput.parentNode.insertBefore(wrapper, nativeInput);
  nativeInput.style.display = 'none';
  nativeInput.dataset.useCustom = 'true';
  
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      if (mutation.attributeName === 'disabled') {
        customInput.disabled = nativeInput.disabled;
        if (nativeInput.disabled) {
          wrapper.classList.add('disabled');
          closeBusinessDropdown(wrapper);
        } else {
          wrapper.classList.remove('disabled');
        }
      }
    });
  });
  
  observer.observe(nativeInput, { attributes: true });
}

function createTimeColumn(label, options, selectedValue) {
  const column = document.createElement('div');
  column.className = 'time-column';
  
  if (label) {
    const header = document.createElement('div');
    header.className = 'time-column-header';
    header.textContent = label;
    column.appendChild(header);
  }
  
  options.forEach(option => {
    const optionElement = document.createElement('div');
    optionElement.className = 'time-column-option';
    optionElement.textContent = option;
    optionElement.dataset.value = option;
    
    if (option === selectedValue) {
      optionElement.classList.add('selected');
      setTimeout(() => {
        optionElement.scrollIntoView({ block: 'center', behavior: 'smooth' });
      }, 50);
    }
    
    optionElement.addEventListener('click', (e) => {
      e.stopPropagation();
      column.querySelectorAll('.time-column-option').forEach(opt => {
        opt.classList.remove('selected');
      });
      optionElement.classList.add('selected');
    });
    
    column.appendChild(optionElement);
  });
  
  return column;
}

function generateHours() {
  const hours = [];
  for (let i = 1; i <= 12; i++) {
    hours.push(i.toString().padStart(2, '0'));
  }
  return hours;
}

function generateMinutes() {
  return ['00', '15', '30', '45'];
}

function parseTime(time24) {
  const [hours, minutes] = time24.split(':');
  let hour = parseInt(hours);
  const period = hour >= 12 ? 'PM' : 'AM';
  hour = hour % 12 || 12;
  
  return {
    hour: hour.toString().padStart(2, '0'),
    minute: minutes,
    period: period
  };
}

function formatTimeDisplay(time24) {
  const parsed = parseTime(time24);
  return `${parsed.hour}:${parsed.minute} ${parsed.period}`;
}

function toggleBusinessDropdown(wrapper) {
  const isActive = wrapper.classList.contains('active');
  
  if (isActive) {
    closeBusinessDropdown(wrapper);
  } else {
    openBusinessDropdown(wrapper);
  }
}

function openBusinessDropdown(wrapper) {
  wrapper.classList.add('active');
  wrapper.querySelector('.time-input-custom').classList.add('active');
}

function closeBusinessDropdown(wrapper) {
  wrapper.classList.remove('active');
  const input = wrapper.querySelector('.time-input-custom');
  if (input) {
    input.classList.remove('active');
  }
}

function applyBusinessTime(wrapper, nativeInput, customInput, hoursColumn, minutesColumn, periodColumn) {
  const selectedHour = hoursColumn.querySelector('.time-column-option.selected');
  const selectedMinute = minutesColumn.querySelector('.time-column-option.selected');
  const selectedPeriod = periodColumn.querySelector('.time-column-option.selected');
  
  if (!selectedHour || !selectedMinute || !selectedPeriod) {
    return;
  }
  
  let hour = parseInt(selectedHour.dataset.value);
  const minute = selectedMinute.dataset.value;
  const period = selectedPeriod.dataset.value;
  
  if (period === 'PM' && hour !== 12) {
    hour += 12;
  } else if (period === 'AM' && hour === 12) {
    hour = 0;
  }
  
  const time24 = `${hour.toString().padStart(2, '0')}:${minute}`;
  const timeDisplay = `${selectedHour.dataset.value}:${minute} ${period}`;
  
  nativeInput.value = time24;
  customInput.value = timeDisplay;
  
  const event = new Event('change', { bubbles: true });
  nativeInput.dispatchEvent(event);
  
  closeBusinessDropdown(wrapper);
}

// ============================================
// CUSTOM DATE PICKER - HOLIDAYS
// ============================================
function initHolidayDatePickers() {
  console.log('📅 Inicializando Date Pickers de festivos...');
  
  const holidaysList = document.getElementById('holidaysList');
  if (!holidaysList) return;
  
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      mutation.addedNodes.forEach((node) => {
        if (node.nodeType === 1 && node.classList.contains('holiday-item')) {
          const dateInput = node.querySelector('.holiday-date-input');
          if (dateInput && !dateInput.dataset.useCustom) {
            convertToCustomDatePicker(dateInput);
          }
        }
      });
    });
  });
  
  observer.observe(holidaysList, { childList: true });
  
  document.querySelectorAll('.holiday-date-input').forEach(input => {
    if (!input.dataset.useCustom) {
      convertToCustomDatePicker(input);
    }
  });
}

function convertToCustomDatePicker(nativeInput) {
  const wrapper = document.createElement('div');
  wrapper.className = 'custom-date-wrapper';
  
  const customInput = document.createElement('input');
  customInput.type = 'text';
  customInput.className = 'date-input-custom';
  customInput.value = formatDisplayDate(nativeInput.value || '');
  customInput.readOnly = true;
  customInput.placeholder = 'Selecciona una fecha';
  
  const arrow = document.createElement('i');
  arrow.className = 'lni lni-calendar date-arrow';
  
  const dropdown = document.createElement('div');
  dropdown.className = 'date-dropdown';
  
  const currentDate = new Date();
  let currentMonth = currentDate.getMonth();
  let currentYear = currentDate.getFullYear();
  
  function renderCalendar() {
    dropdown.innerHTML = '';
    
    const header = document.createElement('div');
    header.className = 'date-picker-header';
    
    const nav = document.createElement('div');
    nav.className = 'date-picker-nav';
    
    const prevBtn = document.createElement('button');
    prevBtn.type = 'button';
    prevBtn.innerHTML = '<i class="lni lni-chevron-left"></i>';
    prevBtn.onclick = (e) => {
      e.stopPropagation();
      currentMonth--;
      if (currentMonth < 0) {
        currentMonth = 11;
        currentYear--;
      }
      renderCalendar();
    };
    
    const nextBtn = document.createElement('button');
    nextBtn.type = 'button';
    nextBtn.innerHTML = '<i class="lni lni-chevron-right"></i>';
    nextBtn.onclick = (e) => {
      e.stopPropagation();
      currentMonth++;
      if (currentMonth > 11) {
        currentMonth = 0;
        currentYear++;
      }
      renderCalendar();
    };
    
    nav.appendChild(prevBtn);
    nav.appendChild(nextBtn);
    
    const current = document.createElement('div');
    current.className = 'date-picker-current';
    const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 
                        'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
    current.textContent = `${monthNames[currentMonth]} ${currentYear}`;
    
    header.appendChild(nav);
    header.appendChild(current);
    dropdown.appendChild(header);
    
    const calendar = document.createElement('div');
    calendar.className = 'date-picker-calendar';
    
    const weekdays = document.createElement('div');
    weekdays.className = 'date-picker-weekdays';
    ['D', 'L', 'M', 'M', 'J', 'V', 'S'].forEach(day => {
      const weekday = document.createElement('div');
      weekday.className = 'date-picker-weekday';
      weekday.textContent = day;
      weekdays.appendChild(weekday);
    });
    calendar.appendChild(weekdays);
    
    const days = document.createElement('div');
    days.className = 'date-picker-days';
    
    const firstDay = new Date(currentYear, currentMonth, 1).getDay();
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    const daysInPrevMonth = new Date(currentYear, currentMonth, 0).getDate();
    
    for (let i = firstDay - 1; i >= 0; i--) {
      const day = document.createElement('div');
      day.className = 'date-picker-day other-month';
      day.textContent = daysInPrevMonth - i;
      days.appendChild(day);
    }
    
    const today = new Date();
    const selectedDate = nativeInput.value ? new Date(nativeInput.value + 'T00:00:00') : null;
    
    for (let i = 1; i <= daysInMonth; i++) {
      const day = document.createElement('div');
      day.className = 'date-picker-day';
      day.textContent = i;
      
      const thisDate = new Date(currentYear, currentMonth, i);
      
      if (today.toDateString() === thisDate.toDateString()) {
        day.classList.add('today');
      }
      
      if (selectedDate && selectedDate.toDateString() === thisDate.toDateString()) {
        day.classList.add('selected');
      }
      
      day.onclick = (e) => {
        e.stopPropagation();
        selectDate(wrapper, nativeInput, customInput, currentYear, currentMonth, i);
      };
      
      days.appendChild(day);
    }
    
    const totalCells = days.children.length;
    const remainingCells = 42 - totalCells;
    for (let i = 1; i <= remainingCells; i++) {
      const day = document.createElement('div');
      day.className = 'date-picker-day other-month';
      day.textContent = i;
      days.appendChild(day);
    }
    
    calendar.appendChild(days);
    dropdown.appendChild(calendar);
  }
  
  renderCalendar();
  
  customInput.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleDateDropdown(wrapper);
  });
  
  document.addEventListener('click', (e) => {
    if (!wrapper.contains(e.target)) {
      closeDateDropdown(wrapper);
    }
  });
  
  wrapper.appendChild(customInput);
  wrapper.appendChild(arrow);
  wrapper.appendChild(dropdown);
  
  nativeInput.parentNode.insertBefore(wrapper, nativeInput);
  nativeInput.style.display = 'none';
  nativeInput.dataset.useCustom = 'true';
}

function toggleDateDropdown(wrapper) {
  const isActive = wrapper.classList.contains('active');
  
  if (isActive) {
    closeDateDropdown(wrapper);
  } else {
    openDateDropdown(wrapper);
  }
}

function openDateDropdown(wrapper) {
  wrapper.classList.add('active');
  wrapper.querySelector('.date-input-custom').classList.add('active');
}

function closeDateDropdown(wrapper) {
  wrapper.classList.remove('active');
  wrapper.querySelector('.date-input-custom').classList.remove('active');
}

function selectDate(wrapper, nativeInput, customInput, year, month, day) {
  const date = new Date(year, month, day);
  const dateString = date.toISOString().split('T')[0];
  
  nativeInput.value = dateString;
  customInput.value = formatDisplayDate(dateString);
  
  const event = new Event('change', { bubbles: true });
  nativeInput.dispatchEvent(event);
  
  closeDateDropdown(wrapper);
}

function formatDisplayDate(dateString) {
  if (!dateString) return '';
  
  const date = new Date(dateString + 'T00:00:00');
  const day = date.getDate();
  const monthNames = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 
                      'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
  
  return `${day} ${monthNames[date.getMonth()]} ${date.getFullYear()}`;
}

// ============================================
// CUSTOM TIME PICKER - WORKERS
// ============================================
function initWorkerTimePickers() {
  console.log('👷 Inicializando Time Pickers de trabajadores...');
  
  const workersList = document.getElementById('workersList');
  if (!workersList) return;
  
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      mutation.addedNodes.forEach((node) => {
        if (node.nodeType === 1 && node.classList.contains('worker-item')) {
          const startTime = node.querySelector('.worker-start-time');
          const endTime = node.querySelector('.worker-end-time');
          
          if (startTime && !startTime.dataset.useCustom) {
            convertToWorkerTimePicker(startTime);
          }
          if (endTime && !endTime.dataset.useCustom) {
            convertToWorkerTimePicker(endTime);
          }
        }
      });
    });
  });
  
  observer.observe(workersList, { childList: true, subtree: true });
  
  document.querySelectorAll('.worker-start-time, .worker-end-time').forEach(input => {
    if (!input.dataset.useCustom) {
      convertToWorkerTimePicker(input);
    }
  });
}

function convertToWorkerTimePicker(nativeInput) {
  const wrapper = document.createElement('div');
  wrapper.className = 'worker-time-wrapper';
  
  const customInput = document.createElement('input');
  customInput.type = 'text';
  customInput.className = 'worker-time-input-custom';
  customInput.value = formatTimeDisplay(nativeInput.value || '09:00');
  customInput.readOnly = true;
  
  const arrow = document.createElement('i');
  arrow.className = 'lni lni-chevron-down worker-time-arrow';
  
  const dropdown = document.createElement('div');
  dropdown.className = 'worker-time-dropdown';
  
  const columnsContainer = document.createElement('div');
  columnsContainer.className = 'time-picker-columns';
  
  const initialTime = parseTime(nativeInput.value || '09:00');
  
  const hoursColumn = createTimeColumn('Hora', generateHours(), initialTime.hour);
  const minutesColumn = createTimeColumn('Min', generateMinutes(), initialTime.minute);
  const periodColumn = createTimeColumn('', ['AM', 'PM'], initialTime.period);
  
  columnsContainer.appendChild(hoursColumn);
  columnsContainer.appendChild(minutesColumn);
  columnsContainer.appendChild(periodColumn);
  
  const footer = document.createElement('div');
  footer.className = 'time-picker-footer';
  
  const cancelBtn = document.createElement('button');
  cancelBtn.type = 'button';
  cancelBtn.className = 'time-picker-btn time-picker-cancel';
  cancelBtn.textContent = 'Cancelar';
  cancelBtn.onclick = (e) => {
    e.stopPropagation();
    closeWorkerDropdown(wrapper);
  };
  
  const confirmBtn = document.createElement('button');
  confirmBtn.type = 'button';
  confirmBtn.className = 'time-picker-btn time-picker-confirm';
  confirmBtn.textContent = 'Aceptar';
  confirmBtn.onclick = (e) => {
    e.stopPropagation();
    applyWorkerTime(wrapper, nativeInput, customInput, hoursColumn, minutesColumn, periodColumn);
  };
  
  footer.appendChild(cancelBtn);
  footer.appendChild(confirmBtn);
  
  dropdown.appendChild(columnsContainer);
  dropdown.appendChild(footer);
  
  customInput.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleWorkerDropdown(wrapper);
  });
  
  document.addEventListener('click', (e) => {
    if (!wrapper.contains(e.target)) {
      closeWorkerDropdown(wrapper);
    }
  });
  
  wrapper.appendChild(customInput);
  wrapper.appendChild(arrow);
  wrapper.appendChild(dropdown);
  
  nativeInput.parentNode.insertBefore(wrapper, nativeInput);
  nativeInput.style.display = 'none';
  nativeInput.dataset.useCustom = 'true';
}

function toggleWorkerDropdown(wrapper) {
  const isActive = wrapper.classList.contains('active');
  
  if (isActive) {
    closeWorkerDropdown(wrapper);
  } else {
    openWorkerDropdown(wrapper);
  }
}

function openWorkerDropdown(wrapper) {
  wrapper.classList.add('active');
  wrapper.querySelector('.worker-time-input-custom').classList.add('active');
}

function closeWorkerDropdown(wrapper) {
  wrapper.classList.remove('active');
  const input = wrapper.querySelector('.worker-time-input-custom');
  if (input) {
    input.classList.remove('active');
  }
}

function applyWorkerTime(wrapper, nativeInput, customInput, hoursColumn, minutesColumn, periodColumn) {
  const selectedHour = hoursColumn.querySelector('.time-column-option.selected');
  const selectedMinute = minutesColumn.querySelector('.time-column-option.selected');
  const selectedPeriod = periodColumn.querySelector('.time-column-option.selected');
  
  if (!selectedHour || !selectedMinute || !selectedPeriod) {
    return;
  }
  
  let hour = parseInt(selectedHour.dataset.value);
  const minute = selectedMinute.dataset.value;
  const period = selectedPeriod.dataset.value;
  
  if (period === 'PM' && hour !== 12) {
    hour += 12;
  } else if (period === 'AM' && hour === 12) {
    hour = 0;
  }
  
  const time24 = `${hour.toString().padStart(2, '0')}:${minute}`;
  const timeDisplay = `${selectedHour.dataset.value}:${minute} ${period}`;
  
  nativeInput.value = time24;
  customInput.value = timeDisplay;
  
  const event = new Event('change', { bubbles: true });
  nativeInput.dispatchEvent(event);
  
  closeWorkerDropdown(wrapper);
}

// ============================================
// USER DATA
// ============================================
async function fetchUserData() {
  try {
    const response = await fetch('/api/me', {
      credentials: 'include'
    });
    
    if (response.ok) {
      const data = await response.json();
      userBusinessType = data.user.businessType;
      agentData.businessType = userBusinessType;
      console.log('✅ Tipo de negocio del usuario:', userBusinessType);
    }
  } catch (error) {
    console.error('❌ Error obteniendo datos del usuario:', error);
  }
}

// ============================================
// SOCIAL NETWORK SELECTION
// ============================================
function initializeSocialSelection() {
  const socialInputs = document.querySelectorAll('input[name="social"]');
  const btnStep1 = document.getElementById('btnStep1');

  socialInputs.forEach(input => {
    input.addEventListener('change', function() {
      selectedSocial = this.value;
      agentData.social = this.value;
      btnStep1.disabled = false;
    });
  });
}

// ============================================
// PHONE TOGGLE
// ============================================
function initializePhoneToggle() {
  const phoneToggle = document.getElementById('phoneToggle');
  const differentPhoneSection = document.getElementById('differentPhoneSection');
  
  if (phoneToggle) {
    phoneToggle.addEventListener('change', function() {
      agentData.useDifferentPhone = this.checked;
      if (differentPhoneSection) {
        if (this.checked) {
          differentPhoneSection.style.display = 'block';
        } else {
          differentPhoneSection.style.display = 'none';
        }
      }
    });
  }
}

// ============================================
// TONE SELECTION
// ============================================
function initializeToneSelection() {
  const toneInputs = document.querySelectorAll('input[name="tone"]');
  const customToneEditor = document.getElementById('customToneEditor');
  
  toneInputs.forEach(input => {
    input.addEventListener('change', function() {
      document.querySelectorAll('.tone-radio-option').forEach(opt => {
        opt.classList.remove('selected');
      });
      
      this.closest('.tone-radio-option').classList.add('selected');
      agentData.config.tone = this.value;
      
      if (this.value === 'custom') {
        customToneEditor.classList.add('show');
      } else {
        customToneEditor.classList.remove('show');
        agentData.config.customTone = '';
      }
    });
  });
}

// ============================================
// LANGUAGE SELECTION
// ============================================
function initializeLanguageSelection() {
  const languageCheckboxes = document.querySelectorAll('input[name="additionalLanguage"]');
  
  languageCheckboxes.forEach(checkbox => {
    checkbox.addEventListener('change', function() {
      if (this.checked) {
        if (!agentData.config.additionalLanguages.includes(this.value)) {
          agentData.config.additionalLanguages.push(this.value);
        }
      } else {
        agentData.config.additionalLanguages = agentData.config.additionalLanguages.filter(lang => lang !== this.value);
      }
    });
  });
}

// ============================================
// RICH TEXT EDITOR
// ============================================
function initializeRichEditor() {
  const editorContent = document.getElementById('editorContent');
  if (!editorContent) return;

  const boldBtn = document.getElementById('boldBtn');
  const italicBtn = document.getElementById('italicBtn');
  const underlineBtn = document.getElementById('underlineBtn');
  const listBtn = document.getElementById('listBtn');

  if (boldBtn) {
    boldBtn.addEventListener('click', () => {
      document.execCommand('bold', false, null);
      editorContent.focus();
    });
  }

  if (italicBtn) {
    italicBtn.addEventListener('click', () => {
      document.execCommand('italic', false, null);
      editorContent.focus();
    });
  }

  if (underlineBtn) {
    underlineBtn.addEventListener('click', () => {
      document.execCommand('underline', false, null);
      editorContent.focus();
    });
  }

  if (listBtn) {
    listBtn.addEventListener('click', () => {
      document.execCommand('insertUnorderedList', false, null);
      editorContent.focus();
    });
  }

  editorContent.addEventListener('input', function() {
    agentData.config.customTone = this.innerHTML;
  });
}

// ============================================
// SCHEDULE MANAGEMENT
// ============================================
function initializeSchedule() {
  const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
  
  days.forEach(day => {
    const toggle = document.getElementById(`${day}Toggle`);
    const startTime = document.getElementById(`${day}Start`);
    const endTime = document.getElementById(`${day}End`);
    const scheduleDay = document.querySelector(`[data-day="${day}"]`);
    
    if (toggle) {
      toggle.addEventListener('change', function() {
        agentData.config.schedule[day].open = this.checked;
        if (scheduleDay) {
          if (this.checked) {
            scheduleDay.classList.remove('closed');
            if (startTime) startTime.disabled = false;
            if (endTime) endTime.disabled = false;
          } else {
            scheduleDay.classList.add('closed');
            if (startTime) startTime.disabled = true;
            if (endTime) endTime.disabled = true;
          }
        }
      });
    }
    
    if (startTime) {
      startTime.addEventListener('change', function() {
        agentData.config.schedule[day].start = this.value;
      });
    }
    
    if (endTime) {
      endTime.addEventListener('change', function() {
        agentData.config.schedule[day].end = this.value;
      });
    }
  });
}

// ============================================
// HOLIDAYS MANAGEMENT
// ============================================
function initializeHolidays() {
  const addHolidayBtn = document.getElementById('addHolidayBtn');
  
  if (addHolidayBtn) {
    addHolidayBtn.addEventListener('click', addHoliday);
  }
}

function addHoliday() {
  const holidaysList = document.getElementById('holidaysList');
  if (!holidaysList) return;
  
  const holidayId = Date.now();
  const holidayItem = document.createElement('div');
  holidayItem.className = 'holiday-item';
  holidayItem.dataset.holidayId = holidayId;
  
  holidayItem.innerHTML = `
    <div class="holiday-date form-group">
      <input type="date" class="form-input holiday-date-input" required>
    </div>
    <div class="holiday-name form-group">
      <input type="text" class="form-input holiday-name-input" placeholder="Nombre del día festivo" required>
    </div>
    <button type="button" class="btn-remove-holiday" onclick="removeHoliday(${holidayId})">
      <i class="lni lni-trash-can"></i>
    </button>
  `;
  
  holidaysList.appendChild(holidayItem);
  
  const dateInput = holidayItem.querySelector('.holiday-date-input');
  const nameInput = holidayItem.querySelector('.holiday-name-input');
  
  dateInput.addEventListener('change', updateHolidaysData);
  nameInput.addEventListener('input', updateHolidaysData);
}

function removeHoliday(holidayId) {
  const holidayItem = document.querySelector(`[data-holiday-id="${holidayId}"]`);
  if (holidayItem) {
    holidayItem.remove();
    updateHolidaysData();
  }
}

function updateHolidaysData() {
  const holidays = [];
  document.querySelectorAll('.holiday-item').forEach(item => {
    const date = item.querySelector('.holiday-date-input').value;
    const name = item.querySelector('.holiday-name-input').value;
    if (date && name) {
      holidays.push({ date, name });
    }
  });
  agentData.config.holidays = holidays;
}

// ============================================
// SERVICES MANAGEMENT
// ============================================
function initializeServices() {
  const addServiceBtn = document.getElementById('addServiceBtn');
  
  if (addServiceBtn) {
    addServiceBtn.addEventListener('click', addService);
  }
}

function addService() {
  const servicesList = document.getElementById('servicesList');
  if (!servicesList) return;
  
  const serviceId = Date.now();
  const serviceNumber = document.querySelectorAll('.service-item').length + 1;
  const serviceItem = document.createElement('div');
  serviceItem.className = 'service-item';
  serviceItem.dataset.serviceId = serviceId;
  
  serviceItem.innerHTML = `
    <div class="service-header">
      <div class="service-number">Servicio ${serviceNumber}</div>
      <button type="button" class="btn-remove-service" onclick="removeService(${serviceId})">
        <i class="lni lni-trash-can"></i>
      </button>
    </div>
    <div class="service-fields">
      <div class="form-group">
        <label class="form-label">Título del Servicio *</label>
        <input type="text" class="form-input service-title" placeholder="Ej: Corte de cabello" required>
      </div>
      
      <div class="form-group">
        <label class="form-label">Tipo de Precio</label>
        <div class="price-type-selector">
          <div class="price-type-option active" data-type="normal">Precio Normal</div>
          <div class="price-type-option" data-type="promotion">Promoción</div>
        </div>
      </div>
      
      <div class="form-group price-normal">
        <label class="form-label">Precio *</label>
        <div class="price-input-wrapper">
          <span class="price-currency">$</span>
          <input type="number" class="form-input service-price price-input" placeholder="0.00" step="0.01" required>
        </div>
      </div>
      
      <div class="promotion-prices">
        <div class="form-group">
          <label class="form-label">Precio Original *</label>
          <div class="price-input-wrapper">
            <span class="price-currency">$</span>
            <input type="number" class="form-input service-original-price price-input" placeholder="0.00" step="0.01">
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">Precio Promoción *</label>
          <div class="price-input-wrapper">
            <span class="price-currency">$</span>
            <input type="number" class="form-input service-promo-price price-input" placeholder="0.00" step="0.01">
          </div>
        </div>
      </div>
      
      <div class="form-group">
        <label class="form-label">Descripción del Servicio</label>
        <div class="service-description-editor">
          <div class="service-editor-toolbar">
            <button type="button" class="service-editor-btn" data-command="bold" title="Negrita">
              <i class="lni lni-text-format"></i>
            </button>
            <button type="button" class="service-editor-btn" data-command="italic" title="Cursiva">
              <i class="lni lni-italic"></i>
            </button>
            <button type="button" class="service-editor-btn" data-command="underline" title="Subrayado">
              <i class="lni lni-underline"></i>
            </button>
            <button type="button" class="service-editor-btn" data-command="insertUnorderedList" title="Lista">
              <i class="lni lni-list"></i>
            </button>
          </div>
          <div class="service-editor-content" 
               contenteditable="true" 
               data-placeholder="Describe las características del servicio...">
          </div>
        </div>
      </div>
    </div>
  `;
  
  servicesList.appendChild(serviceItem);
  
  const editorButtons = serviceItem.querySelectorAll('.service-editor-btn');
  const editorContent = serviceItem.querySelector('.service-editor-content');
  
  editorButtons.forEach(btn => {
    btn.addEventListener('click', function() {
      const command = this.dataset.command;
      document.execCommand(command, false, null);
      editorContent.focus();
    });
  });
  
  editorContent.addEventListener('input', function() {
    updateServicesData();
  });
  
  const priceTypeOptions = serviceItem.querySelectorAll('.price-type-option');
  const promotionPrices = serviceItem.querySelector('.promotion-prices');
  const normalPrice = serviceItem.querySelector('.price-normal');
  
  priceTypeOptions.forEach(option => {
    option.addEventListener('click', function() {
      priceTypeOptions.forEach(opt => opt.classList.remove('active'));
      this.classList.add('active');
      
      if (this.dataset.type === 'promotion') {
        promotionPrices.classList.add('show');
        normalPrice.style.display = 'none';
      } else {
        promotionPrices.classList.remove('show');
        normalPrice.style.display = 'block';
      }
      updateServicesData();
    });
  });
  
  serviceItem.querySelectorAll('input, textarea').forEach(input => {
    input.addEventListener('input', updateServicesData);
  });
}

function removeService(serviceId) {
  const serviceItem = document.querySelector(`[data-service-id="${serviceId}"]`);
  if (serviceItem) {
    serviceItem.remove();
    updateServicesData();
    
    document.querySelectorAll('.service-item').forEach((item, index) => {
      const numberDiv = item.querySelector('.service-number');
      if (numberDiv) {
        numberDiv.textContent = `Servicio ${index + 1}`;
      }
    });
  }
}

function updateServicesData() {
  const services = [];
  document.querySelectorAll('.service-item').forEach(item => {
    const title = item.querySelector('.service-title').value;
    const editorContent = item.querySelector('.service-editor-content');
    const description = editorContent ? editorContent.innerHTML : '';
    const priceType = item.querySelector('.price-type-option.active').dataset.type;
    
    let price, originalPrice, promoPrice;
    
    if (priceType === 'promotion') {
      originalPrice = parseFloat(item.querySelector('.service-original-price').value) || 0;
      promoPrice = parseFloat(item.querySelector('.service-promo-price').value) || 0;
    } else {
      price = parseFloat(item.querySelector('.service-price').value) || 0;
    }
    
    if (title) {
      services.push({
        title,
        description,
        priceType,
        price: priceType === 'normal' ? price : null,
        originalPrice: priceType === 'promotion' ? originalPrice : null,
        promoPrice: priceType === 'promotion' ? promoPrice : null
      });
    }
  });
  agentData.config.services = services;
}

// ============================================
// WORKERS MANAGEMENT
// ============================================
function initializeWorkers() {
  const addWorkerBtn = document.getElementById('addWorkerBtn');
  
  if (addWorkerBtn) {
    addWorkerBtn.addEventListener('click', addWorker);
  }
}

function addWorker() {
  const workersList = document.getElementById('workersList');
  if (!workersList) return;
  
  const workerId = Date.now();
  const workerNumber = document.querySelectorAll('.worker-item').length + 1;
  const workerItem = document.createElement('div');
  workerItem.className = 'worker-item';
  workerItem.dataset.workerId = workerId;
  
  workerItem.innerHTML = `
    <div class="worker-header">
      <div class="worker-number">Trabajador ${workerNumber}</div>
      <button type="button" class="btn-remove-worker" onclick="removeWorker(${workerId})">
        <i class="lni lni-trash-can"></i>
      </button>
    </div>
    <div class="worker-fields">
      <div class="form-group">
        <label class="form-label">Nombre del Trabajador *</label>
        <input type="text" class="form-input worker-name" placeholder="Ej: Juan Pérez" required>
      </div>
      
      <div class="worker-availability">
        <div class="availability-title">Disponibilidad (Días de la Semana)</div>
        <div class="availability-grid">
          <label class="availability-day">
            <input type="checkbox" value="monday" checked>
            <span>Lunes</span>
          </label>
          <label class="availability-day">
            <input type="checkbox" value="tuesday" checked>
            <span>Martes</span>
          </label>
          <label class="availability-day">
            <input type="checkbox" value="wednesday" checked>
            <span>Miércoles</span>
          </label>
          <label class="availability-day">
            <input type="checkbox" value="thursday" checked>
            <span>Jueves</span>
          </label>
          <label class="availability-day">
            <input type="checkbox" value="friday" checked>
            <span>Viernes</span>
          </label>
          <label class="availability-day">
            <input type="checkbox" value="saturday">
            <span>Sábado</span>
          </label>
          <label class="availability-day">
            <input type="checkbox" value="sunday">
            <span>Domingo</span>
          </label>
        </div>
      </div>
      
      <div class="worker-hours">
        <div class="form-group">
          <label class="form-label">Hora de Inicio</label>
          <input type="time" class="form-input worker-start-time" value="09:00" required>
        </div>
        <div class="form-group">
          <label class="form-label">Hora de Fin</label>
          <input type="time" class="form-input worker-end-time" value="18:00" required>
        </div>
      </div>
    </div>
  `;
  
  workersList.appendChild(workerItem);
  
  workerItem.querySelectorAll('input').forEach(input => {
    input.addEventListener('input', updateWorkersData);
    input.addEventListener('change', updateWorkersData);
  });
}

function removeWorker(workerId) {
  const workerItem = document.querySelector(`[data-worker-id="${workerId}"]`);
  if (workerItem) {
    workerItem.remove();
    updateWorkersData();
    
    document.querySelectorAll('.worker-item').forEach((item, index) => {
      const numberDiv = item.querySelector('.worker-number');
      if (numberDiv) {
        numberDiv.textContent = `Trabajador ${index + 1}`;
      }
    });
  }
}

function updateWorkersData() {
  const workers = [];
  document.querySelectorAll('.worker-item').forEach(item => {
    const name = item.querySelector('.worker-name').value;
    const startTime = item.querySelector('.worker-start-time').value;
    const endTime = item.querySelector('.worker-end-time').value;
    
    const days = [];
    item.querySelectorAll('.availability-day input:checked').forEach(checkbox => {
      days.push(checkbox.value);
    });
    
    if (name && startTime && endTime) {
      workers.push({
        name,
        startTime,
        endTime,
        days
      });
    }
  });
  agentData.config.workers = workers;
}

// ============================================
// LOCATION DROPDOWNS
// ============================================
function initializeLocationDropdowns() {
  createLocationDropdown('countryInput', COUNTRIES, 'Selecciona un país');
  createLocationDropdown('stateInput', STATES_MEXICO.map(s => ({ 
    value: s.toLowerCase().replace(/\s+/g, '-'), 
    name: s 
  })), 'Selecciona un estado');
  createLocationDropdown('cityInput', CITIES_MEXICO.default.map(c => ({ 
    value: c.toLowerCase().replace(/\s+/g, '-'), 
    name: c 
  })), 'Selecciona una ciudad');
}

function createLocationDropdown(inputId, options, placeholder) {
  const input = document.getElementById(inputId);
  if (!input) return;

  const wrapper = document.createElement('div');
  wrapper.className = 'location-dropdown-wrapper';
  
  const displayInput = document.createElement('input');
  displayInput.type = 'text';
  displayInput.className = 'form-input location-select';
  displayInput.placeholder = placeholder;
  displayInput.readOnly = true;
  
  const arrow = document.createElement('i');
  arrow.className = 'lni lni-chevron-down location-arrow';
  
  const dropdown = document.createElement('div');
  dropdown.className = 'location-dropdown';
  
  const searchContainer = document.createElement('div');
  searchContainer.className = 'location-search-container';
  searchContainer.innerHTML = `
    <i class="lni lni-search-alt location-search-icon"></i>
    <input type="text" class="location-search" placeholder="Buscar..." autocomplete="off">
  `;
  
  const optionsContainer = document.createElement('div');
  optionsContainer.className = 'location-options-container';
  
  options.forEach(opt => {
    const option = document.createElement('div');
    option.className = 'location-option';
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
  
  const searchInput = searchContainer.querySelector('.location-search');
  const selectOptions = optionsContainer.querySelectorAll('.location-option');
  
  displayInput.addEventListener('click', function(e) {
    e.stopPropagation();
    toggleLocationDropdown(wrapper, searchInput, selectOptions);
  });
  
  searchInput.addEventListener('input', function() {
    filterLocationOptions(this.value, selectOptions);
  });
  
  searchInput.addEventListener('click', function(e) {
    e.stopPropagation();
  });
  
  selectOptions.forEach(option => {
    option.addEventListener('click', function(e) {
      e.stopPropagation();
      selectLocationOption(this, displayInput, input, wrapper, selectOptions, inputId);
    });
  });
  
  document.addEventListener('click', function(e) {
    if (!wrapper.contains(e.target)) {
      closeLocationDropdown(wrapper);
    }
  });
}

function toggleLocationDropdown(wrapper, searchInput, options) {
  const isActive = wrapper.classList.contains('active');
  
  document.querySelectorAll('.location-dropdown-wrapper.active').forEach(w => {
    if (w !== wrapper) w.classList.remove('active');
  });
  
  if (isActive) {
    closeLocationDropdown(wrapper);
  } else {
    wrapper.classList.add('active');
    setTimeout(() => searchInput.focus(), 100);
    searchInput.value = '';
    options.forEach(opt => opt.classList.remove('hidden'));
  }
}

function closeLocationDropdown(wrapper) {
  wrapper.classList.remove('active');
  const searchInput = wrapper.querySelector('.location-search');
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

function selectLocationOption(option, displayInput, hiddenInput, wrapper, allOptions, inputId) {
  const value = option.getAttribute('data-value');
  const text = option.querySelector('span')?.textContent;
  
  displayInput.value = text;
  hiddenInput.value = text;
  hiddenInput.setAttribute('data-value', value);
  
  allOptions.forEach(opt => opt.classList.remove('selected'));
  option.classList.add('selected');
  
  // Update agentData
  if (inputId === 'countryInput') {
    agentData.location.country = text;
  } else if (inputId === 'stateInput') {
    agentData.location.state = text;
  } else if (inputId === 'cityInput') {
    agentData.location.city = text;
  }
  
  closeLocationDropdown(wrapper);
}

// ============================================
// SOCIAL MEDIA INPUTS
// ============================================
function initializeSocialMediaInputs() {
  const socialInputs = {
    'facebookInput': 'facebook',
    'instagramInput': 'instagram',
    'twitterInput': 'twitter',
    'linkedinInput': 'linkedin'
  };
  
  Object.keys(socialInputs).forEach(inputId => {
    const input = document.getElementById(inputId);
    if (input) {
      input.addEventListener('input', function() {
        agentData.social_media[socialInputs[inputId]] = this.value;
      });
    }
  });
  
  // Location text inputs
  const locationInputs = {
    'addressInput': 'address',
    'postalCodeInput': 'postalCode',
    'betweenStreetsInput': 'betweenStreets',
    'numberInput': 'number',
    'neighborhoodInput': 'neighborhood'
  };
  
  Object.keys(locationInputs).forEach(inputId => {
    const input = document.getElementById(inputId);
    if (input) {
      input.addEventListener('input', function() {
        agentData.location[locationInputs[inputId]] = this.value;
      });
    }
  });
}

// ============================================
// NAVIGATION
// ============================================
function initializeNavigationButtons() {
  const btnStep1 = document.getElementById('btnStep1');
  if (btnStep1) {
    btnStep1.addEventListener('click', () => nextStep());
  }
  
  const btnStep2Unified = document.getElementById('btnStep2Unified');
  if (btnStep2Unified) {
    btnStep2Unified.addEventListener('click', () => nextStep());
  }
  
  const btnBackStep3 = document.getElementById('btnBackStep3');
  if (btnBackStep3) {
    btnBackStep3.addEventListener('click', () => previousStep());
  }
  
  const btnCreateAgent = document.getElementById('btnCreateAgent');
  if (btnCreateAgent) {
    console.log('✅ Botón Crear Agente encontrado, agregando event listener');
    btnCreateAgent.addEventListener('click', () => {
      console.log('🔘 Click en botón Crear Agente');
      createAgent();
    });
  } else {
    console.warn('⚠️ Botón Crear Agente no encontrado en initializeNavigationButtons');
  }
  
  const btnGoToDashboard = document.getElementById('btnGoToDashboard');
  if (btnGoToDashboard) {
    btnGoToDashboard.addEventListener('click', function() {
      window.location.href = '/dashboard';
    });
  }
}

function nextStep() {
  if (currentStep === 1 && !selectedSocial) {
    alert('Por favor selecciona una red social');
    return;
  }

  if (currentStep === 2) {
    if (!validateStep2()) {
      return;
    }
    collectFormData();
  }

  if (currentStep === 3) {
    return;
  }

  currentStep++;
  updateStepDisplay();
  updateProgressBar();

  if (currentStep === 3) {
    generateSummary();
  }
}

function previousStep() {
  if (currentStep === 1) return;

  currentStep--;
  updateStepDisplay();
  updateProgressBar();
}

function validateStep2() {
  const agentName = document.getElementById('agentName').value.trim();

  if (!agentName) {
    alert('Por favor ingresa el nombre del agente');
    document.getElementById('agentName').focus();
    return false;
  }

  const useDifferentPhone = document.getElementById('phoneToggle').checked;
  if (useDifferentPhone) {
    const phoneNumber = document.getElementById('phoneNumber').value.trim();
    if (!phoneNumber) {
      alert('Por favor ingresa el número de teléfono');
      document.getElementById('phoneNumber').focus();
      return false;
    }
  }

  return true;
}

function updateStepDisplay() {
  document.querySelectorAll('.step').forEach(step => {
    step.classList.remove('active');
  });
  document.getElementById(`step${currentStep}`).classList.add('active');
  window.scrollTo(0, 0);
}

function updateProgressBar() {
  const progressSteps = document.querySelectorAll('.progress-step');
  const progressPercentage = document.getElementById('progressPercentage');
  const totalSteps = 3; // Paso 1, 2, 3
  const totalCircles = progressSteps.length; // 10 círculos
  
  // Calcular cuántos círculos deben estar iluminados según el paso actual
  const circlesPerStep = totalCircles / totalSteps;
  const targetCircles = Math.ceil((currentStep - 1) * circlesPerStep) + 1;
  
  // Primero, remover todas las clases
  progressSteps.forEach((step, index) => {
    step.classList.remove('active', 'completed', 'cascading');
  });
  
  // Aplicar clases según el progreso
  progressSteps.forEach((step, index) => {
    if (index < targetCircles - 1) {
      // Círculos completados
      step.classList.add('completed');
    } else if (index === targetCircles - 1) {
      // Círculo activo con brillo
      step.classList.add('active');
    }
  });
  
  // Efecto cascada: animar desde el primer círculo nuevo hasta el target
  const previousCircles = Math.ceil(((currentStep - 2) * circlesPerStep)) + 1;
  const startCascade = Math.max(0, previousCircles);
  
  for (let i = startCascade; i < targetCircles; i++) {
    setTimeout(() => {
      if (progressSteps[i]) {
        progressSteps[i].classList.add('cascading');
        // Después de la animación, marcar como completado
        setTimeout(() => {
          progressSteps[i].classList.remove('cascading');
          if (i < targetCircles - 1) {
            progressSteps[i].classList.add('completed');
          } else {
            progressSteps[i].classList.add('active');
          }
        }, 600);
      }
    }, i * 80); // Delay incremental para efecto dominó
  }

  // Update percentage
  const targetProgress = ((currentStep - 1) / 2) * 100;
  
  if (progressPercentage) {
    const currentProgress = parseInt(progressPercentage.textContent) || 0;
    animatePercentage(currentProgress, targetProgress, progressPercentage);
  }
}

function animatePercentage(start, end, element) {
  const duration = 600;
  const startTime = performance.now();
  
  function update(currentTime) {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);
    
    const easeOutCubic = 1 - Math.pow(1 - progress, 3);
    const current = Math.round(start + (end - start) * easeOutCubic);
    
    element.textContent = current + '%';
    
    if (progress < 1) {
      requestAnimationFrame(update);
    }
  }
  
  requestAnimationFrame(update);
}

function collectFormData() {
  agentData.name = document.getElementById('agentName').value;

  const useDifferentPhone = document.getElementById('phoneToggle').checked;
  if (useDifferentPhone) {
    const countryCode = document.getElementById('countryCode').value;
    const phoneNumber = document.getElementById('phoneNumber').value;
    agentData.phoneNumber = countryCode + phoneNumber;
  } else {
    agentData.phoneNumber = '';
  }

  const tone = document.querySelector('input[name="tone"]:checked');
  if (tone) {
    agentData.config.tone = tone.value;
    if (tone.value === 'custom') {
      const editorContent = document.getElementById('editorContent');
      if (editorContent) {
        agentData.config.customTone = editorContent.innerHTML;
      }
    }
  }
}

function generateSummary() {
  const container = document.getElementById('summaryContainer');
  if (!container) return;
  
  const socialNames = {
    whatsapp: 'WhatsApp',
    facebook: 'Facebook Messenger',
    instagram: 'Instagram',
    telegram: 'Telegram',
    wechat: 'WeChat',
    kakaotalk: 'KakaoTalk',
    line: 'Line'
  };

  const businessTypeNames = {
    'clinica-dental': 'Clínica Dental',
    'peluqueria': 'Peluquería / Salón de Belleza',
    'restaurante': 'Restaurante',
    'pizzeria': 'Pizzería',
    'escuela': 'Escuela / Educación',
    'gym': 'Gimnasio / Fitness',
    'spa': 'Spa / Wellness',
    'consultorio': 'Consultorio Médico',
    'veterinaria': 'Veterinaria',
    'hotel': 'Hotel / Hospedaje',
    'tienda': 'Tienda / Retail',
    'agencia': 'Agencia / Servicios',
    'otro': 'Otro'
  };
  
  let html = `
    <div class="summary-section">
      <h3 class="summary-section-title">
        <i class="lni lni-network"></i>
        Red Social
      </h3>
      <div class="summary-item">
        <span class="summary-label">Plataforma:</span>
        <span class="summary-value">${socialNames[agentData.social]}</span>
      </div>
    </div>
    
    <div class="summary-section">
      <h3 class="summary-section-title">
        <i class="lni lni-information"></i>
        Información Básica
      </h3>
      <div class="summary-item">
        <span class="summary-label">Nombre del Agente:</span>
        <span class="summary-value">${agentData.name}</span>
      </div>
      <div class="summary-item">
        <span class="summary-label">Tipo de Negocio:</span>
        <span class="summary-value">${businessTypeNames[agentData.businessType] || agentData.businessType}</span>
      </div>
      <div class="summary-item">
        <span class="summary-label">Número de Teléfono:</span>
        <span class="summary-value">${agentData.phoneNumber || 'Usar número registrado'}</span>
      </div>
      ${agentData.config.additionalLanguages.length > 0 ? `
      <div class="summary-item">
        <span class="summary-label">Idiomas Adicionales:</span>
        <span class="summary-value">${agentData.config.additionalLanguages.join(', ')}</span>
      </div>
      ` : ''}
    </div>
    
    <div class="summary-section">
      <h3 class="summary-section-title">
        <i class="lni lni-comments"></i>
        Personalidad
      </h3>
      <div class="summary-item">
        <span class="summary-label">Tono:</span>
        <span class="summary-value">${formatTone(agentData.config.tone)}</span>
      </div>
    </div>
  `;
  
  const openDays = Object.keys(agentData.config.schedule).filter(day => agentData.config.schedule[day].open);
  if (openDays.length > 0) {
    html += `
      <div class="summary-section">
        <h3 class="summary-section-title">
          <i class="lni lni-calendar"></i>
          Horario de Atención
        </h3>
        <ul class="summary-list">
          ${openDays.map(day => {
            const dayData = agentData.config.schedule[day];
            return `<li>${formatDay(day)}: ${dayData.start} - ${dayData.end}</li>`;
          }).join('')}
        </ul>
      </div>
    `;
  }
  
  if (agentData.config.holidays.length > 0) {
    html += `
      <div class="summary-section">
        <h3 class="summary-section-title">
          <i class="lni lni-gift"></i>
          Días Festivos
        </h3>
        <ul class="summary-list">
          ${agentData.config.holidays.map(h => `<li>${h.date} - ${h.name}</li>`).join('')}
        </ul>
      </div>
    `;
  }
  
  if (agentData.config.services.length > 0) {
    html += `
      <div class="summary-section">
        <h3 class="summary-section-title">
          <i class="lni lni-package"></i>
          Servicios
        </h3>
        <ul class="summary-list">
          ${agentData.config.services.map(s => {
            let priceText = '';
            if (s.priceType === 'promotion') {
              priceText = `$${s.promoPrice} (antes $${s.originalPrice})`;
            } else {
              priceText = `$${s.price}`;
            }
            return `<li><strong>${s.title}</strong> - ${priceText}</li>`;
          }).join('')}
        </ul>
      </div>
    `;
  }
  
  // Location summary
  if (agentData.location.address || agentData.location.city) {
    html += `
      <div class="summary-section">
        <h3 class="summary-section-title">
          <i class="lni lni-map-marker"></i>
          Ubicación
        </h3>
        ${agentData.location.address ? `
        <div class="summary-item">
          <span class="summary-label">Dirección:</span>
          <span class="summary-value">${agentData.location.address}</span>
        </div>
        ` : ''}
        ${agentData.location.number ? `
        <div class="summary-item">
          <span class="summary-label">Número:</span>
          <span class="summary-value">${agentData.location.number}</span>
        </div>
        ` : ''}
        ${agentData.location.neighborhood ? `
        <div class="summary-item">
          <span class="summary-label">Colonia:</span>
          <span class="summary-value">${agentData.location.neighborhood}</span>
        </div>
        ` : ''}
        ${agentData.location.city ? `
        <div class="summary-item">
          <span class="summary-label">Ciudad:</span>
          <span class="summary-value">${agentData.location.city}</span>
        </div>
        ` : ''}
        ${agentData.location.state ? `
        <div class="summary-item">
          <span class="summary-label">Estado:</span>
          <span class="summary-value">${agentData.location.state}</span>
        </div>
        ` : ''}
        ${agentData.location.country ? `
        <div class="summary-item">
          <span class="summary-label">País:</span>
          <span class="summary-value">${agentData.location.country}</span>
        </div>
        ` : ''}
        ${agentData.location.postalCode ? `
        <div class="summary-item">
          <span class="summary-label">Código Postal:</span>
          <span class="summary-value">${agentData.location.postalCode}</span>
        </div>
        ` : ''}
      </div>
    `;
  }
  
  // Social media summary
  if (agentData.social_media.facebook || agentData.social_media.instagram || agentData.social_media.twitter || agentData.social_media.linkedin) {
    html += `
      <div class="summary-section">
        <h3 class="summary-section-title">
          <i class="lni lni-share-alt"></i>
          Redes Sociales
        </h3>
        ${agentData.social_media.facebook ? `
        <div class="summary-item">
          <span class="summary-label">Facebook:</span>
          <span class="summary-value">${agentData.social_media.facebook}</span>
        </div>
        ` : ''}
        ${agentData.social_media.instagram ? `
        <div class="summary-item">
          <span class="summary-label">Instagram:</span>
          <span class="summary-value">${agentData.social_media.instagram}</span>
        </div>
        ` : ''}
        ${agentData.social_media.twitter ? `
        <div class="summary-item">
          <span class="summary-label">Twitter / X:</span>
          <span class="summary-value">${agentData.social_media.twitter}</span>
        </div>
        ` : ''}
        ${agentData.social_media.linkedin ? `
        <div class="summary-item">
          <span class="summary-label">LinkedIn:</span>
          <span class="summary-value">${agentData.social_media.linkedin}</span>
        </div>
        ` : ''}
      </div>
    `;
  }
  
  if (agentData.config.workers.length > 0) {
    html += `
      <div class="summary-section">
        <h3 class="summary-section-title">
          <i class="lni lni-users"></i>
          Trabajadores
        </h3>
        <ul class="summary-list">
          ${agentData.config.workers.map(w => {
            return `<li><strong>${w.name}</strong> - ${w.startTime} a ${w.endTime} (${w.days.length} días)</li>`;
          }).join('')}
        </ul>
      </div>
    `;
  }
  
  container.innerHTML = html;
}

function formatTone(tone) {
  const toneNames = {
    'formal': 'Formal',
    'friendly': 'Amigable',
    'casual': 'Casual',
    'custom': 'Personalizado'
  };
  return toneNames[tone] || tone;
}

function formatDay(day) {
  const dayNames = {
    'monday': 'Lunes',
    'tuesday': 'Martes',
    'wednesday': 'Miércoles',
    'thursday': 'Jueves',
    'friday': 'Viernes',
    'saturday': 'Sábado',
    'sunday': 'Domingo'
  };
  return dayNames[day] || day;
}

// ============================================
// ENSURE MODALS EXIST
// ============================================
function ensureModalsExist() {
  // Verificar si ya existen los modales
  if (document.getElementById('creatingModal') && document.getElementById('successModal')) {
    return;
  }
  
  // Crear el modal de creación si no existe
  if (!document.getElementById('creatingModal')) {
    const creatingModal = document.createElement('div');
    creatingModal.id = 'creatingModal';
    creatingModal.className = 'overlay creating-modal';
    creatingModal.innerHTML = `
      <div class="creating-content">
        <div class="creating-icon-wrapper">
          <div class="creating-icon robot-icon">
            <i class="lni lni-bot"></i>
          </div>
          <div class="pulse-ring"></div>
          <div class="pulse-ring"></div>
          <div class="pulse-ring"></div>
        </div>

        <h2 class="creating-title">Creando tu Agente</h2>
        <p class="creating-subtitle">
          Configurando infraestructura y desplegando el bot
        </p>

        <div class="agent-info">
          <div class="agent-info-label">Agente</div>
          <div class="agent-info-value" id="agentNameDisplay">Mi Agente</div>
        </div>

        <div class="status-info">
          <div class="current-status">
            <i class="lni lni-cog status-icon" id="currentStatusIcon"></i>
            <span class="status-text" id="currentStatusText">Iniciando creación...</span>
          </div>

          <div class="status-steps" id="statusStepsContainer">
            <div class="status-step active">
              <div class="status-step-indicator"></div>
              <div class="status-step-text">
                <i class="lni lni-apartment"></i> Creando infraestructura
              </div>
            </div>
            <div class="status-step">
              <div class="status-step-indicator"></div>
              <div class="status-step-text">
                <i class="lni lni-cog"></i> Inicializando sistema
              </div>
            </div>
            <div class="status-step">
              <div class="status-step-indicator"></div>
              <div class="status-step-text">
                <i class="lni lni-bot"></i> Desplegando bot
              </div>
            </div>
            <div class="status-step">
              <div class="status-step-indicator"></div>
              <div class="status-step-text">
                <i class="lni lni-checkmark"></i> Completado
              </div>
            </div>
          </div>
        </div>

        <div class="progress-section">
          <div class="progress-bar-bg">
            <div class="progress-bar-fill" id="creationProgressBar"></div>
          </div>

          <div class="time-info">
            <div class="time-item">
              <div class="time-label">Transcurrido</div>
              <div class="time-value" id="timeElapsed">0:00</div>
            </div>
            <div class="time-item">
              <div class="time-label">Estimado</div>
              <div class="time-value" id="timeRemaining">~15:00</div>
            </div>
          </div>
        </div>

        <div class="creating-note">
          <div class="creating-note-icon">
            <i class="lni lni-information"></i>
          </div>
          <p class="creating-note-text">
            Este proceso toma entre 10 y 20 minutos. Estamos configurando tu
            infraestructura en la nube y desplegando tu bot personalizado.
          </p>
        </div>
      </div>
    `;
    document.body.appendChild(creatingModal);
  }
  
  // Crear el modal de éxito si no existe
  if (!document.getElementById('successModal')) {
    const successModal = document.createElement('div');
    successModal.id = 'successModal';
    successModal.className = 'overlay creating-modal';
    successModal.innerHTML = `
      <div class="creating-content success-modal-content">
        <div class="success-icon-large">
          <i class="lni lni-checkmark-circle" style="color: #10b981"></i>
        </div>
        <h2 class="success-title">¡Agente Creado Exitosamente!</h2>
        <p class="success-subtitle">Tu agente de IA está listo y operativo</p>

        <div class="agent-details-box">
          <div class="agent-detail-item">
            <span class="agent-detail-label">Nombre:</span>
            <span class="agent-detail-value" id="finalAgentName">Mi Agente</span>
          </div>
          <div class="agent-detail-item">
            <span class="agent-detail-label">Servidor:</span>
            <span class="agent-detail-value" id="finalAgentIP">Configurado</span>
          </div>
          <div class="agent-detail-item">
            <span class="agent-detail-label">Estado:</span>
            <span class="agent-detail-value" style="color: #10b981">
              <i class="lni lni-circle-fill" style="font-size: 8px"></i> Activo
            </span>
          </div>
        </div>

        <button
          type="button"
          id="btnGoToDashboard"
          class="btn btn-next"
          style="width: 100%; justify-content: center"
        >
          <i class="lni lni-dashboard"></i>
          <span>Ir al Dashboard</span>
        </button>

        <div class="creating-note" style="margin-top: 20px">
          <div class="creating-note-icon"><i class="lni lni-bulb"></i></div>
          <p class="creating-note-text">
            Configura las credenciales de Meta WhatsApp API en el dashboard para
            comenzar a usar tu agente.
          </p>
        </div>
      </div>
    `;
    document.body.appendChild(successModal);
    
    // Agregar event listener al botón "Ir al Dashboard"
    setTimeout(() => {
      const btnGoToDashboard = document.getElementById('btnGoToDashboard');
      if (btnGoToDashboard) {
        btnGoToDashboard.addEventListener('click', function() {
          // Si ya estamos en el dashboard, recargar la página
          // Si no, redirigir al dashboard
          if (window.location.pathname === '/dashboard') {
            window.location.reload();
          } else {
            window.location.href = '/dashboard';
          }
        });
      }
    }, 100);
  }
}

// ============================================
// CREATE AGENT
// ============================================
async function createAgent() {
  console.log('🚀 Iniciando creación de agente...');
  
  // Cerrar el modal del onboarding si existe (cuando se abre desde el dashboard)
  const onboardingModal = document.getElementById('onboardingModal');
  if (onboardingModal && typeof closeOnboardingModal === 'function') {
    console.log('🔒 Cerrando modal del onboarding...');
    closeOnboardingModal();
  }
  
  // Asegurar que los modales existen
  ensureModalsExist();
  
  const creatingModal = document.getElementById('creatingModal');
  if (!creatingModal) {
    console.error('❌ Modal de creación no encontrado');
    alert('Error: No se pudo mostrar el modal de creación');
    return;
  }
  
  console.log('✅ Mostrando modal de creación...');
  creatingModal.classList.add('show');
  
  let elapsedSeconds = 0;
  const maxSeconds = 1200;
  
  const timerInterval = setInterval(() => {
    elapsedSeconds++;
    updateTimer(elapsedSeconds, maxSeconds);
  }, 1000);

  try {
    console.log('📤 Enviando petición de creación de agente...');
    console.log('Datos del agente:', {
      name: agentData.name,
      phoneNumber: agentData.phoneNumber,
      businessType: agentData.businessType
    });
    
    const response = await fetch('/api/agents', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({
        name: agentData.name,
        phoneNumber: agentData.phoneNumber,
        businessType: agentData.businessType,
        metaDocument: '',
        config: agentData.config
      }),
    });

    const data = await response.json();
    console.log('📥 Respuesta recibida:', data);

    if (response.status === 202) {
      const agentId = data.agent.id;
      console.log('✅ Agente creado con ID:', agentId);
      
      const agentNameDisplay = document.getElementById('agentNameDisplay');
      if (agentNameDisplay) {
        agentNameDisplay.textContent = data.agent.name;
      }
      
      const checkInterval = setInterval(async () => {
        try {
          console.log('🔍 Verificando estado del agente...');
          const statusResp = await fetch(`/api/agents/${agentId}`, {
            credentials: 'include'
          });
          
          if (!statusResp.ok) {
            console.error('❌ Error al verificar estado:', statusResp.status);
            return;
          }
          
          const statusData = await statusResp.json();
          console.log('📊 Estado actual:', statusData.agent.deployStatus);
          
          updateCreationStatus(statusData.agent.deployStatus);
          
          if (statusData.agent.deployStatus === 'running') {
            console.log('🎉 ¡Agente completado exitosamente!');
            clearInterval(checkInterval);
            clearInterval(timerInterval);
            
            creatingModal.classList.remove('show');
            
            const successModal = document.getElementById('successModal');
            if (successModal) {
              successModal.classList.add('show');
              
              const finalAgentName = document.getElementById('finalAgentName');
              if (finalAgentName) {
                finalAgentName.textContent = statusData.agent.name;
              }
              
              try {
                const userResp = await fetch('/api/me', { credentials: 'include' });
                const userData = await userResp.json();
                const finalAgentIP = document.getElementById('finalAgentIP');
                if (finalAgentIP) {
                  finalAgentIP.textContent = userData.user.sharedServerIp || 'N/A';
                }
              } catch (error) {
                console.error('Error obteniendo información del usuario:', error);
              }
            } else {
              console.error('❌ Modal de éxito no encontrado');
            }
            
          } else if (statusData.agent.deployStatus === 'error') {
            console.error('❌ Error en el despliegue del agente');
            clearInterval(checkInterval);
            clearInterval(timerInterval);
            
            creatingModal.classList.remove('show');
            alert('Error al crear el agente. Por favor contacta a soporte.');
          }
        } catch (error) {
          console.error('❌ Error verificando estado:', error);
        }
      }, 5000);
      
    } else {
      clearInterval(timerInterval);
      throw new Error(data.error || 'Error al crear agente');
    }
    
  } catch (error) {
    clearInterval(timerInterval);
    console.error('❌ Error:', error);
    creatingModal.classList.remove('show');
    alert('Error al crear el agente. Por favor intenta de nuevo.');
  }
}

function updateTimer(elapsed, max) {
  const minutes = Math.floor(elapsed / 60);
  const seconds = elapsed % 60;
  const percentage = (elapsed / max) * 100;
  
  const timeElapsedEl = document.getElementById('timeElapsed');
  if (timeElapsedEl) {
    timeElapsedEl.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }
  
  const estimatedMinutes = Math.floor((max - elapsed) / 60);
  const estimatedSeconds = (max - elapsed) % 60;
  const timeRemainingEl = document.getElementById('timeRemaining');
  if (timeRemainingEl) {
    timeRemainingEl.textContent = `~${estimatedMinutes}:${estimatedSeconds.toString().padStart(2, '0')}`;
  }
  
  const progressBar = document.getElementById('creationProgressBar');
  if (progressBar) {
    progressBar.style.width = Math.min(percentage, 100) + '%';
  }
}

function updateCreationStatus(status) {
  const statusMessages = {
    'pending': {
      text: 'Preparando creación...',
      icon: 'lni-hourglass',
      step: 0
    },
    'creating': {
      text: 'Creando infraestructura...',
      icon: 'lni-apartment',
      step: 1
    },
    'provisioning': {
      text: 'Inicializando sistema operativo...',
      icon: 'lni-cog',
      step: 2
    },
    'initializing': {
      text: 'Instalando dependencias...',
      icon: 'lni-package',
      step: 2
    },
    'deploying': {
      text: 'Desplegando y configurando bot...',
      icon: 'lni-bot',
      step: 3
    },
    'running': {
      text: '¡Agente listo y funcionando!',
      icon: 'lni-checkmark-circle',
      step: 4
    },
    'error': {
      text: 'Error en la creación',
      icon: 'lni-cross-circle',
      step: 0
    }
  };
  
  const statusInfo = statusMessages[status] || statusMessages['pending'];
  
  const statusTextEl = document.getElementById('currentStatusText');
  if (statusTextEl) {
    statusTextEl.textContent = statusInfo.text;
  }
  
  const iconElement = document.getElementById('currentStatusIcon');
  if (iconElement) {
    iconElement.className = `lni ${statusInfo.icon} status-icon`;
  }
  
  updateStatusSteps(statusInfo.step);
}

function updateStatusSteps(currentStep) {
  const steps = [
    { icon: 'lni-apartment', text: 'Creando infraestructura' },
    { icon: 'lni-cog', text: 'Inicializando sistema' },
    { icon: 'lni-bot', text: 'Desplegando bot' },
    { icon: 'lni-checkmark', text: 'Completado' }
  ];
  
  const container = document.getElementById('statusStepsContainer');
  if (!container) return;
  
  container.innerHTML = '';
  
  steps.forEach((step, index) => {
    const stepDiv = document.createElement('div');
    stepDiv.className = 'status-step';
    
    if (index + 1 < currentStep) {
      stepDiv.classList.add('completed');
    } else if (index + 1 === currentStep) {
      stepDiv.classList.add('active');
    }
    
    stepDiv.innerHTML = `
      <div class="status-step-indicator"></div>
      <div class="status-step-text"><i class="${step.icon}"></i> ${step.text}</div>
    `;
    
    container.appendChild(stepDiv);
  });
}