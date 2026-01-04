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
	log.Println("")
	log.Println("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
	log.Println("🔧 INICIANDO GOOGLE CALENDAR")
	log.Println("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
	log.Println("")

	// PASO 1: Verificar GOOGLE_CALENDAR_ID
	calendarID = os.Getenv("GOOGLE_CALENDAR_ID")
	log.Println("📋 PASO 1/7: Verificando GOOGLE_CALENDAR_ID...")
	if calendarID == "" {
		calendarEnabled = false
		log.Println("   ❌ GOOGLE_CALENDAR_ID no configurado en .env")
		log.Println("   💡 Agrega GOOGLE_CALENDAR_ID=tu_id en el archivo .env")
		return fmt.Errorf("GOOGLE_CALENDAR_ID no configurado")
	}
	log.Printf("   ✅ GOOGLE_CALENDAR_ID encontrado: %s\n", calendarID)
	log.Println("")

	// PASO 2: Verificar archivo google.json
	log.Println("📋 PASO 2/7: Verificando archivo google.json...")
	wd, _ := os.Getwd()
	log.Printf("   📂 Directorio actual: %s\n", wd)

	if _, err := os.Stat("google.json"); os.IsNotExist(err) {
		calendarEnabled = false
		log.Println("   ❌ Archivo google.json NO encontrado")
		log.Printf("   📂 Buscado en: %s/google.json\n", wd)
		log.Println("   💡 Crea el archivo google.json con tus credenciales OAuth")
		return fmt.Errorf("archivo google.json no encontrado")
	}
	log.Println("   ✅ Archivo google.json existe")
	log.Println("")

	// PASO 3: Leer google.json
	log.Println("📋 PASO 3/7: Leyendo google.json...")
	tokenJSON, err := os.ReadFile("google.json")
	if err != nil {
		calendarEnabled = false
		log.Printf("   ❌ Error leyendo google.json: %v\n", err)
		return fmt.Errorf("error leyendo google.json: %w", err)
	}
	log.Printf("   ✅ Archivo leído: %d bytes\n", len(tokenJSON))

	// Mostrar primeros caracteres para debug
	preview := string(tokenJSON)
	if len(preview) > 100 {
		preview = preview[:100] + "..."
	}
	log.Printf("   📄 Contenido: %s\n", preview)
	log.Println("")

	// PASO 4: Parsear token
	log.Println("📋 PASO 4/7: Parseando token OAuth...")
	var token oauth2.Token
	if err := json.Unmarshal(tokenJSON, &token); err != nil {
		calendarEnabled = false
		log.Printf("   ❌ Error parseando token: %v\n", err)
		log.Println("   💡 Verifica que google.json tenga formato JSON válido")
		return fmt.Errorf("error parseando token de google.json: %w", err)
	}
	log.Println("   ✅ Token parseado correctamente")
	log.Println("")

	// PASO 5: Validar token
	log.Println("📋 PASO 5/7: Validando contenido del token...")

	if token.AccessToken == "" {
		calendarEnabled = false
		log.Println("   ❌ Token no contiene access_token")
		log.Println("   💡 El archivo google.json debe tener un access_token válido")
		return fmt.Errorf("token no contiene access_token válido")
	}

	// Mostrar preview del access token
	accessTokenPreview := token.AccessToken
	if len(accessTokenPreview) > 30 {
		accessTokenPreview = accessTokenPreview[:20] + "..." + accessTokenPreview[len(accessTokenPreview)-10:]
	}
	log.Printf("   ✅ access_token presente: %s\n", accessTokenPreview)

	// Verificar expiración
	if !token.Expiry.IsZero() {
		if token.Expiry.Before(time.Now()) {
			log.Printf("   ⚠️  TOKEN EXPIRADO: %s (hace %v)\n",
				token.Expiry.Format("2006-01-02 15:04:05"),
				time.Since(token.Expiry))
			log.Println("   💡 Necesitas renovar el token desde el panel de Attomos")
		} else {
			log.Printf("   ✅ Token válido hasta: %s (en %v)\n",
				token.Expiry.Format("2006-01-02 15:04:05"),
				time.Until(token.Expiry))
		}
	} else {
		log.Println("   ℹ️  Token sin fecha de expiración")
	}

	if token.RefreshToken != "" {
		log.Println("   ✅ refresh_token presente (auto-renovación habilitada)")
	} else {
		log.Println("   ⚠️  No hay refresh_token (el token no se auto-renovará)")
	}
	log.Println("")

	// PASO 6: Crear servicio
	log.Println("📋 PASO 6/7: Creando servicio de Google Calendar...")

	ctx := context.Background()

	// Crear token source
	tokenSource := oauth2.StaticTokenSource(&token)

	// Crear cliente HTTP autenticado con el token
	client := oauth2.NewClient(ctx, tokenSource)

	// Crear servicio de Calendar con el cliente HTTP
	srv, err := calendar.NewService(ctx, option.WithHTTPClient(client))
	if err != nil {
		calendarEnabled = false
		log.Printf("   ❌ Error creando servicio Calendar: %v\n", err)
		log.Println("   💡 Verifica tu conexión a internet y que el token sea válido")
		return fmt.Errorf("error creando servicio Calendar: %w", err)
	}
	log.Println("   ✅ Servicio de Calendar creado exitosamente")
	log.Println("")

	// PASO 7: Probar acceso al Calendar
	log.Println("📋 PASO 7/7: Probando acceso al Calendar...")
	log.Printf("   🔍 Intentando acceder a: %s\n", calendarID)

	cal, testErr := srv.Calendars.Get(calendarID).Do()
	if testErr != nil {
		calendarEnabled = false
		log.Printf("   ❌ Error accediendo al Calendar: %v\n", testErr)
		log.Println("")
		log.Println("   💡 POSIBLES CAUSAS:")
		log.Println("      1️⃣  El Calendar ID es incorrecto")
		log.Println("      2️⃣  La cuenta no tiene permisos de edición")
		log.Println("      3️⃣  El token está expirado/inválido")
		log.Println("      4️⃣  El Calendar fue eliminado")
		log.Println("")
		log.Println("   📋 CÓMO VERIFICAR:")
		log.Printf("      Abre: https://calendar.google.com/calendar/u/0/r/settings/calendar/%s\n", calendarID)
		log.Println("      Asegúrate de tener permisos de Editor")
		log.Println("")
		return fmt.Errorf("error accediendo al Calendar: %w", testErr)
	}

	log.Println("   ✅ Acceso al Calendar verificado")
	if cal.Summary != "" {
		log.Printf("   📅 Calendario: %s\n", cal.Summary)
		log.Printf("   🌍 Zona horaria: %s\n", cal.TimeZone)
	}
	log.Println("")

	calendarService = srv
	calendarEnabled = true

	log.Println("╔════════════════════════════════════════════════════════╗")
	log.Println("║                                                        ║")
	log.Println("║    ✅ GOOGLE CALENDAR INICIALIZADO EXITOSAMENTE       ║")
	log.Println("║                                                        ║")
	log.Println("╚════════════════════════════════════════════════════════╝")
	log.Println("")

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

	log.Println("✅ Objeto del evento construido:")
	log.Printf("   📝 Título: %s\n", event.Summary)
	log.Printf("   📅 Inicio: %s\n", startDate.Format("02/01/2006 15:04"))
	log.Printf("   📅 Fin: %s\n", endDate.Format("02/01/2006 15:04"))
	log.Printf("   🌍 Zona horaria: %s\n", TIMEZONE)
	log.Printf("   🎨 Color: %s\n", event.ColorId)
	log.Println("")

	log.Println("🔄 PASO 5: Enviando evento a Google Calendar API...")
	log.Printf("   📅 Calendar ID: %s\n", calendarID)

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
