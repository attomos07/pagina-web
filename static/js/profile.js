// ============================================
// PROFILE JAVASCRIPT
// ============================================

document.addEventListener('DOMContentLoaded', function() {
    console.log('🔧 Profile JS cargado correctamente');
    
    initProfileData();
    initEditButtons();
    initCustomSelect();
    initSaveButton();
    
    console.log('✅ Profile funcionalidades inicializadas');
});

// ============================================
// LOAD PROFILE DATA (Mock Data)
// ============================================

function initProfileData() {
    // Mock data - En producción esto vendría del backend
    const mockProfile = {
        business: {
            name: 'Mi Negocio Ejemplo',
            type: 'peluqueria',
            typeName: 'Peluquería / Salón de Belleza',
            description: 'Somos un salón de belleza especializado en cortes modernos y tratamientos capilares de alta calidad.',
            website: 'https://minegocio.com',
            email: 'contacto@minegocio.com'
        },
        location: {
            address: 'Calle Principal #123',
            betweenStreets: 'Entre Av. Uno y Calle Dos',
            number: '123 Int. A',
            neighborhood: 'Centro',
            city: 'Hermosillo',
            state: 'Sonora',
            country: 'México',
            postalCode: '83000'
        },
        social: {
            facebook: 'https://facebook.com/minegocio',
            instagram: 'https://instagram.com/minegocio',
            twitter: '',
            linkedin: ''
        }
    };

    // Load business data
    setDisplayValue('businessNameDisplay', mockProfile.business.name);
    setDisplayValue('businessTypeDisplay', mockProfile.business.typeName);
    setDisplayValue('descriptionDisplay', mockProfile.business.description);
    setDisplayValue('websiteDisplay', mockProfile.business.website);
    setDisplayValue('emailDisplay', mockProfile.business.email);

    // Load location data
    setDisplayValue('addressDisplay', mockProfile.location.address);
    setDisplayValue('betweenStreetsDisplay', mockProfile.location.betweenStreets);
    setDisplayValue('numberDisplay', mockProfile.location.number);
    setDisplayValue('neighborhoodDisplay', mockProfile.location.neighborhood);
    setDisplayValue('cityDisplay', mockProfile.location.city);
    setDisplayValue('stateDisplay', mockProfile.location.state);
    setDisplayValue('countryDisplay', mockProfile.location.country);
    setDisplayValue('postalCodeDisplay', mockProfile.location.postalCode);

    // Load social data
    setDisplayValue('facebookDisplay', mockProfile.social.facebook);
    setDisplayValue('instagramDisplay', mockProfile.social.instagram);
    setDisplayValue('twitterDisplay', mockProfile.social.twitter || '---');
    setDisplayValue('linkedinDisplay', mockProfile.social.linkedin || '---');

    console.log('📊 Profile data loaded:', mockProfile);
}

function setDisplayValue(elementId, value) {
    const element = document.getElementById(elementId);
    if (element) {
        element.textContent = value || '---';
    }
}

// ============================================
// EDIT BUTTONS FUNCTIONALITY
// ============================================

let activeSection = null;
let originalValues = {};

function initEditButtons() {
    const editButtons = document.querySelectorAll('.btn-edit');
    
    editButtons.forEach(button => {
        button.addEventListener('click', function() {
            const section = this.getAttribute('data-section');
            
            if (activeSection === section) {
                // Cancel editing
                cancelEdit(section);
            } else {
                // Start editing
                if (activeSection) {
                    cancelEdit(activeSection);
                }
                startEdit(section, this);
            }
        });
    });
}

function startEdit(section, button) {
    activeSection = section;
    button.classList.add('active');
    button.querySelector('i').className = 'lni lni-close';
    
    // Save original values
    originalValues = {};
    
    const fields = getSectionFields(section);
    fields.forEach(field => {
        const displayElement = document.getElementById(field.display);
        const inputElement = document.getElementById(field.input);
        
        if (displayElement && inputElement) {
            originalValues[field.input] = displayElement.textContent;
            inputElement.value = displayElement.textContent === '---' ? '' : displayElement.textContent;
            displayElement.style.display = 'none';
            inputElement.style.display = 'block';
            
            // Handle custom select
            if (field.input === 'businessTypeInput') {
                const wrapper = document.getElementById('businessTypeWrapper');
                if (wrapper) {
                    wrapper.style.display = 'block';
                }
            }
        }
    });
    
    // Show save button
    const saveBtn = document.getElementById('saveProfileBtn');
    if (saveBtn) {
        saveBtn.style.display = 'flex';
    }
    
    console.log(`✏️ Editing section: ${section}`);
}

function cancelEdit(section) {
    const button = document.querySelector(`.btn-edit[data-section="${section}"]`);
    if (button) {
        button.classList.remove('active');
        button.querySelector('i').className = 'lni lni-pencil';
    }
    
    const fields = getSectionFields(section);
    fields.forEach(field => {
        const displayElement = document.getElementById(field.display);
        const inputElement = document.getElementById(field.input);
        
        if (displayElement && inputElement) {
            // Restore original value
            displayElement.textContent = originalValues[field.input] || '---';
            displayElement.style.display = 'block';
            inputElement.style.display = 'none';
            
            // Handle custom select
            if (field.input === 'businessTypeInput') {
                const wrapper = document.getElementById('businessTypeWrapper');
                if (wrapper) {
                    wrapper.style.display = 'none';
                    wrapper.classList.remove('active');
                }
            }
        }
    });
    
    activeSection = null;
    originalValues = {};
    
    // Hide save button if no active sections
    const saveBtn = document.getElementById('saveProfileBtn');
    if (saveBtn) {
        saveBtn.style.display = 'none';
    }
    
    console.log(`❌ Cancelled editing section: ${section}`);
}

function getSectionFields(section) {
    const fieldMaps = {
        business: [
            { display: 'businessNameDisplay', input: 'businessNameInput' },
            { display: 'businessTypeDisplay', input: 'businessTypeInput' },
            { display: 'descriptionDisplay', input: 'descriptionInput' },
            { display: 'websiteDisplay', input: 'websiteInput' },
            { display: 'emailDisplay', input: 'emailInput' }
        ],
        location: [
            { display: 'addressDisplay', input: 'addressInput' },
            { display: 'betweenStreetsDisplay', input: 'betweenStreetsInput' },
            { display: 'numberDisplay', input: 'numberInput' },
            { display: 'neighborhoodDisplay', input: 'neighborhoodInput' },
            { display: 'cityDisplay', input: 'cityInput' },
            { display: 'stateDisplay', input: 'stateInput' },
            { display: 'countryDisplay', input: 'countryInput' },
            { display: 'postalCodeDisplay', input: 'postalCodeInput' }
        ],
        social: [
            { display: 'facebookDisplay', input: 'facebookInput' },
            { display: 'instagramDisplay', input: 'instagramInput' },
            { display: 'twitterDisplay', input: 'twitterInput' },
            { display: 'linkedinDisplay', input: 'linkedinInput' }
        ]
    };
    
    return fieldMaps[section] || [];
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

    selectInput.addEventListener('click', function(e) {
        e.stopPropagation();
        toggleDropdown();
    });

    if (searchInput) {
        searchInput.addEventListener('input', function() {
            filterOptions(this.value);
        });

        searchInput.addEventListener('click', function(e) {
            e.stopPropagation();
        });
    }

    options?.forEach(option => {
        option.addEventListener('click', function(e) {
            e.stopPropagation();
            selectOption(this);
        });
    });

    document.addEventListener('click', function(e) {
        if (!selectWrapper.contains(e.target)) {
            closeDropdown();
        }
    });

    function toggleDropdown() {
        const isActive = selectWrapper.classList.contains('active');
        
        if (isActive) {
            closeDropdown();
        } else {
            openDropdown();
        }
    }

    function openDropdown() {
        selectWrapper.classList.add('active');
        
        if (searchInput) {
            setTimeout(() => {
                searchInput.focus();
            }, 100);
            searchInput.value = '';
        }
        filterOptions('');
    }

    function closeDropdown() {
        selectWrapper.classList.remove('active');
        
        if (searchInput) {
            searchInput.value = '';
        }
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
// SAVE BUTTON FUNCTIONALITY
// ============================================

function initSaveButton() {
    const saveBtn = document.getElementById('saveProfileBtn');
    
    if (saveBtn) {
        saveBtn.addEventListener('click', saveProfile);
    }
}

async function saveProfile() {
    if (!activeSection) return;
    
    const saveBtn = document.getElementById('saveProfileBtn');
    const originalText = saveBtn.innerHTML;
    
    // Show loading state
    saveBtn.innerHTML = `
        <div class="loading-spinner"></div>
        <span>Guardando...</span>
    `;
    saveBtn.disabled = true;
    
    // Collect data
    const fields = getSectionFields(activeSection);
    const data = {};
    
    fields.forEach(field => {
        const inputElement = document.getElementById(field.input);
        if (inputElement) {
            let value = inputElement.value.trim();
            
            // Special handling for businessType
            if (field.input === 'businessTypeInput') {
                data.businessType = inputElement.getAttribute('data-value');
                data.businessTypeName = value;
            } else {
                const fieldName = field.input.replace('Input', '');
                data[fieldName] = value || null;
            }
        }
    });
    
    console.log('💾 Saving data:', { section: activeSection, data });
    
    try {
        // Simulate API call
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Update display values
        fields.forEach(field => {
            const displayElement = document.getElementById(field.display);
            const inputElement = document.getElementById(field.input);
            
            if (displayElement && inputElement) {
                const newValue = inputElement.value.trim();
                displayElement.textContent = newValue || '---';
                displayElement.style.display = 'block';
                inputElement.style.display = 'none';
                
                // Handle custom select
                if (field.input === 'businessTypeInput') {
                    const wrapper = document.getElementById('businessTypeWrapper');
                    if (wrapper) {
                        wrapper.style.display = 'none';
                        wrapper.classList.remove('active');
                    }
                }
            }
        });
        
        // Reset button state
        const button = document.querySelector(`.btn-edit[data-section="${activeSection}"]`);
        if (button) {
            button.classList.remove('active');
            button.querySelector('i').className = 'lni lni-pencil';
        }
        
        activeSection = null;
        originalValues = {};
        
        saveBtn.style.display = 'none';
        saveBtn.innerHTML = originalText;
        saveBtn.disabled = false;
        
        showNotification('✅ Cambios guardados exitosamente', 'success');
        console.log('✅ Profile saved successfully');
        
    } catch (error) {
        console.error('Error saving profile:', error);
        
        saveBtn.innerHTML = originalText;
        saveBtn.disabled = false;
        
        showNotification('❌ Error al guardar los cambios', 'error');
    }
}

// ============================================
// NOTIFICATION SYSTEM
// ============================================

function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.style.cssText = `
        position: fixed;
        top: 100px;
        right: 20px;
        background: ${type === 'success' ? '#10b981' : '#ef4444'};
        color: white;
        padding: 1rem 1.5rem;
        border-radius: 12px;
        box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
        font-weight: 600;
        z-index: 10000;
        animation: slideInRight 0.4s ease;
        min-width: 300px;
    `;
    
    notification.textContent = message;
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.animation = 'slideOutRight 0.4s ease';
        setTimeout(() => notification.remove(), 400);
    }, 3000);
}

// Add CSS for animations
const style = document.createElement('style');
style.textContent = `
    @keyframes slideInRight {
        from {
            transform: translateX(400px);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
    
    @keyframes slideOutRight {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(400px);
            opacity: 0;
        }
    }
    
    .loading-spinner {
        width: 16px;
        height: 16px;
        border: 2px solid rgba(255, 255, 255, 0.3);
        border-top: 2px solid white;
        border-radius: 50%;
        animation: spin 1s linear infinite;
    }
    
    @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
    }
`;
document.head.appendChild(style);

// ============================================
// KEYBOARD SHORTCUTS
// ============================================

document.addEventListener('keydown', function(e) {
    // ESC to cancel editing
    if (e.key === 'Escape' && activeSection) {
        cancelEdit(activeSection);
    }
    
    // Ctrl/Cmd + S to save
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        if (activeSection) {
            saveProfile();
        }
    }
});

console.log('⌨️ Keyboard shortcuts initialized:');
console.log('  - ESC: Cancelar edición');
console.log('  - Ctrl/Cmd + S: Guardar cambios');