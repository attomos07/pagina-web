package main

import (
	"attomos/config"
	"attomos/handlers"
	"attomos/middleware"
	"attomos/models"
	"html/template"
	"log"
	"net/http"
	"os"

	"github.com/gin-gonic/gin"
	"github.com/joho/godotenv"
)

func main() {
	if err := godotenv.Load(); err != nil {
		log.Println("⚠️  Advertencia: No se encontró archivo .env")
	}

	log.Println("🔍 Verificando variables de entorno...")
	if os.Getenv("MYSQL_PUBLIC_URL") == "" && os.Getenv("MYSQL_HOST") == "" {
		log.Println("⚠️  Advertencia: No hay configuración de MySQL")
	} else {
		log.Println("✅ Configuración de MySQL encontrada")
	}

	config.ConnectDatabase()

	if err := config.DB.AutoMigrate(&models.User{}); err != nil {
		log.Fatal("Error al migrar la base de datos:", err)
	}
	log.Println("✅ Migraciones completadas")

	if _, err := os.Stat("./templates"); os.IsNotExist(err) {
		log.Fatal("❌ ERROR: Falta la carpeta templates/")
	}
	if _, err := os.Stat("./static"); os.IsNotExist(err) {
		log.Println("⚠️  Advertencia: Falta la carpeta static/")
	}

	if os.Getenv("GIN_MODE") == "release" {
		gin.SetMode(gin.ReleaseMode)
	}

	router := gin.Default()

	// ✅ Cargar templates de forma explícita por nivel de directorio
	tmpl := template.New("") // Start with a base template

	// Top-level files in templates/
	basePatterns := []string{
		"templates/*.html",          // e.g., index.html, dashboard.html
		"templates/auth/*.html",     // e.g., auth/login.html, auth/register.html
		"templates/partials/*.html", // e.g., partials/agents.html, etc.
	}

	for _, pattern := range basePatterns {
		parsed, err := tmpl.ParseGlob(pattern)
		if err != nil {
			log.Fatalf("❌ Error parsing templates from %s: %v", pattern, err)
		}
		tmpl = parsed
	}

	if len(tmpl.Templates()) == 0 {
		log.Fatal("❌ No templates found! Check your templates/ directory.")
	}

	router.SetHTMLTemplate(tmpl)
	log.Printf("✅ Templates cargados correctamente (%d archivos)", len(tmpl.Templates()))

	router.Static("/static", "./static")

	// ==========================================
	// RUTAS PÚBLICAS
	// ==========================================
	router.GET("/", func(c *gin.Context) {
		log.Println("📄 Solicitud GET / recibida")
		c.HTML(http.StatusOK, "index.html", gin.H{"title": "Attomos"})
	})

	router.GET("/agents", func(c *gin.Context) {
		c.HTML(http.StatusOK, "agents.html", gin.H{"title": "Agentes"})
	})

	router.GET("/pricing", func(c *gin.Context) {
		c.HTML(http.StatusOK, "pricing.html", gin.H{"title": "Precios"})
	})

	router.GET("/contact", func(c *gin.Context) {
		c.HTML(http.StatusOK, "contact.html", gin.H{"title": "Contacto"})
	})

	router.GET("/login", func(c *gin.Context) {
		c.HTML(http.StatusOK, "login.html", gin.H{"title": "Iniciar sesión"})
	})

	router.GET("/register", func(c *gin.Context) {
		c.HTML(http.StatusOK, "register.html", gin.H{"title": "Registrarse"})
	})

	router.GET("/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "ok"})
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
	// RUTAS PROTEGIDAS
	// ==========================================
	protected := router.Group("/")
	protected.Use(middleware.AuthRequired())
	{
		protected.GET("/dashboard", func(c *gin.Context) {
			c.HTML(http.StatusOK, "dashboard.html", gin.H{"title": "Dashboard"})
		})

		api := protected.Group("/api")
		{
			api.GET("/me", handlers.GetCurrentUser)
		}
	}

	router.NoRoute(func(c *gin.Context) {
		c.JSON(http.StatusNotFound, gin.H{
			"error": "Ruta no encontrada",
			"path":  c.Request.URL.Path,
		})
	})

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	log.Printf("🚀 Servidor corriendo en http://localhost:%s\n", port)
	if err := router.Run(":" + port); err != nil {
		log.Fatal("Error al iniciar el servidor:", err)
	}
}
