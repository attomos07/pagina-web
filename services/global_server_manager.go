package services

import (
	"attomos/config"
	"attomos/models"
	"fmt"
	"log"
	"strings"
	"sync"
	"time"
)

// GlobalServerManager gestiona el servidor compartido global para AtomicBots
type GlobalServerManager struct {
	mu sync.Mutex
}

var (
	serverManager     *GlobalServerManager
	serverManagerOnce sync.Once
)

// GetGlobalServerManager obtiene la instancia singleton del manager
func GetGlobalServerManager() *GlobalServerManager {
	serverManagerOnce.Do(func() {
		serverManager = &GlobalServerManager{}
	})
	return serverManager
}

// GetOrCreateAtomicBotsServer obtiene o crea el servidor compartido para AtomicBots
func (gsm *GlobalServerManager) GetOrCreateAtomicBotsServer() (*models.GlobalServer, error) {
	gsm.mu.Lock()
	defer gsm.mu.Unlock()

	// PASO 1: Buscar servidor READY con capacidad disponible
	var server models.GlobalServer
	err := config.DB.Where(
		"purpose = ? AND status = ? AND current_agents < max_agents",
		"atomic-bots",
		"ready",
	).Order("current_agents ASC").First(&server).Error

	if err == nil {
		// Servidor encontrado con capacidad
		log.Printf("✅ [GlobalServer] Reutilizando servidor compartido: ID=%d, IP=%s, Status=%s, Agentes=%d/%d",
			server.ID, server.IPAddress, server.Status, server.CurrentAgents, server.MaxAgents)
		return &server, nil
	}

	// PASO 2: Buscar servidor INITIALIZING (esperando a que esté listo)
	err = config.DB.Where(
		"purpose = ? AND status = ?",
		"atomic-bots",
		"initializing",
	).Order("created_at DESC").First(&server).Error

	if err == nil {
		// Hay un servidor inicializándose, reutilizarlo
		log.Printf("⏳ [GlobalServer] Servidor en inicialización encontrado: ID=%d, IP=%s, Status=%s",
			server.ID, server.IPAddress, server.Status)
		return &server, nil
	}

	// PASO 3: No existe servidor disponible, crear uno nuevo
	log.Println("🆕 [GlobalServer] No hay servidores disponibles - Creando nuevo servidor compartido...")

	// Crear servidor en Hetzner
	hetznerService, err := NewHetznerService()
	if err != nil {
		return nil, fmt.Errorf("error inicializando Hetzner: %w", err)
	}

	serverName := fmt.Sprintf("attomos-atomic-bots-global-%d", time.Now().Unix())
	hetznerResp, err := hetznerService.CreateAtomicBotsGlobalServer(serverName)
	if err != nil {
		return nil, fmt.Errorf("error creando servidor en Hetzner: %w", err)
	}

	// Crear registro en BD
	server = models.GlobalServer{
		Name:            serverName,
		Purpose:         "atomic-bots",
		HetznerServerID: hetznerResp.Server.ID,
		IPAddress:       hetznerResp.Server.PublicNet.IPv4.IP,
		RootPassword:    hetznerResp.RootPassword,
		Status:          "initializing",
		MaxAgents:       100,
		CurrentAgents:   0,
		NextPortNumber:  3001,
		BasePort:        3001,
		MaxPort:         3100,
	}

	if err := config.DB.Create(&server).Error; err != nil {
		// Intentar eliminar servidor de Hetzner si falla BD
		hetznerService.DeleteServer(hetznerResp.Server.ID)
		return nil, fmt.Errorf("error guardando servidor en BD: %w", err)
	}

	log.Printf("✅ [GlobalServer] Servidor compartido creado: ID=%d, Hetzner ID=%d, IP=%s",
		server.ID, server.HetznerServerID, server.IPAddress)

	// Esperar a que el servidor esté ready (en goroutine para no bloquear)
	go gsm.waitAndMarkServerReady(&server, hetznerService)

	return &server, nil
}

// waitAndMarkServerReady espera a que el servidor esté listo y actualiza su estado
func (gsm *GlobalServerManager) waitAndMarkServerReady(server *models.GlobalServer, hetznerService *HetznerService) {
	log.Printf("⏳ [GlobalServer %d] Esperando que el servidor esté en estado 'running'...", server.ID)

	// Esperar a que Hetzner reporte el servidor como running (máximo 5 minutos)
	if err := hetznerService.WaitForServer(server.HetznerServerID, 5*time.Minute); err != nil {
		log.Printf("❌ [GlobalServer %d] Error esperando servidor: %v", server.ID, err)
		gsm.mu.Lock()
		server.MarkAsError()
		config.DB.Save(server)
		gsm.mu.Unlock()
		return
	}

	log.Printf("✅ [GlobalServer %d] Servidor en estado 'running'", server.ID)

	// Monitorear cloud-init logs (no bloqueante)
	go hetznerService.MonitorCloudInitLogs(server.IPAddress, server.RootPassword, 10*time.Minute)

	// Esperar a que cloud-init termine (con verificación inteligente)
	log.Printf("⏳ [GlobalServer %d] Esperando cloud-init (verificando cada 2 minutos)...", server.ID)

	maxAttempts := 15 // 15 intentos × 2 min = 30 minutos máximo
	attempt := 0

	for attempt < maxAttempts {
		attempt++

		// Esperar 2 minutos entre verificaciones
		if attempt > 1 {
			log.Printf("⏳ [GlobalServer %d] Intento %d/%d - Esperando 2 minutos...", server.ID, attempt, maxAttempts)
			time.Sleep(2 * time.Minute)
		} else {
			// Primera vez esperar solo 1 minuto (dar tiempo para que SSH esté disponible)
			log.Printf("⏳ [GlobalServer %d] Primera verificación - Esperando 1 minuto...", server.ID)
			time.Sleep(1 * time.Minute)
		}

		// Verificar si el servidor está listo
		log.Printf("🔍 [GlobalServer %d] Verificando estado del servidor (intento %d/%d)...", server.ID, attempt, maxAttempts)

		if err := gsm.verifyServerReady(server); err != nil {
			log.Printf("⚠️  [GlobalServer %d] Intento %d/%d - Servidor aún no listo: %v", server.ID, attempt, maxAttempts, err)

			// Si es el último intento, marcar como error
			if attempt >= maxAttempts {
				log.Printf("❌ [GlobalServer %d] Timeout después de %d intentos (%d minutos)",
					server.ID, maxAttempts, maxAttempts*2)
				gsm.mu.Lock()
				server.MarkAsError()
				config.DB.Save(server)
				gsm.mu.Unlock()
				return
			}

			// Continuar esperando
			continue
		}

		// Servidor listo!
		break
	}

	// Marcar como ready
	gsm.mu.Lock()
	server.MarkAsReady()
	config.DB.Save(server)
	gsm.mu.Unlock()

	log.Printf("🎉 [GlobalServer %d] Servidor compartido de AtomicBots LISTO PARA DESPLIEGUES", server.ID)
	log.Printf("📊 [GlobalServer %d] Tiempo total de inicialización: ~%d minutos", server.ID, attempt*2)
}

// verifyServerReady verifica que el servidor esté completamente inicializado
func (gsm *GlobalServerManager) verifyServerReady(server *models.GlobalServer) error {
	// Conectar por SSH y verificar
	atomicService := NewAtomicBotDeployService(server.IPAddress, server.RootPassword)

	if err := atomicService.Connect(); err != nil {
		return fmt.Errorf("error conectando por SSH: %w", err)
	}
	defer atomicService.Close()

	// PASO 1: Verificar que cloud-init haya terminado
	log.Printf("   🔍 [GlobalServer %d] [1/3] Verificando cloud-init...", server.ID)
	cloudInitCmd := `cloud-init status --wait 2>&1 || echo "TIMEOUT"`
	output, err := atomicService.executeCommand(cloudInitCmd)
	if err != nil || strings.Contains(output, "TIMEOUT") {
		return fmt.Errorf("cloud-init aún no termina")
	}
	if !strings.Contains(output, "done") && !strings.Contains(output, "status: done") {
		return fmt.Errorf("cloud-init en progreso: %s", strings.TrimSpace(output))
	}
	log.Printf("   ✅ [GlobalServer %d] Cloud-init completado", server.ID)

	// PASO 2: Verificar que Go esté instalado y funcional
	log.Printf("   🔍 [GlobalServer %d] [2/3] Verificando Go...", server.ID)
	goCmd := `export PATH=$PATH:/usr/local/go/bin && go version 2>&1`
	goOutput, err := atomicService.executeCommand(goCmd)
	if err != nil || !strings.Contains(goOutput, "go version") {
		return fmt.Errorf("Go no está instalado correctamente: %s", strings.TrimSpace(goOutput))
	}
	log.Printf("   ✅ [GlobalServer %d] Go instalado: %s", server.ID, strings.TrimSpace(goOutput))

	// PASO 3: Verificar que GCC esté instalado
	log.Printf("   🔍 [GlobalServer %d] [3/3] Verificando GCC...", server.ID)
	gccCmd := `gcc --version 2>&1`
	gccOutput, err := atomicService.executeCommand(gccCmd)
	if err != nil || !strings.Contains(gccOutput, "gcc") {
		return fmt.Errorf("GCC no está instalado correctamente: %s", strings.TrimSpace(gccOutput))
	}
	gccVersion := strings.Split(gccOutput, "\n")[0]
	log.Printf("   ✅ [GlobalServer %d] GCC instalado: %s", server.ID, gccVersion)

	log.Printf("✅ [GlobalServer %d] Health check exitoso - Servidor completamente listo", server.ID)
	return nil
}

// AssignPortToAgent asigna un puerto disponible a un agente
func (gsm *GlobalServerManager) AssignPortToAgent(server *models.GlobalServer) (int, error) {
	gsm.mu.Lock()
	defer gsm.mu.Unlock()

	// Verificar capacidad
	if server.IsAtCapacity() {
		return 0, fmt.Errorf("servidor a capacidad máxima (%d/%d agentes)", server.CurrentAgents, server.MaxAgents)
	}

	// Obtener siguiente puerto
	port := server.GetNextPort()

	// Incrementar contadores
	server.IncrementAgentCount()

	// Guardar en BD
	if err := config.DB.Save(server).Error; err != nil {
		return 0, fmt.Errorf("error guardando servidor: %w", err)
	}

	log.Printf("📍 [GlobalServer %d] Puerto asignado: %d (Agentes: %d/%d)",
		server.ID, port, server.CurrentAgents, server.MaxAgents)

	return port, nil
}

// ReleaseAgentPort libera el puerto de un agente eliminado
func (gsm *GlobalServerManager) ReleaseAgentPort(server *models.GlobalServer) error {
	gsm.mu.Lock()
	defer gsm.mu.Unlock()

	server.DecrementAgentCount()

	if err := config.DB.Save(server).Error; err != nil {
		return fmt.Errorf("error guardando servidor: %w", err)
	}

	log.Printf("📍 [GlobalServer %d] Puerto liberado (Agentes: %d/%d)",
		server.ID, server.CurrentAgents, server.MaxAgents)

	return nil
}

// GetServerStatus obtiene el estado actual del servidor
func (gsm *GlobalServerManager) GetServerStatus(serverID uint) (*models.GlobalServer, error) {
	var server models.GlobalServer
	if err := config.DB.First(&server, serverID).Error; err != nil {
		return nil, err
	}
	return &server, nil
}

// ListAllServers lista todos los servidores globales
func (gsm *GlobalServerManager) ListAllServers() ([]models.GlobalServer, error) {
	var servers []models.GlobalServer
	if err := config.DB.Where("purpose = ?", "atomic-bots").Order("created_at DESC").Find(&servers).Error; err != nil {
		return nil, err
	}
	return servers, nil
}

// GetServerMetrics obtiene métricas del servidor
func (gsm *GlobalServerManager) GetServerMetrics(server *models.GlobalServer) map[string]interface{} {
	utilizationPercent := float64(server.CurrentAgents) / float64(server.MaxAgents) * 100

	return map[string]interface{}{
		"server_id":          server.ID,
		"ip_address":         server.IPAddress,
		"status":             server.Status,
		"current_agents":     server.CurrentAgents,
		"max_agents":         server.MaxAgents,
		"utilization":        fmt.Sprintf("%.1f%%", utilizationPercent),
		"available_capacity": server.MaxAgents - server.CurrentAgents,
		"port_range":         fmt.Sprintf("%d-%d", server.BasePort, server.MaxPort),
		"next_port":          server.NextPortNumber,
		"is_ready":           server.IsReady(),
		"is_at_capacity":     server.IsAtCapacity(),
	}
}
