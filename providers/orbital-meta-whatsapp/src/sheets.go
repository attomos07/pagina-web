package src

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"os"
	"strings"
	"time"

	"golang.org/x/oauth2"
	"golang.org/x/oauth2/google"
	"google.golang.org/api/option"
	"google.golang.org/api/sheets/v4"
)

var (
	sheetsService *sheets.Service
	spreadsheetID string
	sheetsEnabled bool
)

// InitSheets inicializa el servicio de Google Sheets
func InitSheets() error {
	log.Println("")
	log.Println("╔══════════════════════════════════════════════════════╗")
	log.Println("║              📊 INICIANDO GOOGLE SHEETS              ║")
	log.Println("╚══════════════════════════════════════════════════════╝")
	log.Println("")

	spreadsheetID = os.Getenv("SPREADSHEETID")
	if spreadsheetID == "" {
		sheetsEnabled = false
		log.Println("⚠️  SPREADSHEETID no configurado en .env")
		log.Println("💡 Google Sheets deshabilitado")
		return fmt.Errorf("SPREADSHEETID no configurado")
	}

	log.Printf("✅ SPREADSHEETID: %s\n", maskSensitiveData(spreadsheetID))
	log.Println("")

	// Verificar archivo google.json (token OAuth)
	if _, err := os.Stat("google.json"); os.IsNotExist(err) {
		sheetsEnabled = false
		log.Println("❌ Archivo google.json NO encontrado")
		return fmt.Errorf("archivo google.json no encontrado")
	}

	log.Println("✅ Archivo google.json encontrado")

	// Leer google.json (token OAuth)
	credBytes, err := os.ReadFile("google.json")
	if err != nil {
		sheetsEnabled = false
		log.Printf("❌ Error leyendo google.json: %v\n", err)
		return err
	}

	// Parsear token OAuth
	var token oauth2.Token
	if err := json.Unmarshal(credBytes, &token); err != nil {
		sheetsEnabled = false
		log.Printf("❌ Error parseando token: %v\n", err)
		return err
	}

	log.Println("✅ Token OAuth parseado correctamente")

	// Crear servicio de Sheets
	config := &oauth2.Config{
		Scopes:   []string{sheets.SpreadsheetsScope},
		Endpoint: google.Endpoint,
	}

	ctx := context.Background()
	client := config.Client(ctx, &token)

	srv, err := sheets.NewService(ctx, option.WithHTTPClient(client))
	if err != nil {
		sheetsEnabled = false
		log.Printf("❌ Error creando servicio Sheets: %v\n", err)
		return err
	}

	sheetsService = srv

	// Probar acceso
	_, testErr := srv.Spreadsheets.Get(spreadsheetID).Do()
	if testErr != nil {
		sheetsEnabled = false
		log.Printf("❌ Error accediendo al Spreadsheet: %v\n", testErr)
		return testErr
	}

	log.Println("✅ Acceso al Spreadsheet verificado")
	log.Println("")

	sheetsEnabled = true

	log.Println("╔══════════════════════════════════════════════════════╗")
	log.Println("║        ✅ GOOGLE SHEETS INICIALIZADO                 ║")
	log.Println("╚══════════════════════════════════════════════════════╝")
	log.Println("")

	return nil
}

// SaveAppointment guarda una cita en Google Sheets (formato de calendario compatible con AtomicBot)
func SaveAppointment(clientName, phoneNumber string, appointmentTime time.Time) error {
	if !sheetsEnabled || sheetsService == nil {
		return fmt.Errorf("Google Sheets no está habilitado")
	}

	log.Println("")
	log.Println("📊 GUARDANDO CITA EN GOOGLE SHEETS")
	log.Printf("   Cliente: %s\n", clientName)
	log.Printf("   Teléfono: %s\n", phoneNumber)
	log.Printf("   Fecha/Hora: %s\n", appointmentTime.Format("02/01/2006 15:04"))

	// Determinar columna según día de la semana
	weekday := int(appointmentTime.Weekday())
	var columnLetter string

	switch weekday {
	case 0: // Domingo
		columnLetter = "H"
	case 1: // Lunes
		columnLetter = "B"
	case 2: // Martes
		columnLetter = "C"
	case 3: // Miércoles
		columnLetter = "D"
	case 4: // Jueves
		columnLetter = "E"
	case 5: // Viernes
		columnLetter = "F"
	case 6: // Sábado
		columnLetter = "G"
	}

	// Determinar fila según hora (9 AM = fila 2, 10 AM = fila 3, etc.)
	hour := appointmentTime.Hour()
	row := hour - 9 + 2

	if row < 2 || row > 12 {
		return fmt.Errorf("hora fuera del rango del calendario (9:00 AM - 7:00 PM)")
	}

	// Construir contenido de la celda (formato compatible con AtomicBot)
	cellContent := fmt.Sprintf("👤 %s\n📞 %s\n✂️ Cita agendada\n📅 %s",
		clientName,
		phoneNumber,
		appointmentTime.Format("02/01/2006"),
	)

	// Rango de la celda (ej: "Calendario!C5")
	cellRange := fmt.Sprintf("Calendario!%s%d", columnLetter, row)

	log.Printf("   📍 Escribiendo en: %s\n", cellRange)

	valueRange := &sheets.ValueRange{
		Values: [][]interface{}{{cellContent}},
	}

	_, err := sheetsService.Spreadsheets.Values.Update(
		spreadsheetID,
		cellRange,
		valueRange,
	).ValueInputOption("RAW").Do()

	if err != nil {
		log.Printf("❌ Error guardando en Sheets: %v\n", err)
		return err
	}

	log.Println("✅ CITA GUARDADA EN SHEETS EXITOSAMENTE")
	log.Println("")

	return nil
}

// CancelAppointmentInSheets cancela una cita en Google Sheets
func CancelAppointmentInSheets(clientName string, appointmentTime time.Time) error {
	if !sheetsEnabled || sheetsService == nil {
		return fmt.Errorf("Google Sheets no está habilitado")
	}

	log.Println("")
	log.Println("🚫 CANCELANDO CITA EN GOOGLE SHEETS")
	log.Printf("   Cliente: %s\n", clientName)
	log.Printf("   Fecha/Hora: %s\n", appointmentTime.Format("02/01/2006 15:04"))

	// Determinar columna según día de la semana
	weekday := int(appointmentTime.Weekday())
	var columnLetter string

	switch weekday {
	case 0: // Domingo
		columnLetter = "H"
	case 1: // Lunes
		columnLetter = "B"
	case 2: // Martes
		columnLetter = "C"
	case 3: // Miércoles
		columnLetter = "D"
	case 4: // Jueves
		columnLetter = "E"
	case 5: // Viernes
		columnLetter = "F"
	case 6: // Sábado
		columnLetter = "G"
	}

	// Determinar fila según hora
	hour := appointmentTime.Hour()
	row := hour - 9 + 2

	if row < 2 || row > 12 {
		return fmt.Errorf("hora fuera del rango del calendario (9:00 AM - 7:00 PM)")
	}

	// Leer contenido actual de la celda
	cellRange := fmt.Sprintf("Calendario!%s%d", columnLetter, row)

	resp, err := sheetsService.Spreadsheets.Values.Get(spreadsheetID, cellRange).Do()
	if err != nil {
		return fmt.Errorf("error leyendo celda: %w", err)
	}

	if len(resp.Values) == 0 || len(resp.Values[0]) == 0 {
		return fmt.Errorf("no hay cita agendada en ese horario")
	}

	currentContent := fmt.Sprintf("%v", resp.Values[0][0])

	// Verificar que la cita pertenezca al cliente
	if !strings.Contains(currentContent, clientName) {
		return fmt.Errorf("la cita en ese horario no corresponde a %s", clientName)
	}

	log.Printf("   📋 Contenido actual: %s\n", currentContent)

	// Limpiar la celda (borrar la cita)
	valueRange := &sheets.ValueRange{
		Values: [][]interface{}{{""}},
	}

	_, err = sheetsService.Spreadsheets.Values.Update(
		spreadsheetID,
		cellRange,
		valueRange,
	).ValueInputOption("RAW").Do()

	if err != nil {
		log.Printf("❌ Error cancelando en Sheets: %v\n", err)
		return err
	}

	log.Println("✅ CITA CANCELADA EN SHEETS EXITOSAMENTE")
	log.Println("")

	return nil
}

// FindAppointmentByClient busca una cita específica de un cliente
func FindAppointmentByClient(clientName string, appointmentTime time.Time) (bool, error) {
	if !sheetsEnabled || sheetsService == nil {
		return false, fmt.Errorf("Google Sheets no está habilitado")
	}

	// Determinar columna y fila
	weekday := int(appointmentTime.Weekday())
	var columnLetter string

	switch weekday {
	case 0:
		columnLetter = "H"
	case 1:
		columnLetter = "B"
	case 2:
		columnLetter = "C"
	case 3:
		columnLetter = "D"
	case 4:
		columnLetter = "E"
	case 5:
		columnLetter = "F"
	case 6:
		columnLetter = "G"
	}

	hour := appointmentTime.Hour()
	row := hour - 9 + 2

	// Leer celda
	cellRange := fmt.Sprintf("Calendario!%s%d", columnLetter, row)
	resp, err := sheetsService.Spreadsheets.Values.Get(spreadsheetID, cellRange).Do()
	if err != nil {
		return false, fmt.Errorf("error leyendo celda: %w", err)
	}

	if len(resp.Values) == 0 || len(resp.Values[0]) == 0 {
		return false, nil
	}

	cellContent := fmt.Sprintf("%v", resp.Values[0][0])

	// Verificar si contiene el nombre del cliente
	if strings.Contains(cellContent, clientName) {
		return true, nil
	}

	return false, nil
}

// InitializeWeeklyCalendar crea el calendario semanal en Sheets
func InitializeWeeklyCalendar() error {
	if sheetsService == nil {
		return fmt.Errorf("Google Sheets no está inicializado")
	}

	log.Println("📅 Inicializando calendario semanal...")

	// Crear estructura del calendario
	// Fila 1: Headers (Hora, Lunes, Martes, Miércoles, Jueves, Viernes, Sábado, Domingo)
	headers := []interface{}{"Hora", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"}

	var rows [][]interface{}
	rows = append(rows, headers)

	// Filas 2-12: Horarios de 9 AM a 7 PM
	for hour := 9; hour <= 19; hour++ {
		var ampm string
		displayHour := hour
		if hour < 12 {
			ampm = "AM"
		} else {
			ampm = "PM"
			if hour > 12 {
				displayHour = hour - 12
			}
		}

		row := []interface{}{fmt.Sprintf("%d:00 %s", displayHour, ampm)}
		// 7 columnas vacías para los días
		for i := 0; i < 7; i++ {
			row = append(row, "")
		}
		rows = append(rows, row)
	}

	valueRange := &sheets.ValueRange{
		Values: rows,
	}

	// Actualizar la hoja de calendario
	_, err := sheetsService.Spreadsheets.Values.Update(
		spreadsheetID,
		"Calendario!A1:H12",
		valueRange,
	).ValueInputOption("USER_ENTERED").Do()

	if err != nil {
		return fmt.Errorf("error inicializando calendario: %w", err)
	}

	log.Println("✅ Calendario semanal inicializado")

	return nil
}

// IsSheetsEnabled verifica si Google Sheets está habilitado
func IsSheetsEnabled() bool {
	return sheetsEnabled && sheetsService != nil && spreadsheetID != ""
}

// GetAppointments obtiene las citas guardadas
func GetAppointments() ([][]interface{}, error) {
	if sheetsService == nil {
		return nil, fmt.Errorf("Google Sheets no está inicializado")
	}

	// Leer todo el calendario
	resp, err := sheetsService.Spreadsheets.Values.Get(spreadsheetID, "Calendario!B2:H12").Do()
	if err != nil {
		return nil, fmt.Errorf("error obteniendo citas: %w", err)
	}

	return resp.Values, nil
}

// ClearCancelledAppointment borra completamente una cita cancelada (alias para compatibilidad)
func ClearCancelledAppointment(appointmentTime time.Time) error {
	return ClearAppointmentCell(appointmentTime)
}

// ClearAppointmentCell limpia una celda específica del calendario
func ClearAppointmentCell(appointmentTime time.Time) error {
	if !sheetsEnabled || sheetsService == nil {
		return fmt.Errorf("Google Sheets no está habilitado")
	}

	// Determinar columna y fila
	weekday := int(appointmentTime.Weekday())
	var columnLetter string

	switch weekday {
	case 0:
		columnLetter = "H"
	case 1:
		columnLetter = "B"
	case 2:
		columnLetter = "C"
	case 3:
		columnLetter = "D"
	case 4:
		columnLetter = "E"
	case 5:
		columnLetter = "F"
	case 6:
		columnLetter = "G"
	}

	hour := appointmentTime.Hour()
	row := hour - 9 + 2

	// Limpiar celda
	cellRange := fmt.Sprintf("Calendario!%s%d", columnLetter, row)

	valueRange := &sheets.ValueRange{
		Values: [][]interface{}{{""}},
	}

	_, err := sheetsService.Spreadsheets.Values.Update(
		spreadsheetID,
		cellRange,
		valueRange,
	).ValueInputOption("RAW").Do()

	if err != nil {
		return fmt.Errorf("error limpiando celda: %w", err)
	}

	log.Println("✅ Celda de cita limpiada del calendario")
	return nil
}
