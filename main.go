package main

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

func main() {
	// Create Gin router
	router := gin.Default()

	// Load all necessary templates explicitly
	router.LoadHTMLFiles(
		"templates/index.html",
		"templates/partials/agents.html", // Ensure this file exists
		"templates/partials/contact.html",
		"templates/partials/footer.html",
		"templates/partials/navbar.html",
		"templates/partials/pricing.html",
		"templates/auth/login.html",
		"templates/auth/register.html",
	)

	// Serve static files
	router.Static("/static", "./static")

	// Routes for each page
	router.GET("/", func(c *gin.Context) {
		c.HTML(http.StatusOK, "index.html", gin.H{
			"title": "Attomos",
		})
	})

	router.GET("/agents", func(c *gin.Context) {
		c.HTML(http.StatusOK, "agents.html", gin.H{ // Match the template name
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
		c.HTML(http.StatusOK, "login.html", gin.H{ // Placeholder, replace with actual template
			"title": "Iniciar sesión",
		})
	})

	router.GET("/register", func(c *gin.Context) {
		c.HTML(http.StatusOK, "register.html", gin.H{ // Placeholder, replace with actual template
			"title": "Registrarse",
		})
	})

	// Start server
	router.Run(":8080")
}
