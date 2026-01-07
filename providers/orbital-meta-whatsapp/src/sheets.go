package src

import (
	"context"
	"fmt"
	"log"
	"os"
	"time"

	"golang.org/x/oauth2/google"
	"google.golang.org/api/option"
	"google.golang.org/api/sheets/v4"
)

var (
	sheetsService *sheets.Service
	spreadsheetID string
)

// InitSheets inicializa el servicio de Google Sheets
func InitSheets() error {
	spreadsheetID = os.Getenv("SPREADSHEETID")
	if spreadsheetID == "" {
		log.Println("⚠️  SPREADSHEETID no configurado - Google Sheets deshabilitado")
		return nil
	}

	// Buscar credenciales
	credPath := os.Getenv("GOOGLE_APPLICATION_CREDENTIALS")
	if credPath == "" {
		credPath = "credentials.json"
	}

	credData, err := os.ReadFile(credPath)
	if err != nil {
		return fmt.Errorf("error leyendo credentials.json: %w", err)
	}

	config, err := google.JWTConfigFromJSON(credData, sheets.SpreadsheetsScope)
	if err != nil {
		return fmt.Errorf("error creando configuración JWT: %w", err)
	}

	ctx := context.Background()
	client := config.Client(ctx)

	srv, err := sheets.NewService(ctx, option.WithHTTPClient(client))
	if err != nil {
		return fmt.Errorf("error creando servicio Sheets: %w", err)
	}

	sheetsService = srv

	log.Println("✅ Google Sheets inicializado correctamente")
	log.Printf("   📊 Spreadsheet ID: %s", maskSensitiveData(spreadsheetID))

	// Verificar si existe la hoja o crearla
	if err := ensureSheetExists(); err != nil {
		log.Printf("⚠️  Error verificando/creando hoja: %v", err)
	}

	return nil
}

// SaveAppointment guarda una cita en Google Sheets
func SaveAppointment(clientName, phoneNumber string, appointmentTime time.Time) error {
	if sheetsService == nil {
		return fmt.Errorf("Google Sheets no está inicializado")
	}

	// Formato de la fecha y hora
	dateStr := appointmentTime.Format("02/01/2006")
	timeStr := appointmentTime.Format("15:04")
	timestampStr := time.Now().Format("02/01/2006 15:04:05")

	// Datos a insertar
	values := [][]interface{}{
		{timestampStr, clientName, phoneNumber, dateStr, timeStr, "Pendiente"},
	}

	valueRange := &sheets.ValueRange{
		Values: values,
	}

	// Agregar a la hoja
	_, err := sheetsService.Spreadsheets.Values.Append(
		spreadsheetID,
		"Citas!A:F", // Rango de la hoja
		valueRange,
	).ValueInputOption("USER_ENTERED").Do()

	if err != nil {
		return fmt.Errorf("error guardando cita en Sheets: %w", err)
	}

	log.Printf("✅ Cita guardada en Google Sheets")
	log.Printf("   👤 Cliente: %s", clientName)
	log.Printf("   📅 Fecha: %s %s", dateStr, timeStr)

	return nil
}

// InitializeWeeklyCalendar crea el calendario semanal en Sheets
func InitializeWeeklyCalendar() error {
	if sheetsService == nil {
		return fmt.Errorf("Google Sheets no está inicializado")
	}

	// Obtener lunes de esta semana
	now := time.Now()
	weekday := int(now.Weekday())
	if weekday == 0 {
		weekday = 7 // Domingo es 0, lo convertimos a 7
	}
	monday := now.AddDate(0, 0, -(weekday - 1))

	// Crear encabezados (Lunes a Viernes)
	headers := []interface{}{"Hora"}
	for i := 0; i < 5; i++ {
		day := monday.AddDate(0, 0, i)
		headers = append(headers, day.Format("Mon 02/01"))
	}

	// Crear filas de horarios (9:00 a 18:00)
	var rows [][]interface{}
	rows = append(rows, headers)

	for hour := 9; hour <= 18; hour++ {
		row := []interface{}{fmt.Sprintf("%02d:00", hour)}
		for i := 0; i < 5; i++ {
			row = append(row, "") // Celdas vacías para las citas
		}
		rows = append(rows, row)
	}

	valueRange := &sheets.ValueRange{
		Values: rows,
	}

	// Actualizar la hoja de calendario
	_, err := sheetsService.Spreadsheets.Values.Update(
		spreadsheetID,
		"Calendario!A1:F20",
		valueRange,
	).ValueInputOption("USER_ENTERED").Do()

	if err != nil {
		return fmt.Errorf("error inicializando calendario: %w", err)
	}

	log.Println("✅ Calendario semanal inicializado en Google Sheets")

	return nil
}

// ensureSheetExists verifica si existe la hoja "Citas" y la crea si no existe
func ensureSheetExists() error {
	// Obtener información del spreadsheet
	spreadsheet, err := sheetsService.Spreadsheets.Get(spreadsheetID).Do()
	if err != nil {
		return fmt.Errorf("error obteniendo spreadsheet: %w", err)
	}

	// Verificar si existe la hoja "Citas"
	citasExists := false
	for _, sheet := range spreadsheet.Sheets {
		if sheet.Properties.Title == "Citas" {
			citasExists = true
			break
		}
	}

	// Si no existe, crearla
	if !citasExists {
		log.Println("📝 Creando hoja 'Citas'...")

		requests := []*sheets.Request{
			{
				AddSheet: &sheets.AddSheetRequest{
					Properties: &sheets.SheetProperties{
						Title: "Citas",
					},
				},
			},
		}

		batchUpdateRequest := &sheets.BatchUpdateSpreadsheetRequest{
			Requests: requests,
		}

		_, err := sheetsService.Spreadsheets.BatchUpdate(spreadsheetID, batchUpdateRequest).Do()
		if err != nil {
			return fmt.Errorf("error creando hoja: %w", err)
		}

		// Agregar encabezados
		headers := [][]interface{}{
			{"Timestamp", "Cliente", "Teléfono", "Fecha", "Hora", "Estado"},
		}

		valueRange := &sheets.ValueRange{
			Values: headers,
		}

		_, err = sheetsService.Spreadsheets.Values.Update(
			spreadsheetID,
			"Citas!A1:F1",
			valueRange,
		).ValueInputOption("USER_ENTERED").Do()

		if err != nil {
			return fmt.Errorf("error agregando encabezados: %w", err)
		}

		log.Println("✅ Hoja 'Citas' creada con encabezados")
	}

	return nil
}

// IsSheetsEnabled verifica si Google Sheets está habilitado
func IsSheetsEnabled() bool {
	return sheetsService != nil && spreadsheetID != ""
}

// GetAppointments obtiene las citas guardadas
func GetAppointments() ([][]interface{}, error) {
	if sheetsService == nil {
		return nil, fmt.Errorf("Google Sheets no está inicializado")
	}

	resp, err := sheetsService.Spreadsheets.Values.Get(spreadsheetID, "Citas!A2:F").Do()
	if err != nil {
		return nil, fmt.Errorf("error obteniendo citas: %w", err)
	}

	return resp.Values, nil
}
