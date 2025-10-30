// State Management
let currentStep = 1;
let selectedSocial = '';
let uploadedFile = null;
let agentData = {
  social: '',
  metaDocument: null,
  name: '',
  phoneNumber: '',
  config: {
    welcomeMessage: '',
    schedule: {},
    services: [],
    staff: [],
    promotions: [],
    facilities: []
  }
};

let serviceCounter = 0;
let staffCounter = 0;
let promotionCounter = 0;

// Initialize
document.addEventListener('DOMContentLoaded', function() {
  initializeSocialSelection();
  initializeFileUpload();
  initializeSchedule();
  initializeEditorToolbar();
  initializeNavigationButtons();
  addService();
  addStaff();
});

// Social Network Selection
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

// File Upload
function initializeFileUpload() {
  const uploadArea = document.getElementById('uploadArea');
  const fileInput = document.getElementById('metaDocument');
  const btnSelectFile = document.getElementById('btnSelectFile');
  const btnRemoveFile = document.getElementById('btnRemoveFile');

  btnSelectFile.addEventListener('click', function() {
    fileInput.click();
  });

  uploadArea.addEventListener('click', function(e) {
    if (e.target !== fileInput && e.target !== btnSelectFile) {
      fileInput.click();
    }
  });

  uploadArea.addEventListener('dragover', function(e) {
    e.preventDefault();
    uploadArea.classList.add('dragover');
  });

  uploadArea.addEventListener('dragleave', function() {
    uploadArea.classList.remove('dragover');
  });

  uploadArea.addEventListener('drop', function(e) {
    e.preventDefault();
    uploadArea.classList.remove('dragover');
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFileUpload(files[0]);
    }
  });

  fileInput.addEventListener('change', function(e) {
    if (e.target.files.length > 0) {
      handleFileUpload(e.target.files[0]);
    }
  });

  btnRemoveFile.addEventListener('click', removeFile);
}

function handleFileUpload(file) {
  const validTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg'];
  if (!validTypes.includes(file.type)) {
    alert('Tipo de archivo no válido. Solo PDF, JPG o PNG');
    return;
  }

  if (file.size > 5 * 1024 * 1024) {
    alert('El archivo es demasiado grande. Máximo 5MB');
    return;
  }

  uploadedFile = file;
  document.getElementById('uploadArea').style.display = 'none';
  document.getElementById('filePreview').style.display = 'flex';
  document.getElementById('fileName').textContent = file.name;
  document.getElementById('fileSize').textContent = formatFileSize(file.size);

  simulateUpload();
  document.getElementById('btnStep2').disabled = false;

  const reader = new FileReader();
  reader.onload = function(e) {
    agentData.metaDocument = e.target.result;
  };
  reader.readAsDataURL(file);
}

function removeFile() {
  uploadedFile = null;
  agentData.metaDocument = null;
  document.getElementById('filePreview').style.display = 'none';
  document.getElementById('uploadArea').style.display = 'block';
  document.getElementById('metaDocument').value = '';
  document.getElementById('btnStep2').disabled = true;
}

function simulateUpload() {
  const progress = document.getElementById('uploadProgress');
  const fill = progress.querySelector('.progress-fill');
  progress.style.display = 'block';

  let width = 0;
  const interval = setInterval(() => {
    width += 10;
    fill.style.width = width + '%';
    if (width >= 100) {
      clearInterval(interval);
      setTimeout(() => {
        progress.style.display = 'none';
      }, 500);
    }
  }, 100);
}

function formatFileSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  else if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
  else return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
}

// Schedule
function initializeSchedule() {
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
        <input type="time" id="time-${day.key}-open" value="09:00">
        <span class="time-separator">-</span>
        <input type="time" id="time-${day.key}-close" value="20:00">
      </div>
    `;
    scheduleList.appendChild(dayDiv);

    const checkbox = dayDiv.querySelector(`#day-${day.key}`);
    
    checkbox.addEventListener('change', function() {
      if (this.checked) {
        dayDiv.classList.remove('closed');
      } else {
        dayDiv.classList.add('closed');
      }
    });
  });
}

// Rich Text Editor
function initializeEditorToolbar() {
  const toolbar = document.querySelector('.editor-toolbar');
  
  toolbar.addEventListener('click', function(e) {
    const btn = e.target.closest('.editor-btn');
    if (!btn) return;

    const command = btn.dataset.command;
    const emoji = btn.dataset.emoji;

    if (command) {
      document.execCommand(command, false, null);
      document.getElementById('welcomeMessage').focus();
    } else if (emoji) {
      insertEmoji(emoji);
    }
  });
}

function insertEmoji(emoji) {
  const editor = document.getElementById('welcomeMessage');
  editor.focus();
  document.execCommand('insertText', false, emoji);
}

// Navigation
function initializeNavigationButtons() {
  document.getElementById('btnStep1').addEventListener('click', nextStep);
  document.getElementById('btnBackStep2').addEventListener('click', previousStep);
  document.getElementById('btnStep2').addEventListener('click', nextStep);
  document.getElementById('btnBackStep3').addEventListener('click', previousStep);
  document.getElementById('btnStep3').addEventListener('click', nextStep);
  document.getElementById('btnBackStep4').addEventListener('click', previousStep);
  document.getElementById('btnCreateAgent').addEventListener('click', createAgent);
  document.getElementById('btnAddService').addEventListener('click', addService);
  document.getElementById('btnAddStaff').addEventListener('click', addStaff);
  document.getElementById('btnAddPromotion').addEventListener('click', addPromotion);
  document.getElementById('btnGoToDashboard').addEventListener('click', function() {
    window.location.href = '/dashboard';
  });
}

function nextStep() {
  if (!validateStep()) return;
  saveStepData();
  if (currentStep === 1) {
    if (selectedSocial === 'whatsapp') {
      currentStep = 2;
    } else {
      currentStep = 3;
    }
  } else if (currentStep === 2) {
    currentStep = 3;
  } else if (currentStep === 3) {
    generateSummary();
    currentStep = 4;
  }
  updateUI();
}

function previousStep() {
  if (currentStep === 3 && selectedSocial !== 'whatsapp') {
    currentStep = 1;
  } else if (currentStep === 2) {
    currentStep = 1;
  } else {
    currentStep--;
  }
  updateUI();
}

function validateStep() {
  if (currentStep === 1) {
    if (!selectedSocial) {
      alert('Por favor selecciona una red social');
      return false;
    }
  } else if (currentStep === 2) {
    if (!uploadedFile) {
      alert('Por favor sube el documento de verificación');
      return false;
    }
  } else if (currentStep === 3) {
    const name = document.getElementById('agentName').value.trim();
    const phone = document.getElementById('phoneNumber').value.trim();
    const welcome = document.getElementById('welcomeMessage').textContent.trim();
    if (!name || !phone || !welcome) {
      alert('Por favor completa todos los campos requeridos');
      return false;
    }
    const services = getServices();
    const staff = getStaff();
    if (services.length === 0) {
      alert('Por favor agrega al menos un servicio');
      return false;
    }
    if (staff.length === 0) {
      alert('Por favor agrega al menos un miembro del personal');
      return false;
    }
  }
  return true;
}

function saveStepData() {
  if (currentStep === 3) {
    agentData.name = document.getElementById('agentName').value.trim();
    const countryCode = document.getElementById('countryCode').value;
    const phoneNumber = document.getElementById('phoneNumber').value.trim();
    agentData.phoneNumber = countryCode + ' ' + phoneNumber;
    agentData.config.welcomeMessage = document.getElementById('welcomeMessage').textContent.trim();
    agentData.config.schedule = getSchedule();
    agentData.config.services = getServices();
    agentData.config.staff = getStaff();
    agentData.config.promotions = getPromotions();
    agentData.config.facilities = getFacilities();
  }
}

function updateUI() {
  document.querySelectorAll('.step').forEach(step => step.classList.remove('active'));
  document.getElementById(`step${currentStep}`).classList.add('active');
  const steps = document.querySelectorAll('.progress-step');
  const progressFill = document.getElementById('progressFill');
  steps.forEach((step, index) => {
    const stepNum = index + 1;
    if (stepNum < currentStep) {
      step.classList.add('completed');
      step.classList.remove('active');
    } else if (stepNum === currentStep) {
      step.classList.add('active');
      step.classList.remove('completed');
    } else {
      step.classList.remove('active', 'completed');
    }
  });
  const progress = ((currentStep - 1) / 3) * 100;
  progressFill.style.width = progress + '%';
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function getSchedule() {
  const schedule = {};
  const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
  days.forEach(day => {
    const checkbox = document.getElementById(`day-${day}`);
    const openTime = document.getElementById(`time-${day}-open`);
    const closeTime = document.getElementById(`time-${day}-close`);
    schedule[day] = {
      isOpen: checkbox.checked,
      open: openTime.value,
      close: closeTime.value
    };
  });
  return schedule;
}

function getServices() {
  const services = [];
  const items = document.querySelectorAll('#servicesContainer .item-card');
  items.forEach(item => {
    const name = item.querySelector('[data-field="name"]').value.trim();
    const price = parseFloat(item.querySelector('[data-field="price"]').value) || 0;
    const duration = parseInt(item.querySelector('[data-field="duration"]').value) || 60;
    const description = item.querySelector('[data-field="description"]').value.trim();
    if (name && price > 0) {
      services.push({ name, price, duration, description });
    }
  });
  return services;
}

function getStaff() {
  const staff = [];
  const items = document.querySelectorAll('#staffContainer .item-card');
  items.forEach(item => {
    const name = item.querySelector('[data-field="name"]').value.trim();
    const role = item.querySelector('[data-field="role"]').value.trim();
    const specialtiesStr = item.querySelector('[data-field="specialties"]').value.trim();
    const specialties = specialtiesStr ? specialtiesStr.split(',').map(s => s.trim()) : [];
    if (name && role) {
      staff.push({ name, role, specialties });
    }
  });
  return staff;
}

function getPromotions() {
  const promotions = [];
  const items = document.querySelectorAll('#promotionsContainer .item-card');
  items.forEach(item => {
    const name = item.querySelector('[data-field="name"]').value.trim();
    const discount = item.querySelector('[data-field="discount"]').value.trim();
    const validDaysStr = item.querySelector('[data-field="validDays"]').value.trim();
    const validDays = validDaysStr ? validDaysStr.split(',').map(d => d.trim()) : [];
    const description = item.querySelector('[data-field="description"]').value.trim();
    if (name) {
      promotions.push({ name, discount, validDays, description });
    }
  });
  return promotions;
}

function getFacilities() {
  const facilities = [];
  const checkboxes = document.querySelectorAll('input[name="facility"]:checked');
  checkboxes.forEach(checkbox => {
    facilities.push(checkbox.value);
  });
  return facilities;
}

function addService() {
  const container = document.getElementById('servicesContainer');
  const id = `service-${serviceCounter++}`;
  const div = document.createElement('div');
  div.className = 'item-card';
  div.dataset.id = id;
  div.innerHTML = `
    <div class="item-header">
      <span class="item-title">Servicio #${serviceCounter}</span>
      <button type="button" class="btn-remove-item" data-remove="${id}">
        <i class="lni lni-trash-can"></i>
      </button>
    </div>
    <div class="form-group">
      <label class="form-label">Nombre del Servicio *</label>
      <input type="text" class="form-input" data-field="name" placeholder="Ej: Corte Tradicional" required>
    </div>
    <div class="field-row">
      <div class="form-group">
        <label class="form-label">Precio ($) *</label>
        <input type="number" class="form-input" data-field="price" placeholder="300" min="0" step="0.01" required>
      </div>
      <div class="form-group">
        <label class="form-label">Duración (min)</label>
        <input type="number" class="form-input" data-field="duration" placeholder="60" min="15" step="15" value="60">
      </div>
    </div>
    <div class="form-group">
      <label class="form-label">Descripción</label>
      <textarea class="form-textarea" data-field="description" rows="2" placeholder="Descripción breve"></textarea>
    </div>
  `;
  container.appendChild(div);
  div.querySelector('.btn-remove-item').addEventListener('click', function() {
    removeItem(id);
  });
}

function addStaff() {
  const container = document.getElementById('staffContainer');
  const id = `staff-${staffCounter++}`;
  const div = document.createElement('div');
  div.className = 'item-card';
  div.dataset.id = id;
  div.innerHTML = `
    <div class="item-header">
      <span class="item-title">Personal #${staffCounter}</span>
      <button type="button" class="btn-remove-item" data-remove="${id}">
        <i class="lni lni-trash-can"></i>
      </button>
    </div>
    <div class="field-row">
      <div class="form-group">
        <label class="form-label">Nombre *</label>
        <div class="input-with-icon">
          <i class="lni lni-user input-icon"></i>
          <input type="text" class="form-input" data-field="name" placeholder="Ej: Carlos" required>
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Rol *</label>
        <div class="input-with-icon">
          <i class="lni lni-certificate input-icon"></i>
          <input type="text" class="form-input" data-field="role" placeholder="Ej: Barbero Senior" required>
        </div>
      </div>
    </div>
    <div class="form-group">
      <label class="form-label">Especialidades (separadas por coma)</label>
      <div class="input-with-icon">
        <i class="lni lni-star input-icon"></i>
        <input type="text" class="form-input" data-field="specialties" placeholder="Ej: Fade, Diseños, Barba">
      </div>
    </div>
  `;
  container.appendChild(div);
  div.querySelector('.btn-remove-item').addEventListener('click', function() {
    removeItem(id);
  });
}

function addPromotion() {
  const container = document.getElementById('promotionsContainer');
  const id = `promotion-${promotionCounter++}`;
  const div = document.createElement('div');
  div.className = 'item-card';
  div.dataset.id = id;
  div.innerHTML = `
    <div class="item-header">
      <span class="item-title">Promoción #${promotionCounter}</span>
      <button type="button" class="btn-remove-item" data-remove="${id}">
        <i class="lni lni-trash-can"></i>
      </button>
    </div>
    <div class="form-group">
      <label class="form-label">Nombre de la Promoción</label>
      <input type="text" class="form-input" data-field="name" placeholder="Ej: Martes de Estudiantes">
    </div>
    <div class="field-row">
      <div class="form-group">
        <label class="form-label">Descuento</label>
        <input type="text" class="form-input" data-field="discount" placeholder="Ej: $250 o 20%">
      </div>
      <div class="form-group">
        <label class="form-label">Días Válidos</label>
        <input type="text" class="form-input" data-field="validDays" placeholder="Ej: Martes">
      </div>
    </div>
    <div class="form-group">
      <label class="form-label">Descripción</label>
      <textarea class="form-textarea" data-field="description" rows="2" placeholder="Detalles de la promoción"></textarea>
    </div>
  `;
  container.appendChild(div);
  div.querySelector('.btn-remove-item').addEventListener('click', function() {
    removeItem(id);
  });
}

function removeItem(id) {
  const element = document.querySelector(`[data-id="${id}"]`);
  if (element) {
    element.remove();
  }
}

function generateSummary() {
  const container = document.getElementById('summaryContainer');
  const dayNames = {
    monday: 'Lunes',
    tuesday: 'Martes',
    wednesday: 'Miércoles',
    thursday: 'Jueves',
    friday: 'Viernes',
    saturday: 'Sábado',
    sunday: 'Domingo'
  };
  const socialNames = {
    whatsapp: 'WhatsApp',
    facebook: 'Facebook',
    instagram: 'Instagram',
    telegram: 'Telegram',
    wechat: 'WeChat',
    kakaotalk: 'KakaoTalk',
    line: 'Line'
  };
  let scheduleHTML = '<ul class="summary-list">';
  Object.keys(agentData.config.schedule).forEach(day => {
    const schedule = agentData.config.schedule[day];
    if (schedule.isOpen) {
      scheduleHTML += `<li>${dayNames[day]}: ${schedule.open} - ${schedule.close}</li>`;
    }
  });
  scheduleHTML += '</ul>';
  let html = `
    <div class="summary-section">
      <h3 class="summary-section-title">
        <i class="lni lni-network section-icon"></i>
        Red Social
      </h3>
      <div class="summary-item">
        <span class="summary-label">Plataforma:</span>
        <span class="summary-value">${socialNames[agentData.social]}</span>
      </div>
    </div>
    <div class="summary-section">
      <h3 class="summary-section-title">
        <i class="lni lni-information section-icon"></i>
        Información Básica
      </h3>
      <div class="summary-item">
        <span class="summary-label">Nombre del Agente:</span>
        <span class="summary-value">${agentData.name}</span>
      </div>
      <div class="summary-item">
        <span class="summary-label">Número de Teléfono:</span>
        <span class="summary-value">${agentData.phoneNumber}</span>
      </div>
      <div class="summary-item">
        <span class="summary-label">Mensaje de Bienvenida:</span>
        <span class="summary-value">${agentData.config.welcomeMessage}</span>
      </div>
    </div>
    <div class="summary-section">
      <h3 class="summary-section-title">
        <i class="lni lni-calendar section-icon"></i>
        Horario de Atención
      </h3>
      ${scheduleHTML}
    </div>
    <div class="summary-section">
      <h3 class="summary-section-title">
        <i class="lni lni-briefcase section-icon"></i>
        Servicios (${agentData.config.services.length})
      </h3>
      <ul class="summary-list">
        ${agentData.config.services.map(s => `<li>${s.name} - $${s.price}</li>`).join('')}
      </ul>
    </div>
    <div class="summary-section">
      <h3 class="summary-section-title">
        <i class="lni lni-users section-icon"></i>
        Personal (${agentData.config.staff.length})
      </h3>
      <ul class="summary-list">
        ${agentData.config.staff.map(s => `<li>${s.name} - ${s.role}</li>`).join('')}
      </ul>
    </div>
  `;
  if (agentData.config.promotions.length > 0) {
    html += `
      <div class="summary-section">
        <h3 class="summary-section-title">
          <i class="lni lni-tag section-icon"></i>
          Promociones (${agentData.config.promotions.length})
        </h3>
        <ul class="summary-list">
          ${agentData.config.promotions.map(p => `<li>${p.name}</li>`).join('')}
        </ul>
      </div>
    `;
  }
  if (agentData.config.facilities.length > 0) {
    html += `
      <div class="summary-section">
        <h3 class="summary-section-title">
          <i class="lni lni-car section-icon"></i>
          Facilidades
        </h3>
        <ul class="summary-list">
          ${agentData.config.facilities.map(f => `<li>${f}</li>`).join('')}
        </ul>
      </div>
    `;
  }
  container.innerHTML = html;
}

async function createAgent() {
  document.getElementById('loadingOverlay').classList.add('show');
  try {
    await new Promise(resolve => setTimeout(resolve, 2000));
    console.log('Agent Data:', agentData);
    document.getElementById('loadingOverlay').classList.remove('show');
    document.getElementById('successModal').classList.add('show');
  } catch (error) {
    console.error('Error:', error);
    document.getElementById('loadingOverlay').classList.remove('show');
    alert('Error al crear el agente. Por favor intenta de nuevo.');
  }
}
