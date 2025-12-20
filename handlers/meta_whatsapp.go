package handlers

import (
	"encoding/base64"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"net/url"
	"os"
	"strings"
	"time"

	"attomos/config"
	"attomos/models"

	"github.com/gin-gonic/gin"
)

// MetaWhatsAppConfig contiene la configuración de Meta
type MetaWhatsAppConfig struct {
	AppID       string
	AppSecret   string
	RedirectURL string
}

// MetaWhatsAppHandler maneja la integración con Meta WhatsApp Business
type MetaWhatsAppHandler struct {
	config *MetaWhatsAppConfig
}

// NewMetaWhatsAppHandler crea una nueva instancia del handler
func NewMetaWhatsAppHandler() (*MetaWhatsAppHandler, error) {
	clientID := os.Getenv("META_APP_ID")
	clientSecret := os.Getenv("META_APP_SECRET")
	redirectURL := os.Getenv("META_REDIRECT_URL")

	if clientID == "" || clientSecret == "" || redirectURL == "" {
		return nil, fmt.Errorf("faltan credenciales de Meta (META_APP_ID, META_APP_SECRET, META_REDIRECT_URL)")
	}

	config := &MetaWhatsAppConfig{
		AppID:       clientID,
		AppSecret:   clientSecret,
		RedirectURL: redirectURL,
	}

	log.Printf("✅ Meta WhatsApp Handler configurado")
	log.Printf("   - App ID: %s", clientID)
	log.Printf("   - Redirect URL: %s", redirectURL)

	return &MetaWhatsAppHandler{config: config}, nil
}

// InitiateConnection genera la URL de OAuth para conectar WhatsApp
func (h *MetaWhatsAppHandler) InitiateConnection(c *gin.Context) {
	// Obtener usuario autenticado
	userInterface, exists := c.Get("user")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Usuario no autenticado"})
		return
	}

	user := userInterface.(*models.User)

	// Generar state token para CSRF protection
	stateToken := fmt.Sprintf("%d:%d", user.ID, time.Now().Unix())
	stateEncoded := base64.URLEncoding.EncodeToString([]byte(stateToken))

	// Guardar state en cookie (expira en 10 minutos)
	c.SetCookie(
		"meta_oauth_state",
		stateEncoded,
		600, // 10 minutos
		"/",
		"",
		false, // Usar true en producción con HTTPS
		true,  // HTTPOnly
	)

	// Construir URL de autorización de Meta
	authURL := fmt.Sprintf(
		"https://www.facebook.com/v22.0/dialog/oauth?client_id=%s&redirect_uri=%s&state=%s&scope=%s",
		h.config.AppID,
		url.QueryEscape(h.config.RedirectURL),
		stateEncoded,
		url.QueryEscape("business_management,whatsapp_business_management,whatsapp_business_messaging"),
	)

	c.JSON(http.StatusOK, gin.H{
		"auth_url": authURL,
	})
}

// HandleCallback procesa el callback de OAuth de Meta
func (h *MetaWhatsAppHandler) HandleCallback(c *gin.Context) {
	// Obtener code y state de la query
	code := c.Query("code")
	state := c.Query("state")

	if code == "" {
		c.Redirect(http.StatusFound, "/business-portfolio?error=authorization_failed")
		return
	}

	// Validar state token (CSRF protection)
	savedState, err := c.Cookie("meta_oauth_state")
	if err != nil || savedState != state {
		c.Redirect(http.StatusFound, "/business-portfolio?error=invalid_state")
		return
	}

	// Limpiar cookie de state
	c.SetCookie("meta_oauth_state", "", -1, "/", "", false, true)

	// Decodificar state para obtener user_id
	stateDecoded, err := base64.URLEncoding.DecodeString(state)
	if err != nil {
		c.Redirect(http.StatusFound, "/business-portfolio?error=invalid_state")
		return
	}

	parts := strings.Split(string(stateDecoded), ":")
	if len(parts) < 2 {
		c.Redirect(http.StatusFound, "/business-portfolio?error=invalid_state")
		return
	}

	var userID uint
	fmt.Sscanf(parts[0], "%d", &userID)

	// Intercambiar code por access token
	accessToken, err := h.exchangeCodeForToken(code)
	if err != nil {
		log.Printf("Error intercambiando código: %v", err)
		c.Redirect(http.StatusFound, "/business-portfolio?error=token_exchange_failed")
		return
	}

	// Obtener WABA ID
	wabaID, err := h.getWABAID(accessToken)
	if err != nil {
		log.Printf("Error obteniendo WABA ID: %v", err)
		c.Redirect(http.StatusFound, "/business-portfolio?error=waba_not_found")
		return
	}

	// Obtener información del número de teléfono
	phoneInfo, err := h.getPhoneNumberInfo(accessToken, wabaID)
	if err != nil {
		log.Printf("Error obteniendo info del teléfono: %v", err)
		c.Redirect(http.StatusFound, "/business-portfolio?error=phone_info_failed")
		return
	}

	// Guardar credenciales en el usuario
	var user models.User
	if err := config.DB.First(&user, userID).Error; err != nil {
		c.Redirect(http.StatusFound, "/business-portfolio?error=user_not_found")
		return
	}

	now := time.Now()
	tokenExpires := now.Add(60 * 24 * time.Hour) // 60 días

	user.MetaAccessToken = accessToken
	user.MetaWABAID = wabaID
	user.MetaPhoneNumberID = phoneInfo.PhoneNumberID
	user.MetaDisplayNumber = phoneInfo.DisplayNumber
	user.MetaVerifiedName = phoneInfo.VerifiedName
	user.MetaConnected = true
	user.MetaConnectedAt = &now
	user.MetaTokenExpiresAt = &tokenExpires

	if err := config.DB.Save(&user).Error; err != nil {
		log.Printf("Error guardando credenciales: %v", err)
		c.Redirect(http.StatusFound, "/business-portfolio?error=save_failed")
		return
	}

	log.Printf("✅ WhatsApp conectado para usuario %d: %s (%s)", userID, phoneInfo.DisplayNumber, phoneInfo.VerifiedName)

	// Redirigir al frontend con éxito
	c.Redirect(http.StatusFound, "/business-portfolio?success=whatsapp_connected")
}

// exchangeCodeForToken intercambia el código de autorización por un access token
func (h *MetaWhatsAppHandler) exchangeCodeForToken(code string) (string, error) {
	tokenURL := fmt.Sprintf(
		"https://graph.facebook.com/v22.0/oauth/access_token?client_id=%s&client_secret=%s&code=%s&redirect_uri=%s",
		h.config.AppID,
		h.config.AppSecret,
		code,
		url.QueryEscape(h.config.RedirectURL),
	)

	resp, err := http.Get(tokenURL)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	var result map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return "", err
	}

	accessToken, ok := result["access_token"].(string)
	if !ok {
		return "", fmt.Errorf("no se recibió access_token")
	}

	return accessToken, nil
}

// getWABAID obtiene el WhatsApp Business Account ID
func (h *MetaWhatsAppHandler) getWABAID(accessToken string) (string, error) {
	// Obtener negocios del usuario
	businessURL := fmt.Sprintf(
		"https://graph.facebook.com/v22.0/me/businesses?access_token=%s",
		accessToken,
	)

	resp, err := http.Get(businessURL)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	var result struct {
		Data []struct {
			ID string `json:"id"`
		} `json:"data"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return "", err
	}

	if len(result.Data) == 0 {
		return "", fmt.Errorf("no se encontraron negocios asociados")
	}

	businessID := result.Data[0].ID

	// Obtener WABA del negocio
	wabaURL := fmt.Sprintf(
		"https://graph.facebook.com/v22.0/%s/owned_whatsapp_business_accounts?access_token=%s",
		businessID,
		accessToken,
	)

	resp2, err := http.Get(wabaURL)
	if err != nil {
		return "", err
	}
	defer resp2.Body.Close()

	var wabaResult struct {
		Data []struct {
			ID string `json:"id"`
		} `json:"data"`
	}

	if err := json.NewDecoder(resp2.Body).Decode(&wabaResult); err != nil {
		return "", err
	}

	if len(wabaResult.Data) == 0 {
		return "", fmt.Errorf("no se encontró WhatsApp Business Account")
	}

	return wabaResult.Data[0].ID, nil
}

// PhoneNumberInfo contiene información del número de WhatsApp
type PhoneNumberInfo struct {
	PhoneNumberID string
	DisplayNumber string
	VerifiedName  string
}

// getPhoneNumberInfo obtiene la información del número de teléfono
func (h *MetaWhatsAppHandler) getPhoneNumberInfo(accessToken, wabaID string) (*PhoneNumberInfo, error) {
	phoneURL := fmt.Sprintf(
		"https://graph.facebook.com/v22.0/%s/phone_numbers?access_token=%s",
		wabaID,
		accessToken,
	)

	resp, err := http.Get(phoneURL)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var result struct {
		Data []struct {
			ID            string `json:"id"`
			DisplayNumber string `json:"display_phone_number"`
			VerifiedName  string `json:"verified_name"`
		} `json:"data"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, err
	}

	if len(result.Data) == 0 {
		return nil, fmt.Errorf("no se encontraron números de teléfono")
	}

	phone := result.Data[0]

	return &PhoneNumberInfo{
		PhoneNumberID: phone.ID,
		DisplayNumber: phone.DisplayNumber,
		VerifiedName:  phone.VerifiedName,
	}, nil
}

// GetConnectionStatus obtiene el estado de conexión del usuario
func (h *MetaWhatsAppHandler) GetConnectionStatus(c *gin.Context) {
	userInterface, exists := c.Get("user")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Usuario no autenticado"})
		return
	}

	user := userInterface.(*models.User)

	c.JSON(http.StatusOK, gin.H{
		"connected":        user.MetaConnected,
		"phone_number_id":  user.MetaPhoneNumberID,
		"display_number":   user.MetaDisplayNumber,
		"verified_name":    user.MetaVerifiedName,
		"connected_at":     user.MetaConnectedAt,
		"token_expires_at": user.MetaTokenExpiresAt,
	})
}

// DisconnectWhatsApp desconecta WhatsApp del usuario
func (h *MetaWhatsAppHandler) DisconnectWhatsApp(c *gin.Context) {
	userInterface, exists := c.Get("user")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Usuario no autenticado"})
		return
	}

	user := userInterface.(*models.User)

	// Limpiar credenciales de Meta
	user.MetaAccessToken = ""
	user.MetaWABAID = ""
	user.MetaPhoneNumberID = ""
	user.MetaDisplayNumber = ""
	user.MetaVerifiedName = ""
	user.MetaConnected = false
	user.MetaConnectedAt = nil
	user.MetaTokenExpiresAt = nil

	if err := config.DB.Save(&user).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Error al desconectar"})
		return
	}

	log.Printf("✅ WhatsApp desconectado para usuario %d", user.ID)

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "WhatsApp desconectado exitosamente",
	})
}
