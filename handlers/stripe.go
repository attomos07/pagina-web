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
	stripe_lib "github.com/stripe/stripe-go/v78"
	"github.com/stripe/stripe-go/v78/paymentintent"
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
		c.JSON(http.StatusUnauthorized, gin.H{"error": "No autenticado"})
		return
	}
	user := userInterface.(*models.User)

	log.Printf("🛒 [User %d] Creando checkout session para plan: %s (%s)", user.ID, req.Plan, req.BillingPeriod)

	stripeService, err := services.NewStripeService()
	if err != nil {
		log.Printf("❌ Error inicializando Stripe: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Error al procesar el pago"})
		return
	}

	var subscription models.Subscription
	err = config.DB.Where("user_id = ?", user.ID).First(&subscription).Error

	var stripeCustomerID string

	if err == nil && subscription.StripeCustomerID != "" {
		stripeCustomerID = subscription.StripeCustomerID
		log.Printf("✅ [User %d] Cliente existente de Stripe: %s", user.ID, stripeCustomerID)
	} else {
		customer, err := stripeService.CreateCustomer(req.Email, req.FullName, req.Phone)
		if err != nil {
			log.Printf("❌ Error creando cliente en Stripe: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Error al procesar el pago"})
			return
		}
		stripeCustomerID = customer.ID

		if subscription.ID != 0 {
			subscription.StripeCustomerID = stripeCustomerID
			config.DB.Save(&subscription)
		} else {
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

	amount := stripeService.CalculateAmount(req.Plan, req.BillingPeriod)
	if amount == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Plan inválido"})
		return
	}

	description := "Suscripción a Attomos - Plan " + req.Plan
	paymentIntent, err := stripeService.CreatePaymentIntent(amount, "mxn", stripeCustomerID, description)
	if err != nil {
		log.Printf("❌ Error creando PaymentIntent: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Error al procesar el pago"})
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

// ConfirmPayment verifica el pago con Stripe, activa la suscripción y registra el pago
func ConfirmPayment(c *gin.Context) {
	var req ConfirmPaymentRequest

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Datos inválidos"})
		return
	}

	userInterface, exists := c.Get("user")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "No autenticado"})
		return
	}
	user := userInterface.(*models.User)

	log.Printf("💳 [User %d] Confirmando pago: %s", user.ID, req.PaymentIntentID)

	// ============================================
	// 1. VERIFICAR EL PAGO CON STRIPE (seguridad)
	// ============================================
	stripe_lib.Key = os.Getenv("STRIPE_SECRET_KEY")

	pi, err := paymentintent.Get(req.PaymentIntentID, nil)
	if err != nil {
		log.Printf("❌ [User %d] Error obteniendo PaymentIntent de Stripe: %v", user.ID, err)
		c.JSON(http.StatusBadRequest, gin.H{"error": "PaymentIntent no encontrado"})
		return
	}

	if pi.Status != stripe_lib.PaymentIntentStatusSucceeded {
		log.Printf("❌ [User %d] PaymentIntent %s no está completado (status: %s)", user.ID, req.PaymentIntentID, pi.Status)
		c.JSON(http.StatusBadRequest, gin.H{
			"error":  "El pago no ha sido completado",
			"status": string(pi.Status),
		})
		return
	}

	log.Printf("✅ [User %d] Pago verificado en Stripe: %s ($%.2f MXN)", user.ID, pi.ID, float64(pi.Amount)/100)

	// ============================================
	// 2. ACTUALIZAR SUSCRIPCIÓN
	// ============================================
	var subscription models.Subscription
	err = config.DB.Where("user_id = ?", user.ID).First(&subscription).Error

	now := time.Now()
	var periodEnd time.Time
	if req.BillingPeriod == "annual" {
		periodEnd = now.AddDate(1, 0, 0)
	} else {
		periodEnd = now.AddDate(0, 1, 0)
	}

	if err != nil {
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
		prevPlan := subscription.Plan
		subscription.Plan = req.Plan
		subscription.BillingCycle = req.BillingPeriod
		subscription.Status = "active"
		subscription.CurrentPeriodStart = &now
		subscription.CurrentPeriodEnd = &periodEnd
		if prevPlan != req.Plan {
			subscription.PlanChangedAt = &now
		}
		subscription.SetPlanLimits()
		config.DB.Save(&subscription)
	}

	log.Printf("✅ [User %d] Suscripción activada: Plan %s hasta %s", user.ID, req.Plan, periodEnd.Format("2006-01-02"))

	// ============================================
	// 3. REGISTRAR EL PAGO EN LA TABLA payments
	// ============================================
	// Extraer charge ID si existe
	chargeID := ""
	if pi.LatestCharge != nil {
		chargeID = pi.LatestCharge.ID
	}

	planDisplay := map[string]string{
		"proton":   "Protón",
		"neutron":  "Neutrón",
		"electron": "Electrón",
	}
	displayName := planDisplay[req.Plan]
	if displayName == "" {
		displayName = req.Plan
	}

	payment := models.Payment{
		UserID:                user.ID,
		SubscriptionID:        subscription.ID,
		StripePaymentIntentID: pi.ID,
		StripeChargeID:        chargeID,
		Amount:                pi.Amount,
		Currency:              string(pi.Currency),
		Status:                "succeeded",
		PaymentMethod:         "card",
		Plan:                  req.Plan,
		BillingCycle:          req.BillingPeriod,
		Description:           "Suscripción Attomos - Plan " + displayName,
		PaidAt:                &now,
	}

	if err := config.DB.Create(&payment).Error; err != nil {
		// No es fatal, loguear pero no romper el flujo
		log.Printf("⚠️  [User %d] Error guardando registro de pago: %v", user.ID, err)
	} else {
		log.Printf("✅ [User %d] Pago registrado en BD: ID %d, $%.2f MXN", user.ID, payment.ID, float64(pi.Amount)/100)
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Pago confirmado exitosamente",
		"subscription": gin.H{
			"plan":   subscription.Plan,
			"status": subscription.Status,
		},
		"payment": gin.H{
			"id":     payment.ID,
			"amount": payment.GetFormattedAmount(),
		},
	})
}

// GetStripePublicKey retorna la clave pública de Stripe
func GetStripePublicKey(c *gin.Context) {
	publicKey := os.Getenv("STRIPE_PUBLISHABLE_KEY")
	if publicKey == "" {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Clave pública no configurada"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"publicKey": publicKey})
}
