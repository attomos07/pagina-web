package services

import (
	"bytes"
	"crypto/rand"
	"encoding/json"
	"fmt"
	"io"
	"math/big"
	mathrand "math/rand"
	"net/http"
	"strings"
	"time"

	"attomos/models"

	"golang.org/x/crypto/ssh"
)

type ChatwootService struct {
	serverIP       string
	baseURL        string
	userID         uint
	httpClient     *http.Client
	serverPassword string
}

type ChatwootAccount struct {
	ID     int    `json:"id"`
	Name   string `json:"name"`
	Locale string `json:"locale"`
}

type ChatwootUser struct {
	ID                int    `json:"id"`
	Email             string `json:"email"`
	Name              string `json:"name"`
	AccountID         int    `json:"account_id"`
	Role              string `json:"role"`
	AccessToken       string `json:"access_token,omitempty"`
	ConfirmationToken string `json:"confirmation_token,omitempty"`
}

type ChatwootInbox struct {
	ID          int    `json:"id"`
	Name        string `json:"name"`
	ChannelType string `json:"channel_type"`
	WebhookURL  string `json:"webhook_url,omitempty"`
}

type ChatwootCredentials struct {
	Email       string `json:"email"`
	Password    string `json:"password"`
	AccountID   int    `json:"accountId"`
	AccountName string `json:"accountName"`
	InboxID     int    `json:"inboxId"`
	InboxName   string `json:"inboxName"`
	ChatwootURL string `json:"chatwootUrl"`
}

// NewChatwootService crea una nueva instancia del servicio
func NewChatwootService(serverIP string, userID uint, password string) *ChatwootService {
	return &ChatwootService{
		serverIP:       serverIP,
		baseURL:        fmt.Sprintf("http://%s:3000", serverIP),
		userID:         userID,
		serverPassword: password,
		httpClient: &http.Client{
			Timeout: 60 * time.Second,
		},
	}
}

// executeSSHCommand ejecuta un comando en el servidor
func (c *ChatwootService) executeSSHCommand(command string) (string, error) {
	config := &ssh.ClientConfig{
		User: "root",
		Auth: []ssh.AuthMethod{
			ssh.Password(c.serverPassword),
		},
		HostKeyCallback: ssh.InsecureIgnoreHostKey(),
		Timeout:         30 * time.Second,
	}

	client, err := ssh.Dial("tcp", c.serverIP+":22", config)
	if err != nil {
		return "", fmt.Errorf("error conectando SSH: %v", err)
	}
	defer client.Close()

	session, err := client.NewSession()
	if err != nil {
		return "", fmt.Errorf("error creando sesión: %v", err)
	}
	defer session.Close()

	var stdout bytes.Buffer
	var stderr bytes.Buffer
	session.Stdout = &stdout
	session.Stderr = &stderr

	err = session.Run(command)
	output := stdout.String()
	if stderr.String() != "" {
		output += "\n" + stderr.String()
	}

	return output, err
}

// diagnoseChatwootFailure diagnostica por qué Chatwoot no está funcionando
func (c *ChatwootService) diagnoseChatwootFailure() {
	fmt.Println("\n╔═══════════════════════════════════════════════════════════════╗")
	fmt.Println("║           🔍 DIAGNÓSTICO AUTOMÁTICO DE CHATWOOT               ║")
	fmt.Println("╚═══════════════════════════════════════════════════════════════╝")

	// 1. Verificar si Docker está corriendo
	fmt.Println("\n1️⃣  VERIFICANDO DOCKER:")
	fmt.Println("────────────────────────────────────────────────────────────────")
	dockerStatus, err := c.executeSSHCommand("systemctl is-active docker")
	if err != nil {
		fmt.Printf("❌ Docker NO está corriendo: %v\n", err)
	} else {
		fmt.Printf("✅ Docker status: %s\n", strings.TrimSpace(dockerStatus))
	}

	// 2. Ver containers de Docker
	fmt.Println("\n2️⃣  CONTAINERS DE DOCKER:")
	fmt.Println("────────────────────────────────────────────────────────────────")
	containers, _ := c.executeSSHCommand("cd /opt/chatwoot && docker compose ps")
	fmt.Println(containers)

	// 3. Ver si docker-compose.yml existe
	fmt.Println("\n3️⃣  VERIFICANDO DOCKER-COMPOSE.YML:")
	fmt.Println("────────────────────────────────────────────────────────────────")
	composeExists, _ := c.executeSSHCommand("ls -lh /opt/chatwoot/docker-compose.yml")
	fmt.Println(composeExists)

	// 4. Ver logs de Chatwoot (últimas 100 líneas)
	fmt.Println("\n4️⃣  LOGS DE CHATWOOT (últimas 100 líneas):")
	fmt.Println("────────────────────────────────────────────────────────────────")
	chatwootLogs, _ := c.executeSSHCommand("cd /opt/chatwoot && docker compose logs chatwoot --tail=100 2>&1")
	if chatwootLogs == "" {
		fmt.Println("⚠️  No hay logs de Chatwoot disponibles")
	} else {
		fmt.Println(chatwootLogs)
	}

	// 5. Ver logs de PostgreSQL
	fmt.Println("\n5️⃣  LOGS DE POSTGRESQL (últimas 50 líneas):")
	fmt.Println("────────────────────────────────────────────────────────────────")
	postgresLogs, _ := c.executeSSHCommand("cd /opt/chatwoot && docker compose logs postgres --tail=50 2>&1")
	if postgresLogs == "" {
		fmt.Println("⚠️  No hay logs de PostgreSQL disponibles")
	} else {
		fmt.Println(postgresLogs)
	}

	// 6. Ver logs de Redis
	fmt.Println("\n6️⃣  LOGS DE REDIS (últimas 50 líneas):")
	fmt.Println("────────────────────────────────────────────────────────────────")
	redisLogs, _ := c.executeSSHCommand("cd /opt/chatwoot && docker compose logs redis --tail=50 2>&1")
	if redisLogs == "" {
		fmt.Println("⚠️  No hay logs de Redis disponibles")
	} else {
		fmt.Println(redisLogs)
	}

	// 7. Ver si el puerto 3000 está escuchando
	fmt.Println("\n7️⃣  PUERTO 3000:")
	fmt.Println("────────────────────────────────────────────────────────────────")
	port3000, _ := c.executeSSHCommand("ss -tlnp | grep :3000 || netstat -tlnp | grep :3000 || echo 'Puerto 3000 NO está escuchando'")
	fmt.Println(port3000)

	// 8. Intentar curl local
	fmt.Println("\n8️⃣  TEST CURL LOCAL:")
	fmt.Println("────────────────────────────────────────────────────────────────")
	curlTest, _ := c.executeSSHCommand("curl -v http://localhost:3000/api 2>&1")
	fmt.Println(curlTest)

	// 9. Ver log de inicialización (últimas 100 líneas)
	fmt.Println("\n9️⃣  LOG DE INICIALIZACIÓN (últimas 100 líneas):")
	fmt.Println("────────────────────────────────────────────────────────────────")
	initLog, _ := c.executeSSHCommand("tail -100 /var/log/attomos/init.log 2>&1")
	fmt.Println(initLog)

	// 10. Ver cloud-init status
	fmt.Println("\n🔟 CLOUD-INIT STATUS:")
	fmt.Println("────────────────────────────────────────────────────────────────")
	cloudInitStatus, _ := c.executeSSHCommand("cloud-init status --long 2>&1")
	fmt.Println(cloudInitStatus)

	fmt.Println("\n═══════════════════════════════════════════════════════════════")
	fmt.Println("FIN DEL DIAGNÓSTICO")
	fmt.Println("═══════════════════════════════════════════════════════════════\n")
}

// WaitForChatwoot espera a que Chatwoot esté disponible
func (c *ChatwootService) WaitForChatwoot(maxWaitMinutes int) error {
	fmt.Println("\n╔═══════════════════════════════════════════════════════════════╗")
	fmt.Println("║              ⏳ ESPERANDO A QUE CHATWOOT INICIE               ║")
	fmt.Println("╚═══════════════════════════════════════════════════════════════╝")
	fmt.Printf("\n🔍 URL base: %s\n", c.baseURL)
	fmt.Printf("⏱️  Timeout: %d minutos\n\n", maxWaitMinutes)

	maxAttempts := maxWaitMinutes * 6 // Cada 10 segundos

	for i := 0; i < maxAttempts; i++ {
		elapsed := (i + 1) * 10

		fmt.Printf("\n[%02d:%02d] 🔄 Intento %d/%d\n", elapsed/60, elapsed%60, i+1, maxAttempts)

		// Intentar conectar al endpoint de API
		resp, err := c.httpClient.Get(c.baseURL + "/api")

		if err != nil {
			fmt.Printf("   ❌ Error de conexión: %v\n", err)

			// Cada 2 minutos, hacer diagnóstico completo
			if (i+1)%12 == 0 {
				fmt.Println("\n   🔍 Ejecutando diagnóstico automático...")
				c.diagnoseChatwootFailure()
			}
		} else {
			resp.Body.Close()

			if resp.StatusCode == 200 {
				fmt.Println("   ✅ Chatwoot está disponible y respondiendo!")
				return nil
			}

			fmt.Printf("   ⚠️  Status code: %d (esperando 200)\n", resp.StatusCode)
		}

		if i < maxAttempts-1 {
			fmt.Printf("   ⏳ Esperando 10 segundos...\n")
			time.Sleep(10 * time.Second)
		}
	}

	// Diagnóstico final antes de fallar
	fmt.Println("\n❌ TIMEOUT ALCANZADO - Ejecutando diagnóstico final...")
	c.diagnoseChatwootFailure()

	return fmt.Errorf("chatwoot no respondió después de %d minutos", maxWaitMinutes)
}

// CreateAccountAndUser crea una cuenta y usuario en Chatwoot
func (c *ChatwootService) CreateAccountAndUser(user *models.User, agent *models.Agent) (*ChatwootCredentials, error) {
	fmt.Println("\n╔═══════════════════════════════════════════════════════════════╗")
	fmt.Println("║           🔧 CREANDO CUENTA Y USUARIO EN CHATWOOT             ║")
	fmt.Println("╚═══════════════════════════════════════════════════════════════╝")

	// 1. Esperar a que Chatwoot esté listo
	if err := c.WaitForChatwoot(20); err != nil {
		return nil, fmt.Errorf("chatwoot no está disponible: %v", err)
	}

	// 2. Generar credenciales
	email, password := c.generateCredentials(user.Company, agent.Name)
	fmt.Printf("\n📧 Email generado: %s\n", email)
	fmt.Printf("🔑 Password generado: %s\n", password)

	// 3. Crear cuenta
	accountName := fmt.Sprintf("%s - %s", user.Company, agent.Name)
	accountID, err := c.createAccount(accountName)
	if err != nil {
		return nil, fmt.Errorf("error creando cuenta: %v", err)
	}
	fmt.Printf("✅ Cuenta creada: ID=%d\n", accountID)

	// 4. Crear usuario
	userID, accessToken, err := c.createUser(email, password, user.FirstName+" "+user.LastName, accountID)
	if err != nil {
		return nil, fmt.Errorf("error creando usuario: %v", err)
	}
	fmt.Printf("✅ Usuario creado: ID=%d\n", userID)

	// 5. Crear inbox
	inboxName := fmt.Sprintf("%s WhatsApp", agent.Name)
	inboxID, err := c.createWhatsAppInbox(accessToken, accountID, inboxName, agent.PhoneNumber)
	if err != nil {
		return nil, fmt.Errorf("error creando inbox: %v", err)
	}
	fmt.Printf("✅ Inbox creado: ID=%d\n", inboxID)

	credentials := &ChatwootCredentials{
		Email:       email,
		Password:    password,
		AccountID:   accountID,
		AccountName: accountName,
		InboxID:     inboxID,
		InboxName:   inboxName,
		ChatwootURL: fmt.Sprintf("https://chat-user%d.attomos.com", c.userID),
	}

	return credentials, nil
}

// generateCredentials genera credenciales con contraseña segura
func (c *ChatwootService) generateCredentials(companyName, agentName string) (string, string) {
	emailUser := strings.ToLower(companyName + "_" + agentName)
	emailUser = strings.ReplaceAll(emailUser, " ", "_")
	emailUser = strings.Map(func(r rune) rune {
		if (r >= 'a' && r <= 'z') || (r >= '0' && r <= '9') || r == '_' {
			return r
		}
		return -1
	}, emailUser)

	email := emailUser + "@attomos.com"

	// Generar contraseña simple tipo: Chatwoot123!
	baseWord := "Chatwoot"
	if companyName != "" {
		// Usar nombre de compañía capitalizado
		baseWord = strings.Title(strings.ToLower(companyName))
		baseWord = strings.ReplaceAll(baseWord, " ", "")
		// Limitar a 8 caracteres
		if len(baseWord) > 8 {
			baseWord = baseWord[:8]
		}
	}

	password := baseWord + "123!"

	return email, password
}

// generateSecurePassword genera una contraseña que cumple con los requisitos de Chatwoot
func (c *ChatwootService) generateSecurePassword() string {
	const (
		uppercase = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
		lowercase = "abcdefghijklmnopqrstuvwxyz"
		numbers   = "0123456789"
		special   = "#$"
	)

	mathrand.Seed(time.Now().UnixNano())

	// Asegurar al menos un carácter de cada tipo
	password := []byte{
		uppercase[mathrand.Intn(len(uppercase))],
		lowercase[mathrand.Intn(len(lowercase))],
		numbers[mathrand.Intn(len(numbers))],
		special[mathrand.Intn(len(special))],
	}

	// Completar hasta 12 caracteres con caracteres aleatorios
	allChars := uppercase + lowercase + numbers + special
	for i := 0; i < 8; i++ {
		password = append(password, allChars[mathrand.Intn(len(allChars))])
	}

	// Mezclar para que no sea predecible
	for i := len(password) - 1; i > 0; i-- {
		j := mathrand.Intn(i + 1)
		password[i], password[j] = password[j], password[i]
	}

	return string(password)
}

// createAccount crea una cuenta en Chatwoot
func (c *ChatwootService) createAccount(accountName string) (int, error) {
	payload := map[string]interface{}{
		"account_name": accountName,
		"email":        "admin@attomos.com",
	}

	jsonData, _ := json.Marshal(payload)
	resp, err := c.httpClient.Post(c.baseURL+"/api/v1/accounts", "application/json", bytes.NewBuffer(jsonData))

	if err != nil {
		return 0, err
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)

	if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusCreated {
		return 0, fmt.Errorf("error HTTP %d: %s", resp.StatusCode, string(body))
	}

	var result ChatwootAccount
	if err := json.Unmarshal(body, &result); err != nil {
		return 0, err
	}

	return result.ID, nil
}

// createUser crea un usuario en Chatwoot
func (c *ChatwootService) createUser(email, password, name string, accountID int) (int, string, error) {
	payload := map[string]interface{}{
		"name":       name,
		"email":      email,
		"password":   password,
		"account_id": accountID,
		"role":       "administrator",
	}

	jsonData, _ := json.Marshal(payload)
	resp, err := c.httpClient.Post(
		fmt.Sprintf("%s/api/v1/accounts/%d/users", c.baseURL, accountID),
		"application/json",
		bytes.NewBuffer(jsonData),
	)

	if err != nil {
		return 0, "", err
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)

	if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusCreated {
		return 0, "", fmt.Errorf("error HTTP %d: %s", resp.StatusCode, string(body))
	}

	var result ChatwootUser
	if err := json.Unmarshal(body, &result); err != nil {
		return 0, "", err
	}

	accessToken := c.generateAccessToken()
	return result.ID, accessToken, nil
}

// createWhatsAppInbox crea un inbox de WhatsApp
func (c *ChatwootService) createWhatsAppInbox(accessToken string, accountID int, inboxName, phoneNumber string) (int, error) {
	payload := map[string]interface{}{
		"name": inboxName,
		"channel": map[string]interface{}{
			"type":         "api",
			"webhook_url":  "",
			"phone_number": phoneNumber,
		},
	}

	jsonData, _ := json.Marshal(payload)
	req, err := http.NewRequest(
		"POST",
		fmt.Sprintf("%s/api/v1/accounts/%d/inboxes", c.baseURL, accountID),
		bytes.NewBuffer(jsonData),
	)

	if err != nil {
		return 0, err
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("api_access_token", accessToken)

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return 0, err
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)

	if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusCreated {
		return 0, fmt.Errorf("error HTTP %d: %s", resp.StatusCode, string(body))
	}

	var result ChatwootInbox
	if err := json.Unmarshal(body, &result); err != nil {
		return 0, err
	}

	return result.ID, nil
}

// generateAccessToken genera un token aleatorio
func (c *ChatwootService) generateAccessToken() string {
	const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
	length := 40

	result := make([]byte, length)
	for i := range result {
		num, _ := rand.Int(rand.Reader, big.NewInt(int64(len(charset))))
		result[i] = charset[num.Int64()]
	}

	return string(result)
}

// GetChatwootURL retorna la URL de Chatwoot
func (c *ChatwootService) GetChatwootURL() string {
	return fmt.Sprintf("https://chat-user%d.attomos.com", c.userID)
}
