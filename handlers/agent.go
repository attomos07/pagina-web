package handlers

import (
	"bytes"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io/ioutil"
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
	BranchID     uint               `json:"branchId"`
	Config       models.AgentConfig `json:"config"`
}

// CreateAgent crea un nuevo agente de WhatsApp
func CreateAgent(c *gin.Context) {
	// ==================== LOGGING DETALLADO ====================
	bodyBytes, _ := ioutil.ReadAll(c.Request.Body)
	log.Printf("🔍 [DEBUG] Payload completo recibido:\n%s", string(bodyBytes))
	c.Request.Body = ioutil.NopCloser(bytes.NewBuffer(bodyBytes))
	// ==========================================================

	var req CreateAgentRequest

	if err := c.ShouldBindJSON(&req); err != nil {
		log.Printf("❌ Error al parsear JSON: %v", err)

		// Logging adicional para errores de tipo
		if jsonErr, ok := err.(*json.UnmarshalTypeError); ok {
			log.Printf("❌ [DEBUG] Campo problemático: %s", jsonErr.Field)
			log.Printf("❌ [DEBUG] Tipo esperado: %s", jsonErr.Type)
			log.Printf("❌ [DEBUG] Tipo recibido: %s", jsonErr.Value)
			log.Printf("❌ [DEBUG] Offset: %d", jsonErr.Offset)
		}

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

	log.Printf("✅ [DEBUG] JSON parseado correctamente para user %d", user.ID)
	log.Printf("🔍 [DEBUG] Verificando suscripción activa...")

	// Obtener o crear suscripción activa del usuario
	var subscription models.Subscription
	err := config.DB.Where("user_id = ? AND status IN (?)", user.ID, []string{"active", "trialing"}).First(&subscription).Error

	if err != nil {
		// Si no existe suscripción activa, crear una gratuita por defecto
		log.Printf("⚠️  [User %d] No se encontró suscripción activa, creando plan gratuito...", user.ID)

		now := time.Now()
		oneYearLater := now.AddDate(1, 0, 0)

		subscription = models.Subscription{
			UserID:             user.ID,
			Plan:               "gratuito",
			BillingCycle:       "monthly",
			Status:             "active",
			CurrentPeriodStart: &now,
			CurrentPeriodEnd:   &oneYearLater,
			Amount:             0,
			Currency:           "mxn",
		}

		// Configurar límites del plan
		subscription.SetPlanLimits()

		if err := config.DB.Create(&subscription).Error; err != nil {
			log.Printf("❌ [User %d] Error creando suscripción: %v", user.ID, err)
			c.JSON(http.StatusInternalServerError, gin.H{
				"error": "Error al verificar suscripción",
			})
			return
		}

		log.Printf("✅ [User %d] Suscripción gratuita creada automáticamente", user.ID)
		log.Printf("   - MaxAgents: %d", subscription.MaxAgents)
		log.Printf("   - MaxMessages: %d", subscription.MaxMessages)
	}

	log.Printf("✅ [User %d] Suscripción encontrada: Plan=%s, Status=%s", user.ID, subscription.Plan, subscription.Status)

	// Determinar el tipo de bot según el plan
	botType := "orbital" // Default para planes de pago (NUEVO: OrbitalBot reemplaza BuilderBot)
	if subscription.Plan == "gratuito" {
		botType = "atomic"
		log.Printf("📋 [User %d] Plan gratuito detectado → usando AtomicBot (Go + WhatsApp Web)", user.ID)
	} else {
		log.Printf("📋 [User %d] Plan de pago (%s) → usando OrbitalBot (Go + Meta API)", user.ID, subscription.Plan)
	}

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
		BranchID:     req.BranchID,
		Config:       req.Config,
		Port:         nextPort,
		DeployStatus: "pending",
		IsActive:     false,
		BotType:      botType,
	}

	if err := config.DB.Create(&agent).Error; err != nil {
		log.Printf("❌ Error creando agente en BD: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Error al crear el agente",
		})
		return
	}

	log.Printf("✅ Agente creado en BD: ID=%d, Port=%d, BotType=%s", agent.ID, agent.Port, agent.BotType)

	// ── Sincronizar servicios/trabajadores/festivos → my_business_info ──
	if req.BranchID > 0 {
		go syncOnboardingToBranch(req.BranchID, req.Config)
	}

	// Respuesta inmediata
	c.JSON(http.StatusAccepted, gin.H{
		"message": "Agente en proceso de creación",
		"agent":   agent,
		"status":  "pending",
	})

	// PROCESO ASÍNCRONO
	go func() {
		log.Println("\n" + strings.Repeat("═", 80))
		log.Printf("║ %s ║", centerText("🚀 INICIO DE PROCESO DE CREACIÓN", 76))
		log.Printf("║ %s ║", centerText(fmt.Sprintf("Agente ID: %d | Usuario ID: %d | Tipo: %s", agent.ID, user.ID, agent.BotType), 76))
		log.Println(strings.Repeat("═", 80))

		// Recargar usuario para tener datos actuales
		config.DB.Preload("GoogleCloudProject").First(&user, user.ID)

		isFirstAgent := agentCount == 0

		if agent.IsAtomicBot() {
			// ========================
			// ATOMIC BOT (Go)
			// ========================
			log.Println("\n" + strings.Repeat("═", 80))
			log.Printf("║ %s ║", centerText("DESPLIEGUE DE ATOMIC BOT (GO)", 76))
			log.Println(strings.Repeat("═", 80))

			// PASO 1: Obtener o crear servidor compartido global
			log.Println("\n" + strings.Repeat("═", 80))
			log.Printf("║ %s ║", centerText("PASO 1/2: OBTENER SERVIDOR COMPARTIDO GLOBAL", 76))
			log.Println(strings.Repeat("═", 80))

			serverManager := services.GetGlobalServerManager()
			globalServer, err := serverManager.GetOrCreateAtomicBotsServer()

			if err != nil {
				log.Printf("❌ [Agent %d] Error obteniendo servidor compartido: %v", agent.ID, err)
				agent.DeployStatus = "error"
				config.DB.Save(&agent)
				return
			}

			// Verificar que el servidor esté listo
			if globalServer.Status == "initializing" {
				log.Printf("⏳ [Agent %d] Servidor compartido inicializándose, esperando...", agent.ID)

				// Esperar hasta 20 minutos máximo
				timeout := time.After(20 * time.Minute)
				ticker := time.NewTicker(30 * time.Second)
				defer ticker.Stop()

				for {
					select {
					case <-timeout:
						log.Printf("❌ [Agent %d] Timeout esperando servidor compartido", agent.ID)
						agent.DeployStatus = "error"
						config.DB.Save(&agent)
						return
					case <-ticker.C:
						// Recargar servidor
						updatedServer, err := serverManager.GetServerStatus(globalServer.ID)
						if err != nil {
							log.Printf("⚠️  [Agent %d] Error recargando servidor: %v", agent.ID, err)
							continue
						}

						if updatedServer.IsReady() {
							globalServer = updatedServer
							log.Printf("✅ [Agent %d] Servidor compartido listo!", agent.ID)
							goto ServerReady
						}

						log.Printf("⏳ [Agent %d] Servidor aún inicializando (Status: %s)...", agent.ID, updatedServer.Status)
					}
				}
			}

		ServerReady:
			if !globalServer.IsReady() {
				log.Printf("❌ [Agent %d] Servidor compartido no está listo (Status: %s)", agent.ID, globalServer.Status)
				agent.DeployStatus = "error"
				config.DB.Save(&agent)
				return
			}

			// Asignar puerto en el servidor compartido
			assignedPort, err := serverManager.AssignPortToAgent(globalServer)
			if err != nil {
				log.Printf("❌ [Agent %d] Error asignando puerto: %v", agent.ID, err)
				agent.DeployStatus = "error"
				config.DB.Save(&agent)
				return
			}

			// Actualizar puerto del agente
			agent.Port = assignedPort
			config.DB.Save(&agent)

			log.Printf("✅ [Agent %d] Servidor compartido asignado:", agent.ID)
			log.Printf("   - Server ID: %d", globalServer.ID)
			log.Printf("   - IP: %s", globalServer.IPAddress)
			log.Printf("   - Puerto asignado: %d", assignedPort)
			log.Printf("   - Capacidad: %d/%d agentes", globalServer.CurrentAgents, globalServer.MaxAgents)

			// PASO 2: Desplegar bot en servidor compartido
			log.Println("\n" + strings.Repeat("═", 80))
			log.Printf("║ %s ║", centerText("PASO 2/2: DESPLIEGUE DEL ATOMIC BOT", 76))
			log.Println(strings.Repeat("═", 80))

			agent.DeployStatus = "deploying"
			config.DB.Save(&agent)

			atomicService := services.NewAtomicBotDeployService(globalServer.IPAddress, globalServer.RootPassword)

			// Conectar al servidor compartido
			maxRetries := 10
			retryDelay := 10 * time.Second
			var connectErr error

			for attempt := 1; attempt <= maxRetries; attempt++ {
				log.Printf("🔌 [Agent %d] Intento de conexión SSH %d/%d...", agent.ID, attempt, maxRetries)

				connectErr = atomicService.Connect()
				if connectErr == nil {
					log.Printf("✅ [Agent %d] Conectado exitosamente al servidor compartido", agent.ID)
					break
				}

				if attempt < maxRetries {
					log.Printf("⚠️  [Agent %d] Error conectando (intento %d/%d): %v", agent.ID, attempt, maxRetries, connectErr)
					log.Printf("   ⏳ Reintentando en %v...", retryDelay)
					time.Sleep(retryDelay)
				}
			}

			if connectErr != nil {
				log.Printf("❌ [Agent %d] No se pudo conectar después de %d intentos: %v", agent.ID, maxRetries, connectErr)
				agent.DeployStatus = "error"
				config.DB.Save(&agent)

				// Liberar puerto
				serverManager.ReleaseAgentPort(globalServer)
				return
			}

			defer atomicService.Close()

			// Obtener Gemini API Key
			geminiAPIKey := user.GetGeminiAPIKey()
			if geminiAPIKey == "" {
				log.Printf("⚠️  [Agent %d] Sin Gemini API Key, bot funcionará sin IA", agent.ID)
			}

			// Obtener credenciales de Google del agente
			var googleCredentials []byte
			if agent.GoogleConnected && agent.GoogleToken != "" {
				googleCredentials = []byte(agent.GoogleToken)
				log.Printf("📊 [Agent %d] Credenciales de Google encontradas para integración", agent.ID)
				log.Printf("   - Google Sheets ID: %s", agent.GoogleSheetID)
				log.Printf("   - Google Calendar ID: %s", agent.GoogleCalendarID)
			} else {
				log.Printf("⚠️  [Agent %d] Sin integración de Google - las citas no se guardarán en Sheets/Calendar", agent.ID)
			}

			// Cargar sucursal vinculada al agente (fuente de verdad del negocio)
			var branch *models.MyBusinessInfo
			if agent.BranchID > 0 {
				var b models.MyBusinessInfo
				if err := config.DB.First(&b, agent.BranchID).Error; err == nil {
					branch = &b
					log.Printf("📋 [Agent %d] Sucursal cargada: %s (ID %d)", agent.ID, b.BranchName, b.ID)
				} else {
					log.Printf("⚠️  [Agent %d] No se pudo cargar sucursal %d: %v", agent.ID, agent.BranchID, err)
				}
			} else {
				log.Printf("⚠️  [Agent %d] Sin sucursal vinculada (BranchID=0), website/email/ubicación/redes no estarán en la config", agent.ID)
			}

			// Desplegar AtomicBot con las credenciales de Google
			if err := atomicService.DeployAtomicBot(&agent, branch, geminiAPIKey, googleCredentials); err != nil {
				log.Printf("❌ [Agent %d] Error desplegando AtomicBot: %v", agent.ID, err)
				agent.DeployStatus = "error"
				config.DB.Save(&agent)

				// Liberar puerto
				serverManager.ReleaseAgentPort(globalServer)
				return
			}

			// Marcar agente como activo y corriendo
			agent.IsActive = true
			agent.DeployStatus = "running"
			config.DB.Save(&agent)

			log.Printf("========================================")
			log.Printf("🎉 [Agent %d] ATOMIC BOT DESPLEGADO EXITOSAMENTE", agent.ID)
			log.Printf("   - Servidor Compartido: %s", globalServer.IPAddress)
			log.Printf("   - Puerto: %d", agent.Port)
			log.Printf("   - Tecnología: WhatsApp Web (Go)")
			log.Printf("   - Acceso: SSH → Ver logs para escanear QR")
			log.Printf("   - Comando logs: tail -f /var/log/atomic-bot-%d.log", agent.ID)

			if geminiAPIKey != "" {
				log.Printf("   - IA: Gemini AI habilitada ✅")
			} else {
				log.Printf("   - IA: Sin configurar")
				log.Printf("   💡 Configura tu Gemini API Key en los ajustes del agente")
				log.Printf("   🔗 Obtener API Key: https://aistudio.google.com/apikey")
			}

			if agent.GoogleConnected {
				log.Printf("   - Google Sheets: Habilitado ✅")
				log.Printf("   - Google Calendar: Habilitado ✅")
			} else {
				log.Printf("   - Google Sheets/Calendar: Sin configurar")
				log.Printf("   💡 Conecta Google Calendar en los ajustes del agente")
			}

			log.Printf("========================================")

		} else {
			// ========================
			// ORBITAL BOT (Go + Meta API) - SERVIDOR POR USUARIO
			// ========================
			log.Println("\n" + strings.Repeat("═", 80))
			log.Printf("║ %s ║", centerText("DESPLIEGUE DE ORBITAL BOT (GO + META API)", 76))
			log.Println(strings.Repeat("═", 80))

			// PASO 1: Crear proyecto GCP si es necesario (NO BLOQUEANTE)
			if isFirstAgent {
				log.Println("\n" + strings.Repeat("═", 80))
				log.Printf("║ %s ║", centerText("PASO 1/5: GOOGLE CLOUD PROJECT", 76))
				log.Println(strings.Repeat("═", 80))
				log.Printf("🎉 [User %d] Primer agente detectado - Intentando crear proyecto GCP\n", user.ID)

				// Verificar si ya existe un proyecto GCP
				var gcpProject models.GoogleCloudProject
				err := config.DB.Where("user_id = ?", user.ID).First(&gcpProject).Error

				if err != nil {
					// No existe, crear nuevo proyecto
					gcpProject = models.GoogleCloudProject{
						UserID:        user.ID,
						ProjectStatus: "creating",
					}
					config.DB.Create(&gcpProject)
				} else {
					// Ya existe, marcar como en creación
					gcpProject.MarkAsCreating()
					config.DB.Save(&gcpProject)
				}

				gca, err := services.NewGoogleCloudAutomation()
				if err != nil {
					log.Printf("⚠️ [User %d] Error inicializando GCP (NO CRÍTICO): %v", user.ID, err)
					gcpProject.MarkAsError()
					config.DB.Save(&gcpProject)
				} else {
					projectID, apiKey, err := gca.CreateProjectForUser(user.ID, user.Email)
					if err != nil {
						log.Printf("⚠️ [User %d] Error creando proyecto GCP (NO CRÍTICO): %v", user.ID, err)
						gcpProject.MarkAsError()
						config.DB.Save(&gcpProject)
					} else {
						gcpProject.ProjectID = projectID
						gcpProject.ProjectName = fmt.Sprintf("Attomos User %d", user.ID)
						gcpProject.GeminiAPIKey = apiKey
						gcpProject.MarkAsReady()

						if err := config.DB.Save(&gcpProject).Error; err != nil {
							log.Printf("⚠️ [User %d] Error guardando proyecto (NO CRÍTICO): %v", user.ID, err)
						} else {
							log.Printf("🎉 [User %d] Proyecto GCP listo: %s", user.ID, projectID)
						}
					}
				}
			}

			// PASO 2: Obtener o crear servidor del usuario (CRÍTICO)
			log.Println("\n" + strings.Repeat("═", 80))
			log.Printf("║ %s ║", centerText("PASO 2/5: OBTENER O CREAR SERVIDOR DEL USUARIO", 76))
			log.Println(strings.Repeat("═", 80))

			// Buscar si el usuario ya tiene un agente con servidor
			var existingAgent models.Agent
			hasExistingServer := config.DB.Where("user_id = ? AND server_id > 0 AND bot_type = ?", user.ID, "orbital").
				First(&existingAgent).Error == nil

			if hasExistingServer {
				// REUTILIZAR servidor existente del usuario
				log.Printf("✅ [Agent %d] Usuario ya tiene servidor (ID: %d)", agent.ID, existingAgent.ServerID)
				log.Printf("   - IP: %s", existingAgent.ServerIP)
				log.Printf("   - Reutilizando para nuevo agente...")

				agent.ServerID = existingAgent.ServerID
				agent.ServerIP = existingAgent.ServerIP
				agent.ServerPassword = existingAgent.ServerPassword
				agent.ServerStatus = "ready"
				config.DB.Save(&agent)

				log.Printf("✅ [Agent %d] Servidor reutilizado exitosamente", agent.ID)
			} else {
				// CREAR nuevo servidor para el usuario
				log.Printf("🖥️  [Agent %d] Primer agente OrbitalBot del usuario - Creando servidor\n", agent.ID)

				agent.ServerStatus = "creating"
				config.DB.Save(&agent)

				hetznerService, err := services.NewHetznerService()
				if err != nil {
					log.Printf("❌ [Agent %d] Error inicializando servicio Hetzner: %v", agent.ID, err)
					agent.ServerStatus = "error"
					agent.DeployStatus = "error"
					config.DB.Save(&agent)
					return
				}

				// Nombre único por USUARIO, no por agente
				serverName := fmt.Sprintf("attomos-user-%d", user.ID)
				serverResp, err := hetznerService.CreateServer(serverName, user.ID)
				if err != nil {
					log.Printf("❌ [Agent %d] Error creando servidor: %v", agent.ID, err)
					agent.ServerStatus = "error"
					agent.DeployStatus = "error"
					config.DB.Save(&agent)
					return
				}

				agent.ServerID = serverResp.Server.ID
				agent.ServerIP = serverResp.Server.PublicNet.IPv4.IP
				agent.ServerPassword = serverResp.RootPassword
				agent.ServerStatus = "provisioning"
				config.DB.Save(&agent)

				log.Printf("✅ [Agent %d] Servidor del usuario creado exitosamente:", agent.ID)
				log.Printf("   - Hetzner ID: %d", serverResp.Server.ID)
				log.Printf("   - IP: %s", serverResp.Server.PublicNet.IPv4.IP)

				// Esperar a que el servidor esté en estado "running"
				log.Printf("⏳ [Agent %d] Esperando que el servidor esté listo...", agent.ID)
				if err := hetznerService.WaitForServer(serverResp.Server.ID, 5*time.Minute); err != nil {
					log.Printf("❌ [Agent %d] Timeout esperando servidor: %v", agent.ID, err)
					agent.ServerStatus = "error"
					agent.DeployStatus = "error"
					config.DB.Save(&agent)
					return
				}

				log.Printf("✅ [Agent %d] Servidor en estado 'running'", agent.ID)

				agent.ServerStatus = "initializing"
				config.DB.Save(&agent)

				go hetznerService.MonitorCloudInitLogs(agent.ServerIP, agent.ServerPassword, 10*time.Minute)
			}

			// PASO 3: Configurar DNS en Cloudflare (NO BLOQUEANTE)
			log.Println("\n" + strings.Repeat("═", 80))
			log.Printf("║ %s ║", centerText("PASO 3/5: CONFIGURAR DNS EN CLOUDFLARE", 76))
			log.Println(strings.Repeat("═", 80))

			cloudflareService, err := services.NewCloudflareService()
			if err != nil {
				log.Printf("⚠️  [Agent %d] Cloudflare no configurado (NO CRÍTICO): %v", agent.ID, err)
				log.Printf("⚠️  Tendrás que configurar el DNS manualmente:")
				log.Printf("    - Tipo: A")
				log.Printf("    - Nombre: agent-%d", agent.ID)
				log.Printf("    - Contenido: %s", agent.ServerIP)
				log.Printf("    - Proxy: Activado")
			} else {
				if err := cloudflareService.CreateOrUpdateChatwootDNS(agent.ServerIP, user.ID); err != nil {
					log.Printf("⚠️  [Agent %d] Error configurando DNS (NO CRÍTICO): %v", agent.ID, err)
					log.Printf("⚠️  Configura el DNS manualmente en Cloudflare")
				} else {
					log.Printf("✅ [Agent %d] DNS configurado automáticamente", agent.ID)
					log.Printf("   URL: https://agent-%d.attomos.com", agent.ID)
				}
			}

			// PASO 4: Configurar Chatwoot (NO BLOQUEANTE)
			log.Println("\n" + strings.Repeat("═", 80))
			log.Printf("║ %s ║", centerText("PASO 4/5: CONFIGURAR CHATWOOT", 76))
			log.Println(strings.Repeat("═", 80))

			chatwootService := services.NewChatwootService(agent.ServerIP, user.ID, agent.ServerPassword)

			credentials, err := chatwootService.CreateAccountAndUser(user, &agent)
			if err != nil {
				log.Printf("⚠️ [Agent %d] Error configurando Chatwoot (NO CRÍTICO): %v", agent.ID, err)
				log.Printf("⚠️ Puedes configurar Chatwoot manualmente después")
				// NO RETORNAR - CONTINUAR CON EL DESPLIEGUE
			} else {
				// Guardar credenciales en el agente
				agent.ChatwootEmail = credentials.Email
				agent.ChatwootPassword = credentials.Password
				agent.ChatwootAccountID = credentials.AccountID
				agent.ChatwootAccountName = credentials.AccountName
				agent.ChatwootInboxID = credentials.InboxID
				agent.ChatwootInboxName = credentials.InboxName
				agent.ChatwootURL = credentials.ChatwootURL
				config.DB.Save(&agent)

				log.Printf("✅ [Agent %d] Chatwoot configurado exitosamente", agent.ID)
				log.Printf("   URL: %s", credentials.ChatwootURL)
			}

			// PASO 5: Desplegar OrbitalBot en el servidor del usuario (CRÍTICO)
			log.Println("\n" + strings.Repeat("═", 80))
			log.Printf("║ %s ║", centerText("PASO 5/5: DESPLIEGUE DEL ORBITAL BOT", 76))
			log.Println(strings.Repeat("═", 80))
			log.Printf("🤖 [Agent %d] Tipo de bot: %s", agent.ID, agent.BotType)
			log.Printf("   - Puerto: %d", agent.Port)
			log.Printf("   - Servidor del Usuario: %s", agent.ServerIP)
			log.Printf("========================================")

			agent.DeployStatus = "deploying"
			config.DB.Save(&agent)

			orbitalService := services.NewOrbitalBotDeployService(agent.ServerIP, agent.ServerPassword)

			// Reintentar conexión SSH (el servidor puede tardar en estar listo)
			maxRetries := 30
			retryDelay := 10 * time.Second
			var connectErr error

			for attempt := 1; attempt <= maxRetries; attempt++ {
				log.Printf("🔌 [Agent %d] Intento de conexión SSH %d/%d...", agent.ID, attempt, maxRetries)

				connectErr = orbitalService.Connect()
				if connectErr == nil {
					log.Printf("✅ [Agent %d] Conectado exitosamente al servidor del usuario", agent.ID)
					break
				}

				if attempt < maxRetries {
					log.Printf("⚠️  [Agent %d] Error conectando (intento %d/%d): %v", agent.ID, attempt, maxRetries, connectErr)
					log.Printf("   ⏳ Reintentando en %v...", retryDelay)
					time.Sleep(retryDelay)
				}
			}

			if connectErr != nil {
				log.Printf("❌ [Agent %d] No se pudo conectar después de %d intentos: %v", agent.ID, maxRetries, connectErr)
				agent.DeployStatus = "error"
				agent.ServerStatus = "error"
				config.DB.Save(&agent)
				return
			}

			defer orbitalService.Close()

			// Obtener Gemini API Key
			geminiAPIKey := user.GetGeminiAPIKey()
			if geminiAPIKey == "" {
				log.Printf("⚠️  [Agent %d] Sin Gemini API Key, bot funcionará sin IA", agent.ID)
			}

			// Obtener credenciales de Google del agente
			var googleCredentials []byte
			if agent.GoogleConnected && agent.GoogleToken != "" {
				googleCredentials = []byte(agent.GoogleToken)
				log.Printf("📊 [Agent %d] Credenciales de Google encontradas para integración", agent.ID)
				log.Printf("   - Google Sheets ID: %s", agent.GoogleSheetID)
				log.Printf("   - Google Calendar ID: %s", agent.GoogleCalendarID)
			} else {
				log.Printf("⚠️  [Agent %d] Sin integración de Google - las citas no se guardarán en Sheets/Calendar", agent.ID)
			}

			// Desplegar OrbitalBot
			if err := orbitalService.DeployOrbitalBot(&agent, geminiAPIKey, googleCredentials); err != nil {
				log.Printf("❌ [Agent %d] Error desplegando OrbitalBot: %v", agent.ID, err)
				agent.DeployStatus = "error"
				config.DB.Save(&agent)
				return
			}

			// Marcar servidor y agente como ready
			agent.IsActive = true
			agent.DeployStatus = "running"
			agent.ServerStatus = "ready"
			config.DB.Save(&agent)

			log.Printf("========================================")
			log.Printf("🎉 [Agent %d] ORBITAL BOT DESPLEGADO EXITOSAMENTE", agent.ID)
			log.Printf("   - Servidor del Usuario: %s", agent.ServerIP)
			log.Printf("   - Puerto: %d", agent.Port)
			log.Printf("   - Tecnología: Go + Meta Business API")
			log.Printf("   - Webhook: https://%s:%d/webhook", agent.ServerIP, agent.Port)

			if agent.ChatwootURL != "" {
				log.Printf("   - Chatwoot: %s", agent.ChatwootURL)
				log.Printf("   - Email: %s", agent.ChatwootEmail)
			}

			if geminiAPIKey != "" {
				log.Printf("   - IA: Gemini AI habilitada ✅")
			} else {
				log.Printf("   - IA: Sin configurar")
				log.Printf("   💡 Configura tu Gemini API Key en los ajustes del agente")
				log.Printf("   🔗 Obtener API Key: https://aistudio.google.com/apikey")
			}

			if agent.GoogleConnected {
				log.Printf("   - Google Sheets: Habilitado ✅")
				log.Printf("   - Google Calendar: Habilitado ✅")
			} else {
				log.Printf("   - Google Sheets/Calendar: Sin configurar")
				log.Printf("   💡 Conecta Google Calendar en los ajustes del agente")
			}

			if agent.MetaConnected {
				log.Printf("   - Meta WhatsApp: Conectado ✅")
				log.Printf("   - Número: %s", agent.MetaDisplayNumber)
				log.Printf("   - WABA ID: %s", agent.MetaWABAID)
			} else {
				log.Printf("   - Meta WhatsApp: Sin configurar")
				log.Printf("   💡 Conecta WhatsApp Business en los ajustes del agente")
			}

			log.Printf("========================================")
		}
	}()
}

// GetAgents obtiene todos los agentes del usuario
func GetAgents(c *gin.Context) {
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
			"error": "Error obteniendo agentes",
		})
		return
	}

	// Enriquecer respuesta con información adicional
	response := make([]gin.H, len(agents))
	for i, agent := range agents {
		agentData := gin.H{
			"id":            agent.ID,
			"name":          agent.Name,
			"phoneNumber":   agent.PhoneNumber,
			"businessType":  agent.BusinessType,
			"branchId":      agent.BranchID,
			"port":          agent.Port,
			"deployStatus":  agent.DeployStatus,
			"isActive":      agent.IsActive,
			"botType":       agent.BotType,
			"config":        agent.Config,
			"createdAt":     agent.CreatedAt,
			"chatwootUrl":   agent.ChatwootURL,
			"chatwootEmail": agent.ChatwootEmail,
		}

		// Agregar info de servidor si tiene servidor individual
		if agent.HasOwnServer() {
			agentData["serverIp"] = agent.ServerIP
			agentData["serverStatus"] = agent.ServerStatus
		}

		response[i] = agentData
	}

	c.JSON(http.StatusOK, gin.H{
		"agents": response,
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

	// Detener el bot en el servidor correspondiente
	go func() {
		if agent.IsAtomicBot() {
			// AtomicBot - servidor compartido global
			serverManager := services.GetGlobalServerManager()
			servers, err := serverManager.ListAllServers()
			if err != nil || len(servers) == 0 {
				log.Printf("⚠️  [Agent %d] No se encontró servidor compartido", agent.ID)
				return
			}

			globalServer := servers[0]
			atomicService := services.NewAtomicBotDeployService(globalServer.IPAddress, globalServer.RootPassword)

			if err := atomicService.Connect(); err != nil {
				log.Printf("⚠️  [Agent %d] Error conectando a servidor compartido: %v", agent.ID, err)
				return
			}
			defer atomicService.Close()

			if err := atomicService.StopBot(agent.ID); err != nil {
				log.Printf("⚠️  [Agent %d] Error deteniendo bot: %v", agent.ID, err)
			} else {
				log.Printf("✅ [Agent %d] AtomicBot detenido del servidor compartido", agent.ID)

				// Liberar puerto
				serverManager.ReleaseAgentPort(&globalServer)
			}
		} else {
			// OrbitalBot - servidor del usuario (compartido entre sus agentes)
			if agent.HasOwnServer() {
				orbitalService := services.NewOrbitalBotDeployService(agent.ServerIP, agent.ServerPassword)
				if err := orbitalService.Connect(); err != nil {
					log.Printf("⚠️  [Agent %d] Error conectando al servidor: %v", agent.ID, err)
					return
				}
				defer orbitalService.Close()

				if err := orbitalService.StopAndRemoveBot(agent.ID); err != nil {
					log.Printf("⚠️  [Agent %d] Error eliminando bot: %v", agent.ID, err)
				} else {
					log.Printf("✅ [Agent %d] OrbitalBot eliminado del servidor del usuario", agent.ID)
				}

				// Verificar si el usuario tiene más agentes en este servidor
				var otherAgents int64
				config.DB.Model(&models.Agent{}).
					Where("user_id = ? AND server_id = ? AND id != ?", user.ID, agent.ServerID, agent.ID).
					Count(&otherAgents)

				if otherAgents == 0 {
					// Es el último agente, eliminar servidor
					log.Printf("🗑️  [Agent %d] Último agente del usuario - eliminando servidor...", agent.ID)
					hetznerService, err := services.NewHetznerService()
					if err == nil {
						if err := hetznerService.DeleteServer(agent.ServerID); err != nil {
							log.Printf("⚠️  [Agent %d] Error eliminando servidor Hetzner: %v", agent.ID, err)
						} else {
							log.Printf("✅ [Agent %d] Servidor Hetzner eliminado: ID=%d", agent.ID, agent.ServerID)
						}
					}
				} else {
					log.Printf("ℹ️  [Agent %d] Servidor conservado (usuario tiene %d agente(s) más)", agent.ID, otherAgents)
				}
			}
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

// GetAgentQRCode obtiene el QR code del agente (solo para AtomicBot)
func GetAgentQRCode(c *gin.Context) {
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

	// Solo AtomicBot (WhatsApp Web) tiene QR
	if !agent.IsAtomicBot() {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   "QR code no disponible",
			"message": "Este agente no usa WhatsApp Web",
		})
		return
	}

	// Obtener servidor compartido global
	serverManager := services.GetGlobalServerManager()
	servers, err := serverManager.ListAllServers()
	if err != nil || len(servers) == 0 {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":   "Error de servidor",
			"message": "No se encontró servidor compartido",
		})
		return
	}

	globalServer := servers[0]
	atomicService := services.NewAtomicBotDeployService(globalServer.IPAddress, globalServer.RootPassword)

	if err := atomicService.Connect(); err != nil {
		log.Printf("❌ [Agent %d] Error conectando a servidor: %v", agent.ID, err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":   "Error de conexión",
			"message": "No se pudo conectar al servidor",
		})
		return
	}
	defer atomicService.Close()

	// Obtener QR code desde logs
	qrCode, connected, err := atomicService.GetQRCodeFromLogs(agent.ID)

	if err != nil {
		log.Printf("⚠️  [Agent %d] Error obteniendo QR: %v", agent.ID, err)
		c.JSON(http.StatusOK, gin.H{
			"connected": false,
			"qrCode":    nil,
			"message":   "Esperando QR code...",
		})
		return
	}

	if connected {
		c.JSON(http.StatusOK, gin.H{
			"connected": true,
			"qrCode":    nil,
			"message":   "WhatsApp conectado exitosamente",
		})
		return
	}

	if qrCode != "" {
		c.JSON(http.StatusOK, gin.H{
			"connected": false,
			"qrCode":    qrCode,
			"message":   "Escanea el código QR",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"connected": false,
		"qrCode":    nil,
		"message":   "Generando QR code...",
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

// RedeployAgent reinicia el bot desde cero (borra sesión WhatsApp y regenera QR)
func RedeployAgent(c *gin.Context) {
	agentID := c.Param("id")

	userInterface, exists := c.Get("user")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "No autenticado"})
		return
	}
	user := userInterface.(*models.User)

	var agent models.Agent
	if err := config.DB.Where("id = ? AND user_id = ?", agentID, user.ID).First(&agent).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Agente no encontrado"})
		return
	}

	if !agent.IsAtomicBot() {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   "Redeploy no disponible",
			"message": "Esta acción solo está disponible para agentes AtomicBot",
		})
		return
	}

	// Marcar como desplegando en BD
	config.DB.Model(&agent).Updates(map[string]interface{}{
		"deploy_status": "deploying",
		"is_active":     false,
	})

	go func() {
		serverManager := services.GetGlobalServerManager()
		servers, err := serverManager.ListAllServers()
		if err != nil || len(servers) == 0 {
			log.Printf("❌ [Agent %d] Redeploy: no se encontró servidor compartido", agent.ID)
			config.DB.Model(&agent).Update("deploy_status", "error")
			return
		}

		globalServer := servers[0]
		atomicService := services.NewAtomicBotDeployService(globalServer.IPAddress, globalServer.RootPassword)

		if err := atomicService.Connect(); err != nil {
			log.Printf("❌ [Agent %d] Redeploy: error conectando SSH: %v", agent.ID, err)
			config.DB.Model(&agent).Update("deploy_status", "error")
			return
		}
		defer atomicService.Close()

		// 1. Detener el servicio systemd
		log.Printf("🔄 [Agent %d] Redeploy: deteniendo bot...", agent.ID)
		atomicService.StopBot(agent.ID)

		// 2. Borrar base de datos de sesión WhatsApp para que genere nuevo QR
		botDir := fmt.Sprintf("/home/user_%d/atomic-bot", agent.UserID)
		dbFile := fmt.Sprintf("%s/whatsapp-%d.db", botDir, agent.ID)
		rmCmd := fmt.Sprintf("rm -f %s %s-shm %s-wal", dbFile, dbFile, dbFile)
		sshClient := atomicService.GetSSHClient()
		if sshClient != nil {
			if sess, err := sshClient.NewSession(); err == nil {
				sess.CombinedOutput(rmCmd)
				sess.Close()
				log.Printf("✅ [Agent %d] Redeploy: sesión WhatsApp eliminada", agent.ID)
			}
		}

		// 3. Limpiar log para que GetQRCodeFromLogs no lea la conexión anterior
		logFile := fmt.Sprintf("/var/log/atomic-bot-%d.log", agent.ID)
		if sshClient != nil {
			if sess, err := sshClient.NewSession(); err == nil {
				sess.CombinedOutput(fmt.Sprintf("truncate -s 0 %s 2>/dev/null || true", logFile))
				sess.Close()
				log.Printf("✅ [Agent %d] Redeploy: log limpiado", agent.ID)
			}
		}

		// 4. Reiniciar bot (arranca limpio y genera nuevo QR)
		if err := atomicService.RestartBot(agent.ID); err != nil {
			log.Printf("❌ [Agent %d] Redeploy: error reiniciando: %v", agent.ID, err)
			config.DB.Model(&agent).Update("deploy_status", "error")
			return
		}

		// 5. Actualizar estado en BD
		config.DB.Model(&agent).Updates(map[string]interface{}{
			"deploy_status": "running",
			"is_active":     true,
		})

		log.Printf("✅ [Agent %d] Redeploy completado — nuevo QR disponible", agent.ID)
	}()

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "Redeploy iniciado. El bot se reiniciará en unos segundos.",
	})
}

// syncOnboardingToBranch sincroniza servicios, trabajadores y festivos
// del onboarding hacia my_business_info. Se ejecuta en goroutine.
func syncOnboardingToBranch(branchID uint, cfg models.AgentConfig) {
	var branch models.MyBusinessInfo
	if err := config.DB.First(&branch, branchID).Error; err != nil {
		log.Printf("⚠️  [SyncBranch] No se encontró sucursal %d: %v", branchID, err)
		return
	}

	updated := false

	if len(cfg.Services) > 0 {
		newServices := make(models.BranchServices, len(cfg.Services))
		for i, s := range cfg.Services {
			newServices[i] = models.BranchService{
				Title:           s.Title,
				Description:     s.Description,
				PriceType:       s.PriceType,
				Price:           parseFlexibleFloat(string(s.Price)),
				OriginalPrice:   parseFlexibleFloatPtr(s.OriginalPrice),
				PromoPrice:      parseFlexibleFloatPtr(s.PromoPrice),
				ImageUrls:       s.ImageUrls,
				PromoPeriodType: s.PromoPeriodType,
				PromoDays:       s.PromoDays,
				PromoDateStart:  s.PromoDateStart,
				PromoDateEnd:    s.PromoDateEnd,
			}
		}
		branch.Services = newServices
		updated = true
		log.Printf("✅ [SyncBranch] %d servicio(s) sincronizados → sucursal %d", len(newServices), branchID)
	}

	if len(cfg.Workers) > 0 {
		newWorkers := make(models.BranchWorkers, len(cfg.Workers))
		for i, w := range cfg.Workers {
			newWorkers[i] = models.BranchWorker{
				Name:      w.Name,
				StartTime: w.StartTime,
				EndTime:   w.EndTime,
				Days:      w.Days,
			}
		}
		branch.Workers = newWorkers
		updated = true
		log.Printf("✅ [SyncBranch] %d trabajador(es) sincronizados → sucursal %d", len(newWorkers), branchID)
	}

	if len(cfg.Holidays) > 0 {
		newHolidays := make(models.BusinessHolidays, len(cfg.Holidays))
		for i, h := range cfg.Holidays {
			newHolidays[i] = models.Holiday{Date: h.Date, Name: h.Name}
		}
		branch.Holidays = newHolidays
		updated = true
		log.Printf("✅ [SyncBranch] %d festivo(s) sincronizados → sucursal %d", len(newHolidays), branchID)
	}

	if updated {
		if err := config.DB.Save(&branch).Error; err != nil {
			log.Printf("❌ [SyncBranch] Error guardando sucursal %d: %v", branchID, err)
		} else {
			log.Printf("✅ [SyncBranch] Sucursal %d actualizada exitosamente", branchID)
		}
	}
}

// parseFlexibleFloat convierte un FlexibleString a float64
func parseFlexibleFloat(s string) float64 {
	if s == "" {
		return 0
	}
	var f float64
	fmt.Sscanf(s, "%f", &f)
	return f
}

// parseFlexibleFloatPtr convierte un *FlexibleString a float64 (0 si nil)
func parseFlexibleFloatPtr(s *models.FlexibleString) float64 {
	if s == nil {
		return 0
	}
	return parseFlexibleFloat(string(*s))
}
