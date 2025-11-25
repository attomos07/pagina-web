// State Management
let currentStep = 1;
let selectedSocial = '';
let userBusinessType = '';
let agentData = {
  social: '',
  businessType: '',
  name: '',
  phoneNumber: '',
  config: {
    welcomeMessage: '',
    aiPersonality: '',
    tone: 'formal',
    languages: [],
    specialInstructions: '',
    capabilities: []
  }
};

// Initialize
document.addEventListener('DOMContentLoaded', function() {
  fetchUserData();
  initializeSocialSelection();
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

  const progress = ((currentStep - 1) / 2) * 100;
  progressFill.style.width = progress + '%';
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

  agentData.config.capabilities = [];
  const capabilityCheckboxes = document.querySelectorAll('input[id^="capability-"]:checked');
  capabilityCheckboxes.forEach(checkbox => {
    agentData.config.capabilities.push(checkbox.id.replace('capability-', ''));
  });
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
        <span class="summary-value">${agentData.phoneNumber}</span>
      </div>
      <div class="summary-item">
        <span class="summary-label">Idiomas:</span>
        <span class="summary-value">${agentData.config.languages.join(', ')}</span>
      </div>
    </div>
    
    <div class="summary-section">
      <h3 class="summary-section-title">
        <i class="lni lni-comments"></i>
        Personalidad
      </h3>
      <div class="summary-item">
        <span class="summary-label">Tono:</span>
        <span class="summary-value">${agentData.config.tone}</span>
      </div>
    </div>
  `;
  
  if (agentData.config.capabilities.length > 0) {
    html += `
      <div class="summary-section">
        <h3 class="summary-section-title">
          <i class="lni lni-checkmark-circle"></i>
          Capacidades
        </h3>
        <ul class="summary-list">
          ${agentData.config.capabilities.map(c => `<li>${formatCapability(c)}</li>`).join('')}
        </ul>
      </div>
    `;
  }
  
  container.innerHTML = html;
}

function formatCapability(capability) {
  const capabilityNames = {
    'appointments': 'Agendar citas y reservaciones',
    'faq': 'Responder preguntas frecuentes',
    'products': 'Información de productos/servicios',
    'support': 'Soporte técnico básico'
  };
  return capabilityNames[capability] || capability;
}

async function createAgent() {
  document.getElementById('creatingModal').classList.add('show');
  
  let elapsedSeconds = 0;
  const maxSeconds = 1200; // 20 minutos
  
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
        metaDocument: '', // Sin documento
        config: agentData.config
      }),
    });

    const data = await response.json();

    if (response.status === 202) {
      const agentId = data.agent.id;
      
      document.getElementById('agentNameDisplay').textContent = data.agent.name;
      
      // Polling para verificar el estado
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
          
          // Actualizar UI con el estado correcto
          updateCreationStatus(statusData.agent.deployStatus);
          
          // Verificar si el despliegue está completo
          if (statusData.agent.deployStatus === 'running') {
            clearInterval(checkInterval);
            clearInterval(timerInterval);
            
            // Mostrar modal de éxito
            document.getElementById('creatingModal').classList.remove('show');
            document.getElementById('successModal').classList.add('show');
            
            document.getElementById('finalAgentName').textContent = statusData.agent.name;
            
            // Obtener información del usuario para mostrar IP del servidor
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