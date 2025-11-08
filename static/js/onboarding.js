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
    aiPersonality: '',
    confirmationTemplate: '',
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
let serviceDurationMode = 'variable';
let fixedDurationValue = '30 min';
let availableDurations = ['15 min', '30 min', '45 min', '1 hora', '1.5 horas', '2 horas'];

// Initialize
document.addEventListener('DOMContentLoaded', function() {
  initializeSocialSelection();
  initializeFileUpload();
  initializeSchedule();
  initializeEditorToolbar();
  initializeNavigationButtons();
  initializeCountryDropdown();
  initializeDurationMode();
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

// Custom Time Picker
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

// Rich Text Editor
function initializeEditorToolbar() {
  const welcomeToolbar = document.querySelector('#welcomeMessageSection .editor-toolbar');
  if (welcomeToolbar) {
    welcomeToolbar.addEventListener('click', function(e) {
      const btn = e.target.closest('.editor-btn');
      if (!btn) return;

      const command = btn.dataset.command;
      const emoji = btn.dataset.emoji;

      if (command) {
        document.execCommand(command, false, null);
        document.getElementById('welcomeMessage').focus();
      } else if (emoji) {
        insertEmojiToEditor('welcomeMessage', emoji);
      }
    });
  }

  const personalityToolbar = document.querySelector('#aiPersonalitySection .editor-toolbar');
  if (personalityToolbar) {
    personalityToolbar.addEventListener('click', function(e) {
      const btn = e.target.closest('.editor-btn');
      if (!btn) return;

      const command = btn.dataset.command;
      const emoji = btn.dataset.emoji;

      if (command) {
        document.execCommand(command, false, null);
        document.getElementById('aiPersonality').focus();
      } else if (emoji) {
        insertEmojiToEditor('aiPersonality', emoji);
      }
    });
  }

  const confirmationToolbar = document.querySelector('#confirmationTemplateSection .editor-toolbar');
  if (confirmationToolbar) {
    confirmationToolbar.addEventListener('click', function(e) {
      const btn = e.target.closest('.editor-btn');
      if (!btn) return;

      const command = btn.dataset.command;
      const emoji = btn.dataset.emoji;

      if (command) {
        document.execCommand(command, false, null);
        document.getElementById('confirmationTemplate').focus();
      } else if (emoji) {
        insertEmojiToEditor('confirmationTemplate', emoji);
      }
    });
  }
}

function insertEmojiToEditor(editorId, emoji) {
  const editor = document.getElementById(editorId);
  editor.focus();
  document.execCommand('insertText', false, emoji);
}

// Country Dropdown
function initializeCountryDropdown() {
  const wrapper = document.querySelector('.country-code-wrapper');
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

// Duration Mode Management
function initializeDurationMode() {
  const modeInputs = document.querySelectorAll('input[name="duration-mode"]');
  const fixedConfig = document.getElementById('fixedDurationConfig');
  const modeLabels = document.querySelectorAll('.duration-radio-option');
  
  modeInputs.forEach((radio, index) => {
    radio.addEventListener('change', function() {
      modeLabels.forEach(label => label.classList.remove('selected'));
      modeLabels[index].classList.add('selected');
      
      serviceDurationMode = this.value;
      
      if (this.value === 'fixed') {
        fixedConfig.classList.add('show');
        createDurationDropdown();
      } else {
        fixedConfig.classList.remove('show');
      }
      
      updateAllServicesDuration();
    });
  });
}

function createDurationDropdown() {
  const container = document.getElementById('fixedDurationDropdown');
  if (container.children.length > 0) return;
  
  const wrapper = document.createElement('div');
  wrapper.className = 'duration-dropdown-wrapper';
  
  const display = document.createElement('div');
  display.className = 'duration-input-display';
  display.innerHTML = `
    <span class="duration-display-value">${fixedDurationValue}</span>
    <i class="lni lni-chevron-down" style="font-size: 14px; color: #06b6d4;"></i>
  `;
  
  const dropdown = document.createElement('div');
  dropdown.className = 'duration-dropdown';
  
  const searchSection = document.createElement('div');
  searchSection.className = 'duration-search';
  searchSection.innerHTML = `
    <input type="text" placeholder="Buscar o agregar duración..." id="durationSearchInput">
  `;
  
  const optionsList = document.createElement('div');
  optionsList.className = 'duration-options-list';
  optionsList.id = 'durationOptionsList';
  
  const addCustom = document.createElement('div');
  addCustom.className = 'duration-add-custom';
  addCustom.innerHTML = `
    <button type="button" class="duration-add-btn">
      <i class="lni lni-plus"></i>
      <span>Agregar "<span id="customDurationText"></span>"</span>
    </button>
  `;
  
  dropdown.appendChild(searchSection);
  dropdown.appendChild(optionsList);
  dropdown.appendChild(addCustom);
  wrapper.appendChild(display);
  wrapper.appendChild(dropdown);
  container.appendChild(wrapper);
  
  renderDurationOptions();
  
  display.addEventListener('click', function(e) {
    e.stopPropagation();
    const isOpen = dropdown.classList.contains('show');
    
    document.querySelectorAll('.duration-dropdown.show').forEach(d => d.classList.remove('show'));
    document.querySelectorAll('.duration-input-display.active').forEach(d => d.classList.remove('active'));
    
    if (!isOpen) {
      dropdown.classList.add('show');
      display.classList.add('active');
      searchSection.querySelector('input').focus();
    }
  });
  
  const searchInput = searchSection.querySelector('input');
  searchInput.addEventListener('input', function() {
    const searchTerm = this.value.toLowerCase().trim();
    filterDurationOptions(searchTerm);
    
    if (searchTerm && !availableDurations.some(d => d.toLowerCase() === searchTerm)) {
      addCustom.classList.add('show');
      document.getElementById('customDurationText').textContent = this.value;
    } else {
      addCustom.classList.remove('show');
    }
  });
  
  addCustom.querySelector('button').addEventListener('click', function() {
    const newDuration = searchInput.value.trim();
    if (newDuration && !availableDurations.includes(newDuration)) {
      availableDurations.push(newDuration);
      renderDurationOptions();
      selectDuration(newDuration);
      searchInput.value = '';
      addCustom.classList.remove('show');
    }
  });
  
  document.addEventListener('click', function(e) {
    if (!wrapper.contains(e.target)) {
      dropdown.classList.remove('show');
      display.classList.remove('active');
    }
  });
}

function renderDurationOptions() {
  const list = document.getElementById('durationOptionsList');
  if (!list) return;
  
  list.innerHTML = '';
  
  availableDurations.forEach(duration => {
    const option = document.createElement('div');
    option.className = 'duration-option';
    if (duration === fixedDurationValue) {
      option.classList.add('selected');
    }
    option.innerHTML = `
      <span>${duration}</span>
      <i class="lni lni-checkmark duration-option-icon"></i>
    `;
    option.addEventListener('click', function() {
      selectDuration(duration);
    });
    list.appendChild(option);
  });
}

function filterDurationOptions(searchTerm) {
  const list = document.getElementById('durationOptionsList');
  if (!list) return;
  
  const options = list.querySelectorAll('.duration-option');
  options.forEach(option => {
    const text = option.textContent.toLowerCase();
    if (text.includes(searchTerm)) {
      option.style.display = 'flex';
    } else {
      option.style.display = 'none';
    }
  });
}

function selectDuration(duration) {
  fixedDurationValue = duration;
  
  const display = document.querySelector('#fixedDurationDropdown .duration-display-value');
  if (display) {
    display.textContent = duration;
  }
  
  renderDurationOptions();
  updateAllServicesDuration();
  
  document.querySelectorAll('.duration-dropdown.show').forEach(d => d.classList.remove('show'));
  document.querySelectorAll('.duration-input-display.active').forEach(d => d.classList.remove('active'));
}

function updateAllServicesDuration() {
  const services = document.querySelectorAll('#servicesContainer .item-card');
  services.forEach(service => {
    const durationField = service.querySelector('.variable-duration-field');
    if (serviceDurationMode === 'fixed') {
      if (durationField) {
        durationField.classList.remove('show');
      }
    } else {
      if (durationField) {
        durationField.classList.add('show');
      }
    }
  });
}

function createServiceDurationDropdown(container, serviceId) {
  const wrapper = document.createElement('div');
  wrapper.className = 'duration-dropdown-wrapper';
  
  const display = document.createElement('div');
  display.className = 'duration-input-display';
  display.innerHTML = `
    <span class="duration-display-value">30 min</span>
    <i class="lni lni-chevron-down" style="font-size: 14px; color: #06b6d4;"></i>
  `;
  
  const dropdown = document.createElement('div');
  dropdown.className = 'duration-dropdown';
  
  const searchSection = document.createElement('div');
  searchSection.className = 'duration-search';
  searchSection.innerHTML = `
    <input type="text" placeholder="Buscar o agregar duración..." class="service-duration-search">
  `;
  
  const optionsList = document.createElement('div');
  optionsList.className = 'duration-options-list service-duration-list';
  
  const addCustom = document.createElement('div');
  addCustom.className = 'duration-add-custom';
  addCustom.innerHTML = `
    <button type="button" class="duration-add-btn service-duration-add">
      <i class="lni lni-plus"></i>
      <span>Agregar "<span class="custom-duration-text"></span>"</span>
    </button>
  `;
  
  dropdown.appendChild(searchSection);
  dropdown.appendChild(optionsList);
  dropdown.appendChild(addCustom);
  wrapper.appendChild(display);
  wrapper.appendChild(dropdown);
  container.appendChild(wrapper);
  
  let selectedDuration = '30 min';
  
  const renderOptions = () => {
    optionsList.innerHTML = '';
    availableDurations.forEach(duration => {
      const option = document.createElement('div');
      option.className = 'duration-option';
      if (duration === selectedDuration) {
        option.classList.add('selected');
      }
      option.innerHTML = `
        <span>${duration}</span>
        <i class="lni lni-checkmark duration-option-icon"></i>
      `;
      option.addEventListener('click', function() {
        selectedDuration = duration;
        display.querySelector('.duration-display-value').textContent = duration;
        renderOptions();
        dropdown.classList.remove('show');
        display.classList.remove('active');
      });
      optionsList.appendChild(option);
    });
  };
  
  renderOptions();
  
  display.addEventListener('click', function(e) {
    e.stopPropagation();
    const isOpen = dropdown.classList.contains('show');
    
    document.querySelectorAll('.duration-dropdown.show').forEach(d => d.classList.remove('show'));
    document.querySelectorAll('.duration-input-display.active').forEach(d => d.classList.remove('active'));
    
    if (!isOpen) {
      dropdown.classList.add('show');
      display.classList.add('active');
      searchSection.querySelector('input').focus();
    }
  });
  
  const searchInput = searchSection.querySelector('input');
  searchInput.addEventListener('input', function() {
    const searchTerm = this.value.toLowerCase().trim();
    
    const options = optionsList.querySelectorAll('.duration-option');
    options.forEach(option => {
      const text = option.textContent.toLowerCase();
      if (text.includes(searchTerm)) {
        option.style.display = 'flex';
      } else {
        option.style.display = 'none';
      }
    });
    
    if (searchTerm && !availableDurations.some(d => d.toLowerCase() === searchTerm)) {
      addCustom.classList.add('show');
      addCustom.querySelector('.custom-duration-text').textContent = this.value;
    } else {
      addCustom.classList.remove('show');
    }
  });
  
  addCustom.querySelector('button').addEventListener('click', function() {
    const newDuration = searchInput.value.trim();
    if (newDuration && !availableDurations.includes(newDuration)) {
      availableDurations.push(newDuration);
      selectedDuration = newDuration;
      display.querySelector('.duration-display-value').textContent = newDuration;
      renderOptions();
      searchInput.value = '';
      addCustom.classList.remove('show');
      dropdown.classList.remove('show');
      display.classList.remove('active');
    }
  });
  
  document.addEventListener('click', function(e) {
    if (!wrapper.contains(e.target)) {
      dropdown.classList.remove('show');
      display.classList.remove('active');
    }
  });
  
  wrapper.getDuration = () => selectedDuration;
  
  return wrapper;
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
  document.getElementById('btnGoToDashboard').addEventListener('click', function() {
    window.location.href = '/dashboard';
  });

  document.getElementById('btnAddService').addEventListener('click', addService);
  document.getElementById('btnAddStaff').addEventListener('click', addStaff);
  document.getElementById('btnAddPromotion').addEventListener('click', addPromotion);
}

function nextStep() {
  if (currentStep === 1 && !selectedSocial) {
    alert('Por favor selecciona una red social');
    return;
  }

  if (currentStep === 1 && selectedSocial !== 'whatsapp') {
    currentStep = 3;
    updateStepDisplay();
    updateProgressBar();
    return;
  }

  if (currentStep === 3) {
    collectFormData();
  }

  if (currentStep === 4) {
    return;
  }

  currentStep++;
  updateStepDisplay();
  updateProgressBar();

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

function collectFormData() {
  agentData.name = document.getElementById('agentName').value;
  
  const countryCode = document.getElementById('countryCode').value;
  const phoneNumber = document.getElementById('phoneNumber').value;
  agentData.phoneNumber = countryCode + phoneNumber;

  agentData.config.welcomeMessage = document.getElementById('welcomeMessage').innerHTML;
  agentData.config.aiPersonality = document.getElementById('aiPersonality').innerHTML;
  agentData.config.confirmationTemplate = document.getElementById('confirmationTemplate').innerHTML;

  const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
  days.forEach(day => {
    const isOpen = document.getElementById(`day-${day}`).checked;
    agentData.config.schedule[day] = {
      isOpen: isOpen,
      open: document.getElementById(`time-${day}-open`).value,
      close: document.getElementById(`time-${day}-close`).value
    };
  });

  agentData.config.services = [];
  document.querySelectorAll('#servicesContainer .item-card').forEach(card => {
    const descriptionEditor = card.querySelector('[data-field="description"]');
    let duration;
    
    if (serviceDurationMode === 'fixed') {
      duration = fixedDurationValue;
    } else {
      const durationWrapper = card.querySelector('.duration-dropdown-wrapper');
      duration = durationWrapper && durationWrapper.getDuration ? durationWrapper.getDuration() : '30 min';
    }
    
    const service = {
      name: card.querySelector('[data-field="name"]').value,
      description: descriptionEditor ? descriptionEditor.innerHTML : '',
      price: card.querySelector('[data-field="price"]').value,
      duration: duration
    };
    agentData.config.services.push(service);
  });

  agentData.config.staff = [];
  document.querySelectorAll('#staffContainer .item-card').forEach(card => {
    const scheduleType = card.querySelector('input[name^="schedule-type-"]:checked');
    const staff = {
      name: card.querySelector('[data-field="name"]').value,
      role: card.querySelector('[data-field="role"]').value,
      specialties: card.querySelector('[data-field="specialties"]').innerHTML,
      scheduleType: scheduleType ? scheduleType.value : 'default',
      customSchedule: {}
    };
    
    if (staff.scheduleType === 'custom') {
      const staffId = card.dataset.id;
      days.forEach(day => {
        const dayCheckbox = card.querySelector(`#staff-${staffId}-day-${day}`);
        if (dayCheckbox) {
          staff.customSchedule[day] = {
            isOpen: dayCheckbox.checked,
            open: card.querySelector(`#staff-${staffId}-time-${day}-open`).value,
            close: card.querySelector(`#staff-${staffId}-time-${day}-close`).value
          };
        }
      });
    }
    
    agentData.config.staff.push(staff);
  });

  agentData.config.promotions = [];
  document.querySelectorAll('#promotionsContainer .item-card').forEach(card => {
    const promotion = {
      name: card.querySelector('[data-field="name"]').value,
      discount: card.querySelector('[data-field="discount"]').value,
      validDays: card.querySelector('[data-field="validDays"]').value,
      description: card.querySelector('[data-field="description"]').value
    };
    agentData.config.promotions.push(promotion);
  });

  agentData.config.facilities = [];
  document.querySelectorAll('input[name="facility"]:checked').forEach(checkbox => {
    agentData.config.facilities.push(checkbox.value);
  });
}

function addService() {
  const container = document.getElementById('servicesContainer');
  const id = `service-${serviceCounter++}`;
  const div = document.createElement('div');
  div.className = 'item-card';
  div.dataset.id = id;
  
  const showDurationField = serviceDurationMode === 'variable' ? 'show' : '';
  
  div.innerHTML = `
    <div class="item-header">
      <span class="item-title">Servicio #${serviceCounter}</span>
      <button type="button" class="btn-remove-item" data-remove="${id}">
        <i class="lni lni-trash-can"></i>
      </button>
    </div>
    <div class="form-group">
      <label class="form-label">Nombre del Servicio *</label>
      <input type="text" class="form-input" data-field="name" placeholder="Ej: Corte de Cabello" required>
    </div>
    <div class="form-group">
      <label class="form-label">Descripción</label>
      <div class="rich-editor">
        <div class="editor-toolbar">
          <button type="button" class="editor-btn" data-command="bold" title="Negrita">
            <strong>B</strong>
          </button>
          <button type="button" class="editor-btn" data-command="italic" title="Cursiva">
            <em>I</em>
          </button>
          <button type="button" class="editor-btn" data-command="underline" title="Subrayado">
            <u>U</u>
          </button>
          <button type="button" class="editor-btn" data-emoji="⭐" title="Emoji">
            😊
          </button>
          <button type="button" class="editor-btn" data-command="insertUnorderedList" title="Lista">
            ☰
          </button>
        </div>
        <div class="editor-content" 
             data-field="description"
             contenteditable="true" 
             data-placeholder="Breve descripción del servicio">
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
      <div class="form-group variable-duration-field ${showDurationField}">
        <label class="form-label">Duración *</label>
        <div class="duration-icon-wrapper">
          <i class="lni lni-timer"></i>
          <div id="service-duration-${id}"></div>
        </div>
      </div>
    </div>
  `;
  container.appendChild(div);
  
  const toolbar = div.querySelector('.editor-toolbar');
  toolbar.addEventListener('click', function(e) {
    const btn = e.target.closest('.editor-btn');
    if (!btn) return;

    const command = btn.dataset.command;
    const emoji = btn.dataset.emoji;
    const editor = div.querySelector('.editor-content');

    if (command) {
      document.execCommand(command, false, null);
      editor.focus();
    } else if (emoji) {
      editor.focus();
      document.execCommand('insertText', false, emoji);
    }
  });
  
  if (serviceDurationMode === 'variable') {
    const durationContainer = div.querySelector(`#service-duration-${id}`);
    createServiceDurationDropdown(durationContainer, id);
  }
  
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
      <label class="form-label">Especialidades</label>
      <div class="rich-editor">
        <div class="editor-toolbar">
          <button type="button" class="editor-btn" data-command="bold" title="Negrita">
            <strong>B</strong>
          </button>
          <button type="button" class="editor-btn" data-command="italic" title="Cursiva">
            <em>I</em>
          </button>
          <button type="button" class="editor-btn" data-command="underline" title="Subrayado">
            <u>U</u>
          </button>
          <button type="button" class="editor-btn" data-emoji="⭐" title="Emoji">
            😊
          </button>
          <button type="button" class="editor-btn" data-command="insertUnorderedList" title="Lista">
            ☰
          </button>
        </div>
        <div class="editor-content" 
             data-field="specialties"
             contenteditable="true" 
             data-placeholder="Ej: Fade, Diseños, Barba...">
        </div>
      </div>
    </div>
    
    <div class="staff-schedule-options">
      <div class="schedule-option-title">Horario de Disponibilidad</div>
      <div class="schedule-radio-group">
        <label class="schedule-radio-option selected">
          <input type="radio" name="schedule-type-${id}" value="default" checked>
          <div class="schedule-radio-label">
            <strong>Horario Predeterminado</strong>
            <span>Utilizar el horario general del negocio</span>
          </div>
        </label>
        <label class="schedule-radio-option">
          <input type="radio" name="schedule-type-${id}" value="custom">
          <div class="schedule-radio-label">
            <strong>Horario Personalizado</strong>
            <span>Configurar un horario específico para este personal</span>
          </div>
        </label>
      </div>
    </div>
    
    <div class="staff-custom-schedule" id="custom-schedule-${id}">
      <div class="staff-schedule-header">
        <div class="staff-schedule-icon">
          <i class="lni lni-calendar"></i>
        </div>
        <div class="staff-schedule-title">Configurar Horario Personalizado</div>
      </div>
      <div class="schedule-list" id="staff-schedule-${id}"></div>
    </div>
  `;
  
  container.appendChild(div);
  
  const toolbar = div.querySelector('.editor-toolbar');
  toolbar.addEventListener('click', function(e) {
    const btn = e.target.closest('.editor-btn');
    if (!btn) return;

    const command = btn.dataset.command;
    const emoji = btn.dataset.emoji;
    const editor = div.querySelector('.editor-content');

    if (command) {
      document.execCommand(command, false, null);
      editor.focus();
    } else if (emoji) {
      editor.focus();
      document.execCommand('insertText', false, emoji);
    }
  });
  
  const scheduleOptions = div.querySelectorAll(`input[name="schedule-type-${id}"]`);
  const customScheduleDiv = div.querySelector(`#custom-schedule-${id}`);
  const scheduleLabels = div.querySelectorAll('.schedule-radio-option');
  
  scheduleOptions.forEach((radio, index) => {
    radio.addEventListener('change', function() {
      scheduleLabels.forEach(label => label.classList.remove('selected'));
      scheduleLabels[index].classList.add('selected');
      
      if (this.value === 'custom') {
        customScheduleDiv.classList.add('show');
        initializeStaffSchedule(id);
      } else {
        customScheduleDiv.classList.remove('show');
      }
    });
  });
  
  div.querySelector('.btn-remove-item').addEventListener('click', function() {
    removeItem(id);
  });
}

function initializeStaffSchedule(staffId) {
  const scheduleContainer = document.querySelector(`#staff-schedule-${staffId}`);
  
  if (scheduleContainer.children.length > 0) {
    return;
  }
  
  const days = [
    { name: 'Lunes', key: 'monday' },
    { name: 'Martes', key: 'tuesday' },
    { name: 'Miércoles', key: 'wednesday' },
    { name: 'Jueves', key: 'thursday' },
    { name: 'Viernes', key: 'friday' },
    { name: 'Sábado', key: 'saturday' },
    { name: 'Domingo', key: 'sunday' }
  ];
  
  days.forEach(day => {
    const dayDiv = document.createElement('div');
    dayDiv.className = 'schedule-day';
    dayDiv.innerHTML = `
      <div class="day-name">${day.name}</div>
      <div class="day-toggle">
        <label class="toggle-switch">
          <input type="checkbox" id="staff-${staffId}-day-${day.key}" checked>
          <span class="toggle-slider"></span>
        </label>
        <span class="toggle-label">Disponible</span>
      </div>
      <div class="day-times">
        <input type="time" class="time-input" id="staff-${staffId}-time-${day.key}-open" value="09:00" style="display: none;">
        <span class="time-separator">-</span>
        <input type="time" class="time-input" id="staff-${staffId}-time-${day.key}-close" value="20:00" style="display: none;">
      </div>
    `;
    scheduleContainer.appendChild(dayDiv);
    
    const checkbox = dayDiv.querySelector(`#staff-${staffId}-day-${day.key}`);
    checkbox.addEventListener('change', function() {
      if (this.checked) {
        dayDiv.classList.remove('closed');
      } else {
        dayDiv.classList.add('closed');
      }
    });
    
    const openInput = dayDiv.querySelector(`#staff-${staffId}-time-${day.key}-open`);
    const closeInput = dayDiv.querySelector(`#staff-${staffId}-time-${day.key}-close`);
    createTimePicker(openInput, '09:00');
    createTimePicker(closeInput, '20:00');
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
  
  let staffHTML = '<ul class="summary-list">';
  agentData.config.staff.forEach(s => {
    let scheduleInfo = s.scheduleType === 'custom' ? ' (Horario personalizado)' : '';
    staffHTML += `<li>${s.name} - ${s.role}${scheduleInfo}</li>`;
  });
  staffHTML += '</ul>';
  
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
      <div class="summary-item">
        <span class="summary-label">Personalidad de la IA:</span>
        <span class="summary-value">${agentData.config.aiPersonality || 'No configurada'}</span>
      </div>
      <div class="summary-item">
        <span class="summary-label">Plantilla de Confirmación:</span>
        <span class="summary-value">${agentData.config.confirmationTemplate || 'Plantilla predeterminada'}</span>
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
        ${agentData.config.services.map(s => `<li>${s.name} - ${s.price}</li>`).join('')}
      </ul>
    </div>
    <div class="summary-section">
      <h3 class="summary-section-title">
        <i class="lni lni-users section-icon"></i>
        Personal (${agentData.config.staff.length})
      </h3>
      ${staffHTML}
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

// NUEVA FUNCIÓN: Crear Agente con Animación y Contador
async function createAgent() {
  // Mostrar modal de creación
  document.getElementById('creatingModal').classList.add('show');
  
  // Iniciar contador de tiempo
  let elapsedSeconds = 0;
  const maxSeconds = 900; // 15 minutos
  
  const timerInterval = setInterval(() => {
    elapsedSeconds++;
    updateTimer(elapsedSeconds, maxSeconds);
  }, 1000);

  try {
    // Enviar petición al servidor
    const response = await fetch('/api/agents', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: agentData.name,
        phoneNumber: agentData.phoneNumber,
        businessType: 'barberia', // o el tipo que tengas
        metaDocument: agentData.metaDocument,
        config: agentData.config
      }),
    });

    const data = await response.json();

    if (response.status === 202) {
      // Aceptado - servidor en creación
      const agentId = data.agent.id;
      
      // Actualizar UI con información del agente
      document.getElementById('agentNameDisplay').textContent = data.agent.name;
      
      // Polling para verificar estado cada 5 segundos
      const checkInterval = setInterval(async () => {
        try {
          const statusResp = await fetch(`/api/agents/${agentId}`);
          const statusData = await statusResp.json();
          
          // Actualizar estado en UI
          updateCreationStatus(statusData.agent.serverStatus);
          
          if (statusData.agent.serverStatus === 'running') {
            clearInterval(checkInterval);
            clearInterval(timerInterval);
            
            // Mostrar éxito
            document.getElementById('creatingModal').classList.remove('show');
            document.getElementById('successModal').classList.add('show');
            
            // Guardar información del agente
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
      }, 5000); // Verificar cada 5 segundos
      
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

// Actualizar el contador de tiempo
function updateTimer(elapsed, max) {
  const minutes = Math.floor(elapsed / 60);
  const seconds = elapsed % 60;
  const percentage = (elapsed / max) * 100;
  
  document.getElementById('timeElapsed').textContent = 
    `${minutes}:${seconds.toString().padStart(2, '0')}`;
  
  const estimatedMinutes = Math.floor((max - elapsed) / 60);
  const estimatedSeconds = (max - elapsed) % 60;
  document.getElementById('timeRemaining').textContent = 
    `~${estimatedMinutes}:${estimatedSeconds.toString().padStart(2, '0')} restantes`;
  
  // Actualizar barra de progreso
  document.getElementById('creationProgressBar').style.width = Math.min(percentage, 100) + '%';
}

// Actualizar estado de creación
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
  
  document.getElementById('currentStatusText').textContent = statusInfo.text;
  const iconElement = document.getElementById('currentStatusIcon');
  iconElement.className = `lni ${statusInfo.icon} status-icon`;
  
  updateStatusSteps(statusInfo.step);
}

// Actualizar pasos visuales
function updateStatusSteps(currentStep) {
  const steps = [
    { icon: 'lni-apartment', text: 'Creando servidor' },
    { icon: 'lni-cog', text: 'Inicializando sistema' },
    { icon: 'lni-bot', text: 'Desplegando bot' },
    { icon: 'lni-checkmark', text: 'Completado' }
  ];
  
  const container = document.getElementById('statusStepsContainer');
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