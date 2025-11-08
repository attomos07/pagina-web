package services

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
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

	// Configuración del servidor
	// CX23: 2 vCPU, 4GB RAM, 40GB SSD (~€2.99/mes) - RECOMENDADO para bots de WhatsApp
	payload := map[string]interface{}{
		"name":        fmt.Sprintf("agent-%d-%s", agentID, agentName),
		"server_type": "cx23", // Actualizado a CX23
		"image":       "ubuntu-22.04",
		"location":    "nbg1",     // Nuremberg, Alemania
		"ssh_keys":    []string{}, // Agregar tus SSH keys si las tienes
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

// getCloudInitScript genera el script de inicialización del servidor
func (h *HetznerService) getCloudInitScript(agentName string, agentID uint) string {
	return fmt.Sprintf(`#cloud-config
# Deshabilitar expiración de contraseña y configurar acceso SSH
chpasswd:
  expire: false

# Configurar SSH para permitir autenticación por contraseña
ssh_pwauth: true

# Comandos a ejecutar al inicio
runcmd:
  # Deshabilitar la expiración de contraseña para root
  - chage -I -1 -m 0 -M 99999 -E -1 root
  # Actualizar sistema e instalar dependencias
  - apt-get update
  - apt-get install -y curl git
  # Instalar Node.js 20.x
  - curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  - apt-get install -y nodejs
  # Instalar PM2 globalmente
  - npm install -g pm2
  # Crear directorio para el agente
  - mkdir -p /opt/agent-%d
  - cd /opt/agent-%d
  - echo "Agent %s initialized" > /opt/agent-%d/init.log
  # Configurar variables de entorno
  - echo "export AGENT_ID=%d" >> /root/.bashrc
  - echo "export AGENT_NAME='%s'" >> /root/.bashrc
`, agentID, agentID, agentName, agentID, agentID, agentName)
}

// WaitForServer espera a que el servidor esté listo
func (h *HetznerService) WaitForServer(serverID int, maxWaitTime time.Duration) error {
	url := fmt.Sprintf("https://api.hetzner.cloud/v1/servers/%d", serverID)

	startTime := time.Now()
	ticker := time.NewTicker(5 * time.Second)
	defer ticker.Stop()

	for range ticker.C {
		// Verificar timeout
		if time.Since(startTime) > maxWaitTime {
			return errors.New("timeout esperando que el servidor esté listo")
		}

		// Hacer petición a la API
		req, err := http.NewRequest("GET", url, nil)
		if err != nil {
			continue
		}

		req.Header.Set("Authorization", "Bearer "+h.apiToken)

		resp, err := h.client.Do(req)
		if err != nil {
			continue
		}

		body, _ := io.ReadAll(resp.Body)
		resp.Body.Close()

		var statusResp ServerStatusResponse
		if err := json.Unmarshal(body, &statusResp); err != nil {
			continue
		}

		// Servidor está listo
		if statusResp.Server.Status == "running" {
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
