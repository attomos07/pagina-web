package handlers

import (
	"encoding/base64"
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

type CreateAgentRequest struct {
	Name         string             `json:"name"`
	PhoneNumber  string             `json:"phoneNumber"`
	BusinessType string             `json:"businessType"`
	MetaDocument string             `json:"metaDocument"`
	Config       models.AgentConfig `json:"config"`
}

// CreateAgent crea un nuevo agente de WhatsApp
func CreateAgent(c *gin.Context) {
	var req CreateAgentRequest

	if err := c.ShouldBindJSON(&req); err != nil {
		log.Printf("❌ Error al parsear JSON: %v", err)
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   "Datos inválidos",
			"details": err.Error(),
		})
		return
	}

	// Validación manual
	if req.Name == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "El nombre del agente es requerido",
		})
		return
	}

	if req.PhoneNumber == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "El número de teléfono es requerido",
		})
		return
	}

	log.Printf("📋 [CreateAgent] Datos recibidos: Name=%s, Phone=%s, BusinessType=%s",
		req.Name, req.PhoneNumber, req.BusinessType)

	userInterface, exists := c.Get("user")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{
			"error": "No autenticado",
		})
		return
	}

	user := userInterface.(*models.User)

	// Si BusinessType está vacío, usar el del usuario
	if req.BusinessType == "" {
		req.BusinessType = user.BusinessType
		log.Printf("ℹ️ BusinessType vacío, usando del usuario: %s", user.BusinessType)
	}

	// Verificar que no exceda el límite de agentes
	var agentCount int64
	config.DB.Model(&models.Agent{}).Where("user_id = ?", user.ID).Count(&agentCount)

	maxAgents := int64(5)
	if agentCount >= maxAgents {
		c.JSON(http.StatusForbidden, gin.H{
			"error":   "Límite alcanzado",
			"message": fmt.Sprintf("Has alcanzado el límite de %d agentes. Actualiza tu plan para crear más.", maxAgents),
		})
		return
	}

	// Procesar documento Meta (si existe)
	var metaDocFilename string
	var docData []byte
	if req.MetaDocument != "" {
		var err error
		base64Data := req.MetaDocument
		if idx := strings.Index(base64Data, ","); idx != -1 {
			base64Data = base64Data[idx+1:]
		}

		docData, err = base64.StdEncoding.DecodeString(base64Data)
		if err != nil {
			log.Printf("❌ Error decodificando documento: %v", err)
			c.JSON(http.StatusBadRequest, gin.H{
				"error": "Error al procesar el documento",
			})
			return
		}

		metaDocFilename = fmt.Sprintf("user_%d_%d_%s.pdf", user.ID, time.Now().Unix(), sanitizeFilename(req.Name))
		log.Printf("✅ Documento procesado: %s (%d bytes)", metaDocFilename, len(docData))
	}

	// Asignar puerto único para este agente
	nextPort := 3001 + int(agentCount)

	// Crear agente en la base de datos
	agent := models.Agent{
		UserID:       user.ID,
		Name:         req.Name,
		PhoneNumber:  req.PhoneNumber,
		BusinessType: req.BusinessType,
		MetaDocument: metaDocFilename,
		Config:       req.Config,
		Port:         nextPort,
		DeployStatus: "pending",
		IsActive:     false,
	}

	if err := config.DB.Create(&agent).Error; err != nil {
		log.Printf("❌ Error creando agente en BD: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Error al crear el agente",
		})
		return
	}

	log.Printf("✅ Agente creado en BD: ID=%d, Port=%d", agent.ID, agent.Port)

	// Respuesta inmediata
	c.JSON(http.StatusAccepted, gin.H{
		"message": "Agente en proceso de creación",
		"agent":   agent,
		"status":  "pending",
	})

	// PROCESO ASÍNCRONO CON MEJOR MANEJO DE ERRORES
	go func() {
		log.Println("\n" + strings.Repeat("═", 80))
		log.Printf("║ %s ║", centerText("🚀 INICIO DE PROCESO DE CREACIÓN", 76))
		log.Printf("║ %s ║", centerText(fmt.Sprintf("Agente ID: %d | Usuario ID: %d", agent.ID, user.ID), 76))
		log.Println(strings.Repeat("═", 80))

		// Recargar usuario para tener datos actuales
		config.DB.First(&user, user.ID)

		isFirstAgent := agentCount == 0

		// PASO 1: Crear proyecto GCP si es necesario
		if isFirstAgent {
			log.Println("\n" + strings.Repeat("═", 80))
			log.Printf("║ %s ║", centerText("PASO 1/3: GOOGLE CLOUD PROJECT", 76))
			log.Println(strings.Repeat("═", 80))
			log.Printf("🎉 [User %d] Primer agente detectado - Creando proyecto GCP\n", user.ID)
			user.ProjectStatus = "creating"
			config.DB.Save(&user)

			gca, err := services.NewGoogleCloudAutomation()
			if err != nil {
				log.Printf("❌ [User %d] Error inicializando GCP: %v", user.ID, err)
				user.ProjectStatus = "error"
				agent.DeployStatus = "error"
				config.DB.Save(&user)
				config.DB.Save(&agent)
				return
			}

			projectID, apiKey, err := gca.CreateProjectForUser(user.ID, user.Email)
			if err != nil {
				log.Printf("❌ [User %d] Error creando proyecto: %v", user.ID, err)
				user.ProjectStatus = "error"
				agent.DeployStatus = "error"
				config.DB.Save(&user)
				config.DB.Save(&agent)
				return
			}

			projectIDCopy := projectID
			user.GCPProjectID = &projectIDCopy
			user.GeminiAPIKey = apiKey
			user.ProjectStatus = "ready"

			if err := config.DB.Save(&user).Error; err != nil {
				log.Printf("❌ [User %d] Error guardando proyecto: %v", user.ID, err)
				agent.DeployStatus = "error"
				config.DB.Save(&agent)
				return
			}

			log.Printf("🎉 [User %d] Proyecto GCP listo: %s", user.ID, projectID)
		}

		// PASO 2: Crear servidor compartido si es el primer agente
		if isFirstAgent {
			log.Println("\n" + strings.Repeat("═", 80))
			log.Printf("║ %s ║", centerText("PASO 2/3: SERVIDOR HETZNER", 76))
			log.Println(strings.Repeat("═", 80))
			log.Printf("🖥️  [User %d] Creando servidor compartido en Hetzner Cloud\n", user.ID)

			user.SharedServerStatus = "creating"
			config.DB.Save(&user)

			hetznerService, err := services.NewHetznerService()
			if err != nil {
				log.Printf("❌ [User %d] Error inicializando Hetzner: %v", user.ID, err)
				user.SharedServerStatus = "error"
				agent.DeployStatus = "error"
				config.DB.Save(&user)
				config.DB.Save(&agent)
				return
			}

			serverName := fmt.Sprintf("attomos-user-%d", user.ID)
			serverResp, err := hetznerService.CreateServer(serverName, user.ID)
			if err != nil {
				log.Printf("❌ [User %d] Error creando servidor: %v", user.ID, err)
				user.SharedServerStatus = "error"
				agent.DeployStatus = "error"
				config.DB.Save(&user)
				config.DB.Save(&agent)
				return
			}

			user.SharedServerID = serverResp.Server.ID
			user.SharedServerIP = serverResp.Server.PublicNet.IPv4.IP
			user.SharedServerPassword = serverResp.RootPassword
			user.SharedServerStatus = "provisioning"
			config.DB.Save(&user)

			log.Printf("✅ [User %d] Servidor creado exitosamente:", user.ID)
			log.Printf("   - ID: %d", serverResp.Server.ID)
			log.Printf("   - IP: %s", serverResp.Server.PublicNet.IPv4.IP)
			log.Printf("   - Tipo: CPX31 (4 vCPU, 8GB RAM)")

			// Esperar a que el servidor esté en estado "running" (máximo 5 minutos)
			log.Printf("⏳ [User %d] Esperando que el servidor esté en estado 'running'...", user.ID)
			if err := hetznerService.WaitForServer(serverResp.Server.ID, 5*time.Minute); err != nil {
				log.Printf("❌ [User %d] Timeout esperando servidor: %v", user.ID, err)
				user.SharedServerStatus = "error"
				agent.DeployStatus = "error"
				config.DB.Save(&user)
				config.DB.Save(&agent)
				return
			}

			log.Printf("✅ [User %d] Servidor está en estado 'running'", user.ID)
			log.Printf("ℹ️ [User %d] Nota: Cloud-init seguirá ejecutándose en segundo plano", user.ID)

			user.SharedServerStatus = "initializing"
			config.DB.Save(&user)

			// NO esperamos aquí - BotDeployService se encargará de esperar la inicialización
			log.Printf("⏭️ [User %d] Continuando al siguiente paso (inicialización en segundo plano)", user.ID)

		} else {
			log.Printf("========================================")
			log.Printf("ℹ️ [User %d] USANDO SERVIDOR COMPARTIDO EXISTENTE", user.ID)
			log.Printf("   - IP: %s", user.SharedServerIP)
			log.Printf("   - Estado: %s", user.SharedServerStatus)
			log.Printf("========================================")
		}

		// PASO 3: Desplegar bot en el servidor compartido
		// BotDeployService ahora maneja TODA la espera de inicialización
		log.Printf("========================================")
		log.Printf("🤖 [Agent %d] INICIANDO DESPLIEGUE DEL BOT", agent.ID)
		log.Printf("   - Puerto: %d", agent.Port)
		log.Printf("   - Servidor: %s", user.SharedServerIP)
		log.Printf("========================================")

		agent.DeployStatus = "deploying"
		config.DB.Save(&agent)

		deployService := services.NewBotDeployService(user.SharedServerIP, user.SharedServerPassword)

		// Conectar con reintentos mejorados
		log.Printf("🔌 [Agent %d] Conectando al servidor...", agent.ID)
		if err := deployService.Connect(); err != nil {
			log.Printf("❌ [Agent %d] Error conectando al servidor: %v", agent.ID, err)
			agent.DeployStatus = "error"
			config.DB.Save(&agent)
			return
		}
		defer deployService.Close()

		log.Printf("✅ [Agent %d] Conectado al servidor exitosamente", agent.ID)

		// DeployBot ahora incluye toda la lógica de espera y verificación
		log.Printf("📦 [Agent %d] Iniciando despliegue (esto puede tomar 10-20 minutos)...", agent.ID)
		if err := deployService.DeployBot(&agent, docData); err != nil {
			log.Printf("========================================")
			log.Printf("❌ [Agent %d] ERROR EN DESPLIEGUE", agent.ID)
			log.Printf("========================================")
			log.Printf("Error: %v", err)
			agent.DeployStatus = "error"
			config.DB.Save(&agent)
			return
		}

		// Actualizar servidor a "ready" si es primer agente y fue exitoso
		if isFirstAgent {
			user.SharedServerStatus = "ready"
			config.DB.Save(&user)
			log.Printf("✅ [User %d] Servidor marcado como 'ready'", user.ID)
		}

		// Marcar agente como activo y corriendo
		agent.IsActive = true
		agent.DeployStatus = "running"
		config.DB.Save(&agent)

		log.Printf("========================================")
		log.Printf("🎉 [Agent %d] BOT DESPLEGADO EXITOSAMENTE", agent.ID)
		log.Printf("   - Servidor: %s", user.SharedServerIP)
		log.Printf("   - Puerto: %d", agent.Port)
		log.Printf("   - Estado: running")
		log.Printf("========================================")
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
		"agents":   agents,
		"total":    len(agents),
		"serverIp": user.SharedServerIP,
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

	// Detener el bot en el servidor compartido
	go func() {
		deployService := services.NewBotDeployService(user.SharedServerIP, user.SharedServerPassword)
		if err := deployService.Connect(); err != nil {
			log.Printf("⚠️ [Agent %d] Error conectando al servidor: %v", agent.ID, err)
			return
		}
		defer deployService.Close()

		if err := deployService.StopAndRemoveBot(agent.ID); err != nil {
			log.Printf("⚠️ [Agent %d] Error eliminando bot: %v", agent.ID, err)
		} else {
			log.Printf("✅ [Agent %d] Bot eliminado del servidor", agent.ID)
		}
	}()

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

// Helper: centrar texto
func centerText(text string, width int) string {
	if len(text) >= width {
		return text[:width]
	}
	padding := (width - len(text)) / 2
	return strings.Repeat(" ", padding) + text + strings.Repeat(" ", width-len(text)-padding)
}
