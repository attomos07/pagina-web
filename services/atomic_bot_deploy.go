package services

import (
	"attomos/models"
	"encoding/json"
	"fmt"
	"io/ioutil"
	"log"
	"path/filepath"
	"strings"
	"time"

	"github.com/pkg/sftp"
	"golang.org/x/crypto/ssh"
)

type AtomicBotDeployService struct {
	serverIP       string
	serverPassword string
	sshClient      *ssh.Client
	sftpClient     *sftp.Client
}

// BusinessConfig estructura para generar business_config.json
type BusinessConfig struct {
	AgentName    string      `json:"agentName"`
	BusinessType string      `json:"businessType"`
	PhoneNumber  string      `json:"phoneNumber"`
	Personality  Personality `json:"personality"`
	Schedule     Schedule    `json:"schedule"`
	Holidays     []Holiday   `json:"holidays"`
	Services     []Service   `json:"services"`
	Workers      []Worker    `json:"workers"`
	Location     Location    `json:"location"`
	SocialMedia  SocialMedia `json:"socialMedia"`
}

type Personality struct {
	Tone                string   `json:"tone"`
	CustomTone          string   `json:"customTone,omitempty"`
	AdditionalLanguages []string `json:"additionalLanguages"`
}

type Schedule struct {
	Monday    DaySchedule `json:"monday"`
	Tuesday   DaySchedule `json:"tuesday"`
	Wednesday DaySchedule `json:"wednesday"`
	Thursday  DaySchedule `json:"thursday"`
	Friday    DaySchedule `json:"friday"`
	Saturday  DaySchedule `json:"saturday"`
	Sunday    DaySchedule `json:"sunday"`
	Timezone  string      `json:"timezone"`
}

type DaySchedule struct {
	Open  bool   `json:"open"`
	Start string `json:"start"`
	End   string `json:"end"`
}

type Holiday struct {
	Date string `json:"date"`
	Name string `json:"name"`
}

type Service struct {
	Title         string  `json:"title"`
	Description   string  `json:"description"`
	PriceType     string  `json:"priceType"`
	Price         float64 `json:"price,omitempty"`
	OriginalPrice float64 `json:"originalPrice,omitempty"`
	PromoPrice    float64 `json:"promoPrice,omitempty"`
}

type Worker struct {
	Name      string   `json:"name"`
	StartTime string   `json:"startTime"`
	EndTime   string   `json:"endTime"`
	Days      []string `json:"days"`
}

type Location struct {
	Address        string `json:"address"`
	Number         string `json:"number"`
	Neighborhood   string `json:"neighborhood"`
	City           string `json:"city"`
	State          string `json:"state"`
	Country        string `json:"country"`
	PostalCode     string `json:"postalCode"`
	BetweenStreets string `json:"betweenStreets"`
}

type SocialMedia struct {
	Facebook  string `json:"facebook"`
	Instagram string `json:"instagram"`
	Twitter   string `json:"twitter"`
	LinkedIn  string `json:"linkedin"`
}

// NewAtomicBotDeployService crea instancia del servicio
func NewAtomicBotDeployService(serverIP, serverPassword string) *AtomicBotDeployService {
	return &AtomicBotDeployService{
		serverIP:       serverIP,
		serverPassword: serverPassword,
	}
}

// Connect conecta al servidor vía SSH y SFTP
func (s *AtomicBotDeployService) Connect() error {
	config := &ssh.ClientConfig{
		User: "root",
		Auth: []ssh.AuthMethod{
			ssh.Password(s.serverPassword),
		},
		HostKeyCallback: ssh.InsecureIgnoreHostKey(),
		Timeout:         30 * time.Second,
	}

	client, err := ssh.Dial("tcp", s.serverIP+":22", config)
	if err != nil {
		return fmt.Errorf("error conectando SSH: %w", err)
	}
	s.sshClient = client

	sftpClient, err := sftp.NewClient(client)
	if err != nil {
		s.sshClient.Close()
		return fmt.Errorf("error conectando SFTP: %w", err)
	}
	s.sftpClient = sftpClient

	return nil
}

// Close cierra conexiones SSH y SFTP
func (s *AtomicBotDeployService) Close() {
	if s.sftpClient != nil {
		s.sftpClient.Close()
	}
	if s.sshClient != nil {
		s.sshClient.Close()
	}
}

// UpdateGoogleIntegrationEnv actualiza las variables de entorno de Google Calendar y Sheets
func (s *AtomicBotDeployService) UpdateGoogleIntegrationEnv(agent *models.Agent) error {
	log.Printf("🔄 [Agent %d] Actualizando variables de entorno de Google...", agent.ID)

	botDir := fmt.Sprintf("/home/user_%d/atomic-bot", agent.UserID)
	envPath := fmt.Sprintf("%s/.env", botDir)

	// Leer .env actual
	envFile, err := s.sftpClient.Open(envPath)
	if err != nil {
		return fmt.Errorf("error abriendo .env: %w", err)
	}
	defer envFile.Close()

	currentContent, err := ioutil.ReadAll(envFile)
	if err != nil {
		return fmt.Errorf("error leyendo .env: %w", err)
	}

	lines := strings.Split(string(currentContent), "\n")
	updatedLines := make([]string, 0)
	hasSpreadsheetID := false
	hasCalendarID := false

	// Actualizar líneas existentes
	for _, line := range lines {
		trimmedLine := strings.TrimSpace(line)

		// Actualizar SPREADSHEETID si existe
		if strings.HasPrefix(trimmedLine, "SPREADSHEETID") && agent.GoogleSheetID != "" {
			updatedLines = append(updatedLines, fmt.Sprintf("SPREADSHEETID=%s", agent.GoogleSheetID))
			hasSpreadsheetID = true
			log.Printf("   ✅ SPREADSHEETID actualizado: %s", agent.GoogleSheetID)
			continue
		}

		// Actualizar GOOGLE_CALENDAR_ID si existe
		if strings.HasPrefix(trimmedLine, "GOOGLE_CALENDAR_ID") && agent.GoogleCalendarID != "" {
			updatedLines = append(updatedLines, fmt.Sprintf("GOOGLE_CALENDAR_ID=%s", agent.GoogleCalendarID))
			hasCalendarID = true
			log.Printf("   ✅ GOOGLE_CALENDAR_ID actualizado: %s", agent.GoogleCalendarID)
			continue
		}

		// Mantener línea original si no es una que estamos actualizando
		updatedLines = append(updatedLines, line)
	}

	// Agregar variables si no existían
	if !hasSpreadsheetID && agent.GoogleSheetID != "" {
		// Buscar sección de Google Sheets
		insertIndex := -1
		for i, line := range updatedLines {
			if strings.Contains(line, "Integracion Con Google Sheets") {
				insertIndex = i + 1
				break
			}
		}

		if insertIndex == -1 {
			// No existe la sección, agregarla al final
			updatedLines = append(updatedLines, "")
			updatedLines = append(updatedLines, "#Integracion Con Google Sheets Para Agendamiento")
			updatedLines = append(updatedLines, fmt.Sprintf("SPREADSHEETID=%s", agent.GoogleSheetID))
		} else {
			// Insertar en la posición correcta
			newLines := make([]string, 0, len(updatedLines)+1)
			newLines = append(newLines, updatedLines[:insertIndex]...)
			newLines = append(newLines, fmt.Sprintf("SPREADSHEETID=%s", agent.GoogleSheetID))
			newLines = append(newLines, updatedLines[insertIndex:]...)
			updatedLines = newLines
		}
		log.Printf("   ✅ SPREADSHEETID agregado: %s", agent.GoogleSheetID)
	}

	if !hasCalendarID && agent.GoogleCalendarID != "" {
		// Buscar sección de Google Calendar
		insertIndex := -1
		for i, line := range updatedLines {
			if strings.Contains(line, "Integracion Con Google Calendar") {
				insertIndex = i + 1
				break
			}
		}

		if insertIndex == -1 {
			// No existe la sección, agregarla al final
			updatedLines = append(updatedLines, "")
			updatedLines = append(updatedLines, "#Integracion Con Google Calendar Para Agendar Los Eventos")
			updatedLines = append(updatedLines, fmt.Sprintf("GOOGLE_CALENDAR_ID=%s", agent.GoogleCalendarID))
		} else {
			// Insertar en la posición correcta
			newLines := make([]string, 0, len(updatedLines)+1)
			newLines = append(newLines, updatedLines[:insertIndex]...)
			newLines = append(newLines, fmt.Sprintf("GOOGLE_CALENDAR_ID=%s", agent.GoogleCalendarID))
			newLines = append(newLines, updatedLines[insertIndex:]...)
			updatedLines = newLines
		}
		log.Printf("   ✅ GOOGLE_CALENDAR_ID agregado: %s", agent.GoogleCalendarID)
	}

	// Escribir .env actualizado
	newContent := strings.Join(updatedLines, "\n")

	// Crear archivo temporal
	tmpEnvFile, err := s.sftpClient.Create(envPath + ".tmp")
	if err != nil {
		return fmt.Errorf("error creando archivo temporal: %w", err)
	}

	if _, err := tmpEnvFile.Write([]byte(newContent)); err != nil {
		tmpEnvFile.Close()
		return fmt.Errorf("error escribiendo archivo temporal: %w", err)
	}
	tmpEnvFile.Close()

	// Reemplazar archivo original
	renameCmd := fmt.Sprintf("mv %s.tmp %s", envPath, envPath)
	if _, err := s.executeCommand(renameCmd); err != nil {
		return fmt.Errorf("error reemplazando .env: %w", err)
	}

	log.Printf("✅ [Agent %d] Variables de entorno de Google actualizadas", agent.ID)
	return nil
}

// UpdateGoogleCredentials actualiza el archivo google.json en el servidor
func (s *AtomicBotDeployService) UpdateGoogleCredentials(agent *models.Agent, googleCredentials []byte) error {
	log.Printf("🔑 [Agent %d] Actualizando credenciales de Google...", agent.ID)

	botDir := fmt.Sprintf("/home/user_%d/atomic-bot", agent.UserID)
	googleJSONPath := fmt.Sprintf("%s/google.json", botDir)

	// Validar que googleCredentials no esté vacío
	if len(googleCredentials) == 0 {
		return fmt.Errorf("credenciales de Google vacías")
	}

	// Crear archivo google.json
	googleJSONFile, err := s.sftpClient.Create(googleJSONPath)
	if err != nil {
		return fmt.Errorf("error creando google.json: %w", err)
	}
	defer googleJSONFile.Close()

	if _, err := googleJSONFile.Write(googleCredentials); err != nil {
		return fmt.Errorf("error escribiendo google.json: %w", err)
	}

	log.Printf("✅ [Agent %d] google.json actualizado correctamente", agent.ID)
	return nil
}

// RestartBotAfterGoogleIntegration reinicia el bot después de actualizar integración de Google
func (s *AtomicBotDeployService) RestartBotAfterGoogleIntegration(agent *models.Agent, googleCredentials []byte) error {
	log.Printf("🔄 [Agent %d] Reiniciando bot después de integración de Google...", agent.ID)

	// 1. Actualizar variables de entorno
	if err := s.UpdateGoogleIntegrationEnv(agent); err != nil {
		return fmt.Errorf("error actualizando .env: %w", err)
	}

	// 2. Actualizar google.json si se proporcionaron nuevas credenciales
	if len(googleCredentials) > 0 {
		if err := s.UpdateGoogleCredentials(agent, googleCredentials); err != nil {
			return fmt.Errorf("error actualizando google.json: %w", err)
		}
	}

	// 3. Reiniciar servicio systemd
	if err := s.RestartBot(agent.ID); err != nil {
		return fmt.Errorf("error reiniciando bot: %w", err)
	}

	log.Printf("✅ [Agent %d] Bot reiniciado con integración de Google", agent.ID)
	return nil
}

// DeployAtomicBot despliega el bot de Go con configuración dinámica
func (s *AtomicBotDeployService) DeployAtomicBot(agent *models.Agent, geminiAPIKey string, googleCredentials []byte) error {
	log.Printf("🚀 [Agent %d] Iniciando despliegue de AtomicBot...", agent.ID)

	botDir := fmt.Sprintf("/home/user_%d/atomic-bot", agent.UserID)

	// PASO 1: Preparar servidor
	log.Printf("📦 [Agent %d] PASO 1/6: Preparando servidor...", agent.ID)
	if err := s.prepareServer(agent.UserID, botDir); err != nil {
		return fmt.Errorf("error preparando servidor: %w", err)
	}

	// PASO 2: Transferir archivos del bot
	log.Printf("📤 [Agent %d] PASO 2/6: Transfiriendo archivos del bot...", agent.ID)
	if err := s.transferBotFiles(agent.UserID, botDir); err != nil {
		return fmt.Errorf("error transfiriendo archivos: %w", err)
	}

	// PASO 3: Configurar entorno
	log.Printf("⚙️  [Agent %d] PASO 3/6: Configurando entorno...", agent.ID)
	if err := s.configureEnvironment(agent, botDir, geminiAPIKey, googleCredentials); err != nil {
		return fmt.Errorf("error configurando entorno: %w", err)
	}

	// PASO 4: Compilar bot
	log.Printf("🔨 [Agent %d] PASO 4/6: Compilando bot en servidor...", agent.ID)
	if err := s.compileBotOnServer(agent.UserID, botDir); err != nil {
		return fmt.Errorf("error compilando bot: %w", err)
	}

	// PASO 5: Crear servicio systemd
	log.Printf("🔧 [Agent %d] PASO 5/6: Creando servicio systemd...", agent.ID)
	if err := s.createSystemdService(agent, botDir); err != nil {
		return fmt.Errorf("error creando servicio: %w", err)
	}

	// PASO 6: Iniciar bot
	log.Printf("▶️  [Agent %d] PASO 6/6: Iniciando AtomicBot...", agent.ID)
	if err := s.startBot(agent.ID); err != nil {
		// Si falla, generar diagnóstico
		log.Printf("❌ [Agent %d] Error iniciando bot, generando diagnóstico...", agent.ID)
		diagnosis := s.DiagnoseBotFailure(agent.ID, agent.UserID)
		log.Printf("\n%s\n", diagnosis)
		return fmt.Errorf("error iniciando bot: %w\n\nDIAGNÓSTICO:\n%s", err, diagnosis)
	}

	log.Printf("✅ [Agent %d] AtomicBot desplegado exitosamente", agent.ID)
	return nil
}

// prepareServer prepara el servidor (instala Go, GCC, crea directorios)
func (s *AtomicBotDeployService) prepareServer(userID uint, botDir string) error {
	// Crear directorios
	log.Printf("   [1/4] Creando directorios...")
	if output, err := s.executeCommand(fmt.Sprintf("mkdir -p %s/src", botDir)); err != nil {
		return fmt.Errorf("error creando directorios: %w\nOutput: %s", err, output)
	}

	// Esperar a que cloud-init libere locks de apt
	log.Printf("   [2/4] Esperando que cloud-init termine...")
	waitCmd := `timeout 300 bash -c 'while fuser /var/lib/dpkg/lock-frontend >/dev/null 2>&1 || fuser /var/lib/apt/lists/lock >/dev/null 2>&1 || fuser /var/lib/dpkg/lock >/dev/null 2>&1; do echo "Esperando locks de apt..."; sleep 5; done'`
	if output, err := s.executeCommand(waitCmd); err != nil {
		log.Printf("   ⚠️  Timeout esperando locks (continuando de todas formas): %v", err)
	} else if strings.TrimSpace(output) != "" {
		log.Printf("   %s", strings.TrimSpace(output))
	}

	// Verificar e instalar GCC/build-essential
	log.Printf("   [3/4] Verificando/instalando GCC...")
	gccCmd := `
	# Esperar locks una vez más antes de apt-get
	timeout 60 bash -c 'while fuser /var/lib/dpkg/lock-frontend >/dev/null 2>&1; do sleep 2; done' || true
	
	if ! command -v gcc &> /dev/null; then
		echo "Instalando build-essential y gcc..."
		
		# Esperar y actualizar apt
		for i in 1 2 3; do
			apt-get update -y 2>&1 && break || {
				echo "Intento $i/3 fallido, esperando 10s..."
				sleep 10
			}
		done
		
		# Esperar y instalar paquetes
		for i in 1 2 3; do
			DEBIAN_FRONTEND=noninteractive apt-get install -y build-essential gcc 2>&1 && break || {
				echo "Intento $i/3 fallido, esperando 10s..."
				sleep 10
			}
		done
		
		echo "Instalación completada"
	else
		echo "GCC ya está instalado"
	fi
	gcc --version`

	output, err := s.executeCommand(gccCmd)
	if strings.TrimSpace(output) != "" {
		log.Printf("   Output: %s", strings.TrimSpace(output))
	}
	if err != nil {
		return fmt.Errorf("error verificando/instalando GCC: %w", err)
	}

	// Instalar Go si no existe
	log.Printf("   [4/4] Verificando/instalando Go...")
	installGoCmd := `
	if ! command -v go &> /dev/null; then
		echo "Descargando Go 1.24..."
		cd /tmp
		wget -q https://go.dev/dl/go1.24.0.linux-amd64.tar.gz 2>&1 || {
			echo "Error descargando Go"
			exit 1
		}
		
		echo "Extrayendo Go..."
		rm -rf /usr/local/go
		tar -C /usr/local -xzf go1.24.0.linux-amd64.tar.gz 2>&1 || {
			echo "Error extrayendo Go"
			exit 1
		}
		
		rm go1.24.0.linux-amd64.tar.gz
		echo "Go instalado correctamente"
	else
		echo "Go ya está instalado"
	fi
	
	export PATH=$PATH:/usr/local/go/bin
	go version`

	output, err = s.executeCommand(installGoCmd)
	if strings.TrimSpace(output) != "" {
		log.Printf("   Output: %s", strings.TrimSpace(output))
	}
	if err != nil {
		return fmt.Errorf("error instalando Go: %w", err)
	}

	log.Printf("   ✅ Servidor preparado correctamente")
	return nil
}

// transferBotFiles transfiere los archivos del bot al servidor
func (s *AtomicBotDeployService) transferBotFiles(userID uint, botDir string) error {
	// Ruta local del código del bot
	localBotPath := "./providers/atomic-whatsapp-web"

	// Archivos y directorios a transferir
	filesToTransfer := []string{
		"go.mod",
		"go.sum",
		"main.go",
		"src",
	}

	for _, file := range filesToTransfer {
		localPath := filepath.Join(localBotPath, file)
		remotePath := filepath.Join(botDir, file)

		info, err := ioutil.ReadDir(localPath)
		if err == nil && len(info) > 0 {
			// Es un directorio
			if err := s.uploadDirectory(localPath, remotePath); err != nil {
				return fmt.Errorf("error subiendo directorio %s: %w", file, err)
			}
			log.Printf("   ✅ Directorio transferido: %s", file)
		} else {
			// Es un archivo
			if err := s.uploadFile(localPath, remotePath); err != nil {
				return fmt.Errorf("error subiendo archivo %s: %w", file, err)
			}
			log.Printf("   ✅ Archivo transferido: %s", file)
		}
	}

	log.Printf("   ✅ Archivos del bot transferidos correctamente")
	return nil
}

// configureEnvironment configura el entorno (.env y business_config.json)
func (s *AtomicBotDeployService) configureEnvironment(agent *models.Agent, botDir, geminiAPIKey string, googleCredentials []byte) error {
	// Generar business_config.json
	businessConfig := s.generateBusinessConfig(agent)
	businessJSON, err := json.MarshalIndent(businessConfig, "", "  ")
	if err != nil {
		return fmt.Errorf("error serializando business_config: %w", err)
	}

	businessConfigPath := fmt.Sprintf("%s/business_config.json", botDir)
	businessConfigFile, err := s.sftpClient.Create(businessConfigPath)
	if err != nil {
		return fmt.Errorf("error creando business_config.json: %w", err)
	}
	defer businessConfigFile.Close()

	if _, err := businessConfigFile.Write(businessJSON); err != nil {
		return fmt.Errorf("error escribiendo business_config.json: %w", err)
	}
	log.Printf("   ✅ business_config.json creado")

	// Generar .env con integración de Google si está disponible
	envContent := s.generateEnvFile(agent, geminiAPIKey)
	envPath := fmt.Sprintf("%s/.env", botDir)
	envFile, err := s.sftpClient.Create(envPath)
	if err != nil {
		return fmt.Errorf("error creando .env: %w", err)
	}
	defer envFile.Close()

	if _, err := envFile.Write([]byte(envContent)); err != nil {
		return fmt.Errorf("error escribiendo .env: %w", err)
	}
	log.Printf("   ✅ .env creado")

	// Crear google.json si hay credenciales
	if len(googleCredentials) > 0 {
		googleJSONPath := fmt.Sprintf("%s/google.json", botDir)
		googleJSONFile, err := s.sftpClient.Create(googleJSONPath)
		if err != nil {
			return fmt.Errorf("error creando google.json: %w", err)
		}
		defer googleJSONFile.Close()

		if _, err := googleJSONFile.Write(googleCredentials); err != nil {
			return fmt.Errorf("error escribiendo google.json: %w", err)
		}
		log.Printf("   ✅ google.json creado")
	}

	log.Printf("   ✅ Entorno configurado correctamente")
	return nil
}

// generateBusinessConfig genera la configuración del negocio
func (s *AtomicBotDeployService) generateBusinessConfig(agent *models.Agent) *BusinessConfig {
	config := &BusinessConfig{
		AgentName:    agent.Name,
		BusinessType: agent.BusinessType,
		PhoneNumber:  agent.PhoneNumber,
		Personality: Personality{
			Tone:                agent.Config.Tone,
			CustomTone:          agent.Config.CustomTone,
			AdditionalLanguages: agent.Config.AdditionalLanguages,
		},
		Schedule: Schedule{
			Monday:    convertDaySchedule(agent.Config.Schedule.Monday),
			Tuesday:   convertDaySchedule(agent.Config.Schedule.Tuesday),
			Wednesday: convertDaySchedule(agent.Config.Schedule.Wednesday),
			Thursday:  convertDaySchedule(agent.Config.Schedule.Thursday),
			Friday:    convertDaySchedule(agent.Config.Schedule.Friday),
			Saturday:  convertDaySchedule(agent.Config.Schedule.Saturday),
			Sunday:    convertDaySchedule(agent.Config.Schedule.Sunday),
			Timezone:  agent.Config.Schedule.Timezone,
		},
		Holidays:    convertHolidays(agent.Config.Holidays),
		Services:    convertServices(agent.Config.Services),
		Workers:     convertWorkers(agent.Config.Workers),
		Location:    Location{},
		SocialMedia: SocialMedia{},
	}

	return config
}

func convertDaySchedule(day models.DaySchedule) DaySchedule {
	return DaySchedule{
		Open:  day.Open,
		Start: day.Start,
		End:   day.End,
	}
}

func convertHolidays(holidays []models.Holiday) []Holiday {
	result := make([]Holiday, len(holidays))
	for i, h := range holidays {
		result[i] = Holiday{
			Date: h.Date,
			Name: h.Name,
		}
	}
	return result
}

func convertServices(services []models.Service) []Service {
	result := make([]Service, len(services))
	for i, s := range services {
		service := Service{
			Title:       s.Title,
			Description: s.Description,
			PriceType:   s.PriceType,
		}

		// Convertir precio - FlexibleString.String() devuelve el string
		if priceStr := s.Price.String(); priceStr != "" {
			// Intentar parsear como float64
			var priceFloat float64
			if _, err := fmt.Sscanf(priceStr, "%f", &priceFloat); err == nil {
				service.Price = priceFloat
			}
		}

		// Convertir precio original si existe
		if s.OriginalPrice != nil {
			if origPriceStr := s.OriginalPrice.String(); origPriceStr != "" {
				var origPriceFloat float64
				if _, err := fmt.Sscanf(origPriceStr, "%f", &origPriceFloat); err == nil {
					service.OriginalPrice = origPriceFloat
				}
			}
		}

		// Convertir precio promocional si existe
		if s.PromoPrice != nil {
			if promoPriceStr := s.PromoPrice.String(); promoPriceStr != "" {
				var promoPriceFloat float64
				if _, err := fmt.Sscanf(promoPriceStr, "%f", &promoPriceFloat); err == nil {
					service.PromoPrice = promoPriceFloat
				}
			}
		}

		result[i] = service
	}
	return result
}

func convertWorkers(workers []models.Staff) []Worker {
	result := make([]Worker, len(workers))
	for i, w := range workers {
		result[i] = Worker{
			Name:      w.Name,
			StartTime: w.StartTime,
			EndTime:   w.EndTime,
			Days:      w.Days,
		}
	}
	return result
}

// generateEnvFile genera el contenido del archivo .env
func (s *AtomicBotDeployService) generateEnvFile(agent *models.Agent, geminiAPIKey string) string {
	var env strings.Builder

	env.WriteString("# Configuración del Bot\n")
	env.WriteString(fmt.Sprintf("AGENT_ID=%d\n", agent.ID))
	env.WriteString(fmt.Sprintf("AGENT_NAME=%s\n", agent.Name))
	env.WriteString(fmt.Sprintf("PHONE_NUMBER=%s\n", agent.PhoneNumber))
	env.WriteString(fmt.Sprintf("PORT=%d\n", agent.Port))
	env.WriteString(fmt.Sprintf("DATABASE_FILE=whatsapp-%d.db\n", agent.ID))
	env.WriteString("\n")

	// API Key de Gemini
	if geminiAPIKey != "" {
		env.WriteString("# Gemini AI\n")
		env.WriteString(fmt.Sprintf("GEMINI_API_KEY=%s\n", geminiAPIKey))
		env.WriteString("\n")
	}

	// Integración de Google Sheets
	if agent.GoogleSheetID != "" {
		env.WriteString("#Integracion Con Google Sheets Para Agendamiento\n")
		env.WriteString(fmt.Sprintf("SPREADSHEETID=%s\n", agent.GoogleSheetID))
		env.WriteString("\n")
	} else {
		env.WriteString("#Integracion Con Google Sheets Para Agendamiento\n")
		env.WriteString("#SPREADSHEETID=\n")
		env.WriteString("\n")
	}

	// Integración de Google Calendar
	if agent.GoogleCalendarID != "" {
		env.WriteString("#Integracion Con Google Calendar Para Agendar Los Eventos\n")
		env.WriteString(fmt.Sprintf("GOOGLE_CALENDAR_ID=%s\n", agent.GoogleCalendarID))
		env.WriteString("\n")
	} else {
		env.WriteString("#Integracion Con Google Calendar Para Agendar Los Eventos\n")
		env.WriteString("#GOOGLE_CALENDAR_ID=\n")
		env.WriteString("\n")
	}

	return env.String()
}

// compileBotOnServer compila el bot en el servidor
func (s *AtomicBotDeployService) compileBotOnServer(userID uint, botDir string) error {
	compileCmd := fmt.Sprintf(`
	export PATH=$PATH:/usr/local/go/bin
	export HOME=/root
	cd %s
	
	echo "Inicializando módulo Go..."
	go mod tidy 2>&1 || {
		echo "Error en go mod tidy"
		exit 1
	}
	
	echo "Compilando bot..."
	go build -o atomic-bot main.go 2>&1 || {
		echo "Error compilando bot"
		exit 1
	}
	
	chmod +x atomic-bot
	echo "Compilación exitosa"
	ls -lh atomic-bot`, botDir)

	output, err := s.executeCommand(compileCmd)
	if strings.TrimSpace(output) != "" {
		log.Printf("   Output compilación:\n%s", strings.TrimSpace(output))
	}
	if err != nil {
		return fmt.Errorf("error compilando: %w", err)
	}

	log.Printf("   ✅ Bot compilado exitosamente")
	return nil
}

// createSystemdService crea el servicio systemd para el bot
func (s *AtomicBotDeployService) createSystemdService(agent *models.Agent, botDir string) error {
	serviceName := fmt.Sprintf("atomic-bot-%d", agent.ID)
	serviceContent := fmt.Sprintf(`[Unit]
Description=AtomicBot WhatsApp - Agent %d
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=%s
ExecStart=%s/atomic-bot
Restart=always
RestartSec=10
StandardOutput=append:/var/log/atomic-bot-%d.log
StandardError=append:/var/log/atomic-bot-%d-error.log
Environment="PATH=/usr/local/go/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"

[Install]
WantedBy=multi-user.target`,
		agent.ID,
		botDir,
		botDir,
		agent.ID,
		agent.ID)

	servicePath := fmt.Sprintf("/etc/systemd/system/%s.service", serviceName)

	// Crear archivo de servicio
	serviceFile, err := s.sftpClient.Create(servicePath)
	if err != nil {
		return fmt.Errorf("error creando archivo de servicio: %w", err)
	}
	defer serviceFile.Close()

	if _, err := serviceFile.Write([]byte(serviceContent)); err != nil {
		return fmt.Errorf("error escribiendo archivo de servicio: %w", err)
	}

	// Recargar systemd
	if _, err := s.executeCommand("systemctl daemon-reload"); err != nil {
		return fmt.Errorf("error recargando systemd: %w", err)
	}

	// Habilitar servicio
	if _, err := s.executeCommand(fmt.Sprintf("systemctl enable %s", serviceName)); err != nil {
		return fmt.Errorf("error habilitando servicio: %w", err)
	}

	log.Printf("   ✅ Servicio systemd creado y habilitado")
	return nil
}

// startBot inicia el bot
func (s *AtomicBotDeployService) startBot(agentID uint) error {
	serviceName := fmt.Sprintf("atomic-bot-%d", agentID)

	// Detener si ya está corriendo
	s.executeCommand(fmt.Sprintf("systemctl stop %s", serviceName))

	// Iniciar servicio
	if _, err := s.executeCommand(fmt.Sprintf("systemctl start %s", serviceName)); err != nil {
		return fmt.Errorf("error iniciando servicio: %w", err)
	}

	// Esperar un momento para que inicie
	time.Sleep(3 * time.Second)

	// Verificar estado
	statusOutput, err := s.executeCommand(fmt.Sprintf("systemctl is-active %s", serviceName))
	if err != nil || !strings.Contains(statusOutput, "active") {
		return fmt.Errorf("servicio no está activo: %s", statusOutput)
	}

	log.Printf("   ✅ Bot iniciado correctamente")
	return nil
}

// StopBot detiene el bot
func (s *AtomicBotDeployService) StopBot(agentID uint) error {
	cmd := fmt.Sprintf("systemctl stop atomic-bot-%d", agentID)
	if _, err := s.executeCommand(cmd); err != nil {
		return fmt.Errorf("error deteniendo: %w", err)
	}

	log.Printf("✅ [Agent %d] AtomicBot detenido", agentID)
	return nil
}

// RestartBot reinicia el bot
func (s *AtomicBotDeployService) RestartBot(agentID uint) error {
	cmd := fmt.Sprintf("systemctl restart atomic-bot-%d", agentID)
	if _, err := s.executeCommand(cmd); err != nil {
		return fmt.Errorf("error reiniciando: %w", err)
	}

	log.Printf("✅ [Agent %d] AtomicBot reiniciado", agentID)
	return nil
}

// GetBotLogs obtiene los últimos logs del bot
func (s *AtomicBotDeployService) GetBotLogs(agentID uint, lines int) (string, error) {
	cmd := fmt.Sprintf("tail -n %d /var/log/atomic-bot-%d.log", lines, agentID)
	output, err := s.executeCommand(cmd)
	if err != nil {
		return "", fmt.Errorf("error leyendo logs: %w", err)
	}
	return output, nil
}

// GetQRCodeFromLogs obtiene el QR code desde los logs del bot
func (s *AtomicBotDeployService) GetQRCodeFromLogs(agentID uint) (string, bool, error) {
	// Leer últimas 300 líneas del log (más líneas para asegurar capturar el QR)
	cmd := fmt.Sprintf("tail -n 300 /var/log/atomic-bot-%d.log", agentID)
	output, err := s.executeCommand(cmd)

	if err != nil {
		return "", false, fmt.Errorf("error leyendo logs: %w", err)
	}

	lines := strings.Split(output, "\n")

	// Log para debugging
	log.Printf("📋 [Agent %d] Analizando %d líneas de logs", agentID, len(lines))

	// Verificar si fue desconectado/desvinculado recientemente (en las últimas líneas)
	for i := len(lines) - 1; i >= 0 && i >= len(lines)-30; i-- {
		line := lines[i]

		// Detectar desconexión o logout
		if strings.Contains(line, "WHATSAPP DESCONECTADO") ||
			strings.Contains(line, "SESIÓN CERRADA - LOGOUT DETECTADO") ||
			strings.Contains(line, "Dispositivo desvinculado") ||
			strings.Contains(line, "esperando nueva conexión") {
			log.Printf("⚠️  [Agent %d] Bot desconectado, esperando reconexión", agentID)
			return "", false, fmt.Errorf("bot desconectado, esperando reconexión - escanea el nuevo QR cuando aparezca")
		}
	}

	// Verificar si ya está conectado (buscar en orden inverso para obtener el estado más reciente)
	for i := len(lines) - 1; i >= 0; i-- {
		line := lines[i]

		// Detectar mensajes de conexión exitosa
		if strings.Contains(line, "BOT CONECTADO EXITOSAMENTE") ||
			strings.Contains(line, "WHATSAPP CONECTADO") ||
			strings.Contains(line, "El bot está listo para recibir mensajes") ||
			strings.Contains(line, "✅ Google Calendar inicializado") ||
			strings.Contains(line, "Esperando mensajes de WhatsApp") {
			log.Printf("✅ [Agent %d] Bot conectado a WhatsApp", agentID)
			return "", true, nil
		}

		// Detectar si está autenticado
		if strings.Contains(line, "Authenticated") ||
			(strings.Contains(line, "Connected") && !strings.Contains(line, "Desconectado")) {
			log.Printf("✅ [Agent %d] WhatsApp autenticado", agentID)
			return "", true, nil
		}
	}

	// Buscar el QR code más reciente
	qrCode := extractQRFromLogs(lines)

	if qrCode != "" {
		log.Printf("📱 [Agent %d] QR code encontrado (%d caracteres)", agentID, len(qrCode))
		return qrCode, false, nil
	}

	// Verificar si el bot está iniciando
	for i := len(lines) - 1; i >= 0 && i >= len(lines)-20; i-- {
		line := lines[i]
		if strings.Contains(line, "Inicializando servicios") ||
			strings.Contains(line, "AtomicBot WhatsApp") ||
			strings.Contains(line, "Conectando a WhatsApp") {
			log.Printf("⏳ [Agent %d] Bot está iniciando, esperando QR code", agentID)
			return "", false, fmt.Errorf("bot iniciando, esperando código QR")
		}
	}

	// Si llegamos aquí, no hay QR ni conexión - ver últimas líneas para diagnóstico
	lastLines := ""
	startIdx := len(lines) - 10
	if startIdx < 0 {
		startIdx = 0
	}
	for i := startIdx; i < len(lines); i++ {
		if strings.TrimSpace(lines[i]) != "" {
			lastLines += lines[i] + "\n"
		}
	}

	log.Printf("⚠️  [Agent %d] No se encontró QR code ni estado de conexión\nÚltimas líneas:\n%s", agentID, lastLines)
	return "", false, fmt.Errorf("no QR code found in logs")
}

// extractQRFromLogs extrae el código QR de las líneas de log
func extractQRFromLogs(lines []string) string {
	var qrLines []string
	inQRBlock := false

	// Buscar de abajo hacia arriba (QR más reciente)
	for i := len(lines) - 1; i >= 0; i-- {
		line := lines[i]

		// Detectar caracteres de QR Unicode (█ ▄ ▀ ▌ y espacios)
		if strings.ContainsAny(line, "█▄▀▌") {
			if !inQRBlock {
				inQRBlock = true
				qrLines = []string{}
			}
			// Extraer solo la parte del QR (después de timestamp y nivel de log)
			parts := strings.SplitN(line, "]", 2)
			if len(parts) > 1 {
				qrLines = append([]string{strings.TrimSpace(parts[1])}, qrLines...)
			} else {
				qrLines = append([]string{line}, qrLines...)
			}
		} else if inQRBlock {
			// Ya terminó el bloque QR
			break
		}
	}

	if len(qrLines) > 0 {
		return strings.Join(qrLines, "\n")
	}

	return ""
}

// executeCommand ejecuta comando SSH y retorna el output
func (s *AtomicBotDeployService) executeCommand(cmd string) (string, error) {
	session, err := s.sshClient.NewSession()
	if err != nil {
		return "", fmt.Errorf("error creando sesión: %w", err)
	}
	defer session.Close()

	// Configurar PATH para incluir Go
	session.Setenv("PATH", "/usr/local/go/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin")

	output, err := session.CombinedOutput(cmd)
	if err != nil {
		return string(output), fmt.Errorf("comando falló: %s", err)
	}

	return string(output), nil
}

// uploadFile sube un archivo al servidor
func (s *AtomicBotDeployService) uploadFile(localPath, remotePath string) error {
	// Leer archivo local
	data, err := ioutil.ReadFile(localPath)
	if err != nil {
		return fmt.Errorf("error leyendo archivo local: %w", err)
	}

	// Crear directorio remoto si no existe
	remoteDir := filepath.Dir(remotePath)
	s.executeCommand(fmt.Sprintf("mkdir -p %s", remoteDir))

	// Crear archivo remoto
	remoteFile, err := s.sftpClient.Create(remotePath)
	if err != nil {
		return fmt.Errorf("error creando archivo remoto: %w", err)
	}
	defer remoteFile.Close()

	// Escribir datos
	if _, err := remoteFile.Write(data); err != nil {
		return fmt.Errorf("error escribiendo archivo remoto: %w", err)
	}

	return nil
}

// uploadDirectory sube un directorio completo al servidor
func (s *AtomicBotDeployService) uploadDirectory(localPath, remotePath string) error {
	// Crear directorio remoto
	if _, err := s.executeCommand(fmt.Sprintf("mkdir -p %s", remotePath)); err != nil {
		return fmt.Errorf("error creando directorio remoto: %w", err)
	}

	// Listar archivos locales
	entries, err := ioutil.ReadDir(localPath)
	if err != nil {
		return fmt.Errorf("error leyendo directorio local: %w", err)
	}

	// Subir cada archivo/subdirectorio
	for _, entry := range entries {
		localEntryPath := filepath.Join(localPath, entry.Name())
		remoteEntryPath := filepath.Join(remotePath, entry.Name())

		if entry.IsDir() {
			// Recursivo para subdirectorios
			if err := s.uploadDirectory(localEntryPath, remoteEntryPath); err != nil {
				return err
			}
		} else {
			// Subir archivo
			if err := s.uploadFile(localEntryPath, remoteEntryPath); err != nil {
				return err
			}
		}
	}

	return nil
}

// CleanupBotFiles elimina completamente los archivos del bot
func (s *AtomicBotDeployService) CleanupBotFiles(userID uint) error {
	botDir := fmt.Sprintf("/home/user_%d/atomic-bot", userID)
	cmd := fmt.Sprintf("rm -rf %s", botDir)

	if _, err := s.executeCommand(cmd); err != nil {
		log.Printf("⚠️  Error limpiando archivos del bot: %v", err)
		return err
	}

	log.Printf("✅ Archivos del bot eliminados: %s", botDir)
	return nil
}

// DiagnoseBotFailure realiza diagnóstico cuando el bot falla al iniciar
func (s *AtomicBotDeployService) DiagnoseBotFailure(agentID uint, userID uint) string {
	var diagnosis strings.Builder
	diagnosis.WriteString("🔍 DIAGNÓSTICO DEL BOT\n")
	diagnosis.WriteString("═══════════════════════════════════\n\n")

	botDir := fmt.Sprintf("/home/user_%d/atomic-bot", userID)

	// 1. Verificar archivos
	diagnosis.WriteString("📁 ARCHIVOS:\n")
	filesCmd := fmt.Sprintf("ls -lh %s", botDir)
	if output, err := s.executeCommand(filesCmd); err == nil {
		diagnosis.WriteString(output)
	} else {
		diagnosis.WriteString(fmt.Sprintf("❌ Error: %v\n", err))
	}
	diagnosis.WriteString("\n")

	// 2. Verificar .env
	diagnosis.WriteString("⚙️  ARCHIVO .ENV:\n")
	envCmd := fmt.Sprintf("cat %s/.env | grep -v API_KEY | grep -v TOKEN", botDir)
	if output, err := s.executeCommand(envCmd); err == nil {
		diagnosis.WriteString(output)
	} else {
		diagnosis.WriteString(fmt.Sprintf("❌ Error: %v\n", err))
	}
	diagnosis.WriteString("\n")

	// 3. Verificar business_config.json
	diagnosis.WriteString("📋 BUSINESS CONFIG:\n")
	configCmd := fmt.Sprintf("cat %s/business_config.json | head -20", botDir)
	if output, err := s.executeCommand(configCmd); err == nil {
		diagnosis.WriteString(output)
	} else {
		diagnosis.WriteString(fmt.Sprintf("❌ Error: %v\n", err))
	}
	diagnosis.WriteString("\n")

	// 4. Estado del servicio
	diagnosis.WriteString("🔧 ESTADO DEL SERVICIO:\n")
	statusCmd := fmt.Sprintf("systemctl status atomic-bot-%d --no-pager -l", agentID)
	if output, err := s.executeCommand(statusCmd); err == nil {
		diagnosis.WriteString(output)
	} else {
		diagnosis.WriteString(fmt.Sprintf("❌ Error: %v\n", err))
	}
	diagnosis.WriteString("\n")

	// 5. Últimos logs
	diagnosis.WriteString("📝 ÚLTIMOS LOGS (50 líneas):\n")
	logsCmd := fmt.Sprintf("tail -n 50 /var/log/atomic-bot-%d.log 2>&1 || journalctl -u atomic-bot-%d -n 50 --no-pager", agentID, agentID)
	if output, err := s.executeCommand(logsCmd); err == nil {
		diagnosis.WriteString(output)
	} else {
		diagnosis.WriteString(fmt.Sprintf("❌ Error: %v\n", err))
	}
	diagnosis.WriteString("\n")

	// 6. Logs de error
	diagnosis.WriteString("❌ LOGS DE ERROR:\n")
	errorLogsCmd := fmt.Sprintf("tail -n 30 /var/log/atomic-bot-%d-error.log 2>&1", agentID)
	if output, err := s.executeCommand(errorLogsCmd); err == nil {
		if strings.TrimSpace(output) != "" {
			diagnosis.WriteString(output)
		} else {
			diagnosis.WriteString("(Sin errores registrados)\n")
		}
	} else {
		diagnosis.WriteString(fmt.Sprintf("❌ Error: %v\n", err))
	}

	return diagnosis.String()
}
