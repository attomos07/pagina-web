package handlers

import (
	"encoding/json"
	"net/http"

	"attomos/config"
	"attomos/models"

	"github.com/gin-gonic/gin"
)

// CreateAgentRequest estructura para la petición de creación de agente
type CreateAgentRequest struct {
	Name         string             `json:"name" binding:"required"`
	PhoneNumber  string             `json:"phoneNumber" binding:"required"`
	BusinessType string             `json:"businessType" binding:"required"`
	MetaDocument string             `json:"metaDocument"`
	Config       models.AgentConfig `json:"config" binding:"required"`
}

// CreateAgent crea un nuevo agente
func CreateAgent(c *gin.Context) {
	var req CreateAgentRequest

	// Validar JSON
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   "Datos inválidos",
			"details": err.Error(),
		})
		return
	}

	// Obtener usuario del contexto
	userInterface, exists := c.Get("user")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{
			"error": "No autenticado",
		})
		return
	}

	user := userInterface.(*models.User)

	// Crear agente
	agent := models.Agent{
		UserID:       user.ID,
		Name:         req.Name,
		PhoneNumber:  req.PhoneNumber,
		BusinessType: req.BusinessType,
		MetaDocument: req.MetaDocument,
		Config:       req.Config,
		IsActive:     true,
	}

	// Guardar en base de datos
	if err := config.DB.Create(&agent).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Error al crear el agente",
		})
		return
	}

	// Respuesta exitosa
	c.JSON(http.StatusCreated, gin.H{
		"message": "Agente creado exitosamente",
		"agent":   agent,
	})
}

// GetUserAgents obtiene todos los agentes del usuario
func GetUserAgents(c *gin.Context) {
	// Obtener usuario del contexto
	userInterface, exists := c.Get("user")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{
			"error": "No autenticado",
		})
		return
	}

	user := userInterface.(*models.User)

	// Obtener agentes del usuario
	var agents []models.Agent
	if err := config.DB.Where("user_id = ?", user.ID).Find(&agents).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Error al obtener los agentes",
		})
		return
	}

	// Deserializar configuración para cada agente
	for i := range agents {
		if agents[i].Configuration != "" {
			json.Unmarshal([]byte(agents[i].Configuration), &agents[i].Config)
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"agents": agents,
	})
}

// GetAgent obtiene un agente específico
func GetAgent(c *gin.Context) {
	agentID := c.Param("id")

	// Obtener usuario del contexto
	userInterface, exists := c.Get("user")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{
			"error": "No autenticado",
		})
		return
	}

	user := userInterface.(*models.User)

	// Buscar agente
	var agent models.Agent
	if err := config.DB.Where("id = ? AND user_id = ?", agentID, user.ID).First(&agent).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{
			"error": "Agente no encontrado",
		})
		return
	}

	// Deserializar configuración
	if agent.Configuration != "" {
		json.Unmarshal([]byte(agent.Configuration), &agent.Config)
	}

	c.JSON(http.StatusOK, gin.H{
		"agent": agent,
	})
}

// UpdateAgent actualiza un agente existente
func UpdateAgent(c *gin.Context) {
	agentID := c.Param("id")

	var req CreateAgentRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   "Datos inválidos",
			"details": err.Error(),
		})
		return
	}

	// Obtener usuario del contexto
	userInterface, exists := c.Get("user")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{
			"error": "No autenticado",
		})
		return
	}

	user := userInterface.(*models.User)

	// Buscar agente
	var agent models.Agent
	if err := config.DB.Where("id = ? AND user_id = ?", agentID, user.ID).First(&agent).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{
			"error": "Agente no encontrado",
		})
		return
	}

	// Actualizar campos
	agent.Name = req.Name
	agent.PhoneNumber = req.PhoneNumber
	agent.BusinessType = req.BusinessType
	agent.MetaDocument = req.MetaDocument
	agent.Config = req.Config

	// Guardar cambios
	if err := config.DB.Save(&agent).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Error al actualizar el agente",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Agente actualizado exitosamente",
		"agent":   agent,
	})
}

// DeleteAgent elimina un agente
func DeleteAgent(c *gin.Context) {
	agentID := c.Param("id")

	// Obtener usuario del contexto
	userInterface, exists := c.Get("user")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{
			"error": "No autenticado",
		})
		return
	}

	user := userInterface.(*models.User)

	// Buscar agente
	var agent models.Agent
	if err := config.DB.Where("id = ? AND user_id = ?", agentID, user.ID).First(&agent).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{
			"error": "Agente no encontrado",
		})
		return
	}

	// Eliminar agente (soft delete)
	if err := config.DB.Delete(&agent).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Error al eliminar el agente",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Agente eliminado exitosamente",
	})
}

// ToggleAgentStatus activa o desactiva un agente
func ToggleAgentStatus(c *gin.Context) {
	agentID := c.Param("id")

	// Obtener usuario del contexto
	userInterface, exists := c.Get("user")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{
			"error": "No autenticado",
		})
		return
	}

	user := userInterface.(*models.User)

	// Buscar agente
	var agent models.Agent
	if err := config.DB.Where("id = ? AND user_id = ?", agentID, user.ID).First(&agent).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{
			"error": "Agente no encontrado",
		})
		return
	}

	// Cambiar estado
	agent.IsActive = !agent.IsActive

	// Guardar cambios
	if err := config.DB.Save(&agent).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Error al cambiar el estado del agente",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Estado del agente actualizado",
		"agent":   agent,
	})
}
