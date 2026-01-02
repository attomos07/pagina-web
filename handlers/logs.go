package handlers

import (
	"attomos/config"
	"attomos/models"
	"attomos/services"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
)

// GetAgentLogs obtiene los logs de un agente conectándose por SSH
func GetAgentLogs(c *gin.Context) {
	// Obtener usuario autenticado
	userInterface, exists := c.Get("user")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "No autenticado"})
		return
	}
	user := userInterface.(*models.User)
	userID := user.ID

	agentIDStr := c.Param("id")

	agentID, err := strconv.ParseUint(agentIDStr, 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "ID de agente inválido"})
		return
	}

	// Obtener agente
	var agent models.Agent
	if err := config.DB.Where("id = ? AND user_id = ?", agentID, userID).First(&agent).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Agente no encontrado"})
		return
	}

	// Obtener número de líneas (default 100, máximo 1000)
	lines := 100
	if linesParam := c.Query("lines"); linesParam != "" {
		if parsedLines, err := strconv.Atoi(linesParam); err == nil && parsedLines > 0 && parsedLines <= 1000 {
			lines = parsedLines
		}
	}

	var logs string

	// Determinar tipo de bot según agent.BotType
	if agent.IsAtomicBot() {
		// AtomicBot = servidor compartido global
		var globalServer models.GlobalServer
		if err := config.DB.Where("purpose = ?", "atomic-bots").First(&globalServer).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Servidor global no encontrado"})
			return
		}

		deployService := services.NewAtomicBotDeployService(globalServer.IPAddress, globalServer.RootPassword)
		if err := deployService.Connect(); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Error conectando al servidor: " + err.Error()})
			return
		}
		defer deployService.Close()

		logs, err = deployService.GetBotLogs(agent.ID, lines)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Error obteniendo logs: " + err.Error()})
			return
		}

	} else {
		// BuilderBot = servidor individual del agente
		if !agent.HasOwnServer() {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Agente no tiene servidor asignado"})
			return
		}

		deployService := services.NewBotDeployService(agent.ServerIP, agent.ServerPassword)
		if err := deployService.Connect(); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Error conectando al servidor: " + err.Error()})
			return
		}
		defer deployService.Close()

		// Para BuilderBot, los logs están en PM2
		cmd := "pm2 logs agent-" + strconv.FormatUint(uint64(agent.ID), 10) + " --lines " + strconv.Itoa(lines) + " --nostream --raw"
		logs, err = deployService.ExecuteCommand(cmd)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Error obteniendo logs: " + err.Error()})
			return
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"agent_id": agent.ID,
		"bot_type": agent.BotType,
		"logs":     logs,
		"lines":    lines,
	})
}
