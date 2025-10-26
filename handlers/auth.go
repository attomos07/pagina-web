package handlers

import (
	"net/http"
	"strings"

	"attomos/config"
	"attomos/models"
	"attomos/utils"

	"github.com/gin-gonic/gin"
)

// RegisterRequest estructura para la petición de registro
type RegisterRequest struct {
	FirstName    string `json:"firstName" binding:"required"`
	LastName     string `json:"lastName" binding:"required"`
	Email        string `json:"email" binding:"required,email"`
	Password     string `json:"password" binding:"required,min=8"`
	Company      string `json:"company"`
	BusinessType string `json:"businessType" binding:"required"`
}

// LoginRequest estructura para la petición de login
type LoginRequest struct {
	Email    string `json:"email" binding:"required,email"`
	Password string `json:"password" binding:"required"`
}

// AuthResponse estructura para la respuesta de autenticación
type AuthResponse struct {
	Token string       `json:"token"`
	User  *models.User `json:"user"`
}

// Register maneja el registro de nuevos usuarios
func Register(c *gin.Context) {
	var req RegisterRequest

	// Validar JSON
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   "Datos inválidos",
			"details": err.Error(),
		})
		return
	}

	// Normalizar email
	req.Email = strings.ToLower(strings.TrimSpace(req.Email))

	// Verificar si el email ya existe
	var existingUser models.User
	if err := config.DB.Where("email = ?", req.Email).First(&existingUser).Error; err == nil {
		c.JSON(http.StatusConflict, gin.H{
			"error": "Este email ya está registrado",
		})
		return
	}

	// Crear nuevo usuario
	user := models.User{
		FirstName:    req.FirstName,
		LastName:     req.LastName,
		Email:        req.Email,
		Company:      req.Company,
		BusinessType: req.BusinessType,
	}

	// Encriptar contraseña
	if err := user.HashPassword(req.Password); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Error al procesar la contraseña",
		})
		return
	}

	// Guardar en base de datos
	if err := config.DB.Create(&user).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Error al crear la cuenta",
		})
		return
	}

	// Generar token JWT
	token, err := utils.GenerateToken(user.ID, user.Email)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Error al generar token",
		})
		return
	}

	// Establecer cookie
	c.SetCookie(
		"auth_token",
		token,
		3600*24, // 24 horas
		"/",
		"",
		false, // Set to true in production with HTTPS
		true,  // HttpOnly
	)

	// Respuesta exitosa
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
	})
}

// Login maneja el inicio de sesión
func Login(c *gin.Context) {
	var req LoginRequest

	// Validar JSON
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   "Datos inválidos",
			"details": err.Error(),
		})
		return
	}

	// Normalizar email
	req.Email = strings.ToLower(strings.TrimSpace(req.Email))

	// Buscar usuario por email
	var user models.User
	if err := config.DB.Where("email = ?", req.Email).First(&user).Error; err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{
			"error": "Email o contraseña incorrectos",
		})
		return
	}

	// Verificar contraseña
	if !user.CheckPassword(req.Password) {
		c.JSON(http.StatusUnauthorized, gin.H{
			"error": "Email o contraseña incorrectos",
		})
		return
	}

	// Generar token JWT
	token, err := utils.GenerateToken(user.ID, user.Email)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Error al generar token",
		})
		return
	}

	// Establecer cookie
	c.SetCookie(
		"auth_token",
		token,
		3600*24, // 24 horas
		"/",
		"",
		false, // Set to true in production with HTTPS
		true,  // HttpOnly
	)

	// Respuesta exitosa
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

// Logout maneja el cierre de sesión
func Logout(c *gin.Context) {
	// Eliminar cookie
	c.SetCookie(
		"auth_token",
		"",
		-1,
		"/",
		"",
		false,
		true,
	)

	c.JSON(http.StatusOK, gin.H{
		"message": "Sesión cerrada exitosamente",
	})
}

// GetCurrentUser retorna el usuario actual
func GetCurrentUser(c *gin.Context) {
	// Obtener user del contexto (establecido por middleware)
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
			"id":           user.ID,
			"firstName":    user.FirstName,
			"lastName":     user.LastName,
			"email":        user.Email,
			"company":      user.Company,
			"businessType": user.BusinessType,
		},
	})
}
