package handlers

import (
	"attomos/config"
	"attomos/models"
	"attomos/services"
	"bufio"
	"context"
	"fmt"
	"net/http"
	"strconv"
	"time"

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

// StreamAgentLogs transmite los logs de un agente en tiempo real usando SSE
func StreamAgentLogs(c *gin.Context) {
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

	// Configurar headers para SSE
	c.Header("Content-Type", "text/event-stream")
	c.Header("Cache-Control", "no-cache")
	c.Header("Connection", "keep-alive")
	c.Header("Transfer-Encoding", "chunked")
	c.Header("X-Accel-Buffering", "no") // Importante para nginx

	// Crear contexto con timeout
	ctx, cancel := context.WithCancel(c.Request.Context())
	defer cancel()

	// Canal para notificar cierre
	clientGone := c.Writer.CloseNotify()

	// Flusher para enviar datos inmediatamente
	flusher, ok := c.Writer.(http.Flusher)
	if !ok {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Streaming no soportado"})
		return
	}

	if agent.IsAtomicBot() {
		streamAtomicBotLogs(ctx, c, agent, flusher, clientGone)
	} else {
		streamBuilderBotLogs(ctx, c, agent, flusher, clientGone)
	}
}

// streamAtomicBotLogs transmite logs de AtomicBot en tiempo real
func streamAtomicBotLogs(ctx context.Context, c *gin.Context, agent models.Agent, flusher http.Flusher, clientGone <-chan bool) {
	// Obtener servidor global
	var globalServer models.GlobalServer
	if err := config.DB.Where("purpose = ?", "atomic-bots").First(&globalServer).Error; err != nil {
		sendSSEError(c, flusher, "Servidor global no encontrado")
		return
	}

	deployService := services.NewAtomicBotDeployService(globalServer.IPAddress, globalServer.RootPassword)
	if err := deployService.Connect(); err != nil {
		sendSSEError(c, flusher, "Error conectando al servidor: "+err.Error())
		return
	}
	defer deployService.Close()

	// Comando para seguir logs en tiempo real
	logFile := fmt.Sprintf("/var/log/atomic-bot-%d.log", agent.ID)
	cmd := fmt.Sprintf("tail -f -n 100 %s", logFile)

	// Ejecutar comando y obtener stdout - ACCESO CORRECTO AL CLIENTE SSH
	session, err := deployService.GetSSHClient().NewSession()
	if err != nil {
		sendSSEError(c, flusher, "Error creando sesión SSH: "+err.Error())
		return
	}
	defer session.Close()

	stdout, err := session.StdoutPipe()
	if err != nil {
		sendSSEError(c, flusher, "Error obteniendo stdout: "+err.Error())
		return
	}

	// Iniciar comando
	if err := session.Start(cmd); err != nil {
		sendSSEError(c, flusher, "Error ejecutando comando: "+err.Error())
		return
	}

	// Enviar mensaje inicial
	sendSSEMessage(c, flusher, "✅ Conectado - Transmitiendo logs en tiempo real...\n")

	// Leer y enviar logs línea por línea
	scanner := bufio.NewScanner(stdout)
	for {
		select {
		case <-ctx.Done():
			sendSSEMessage(c, flusher, "🔴 Conexión cerrada por el servidor\n")
			return
		case <-clientGone:
			sendSSEMessage(c, flusher, "🔴 Cliente desconectado\n")
			return
		default:
			if scanner.Scan() {
				line := scanner.Text()
				sendSSEMessage(c, flusher, line+"\n")
			} else {
				// Si hay error o fin del stream
				if err := scanner.Err(); err != nil {
					sendSSEError(c, flusher, "Error leyendo logs: "+err.Error())
					return
				}
				// Esperar un poco antes de continuar
				time.Sleep(100 * time.Millisecond)
			}
		}
	}
}

// streamBuilderBotLogs transmite logs de BuilderBot en tiempo real
func streamBuilderBotLogs(ctx context.Context, c *gin.Context, agent models.Agent, flusher http.Flusher, clientGone <-chan bool) {
	if !agent.HasOwnServer() {
		sendSSEError(c, flusher, "Agente no tiene servidor asignado")
		return
	}

	deployService := services.NewBotDeployService(agent.ServerIP, agent.ServerPassword)
	if err := deployService.Connect(); err != nil {
		sendSSEError(c, flusher, "Error conectando al servidor: "+err.Error())
		return
	}
	defer deployService.Close()

	// Comando para seguir logs de PM2 en tiempo real
	cmd := fmt.Sprintf("pm2 logs agent-%d --lines 100 --raw", agent.ID)

	// Ejecutar comando y obtener stdout - ACCESO CORRECTO AL CLIENTE SSH
	session, err := deployService.GetSSHClient().NewSession()
	if err != nil {
		sendSSEError(c, flusher, "Error creando sesión SSH: "+err.Error())
		return
	}
	defer session.Close()

	stdout, err := session.StdoutPipe()
	if err != nil {
		sendSSEError(c, flusher, "Error obteniendo stdout: "+err.Error())
		return
	}

	// Iniciar comando
	if err := session.Start(cmd); err != nil {
		sendSSEError(c, flusher, "Error ejecutando comando: "+err.Error())
		return
	}

	// Enviar mensaje inicial
	sendSSEMessage(c, flusher, "✅ Conectado - Transmitiendo logs en tiempo real...\n")

	// Leer y enviar logs línea por línea
	scanner := bufio.NewScanner(stdout)
	for {
		select {
		case <-ctx.Done():
			sendSSEMessage(c, flusher, "🔴 Conexión cerrada por el servidor\n")
			return
		case <-clientGone:
			sendSSEMessage(c, flusher, "🔴 Cliente desconectado\n")
			return
		default:
			if scanner.Scan() {
				line := scanner.Text()
				sendSSEMessage(c, flusher, line+"\n")
			} else {
				// Si hay error o fin del stream
				if err := scanner.Err(); err != nil {
					sendSSEError(c, flusher, "Error leyendo logs: "+err.Error())
					return
				}
				// Esperar un poco antes de continuar
				time.Sleep(100 * time.Millisecond)
			}
		}
	}
}

// sendSSEMessage envía un mensaje SSE al cliente
func sendSSEMessage(c *gin.Context, flusher http.Flusher, message string) {
	fmt.Fprintf(c.Writer, "data: %s\n\n", message)
	flusher.Flush()
}

// sendSSEError envía un error SSE al cliente
func sendSSEError(c *gin.Context, flusher http.Flusher, errorMsg string) {
	fmt.Fprintf(c.Writer, "event: error\ndata: %s\n\n", errorMsg)
	flusher.Flush()
}
