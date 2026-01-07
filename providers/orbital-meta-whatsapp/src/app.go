package src

import (
	"fmt"
	"log"
	"regexp"
	"strings"
	"time"
)

// ProcessMessage procesa un mensaje entrante y retorna la respuesta
func ProcessMessage(messageText, phoneNumber, senderName string) string {
	// Normalizar mensaje
	normalizedMessage := strings.TrimSpace(strings.ToLower(messageText))

	log.Printf("🔍 Procesando mensaje de %s (%s): %s", senderName, phoneNumber, messageText)

	// Detectar intención
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

	case "cancel":
		response = handleCancellation()

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

	// Cancelar
	cancels := []string{"cancelar", "cancel"}
	for _, word := range cancels {
		if strings.Contains(message, word) {
			return "cancel"
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
		eventTitle := fmt.Sprintf("Cita - %s", senderName)
		eventDescription := fmt.Sprintf("Cliente: %s\nTeléfono: %s", senderName, phoneNumber)

		eventLink, err := CreateCalendarEvent(eventTitle, eventDescription, appointmentDateTime, config.DefaultAppointmentDuration)
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

// handleCancellation maneja cancelaciones
func handleCancellation() string {
	config := GetBusinessConfig()
	phone := ""
	if config != nil {
		phone = config.PhoneNumber // CORREGIDO: config.Phone → config.PhoneNumber
	}

	response := `Para cancelar tu cita, necesito los siguientes datos:

📅 *Fecha de tu cita*
👤 *Tu nombre*`

	if phone != "" {
		response += fmt.Sprintf("\n\nO puedes llamarnos directamente al: %s", phone)
	}

	return response
}

// handleHelp maneja solicitudes de ayuda
func handleHelp() string {
	config := GetBusinessConfig()
	businessName := "nosotros"
	if config != nil {
		businessName = config.AgentName // CORREGIDO: config.Name → config.AgentName
	}

	return fmt.Sprintf(`🤖 *Menú de ayuda*

Puedes escribir:

📅 *"Agendar cita"* - Reservar una cita
💼 *"Servicios"* - Ver servicios disponibles
🕐 *"Horarios"* - Conocer horario de atención
📍 *"Ubicación"* - Ver dónde estamos
💰 *"Precios"* - Consultar precios
❌ *"Cancelar"* - Cancelar una cita

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
			config.AgentName, // CORREGIDO: config.Name → config.AgentName
			getServicesText(config.Services),
			config.BusinessHours,
			config.Address,
			config.PhoneNumber) // CORREGIDO: config.Phone → config.PhoneNumber
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
