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

	sender := msg.Info.Sender.User
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

	log.Printf("📨 Mensaje de %s (%s): %s\n", senderName, sender, messageText)

	// Procesar mensaje
	response := ProcessMessage(messageText, sender, senderName)

	// Enviar respuesta
	if response != "" {
		if err := SendMessage(msg.Info.Chat, response); err != nil {
			log.Printf("❌ Error enviando mensaje: %v\n", err)
		} else {
			log.Printf("✅ Respuesta enviada a %s\n", senderName)
		}
	}
}

// ProcessMessage procesa un mensaje y genera respuesta usando Gemini
func ProcessMessage(message, userID, userName string) string {
	state := GetUserState(userID)
	state.LastMessageTime = time.Now().Unix()

	log.Printf("📊 Estado actual - isScheduling: %v, appointmentSaved: %v\n",
		state.IsScheduling,
		state.AppointmentSaved,
	)

	// Evitar procesar si ya se guardó recientemente
	if state.AppointmentSaved {
		timeSinceLastMessage := time.Now().Unix() - state.LastMessageTime
		if timeSinceLastMessage < 5 {
			log.Println("⏭️  Mensaje ignorado - cita recién guardada")
			return ""
		}
	}

	// Agregar al historial
	state.ConversationHistory = append(state.ConversationHistory, "Usuario: "+message)

	// Si ya guardó la cita, reiniciar
	if state.AppointmentSaved {
		log.Println("🔄 Reiniciando estado después de cita guardada")
		ClearUserState(userID)
		newState := GetUserState(userID)
		newState.ConversationHistory = append(newState.ConversationHistory, "Usuario: "+message)
		return processNewMessage(message, userID, userName, newState)
	}

	// Analizar intención usando Gemini
	analysis, err := AnalyzeForAppointment(
		message,
		joinHistory(state.ConversationHistory),
		state.IsScheduling,
	)
	if err != nil {
		log.Printf("⚠️  Error en análisis: %v\n", err)
		// Fallback: conversación normal
		return handleNormalConversation(message, userName, state)
	}

	// Si quiere agendar y no está agendando
	if analysis.WantsToSchedule && !state.IsScheduling {
		return startAppointmentFlow(state, analysis, message, userName)
	}

	// Si está agendando, continuar
	if state.IsScheduling {
		return continueAppointmentFlow(state, analysis, message, userID, userName)
	}

	// Conversación normal con Gemini
	return handleNormalConversation(message, userName, state)
}

func processNewMessage(message, userID, userName string, state *UserState) string {
	analysis, _ := AnalyzeForAppointment(message, joinHistory(state.ConversationHistory), false)

	if analysis != nil && analysis.WantsToSchedule {
		return startAppointmentFlow(state, analysis, message, userName)
	}

	return handleNormalConversation(message, userName, state)
}

func startAppointmentFlow(state *UserState, analysis *AppointmentAnalysis, message, userName string) string {
	log.Println("🎯 Iniciando proceso de agendamiento")
	state.IsScheduling = true
	state.Step = 1

	// Extraer datos del primer mensaje
	if analysis.ExtractedData != nil {
		for key, value := range analysis.ExtractedData {
			if value != "" && value != "null" {
				state.Data[key] = value
				log.Printf("✅ %s capturado: %s\n", key, value)
			}
		}
	}

	// Determinar qué falta
	missingData := getMissingData(state.Data)
	log.Printf("📊 Datos faltantes: %v\n", missingData)

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
		log.Printf("❌ Error en chat: %v\n", err)
		return "¡Perfecto! Vamos a agendar tu cita. ¿Cuál es tu nombre completo?"
	}

	state.ConversationHistory = append(state.ConversationHistory, "Asistente: "+response)
	return response
}

func continueAppointmentFlow(state *UserState, analysis *AppointmentAnalysis, message, userID, userName string) string {
	log.Println("📝 Continuando proceso de agendamiento")

	// Extraer información del mensaje actual
	if analysis.ExtractedData != nil {
		for key, value := range analysis.ExtractedData {
			if value != "" && value != "null" && state.Data[key] == "" {
				state.Data[key] = value
				log.Printf("✅ %s capturado: %s\n", key, value)
			}
		}
	}

	// Verificar datos faltantes
	missingData := getMissingData(state.Data)
	log.Printf("📊 Datos faltantes: %v\n", missingData)
	log.Printf("📋 Datos actuales: %v\n", state.Data)

	if len(missingData) > 0 {
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
	return saveAppointment(state, userID, userName)
}

func saveAppointment(state *UserState, userID, userName string) string {
	log.Println("✅ Todos los datos completos - Guardando automáticamente")

	state.AppointmentSaved = true
	telefono := userID

	// Convertir fecha a fecha exacta
	_, fechaExacta, err := ConvertirFechaADia(state.Data["fecha"])
	if err != nil {
		log.Printf("⚠️  Error convirtiendo fecha: %v\n", err)
		fechaExacta = state.Data["fecha"]
	}

	// Normalizar hora
	horaNormalizada, err := NormalizarHora(state.Data["hora"])
	if err != nil {
		log.Printf("⚠️  Error normalizando hora: %v\n", err)
		horaNormalizada = state.Data["hora"]
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

	// Guardar en Sheets
	sheetsErr := SaveAppointmentToCalendar(appointmentData)

	// Crear evento en Calendar
	calendarEvent, calendarErr := CreateCalendarEvent(appointmentData)

	// Construir mensaje de confirmación usando Gemini si está disponible
	confirmation := generateConfirmationMessage(state.Data, fechaExacta, horaNormalizada, calendarEvent)

	if sheetsErr != nil || calendarErr != nil {
		log.Printf("⚠️  Errores guardando: Sheets=%v, Calendar=%v\n", sheetsErr, calendarErr)
	}

	log.Println("✅ Cita guardada y confirmada")
	return confirmation
}

func generateConfirmationMessage(data map[string]string, fechaExacta, horaNormalizada string, calendarEvent interface{}) string {
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

func handleNormalConversation(message, userName string, state *UserState) string {
	log.Println("💬 Conversación normal con Gemini")

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
		log.Printf("❌ Error en Gemini: %v\n", err)
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
