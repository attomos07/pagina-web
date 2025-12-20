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

// getPlansData obtiene los datos de los planes con precios de Stripe
func getPlansData() []gin.H {
	return []gin.H{
		{
			"id":          "gratuito",
			"name":        "Plan Gratuito",
			"description": "Perfecto para probar Attomos con tu primer chatbot.",
			"monthly": gin.H{
				"amount":  0,
				"priceId": "",
			},
			"annual": gin.H{
				"amount":  0,
				"priceId": "",
			},
			"features": []string{
				"1 Chatbot (AtomicBot)",
				"100 mensajes/mes",
				"WhatsApp Web",
				"IA básica con Gemini",
				"30 días de prueba",
				"Soporte por email",
			},
			"isFree": true,
		},
		{
			"id":          "proton",
			"name":        "Plan Protón",
			"description": "Perfecto para pequeños negocios que comienzan con chatbots.",
			"monthly": gin.H{
				"amount":  getStripePriceAmount("STRIPE_PROTON_MONTHLY_PRICE_ID"),
				"priceId": os.Getenv("STRIPE_PROTON_MONTHLY_PRICE_ID"),
			},
			"annual": gin.H{
				"amount":  getStripePriceAmount("STRIPE_PROTON_ANNUAL_PRICE_ID"),
				"priceId": os.Getenv("STRIPE_PROTON_ANNUAL_PRICE_ID"),
			},
			"features": []string{
				"1 Chatbot (BuilderBot)",
				"1,000 mensajes/mes",
				"Meta WhatsApp Business API",
				"Panel de mensajes (Chatwoot)",
				"Soporte por email",
				"Analytics básico",
			},
		},
		{
			"id":          "neutron",
			"name":        "Plan Neutrón",
			"description": "Ideal para Mipymes en crecimiento.",
			"popular":     true,
			"monthly": gin.H{
				"amount":  getStripePriceAmount("STRIPE_NEUTRON_MONTHLY_PRICE_ID"),
				"priceId": os.Getenv("STRIPE_NEUTRON_MONTHLY_PRICE_ID"),
			},
			"annual": gin.H{
				"amount":  getStripePriceAmount("STRIPE_NEUTRON_ANNUAL_PRICE_ID"),
				"priceId": os.Getenv("STRIPE_NEUTRON_ANNUAL_PRICE_ID"),
			},
			"features": []string{
				"3 Chatbots incluidos",
				"10,000 mensajes/mes",
				"Todas las plataformas",
				"Soporte prioritario",
				"Analytics avanzados",
				"Integraciones CRM",
			},
		},
		{
			"id":          "electron",
			"name":        "Plan Electrón",
			"description": "Plan premium con consumo ilimitado y soporte dedicado.",
			"monthly": gin.H{
				"amount":  getStripePriceAmount("STRIPE_ELECTRON_MONTHLY_PRICE_ID"),
				"priceId": os.Getenv("STRIPE_ELECTRON_MONTHLY_PRICE_ID"),
			},
			"annual": gin.H{
				"amount":  getStripePriceAmount("STRIPE_ELECTRON_ANNUAL_PRICE_ID"),
				"priceId": os.Getenv("STRIPE_ELECTRON_ANNUAL_PRICE_ID"),
			},
			"features": []string{
				"Chatbots ilimitados",
				"Mensajes ilimitados",
				"Todas las funcionalidades",
				"Soporte dedicado 24/7",
				"API personalizada",
				"Onboarding personalizado",
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
