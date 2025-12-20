package services

import (
	"fmt"
	"os"

	"github.com/stripe/stripe-go/v78"
	"github.com/stripe/stripe-go/v78/customer"
	"github.com/stripe/stripe-go/v78/paymentintent"
	"github.com/stripe/stripe-go/v78/price"
	"github.com/stripe/stripe-go/v78/subscription"
)

// StripeService maneja todas las operaciones de Stripe
type StripeService struct {
	secretKey string
}

// NewStripeService crea una nueva instancia del servicio
func NewStripeService() (*StripeService, error) {
	secretKey := os.Getenv("STRIPE_SECRET_KEY")
	if secretKey == "" {
		return nil, fmt.Errorf("STRIPE_SECRET_KEY no está configurado")
	}

	// Configurar Stripe con la clave secreta
	stripe.Key = secretKey

	return &StripeService{
		secretKey: secretKey,
	}, nil
}

// CreateCustomer crea un nuevo cliente en Stripe
func (s *StripeService) CreateCustomer(email, name, phone string) (*stripe.Customer, error) {
	params := &stripe.CustomerParams{
		Email: stripe.String(email),
		Name:  stripe.String(name),
		Phone: stripe.String(phone),
	}

	return customer.New(params)
}

// CreatePaymentIntent crea un PaymentIntent para un pago único
func (s *StripeService) CreatePaymentIntent(amount int64, currency, customerID, description string) (*stripe.PaymentIntent, error) {
	params := &stripe.PaymentIntentParams{
		Amount:      stripe.Int64(amount), // Monto en centavos (255.00 MXN = 25500)
		Currency:    stripe.String(currency),
		Customer:    stripe.String(customerID),
		Description: stripe.String(description),
		AutomaticPaymentMethods: &stripe.PaymentIntentAutomaticPaymentMethodsParams{
			Enabled: stripe.Bool(true),
		},
	}

	return paymentintent.New(params)
}

// CreateSubscription crea una suscripción para un cliente
func (s *StripeService) CreateSubscription(customerID, priceID string) (*stripe.Subscription, error) {
	params := &stripe.SubscriptionParams{
		Customer: stripe.String(customerID),
		Items: []*stripe.SubscriptionItemsParams{
			{
				Price: stripe.String(priceID),
			},
		},
		PaymentBehavior: stripe.String("default_incomplete"),
		PaymentSettings: &stripe.SubscriptionPaymentSettingsParams{
			SaveDefaultPaymentMethod: stripe.String("on_subscription"),
		},
		Expand: []*string{
			stripe.String("latest_invoice.payment_intent"),
		},
	}

	return subscription.New(params)
}

// CancelSubscription cancela una suscripción
func (s *StripeService) CancelSubscription(subscriptionID string) (*stripe.Subscription, error) {
	params := &stripe.SubscriptionCancelParams{}
	return subscription.Cancel(subscriptionID, params)
}

// UpdateSubscription actualiza una suscripción (cambiar plan)
func (s *StripeService) UpdateSubscription(subscriptionID, newPriceID string) (*stripe.Subscription, error) {
	// Primero obtenemos la suscripción actual
	sub, err := subscription.Get(subscriptionID, nil)
	if err != nil {
		return nil, err
	}

	// Actualizamos el item de la suscripción
	params := &stripe.SubscriptionParams{
		Items: []*stripe.SubscriptionItemsParams{
			{
				ID:    stripe.String(sub.Items.Data[0].ID),
				Price: stripe.String(newPriceID),
			},
		},
		ProrationBehavior: stripe.String("create_prorations"),
	}

	return subscription.Update(subscriptionID, params)
}

// GetSubscription obtiene información de una suscripción
func (s *StripeService) GetSubscription(subscriptionID string) (*stripe.Subscription, error) {
	return subscription.Get(subscriptionID, nil)
}

// GetCustomer obtiene información de un cliente
func (s *StripeService) GetCustomer(customerID string) (*stripe.Customer, error) {
	return customer.Get(customerID, nil)
}

// ListPrices obtiene todos los precios configurados
func (s *StripeService) ListPrices() []*stripe.Price {
	params := &stripe.PriceListParams{
		Active: stripe.Bool(true),
	}
	params.Limit = stripe.Int64(100)

	i := price.List(params)
	var prices []*stripe.Price

	for i.Next() {
		prices = append(prices, i.Price())
	}

	return prices
}

// GetPriceIDForPlan retorna el Price ID de Stripe según el plan
func (s *StripeService) GetPriceIDForPlan(planName, billingPeriod string) string {
	// Estos IDs los obtienes después de crear los productos en Stripe
	// Por ahora son placeholders
	priceMap := map[string]map[string]string{
		"proton": {
			"monthly": "price_proton_monthly", // Reemplazar con tu Price ID real
			"annual":  "price_proton_annual",  // Reemplazar con tu Price ID real
		},
		"neutron": {
			"monthly": "price_neutron_monthly", // Reemplazar con tu Price ID real
			"annual":  "price_neutron_annual",  // Reemplazar con tu Price ID real
		},
		"electron": {
			"monthly": "price_electron_monthly", // Reemplazar con tu Price ID real
			"annual":  "price_electron_annual",  // Reemplazar con tu Price ID real
		},
	}

	if plan, exists := priceMap[planName]; exists {
		if priceID, exists := plan[billingPeriod]; exists {
			return priceID
		}
	}

	return ""
}

// CalculateAmount calcula el monto en centavos según el plan y período
func (s *StripeService) CalculateAmount(planName, billingPeriod string) int64 {
	prices := map[string]map[string]int64{
		"proton": {
			"monthly": 14900,  // $149.00 MXN
			"annual":  143200, // $1432.00 MXN (20% descuento)
		},
		"neutron": {
			"monthly": 25500,  // $255.00 MXN
			"annual":  244800, // $2448.00 MXN (20% descuento)
		},
		"electron": {
			"monthly": 79900,  // $799.00 MXN
			"annual":  767040, // $7670.40 MXN (20% descuento)
		},
	}

	if plan, exists := prices[planName]; exists {
		if amount, exists := plan[billingPeriod]; exists {
			return amount
		}
	}

	return 0
}
