package handlers

import (
	"log"
	"net/http"
	"strings"

	"attomos/config"
	"attomos/models"
	"attomos/services"
	"attomos/utils"

	"github.com/gin-gonic/gin"
)

type RegisterRequest struct {
	FirstName    string `json:"firstName" binding:"required"`
	LastName     string `json:"lastName" binding:"required"`
	Email        string `json:"email" binding:"required,email"`
	Password     string `json:"password" binding:"required,min=8"`
	Company      string `json:"company"`
	BusinessType string `json:"businessType" binding:"required"`
}

type LoginRequest struct {
	Email    string `json:"email" binding:"required,email"`
	Password string `json:"password" binding:"required"`
}

// Register registra un nuevo usuario y crea su proyecto de Google Cloud
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

	// Verificar si el email ya existe
	var existingUser models.User
	if err := config.DB.Where("email = ?", req.Email).First(&existingUser).Error; err == nil {
		c.JSON(http.StatusConflict, gin.H{
			"error": "Este email ya está registrado",
		})
		return
	}

	// Crear usuario - GCPProjectID será NULL por defecto (puntero a string)
	user := models.User{
		FirstName:     req.FirstName,
		LastName:      req.LastName,
		Email:         req.Email,
		Company:       req.Company,
		BusinessType:  req.BusinessType,
		ProjectStatus: "pending",
		GCPProjectID:  nil, // Explícitamente NULL hasta que se cree el proyecto
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

	// CREAR PROYECTO DE GOOGLE CLOUD EN BACKGROUND
	go func() {
		log.Printf("🚀 [User %d] Iniciando creación de proyecto GCP", user.ID)

		// Actualizar estado
		user.ProjectStatus = "creating"
		config.DB.Save(&user)

		// Inicializar servicio de GCP
		gca, err := services.NewGoogleCloudAutomation()
		if err != nil {
			log.Printf("❌ [User %d] Error inicializando GCP: %v", user.ID, err)
			user.ProjectStatus = "error"
			config.DB.Save(&user)
			return
		}

		// Crear proyecto y API Key
		projectID, apiKey, err := gca.CreateProjectForUser(user.ID, user.Email)
		if err != nil {
			log.Printf("❌ [User %d] Error creando proyecto: %v", user.ID, err)
			user.ProjectStatus = "error"
			config.DB.Save(&user)
			return
		}

		// Guardar información del proyecto
		// CAMBIO: Asignar el puntero al string correctamente
		projectIDCopy := projectID // Crear una copia para tomar su dirección
		user.GCPProjectID = &projectIDCopy
		user.GeminiAPIKey = apiKey
		user.ProjectStatus = "ready"

		if err := config.DB.Save(&user).Error; err != nil {
			log.Printf("❌ [User %d] Error guardando proyecto: %v", user.ID, err)
			return
		}

		log.Printf("🎉 [User %d] Proyecto GCP listo: %s", user.ID, projectID)
	}()

	// Generar token JWT
	token, err := utils.GenerateToken(user.ID, user.Email)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Error al generar token",
		})
		return
	}

	c.SetCookie("auth_token", token, 3600*24, "/", "", false, true)

	// Respuesta inmediata
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
		},
		"info": "Tu entorno de IA está siendo configurado (30-60 segundos)",
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

	// CAMBIO: Verificar si GCPProjectID no es nil y no está vacío
	hasProject := user.GCPProjectID != nil && *user.GCPProjectID != ""

	c.JSON(http.StatusOK, gin.H{
		"projectStatus": user.ProjectStatus,
		"hasProject":    hasProject,
		"hasAPIKey":     user.GeminiAPIKey != "",
		"ready":         user.ProjectStatus == "ready",
		"message":       getProjectStatusMessage(user.ProjectStatus),
	})
}

// getProjectStatusMessage retorna un mensaje legible del estado
func getProjectStatusMessage(status string) string {
	messages := map[string]string{
		"pending":  "Inicializando tu entorno...",
		"creating": "Configurando tu espacio de trabajo (esto puede tomar 30-60 segundos)...",
		"ready":    "Tu entorno está listo para crear agentes",
		"error":    "Hubo un problema configurando tu entorno. Por favor contacta a soporte.",
	}

	if msg, ok := messages[status]; ok {
		return msg
	}

	return "Estado desconocido"
}
