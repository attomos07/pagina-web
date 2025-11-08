package main

import (
	"log"
	"os"
	"path/filepath"

	"attomos/config"
	"attomos/handlers"
	"attomos/middleware"
	"attomos/models"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"github.com/joho/godotenv"
)

// getTemplateFiles obtiene todos los archivos de template de los patrones dados
func getTemplateFiles(patterns ...string) []string {
	var files []string
	for _, pattern := range patterns {
		matches, err := filepath.Glob(pattern)
		if err != nil {
			log.Printf("Error buscando templates con patrón %s: %v", pattern, err)
			continue
		}
		files = append(files, matches...)
	}
	return files
}

func main() {
	// Cargar variables de entorno
	if err := godotenv.Load(); err != nil {
		log.Println("⚠️  Advertencia: No se encontró archivo .env")
	}

	// Conectar a la base de datos
	config.ConnectDatabase()

	// Migrar modelos
	if err := config.DB.AutoMigrate(
		&models.User{},
		&models.Agent{},
	); err != nil {
		log.Fatal("❌ Error en migración:", err)
	}

	log.Println("✅ Base de datos conectada y migrada")

	// Configurar Gin
	if os.Getenv("ENVIRONMENT") == "production" {
		gin.SetMode(gin.ReleaseMode)
	}

	router := gin.Default()

	// CORS
	allowedOrigins := []string{"http://localhost:3000", "http://localhost:8080"}

	// Agregar FRONTEND_URL si existe
	if frontendURL := os.Getenv("FRONTEND_URL"); frontendURL != "" {
		allowedOrigins = append(allowedOrigins, frontendURL)
	}

	router.Use(cors.New(cors.Config{
		AllowOrigins:     allowedOrigins,
		AllowMethods:     []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowHeaders:     []string{"Origin", "Content-Type", "Authorization"},
		ExposeHeaders:    []string{"Content-Length"},
		AllowCredentials: true,
	}))

	// Servir archivos estáticos
	router.Static("/static", "./static")

	// Cargar templates de múltiples directorios
	templates := []string{
		"templates/*.html",
		"templates/auth/*.html",
		"templates/partials/*.html",
	}

	// Construir el patrón final
	router.LoadHTMLFiles(getTemplateFiles(templates...)...)

	// ============================================
	// RUTAS PÚBLICAS
	// ============================================

	// Landing page
	router.GET("/", func(c *gin.Context) {
		c.HTML(200, "index.html", nil)
	})

	// Autenticación
	router.POST("/api/register", handlers.Register)
	router.POST("/api/login", handlers.Login)
	router.POST("/api/logout", handlers.Logout)

	// ============================================
	// RUTAS PROTEGIDAS
	// ============================================

	protected := router.Group("/api")
	protected.Use(middleware.AuthRequired())
	{
		// Usuario
		protected.GET("/me", handlers.GetCurrentUser)
		protected.GET("/project-status", handlers.GetProjectStatus)

		// Agentes
		protected.POST("/agents", handlers.CreateAgent)
		protected.GET("/agents", handlers.GetUserAgents)
		protected.GET("/agents/:id", handlers.GetAgent)
		protected.PUT("/agents/:id", handlers.UpdateAgent)
		protected.DELETE("/agents/:id", handlers.DeleteAgent)
		protected.POST("/agents/:id/toggle", handlers.ToggleAgentStatus)
	}

	// ============================================
	// PÁGINAS WEB
	// ============================================

	// Dashboard (requiere autenticación)
	router.GET("/dashboard", middleware.AuthRequired(), func(c *gin.Context) {
		c.HTML(200, "dashboard.html", nil)
	})

	// Login page
	router.GET("/login", func(c *gin.Context) {
		c.HTML(200, "login.html", gin.H{
			"title": "Attomos",
		})
	})

	// Register page
	router.GET("/register", func(c *gin.Context) {
		c.HTML(200, "register.html", gin.H{
			"title": "Attomos",
		})
	})

	// Agents page (público)
	router.GET("/agents", func(c *gin.Context) {
		c.HTML(200, "agents.html", gin.H{
			"title": "Agentes - Attomos",
		})
	})

	// Pricing page (público)
	router.GET("/pricing", func(c *gin.Context) {
		c.HTML(200, "pricing.html", gin.H{
			"title": "Precios - Attomos",
		})
	})

	// Contact page (público)
	router.GET("/contact", func(c *gin.Context) {
		c.HTML(200, "contact.html", gin.H{
			"title": "Contacto - Attomos",
		})
	})

	// Onboarding (requiere autenticación)
	router.GET("/onboarding", middleware.AuthRequired(), func(c *gin.Context) {
		c.HTML(200, "onboarding.html", nil)
	})

	// Billing (requiere autenticación)
	router.GET("/billing", middleware.AuthRequired(), func(c *gin.Context) {
		c.HTML(200, "billing.html", nil)
	})

	// Plans (requiere autenticación)
	router.GET("/plans", middleware.AuthRequired(), func(c *gin.Context) {
		c.HTML(200, "plans.html", nil)
	})

	// ============================================
	// HEALTH CHECK
	// ============================================

	router.GET("/health", func(c *gin.Context) {
		c.JSON(200, gin.H{
			"status":  "ok",
			"message": "Attomos API is running",
		})
	})

	// ============================================
	// INICIAR SERVIDOR
	// ============================================

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	log.Printf("🚀 Servidor iniciado en puerto %s", port)
	log.Printf("📍 http://localhost:%s", port)

	if err := router.Run(":" + port); err != nil {
		log.Fatal("❌ Error al iniciar servidor:", err)
	}
}
