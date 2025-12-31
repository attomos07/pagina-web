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
		log.Println("⚠️  Google Calendar no habilitado, saltando creación")
		return nil, nil
	}

	// Parsear fecha y hora
	fechaObj, err := ParseFecha(data["fechaExacta"])
	if err != nil {
		return nil, fmt.Errorf("error parseando fecha: %w", err)
	}

	horas, minutos, err := ConvertirHoraA24h(data["hora"])
	if err != nil {
		return nil, fmt.Errorf("error convirtiendo hora: %w", err)
	}

	// Crear fecha de inicio
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

	// Crear fecha de fin (1 hora después)
	endDate := startDate.Add(time.Hour)

	// Crear el evento
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
			UseDefault: false,
			Overrides: []*calendar.EventReminder{
				{Method: "email", Minutes: 1440}, // 1 día antes
				{Method: "popup", Minutes: 60},   // 1 hora antes
				{Method: "popup", Minutes: 10},   // 10 minutos antes
			},
		},
		Status:       "confirmed",
		Transparency: "opaque",
	}

	log.Printf("📅 Creando evento en Google Calendar para %s el %s a las %s\n",
		data["nombre"],
		data["fechaExacta"],
		data["hora"],
	)

	createdEvent, err := calendarService.Events.Insert(calendarID, event).Do()
	if err != nil {
		return nil, fmt.Errorf("error creando evento: %w", err)
	}

	log.Printf("✅ Evento creado en Calendar: %s\n", createdEvent.HtmlLink)
	return createdEvent, nil
}

// GetUpcomingAppointments obtiene las próximas citas (próximos 7 días)
func GetUpcomingAppointments() ([]*calendar.Event, error) {
	if !calendarEnabled {
		return nil, fmt.Errorf("Google Calendar no habilitado")
	}

	now := time.Now()
	weekFromNow := now.AddDate(0, 0, 7)

	events, err := calendarService.Events.List(calendarID).
		TimeMin(now.Format(time.RFC3339)).
		TimeMax(weekFromNow.Format(time.RFC3339)).
		SingleEvents(true).
		OrderBy("startTime").
		Q("✂️").
		Do()

	if err != nil {
		return nil, fmt.Errorf("error obteniendo citas: %w", err)
	}

	return events.Items, nil
}

// SearchEventsByPatient busca eventos por nombre de cliente
func SearchEventsByPatient(nombre string) ([]*calendar.Event, error) {
	if !calendarEnabled {
		return nil, fmt.Errorf("Google Calendar no habilitado")
	}

	now := time.Now()
	threeMonthsLater := now.AddDate(0, 3, 0)

	events, err := calendarService.Events.List(calendarID).
		TimeMin(now.Format(time.RFC3339)).
		TimeMax(threeMonthsLater.Format(time.RFC3339)).
		SingleEvents(true).
		OrderBy("startTime").
		Q(nombre).
		Do()

	if err != nil {
		return nil, fmt.Errorf("error buscando eventos: %w", err)
	}

	return events.Items, nil
}
