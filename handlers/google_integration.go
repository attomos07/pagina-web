package handlers

import (
	"crypto/rand"
	"database/sql"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"yourproject/models"
	"yourproject/services"
)

type GoogleIntegrationHandler struct {
	DB              *sql.DB
	CalendarService *services.GoogleCalendarService
	SheetsService   *services.GoogleSheetsService
	FrontendURL     string
}

// InitiateGoogleAuth inicia el flujo OAuth2 para Calendar y Sheets
func (h *GoogleIntegrationHandler) InitiateGoogleAuth(w http.ResponseWriter, r *http.Request) {
	userID := r.Context().Value("user_id").(int)
	agentID := r.URL.Query().Get("agent_id")

	if agentID == "" {
		http.Error(w, "agent_id is required", http.StatusBadRequest)
		return
	}

	// Generar state token para prevenir CSRF
	stateToken := generateStateToken()

	// Guardar state en sesión o BD temporal (aquí usamos BD)
	_, err := h.DB.Exec(`
		INSERT INTO oauth_states (user_id, agent_id, state_token, expires_at)
		VALUES (?, ?, ?, ?)
	`, userID, agentID, stateToken, time.Now().Add(10*time.Minute))

	if err != nil {
		http.Error(w, "Error saving state", http.StatusInternalServerError)
		return
	}

	// Generar URL de autorización (necesitamos ambos scopes)
	config := h.CalendarService.GetOAuthConfig()
	config.Scopes = append(config.Scopes, "https://www.googleapis.com/auth/spreadsheets")

	authURL := config.AuthCodeURL(stateToken,
		"access_type", "offline",
		"prompt", "consent",
	)

	response := map[string]string{
		"auth_url": authURL,
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

// HandleGoogleCallback maneja el callback de OAuth2
func (h *GoogleIntegrationHandler) HandleGoogleCallback(w http.ResponseWriter, r *http.Request) {
	code := r.URL.Query().Get("code")
	state := r.URL.Query().Get("state")

	if code == "" || state == "" {
		http.Redirect(w, r, h.FrontendURL+"/integration?error=invalid_request", http.StatusFound)
		return
	}

	// Verificar state token
	var userID, agentID int
	var expiresAt time.Time
	err := h.DB.QueryRow(`
		SELECT user_id, agent_id, expires_at 
		FROM oauth_states 
		WHERE state_token = ?
	`, state).Scan(&userID, &agentID, &expiresAt)

	if err != nil || time.Now().After(expiresAt) {
		http.Redirect(w, r, h.FrontendURL+"/integration?error=invalid_state", http.StatusFound)
		return
	}

	// Eliminar state token usado
	h.DB.Exec("DELETE FROM oauth_states WHERE state_token = ?", state)

	// Intercambiar código por tokens
	ctx := r.Context()
	token, err := h.CalendarService.ExchangeCode(ctx, code)
	if err != nil {
		http.Redirect(w, r, h.FrontendURL+"/integration?error=token_exchange_failed", http.StatusFound)
		return
	}

	tokenJSON, err := json.Marshal(token)
	if err != nil {
		http.Error(w, "Error processing token", http.StatusInternalServerError)
		return
	}

	// Obtener información del agente
	var agentName string
	err = h.DB.QueryRow("SELECT name FROM agents WHERE id = ?", agentID).Scan(&agentName)
	if err != nil {
		http.Redirect(w, r, h.FrontendURL+"/integration?error=agent_not_found", http.StatusFound)
		return
	}

	// Crear Calendar automáticamente
	calendarID, err := h.CalendarService.CreateCalendar(ctx, string(tokenJSON), agentName)
	if err != nil {
		http.Redirect(w, r, h.FrontendURL+"/integration?error=calendar_creation_failed", http.StatusFound)
		return
	}

	// Crear Spreadsheet automáticamente
	spreadsheetID, err := h.SheetsService.CreateSpreadsheet(ctx, string(tokenJSON), agentName)
	if err != nil {
		http.Redirect(w, r, h.FrontendURL+"/integration?error=sheet_creation_failed", http.StatusFound)
		return
	}

	// Guardar todo en la BD
	_, err = h.DB.Exec(`
		UPDATE agents 
		SET 
			google_token = ?,
			google_calendar_id = ?,
			google_sheet_id = ?,
			google_connected = 1,
			google_connected_at = ?
		WHERE id = ?
	`, string(tokenJSON), calendarID, spreadsheetID, time.Now(), agentID)

	if err != nil {
		http.Redirect(w, r, h.FrontendURL+"/integration?error=save_failed", http.StatusFound)
		return
	}

	// Redirigir al frontend con éxito
	redirectURL := fmt.Sprintf("%s/integration?success=true&agent_id=%d&calendar_id=%s&sheet_id=%s",
		h.FrontendURL, agentID, calendarID, spreadsheetID)
	http.Redirect(w, r, redirectURL, http.StatusFound)
}

// DisconnectGoogle desconecta la integración de Google
func (h *GoogleIntegrationHandler) DisconnectGoogle(w http.ResponseWriter, r *http.Request) {
	userID := r.Context().Value("user_id").(int)
	agentID := r.URL.Query().Get("agent_id")

	if agentID == "" {
		http.Error(w, "agent_id is required", http.StatusBadRequest)
		return
	}

	// Verificar que el agente pertenece al usuario
	var ownerID int
	err := h.DB.QueryRow("SELECT user_id FROM agents WHERE id = ?", agentID).Scan(&ownerID)
	if err != nil || ownerID != userID {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	// Desconectar
	_, err = h.DB.Exec(`
		UPDATE agents 
		SET 
			google_token = NULL,
			google_calendar_id = NULL,
			google_sheet_id = NULL,
			google_connected = 0,
			google_connected_at = NULL
		WHERE id = ?
	`, agentID)

	if err != nil {
		http.Error(w, "Error disconnecting", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]bool{"success": true})
}

// CreateAppointment crea una cita en Calendar y Sheets
func (h *GoogleIntegrationHandler) CreateAppointment(w http.ResponseWriter, r *http.Request) {
	var req struct {
		AgentID     int       `json:"agent_id"`
		Title       string    `json:"title"`
		Description string    `json:"description"`
		StartTime   time.Time `json:"start_time"`
		EndTime     time.Time `json:"end_time"`
		ClientName  string    `json:"client_name"`
		ClientEmail string    `json:"client_email"`
		ClientPhone string    `json:"client_phone"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request", http.StatusBadRequest)
		return
	}

	// Obtener agente con integración
	var agent models.Agent
	err := h.DB.QueryRow(`
		SELECT id, name, google_token, google_calendar_id, google_sheet_id, google_connected
		FROM agents 
		WHERE id = ? AND google_connected = 1
	`, req.AgentID).Scan(&agent.ID, &agent.Name, &agent.GoogleToken,
		&agent.GoogleCalendarID, &agent.GoogleSheetID, &agent.GoogleConnected)

	if err != nil {
		http.Error(w, "Agent not found or not connected", http.StatusNotFound)
		return
	}

	ctx := r.Context()

	// Crear evento en Calendar
	eventData := services.EventData{
		Title:       req.Title,
		Description: req.Description,
		StartTime:   req.StartTime,
		EndTime:     req.EndTime,
		ClientEmail: req.ClientEmail,
		ClientPhone: req.ClientPhone,
	}

	eventID, err := h.CalendarService.CreateEvent(ctx, agent.GoogleToken.String,
		agent.GoogleCalendarID.String, eventData)
	if err != nil {
		http.Error(w, fmt.Sprintf("Error creating calendar event: %v", err), http.StatusInternalServerError)
		return
	}

	// Agregar a Sheets
	appointmentData := services.AppointmentData{
		EventID:     eventID,
		Date:        req.StartTime.Format("2006-01-02"),
		StartTime:   req.StartTime.Format("15:04"),
		EndTime:     req.EndTime.Format("15:04"),
		ClientName:  req.ClientName,
		ClientEmail: req.ClientEmail,
		ClientPhone: req.ClientPhone,
		Description: req.Description,
		Status:      "Confirmada",
	}

	err = h.SheetsService.AddAppointment(ctx, agent.GoogleToken.String,
		agent.GoogleSheetID.String, appointmentData)
	if err != nil {
		// Si falla Sheets, intentar eliminar el evento de Calendar
		h.CalendarService.DeleteEvent(ctx, agent.GoogleToken.String,
			agent.GoogleCalendarID.String, eventID)
		http.Error(w, "Error adding to spreadsheet", http.StatusInternalServerError)
		return
	}

	response := map[string]interface{}{
		"success":  true,
		"event_id": eventID,
		"message":  "Cita creada exitosamente",
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

// GetIntegrationStatus obtiene el estado de la integración
func (h *GoogleIntegrationHandler) GetIntegrationStatus(w http.ResponseWriter, r *http.Request) {
	userID := r.Context().Value("user_id").(int)
	agentID := r.URL.Query().Get("agent_id")

	if agentID == "" {
		http.Error(w, "agent_id is required", http.StatusBadRequest)
		return
	}

	var agent models.Agent
	err := h.DB.QueryRow(`
		SELECT id, name, google_connected, google_calendar_id, google_sheet_id, google_connected_at
		FROM agents 
		WHERE id = ? AND user_id = ?
	`, agentID, userID).Scan(&agent.ID, &agent.Name, &agent.GoogleConnected,
		&agent.GoogleCalendarID, &agent.GoogleSheetID, &agent.GoogleConnectedAt)

	if err != nil {
		http.Error(w, "Agent not found", http.StatusNotFound)
		return
	}

	response := map[string]interface{}{
		"connected":    agent.GoogleConnected,
		"calendar_id":  agent.GoogleCalendarID.String,
		"sheet_id":     agent.GoogleSheetID.String,
		"connected_at": agent.GoogleConnectedAt,
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

// generateStateToken genera un token aleatorio para CSRF protection
func generateStateToken() string {
	b := make([]byte, 32)
	rand.Read(b)
	return base64.URLEncoding.EncodeToString(b)
}
