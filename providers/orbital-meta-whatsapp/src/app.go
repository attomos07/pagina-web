package src

import (
	"fmt"
	"log"
	"regexp"
	"strings"
	"sync"
	"time"
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

// ProcessMessage procesa un mensaje entrante y retorna la respuesta
func ProcessMessage(messageText, phoneNumber, senderName string) string {
	state := GetUserState(phoneNumber)
	state.LastMessageTime = time.Now().Unix()

	log.Println("╔════════════════════════════════════════╗")
	log.Println("║     PROCESANDO MENSAJE                 ║")
	log.Println("╚════════════════════════════════════════╝")
	log.Printf("📊 Estado del usuario %s:", senderName)
	log.Printf("   🔄 isScheduling: %v", state.IsScheduling)
	log.Printf("   🚫 isCancelling: %v", state.IsCancelling)
	log.Printf("   📋 Datos recopilados: %v", state.Data)
	log.Printf("   📝 Pasos completados: %d", state.Step)

	// Agregar al historial
	state.ConversationHistory = append(state.ConversationHistory, "Usuario: "+messageText)

	// Normalizar mensaje
	normalizedMessage := strings.TrimSpace(strings.ToLower(messageText))

	// Detectar intención de cancelar cita
	messageLower := strings.ToLower(messageText)
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
		return startCancellationFlow(state, messageText, senderName)
	}

	// Si está cancelando, continuar
	if state.IsCancelling {
		log.Println("🚫 CONTINUANDO PROCESO DE CANCELACIÓN")
		return continueCancellationFlow(state, messageText, phoneNumber, senderName)
	}

	// Detectar otras intenciones
	intention := detectIntention(normalizedMessage)
	log.Printf("🎯 Intención detectada: %s", intention)

	var response string

	switch intention {
	case "greeting":
		response = handleGreeting(senderName)

	case "appointment":
		response = handleAppointment(messageText, phoneNumber, senderName)

	case "hours":
		response = handleBusinessHours()

	case "services":
		response = handleServices()

	case "location":
		response = handleLocation()

	case "price":
		response = handlePricing()

	case "help":
		response = handleHelp()

	default:
		// Si Gemini está habilitado, usar IA
		if IsGeminiEnabled() {
			response = generateGeminiResponse(messageText, senderName)
		} else {
			response = handleUnknown(senderName)
		}
	}

	return response
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

	// Cancelar en Google Sheets
	if IsSheetsEnabled() {
		err := CancelAppointmentInSheets(userName, appointmentDateTime)
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

	// TODO: Cancelar en Google Calendar si está habilitado

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

// detectIntention detecta la intención del mensaje
func detectIntention(message string) string {
	// Saludos
	greetings := []string{"hola", "buenos días", "buenas tardes", "buenas noches", "hey", "hi", "hello"}
	for _, greeting := range greetings {
		if strings.Contains(message, greeting) {
			return "greeting"
		}
	}

	// Agendar cita
	appointments := []string{"agendar", "cita", "reservar", "turno", "hora", "appointment", "book", "schedule"}
	for _, word := range appointments {
		if strings.Contains(message, word) {
			return "appointment"
		}
	}

	// Horarios
	hours := []string{"horario", "hora", "abren", "cierran", "hours", "open", "close"}
	for _, word := range hours {
		if strings.Contains(message, word) {
			return "hours"
		}
	}

	// Servicios
	services := []string{"servicio", "tratamiento", "procedure", "service"}
	for _, word := range services {
		if strings.Contains(message, word) {
			return "services"
		}
	}

	// Ubicación
	locations := []string{"ubicación", "dirección", "dónde", "location", "address", "where"}
	for _, word := range locations {
		if strings.Contains(message, word) {
			return "location"
		}
	}

	// Precios
	prices := []string{"precio", "costo", "cuánto", "price", "cost", "how much"}
	for _, word := range prices {
		if strings.Contains(message, word) {
			return "price"
		}
	}

	// Ayuda
	helps := []string{"ayuda", "help", "menú", "menu", "opciones", "options"}
	for _, word := range helps {
		if strings.Contains(message, word) {
			return "help"
		}
	}

	return "unknown"
}

// handleGreeting maneja saludos
func handleGreeting(senderName string) string {
	config := GetBusinessConfig()
	if config == nil {
		return fmt.Sprintf("¡Hola %s! 👋 ¿En qué puedo ayudarte?", senderName)
	}

	return fmt.Sprintf(`¡Hola %s! 👋

Bienvenido/a a *%s*

¿En qué puedo ayudarte hoy?

Puedes escribir:
• "Agendar cita" para reservar
• "Servicios" para ver lo que ofrecemos
• "Horarios" para conocer nuestro horario
• "Cancelar cita" para cancelar una reserva
• "Ayuda" para más opciones`, senderName, config.AgentName)
}

// handleAppointment maneja solicitudes de citas
func handleAppointment(messageText, phoneNumber, senderName string) string {
	// Extraer fecha y hora del mensaje (formato: DD/MM/YYYY HH:MM)
	dateRegex := regexp.MustCompile(`(\d{1,2})/(\d{1,2})/(\d{4})`)
	timeRegex := regexp.MustCompile(`(\d{1,2}):(\d{2})`)

	dateMatch := dateRegex.FindStringSubmatch(messageText)
	timeMatch := timeRegex.FindStringSubmatch(messageText)

	if len(dateMatch) < 4 || len(timeMatch) < 3 {
		return `Para agendar una cita, necesito los siguientes datos:

📅 *Fecha:* DD/MM/YYYY
🕐 *Hora:* HH:MM

Ejemplo: "Agendar cita 15/01/2026 10:30"

Por favor envíame tu cita con este formato.`
	}

	day := dateMatch[1]
	month := dateMatch[2]
	year := dateMatch[3]
	hour := timeMatch[1]
	minute := timeMatch[2]

	// Construir fecha
	dateStr := fmt.Sprintf("%s-%s-%s", year, month, day)
	timeStr := fmt.Sprintf("%s:%s", hour, minute)

	appointmentDateTime, err := time.Parse("2006-01-02 15:04", fmt.Sprintf("%s %s", dateStr, timeStr))
	if err != nil {
		return "❌ Formato de fecha/hora inválido. Por favor usa el formato: DD/MM/YYYY HH:MM"
	}

	// Validar que la fecha no sea en el pasado
	if appointmentDateTime.Before(time.Now()) {
		return "❌ La fecha no puede ser en el pasado. Por favor elige una fecha futura."
	}

	// Guardar en Google Sheets
	if IsSheetsEnabled() {
		err := SaveAppointment(senderName, phoneNumber, appointmentDateTime)
		if err != nil {
			log.Printf("❌ Error guardando en Sheets: %v", err)
		} else {
			log.Printf("✅ Cita guardada en Google Sheets")
		}
	}

	// Crear evento en Google Calendar
	if IsCalendarEnabled() {
		config := GetBusinessConfig()
		duration := 60 // Duración por defecto
		if config != nil && config.DefaultAppointmentDuration > 0 {
			duration = config.DefaultAppointmentDuration
		}

		eventTitle := fmt.Sprintf("Cita - %s", senderName)
		eventDescription := fmt.Sprintf("Cliente: %s\nTeléfono: %s", senderName, phoneNumber)

		eventLink, err := CreateCalendarEvent(eventTitle, eventDescription, appointmentDateTime, duration)
		if err != nil {
			log.Printf("❌ Error creando evento en Calendar: %v", err)
		} else {
			log.Printf("✅ Evento creado en Google Calendar: %s", eventLink)
		}
	}

	return fmt.Sprintf(`✅ *Cita agendada exitosamente*

👤 *Cliente:* %s
📅 *Fecha:* %s
🕐 *Hora:* %s

Recibirás un recordatorio antes de tu cita.

¿Necesitas algo más?`, senderName, appointmentDateTime.Format("02/01/2006"), appointmentDateTime.Format("15:04"))
}

// handleBusinessHours maneja consultas de horario
func handleBusinessHours() string {
	config := GetBusinessConfig()
	if config == nil {
		return "Estamos disponibles de lunes a viernes de 9:00 AM a 6:00 PM"
	}

	return fmt.Sprintf(`🕐 *Horarios de atención*

%s

¿Deseas agendar una cita?`, config.BusinessHours)
}

// handleServices maneja consultas de servicios
func handleServices() string {
	config := GetBusinessConfig()
	if config == nil {
		return "Ofrecemos diversos servicios profesionales. ¿Te gustaría agendar una cita?"
	}

	var servicesList strings.Builder
	servicesList.WriteString("💼 *Nuestros servicios*\n\n")

	for i, service := range config.Services {
		servicesList.WriteString(fmt.Sprintf("%d. *%s*\n", i+1, service.Name))
		if service.Description != "" {
			servicesList.WriteString(fmt.Sprintf("   %s\n", service.Description))
		}
		if service.Duration > 0 {
			servicesList.WriteString(fmt.Sprintf("   ⏱ Duración: %d min\n", service.Duration))
		}
		if service.Price > 0 {
			servicesList.WriteString(fmt.Sprintf("   💰 Precio: $%.2f\n", service.Price))
		}
		servicesList.WriteString("\n")
	}

	servicesList.WriteString("¿Te gustaría agendar alguno de estos servicios?")

	return servicesList.String()
}

// handleLocation maneja consultas de ubicación
func handleLocation() string {
	config := GetBusinessConfig()
	if config == nil {
		return "Contáctanos para conocer nuestra ubicación."
	}

	response := fmt.Sprintf(`📍 *Nuestra ubicación*

%s`, config.Address)

	if config.GoogleMapsLink != "" {
		response += fmt.Sprintf("\n\n🗺 Ver en Google Maps:\n%s", config.GoogleMapsLink)
	}

	return response
}

// handlePricing maneja consultas de precios
func handlePricing() string {
	config := GetBusinessConfig()
	if config == nil {
		return "Para información sobre precios, por favor contáctanos o agenda una cita."
	}

	var priceList strings.Builder
	priceList.WriteString("💰 *Lista de precios*\n\n")

	hasServices := false
	for _, service := range config.Services {
		if service.Price > 0 {
			hasServices = true
			priceList.WriteString(fmt.Sprintf("• *%s:* $%.2f\n", service.Name, service.Price))
		}
	}

	if !hasServices {
		return "Para información sobre precios, por favor contáctanos o agenda una cita."
	}

	priceList.WriteString("\n¿Te gustaría agendar una cita?")

	return priceList.String()
}

// handleHelp maneja solicitudes de ayuda
func handleHelp() string {
	config := GetBusinessConfig()
	businessName := "nosotros"
	if config != nil {
		businessName = config.AgentName
	}

	return fmt.Sprintf(`🤖 *Menú de ayuda*

Puedes escribir:

📅 *"Agendar cita"* - Reservar una cita
💼 *"Servicios"* - Ver servicios disponibles
🕐 *"Horarios"* - Conocer horario de atención
📍 *"Ubicación"* - Ver dónde estamos
💰 *"Precios"* - Consultar precios
🚫 *"Cancelar cita"* - Cancelar una reserva

¿En qué puedo ayudarte?

_Atendido por %s_`, businessName)
}

// handleUnknown maneja mensajes desconocidos
func handleUnknown(senderName string) string {
	return fmt.Sprintf(`Lo siento %s, no entendí tu mensaje. 🤔

Escribe *"Ayuda"* para ver las opciones disponibles.`, senderName)
}

// generateGeminiResponse genera respuesta con IA
func generateGeminiResponse(messageText, senderName string) string {
	config := GetBusinessConfig()
	businessContext := ""

	if config != nil {
		businessContext = fmt.Sprintf(`Eres el asistente virtual de %s.
Información del negocio:
- Servicios: %s
- Horarios: %s
- Ubicación: %s
- Teléfono: %s

Responde de manera amigable, profesional y útil. Si te preguntan por citas, servicios, horarios o ubicación, proporciona la información correspondiente.`,
			config.AgentName,
			getServicesText(config.Services),
			config.BusinessHours,
			config.Address,
			config.PhoneNumber)
	}

	prompt := fmt.Sprintf(`%s

Cliente: %s
Mensaje: %s

Genera una respuesta apropiada, breve (máximo 3 líneas) y en español.`, businessContext, senderName, messageText)

	response, err := GenerateResponse(prompt)
	if err != nil {
		log.Printf("❌ Error con Gemini: %v", err)
		return handleUnknown(senderName)
	}

	return response
}

// getServicesText convierte servicios a texto
func getServicesText(services []Service) string {
	var serviceNames []string
	for _, service := range services {
		serviceNames = append(serviceNames, service.Name)
	}
	return strings.Join(serviceNames, ", ")
}
