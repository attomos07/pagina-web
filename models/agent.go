package models

import (
	"database/sql/driver"
	"encoding/json"
	"time"

	"gorm.io/gorm"
)

// DaySchedule representa el horario de un día
type DaySchedule struct {
	IsOpen bool   `json:"isOpen"`
	Open   string `json:"open"`
	Close  string `json:"close"`
}

// Schedule representa el horario semanal del negocio
type Schedule struct {
	Monday    DaySchedule `json:"monday"`
	Tuesday   DaySchedule `json:"tuesday"`
	Wednesday DaySchedule `json:"wednesday"`
	Thursday  DaySchedule `json:"thursday"`
	Friday    DaySchedule `json:"friday"`
	Saturday  DaySchedule `json:"saturday"`
	Sunday    DaySchedule `json:"sunday"`
	Timezone  string      `json:"timezone"`
}

// Service representa un servicio ofrecido
type Service struct {
	Name        string `json:"name"`
	Description string `json:"description"`
	Price       string `json:"price"`
	Duration    string `json:"duration"`
}

// Staff representa un miembro del personal
type Staff struct {
	Name        string `json:"name"`
	Role        string `json:"role"`
	Specialties string `json:"specialties"`
}

// Promotion representa una promoción
type Promotion struct {
	Name        string `json:"name"`
	Discount    string `json:"discount"`
	ValidDays   string `json:"validDays"`
	Description string `json:"description"`
}

// AgentConfig es el tipo para la configuración del agente
type AgentConfig struct {
	WelcomeMessage      string      `json:"welcomeMessage"`
	AIPersonality       string      `json:"aiPersonality"`
	Tone                string      `json:"tone"`
	Languages           []string    `json:"languages"`
	Schedule            Schedule    `json:"schedule"`
	Services            []Service   `json:"services"`
	Staff               []Staff     `json:"staff"`
	Promotions          []Promotion `json:"promotions"`
	Facilities          []string    `json:"facilities"`
	Capabilities        []string    `json:"capabilities"`
	SpecialInstructions string      `json:"specialInstructions"`
}

// Value implementa driver.Valuer para GORM
func (a AgentConfig) Value() (driver.Value, error) {
	return json.Marshal(a)
}

// Scan implementa sql.Scanner para GORM
func (a *AgentConfig) Scan(value interface{}) error {
	if value == nil {
		return nil
	}

	bytes, ok := value.([]byte)
	if !ok {
		return nil
	}

	return json.Unmarshal(bytes, a)
}

type Agent struct {
	ID     uint `gorm:"primaryKey" json:"id"`
	UserID uint `gorm:"not null;index" json:"userId"`

	// Información del agente
	Name         string `gorm:"size:255;not null" json:"name"`
	PhoneNumber  string `gorm:"size:50;not null" json:"phoneNumber"`
	BusinessType string `gorm:"size:100" json:"businessType"`
	MetaDocument string `gorm:"size:500" json:"metaDocument"`

	// Configuración personalizada
	Config AgentConfig `gorm:"type:json" json:"config"`

	// Puerto en el servidor compartido del usuario
	Port         int    `gorm:"default:0" json:"port"`                       // Puerto único en el servidor (3001, 3002, 3003, etc.)
	DeployStatus string `gorm:"size:50;default:pending" json:"deployStatus"` // pending, deploying, running, error

	// Estado del agente
	IsActive bool `gorm:"default:false" json:"isActive"`

	// Credenciales de Chatwoot
	ChatwootEmail       string `gorm:"size:255" json:"chatwootEmail"`
	ChatwootPassword    string `gorm:"size:255" json:"-"` // No exponer en JSON
	ChatwootAccountID   int    `gorm:"default:0" json:"chatwootAccountId"`
	ChatwootAccountName string `gorm:"size:255" json:"chatwootAccountName"`
	ChatwootInboxID     int    `gorm:"default:0" json:"chatwootInboxId"`
	ChatwootInboxName   string `gorm:"size:255" json:"chatwootInboxName"`
	ChatwootURL         string `gorm:"size:500" json:"chatwootUrl"`

	// Timestamps
	CreatedAt time.Time      `json:"createdAt"`
	UpdatedAt time.Time      `json:"updatedAt"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`

	// Relación con User
	User User `gorm:"foreignKey:UserID" json:"-"`
}

func (Agent) TableName() string {
	return "agents"
}
