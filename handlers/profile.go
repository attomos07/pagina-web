package handlers

import (
	"fmt"
	"net/http"
	"strings"
	"time"

	"attomos/models"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

// SaveProfile - Guarda perfil en Agent.Config (campos estructurados)
func SaveProfile(c *gin.Context) {
	db := c.MustGet("db").(*gorm.DB)
	userID := c.MustGet("userId").(uint)

	var req ProfileRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Datos inválidos"})
		return
	}

	// 1. Buscar TODOS los agentes
	var agents []models.Agent
	if err := db.Where("user_id = ?", userID).Find(&agents).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Error al buscar agentes"})
		return
	}

	if len(agents) == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "No tienes agentes creados."})
		return
	}

	// 2. Actualizar información básica de los agentes con transaction

	err := db.Transaction(func(tx *gorm.DB) error {
		for _, agent := range agents {
			// Update info
			agent.BusinessType = req.Business.Type

			updateConfigWithProfile(&agent.Config, req)

			// Guardar el agente en el loop especifico
			if err := tx.Save(&agent).Error; err != nil {
				return err // Rollback si se rompe en medio de las actualizaciones
			}
		}
		return nil
	})

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Error al actualizar agentes: " + err.Error()})
		return
	}

	fmt.Printf("✅ Perfil guardado para %d agentes\n", len(agents))

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": fmt.Sprintf("Se actualizaron %d agentes exitosamente", len(agents)),
	})
}

// updateConfigWithProfile - Actualiza el Config con los datos del perfil
func updateConfigWithProfile(config *models.AgentConfig, req ProfileRequest) {

	// 1. BusinessInfo
	config.BusinessInfo = models.BusinessProfileInfo{
		Description: req.Business.Description,
		Website:     req.Business.Website,
		Email:       req.Business.Email,
	}

	// 2. Location
	config.Location = models.LocationProfile{
		Address:        req.Location.Address,
		BetweenStreets: req.Location.BetweenStreets,
		Number:         req.Location.Number,
		Neighborhood:   req.Location.Neighborhood,
		City:           req.Location.City,
		State:          req.Location.State,
		Country:        req.Location.Country,
		PostalCode:     req.Location.PostalCode,
	}

	// 3. SocialMedia
	config.SocialMedia = models.SocialMediaProfile{
		Facebook:  req.Social.Facebook,
		Instagram: req.Social.Instagram,
		Twitter:   req.Social.Twitter,
		LinkedIn:  req.Social.LinkedIn,
	}

	// 4. Schedule
	config.Schedule = models.Schedule{
		Monday:    convertToModelDay(req.Schedule.Monday),
		Tuesday:   convertToModelDay(req.Schedule.Tuesday),
		Wednesday: convertToModelDay(req.Schedule.Wednesday),
		Thursday:  convertToModelDay(req.Schedule.Thursday),
		Friday:    convertToModelDay(req.Schedule.Friday),
		Saturday:  convertToModelDay(req.Schedule.Saturday),
		Sunday:    convertToModelDay(req.Schedule.Sunday),
		Timezone:  "America/Hermosillo",
	}

	// 5. Holidays
	config.Holidays = make([]models.Holiday, len(req.Holidays))
	for i, h := range req.Holidays {
		year := time.Now().Year()
		config.Holidays[i] = models.Holiday{
			Date: fmt.Sprintf("%d-%s-%s", year, h.Month, h.Day),
			Name: h.Name,
		}
	}

	// 6. Facilities (resumen legible)
	config.Facilities = buildFacilities(req)

	// 7. WelcomeMessage
	config.WelcomeMessage = generateWelcome(req)
}

func convertToModelDay(day DayScheduleInfo) models.DaySchedule {
	return models.DaySchedule{
		Open:  day.IsOpen,
		Start: day.Open,
		End:   day.Close,
	}
}

func buildFacilities(req ProfileRequest) []string {
	facilities := []string{}

	// Ubicación
	if req.Location.City != "" {
		addr := buildAddress(req.Location)
		facilities = append(facilities, "📍 "+addr)
	}

	// Contacto
	if req.Business.Email != "" {
		facilities = append(facilities, "📧 "+req.Business.Email)
	}
	if req.Business.Website != "" {
		facilities = append(facilities, "🌐 "+req.Business.Website)
	}

	// Redes
	socials := []string{}
	if req.Social.Facebook != "" {
		socials = append(socials, "Facebook")
	}
	if req.Social.Instagram != "" {
		socials = append(socials, "Instagram")
	}
	if req.Social.Twitter != "" {
		socials = append(socials, "Twitter")
	}
	if req.Social.LinkedIn != "" {
		socials = append(socials, "LinkedIn")
	}
	if len(socials) > 0 {
		facilities = append(facilities, "📱 "+strings.Join(socials, ", "))
	}

	return facilities
}

func buildAddress(loc LocationInfo) string {
	parts := []string{}
	if loc.Address != "" {
		parts = append(parts, loc.Address)
	}
	if loc.Number != "" {
		parts = append(parts, loc.Number)
	}
	if loc.Neighborhood != "" {
		parts = append(parts, loc.Neighborhood)
	}
	if loc.City != "" {
		parts = append(parts, loc.City)
	}
	if loc.State != "" {
		parts = append(parts, loc.State)
	}
	return strings.Join(parts, ", ")
}

func generateWelcome(req ProfileRequest) string {
	msg := fmt.Sprintf("¡Bienvenido a %s!", req.Business.Name)
	if req.Business.Description != "" {
		msg += " " + req.Business.Description
	}
	if req.Location.City != "" {
		msg += fmt.Sprintf(" Estamos en %s.", req.Location.City)
	}
	msg += " ¿En qué puedo ayudarte?"
	return msg
}

// GetProfile - Obtiene perfil desde Agent.Config
func GetProfile(c *gin.Context) {
	db := c.MustGet("db").(*gorm.DB)
	userID := c.MustGet("userId").(uint)

	var agent models.Agent
	if err := db.Where("user_id = ?", userID).First(&agent).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusOK, getEmptyProfile())
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Error al buscar agente"})
		return
	}

	response := configToProfileResponse(agent)
	c.JSON(http.StatusOK, response)
}

func configToProfileResponse(agent models.Agent) gin.H {
	cfg := agent.Config

	// Convertir schedule
	schedule := gin.H{
		"monday":    dayToFrontend(cfg.Schedule.Monday),
		"tuesday":   dayToFrontend(cfg.Schedule.Tuesday),
		"wednesday": dayToFrontend(cfg.Schedule.Wednesday),
		"thursday":  dayToFrontend(cfg.Schedule.Thursday),
		"friday":    dayToFrontend(cfg.Schedule.Friday),
		"saturday":  dayToFrontend(cfg.Schedule.Saturday),
		"sunday":    dayToFrontend(cfg.Schedule.Sunday),
	}

	// Convertir holidays
	holidays := make([]gin.H, len(cfg.Holidays))
	for i, h := range cfg.Holidays {
		month, day := parseDate(h.Date)
		holidays[i] = gin.H{
			"month": month,
			"day":   day,
			"name":  h.Name,
			"date":  fmt.Sprintf("%s/%s", day, month),
		}
	}

	return gin.H{
		"business": gin.H{
			"name":        agent.Name,
			"type":        agent.BusinessType,
			"typeName":    getTypeName(agent.BusinessType),
			"description": cfg.BusinessInfo.Description,
			"website":     cfg.BusinessInfo.Website,
			"email":       cfg.BusinessInfo.Email,
		},
		"schedule": schedule,
		"holidays": holidays,
		"location": gin.H{
			"address":        cfg.Location.Address,
			"betweenStreets": cfg.Location.BetweenStreets,
			"number":         cfg.Location.Number,
			"neighborhood":   cfg.Location.Neighborhood,
			"city":           cfg.Location.City,
			"state":          cfg.Location.State,
			"country":        cfg.Location.Country,
			"postalCode":     cfg.Location.PostalCode,
		},
		"social": gin.H{
			"facebook":  cfg.SocialMedia.Facebook,
			"instagram": cfg.SocialMedia.Instagram,
			"twitter":   cfg.SocialMedia.Twitter,
			"linkedin":  cfg.SocialMedia.LinkedIn,
		},
	}
}

func dayToFrontend(day models.DaySchedule) gin.H {
	return gin.H{
		"isOpen": day.Open,
		"open":   day.Start,
		"close":  day.End,
	}
}

func parseDate(date string) (month, day string) {
	parts := strings.Split(date, "-")
	if len(parts) == 3 {
		return parts[1], parts[2]
	}
	return "01", "01"
}

func getTypeName(code string) string {
	types := map[string]string{
		"clinica-dental": "Clínica Dental",
		"peluqueria":     "Peluquería / Salón de Belleza",
		"restaurante":    "Restaurante",
		"pizzeria":       "Pizzería",
		"escuela":        "Escuela / Educación",
		"gym":            "Gimnasio / Fitness",
		"spa":            "Spa / Wellness",
		"consultorio":    "Consultorio Médico",
		"veterinaria":    "Veterinaria",
		"hotel":          "Hotel / Hospedaje",
		"tienda":         "Tienda / Retail",
		"agencia":        "Agencia / Servicios",
		"otro":           "Otro",
	}
	if name, ok := types[code]; ok {
		return name
	}
	return code
}

func getEmptyProfile() gin.H {
	defaultDay := gin.H{
		"isOpen": true,
		"open":   "09:00",
		"close":  "20:00",
	}

	return gin.H{
		"business": gin.H{
			"name":        "",
			"type":        "",
			"typeName":    "",
			"description": "",
			"website":     "",
			"email":       "",
		},
		"schedule": gin.H{
			"monday":    defaultDay,
			"tuesday":   defaultDay,
			"wednesday": defaultDay,
			"thursday":  defaultDay,
			"friday":    defaultDay,
			"saturday":  defaultDay,
			"sunday": gin.H{
				"isOpen": false,
				"open":   "09:00",
				"close":  "20:00",
			},
		},
		"holidays": []gin.H{},
		"location": gin.H{
			"address":        "",
			"betweenStreets": "",
			"number":         "",
			"neighborhood":   "",
			"city":           "",
			"state":          "",
			"country":        "",
			"postalCode":     "",
		},
		"social": gin.H{
			"facebook":  "",
			"instagram": "",
			"twitter":   "",
			"linkedin":  "",
		},
	}
}

// Structs de request (mismos de antes)
type ProfileRequest struct {
	Business BusinessInfo  `json:"business"`
	Schedule ScheduleInfo  `json:"schedule"`
	Holidays []HolidayInfo `json:"holidays"`
	Location LocationInfo  `json:"location"`
	Social   SocialInfo    `json:"social"`
}

type BusinessInfo struct {
	Name        string `json:"name"`
	Type        string `json:"type"`
	Description string `json:"description"`
	Website     string `json:"website"`
	Email       string `json:"email"`
}

type ScheduleInfo struct {
	Monday    DayScheduleInfo `json:"monday"`
	Tuesday   DayScheduleInfo `json:"tuesday"`
	Wednesday DayScheduleInfo `json:"wednesday"`
	Thursday  DayScheduleInfo `json:"thursday"`
	Friday    DayScheduleInfo `json:"friday"`
	Saturday  DayScheduleInfo `json:"saturday"`
	Sunday    DayScheduleInfo `json:"sunday"`
}

type DayScheduleInfo struct {
	IsOpen bool   `json:"isOpen"`
	Open   string `json:"open"`
	Close  string `json:"close"`
}

type HolidayInfo struct {
	Month string `json:"month"`
	Day   string `json:"day"`
	Name  string `json:"name"`
	Date  string `json:"date"`
}

type LocationInfo struct {
	Address        string `json:"address"`
	BetweenStreets string `json:"betweenStreets"`
	Number         string `json:"number"`
	Neighborhood   string `json:"neighborhood"`
	City           string `json:"city"`
	State          string `json:"state"`
	Country        string `json:"country"`
	PostalCode     string `json:"postalCode"`
}

type SocialInfo struct {
	Facebook  string `json:"facebook"`
	Instagram string `json:"instagram"`
	Twitter   string `json:"twitter"`
	LinkedIn  string `json:"linkedin"`
}
