// State Management
let currentStep = 1;
let selectedSocial = '';
let uploadedFile = null;
let userBusinessType = '';
let agentData = {
  social: '',
  businessType: '',
  metaDocument: null,
  name: '',
  phoneNumber: '',
  config: {
    welcomeMessage: '',
    aiPersonality: '',
    tone: 'formal',
    languages: [],
    schedule: {},
    services: [],
    staff: [],
    promotions: [],
    facilities: [],
    capabilities: []
  }
};

let serviceCounter = 0;
let staffCounter = 0;
let promotionCounter = 0;

// Initialize
document.addEventListener('DOMContentLoaded', function() {
  fetchUserData();
  initializeSocialSelection();
  initializeFileUpload();
  initializeNavigationButtons();
  initializeCountryDropdown();
  initializeToneSelection();
  initializeLanguageSelection();
  initializeRichEditor();
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

// Tone Selection
function initializeToneSelection() {
  const toneInputs = document.querySelectorAll('input[name="tone"]');
  
  toneInputs.forEach(input => {
    input.addEventListener('change', function() {
      document.querySelectorAll('.tone-radio-option').forEach(opt => {
        opt.classList.remove('selected');
      });
      
      this.closest('.tone-radio-option').classList.add('selected');
      agentData.config.tone = this.value;
    });
  });
}

// Language Selection
function initializeLanguageSelection() {
  const languageCheckboxes = document.querySelectorAll('input[name="language"]');
  
  languageCheckboxes.forEach(checkbox => {
    checkbox.addEventListener('change', function() {
      if (this.checked) {
        if (!agentData.config.languages.includes(this.value)) {
          agentData.config.languages.push(this.value);
        }
      } else {
        agentData.config.languages = agentData.config.languages.filter(lang => lang !== this.value);
      }
      console.log('Idiomas seleccionados:', agentData.config.languages);
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
    agentData.config.specialInstructions = this.innerHTML;
  });
}

// Initialize rich editor for dynamically created elements
function initializeRichEditorForElement(container) {
  const editorContent = container.querySelector('.editor-content');
  if (!editorContent) return;

  const boldBtn = container.querySelector('.editor-bold');
  const italicBtn = container.querySelector('.editor-italic');
  const underlineBtn = container.querySelector('.editor-underline');
  const listBtn = container.querySelector('.editor-list');

  if (boldBtn) {
    boldBtn.addEventListener('click', (e) => {
      e.preventDefault();
      document.execCommand('bold', false, null);
      editorContent.focus();
    });
  }

  if (italicBtn) {
    italicBtn.addEventListener('click', (e) => {
      e.preventDefault();
      document.execCommand('italic', false, null);
      editorContent.focus();
    });
  }

  if (underlineBtn) {
    underlineBtn.addEventListener('click', (e) => {
      e.preventDefault();
      document.execCommand('underline', false, null);
      editorContent.focus();
    });
  }

  if (listBtn) {
    listBtn.addEventListener('click', (e) => {
      e.preventDefault();
      document.execCommand('insertUnorderedList', false, null);
      editorContent.focus();
    });
  }
}

// File Upload
function initializeFileUpload() {
  const uploadArea = document.getElementById('uploadArea');
  const fileInput = document.getElementById('metaDocument');
  const btnSelectFile = document.getElementById('btnSelectFile');
  const btnRemoveFile = document.getElementById('btnRemoveFile');

  btnSelectFile.addEventListener('click', function(e) {
    e.stopPropagation();
    fileInput.click();
  });

  uploadArea.addEventListener('click', function(e) {
    if (e.target !== fileInput && e.target !== btnSelectFile && !e.target.closest('.btn-select-file')) {
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
  const validTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg', 'text/plain', 
                      'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
  
  if (!validTypes.includes(file.type)) {
    alert('Tipo de archivo no válido. Solo PDF, JPG, PNG, TXT, DOC o DOCX');
    return;
  }

  if (file.size > 10 * 1024 * 1024) {
    alert('El archivo es demasiado grande. Máximo 10MB');
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

// Country Dropdown
function initializeCountryDropdown() {
  const wrapper = document.querySelector('.country-code-wrapper');
  if (!wrapper) return;
  
  const select = document.getElementById('countryCode');
  const dropdown = document.getElementById('countryDropdown');
  const options = dropdown.querySelectorAll('.country-option');
  
  let isDropdownOpen = false;
  let hoverTimeout = null;

  wrapper.addEventListener('mouseenter', function() {
    if (!isDropdownOpen) {
      hoverTimeout = setTimeout(() => {
        dropdown.classList.add('show');
        isDropdownOpen = true;
      }, 200);
    }
  });

  wrapper.addEventListener('mouseleave', function() {
    if (hoverTimeout) {
      clearTimeout(hoverTimeout);
      hoverTimeout = null;
    }
    
    dropdown.classList.remove('show');
    isDropdownOpen = false;
  });

  options.forEach(option => {
    option.addEventListener('click', function(e) {
      e.stopPropagation();
      const value = this.dataset.value;
      select.value = value;
      
      dropdown.classList.remove('show');
      isDropdownOpen = false;
      
      const event = new Event('change', { bubbles: true });
      select.dispatchEvent(event);
    });
  });

  document.addEventListener('click', function(e) {
    if (!wrapper.contains(e.target)) {
      dropdown.classList.remove('show');
      isDropdownOpen = false;
    }
  });
}

// Navigation
function initializeNavigationButtons() {
  document.getElementById('btnStep1').addEventListener('click', () => nextStep());
  document.getElementById('btnBackStep2').addEventListener('click', () => previousStep());
  document.getElementById('btnStep2').addEventListener('click', () => nextStep());
  document.getElementById('btnBackStep3').addEventListener('click', () => previousStep());
  document.getElementById('btnStep3').addEventListener('click', () => nextStep());
  document.getElementById('btnBackStep4').addEventListener('click', () => previousStep());
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

  if (currentStep === 2 && !uploadedFile) {
    alert('Por favor sube un documento');
    return;
  }

  if (currentStep === 1 && selectedSocial !== 'whatsapp') {
    currentStep = 3;
    updateStepDisplay();
    updateProgressBar();
    return;
  }

  if (currentStep === 3) {
    if (!validateStep3()) {
      return;
    }
    collectFormData();
  }

  if (currentStep === 4) {
    return;
  }

  currentStep++;
  updateStepDisplay();
  updateProgressBar();

  // Generar campos dinámicos cuando se entra al paso 3
  if (currentStep === 3 && (userBusinessType === 'clinica-dental' || userBusinessType === 'peluqueria')) {
    setTimeout(() => {
      generateDynamicFields();
    }, 100);
  }

  if (currentStep === 4) {
    generateSummary();
  }
}

function previousStep() {
  if (currentStep === 3 && selectedSocial !== 'whatsapp') {
    currentStep = 1;
    updateStepDisplay();
    updateProgressBar();
    return;
  }

  if (currentStep === 1) return;

  currentStep--;
  updateStepDisplay();
  updateProgressBar();
}

function validateStep3() {
  const agentName = document.getElementById('agentName').value.trim();
  const phoneNumber = document.getElementById('phoneNumber').value.trim();

  if (!agentName) {
    alert('Por favor ingresa el nombre del agente');
    document.getElementById('agentName').focus();
    return false;
  }

  if (!phoneNumber) {
    alert('Por favor ingresa el número de teléfono');
    document.getElementById('phoneNumber').focus();
    return false;
  }

  if (agentData.config.languages.length === 0) {
    alert('Por favor selecciona al menos un idioma');
    return false;
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

  progressSteps.forEach((step, index) => {
    step.classList.remove('active', 'completed');
    if (index + 1 < currentStep) {
      step.classList.add('completed');
    } else if (index + 1 === currentStep) {
      step.classList.add('active');
    }
  });

  const progress = ((currentStep - 1) / 3) * 100;
  progressFill.style.width = progress + '%';
}

function generateDynamicFields() {
  const step3Content = document.getElementById('step3');
  const formSections = step3Content.querySelectorAll('.form-section');
  
  formSections.forEach((section, index) => {
    if (index > 1) {
      section.remove();
    }
  });

  if (userBusinessType === 'clinica-dental' || userBusinessType === 'peluqueria') {
    const businessType = userBusinessType === 'clinica-dental' ? 'dental' : 'salon';
    generateBusinessSpecificFields(businessType);
  }
}

function generateBusinessSpecificFields(type) {
  const step3Content = document.getElementById('step3');
  const actionButtons = step3Content.querySelector('.action-buttons');

  const fieldsHTML = type === 'salon' ? generateSalonFields() : generateDentalFields();
  
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = fieldsHTML;
  
  while (tempDiv.firstChild) {
    actionButtons.parentNode.insertBefore(tempDiv.firstChild, actionButtons);
  }

  initializeDynamicFieldsEvents();
}

function generateSalonFields() {
  return `
    <div class="form-section">
      <h3 class="section-title">
        <i class="lni lni-calendar"></i>
        Horario de Atención
      </h3>
      <div class="schedule-list" id="scheduleList"></div>
    </div>

    <div class="form-section">
      <h3 class="section-title">
        <i class="lni lni-briefcase"></i>
        Servicios
      </h3>
      <button type="button" class="btn-add-item" id="btnAddService">
        <i class="lni lni-plus"></i>
        Agregar Servicio
      </button>
      <div id="servicesContainer"></div>
    </div>

    <div class="form-section">
      <h3 class="section-title">
        <i class="lni lni-users"></i>
        Personal / Estilistas
      </h3>
      <button type="button" class="btn-add-item" id="btnAddStaff">
        <i class="lni lni-plus"></i>
        Agregar Personal
      </button>
      <div id="staffContainer"></div>
    </div>

    <div class="form-section">
      <h3 class="section-title">
        <i class="lni lni-tag"></i>
        Promociones (Opcional)
      </h3>
      <button type="button" class="btn-add-item" id="btnAddPromotion">
        <i class="lni lni-plus"></i>
        Agregar Promoción
      </button>
      <div id="promotionsContainer"></div>
    </div>

    <div class="form-section">
      <h3 class="section-title">
        <i class="lni lni-apartment"></i>
        Facilidades Adicionales
      </h3>
      <div class="facility-grid">
        <label class="facility-item">
          <input type="checkbox" name="facility" value="Estacionamiento">
          <div class="facility-icon-wrapper">
            <i class="lni lni-car-alt"></i>
          </div>
          <div class="facility-content">
            <div class="facility-name">Estacionamiento</div>
            <div class="facility-description">Estacionamiento exclusivo disponible</div>
          </div>
        </label>
        
        <label class="facility-item">
          <input type="checkbox" name="facility" value="WiFi Gratis">
          <div class="facility-icon-wrapper">
            <i class="lni lni-wifi"></i>
          </div>
          <div class="facility-content">
            <div class="facility-name">WiFi Gratis</div>
            <div class="facility-description">Internet de alta velocidad</div>
          </div>
        </label>
        
        <label class="facility-item">
          <input type="checkbox" name="facility" value="Café/Bebidas">
          <div class="facility-icon-wrapper">
            <i class="lni lni-cup"></i>
          </div>
          <div class="facility-content">
            <div class="facility-name">Café y Bebidas</div>
            <div class="facility-description">Café de cortesía para clientes</div>
          </div>
        </label>
        
        <label class="facility-item">
          <input type="checkbox" name="facility" value="Sala de Espera">
          <div class="facility-icon-wrapper">
            <i class="lni lni-sofa"></i>
          </div>
          <div class="facility-content">
            <div class="facility-name">Sala de Espera</div>
            <div class="facility-description">Área cómoda con entretenimiento</div>
          </div>
        </label>
        
        <label class="facility-item">
          <input type="checkbox" name="facility" value="Productos Premium">
          <div class="facility-icon-wrapper">
            <i class="lni lni-producthunt"></i>
          </div>
          <div class="facility-content">
            <div class="facility-name">Productos Premium</div>
            <div class="facility-description">Marcas de alta calidad</div>
          </div>
        </label>
        
        <label class="facility-item">
          <input type="checkbox" name="facility" value="Tarjetas de Regalo">
          <div class="facility-icon-wrapper">
            <i class="lni lni-gift"></i>
          </div>
          <div class="facility-content">
            <div class="facility-name">Tarjetas de Regalo</div>
            <div class="facility-description">Disponibles para compra</div>
          </div>
        </label>
      </div>
    </div>
  `;
}

function generateDentalFields() {
  return `
    <div class="form-section">
      <h3 class="section-title">
        <i class="lni lni-calendar"></i>
        Horario de Atención
      </h3>
      <div class="schedule-list" id="scheduleList"></div>
    </div>

    <div class="form-section">
      <h3 class="section-title">
        <i class="lni lni-briefcase"></i>
        Servicios Dentales
      </h3>
      <button type="button" class="btn-add-item" id="btnAddService">
        <i class="lni lni-plus"></i>
        Agregar Servicio
      </button>
      <div id="servicesContainer"></div>
    </div>

    <div class="form-section">
      <h3 class="section-title">
        <i class="lni lni-users"></i>
        Dentistas / Especialistas
      </h3>
      <button type="button" class="btn-add-item" id="btnAddStaff">
        <i class="lni lni-plus"></i>
        Agregar Dentista
      </button>
      <div id="staffContainer"></div>
    </div>

    <div class="form-section">
      <h3 class="section-title">
        <i class="lni lni-tag"></i>
        Promociones (Opcional)
      </h3>
      <button type="button" class="btn-add-item" id="btnAddPromotion">
        <i class="lni lni-plus"></i>
        Agregar Promoción
      </button>
      <div id="promotionsContainer"></div>
    </div>

    <div class="form-section">
      <h3 class="section-title">
        <i class="lni lni-hospital"></i>
        Facilidades y Certificaciones
      </h3>
      <div class="facility-grid">
        <label class="facility-item">
          <input type="checkbox" name="facility" value="Estacionamiento">
          <div class="facility-icon-wrapper">
            <i class="lni lni-car-alt"></i>
          </div>
          <div class="facility-content">
            <div class="facility-name">Estacionamiento</div>
            <div class="facility-description">Estacionamiento exclusivo disponible</div>
          </div>
        </label>
        
        <label class="facility-item">
          <input type="checkbox" name="facility" value="Equipo Digital">
          <div class="facility-icon-wrapper">
            <i class="lni lni-display-alt"></i>
          </div>
          <div class="facility-content">
            <div class="facility-name">Equipo Digital</div>
            <div class="facility-description">Tecnología de última generación</div>
          </div>
        </label>
        
        <label class="facility-item">
          <input type="checkbox" name="facility" value="Esterilización">
          <div class="facility-icon-wrapper">
            <i class="lni lni-shield-check"></i>
          </div>
          <div class="facility-content">
            <div class="facility-name">Esterilización</div>
            <div class="facility-description">Protocolo certificado</div>
          </div>
        </label>
        
        <label class="facility-item">
          <input type="checkbox" name="facility" value="Emergencias">
          <div class="facility-icon-wrapper">
            <i class="lni lni-ambulance"></i>
          </div>
          <div class="facility-content">
            <div class="facility-name">Emergencias</div>
            <div class="facility-description">Atención 24/7 para urgencias</div>
          </div>
        </label>
        
        <label class="facility-item">
          <input type="checkbox" name="facility" value="Odontopediatría">
          <div class="facility-icon-wrapper">
            <i class="lni lni-emoji-smile"></i>
          </div>
          <div class="facility-content">
            <div class="facility-name">Odontopediatría</div>
            <div class="facility-description">Especialización en niños</div>
          </div>
        </label>
        
        <label class="facility-item">
          <input type="checkbox" name="facility" value="Rayos X Digital">
          <div class="facility-icon-wrapper">
            <i class="lni lni-camera"></i>
          </div>
          <div class="facility-content">
            <div class="facility-name">Rayos X Digital</div>
            <div class="facility-description">Diagnóstico preciso e inmediato</div>
          </div>
        </label>
        
        <label class="facility-item">
          <input type="checkbox" name="facility" value="Sedación Consciente">
          <div class="facility-icon-wrapper">
            <i class="lni lni-heart-monitor"></i>
          </div>
          <div class="facility-content">
            <div class="facility-name">Sedación Consciente</div>
            <div class="facility-description">Para pacientes con ansiedad</div>
          </div>
        </label>
        
        <label class="facility-item">
          <input type="checkbox" name="facility" value="Sala de Espera">
          <div class="facility-icon-wrapper">
            <i class="lni lni-sofa"></i>
          </div>
          <div class="facility-content">
            <div class="facility-name">Sala de Espera</div>
            <div class="facility-description">Área cómoda con entretenimiento</div>
          </div>
        </label>
      </div>
    </div>
  `;
}

function initializeDynamicFieldsEvents() {
  initializeSchedule();
  
  const btnAddService = document.getElementById('btnAddService');
  const btnAddStaff = document.getElementById('btnAddStaff');
  const btnAddPromotion = document.getElementById('btnAddPromotion');
  
  if (btnAddService) {
    btnAddService.addEventListener('click', addService);
    addService();
  }
  
  if (btnAddStaff) {
    btnAddStaff.addEventListener('click', addStaff);
    addStaff();
  }
  
  if (btnAddPromotion) {
    btnAddPromotion.addEventListener('click', addPromotion);
  }
}

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
    checkbox.addEventListener('change', function() {
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
  
  display.addEventListener('click', function(e) {
    e.stopPropagation();
    const isOpen = dropdown.classList.contains('show');
    
    document.querySelectorAll('.time-dropdown.show').forEach(d => d.classList.remove('show'));
    document.querySelectorAll('.time-input-display.active').forEach(d => d.classList.remove('active'));
    
    if (!isOpen) {
      dropdown.classList.add('show');
      display.classList.add('active');
    }
  });
  
  hourScroll.addEventListener('click', function(e) {
    if (e.target.classList.contains('time-option')) {
      hourScroll.querySelectorAll('.time-option').forEach(o => o.classList.remove('selected'));
      e.target.classList.add('selected');
      selectedHour = e.target.dataset.value;
      updateTime();
    }
  });
  
  minuteScroll.addEventListener('click', function(e) {
    if (e.target.classList.contains('time-option')) {
      minuteScroll.querySelectorAll('.time-option').forEach(o => o.classList.remove('selected'));
      e.target.classList.add('selected');
      selectedMinute = e.target.dataset.value;
      updateTime();
    }
  });
  
  periodScroll.addEventListener('click', function(e) {
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
  
  document.addEventListener('click', function(e) {
    if (!wrapper.contains(e.target)) {
      dropdown.classList.remove('show');
      display.classList.remove('active');
    }
  });
}

function addService() {
  const container = document.getElementById('servicesContainer');
  if (!container) return;
  
  serviceCounter++;
  const id = `service-${serviceCounter}`;
  const div = document.createElement('div');
  div.className = 'item-card';
  div.dataset.id = id;
  
  const serviceLabel = userBusinessType === 'clinica-dental' ? 'Tratamiento' : 'Servicio';
  const servicePlaceholder = userBusinessType === 'clinica-dental' ? 'Ej: Limpieza Dental' : 'Ej: Corte de Cabello';
  
  div.innerHTML = `
    <div class="item-header">
      <span class="item-title">${serviceLabel} #${serviceCounter}</span>
      <button type="button" class="btn-remove-item" data-remove="${id}">
        <i class="lni lni-trash-can"></i>
      </button>
    </div>
    <div class="form-group">
      <label class="form-label">Nombre del ${serviceLabel} *</label>
      <input type="text" class="form-input" data-field="name" placeholder="${servicePlaceholder}" required>
    </div>
    <div class="form-group">
      <label class="form-label">Descripción</label>
      <span class="form-help">Breve descripción del ${serviceLabel.toLowerCase()}</span>
      <div class="rich-editor">
        <div class="editor-toolbar">
          <button type="button" class="editor-btn editor-bold" title="Negrita">
            <i class="lni lni-text-format"></i>
          </button>
          <button type="button" class="editor-btn editor-italic" title="Cursiva">
            <i class="lni lni-italic"></i>
          </button>
          <button type="button" class="editor-btn editor-underline" title="Subrayado">
            <i class="lni lni-underline"></i>
          </button>
          <button type="button" class="editor-btn editor-list" title="Lista">
            <i class="lni lni-list"></i>
          </button>
        </div>
        <div class="editor-content" 
             data-field="description"
             contenteditable="true" 
             data-placeholder="Describe brevemente este ${serviceLabel.toLowerCase()}...">
        </div>
      </div>
    </div>
    <div class="field-row">
      <div class="form-group">
        <label class="form-label">Precio *</label>
        <div class="input-with-icon">
          <i class="lni lni-dollar input-icon"></i>
          <input type="text" class="form-input" data-field="price" placeholder="250" required>
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Duración *</label>
        <input type="text" class="form-input" data-field="duration" placeholder="30 min" required>
      </div>
    </div>
  `;
  container.appendChild(div);
  
  div.querySelector('.btn-remove-item').addEventListener('click', function() {
    removeItem(id);
  });
  
  initializeRichEditorForElement(div);
}

function addStaff() {
  const container = document.getElementById('staffContainer');
  if (!container) return;
  
  staffCounter++;
  const id = `staff-${staffCounter}`;
  const div = document.createElement('div');
  div.className = 'item-card';
  div.dataset.id = id;
  
  const staffLabel = userBusinessType === 'clinica-dental' ? 'Dentista' : 'Estilista';
  const staffPlaceholder = userBusinessType === 'clinica-dental' ? 'Ej: Dr. García' : 'Ej: María';
  const rolePlaceholder = userBusinessType === 'clinica-dental' ? 'Ej: Ortodoncista' : 'Ej: Estilista Senior';
  
  div.innerHTML = `
    <div class="item-header">
      <span class="item-title">${staffLabel} #${staffCounter}</span>
      <button type="button" class="btn-remove-item" data-remove="${id}">
        <i class="lni lni-trash-can"></i>
      </button>
    </div>
    <div class="field-row">
      <div class="form-group">
        <label class="form-label">Nombre *</label>
        <div class="input-with-icon">
          <i class="lni lni-user input-icon"></i>
          <input type="text" class="form-input" data-field="name" placeholder="${staffPlaceholder}" required>
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Rol *</label>
        <div class="input-with-icon">
          <i class="lni lni-certificate input-icon"></i>
          <input type="text" class="form-input" data-field="role" placeholder="${rolePlaceholder}" required>
        </div>
      </div>
    </div>
    <div class="form-group">
      <label class="form-label">Especialidades</label>
      <span class="form-help">Describe las especialidades de este ${staffLabel.toLowerCase()}</span>
      <div class="rich-editor">
        <div class="editor-toolbar">
          <button type="button" class="editor-btn editor-bold" title="Negrita">
            <i class="lni lni-text-format"></i>
          </button>
          <button type="button" class="editor-btn editor-italic" title="Cursiva">
            <i class="lni lni-italic"></i>
          </button>
          <button type="button" class="editor-btn editor-underline" title="Subrayado">
            <i class="lni lni-underline"></i>
          </button>
          <button type="button" class="editor-btn editor-list" title="Lista">
            <i class="lni lni-list"></i>
          </button>
        </div>
        <div class="editor-content" 
             data-field="specialties"
             contenteditable="true" 
             data-placeholder="Ej: Fade, Diseños, Barba...">
        </div>
      </div>
    </div>
  `;
  container.appendChild(div);
  
  div.querySelector('.btn-remove-item').addEventListener('click', function() {
    removeItem(id);
  });
  
  initializeRichEditorForElement(div);
}

function addPromotion() {
  const container = document.getElementById('promotionsContainer');
  if (!container) return;
  
  promotionCounter++;
  const id = `promotion-${promotionCounter}`;
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
      <span class="form-help">Detalles de la promoción</span>
      <div class="rich-editor">
        <div class="editor-toolbar">
          <button type="button" class="editor-btn editor-bold" title="Negrita">
            <i class="lni lni-text-format"></i>
          </button>
          <button type="button" class="editor-btn editor-italic" title="Cursiva">
            <i class="lni lni-italic"></i>
          </button>
          <button type="button" class="editor-btn editor-underline" title="Subrayado">
            <i class="lni lni-underline"></i>
          </button>
          <button type="button" class="editor-btn editor-list" title="Lista">
            <i class="lni lni-list"></i>
          </button>
        </div>
        <div class="editor-content" 
             data-field="description"
             contenteditable="true" 
             data-placeholder="Describe los detalles de la promoción...">
        </div>
      </div>
    </div>
  `;
  container.appendChild(div);
  
  div.querySelector('.btn-remove-item').addEventListener('click', function() {
    removeItem(id);
  });
  
  initializeRichEditorForElement(div);
}

function removeItem(id) {
  const element = document.querySelector(`[data-id="${id}"]`);
  if (element) {
    element.remove();
  }
}

function collectFormData() {
  agentData.name = document.getElementById('agentName').value;

  const countryCode = document.getElementById('countryCode').value;
  const phoneNumber = document.getElementById('phoneNumber').value;
  agentData.phoneNumber = countryCode + phoneNumber;

  const tone = document.querySelector('input[name="tone"]:checked');
  if (tone) {
    agentData.config.tone = tone.value;
  }

  const editorContent = document.getElementById('editorContent');
  if (editorContent) {
    agentData.config.specialInstructions = editorContent.innerHTML;
  }

  const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
  days.forEach(day => {
    const checkbox = document.getElementById(`day-${day}`);
    if (checkbox) {
      const isOpen = checkbox.checked;
      const openTime = document.getElementById(`time-${day}-open`);
      const closeTime = document.getElementById(`time-${day}-close`);
      
      agentData.config.schedule[day] = {
        isOpen: isOpen,
        open: openTime ? openTime.value : '09:00',
        close: closeTime ? closeTime.value : '20:00'
      };
    }
  });

  agentData.config.services = [];
  const serviceCards = document.querySelectorAll('#servicesContainer .item-card');
  serviceCards.forEach(card => {
    const descriptionEditor = card.querySelector('[data-field="description"].editor-content');
    const service = {
      name: card.querySelector('[data-field="name"]').value,
      description: descriptionEditor ? descriptionEditor.innerHTML : '',
      price: card.querySelector('[data-field="price"]').value,
      duration: card.querySelector('[data-field="duration"]').value
    };
    agentData.config.services.push(service);
  });

  agentData.config.staff = [];
  const staffCards = document.querySelectorAll('#staffContainer .item-card');
  staffCards.forEach(card => {
    const specialtiesEditor = card.querySelector('[data-field="specialties"].editor-content');
    const staff = {
      name: card.querySelector('[data-field="name"]').value,
      role: card.querySelector('[data-field="role"]').value,
      specialties: specialtiesEditor ? specialtiesEditor.innerHTML : ''
    };
    agentData.config.staff.push(staff);
  });

  agentData.config.promotions = [];
  const promotionCards = document.querySelectorAll('#promotionsContainer .item-card');
  promotionCards.forEach(card => {
    const descriptionEditor = card.querySelector('[data-field="description"].editor-content');
    const promotion = {
      name: card.querySelector('[data-field="name"]').value,
      discount: card.querySelector('[data-field="discount"]').value,
      validDays: card.querySelector('[data-field="validDays"]').value,
      description: descriptionEditor ? descriptionEditor.innerHTML : ''
    };
    agentData.config.promotions.push(promotion);
  });

  agentData.config.facilities = [];
  const facilityCheckboxes = document.querySelectorAll('input[name="facility"]:checked');
  facilityCheckboxes.forEach(checkbox => {
    agentData.config.facilities.push(checkbox.value);
  });

  agentData.config.capabilities = [];
  const capabilityCheckboxes = document.querySelectorAll('input[id^="capability-"]:checked');
  capabilityCheckboxes.forEach(checkbox => {
    agentData.config.capabilities.push(checkbox.id.replace('capability-', ''));
  });
}

function generateSummary() {
  const container = document.getElementById('summaryContainer');
  if (!container) return;
  
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
  
  let scheduleHTML = '<ul class="summary-list">';
  Object.keys(agentData.config.schedule).forEach(day => {
    const schedule = agentData.config.schedule[day];
    if (schedule.isOpen) {
      scheduleHTML += `<li>${dayNames[day]}: ${schedule.open} - ${schedule.close}</li>`;
    }
  });
  scheduleHTML += '</ul>';
  
  let staffHTML = '<ul class="summary-list">';
  agentData.config.staff.forEach(s => {
    staffHTML += `<li>${s.name} - ${s.role}</li>`;
  });
  staffHTML += '</ul>';
  
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
        <span class="summary-value">${agentData.phoneNumber}</span>
      </div>
      <div class="summary-item">
        <span class="summary-label">Idiomas:</span>
        <span class="summary-value">${agentData.config.languages.join(', ')}</span>
      </div>
    </div>
  `;
  
  if (Object.keys(agentData.config.schedule).length > 0) {
    html += `
      <div class="summary-section">
        <h3 class="summary-section-title">
          <i class="lni lni-calendar"></i>
          Horario de Atención
        </h3>
        ${scheduleHTML}
      </div>
    `;
  }
  
  if (agentData.config.services.length > 0) {
    html += `
      <div class="summary-section">
        <h3 class="summary-section-title">
          <i class="lni lni-briefcase"></i>
          Servicios (${agentData.config.services.length})
        </h3>
        <ul class="summary-list">
          ${agentData.config.services.map(s => `<li>${s.name} - ${s.price} - ${s.duration}</li>`).join('')}
        </ul>
      </div>
    `;
  }
  
  if (agentData.config.staff.length > 0) {
    html += `
      <div class="summary-section">
        <h3 class="summary-section-title">
          <i class="lni lni-users"></i>
          Personal (${agentData.config.staff.length})
        </h3>
        ${staffHTML}
      </div>
    `;
  }
  
  if (agentData.config.promotions.length > 0) {
    html += `
      <div class="summary-section">
        <h3 class="summary-section-title">
          <i class="lni lni-tag"></i>
          Promociones (${agentData.config.promotions.length})
        </h3>
        <ul class="summary-list">
          ${agentData.config.promotions.map(p => `<li>${p.name} - ${p.discount}</li>`).join('')}
        </ul>
      </div>
    `;
  }
  
  if (agentData.config.facilities.length > 0) {
    html += `
      <div class="summary-section">
        <h3 class="summary-section-title">
          <i class="lni lni-car"></i>
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
  document.getElementById('creatingModal').classList.add('show');
  
  let elapsedSeconds = 0;
  const maxSeconds = 900;
  
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
      body: JSON.stringify({
        name: agentData.name,
        phoneNumber: agentData.phoneNumber,
        businessType: agentData.businessType,
        metaDocument: agentData.metaDocument,
        config: agentData.config
      }),
    });

    const data = await response.json();

    if (response.status === 202) {
      const agentId = data.agent.id;
      
      document.getElementById('agentNameDisplay').textContent = data.agent.name;
      
      const checkInterval = setInterval(async () => {
        try {
          const statusResp = await fetch(`/api/agents/${agentId}`);
          const statusData = await statusResp.json();
          
          updateCreationStatus(statusData.agent.serverStatus);
          
          if (statusData.agent.serverStatus === 'running') {
            clearInterval(checkInterval);
            clearInterval(timerInterval);
            
            document.getElementById('creatingModal').classList.remove('show');
            document.getElementById('successModal').classList.add('show');
            
            document.getElementById('finalAgentName').textContent = statusData.agent.name;
            document.getElementById('finalAgentIP').textContent = statusData.agent.serverIp;
            
          } else if (statusData.agent.serverStatus === 'error') {
            clearInterval(checkInterval);
            clearInterval(timerInterval);
            
            document.getElementById('creatingModal').classList.remove('show');
            alert('Error al crear el servidor. Por favor contacta a soporte.');
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
    timeRemainingEl.textContent = `~${estimatedMinutes}:${estimatedSeconds.toString().padStart(2, '0')} restantes`;
  }
  
  const progressBar = document.getElementById('creationProgressBar');
  if (progressBar) {
    progressBar.style.width = Math.min(percentage, 100) + '%';
  }
}

function updateCreationStatus(status) {
  const statusMessages = {
    'creating': {
      text: 'Creando servidor en Hetzner...',
      icon: 'lni-apartment',
      step: 1
    },
    'provisioning': {
      text: 'Servidor creado, inicializando...',
      icon: 'lni-cog',
      step: 2
    },
    'deploying': {
      text: 'Instalando y configurando el bot...',
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
  
  const statusInfo = statusMessages[status] || statusMessages['creating'];
  
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
    { icon: 'lni-apartment', text: 'Creando servidor' },
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