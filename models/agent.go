package models

import (
	"database/sql/driver"
	"encoding/json"
	"fmt"
	"time"

	"gorm.io/gorm"
)

// FlexibleString es un tipo que acepta string o number en JSON
type FlexibleString string

// UnmarshalJSON implementa json.Unmarshaler para FlexibleString
func (fs *FlexibleString) UnmarshalJSON(data []byte) error {
	// Intentar como string primero
	var s string
	if err := json.Unmarshal(data, &s); err == nil {
		*fs = FlexibleString(s)
		return nil
	}

	// Si falla, intentar como número
	var n float64
	if err := json.Unmarshal(data, &n); err == nil {
		*fs = FlexibleString(fmt.Sprintf("%.2f", n))
		return nil
	}

	return fmt.Errorf("no se pudo parsear como string o número")
}

// String convierte FlexibleString a string
func (fs FlexibleString) String() string {
	return string(fs)
}

// DaySchedule representa el horario de un día
type DaySchedule struct {
	Open  bool   `json:"open"`  // Si el día está abierto (boolean)
	Start string `json:"start"` // Hora de apertura (formato HH:MM)
	End   string `json:"end"`   // Hora de cierre (formato HH:MM)
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
	Title         string          `json:"title"`         // Título del servicio
	Description   string          `json:"description"`   // Descripción
	PriceType     string          `json:"priceType"`     // Tipo: "normal", "range", "promo"
	Price         FlexibleString  `json:"price"`         // Precio (acepta string o number)
	OriginalPrice *FlexibleString `json:"originalPrice"` // Precio original (opcional, puntero para null)
	PromoPrice    *FlexibleString `json:"promoPrice"`    // Precio promocional (opcional, puntero para null)
}

// Staff representa un miembro del personal (Workers en frontend)
type Staff struct {
	Name      string   `json:"name"`
	StartTime string   `json:"startTime"` // Hora inicio
	EndTime   string   `json:"endTime"`   // Hora fin
	Days      []string `json:"days"`      // Días que trabaja
}

// Holiday representa un día festivo
type Holiday struct {
	Date string `json:"date"` // Formato: YYYY-MM-DD
	Name string `json:"name"` // Nombre del festivo
}

// Promotion representa una promoción
type Promotion struct {
	Name        string         `json:"name"`
	Discount    FlexibleString `json:"discount"` // Acepta string o number
	ValidDays   string         `json:"validDays"`
	Description string         `json:"description"`
}

// AgentConfig es el tipo para la configuración del agente
type AgentConfig struct {
	WelcomeMessage      string      `json:"welcomeMessage"`
	AIPersonality       string      `json:"aiPersonality"`
	Tone                string      `json:"tone"`
	CustomTone          string      `json:"customTone"`          // Tono personalizado
	Languages           []string    `json:"languages"`           // Idiomas principales
	AdditionalLanguages []string    `json:"additionalLanguages"` // Idiomas adicionales
	Schedule            Schedule    `json:"schedule"`
	Holidays            []Holiday   `json:"holidays"` // Días festivos
	Services            []Service   `json:"services"`
	Workers             []Staff     `json:"workers"` // Personal (Staff en BD)
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
	Port         int    `gorm:"default:0" json:"port"`
	DeployStatus string `gorm:"size:50;default:pending" json:"deployStatus"`

	// Estado del agente
	IsActive bool `gorm:"default:false" json:"isActive"`

	// Tipo de bot desplegado: "builderbot" (Node.js) o "atomic" (Go)
	BotType string `gorm:"size:50;default:builderbot" json:"botType"`

	// =============================================
	// 🆕 SERVIDOR INDIVIDUAL PARA BUILDERBOT
	// =============================================
	// Cada BuilderBot (plan de pago) tiene su propio servidor Hetzner
	ServerID       int    `gorm:"default:0" json:"serverId"`                   // ID del servidor en Hetzner
	ServerIP       string `gorm:"size:50" json:"serverIp"`                     // IP del servidor
	ServerPassword string `gorm:"size:255" json:"-"`                           // Password SSH (oculto en JSON)
	ServerStatus   string `gorm:"size:50;default:pending" json:"serverStatus"` // Estado: pending, creating, ready, error

	// Credenciales de Chatwoot
	ChatwootEmail       string `gorm:"size:255" json:"chatwootEmail"`
	ChatwootPassword    string `gorm:"size:255" json:"-"`
	ChatwootAccountID   int    `gorm:"default:0" json:"chatwootAccountId"`
	ChatwootAccountName string `gorm:"size:255" json:"chatwootAccountName"`
	ChatwootInboxID     int    `gorm:"default:0" json:"chatwootInboxId"`
	ChatwootInboxName   string `gorm:"size:255" json:"chatwootInboxName"`
	ChatwootURL         string `gorm:"size:500" json:"chatwootUrl"`

	// =============================================
	// INTEGRACIÓN DE GOOGLE CALENDAR Y SHEETS
	// =============================================

	GoogleToken       string     `gorm:"type:text" json:"-"`
	GoogleCalendarID  string     `gorm:"size:500" json:"googleCalendarId"`
	GoogleSheetID     string     `gorm:"size:500" json:"googleSheetId"`
	GoogleConnected   bool       `gorm:"default:false" json:"googleConnected"`
	GoogleConnectedAt *time.Time `json:"googleConnectedAt"`

	// =============================================
	// INTEGRACIÓN DE META WHATSAPP BUSINESS API
	// =============================================

	// Token de acceso de Meta (long-lived token de 60 días)
	MetaAccessToken string `gorm:"type:text" json:"-"`

	// WhatsApp Business Account ID
	MetaWABAID string `gorm:"size:255" json:"metaWabaId"`

	// Phone Number ID (identificador único del número de WhatsApp)
	MetaPhoneNumberID string `gorm:"size:255" json:"metaPhoneNumberId"`

	// Número de teléfono formateado para mostrar (ej: +52 123 456 7890)
	MetaDisplayNumber string `gorm:"size:50" json:"metaDisplayNumber"`

	// Nombre verificado del negocio en WhatsApp
	MetaVerifiedName string `gorm:"size:255" json:"metaVerifiedName"`

	// Estado de la conexión
	MetaConnected   bool       `gorm:"default:false" json:"metaConnected"`
	MetaConnectedAt *time.Time `json:"metaConnectedAt"`

	// Expiración del token
	MetaTokenExpiresAt *time.Time `json:"metaTokenExpiresAt"`

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

// IsAtomicBot verifica si el agente usa el bot de Go
func (a *Agent) IsAtomicBot() bool {
	return a.BotType == "atomic"
}

// IsBuilderBot verifica si el agente usa BuilderBot
func (a *Agent) IsBuilderBot() bool {
	return a.BotType == "builderbot" || a.BotType == ""
}

// HasOwnServer verifica si el agente tiene servidor individual (BuilderBot)
func (a *Agent) HasOwnServer() bool {
	return a.IsBuilderBot() && a.ServerID > 0
}

// GetEnvVarsForBot genera las variables de entorno para el bot
func (a *Agent) GetEnvVarsForBot() map[string]string {
	envVars := map[string]string{
		"AGENT_ID":     fmt.Sprintf("%d", a.ID),
		"AGENT_NAME":   a.Name,
		"PHONE_NUMBER": a.PhoneNumber,
		"PORT":         fmt.Sprintf("%d", a.Port),
	}

	// Agregar variables de Google si está conectado
	if a.GoogleConnected {
		if a.GoogleSheetID != "" {
			envVars["SPREADSHEETID"] = a.GoogleSheetID
		}
		if a.GoogleCalendarID != "" {
			envVars["GOOGLE_CALENDAR_ID"] = a.GoogleCalendarID
		}
	}

	// Agregar variables de Meta WhatsApp si está conectado
	if a.MetaConnected {
		if a.MetaAccessToken != "" {
			envVars["META_ACCESS_TOKEN"] = a.MetaAccessToken
		}
		if a.MetaPhoneNumberID != "" {
			envVars["META_PHONE_NUMBER_ID"] = a.MetaPhoneNumberID
		}
		if a.MetaWABAID != "" {
			envVars["META_WABA_ID"] = a.MetaWABAID
		}
	}

	return envVars
}

// GetGoogleCalendarEmail extrae el email del token de Google
func (a *Agent) GetGoogleCalendarEmail() string {
	if a.GoogleToken == "" {
		return ""
	}

	var tokenData struct {
		AccessToken  string `json:"access_token"`
		TokenType    string `json:"token_type"`
		RefreshToken string `json:"refresh_token"`
		Expiry       string `json:"expiry"`
	}

	if err := json.Unmarshal([]byte(a.GoogleToken), &tokenData); err != nil {
		return ""
	}

	return a.GoogleCalendarID
}

// IsMetaTokenExpired verifica si el token de Meta ha expirado
func (a *Agent) IsMetaTokenExpired() bool {
	if !a.MetaConnected || a.MetaTokenExpiresAt == nil {
		return true
	}
	return time.Now().After(*a.MetaTokenExpiresAt)
}

// GetMetaTokenDaysRemaining obtiene los días restantes del token de Meta
func (a *Agent) GetMetaTokenDaysRemaining() int {
	if !a.MetaConnected || a.MetaTokenExpiresAt == nil {
		return 0
	}

	duration := time.Until(*a.MetaTokenExpiresAt)
	days := int(duration.Hours() / 24)

	if days < 0 {
		return 0
	}

	return days
}
