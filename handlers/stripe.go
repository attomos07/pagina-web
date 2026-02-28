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
		log.Printf("❌ [CHECKOUT] Error al parsear JSON: %v", err)
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   "Datos inválidos",
			"details": err.Error(),
		})
		return
	}

	userInterface, exists := c.Get("user")
	if !exists {
		log.Printf("❌ [CHECKOUT] Usuario no autenticado")
		c.JSON(http.StatusUnauthorized, gin.H{"error": "No autenticado"})
		return
	}
	user := userInterface.(*models.User)

	log.Printf("🛒 [CHECKOUT] ══════════════════════════════════")
	log.Printf("🛒 [CHECKOUT] Usuario ID: %d | Email: %s", user.ID, user.Email)
	log.Printf("🛒 [CHECKOUT] Plan: %s | Período: %s", req.Plan, req.BillingPeriod)
	log.Printf("🛒 [CHECKOUT] ══════════════════════════════════")

	stripeService, err := services.NewStripeService()
	if err != nil {
		log.Printf("❌ [CHECKOUT] Error inicializando Stripe: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Error al procesar el pago"})
		return
	}

	var subscription models.Subscription
	err = config.DB.Where("user_id = ?", user.ID).First(&subscription).Error

	var stripeCustomerID string

	if err == nil && subscription.StripeCustomerID != "" {
		stripeCustomerID = subscription.StripeCustomerID
		log.Printf("✅ [CHECKOUT] Cliente Stripe existente: %s", stripeCustomerID)
	} else {
		log.Printf("🆕 [CHECKOUT] Creando nuevo cliente en Stripe para: %s", req.Email)
		customer, err := stripeService.CreateCustomer(req.Email, req.FullName, req.Phone)
		if err != nil {
			log.Printf("❌ [CHECKOUT] Error creando cliente en Stripe: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Error al procesar el pago"})
			return
		}
		stripeCustomerID = customer.ID
		log.Printf("✅ [CHECKOUT] Nuevo cliente Stripe creado: %s", stripeCustomerID)

		if subscription.ID != 0 {
			subscription.StripeCustomerID = stripeCustomerID
			config.DB.Save(&subscription)
			log.Printf("✅ [CHECKOUT] StripeCustomerID guardado en suscripción existente ID: %d", subscription.ID)
		} else {
			subscription = models.Subscription{
				UserID:           user.ID,
				StripeCustomerID: stripeCustomerID,
				Plan:             "pending",
				Status:           "inactive",
				Currency:         "mxn",
			}
			config.DB.Create(&subscription)
			log.Printf("✅ [CHECKOUT] Nueva suscripción creada con ID: %d", subscription.ID)
		}
	}

	amount := stripeService.CalculateAmount(req.Plan, req.BillingPeriod)
	if amount == 0 {
		log.Printf("❌ [CHECKOUT] Plan inválido o monto 0 para plan: %s", req.Plan)
		c.JSON(http.StatusBadRequest, gin.H{"error": "Plan inválido"})
		return
	}

	log.Printf("💰 [CHECKOUT] Monto calculado: $%.2f MXN para plan %s", float64(amount)/100, req.Plan)

	description := "Suscripción a Attomos - Plan " + req.Plan
	paymentIntent, err := stripeService.CreatePaymentIntent(amount, "mxn", stripeCustomerID, description)
	if err != nil {
		log.Printf("❌ [CHECKOUT] Error creando PaymentIntent: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Error al procesar el pago"})
		return
	}

	log.Printf("✅ [CHECKOUT] PaymentIntent creado: %s | Monto: $%.2f MXN", paymentIntent.ID, float64(amount)/100)

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
		log.Printf("❌ [CONFIRM] Error parseando JSON: %v", err)
		c.JSON(http.StatusBadRequest, gin.H{"error": "Datos inválidos"})
		return
	}

	userInterface, exists := c.Get("user")
	if !exists {
		log.Printf("❌ [CONFIRM] Usuario no autenticado")
		c.JSON(http.StatusUnauthorized, gin.H{"error": "No autenticado"})
		return
	}
	user := userInterface.(*models.User)

	log.Printf("💳 [CONFIRM] ══════════════════════════════════")
	log.Printf("💳 [CONFIRM] Usuario ID: %d | Email: %s", user.ID, user.Email)
	log.Printf("💳 [CONFIRM] PaymentIntentID: %s", req.PaymentIntentID)
	log.Printf("💳 [CONFIRM] Plan: %s | Período: %s", req.Plan, req.BillingPeriod)
	log.Printf("💳 [CONFIRM] ══════════════════════════════════")

	// ============================================
	// PASO 1: VERIFICAR PAGO CON STRIPE
	// ============================================
	log.Printf("🔍 [CONFIRM] PASO 1: Verificando pago con Stripe...")
	stripe_lib.Key = os.Getenv("STRIPE_SECRET_KEY")

	if stripe_lib.Key == "" {
		log.Printf("❌ [CONFIRM] STRIPE_SECRET_KEY no está configurada")
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Configuración de pagos incorrecta"})
		return
	}

	pi, err := paymentintent.Get(req.PaymentIntentID, &stripe_lib.PaymentIntentParams{
		Params: stripe_lib.Params{
			Expand: []*string{stripe_lib.String("latest_charge")},
		},
	})
	if err != nil {
		log.Printf("❌ [CONFIRM] Error obteniendo PaymentIntent de Stripe: %v", err)
		c.JSON(http.StatusBadRequest, gin.H{"error": "PaymentIntent no encontrado"})
		return
	}

	log.Printf("✅ [CONFIRM] PaymentIntent obtenido: %s | Status: %s | Monto: $%.2f MXN",
		pi.ID, pi.Status, float64(pi.Amount)/100)

	if pi.Status != stripe_lib.PaymentIntentStatusSucceeded {
		log.Printf("❌ [CONFIRM] Pago NO completado. Status actual: %s (se requiere: succeeded)", pi.Status)
		c.JSON(http.StatusBadRequest, gin.H{
			"error":  "El pago no ha sido completado",
			"status": string(pi.Status),
		})
		return
	}

	log.Printf("✅ [CONFIRM] PASO 1 OK — Pago verificado en Stripe: $%.2f MXN", float64(pi.Amount)/100)

	// ============================================
	// PASO 2: ACTUALIZAR SUSCRIPCIÓN
	// ============================================
	log.Printf("🔄 [CONFIRM] PASO 2: Actualizando suscripción en BD...")

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
		log.Printf("⚠️  [CONFIRM] No existe suscripción previa para user %d — Creando nueva", user.ID)
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
		if dbErr := config.DB.Create(&subscription).Error; dbErr != nil {
			log.Printf("❌ [CONFIRM] Error creando suscripción: %v", dbErr)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Error activando suscripción"})
			return
		}
		log.Printf("✅ [CONFIRM] Nueva suscripción creada con ID: %d", subscription.ID)
	} else {
		prevPlan := subscription.Plan
		subscription.Plan = req.Plan
		subscription.BillingCycle = req.BillingPeriod
		subscription.Status = "active"
		subscription.CurrentPeriodStart = &now
		subscription.CurrentPeriodEnd = &periodEnd
		if prevPlan != req.Plan {
			subscription.PlanChangedAt = &now
			log.Printf("📋 [CONFIRM] Cambio de plan: %s → %s", prevPlan, req.Plan)
		}
		subscription.SetPlanLimits()
		if dbErr := config.DB.Save(&subscription).Error; dbErr != nil {
			log.Printf("❌ [CONFIRM] Error actualizando suscripción: %v", dbErr)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Error actualizando suscripción"})
			return
		}
		log.Printf("✅ [CONFIRM] Suscripción ID %d actualizada — Plan: %s | Status: active | Expira: %s",
			subscription.ID, req.Plan, periodEnd.Format("2006-01-02"))
	}

	log.Printf("✅ [CONFIRM] PASO 2 OK — SubscriptionID: %d", subscription.ID)

	// ============================================
	// PASO 3: REGISTRAR PAGO EN TABLA payments
	// ============================================
	log.Printf("💾 [CONFIRM] PASO 3: Guardando pago en tabla payments...")
	log.Printf("💾 [CONFIRM] Datos: UserID=%d | SubID=%d | PI=%s | Amount=%d | Currency=%s | Plan=%s",
		user.ID, subscription.ID, pi.ID, pi.Amount, pi.Currency, req.Plan)

	// Extraer charge ID si existe
	chargeID := ""
	if pi.LatestCharge != nil {
		chargeID = pi.LatestCharge.ID
		log.Printf("💾 [CONFIRM] ChargeID: %s", chargeID)
	} else {
		log.Printf("⚠️  [CONFIRM] No hay LatestCharge en el PaymentIntent")
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

	// Verificar si ya existe ese PaymentIntent en la BD
	var existingPayment models.Payment
	searchErr := config.DB.Where("stripe_payment_intent_id = ?", pi.ID).First(&existingPayment).Error

	if searchErr == nil {
		// Ya existe — no duplicar
		log.Printf("ℹ️  [CONFIRM] Pago ya existía en BD con ID: %d — No se duplica", existingPayment.ID)
		payment = existingPayment
	} else {
		// No existe — crear nuevo
		log.Printf("💾 [CONFIRM] Pago no existe en BD, insertando nuevo registro...")
		if createErr := config.DB.Create(&payment).Error; createErr != nil {
			log.Printf("❌ [CONFIRM] ERROR AL GUARDAR PAGO EN BD: %v", createErr)
			log.Printf("❌ [CONFIRM] Datos del pago fallido: %+v", payment)
			// NO retornamos error al cliente — la suscripción ya está activa
			// pero sí logueamos el error claramente
		} else {
			log.Printf("✅ [CONFIRM] PASO 3 OK — Pago guardado en BD con ID: %d", payment.ID)
			log.Printf("✅ [CONFIRM] Resumen: User=%d | Sub=%d | Payment=%d | $%.2f MXN | Plan=%s",
				user.ID, subscription.ID, payment.ID, float64(pi.Amount)/100, req.Plan)
		}
	}

	log.Printf("🎉 [CONFIRM] ══ PAGO COMPLETADO ══════════════════")
	log.Printf("🎉 [CONFIRM] Usuario %d activó plan %s hasta %s",
		user.ID, req.Plan, periodEnd.Format("2006-01-02"))
	log.Printf("🎉 [CONFIRM] ══════════════════════════════════════")

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
		log.Printf("❌ [STRIPE] STRIPE_PUBLISHABLE_KEY no configurada")
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Clave pública no configurada"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"publicKey": publicKey})
}
