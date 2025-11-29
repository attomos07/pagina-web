package services

import (
	"bytes"
	"crypto/rand"
	"encoding/json"
	"fmt"
	"io"
	"math/big"
	"net/http"
	"strings"
	"time"

	"attomos/models"
)

type ChatwootService struct {
	serverIP   string
	baseURL    string
	userID     uint
	httpClient *http.Client
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
func NewChatwootService(serverIP string, userID uint) *ChatwootService {
	return &ChatwootService{
		serverIP: serverIP,
		baseURL:  fmt.Sprintf("http://%s:3000", serverIP),
		userID:   userID,
		httpClient: &http.Client{
			Timeout: 60 * time.Second,
		},
	}
}

// WaitForChatwoot espera a que Chatwoot esté disponible
func (c *ChatwootService) WaitForChatwoot(maxWaitMinutes int) error {
	fmt.Println("\n╔═══════════════════════════════════════════════════════════════╗")
	fmt.Println("║              ⏳ ESPERANDO A QUE CHATWOOT INICIE               ║")
	fmt.Println("╚═══════════════════════════════════════════════════════════════╝")
	fmt.Printf("\n🔍 URL base: %s\n", c.baseURL)
	fmt.Printf("⏱️  Timeout: %d minutos\n", maxWaitMinutes)

	maxAttempts := maxWaitMinutes * 6 // Cada 10 segundos

	for i := 0; i < maxAttempts; i++ {
		elapsed := (i + 1) * 10

		fmt.Printf("\n[%02d:%02d] 🔄 Intento %d/%d\n", elapsed/60, elapsed%60, i+1, maxAttempts)

		// Intentar conectar al endpoint de API
		resp, err := c.httpClient.Get(c.baseURL + "/api")

		if err != nil {
			fmt.Printf("   ❌ Error de conexión: %v\n", err)
			fmt.Printf("   💡 Causas posibles:\n")
			fmt.Printf("      - Chatwoot aún no ha iniciado\n")
			fmt.Printf("      - Docker containers no están listos\n")
			fmt.Printf("      - PostgreSQL/Redis iniciando\n")
		} else {
			fmt.Printf("   📊 HTTP Status: %d\n", resp.StatusCode)

			// Leer respuesta para más detalles
			body, _ := io.ReadAll(resp.Body)
			resp.Body.Close()

			if resp.StatusCode == 200 {
				fmt.Println("   ✅ Chatwoot está disponible y respondiendo!")
				return nil
			}

			if len(body) > 0 {
				preview := string(body)
				if len(preview) > 150 {
					preview = preview[:150] + "..."
				}
				fmt.Printf("   📄 Respuesta: %s\n", preview)
			}
		}

		if i < maxAttempts-1 {
			fmt.Printf("   ⏳ Esperando 10 segundos...\n")
			time.Sleep(10 * time.Second)
		}
	}

	fmt.Printf("\n❌ DIAGNÓSTICO FINAL:\n")
	fmt.Printf("   • Chatwoot no respondió en %d minutos\n", maxWaitMinutes)
	fmt.Printf("   • URL intentada: %s/api\n", c.baseURL)
	fmt.Printf("   • Total de intentos: %d\n", maxAttempts)
	fmt.Printf("\n💡 PRÓXIMOS PASOS:\n")
	fmt.Printf("   1. Verifica que el servidor está en 'running'\n")
	fmt.Printf("   2. SSH al servidor: ssh root@%s\n", c.serverIP)
	fmt.Printf("   3. Revisa Docker: docker ps\n")
	fmt.Printf("   4. Revisa logs: docker logs chatwoot-chatwoot-1\n")
	fmt.Printf("   5. Revisa cloud-init: tail -f /var/log/cloud-init-output.log\n")

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

	// 2. Generar credenciales simples basadas en el negocio
	email, password := c.generateCredentials(user.Company, agent.Name)

	fmt.Printf("\n📧 Email generado: %s\n", email)
	fmt.Printf("🔑 Password generado: %s\n", password)

	// 3. Crear cuenta (Account)
	accountName := fmt.Sprintf("%s - %s", user.Company, agent.Name)
	accountID, err := c.createAccount(accountName)
	if err != nil {
		return nil, fmt.Errorf("error creando cuenta: %v", err)
	}

	fmt.Printf("✅ Cuenta creada: ID=%d, Name=%s\n", accountID, accountName)

	// 4. Crear usuario con acceso a la cuenta
	userID, accessToken, err := c.createUser(email, password, user.FirstName+" "+user.LastName, accountID)
	if err != nil {
		return nil, fmt.Errorf("error creando usuario: %v", err)
	}

	fmt.Printf("✅ Usuario creado: ID=%d, Email=%s\n", userID, email)

	// 5. Crear inbox de WhatsApp
	inboxName := fmt.Sprintf("%s WhatsApp", agent.Name)
	inboxID, err := c.createWhatsAppInbox(accessToken, accountID, inboxName, agent.PhoneNumber)
	if err != nil {
		return nil, fmt.Errorf("error creando inbox: %v", err)
	}

	fmt.Printf("✅ Inbox creado: ID=%d, Name=%s\n", inboxID, inboxName)

	credentials := &ChatwootCredentials{
		Email:       email,
		Password:    password,
		AccountID:   accountID,
		AccountName: accountName,
		InboxID:     inboxID,
		InboxName:   inboxName,
		ChatwootURL: fmt.Sprintf("https://chat-user%d.attomos.com", c.userID),
	}

	fmt.Println("\n✅ Configuración de Chatwoot completada")

	return credentials, nil
}

// generateCredentials genera credenciales simples basadas en el negocio
func (c *ChatwootService) generateCredentials(companyName, agentName string) (string, string) {
	// Email: nombre_empresa_agente@attomos.com
	emailUser := strings.ToLower(companyName + "_" + agentName)
	emailUser = strings.ReplaceAll(emailUser, " ", "_")
	emailUser = strings.Map(func(r rune) rune {
		if (r >= 'a' && r <= 'z') || (r >= '0' && r <= '9') || r == '_' {
			return r
		}
		return -1
	}, emailUser)

	email := emailUser + "@attomos.com"

	// Password: NombreEmpresa123! (capitalizado + 123!)
	passwordBase := strings.Title(strings.ToLower(companyName))
	passwordBase = strings.ReplaceAll(passwordBase, " ", "")
	password := passwordBase + "123!"

	return email, password
}

// createAccount crea una cuenta en Chatwoot usando la API de instalación
func (c *ChatwootService) createAccount(accountName string) (int, error) {
	// Usar la API pública de instalación de Chatwoot
	payload := map[string]interface{}{
		"account_name": accountName,
		"email":        "admin@attomos.com", // Email temporal para creación inicial
	}

	jsonData, _ := json.Marshal(payload)

	resp, err := c.httpClient.Post(
		c.baseURL+"/api/v1/accounts",
		"application/json",
		bytes.NewBuffer(jsonData),
	)

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
	// Crear usuario usando la API de Chatwoot
	payload := map[string]interface{}{
		"name":       name,
		"email":      email,
		"password":   password,
		"account_id": accountID,
		"role":       "administrator",
	}

	jsonData, _ := json.Marshal(payload)

	resp, err := c.httpClient.Post(
		c.baseURL+"/api/v1/accounts/"+fmt.Sprintf("%d", accountID)+"/users",
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

	// Generar access token (simulado - en producción usar el token real de Chatwoot)
	accessToken := c.generateAccessToken()

	return result.ID, accessToken, nil
}

// createWhatsAppInbox crea un inbox de WhatsApp en Chatwoot
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
		c.baseURL+"/api/v1/accounts/"+fmt.Sprintf("%d", accountID)+"/inboxes",
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

// generateAccessToken genera un token de acceso aleatorio
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

// GetChatwootURL retorna la URL de Chatwoot para este servicio
func (c *ChatwootService) GetChatwootURL() string {
	return fmt.Sprintf("https://chat-user%d.attomos.com", c.userID)
}
