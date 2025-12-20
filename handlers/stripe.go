package handlers

import (
	"log"
	"net/http"
	"os"
	"time"

	"attomos/config"
	"attomos/models"
	"attomos/services"

	"github.com/gin-gonic/gin"
)

type CheckoutRequest struct {
	FullName      string `json:"fullName" binding:"required"`
	Email         string `json:"email" binding:"required,email"`
	Phone         string `json:"phone"`
	CountryCode   string `json:"countryCode" binding:"required"`
	PostalCode    string `json:"postalCode" binding:"required"`
	Plan          string `json:"plan" binding:"required"`
	BillingPeriod string `json:"billingPeriod" binding:"required"`
}

type CheckoutResponse struct {
	ClientSecret string `json:"clientSecret"`
	CustomerID   string `json:"customerId"`
	Amount       int64  `json:"amount"`
	Currency     string `json:"currency"`
}

// CreateCheckoutSession crea una sesión de checkout con Stripe
func CreateCheckoutSession(c *gin.Context) {
	var req CheckoutRequest

	if err := c.ShouldBindJSON(&req); err != nil {
		log.Printf("❌ Error al parsear JSON: %v", err)
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   "Datos inválidos",
			"details": err.Error(),
		})
		return
	}

	userInterface, exists := c.Get("user")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{
			"error": "No autenticado",
		})
		return
	}

	user := userInterface.(*models.User)

	log.Printf("🛒 [User %d] Creando checkout session para plan: %s (%s)", user.ID, req.Plan, req.BillingPeriod)

	// Inicializar servicio de Stripe
	stripeService, err := services.NewStripeService()
	if err != nil {
		log.Printf("❌ Error inicializando Stripe: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Error al procesar el pago",
		})
		return
	}

	// Obtener o crear suscripción del usuario
	var subscription models.Subscription
	err = config.DB.Where("user_id = ?", user.ID).First(&subscription).Error

	var stripeCustomerID string

	if err == nil && subscription.StripeCustomerID != "" {
		// Usuario ya tiene un Customer ID en Stripe
		stripeCustomerID = subscription.StripeCustomerID
		log.Printf("✅ [User %d] Cliente existente de Stripe: %s", user.ID, stripeCustomerID)
	} else {
		// Crear nuevo cliente en Stripe
		fullPhone := req.Phone
		customer, err := stripeService.CreateCustomer(req.Email, req.FullName, fullPhone)
		if err != nil {
			log.Printf("❌ Error creando cliente en Stripe: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{
				"error": "Error al procesar el pago",
			})
			return
		}

		stripeCustomerID = customer.ID

		// Guardar Customer ID en suscripción
		if subscription.ID != 0 {
			// Suscripción existe, actualizar
			subscription.StripeCustomerID = stripeCustomerID
			config.DB.Save(&subscription)
		} else {
			// Crear nueva suscripción con Customer ID
			subscription = models.Subscription{
				UserID:           user.ID,
				StripeCustomerID: stripeCustomerID,
				Plan:             "pending",
				Status:           "inactive",
				Currency:         "mxn",
			}
			config.DB.Create(&subscription)
		}

		log.Printf("✅ [User %d] Nuevo cliente creado en Stripe: %s", user.ID, stripeCustomerID)
	}

	// Calcular monto según plan y período
	amount := stripeService.CalculateAmount(req.Plan, req.BillingPeriod)
	if amount == 0 {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Plan inválido",
		})
		return
	}

	// Crear Payment Intent
	description := "Suscripción a Attomos - Plan " + req.Plan
	paymentIntent, err := stripeService.CreatePaymentIntent(
		amount,
		"mxn",
		stripeCustomerID,
		description,
	)

	if err != nil {
		log.Printf("❌ Error creando PaymentIntent: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Error al procesar el pago",
		})
		return
	}

	log.Printf("✅ [User %d] PaymentIntent creado: %s (Monto: $%.2f MXN)", user.ID, paymentIntent.ID, float64(amount)/100)

	c.JSON(http.StatusOK, CheckoutResponse{
		ClientSecret: paymentIntent.ClientSecret,
		CustomerID:   stripeCustomerID,
		Amount:       amount,
		Currency:     "mxn",
	})
}

type ConfirmPaymentRequest struct {
	PaymentIntentID string `json:"paymentIntentId" binding:"required"`
	Plan            string `json:"plan" binding:"required"`
	BillingPeriod   string `json:"billingPeriod" binding:"required"`
}

// ConfirmPayment confirma el pago y activa la suscripción
func ConfirmPayment(c *gin.Context) {
	var req ConfirmPaymentRequest

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Datos inválidos",
		})
		return
	}

	userInterface, exists := c.Get("user")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{
			"error": "No autenticado",
		})
		return
	}

	user := userInterface.(*models.User)

	log.Printf("💳 [User %d] Confirmando pago: %s", user.ID, req.PaymentIntentID)

	// Obtener o crear suscripción
	var subscription models.Subscription
	err := config.DB.Where("user_id = ?", user.ID).First(&subscription).Error

	now := time.Now()
	var periodEnd time.Time

	if req.BillingPeriod == "annual" {
		periodEnd = now.AddDate(1, 0, 0)
	} else {
		periodEnd = now.AddDate(0, 1, 0)
	}

	if err != nil {
		// Crear nueva suscripción
		subscription = models.Subscription{
			UserID:             user.ID,
			Plan:               req.Plan,
			BillingCycle:       req.BillingPeriod,
			Status:             "active",
			CurrentPeriodStart: &now,
			CurrentPeriodEnd:   &periodEnd,
			Currency:           "mxn",
		}
		subscription.SetPlanLimits()
		config.DB.Create(&subscription)
	} else {
		// Actualizar suscripción existente
		subscription.Plan = req.Plan
		subscription.BillingCycle = req.BillingPeriod
		subscription.Status = "active"
		subscription.CurrentPeriodStart = &now
		subscription.CurrentPeriodEnd = &periodEnd
		subscription.SetPlanLimits()
		config.DB.Save(&subscription)
	}

	log.Printf("✅ [User %d] Suscripción activada: Plan %s", user.ID, req.Plan)

	c.JSON(http.StatusOK, gin.H{
		"message": "Pago confirmado exitosamente",
		"subscription": gin.H{
			"plan":   subscription.Plan,
			"status": subscription.Status,
		},
	})
}

// GetStripePublicKey retorna la clave pública de Stripe
func GetStripePublicKey(c *gin.Context) {
	publicKey := os.Getenv("STRIPE_PUBLISHABLE_KEY")

	if publicKey == "" {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Clave pública no configurada",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"publicKey": publicKey,
	})
}
