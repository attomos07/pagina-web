package src

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"os"
	"time"

	"golang.org/x/oauth2"
	"google.golang.org/api/calendar/v3"
	"google.golang.org/api/option"
)

var calendarService *calendar.Service
var calendarID string
var calendarEnabled bool

// InitCalendar inicializa el servicio de Google Calendar usando OAuth token
func InitCalendar() error {
	calendarID = os.Getenv("GOOGLE_CALENDAR_ID")
	if calendarID == "" {
		calendarEnabled = false
		return fmt.Errorf("GOOGLE_CALENDAR_ID no configurado")
	}

	// Verificar credenciales
	if _, err := os.Stat("google.json"); os.IsNotExist(err) {
		calendarEnabled = false
		return fmt.Errorf("archivo google.json no encontrado")
	}

	// Leer el archivo google.json (que contiene el OAuth token)
	tokenJSON, err := os.ReadFile("google.json")
	if err != nil {
		calendarEnabled = false
		return fmt.Errorf("error leyendo google.json: %w", err)
	}

	// Intentar parsear como OAuth token
	var token oauth2.Token
	if err := json.Unmarshal(tokenJSON, &token); err != nil {
		calendarEnabled = false
		return fmt.Errorf("error parseando token de google.json: %w", err)
	}

	// Validar que el token tenga access_token
	if token.AccessToken == "" {
		calendarEnabled = false
		return fmt.Errorf("token no contiene access_token válido")
	}

	ctx := context.Background()

	// Crear token source que maneje el refresh automáticamente
	tokenSource := oauth2.StaticTokenSource(&token)

	// Crear cliente HTTP autenticado con el token
	client := oauth2.NewClient(ctx, tokenSource)

	// Crear servicio de Calendar con el cliente HTTP
	srv, err := calendar.NewService(ctx, option.WithHTTPClient(client))
	if err != nil {
		calendarEnabled = false
		return fmt.Errorf("error creando servicio Calendar: %w", err)
	}

	calendarService = srv
	calendarEnabled = true

	log.Println("✅ Google Calendar inicializado correctamente")
	return nil
}

// IsCalendarEnabled verifica si Calendar está habilitado
func IsCalendarEnabled() bool {
	return calendarEnabled
}

// CreateCalendarEvent crea un evento en Google Calendar
func CreateCalendarEvent(data map[string]string) (*calendar.Event, error) {
	if !calendarEnabled {
		log.Println("⚠️  Google Calendar NO HABILITADO - Saltando creación de evento")
		return nil, nil
	}

	log.Println("")
	log.Println("╔════════════════════════════════════════════════════════╗")
	log.Println("║                                                        ║")
	log.Println("║      📅 CREANDO EVENTO EN GOOGLE CALENDAR - INICIO     ║")
	log.Println("║                                                        ║")
	log.Println("╚════════════════════════════════════════════════════════╝")
	log.Println("")

	log.Println("📋 DATOS RECIBIDOS PARA CREAR EVENTO:")
	log.Println("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
	for key, value := range data {
		log.Printf("   %s: %s\n", key, value)
	}
	log.Println("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
	log.Println("")

	// Parsear fecha y hora
	log.Println("🔄 PASO 1: Parseando fecha...")
	fechaObj, err := ParseFecha(data["fechaExacta"])
	if err != nil {
		log.Println("❌ ERROR parseando fecha:")
		log.Printf("   📅 Fecha: %s\n", data["fechaExacta"])
		log.Printf("   ⚠️  Error: %v\n", err)
		return nil, fmt.Errorf("error parseando fecha: %w", err)
	}
	log.Println("✅ Fecha parseada exitosamente:")
	log.Printf("   📅 Fecha string: %s\n", data["fechaExacta"])
	log.Printf("   📅 Fecha objeto: %s\n", fechaObj.Format("02/01/2006"))
	log.Println("")

	log.Println("🔄 PASO 2: Convirtiendo hora a formato 24h...")
	horas, minutos, err := ConvertirHoraA24h(data["hora"])
	if err != nil {
		log.Println("❌ ERROR convirtiendo hora:")
		log.Printf("   ⏰ Hora: %s\n", data["hora"])
		log.Printf("   ⚠️  Error: %v\n", err)
		return nil, fmt.Errorf("error convirtiendo hora: %w", err)
	}
	log.Println("✅ Hora convertida exitosamente:")
	log.Printf("   ⏰ Hora string: %s\n", data["hora"])
	log.Printf("   ⏰ Horas: %d, Minutos: %d\n", horas, minutos)
	log.Println("")

	// Crear fecha de inicio
	log.Println("🔄 PASO 3: Creando fecha de inicio del evento...")
	startDate := time.Date(
		fechaObj.Year(),
		fechaObj.Month(),
		fechaObj.Day(),
		horas,
		minutos,
		0,
		0,
		time.Local,
	)
	log.Println("✅ Fecha de inicio creada:")
	log.Printf("   📅 Inicio: %s\n", startDate.Format("02/01/2006 15:04 MST"))
	log.Println("")

	// Crear fecha de fin (1 hora después)
	endDate := startDate.Add(time.Hour)
	log.Println("✅ Fecha de fin calculada:")
	log.Printf("   📅 Fin: %s (1 hora después)\n", endDate.Format("02/01/2006 15:04 MST"))
	log.Println("")

	// Crear el evento
	log.Println("🔄 PASO 4: Construyendo objeto del evento...")
	event := &calendar.Event{
		Summary: fmt.Sprintf("✂️ %s - %s", data["servicio"], data["nombre"]),
		Description: fmt.Sprintf(
			"Cliente: %s\nTeléfono: %s\nServicio: %s\nBarbero: %s\n\nAgendado mediante WhatsApp Bot",
			data["nombre"],
			data["telefono"],
			data["servicio"],
			data["barbero"],
		),
		Start: &calendar.EventDateTime{
			DateTime: startDate.Format(time.RFC3339),
			TimeZone: TIMEZONE,
		},
		End: &calendar.EventDateTime{
			DateTime: endDate.Format(time.RFC3339),
			TimeZone: TIMEZONE,
		},
		ColorId: "9", // Azul
		Reminders: &calendar.EventReminders{
			Overrides: []*calendar.EventReminder{
				{Method: "email", Minutes: 1440}, // 1 día antes
				{Method: "popup", Minutes: 60},   // 1 hora antes
				{Method: "popup", Minutes: 10},   // 10 minutos antes
			},
		},
		Status:       "confirmed",
		Transparency: "opaque",
	}

	log.Println("✅ Objeto del evento construido:")
	log.Printf("   📝 Título: %s\n", event.Summary)
	log.Printf("   📅 Inicio: %s\n", startDate.Format("02/01/2006 15:04"))
	log.Printf("   📅 Fin: %s\n", endDate.Format("02/01/2006 15:04"))
	log.Printf("   🌍 Zona horaria: %s\n", TIMEZONE)
	log.Printf("   🎨 Color: %s\n", event.ColorId)
	log.Println("")

	log.Println("🔄 PASO 5: Enviando evento a Google Calendar API...")
	log.Printf("   📍 Calendar ID: %s\n", calendarID)

	createdEvent, err := calendarService.Events.Insert(calendarID, event).Do()
	if err != nil {
		log.Println("")
		log.Println("╔════════════════════════════════════════════════════════╗")
		log.Println("║                                                        ║")
		log.Println("║       ❌ ERROR CREANDO EVENTO EN CALENDAR              ║")
		log.Println("║                                                        ║")
		log.Println("╚════════════════════════════════════════════════════════╝")
		log.Printf("❌ ERROR: %v\n", err)
		log.Printf("   📅 Datos del evento: %s - %s\n", data["nombre"], data["servicio"])
		log.Println("")
		return nil, fmt.Errorf("error creando evento: %w", err)
	}

	log.Println("")
	log.Println("╔════════════════════════════════════════════════════════╗")
	log.Println("║                                                        ║")
	log.Println("║     ✅ EVENTO CREADO EN CALENDAR EXITOSAMENTE          ║")
	log.Println("║                                                        ║")
	log.Println("╚════════════════════════════════════════════════════════╝")
	log.Println("")
	log.Println("📊 DETALLES DEL EVENTO CREADO:")
	log.Println("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
	log.Printf("   🆔 Event ID: %s\n", createdEvent.Id)
	log.Printf("   📝 Título: %s\n", createdEvent.Summary)
	log.Printf("   📅 Inicio: %s\n", startDate.Format("02/01/2006 15:04 MST"))
	log.Printf("   📅 Fin: %s\n", endDate.Format("02/01/2006 15:04 MST"))
	log.Printf("   👤 Cliente: %s\n", data["nombre"])
	log.Printf("   📞 Teléfono: %s\n", data["telefono"])
	log.Printf("   ✂️  Servicio: %s\n", data["servicio"])
	log.Printf("   💈 Barbero: %s\n", data["barbero"])
	log.Printf("   🔗 Link: %s\n", createdEvent.HtmlLink)
	log.Println("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
	log.Println("")

	return createdEvent, nil
}

// GetUpcomingAppointments obtiene las próximas citas (próximos 7 días)
func GetUpcomingAppointments() ([]*calendar.Event, error) {
	if !calendarEnabled {
		return nil, fmt.Errorf("Google Calendar no habilitado")
	}

	now := time.Now()
	weekFromNow := now.AddDate(0, 0, 7)

	log.Printf("📅 Obteniendo citas desde %s hasta %s\n",
		now.Format("02/01/2006"),
		weekFromNow.Format("02/01/2006"))

	events, err := calendarService.Events.List(calendarID).
		TimeMin(now.Format(time.RFC3339)).
		TimeMax(weekFromNow.Format(time.RFC3339)).
		SingleEvents(true).
		OrderBy("startTime").
		Q("✂️").
		Do()

	if err != nil {
		log.Printf("❌ Error obteniendo citas: %v\n", err)
		return nil, fmt.Errorf("error obteniendo citas: %w", err)
	}

	log.Printf("✅ Se encontraron %d citas\n", len(events.Items))
	return events.Items, nil
}

// SearchEventsByPatient busca eventos por nombre de cliente
func SearchEventsByPatient(nombre string) ([]*calendar.Event, error) {
	if !calendarEnabled {
		return nil, fmt.Errorf("Google Calendar no habilitado")
	}

	now := time.Now()
	threeMonthsLater := now.AddDate(0, 3, 0)

	log.Printf("🔍 Buscando eventos para cliente: %s\n", nombre)

	events, err := calendarService.Events.List(calendarID).
		TimeMin(now.Format(time.RFC3339)).
		TimeMax(threeMonthsLater.Format(time.RFC3339)).
		SingleEvents(true).
		OrderBy("startTime").
		Q(nombre).
		Do()

	if err != nil {
		log.Printf("❌ Error buscando eventos: %v\n", err)
		return nil, fmt.Errorf("error buscando eventos: %w", err)
	}

	log.Printf("✅ Se encontraron %d eventos para %s\n", len(events.Items), nombre)
	return events.Items, nil
}
