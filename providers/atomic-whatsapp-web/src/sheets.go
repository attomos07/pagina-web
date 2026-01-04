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
	log.Println("")
	log.Println("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
	log.Println("🔧 INICIANDO GOOGLE SHEETS")
	log.Println("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
	log.Println("")

	// PASO 1: Verificar SPREADSHEETID
	spreadsheetID = os.Getenv("SPREADSHEETID")
	log.Println("📋 PASO 1/8: Verificando SPREADSHEETID...")
	if spreadsheetID == "" {
		sheetsEnabled = false
		log.Println("   ❌ SPREADSHEETID no configurado en .env")
		log.Println("   💡 Agrega SPREADSHEETID=tu_id en el archivo .env")
		return fmt.Errorf("SPREADSHEETID no configurado")
	}
	log.Printf("   ✅ SPREADSHEETID encontrado: %s\n", spreadsheetID)
	log.Println("")

	// PASO 2: Verificar archivo google.json
	log.Println("📋 PASO 2/8: Verificando archivo google.json...")
	wd, _ := os.Getwd()
	log.Printf("   📂 Directorio actual: %s\n", wd)

	if _, err := os.Stat("google.json"); os.IsNotExist(err) {
		sheetsEnabled = false
		log.Println("   ❌ Archivo google.json NO encontrado")
		log.Printf("   📂 Buscado en: %s/google.json\n", wd)
		log.Println("   💡 Crea el archivo google.json con tus credenciales OAuth")
		return fmt.Errorf("archivo google.json no encontrado")
	}
	log.Println("   ✅ Archivo google.json existe")
	log.Println("")

	// PASO 3: Leer google.json
	log.Println("📋 PASO 3/8: Leyendo google.json...")
	tokenJSON, err := os.ReadFile("google.json")
	if err != nil {
		sheetsEnabled = false
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
	log.Println("📋 PASO 4/8: Parseando token OAuth...")
	var token oauth2.Token
	if err := json.Unmarshal(tokenJSON, &token); err != nil {
		sheetsEnabled = false
		log.Printf("   ❌ Error parseando token: %v\n", err)
		log.Println("   💡 Verifica que google.json tenga formato JSON válido")

		// Mostrar más contexto del error
		if len(tokenJSON) < 500 {
			log.Printf("   📄 JSON completo: %s\n", string(tokenJSON))
		}
		return fmt.Errorf("error parseando token de google.json: %w", err)
	}
	log.Println("   ✅ Token parseado correctamente")
	log.Println("")

	// PASO 5: Validar token
	log.Println("📋 PASO 5/8: Validando contenido del token...")

	if token.AccessToken == "" {
		sheetsEnabled = false
		log.Println("   ❌ Token no contiene access_token")
		log.Println("   💡 El archivo google.json debe tener un access_token válido")
		return fmt.Errorf("token no contiene access_token válido")
	}

	// Mostrar preview del access token (primeros y últimos caracteres)
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
	log.Println("📋 PASO 6/8: Creando servicio de Google Sheets...")

	ctx := context.Background()

	// Crear token source que maneje el refresh automáticamente
	tokenSource := oauth2.StaticTokenSource(&token)

	// Crear cliente HTTP autenticado con el token
	client := oauth2.NewClient(ctx, tokenSource)

	// Crear servicio de Sheets con el cliente HTTP
	srv, err := sheets.NewService(ctx, option.WithHTTPClient(client))
	if err != nil {
		sheetsEnabled = false
		log.Printf("   ❌ Error creando servicio Sheets: %v\n", err)
		log.Println("   💡 Verifica tu conexión a internet y que el token sea válido")
		return fmt.Errorf("error creando servicio Sheets: %w", err)
	}
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
		log.Println("      O bien:")
		log.Println("      4. Agrega la cuenta de servicio como Editor")
		log.Println("")
		return fmt.Errorf("error accediendo al Spreadsheet: %w", testErr)
	}

	log.Println("   ✅ Acceso de LECTURA verificado")
	if spreadsheet.Properties != nil {
		log.Printf("   📊 Título: %s\n", spreadsheet.Properties.Title)
		log.Printf("   📄 Hojas: %d\n", len(spreadsheet.Sheets))
	}
	log.Println("")

	// PASO 8: Probar permisos de ESCRITURA
	log.Println("📋 PASO 8/8: Probando permisos de ESCRITURA...")
	log.Println("   🧪 Intentando escribir una celda de prueba...")

	testCellRange := "Sheet1!Z1000" // Celda lejana para no molestar
	testValue := [][]interface{}{{"TEST_PERMISOS"}}
	testValueRange := &sheets.ValueRange{Values: testValue}

	_, writeErr := srv.Spreadsheets.Values.Update(
		spreadsheetID,
		testCellRange,
		testValueRange,
	).ValueInputOption("USER_ENTERED").Do()

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
		log.Println("      5. Reinicia el bot: systemctl restart atomic-bot-109")
		log.Println("")
		return fmt.Errorf("sin permisos de escritura en el Spreadsheet")
	}

	// Limpiar la celda de prueba
	clearValue := [][]interface{}{{""}}
	clearValueRange := &sheets.ValueRange{Values: clearValue}
	srv.Spreadsheets.Values.Update(
		spreadsheetID,
		testCellRange,
		clearValueRange,
	).ValueInputOption("USER_ENTERED").Do()

	log.Println("   ✅ Permisos de ESCRITURA verificados")
	log.Println("   🧹 Celda de prueba limpiada")
	log.Println("")

	sheetsService = srv
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

	log.Println("📝 CONTENIDO A ESCRIBIR:")
	log.Println("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
	log.Println(infoCita)
	log.Println("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
	log.Println("")

	// Si la celda ya tiene contenido, agregar separador
	if len(contenidoActual) > 0 && len(contenidoActual[0]) > 0 {
		contenidoExistente := fmt.Sprintf("%v", contenidoActual[0][0])
		if strings.TrimSpace(contenidoExistente) != "" {
			log.Println("⚠️  Celda ya ocupada, agregando segunda cita con separador...")
			infoCita = contenidoExistente + "\n\n---\n\n" + infoCita
		}
	}

	// Escribir en la celda
	log.Println("🔄 PASO 6: Escribiendo en Google Sheets...")
	if err := WriteToSheet([][]interface{}{{infoCita}}, celdaRango); err != nil {
		log.Println("")
		log.Println("╔════════════════════════════════════════════════════════╗")
		log.Println("║                                                        ║")
		log.Println("║        ❌ ERROR GUARDANDO EN SHEETS                    ║")
		log.Println("║                                                        ║")
		log.Println("╚════════════════════════════════════════════════════════╝")
		log.Printf("❌ ERROR: %v\n", err)
		log.Printf("   📍 Celda: %s\n", celdaRango)
		log.Printf("   📅 Día: %s\n", dia)
		log.Printf("   ⏰ Hora: %s\n", horaNormalizada)
		log.Println("")
		return fmt.Errorf("error guardando en Sheets: %w", err)
	}

	log.Println("")
	log.Println("╔════════════════════════════════════════════════════════╗")
	log.Println("║                                                        ║")
	log.Println("║      ✅ CITA GUARDADA EN SHEETS EXITOSAMENTE           ║")
	log.Println("║                                                        ║")
	log.Println("╚════════════════════════════════════════════════════════╝")
	log.Println("")
	log.Println("📊 RESUMEN:")
	log.Println("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
	log.Printf("   📍 Celda: %s\n", celdaRango)
	log.Printf("   📅 Día: %s\n", dia)
	log.Printf("   ⏰ Hora: %s\n", horaNormalizada)
	log.Printf("   📅 Fecha: %s\n", fechaExacta)
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
