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

// prepareServer prepara el servidor (instala Go, crea directorios)
func (s *AtomicBotDeployService) prepareServer(userID uint, botDir string) error {
	commands := []string{
		fmt.Sprintf("mkdir -p %s/src", botDir),
		`if ! command -v go &> /dev/null; then
			wget -q https://go.dev/dl/go1.24.0.linux-amd64.tar.gz -O /tmp/go.tar.gz
			tar -C /usr/local -xzf /tmp/go.tar.gz
			rm /tmp/go.tar.gz
		fi`,
		"/usr/local/go/bin/go version",
	}

	for i, cmd := range commands {
		log.Printf("   [%d/%d] Ejecutando preparación...", i+1, len(commands))
		if _, err := s.executeCommand(cmd); err != nil {
			return fmt.Errorf("comando %d falló: %w", i+1, err)
		}
	}

	log.Printf("✅ Servidor preparado correctamente")
	return nil
}

// transferBotFiles transfiere archivos desde /providers/atomic-whatsapp-web/
func (s *AtomicBotDeployService) transferBotFiles(userID uint, botDir string) error {
	localBotPath := "./providers/atomic-whatsapp-web"

	filesToTransfer := map[string]string{
		"main.go":         "main.go",
		"go.mod":          "go.mod",
		"go.sum":          "go.sum",
		"src/app.go":      "src/app.go",
		"src/utils.go":    "src/utils.go",
		"src/config.go":   "src/config.go",
		"src/gemini.go":   "src/gemini.go",
		"src/sheets.go":   "src/sheets.go",
		"src/calendar.go": "src/calendar.go",
	}

	totalFiles := len(filesToTransfer)
	currentFile := 0

	for localFile, remoteFile := range filesToTransfer {
		currentFile++
		localPath := filepath.Join(localBotPath, localFile)
		remotePath := filepath.Join(botDir, remoteFile)

		if err := s.uploadFile(localPath, remotePath); err != nil {
			return fmt.Errorf("error transfiriendo %s: %w", localFile, err)
		}
		log.Printf("   [%d/%d] ✅ %s transferido", currentFile, totalFiles, localFile)
	}

	log.Printf("✅ Todos los archivos transferidos correctamente")
	return nil
}

// uploadFile sube un archivo al servidor vía SFTP
func (s *AtomicBotDeployService) uploadFile(localPath, remotePath string) error {
	data, err := ioutil.ReadFile(localPath)
	if err != nil {
		return fmt.Errorf("error leyendo archivo local: %w", err)
	}

	remoteDir := filepath.Dir(remotePath)
	s.sftpClient.MkdirAll(remoteDir)

	remoteFile, err := s.sftpClient.Create(remotePath)
	if err != nil {
		return fmt.Errorf("error creando archivo remoto: %w", err)
	}
	defer remoteFile.Close()

	if _, err := remoteFile.Write(data); err != nil {
		return fmt.Errorf("error escribiendo archivo: %w", err)
	}

	return nil
}

// configureEnvironment configura .env, business_config.json y google.json
func (s *AtomicBotDeployService) configureEnvironment(agent *models.Agent, botDir, geminiAPIKey string, googleCredentials []byte) error {
	// 1. Crear archivo .env
	envContent := fmt.Sprintf(`# AtomicBot Configuration
DATABASE_FILE=whatsapp.db
LOG_LEVEL=INFO

# Gemini AI
GEMINI_API_KEY=%s

# Google Sheets (opcional)
SPREADSHEETID=%s

# Google Calendar (opcional)
GOOGLE_CALENDAR_ID=%s

# Business Configuration Path
BUSINESS_CONFIG_PATH=business_config.json
`, geminiAPIKey, agent.GoogleSheetID, agent.GoogleCalendarID)

	envPath := filepath.Join(botDir, ".env")
	if err := s.writeRemoteFile(envPath, envContent); err != nil {
		return fmt.Errorf("error creando .env: %w", err)
	}
	log.Printf("   ✅ Archivo .env creado")

	// 2. Crear business_config.json desde los datos del agente
	businessConfig := s.buildBusinessConfig(agent)
	configJSON, err := json.MarshalIndent(businessConfig, "", "  ")
	if err != nil {
		return fmt.Errorf("error serializando business_config: %w", err)
	}

	configPath := filepath.Join(botDir, "business_config.json")
	if err := s.writeRemoteFile(configPath, string(configJSON)); err != nil {
		return fmt.Errorf("error creando business_config.json: %w", err)
	}
	log.Printf("   ✅ Archivo business_config.json creado")

	// 3. Crear google.json con credenciales (si están disponibles)
	if len(googleCredentials) > 0 {
		googlePath := filepath.Join(botDir, "google.json")
		if err := s.writeRemoteFileBytes(googlePath, googleCredentials); err != nil {
			return fmt.Errorf("error creando google.json: %w", err)
		}
		log.Printf("   ✅ Archivo google.json creado")
	} else {
		log.Printf("   ⚠️  google.json no disponible (Sheets/Calendar deshabilitados)")
	}

	log.Printf("✅ Entorno configurado correctamente")
	return nil
}

// buildBusinessConfig construye la configuración del negocio desde el agente
func (s *AtomicBotDeployService) buildBusinessConfig(agent *models.Agent) BusinessConfig {
	config := BusinessConfig{
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
		Holidays: convertHolidays(agent.Config.Holidays),
		Services: convertServices(agent.Config.Services),
		Workers:  convertWorkers(agent.Config.Workers),
		Location: Location{
			// Estos campos no existen en el modelo actual
			Address:        "",
			Number:         "",
			Neighborhood:   "",
			City:           "",
			State:          "",
			Country:        "",
			PostalCode:     "",
			BetweenStreets: "",
		},
		SocialMedia: SocialMedia{
			// Estos campos no existen en el modelo actual
			Facebook:  "",
			Instagram: "",
			Twitter:   "",
			LinkedIn:  "",
		},
	}

	return config
}

// Funciones de conversión de tipos models -> deploy structures

func convertDaySchedule(modelSchedule models.DaySchedule) DaySchedule {
	return DaySchedule{
		Open:  modelSchedule.Open,
		Start: modelSchedule.Start,
		End:   modelSchedule.End,
	}
}

func convertHolidays(modelHolidays []models.Holiday) []Holiday {
	holidays := make([]Holiday, len(modelHolidays))
	for i, h := range modelHolidays {
		holidays[i] = Holiday{
			Date: h.Date,
			Name: h.Name,
		}
	}
	return holidays
}

func convertServices(modelServices []models.Service) []Service {
	services := make([]Service, len(modelServices))
	for i, s := range modelServices {
		service := Service{
			Title:       s.Title,
			Description: s.Description,
			PriceType:   s.PriceType,
		}

		// Convertir FlexibleString a float64
		if s.Price != "" {
			var price float64
			fmt.Sscanf(string(s.Price), "%f", &price)
			service.Price = price
		}

		if s.OriginalPrice != nil && *s.OriginalPrice != "" {
			var originalPrice float64
			fmt.Sscanf(string(*s.OriginalPrice), "%f", &originalPrice)
			service.OriginalPrice = originalPrice
		}

		if s.PromoPrice != nil && *s.PromoPrice != "" {
			var promoPrice float64
			fmt.Sscanf(string(*s.PromoPrice), "%f", &promoPrice)
			service.PromoPrice = promoPrice
		}

		services[i] = service
	}
	return services
}

func convertWorkers(modelWorkers []models.Staff) []Worker {
	workers := make([]Worker, len(modelWorkers))
	for i, w := range modelWorkers {
		workers[i] = Worker{
			Name:      w.Name,
			StartTime: w.StartTime,
			EndTime:   w.EndTime,
			Days:      w.Days,
		}
	}
	return workers
}

// writeRemoteFile escribe contenido en archivo remoto
func (s *AtomicBotDeployService) writeRemoteFile(remotePath, content string) error {
	remoteFile, err := s.sftpClient.Create(remotePath)
	if err != nil {
		return err
	}
	defer remoteFile.Close()

	_, err = remoteFile.Write([]byte(content))
	return err
}

// writeRemoteFileBytes escribe bytes en archivo remoto
func (s *AtomicBotDeployService) writeRemoteFileBytes(remotePath string, data []byte) error {
	remoteFile, err := s.sftpClient.Create(remotePath)
	if err != nil {
		return err
	}
	defer remoteFile.Close()

	_, err = remoteFile.Write(data)
	return err
}

// compileBotOnServer compila el bot en el servidor
func (s *AtomicBotDeployService) compileBotOnServer(userID uint, botDir string) error {
	commands := []string{
		fmt.Sprintf("cd %s && /usr/local/go/bin/go mod download", botDir),
		fmt.Sprintf("cd %s && /usr/local/go/bin/go mod tidy", botDir),
		fmt.Sprintf("cd %s && /usr/local/go/bin/go build -o atomic-bot main.go", botDir),
		fmt.Sprintf("chmod +x %s/atomic-bot", botDir),
	}

	for i, cmd := range commands {
		log.Printf("   [%d/%d] Compilando...", i+1, len(commands))
		output, err := s.executeCommand(cmd)
		if err != nil {
			return fmt.Errorf("compilación falló en paso %d: %w\nOutput: %s", i+1, err, output)
		}
	}

	// Verificar que el ejecutable se creó correctamente
	checkCmd := fmt.Sprintf("test -f %s/atomic-bot && echo 'OK'", botDir)
	output, err := s.executeCommand(checkCmd)
	if err != nil || !strings.Contains(output, "OK") {
		return fmt.Errorf("el ejecutable atomic-bot no se creó correctamente")
	}

	// Verificar que el ejecutable tenga permisos de ejecución
	permCmd := fmt.Sprintf("ls -l %s/atomic-bot", botDir)
	permOutput, err := s.executeCommand(permCmd)
	if err != nil {
		return fmt.Errorf("error verificando permisos del ejecutable: %w", err)
	}
	log.Printf("   Permisos del ejecutable: %s", strings.TrimSpace(permOutput))

	log.Printf("✅ Bot compilado correctamente")
	return nil
}

// createSystemdService crea servicio systemd para el bot
func (s *AtomicBotDeployService) createSystemdService(agent *models.Agent, botDir string) error {
	serviceContent := fmt.Sprintf(`[Unit]
Description=AtomicBot WhatsApp - Agent %d (%s)
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

[Install]
WantedBy=multi-user.target
`, agent.ID, agent.Name, botDir, botDir, agent.ID, agent.ID)

	servicePath := fmt.Sprintf("/etc/systemd/system/atomic-bot-%d.service", agent.ID)
	if err := s.writeRemoteFile(servicePath, serviceContent); err != nil {
		return fmt.Errorf("error creando servicio: %w", err)
	}

	if _, err := s.executeCommand("systemctl daemon-reload"); err != nil {
		return fmt.Errorf("error recargando systemd: %w", err)
	}

	log.Printf("✅ Servicio systemd creado correctamente")
	return nil
}

// startBot habilita e inicia el servicio
func (s *AtomicBotDeployService) startBot(agentID uint) error {
	// Habilitar servicio
	log.Printf("   [1/3] Habilitando servicio...")
	enableCmd := fmt.Sprintf("systemctl enable atomic-bot-%d", agentID)
	if _, err := s.executeCommand(enableCmd); err != nil {
		return fmt.Errorf("error habilitando servicio: %w", err)
	}

	// Iniciar servicio
	log.Printf("   [2/3] Iniciando servicio...")
	startCmd := fmt.Sprintf("systemctl start atomic-bot-%d", agentID)
	if _, err := s.executeCommand(startCmd); err != nil {
		// Obtener logs de error
		logCmd := fmt.Sprintf("journalctl -u atomic-bot-%d -n 50 --no-pager", agentID)
		logs, _ := s.executeCommand(logCmd)
		return fmt.Errorf("error iniciando servicio: %w\nLogs: %s", err, logs)
	}

	// Esperar y verificar estado con reintentos
	log.Printf("   [3/3] Verificando estado del servicio...")
	maxRetries := 10
	for i := 0; i < maxRetries; i++ {
		time.Sleep(2 * time.Second)

		statusCmd := fmt.Sprintf("systemctl is-active atomic-bot-%d", agentID)
		status, err := s.executeCommand(statusCmd)
		status = strings.TrimSpace(status)

		if err == nil && status == "active" {
			log.Printf("✅ AtomicBot iniciado correctamente")
			return nil
		}

		if status == "failed" {
			// Obtener logs del error
			logCmd := fmt.Sprintf("journalctl -u atomic-bot-%d -n 100 --no-pager", agentID)
			logs, _ := s.executeCommand(logCmd)
			return fmt.Errorf("servicio falló al iniciar\nLogs:\n%s", logs)
		}

		log.Printf("      Estado: %s, reintentando... (%d/%d)", status, i+1, maxRetries)
	}

	// Si llegamos aquí, el servicio no se activó a tiempo
	logCmd := fmt.Sprintf("journalctl -u atomic-bot-%d -n 100 --no-pager", agentID)
	logs, _ := s.executeCommand(logCmd)
	return fmt.Errorf("timeout esperando que el servicio se active\nLogs:\n%s", logs)
}

// StopAtomicBot detiene y elimina el bot
func (s *AtomicBotDeployService) StopAtomicBot(agentID uint) error {
	log.Printf("🛑 [Agent %d] Deteniendo AtomicBot...", agentID)

	commands := []string{
		fmt.Sprintf("systemctl stop atomic-bot-%d", agentID),
		fmt.Sprintf("systemctl disable atomic-bot-%d", agentID),
		fmt.Sprintf("rm -f /etc/systemd/system/atomic-bot-%d.service", agentID),
		"systemctl daemon-reload",
	}

	for _, cmd := range commands {
		s.executeCommand(cmd)
	}

	log.Printf("✅ [Agent %d] AtomicBot eliminado", agentID)
	return nil
}

// UpdateBotConfiguration actualiza la configuración del bot sin reiniciar
func (s *AtomicBotDeployService) UpdateBotConfiguration(agent *models.Agent, botDir string) error {
	log.Printf("🔄 [Agent %d] Actualizando configuración del bot...", agent.ID)

	// Regenerar business_config.json
	businessConfig := s.buildBusinessConfig(agent)
	configJSON, err := json.MarshalIndent(businessConfig, "", "  ")
	if err != nil {
		return fmt.Errorf("error serializando business_config: %w", err)
	}

	configPath := filepath.Join(botDir, "business_config.json")
	if err := s.writeRemoteFile(configPath, string(configJSON)); err != nil {
		return fmt.Errorf("error actualizando business_config.json: %w", err)
	}

	log.Printf("✅ [Agent %d] Configuración actualizada (el bot la recargará automáticamente)", agent.ID)
	return nil
}

// GetBotStatus obtiene el estado del bot
func (s *AtomicBotDeployService) GetBotStatus(agentID uint) (string, error) {
	cmd := fmt.Sprintf("systemctl is-active atomic-bot-%d", agentID)
	output, err := s.executeCommand(cmd)
	if err != nil {
		return "inactive", nil
	}
	return strings.TrimSpace(output), nil
}

// RestartBot reinicia el bot
func (s *AtomicBotDeployService) RestartBot(agentID uint) error {
	log.Printf("🔄 [Agent %d] Reiniciando AtomicBot...", agentID)

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
		return "", fmt.Errorf("comando falló: %s (output: %s)", err, string(output))
	}

	return string(output), nil
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
