// State Management
let currentStep = 1;
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
  }
};

// Initialize
document.addEventListener('DOMContentLoaded', function() {
  fetchUserData();
  initializeSocialSelection();
  initializeNavigationButtons();
  initializeToneSelection();
  initializeLanguageSelection();
  initializeRichEditor();
  initializePhoneToggle();
  initializeSchedule();
  initializeHolidays();
  initializeServices();
  initializeWorkers();
});

// Fetch User Data
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

// Social Network Selection
function initializeSocialSelection() {
  const socialInputs = document.querySelectorAll('input[name="social"]');
  const btnStep1 = document.getElementById('btnStep1');

  socialInputs.forEach(input => {
    input.addEventListener('change', function() {
      selectedSocial = this.value;
      agentData.social = this.value;
      btnStep1.disabled = false;
      console.log('Red social seleccionada:', selectedSocial);
    });
  });
}

// Phone Toggle
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

// Tone Selection
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

// Language Selection
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
      console.log('Idiomas adicionales seleccionados:', agentData.config.additionalLanguages);
    });
  });
}

// Rich Text Editor
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

// Schedule Management
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

// Holidays Management
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
  console.log('Días festivos:', holidays);
}

// Services Management
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
  
  // Inicializar editor de texto enriquecido
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
  
  // Price type selector
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
  
  // Update data on input
  serviceItem.querySelectorAll('input, textarea').forEach(input => {
    input.addEventListener('input', updateServicesData);
  });
}

function removeService(serviceId) {
  const serviceItem = document.querySelector(`[data-service-id="${serviceId}"]`);
  if (serviceItem) {
    serviceItem.remove();
    updateServicesData();
    
    // Renumber services
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
  console.log('Servicios:', services);
}

// Workers Management
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
  
  // Update data on input
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
    
    // Renumber workers
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
  console.log('Trabajadores:', workers);
}

// Navigation
function initializeNavigationButtons() {
  document.getElementById('btnStep1').addEventListener('click', () => nextStep());
  document.getElementById('btnBackStep2').addEventListener('click', () => previousStep());
  document.getElementById('btnStep2').addEventListener('click', () => nextStep());
  document.getElementById('btnBackStep3').addEventListener('click', () => previousStep());
  document.getElementById('btnCreateAgent').addEventListener('click', () => createAgent());
  
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
  const progressFill = document.getElementById('progressFill');
  const progressBarFill = document.getElementById('progressBarFill');
  const progressPercentage = document.getElementById('progressPercentage');

  progressSteps.forEach((step, index) => {
    step.classList.remove('active', 'completed');
    if (index + 1 < currentStep) {
      step.classList.add('completed');
    } else if (index + 1 === currentStep) {
      step.classList.add('active');
    }
  });

  // Calcular progreso (0%, 50%, 100%)
  const targetProgress = ((currentStep - 1) / 2) * 100;
  
  // Actualizar barra de progreso tradicional (oculta)
  if (progressFill) {
    progressFill.style.width = targetProgress + '%';
  }
  
  // Actualizar nueva barra de progreso moderna
  if (progressBarFill) {
    progressBarFill.style.width = targetProgress + '%';
  }
  
  // Animar porcentaje con conteo
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
    
    // Easing function para animación suave
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
    agentData.phoneNumber = ''; // Will use user's registered phone
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

  // Languages are already updated in real-time
  // Schedule is already updated in real-time
  // Holidays are already updated in real-time
  // Services are already updated in real-time
  // Workers are already updated in real-time
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
  
  // Schedule summary
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
  
  // Holidays summary
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
  
  // Services summary
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
  
  // Workers summary
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

async function createAgent() {
  document.getElementById('creatingModal').classList.add('show');
  
  let elapsedSeconds = 0;
  const maxSeconds = 1200;
  
  const timerInterval = setInterval(() => {
    elapsedSeconds++;
    updateTimer(elapsedSeconds, maxSeconds);
  }, 1000);

  try {
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

    if (response.status === 202) {
      const agentId = data.agent.id;
      
      document.getElementById('agentNameDisplay').textContent = data.agent.name;
      
      const checkInterval = setInterval(async () => {
        try {
          const statusResp = await fetch(`/api/agents/${agentId}`, {
            credentials: 'include'
          });
          
          if (!statusResp.ok) {
            console.error('Error al verificar estado:', statusResp.status);
            return;
          }
          
          const statusData = await statusResp.json();
          
          console.log('Estado actual:', statusData.agent.deployStatus);
          
          updateCreationStatus(statusData.agent.deployStatus);
          
          if (statusData.agent.deployStatus === 'running') {
            clearInterval(checkInterval);
            clearInterval(timerInterval);
            
            document.getElementById('creatingModal').classList.remove('show');
            document.getElementById('successModal').classList.add('show');
            
            document.getElementById('finalAgentName').textContent = statusData.agent.name;
            
            const userResp = await fetch('/api/me', { credentials: 'include' });
            const userData = await userResp.json();
            document.getElementById('finalAgentIP').textContent = userData.user.sharedServerIp || 'N/A';
            
          } else if (statusData.agent.deployStatus === 'error') {
            clearInterval(checkInterval);
            clearInterval(timerInterval);
            
            document.getElementById('creatingModal').classList.remove('show');
            alert('Error al crear el agente. Por favor contacta a soporte.');
          }
        } catch (error) {
          console.error('Error verificando estado:', error);
        }
      }, 5000);
      
    } else {
      clearInterval(timerInterval);
      throw new Error(data.error || 'Error al crear agente');
    }
    
  } catch (error) {
    clearInterval(timerInterval);
    console.error('Error:', error);
    document.getElementById('creatingModal').classList.remove('show');
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