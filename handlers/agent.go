package handlers

import (
	"encoding/base64"
	"fmt"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"attomos/config"
	"attomos/models"

	"github.com/gin-gonic/gin"
)

type CreateAgentRequest struct {
	Name         string             `json:"name" binding:"required"`
	PhoneNumber  string             `json:"phoneNumber" binding:"required"`
	BusinessType string             `json:"businessType" binding:"required"`
	MetaDocument string             `json:"metaDocument"` // Base64 del documento
	Config       models.AgentConfig `json:"config"`
}

// CreateAgent crea un nuevo agente de WhatsApp
func CreateAgent(c *gin.Context) {
	var req CreateAgentRequest

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   "Datos inválidos",
			"details": err.Error(),
		})
		return
	}

	userInterface, exists := c.Get("user")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{
			"error": "No autenticado",
		})
		return
	}

	user := userInterface.(*models.User)

	// ============================================
	// VERIFICAR QUE EL PROYECTO ESTÉ LISTO
	// ============================================
	if user.ProjectStatus != "ready" {
		statusMessages := map[string]string{
			"pending":  "Tu entorno se está inicializando. Por favor espera unos segundos.",
			"creating": "Tu entorno se está configurando (30-60 segundos). Por favor espera.",
			"error":    "Hubo un problema configurando tu entorno. Por favor contacta a soporte.",
		}

		message := statusMessages[user.ProjectStatus]
		if message == "" {
			message = "Tu entorno aún no está listo. Por favor espera."
		}

		c.JSON(http.StatusPreconditionFailed, gin.H{
			"error":         "Entorno no disponible",
			"projectStatus": user.ProjectStatus,
			"message":       message,
		})
		return
	}

	if user.GeminiAPIKey == "" {
		c.JSON(http.StatusPreconditionFailed, gin.H{
			"error":   "Configuración incompleta",
			"message": "No se pudo configurar tu API Key de IA. Por favor contacta a soporte.",
		})
		return
	}

	// Verificar que no exceda el límite de agentes
	var agentCount int64
	config.DB.Model(&models.Agent{}).Where("user_id = ?", user.ID).Count(&agentCount)

	// TODO: Verificar plan del usuario y límites
	maxAgents := int64(5) // Por ejemplo, plan básico
	if agentCount >= maxAgents {
		c.JSON(http.StatusForbidden, gin.H{
			"error":   "Límite alcanzado",
			"message": fmt.Sprintf("Has alcanzado el límite de %d agentes. Actualiza tu plan para crear más.", maxAgents),
		})
		return
	}

	// Procesar documento Meta (si existe)
	var metaDocPath string
	if req.MetaDocument != "" {
		// Decodificar base64
		docData, err := base64.StdEncoding.DecodeString(req.MetaDocument)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{
				"error": "Error al procesar el documento",
			})
			return
		}

		// Guardar en carpeta uploads
		uploadsDir := "./uploads/meta-docs"
		os.MkdirAll(uploadsDir, 0755)

		filename := fmt.Sprintf("user_%d_agent_%d_%s.txt", user.ID, time.Now().Unix(), sanitizeFilename(req.Name))
		metaDocPath = filepath.Join(uploadsDir, filename)

		if err := os.WriteFile(metaDocPath, docData, 0644); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{
				"error": "Error al guardar el documento",
			})
			return
		}
	}

	// Crear agente en la base de datos
	agent := models.Agent{
		UserID:       user.ID,
		Name:         req.Name,
		PhoneNumber:  req.PhoneNumber,
		BusinessType: req.BusinessType,
		MetaDocument: metaDocPath,
		Config:       req.Config,
		IsActive:     false,
		ServerStatus: "creating",
	}

	if err := config.DB.Create(&agent).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Error al crear el agente",
		})
		return
	}

	// Respuesta inmediata
	c.JSON(http.StatusAccepted, gin.H{
		"message": "Agente en proceso de creación",
		"agent":   agent,
		"status":  "creating",
	})

	// ============================================
	// DESPLEGAR BOT EN HETZNER (ASÍNCRONO)
	// ============================================
	go func() {
		log.Printf("🚀 [Agent %d] Iniciando despliegue del bot", agent.ID)

		// TODO: Aquí iría tu código de despliegue en Hetzner
		// Ejemplo simplificado:

		/*
			// 1. Crear servidor en Hetzner
			hetznerToken := os.Getenv("HETZNER_API_TOKEN")
			hetzner := services.NewHetznerService(hetznerToken)

			serverName := fmt.Sprintf("attomos-agent-%d", agent.ID)
			server, err := hetzner.CreateServer(serverName, "cx11", "ubuntu-22.04")

			if err != nil {
				log.Printf("❌ [Agent %d] Error creando servidor: %v", agent.ID, err)
				agent.ServerStatus = "error"
				config.DB.Save(&agent)
				return
			}

			log.Printf("✅ [Agent %d] Servidor creado: %s (IP: %s)", agent.ID, server.Name, server.PublicIP)

			// Actualizar agente con info del servidor
			agent.ServerID = server.ID
			agent.ServerIP = server.PublicIP
			agent.ServerStatus = "provisioning"
			config.DB.Save(&agent)

			// 2. Esperar a que el servidor esté listo
			time.Sleep(30 * time.Second)

			// 3. Desplegar el bot usando la API Key del usuario
			if err := deployBotToServer(agent, user); err != nil {
				log.Printf("❌ [Agent %d] Error desplegando bot: %v", agent.ID, err)
				agent.ServerStatus = "error"
				config.DB.Save(&agent)
				return
			}

			// 4. Marcar como activo
			agent.IsActive = true
			agent.ServerStatus = "running"
			config.DB.Save(&agent)

			log.Printf("🎉 [Agent %d] Bot desplegado exitosamente", agent.ID)
		*/

		// Por ahora, solo simular el despliegue
		time.Sleep(5 * time.Second)
		agent.IsActive = true
		agent.ServerStatus = "running"
		config.DB.Save(&agent)
		log.Printf("🎉 [Agent %d] Bot desplegado exitosamente (simulado)", agent.ID)
	}()
}

// GetUserAgents obtiene todos los agentes del usuario
func GetUserAgents(c *gin.Context) {
	userInterface, exists := c.Get("user")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{
			"error": "No autenticado",
		})
		return
	}

	user := userInterface.(*models.User)

	var agents []models.Agent
	if err := config.DB.Where("user_id = ?", user.ID).Find(&agents).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Error al obtener agentes",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"agents": agents,
		"total":  len(agents),
	})
}

// GetAgent obtiene un agente específico
func GetAgent(c *gin.Context) {
	agentID := c.Param("id")

	userInterface, exists := c.Get("user")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{
			"error": "No autenticado",
		})
		return
	}

	user := userInterface.(*models.User)

	var agent models.Agent
	if err := config.DB.Where("id = ? AND user_id = ?", agentID, user.ID).First(&agent).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{
			"error": "Agente no encontrado",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"agent": agent,
	})
}

// UpdateAgent actualiza un agente
func UpdateAgent(c *gin.Context) {
	agentID := c.Param("id")

	userInterface, exists := c.Get("user")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{
			"error": "No autenticado",
		})
		return
	}

	user := userInterface.(*models.User)

	var agent models.Agent
	if err := config.DB.Where("id = ? AND user_id = ?", agentID, user.ID).First(&agent).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{
			"error": "Agente no encontrado",
		})
		return
	}

	type UpdateRequest struct {
		Name   string             `json:"name"`
		Config models.AgentConfig `json:"config"`
	}

	var req UpdateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Datos inválidos",
		})
		return
	}

	if req.Name != "" {
		agent.Name = req.Name
	}

	// Solo actualizar config si no está vacío
	if req.Config.WelcomeMessage != "" || len(req.Config.Services) > 0 {
		agent.Config = req.Config
	}

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

// ToggleAgentStatus activa/desactiva un agente
func ToggleAgentStatus(c *gin.Context) {
	agentID := c.Param("id")

	userInterface, exists := c.Get("user")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{
			"error": "No autenticado",
		})
		return
	}

	user := userInterface.(*models.User)

	var agent models.Agent
	if err := config.DB.Where("id = ? AND user_id = ?", agentID, user.ID).First(&agent).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{
			"error": "Agente no encontrado",
		})
		return
	}

	agent.IsActive = !agent.IsActive

	if err := config.DB.Save(&agent).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Error al cambiar estado del agente",
		})
		return
	}

	status := "desactivado"
	if agent.IsActive {
		status = "activado"
	}

	c.JSON(http.StatusOK, gin.H{
		"message": fmt.Sprintf("Agente %s exitosamente", status),
		"agent":   agent,
	})
}

// DeleteAgent elimina un agente
func DeleteAgent(c *gin.Context) {
	agentID := c.Param("id")

	userInterface, exists := c.Get("user")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{
			"error": "No autenticado",
		})
		return
	}

	user := userInterface.(*models.User)

	var agent models.Agent
	if err := config.DB.Where("id = ? AND user_id = ?", agentID, user.ID).First(&agent).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{
			"error": "Agente no encontrado",
		})
		return
	}

	// TODO: Eliminar servidor de Hetzner si existe
	/*
		if agent.ServerID > 0 {
			go func() {
				hetznerToken := os.Getenv("HETZNER_API_TOKEN")
				hetzner := services.NewHetznerService(hetznerToken)
				if err := hetzner.DeleteServer(agent.ServerID); err != nil {
					log.Printf("⚠️ [Agent %d] Error eliminando servidor: %v", agent.ID, err)
				} else {
					log.Printf("✅ [Agent %d] Servidor eliminado", agent.ID)
				}
			}()
		}
	*/

	// Eliminar documento Meta si existe
	if agent.MetaDocument != "" {
		os.Remove(agent.MetaDocument)
	}

	// Eliminar agente de BD
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

// Helper: sanitizar nombre de archivo
func sanitizeFilename(name string) string {
	name = strings.ToLower(name)
	name = strings.ReplaceAll(name, " ", "_")
	name = strings.Map(func(r rune) rune {
		if (r >= 'a' && r <= 'z') || (r >= '0' && r <= '9') || r == '_' || r == '-' {
			return r
		}
		return -1
	}, name)
	return name
}
