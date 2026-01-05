package src

import (
	"fmt"
	"log"
	"strings"
	"sync"
	"time"

	"go.mau.fi/whatsmeow"
	"go.mau.fi/whatsmeow/types/events"
)

// UserState estado del usuario
type UserState struct {
	IsScheduling        bool
	Step                int
	Data                map[string]string
	ConversationHistory []string
	LastMessageTime     int64
	AppointmentSaved    bool
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
		Step:                0,
		Data:                make(map[string]string),
		ConversationHistory: []string{},
		LastMessageTime:     time.Now().Unix(),
		AppointmentSaved:    false,
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

	// Usar Chat.User en lugar de Sender.User para obtener el número real
	// Chat.User = número de teléfono del usuario (ej: 5216624045267)
	// Sender.User = puede ser device ID (ej: 122432455233651)
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
	log.Printf("   💾 appointmentSaved: %v", state.AppointmentSaved)
	log.Printf("   📋 Datos recopilados: %v", state.Data)
	log.Printf("   📝 Pasos completados: %d", state.Step)

	// 🔥 CAMBIO IMPORTANTE: Reducir tiempo de bloqueo después de guardar cita
	// Cambiar de 5 segundos a 2 segundos
	if state.AppointmentSaved {
		timeSinceLastMessage := time.Now().Unix() - state.LastMessageTime
		log.Printf("⏱️  Tiempo desde último mensaje: %d segundos", timeSinceLastMessage)

		// Solo bloquear durante 2 segundos después de guardar
		if timeSinceLastMessage < 2 {
			log.Println("⏭️  MENSAJE IGNORADO - Cita recién guardada (esperando 2 segundos)")
			return ""
		}
		// Después de 2 segundos, reiniciar estado automáticamente
		log.Println("🔄 REINICIANDO ESTADO - Ya pasaron 2 segundos desde guardar cita")
		ClearUserState(userID)
		state = GetUserState(userID)
	}

	// Agregar al historial
	state.ConversationHistory = append(state.ConversationHistory, "Usuario: "+message)

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

	state.AppointmentSaved = true

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
// Maneja formatos:
// - "5216624045267" → "5216624045267" (ya limpio)
// - "122432455233651" → número sin prefijo 1224... (linked device)
func cleanPhoneNumber(userID string) string {
	// Si el número empieza con "122" probablemente es un linked device ID
	// En ese caso, intentamos extraer el número real
	// Por ahora, devolvemos el userID como está
	// TODO: Implementar lógica más sofisticada si es necesario

	// Remover caracteres no numéricos
	cleaned := ""
	for _, char := range userID {
		if char >= '0' && char <= '9' {
			cleaned += string(char)
		}
	}

	return cleaned
}
