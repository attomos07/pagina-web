package handlers

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"strings"
	"time"

	"attomos/config"
	"attomos/models"
	"attomos/services"

	"github.com/gin-gonic/gin"
)

// GetAppointments obtiene todas las citas de Google Sheets de los agentes del usuario
func GetAppointments(c *gin.Context) {
	userInterface, exists := c.Get("user")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "No autenticado"})
		return
	}

	user := userInterface.(*models.User)

	// Obtener todos los agentes del usuario que tengan Google Sheets conectado
	var agents []models.Agent
	if err := config.DB.Where("user_id = ? AND google_connected = ?", user.ID, true).Find(&agents).Error; err != nil {
		log.Printf("❌ Error obteniendo agentes: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Error obteniendo agentes"})
		return
	}

	if len(agents) == 0 {
		log.Printf("⚠️  [User %d] No tiene agentes con Google Sheets conectado", user.ID)
		c.JSON(http.StatusOK, gin.H{
			"appointments": []interface{}{},
			"message":      "No hay agentes con Google Sheets conectado",
		})
		return
	}

	// Inicializar servicio de Sheets
	sheetsService := &services.GoogleSheetsService{
		ClientID:     getGoogleClientID(),
		ClientSecret: getGoogleClientSecret(),
		RedirectURL:  getGoogleRedirectURL(),
	}

	allAppointments := []AppointmentResponse{}
	ctx := context.Background()

	// Obtener citas de cada agente
	for _, agent := range agents {
		if agent.GoogleSheetID == "" {
			continue
		}

		log.Printf("📊 [Agent %d] Obteniendo citas de Sheet: %s", agent.ID, agent.GoogleSheetID)

		// Leer todas las celdas del calendario
		appointments, err := readAppointmentsFromSheet(ctx, sheetsService, agent.GoogleToken, agent.GoogleSheetID, agent.ID, agent.Name)
		if err != nil {
			log.Printf("⚠️  [Agent %d] Error leyendo citas: %v", agent.ID, err)
			continue
		}

		log.Printf("✅ [Agent %d] Se encontraron %d citas", agent.ID, len(appointments))
		allAppointments = append(allAppointments, appointments...)
	}

	log.Printf("✅ [User %d] Total de citas: %d", user.ID, len(allAppointments))

	c.JSON(http.StatusOK, gin.H{
		"appointments": allAppointments,
		"total":        len(allAppointments),
	})
}

// AppointmentResponse representa una cita para el frontend
type AppointmentResponse struct {
	ID        string `json:"id"`
	Client    string `json:"client"`
	Phone     string `json:"phone"`
	Service   string `json:"service"`
	Worker    string `json:"worker"`
	Date      string `json:"date"`      // Formato: YYYY-MM-DD
	Time      string `json:"time"`      // Formato: HH:MM
	Status    string `json:"status"`    // confirmed, pending, cancelled, completed
	AgentID   uint   `json:"agentId"`   // ID del agente
	AgentName string `json:"agentName"` // Nombre del agente
	Duration  int    `json:"duration"`  // Duración en minutos (default 60)
	Notes     string `json:"notes"`     // Notas adicionales
	SheetCell string `json:"sheetCell"` // Celda en el sheet (ej: "B5")
	SheetURL  string `json:"sheetUrl"`  // URL del sheet
}

// readAppointmentsFromSheet lee todas las citas de un sheet de calendario
func readAppointmentsFromSheet(ctx context.Context, sheetsService *services.GoogleSheetsService, tokenJSON, sheetID string, agentID uint, agentName string) ([]AppointmentResponse, error) {
	service, err := sheetsService.CreateSheetsService(ctx, tokenJSON)
	if err != nil {
		return nil, fmt.Errorf("error creando servicio: %w", err)
	}

	// Leer todas las celdas del calendario (B2:H12 = Lunes a Domingo, 9 AM - 7 PM)
	resp, err := service.Spreadsheets.Values.Get(sheetID, "Calendario!B2:H12").Do()
	if err != nil {
		return nil, fmt.Errorf("error leyendo sheet: %w", err)
	}

	appointments := []AppointmentResponse{}

	// Columnas: B=Lunes, C=Martes, D=Miércoles, E=Jueves, F=Viernes, G=Sábado, H=Domingo
	columns := []string{"B", "C", "D", "E", "F", "G", "H"}
	weekdays := []time.Weekday{time.Monday, time.Tuesday, time.Wednesday, time.Thursday, time.Friday, time.Saturday, time.Sunday}

	// Procesar cada celda
	for rowIdx, row := range resp.Values {
		hour := 9 + rowIdx // Fila 0 = 9 AM, Fila 1 = 10 AM, etc.

		for colIdx, cell := range row {
			if cell == nil || cell == "" {
				continue
			}

			cellContent := fmt.Sprintf("%v", cell)
			if strings.TrimSpace(cellContent) == "" {
				continue
			}

			// Parsear contenido de la celda
			appointment := parseAppointmentFromCell(cellContent, weekdays[colIdx], hour, columns[colIdx], rowIdx+2)
			if appointment == nil {
				continue
			}

			// Agregar información del agente
			appointment.AgentID = agentID
			appointment.AgentName = agentName
			appointment.SheetURL = fmt.Sprintf("https://docs.google.com/spreadsheets/d/%s/edit", sheetID)

			appointments = append(appointments, *appointment)
		}
	}

	return appointments, nil
}

// parseAppointmentFromCell parsea el contenido de una celda y extrae la información de la cita
func parseAppointmentFromCell(content string, weekday time.Weekday, hour int, column string, row int) *AppointmentResponse {
	// Formato esperado:
	// 👤 Juan Pérez
	// 📞 5216621234567
	// ✂️ Corte y barba
	// 👨‍💼 Pedro García
	// 📅 14/01/2025

	lines := strings.Split(content, "\n")
	if len(lines) < 3 {
		return nil
	}

	appointment := &AppointmentResponse{
		Duration: 60,
		Status:   "confirmed",
	}

	for _, line := range lines {
		line = strings.TrimSpace(line)

		// Extraer nombre del cliente (👤)
		if strings.Contains(line, "👤") {
			appointment.Client = strings.TrimSpace(strings.ReplaceAll(line, "👤", ""))
		}

		// Extraer teléfono (📞)
		if strings.Contains(line, "📞") {
			appointment.Phone = strings.TrimSpace(strings.ReplaceAll(line, "📞", ""))
		}

		// Extraer servicio (✂️)
		if strings.Contains(line, "✂️") || strings.Contains(line, "✂") {
			appointment.Service = strings.TrimSpace(strings.ReplaceAll(strings.ReplaceAll(line, "✂️", ""), "✂", ""))
		}

		// Extraer trabajador (👨‍💼)
		if strings.Contains(line, "👨‍💼") || strings.Contains(line, "👨") {
			appointment.Worker = strings.TrimSpace(strings.ReplaceAll(strings.ReplaceAll(line, "👨‍💼", ""), "👨", ""))
		}

		// Extraer fecha (📅)
		if strings.Contains(line, "📅") {
			dateStr := strings.TrimSpace(strings.ReplaceAll(line, "📅", ""))
			// Convertir de DD/MM/YYYY a YYYY-MM-DD
			if parsedDate, err := time.Parse("02/01/2006", dateStr); err == nil {
				appointment.Date = parsedDate.Format("2006-01-02")
			}
		}
	}

	// Si no hay fecha en la celda, calcular basado en el día de la semana
	if appointment.Date == "" {
		appointment.Date = getNextDateForWeekday(weekday)
	}

	// Formato de hora (24h para el frontend)
	appointment.Time = fmt.Sprintf("%02d:00", hour)

	// Generar ID único basado en la celda
	appointment.ID = fmt.Sprintf("%s%d", column, row)
	appointment.SheetCell = fmt.Sprintf("%s%d", column, row)

	// Validar datos mínimos
	if appointment.Client == "" || appointment.Service == "" {
		return nil
	}

	return appointment
}

// getNextDateForWeekday obtiene la próxima fecha para un día de la semana específico
func getNextDateForWeekday(targetWeekday time.Weekday) string {
	now := time.Now()
	currentWeekday := now.Weekday()

	daysUntil := int(targetWeekday - currentWeekday)
	if daysUntil <= 0 {
		daysUntil += 7
	}

	targetDate := now.AddDate(0, 0, daysUntil)
	return targetDate.Format("2006-01-02")
}

// Helper functions para obtener credenciales de Google
func getGoogleClientID() string {
	clientID := config.GetEnv("GOOGLE_INTEGRATION_CLIENT_ID")
	if clientID == "" {
		clientID = config.GetEnv("GOOGLE_CLIENT_ID")
	}
	return clientID
}

func getGoogleClientSecret() string {
	clientSecret := config.GetEnv("GOOGLE_INTEGRATION_CLIENT_SECRET")
	if clientSecret == "" {
		clientSecret = config.GetEnv("GOOGLE_CLIENT_SECRET")
	}
	return clientSecret
}

func getGoogleRedirectURL() string {
	redirectURL := config.GetEnv("GOOGLE_INTEGRATION_REDIRECT_URL")
	if redirectURL == "" {
		redirectURL = config.GetEnv("GOOGLE_REDIRECT_URL")
	}
	return redirectURL
}
