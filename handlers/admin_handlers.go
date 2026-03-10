package handlers

import (
	"crypto/sha256"
	"fmt"
	"net/http"
	"os"
	"time"

	"attomos/config"
	"attomos/models"

	"github.com/gin-gonic/gin"
)

// getAdminSessionToken genera un token derivado de las credenciales de entorno
// Se usa tanto en el middleware como aquí para verificar consistencia
func getAdminSessionToken() string {
	secret := os.Getenv("ADMIN_SESSION_SECRET")
	if secret == "" {
		secret = "attomos-admin-fallback-secret" // cámbialo en producción con la env var
	}
	h := sha256.Sum256([]byte(secret))
	return fmt.Sprintf("%x", h)
}

// AdminLogin — POST /admin/api/login
func AdminLogin(c *gin.Context) {
	var body struct {
		Identifier string `json:"identifier"`
		Password   string `json:"password"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Datos inválidos."})
		return
	}

	adminUser := os.Getenv("ADMIN_USERNAME")
	adminPass := os.Getenv("ADMIN_PASSWORD")

	if adminUser == "" || adminPass == "" {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Administrador no configurado."})
		return
	}

	if body.Identifier != adminUser || body.Password != adminPass {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Credenciales incorrectas."})
		return
	}

	// Establecer cookie de sesión (HttpOnly, 8 horas)
	c.SetCookie(
		"admin_session",
		getAdminSessionToken(),
		int(8*time.Hour/time.Second),
		"/",
		"",
		os.Getenv("ENVIRONMENT") == "production",
		true,
	)

	c.JSON(http.StatusOK, gin.H{"success": true})
}

// AdminLogout — POST /admin/api/logout
func AdminLogout(c *gin.Context) {
	c.SetCookie("admin_session", "", -1, "/", "", false, true)
	c.JSON(http.StatusOK, gin.H{"success": true})
}

// AdminGetCompanies — GET /admin/api/companies
// Devuelve la lista de empresas registradas para el panel de base de datos
func AdminGetCompanies(c *gin.Context) {
	var users []models.User
	result := config.DB.Order("created_at desc").Find(&users)
	if result.Error != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Error al obtener empresas."})
		return
	}

	// Contar activas hoy (último login en las últimas 24h)
	yesterday := time.Now().Add(-24 * time.Hour)
	var activeCount int64
	config.DB.Model(&models.User{}).Where("last_login_at > ?", yesterday).Count(&activeCount)

	// Contar con plan de pago
	var paidCount int64
	config.DB.Model(&models.User{}).Where("plan NOT IN ?", []string{"gratuito", ""}).Count(&paidCount)

	// Contar nuevas este mes
	firstOfMonth := time.Now().Truncate(24*time.Hour).AddDate(0, 0, -time.Now().Day()+1)
	var newCount int64
	config.DB.Model(&models.User{}).Where("created_at >= ?", firstOfMonth).Count(&newCount)

	c.JSON(http.StatusOK, gin.H{
		"companies": users,
		"stats": gin.H{
			"total":  len(users),
			"active": activeCount,
			"paid":   paidCount,
			"new":    newCount,
		},
	})
}
