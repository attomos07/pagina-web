package src

import (
	"context"
	"fmt"
	"regexp"
	"strconv"
	"strings"
	"time"
	"unicode"

	"go.mau.fi/whatsmeow"
	"go.mau.fi/whatsmeow/types"
	"golang.org/x/text/runes"
	"golang.org/x/text/transform"
	"golang.org/x/text/unicode/norm"
	"google.golang.org/protobuf/proto"

	waProto "go.mau.fi/whatsmeow/binary/proto"
)

var client *whatsmeow.Client

// SetClient configura el cliente global de WhatsApp
func SetClient(c *whatsmeow.Client) {
	client = c
}

// SendMessage envía un mensaje de texto a un chat
func SendMessage(jid types.JID, text string) error {
	if client == nil {
		return fmt.Errorf("cliente no configurado")
	}

	msg := &waProto.Message{
		Conversation: proto.String(text),
	}

	_, err := client.SendMessage(context.Background(), jid, msg)
	return err
}

// NormalizeText normaliza texto quitando acentos y convirtiendo a minúsculas
func NormalizeText(text string) string {
	text = strings.ToLower(text)
	t := transform.Chain(norm.NFD, runes.Remove(runes.In(unicode.Mn)), norm.NFC)
	result, _, _ := transform.String(t, text)
	return strings.TrimSpace(result)
}

// ContainsKeywords verifica si el texto contiene alguna palabra clave
func ContainsKeywords(text string, keywords []string) bool {
	text = NormalizeText(text)
	for _, keyword := range keywords {
		if strings.Contains(text, NormalizeText(keyword)) {
			return true
		}
	}
	return false
}

// IsGreeting verifica si el mensaje es un saludo
func IsGreeting(text string) bool {
	greetings := []string{
		"hola", "buenos dias", "buenas tardes", "buenas noches",
		"hey", "hi", "hello", "saludos", "que tal",
	}
	return ContainsKeywords(text, greetings)
}

// GetDayOfWeek obtiene el día de la semana en español
func GetDayOfWeek(fecha time.Time) string {
	dias := []string{"domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"}
	return dias[fecha.Weekday()]
}

// ParseFecha parsea una fecha en formato DD/MM/YYYY
func ParseFecha(fechaStr string) (time.Time, error) {
	// Limpiar espacios
	fechaStr = strings.TrimSpace(fechaStr)

	// Intentar formato DD/MM/YYYY
	layout := "02/01/2006"
	fecha, err := time.Parse(layout, fechaStr)
	if err != nil {
		// Intentar formato D/M/YYYY o DD/M/YYYY o D/MM/YYYY
		partes := strings.Split(fechaStr, "/")
		if len(partes) == 3 {
			dia, err1 := strconv.Atoi(partes[0])
			mes, err2 := strconv.Atoi(partes[1])
			año, err3 := strconv.Atoi(partes[2])

			if err1 == nil && err2 == nil && err3 == nil {
				// Validar rangos
				if dia >= 1 && dia <= 31 && mes >= 1 && mes <= 12 && año >= 2000 {
					fecha = time.Date(año, time.Month(mes), dia, 0, 0, 0, 0, time.Local)
					return fecha, nil
				}
			}
		}
		return time.Time{}, fmt.Errorf("formato de fecha inválido: %s (use DD/MM/YYYY)", fechaStr)
	}

	return fecha, nil
}

// FormatFecha formatea una fecha a DD/MM/YYYY
func FormatFecha(fecha time.Time) string {
	return fecha.Format("02/01/2006")
}

// ConvertirFechaADia convierte una fecha a día de la semana y calcula la fecha exacta
func ConvertirFechaADia(fecha string) (string, string, error) {
	fechaLower := NormalizeText(fecha)

	// Si ya es un día de la semana válido
	if _, exists := COLUMNAS_DIAS[fechaLower]; exists {
		fechaExacta := CalcularFechaDelDia(fechaLower)
		return fechaLower, fechaExacta, nil
	}

	// Conversiones de palabras comunes a día de la semana
	conversiones := map[string]string{
		"hoy":               GetDayOfWeek(time.Now()),
		"mañana":            GetDayOfWeek(time.Now().AddDate(0, 0, 1)),
		"pasado mañana":     GetDayOfWeek(time.Now().AddDate(0, 0, 2)),
		"pasado manana":     GetDayOfWeek(time.Now().AddDate(0, 0, 2)),
		"el lunes":          "lunes",
		"el martes":         "martes",
		"el miercoles":      "miércoles",
		"el miércoles":      "miércoles",
		"el jueves":         "jueves",
		"el viernes":        "viernes",
		"el sabado":         "sábado",
		"el sábado":         "sábado",
		"el domingo":        "domingo",
		"este lunes":        "lunes",
		"este martes":       "martes",
		"este miercoles":    "miércoles",
		"este miércoles":    "miércoles",
		"este jueves":       "jueves",
		"este viernes":      "viernes",
		"este sabado":       "sábado",
		"este sábado":       "sábado",
		"este domingo":      "domingo",
		"proximo lunes":     "lunes",
		"próximo lunes":     "lunes",
		"proximo martes":    "martes",
		"próximo martes":    "martes",
		"proximo miercoles": "miércoles",
		"próximo miércoles": "miércoles",
		"proximo jueves":    "jueves",
		"próximo jueves":    "jueves",
		"proximo viernes":   "viernes",
		"próximo viernes":   "viernes",
		"proximo sabado":    "sábado",
		"próximo sábado":    "sábado",
		"proximo domingo":   "domingo",
		"próximo domingo":   "domingo",
	}

	if dia, exists := conversiones[fechaLower]; exists {
		fechaExacta := CalcularFechaDelDia(dia)
		return dia, fechaExacta, nil
	}

	// Intentar extraer día de la semana del texto
	diasSemana := []string{"lunes", "martes", "miércoles", "miercoles", "jueves", "viernes", "sábado", "sabado", "domingo"}
	for _, dia := range diasSemana {
		if strings.Contains(fechaLower, dia) {
			diaKey := dia
			if dia == "miercoles" {
				diaKey = "miércoles"
			} else if dia == "sabado" {
				diaKey = "sábado"
			}
			fechaExacta := CalcularFechaDelDia(diaKey)
			return diaKey, fechaExacta, nil
		}
	}

	// Intentar parsear fecha DD/MM/YYYY
	fechaObj, err := ParseFecha(fecha)
	if err == nil {
		diaSemana := GetDayOfWeek(fechaObj)
		return diaSemana, FormatFecha(fechaObj), nil
	}

	// Intentar extraer fecha con regex (números separados por / o -)
	re := regexp.MustCompile(`(\d{1,2})[/-](\d{1,2})[/-](\d{4})`)
	matches := re.FindStringSubmatch(fecha)
	if len(matches) == 4 {
		fechaFormateada := fmt.Sprintf("%s/%s/%s", matches[1], matches[2], matches[3])
		fechaObj, err := ParseFecha(fechaFormateada)
		if err == nil {
			diaSemana := GetDayOfWeek(fechaObj)
			return diaSemana, FormatFecha(fechaObj), nil
		}
	}

	return "", "", fmt.Errorf("formato de fecha no reconocido: '%s'. Use un día de la semana (lunes, martes, etc.) o formato DD/MM/YYYY", fecha)
}

// CalcularFechaDelDia calcula la fecha exacta del próximo día especificado
func CalcularFechaDelDia(diaSemana string) string {
	hoy := time.Now()

	diasSemanaNum := map[string]time.Weekday{
		"domingo":   time.Sunday,
		"lunes":     time.Monday,
		"martes":    time.Tuesday,
		"miércoles": time.Wednesday,
		"miercoles": time.Wednesday,
		"jueves":    time.Thursday,
		"viernes":   time.Friday,
		"sábado":    time.Saturday,
		"sabado":    time.Saturday,
	}

	diaObjetivo, exists := diasSemanaNum[NormalizeText(diaSemana)]
	if !exists {
		// Fallback: retornar fecha de hoy
		return FormatFecha(hoy)
	}

	diaActual := hoy.Weekday()

	// Calcular días hasta el objetivo
	diasHastaObjetivo := int(diaObjetivo - diaActual)

	// Si el día ya pasó esta semana, programar para la próxima semana
	if diasHastaObjetivo <= 0 {
		diasHastaObjetivo += 7
	}

	fechaObjetivo := hoy.AddDate(0, 0, diasHastaObjetivo)
	return FormatFecha(fechaObjetivo)
}

// NormalizarHora normaliza una hora al formato del calendario
func NormalizarHora(hora string) (string, error) {
	horaLower := NormalizeText(hora)

	// Extraer números de la hora
	re := regexp.MustCompile(`(\d+)`)
	matches := re.FindAllString(horaLower, -1)

	var numeroHora int
	var minutos int = 0

	if len(matches) > 0 {
		num, _ := strconv.Atoi(matches[0])
		numeroHora = num

		// Si hay minutos especificados
		if len(matches) > 1 {
			min, _ := strconv.Atoi(matches[1])
			minutos = min
		}
	}

	// Detectar si es AM o PM
	esPM := strings.Contains(horaLower, "tarde") ||
		strings.Contains(horaLower, "pm") ||
		strings.Contains(horaLower, "noche")

	esAM := strings.Contains(horaLower, "mañana") ||
		strings.Contains(horaLower, "manana") ||
		strings.Contains(horaLower, "am") ||
		strings.Contains(horaLower, "madrugada")

	// Ajustar para formato 12h
	if numeroHora > 0 {
		// Si es PM y no es 12
		if esPM && numeroHora < 12 {
			numeroHora += 12
		}
		// Si es AM y es 12
		if esAM && numeroHora == 12 {
			numeroHora = 0
		}

		// Convertir a formato de 12h con AM/PM
		var horaFormateada string
		if numeroHora == 0 {
			horaFormateada = fmt.Sprintf("12:%02d AM", minutos)
		} else if numeroHora < 12 {
			horaFormateada = fmt.Sprintf("%d:%02d AM", numeroHora, minutos)
		} else if numeroHora == 12 {
			horaFormateada = fmt.Sprintf("12:%02d PM", minutos)
		} else {
			horaFormateada = fmt.Sprintf("%d:%02d PM", numeroHora-12, minutos)
		}

		// Buscar coincidencia exacta en HORARIOS
		for _, h := range HORARIOS {
			if h == horaFormateada {
				return h, nil
			}
			// Buscar coincidencia aproximada (misma hora, diferentes minutos)
			if strings.HasPrefix(h, fmt.Sprintf("%d:", numeroHora%12)) ||
				strings.HasPrefix(h, fmt.Sprintf("%d:", (numeroHora%12)+12)) {
				return h, nil
			}
		}
	}

	// Conversiones directas comunes
	conversiones := map[string]string{
		"9":               "9:00 AM",
		"10":              "10:00 AM",
		"11":              "11:00 AM",
		"12":              "12:00 PM",
		"13":              "1:00 PM",
		"14":              "2:00 PM",
		"15":              "3:00 PM",
		"16":              "4:00 PM",
		"17":              "5:00 PM",
		"18":              "6:00 PM",
		"19":              "7:00 PM",
		"9 am":            "9:00 AM",
		"10 am":           "10:00 AM",
		"11 am":           "11:00 AM",
		"12 pm":           "12:00 PM",
		"1 pm":            "1:00 PM",
		"2 pm":            "2:00 PM",
		"3 pm":            "3:00 PM",
		"4 pm":            "4:00 PM",
		"5 pm":            "5:00 PM",
		"6 pm":            "6:00 PM",
		"7 pm":            "7:00 PM",
		"9 de la mañana":  "9:00 AM",
		"9 de la manana":  "9:00 AM",
		"10 de la mañana": "10:00 AM",
		"10 de la manana": "10:00 AM",
		"11 de la mañana": "11:00 AM",
		"11 de la manana": "11:00 AM",
		"12 del dia":      "12:00 PM",
		"1 de la tarde":   "1:00 PM",
		"2 de la tarde":   "2:00 PM",
		"3 de la tarde":   "3:00 PM",
		"4 de la tarde":   "4:00 PM",
		"5 de la tarde":   "5:00 PM",
		"6 de la tarde":   "6:00 PM",
		"7 de la tarde":   "7:00 PM",
		"7 de la noche":   "7:00 PM",
		"mañana":          "10:00 AM",
		"manana":          "10:00 AM",
		"tarde":           "3:00 PM",
		"en la mañana":    "10:00 AM",
		"en la manana":    "10:00 AM",
		"en la tarde":     "3:00 PM",
		"por la mañana":   "10:00 AM",
		"por la manana":   "10:00 AM",
		"por la tarde":    "3:00 PM",
	}

	if normalized, exists := conversiones[horaLower]; exists {
		return normalized, nil
	}

	// Buscar en horarios disponibles por coincidencia parcial
	for _, h := range HORARIOS {
		if strings.Contains(horaLower, strings.ToLower(h)) ||
			strings.Contains(NormalizeText(h), horaLower) {
			return h, nil
		}
	}

	return "", fmt.Errorf("hora no válida: '%s'. Horas disponibles: %v", hora, HORARIOS)
}

// ConvertirHoraA24h convierte hora de formato 12h a 24h
func ConvertirHoraA24h(hora string) (int, int, error) {
	// Limpiar hora
	hora = strings.TrimSpace(hora)

	var horas, minutos int
	var periodo string

	// Intentar parsear formato "HH:MM AM/PM"
	_, err := fmt.Sscanf(hora, "%d:%d %s", &horas, &minutos, &periodo)
	if err != nil {
		// Intentar formato "H:MM AM/PM"
		_, err = fmt.Sscanf(hora, "%d:%d%s", &horas, &minutos, &periodo)
		if err != nil {
			return 0, 0, fmt.Errorf("formato de hora inválido: %s", hora)
		}
	}

	periodo = strings.ToUpper(strings.TrimSpace(periodo))

	// Convertir a 24h
	if periodo == "PM" && horas != 12 {
		horas += 12
	} else if periodo == "AM" && horas == 12 {
		horas = 0
	}

	// Validar rangos
	if horas < 0 || horas > 23 || minutos < 0 || minutos > 59 {
		return 0, 0, fmt.Errorf("hora fuera de rango: %d:%d", horas, minutos)
	}

	return horas, minutos, nil
}

// GetNearestAvailableTime obtiene la hora disponible más cercana
func GetNearestAvailableTime(horaDeseada string) (string, error) {
	// Intentar normalizar la hora deseada
	horaNormalizada, err := NormalizarHora(horaDeseada)
	if err == nil {
		return horaNormalizada, nil
	}

	// Si no se puede normalizar, retornar la primera hora disponible
	if len(HORARIOS) > 0 {
		return HORARIOS[0], nil
	}

	return "", fmt.Errorf("no hay horarios disponibles")
}

// ValidateDateInFuture verifica que una fecha sea en el futuro
func ValidateDateInFuture(fechaStr string) error {
	fecha, err := ParseFecha(fechaStr)
	if err != nil {
		return err
	}

	hoy := time.Now()
	hoy = time.Date(hoy.Year(), hoy.Month(), hoy.Day(), 0, 0, 0, 0, hoy.Location())

	if fecha.Before(hoy) {
		return fmt.Errorf("la fecha debe ser hoy o en el futuro")
	}

	return nil
}

// GetWeekdayInSpanish convierte time.Weekday a español
func GetWeekdayInSpanish(weekday time.Weekday) string {
	dias := map[time.Weekday]string{
		time.Sunday:    "domingo",
		time.Monday:    "lunes",
		time.Tuesday:   "martes",
		time.Wednesday: "miércoles",
		time.Thursday:  "jueves",
		time.Friday:    "viernes",
		time.Saturday:  "sábado",
	}
	return dias[weekday]
}

// ParseHumanDate parsea fechas en lenguaje natural
func ParseHumanDate(texto string) (string, error) {
	textoLower := NormalizeText(texto)

	// Casos especiales
	if strings.Contains(textoLower, "hoy") {
		return FormatFecha(time.Now()), nil
	}

	if strings.Contains(textoLower, "mañana") || strings.Contains(textoLower, "manana") {
		return FormatFecha(time.Now().AddDate(0, 0, 1)), nil
	}

	if strings.Contains(textoLower, "pasado mañana") || strings.Contains(textoLower, "pasado manana") {
		return FormatFecha(time.Now().AddDate(0, 0, 2)), nil
	}

	// Intentar como día de la semana
	_, fechaExacta, err := ConvertirFechaADia(texto)
	if err == nil {
		return fechaExacta, nil
	}

	// Intentar como fecha DD/MM/YYYY
	fecha, err := ParseFecha(texto)
	if err == nil {
		return FormatFecha(fecha), nil
	}

	return "", fmt.Errorf("no se pudo interpretar la fecha: %s", texto)
}
