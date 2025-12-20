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
	AgentName    string      `json:"agentName"`
	BusinessType string      `json:"businessType"`
	PhoneNumber  string      `json:"phoneNumber"`
	Personality  Personality `json:"personality"`
	Schedule     Schedule    `json:"schedule"`
	Holidays     []Holiday   `json:"holidays"`
	Services     []Service   `json:"services"`
	Workers      []Worker    `json:"workers"`
	Location     Location    `json:"location"`
	SocialMedia  SocialMedia `json:"socialMedia"`
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
	Title         string  `json:"title"`
	Description   string  `json:"description"`
	PriceType     string  `json:"priceType"` // normal, promotion
	Price         float64 `json:"price,omitempty"`
	OriginalPrice float64 `json:"originalPrice,omitempty"`
	PromoPrice    float64 `json:"promoPrice,omitempty"`
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
	sb.WriteString(fmt.Sprintf("**INFORMACIÓN DEL NEGOCIO:**\n"))
	sb.WriteString(fmt.Sprintf("- Nombre: %s\n", BusinessCfg.AgentName))
	sb.WriteString(fmt.Sprintf("- Tipo: %s\n", BusinessCfg.BusinessType))

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
			if service.PriceType == "promotion" && service.PromoPrice > 0 {
				sb.WriteString(fmt.Sprintf("- %s: $%.2f (antes $%.2f) 🎉\n",
					service.Title, service.PromoPrice, service.OriginalPrice))
			} else {
				sb.WriteString(fmt.Sprintf("- %s: $%.2f\n", service.Title, service.Price))
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

// Zona horaria para Google Calendar
const TIMEZONE = "America/Hermosillo"

// Días de la semana
var DIAS_SEMANA = []string{"Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"}

// Horarios disponibles (se pueden cargar desde BusinessConfig si existen)
var HORARIOS = []string{
	"9:00 AM", "10:00 AM", "11:00 AM", "12:00 PM",
	"1:00 PM", "2:00 PM", "3:00 PM", "4:00 PM",
	"5:00 PM", "6:00 PM", "7:00 PM",
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
