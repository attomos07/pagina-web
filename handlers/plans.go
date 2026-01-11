package handlers

import (
	"log"
	"net/http"
	"os"

	"attomos/config"
	"attomos/models"

	"github.com/gin-gonic/gin"
	"github.com/stripe/stripe-go/v78"
	"github.com/stripe/stripe-go/v78/price"
)

// GetPlansPage renderiza la página de planes con precios de Stripe
func GetPlansPage(c *gin.Context) {
	userInterface, exists := c.Get("user")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{
			"error": "No autenticado",
		})
		return
	}

	user := userInterface.(*models.User)

	// Obtener suscripción del usuario
	var subscription models.Subscription
	currentPlan := "pending"
	if err := config.DB.Where("user_id = ?", user.ID).First(&subscription).Error; err == nil {
		currentPlan = subscription.Plan
	}

	// Configurar Stripe
	stripe.Key = os.Getenv("STRIPE_SECRET_KEY")

	// Obtener precios desde Stripe
	plans := getPlansData()

	c.HTML(http.StatusOK, "plans.html", gin.H{
		"user":        user,
		"plans":       plans,
		"currentPlan": currentPlan,
	})
}

// GetIndexPage renderiza la landing page con precios de Stripe
func GetIndexPage(c *gin.Context) {
	// Configurar Stripe
	stripe.Key = os.Getenv("STRIPE_SECRET_KEY")

	// Obtener precios desde Stripe
	plans := getPlansData()

	c.HTML(http.StatusOK, "index.html", gin.H{
		"title": "Attomos - Automatiza tu negocio con Agentes de IA",
		"plans": plans,
	})
}

// GetPlansDataAPI devuelve los datos de los planes en formato JSON
func GetPlansDataAPI(c *gin.Context) {
	// Configurar Stripe
	stripe.Key = os.Getenv("STRIPE_SECRET_KEY")

	// Obtener datos de los planes
	plans := getPlansData()

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"plans":   plans,
	})
}

// getPlansData obtiene los datos de los planes con precios de Stripe
func getPlansData() []gin.H {
	return []gin.H{
		{
			"id":          "gratuito",
			"name":        "Plan Gratuito",
			"displayName": "Gratuito",
			"description": "Perfecto para empezar sin compromisos",
			"subtitle":    "Perfecto para probar sin compromisos",
			"monthly": gin.H{
				"amount":  0,
				"priceId": "",
			},
			"annual": gin.H{
				"amount":  0,
				"priceId": "",
			},
			"features": []string{
				"1 agente de WhatsApp",
				"WhatsApp Web (escaneo QR)",
				"Mensajes ilimitados",
				"IA con Gemini",
				"Google Sheets",
				"Google Calendar",
				"Horarios personalizados de atención",
				"Catálogo de servicios",
				"Promociones de servicios",
				"📜 Ofertas de trabajo",
			},
			"isFree":     true,
			"badge":      "✨ Prueba Gratis",
			"badgeClass": "trial",
		},
		{
			"id":          "proton",
			"name":        "Plan Protón",
			"displayName": "Protón",
			"description": "Ideal para empresas de servicios",
			"subtitle":    "Ideal para comenzar tu negocio",
			"monthly": gin.H{
				"amount":  getStripePriceAmount("STRIPE_PROTON_MONTHLY_PRICE_ID"),
				"priceId": os.Getenv("STRIPE_PROTON_MONTHLY_PRICE_ID"),
			},
			"annual": gin.H{
				"amount":  getStripePriceAmount("STRIPE_PROTON_ANNUAL_PRICE_ID"),
				"priceId": os.Getenv("STRIPE_PROTON_ANNUAL_PRICE_ID"),
			},
			"features": []string{
				"Agentes ilimitados",
				"Meta WhatsApp Business API",
				"Mensajes ilimitados",
				"IA con Gemini avanzada",
				"Chatwoot CRM integrado",
				"Google Calendar",
				"Horarios personalizados de atención",
				"Catálogo de servicios",
				"Promociones de servicios",
				"📜 Ofertas de trabajo",
			},
		},
		{
			"id":          "neutron",
			"name":        "Plan Neutrón",
			"displayName": "Neutrón",
			"description": "Ideal para e-commerce",
			"subtitle":    "Para negocios en crecimiento",
			"popular":     true,
			"comingSoon":  true,
			"badge":       "🔥 Más Popular",
			"badgeClass":  "popular",
			"monthly": gin.H{
				"amount":  getStripePriceAmount("STRIPE_NEUTRON_MONTHLY_PRICE_ID"),
				"priceId": os.Getenv("STRIPE_NEUTRON_MONTHLY_PRICE_ID"),
			},
			"annual": gin.H{
				"amount":  getStripePriceAmount("STRIPE_NEUTRON_ANNUAL_PRICE_ID"),
				"priceId": os.Getenv("STRIPE_NEUTRON_ANNUAL_PRICE_ID"),
			},
			"features": []string{
				"Agentes ilimitados",
				"Meta WhatsApp Business API",
				"Mensajes ilimitados",
				"Chatwoot CRM integrado",
				"IA con Gemini avanzada",
				"Google Sheets para ventas",
				"Catálogo de productos",
				"Promociones y packs",
				"Página web + App móvil",
				"Sistema de inventario",
				"Punto de venta (POS)",
				"Ofertas de trabajo",
			},
		},
		{
			"id":          "electron",
			"name":        "Plan Electrón",
			"displayName": "Electrón",
			"description": "Agente telefónico con voz IA",
			"subtitle":    "Para empresas grandes",
			"comingSoon":  true,
			"badge":       "⚡ Enterprise",
			"badgeClass":  "enterprise",
			"monthly": gin.H{
				"amount":  getStripePriceAmount("STRIPE_ELECTRON_MONTHLY_PRICE_ID"),
				"priceId": os.Getenv("STRIPE_ELECTRON_MONTHLY_PRICE_ID"),
			},
			"annual": gin.H{
				"amount":  getStripePriceAmount("STRIPE_ELECTRON_ANNUAL_PRICE_ID"),
				"priceId": os.Getenv("STRIPE_ELECTRON_ANNUAL_PRICE_ID"),
			},
			"features": []string{
				"Todo del plan Neutrón",
				"Llamadas entrantes con IA",
				"Llamadas salientes automatizadas",
				"Voz natural con IA",
				"Integración telefónica",
				"Múltiples voces disponibles",
				"Transcripción en tiempo real",
				"Análisis de sentimiento",
				"IVR inteligente con IA",
				"Grabación de llamadas",
				"Analytics de llamadas",
			},
		},
	}
}

// getStripePriceAmount obtiene el precio desde Stripe API
func getStripePriceAmount(envKey string) int64 {
	priceID := os.Getenv(envKey)
	if priceID == "" {
		log.Printf("⚠️  %s no está configurado, usando precio por defecto", envKey)
		return 0
	}

	p, err := price.Get(priceID, nil)
	if err != nil {
		log.Printf("⚠️  Error obteniendo precio de Stripe para %s: %v", envKey, err)
		return 0
	}

	return p.UnitAmount / 100
}
