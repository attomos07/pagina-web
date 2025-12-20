package models

import (
	"time"

	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
)

type User struct {
	ID           uint   `gorm:"primaryKey" json:"id"`
	FirstName    string `gorm:"size:100;not null" json:"firstName"`
	LastName     string `gorm:"size:100;not null" json:"lastName"`
	Email        string `gorm:"size:255;uniqueIndex;not null" json:"email"`
	Password     string `gorm:"size:255;not null" json:"-"`
	Company      string `gorm:"size:255" json:"company"`
	BusinessType string `gorm:"size:100" json:"businessType"`
	PhoneNumber  string `gorm:"size:50" json:"phoneNumber"`

	// Servidor Compartido de Hetzner
	SharedServerID       int    `gorm:"default:0" json:"sharedServerId"`
	SharedServerIP       string `gorm:"size:50" json:"sharedServerIp"`
	SharedServerPassword string `gorm:"size:255" json:"-"`
	SharedServerStatus   string `gorm:"size:50;default:pending" json:"sharedServerStatus"`

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

	CreatedAt time.Time      `json:"createdAt"`
	UpdatedAt time.Time      `json:"updatedAt"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`

	// Relación con GoogleCloudProject (nueva)
	GoogleCloudProject *GoogleCloudProject `gorm:"foreignKey:UserID" json:"googleCloudProject,omitempty"`
}

// HashPassword genera el hash de la contraseña
func (u *User) HashPassword(password string) error {
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return err
	}
	u.Password = string(hashedPassword)
	return nil
}

// CheckPassword verifica si la contraseña es correcta
func (u *User) CheckPassword(password string) bool {
	err := bcrypt.CompareHashAndPassword([]byte(u.Password), []byte(password))
	return err == nil
}

// TableName especifica el nombre de la tabla
func (User) TableName() string {
	return "users"
}

// IsMetaTokenExpired verifica si el token de Meta ha expirado
func (u *User) IsMetaTokenExpired() bool {
	if !u.MetaConnected || u.MetaTokenExpiresAt == nil {
		return true
	}
	return time.Now().After(*u.MetaTokenExpiresAt)
}

// GetMetaTokenDaysRemaining obtiene los días restantes del token de Meta
func (u *User) GetMetaTokenDaysRemaining() int {
	if !u.MetaConnected || u.MetaTokenExpiresAt == nil {
		return 0
	}

	duration := time.Until(*u.MetaTokenExpiresAt)
	days := int(duration.Hours() / 24)

	if days < 0 {
		return 0
	}

	return days
}

// HasGoogleCloudProject verifica si el usuario tiene un proyecto GCP
func (u *User) HasGoogleCloudProject() bool {
	return u.GoogleCloudProject != nil && u.GoogleCloudProject.ProjectID != ""
}

// GetGCPProjectStatus retorna el estado del proyecto GCP (helper para compatibilidad)
func (u *User) GetGCPProjectStatus() string {
	if u.GoogleCloudProject == nil {
		return "pending"
	}
	return u.GoogleCloudProject.ProjectStatus
}

// GetGeminiAPIKey retorna la API Key de Gemini (helper para compatibilidad)
func (u *User) GetGeminiAPIKey() string {
	if u.GoogleCloudProject == nil {
		return ""
	}
	return u.GoogleCloudProject.GeminiAPIKey
}
