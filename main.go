package main

import (
	"attomos/config"
	"attomos/handlers"
	"attomos/middleware"
	"attomos/models"
	"log"
	"net/http"
	"os"

	"github.com/gin-gonic/gin"
	"github.com/joho/godotenv"
)

func main() {
	// Cargar variables de entorno
	if err := godotenv.Load(); err != nil {
		log.Println("⚠️  Advertencia: No se encontró archivo .env")
	}

	// Conectar a la base de datos
	config.ConnectDatabase()

	// Migrar modelos (crear tablas)
	if err := config.DB.AutoMigrate(&models.User{}); err != nil {
		log.Fatal("Error al migrar la base de datos:", err)
	}
	log.Println("✅ Migraciones de base de datos completadas")

	// Crear router Gin
	router := gin.Default()

	// Cargar templates
	router.LoadHTMLGlob("templates/**/*.html")

	// Servir archivos estáticos
	router.Static("/static", "./static")

	// ==========================================
	// RUTAS PÚBLICAS (SIN AUTENTICACIÓN)
	// ==========================================

	// Páginas públicas
	router.GET("/", func(c *gin.Context) {
		c.HTML(http.StatusOK, "index.html", gin.H{
			"title": "Attomos",
		})
	})

	router.GET("/agents", func(c *gin.Context) {
		c.HTML(http.StatusOK, "agents.html", gin.H{
			"title": "Agentes",
		})
	})

	router.GET("/pricing", func(c *gin.Context) {
		c.HTML(http.StatusOK, "pricing.html", gin.H{
			"title": "Precios",
		})
	})

	router.GET("/contact", func(c *gin.Context) {
		c.HTML(http.StatusOK, "contact.html", gin.H{
			"title": "Contacto",
		})
	})

	router.GET("/login", func(c *gin.Context) {
		c.HTML(http.StatusOK, "login.html", gin.H{
			"title": "Iniciar sesión",
		})
	})

	router.GET("/register", func(c *gin.Context) {
		c.HTML(http.StatusOK, "register.html", gin.H{
			"title": "Registrarse",
		})
	})

	// ==========================================
	// API DE AUTENTICACIÓN
	// ==========================================
	auth := router.Group("/api/auth")
	{
		auth.POST("/register", handlers.Register)
		auth.POST("/login", handlers.Login)
		auth.POST("/logout", handlers.Logout)
	}

	// ==========================================
	// RUTAS PROTEGIDAS (CON AUTENTICACIÓN)
	// ==========================================
	protected := router.Group("/")
	protected.Use(middleware.AuthRequired())
	{
		// Dashboard
		protected.GET("/dashboard", func(c *gin.Context) {
			c.HTML(http.StatusOK, "dashboard.html", gin.H{
				"title": "Dashboard",
			})
		})

		// API protegidas
		api := protected.Group("/api")
		{
			api.GET("/me", handlers.GetCurrentUser)
		}
	}

	// Obtener puerto
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	// Iniciar servidor
	log.Printf("🚀 Servidor corriendo en http://localhost:%s\n", port)
	if err := router.Run(":" + port); err != nil {
		log.Fatal("Error al iniciar el servidor:", err)
	}
}