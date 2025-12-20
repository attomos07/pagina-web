package middleware

import (
	"net/http"
	"strings"

	"attomos/config"
	"attomos/models"
	"attomos/utils"

	"github.com/gin-gonic/gin"
)

// AuthRequired middleware que verifica si el usuario está autenticado
func AuthRequired() gin.HandlerFunc {
	return func(c *gin.Context) {
		// Intentar obtener token de la cookie
		token, err := c.Cookie("auth_token")

		// Si no está en cookie, buscar en header Authorization
		if err != nil || token == "" {
			authHeader := c.GetHeader("Authorization")
			if authHeader != "" {
				// Formato: "Bearer <token>"
				parts := strings.Split(authHeader, " ")
				if len(parts) == 2 && parts[0] == "Bearer" {
					token = parts[1]
				}
			}
		}

		// Si no hay token
		if token == "" {
			c.JSON(http.StatusUnauthorized, gin.H{
				"error": "Token de autenticación requerido",
			})
			c.Abort()
			return
		}

		// Validar token
		claims, err := utils.ValidateToken(token)
		if err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{
				"error": "Token inválido o expirado",
			})
			c.Abort()
			return
		}

		// Buscar usuario en la base de datos
		var user models.User
		if err := config.DB.First(&user, claims.UserID).Error; err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{
				"error": "Usuario no encontrado",
			})
			c.Abort()
			return
		}

		// Establecer usuario en el contexto
		c.Set("user", &user)
		c.Set("userId", user.ID)

		c.Next()
	}
}