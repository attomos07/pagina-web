package handlers

import (
	"log"
	"net/http"
	"strings"

	"attomos/config"
	"attomos/models"
	"attomos/utils"

	"github.com/gin-gonic/gin"
)

type RegisterRequest struct {
	BusinessName string `json:"businessName" binding:"required"`
	PhoneNumber  string `json:"phoneNumber" binding:"required"`
	Email        string `json:"email" binding:"required,email"`
	Password     string `json:"password" binding:"required,min=8"`
	BusinessType string `json:"businessType" binding:"required"`
}

type LoginRequest struct {
	Email    string `json:"email" binding:"required,email"`
	Password string `json:"password" binding:"required"`
}

// Register registra un nuevo usuario SIN crear proyecto GCP
func Register(c *gin.Context) {
	var req RegisterRequest

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   "Datos inválidos",
			"details": err.Error(),
		})
		return
	}

	req.Email = strings.ToLower(strings.TrimSpace(req.Email))
	req.PhoneNumber = strings.TrimSpace(req.PhoneNumber)

	// Verificar si el email ya existe
	var existingUser models.User
	if err := config.DB.Where("email = ?", req.Email).First(&existingUser).Error; err == nil {
		c.JSON(http.StatusConflict, gin.H{
			"error": "Este email ya está registrado",
		})
		return
	}

	// Crear usuario SIN proyecto GCP (se creará al crear primer agente)
	user := models.User{
		FirstName:     req.BusinessName, // Usar BusinessName como FirstName
		LastName:      "",               // Dejar LastName vacío por ahora
		Email:         req.Email,
		Company:       req.BusinessName,
		BusinessType:  req.BusinessType,
		PhoneNumber:   req.PhoneNumber, // NUEVO CAMPO
		ProjectStatus: "pending",       // Indica que aún no se ha creado el proyecto
		GCPProjectID:  nil,             // NULL hasta que se cree el primer agente
		GeminiAPIKey:  "",              // Vacío hasta que se cree el primer agente
	}

	if err := user.HashPassword(req.Password); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Error al procesar la contraseña",
		})
		return
	}

	// Guardar usuario en BD
	if err := config.DB.Create(&user).Error; err != nil {
		log.Printf("❌ Error creando usuario: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Error al crear la cuenta",
		})
		return
	}

	log.Printf("✅ [User %d] Usuario creado exitosamente: %s (Tel: %s)", user.ID, user.Email, user.PhoneNumber)

	// Generar token JWT
	token, err := utils.GenerateToken(user.ID, user.Email)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Error al generar token",
		})
		return
	}

	c.SetCookie("auth_token", token, 3600*24, "/", "", false, true)

	// Respuesta inmediata - SIN mensaje de espera de entorno
	c.JSON(http.StatusCreated, gin.H{
		"message": "Cuenta creada exitosamente",
		"token":   token,
		"user": gin.H{
			"id":           user.ID,
			"firstName":    user.FirstName,
			"lastName":     user.LastName,
			"email":        user.Email,
			"company":      user.Company,
			"businessType": user.BusinessType,
			"phoneNumber":  user.PhoneNumber,
		},
		"info": "Tu proyecto de Google Cloud se creará automáticamente cuando crees tu primer agente",
	})
}

// Login autentica un usuario
func Login(c *gin.Context) {
	var req LoginRequest

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   "Datos inválidos",
			"details": err.Error(),
		})
		return
	}

	req.Email = strings.ToLower(strings.TrimSpace(req.Email))

	// Buscar usuario
	var user models.User
	if err := config.DB.Where("email = ?", req.Email).First(&user).Error; err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{
			"error": "Credenciales inválidas",
		})
		return
	}

	// Verificar contraseña
	if !user.CheckPassword(req.Password) {
		c.JSON(http.StatusUnauthorized, gin.H{
			"error": "Credenciales inválidas",
		})
		return
	}

	// Generar token
	token, err := utils.GenerateToken(user.ID, user.Email)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Error al generar token",
		})
		return
	}

	c.SetCookie("auth_token", token, 3600*24, "/", "", false, true)

	c.JSON(http.StatusOK, gin.H{
		"message": "Inicio de sesión exitoso",
		"token":   token,
		"user": gin.H{
			"id":           user.ID,
			"firstName":    user.FirstName,
			"lastName":     user.LastName,
			"email":        user.Email,
			"company":      user.Company,
			"businessType": user.BusinessType,
			"phoneNumber":  user.PhoneNumber,
		},
	})
}

// Logout cierra la sesión del usuario
func Logout(c *gin.Context) {
	c.SetCookie("auth_token", "", -1, "/", "", false, true)

	c.JSON(http.StatusOK, gin.H{
		"message": "Sesión cerrada exitosamente",
	})
}

// GetCurrentUser obtiene la información del usuario actual
func GetCurrentUser(c *gin.Context) {
	userInterface, exists := c.Get("user")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{
			"error": "No autenticado",
		})
		return
	}

	user := userInterface.(*models.User)

	c.JSON(http.StatusOK, gin.H{
		"user": gin.H{
			"id":            user.ID,
			"firstName":     user.FirstName,
			"lastName":      user.LastName,
			"email":         user.Email,
			"company":       user.Company,
			"businessType":  user.BusinessType,
			"phoneNumber":   user.PhoneNumber,
			"projectStatus": user.ProjectStatus,
		},
	})
}

// GetProjectStatus retorna el estado del proyecto GCP del usuario
func GetProjectStatus(c *gin.Context) {
	userInterface, exists := c.Get("user")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{
			"error": "No autenticado",
		})
		return
	}

	user := userInterface.(*models.User)

	// Verificar si tiene proyecto y API Key
	hasProject := user.GCPProjectID != nil && *user.GCPProjectID != ""
	hasAPIKey := user.GeminiAPIKey != ""

	c.JSON(http.StatusOK, gin.H{
		"projectStatus": user.ProjectStatus,
		"hasProject":    hasProject,
		"hasAPIKey":     hasAPIKey,
		"ready":         user.ProjectStatus == "ready",
		"message":       getProjectStatusMessage(user.ProjectStatus),
	})
}

// getProjectStatusMessage retorna un mensaje legible del estado
func getProjectStatusMessage(status string) string {
	messages := map[string]string{
		"pending":  "Tu proyecto de Google Cloud se creará cuando crees tu primer agente",
		"creating": "Configurando tu espacio de trabajo (esto puede tomar 30-60 segundos)...",
		"ready":    "Tu entorno está listo",
		"error":    "Hubo un problema configurando tu entorno. Por favor contacta a soporte.",
	}

	if msg, ok := messages[status]; ok {
		return msg
	}

	return "Estado desconocido"
}
