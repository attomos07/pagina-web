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
func (h *HetznerService) CreateServer(serverName string, userID uint) (*ServerResponse, error) {
	url := "https://api.hetzner.cloud/v1/servers"

	payload := map[string]interface{}{
		"name":        fmt.Sprintf("user-%d-server", userID),
		"server_type": "cx23", // 4GB RAM - suficiente para Docker, Chatwoot y bots
		"image":       "ubuntu-22.04",
		"location":    "nbg1",
		"ssh_keys":    []string{},
		"user_data":   h.getCloudInitScript(serverName, userID),
		"labels": map[string]string{
			"user_id":     fmt.Sprintf("%d", userID),
			"server_name": serverName,
			"type":        "shared-server",
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

// getCloudInitScript genera el script de inicialización CON CHATWOOT
func (h *HetznerService) getCloudInitScript(agentName string, userID uint) string {
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
  - nginx
  - certbot
  - python3-certbot-nginx
  - apt-transport-https
  - software-properties-common

runcmd:
  # === FASE 1: SETUP INICIAL ===
  - mkdir -p /var/log/attomos /opt/agents /opt/chatwoot
  - echo "INICIO" > /var/log/attomos/init.log
  - date >> /var/log/attomos/init.log
  - echo "PHASE_1_START" > /var/log/attomos/status
  - chage -I -1 -m 0 -M 99999 -E -1 root
  
  # === FASE 2: INSTALAR DOCKER ===
  - echo "PHASE_2_DOCKER" > /var/log/attomos/status
  - curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg
  - echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" > /etc/apt/sources.list.d/docker.list
  - apt-get update -y >> /var/log/attomos/init.log 2>&1
  - DEBIAN_FRONTEND=noninteractive apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin >> /var/log/attomos/init.log 2>&1
  - systemctl enable docker >> /var/log/attomos/init.log 2>&1
  - systemctl start docker >> /var/log/attomos/init.log 2>&1
  - docker --version >> /var/log/attomos/init.log 2>&1
  
  # === FASE 3: INSTALAR NODE.JS Y PM2 ===
  - echo "PHASE_3_NODEJS" > /var/log/attomos/status
  - curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key | gpg --dearmor -o /etc/apt/keyrings/nodesource.gpg
  - echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_20.x nodistro main" > /etc/apt/sources.list.d/nodesource.list
  - apt-get update -y >> /var/log/attomos/init.log 2>&1
  - DEBIAN_FRONTEND=noninteractive apt-get install -y nodejs >> /var/log/attomos/init.log 2>&1
  - sleep 3
  - node --version >> /var/log/attomos/init.log 2>&1
  - npm --version >> /var/log/attomos/init.log 2>&1
  - npm install -g pm2 >> /var/log/attomos/init.log 2>&1
  - sleep 3
  - pm2 --version >> /var/log/attomos/init.log 2>&1
  
  # === FASE 4: CONFIGURAR CHATWOOT ===
  - echo "PHASE_4_CHATWOOT" > /var/log/attomos/status
  - cd /opt/chatwoot
  - |
    cat > docker-compose.yml << 'EOFCOMPOSE'
    version: '3'
    
    services:
      postgres:
        image: postgres:12
        restart: always
        volumes:
          - ./data/postgres:/var/lib/postgresql/data
        environment:
          - POSTGRES_DB=chatwoot
          - POSTGRES_USER=postgres
          - POSTGRES_PASSWORD=chatwoot_postgres_password
        networks:
          - chatwoot
    
      redis:
        image: redis:alpine
        restart: always
        command: ["sh", "-c", "redis-server --requirepass chatwoot_redis_password"]
        volumes:
          - ./data/redis:/data
        networks:
          - chatwoot
    
      chatwoot:
        image: chatwoot/chatwoot:latest
        restart: always
        depends_on:
          - postgres
          - redis
        ports:
          - "3000:3000"
        environment:
          - NODE_ENV=production
          - RAILS_ENV=production
          - INSTALLATION_ENV=docker
          - SECRET_KEY_BASE=replace_with_random_string_min_30_chars
          - FRONTEND_URL=https://chat-user` + fmt.Sprintf("%d", userID) + `.attomos.com
          - POSTGRES_HOST=postgres
          - POSTGRES_PORT=5432
          - POSTGRES_DATABASE=chatwoot
          - POSTGRES_USERNAME=postgres
          - POSTGRES_PASSWORD=chatwoot_postgres_password
          - REDIS_URL=redis://:chatwoot_redis_password@redis:6379
          - REDIS_PASSWORD=chatwoot_redis_password
          - MAILER_SENDER_EMAIL=noreply@attomos.com
          - SMTP_DOMAIN=attomos.com
          - ACTIVE_STORAGE_SERVICE=local
        volumes:
          - ./data/storage:/app/storage
        networks:
          - chatwoot
        entrypoint: docker/entrypoints/rails.sh
        command: ['bundle', 'exec', 'rails', 's', '-p', '3000', '-b', '0.0.0.0']
    
      sidekiq:
        image: chatwoot/chatwoot:latest
        restart: always
        depends_on:
          - postgres
          - redis
        environment:
          - NODE_ENV=production
          - RAILS_ENV=production
          - INSTALLATION_ENV=docker
          - SECRET_KEY_BASE=replace_with_random_string_min_30_chars
          - FRONTEND_URL=https://chat-user` + fmt.Sprintf("%d", userID) + `.attomos.com
          - POSTGRES_HOST=postgres
          - POSTGRES_PORT=5432
          - POSTGRES_DATABASE=chatwoot
          - POSTGRES_USERNAME=postgres
          - POSTGRES_PASSWORD=chatwoot_postgres_password
          - REDIS_URL=redis://:chatwoot_redis_password@redis:6379
          - REDIS_PASSWORD=chatwoot_redis_password
          - MAILER_SENDER_EMAIL=noreply@attomos.com
          - SMTP_DOMAIN=attomos.com
        volumes:
          - ./data/storage:/app/storage
        networks:
          - chatwoot
        command: ['bundle', 'exec', 'sidekiq', '-C', 'config/sidekiq.yml']
    
    networks:
      chatwoot:
    EOFCOMPOSE
  - docker compose up -d >> /var/log/attomos/init.log 2>&1
  - echo "Esperando a que los containers inicien..." >> /var/log/attomos/init.log 2>&1
  - sleep 30
  - echo "Inicializando base de datos de Chatwoot..." >> /var/log/attomos/init.log 2>&1
  - docker compose exec -T chatwoot bundle exec rails db:chatwoot_prepare >> /var/log/attomos/init.log 2>&1 || echo "DB already initialized" >> /var/log/attomos/init.log 2>&1
  - sleep 10
  - echo "Chatwoot setup completed" >> /var/log/attomos/init.log 2>&1
  
  # === FASE 5: CONFIGURAR NGINX ===
  - echo "PHASE_5_NGINX" > /var/log/attomos/status
  - |
    cat > /etc/nginx/sites-available/chatwoot << 'EOFNGINX'
    server {
        listen 80;
        server_name chat-user` + fmt.Sprintf("%d", userID) + `.attomos.com;
        
        location / {
            proxy_pass http://localhost:3000;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection 'upgrade';
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            proxy_cache_bypass $http_upgrade;
        }
    }
    EOFNGINX
  - ln -sf /etc/nginx/sites-available/chatwoot /etc/nginx/sites-enabled/
  - nginx -t >> /var/log/attomos/init.log 2>&1
  - systemctl restart nginx >> /var/log/attomos/init.log 2>&1
  
  # === FASE 6: FIREWALL ===
  - echo "PHASE_6_FIREWALL" > /var/log/attomos/status
  - ufw --force enable >> /var/log/attomos/init.log 2>&1 || true
  - ufw allow 22/tcp >> /var/log/attomos/init.log 2>&1 || true
  - ufw allow 80/tcp >> /var/log/attomos/init.log 2>&1 || true
  - ufw allow 443/tcp >> /var/log/attomos/init.log 2>&1 || true
  - ufw allow 3001:3020/tcp >> /var/log/attomos/init.log 2>&1 || true
  
  # === FASE 7: SERVER CONFIG ===
  - echo "PHASE_7_CONFIG" > /var/log/attomos/status
  - echo "export USER_ID=` + fmt.Sprintf("%d", userID) + `" >> /root/.bashrc
  - echo "export SERVER_NAME='` + escapedName + `'" >> /root/.bashrc
  - echo "fs.file-max = 100000" >> /etc/sysctl.conf
  - echo "net.core.somaxconn = 1024" >> /etc/sysctl.conf
  - sysctl -p >> /var/log/attomos/init.log 2>&1 || true
  
  # === FASE 8: HEALTH CHECK ===
  - echo "PHASE_8_HEALTH_CHECK" > /var/log/attomos/status
  - |
    cat > /opt/health_check.sh << 'EOFHEALTH'
    #!/bin/bash
    echo "=== HEALTH CHECK ==="
    command -v node && echo "Node OK" || exit 1
    command -v npm && echo "NPM OK" || exit 1
    command -v pm2 && echo "PM2 OK" || exit 1
    command -v docker && echo "Docker OK" || exit 1
    docker ps | grep chatwoot && echo "Chatwoot OK" || exit 1
    [ -f /var/log/attomos/status ] && cat /var/log/attomos/status
    [ "$(cat /var/log/attomos/status)" = "CLOUD_INIT_COMPLETE" ] && echo "SERVIDOR LISTO PARA DESPLEGAR BOTS" && exit 0
    exit 2
    EOFHEALTH
  - chmod +x /opt/health_check.sh
  
  # === COMPLETADO ===
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
