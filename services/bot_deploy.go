package services

import (
	"attomos/models"
	"bytes"
	"encoding/base64"
	"fmt"
	"strings"
	"time"

	"golang.org/x/crypto/ssh"
)

// BotDeployService maneja el despliegue del bot en el servidor
type BotDeployService struct {
	serverIP     string
	rootPassword string
	sshClient    *ssh.Client
}

// NewBotDeployService crea una nueva instancia del servicio
func NewBotDeployService(serverIP, rootPassword string) *BotDeployService {
	return &BotDeployService{
		serverIP:     serverIP,
		rootPassword: rootPassword,
	}
}

// Connect establece conexión SSH con el servidor
func (b *BotDeployService) Connect() error {
	config := &ssh.ClientConfig{
		User: "root",
		Auth: []ssh.AuthMethod{
			ssh.Password(b.rootPassword),
		},
		HostKeyCallback: ssh.InsecureIgnoreHostKey(),
		Timeout:         30 * time.Second,
	}

	// Reintentar conexión hasta 10 veces (el servidor puede tardar en inicializarse)
	var client *ssh.Client
	var err error

	for i := 0; i < 10; i++ {
		client, err = ssh.Dial("tcp", b.serverIP+":22", config)
		if err == nil {
			break
		}
		time.Sleep(10 * time.Second)
	}

	if err != nil {
		return fmt.Errorf("no se pudo conectar al servidor después de varios intentos: %v", err)
	}

	b.sshClient = client
	return nil
}

// Close cierra la conexión SSH
func (b *BotDeployService) Close() error {
	if b.sshClient != nil {
		return b.sshClient.Close()
	}
	return nil
}

// ExecuteCommand ejecuta un comando en el servidor
func (b *BotDeployService) ExecuteCommand(cmd string) (string, error) {
	session, err := b.sshClient.NewSession()
	if err != nil {
		return "", err
	}
	defer session.Close()

	var stdout bytes.Buffer
	var stderr bytes.Buffer
	session.Stdout = &stdout
	session.Stderr = &stderr

	err = session.Run(cmd)
	if err != nil {
		return "", fmt.Errorf("error ejecutando comando: %v\nStderr: %s", err, stderr.String())
	}

	return stdout.String(), nil
}

// UploadFile sube un archivo al servidor
func (b *BotDeployService) UploadFile(localData []byte, remotePath string) error {
	// Crear el directorio si no existe
	dirCmd := fmt.Sprintf("mkdir -p $(dirname %s)", remotePath)
	if _, err := b.ExecuteCommand(dirCmd); err != nil {
		return fmt.Errorf("error creando directorio: %v", err)
	}

	// Usar una sesión SSH para transferir el archivo directamente
	session, err := b.sshClient.NewSession()
	if err != nil {
		return fmt.Errorf("error creando sesión SSH: %v", err)
	}
	defer session.Close()

	// Comando para escribir desde stdin al archivo usando base64
	cmd := fmt.Sprintf("base64 -d > %s", remotePath)

	// Crear pipe para stdin
	stdin, err := session.StdinPipe()
	if err != nil {
		return fmt.Errorf("error creando stdin pipe: %v", err)
	}

	// Iniciar el comando
	if err := session.Start(cmd); err != nil {
		return fmt.Errorf("error iniciando comando: %v", err)
	}

	// Codificar y escribir datos en base64
	encoder := base64.NewEncoder(base64.StdEncoding, stdin)
	if _, err := encoder.Write(localData); err != nil {
		stdin.Close()
		return fmt.Errorf("error escribiendo datos: %v", err)
	}
	encoder.Close()
	stdin.Close()

	// Esperar a que el comando termine
	if err := session.Wait(); err != nil {
		return fmt.Errorf("error esperando comando: %v", err)
	}

	return nil
}

// DeployBot despliega el bot de BuilderBot en el servidor
func (b *BotDeployService) DeployBot(agent *models.Agent, pdfData []byte) error {
	// 1. Esperar a que cloud-init termine completamente
	fmt.Println("Esperando a que cloud-init termine la inicialización...")

	maxRetries := 30 // 30 intentos = ~5 minutos máximo
	for i := 0; i < maxRetries; i++ {
		// Verificar si cloud-init ha terminado
		output, err := b.ExecuteCommand("cloud-init status")
		if err == nil && strings.Contains(output, "status: done") {
			fmt.Println("✅ Cloud-init completado")
			break
		}

		if i == maxRetries-1 {
			return fmt.Errorf("timeout esperando que cloud-init termine")
		}

		fmt.Printf("Esperando cloud-init... intento %d/%d\n", i+1, maxRetries)
		time.Sleep(10 * time.Second)
	}

	// 2. Verificar que npm esté instalado
	fmt.Println("Verificando instalación de Node.js y npm...")
	if _, err := b.ExecuteCommand("which npm"); err != nil {
		return fmt.Errorf("npm no está instalado en el servidor")
	}

	npmVersion, _ := b.ExecuteCommand("npm --version")
	nodeVersion, _ := b.ExecuteCommand("node --version")
	fmt.Printf("✅ Node.js %s y npm %s instalados\n", strings.TrimSpace(nodeVersion), strings.TrimSpace(npmVersion))

	// 3. Crear directorios necesarios
	fmt.Println("Creando estructura de directorios...")
	dirsCmd := fmt.Sprintf("mkdir -p /opt/agent-%d/documents", agent.ID)
	if _, err := b.ExecuteCommand(dirsCmd); err != nil {
		return fmt.Errorf("error creando directorios: %v", err)
	}

	// 4. Subir el documento PDF si existe
	if len(pdfData) > 0 && agent.MetaDocument != "" {
		fmt.Println("Subiendo documento Meta...")
		remotePath := fmt.Sprintf("/opt/agent-%d/documents/%s", agent.ID, agent.MetaDocument)
		if err := b.UploadFile(pdfData, remotePath); err != nil {
			return fmt.Errorf("error subiendo PDF: %v", err)
		}
		fmt.Println("✅ Documento subido exitosamente")
	}

	// 5. Crear proyecto BuilderBot
	fmt.Println("Creando proyecto BuilderBot...")
	createProjectCmd := fmt.Sprintf("cd /opt/agent-%d && npm create builderbot@latest -y -- --provider=meta --database=memory --language=ts 2>&1", agent.ID)
	output, err := b.ExecuteCommand(createProjectCmd)
	if err != nil {
		return fmt.Errorf("error creando proyecto BuilderBot: %v\nOutput: %s", err, output)
	}

	fmt.Printf("Output del comando npm create:\n%s\n", output)

	// Esperar un momento para que npm termine de crear todos los archivos
	fmt.Println("Esperando a que npm termine de crear archivos...")
	time.Sleep(5 * time.Second)

	// Listar qué se creó realmente
	fmt.Println("Listando contenido de /opt/agent-" + fmt.Sprintf("%d", agent.ID) + "...")
	lsOutput, _ := b.ExecuteCommand(fmt.Sprintf("ls -la /opt/agent-%d/", agent.ID))
	fmt.Printf("Contenido del directorio:\n%s\n", lsOutput)

	// El directorio siempre se llama base-ts-meta-memory para este template
	projectDir := "base-ts-meta-memory"
	projectPath := fmt.Sprintf("/opt/agent-%d/%s", agent.ID, projectDir)

	// Verificar que el directorio del proyecto existe
	fmt.Println("Verificando estructura del proyecto...")
	checkCmd := fmt.Sprintf("test -d %s && echo 'OK' || echo 'NOT_FOUND'", projectPath)
	checkOutput, err := b.ExecuteCommand(checkCmd)
	if err != nil || !strings.Contains(checkOutput, "OK") {
		// Si no existe, intentar buscar cualquier directorio que se haya creado
		findOutput, _ := b.ExecuteCommand(fmt.Sprintf("find /opt/agent-%d -maxdepth 1 -type d -not -name 'agent-%d' -not -name 'documents' 2>&1", agent.ID, agent.ID))
		return fmt.Errorf("el directorio del proyecto no se creó correctamente.\nEsperado: %s\nDirectorios encontrados:\n%s", projectPath, findOutput)
	}

	fmt.Printf("✅ Proyecto creado en: %s\n", projectPath)

	// 7. Configurar variables de entorno
	fmt.Println("Configurando variables de entorno...")
	envContent := b.generateEnvFile(agent)
	envPath := fmt.Sprintf("/opt/agent-%d/%s/.env", agent.ID, projectDir)

	if err := b.UploadFile([]byte(envContent), envPath); err != nil {
		return fmt.Errorf("error escribiendo .env: %v", err)
	}

	// 8. Crear archivo de flujo principal personalizado
	fmt.Println("Creando flujo del bot...")
	flowContent := b.generateFlowFile(agent)
	flowPath := fmt.Sprintf("/opt/agent-%d/%s/src/flows/main.flow.ts", agent.ID, projectDir)

	if err := b.UploadFile([]byte(flowContent), flowPath); err != nil {
		return fmt.Errorf("error escribiendo flow: %v", err)
	}

	// 9. Instalar dependencias
	fmt.Println("Instalando dependencias...")
	installCmd := fmt.Sprintf("cd /opt/agent-%d/%s && npm install", agent.ID, projectDir)
	if _, err := b.ExecuteCommand(installCmd); err != nil {
		return fmt.Errorf("error instalando dependencias: %v", err)
	}

	// 10. Compilar TypeScript
	fmt.Println("Compilando TypeScript...")
	buildCmd := fmt.Sprintf("cd /opt/agent-%d/%s && npm run build", agent.ID, projectDir)
	if _, err := b.ExecuteCommand(buildCmd); err != nil {
		return fmt.Errorf("error compilando: %v", err)
	}

	// 11. Iniciar bot con PM2
	fmt.Println("Iniciando bot con PM2...")
	pm2Cmd := fmt.Sprintf("cd /opt/agent-%d/%s && pm2 start npm --name agent-%d -- start && pm2 save", agent.ID, projectDir, agent.ID)
	if _, err := b.ExecuteCommand(pm2Cmd); err != nil {
		return fmt.Errorf("error iniciando PM2: %v", err)
	}

	// 12. Configurar PM2 para iniciar al reiniciar
	if _, err := b.ExecuteCommand("pm2 startup systemd -u root --hp /root && pm2 save"); err != nil {
		return fmt.Errorf("error configurando PM2 startup: %v", err)
	}

	fmt.Println("✅ Bot desplegado exitosamente!")
	return nil
}

// generateEnvFile genera el contenido del archivo .env
func (b *BotDeployService) generateEnvFile(agent *models.Agent) string {
	docPath := ""
	if agent.MetaDocument != "" {
		docPath = fmt.Sprintf("/opt/agent-%d/documents/%s", agent.ID, agent.MetaDocument)
	}

	return fmt.Sprintf(`# Meta (WhatsApp Cloud API) Configuration
META_APP_ID=tu_app_id_aqui
META_ACCESS_TOKEN=tu_access_token_aqui
META_PHONE_NUMBER_ID=tu_phone_number_id_aqui
META_WEBHOOK_VERIFY_TOKEN=tu_verify_token_aqui

# Bot Configuration
AGENT_ID=%d
AGENT_NAME=%s
PHONE_NUMBER=%s
BUSINESS_TYPE=%s
META_DOCUMENT_PATH=%s

# Port
PORT=3000
`, agent.ID, agent.Name, agent.PhoneNumber, agent.BusinessType, docPath)
}

// generateFlowFile genera el flujo principal del bot
func (b *BotDeployService) generateFlowFile(agent *models.Agent) string {
	// Generar lista de servicios (ahora es un array simple de strings)
	servicesText := ""
	for i, service := range agent.Config.Services {
		servicesText += fmt.Sprintf("%d. %s\\n", i+1, service)
	}

	// Generar horario
	scheduleText := b.generateScheduleText(agent.Config.Schedule)

	return fmt.Sprintf(`import { addKeyword, EVENTS } from '@builderbot/bot'

const welcomeFlow = addKeyword(EVENTS.WELCOME)
    .addAnswer('%s')
    .addAnswer([
        '📋 *Servicios disponibles:*',
        '%s',
        '',
        '🕐 *Horario de atención:*',
        '%s',
        '',
        '¿En qué puedo ayudarte?'
    ])

const servicesFlow = addKeyword(['servicios', 'precios', 'lista'])
    .addAnswer([
        '✂️ *Nuestros Servicios:*',
        '%s'
    ])

const scheduleFlow = addKeyword(['horario', 'hora', 'cuando'])
    .addAnswer([
        '🕐 *Horario de Atención:*',
        '%s'
    ])

const appointmentFlow = addKeyword(['cita', 'agendar', 'reservar'])
    .addAnswer('¡Perfecto! Voy a ayudarte a agendar tu cita.')
    .addAnswer('¿Cuál es tu nombre completo?', { capture: true }, async (ctx, { state }) => {
        await state.update({ name: ctx.body })
    })
    .addAnswer('¿Qué servicio te gustaría?', { capture: true }, async (ctx, { state }) => {
        await state.update({ service: ctx.body })
    })
    .addAnswer('¿Qué día prefieres? (ejemplo: lunes, martes)', { capture: true }, async (ctx, { state }) => {
        await state.update({ day: ctx.body })
    })
    .addAnswer('¿A qué hora? (ejemplo: 10:00, 14:30)', { capture: true }, async (ctx, { state, flowDynamic }) => {
        const currentState = await state.getMyState()
        
        await flowDynamic([
            '✅ *Cita Confirmada*',
            '',
            '👤 Nombre: ' + currentState.name,
            '✂️ Servicio: ' + currentState.service,
            '📅 Día: ' + currentState.day,
            '⏰ Hora: ' + ctx.body,
            '',
            '¡Nos vemos pronto! 😊'
        ])
    })

export { welcomeFlow, servicesFlow, scheduleFlow, appointmentFlow }
`, agent.Config.WelcomeMessage, servicesText, scheduleText, servicesText, scheduleText)
}

// generateScheduleText genera el texto del horario
func (b *BotDeployService) generateScheduleText(schedule models.Schedule) string {
	dayNames := map[string]string{
		"monday":    "Lunes",
		"tuesday":   "Martes",
		"wednesday": "Miércoles",
		"thursday":  "Jueves",
		"friday":    "Viernes",
		"saturday":  "Sábado",
		"sunday":    "Domingo",
	}

	var scheduleLines []string

	days := []string{"monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"}

	for _, day := range days {
		var daySchedule models.DaySchedule

		switch day {
		case "monday":
			daySchedule = schedule.Monday
		case "tuesday":
			daySchedule = schedule.Tuesday
		case "wednesday":
			daySchedule = schedule.Wednesday
		case "thursday":
			daySchedule = schedule.Thursday
		case "friday":
			daySchedule = schedule.Friday
		case "saturday":
			daySchedule = schedule.Saturday
		case "sunday":
			daySchedule = schedule.Sunday
		}

		if daySchedule.IsOpen {
			scheduleLines = append(scheduleLines,
				fmt.Sprintf("%s: %s - %s", dayNames[day], daySchedule.Open, daySchedule.Close))
		}
	}

	return strings.Join(scheduleLines, "\\n")
}

// StopBot detiene el bot en el servidor
func (b *BotDeployService) StopBot(agentID uint) error {
	stopCmd := fmt.Sprintf("pm2 stop agent-%d", agentID)
	_, err := b.ExecuteCommand(stopCmd)
	return err
}

// StartBot inicia el bot en el servidor
func (b *BotDeployService) StartBot(agentID uint) error {
	startCmd := fmt.Sprintf("pm2 start agent-%d", agentID)
	_, err := b.ExecuteCommand(startCmd)
	return err
}

// RestartBot reinicia el bot en el servidor
func (b *BotDeployService) RestartBot(agentID uint) error {
	restartCmd := fmt.Sprintf("pm2 restart agent-%d", agentID)
	_, err := b.ExecuteCommand(restartCmd)
	return err
}

// GetBotStatus obtiene el estado del bot
func (b *BotDeployService) GetBotStatus(agentID uint) (string, error) {
	statusCmd := fmt.Sprintf("pm2 jlist | grep agent-%d", agentID)
	output, err := b.ExecuteCommand(statusCmd)
	return output, err
}

// UpdateBotConfig actualiza la configuración del bot
func (b *BotDeployService) UpdateBotConfig(agent *models.Agent) error {
	// Generar nuevos archivos
	envContent := b.generateEnvFile(agent)
	flowContent := b.generateFlowFile(agent)

	// Escribir .env
	writeEnvCmd := fmt.Sprintf(`cat > /opt/agent-%d/base-ts-meta-memory/.env << 'EOF'
%s
EOF`, agent.ID, envContent)

	if _, err := b.ExecuteCommand(writeEnvCmd); err != nil {
		return err
	}

	// Escribir flow
	writeFlowCmd := fmt.Sprintf(`cat > /opt/agent-%d/base-ts-meta-memory/src/flows/main.flow.ts << 'EOF'
%s
EOF`, agent.ID, flowContent)

	if _, err := b.ExecuteCommand(writeFlowCmd); err != nil {
		return err
	}

	// Recompilar y reiniciar
	rebuildCmd := fmt.Sprintf("cd /opt/agent-%d/base-ts-meta-memory && npm run build", agent.ID)
	if _, err := b.ExecuteCommand(rebuildCmd); err != nil {
		return err
	}

	return b.RestartBot(agent.ID)
}
