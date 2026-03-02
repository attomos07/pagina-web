package handlers

import (
	"fmt"
	"net/http"
	"strings"
	"time"

	"attomos/config"
	"attomos/models"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

// ============================================================
// GetMyBusiness - Lee perfil desde my_business_info
// Si no existe aún (usuario antiguo), devuelve perfil vacío con datos del usuario
// ============================================================
func GetMyBusiness(c *gin.Context) {
	userInterface, exists := c.Get("user")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "No autenticado"})
		return
	}
	user := userInterface.(*models.User)

	var biz models.MyBusinessInfo
	err := config.DB.Where("user_id = ?", user.ID).First(&biz).Error

	if err != nil {
		if err == gorm.ErrRecordNotFound {
			// Usuario registrado antes de esta feature: devolver datos del usuario como base
			c.JSON(http.StatusOK, buildEmptyBusinessResponse(user))
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Error al obtener perfil"})
		return
	}

	c.JSON(http.StatusOK, buildBusinessResponse(&biz))
}

// ============================================================
// SaveMyBusiness - Guarda perfil en my_business_info y sincroniza agentes
// ============================================================
func SaveMyBusiness(c *gin.Context) {
	userInterface, exists := c.Get("user")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "No autenticado"})
		return
	}
	user := userInterface.(*models.User)

	var req ProfileRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Datos inválidos"})
		return
	}

	// Upsert en my_business_info
	var biz models.MyBusinessInfo
	err := config.DB.Where("user_id = ?", user.ID).First(&biz).Error

	if err == gorm.ErrRecordNotFound {
		// Crear nuevo registro
		biz = models.MyBusinessInfo{UserID: user.ID}
	} else if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Error al buscar perfil"})
		return
	}

	// Mapear request al modelo
	biz.BusinessName = req.Business.Name
	biz.BusinessType = req.Business.Type
	biz.Description = req.Business.Description
	biz.Website = req.Business.Website
	biz.Email = req.Business.Email

	biz.Location = models.BusinessLocation{
		Address:        req.Location.Address,
		BetweenStreets: req.Location.BetweenStreets,
		Number:         req.Location.Number,
		Neighborhood:   req.Location.Neighborhood,
		City:           req.Location.City,
		State:          req.Location.State,
		Country:        req.Location.Country,
		PostalCode:     req.Location.PostalCode,
	}

	biz.SocialMedia = models.BusinessSocialMedia{
		Facebook:  req.Social.Facebook,
		Instagram: req.Social.Instagram,
		Twitter:   req.Social.Twitter,
		LinkedIn:  req.Social.LinkedIn,
	}

	biz.Schedule = models.BusinessSchedule{
		Monday:    models.DaySchedule{Open: req.Schedule.Monday.IsOpen, Start: req.Schedule.Monday.Open, End: req.Schedule.Monday.Close},
		Tuesday:   models.DaySchedule{Open: req.Schedule.Tuesday.IsOpen, Start: req.Schedule.Tuesday.Open, End: req.Schedule.Tuesday.Close},
		Wednesday: models.DaySchedule{Open: req.Schedule.Wednesday.IsOpen, Start: req.Schedule.Wednesday.Open, End: req.Schedule.Wednesday.Close},
		Thursday:  models.DaySchedule{Open: req.Schedule.Thursday.IsOpen, Start: req.Schedule.Thursday.Open, End: req.Schedule.Thursday.Close},
		Friday:    models.DaySchedule{Open: req.Schedule.Friday.IsOpen, Start: req.Schedule.Friday.Open, End: req.Schedule.Friday.Close},
		Saturday:  models.DaySchedule{Open: req.Schedule.Saturday.IsOpen, Start: req.Schedule.Saturday.Open, End: req.Schedule.Saturday.Close},
		Sunday:    models.DaySchedule{Open: req.Schedule.Sunday.IsOpen, Start: req.Schedule.Sunday.Open, End: req.Schedule.Sunday.Close},
		Timezone:  "America/Hermosillo",
	}

	holidays := make(models.BusinessHolidays, len(req.Holidays))
	for i, h := range req.Holidays {
		year := time.Now().Year()
		holidays[i] = models.Holiday{
			Date: fmt.Sprintf("%d-%s-%s", year, h.Month, h.Day),
			Name: h.Name,
		}
	}
	biz.Holidays = holidays

	// Guardar (create or update)
	if biz.ID == 0 {
		if err := config.DB.Create(&biz).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Error al crear perfil: " + err.Error()})
			return
		}
	} else {
		if err := config.DB.Save(&biz).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Error al guardar perfil: " + err.Error()})
			return
		}
	}

	// Sincronizar agentes (si tiene) — no crítico, no bloquea la respuesta
	go syncAgentsWithBusiness(user.ID, req)

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "Perfil de negocio guardado exitosamente",
		"profile": buildBusinessResponse(&biz),
	})
}

// syncAgentsWithBusiness actualiza los agentes del usuario con los datos del perfil
func syncAgentsWithBusiness(userID uint, req ProfileRequest) {
	var agents []models.Agent
	if err := config.DB.Where("user_id = ?", userID).Find(&agents).Error; err != nil || len(agents) == 0 {
		return
	}

	config.DB.Transaction(func(tx *gorm.DB) error {
		for _, agent := range agents {
			agent.BusinessType = req.Business.Type
			updateConfigWithProfile(&agent.Config, req)
			tx.Save(&agent)
		}
		return nil
	})
}

// ============================================================
// buildBusinessResponse convierte MyBusinessInfo a respuesta JSON
// ============================================================
func buildBusinessResponse(biz *models.MyBusinessInfo) gin.H {
	holidays := make([]gin.H, len(biz.Holidays))
	for i, h := range biz.Holidays {
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
			"name":        biz.BusinessName,
			"type":        biz.BusinessType,
			"typeName":    getTypeName(biz.BusinessType),
			"size":        biz.BusinessSize,
			"description": biz.Description,
			"website":     biz.Website,
			"email":       biz.Email,
		},
		"schedule": gin.H{
			"monday":    dayToFrontend(biz.Schedule.Monday),
			"tuesday":   dayToFrontend(biz.Schedule.Tuesday),
			"wednesday": dayToFrontend(biz.Schedule.Wednesday),
			"thursday":  dayToFrontend(biz.Schedule.Thursday),
			"friday":    dayToFrontend(biz.Schedule.Friday),
			"saturday":  dayToFrontend(biz.Schedule.Saturday),
			"sunday":    dayToFrontend(biz.Schedule.Sunday),
		},
		"holidays": holidays,
		"location": gin.H{
			"address":        biz.Location.Address,
			"betweenStreets": biz.Location.BetweenStreets,
			"number":         biz.Location.Number,
			"neighborhood":   biz.Location.Neighborhood,
			"city":           biz.Location.City,
			"state":          biz.Location.State,
			"country":        biz.Location.Country,
			"postalCode":     biz.Location.PostalCode,
		},
		"social": gin.H{
			"facebook":  biz.SocialMedia.Facebook,
			"instagram": biz.SocialMedia.Instagram,
			"twitter":   biz.SocialMedia.Twitter,
			"linkedin":  biz.SocialMedia.LinkedIn,
		},
	}
}

func buildEmptyBusinessResponse(user *models.User) gin.H {
	defaultDay := gin.H{"isOpen": true, "open": "09:00", "close": "20:00"}
	return gin.H{
		"business": gin.H{
			"name":        user.Company,
			"type":        user.BusinessType,
			"typeName":    getTypeName(user.BusinessType),
			"size":        user.BusinessSize,
			"description": "",
			"website":     "",
			"email":       "",
		},
		"schedule": gin.H{
			"monday": defaultDay, "tuesday": defaultDay, "wednesday": defaultDay,
			"thursday": defaultDay, "friday": defaultDay, "saturday": defaultDay,
			"sunday": gin.H{"isOpen": false, "open": "09:00", "close": "20:00"},
		},
		"holidays": []gin.H{},
		"location": gin.H{
			"address": "", "betweenStreets": "", "number": "", "neighborhood": "",
			"city": "", "state": "", "country": "", "postalCode": "",
		},
		"social": gin.H{"facebook": "", "instagram": "", "twitter": "", "linkedin": ""},
	}
}

// ============================================================
// Helpers reutilizados (antes en profile.go)
// ============================================================

func updateConfigWithProfile(config *models.AgentConfig, req ProfileRequest) {
	config.BusinessInfo = models.BusinessProfileInfo{
		Description: req.Business.Description,
		Website:     req.Business.Website,
		Email:       req.Business.Email,
	}
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
	config.SocialMedia = models.SocialMediaProfile{
		Facebook:  req.Social.Facebook,
		Instagram: req.Social.Instagram,
		Twitter:   req.Social.Twitter,
		LinkedIn:  req.Social.LinkedIn,
	}
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
	config.Holidays = make([]models.Holiday, len(req.Holidays))
	for i, h := range req.Holidays {
		year := time.Now().Year()
		config.Holidays[i] = models.Holiday{
			Date: fmt.Sprintf("%d-%s-%s", year, h.Month, h.Day),
			Name: h.Name,
		}
	}
	config.Facilities = buildFacilities(req)
	config.WelcomeMessage = generateWelcome(req)
}

func convertToModelDay(day DayScheduleInfo) models.DaySchedule {
	return models.DaySchedule{Open: day.IsOpen, Start: day.Open, End: day.Close}
}

func buildFacilities(req ProfileRequest) []string {
	facilities := []string{}
	if req.Location.City != "" {
		facilities = append(facilities, "📍 "+buildAddress(req.Location))
	}
	if req.Business.Email != "" {
		facilities = append(facilities, "📧 "+req.Business.Email)
	}
	if req.Business.Website != "" {
		facilities = append(facilities, "🌐 "+req.Business.Website)
	}
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

func dayToFrontend(day models.DaySchedule) gin.H {
	return gin.H{"isOpen": day.Open, "open": day.Start, "close": day.End}
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
	defaultDay := gin.H{"isOpen": true, "open": "09:00", "close": "20:00"}
	return gin.H{
		"business": gin.H{"name": "", "type": "", "typeName": "", "description": "", "website": "", "email": ""},
		"schedule": gin.H{
			"monday": defaultDay, "tuesday": defaultDay, "wednesday": defaultDay,
			"thursday": defaultDay, "friday": defaultDay, "saturday": defaultDay,
			"sunday": gin.H{"isOpen": false, "open": "09:00", "close": "20:00"},
		},
		"holidays": []gin.H{},
		"location": gin.H{"address": "", "betweenStreets": "", "number": "", "neighborhood": "", "city": "", "state": "", "country": "", "postalCode": ""},
		"social":   gin.H{"facebook": "", "instagram": "", "twitter": "", "linkedin": ""},
	}
}

// ============================================================
// Structs de request (compatibilidad con el frontend existente)
// ============================================================

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
