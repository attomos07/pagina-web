package services

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"golang.org/x/oauth2"
	"golang.org/x/oauth2/google"
	"google.golang.org/api/calendar/v3"
	"google.golang.org/api/option"
	"google.golang.org/api/sheets/v4"
)

type GoogleSheetsService struct {
	ClientID     string
	ClientSecret string
	RedirectURL  string
}

// GetOAuthConfig retorna la configuración de OAuth2 para Google Sheets y Calendar
func (s *GoogleSheetsService) GetOAuthConfig() *oauth2.Config {
	return &oauth2.Config{
		ClientID:     s.ClientID,
		ClientSecret: s.ClientSecret,
		RedirectURL:  s.RedirectURL,
		Scopes: []string{
			sheets.SpreadsheetsScope, // Acceso completo a Sheets
			calendar.CalendarScope,   // Acceso completo a Calendar
		},
		Endpoint: google.Endpoint,
	}
}

// GetAuthURL genera la URL de autorización de Google
func (s *GoogleSheetsService) GetAuthURL(state string) string {
	config := s.GetOAuthConfig()
	return config.AuthCodeURL(state, oauth2.AccessTypeOffline, oauth2.ApprovalForce)
}

// ExchangeCode intercambia el código de autorización por tokens
func (s *GoogleSheetsService) ExchangeCode(ctx context.Context, code string) (*oauth2.Token, error) {
	config := s.GetOAuthConfig()
	token, err := config.Exchange(ctx, code)
	if err != nil {
		return nil, fmt.Errorf("error exchanging code: %w", err)
	}
	return token, nil
}

// CreateSheetsService crea un servicio de Sheets con los tokens del usuario
func (s *GoogleSheetsService) CreateSheetsService(ctx context.Context, tokenJSON string) (*sheets.Service, error) {
	var token oauth2.Token
	if err := json.Unmarshal([]byte(tokenJSON), &token); err != nil {
		return nil, fmt.Errorf("error parsing token: %w", err)
	}

	config := s.GetOAuthConfig()
	client := config.Client(ctx, &token)

	service, err := sheets.NewService(ctx, option.WithHTTPClient(client))
	if err != nil {
		return nil, fmt.Errorf("error creating sheets service: %w", err)
	}

	return service, nil
}

// CreateSpreadsheet crea una nueva hoja de cálculo para el agente
func (s *GoogleSheetsService) CreateSpreadsheet(ctx context.Context, tokenJSON, agentName string) (string, error) {
	service, err := s.CreateSheetsService(ctx, tokenJSON)
	if err != nil {
		return "", err
	}

	spreadsheetTitle := fmt.Sprintf("Attomos - Citas de %s", agentName)

	spreadsheet := &sheets.Spreadsheet{
		Properties: &sheets.SpreadsheetProperties{
			Title:    spreadsheetTitle,
			TimeZone: "America/Mexico_City",
			Locale:   "es_MX",
		},
		Sheets: []*sheets.Sheet{
			{
				Properties: &sheets.SheetProperties{
					Title: "Citas",
				},
			},
		},
	}

	created, err := service.Spreadsheets.Create(spreadsheet).Do()
	if err != nil {
		return "", fmt.Errorf("error creating spreadsheet: %w", err)
	}

	// Configurar encabezados
	err = s.SetupHeaders(ctx, tokenJSON, created.SpreadsheetId)
	if err != nil {
		return "", fmt.Errorf("error setting up headers: %w", err)
	}

	return created.SpreadsheetId, nil
}

// SetupHeaders configura los encabezados y formato inicial de la hoja
func (s *GoogleSheetsService) SetupHeaders(ctx context.Context, tokenJSON, spreadsheetID string) error {
	service, err := s.CreateSheetsService(ctx, tokenJSON)
	if err != nil {
		return err
	}

	// Obtener el spreadsheet para conseguir el sheetId correcto
	spreadsheet, err := service.Spreadsheets.Get(spreadsheetID).Do()
	if err != nil {
		return fmt.Errorf("error getting spreadsheet: %w", err)
	}

	if len(spreadsheet.Sheets) == 0 {
		return fmt.Errorf("spreadsheet has no sheets")
	}

	// Obtener el sheetId de la primera hoja
	sheetId := spreadsheet.Sheets[0].Properties.SheetId

	// Encabezados
	headers := []interface{}{
		"ID Evento",
		"Fecha",
		"Hora Inicio",
		"Hora Fin",
		"Cliente",
		"Email",
		"Teléfono",
		"Descripción",
		"Estado",
		"Creado",
	}

	valueRange := &sheets.ValueRange{
		Values: [][]interface{}{headers},
	}

	_, err = service.Spreadsheets.Values.Update(
		spreadsheetID,
		"Citas!A1:J1",
		valueRange,
	).ValueInputOption("RAW").Do()

	if err != nil {
		return fmt.Errorf("error updating headers: %w", err)
	}

	// Formato de encabezados (negrita y fondo gris)
	requests := []*sheets.Request{
		{
			RepeatCell: &sheets.RepeatCellRequest{
				Range: &sheets.GridRange{
					SheetId:       sheetId,
					StartRowIndex: 0,
					EndRowIndex:   1,
				},
				Cell: &sheets.CellData{
					UserEnteredFormat: &sheets.CellFormat{
						BackgroundColor: &sheets.Color{
							Red:   0.9,
							Green: 0.9,
							Blue:  0.9,
						},
						TextFormat: &sheets.TextFormat{
							Bold: true,
						},
					},
				},
				Fields: "userEnteredFormat(backgroundColor,textFormat)",
			},
		},
		// Congelar primera fila
		{
			UpdateSheetProperties: &sheets.UpdateSheetPropertiesRequest{
				Properties: &sheets.SheetProperties{
					SheetId: sheetId,
					GridProperties: &sheets.GridProperties{
						FrozenRowCount: 1,
					},
				},
				Fields: "gridProperties.frozenRowCount",
			},
		},
	}

	batchUpdate := &sheets.BatchUpdateSpreadsheetRequest{
		Requests: requests,
	}

	_, err = service.Spreadsheets.BatchUpdate(spreadsheetID, batchUpdate).Do()
	if err != nil {
		return fmt.Errorf("error formatting headers: %w", err)
	}

	return nil
}

// AddAppointment agrega una nueva cita a la hoja de cálculo
func (s *GoogleSheetsService) AddAppointment(ctx context.Context, tokenJSON, spreadsheetID string, appointment AppointmentData) error {
	service, err := s.CreateSheetsService(ctx, tokenJSON)
	if err != nil {
		return err
	}

	row := []interface{}{
		appointment.EventID,
		appointment.Date,
		appointment.StartTime,
		appointment.EndTime,
		appointment.ClientName,
		appointment.ClientEmail,
		appointment.ClientPhone,
		appointment.Description,
		appointment.Status,
		time.Now().Format("2006-01-02 15:04:05"),
	}

	valueRange := &sheets.ValueRange{
		Values: [][]interface{}{row},
	}

	_, err = service.Spreadsheets.Values.Append(
		spreadsheetID,
		"Citas!A:J",
		valueRange,
	).ValueInputOption("RAW").InsertDataOption("INSERT_ROWS").Do()

	if err != nil {
		return fmt.Errorf("error adding appointment: %w", err)
	}

	return nil
}

// UpdateAppointment actualiza una cita existente en la hoja
func (s *GoogleSheetsService) UpdateAppointment(ctx context.Context, tokenJSON, spreadsheetID, eventID string, appointment AppointmentData) error {
	service, err := s.CreateSheetsService(ctx, tokenJSON)
	if err != nil {
		return err
	}

	// Buscar la fila del evento
	rowIndex, err := s.FindEventRow(ctx, tokenJSON, spreadsheetID, eventID)
	if err != nil {
		return err
	}

	if rowIndex == -1 {
		return fmt.Errorf("event not found in spreadsheet")
	}

	row := []interface{}{
		appointment.EventID,
		appointment.Date,
		appointment.StartTime,
		appointment.EndTime,
		appointment.ClientName,
		appointment.ClientEmail,
		appointment.ClientPhone,
		appointment.Description,
		appointment.Status,
		time.Now().Format("2006-01-02 15:04:05"),
	}

	valueRange := &sheets.ValueRange{
		Values: [][]interface{}{row},
	}

	rangeStr := fmt.Sprintf("Citas!A%d:J%d", rowIndex, rowIndex)
	_, err = service.Spreadsheets.Values.Update(
		spreadsheetID,
		rangeStr,
		valueRange,
	).ValueInputOption("RAW").Do()

	if err != nil {
		return fmt.Errorf("error updating appointment: %w", err)
	}

	return nil
}

// FindEventRow busca la fila de un evento por su ID
func (s *GoogleSheetsService) FindEventRow(ctx context.Context, tokenJSON, spreadsheetID, eventID string) (int, error) {
	service, err := s.CreateSheetsService(ctx, tokenJSON)
	if err != nil {
		return -1, err
	}

	resp, err := service.Spreadsheets.Values.Get(spreadsheetID, "Citas!A:A").Do()
	if err != nil {
		return -1, fmt.Errorf("error reading spreadsheet: %w", err)
	}

	for i, row := range resp.Values {
		if len(row) > 0 && row[0] == eventID {
			return i + 1, nil // +1 porque las filas empiezan en 1
		}
	}

	return -1, nil
}

// DeleteAppointment marca una cita como cancelada
func (s *GoogleSheetsService) DeleteAppointment(ctx context.Context, tokenJSON, spreadsheetID, eventID string) error {
	service, err := s.CreateSheetsService(ctx, tokenJSON)
	if err != nil {
		return err
	}

	rowIndex, err := s.FindEventRow(ctx, tokenJSON, spreadsheetID, eventID)
	if err != nil {
		return err
	}

	if rowIndex == -1 {
		return fmt.Errorf("event not found in spreadsheet")
	}

	// Actualizar solo la columna de estado
	valueRange := &sheets.ValueRange{
		Values: [][]interface{}{{"Cancelada"}},
	}

	rangeStr := fmt.Sprintf("Citas!I%d:I%d", rowIndex, rowIndex)
	_, err = service.Spreadsheets.Values.Update(
		spreadsheetID,
		rangeStr,
		valueRange,
	).ValueInputOption("RAW").Do()

	if err != nil {
		return fmt.Errorf("error deleting appointment: %w", err)
	}

	return nil
}

// GetAppointments obtiene todas las citas de la hoja
func (s *GoogleSheetsService) GetAppointments(ctx context.Context, tokenJSON, spreadsheetID string) ([]AppointmentData, error) {
	service, err := s.CreateSheetsService(ctx, tokenJSON)
	if err != nil {
		return nil, err
	}

	resp, err := service.Spreadsheets.Values.Get(spreadsheetID, "Citas!A2:J").Do()
	if err != nil {
		return nil, fmt.Errorf("error reading appointments: %w", err)
	}

	var appointments []AppointmentData
	for _, row := range resp.Values {
		if len(row) >= 9 {
			appointment := AppointmentData{
				EventID:     getStringValue(row, 0),
				Date:        getStringValue(row, 1),
				StartTime:   getStringValue(row, 2),
				EndTime:     getStringValue(row, 3),
				ClientName:  getStringValue(row, 4),
				ClientEmail: getStringValue(row, 5),
				ClientPhone: getStringValue(row, 6),
				Description: getStringValue(row, 7),
				Status:      getStringValue(row, 8),
			}
			appointments = append(appointments, appointment)
		}
	}

	return appointments, nil
}

// AppointmentData representa los datos de una cita en la hoja
type AppointmentData struct {
	EventID     string
	Date        string
	StartTime   string
	EndTime     string
	ClientName  string
	ClientEmail string
	ClientPhone string
	Description string
	Status      string
}

// RefreshToken refresca el token de acceso si ha expirado
func (s *GoogleSheetsService) RefreshToken(ctx context.Context, tokenJSON string) (string, error) {
	var token oauth2.Token
	if err := json.Unmarshal([]byte(tokenJSON), &token); err != nil {
		return "", fmt.Errorf("error parsing token: %w", err)
	}

	config := s.GetOAuthConfig()
	tokenSource := config.TokenSource(ctx, &token)

	newToken, err := tokenSource.Token()
	if err != nil {
		return "", fmt.Errorf("error refreshing token: %w", err)
	}

	newTokenJSON, err := json.Marshal(newToken)
	if err != nil {
		return "", fmt.Errorf("error marshaling token: %w", err)
	}

	return string(newTokenJSON), nil
}

// Helper function
func getStringValue(row []interface{}, index int) string {
	if index < len(row) && row[index] != nil {
		return fmt.Sprintf("%v", row[index])
	}
	return ""
}
