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
	Open   string `json:"open"`  // Formato: "09:00"
	Close  string `json:"close"` // Formato: "18:00"
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
	Timezone  string      `json:"timezone"` // Ej: "America/Mexico_City"
}

// AgentConfig es el tipo para la configuración del agente
type AgentConfig struct {
	WelcomeMessage string   `json:"welcomeMessage"`
	Schedule       Schedule `json:"schedule"`
	Services       []string `json:"services"`
	Language       string   `json:"language"`
	// Agrega más campos según necesites
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
	MetaDocument string `gorm:"size:500" json:"metaDocument"` // Path al documento

	// Configuración personalizada
	Config AgentConfig `gorm:"type:json" json:"config"`

	// Servidor de Hetzner
	ServerID     int    `gorm:"default:0" json:"serverId"`
	ServerIP     string `gorm:"size:50" json:"serverIp"`
	ServerStatus string `gorm:"size:50;default:pending" json:"serverStatus"` // pending, creating, running, error

	// Estado del agente
	IsActive bool `gorm:"default:false" json:"isActive"`

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
