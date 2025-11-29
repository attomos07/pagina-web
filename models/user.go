package models

import (
	"time"

	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
)

type User struct {
	ID           uint   `gorm:"primaryKey" json:"id"`
	FirstName    string `gorm:"size:100;not null" json:"firstName"` // REQUERIDO - Se usa BusinessName aquí
	LastName     string `gorm:"size:100;not null" json:"lastName"`  // REQUERIDO - Se deja vacío por ahora
	Email        string `gorm:"size:255;uniqueIndex;not null" json:"email"`
	Password     string `gorm:"size:255;not null" json:"-"`
	Company      string `gorm:"size:255" json:"company"`
	BusinessType string `gorm:"size:100" json:"businessType"`
	PhoneNumber  string `gorm:"size:50" json:"phoneNumber"` // Número de WhatsApp del negocio

	// Google Cloud Project
	GCPProjectID  *string `gorm:"size:255;unique" json:"-"`
	GeminiAPIKey  string  `gorm:"size:500" json:"-"`
	ProjectStatus string  `gorm:"size:50;default:pending" json:"projectStatus"` // pending, creating, ready, error

	// Servidor Compartido de Hetzner (todos los agentes del usuario)
	SharedServerID       int    `gorm:"default:0" json:"sharedServerId"`
	SharedServerIP       string `gorm:"size:50" json:"sharedServerIp"`
	SharedServerPassword string `gorm:"size:255" json:"-"`                                 // Root password del servidor
	SharedServerStatus   string `gorm:"size:50;default:pending" json:"sharedServerStatus"` // pending, creating, ready, error

	// Stripe
	StripeCustomerID     string     `gorm:"size:255" json:"-"`
	StripeSubscriptionID string     `gorm:"size:255" json:"-"`
	SubscriptionStatus   string     `gorm:"size:50" json:"subscriptionStatus"`             // active, canceled, past_due
	SubscriptionPlan     string     `gorm:"size:50;default:basic" json:"subscriptionPlan"` // basic, pro, enterprise
	CurrentPeriodEnd     *time.Time `json:"currentPeriodEnd"`

	CreatedAt time.Time      `json:"createdAt"`
	UpdatedAt time.Time      `json:"updatedAt"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`
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
