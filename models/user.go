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

	// Google Cloud Project
	// CAMBIO: Usar *string (puntero) para permitir NULL en la base de datos
	// Esto soluciona el error de duplicate entry para valores vacíos
	GCPProjectID  *string `gorm:"size:255;unique" json:"-"`
	GeminiAPIKey  string  `gorm:"size:500" json:"-"`
	ProjectStatus string  `gorm:"size:50;default:pending" json:"projectStatus"` // pending, creating, ready, error

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
