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

	// ============================================
	// INICIALIZAR GOOGLE OAUTH
	// ============================================
	if err := handlers.InitGoogleOAuth(); err != nil {
		log.Printf("⚠️  Google OAuth no inicializado: %v", err)
		log.Println("ℹ️  El login/registro con Google no estará disponible")
		log.Println("💡 Verifica que tengas configuradas las variables:")
		log.Println("   - GOOGLE_CLIENT_ID")
		log.Println("   - GOOGLE_CLIENT_SECRET")
		log.Println("   - GOOGLE_REDIRECT_URL")
	} else {
		log.Println("✅ Google OAuth inicializado correctamente")
	}

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
		AllowMethods:     []string{"GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"},
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

	// Landing page con precios de Stripe
	router.GET("/", handlers.GetIndexPage)

	// Autenticación tradicional
	router.POST("/api/register", handlers.Register)
	router.POST("/api/login", handlers.Login)
	router.POST("/api/logout", handlers.Logout)

	// ============================================
	// GOOGLE OAUTH ROUTES
	// ============================================
	router.GET("/api/auth/google/login", handlers.GoogleLogin)
	router.GET("/api/auth/google/callback", handlers.GoogleCallback)

	// ============================================
	// RUTAS PROTEGIDAS (API)
	// ============================================

	protected := router.Group("/api")
	protected.Use(middleware.AuthRequired())
	{
		// Usuario
		protected.GET("/me", handlers.GetCurrentUser)
		protected.GET("/project-status", handlers.GetProjectStatus)
		protected.PUT("/user/password", handlers.UpdatePassword)
		protected.DELETE("/user/account", handlers.DeleteAccount)

		// Agentes
		protected.POST("/agents", handlers.CreateAgent)
		protected.GET("/agents", handlers.GetUserAgents)
		protected.GET("/agents/:id", handlers.GetAgent)
		protected.PUT("/agents/:id", handlers.UpdateAgent)
		protected.DELETE("/agents/:id", handlers.DeleteAgent)
		protected.PATCH("/agents/:id/toggle", handlers.ToggleAgentStatus)

		// Billing
		protected.GET("/billing/data", handlers.GetBillingData)

		// Chatwoot
		protected.GET("/chatwoot/info", handlers.GetChatwootInfo)

		// Stripe - Pagos
		protected.POST("/stripe/checkout", handlers.CreateCheckoutSession)
		protected.POST("/stripe/confirm", handlers.ConfirmPayment)
		protected.GET("/stripe/public-key", handlers.GetStripePublicKey)
	}

	// ============================================
	// PÁGINAS WEB
	// ============================================

	// Dashboard (requiere autenticación)
	router.GET("/dashboard", middleware.AuthRequired(), func(c *gin.Context) {
		c.HTML(200, "dashboard.html", nil)
	})

	// My Agents (requiere autenticación)
	router.GET("/my-agents", middleware.AuthRequired(), func(c *gin.Context) {
		c.HTML(200, "my-agents.html", nil)
	})

	// Appointments (requiere autenticación)
	router.GET("/appointments", middleware.AuthRequired(), func(c *gin.Context) {
		c.HTML(200, "appointments.html", nil)
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

	router.GET("/plans", middleware.AuthRequired(), handlers.GetPlansPage)

	// Checkout (requiere autenticación)
	router.GET("/checkout", middleware.AuthRequired(), func(c *gin.Context) {
		c.HTML(200, "checkout.html", nil)
	})

	// Settings (requiere autenticación)
	router.GET("/settings", middleware.AuthRequired(), func(c *gin.Context) {
		c.HTML(200, "settings.html", nil)
	})

	// Profile (requiere autenticación)
	router.GET("/profile", middleware.AuthRequired(), func(c *gin.Context) {
		c.HTML(200, "profile.html", nil)
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

	log.Println("╔══════════════════════════════════════════════════════════╗")
	log.Printf("║ 🚀 Servidor Attomos iniciado exitosamente               ║")
	log.Printf("║ 📍 Puerto: %s                                           ║", port)
	log.Printf("║ 🌐 URL Local: http://localhost:%s                       ║", port)
	log.Println("╚══════════════════════════════════════════════════════════╝")

	if err := router.Run(":" + port); err != nil {
		log.Fatal("❌ Error al iniciar servidor:", err)
	}
}
