package src

import (
	"context"
	"fmt"
	"log"
	"os"
	"time"

	"golang.org/x/oauth2/google"
	"google.golang.org/api/calendar/v3"
	"google.golang.org/api/option"
)

var (
	calendarService *calendar.Service
	calendarID      string
)

// InitCalendar inicializa el servicio de Google Calendar
func InitCalendar() error {
	calendarID = os.Getenv("GOOGLE_CALENDAR_ID")
	if calendarID == "" {
		log.Println("⚠️  GOOGLE_CALENDAR_ID no configurado - Google Calendar deshabilitado")
		return nil
	}

	// Buscar credenciales
	credPath := os.Getenv("GOOGLE_APPLICATION_CREDENTIALS")
	if credPath == "" {
		credPath = "credentials.json"
	}

	credData, err := os.ReadFile(credPath)
	if err != nil {
		return fmt.Errorf("error leyendo credentials.json: %w", err)
	}

	config, err := google.JWTConfigFromJSON(credData, calendar.CalendarScope)
	if err != nil {
		return fmt.Errorf("error creando configuración JWT: %w", err)
	}

	ctx := context.Background()
	client := config.Client(ctx)

	srv, err := calendar.NewService(ctx, option.WithHTTPClient(client))
	if err != nil {
		return fmt.Errorf("error creando servicio Calendar: %w", err)
	}

	calendarService = srv

	log.Println("✅ Google Calendar inicializado correctamente")
	log.Printf("   📅 Calendar ID: %s", maskSensitiveData(calendarID))

	return nil
}

// CreateCalendarEvent crea un evento en Google Calendar
func CreateCalendarEvent(title, description string, startTime time.Time, durationMinutes int) (string, error) {
	if calendarService == nil {
		return "", fmt.Errorf("Google Calendar no está inicializado")
	}

	endTime := startTime.Add(time.Duration(durationMinutes) * time.Minute)

	event := &calendar.Event{
		Summary:     title,
		Description: description,
		Start: &calendar.EventDateTime{
			DateTime: startTime.Format(time.RFC3339),
			TimeZone: "America/Mexico_City",
		},
		End: &calendar.EventDateTime{
			DateTime: endTime.Format(time.RFC3339),
			TimeZone: "America/Mexico_City",
		},
		Reminders: &calendar.EventReminders{
			UseDefault: false,
			Overrides: []*calendar.EventReminder{
				{Method: "popup", Minutes: 30},
				{Method: "email", Minutes: 1440}, // 24 horas antes
			},
		},
	}

	createdEvent, err := calendarService.Events.Insert(calendarID, event).Do()
	if err != nil {
		return "", fmt.Errorf("error creando evento: %w", err)
	}

	log.Printf("✅ Evento creado en Google Calendar")
	log.Printf("   📋 Título: %s", title)
	log.Printf("   📅 Inicio: %s", startTime.Format("02/01/2006 15:04"))
	log.Printf("   ⏱  Duración: %d minutos", durationMinutes)
	log.Printf("   🔗 Link: %s", createdEvent.HtmlLink)

	return createdEvent.HtmlLink, nil
}

// GetUpcomingEvents obtiene los próximos eventos
func GetUpcomingEvents(maxResults int) ([]*calendar.Event, error) {
	if calendarService == nil {
		return nil, fmt.Errorf("Google Calendar no está inicializado")
	}

	now := time.Now().Format(time.RFC3339)

	events, err := calendarService.Events.List(calendarID).
		ShowDeleted(false).
		SingleEvents(true).
		TimeMin(now).
		MaxResults(int64(maxResults)).
		OrderBy("startTime").
		Do()

	if err != nil {
		return nil, fmt.Errorf("error obteniendo eventos: %w", err)
	}

	return events.Items, nil
}

// DeleteEvent elimina un evento de Google Calendar
func DeleteEvent(eventID string) error {
	if calendarService == nil {
		return fmt.Errorf("Google Calendar no está inicializado")
	}

	err := calendarService.Events.Delete(calendarID, eventID).Do()
	if err != nil {
		return fmt.Errorf("error eliminando evento: %w", err)
	}

	log.Printf("✅ Evento eliminado: %s", eventID)

	return nil
}

// UpdateEvent actualiza un evento existente
func UpdateEvent(eventID, title, description string, startTime time.Time, durationMinutes int) error {
	if calendarService == nil {
		return fmt.Errorf("Google Calendar no está inicializado")
	}

	endTime := startTime.Add(time.Duration(durationMinutes) * time.Minute)

	event, err := calendarService.Events.Get(calendarID, eventID).Do()
	if err != nil {
		return fmt.Errorf("error obteniendo evento: %w", err)
	}

	event.Summary = title
	event.Description = description
	event.Start.DateTime = startTime.Format(time.RFC3339)
	event.End.DateTime = endTime.Format(time.RFC3339)

	_, err = calendarService.Events.Update(calendarID, eventID, event).Do()
	if err != nil {
		return fmt.Errorf("error actualizando evento: %w", err)
	}

	log.Printf("✅ Evento actualizado: %s", eventID)

	return nil
}

// IsCalendarEnabled verifica si Google Calendar está habilitado
func IsCalendarEnabled() bool {
	return calendarService != nil && calendarID != ""
}

// FindEventByDate busca eventos en una fecha específica
func FindEventByDate(date time.Time) ([]*calendar.Event, error) {
	if calendarService == nil {
		return nil, fmt.Errorf("Google Calendar no está inicializado")
	}

	// Inicio del día
	startOfDay := time.Date(date.Year(), date.Month(), date.Day(), 0, 0, 0, 0, date.Location())
	// Fin del día
	endOfDay := startOfDay.Add(24 * time.Hour)

	events, err := calendarService.Events.List(calendarID).
		ShowDeleted(false).
		SingleEvents(true).
		TimeMin(startOfDay.Format(time.RFC3339)).
		TimeMax(endOfDay.Format(time.RFC3339)).
		OrderBy("startTime").
		Do()

	if err != nil {
		return nil, fmt.Errorf("error buscando eventos: %w", err)
	}

	return events.Items, nil
}

// GetCalendarInfo obtiene información del calendario
func GetCalendarInfo() (*calendar.Calendar, error) {
	if calendarService == nil {
		return nil, fmt.Errorf("Google Calendar no está inicializado")
	}

	cal, err := calendarService.Calendars.Get(calendarID).Do()
	if err != nil {
		return nil, fmt.Errorf("error obteniendo información del calendario: %w", err)
	}

	return cal, nil
}
