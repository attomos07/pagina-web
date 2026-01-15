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

// UserState estado del usuario
type UserState struct {
	IsScheduling        bool
	IsCancelling        bool
	Step                int
	Data                map[string]string
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

	// Procesar mensaje
	response := ProcessMessage(messageText, phoneNumber, senderName)

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
func continueCancellationFlow(state *UserState, message, userID, userName string) string {
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

	// Todos los datos completos - guardar
	log.Println("🎉 TODOS LOS DATOS COMPLETOS - PROCEDIENDO A GUARDAR")
	return saveAppointment(state, userID)
}

func saveAppointment(state *UserState, userID string) string {
	log.Println("")
	log.Println("╔════════════════════════════════════════════════════════╗")
	log.Println("║                                                        ║")
	log.Println("║          🎯 GUARDANDO CITA - INICIO                    ║")
	log.Println("║                                                        ║")
	log.Println("╚════════════════════════════════════════════════════════╝")

	// Limpiar el número de teléfono
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
		return GenerateWelcomeMessage()
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

// cleanPhoneNumber limpia el número de teléfono de WhatsApp
func cleanPhoneNumber(userID string) string {
	// Remover caracteres no numéricos
	cleaned := ""
	for _, char := range userID {
		if char >= '0' && char <= '9' {
			cleaned += string(char)
		}
	}

	return cleaned
}
