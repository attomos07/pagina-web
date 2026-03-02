package models

import (
	"database/sql/driver"
	"encoding/json"
	"time"

	"gorm.io/gorm"
)

// BusinessSchedule almacena el horario semanal del negocio en JSON
type BusinessSchedule struct {
	Monday    DaySchedule `json:"monday"`
	Tuesday   DaySchedule `json:"tuesday"`
	Wednesday DaySchedule `json:"wednesday"`
	Thursday  DaySchedule `json:"thursday"`
	Friday    DaySchedule `json:"friday"`
	Saturday  DaySchedule `json:"saturday"`
	Sunday    DaySchedule `json:"sunday"`
	Timezone  string      `json:"timezone"`
}

func (bs BusinessSchedule) Value() (driver.Value, error) { return json.Marshal(bs) }
func (bs *BusinessSchedule) Scan(v interface{}) error {
	if b, ok := v.([]byte); ok {
		return json.Unmarshal(b, bs)
	}
	return nil
}

// BusinessHolidays almacena los días festivos en JSON
type BusinessHolidays []Holiday

func (bh BusinessHolidays) Value() (driver.Value, error) { return json.Marshal(bh) }
func (bh *BusinessHolidays) Scan(v interface{}) error {
	if b, ok := v.([]byte); ok {
		return json.Unmarshal(b, bh)
	}
	return nil
}

// BusinessSocialMedia almacena las redes sociales en JSON
type BusinessSocialMedia struct {
	Facebook  string `json:"facebook"`
	Instagram string `json:"instagram"`
	Twitter   string `json:"twitter"`
	LinkedIn  string `json:"linkedin"`
}

func (bsm BusinessSocialMedia) Value() (driver.Value, error) { return json.Marshal(bsm) }
func (bsm *BusinessSocialMedia) Scan(v interface{}) error {
	if b, ok := v.([]byte); ok {
		return json.Unmarshal(b, bsm)
	}
	return nil
}

// BusinessLocation almacena la ubicación en JSON
type BusinessLocation struct {
	Address        string `json:"address"`
	BetweenStreets string `json:"betweenStreets"`
	Number         string `json:"number"`
	Neighborhood   string `json:"neighborhood"`
	City           string `json:"city"`
	State          string `json:"state"`
	Country        string `json:"country"`
	PostalCode     string `json:"postalCode"`
}

func (bl BusinessLocation) Value() (driver.Value, error) { return json.Marshal(bl) }
func (bl *BusinessLocation) Scan(v interface{}) error {
	if b, ok := v.([]byte); ok {
		return json.Unmarshal(b, bl)
	}
	return nil
}

// MyBusinessInfo es la tabla principal del perfil del negocio del usuario.
// Se crea automáticamente al registrarse y es independiente de tener agentes.
type MyBusinessInfo struct {
	ID     uint `gorm:"primaryKey" json:"id"`
	UserID uint `gorm:"not null;uniqueIndex" json:"userId"`

	// Datos básicos (poblados desde el registro)
	BusinessName string `gorm:"size:255" json:"businessName"`
	BusinessType string `gorm:"size:100" json:"businessType"`
	BusinessSize string `gorm:"size:50" json:"businessSize"`

	// Información de contacto del negocio
	Description string `gorm:"type:text" json:"description"`
	Website     string `gorm:"size:500" json:"website"`
	Email       string `gorm:"size:255" json:"email"`

	// Campos JSON
	Location    BusinessLocation    `gorm:"type:json" json:"location"`
	SocialMedia BusinessSocialMedia `gorm:"type:json" json:"socialMedia"`
	Schedule    BusinessSchedule    `gorm:"type:json" json:"schedule"`
	Holidays    BusinessHolidays    `gorm:"type:json" json:"holidays"`

	// Timestamps
	CreatedAt time.Time      `json:"createdAt"`
	UpdatedAt time.Time      `json:"updatedAt"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`

	// Relación con User
	User User `gorm:"foreignKey:UserID" json:"-"`
}

func (MyBusinessInfo) TableName() string {
	return "my_business_info"
}
