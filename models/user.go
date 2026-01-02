package models

import (
	"time"

	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
)

type User struct {
	ID           uint   `gorm:"primaryKey" json:"id"`
	Email        string `gorm:"size:255;uniqueIndex;not null" json:"email"`
	Password     string `gorm:"size:255;not null" json:"-"`
	Company      string `gorm:"size:255" json:"company"`
	BusinessType string `gorm:"size:100" json:"businessType"`
	BusinessSize string `gorm:"size:50;index" json:"businessSize"`
	PhoneNumber  string `gorm:"size:50" json:"phoneNumber"`

	CreatedAt time.Time      `json:"createdAt"`
	UpdatedAt time.Time      `json:"updatedAt"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`

	// Relación con GoogleCloudProject
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

// HasGoogleCloudProject verifica si el usuario tiene un proyecto GCP
func (u *User) HasGoogleCloudProject() bool {
	return u.GoogleCloudProject != nil && u.GoogleCloudProject.ProjectID != ""
}

// GetGCPProjectStatus retorna el estado del proyecto GCP
func (u *User) GetGCPProjectStatus() string {
	if u.GoogleCloudProject == nil {
		return "pending"
	}
	return u.GoogleCloudProject.ProjectStatus
}

// GetGeminiAPIKey retorna la API Key de Gemini
func (u *User) GetGeminiAPIKey() string {
	if u.GoogleCloudProject == nil {
		return ""
	}
	return u.GoogleCloudProject.GeminiAPIKey
}
