package src

import (
	"fmt"
	"log"
	"regexp"
	"strings"
	"sync"
	"time"

	"go.mau.fi/whatsmeow"
	"go.mau.fi/whatsmeow/types/events"
)

// OrderItem representa un producto en el carrito
type OrderItem struct {
	Title    string
	Quantity int
	Price    float64
}

// UserState estado del usuario
type UserState struct {
	IsScheduling        bool
	IsCancelling        bool
	IsAskingForEmail    bool
	IsOrdering          bool
	Step                int
	Data                map[string]string
	Cart                []OrderItem
	ConversationHistory []string
	LastMessageTime     int64
}

var (
	userStates = make(map[string]*UserState)
	stateMutex sync.RWMutex
)

// GetUserState obtiene o crea el estado de un usuario
func GetUserState(userID string) *UserState {
	stateMutex.Lock()
	defer stateMutex.Unlock()

	if state, exists := userStates[userID]; exists {
		return state
	}

	state := &UserState{
		IsScheduling:        false,
		IsCancelling:        false,
		IsAskingForEmail:    false,
		Step:                0,
		Data:                make(map[string]string),
		ConversationHistory: []string{},
		LastMessageTime:     time.Now().Unix(),
	}

	userStates[userID] = state
	return state
}

// ClearUserState limpia el estado de un usuario
func ClearUserState(userID string) {
	stateMutex.Lock()
	defer stateMutex.Unlock()
	delete(userStates, userID)
}

// HandleMessage maneja los mensajes entrantes
func HandleMessage(msg *events.Message, client *whatsmeow.Client) {
	// Ignorar mensajes propios
	if msg.Info.IsFromMe {
		return
	}

	// Ignorar mensajes de grupos
	if msg.Info.IsGroup {
		return
	}

	phoneNumber := msg.Info.Chat.User
	senderName := msg.Info.PushName
	if senderName == "" {
		senderName = "Cliente"
	}

	// Obtener texto del mensaje
	var messageText string
	if msg.Message.GetConversation() != "" {
		messageText = msg.Message.GetConversation()
	} else if msg.Message.GetExtendedTextMessage() != nil {
		messageText = msg.Message.GetExtendedTextMessage().GetText()
	}

	if messageText == "" {
		return
	}

	log.Println("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
	log.Printf("📨 MENSAJE RECIBIDO")
	log.Printf("   👤 De: %s (%s)", senderName, phoneNumber)
	log.Printf("   💬 Texto: %s", messageText)
	log.Println("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")

	// ── Detección temprana de solicitud de menú ──────────────────────────────
	// Se maneja aquí para tener acceso al JID y poder enviar imagen/documento.
	if BusinessCfg != nil && BusinessCfg.MenuUrl != "" {
		msgLower := strings.ToLower(messageText)
		menuKeywords := []string{
			"menu", "menú", "carta",
			"que tienen", "qué tienen",
			"ver menu", "ver menú",
			"manda menu", "manda el menu", "manda menú", "manda el menú",
			"muestra menu", "muestra el menu",
			"pdf", "imagen del men", "foto del men",
			"tienen men", "tienen carta",
		}
		isMenuRequest := false
		for _, kw := range menuKeywords {
			if strings.Contains(msgLower, kw) {
				isMenuRequest = true
				break
			}
		}
		if isMenuRequest {
			menuURL := BusinessCfg.MenuUrl
			log.Printf("📋 Solicitud de menú detectada — enviando: %s", menuURL)
			urlLower := strings.ToLower(menuURL)
			var sendErr error
			if strings.HasSuffix(urlLower, ".pdf") {
				sendErr = SendDocument(msg.Info.Chat, menuURL, "menu.pdf", "")
			} else {
				sendErr = SendImage(msg.Info.Chat, menuURL, "")
			}
			if sendErr != nil {
				log.Printf("❌ Error enviando menú: %v", sendErr)
				// fallback: enviar URL como texto
				SendMessage(msg.Info.Chat, menuURL)
			} else {
				log.Printf("✅ Menú enviado correctamente")
			}
			log.Println("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
			return
		}
	}

	// Procesar mensaje
	response := ProcessMessage(messageText, phoneNumber, senderName)

	// ── Interceptar respuestas de media de Gemini ───────────────────────────
	// Gemini puede envolver el tag en texto, buscamos en toda la respuesta
	if idx := strings.Index(response, "SEND_PHOTOS:"); idx != -1 {
		raw := response[idx+len("SEND_PHOTOS:"):]
		// Cortar en el primer salto de línea, emoji o fin de cadena
		end := len(raw)
		for i, ch := range raw {
			if ch == '\n' || ch == '\r' || ch == '🌽' || ch == '🍕' || ch == '✅' {
				end = i
				break
			}
		}
		serviceTitle := strings.TrimSpace(raw[:end])
		log.Printf("📸 Gemini solicita fotos del servicio: %s", serviceTitle)
		sent := false
		if BusinessCfg != nil {
			var matched *Service
			queryNorm := normalizeStr(serviceTitle)

			// 1. Coincidencia exacta (case-insensitive)
			for i := range BusinessCfg.Services {
				if strings.EqualFold(strings.TrimSpace(BusinessCfg.Services[i].Title), serviceTitle) {
					matched = &BusinessCfg.Services[i]
					break
				}
			}
			// 2. Fuzzy: el título normalizado contiene la query o viceversa
			if matched == nil {
				for i := range BusinessCfg.Services {
					titleNorm := normalizeStr(BusinessCfg.Services[i].Title)
					if strings.Contains(titleNorm, queryNorm) || strings.Contains(queryNorm, titleNorm) {
						matched = &BusinessCfg.Services[i]
						break
					}
				}
			}

			if matched != nil && len(matched.ImageUrls) > 0 {
				for _, imgURL := range matched.ImageUrls {
					if err := SendImage(msg.Info.Chat, imgURL, ""); err != nil {
						log.Printf("❌ Error enviando foto de servicio: %v", err)
					}
				}
				log.Printf("✅ Fotos de '%s' enviadas (%d imágenes)", matched.Title, len(matched.ImageUrls))
				sent = true
			}
		}
		if !sent {
			log.Printf("⚠️  Servicio '%s' no encontrado o sin fotos", serviceTitle)
			SendMessage(msg.Info.Chat, "No encontré fotos de ese producto. ¿Puedes ser más específico?")
		}
		log.Println("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
		return
	}

	// Enviar respuesta
	if response != "" {
		log.Printf("📤 ENVIANDO RESPUESTA a %s...", senderName)
		if err := SendMessage(msg.Info.Chat, response); err != nil {
			log.Printf("❌ ERROR enviando mensaje: %v", err)
		} else {
			log.Printf("✅ RESPUESTA ENVIADA correctamente")
			log.Printf("   📝 Contenido: %s", response)
		}
	} else {
		log.Printf("⚠️  No se generó respuesta para este mensaje")
	}
	log.Println("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
}

// ProcessMessage procesa un mensaje y genera respuesta usando Gemini
func ProcessMessage(message, userID, userName string) string {
	state := GetUserState(userID)
	state.LastMessageTime = time.Now().Unix()

	log.Println("╔════════════════════════════════════════╗")
	log.Println("║     PROCESANDO MENSAJE                 ║")
	log.Println("╚════════════════════════════════════════╝")
	log.Printf("📊 Estado del usuario %s:", userName)
	log.Printf("   🔄 isScheduling: %v", state.IsScheduling)
	log.Printf("   🚫 isCancelling: %v", state.IsCancelling)
	log.Printf("   📋 Datos recopilados: %v", state.Data)
	log.Printf("   📝 Pasos completados: %d", state.Step)

	// Agregar al historial
	state.ConversationHistory = append(state.ConversationHistory, "Usuario: "+message)

	// NUEVA LÓGICA: Detectar intención de cancelar cita
	messageLower := strings.ToLower(message)
	cancelKeywords := []string{
		"cancelar cita",
		"cancel appointment",
		"eliminar cita",
		"borrar cita",
		"anular cita",
		"quiero cancelar",
		"necesito cancelar",
	}

	wantsToCancelAppointment := false
	for _, keyword := range cancelKeywords {
		if strings.Contains(messageLower, keyword) {
			wantsToCancelAppointment = true
			log.Printf("🚫 KEYWORD DE CANCELACIÓN DETECTADO: %s\n", keyword)
			break
		}
	}

	// Si está en flujo de email para recordatorio, procesarlo primero
	if state.IsAskingForEmail {
		log.Println("📧 PROCESANDO RESPUESTA DE RECORDATORIO POR EMAIL")
		return processEmailReminderResponse(state, message, userID)
	}

	// Flujo de pedido (pizzeria / comida)
	if isPizzeriaMode() {
		if state.IsOrdering {
			log.Println("🍕 CONTINUANDO FLUJO DE PEDIDO")
			return continueOrderFlow(state, message, userID, userName)
		}
		orderKeywords := []string{
			"quiero", "dame", "me das", "pedido", "ordenar", "pedir",
			"quiero pedir", "quiero ordenar", "me pones", "ponme",
			"una pizza", "dos pizzas", "una gordita", "dos gorditas",
			"para llevar", "a domicilio", "para comer",
		}
		wantsToOrder := false
		for _, kw := range orderKeywords {
			if strings.Contains(messageLower, kw) {
				wantsToOrder = true
				break
			}
		}
		if wantsToOrder {
			log.Println("🍕 INICIANDO FLUJO DE PEDIDO")
			return startOrderFlow(state, message, userName)
		}
	}

	// Si quiere cancelar y no está cancelando
	if wantsToCancelAppointment && !state.IsCancelling {
		log.Println("🚫 INICIANDO PROCESO DE CANCELACIÓN")
		return startCancellationFlow(state, message, userName)
	}

	// Si está cancelando, continuar
	if state.IsCancelling {
		log.Println("🚫 CONTINUANDO PROCESO DE CANCELACIÓN")
		return continueCancellationFlow(state, message, userID, userName)
	}

	// Analizar intención usando Gemini
	log.Println("🔍 Analizando intención del mensaje...")
	analysis, err := AnalyzeForAppointment(
		message,
		joinHistory(state.ConversationHistory),
		state.IsScheduling,
	)
	if err != nil {
		log.Printf("⚠️  Error en análisis: %v", err)
		log.Println("📞 Usando conversación normal como fallback")
		return handleNormalConversation(message, state)
	}

	log.Printf("✅ Análisis completado:")
	log.Printf("   🎯 Quiere agendar: %v", analysis.WantsToSchedule)
	log.Printf("   📊 Confianza: %.2f", analysis.Confidence)
	log.Printf("   📋 Datos extraídos: %v", analysis.ExtractedData)

	// Si quiere agendar y no está agendando
	if analysis.WantsToSchedule && !state.IsScheduling {
		log.Println("🎯 INICIANDO PROCESO DE AGENDAMIENTO")
		return startAppointmentFlow(state, analysis, message)
	}

	// Si está agendando, continuar
	if state.IsScheduling {
		log.Println("📝 CONTINUANDO PROCESO DE AGENDAMIENTO")
		return continueAppointmentFlow(state, analysis, message, userID)
	}

	// Conversación normal con Gemini
	log.Println("💬 CONVERSACIÓN NORMAL")
	return handleNormalConversation(message, state)
}

// startCancellationFlow inicia el flujo de cancelación de citas
func startCancellationFlow(state *UserState, message, userName string) string {
	log.Println("╔════════════════════════════════════════╗")
	log.Println("║  INICIANDO FLUJO DE CANCELACIÓN        ║")
	log.Println("╚════════════════════════════════════════╝")

	state.IsCancelling = true
	state.Step = 1

	// Intentar extraer fecha y hora del mensaje inicial
	dateRegex := regexp.MustCompile(`(\d{1,2})/(\d{1,2})/(\d{4})`)
	timeRegex := regexp.MustCompile(`(\d{1,2}):(\d{2})`)

	dateMatch := dateRegex.FindStringSubmatch(message)
	timeMatch := timeRegex.FindStringSubmatch(message)

	if len(dateMatch) >= 4 && len(timeMatch) >= 3 {
		// Ya tiene fecha y hora, procesar directamente
		state.Data["fecha_cancelar"] = fmt.Sprintf("%s/%s/%s", dateMatch[1], dateMatch[2], dateMatch[3])
		state.Data["hora_cancelar"] = fmt.Sprintf("%s:%s", timeMatch[1], timeMatch[2])
		log.Printf("✅ Fecha y hora extraídas: %s %s\n", state.Data["fecha_cancelar"], state.Data["hora_cancelar"])
		return processCancellation(state, userName)
	}

	// Si no tiene los datos, pedirlos
	response := fmt.Sprintf(`Para cancelar tu cita, %s, necesito los siguientes datos:

📅 *Fecha de tu cita:* DD/MM/YYYY
🕐 *Hora de tu cita:* HH:MM

Ejemplo: "Cancelar cita 15/01/2026 10:30"

Por favor envíame los datos de la cita que deseas cancelar.`, userName)

	state.ConversationHistory = append(state.ConversationHistory, "Asistente: "+response)
	return response
}

// continueCancellationFlow continúa el flujo de cancelación
func continueCancellationFlow(state *UserState, message string, _ string, userName string) string {
	log.Println("╔════════════════════════════════════════╗")
	log.Println("║  CONTINUANDO FLUJO DE CANCELACIÓN      ║")
	log.Println("╚════════════════════════════════════════╝")

	// Extraer fecha y hora del mensaje
	dateRegex := regexp.MustCompile(`(\d{1,2})/(\d{1,2})/(\d{4})`)
	timeRegex := regexp.MustCompile(`(\d{1,2}):(\d{2})`)

	dateMatch := dateRegex.FindStringSubmatch(message)
	timeMatch := timeRegex.FindStringSubmatch(message)

	if len(dateMatch) >= 4 {
		state.Data["fecha_cancelar"] = fmt.Sprintf("%s/%s/%s", dateMatch[1], dateMatch[2], dateMatch[3])
		log.Printf("✅ Fecha extraída: %s\n", state.Data["fecha_cancelar"])
	}

	if len(timeMatch) >= 3 {
		state.Data["hora_cancelar"] = fmt.Sprintf("%s:%s", timeMatch[1], timeMatch[2])
		log.Printf("✅ Hora extraída: %s\n", state.Data["hora_cancelar"])
	}

	// Verificar si ya tenemos fecha y hora
	if state.Data["fecha_cancelar"] != "" && state.Data["hora_cancelar"] != "" {
		return processCancellation(state, userName)
	}

	// Si falta algo, pedirlo
	if state.Data["fecha_cancelar"] == "" {
		return "Por favor, indícame la *fecha* de tu cita (DD/MM/YYYY):"
	}

	if state.Data["hora_cancelar"] == "" {
		return "Por favor, indícame la *hora* de tu cita (HH:MM):"
	}

	return "Por favor, envíame la fecha y hora de tu cita en el formato: DD/MM/YYYY HH:MM"
}

// processCancellation procesa la cancelación de la cita
func processCancellation(state *UserState, userName string) string {
	log.Println("🚫 PROCESANDO CANCELACIÓN DE CITA")

	fecha := state.Data["fecha_cancelar"]
	hora := state.Data["hora_cancelar"]

	log.Printf("   Fecha: %s\n", fecha)
	log.Printf("   Hora: %s\n", hora)

	// Parsear fecha y hora
	fechaHoraStr := fmt.Sprintf("%s %s", fecha, hora)
	appointmentDateTime, err := time.Parse("02/01/2006 15:04", fechaHoraStr)
	if err != nil {
		log.Printf("❌ Error parseando fecha/hora: %v\n", err)
		state.IsCancelling = false
		return "❌ Formato de fecha/hora inválido. Por favor usa el formato: DD/MM/YYYY HH:MM"
	}

	// Obtener teléfono desde userName o usar placeholder
	telefono := ""
	if state.Data["telefono"] != "" {
		telefono = state.Data["telefono"]
	}

	// Cancelar en Google Sheets
	if IsSheetsEnabled() {
		err := CancelAppointmentByClient(userName, telefono, appointmentDateTime)
		if err != nil {
			log.Printf("❌ Error cancelando en Sheets: %v", err)
			state.IsCancelling = false
			return fmt.Sprintf(`❌ No encontré una cita agendada para:

📅 *Fecha:* %s
🕐 *Hora:* %s

Por favor verifica los datos y vuelve a intentar.`,
				appointmentDateTime.Format("02/01/2006"),
				appointmentDateTime.Format("15:04"))
		} else {
			log.Printf("✅ Cita cancelada en Google Sheets")
		}
	}

	// Cancelar en Google Calendar (si está habilitado)
	if IsCalendarEnabled() {
		events, err := SearchEventsByPatient(userName)
		if err == nil && len(events) > 0 {
			for _, event := range events {
				// Verificar que sea la cita correcta por fecha
				if event.Start != nil && event.Start.DateTime != "" {
					eventTime, _ := time.Parse(time.RFC3339, event.Start.DateTime)
					if eventTime.Format("02/01/2006 15:04") == appointmentDateTime.Format("02/01/2006 15:04") {
						// Evento encontrado en calendar
						log.Printf("✅ Evento encontrado en Calendar para cancelación")
						break
					}
				}
			}
		}
	}

	// Limpiar estado
	state.IsCancelling = false
	state.Data = make(map[string]string)

	return fmt.Sprintf(`✅ *Cita cancelada exitosamente*

👤 *Cliente:* %s
📅 *Fecha:* %s
🕐 *Hora:* %s

Tu cita ha sido cancelada. Si deseas reagendar, házmelo saber.

¿Puedo ayudarte en algo más?`,
		userName,
		appointmentDateTime.Format("02/01/2006"),
		appointmentDateTime.Format("15:04"))
}

func startAppointmentFlow(state *UserState, analysis *AppointmentAnalysis, message string) string {
	log.Println("╔════════════════════════════════════════╗")
	log.Println("║  INICIANDO FLUJO DE AGENDAMIENTO       ║")
	log.Println("╚════════════════════════════════════════╝")

	state.IsScheduling = true
	state.Step = 1

	// Extraer datos del primer mensaje
	if analysis.ExtractedData != nil {
		log.Println("📋 Extrayendo datos del mensaje inicial:")
		for key, value := range analysis.ExtractedData {
			if value != "" && value != "null" {
				state.Data[key] = value
				log.Printf("   ✅ %s = %s", key, value)
			}
		}
	}

	// Determinar qué falta
	missingData := getMissingData(state.Data)
	log.Printf("📊 Datos completos: %v", state.Data)
	log.Printf("❓ Datos faltantes: %v", missingData)

	var promptContext string
	if len(missingData) > 0 {
		promptContext = fmt.Sprintf("El cliente quiere agendar una cita. Ya tenemos: %v. Pide SOLO el siguiente dato: %s. NO pidas teléfono. Sé breve (1-2 líneas).",
			state.Data,
			missingData[0],
		)
	} else {
		promptContext = "Confirma todos los datos antes de guardar: " + fmt.Sprintf("%v", state.Data)
	}

	response, err := Chat(promptContext, message, joinHistory(state.ConversationHistory))
	if err != nil {
		log.Printf("❌ Error en chat: %v", err)
		return "¡Perfecto! Vamos a agendar tu cita. ¿Cuál es tu nombre completo?"
	}

	state.ConversationHistory = append(state.ConversationHistory, "Asistente: "+response)
	return response
}

func continueAppointmentFlow(state *UserState, analysis *AppointmentAnalysis, message, userID string) string {
	log.Println("╔════════════════════════════════════════╗")
	log.Println("║  CONTINUANDO FLUJO DE AGENDAMIENTO     ║")
	log.Println("╚════════════════════════════════════════╝")

	// Guardar userID en state para usarlo después en saveAppointment
	state.Data["userID"] = userID

	// Extraer información del mensaje actual
	if analysis.ExtractedData != nil {
		log.Println("📋 Extrayendo datos del mensaje actual:")
		for key, value := range analysis.ExtractedData {
			if value != "" && value != "null" {
				state.Data[key] = value
				log.Printf("   ✅ %s = %s", key, value)
			}
		}
	}

	// Verificar datos faltantes
	missingData := getMissingData(state.Data)
	log.Printf("📋 Datos actuales: %v", state.Data)
	log.Printf("❓ Datos faltantes: %v", missingData)

	if len(missingData) > 0 {
		log.Printf("⚠️  Faltan %d datos, solicitando: %s", len(missingData), missingData[0])

		// Pedir siguiente dato usando Gemini
		promptContext := fmt.Sprintf(
			"Estamos agendando una cita. Datos ya recopilados: %v. Pide ÚNICAMENTE: %s. NO repitas preguntas. NO pidas teléfono. 1-2 líneas máximo.",
			state.Data,
			missingData[0],
		)

		response, err := Chat(promptContext, message, joinHistory(state.ConversationHistory))
		if err != nil {
			return fmt.Sprintf("Por favor, dime tu %s:", missingData[0])
		}

		state.ConversationHistory = append(state.ConversationHistory, "Asistente: "+response)
		return response
	}

	// Todos los datos completos - preguntar por recordatorio email
	log.Println("🎉 TODOS LOS DATOS COMPLETOS - PREGUNTANDO POR RECORDATORIO")
	return askForEmailReminder(state)
}

// askForEmailReminder pregunta al cliente si desea un recordatorio por email
func askForEmailReminder(state *UserState) string {
	state.IsAskingForEmail = true
	state.Data["email_step"] = "asking"

	nombre := state.Data["nombre"]
	if nombre == "" {
		nombre = "cliente"
	}

	response := fmt.Sprintf(`📋 *Resumen de tu cita:*

👤 *Nombre:* %s
✂️ *Servicio:* %s
📅 *Fecha:* %s
🕐 *Hora:* %s`,
		state.Data["nombre"],
		state.Data["servicio"],
		state.Data["fecha"],
		state.Data["hora"],
	)

	if state.Data["barbero"] != "" {
		response += fmt.Sprintf("\n💈 *Con:* %s", state.Data["barbero"])
	}

	response += `

¿Te gustaría recibir un recordatorio por correo electrónico? 📧

Responde *sí* para agregar tu email, o *no* para continuar sin recordatorio.`

	return response
}

// processEmailReminderResponse procesa la respuesta del cliente sobre el recordatorio
func processEmailReminderResponse(state *UserState, message string, _ string) string {
	userID := state.Data["userID"]
	msgLower := strings.ToLower(strings.TrimSpace(message))

	emailStep := state.Data["email_step"]

	// Paso 1: preguntamos si quiere recordatorio
	if emailStep == "asking" {
		// Respuestas afirmativas
		quiereSi := []string{"si", "sí", "yes", "claro", "ok", "dale", "va", "quiero", "porfa", "por favor", "ándale", "andale"}
		// Respuestas negativas
		quiereNo := []string{"no", "nel", "nope", "sin recordatorio", "no gracias", "no quiero"}

		for _, kw := range quiereSi {
			if strings.Contains(msgLower, kw) {
				log.Println("📧 Cliente QUIERE recordatorio por email - pidiendo correo")
				state.Data["email_step"] = "waiting_email"
				return "¡Perfecto! 📧 Por favor escribe tu correo electrónico:"
			}
		}

		for _, kw := range quiereNo {
			if strings.Contains(msgLower, kw) {
				log.Println("📧 Cliente NO quiere recordatorio - guardando cita sin email")
				state.IsAskingForEmail = false
				delete(state.Data, "email_step")
				return saveAppointment(state, userID)
			}
		}

		// No se entendió la respuesta
		return "No entendí tu respuesta 😅\n\n¿Quieres recibir un recordatorio por correo electrónico?\nResponde *sí* o *no*."
	}

	// Paso 2: esperamos el correo electrónico
	if emailStep == "waiting_email" {
		email := strings.TrimSpace(message)

		// Validar formato básico de email
		if isValidEmail(email) {
			log.Printf("📧 Email recibido y válido: %s", email)
			state.Data["email"] = email
			state.IsAskingForEmail = false
			delete(state.Data, "email_step")
			return saveAppointment(state, userID)
		}

		// Email inválido, pedir de nuevo
		log.Printf("⚠️  Email inválido recibido: %s", email)
		return "Ese correo no parece válido 🤔\n\nPor favor escribe un correo electrónico válido (ejemplo: nombre@gmail.com):"
	}

	// Fallback: limpiar y guardar
	state.IsAskingForEmail = false
	delete(state.Data, "email_step")
	return saveAppointment(state, userID)
}

// isValidEmail valida formato básico de email
func isValidEmail(email string) bool {
	atIdx := strings.Index(email, "@")
	if atIdx < 1 {
		return false
	}
	domain := email[atIdx+1:]
	dotIdx := strings.LastIndex(domain, ".")
	if dotIdx < 1 || dotIdx == len(domain)-1 {
		return false
	}
	return true
}

func saveAppointment(state *UserState, userID string) string {
	log.Println("")
	log.Println("╔════════════════════════════════════════════════════════╗")
	log.Println("║                                                        ║")
	log.Println("║          🎯 GUARDANDO CITA - INICIO                    ║")
	log.Println("║                                                        ║")
	log.Println("╚════════════════════════════════════════════════════════╝")

	// 🔧 CORRECCIÓN: Limpiar el número de teléfono correctamente
	telefono := cleanPhoneNumber(userID)
	log.Printf("📞 Teléfono procesado: %s → %s", userID, telefono)

	// Convertir fecha a fecha exacta
	log.Println("📅 Procesando fecha...")
	_, fechaExacta, err := ConvertirFechaADia(state.Data["fecha"])
	if err != nil {
		log.Printf("❌ ERROR convirtiendo fecha '%s': %v", state.Data["fecha"], err)
		fechaExacta = state.Data["fecha"]
	} else {
		log.Printf("✅ Fecha convertida: %s → %s", state.Data["fecha"], fechaExacta)
	}

	// Normalizar hora
	log.Println("⏰ Procesando hora...")
	horaNormalizada, err := NormalizarHora(state.Data["hora"])
	if err != nil {
		log.Printf("❌ ERROR normalizando hora '%s': %v", state.Data["hora"], err)
		horaNormalizada = state.Data["hora"]
	} else {
		log.Printf("✅ Hora normalizada: %s → %s", state.Data["hora"], horaNormalizada)
	}

	appointmentData := map[string]string{
		"nombre":      state.Data["nombre"],
		"telefono":    telefono,
		"servicio":    state.Data["servicio"],
		"barbero":     state.Data["barbero"],
		"fecha":       state.Data["fecha"],
		"fechaExacta": fechaExacta,
		"hora":        horaNormalizada,
		"email":       state.Data["email"], // correo para recordatorio (puede estar vacío)
	}

	log.Println("")
	log.Println("📋 DATOS DE LA CITA A GUARDAR:")
	log.Println("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
	for key, value := range appointmentData {
		log.Printf("   %s: %s", key, value)
	}
	log.Println("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
	log.Println("")

	// Guardar en Sheets
	log.Println("📊 PASO 1/2: Guardando en Google Sheets...")
	sheetsErr := SaveAppointmentToSheets(
		appointmentData["nombre"],
		appointmentData["telefono"],
		appointmentData["fechaExacta"],
		appointmentData["hora"],
		appointmentData["servicio"],
		appointmentData["barbero"],
	)
	if sheetsErr != nil {
		log.Printf("❌ ERROR guardando en Sheets: %v", sheetsErr)
	} else {
		log.Println("✅ GUARDADO EN SHEETS EXITOSO")
	}

	// Crear evento en Calendar
	log.Println("")
	log.Println("📅 PASO 2/2: Creando evento en Google Calendar...")
	calendarEvent, calendarErr := CreateCalendarEvent(appointmentData)
	if calendarErr != nil {
		log.Printf("❌ ERROR creando evento en Calendar: %v", calendarErr)
	} else {
		log.Println("✅ EVENTO EN CALENDAR CREADO EXITOSO")
		if calendarEvent != nil {
			log.Printf("   🔗 Link: %s", calendarEvent.HtmlLink)
		}
	}

	log.Println("")
	log.Println("╔════════════════════════════════════════════════════════╗")
	log.Println("║                                                        ║")
	log.Println("║          ✅ GUARDADO COMPLETADO                        ║")
	log.Println("║                                                        ║")
	log.Println("╚════════════════════════════════════════════════════════╝")

	if sheetsErr != nil || calendarErr != nil {
		log.Println("⚠️  RESUMEN DE ERRORES:")
		if sheetsErr != nil {
			log.Printf("   📊 Sheets: %v", sheetsErr)
		}
		if calendarErr != nil {
			log.Printf("   📅 Calendar: %v", calendarErr)
		}
	} else {
		log.Println("🎉 CITA GUARDADA EXITOSAMENTE EN AMBOS SERVICIOS")
	}
	log.Println("")

	// Construir mensaje de confirmación usando Gemini si está disponible
	confirmation := generateConfirmationMessage(state.Data, fechaExacta, horaNormalizada)

	log.Println("✅ Mensaje de confirmación generado")
	log.Println("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
	log.Println("")

	// ── Agregar opciones de pago si el negocio las tiene configuradas ─────
	if HasPaymentMethods() {
		servicio := state.Data["servicio"]
		precio := GetServicePrice(servicio)
		paymentMsg := BuildPaymentMessage(servicio, precio, "")
		if paymentMsg != "" {
			log.Println("💳 [Payments] Agregando opciones de pago al mensaje de confirmación")
			confirmation += "\n\n" + paymentMsg
		}
	}

	// Limpiar el estado DESPUÉS de generar la confirmación
	state.IsScheduling = false
	state.Data = make(map[string]string)

	return confirmation
}

func generateConfirmationMessage(data map[string]string, fechaExacta, horaNormalizada string) string {
	// Intentar generar con Gemini
	if geminiEnabled && BusinessCfg != nil {
		promptContext := fmt.Sprintf(`Genera un mensaje de confirmación de cita breve y profesional.

Datos de la cita:
- Nombre: %s
- Servicio: %s
- Fecha: %s
- Hora: %s
- Negocio: %s

Incluye:
- Confirmación entusiasta
- Resumen de los datos
- Agradecimiento
- Un emoji apropiado

Máximo 4-5 líneas.`,
			data["nombre"],
			data["servicio"],
			fechaExacta,
			horaNormalizada,
			BusinessCfg.AgentName)

		response, err := Chat(promptContext, "Confirmar cita", "")
		if err == nil && response != "" {
			return response
		}
	}

	// Mensaje por defecto
	confirmation := "¡Perfecto! 🎉 Tu cita ha sido agendada exitosamente.\n\n"
	confirmation += "📋 Resumen:\n"
	confirmation += fmt.Sprintf("👤 %s\n", data["nombre"])
	confirmation += fmt.Sprintf("✂️ %s\n", data["servicio"])
	if data["barbero"] != "" {
		confirmation += fmt.Sprintf("💈 Con: %s\n", data["barbero"])
	}
	confirmation += fmt.Sprintf("📅 %s a las %s\n\n", fechaExacta, horaNormalizada)
	confirmation += "¡Te esperamos! 😊"

	return confirmation
}

// isPizzeriaMode detecta si el negocio es de comida
func isPizzeriaMode() bool {
	if BusinessCfg == nil {
		return false
	}
	foodTypes := []string{"pizzeria", "pizza", "gorditas", "gordita", "restaurante", "comida", "taqueria", "tacos"}
	bt := strings.ToLower(BusinessCfg.BusinessType)
	for _, ft := range foodTypes {
		if strings.Contains(bt, ft) {
			return true
		}
	}
	return false
}

func startOrderFlow(state *UserState, message, userName string) string {
	state.IsOrdering = true
	state.Step = 1
	state.Cart = []OrderItem{}
	state.Data["userName"] = userName
	parseCartFromMessage(state, message)
	if len(state.Cart) > 0 {
		state.Step = 2
		response := buildCartSummary(state) + "\n\n" + "¿Cómo lo quieres?\n\n• 🥡 *Para llevar* (recoger en local)\n• 🍽️ *Para comer aquí* (en el local)\n• 🛵 *A domicilio*"
		state.ConversationHistory = append(state.ConversationHistory, "Asistente: "+response)
		return response
	}
	response := buildMenuResponse()
	state.ConversationHistory = append(state.ConversationHistory, "Asistente: "+response)
	return response
}

func continueOrderFlow(state *UserState, message, userID, userName string) string {
	msgL := strings.ToLower(message)
	if strings.Contains(msgL, "cancelar") || strings.Contains(msgL, "olvida") || strings.Contains(msgL, "no quiero") {
		state.IsOrdering = false
		state.Cart = []OrderItem{}
		state.Data = make(map[string]string)
		return "Entendido, pedido cancelado. En que mas te puedo ayudar? 😊"
	}
	switch state.Step {
	case 1:
		parseCartFromMessage(state, message)
		if len(state.Cart) == 0 {
			response := buildMenuResponse()
			state.ConversationHistory = append(state.ConversationHistory, "Asistente: "+response)
			return response
		}
		state.Step = 2
		response := buildCartSummary(state) + "\n\n" + "¿Cómo lo quieres?\n\n• 🥡 *Para llevar* (recoger en local)\n• 🍽️ *Para comer aquí* (en el local)\n• 🛵 *A domicilio*"
		state.ConversationHistory = append(state.ConversationHistory, "Asistente: "+response)
		return response
	case 2:
		if strings.Contains(msgL, "domicilio") || strings.Contains(msgL, "delivery") || strings.Contains(msgL, "a mi casa") {
			state.Data["deliveryType"] = "domicilio"
			state.Step = 3
			response := "Perfecto! 🛵 ¿Cuál es tu dirección de entrega?"
			state.ConversationHistory = append(state.ConversationHistory, "Asistente: "+response)
			return response
		} else if strings.Contains(msgL, "comer") || strings.Contains(msgL, "aqui") ||
			strings.Contains(msgL, "aquí") || strings.Contains(msgL, "salon") || strings.Contains(msgL, "salón") {
			state.Data["deliveryType"] = "local"
			state.Step = 4
			return askPaymentMethodStep(state)
		} else if strings.Contains(msgL, "llevar") || strings.Contains(msgL, "recoger") {
			state.Data["deliveryType"] = "llevar"
			state.Step = 4
			return askPaymentMethodStep(state)
		}
		response := "No entendí 😅 ¿Cómo lo quieres?\n\n• 🥡 *Para llevar* (recoger en local)\n• 🍽️ *Para comer aquí* (en el local)\n• 🛵 *A domicilio*"
		state.ConversationHistory = append(state.ConversationHistory, "Asistente: "+response)
		return response
	case 3:
		state.Data["deliveryAddress"] = message
		state.Step = 4
		return askPaymentMethodStep(state)
	case 4:
		// Parsear método de pago elegido por el cliente
		if strings.Contains(msgL, "efectivo") || strings.Contains(msgL, "cash") {
			state.Data["paymentMethod"] = "efectivo"
		} else if strings.Contains(msgL, "tarjeta") || strings.Contains(msgL, "card") ||
			strings.Contains(msgL, "linea") || strings.Contains(msgL, "línea") || strings.Contains(msgL, "online") {
			state.Data["paymentMethod"] = "tarjeta"
		} else if strings.Contains(msgL, "transferencia") || strings.Contains(msgL, "spei") ||
			strings.Contains(msgL, "banco") || strings.Contains(msgL, "clabe") {
			state.Data["paymentMethod"] = "transferencia"
		} else {
			// No se entendió → preguntar de nuevo
			response := "No entendí tu respuesta 😅\n\n" + AskPaymentMethod()
			state.ConversationHistory = append(state.ConversationHistory, "Asistente: "+response)
			return response
		}
		return confirmOrder(state, userID, userName)
	default:
		state.IsOrdering = false
		return handleNormalConversation(message, state)
	}
}

// askPaymentMethodStep pregunta al cliente cómo desea pagar.
// Se usa en el flujo de pedidos (pizzería/comida) entre el paso de entrega y la confirmación.
func askPaymentMethodStep(state *UserState) string {
	response := AskPaymentMethod()
	state.ConversationHistory = append(state.ConversationHistory, "Asistente: "+response)
	return response
}

func confirmOrder(state *UserState, userID, userName string) string {
	deliveryType := state.Data["deliveryType"]
	address := state.Data["deliveryAddress"]
	var sb strings.Builder
	sb.WriteString("🧾 *Resumen de tu pedido:*\n\n")
	total := 0.0
	for _, item := range state.Cart {
		sb.WriteString(fmt.Sprintf("• %dx %s — $%.0f\n", item.Quantity, item.Title, item.Price*float64(item.Quantity)))
		total += item.Price * float64(item.Quantity)
	}
	sb.WriteString(fmt.Sprintf("\n💰 *Total: $%.0f MXN*\n", total))
	if deliveryType == "domicilio" && address != "" {
		sb.WriteString(fmt.Sprintf("🛵 *Entrega a domicilio:* %s\n", address))
	} else if deliveryType == "local" {
		sb.WriteString("🍽️ *Para comer en el local*\n")
	} else {
		sb.WriteString("🥡 *Para llevar (recoger en local)*\n")
	}
	sb.WriteString(fmt.Sprintf("👤 *Cliente:* %s\n", userName))
	paymentMethod := state.Data["paymentMethod"]
	if paymentMethod == "tarjeta" && HasPaymentMethods() && len(state.Cart) > 0 {
		// Generar Stripe Checkout directo (sin pasar por Ninda)
		checkoutURL, err := CreateBotCheckoutURL(userName, userID, state.Cart)
		if err != nil {
			log.Printf("⚠️  [Bot] Error creando checkout: %v — mostrando link de Ninda como fallback", err)
			paymentMsg := BuildPaymentMessage(state.Cart[0].Title, total, "tarjeta")
			if paymentMsg != "" {
				sb.WriteString("\n" + paymentMsg)
			}
		} else {
			sb.WriteString("\n" + BuildStripeOnlyMessage(checkoutURL, total))
		}
	} else if HasPaymentMethods() && len(state.Cart) > 0 {
		paymentMsg := BuildPaymentMessage(state.Cart[0].Title, total, paymentMethod)
		if paymentMsg != "" {
			sb.WriteString("\n" + paymentMsg)
		}
	}
	sb.WriteString("\n\n" + "Pedido recibido! Nos pondremos en contacto pronto. 🙌")
	state.IsOrdering = false
	state.Cart = []OrderItem{}
	state.Data = make(map[string]string)
	response := sb.String()
	state.ConversationHistory = append(state.ConversationHistory, "Asistente: "+response)
	return response
}

// extractQuantity detecta la cantidad en un mensaje en lenguaje natural.
// Busca números y palabras numéricas en todo el mensaje, sin requerir
// que vayan pegados al nombre del servicio.
// Ejemplos: "dos de nata", "quiero 3", "pediré dos gorditas"
func extractQuantity(msgL string) int {
	// Primero buscar dígitos explícitos (ej: "3 gorditas", "pediré 2")
	for _, pair := range []struct {
		word string
		n    int
	}{
		{"10", 10}, {"9", 9}, {"8", 8}, {"7", 7}, {"6", 6},
		{"5", 5}, {"4", 4}, {"3", 3}, {"2", 2}, {"1", 1},
	} {
		if strings.Contains(msgL, pair.word) {
			return pair.n
		}
	}
	// Luego buscar palabras numéricas en cualquier posición del mensaje
	for _, pair := range []struct {
		word string
		n    int
	}{
		{"diez", 10}, {"nueve", 9}, {"ocho", 8}, {"siete", 7}, {"seis", 6},
		{"cinco", 5}, {"cuatro", 4}, {"tres", 3}, {"dos", 2},
		{"una", 1}, {"uno", 1}, {"un", 1},
	} {
		if strings.Contains(msgL, pair.word) {
			return pair.n
		}
	}
	return 1
}

func parseCartFromMessage(state *UserState, message string) {
	if BusinessCfg == nil {
		return
	}
	msgL := strings.ToLower(message)
	for _, svc := range BusinessCfg.Services {
		titleL := strings.ToLower(svc.Title)
		if !strings.Contains(msgL, titleL) {
			found := false
			for _, w := range strings.Fields(titleL) {
				if len(w) > 3 && strings.Contains(msgL, w) {
					found = true
					break
				}
			}
			if !found {
				continue
			}
		}
		qty := extractQuantity(msgL)
		price := svc.Price
		if svc.PriceType == "promotion" && svc.PromoPrice > 0 {
			price = svc.PromoPrice
		}
		alreadyIn := false
		for i, item := range state.Cart {
			if strings.EqualFold(item.Title, svc.Title) {
				state.Cart[i].Quantity += qty
				alreadyIn = true
				break
			}
		}
		if !alreadyIn {
			state.Cart = append(state.Cart, OrderItem{Title: svc.Title, Quantity: qty, Price: price})
		}
	}
}

func buildCartSummary(state *UserState) string {
	if len(state.Cart) == 0 {
		return "No hay productos en tu pedido."
	}
	var sb strings.Builder
	sb.WriteString("🛒 *Tu pedido:*\n")
	total := 0.0
	for _, item := range state.Cart {
		sb.WriteString(fmt.Sprintf("  • %dx %s — $%.0f\n", item.Quantity, item.Title, item.Price*float64(item.Quantity)))
		total += item.Price * float64(item.Quantity)
	}
	sb.WriteString(fmt.Sprintf("💰 Subtotal: $%.0f MXN", total))
	return sb.String()
}

func buildMenuResponse() string {
	if BusinessCfg == nil || len(BusinessCfg.Services) == 0 {
		return "Que te gustaria ordenar?"
	}
	var sb strings.Builder
	sb.WriteString("Que deseas ordenar? 😋 Tenemos:\n\n")
	for _, svc := range BusinessCfg.Services {
		price := svc.Price
		if svc.PriceType == "promotion" && svc.PromoPrice > 0 {
			price = svc.PromoPrice
		}
		sb.WriteString(fmt.Sprintf("• *%s* — $%.0f MXN\n", svc.Title, price))
	}
	sb.WriteString("\nCuanto quieres ordenar?")
	return sb.String()
}

// getContextualWelcome genera un mensaje de bienvenida adecuado al giro del negocio.
// Para negocios de comida menciona "hacer tu pedido", para servicios menciona "agendar cita".
func getContextualWelcome() string {
	if isPizzeriaMode() && BusinessCfg != nil {
		// Generar con Gemini si está disponible
		if geminiEnabled {
			prompt := fmt.Sprintf(
				"Genera un mensaje de bienvenida breve (2-3 líneas) para %s, un negocio de comida tipo %s.\n\nIncluye:\n- Saludo amigable\n- Mención de que pueden preguntar por el menú o hacer su pedido\n- Un emoji de comida apropiado\n\nNO menciones citas ni agendamientos.\nTono: amigable.\nRespuesta SOLO con el mensaje.",
				BusinessCfg.AgentName, BusinessCfg.BusinessType,
			)
			response, err := Chat(prompt, "Bienvenida", "")
			if err == nil && response != "" {
				return response
			}
		}
		// Fallback texto plano para comida
		name := ""
		if BusinessCfg != nil {
			name = BusinessCfg.AgentName
		}
		return fmt.Sprintf("¡Hola! Bienvenido a %s 👋\n\nPuedes ver nuestro menú o hacer tu pedido directamente. ¿Qué se te antoja hoy? 😋", name)
	}
	return GenerateWelcomeMessage()
}

func handleNormalConversation(message string, state *UserState) string {
	log.Println("💬 Manejando conversación normal con Gemini")

	// Contexto: si pregunta por servicios, horarios, ubicación, etc.
	var promptContext string

	messageLower := strings.ToLower(message)

	if strings.Contains(messageLower, "servicio") || strings.Contains(messageLower, "precio") ||
		strings.Contains(messageLower, "cuanto cuesta") || strings.Contains(messageLower, "costo") {
		promptContext = "El cliente pregunta sobre servicios o precios. Proporciona información detallada y clara de los servicios disponibles."
	} else if strings.Contains(messageLower, "horario") || strings.Contains(messageLower, "hora") ||
		strings.Contains(messageLower, "abren") || strings.Contains(messageLower, "cierran") {
		promptContext = "El cliente pregunta sobre horarios. Proporciona los horarios de atención claramente."
	} else if strings.Contains(messageLower, "donde") || strings.Contains(messageLower, "ubicacion") ||
		strings.Contains(messageLower, "direccion") || strings.Contains(messageLower, "como llegar") {
		promptContext = "El cliente pregunta sobre ubicación. Proporciona la dirección completa y referencias útiles."
	} else if strings.Contains(messageLower, "hola") || strings.Contains(messageLower, "buenos") ||
		strings.Contains(messageLower, "buenas") {
		// Generar mensaje de bienvenida personalizado
		return getContextualWelcome()
	} else {
		promptContext = "Responde de manera útil y natural según la información del negocio."
	}

	response, err := Chat(promptContext, message, joinHistory(state.ConversationHistory))
	if err != nil {
		log.Printf("❌ Error en Gemini: %v", err)
		// Fallback simple
		return "Disculpa, ¿podrías repetir tu pregunta?"
	}

	state.ConversationHistory = append(state.ConversationHistory, "Asistente: "+response)
	return response
}

func getMissingData(data map[string]string) []string {
	required := []string{"nombre", "servicio", "fecha", "hora"}
	var missing []string

	// Si hay trabajadores configurados, también pedimos el trabajador
	if BusinessCfg != nil && len(BusinessCfg.Workers) > 1 {
		required = append(required, "barbero")
	}

	for _, field := range required {
		if data[field] == "" {
			missing = append(missing, field)
		}
	}

	return missing
}

func joinHistory(history []string) string {
	result := ""
	maxHistory := 10 // Limitar historial a últimos 10 mensajes
	startIdx := 0
	if len(history) > maxHistory {
		startIdx = len(history) - maxHistory
	}

	for i := startIdx; i < len(history); i++ {
		result += history[i] + "\n"
	}
	return result
}

// cleanPhoneNumber limpia el número de teléfono de WhatsApp Web
// Formatos posibles que llegan:
//   - "5216621234567@s.whatsapp.net"  → 521 + 10 dígitos (WhatsApp agrega 1 intermedio)
//   - "526621234567@s.whatsapp.net"   → 52 + 10 dígitos (formato normal)
//   - "6621234567"                    → 10 dígitos (local mexicano)
//
// Resultado esperado: "526621234567" (12 dígitos: 52 + área + número)
func cleanPhoneNumber(userID string) string {
	log.Printf("🔍 Limpiando número: %s", userID)

	// Remover @s.whatsapp.net si existe
	parts := strings.Split(userID, "@")
	phoneNumber := parts[0]
	log.Printf("   Después de split: %s", phoneNumber)

	// Extraer solo dígitos
	cleaned := ""
	for _, char := range phoneNumber {
		if char >= '0' && char <= '9' {
			cleaned += string(char)
		}
	}
	log.Printf("   Solo dígitos: %s (len=%d)", cleaned, len(cleaned))

	if len(cleaned) < 10 {
		log.Printf("⚠️  Número muy corto, retornando tal cual: %s", cleaned)
		return cleaned
	}

	// Caso: 13 dígitos → WhatsApp Web agrega un "1" entre código de país y área
	// Ejemplo: 521 662 123 4567 → quitar el "1" intermedio → 52 662 123 4567
	if len(cleaned) == 13 && strings.HasPrefix(cleaned, "521") {
		fixed := "52" + cleaned[3:]
		log.Printf("✅ Corregido 521→52 (13 dígitos): %s → %s", cleaned, fixed)
		return fixed
	}

	// Caso: 12 dígitos con prefijo 52 → ya está correcto
	if len(cleaned) == 12 && strings.HasPrefix(cleaned, "52") {
		log.Printf("✅ Número correcto (12 dígitos): %s", cleaned)
		return cleaned
	}

	// Caso: 10 dígitos → número local mexicano, agregar 52
	if len(cleaned) == 10 {
		fixed := "52" + cleaned
		log.Printf("✅ Agregado prefijo 52 (10 dígitos): %s → %s", cleaned, fixed)
		return fixed
	}

	// Cualquier otro caso: tomar los últimos 10 dígitos y agregar 52
	local := cleaned[len(cleaned)-10:]
	fixed := "52" + local
	log.Printf("⚠️  Longitud inusual (%d dígitos), tomando últimos 10: %s → %s", len(cleaned), cleaned, fixed)
	return fixed
}

// normalizeStr convierte a minúsculas y elimina acentos para comparación fuzzy
func normalizeStr(s string) string {
	s = strings.ToLower(s)
	replacer := strings.NewReplacer(
		"á", "a", "é", "e", "í", "i", "ó", "o", "ú", "u",
		"à", "a", "è", "e", "ì", "i", "ò", "o", "ù", "u",
		"ä", "a", "ë", "e", "ï", "i", "ö", "o", "ü", "u",
		"ñ", "n",
	)
	return replacer.Replace(s)
}
