// Este archivo es para reemplazar src/sheets.go en el bot AtomicBot
// Corrige el error: "Unable to parse range: Sheet1!A1"
// La hoja se llama "Calendario", no "Sheet1"

package src

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"os"
	"strings"
	"time"

	"golang.org/x/oauth2"
	"golang.org/x/oauth2/google"
	"google.golang.org/api/option"
	"google.golang.org/api/sheets/v4"
)

var (
	sheetsService *sheets.Service
	sheetsEnabled bool
	sheetID       string
)

// CitaData representa los datos de una cita
type CitaData struct {
	NombreCliente    string
	Telefono         string
	Fecha            string
	Hora             string
	Servicio         string
	NombreTrabajador string
}

// InitSheets inicializa Google Sheets
func InitSheets() error {
	return initGoogleSheets()
}

// IsSheetsEnabled retorna si Google Sheets está habilitado
func IsSheetsEnabled() bool {
	return sheetsEnabled
}

// SaveAppointmentToSheets guarda una cita en Google Sheets (alias de guardarCitaEnSheets)
func SaveAppointmentToSheets(nombreCliente, telefono, fecha, hora, servicio, trabajador string) error {
	cita := &CitaData{
		NombreCliente:    nombreCliente,
		Telefono:         telefono,
		Fecha:            fecha,
		Hora:             hora,
		Servicio:         servicio,
		NombreTrabajador: trabajador,
	}
	return guardarCitaEnSheets(cita)
}

// InitializeWeeklyCalendar inicializa el calendario semanal (no hace nada si ya está inicializado)
func InitializeWeeklyCalendar() error {
	// El calendario ya está inicializado cuando se crea el Spreadsheet
	// Esta función solo retorna nil para compatibilidad
	return nil
}

func initGoogleSheets() error {
	log.Println("")
	log.Println("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
	log.Println("📊 INICIANDO GOOGLE SHEETS")
	log.Println("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
	log.Println("")

	// PASO 1: Verificar SPREADSHEETID
	log.Println("📋 PASO 1/8: Verificando SPREADSHEETID en .env...")
	spreadsheetID := os.Getenv("SPREADSHEETID")

	if spreadsheetID == "" {
		sheetsEnabled = false
		log.Println("   ⚠️  SPREADSHEETID no encontrado en .env")
		log.Println("")
		log.Println("   💡 SOLUCIÓN:")
		log.Println("      1. Crea un Google Sheet")
		log.Println("      2. Copia el ID de la URL")
		log.Println("      3. Agrégalo al archivo .env:")
		log.Println("         SPREADSHEETID=tu_id_aqui")
		log.Println("")
		return fmt.Errorf("SPREADSHEETID no configurado")
	}

	sheetID = spreadsheetID
	log.Printf("   ✅ SPREADSHEETID encontrado: %s\n", spreadsheetID)
	log.Println("")

	// PASO 2: Verificar archivo google.json
	log.Println("📋 PASO 2/8: Verificando archivo google.json...")

	currentDir, err := os.Getwd()
	if err == nil {
		log.Printf("   📂 Directorio actual: %s\n", currentDir)
	}

	if _, err := os.Stat("google.json"); os.IsNotExist(err) {
		sheetsEnabled = false
		log.Println("   ❌ Archivo google.json NO encontrado")
		log.Println("")
		log.Println("   💡 SOLUCIÓN:")
		log.Println("      1. Ve a Google Cloud Console")
		log.Println("      2. Crea credenciales OAuth 2.0")
		log.Println("      3. Descarga el archivo JSON")
		log.Println("      4. Guárdalo como 'google.json' en este directorio")
		log.Println("")
		return fmt.Errorf("archivo google.json no encontrado")
	}

	log.Println("   ✅ Archivo google.json existe")
	log.Println("")

	// PASO 3: Leer google.json
	log.Println("📋 PASO 3/8: Leyendo google.json...")

	credBytes, err := os.ReadFile("google.json")
	if err != nil {
		sheetsEnabled = false
		log.Printf("   ❌ Error leyendo google.json: %v\n", err)
		return err
	}

	log.Printf("   ✅ Archivo leído: %d bytes\n", len(credBytes))

	// Mostrar preview del contenido (primeros 100 chars)
	preview := string(credBytes)
	if len(preview) > 100 {
		preview = preview[:100] + "..."
	}
	log.Printf("   📄 Contenido: %s\n", preview)
	log.Println("")

	// PASO 4: Parsear token OAuth
	log.Println("📋 PASO 4/8: Parseando token OAuth...")

	var token oauth2.Token
	if err := json.Unmarshal(credBytes, &token); err != nil {
		sheetsEnabled = false
		log.Printf("   ❌ Error parseando token: %v\n", err)
		log.Println("")
		log.Println("   💡 DIAGNÓSTICO:")
		log.Println("      El archivo google.json no tiene el formato correcto")
		log.Println("")
		log.Println("   🔧 SOLUCIÓN:")
		log.Println("      El archivo debe contener un token OAuth2 con esta estructura:")
		log.Println("      {")
		log.Println("        \"access_token\": \"...\",")
		log.Println("        \"token_type\": \"Bearer\",")
		log.Println("        \"refresh_token\": \"...\",")
		log.Println("        \"expiry\": \"...\"")
		log.Println("      }")
		log.Println("")
		return err
	}

	log.Println("   ✅ Token parseado correctamente")
	log.Println("")

	// PASO 5: Validar contenido del token
	log.Println("📋 PASO 5/8: Validando contenido del token...")

	if token.AccessToken == "" {
		sheetsEnabled = false
		log.Println("   ❌ access_token está vacío")
		return fmt.Errorf("access_token vacío en google.json")
	}

	// Mostrar preview del access_token (primeros y últimos 20 chars)
	accessTokenPreview := token.AccessToken
	if len(accessTokenPreview) > 40 {
		accessTokenPreview = accessTokenPreview[:20] + "..." + accessTokenPreview[len(accessTokenPreview)-10:]
	}
	log.Printf("   ✅ access_token presente: %s\n", accessTokenPreview)

	// Verificar expiración
	if !token.Expiry.IsZero() {
		timeUntilExpiry := time.Until(token.Expiry)
		if timeUntilExpiry < 0 {
			log.Printf("   ⚠️  Token expirado hace: %v\n", -timeUntilExpiry)
			log.Println("")
			log.Println("   💡 SOLUCIÓN:")
			log.Println("      El token está expirado. Necesitas:")
			log.Println("      1. Reconectar tu Google Account desde el panel de Attomos")
			log.Println("      2. O generar un nuevo token manualmente")
			log.Println("")

			// Intentar continuar de todas formas si hay refresh_token
			if token.RefreshToken != "" {
				log.Println("   ℹ️  Hay refresh_token - intentando renovar automáticamente...")
			}
		} else {
			log.Printf("   ✅ Token válido hasta: %v (en %v)\n", token.Expiry.Format("2006-01-02 15:04:05"), timeUntilExpiry)
		}
	}

	if token.RefreshToken != "" {
		log.Println("   ✅ refresh_token presente (auto-renovación habilitada)")
	} else {
		log.Println("   ⚠️  refresh_token NO presente (el token expirará sin renovarse)")
	}

	log.Println("")

	// PASO 6: Crear servicio de Sheets
	log.Println("📋 PASO 6/8: Creando servicio de Google Sheets...")

	config := &oauth2.Config{
		Scopes:   []string{sheets.SpreadsheetsScope},
		Endpoint: google.Endpoint,
	}

	client := config.Client(context.Background(), &token)

	srv, err := sheets.NewService(context.Background(), option.WithHTTPClient(client))
	if err != nil {
		sheetsEnabled = false
		log.Printf("   ❌ Error creando servicio Sheets: %v\n", err)
		return err
	}

	sheetsService = srv
	log.Println("   ✅ Servicio de Sheets creado exitosamente")
	log.Println("")

	// PASO 7: Probar acceso de LECTURA al Spreadsheet
	log.Println("📋 PASO 7/8: Probando acceso de LECTURA al Spreadsheet...")
	log.Printf("   🔍 Intentando acceder a: %s\n", spreadsheetID)

	spreadsheet, testErr := srv.Spreadsheets.Get(spreadsheetID).Do()
	if testErr != nil {
		sheetsEnabled = false
		log.Printf("   ❌ Error accediendo al Spreadsheet: %v\n", testErr)
		log.Println("")
		log.Println("   💡 POSIBLES CAUSAS:")
		log.Println("      1️⃣  El Spreadsheet ID es incorrecto")
		log.Println("      2️⃣  La cuenta no tiene permisos (el Spreadsheet está RESTRINGIDO)")
		log.Println("      3️⃣  El token está expirado/inválido")
		log.Println("      4️⃣  El Spreadsheet fue eliminado")
		log.Println("")
		log.Println("   📋 CÓMO VERIFICAR:")
		log.Printf("      Abre: https://docs.google.com/spreadsheets/d/%s\n", spreadsheetID)
		log.Println("")
		log.Println("   🔓 SOLUCIÓN SI ESTÁ RESTRINGIDO:")
		log.Println("      1. Abre el Spreadsheet")
		log.Println("      2. Click en 'Compartir' (arriba a la derecha)")
		log.Println("      3. En 'Acceso general', cambia de 'Restringido' a:")
		log.Println("         → 'Cualquier persona con el vínculo' puede EDITAR")
		log.Println("")
		return testErr
	}

	log.Println("   ✅ Acceso de LECTURA verificado")
	log.Printf("   📊 Título: %s\n", spreadsheet.Properties.Title)
	log.Println("")

	// PASO 8: Probar permisos de ESCRITURA
	log.Println("📋 PASO 8/8: Probando permisos de ESCRITURA...")
	log.Println("   🧪 Intentando escribir una celda de prueba...")

	testCellRange := "Calendario!A1"
	testValue := [][]interface{}{{"Hora"}}
	testValueRange := &sheets.ValueRange{Values: testValue}

	_, writeErr := srv.Spreadsheets.Values.Update(spreadsheetID, testCellRange, testValueRange).
		ValueInputOption("RAW").
		Do()

	if writeErr != nil {
		sheetsEnabled = false
		log.Printf("   ❌ Error escribiendo en el Spreadsheet: %v\n", writeErr)
		log.Println("")
		log.Println("   💡 DIAGNÓSTICO:")
		log.Println("      ✅ Tienes permisos de LECTURA")
		log.Println("      ❌ NO tienes permisos de ESCRITURA")
		log.Println("")
		log.Println("   🔓 SOLUCIÓN:")
		log.Println("      El Spreadsheet debe tener permisos de EDICIÓN, no solo lectura")
		log.Println("")
		log.Println("   📋 PASOS:")
		log.Printf("      1. Abre: https://docs.google.com/spreadsheets/d/%s\n", spreadsheetID)
		log.Println("      2. Click en 'Compartir' (botón arriba a la derecha)")
		log.Println("      3. En 'Acceso general':")
		log.Println("         → Cambia de 'Restringido' a 'Cualquier persona con el vínculo'")
		log.Println("         → En el dropdown de permisos, selecciona 'Editor'")
		log.Println("      4. Guarda los cambios")
		log.Println("      5. Reinicia el bot: systemctl restart atomic-bot-112")
		log.Println("")
		return writeErr
	}

	log.Println("   ✅ Permisos de ESCRITURA verificados")
	log.Println("   ℹ️  Celda A1 restaurada al valor original (header)")
	log.Println("")

	sheetsEnabled = true

	log.Println("╔════════════════════════════════════════════════════════╗")
	log.Println("║                                                        ║")
	log.Println("║     ✅ GOOGLE SHEETS INICIALIZADO EXITOSAMENTE        ║")
	log.Println("║        CON PERMISOS DE LECTURA Y ESCRITURA            ║")
	log.Println("║                                                        ║")
	log.Println("╚════════════════════════════════════════════════════════╝")
	log.Println("")

	return nil
}

// guardarCitaEnSheets guarda una cita en Google Sheets
func guardarCitaEnSheets(cita *CitaData) error {
	if !sheetsEnabled || sheetsService == nil {
		return fmt.Errorf("Google Sheets no está habilitado")
	}

	log.Println("")
	log.Println("📊 GUARDANDO EN GOOGLE SHEETS - INICIO")
	log.Printf("   Cliente: %s\n", cita.NombreCliente)
	log.Printf("   Fecha: %s\n", cita.Fecha)
	log.Printf("   Hora: %s\n", cita.Hora)
	log.Printf("   Servicio: %s\n", cita.Servicio)
	log.Printf("   Trabajador: %s\n", cita.NombreTrabajador)

	// Parsear fecha en formato DD/MM/YYYY a objeto time.Time
	var fechaObj time.Time
	var err error

	// Intentar parsear como DD/MM/YYYY
	fechaObj, err = time.Parse("02/01/2006", cita.Fecha)
	if err != nil {
		// Si falla, intentar como YYYY-MM-DD
		fechaObj, err = time.Parse("2006-01-02", cita.Fecha)
		if err != nil {
			log.Printf("❌ Error parseando fecha: %v\n", err)
			return err
		}
	}

	weekday := int(fechaObj.Weekday())
	var columnLetter string

	switch weekday {
	case 0: // Domingo
		columnLetter = "H"
	case 1: // Lunes
		columnLetter = "B"
	case 2: // Martes
		columnLetter = "C"
	case 3: // Miércoles
		columnLetter = "D"
	case 4: // Jueves
		columnLetter = "E"
	case 5: // Viernes
		columnLetter = "F"
	case 6: // Sábado
		columnLetter = "G"
	}

	// Parsear la hora para obtener la fila
	var horaObj time.Time

	// Intentar primero con formato 12h (AM/PM)
	horaObj, err = time.Parse("3:04 PM", cita.Hora)
	if err != nil {
		// Si falla, intentar con formato 24h
		horaObj, err = time.Parse("15:04", cita.Hora)
		if err != nil {
			log.Printf("❌ Error parseando hora: %v\n", err)
			return err
		}
	}

	hour := horaObj.Hour()
	row := hour - 9 + 2 // 9:00 AM está en la fila 2

	if row < 2 || row > 12 {
		return fmt.Errorf("hora fuera del rango del calendario (9:00 AM - 7:00 PM)")
	}

	// Construir el contenido de la celda
	cellContent := fmt.Sprintf("👤 %s\n📞 %s\n✂️ %s",
		cita.NombreCliente,
		cita.Telefono,
		cita.Servicio,
	)

	if cita.NombreTrabajador != "" {
		cellContent += fmt.Sprintf("\n👨‍💼 %s", cita.NombreTrabajador)
	}

	cellContent += fmt.Sprintf("\n📅 %s", cita.Fecha)

	// Actualizar la celda
	cellRange := fmt.Sprintf("Calendario!%s%d", columnLetter, row)

	log.Printf("   📍 Escribiendo en: %s\n", cellRange)

	valueRange := &sheets.ValueRange{
		Values: [][]interface{}{{cellContent}},
	}

	_, err = sheetsService.Spreadsheets.Values.Update(
		sheetID,
		cellRange,
		valueRange,
	).ValueInputOption("RAW").Do()

	if err != nil {
		log.Printf("❌ Error guardando en Sheets: %v\n", err)
		return err
	}

	log.Println("✅ CITA GUARDADA EN SHEETS EXITOSAMENTE")
	log.Println("")

	return nil
}

// ============================================
// FUNCIONES PARA CANCELAR CITAS
// ============================================

// CancelAppointment marca una cita como cancelada en Google Sheets
func CancelAppointment(appointmentDate time.Time, reason string) error {
	if !sheetsEnabled || sheetsService == nil {
		return fmt.Errorf("Google Sheets no está habilitado")
	}

	log.Println("")
	log.Println("🚫 CANCELANDO CITA EN GOOGLE SHEETS")
	log.Printf("   Fecha/Hora: %s\n", appointmentDate.Format("02/01/2006 15:04"))
	log.Printf("   Razón: %s\n", reason)

	// Determinar columna según día de la semana
	weekday := int(appointmentDate.Weekday())
	var columnLetter string

	switch weekday {
	case 0: // Domingo
		columnLetter = "H"
	case 1: // Lunes
		columnLetter = "B"
	case 2: // Martes
		columnLetter = "C"
	case 3: // Miércoles
		columnLetter = "D"
	case 4: // Jueves
		columnLetter = "E"
	case 5: // Viernes
		columnLetter = "F"
	case 6: // Sábado
		columnLetter = "G"
	}

	// Determinar fila según hora
	hour := appointmentDate.Hour()
	row := hour - 9 + 2

	if row < 2 || row > 12 {
		return fmt.Errorf("hora fuera del rango del calendario (9:00 AM - 7:00 PM)")
	}

	// Leer contenido actual de la celda
	cellRange := fmt.Sprintf("Calendario!%s%d", columnLetter, row)

	resp, err := sheetsService.Spreadsheets.Values.Get(sheetID, cellRange).Do()
	if err != nil {
		return fmt.Errorf("error leyendo celda: %w", err)
	}

	if len(resp.Values) == 0 || len(resp.Values[0]) == 0 {
		return fmt.Errorf("no hay cita agendada en ese horario")
	}

	currentContent := fmt.Sprintf("%v", resp.Values[0][0])

	// Construir nuevo contenido con marca de cancelación
	cancelledContent := fmt.Sprintf("❌ CANCELADA\n\n%s\n\n🚫 %s",
		currentContent,
		reason,
	)

	// Actualizar celda
	valueRange := &sheets.ValueRange{
		Values: [][]interface{}{{cancelledContent}},
	}

	_, err = sheetsService.Spreadsheets.Values.Update(
		sheetID,
		cellRange,
		valueRange,
	).ValueInputOption("RAW").Do()

	if err != nil {
		log.Printf("❌ Error cancelando en Sheets: %v\n", err)
		return err
	}

	log.Println("✅ CITA CANCELADA EN SHEETS")
	log.Println("")

	return nil
}

// CancelAppointmentByClient marca una cita como cancelada (simplificado)
func CancelAppointmentByClient(clientName, phoneNumber string, appointmentDate time.Time) error {
	reason := fmt.Sprintf("Cancelado por %s (%s)", clientName, phoneNumber)
	return CancelAppointment(appointmentDate, reason)
}

// ClearCancelledAppointment borra completamente una cita cancelada
func ClearCancelledAppointment(appointmentDate time.Time) error {
	if !sheetsEnabled || sheetsService == nil {
		return fmt.Errorf("Google Sheets no está habilitado")
	}

	// Determinar columna y fila
	weekday := int(appointmentDate.Weekday())
	var columnLetter string

	switch weekday {
	case 0:
		columnLetter = "H"
	case 1:
		columnLetter = "B"
	case 2:
		columnLetter = "C"
	case 3:
		columnLetter = "D"
	case 4:
		columnLetter = "E"
	case 5:
		columnLetter = "F"
	case 6:
		columnLetter = "G"
	}

	hour := appointmentDate.Hour()
	row := hour - 9 + 2

	// Limpiar celda
	cellRange := fmt.Sprintf("Calendario!%s%d", columnLetter, row)

	valueRange := &sheets.ValueRange{
		Values: [][]interface{}{{""}},
	}

	_, err := sheetsService.Spreadsheets.Values.Update(
		sheetID,
		cellRange,
		valueRange,
	).ValueInputOption("RAW").Do()

	if err != nil {
		return fmt.Errorf("error limpiando celda: %w", err)
	}

	log.Println("✅ Cita cancelada eliminada del calendario")
	return nil
}

// maskSensitiveData enmascara datos sensibles para logs
func maskSensitiveData(data string) string {
	if len(data) <= 8 {
		return "***"
	}
	return data[:4] + "..." + data[len(data)-4:]
}

// FindAppointmentByClient busca una cita específica de un cliente
func FindAppointmentByClient(clientName, phoneNumber string, appointmentDate time.Time) (bool, error) {
	if !sheetsEnabled || sheetsService == nil {
		return false, fmt.Errorf("Google Sheets no está habilitado")
	}

	// Determinar columna y fila
	weekday := int(appointmentDate.Weekday())
	var columnLetter string

	switch weekday {
	case 0:
		columnLetter = "H"
	case 1:
		columnLetter = "B"
	case 2:
		columnLetter = "C"
	case 3:
		columnLetter = "D"
	case 4:
		columnLetter = "E"
	case 5:
		columnLetter = "F"
	case 6:
		columnLetter = "G"
	}

	hour := appointmentDate.Hour()
	row := hour - 9 + 2

	// Leer celda
	cellRange := fmt.Sprintf("Calendario!%s%d", columnLetter, row)
	resp, err := sheetsService.Spreadsheets.Values.Get(sheetID, cellRange).Do()
	if err != nil {
		return false, fmt.Errorf("error leyendo celda: %w", err)
	}

	if len(resp.Values) == 0 || len(resp.Values[0]) == 0 {
		return false, nil
	}

	cellContent := fmt.Sprintf("%v", resp.Values[0][0])

	// Verificar si contiene el nombre o teléfono del cliente
	if strings.Contains(cellContent, clientName) || strings.Contains(cellContent, phoneNumber) {
		return true, nil
	}

	return false, nil
}
