package services

import (
	"attomos/models"
	"bufio"
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

// Connect establece conexión SSH con el servidor CON REINTENTOS MEJORADOS
func (b *BotDeployService) Connect() error {
	config := &ssh.ClientConfig{
		User: "root",
		Auth: []ssh.AuthMethod{
			ssh.Password(b.rootPassword),
		},
		HostKeyCallback: ssh.InsecureIgnoreHostKey(),
		Timeout:         30 * time.Second,
	}

	var client *ssh.Client
	var err error

	maxRetries := 18
	for i := 0; i < maxRetries; i++ {
		fmt.Printf("[SSH] Intento de conexión %d/%d a %s:22\n", i+1, maxRetries, b.serverIP)
		client, err = ssh.Dial("tcp", b.serverIP+":22", config)
		if err == nil {
			b.sshClient = client
			fmt.Printf("✅ [SSH] Conectado exitosamente en intento %d/%d\n", i+1, maxRetries)
			return nil
		}

		if i < maxRetries-1 {
			fmt.Printf("⚠️  [SSH] Fallo: %v - Reintentando en 10s...\n", err)
			time.Sleep(10 * time.Second)
		}
	}

	return fmt.Errorf("no se pudo conectar al servidor después de %d intentos: %v", maxRetries, err)
}

// Close cierra la conexión SSH
func (b *BotDeployService) Close() error {
	if b.sshClient != nil {
		fmt.Println("[SSH] Cerrando conexión...")
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

// ExecuteCommandWithRealtimeOutput ejecuta un comando y muestra output en tiempo real
func (b *BotDeployService) ExecuteCommandWithRealtimeOutput(cmd string, prefix string) error {
	session, err := b.sshClient.NewSession()
	if err != nil {
		return fmt.Errorf("error creando sesión: %v", err)
	}
	defer session.Close()

	// Capturar stdout
	stdout, err := session.StdoutPipe()
	if err != nil {
		return fmt.Errorf("error creando stdout pipe: %v", err)
	}

	// Capturar stderr
	stderr, err := session.StderrPipe()
	if err != nil {
		return fmt.Errorf("error creando stderr pipe: %v", err)
	}

	// Iniciar comando
	if err := session.Start(cmd); err != nil {
		return fmt.Errorf("error iniciando comando: %v", err)
	}

	// Leer stdout en tiempo real
	go func() {
		scanner := bufio.NewScanner(stdout)
		for scanner.Scan() {
			line := scanner.Text()
			if strings.TrimSpace(line) != "" {
				fmt.Printf("%s %s\n", prefix, line)
			}
		}
	}()

	// Leer stderr en tiempo real
	go func() {
		scanner := bufio.NewScanner(stderr)
		for scanner.Scan() {
			line := scanner.Text()
			if strings.TrimSpace(line) != "" {
				fmt.Printf("%s [stderr] %s\n", prefix, line)
			}
		}
	}()

	// Esperar a que termine
	if err := session.Wait(); err != nil {
		return fmt.Errorf("comando falló: %v", err)
	}

	return nil
}

// ExecuteCommandWithTimeout ejecuta un comando con timeout
func (b *BotDeployService) ExecuteCommandWithTimeout(cmd string, timeout time.Duration) (string, error) {
	resultChan := make(chan struct {
		output string
		err    error
	}, 1)

	go func() {
		output, err := b.ExecuteCommand(cmd)
		resultChan <- struct {
			output string
			err    error
		}{output, err}
	}()

	select {
	case result := <-resultChan:
		return result.output, result.err
	case <-time.After(timeout):
		return "", fmt.Errorf("comando excedió timeout de %v", timeout)
	}
}

// StreamRemoteFile lee un archivo remoto y lo imprime en tiempo real
func (b *BotDeployService) StreamRemoteFile(remotePath string, prefix string, duration time.Duration) {
	session, err := b.sshClient.NewSession()
	if err != nil {
		fmt.Printf("%s Error abriendo sesión: %v\n", prefix, err)
		return
	}
	defer session.Close()

	// Comando tail -f con timeout
	cmd := fmt.Sprintf("timeout %d tail -f %s 2>/dev/null || cat %s 2>/dev/null", int(duration.Seconds()), remotePath, remotePath)

	stdout, err := session.StdoutPipe()
	if err != nil {
		fmt.Printf("%s Error creando pipe: %v\n", prefix, err)
		return
	}

	if err := session.Start(cmd); err != nil {
		fmt.Printf("%s Error iniciando tail: %v\n", prefix, err)
		return
	}

	scanner := bufio.NewScanner(stdout)
	for scanner.Scan() {
		line := scanner.Text()
		if strings.TrimSpace(line) != "" {
			fmt.Printf("%s %s\n", prefix, line)
		}
	}

	session.Wait()
}

// UploadFile sube un archivo al servidor
func (b *BotDeployService) UploadFile(localData []byte, remotePath string) error {
	fmt.Printf("[UPLOAD] Subiendo archivo a %s (%d bytes)\n", remotePath, len(localData))

	dirCmd := fmt.Sprintf("mkdir -p $(dirname %s)", remotePath)
	if _, err := b.ExecuteCommand(dirCmd); err != nil {
		return fmt.Errorf("error creando directorio: %v", err)
	}

	session, err := b.sshClient.NewSession()
	if err != nil {
		return fmt.Errorf("error creando sesión SSH: %v", err)
	}
	defer session.Close()

	cmd := fmt.Sprintf("base64 -d > %s", remotePath)

	stdin, err := session.StdinPipe()
	if err != nil {
		return fmt.Errorf("error creando stdin pipe: %v", err)
	}

	if err := session.Start(cmd); err != nil {
		return fmt.Errorf("error iniciando comando: %v", err)
	}

	encoder := base64.NewEncoder(base64.StdEncoding, stdin)
	if _, err := encoder.Write(localData); err != nil {
		stdin.Close()
		return fmt.Errorf("error escribiendo datos: %v", err)
	}
	encoder.Close()
	stdin.Close()

	if err := session.Wait(); err != nil {
		return fmt.Errorf("error esperando comando: %v", err)
	}

	fmt.Printf("✅ [UPLOAD] Archivo subido exitosamente\n")
	return nil
}

// WaitForServerInitialization espera a que cloud-init complete CON LOGS EN TIEMPO REAL
func (b *BotDeployService) WaitForServerInitialization(maxWaitMinutes int) error {
	fmt.Println("╔═══════════════════════════════════════════════════════════════╗")
	fmt.Println("║          🔍 ESPERANDO INICIALIZACIÓN DEL SERVIDOR             ║")
	fmt.Println("╚═══════════════════════════════════════════════════════════════╝")
	fmt.Printf("\n⏰ Tiempo máximo de espera: %d minutos\n", maxWaitMinutes)
	fmt.Println("📊 Verificando estado cada 10 segundos...\n")

	maxWait := maxWaitMinutes * 60 / 10
	lastLogLine := ""
	lastPhase := ""
	cloudInitFailed := false

	for i := 0; i < maxWait; i++ {
		elapsed := (i + 1) * 10
		elapsedMin := elapsed / 60
		elapsedSec := elapsed % 60

		fmt.Println("────────────────────────────────────────────────────────────────")
		fmt.Printf("⏱️  Tiempo transcurrido: %02d:%02d / %d:00\n", elapsedMin, elapsedSec, maxWaitMinutes)

		// 0. PRIMERO: Verificar si cloud-init está corriendo o ha fallado
		fmt.Println("\n🔍 Verificando cloud-init...")
		cloudInitStatus, _ := b.ExecuteCommand("cloud-init status --long 2>&1 || echo 'not_available'")
		cloudInitStatus = strings.TrimSpace(cloudInitStatus)

		if strings.Contains(cloudInitStatus, "status: done") {
			fmt.Println("✅ Cloud-init completado")
		} else if strings.Contains(cloudInitStatus, "status: running") {
			fmt.Println("⏳ Cloud-init en ejecución...")
		} else if strings.Contains(cloudInitStatus, "status: error") {
			fmt.Println("❌ Cloud-init reporta ERROR")
			fmt.Println("\n📋 LOGS DE CLOUD-INIT (últimas 50 líneas):")
			fmt.Println("═══════════════════════════════════════════════════════════════")
			cloudInitLog, _ := b.ExecuteCommand("tail -50 /var/log/cloud-init-output.log 2>/dev/null || echo 'Log no disponible'")
			fmt.Println(cloudInitLog)
			fmt.Println("═══════════════════════════════════════════════════════════════")

			// Mostrar también errores específicos
			fmt.Println("\n🔴 ERRORES DE CLOUD-INIT:")
			fmt.Println("═══════════════════════════════════════════════════════════════")
			cloudInitErrors, _ := b.ExecuteCommand("grep -i 'error\\|failed\\|traceback' /var/log/cloud-init-output.log 2>/dev/null | tail -20 || echo 'No hay errores específicos en el log'")
			fmt.Println(cloudInitErrors)
			fmt.Println("═══════════════════════════════════════════════════════════════")

			// NUEVO: Obtener detalles del error de schema
			fmt.Println("\n🔍 DETALLES DEL ERROR DE SCHEMA:")
			fmt.Println("═══════════════════════════════════════════════════════════════")
			schemaDetails, _ := b.ExecuteCommand("cloud-init schema --system --annotate 2>&1 || echo 'No se puede obtener detalles'")
			fmt.Println(schemaDetails)
			fmt.Println("═══════════════════════════════════════════════════════════════")

			cloudInitFailed = true
		} else if strings.Contains(cloudInitStatus, "not_available") {
			fmt.Println("⚠️  Cloud-init no disponible aún")
		}

		// 1. Si cloud-init falló, intentar instalación manual
		if cloudInitFailed && i > 6 { // Después de 1 minuto
			fmt.Println("\n🔧 Cloud-init falló - Intentando instalación MANUAL...")
			if err := b.manualInstallation(); err != nil {
				fmt.Printf("⚠️  Instalación manual falló: %v\n", err)
			} else {
				fmt.Println("✅ Instalación manual completada")
				// Verificar que todo funciona
				if b.verifyAllTools() {
					return nil
				}
			}
		}

		// 2. Verificar con health check (solo si existe)
		fmt.Println("\n🏥 Ejecutando health check...")
		healthOutput, err := b.ExecuteCommandWithTimeout("/opt/health_check.sh 2>/dev/null", 30*time.Second)

		if err == nil && strings.Contains(healthOutput, "SERVIDOR LISTO PARA DESPLEGAR BOTS") {
			fmt.Println("\n╔═══════════════════════════════════════════════════════════════╗")
			fmt.Println("║              ✅ SERVIDOR COMPLETAMENTE LISTO                   ║")
			fmt.Println("╚═══════════════════════════════════════════════════════════════╝")
			fmt.Println("\n📋 Resultado del health check:")
			fmt.Println(healthOutput)
			return nil
		}

		// 3. Leer archivo de estado (si existe)
		fmt.Println("\n📄 Leyendo estado de inicialización...")
		statusOutput, _ := b.ExecuteCommand("cat /var/log/attomos/status 2>/dev/null | tail -1 || echo 'NO_STATUS'")
		statusOutput = strings.TrimSpace(statusOutput)

		if statusOutput != lastPhase {
			fmt.Printf("🔄 CAMBIO DE FASE: %s\n", statusOutput)
			lastPhase = statusOutput
		} else {
			fmt.Printf("📍 Fase actual: %s\n", statusOutput)
		}

		// Si encontramos CLOUD_INIT_COMPLETE, verificar manualmente
		if strings.Contains(statusOutput, "CLOUD_INIT_COMPLETE") {
			fmt.Println("\n✨ Cloud-init reporta COMPLETE - Verificando herramientas...")
			if b.verifyAllTools() {
				fmt.Println("✅ Todas las herramientas verificadas - Servidor listo")
				return nil
			} else {
				fmt.Println("⚠️  Algunas herramientas faltan, esperando más...")
			}
		}

		// 4. Mostrar últimas líneas del log de inicialización (si existe)
		fmt.Println("\n📜 Últimas 3 líneas del log de inicialización:")
		logOutput, _ := b.ExecuteCommand("tail -3 /var/log/attomos/init.log 2>/dev/null")
		if logOutput != "" {
			lines := strings.Split(strings.TrimSpace(logOutput), "\n")
			for _, line := range lines {
				line = strings.TrimSpace(line)
				if line != "" && line != lastLogLine {
					fmt.Printf("   📝 %s\n", line)
					lastLogLine = line
				}
			}
		} else {
			fmt.Println("   ⚠️  Log aún no disponible")
			// Si no hay logs después de 2 minutos, verificar cloud-init logs
			if i > 12 {
				fmt.Println("\n🔍 Verificando logs de cloud-init:")
				cloudLogs, _ := b.ExecuteCommand("tail -10 /var/log/cloud-init-output.log 2>/dev/null || echo 'No disponible'")
				if cloudLogs != "No disponible" {
					fmt.Println("--- Cloud-Init Output ---")
					fmt.Println(cloudLogs)
					fmt.Println("-------------------------")
				}
			}
		}

		// 5. Verificar procesos en ejecución
		fmt.Println("\n⚙️  Procesos de instalación activos:")
		processes, _ := b.ExecuteCommand("ps aux | grep -E '(apt|dpkg|npm|cloud-init)' | grep -v grep | wc -l")
		processCount := strings.TrimSpace(processes)
		if processCount != "0" {
			fmt.Printf("   🔄 %s procesos de instalación en ejecución\n", processCount)

			// Mostrar detalles de procesos
			processDetails, _ := b.ExecuteCommand("ps aux | grep -E '(apt|dpkg|npm|cloud-init)' | grep -v grep | awk '{print $11}' | head -3")
			if processDetails != "" {
				for _, proc := range strings.Split(strings.TrimSpace(processDetails), "\n") {
					if proc != "" {
						fmt.Printf("      → %s\n", proc)
					}
				}
			}
		} else {
			fmt.Println("   ✓ No hay procesos de instalación activos")

			// Si no hay procesos y cloud-init falló, intentar verificación manual
			if i > 6 && !b.verifyAllTools() {
				fmt.Println("\n⚠️  No hay procesos pero herramientas no están instaladas")
				fmt.Println("🔧 Intentando instalación manual...")
				if err := b.manualInstallation(); err == nil {
					if b.verifyAllTools() {
						return nil
					}
				}
			}
		}

		// 6. Ver si llegamos al límite
		if i == maxWait-1 {
			fmt.Println("\n╔═══════════════════════════════════════════════════════════════╗")
			fmt.Println("║                    ❌ TIMEOUT ALCANZADO                        ║")
			fmt.Println("╚═══════════════════════════════════════════════════════════════╝")
			b.showDiagnostics()

			// Mostrar logs de cloud-init si están disponibles
			fmt.Println("\n📋 LOG COMPLETO DE CLOUD-INIT:")
			fmt.Println("═══════════════════════════════════════════════════════════════")
			cloudLog, _ := b.ExecuteCommand("cat /var/log/cloud-init-output.log 2>/dev/null || echo 'No disponible'")
			if cloudLog != "No disponible" {
				fmt.Println(cloudLog)
			} else {
				fmt.Println("⚠️  Cloud-init log no disponible")
			}
			fmt.Println("═══════════════════════════════════════════════════════════════")

			// Mostrar log de inicialización de attomos
			fmt.Println("\n📋 LOG COMPLETO DE INICIALIZACIÓN:")
			fmt.Println("═══════════════════════════════════════════════════════════════")
			fullLog, _ := b.ExecuteCommand("cat /var/log/attomos/init.log 2>/dev/null || echo 'No disponible'")
			fmt.Println(fullLog)
			fmt.Println("═══════════════════════════════════════════════════════════════")

			return fmt.Errorf("timeout: servidor no se inicializó después de %d minutos", maxWaitMinutes)
		}

		// Mostrar barra de progreso simple
		progress := float64(i+1) / float64(maxWait) * 100
		fmt.Printf("\n📊 Progreso: %.1f%%\n", progress)

		fmt.Println("\n⏳ Esperando 10 segundos antes de la siguiente verificación...")
		time.Sleep(10 * time.Second)
	}

	return fmt.Errorf("timeout en inicialización del servidor")
}

// verifyAllTools verifica manualmente que todas las herramientas estén instaladas
func (b *BotDeployService) verifyAllTools() bool {
	fmt.Println("\n🔍 Verificando herramientas manualmente...")

	allOk := true

	// Verificar Node.js
	fmt.Print("   Verificando Node.js... ")
	nodeOutput, err := b.ExecuteCommand("which node && node --version")
	if err != nil || !strings.Contains(nodeOutput, "v") {
		fmt.Println("❌ NO DISPONIBLE")
		allOk = false
	} else {
		fmt.Printf("✅ %s\n", strings.TrimSpace(strings.Split(nodeOutput, "\n")[1]))
	}

	// Verificar NPM
	fmt.Print("   Verificando NPM... ")
	npmOutput, err := b.ExecuteCommand("which npm && npm --version")
	if err != nil || npmOutput == "" {
		fmt.Println("❌ NO DISPONIBLE")
		allOk = false
	} else {
		fmt.Printf("✅ %s\n", strings.TrimSpace(strings.Split(npmOutput, "\n")[1]))
	}

	// Verificar PM2
	fmt.Print("   Verificando PM2... ")
	pm2Output, err := b.ExecuteCommand("which pm2 && pm2 --version")
	if err != nil || pm2Output == "" {
		fmt.Println("❌ NO DISPONIBLE")
		allOk = false
	} else {
		fmt.Printf("✅ %s\n", strings.TrimSpace(strings.Split(pm2Output, "\n")[1]))
	}

	// Test rápido de npm
	fmt.Print("   Probando npm... ")
	testOutput, err := b.ExecuteCommandWithTimeout("cd /tmp && npm --version", 10*time.Second)
	if err != nil || testOutput == "" {
		fmt.Println("❌ NO RESPONDE")
		allOk = false
	} else {
		fmt.Println("✅ FUNCIONAL")
	}

	return allOk
}

// manualInstallation intenta instalar Node.js, NPM y PM2 manualmente
func (b *BotDeployService) manualInstallation() error {
	fmt.Println("\n🔧 ==> INSTALACIÓN MANUAL INICIADA <==")

	// Crear directorios
	fmt.Println("1. Creando directorios...")
	b.ExecuteCommand("mkdir -p /var/log/attomos /opt/agents")

	// Instalar Node.js usando NodeSource
	fmt.Println("2. Instalando Node.js...")
	commands := []string{
		"curl -fsSL https://deb.nodesource.com/setup_20.x | bash -",
		"apt-get install -y nodejs",
	}

	for _, cmd := range commands {
		fmt.Printf("   Ejecutando: %s\n", cmd)
		if _, err := b.ExecuteCommandWithTimeout(cmd, 5*time.Minute); err != nil {
			fmt.Printf("   ⚠️  Error: %v\n", err)
			return fmt.Errorf("error instalando Node.js: %v", err)
		}
	}

	// Verificar Node.js
	if output, err := b.ExecuteCommand("node --version"); err == nil {
		fmt.Printf("   ✅ Node.js instalado: %s\n", strings.TrimSpace(output))
	} else {
		return fmt.Errorf("Node.js no se instaló correctamente")
	}

	// Instalar PM2
	fmt.Println("3. Instalando PM2...")
	if _, err := b.ExecuteCommandWithTimeout("npm install -g pm2", 3*time.Minute); err != nil {
		return fmt.Errorf("error instalando PM2: %v", err)
	}

	// Verificar PM2
	if output, err := b.ExecuteCommand("pm2 --version"); err == nil {
		fmt.Printf("   ✅ PM2 instalado: %s\n", strings.TrimSpace(output))
	} else {
		return fmt.Errorf("PM2 no se instaló correctamente")
	}

	// Configurar firewall
	fmt.Println("4. Configurando firewall...")
	firewallCmds := []string{
		"ufw --force enable",
		"ufw allow 22/tcp",
		"ufw allow 80/tcp",
		"ufw allow 443/tcp",
		"ufw allow 3001:3020/tcp",
	}

	for _, cmd := range firewallCmds {
		b.ExecuteCommand(cmd)
	}

	// Marcar como completo
	fmt.Println("5. Marcando inicialización como completa...")
	b.ExecuteCommand("echo 'MANUAL_INSTALL_COMPLETE' > /var/log/attomos/status")
	b.ExecuteCommand("date '+%Y-%m-%d %H:%M:%S' > /var/log/attomos/init_completed_at")

	fmt.Println("✅ ==> INSTALACIÓN MANUAL COMPLETADA <==\n")
	return nil
}

// verifyAllTools verifica manualmente que todas las herramientas estén instaladas
func (b *BotDeployService) showDiagnostics() {
	fmt.Println("\n╔═══════════════════════════════════════════════════════════════╗")
	fmt.Println("║                  📋 DIAGNÓSTICO DEL SERVIDOR                   ║")
	fmt.Println("╚═══════════════════════════════════════════════════════════════╝")

	// 1. Status file
	fmt.Println("\n1️⃣  ARCHIVO DE ESTADO:")
	status, _ := b.ExecuteCommand("cat /var/log/attomos/status 2>/dev/null || echo 'NO_STATUS_FILE'")
	fmt.Printf("   %s\n", strings.TrimSpace(status))

	// 2. Init log (últimas 50 líneas)
	fmt.Println("\n2️⃣  ÚLTIMAS 50 LÍNEAS DEL LOG DE INICIALIZACIÓN:")
	fmt.Println("────────────────────────────────────────────────────────────────")
	initLog, _ := b.ExecuteCommand("tail -50 /var/log/attomos/init.log 2>/dev/null || echo 'NO_LOG'")
	fmt.Println(initLog)
	fmt.Println("────────────────────────────────────────────────────────────────")

	// 3. Verificar herramientas
	fmt.Println("\n3️⃣  ESTADO DE HERRAMIENTAS:")
	nodeCheck, _ := b.ExecuteCommand("which node && node --version || echo 'Node.js NO INSTALADO'")
	fmt.Printf("   Node.js: %s\n", strings.TrimSpace(nodeCheck))

	npmCheck, _ := b.ExecuteCommand("which npm && npm --version || echo 'NPM NO INSTALADO'")
	fmt.Printf("   NPM: %s\n", strings.TrimSpace(npmCheck))

	pm2Check, _ := b.ExecuteCommand("which pm2 && pm2 --version || echo 'PM2 NO INSTALADO'")
	fmt.Printf("   PM2: %s\n", strings.TrimSpace(pm2Check))

	// 4. Cloud-init status
	fmt.Println("\n4️⃣  ESTADO DE CLOUD-INIT:")
	cloudInitStatus, _ := b.ExecuteCommand("cloud-init status --long 2>&1 || echo 'cloud-init no disponible'")
	fmt.Printf("   %s\n", cloudInitStatus)

	// Mostrar más detalles de cloud-init
	fmt.Println("\n   📜 Últimas 30 líneas de cloud-init-output.log:")
	cloudInitLog, _ := b.ExecuteCommand("tail -30 /var/log/cloud-init-output.log 2>/dev/null || echo 'No disponible'")
	if cloudInitLog != "No disponible" {
		fmt.Println("   ────────────────────────────────────────────────────")
		fmt.Println(cloudInitLog)
		fmt.Println("   ────────────────────────────────────────────────────")
	} else {
		fmt.Println("   ⚠️  Log no disponible")
	}

	// 5. Procesos en ejecución
	fmt.Println("\n5️⃣  PROCESOS RELACIONADOS CON INSTALACIÓN:")
	processes, _ := b.ExecuteCommand("ps aux | grep -E '(apt|dpkg|unattended|npm)' | grep -v grep || echo 'Ninguno'")
	fmt.Println(processes)

	// 6. Espacio en disco
	fmt.Println("\n6️⃣  ESPACIO EN DISCO:")
	diskSpace, _ := b.ExecuteCommand("df -h / || echo 'No disponible'")
	fmt.Println(diskSpace)

	// 7. Memoria
	fmt.Println("\n7️⃣  MEMORIA:")
	memory, _ := b.ExecuteCommand("free -h || echo 'No disponible'")
	fmt.Println(memory)

	// 8. Uptime
	fmt.Println("\n8️⃣  TIEMPO ACTIVO DEL SERVIDOR:")
	uptime, _ := b.ExecuteCommand("uptime")
	fmt.Printf("   %s\n", uptime)

	fmt.Println("═══════════════════════════════════════════════════════════════")
}

// DeployBot despliega el bot con LOGS EN TIEMPO REAL
func (b *BotDeployService) DeployBot(agent *models.Agent, pdfData []byte) error {
	fmt.Println("\n╔═══════════════════════════════════════════════════════════════╗")
	fmt.Printf("║            🤖 DESPLEGANDO BOT - AGENTE %d                      ║\n", agent.ID)
	fmt.Println("╚═══════════════════════════════════════════════════════════════╝")

	startTime := time.Now()

	// 1. ESPERAR INICIALIZACIÓN
	fmt.Println("\n" + strings.Repeat("╔", 64))
	fmt.Println("FASE 1: ESPERANDO INICIALIZACIÓN DEL SERVIDOR")
	fmt.Println(strings.Repeat("╝", 64))

	if err := b.WaitForServerInitialization(20); err != nil {
		return err
	}

	fmt.Printf("\n✅ Servidor listo después de %v\n", time.Since(startTime).Round(time.Second))

	// 2. VERIFICACIÓN FINAL
	fmt.Println("\n" + strings.Repeat("╔", 64))
	fmt.Println("FASE 2: VERIFICACIÓN FINAL DE HERRAMIENTAS")
	fmt.Println(strings.Repeat("╝", 64))

	if !b.verifyAllTools() {
		return fmt.Errorf("las herramientas necesarias no están disponibles")
	}

	// 3. CREAR DIRECTORIOS
	fmt.Println("\n" + strings.Repeat("╔", 64))
	fmt.Println("FASE 3: CREANDO ESTRUCTURA DE DIRECTORIOS")
	fmt.Println(strings.Repeat("╝", 64))

	dirsCmd := fmt.Sprintf("mkdir -p /opt/agent-%d/documents", agent.ID)
	fmt.Printf("[CMD] %s\n", dirsCmd)
	if _, err := b.ExecuteCommand(dirsCmd); err != nil {
		return fmt.Errorf("error creando directorios: %v", err)
	}
	fmt.Println("✅ Directorios creados")

	// 4. SUBIR PDF
	if len(pdfData) > 0 && agent.MetaDocument != "" {
		fmt.Println("\n" + strings.Repeat("╔", 64))
		fmt.Println("FASE 4: SUBIENDO DOCUMENTO PDF")
		fmt.Println(strings.Repeat("╝", 64))

		remotePath := fmt.Sprintf("/opt/agent-%d/documents/%s", agent.ID, agent.MetaDocument)
		if err := b.UploadFile(pdfData, remotePath); err != nil {
			return fmt.Errorf("error subiendo PDF: %v", err)
		}
	}

	// 5. CREAR PROYECTO BUILDERBOT
	fmt.Println("\n" + strings.Repeat("╔", 64))
	fmt.Println("FASE 5: CREANDO PROYECTO BUILDERBOT")
	fmt.Println(strings.Repeat("╝", 64))
	fmt.Println("⏰ Esto puede tomar 2-3 minutos...")
	fmt.Println("📊 Mostrando output en tiempo real:\n")

	createProjectCmd := fmt.Sprintf("cd /opt/agent-%d && timeout 300 npm create builderbot@latest -y -- --provider=meta --database=memory --language=ts", agent.ID)

	if err := b.ExecuteCommandWithRealtimeOutput(createProjectCmd, "[NPM]"); err != nil {
		return fmt.Errorf("error creando proyecto: %v", err)
	}

	fmt.Println("\n✅ Proyecto BuilderBot creado")
	fmt.Println("⏳ Esperando 10 segundos para asegurar escritura de archivos...")
	time.Sleep(10 * time.Second)

	projectDir := "base-ts-meta-memory"
	projectPath := fmt.Sprintf("/opt/agent-%d/%s", agent.ID, projectDir)

	// 6. VERIFICAR PROYECTO
	fmt.Println("\n" + strings.Repeat("╔", 64))
	fmt.Println("FASE 6: VERIFICANDO ESTRUCTURA DEL PROYECTO")
	fmt.Println(strings.Repeat("╝", 64))

	checkCmd := fmt.Sprintf("test -d %s && echo 'OK' || echo 'NOT_FOUND'", projectPath)
	checkOutput, _ := b.ExecuteCommand(checkCmd)

	if !strings.Contains(checkOutput, "OK") {
		fmt.Println("❌ Directorio no encontrado - Mostrando estructura:")
		lsOutput, _ := b.ExecuteCommand(fmt.Sprintf("ls -la /opt/agent-%d/", agent.ID))
		fmt.Println(lsOutput)
		return fmt.Errorf("el directorio del proyecto no se creó: esperado %s", projectPath)
	}

	fmt.Printf("✅ Proyecto verificado en: %s\n", projectPath)

	// Mostrar estructura del proyecto
	fmt.Println("\n🔍 Estructura del proyecto:")
	treeOutput, _ := b.ExecuteCommand(fmt.Sprintf("ls -lh %s", projectPath))
	fmt.Println(treeOutput)

	// 7. CONFIGURAR .ENV
	fmt.Println("\n" + strings.Repeat("╔", 64))
	fmt.Println("FASE 7: CONFIGURANDO VARIABLES DE ENTORNO")
	fmt.Println(strings.Repeat("╝", 64))

	envContent := b.generateEnvFile(agent)
	envPath := fmt.Sprintf("/opt/agent-%d/%s/.env", agent.ID, projectDir)

	if err := b.UploadFile([]byte(envContent), envPath); err != nil {
		return fmt.Errorf("error escribiendo .env: %v", err)
	}

	// 8. CREAR FLOW
	fmt.Println("\n" + strings.Repeat("╔", 64))
	fmt.Println("FASE 8: CREANDO FLUJO DEL BOT")
	fmt.Println(strings.Repeat("╝", 64))

	flowContent := b.generateFlowFile(agent)
	flowPath := fmt.Sprintf("/opt/agent-%d/%s/src/flows/main.flow.ts", agent.ID, projectDir)

	if err := b.UploadFile([]byte(flowContent), flowPath); err != nil {
		return fmt.Errorf("error escribiendo flow: %v", err)
	}

	// 9. INSTALAR DEPENDENCIAS
	fmt.Println("\n" + strings.Repeat("╔", 64))
	fmt.Println("FASE 9: INSTALANDO DEPENDENCIAS")
	fmt.Println(strings.Repeat("╝", 64))
	fmt.Println("⏰ Esto puede tomar 2-3 minutos...")
	fmt.Println("📊 Mostrando output en tiempo real:\n")

	installCmd := fmt.Sprintf("cd /opt/agent-%d/%s && npm install", agent.ID, projectDir)

	if err := b.ExecuteCommandWithRealtimeOutput(installCmd, "[NPM]"); err != nil {
		return fmt.Errorf("error instalando dependencias: %v", err)
	}

	fmt.Println("\n✅ Dependencias instaladas")

	// 10. COMPILAR TYPESCRIPT
	fmt.Println("\n" + strings.Repeat("╔", 64))
	fmt.Println("FASE 10: COMPILANDO TYPESCRIPT")
	fmt.Println(strings.Repeat("╝", 64))
	fmt.Println("📊 Mostrando output en tiempo real:\n")

	buildCmd := fmt.Sprintf("cd /opt/agent-%d/%s && npm run build", agent.ID, projectDir)

	if err := b.ExecuteCommandWithRealtimeOutput(buildCmd, "[BUILD]"); err != nil {
		return fmt.Errorf("error compilando: %v", err)
	}

	fmt.Println("\n✅ Código compilado")

	// 11. INICIAR CON PM2
	fmt.Println("\n" + strings.Repeat("╔", 64))
	fmt.Println("FASE 11: INICIANDO BOT CON PM2")
	fmt.Println(strings.Repeat("╝", 64))

	pm2Cmd := fmt.Sprintf("cd /opt/agent-%d/%s && pm2 start npm --name agent-%d -- start && pm2 save", agent.ID, projectDir, agent.ID)
	fmt.Printf("[CMD] %s\n\n", pm2Cmd)

	if err := b.ExecuteCommandWithRealtimeOutput(pm2Cmd, "[PM2]"); err != nil {
		return fmt.Errorf("error iniciando PM2: %v", err)
	}

	fmt.Println("\n✅ Bot iniciado con PM2")

	// 12. PM2 STARTUP
	fmt.Println("\n" + strings.Repeat("╔", 64))
	fmt.Println("FASE 12: CONFIGURANDO PM2 STARTUP")
	fmt.Println(strings.Repeat("╝", 64))

	if err := b.ExecuteCommandWithRealtimeOutput("pm2 startup systemd -u root --hp /root && pm2 save", "[PM2]"); err != nil {
		fmt.Printf("⚠️  Warning: Error configurando PM2 startup (no crítico)\n")
	} else {
		fmt.Println("✅ PM2 startup configurado")
	}

	// 13. VERIFICAR ESTADO FINAL
	fmt.Println("\n" + strings.Repeat("╔", 64))
	fmt.Println("FASE 13: VERIFICANDO ESTADO DEL BOT")
	fmt.Println(strings.Repeat("╝", 64))

	time.Sleep(3 * time.Second)
	fmt.Println("\n📊 Lista de procesos PM2:")
	listCmd := "pm2 list"
	b.ExecuteCommandWithRealtimeOutput(listCmd, "[PM2]")

	fmt.Println("\n📋 Información detallada del agente:")
	infoCmd := fmt.Sprintf("pm2 info agent-%d", agent.ID)
	b.ExecuteCommandWithRealtimeOutput(infoCmd, "[PM2]")

	// Verificar logs del bot
	fmt.Println("\n📜 Últimas líneas del log del bot:")
	logsCmd := fmt.Sprintf("pm2 logs agent-%d --lines 10 --nostream", agent.ID)
	b.ExecuteCommandWithRealtimeOutput(logsCmd, "[LOGS]")

	totalTime := time.Since(startTime).Round(time.Second)

	fmt.Println("\n╔═══════════════════════════════════════════════════════════════╗")
	fmt.Printf("║              ✅ BOT DESPLEGADO EXITOSAMENTE                    ║\n")
	fmt.Println("╚═══════════════════════════════════════════════════════════════╝")
	fmt.Printf("\n📊 Resumen del despliegue:\n")
	fmt.Printf("   • Agente ID: %d\n", agent.ID)
	fmt.Printf("   • Puerto: %d\n", agent.Port)
	fmt.Printf("   • Path: %s\n", projectPath)
	fmt.Printf("   • Tiempo total: %v\n", totalTime)
	fmt.Println("\n" + strings.Repeat("╔", 64))

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

# Port (único para este agente)
PORT=%d
`, agent.ID, agent.Name, agent.PhoneNumber, agent.BusinessType, docPath, agent.Port)
}

// generateFlowFile genera el flujo principal del bot
func (b *BotDeployService) generateFlowFile(agent *models.Agent) string {
	servicesText := ""
	for i, service := range agent.Config.Services {
		// Generar texto del servicio según el tipo de precio
		priceText := string(service.Price)

		switch service.PriceType {
		case "promo":
			if service.OriginalPrice != nil && service.PromoPrice != nil {
				priceText = fmt.Sprintf("~~%s~~ *%s*", string(*service.OriginalPrice), string(*service.PromoPrice))
			}
		case "range":
			// Para rangos de precios, el Price ya contiene el formato correcto del frontend
			priceText = string(service.Price)
		default:
			// "normal" o sin especificar
			priceText = string(service.Price)
		}

		servicesText += fmt.Sprintf("%d. %s - %s\\n", i+1, service.Title, priceText)
	}

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

		if daySchedule.Open {
			scheduleLines = append(scheduleLines,
				fmt.Sprintf("%s: %s - %s", dayNames[day], daySchedule.Start, daySchedule.End))
		}
	}

	return strings.Join(scheduleLines, "\\n")
}

// StopBot detiene el bot en el servidor
func (b *BotDeployService) StopBot(agentID uint) error {
	fmt.Printf("[PM2] Deteniendo agente %d...\n", agentID)
	stopCmd := fmt.Sprintf("pm2 stop agent-%d", agentID)
	_, err := b.ExecuteCommand(stopCmd)
	if err != nil {
		fmt.Printf("❌ Error: %v\n", err)
	} else {
		fmt.Printf("✅ Agente %d detenido\n", agentID)
	}
	return err
}

// StartBot inicia el bot en el servidor
func (b *BotDeployService) StartBot(agentID uint) error {
	fmt.Printf("[PM2] Iniciando agente %d...\n", agentID)
	startCmd := fmt.Sprintf("pm2 start agent-%d", agentID)
	_, err := b.ExecuteCommand(startCmd)
	if err != nil {
		fmt.Printf("❌ Error: %v\n", err)
	} else {
		fmt.Printf("✅ Agente %d iniciado\n", agentID)
	}
	return err
}

// RestartBot reinicia el bot en el servidor
func (b *BotDeployService) RestartBot(agentID uint) error {
	fmt.Printf("[PM2] Reiniciando agente %d...\n", agentID)
	restartCmd := fmt.Sprintf("pm2 restart agent-%d", agentID)
	_, err := b.ExecuteCommand(restartCmd)
	if err != nil {
		fmt.Printf("❌ Error: %v\n", err)
	} else {
		fmt.Printf("✅ Agente %d reiniciado\n", agentID)
	}
	return err
}

// StopAndRemoveBot detiene y elimina completamente el bot del servidor
func (b *BotDeployService) StopAndRemoveBot(agentID uint) error {
	fmt.Printf("\n[CLEANUP] Eliminando agente %d del servidor...\n", agentID)

	// Detener proceso PM2
	fmt.Printf("[PM2] Deteniendo proceso...\n")
	stopCmd := fmt.Sprintf("pm2 delete agent-%d", agentID)
	if _, err := b.ExecuteCommand(stopCmd); err != nil {
		fmt.Printf("⚠️  Error deteniendo PM2: %v\n", err)
	} else {
		fmt.Printf("✅ Proceso PM2 detenido\n")
	}

	// Eliminar directorio del agente
	fmt.Printf("[FILES] Eliminando directorio /opt/agent-%d...\n", agentID)
	removeCmd := fmt.Sprintf("rm -rf /opt/agent-%d", agentID)
	if _, err := b.ExecuteCommand(removeCmd); err != nil {
		fmt.Printf("❌ Error eliminando directorio: %v\n", err)
		return fmt.Errorf("error eliminando directorio: %v", err)
	}
	fmt.Printf("✅ Directorio eliminado\n")

	// Guardar configuración de PM2
	fmt.Printf("[PM2] Guardando configuración...\n")
	b.ExecuteCommand("pm2 save --force")
	fmt.Printf("✅ Agente %d eliminado completamente\n", agentID)

	return nil
}

// GetBotStatus obtiene el estado del bot
func (b *BotDeployService) GetBotStatus(agentID uint) (string, error) {
	statusCmd := fmt.Sprintf("pm2 jlist | grep agent-%d", agentID)
	output, err := b.ExecuteCommand(statusCmd)
	return output, err
}

// UpdateBotConfig actualiza la configuración del bot
func (b *BotDeployService) UpdateBotConfig(agent *models.Agent) error {
	fmt.Printf("\n[UPDATE] Actualizando configuración del agente %d...\n", agent.ID)

	envContent := b.generateEnvFile(agent)
	flowContent := b.generateFlowFile(agent)

	fmt.Println("[FILES] Escribiendo nuevo .env...")
	writeEnvCmd := fmt.Sprintf(`cat > /opt/agent-%d/base-ts-meta-memory/.env << 'EOF'
%s
EOF`, agent.ID, envContent)

	if _, err := b.ExecuteCommand(writeEnvCmd); err != nil {
		return err
	}
	fmt.Println("✅ .env actualizado")

	fmt.Println("[FILES] Escribiendo nuevo flow...")
	writeFlowCmd := fmt.Sprintf(`cat > /opt/agent-%d/base-ts-meta-memory/src/flows/main.flow.ts << 'EOF'
%s
EOF`, agent.ID, flowContent)

	if _, err := b.ExecuteCommand(writeFlowCmd); err != nil {
		return err
	}
	fmt.Println("✅ Flow actualizado")

	fmt.Println("[BUILD] Recompilando TypeScript...")
	rebuildCmd := fmt.Sprintf("cd /opt/agent-%d/base-ts-meta-memory && npm run build", agent.ID)
	if err := b.ExecuteCommandWithRealtimeOutput(rebuildCmd, "[BUILD]"); err != nil {
		return err
	}
	fmt.Println("✅ Código recompilado")

	fmt.Println("[PM2] Reiniciando bot...")
	if err := b.RestartBot(agent.ID); err != nil {
		return err
	}

	fmt.Printf("✅ Agente %d actualizado exitosamente\n", agent.ID)
	return nil
}
