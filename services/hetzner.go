package services

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"strings"
	"time"
)

// HetznerService maneja la interacción con la API de Hetzner
type HetznerService struct {
	apiToken string
	client   *http.Client
}

// ServerResponse respuesta de la API de Hetzner al crear servidor
type ServerResponse struct {
	Server struct {
		ID        int    `json:"id"`
		Name      string `json:"name"`
		Status    string `json:"status"`
		PublicNet struct {
			IPv4 struct {
				IP string `json:"ip"`
			} `json:"ipv4"`
		} `json:"public_net"`
	} `json:"server"`
	RootPassword string `json:"root_password"`
}

// ServerStatusResponse respuesta al consultar estado del servidor
type ServerStatusResponse struct {
	Server struct {
		ID        int    `json:"id"`
		Status    string `json:"status"`
		PublicNet struct {
			IPv4 struct {
				IP string `json:"ip"`
			} `json:"ipv4"`
		} `json:"public_net"`
	} `json:"server"`
}

// NewHetznerService crea una nueva instancia del servicio
func NewHetznerService() (*HetznerService, error) {
	apiToken := os.Getenv("HETZNER_API_TOKEN")
	if apiToken == "" {
		return nil, errors.New("HETZNER_API_TOKEN no está configurado")
	}

	return &HetznerService{
		apiToken: apiToken,
		client: &http.Client{
			Timeout: 30 * time.Second,
		},
	}, nil
}

// CreateServer crea un nuevo servidor en Hetzner
func (h *HetznerService) CreateServer(agentName string, agentID uint) (*ServerResponse, error) {
	url := "https://api.hetzner.cloud/v1/servers"

	payload := map[string]interface{}{
		"name":        fmt.Sprintf("agent-%d-%s", agentID, agentName),
		"server_type": "cx23",
		"image":       "ubuntu-22.04",
		"location":    "nbg1",
		"ssh_keys":    []string{},
		"user_data":   h.getCloudInitScript(agentName, agentID),
		"labels": map[string]string{
			"agent_id":   fmt.Sprintf("%d", agentID),
			"agent_name": agentName,
		},
	}

	jsonData, err := json.Marshal(payload)
	if err != nil {
		return nil, err
	}

	req, err := http.NewRequest("POST", url, bytes.NewBuffer(jsonData))
	if err != nil {
		return nil, err
	}

	req.Header.Set("Authorization", "Bearer "+h.apiToken)
	req.Header.Set("Content-Type", "application/json")

	resp, err := h.client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	if resp.StatusCode != http.StatusCreated {
		return nil, fmt.Errorf("error al crear servidor: %s - %s", resp.Status, string(body))
	}

	var serverResp ServerResponse
	if err := json.Unmarshal(body, &serverResp); err != nil {
		return nil, err
	}

	return &serverResp, nil
}

// getCloudInitScript genera el script de inicialización COMPLETO Y ROBUSTO
func (h *HetznerService) getCloudInitScript(agentName string, agentID uint) string {
	// Escapar comillas simples en el nombre del agente
	escapedName := strings.ReplaceAll(agentName, "'", "'\\''")

	return `#cloud-config

chpasswd:
  expire: false

ssh_pwauth: true

package_update: true
package_upgrade: false

packages:
  - curl
  - git
  - ca-certificates
  - gnupg
  - build-essential

runcmd:
  - mkdir -p /var/log/attomos /opt/agents
  - echo "INICIO" > /var/log/attomos/init.log
  - date >> /var/log/attomos/init.log
  - echo "PHASE_1_START" > /var/log/attomos/status
  - chage -I -1 -m 0 -M 99999 -E -1 root
  - echo "PHASE_2_NODEJS" > /var/log/attomos/status
  - curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key | gpg --dearmor -o /etc/apt/keyrings/nodesource.gpg
  - echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_20.x nodistro main" > /etc/apt/sources.list.d/nodesource.list
  - apt-get update -y >> /var/log/attomos/init.log 2>&1
  - DEBIAN_FRONTEND=noninteractive apt-get install -y nodejs >> /var/log/attomos/init.log 2>&1
  - sleep 3
  - node --version >> /var/log/attomos/init.log 2>&1
  - npm --version >> /var/log/attomos/init.log 2>&1
  - echo "PHASE_3_PM2" > /var/log/attomos/status
  - npm install -g pm2 >> /var/log/attomos/init.log 2>&1
  - sleep 3
  - pm2 --version >> /var/log/attomos/init.log 2>&1
  - echo "PHASE_4_CONFIG" > /var/log/attomos/status
  - echo "export AGENT_ID=` + fmt.Sprintf("%d", agentID) + `" >> /root/.bashrc
  - echo "export AGENT_NAME='` + escapedName + `'" >> /root/.bashrc
  - ufw --force enable >> /var/log/attomos/init.log 2>&1 || true
  - ufw allow 22/tcp >> /var/log/attomos/init.log 2>&1 || true
  - ufw allow 80/tcp >> /var/log/attomos/init.log 2>&1 || true
  - ufw allow 443/tcp >> /var/log/attomos/init.log 2>&1 || true
  - ufw allow 3000/tcp >> /var/log/attomos/init.log 2>&1 || true
  - echo "fs.file-max = 100000" >> /etc/sysctl.conf
  - echo "net.core.somaxconn = 1024" >> /etc/sysctl.conf
  - sysctl -p >> /var/log/attomos/init.log 2>&1 || true
  - echo "PHASE_5_HEALTH_CHECK" > /var/log/attomos/status
  - echo '#!/bin/bash' > /opt/health_check.sh
  - echo 'echo "=== HEALTH CHECK ==="' >> /opt/health_check.sh
  - echo 'command -v node && echo "Node OK" || exit 1' >> /opt/health_check.sh
  - echo 'command -v npm && echo "NPM OK" || exit 1' >> /opt/health_check.sh
  - echo 'command -v pm2 && echo "PM2 OK" || exit 1' >> /opt/health_check.sh
  - echo '[ -f /var/log/attomos/status ] && cat /var/log/attomos/status' >> /opt/health_check.sh
  - echo '[ "$(cat /var/log/attomos/status)" = "CLOUD_INIT_COMPLETE" ] && echo "SERVIDOR LISTO PARA DESPLEGAR BOTS" && exit 0' >> /opt/health_check.sh
  - echo 'exit 2' >> /opt/health_check.sh
  - chmod +x /opt/health_check.sh
  - echo "CLOUD_INIT_COMPLETE" > /var/log/attomos/status
  - date >> /var/log/attomos/init.log
  - echo "COMPLETADO" >> /var/log/attomos/init.log
`
}

// WaitForServer espera a que el servidor esté en estado "running"
func (h *HetznerService) WaitForServer(serverID int, maxWaitTime time.Duration) error {
	fmt.Println("\n╔═══════════════════════════════════════════════════════════════╗")
	fmt.Println("║      ⏳ ESPERANDO QUE SERVIDOR ESTÉ EN ESTADO 'RUNNING'       ║")
	fmt.Println("╚═══════════════════════════════════════════════════════════════╝")

	url := fmt.Sprintf("https://api.hetzner.cloud/v1/servers/%d", serverID)

	startTime := time.Now()
	ticker := time.NewTicker(5 * time.Second)
	defer ticker.Stop()

	attempt := 0
	lastStatus := ""

	for range ticker.C {
		attempt++
		elapsed := time.Since(startTime).Round(time.Second)

		if elapsed > maxWaitTime {
			fmt.Println("\n❌ TIMEOUT: Servidor no alcanzó estado 'running'")
			return errors.New("timeout esperando que el servidor esté en estado running")
		}

		req, err := http.NewRequest("GET", url, nil)
		if err != nil {
			fmt.Printf("⚠️  [Intento %d] Error creando request: %v\n", attempt, err)
			continue
		}

		req.Header.Set("Authorization", "Bearer "+h.apiToken)

		resp, err := h.client.Do(req)
		if err != nil {
			fmt.Printf("⚠️  [Intento %d] Error en petición HTTP: %v\n", attempt, err)
			continue
		}

		body, _ := io.ReadAll(resp.Body)
		resp.Body.Close()

		var statusResp ServerStatusResponse
		if err := json.Unmarshal(body, &statusResp); err != nil {
			fmt.Printf("⚠️  [Intento %d] Error parseando respuesta: %v\n", attempt, err)
			continue
		}

		currentStatus := statusResp.Server.Status

		if currentStatus != lastStatus {
			fmt.Printf("\n🔄 [%v] Cambio de estado: '%s' → '%s'\n", elapsed, lastStatus, currentStatus)
			lastStatus = currentStatus
		} else if attempt%3 == 0 {
			fmt.Printf("⏱️  [%v] Estado actual: '%s' - Esperando 'running'...\n", elapsed, currentStatus)
		}

		if currentStatus == "running" {
			fmt.Println("\n╔═══════════════════════════════════════════════════════════════╗")
			fmt.Println("║           ✅ SERVIDOR EN ESTADO 'RUNNING'                      ║")
			fmt.Println("╚═══════════════════════════════════════════════════════════════╝")
			fmt.Printf("⏱️  Tiempo total: %v\n", elapsed)
			fmt.Printf("📊 Intentos: %d\n", attempt)
			fmt.Println("\n💡 Nota: Cloud-init continuará ejecutándose en segundo plano")
			return nil
		}
	}

	return errors.New("timeout esperando que el servidor esté listo")
}

// DeleteServer elimina un servidor
func (h *HetznerService) DeleteServer(serverID int) error {
	url := fmt.Sprintf("https://api.hetzner.cloud/v1/servers/%d", serverID)

	req, err := http.NewRequest("DELETE", url, nil)
	if err != nil {
		return err
	}

	req.Header.Set("Authorization", "Bearer "+h.apiToken)

	resp, err := h.client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusNoContent {
		body, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("error al eliminar servidor: %s - %s", resp.Status, string(body))
	}

	return nil
}

// GetServerInfo obtiene información de un servidor
func (h *HetznerService) GetServerInfo(serverID int) (*ServerStatusResponse, error) {
	url := fmt.Sprintf("https://api.hetzner.cloud/v1/servers/%d", serverID)

	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return nil, err
	}

	req.Header.Set("Authorization", "Bearer "+h.apiToken)

	resp, err := h.client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("error al obtener info del servidor: %s", resp.Status)
	}

	var statusResp ServerStatusResponse
	if err := json.Unmarshal(body, &statusResp); err != nil {
		return nil, err
	}

	return &statusResp, nil
}
