package models

import (
	"encoding/json"
	"time"

	"gorm.io/gorm"
)

// Agent representa un agente de IA creado por el usuario
type Agent struct {
	ID           uint           `gorm:"primaryKey" json:"id"`
	UserID       uint           `gorm:"not null;index" json:"userId"`
	User         User           `gorm:"foreignKey:UserID" json:"-"`
	
	// Información básica
	Name         string         `gorm:"size:255;not null" json:"name"`
	PhoneNumber  string         `gorm:"size:50;not null" json:"phoneNumber"`
	BusinessType string         `gorm:"size:100;not null" json:"businessType"`
	
	// Documento de verificación de Meta
	MetaDocument string         `gorm:"size:500" json:"metaDocument"` // URL o path del documento
	
	// Configuración del agente (JSON)
	Configuration string        `gorm:"type:text" json:"-"`
	Config        AgentConfig    `gorm:"-" json:"config"`
	
	// Estado
	IsActive     bool           `gorm:"default:true" json:"isActive"`
	
	// Timestamps
	CreatedAt    time.Time      `json:"createdAt"`
	UpdatedAt    time.Time      `json:"updatedAt"`
	DeletedAt    gorm.DeletedAt `gorm:"index" json:"-"`
}

// AgentConfig estructura para la configuración del agente
// AgentConfig estructura para la configuración del agente
type AgentConfig struct {
	WelcomeMessage string                 `json:"welcomeMessage"`
	Schedule       Schedule               `json:"schedule"`
	Services       []Service              `json:"services"`
	Staff          []StaffMember          `json:"staff"`
	Promotions     []Promotion            `json:"promotions"`
	Facilities     []string               `json:"facilities"`
	CustomFields   map[string]interface{} `json:"customFields"`
}

// Schedule horario de atención
type Schedule struct {
	Monday    DaySchedule `json:"monday"`
	Tuesday   DaySchedule `json:"tuesday"`
	Wednesday DaySchedule `json:"wednesday"`
	Thursday  DaySchedule `json:"thursday"`
	Friday    DaySchedule `json:"friday"`
	Saturday  DaySchedule `json:"saturday"`
	Sunday    DaySchedule `json:"sunday"`
}

// DaySchedule horario de un día específico
type DaySchedule struct {
	IsOpen bool   `json:"isOpen"`
	Open   string `json:"open"`
	Close  string `json:"close"`
}

// Service servicio ofrecido
type Service struct {
	Name        string  `json:"name"`
	Description string  `json:"description"`
	Price       float64 `json:"price"`
	Duration    int     `json:"duration"` // En minutos
}

// StaffMember miembro del personal
type StaffMember struct {
	Name         string   `json:"name"`
	Role         string   `json:"role"`
	Specialties  []string `json:"specialties"`
	Availability Schedule `json:"availability"`
}

// Promotion promoción o descuento
type Promotion struct {
	Name        string `json:"name"`
	Description string `json:"description"`
	Discount    string `json:"discount"`
	ValidDays   []string `json:"validDays"`
}

// BeforeSave hook para serializar la configuración
func (a *Agent) BeforeSave(tx *gorm.DB) error {
	if a.Config.WelcomeMessage != "" {
		configJSON, err := json.Marshal(a.Config)
		if err != nil {
			return err
		}
		a.Configuration = string(configJSON)
	}
	return nil
}

// AfterFind hook para deserializar la configuración
func (a *Agent) AfterFind(tx *gorm.DB) error {
	if a.Configuration != "" {
		return json.Unmarshal([]byte(a.Configuration), &a.Config)
	}
	return nil
}

// TableName especifica el nombre de la tabla
func (Agent) TableName() string {
	return "agents"
}