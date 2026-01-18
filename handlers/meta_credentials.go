package handlers

import (
	"log"
	"net/http"
	"strconv"

	"attomos/config"
	"attomos/models"

	"github.com/gin-gonic/gin"
)

// GetMetaCredentialsStatus obtiene el estado de las credenciales de Meta para un agente
func GetMetaCredentialsStatus(c *gin.Context) {
	userInterface, exists := c.Get("user")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "No autenticado"})
		return
	}

	user := userInterface.(*models.User)
	agentIDStr := c.Param("agent_id")

	agentID, err := strconv.ParseUint(agentIDStr, 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "ID de agente inválido"})
		return
	}

	// Verificar que el agente pertenece al usuario
	var agent models.Agent
	if err := config.DB.Where("id = ? AND user_id = ?", agentID, user.ID).First(&agent).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Agente no encontrado"})
		return
	}

	// Verificar si tiene credenciales configuradas
	hasCredentials := agent.MetaAccessToken != "" &&
		agent.MetaPhoneNumberID != "" &&
		agent.MetaConnected

	response := gin.H{
		"agent_id":         agent.ID,
		"bot_type":         agent.BotType,
		"has_credentials":  hasCredentials,
		"connected":        agent.MetaConnected,
		"phone_number_id":  "",
		"display_number":   "",
		"verified_name":    "",
		"connected_at":     nil,
		"token_expires_at": nil,
	}

	if hasCredentials {
		// Mostrar solo información parcial
		if agent.MetaPhoneNumberID != "" {
			response["phone_number_id"] = maskSensitiveValue(agent.MetaPhoneNumberID)
		}
		response["display_number"] = agent.MetaDisplayNumber
		response["verified_name"] = agent.MetaVerifiedName
		response["connected_at"] = agent.MetaConnectedAt
		response["token_expires_at"] = agent.MetaTokenExpiresAt
		response["days_remaining"] = agent.GetMetaTokenDaysRemaining()
		response["token_expired"] = agent.IsMetaTokenExpired()
	}

	c.JSON(http.StatusOK, response)
}

// SaveMetaCredentials guarda las credenciales de Meta para un agente
func SaveMetaCredentials(c *gin.Context) {
	userInterface, exists := c.Get("user")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "No autenticado"})
		return
	}

	user := userInterface.(*models.User)
	agentIDStr := c.Param("agent_id")

	agentID, err := strconv.ParseUint(agentIDStr, 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "ID de agente inválido"})
		return
	}

	// Verificar que el agente pertenece al usuario
	var agent models.Agent
	if err := config.DB.Where("id = ? AND user_id = ?", agentID, user.ID).First(&agent).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Agente no encontrado"})
		return
	}

	// Solo permitir para OrbitalBot
	if !agent.IsOrbitalBot() {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Esta funcionalidad solo está disponible para planes de pago",
		})
		return
	}

	type SaveCredentialsRequest struct {
		PhoneNumberID string `json:"phone_number_id" binding:"required"`
		AccessToken   string `json:"access_token" binding:"required"`
		WABAID        string `json:"waba_id" binding:"required"`
		VerifyToken   string `json:"verify_token" binding:"required"`
	}

	var req SaveCredentialsRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   "Datos inválidos",
			"details": err.Error(),
		})
		return
	}

	log.Printf("💾 [Agent %d] Guardando credenciales de Meta WhatsApp", agent.ID)
	log.Printf("   - Phone Number ID: %s", maskSensitiveValue(req.PhoneNumberID))
	log.Printf("   - WABA ID: %s", maskSensitiveValue(req.WABAID))

	// Guardar credenciales
	agent.MetaPhoneNumberID = req.PhoneNumberID
	agent.MetaAccessToken = req.AccessToken
	agent.MetaWABAID = req.WABAID
	agent.MetaConnected = true

	// Actualizar en base de datos
	if err := config.DB.Save(&agent).Error; err != nil {
		log.Printf("❌ [Agent %d] Error guardando credenciales: %v", agent.ID, err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Error al guardar credenciales",
		})
		return
	}

	log.Printf("✅ [Agent %d] Credenciales de Meta guardadas exitosamente", agent.ID)

	// Si el bot ya está desplegado, actualizar el .env y reiniciar
	if agent.DeployStatus == "running" && agent.HasOwnServer() {
		go updateMetaCredentialsInBot(&agent, req.VerifyToken)
	}

	c.JSON(http.StatusOK, gin.H{
		"success":  true,
		"message":  "Credenciales guardadas exitosamente",
		"agent_id": agent.ID,
	})
}

// RemoveMetaCredentials elimina las credenciales de Meta
func RemoveMetaCredentials(c *gin.Context) {
	userInterface, exists := c.Get("user")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "No autenticado"})
		return
	}

	user := userInterface.(*models.User)
	agentIDStr := c.Param("agent_id")

	agentID, err := strconv.ParseUint(agentIDStr, 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "ID de agente inválido"})
		return
	}

	// Verificar que el agente pertenece al usuario
	var agent models.Agent
	if err := config.DB.Where("id = ? AND user_id = ?", agentID, user.ID).First(&agent).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Agente no encontrado"})
		return
	}

	log.Printf("🗑️  [Agent %d] Eliminando credenciales de Meta WhatsApp", agent.ID)

	// Limpiar credenciales
	agent.MetaAccessToken = ""
	agent.MetaPhoneNumberID = ""
	agent.MetaWABAID = ""
	agent.MetaDisplayNumber = ""
	agent.MetaVerifiedName = ""
	agent.MetaConnected = false
	agent.MetaConnectedAt = nil
	agent.MetaTokenExpiresAt = nil

	if err := config.DB.Save(&agent).Error; err != nil {
		log.Printf("❌ [Agent %d] Error eliminando credenciales: %v", agent.ID, err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Error al eliminar credenciales",
		})
		return
	}

	log.Printf("✅ [Agent %d] Credenciales de Meta eliminadas", agent.ID)

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "Credenciales eliminadas exitosamente",
	})
}

// updateMetaCredentialsInBot actualiza las credenciales en el bot desplegado
func updateMetaCredentialsInBot(agent *models.Agent, verifyToken string) {
	log.Printf("🔄 [Agent %d] Actualizando credenciales en bot desplegado", agent.ID)

	// TODO: Implementar actualización del .env en el servidor
	// Esto requerirá:
	// 1. Conectar al servidor vía SSH
	// 2. Actualizar las variables META_ACCESS_TOKEN, META_PHONE_NUMBER_ID, META_WABA_ID, WEBHOOK_VERIFY_TOKEN
	// 3. Reiniciar el servicio systemd
}

// maskSensitiveValue enmascara valores sensibles para logs
func maskSensitiveValue(value string) string {
	if len(value) <= 8 {
		return "***"
	}
	return value[:4] + "..." + value[len(value)-4:]
}
