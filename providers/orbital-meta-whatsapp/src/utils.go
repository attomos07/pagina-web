package src

import (
	"fmt"
	"log"
	"regexp"
	"strings"
	"time"
)

// FormatPhoneNumber formatea un número de teléfono
func FormatPhoneNumber(phone string) string {
	// Remover espacios, guiones y paréntesis
	phone = strings.ReplaceAll(phone, " ", "")
	phone = strings.ReplaceAll(phone, "-", "")
	phone = strings.ReplaceAll(phone, "(", "")
	phone = strings.ReplaceAll(phone, ")", "")
	phone = strings.ReplaceAll(phone, "+", "")

	return phone
}

// ValidatePhoneNumber valida que un número de teléfono sea válido
func ValidatePhoneNumber(phone string) bool {
	phone = FormatPhoneNumber(phone)

	// Debe tener entre 10 y 15 dígitos
	if len(phone) < 10 || len(phone) > 15 {
		return false
	}

	// Solo debe contener números
	matched, _ := regexp.MatchString(`^\d+$`, phone)
	return matched
}

// ExtractPhoneFromMessage extrae un número de teléfono de un mensaje
func ExtractPhoneFromMessage(message string) string {
	// Buscar patrones de teléfono
	patterns := []string{
		`\+?\d{1,3}[-.\s]?\(?\d{1,4}\)?[-.\s]?\d{1,4}[-.\s]?\d{1,9}`,
		`\d{10,15}`,
	}

	for _, pattern := range patterns {
		re := regexp.MustCompile(pattern)
		match := re.FindString(message)
		if match != "" {
			return FormatPhoneNumber(match)
		}
	}

	return ""
}

// ParseDateTime intenta parsear una fecha y hora del mensaje
func ParseDateTime(message string) (*time.Time, error) {
	// Formatos soportados
	formats := []string{
		"02/01/2006 15:04",
		"2006-01-02 15:04",
		"02-01-2006 15:04",
		"02/01/2006",
		"2006-01-02",
	}

	for _, format := range formats {
		if t, err := time.Parse(format, message); err == nil {
			return &t, nil
		}
	}

	return nil, fmt.Errorf("no se pudo parsear fecha/hora")
}

// IsBusinessHours verifica si la hora actual está dentro del horario de atención
func IsBusinessHours() bool {
	now := time.Now()

	// Horario: Lunes a Viernes 9:00 - 18:00
	if now.Weekday() == time.Saturday || now.Weekday() == time.Sunday {
		return false
	}

	hour := now.Hour()
	return hour >= 9 && hour < 18
}

// FormatDuration formatea una duración en minutos a texto
func FormatDuration(minutes int) string {
	if minutes < 60 {
		return fmt.Sprintf("%d minutos", minutes)
	}

	hours := minutes / 60
	remainingMinutes := minutes % 60

	if remainingMinutes == 0 {
		return fmt.Sprintf("%d hora(s)", hours)
	}

	return fmt.Sprintf("%d hora(s) %d minuto(s)", hours, remainingMinutes)
}

// TruncateString trunca un string a una longitud máxima
func TruncateString(s string, maxLength int) string {
	if len(s) <= maxLength {
		return s
	}

	return s[:maxLength-3] + "..."
}

// ContainsAny verifica si un string contiene alguna de las palabras clave
func ContainsAny(text string, keywords []string) bool {
	text = strings.ToLower(text)
	for _, keyword := range keywords {
		if strings.Contains(text, strings.ToLower(keyword)) {
			return true
		}
	}
	return false
}

// SanitizeInput sanitiza input del usuario
func SanitizeInput(input string) string {
	// Remover caracteres especiales peligrosos
	input = strings.ReplaceAll(input, "<", "")
	input = strings.ReplaceAll(input, ">", "")
	input = strings.ReplaceAll(input, "script", "")
	input = strings.ReplaceAll(input, "javascript:", "")

	return strings.TrimSpace(input)
}

// LogError registra un error con contexto
func LogError(context, message string, err error) {
	log.Printf("❌ [%s] %s: %v", context, message, err)
}

// LogInfo registra información
func LogInfo(context, message string) {
	log.Printf("ℹ️  [%s] %s", context, message)
}

// LogSuccess registra un éxito
func LogSuccess(context, message string) {
	log.Printf("✅ [%s] %s", context, message)
}

// LogWarning registra una advertencia
func LogWarning(context, message string) {
	log.Printf("⚠️  [%s] %s", context, message)
}

// GetCurrentTimeFormatted retorna la hora actual formateada
func GetCurrentTimeFormatted() string {
	return time.Now().Format("02/01/2006 15:04:05")
}

// GetDateFromDaysOffset retorna una fecha a partir de días de offset
func GetDateFromDaysOffset(days int) time.Time {
	return time.Now().AddDate(0, 0, days)
}

// IsWeekend verifica si una fecha es fin de semana
func IsWeekend(t time.Time) bool {
	return t.Weekday() == time.Saturday || t.Weekday() == time.Sunday
}

// GetNextBusinessDay obtiene el siguiente día hábil
func GetNextBusinessDay(t time.Time) time.Time {
	nextDay := t.AddDate(0, 0, 1)

	for IsWeekend(nextDay) {
		nextDay = nextDay.AddDate(0, 0, 1)
	}

	return nextDay
}

// FormatPrice formatea un precio
func FormatPrice(price float64) string {
	return fmt.Sprintf("$%.2f", price)
}

// GenerateConfirmationCode genera un código de confirmación
func GenerateConfirmationCode() string {
	return fmt.Sprintf("%d%02d%02d", time.Now().Year(), time.Now().Month(), time.Now().Day()) + fmt.Sprintf("%02d%02d", time.Now().Hour(), time.Now().Minute())
}

// NormalizeName normaliza un nombre (primera letra mayúscula)
func NormalizeName(name string) string {
	name = strings.TrimSpace(name)
	if name == "" {
		return name
	}

	words := strings.Fields(name)
	for i, word := range words {
		if len(word) > 0 {
			words[i] = strings.ToUpper(word[:1]) + strings.ToLower(word[1:])
		}
	}

	return strings.Join(words, " ")
}

// ValidateEmail valida un email
func ValidateEmail(email string) bool {
	emailRegex := regexp.MustCompile(`^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$`)
	return emailRegex.MatchString(email)
}

// ExtractEmailFromMessage extrae un email de un mensaje
func ExtractEmailFromMessage(message string) string {
	emailRegex := regexp.MustCompile(`[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}`)
	return emailRegex.FindString(message)
}

// GetDayOfWeekInSpanish retorna el día de la semana en español
func GetDayOfWeekInSpanish(t time.Time) string {
	days := map[time.Weekday]string{
		time.Monday:    "Lunes",
		time.Tuesday:   "Martes",
		time.Wednesday: "Miércoles",
		time.Thursday:  "Jueves",
		time.Friday:    "Viernes",
		time.Saturday:  "Sábado",
		time.Sunday:    "Domingo",
	}

	return days[t.Weekday()]
}

// GetMonthInSpanish retorna el mes en español
func GetMonthInSpanish(t time.Time) string {
	months := map[time.Month]string{
		time.January:   "Enero",
		time.February:  "Febrero",
		time.March:     "Marzo",
		time.April:     "Abril",
		time.May:       "Mayo",
		time.June:      "Junio",
		time.July:      "Julio",
		time.August:    "Agosto",
		time.September: "Septiembre",
		time.October:   "Octubre",
		time.November:  "Noviembre",
		time.December:  "Diciembre",
	}

	return months[t.Month()]
}
