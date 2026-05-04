package src

import (
	"encoding/json"
	"fmt"
	"os"
	"strings"
)

// ============================================
// ESTRUCTURAS DE CONFIGURACIÓN DEL NEGOCIO
// ============================================

// BusinessConfig contiene toda la configuración del negocio
type BusinessConfig struct {
	AgentName    string `json:"agentName"`
	BusinessType string `json:"businessType"`
	PhoneNumber  string `json:"phoneNumber"`
	Website      string `json:"website,omitempty"`
	Email        string `json:"email,omitempty"`
	Description  string `json:"description,omitempty"`
	// URLs de imágenes y menú del negocio
	MenuUrl     string      `json:"menuUrl,omitempty"`
	LogoUrl     string      `json:"logoUrl,omitempty"`
	BannerUrl   string      `json:"bannerUrl,omitempty"`
	Personality Personality `json:"personality"`
	Schedule    Schedule    `json:"schedule"`
	Holidays    []Holiday   `json:"holidays"`
	Services    []Service   `json:"services"`
	Workers     []Worker    `json:"workers"`
	Location    Location    `json:"location"`
	SocialMedia SocialMedia `json:"socialMedia"`
}

// Personality define la personalidad del bot
type Personality struct {
	Tone                string   `json:"tone"` // formal, friendly, casual, custom
	CustomTone          string   `json:"customTone"`
	AdditionalLanguages []string `json:"additionalLanguages"`
}

// Schedule representa el horario semanal
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

// DaySchedule representa el horario de un día
type DaySchedule struct {
	Open  bool   `json:"open"`
	Start string `json:"start"` // Formato HH:MM
	End   string `json:"end"`   // Formato HH:MM
}

// Holiday representa un día festivo
type Holiday struct {
	Date string `json:"date"` // Formato YYYY-MM-DD
	Name string `json:"name"`
}

// Service representa un servicio/producto
type Service struct {
	Title         string   `json:"title"`
	Description   string   `json:"description"`
	PriceType     string   `json:"priceType"` // normal, promotion
	Price         float64  `json:"price,omitempty"`
	OriginalPrice float64  `json:"originalPrice,omitempty"`
	PromoPrice    float64  `json:"promoPrice,omitempty"`
	ImageUrls     []string `json:"imageUrls,omitempty"`
	InStock       bool     `json:"inStock"` // true = en existencia, false = agotado
}

// Worker representa un trabajador
type Worker struct {
	Name      string   `json:"name"`
	StartTime string   `json:"startTime"`
	EndTime   string   `json:"endTime"`
	Days      []string `json:"days"` // monday, tuesday, etc.
}

// Location representa la ubicación del negocio
type Location struct {
	Address        string `json:"address"`
	Number         string `json:"number"`
	Neighborhood   string `json:"neighborhood"`
	City           string `json:"city"`
	State          string `json:"state"`
	Country        string `json:"country"`
	PostalCode     string `json:"postalCode"`
	BetweenStreets string `json:"betweenStreets"`
}

// SocialMedia representa las redes sociales
type SocialMedia struct {
	Facebook  string `json:"facebook"`
	Instagram string `json:"instagram"`
	Twitter   string `json:"twitter"`
	LinkedIn  string `json:"linkedin"`
}

// ============================================
// VARIABLES GLOBALES
// ============================================

var BusinessCfg *BusinessConfig

// ============================================
// CARGAR CONFIGURACIÓN
// ============================================

// LoadBusinessConfig carga la configuración del negocio desde JSON
func LoadBusinessConfig() error {
	configPath := os.Getenv("BUSINESS_CONFIG_PATH")
	if configPath == "" {
		configPath = "business_config.json"
	}

	data, err := os.ReadFile(configPath)
	if err != nil {
		return fmt.Errorf("error leyendo configuración: %w", err)
	}

	var config BusinessConfig
	if err := json.Unmarshal(data, &config); err != nil {
		return fmt.Errorf("error parseando configuración: %w", err)
	}

	BusinessCfg = &config

	// Refrescar horarios disponibles con la config del negocio
	HORARIOS = getHorarios()

	return nil
}

// ============================================
// HELPERS PARA GENERAR PROMPTS
// ============================================

// GetBusinessInfoPrompt genera la sección de información del negocio para el prompt
func GetBusinessInfoPrompt() string {
	if BusinessCfg == nil {
		return ""
	}

	var sb strings.Builder

	// Información básica
	sb.WriteString("**INFORMACIÓN DEL NEGOCIO:**\n")
	sb.WriteString(fmt.Sprintf("- Nombre: %s\n", BusinessCfg.AgentName))
	sb.WriteString(fmt.Sprintf("- Tipo: %s\n", BusinessCfg.BusinessType))
	if BusinessCfg.Description != "" {
		sb.WriteString(fmt.Sprintf("- Descripción: %s\n", BusinessCfg.Description))
	}
	if BusinessCfg.Website != "" {
		sb.WriteString(fmt.Sprintf("- Sitio Web: %s\n", BusinessCfg.Website))
	}
	if BusinessCfg.Email != "" {
		sb.WriteString(fmt.Sprintf("- Email de contacto: %s\n", BusinessCfg.Email))
	}

	// Ubicación
	if BusinessCfg.Location.Address != "" {
		sb.WriteString("\n**UBICACIÓN:**\n")
		if BusinessCfg.Location.Address != "" {
			sb.WriteString(fmt.Sprintf("- Dirección: %s", BusinessCfg.Location.Address))
			if BusinessCfg.Location.Number != "" {
				sb.WriteString(fmt.Sprintf(" #%s", BusinessCfg.Location.Number))
			}
			sb.WriteString("\n")
		}
		if BusinessCfg.Location.Neighborhood != "" {
			sb.WriteString(fmt.Sprintf("- Colonia: %s\n", BusinessCfg.Location.Neighborhood))
		}
		if BusinessCfg.Location.City != "" && BusinessCfg.Location.State != "" {
			sb.WriteString(fmt.Sprintf("- Ciudad: %s, %s\n", BusinessCfg.Location.City, BusinessCfg.Location.State))
		}
		if BusinessCfg.Location.BetweenStreets != "" {
			sb.WriteString(fmt.Sprintf("- %s\n", BusinessCfg.Location.BetweenStreets))
		}
	}

	// Horarios
	sb.WriteString("\n**HORARIOS DE ATENCIÓN:**\n")
	days := []struct {
		name  string
		sched DaySchedule
	}{
		{"Lunes", BusinessCfg.Schedule.Monday},
		{"Martes", BusinessCfg.Schedule.Tuesday},
		{"Miércoles", BusinessCfg.Schedule.Wednesday},
		{"Jueves", BusinessCfg.Schedule.Thursday},
		{"Viernes", BusinessCfg.Schedule.Friday},
		{"Sábado", BusinessCfg.Schedule.Saturday},
		{"Domingo", BusinessCfg.Schedule.Sunday},
	}

	for _, day := range days {
		if day.sched.Open {
			sb.WriteString(fmt.Sprintf("- %s: %s - %s\n", day.name, day.sched.Start, day.sched.End))
		}
	}

	// Días festivos
	if len(BusinessCfg.Holidays) > 0 {
		sb.WriteString("\n**DÍAS FESTIVOS (CERRADO):**\n")
		for _, holiday := range BusinessCfg.Holidays {
			sb.WriteString(fmt.Sprintf("- %s: %s\n", holiday.Date, holiday.Name))
		}
	}

	// Servicios
	if len(BusinessCfg.Services) > 0 {
		sb.WriteString("\n**SERVICIOS Y PRECIOS:**\n")
		for _, service := range BusinessCfg.Services {
			stockLabel := ""
			if !service.InStock {
				stockLabel = " ❌ AGOTADO"
			}
			if service.PriceType == "promotion" && service.PromoPrice > 0 {
				sb.WriteString(fmt.Sprintf("- %s: $%.2f (antes $%.2f) 🎉%s\n",
					service.Title, service.PromoPrice, service.OriginalPrice, stockLabel))
			} else {
				sb.WriteString(fmt.Sprintf("- %s: $%.2f%s\n", service.Title, service.Price, stockLabel))
			}
			if service.Description != "" {
				// Limpiar HTML del description
				desc := strings.ReplaceAll(service.Description, "<br>", " ")
				desc = strings.ReplaceAll(desc, "</p>", " ")
				desc = strings.ReplaceAll(desc, "<p>", "")
				desc = strings.TrimSpace(desc)
				if desc != "" {
					sb.WriteString(fmt.Sprintf("  %s\n", desc))
				}
			}
		}
	}

	// Trabajadores
	if len(BusinessCfg.Workers) > 0 {
		sb.WriteString("\n**PERSONAL DISPONIBLE:**\n")
		for _, worker := range BusinessCfg.Workers {
			dayNames := make([]string, 0)
			for _, day := range worker.Days {
				switch day {
				case "monday":
					dayNames = append(dayNames, "Lunes")
				case "tuesday":
					dayNames = append(dayNames, "Martes")
				case "wednesday":
					dayNames = append(dayNames, "Miércoles")
				case "thursday":
					dayNames = append(dayNames, "Jueves")
				case "friday":
					dayNames = append(dayNames, "Viernes")
				case "saturday":
					dayNames = append(dayNames, "Sábado")
				case "sunday":
					dayNames = append(dayNames, "Domingo")
				}
			}
			sb.WriteString(fmt.Sprintf("- %s: %s a %s (%s)\n",
				worker.Name, worker.StartTime, worker.EndTime, strings.Join(dayNames, ", ")))
		}
	}

	// Redes sociales
	if BusinessCfg.SocialMedia.Facebook != "" || BusinessCfg.SocialMedia.Instagram != "" {
		sb.WriteString("\n**REDES SOCIALES:**\n")
		if BusinessCfg.SocialMedia.Facebook != "" {
			sb.WriteString(fmt.Sprintf("- Facebook: %s\n", BusinessCfg.SocialMedia.Facebook))
		}
		if BusinessCfg.SocialMedia.Instagram != "" {
			sb.WriteString(fmt.Sprintf("- Instagram: %s\n", BusinessCfg.SocialMedia.Instagram))
		}
		if BusinessCfg.SocialMedia.Twitter != "" {
			sb.WriteString(fmt.Sprintf("- Twitter/X: %s\n", BusinessCfg.SocialMedia.Twitter))
		}
		if BusinessCfg.SocialMedia.LinkedIn != "" {
			sb.WriteString(fmt.Sprintf("- LinkedIn: %s\n", BusinessCfg.SocialMedia.LinkedIn))
		}
	}

	return sb.String()
}

// GetPersonalityPrompt genera la sección de personalidad para el prompt
func GetPersonalityPrompt() string {
	if BusinessCfg == nil {
		return "Sé profesional, amigable y servicial."
	}

	var personality string

	switch BusinessCfg.Personality.Tone {
	case "formal":
		personality = "Sé formal, profesional y cortés. Usa usted y mantenga un tono respetuoso."
	case "friendly":
		personality = "Sé amigable, cercano y cálido. Usa un tono acogedor pero profesional."
	case "casual":
		personality = "Sé relajado, informal y cercano. Puedes usar tú y un lenguaje más desenfadado."
	case "custom":
		if BusinessCfg.Personality.CustomTone != "" {
			// Limpiar HTML del custom tone
			personality = strings.ReplaceAll(BusinessCfg.Personality.CustomTone, "<br>", " ")
			personality = strings.ReplaceAll(personality, "</p>", " ")
			personality = strings.ReplaceAll(personality, "<p>", "")
			personality = strings.TrimSpace(personality)
		} else {
			personality = "Sé profesional, amigable y servicial."
		}
	default:
		personality = "Sé profesional, amigable y servicial."
	}

	// Agregar idiomas adicionales
	if len(BusinessCfg.Personality.AdditionalLanguages) > 0 {
		langs := make([]string, 0)
		for _, lang := range BusinessCfg.Personality.AdditionalLanguages {
			switch lang {
			case "en":
				langs = append(langs, "inglés")
			case "fr":
				langs = append(langs, "francés")
			case "pt":
				langs = append(langs, "portugués")
			case "de":
				langs = append(langs, "alemán")
			case "it":
				langs = append(langs, "italiano")
			case "zh":
				langs = append(langs, "chino")
			}
		}
		if len(langs) > 0 {
			personality += fmt.Sprintf(" Puedes responder en español y también en %s si el cliente lo solicita.",
				strings.Join(langs, ", "))
		}
	}

	return personality
}

// GetSystemPrompt genera el prompt del sistema completo
func GetSystemPrompt() string {
	if BusinessCfg == nil {
		return "Eres un asistente virtual útil y profesional."
	}

	businessInfo := GetBusinessInfoPrompt()
	personality := GetPersonalityPrompt()

	prompt := fmt.Sprintf(`Eres el asistente virtual de %s, un %s.

**TU PERSONALIDAD:**
%s

%s

**REGLAS IMPORTANTES:**
- Responde de manera natural y conversacional
- Proporciona información precisa sobre horarios, servicios y precios
- Si te preguntan sobre algo que no está en la información del negocio, dilo claramente
- Sé breve y conciso en tus respuestas (máximo 3-4 líneas)
- Usa emojis ocasionalmente para hacer las respuestas más amigables
- Si el cliente quiere agendar una cita, recopila: nombre, servicio deseado, fecha y hora preferida
- NUNCA inventes información que no esté en los datos del negocio

**RECUERDA:**
Tu objetivo es ayudar a los clientes de manera efectiva y representar bien al negocio.`,
		BusinessCfg.AgentName,
		BusinessCfg.BusinessType,
		personality,
		businessInfo)

	return prompt
}

// IsBusinessOpen verifica si el negocio está abierto en este momento
func IsBusinessOpen() bool {
	if BusinessCfg == nil {
		return true
	}

	// TODO: Implementar lógica real de verificación de horarios
	// Por ahora retornamos true
	return true
}

// GetAvailableServices retorna la lista de servicios formateada
func GetAvailableServices() string {
	if BusinessCfg == nil || len(BusinessCfg.Services) == 0 {
		return "No hay servicios configurados."
	}

	var sb strings.Builder
	sb.WriteString("Servicios disponibles:\n\n")

	for i, service := range BusinessCfg.Services {
		sb.WriteString(fmt.Sprintf("%d. %s", i+1, service.Title))

		if service.PriceType == "promotion" && service.PromoPrice > 0 {
			sb.WriteString(fmt.Sprintf(" - $%.2f (antes $%.2f) 🎉\n", service.PromoPrice, service.OriginalPrice))
		} else {
			sb.WriteString(fmt.Sprintf(" - $%.2f\n", service.Price))
		}
	}

	return sb.String()
}

// ============================================
// CONSTANTES PARA SHEETS Y CALENDAR
// ============================================

// GetTimezone retorna el timezone configurado en BusinessCfg, o Hermosillo como fallback
func GetTimezone() string {
	if BusinessCfg != nil && BusinessCfg.Schedule.Timezone != "" {
		return BusinessCfg.Schedule.Timezone
	}
	return "America/Hermosillo"
}

// Días de la semana
var DIAS_SEMANA = []string{"Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"}

// horariosFallback son los horarios por defecto si no hay config del negocio
var horariosFallback = []string{
	"9:00 AM", "10:00 AM", "11:00 AM", "12:00 PM",
	"1:00 PM", "2:00 PM", "3:00 PM", "4:00 PM",
	"5:00 PM", "6:00 PM", "7:00 PM",
}

// HORARIOS disponibles — se inicializa con fallback y se recarga en LoadBusinessConfig
var HORARIOS = horariosFallback

func getHorarios() []string {
	if BusinessCfg == nil {
		return horariosFallback
	}

	// Determinar apertura y cierre más amplios entre los días abiertos
	earliest := 9 // hora de inicio por defecto
	latest := 19  // hora de cierre por defecto (7 PM)

	days := []DaySchedule{
		BusinessCfg.Schedule.Monday,
		BusinessCfg.Schedule.Tuesday,
		BusinessCfg.Schedule.Wednesday,
		BusinessCfg.Schedule.Thursday,
		BusinessCfg.Schedule.Friday,
		BusinessCfg.Schedule.Saturday,
		BusinessCfg.Schedule.Sunday,
	}

	found := false
	for _, day := range days {
		if !day.Open || day.Start == "" || day.End == "" {
			continue
		}
		var startH, startM, endH, endM int
		fmt.Sscanf(day.Start, "%d:%d", &startH, &startM)
		fmt.Sscanf(day.End, "%d:%d", &endH, &endM)
		if !found {
			earliest = startH
			latest = endH
			found = true
		} else {
			if startH < earliest {
				earliest = startH
			}
			if endH > latest {
				latest = endH
			}
		}
	}

	if !found {
		return horariosFallback
	}

	// Generar slots cada hora dentro del rango
	var slots []string
	for h := earliest; h < latest; h++ {
		if h == 0 {
			slots = append(slots, "12:00 AM")
		} else if h < 12 {
			slots = append(slots, fmt.Sprintf("%d:00 AM", h))
		} else if h == 12 {
			slots = append(slots, "12:00 PM")
		} else {
			slots = append(slots, fmt.Sprintf("%d:00 PM", h-12))
		}
	}

	if len(slots) == 0 {
		return horariosFallback
	}
	return slots
}

// Mapeo de columnas en Google Sheets
var COLUMNAS_DIAS = map[string]string{
	"lunes":     "B",
	"martes":    "C",
	"miércoles": "D",
	"miercoles": "D",
	"jueves":    "E",
	"viernes":   "F",
	"sábado":    "G",
	"sabado":    "G",
	"domingo":   "H",
}

// GetFilaHora obtiene el número de fila para una hora específica
func GetFilaHora(hora string) int {
	for i, h := range HORARIOS {
		if h == hora {
			return i + 2 // +2 porque la fila 1 son headers
		}
	}
	return -1
}
