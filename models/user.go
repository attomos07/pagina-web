package models

import (
	"time"

	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
)

// User representa el modelo de usuario en la base de datos
type User struct {
	ID           uint           `gorm:"primaryKey" json:"id"`
	FirstName    string         `gorm:"size:100;not null" json:"firstName"`
	LastName     string         `gorm:"size:100;not null" json:"lastName"`
	Email        string         `gorm:"size:255;uniqueIndex;not null" json:"email"`
	Password     string         `gorm:"size:255;not null" json:"-"` // No se expone en JSON
	Company      string         `gorm:"size:255" json:"company"`
	BusinessType string         `gorm:"size:100" json:"businessType"`
	CreatedAt    time.Time      `json:"createdAt"`
	UpdatedAt    time.Time      `json:"updatedAt"`
	DeletedAt    gorm.DeletedAt `gorm:"index" json:"-"`
}

// HashPassword encripta la contraseña del usuario
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

// BeforeCreate hook que se ejecuta antes de crear un usuario
func (u *User) BeforeCreate(tx *gorm.DB) error {
	// Validaciones adicionales si es necesario
	return nil
}

// TableName especifica el nombre de la tabla
func (User) TableName() string {
	return "users"
}