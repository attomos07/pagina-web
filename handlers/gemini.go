package handlers

import (
	"log"
	"net/http"

	"attomos/config"
	"attomos/models"
	"attomos/services"

	"github.com/gin-gonic/gin"
)

type SaveGeminiKeyRequest struct {
	APIKey string `json:"apiKey" binding:"required"`
}

// SaveGeminiKey guarda la API Key de Gemini en el .env del bot
func SaveGeminiKey(c *gin.Context) {
	agentID := c.Param("agent_id")

	userInterface, exists := c.Get("user")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{
			"error": "No autenticado",
		})
		return
	}

	user := userInterface.(*models.User)

	// Obtener agente
	var agent models.Agent
	if err := config.DB.Where("id = ? AND user_id = ?", agentID, user.ID).First(&agent).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{
			"error": "Agente no encontrado",
		})
		return
	}

	// Parsear request
	var req SaveGeminiKeyRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   "Datos inválidos",
			"details": err.Error(),
		})
		return
	}

	// Validar que la API Key sea válida
	if len(req.APIKey) < 30 || req.APIKey[:6] != "AIzaSy" {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "API Key inválida. Debe comenzar con 'AIzaSy'",
		})
		return
	}

	log.Printf("💾 [Agent %d] Guardando Gemini API Key...", agent.ID)

	// Determinar el servidor según el tipo de bot
	var serverIP, serverPassword string
	var isAtomicBot bool

	if agent.IsAtomicBot() {
		// Obtener servidor compartido global
		isAtomicBot = true
		serverManager := services.GetGlobalServerManager()
		servers, err := serverManager.ListAllServers()
		if err != nil || len(servers) == 0 {
			log.Printf("❌ [Agent %d] No se encontró servidor compartido", agent.ID)
			c.JSON(http.StatusInternalServerError, gin.H{
				"error": "Servidor compartido no disponible",
			})
			return
		}

		globalServer := servers[0]
		serverIP = globalServer.IPAddress
		serverPassword = globalServer.RootPassword
	} else {
		// BuilderBot - servidor individual del usuario
		isAtomicBot = false
		serverIP = user.SharedServerIP
		serverPassword = user.SharedServerPassword
	}

	if serverIP == "" || serverPassword == "" {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Servidor no configurado",
		})
		return
	}

	// Conectar al servidor y actualizar .env
	if isAtomicBot {
		atomicService := services.NewAtomicBotDeployService(serverIP, serverPassword)
		if err := atomicService.Connect(); err != nil {
			log.Printf("❌ [Agent %d] Error conectando a servidor: %v", agent.ID, err)
			c.JSON(http.StatusInternalServerError, gin.H{
				"error": "Error conectando al servidor",
			})
			return
		}
		defer atomicService.Close()

		if err := atomicService.UpdateGeminiAPIKey(&agent, req.APIKey); err != nil {
			log.Printf("❌ [Agent %d] Error actualizando API Key: %v", agent.ID, err)
			c.JSON(http.StatusInternalServerError, gin.H{
				"error": "Error guardando API Key en el servidor",
			})
			return
		}

	} else {
		deployService := services.NewBotDeployService(serverIP, serverPassword)
		if err := deployService.Connect(); err != nil {
			log.Printf("❌ [Agent %d] Error conectando a servidor: %v", agent.ID, err)
			c.JSON(http.StatusInternalServerError, gin.H{
				"error": "Error conectando al servidor",
			})
			return
		}
		defer deployService.Close()

		if err := deployService.UpdateGeminiAPIKey(&agent, req.APIKey); err != nil {
			log.Printf("❌ [Agent %d] Error actualizando API Key: %v", agent.ID, err)
			c.JSON(http.StatusInternalServerError, gin.H{
				"error": "Error guardando API Key en el servidor",
			})
			return
		}
	}

	log.Printf("✅ [Agent %d] Gemini API Key guardada exitosamente", agent.ID)

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "API Key guardada exitosamente",
	})
}

// RemoveGeminiKey elimina la API Key de Gemini del .env del bot
func RemoveGeminiKey(c *gin.Context) {
	agentID := c.Param("agent_id")

	userInterface, exists := c.Get("user")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{
			"error": "No autenticado",
		})
		return
	}

	user := userInterface.(*models.User)

	// Obtener agente
	var agent models.Agent
	if err := config.DB.Where("id = ? AND user_id = ?", agentID, user.ID).First(&agent).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{
			"error": "Agente no encontrado",
		})
		return
	}

	log.Printf("🗑️  [Agent %d] Eliminando Gemini API Key...", agent.ID)

	// Determinar el servidor según el tipo de bot
	var serverIP, serverPassword string
	var isAtomicBot bool

	if agent.IsAtomicBot() {
		isAtomicBot = true
		serverManager := services.GetGlobalServerManager()
		servers, err := serverManager.ListAllServers()
		if err != nil || len(servers) == 0 {
			log.Printf("❌ [Agent %d] No se encontró servidor compartido", agent.ID)
			c.JSON(http.StatusInternalServerError, gin.H{
				"error": "Servidor compartido no disponible",
			})
			return
		}

		globalServer := servers[0]
		serverIP = globalServer.IPAddress
		serverPassword = globalServer.RootPassword
	} else {
		isAtomicBot = false
		serverIP = user.SharedServerIP
		serverPassword = user.SharedServerPassword
	}

	if serverIP == "" || serverPassword == "" {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Servidor no configurado",
		})
		return
	}

	// Conectar al servidor y eliminar API Key
	if isAtomicBot {
		atomicService := services.NewAtomicBotDeployService(serverIP, serverPassword)
		if err := atomicService.Connect(); err != nil {
			log.Printf("❌ [Agent %d] Error conectando a servidor: %v", agent.ID, err)
			c.JSON(http.StatusInternalServerError, gin.H{
				"error": "Error conectando al servidor",
			})
			return
		}
		defer atomicService.Close()

		if err := atomicService.UpdateGeminiAPIKey(&agent, ""); err != nil {
			log.Printf("❌ [Agent %d] Error eliminando API Key: %v", agent.ID, err)
			c.JSON(http.StatusInternalServerError, gin.H{
				"error": "Error eliminando API Key del servidor",
			})
			return
		}

	} else {
		deployService := services.NewBotDeployService(serverIP, serverPassword)
		if err := deployService.Connect(); err != nil {
			log.Printf("❌ [Agent %d] Error conectando a servidor: %v", agent.ID, err)
			c.JSON(http.StatusInternalServerError, gin.H{
				"error": "Error conectando al servidor",
			})
			return
		}
		defer deployService.Close()

		if err := deployService.UpdateGeminiAPIKey(&agent, ""); err != nil {
			log.Printf("❌ [Agent %d] Error eliminando API Key: %v", agent.ID, err)
			c.JSON(http.StatusInternalServerError, gin.H{
				"error": "Error eliminando API Key del servidor",
			})
			return
		}
	}

	log.Printf("✅ [Agent %d] Gemini API Key eliminada exitosamente", agent.ID)

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "API Key eliminada exitosamente",
	})
}

// GetGeminiStatus obtiene el estado de Gemini (si tiene o no API Key)
func GetGeminiStatus(c *gin.Context) {
	agentID := c.Param("agent_id")

	userInterface, exists := c.Get("user")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{
			"error": "No autenticado",
		})
		return
	}

	user := userInterface.(*models.User)

	// Obtener agente
	var agent models.Agent
	if err := config.DB.Where("id = ? AND user_id = ?", agentID, user.ID).First(&agent).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{
			"error": "Agente no encontrado",
		})
		return
	}

	// Determinar el servidor según el tipo de bot
	var serverIP, serverPassword string
	var isAtomicBot bool

	if agent.IsAtomicBot() {
		isAtomicBot = true
		serverManager := services.GetGlobalServerManager()
		servers, err := serverManager.ListAllServers()
		if err != nil || len(servers) == 0 {
			c.JSON(http.StatusOK, gin.H{
				"has_api_key": false,
			})
			return
		}

		globalServer := servers[0]
		serverIP = globalServer.IPAddress
		serverPassword = globalServer.RootPassword
	} else {
		isAtomicBot = false
		serverIP = user.SharedServerIP
		serverPassword = user.SharedServerPassword
	}

	if serverIP == "" || serverPassword == "" {
		c.JSON(http.StatusOK, gin.H{
			"has_api_key": false,
		})
		return
	}

	// Verificar si tiene API Key en el .env
	var hasAPIKey bool

	if isAtomicBot {
		atomicService := services.NewAtomicBotDeployService(serverIP, serverPassword)
		if err := atomicService.Connect(); err != nil {
			c.JSON(http.StatusOK, gin.H{
				"has_api_key": false,
			})
			return
		}
		defer atomicService.Close()

		hasAPIKey = atomicService.CheckGeminiAPIKey(&agent)

	} else {
		deployService := services.NewBotDeployService(serverIP, serverPassword)
		if err := deployService.Connect(); err != nil {
			c.JSON(http.StatusOK, gin.H{
				"has_api_key": false,
			})
			return
		}
		defer deployService.Close()

		hasAPIKey = deployService.CheckGeminiAPIKey(&agent)
	}

	c.JSON(http.StatusOK, gin.H{
		"has_api_key": hasAPIKey,
	})
}
