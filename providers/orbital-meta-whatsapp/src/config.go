package src

import (
	"encoding/json"
	"fmt"
	"log"
	"os"
	"sync"
)

// BusinessConfig contiene la configuración del negocio
type BusinessConfig struct {
	AgentName                  string    `json:"agentName"`
	BusinessType               string    `json:"businessType"`
	PhoneNumber                string    `json:"phoneNumber"`
	Address                    string    `json:"address"`
	BusinessHours              string    `json:"business_hours"`
	GoogleMapsLink             string    `json:"google_maps_link"`
	Services                   []Service `json:"services"`
	DefaultAppointmentDuration int       `json:"default_appointment_duration"` // en minutos
	WelcomeMessage             string    `json:"welcome_message"`
	AutoResponseEnabled        bool      `json:"auto_response_enabled"`
}

// Service representa un servicio ofrecido
type Service struct {
	Name        string  `json:"name"`
	Description string  `json:"description"`
	Duration    int     `json:"duration"` // en minutos
	Price       float64 `json:"price"`
}

var (
	businessConfig *BusinessConfig
	configMutex    sync.RWMutex
	BusinessCfg    *BusinessConfig // Exportada para main.go
)

// LoadBusinessConfig carga la configuración del negocio desde JSON (sin parámetro)
func LoadBusinessConfig() error {
	filePath := os.Getenv("BUSINESS_CONFIG_FILE")
	if filePath == "" {
		filePath = "business_config.json"
	}
	log.Printf("📂 Cargando configuración desde: %s", filePath)

	file, err := os.ReadFile(filePath)
	if err != nil {
		return fmt.Errorf("error leyendo archivo de configuración: %w", err)
	}

	var config BusinessConfig
	if err := json.Unmarshal(file, &config); err != nil {
		return fmt.Errorf("error parseando JSON: %w", err)
	}

	configMutex.Lock()
	businessConfig = &config
	BusinessCfg = &config // Actualizar también la variable exportada
	configMutex.Unlock()

	log.Println("✅ Configuración del negocio cargada:")
	log.Printf("   📛 Nombre: %s", config.AgentName)
	log.Printf("   📱 Tipo: %s", config.BusinessType)
	log.Printf("   📞 Teléfono: %s", config.PhoneNumber)
	log.Printf("   📍 Dirección: %s", config.Address)
	log.Printf("   🕐 Horario: %s", config.BusinessHours)
	log.Printf("   💼 Servicios: %d configurados", len(config.Services))
	log.Printf("   ⏱  Duración por defecto: %d minutos", config.DefaultAppointmentDuration)
	log.Printf("   🤖 Auto-respuesta: %v", config.AutoResponseEnabled)

	return nil
}

// GetBusinessConfig obtiene la configuración actual
func GetBusinessConfig() *BusinessConfig {
	configMutex.RLock()
	defer configMutex.RUnlock()
	return businessConfig
}

// SetBusinessConfig establece una nueva configuración
func SetBusinessConfig(config *BusinessConfig) {
	configMutex.Lock()
	businessConfig = config
	configMutex.Unlock()
	log.Println("✅ Configuración del negocio actualizada")
}

// ReloadBusinessConfig recarga la configuración desde el archivo
func ReloadBusinessConfig() error {
	log.Println("🔄 Recargando configuración del negocio...")

	if err := LoadBusinessConfig(); err != nil {
		return err
	}

	log.Println("✅ Configuración recargada exitosamente")
	return nil
}

// ValidateConfig valida que la configuración sea válida
func ValidateConfig(config *BusinessConfig) error {
	if config.AgentName == "" {
		return fmt.Errorf("el nombre del negocio no puede estar vacío")
	}

	if config.PhoneNumber == "" {
		return fmt.Errorf("el teléfono no puede estar vacío")
	}

	if config.DefaultAppointmentDuration <= 0 {
		return fmt.Errorf("la duración por defecto debe ser mayor a 0")
	}

	if len(config.Services) == 0 {
		log.Println("⚠️  Advertencia: No hay servicios configurados")
	}

	return nil
}

// GetServiceByName busca un servicio por nombre
func GetServiceByName(name string) (*Service, error) {
	config := GetBusinessConfig()
	if config == nil {
		return nil, fmt.Errorf("configuración no cargada")
	}

	for _, service := range config.Services {
		if service.Name == name {
			return &service, nil
		}
	}

	return nil, fmt.Errorf("servicio no encontrado: %s", name)
}
