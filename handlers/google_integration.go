package handlers

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"time"

	"attomos/config"
	"attomos/models"
	"attomos/services"

	"github.com/gin-gonic/gin"
)

type GoogleIntegrationHandler struct {
	calendarService *services.GoogleCalendarService
	sheetsService   *services.GoogleSheetsService
}

// NewGoogleIntegrationHandler crea una nueva instancia del handler
func NewGoogleIntegrationHandler() (*GoogleIntegrationHandler, error) {
	// Intentar primero con variables específicas de integración
	clientID := os.Getenv("GOOGLE_INTEGRATION_CLIENT_ID")
	clientSecret := os.Getenv("GOOGLE_INTEGRATION_CLIENT_SECRET")
	redirectURL := os.Getenv("GOOGLE_INTEGRATION_REDIRECT_URL")

	// Fallback a variables genéricas si no existen las específicas
	if clientID == "" {
		clientID = os.Getenv("GOOGLE_CLIENT_ID")
	}
	if clientSecret == "" {
		clientSecret = os.Getenv("GOOGLE_CLIENT_SECRET")
	}
	if redirectURL == "" {
		redirectURL = os.Getenv("GOOGLE_REDIRECT_URL")
	}

	if clientID == "" || clientSecret == "" || redirectURL == "" {
		return nil, fmt.Errorf("faltan credenciales de Google OAuth (GOOGLE_INTEGRATION_CLIENT_ID, GOOGLE_INTEGRATION_CLIENT_SECRET, GOOGLE_INTEGRATION_REDIRECT_URL)")
	}

	log.Printf("✅ Google Integration configurado con redirect URL: %s", redirectURL)

	return &GoogleIntegrationHandler{
		calendarService: &services.GoogleCalendarService{
			ClientID:     clientID,
			ClientSecret: clientSecret,
			RedirectURL:  redirectURL,
		},
		sheetsService: &services.GoogleSheetsService{
			ClientID:     clientID,
			ClientSecret: clientSecret,
			RedirectURL:  redirectURL,
		},
	}, nil
}

// InitiateGoogleIntegration inicia el flujo OAuth2 para Calendar y Sheets
func (h *GoogleIntegrationHandler) InitiateGoogleIntegration(c *gin.Context) {
	userInterface, exists := c.Get("user")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "No autenticado"})
		return
	}

	user := userInterface.(*models.User)
	agentID := c.Query("agent_id")

	if agentID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "agent_id es requerido"})
		return
	}

	// Verificar que el agente pertenece al usuario
	var agent models.Agent
	if err := config.DB.Where("id = ? AND user_id = ?", agentID, user.ID).First(&agent).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Agente no encontrado"})
		return
	}

	// Generar state token con agent_id incluido
	state := fmt.Sprintf("%d:%d:%d", user.ID, agent.ID, time.Now().Unix())

	// Guardar state en sesión (cookie temporal)
	c.SetCookie("oauth_state", state, 600, "/", "", false, true) // 10 minutos

	// Obtener URL de autorización con ambos scopes
	authURL := h.calendarService.GetAuthURL(state)

	c.JSON(http.StatusOK, gin.H{
		"auth_url": authURL,
	})
}

// HandleGoogleCallback maneja el callback de OAuth2 y crea automáticamente Calendar y Sheet
func (h *GoogleIntegrationHandler) HandleGoogleCallback(c *gin.Context) {
	code := c.Query("code")
	state := c.Query("state")

	if code == "" || state == "" {
		c.Redirect(http.StatusTemporaryRedirect, "/my-agents?error=invalid_request")
		return
	}

	// Verificar state token
	savedState, err := c.Cookie("oauth_state")
	if err != nil || state != savedState {
		log.Printf("❌ Error de validación de state: state=%s, savedState=%s", state, savedState)
		c.Redirect(http.StatusTemporaryRedirect, "/my-agents?error=invalid_state")
		return
	}

	// Limpiar cookie de state
	c.SetCookie("oauth_state", "", -1, "/", "", false, true)

	// Extraer user_id y agent_id del state
	var userID, agentID int64
	fmt.Sscanf(state, "%d:%d:", &userID, &agentID)

	// Obtener agente
	var agent models.Agent
	if err := config.DB.Where("id = ? AND user_id = ?", agentID, userID).First(&agent).Error; err != nil {
		log.Printf("❌ Error obteniendo agente: %v", err)
		c.Redirect(http.StatusTemporaryRedirect, "/my-agents?error=agent_not_found")
		return
	}

	// Obtener usuario para acceder a servidor
	var user models.User
	if err := config.DB.Where("id = ?", userID).First(&user).Error; err != nil {
		log.Printf("❌ Error obteniendo usuario: %v", err)
		c.Redirect(http.StatusTemporaryRedirect, "/my-agents?error=user_not_found")
		return
	}

	// Intercambiar código por tokens
	ctx := context.Background()
	token, err := h.calendarService.ExchangeCode(ctx, code)
	if err != nil {
		log.Printf("❌ Error intercambiando código: %v", err)
		c.Redirect(http.StatusTemporaryRedirect, "/my-agents?error=token_exchange_failed")
		return
	}

	tokenJSON, err := json.Marshal(token)
	if err != nil {
		log.Printf("❌ Error serializando token: %v", err)
		c.Redirect(http.StatusTemporaryRedirect, "/my-agents?error=token_error")
		return
	}

	log.Printf("✅ [Agent %d] Token obtenido exitosamente", agent.ID)

	// PASO 1: Crear Calendar automáticamente
	log.Printf("📅 [Agent %d] Creando Google Calendar...", agent.ID)
	calendarID, err := h.calendarService.CreateCalendar(ctx, string(tokenJSON), agent.Name)
	if err != nil {
		log.Printf("❌ [Agent %d] Error creando Calendar: %v", agent.ID, err)
		c.Redirect(http.StatusTemporaryRedirect, "/my-agents?error=calendar_creation_failed")
		return
	}
	log.Printf("✅ [Agent %d] Calendar creado: %s", agent.ID, calendarID)

	// PASO 2: Crear Spreadsheet automáticamente
	log.Printf("📊 [Agent %d] Creando Google Sheet...", agent.ID)
	spreadsheetID, err := h.sheetsService.CreateSpreadsheet(ctx, string(tokenJSON), agent.Name)
	if err != nil {
		log.Printf("❌ [Agent %d] Error creando Sheet: %v", agent.ID, err)
		c.Redirect(http.StatusTemporaryRedirect, "/my-agents?error=sheet_creation_failed")
		return
	}
	log.Printf("✅ [Agent %d] Sheet creado: %s", agent.ID, spreadsheetID)

	// PASO 3: Guardar todo en la base de datos
	now := time.Now()
	agent.GoogleToken = string(tokenJSON)
	agent.GoogleCalendarID = calendarID
	agent.GoogleSheetID = spreadsheetID
	agent.GoogleConnected = true
	agent.GoogleConnectedAt = &now

	if err := config.DB.Save(&agent).Error; err != nil {
		log.Printf("❌ [Agent %d] Error guardando en BD: %v", agent.ID, err)
		c.Redirect(http.StatusTemporaryRedirect, "/my-agents?error=save_failed")
		return
	}

	log.Printf("🎉 [Agent %d] Integración completada exitosamente", agent.ID)

	// PASO 4: Actualizar .env del bot en el servidor (SOLO para AtomicBot)
	if agent.IsAtomicBot() && user.SharedServerIP != "" && user.SharedServerPassword != "" {
		log.Printf("🔄 [Agent %d] Actualizando .env en el servidor...", agent.ID)

		// Crear servicio de deploy
		deployService := services.NewAtomicBotDeployService(user.SharedServerIP, user.SharedServerPassword)

		// Conectar al servidor
		if err := deployService.Connect(); err != nil {
			log.Printf("⚠️  [Agent %d] Error conectando al servidor para actualizar .env: %v", agent.ID, err)
			// No fallar completamente, la integración ya está guardada en BD
		} else {
			defer deployService.Close()

			// Actualizar variables de entorno y reiniciar bot
			if err := deployService.RestartBotAfterGoogleIntegration(&agent, nil); err != nil {
				log.Printf("⚠️  [Agent %d] Error actualizando .env en servidor: %v", agent.ID, err)
				// No fallar completamente, la integración ya está guardada en BD
			} else {
				log.Printf("✅ [Agent %d] .env actualizado y bot reiniciado en servidor", agent.ID)
			}
		}
	}

	// Redirigir con éxito
	redirectURL := fmt.Sprintf("/my-agents?success=true&agent_id=%d&calendar_id=%s&sheet_id=%s",
		agent.ID, calendarID, spreadsheetID)
	c.Redirect(http.StatusTemporaryRedirect, redirectURL)
}

// DisconnectGoogle desconecta la integración de Google
func (h *GoogleIntegrationHandler) DisconnectGoogle(c *gin.Context) {
	userInterface, exists := c.Get("user")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "No autenticado"})
		return
	}

	user := userInterface.(*models.User)
	agentID := c.Param("agent_id")

	if agentID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "agent_id es requerido"})
		return
	}

	// Verificar que el agente pertenece al usuario
	var agent models.Agent
	if err := config.DB.Where("id = ? AND user_id = ?", agentID, user.ID).First(&agent).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Agente no encontrado"})
		return
	}

	// Limpiar campos de Google
	agent.GoogleToken = ""
	agent.GoogleCalendarID = ""
	agent.GoogleSheetID = ""
	agent.GoogleConnected = false
	agent.GoogleConnectedAt = nil

	if err := config.DB.Save(&agent).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Error desconectando"})
		return
	}

	log.Printf("✅ [Agent %d] Google desconectado", agent.ID)

	// Actualizar .env del bot en el servidor (SOLO para AtomicBot)
	if agent.IsAtomicBot() && user.SharedServerIP != "" && user.SharedServerPassword != "" {
		log.Printf("🔄 [Agent %d] Limpiando variables de Google del .env en el servidor...", agent.ID)

		deployService := services.NewAtomicBotDeployService(user.SharedServerIP, user.SharedServerPassword)

		if err := deployService.Connect(); err != nil {
			log.Printf("⚠️  [Agent %d] Error conectando al servidor: %v", agent.ID, err)
		} else {
			defer deployService.Close()

			if err := deployService.RestartBotAfterGoogleIntegration(&agent, nil); err != nil {
				log.Printf("⚠️  [Agent %d] Error limpiando .env: %v", agent.ID, err)
			} else {
				log.Printf("✅ [Agent %d] Variables de Google limpiadas del .env", agent.ID)
			}
		}
	}

	c.JSON(http.StatusOK, gin.H{"success": true})
}

// GetIntegrationStatus obtiene el estado de la integración
func (h *GoogleIntegrationHandler) GetIntegrationStatus(c *gin.Context) {
	userInterface, exists := c.Get("user")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "No autenticado"})
		return
	}

	user := userInterface.(*models.User)
	agentID := c.Param("agent_id")

	if agentID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "agent_id es requerido"})
		return
	}

	var agent models.Agent
	if err := config.DB.Where("id = ? AND user_id = ?", agentID, user.ID).First(&agent).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Agente no encontrado"})
		return
	}

	response := gin.H{
		"connected":    agent.GoogleConnected,
		"calendar_id":  agent.GoogleCalendarID,
		"sheet_id":     agent.GoogleSheetID,
		"connected_at": agent.GoogleConnectedAt,
	}

	// Si está conectado, agregar URLs públicas
	if agent.GoogleConnected {
		if agent.GoogleCalendarID != "" {
			response["calendar_url"] = fmt.Sprintf("https://calendar.google.com/calendar/u/0/r?cid=%s", agent.GoogleCalendarID)
		}
		if agent.GoogleSheetID != "" {
			response["sheet_url"] = fmt.Sprintf("https://docs.google.com/spreadsheets/d/%s/edit", agent.GoogleSheetID)
		}
	}

	c.JSON(http.StatusOK, response)
}

// CreateAppointment crea una cita en Calendar y Sheets
func (h *GoogleIntegrationHandler) CreateAppointment(c *gin.Context) {
	userInterface, exists := c.Get("user")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "No autenticado"})
		return
	}

	user := userInterface.(*models.User)

	var req struct {
		AgentID     uint      `json:"agent_id" binding:"required"`
		Title       string    `json:"title" binding:"required"`
		Description string    `json:"description"`
		StartTime   time.Time `json:"start_time" binding:"required"`
		EndTime     time.Time `json:"end_time" binding:"required"`
		ClientName  string    `json:"client_name" binding:"required"`
		ClientEmail string    `json:"client_email"`
		ClientPhone string    `json:"client_phone"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Datos inválidos", "details": err.Error()})
		return
	}

	// Obtener agente con integración
	var agent models.Agent
	if err := config.DB.Where("id = ? AND user_id = ? AND google_connected = ?", req.AgentID, user.ID, true).First(&agent).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Agente no encontrado o no conectado a Google"})
		return
	}

	ctx := context.Background()

	// Crear evento en Calendar
	eventData := services.EventData{
		Title:       req.Title,
		Description: req.Description,
		StartTime:   req.StartTime,
		EndTime:     req.EndTime,
		ClientEmail: req.ClientEmail,
		ClientPhone: req.ClientPhone,
	}

	eventID, err := h.calendarService.CreateEvent(ctx, agent.GoogleToken, agent.GoogleCalendarID, eventData)
	if err != nil {
		log.Printf("❌ Error creando evento en Calendar: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Error creando evento en Calendar"})
		return
	}

	log.Printf("✅ [Agent %d] Evento creado en Calendar: %s", agent.ID, eventID)

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

	err = h.sheetsService.AddAppointment(ctx, agent.GoogleToken, agent.GoogleSheetID, appointmentData)
	if err != nil {
		// Si falla Sheets, intentar eliminar el evento de Calendar
		h.calendarService.DeleteEvent(ctx, agent.GoogleToken, agent.GoogleCalendarID, eventID)
		log.Printf("❌ Error agregando a Sheet: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Error agregando a la hoja de cálculo"})
		return
	}

	log.Printf("✅ [Agent %d] Cita agregada a Sheet", agent.ID)

	c.JSON(http.StatusOK, gin.H{
		"success":  true,
		"event_id": eventID,
		"message":  "Cita creada exitosamente",
	})
}
