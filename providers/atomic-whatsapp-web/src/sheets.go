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
	"google.golang.org/api/option"
	"google.golang.org/api/sheets/v4"
)

var sheetsService *sheets.Service
var spreadsheetID string
var sheetsEnabled bool

// InitSheets inicializa el servicio de Google Sheets usando OAuth token
func InitSheets() error {
	spreadsheetID = os.Getenv("SPREADSHEETID")
	if spreadsheetID == "" {
		sheetsEnabled = false
		return fmt.Errorf("SPREADSHEETID no configurado")
	}

	// Verificar credenciales
	if _, err := os.Stat("google.json"); os.IsNotExist(err) {
		sheetsEnabled = false
		return fmt.Errorf("archivo google.json no encontrado")
	}

	// Leer el archivo google.json (que contiene el OAuth token)
	tokenJSON, err := os.ReadFile("google.json")
	if err != nil {
		sheetsEnabled = false
		return fmt.Errorf("error leyendo google.json: %w", err)
	}

	// Intentar parsear como OAuth token
	var token oauth2.Token
	if err := json.Unmarshal(tokenJSON, &token); err != nil {
		sheetsEnabled = false
		return fmt.Errorf("error parseando token de google.json: %w", err)
	}

	// Validar que el token tenga access_token
	if token.AccessToken == "" {
		sheetsEnabled = false
		return fmt.Errorf("token no contiene access_token válido")
	}

	ctx := context.Background()

	// Crear token source que maneje el refresh automáticamente
	tokenSource := oauth2.StaticTokenSource(&token)

	// Crear cliente HTTP autenticado con el token
	client := oauth2.NewClient(ctx, tokenSource)

	// Crear servicio de Sheets con el cliente HTTP
	srv, err := sheets.NewService(ctx, option.WithHTTPClient(client))
	if err != nil {
		sheetsEnabled = false
		return fmt.Errorf("error creando servicio Sheets: %w", err)
	}

	sheetsService = srv
	sheetsEnabled = true

	log.Println("✅ Google Sheets inicializado correctamente")
	return nil
}

// IsSheetsEnabled verifica si Sheets está habilitado
func IsSheetsEnabled() bool {
	return sheetsEnabled
}

// WriteToSheet escribe datos en una posición específica
func WriteToSheet(values [][]interface{}, rangeStr string) error {
	if !sheetsEnabled {
		return fmt.Errorf("Google Sheets no habilitado")
	}

	log.Printf("📝 WriteToSheet: Escribiendo en rango %s\n", rangeStr)

	valueRange := &sheets.ValueRange{
		Values: values,
	}

	_, err := sheetsService.Spreadsheets.Values.Update(
		spreadsheetID,
		rangeStr,
		valueRange,
	).ValueInputOption("USER_ENTERED").Do()

	if err != nil {
		log.Printf("❌ WriteToSheet ERROR: %v\n", err)
		return fmt.Errorf("error escribiendo en Sheets: %w", err)
	}

	log.Printf("✅ WriteToSheet EXITOSO: Datos escritos en %s\n", rangeStr)
	return nil
}

// ReadSheet lee datos de Google Sheets
func ReadSheet(rangeStr string) ([][]interface{}, error) {
	if !sheetsEnabled {
		return nil, fmt.Errorf("Google Sheets no habilitado")
	}

	log.Printf("📖 ReadSheet: Leyendo rango %s\n", rangeStr)

	resp, err := sheetsService.Spreadsheets.Values.Get(spreadsheetID, rangeStr).Do()
	if err != nil {
		log.Printf("❌ ReadSheet ERROR: %v\n", err)
		return nil, fmt.Errorf("error leyendo Sheets: %w", err)
	}

	log.Printf("✅ ReadSheet EXITOSO: %d filas leídas\n", len(resp.Values))
	return resp.Values, nil
}

// InitializeWeeklyCalendar inicializa el calendario semanal con la estructura correcta
func InitializeWeeklyCalendar() error {
	if !sheetsEnabled {
		return fmt.Errorf("Google Sheets no habilitado")
	}

	log.Println("🗓️ Inicializando calendario semanal...")

	// Verificar si ya existe
	existingData, err := ReadSheet("Sheet1!A1:H1")
	if err == nil && len(existingData) > 0 && len(existingData[0]) > 1 {
		log.Println("ℹ️  Calendario semanal ya existe")
		return nil
	}

	// Crear encabezados: Hora | Lunes | Martes | Miércoles | Jueves | Viernes | Sábado | Domingo
	headers := []interface{}{"Hora", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"}

	if err := WriteToSheet([][]interface{}{headers}, "Sheet1!A1:H1"); err != nil {
		return fmt.Errorf("error creando encabezados: %w", err)
	}

	// Crear filas de horarios
	var horariosData [][]interface{}
	for _, hora := range HORARIOS {
		row := []interface{}{hora, "", "", "", "", "", "", ""}
		horariosData = append(horariosData, row)
	}

	rangeStr := fmt.Sprintf("Sheet1!A2:H%d", len(HORARIOS)+1)
	if err := WriteToSheet(horariosData, rangeStr); err != nil {
		return fmt.Errorf("error creando filas de horarios: %w", err)
	}

	log.Println("✅ Calendario semanal inicializado correctamente")
	log.Printf("   📊 Horarios: %d slots desde %s hasta %s", len(HORARIOS), HORARIOS[0], HORARIOS[len(HORARIOS)-1])
	log.Printf("   📅 Días: Lunes a Domingo (columnas B-H)")

	return nil
}

// SaveAppointmentToCalendar guarda una cita en el calendario semanal
func SaveAppointmentToCalendar(data map[string]string) error {
	if !sheetsEnabled {
		log.Println("⚠️  Google Sheets NO HABILITADO - Saltando guardado")
		return nil
	}

	log.Println("")
	log.Println("╔════════════════════════════════════════════════════════╗")
	log.Println("║                                                        ║")
	log.Println("║       📊 GUARDANDO EN GOOGLE SHEETS - INICIO           ║")
	log.Println("║                                                        ║")
	log.Println("╚════════════════════════════════════════════════════════╝")
	log.Println("")

	log.Println("📋 DATOS RECIBIDOS PARA GUARDAR:")
	log.Println("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
	for key, value := range data {
		log.Printf("   %s: %s\n", key, value)
	}
	log.Println("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
	log.Println("")

	// Convertir fecha a día de semana y calcular fecha exacta
	log.Println("🔄 PASO 1: Convirtiendo fecha a día de semana...")
	dia, fechaExacta, err := ConvertirFechaADia(data["fecha"])
	if err != nil {
		log.Println("❌ ERROR en conversión de fecha:")
		log.Printf("   📅 Fecha original: %s\n", data["fecha"])
		log.Printf("   ⚠️  Error: %v\n", err)
		return fmt.Errorf("error convirtiendo fecha: %w", err)
	}

	log.Println("✅ Conversión de fecha exitosa:")
	log.Printf("   📅 Fecha original: %s\n", data["fecha"])
	log.Printf("   📅 Día de la semana: %s\n", dia)
	log.Printf("   📅 Fecha exacta calculada: %s\n", fechaExacta)
	log.Println("")

	// Normalizar hora
	log.Println("🔄 PASO 2: Normalizando hora...")
	horaNormalizada, err := NormalizarHora(data["hora"])
	if err != nil {
		log.Println("❌ ERROR en normalización de hora:")
		log.Printf("   ⏰ Hora original: %s\n", data["hora"])
		log.Printf("   ⚠️  Error: %v\n", err)
		return fmt.Errorf("error normalizando hora: %w", err)
	}

	log.Println("✅ Normalización de hora exitosa:")
	log.Printf("   ⏰ Hora original: %s\n", data["hora"])
	log.Printf("   ⏰ Hora normalizada: %s\n", horaNormalizada)
	log.Println("")

	// Obtener columna del día
	log.Println("🔄 PASO 3: Obteniendo columna del día...")
	columna, exists := COLUMNAS_DIAS[dia]
	if !exists {
		log.Println("❌ ERROR: Día no válido")
		log.Printf("   ❌ Día recibido: %s\n", dia)
		log.Printf("   💡 Días disponibles: %v\n", getDiasDisponibles())
		return fmt.Errorf("día no válido: %s", dia)
	}

	log.Println("✅ Columna obtenida:")
	log.Printf("   📍 Día: %s\n", dia)
	log.Printf("   📍 Columna: %s\n", columna)
	log.Println("")

	// Obtener fila de la hora
	log.Println("🔄 PASO 4: Obteniendo fila de la hora...")
	fila := GetFilaHora(horaNormalizada)
	if fila == -1 {
		log.Println("❌ ERROR: Hora no válida")
		log.Printf("   ❌ Hora recibida: %s\n", horaNormalizada)
		log.Printf("   💡 Horas disponibles: %v\n", HORARIOS)
		return fmt.Errorf("hora no válida: %s", horaNormalizada)
	}

	log.Println("✅ Fila obtenida:")
	log.Printf("   ⏰ Hora: %s\n", horaNormalizada)
	log.Printf("   📍 Fila: %d\n", fila)
	log.Println("")

	// Calcular celda objetivo
	celdaRango := fmt.Sprintf("Sheet1!%s%d", columna, fila)
	log.Println("🎯 CELDA OBJETIVO CALCULADA:")
	log.Printf("   📍 Celda: %s\n", celdaRango)
	log.Printf("   📅 Día: %s (columna %s)\n", dia, columna)
	log.Printf("   ⏰ Hora: %s (fila %d)\n", horaNormalizada, fila)
	log.Println("")

	// Leer contenido actual de la celda
	log.Println("🔄 PASO 5: Leyendo contenido actual de la celda...")
	contenidoActual, err := ReadSheet(celdaRango)
	if err != nil {
		log.Printf("⚠️  Advertencia leyendo celda: %v (probablemente está vacía)\n", err)
	}

	// Formatear información de la cita con TODOS los datos importantes
	infoCita := fmt.Sprintf("👤 %s\n📞 %s\n✂️ %s\n💈 Barbero: %s\n📅 %s",
		data["nombre"],
		data["telefono"],
		data["servicio"],
		data["barbero"],
		fechaExacta,
	)

	log.Println("📝 INFORMACIÓN DE LA CITA A GUARDAR:")
	log.Println("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
	log.Println(infoCita)
	log.Println("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
	log.Println("")

	var contenidoFinal string
	if len(contenidoActual) > 0 && len(contenidoActual[0]) > 0 {
		// Ya hay contenido, agregar separador
		existente := fmt.Sprintf("%v", contenidoActual[0][0])
		if strings.TrimSpace(existente) != "" {
			contenidoFinal = fmt.Sprintf("%s\n\n---\n\n%s", existente, infoCita)
			log.Println("ℹ️  La celda ya tiene contenido - Agregando nueva cita con separador")
			log.Println("📄 Contenido existente:")
			log.Println(existente)
		} else {
			contenidoFinal = infoCita
			log.Println("ℹ️  Celda vacía - Creando primera cita")
		}
	} else {
		contenidoFinal = infoCita
		log.Println("ℹ️  Celda vacía - Creando primera cita")
	}
	log.Println("")

	// Guardar en la celda específica
	log.Println("🔄 PASO 6: Escribiendo en Google Sheets...")
	log.Printf("   🎯 Escribiendo en celda: %s\n", celdaRango)

	if err := WriteToSheet([][]interface{}{{contenidoFinal}}, celdaRango); err != nil {
		log.Println("")
		log.Println("╔════════════════════════════════════════════════════════╗")
		log.Println("║                                                        ║")
		log.Println("║         ❌ ERROR GUARDANDO EN SHEETS                   ║")
		log.Println("║                                                        ║")
		log.Println("╚════════════════════════════════════════════════════════╝")
		log.Printf("❌ ERROR: %v\n", err)
		log.Printf("   📍 Celda: %s\n", celdaRango)
		log.Println("")
		return fmt.Errorf("error escribiendo en Sheets: %w", err)
	}

	log.Println("")
	log.Println("╔════════════════════════════════════════════════════════╗")
	log.Println("║                                                        ║")
	log.Println("║       ✅ CITA GUARDADA EN SHEETS EXITOSAMENTE          ║")
	log.Println("║                                                        ║")
	log.Println("╚════════════════════════════════════════════════════════╝")
	log.Println("")
	log.Println("📊 RESUMEN DEL GUARDADO:")
	log.Println("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
	log.Printf("   📍 Celda: %s\n", celdaRango)
	log.Printf("   📅 Día: %s\n", dia)
	log.Printf("   ⏰ Hora: %s\n", horaNormalizada)
	log.Printf("   📆 Fecha exacta: %s\n", fechaExacta)
	log.Printf("   👤 Cliente: %s\n", data["nombre"])
	log.Printf("   📞 Teléfono: %s\n", data["telefono"])
	log.Printf("   ✂️  Servicio: %s\n", data["servicio"])
	log.Printf("   💈 Barbero: %s\n", data["barbero"])
	log.Println("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
	log.Println("")

	return nil
}

// getDiasDisponibles retorna la lista de días disponibles
func getDiasDisponibles() []string {
	dias := make([]string, 0, len(COLUMNAS_DIAS))
	for dia := range COLUMNAS_DIAS {
		dias = append(dias, dia)
	}
	return dias
}

// GetAppointmentsByDay obtiene las citas de un día específico
func GetAppointmentsByDay(dia string) ([]map[string]interface{}, error) {
	if !sheetsEnabled {
		return nil, fmt.Errorf("Google Sheets no habilitado")
	}

	diaLower := NormalizeText(dia)
	columna, exists := COLUMNAS_DIAS[diaLower]
	if !exists {
		return nil, fmt.Errorf("día no válido: %s", dia)
	}

	// Leer toda la columna del día
	rangeStr := fmt.Sprintf("Sheet1!%s2:%s%d", columna, columna, len(HORARIOS)+1)
	data, err := ReadSheet(rangeStr)
	if err != nil {
		return nil, err
	}

	var citas []map[string]interface{}
	for i, row := range data {
		if len(row) > 0 {
			contenido := fmt.Sprintf("%v", row[0])
			if strings.TrimSpace(contenido) != "" {
				citas = append(citas, map[string]interface{}{
					"hora":      HORARIOS[i],
					"contenido": contenido,
					"dia":       dia,
				})
			}
		}
	}

	log.Printf("📅 Citas encontradas para %s: %d\n", dia, len(citas))
	return citas, nil
}

// GetCalendarStats obtiene estadísticas del calendario
func GetCalendarStats() (map[string]interface{}, error) {
	if !sheetsEnabled {
		return nil, fmt.Errorf("Google Sheets no habilitado")
	}

	// Leer todo el calendario
	data, err := ReadSheet(fmt.Sprintf("Sheet1!B2:H%d", len(HORARIOS)+1))
	if err != nil {
		return nil, err
	}

	totalCitas := 0
	horasOcupadas := 0
	citasPorDia := make(map[string]int)

	// Inicializar contadores
	for _, dia := range DIAS_SEMANA {
		citasPorDia[dia] = 0
	}

	// Contar citas
	for _, row := range data {
		for j := 0; j < len(row) && j < len(DIAS_SEMANA); j++ {
			contenido := fmt.Sprintf("%v", row[j])
			if strings.TrimSpace(contenido) != "" {
				horasOcupadas++
				// Contar cuántas citas hay en esta celda (por el separador "---")
				numeroCitas := strings.Count(contenido, "👤") // Cada cita tiene un emoji de persona
				totalCitas += numeroCitas
				citasPorDia[DIAS_SEMANA[j]] += numeroCitas
			}
		}
	}

	totalHoras := len(HORARIOS) * 7
	horasLibres := totalHoras - horasOcupadas

	stats := map[string]interface{}{
		"totalCitas":          totalCitas,
		"horasOcupadas":       horasOcupadas,
		"horasLibres":         horasLibres,
		"citasPorDia":         citasPorDia,
		"porcentajeOcupacion": float64(horasOcupadas) / float64(totalHoras) * 100,
	}

	return stats, nil
}

// ClearAppointment limpia una cita específica
func ClearAppointment(dia string, hora string) error {
	if !sheetsEnabled {
		return fmt.Errorf("Google Sheets no habilitado")
	}

	diaLower := NormalizeText(dia)
	columna, exists := COLUMNAS_DIAS[diaLower]
	if !exists {
		return fmt.Errorf("día no válido: %s", dia)
	}

	horaNormalizada, err := NormalizarHora(hora)
	if err != nil {
		return fmt.Errorf("error normalizando hora: %w", err)
	}

	fila := GetFilaHora(horaNormalizada)
	if fila == -1 {
		return fmt.Errorf("hora no válida: %s", horaNormalizada)
	}

	celdaRango := fmt.Sprintf("Sheet1!%s%d", columna, fila)

	if err := WriteToSheet([][]interface{}{{""}}, celdaRango); err != nil {
		return fmt.Errorf("error limpiando celda: %w", err)
	}

	log.Printf("✅ Cita eliminada: %s a las %s (celda %s)\n", dia, horaNormalizada, celdaRango)
	return nil
}

// ExportWeeklyCalendar exporta el calendario completo en formato legible
func ExportWeeklyCalendar() (string, error) {
	if !sheetsEnabled {
		return "", fmt.Errorf("Google Sheets no habilitado")
	}

	data, err := ReadSheet(fmt.Sprintf("Sheet1!A1:H%d", len(HORARIOS)+1))
	if err != nil {
		return "", fmt.Errorf("error leyendo calendario: %w", err)
	}

	if len(data) == 0 {
		return "Calendario vacío", nil
	}

	var calendario strings.Builder
	calendario.WriteString("CALENDARIO SEMANAL\n")
	calendario.WriteString("═══════════════════════════════════════════\n\n")

	// Encabezados
	if len(data) > 0 {
		for i, header := range data[0] {
			if i > 0 {
				calendario.WriteString("\t")
			}
			calendario.WriteString(fmt.Sprintf("%v", header))
		}
		calendario.WriteString("\n")
		calendario.WriteString(strings.Repeat("─", 80))
		calendario.WriteString("\n")
	}

	// Filas de datos
	for i := 1; i < len(data); i++ {
		row := data[i]
		for j, cell := range row {
			if j > 0 {
				calendario.WriteString("\t")
			}
			cellStr := fmt.Sprintf("%v", cell)
			// Truncar contenido largo para visualización
			if len(cellStr) > 30 {
				cellStr = cellStr[:27] + "..."
			}
			calendario.WriteString(cellStr)
		}
		calendario.WriteString("\n")
	}

	return calendario.String(), nil
}

// VerifyCalendarStructure verifica que el calendario tenga la estructura correcta
func VerifyCalendarStructure() error {
	if !sheetsEnabled {
		return fmt.Errorf("Google Sheets no habilitado")
	}

	log.Println("🔍 Verificando estructura del calendario...")

	// Verificar encabezados
	headers, err := ReadSheet("Sheet1!A1:H1")
	if err != nil {
		return fmt.Errorf("error leyendo encabezados: %w", err)
	}

	if len(headers) == 0 || len(headers[0]) != 8 {
		return fmt.Errorf("estructura de encabezados incorrecta")
	}

	expectedHeaders := []string{"Hora", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"}
	for i, expected := range expectedHeaders {
		if fmt.Sprintf("%v", headers[0][i]) != expected {
			return fmt.Errorf("encabezado incorrecto en columna %d: esperado '%s', encontrado '%v'",
				i+1, expected, headers[0][i])
		}
	}

	log.Println("   ✅ Encabezados correctos")

	// Verificar horarios
	horariosData, err := ReadSheet(fmt.Sprintf("Sheet1!A2:A%d", len(HORARIOS)+1))
	if err != nil {
		return fmt.Errorf("error leyendo horarios: %w", err)
	}

	if len(horariosData) != len(HORARIOS) {
		return fmt.Errorf("número incorrecto de horarios: esperado %d, encontrado %d",
			len(HORARIOS), len(horariosData))
	}

	for i, hora := range HORARIOS {
		if len(horariosData[i]) == 0 || fmt.Sprintf("%v", horariosData[i][0]) != hora {
			return fmt.Errorf("horario incorrecto en fila %d: esperado '%s', encontrado '%v'",
				i+2, hora, horariosData[i][0])
		}
	}

	log.Println("   ✅ Horarios correctos")
	log.Printf("✅ Estructura del calendario verificada correctamente")
	log.Printf("   📊 %d horarios configurados", len(HORARIOS))
	log.Printf("   📅 7 días de la semana")

	return nil
}

// GetCurrentWeekRange obtiene el rango de fechas de la semana actual
func GetCurrentWeekRange() (time.Time, time.Time) {
	now := time.Now()

	// Obtener el lunes de esta semana
	weekday := now.Weekday()
	daysToMonday := int(weekday) - 1
	if weekday == time.Sunday {
		daysToMonday = -6
	}

	monday := now.AddDate(0, 0, -daysToMonday)
	monday = time.Date(monday.Year(), monday.Month(), monday.Day(), 0, 0, 0, 0, monday.Location())

	// El domingo es 6 días después del lunes
	sunday := monday.AddDate(0, 0, 6)
	sunday = time.Date(sunday.Year(), sunday.Month(), sunday.Day(), 23, 59, 59, 0, sunday.Location())

	return monday, sunday
}

// GetWeekInfo obtiene información sobre la semana actual
func GetWeekInfo() string {
	monday, sunday := GetCurrentWeekRange()

	return fmt.Sprintf("Semana del %s al %s",
		monday.Format("02/01/2006"),
		sunday.Format("02/01/2006"))
}
