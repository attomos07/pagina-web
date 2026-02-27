package handlers

import (
	"fmt"
	"log"
	"net/http"
	"time"

	"attomos/config"
	"attomos/models"

	"github.com/gin-gonic/gin"
	"github.com/jung-kurt/gofpdf"
)

// GetReceiptPDF genera y descarga el recibo en PDF para un pago específico
func GetReceiptPDF(c *gin.Context) {
	userInterface, exists := c.Get("user")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "No autenticado"})
		return
	}
	user := userInterface.(*models.User)

	paymentID := c.Param("id")

	// Buscar el pago verificando que pertenezca al usuario
	var payment models.Payment
	if err := config.DB.Where("id = ? AND user_id = ?", paymentID, user.ID).First(&payment).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Recibo no encontrado"})
		return
	}

	// Buscar suscripción para datos adicionales
	var subscription models.Subscription
	config.DB.Where("user_id = ?", user.ID).First(&subscription)

	// Generar número de folio
	folioNumber := fmt.Sprintf("ATT-%06d", payment.ID)

	// Fecha de pago
	paidDate := payment.CreatedAt
	if payment.PaidAt != nil {
		paidDate = *payment.PaidAt
	}

	// Nombres de planes
	planNames := map[string]string{
		"gratuito": "Plan Gratuito",
		"proton":   "Plan Protón",
		"neutron":  "Plan Neutrón",
		"electron": "Plan Electrón",
	}
	planDisplay := planNames[payment.Plan]
	if planDisplay == "" {
		planDisplay = payment.Plan
	}

	cycleDisplay := "Mensual"
	if payment.BillingCycle == "annual" {
		cycleDisplay = "Anual"
	}

	// ============================================
	// GENERAR PDF
	// ============================================
	pdf := gofpdf.New("P", "mm", "A4", "")
	pdf.SetMargins(20, 20, 20)
	pdf.AddPage()

	pageW, _ := pdf.GetPageSize()
	safeW := pageW - 40 // 20mm margen izquierdo + 20mm margen derecho

	// ---- COLORES ----
	primaryR, primaryG, primaryB := 14, 165, 233 // azul attomos #0EA5E9
	darkR, darkG, darkB := 15, 23, 42            // casi negro #0F172A
	grayR, grayG, grayB := 100, 116, 139         // gris #64748B
	lightR, lightG, lightB := 241, 245, 249      // fondo claro #F1F5F9
	successR, successG, successB := 34, 197, 94  // verde #22C55E
	borderR, borderG, borderB := 226, 232, 240   // borde #E2E8F0

	// ---- LOGO ----
	logoPath := "./static/images/attomos-logo.png"
	logoW := 45.0
	logoH := 15.0
	logoX := (pageW - logoW) / 2
	pdf.Image(logoPath, logoX, 20, logoW, logoH, false, "", 0, "")
	pdf.Ln(logoH + 8)

	// ---- LÍNEA DIVISORIA ----
	pdf.SetDrawColor(borderR, borderG, borderB)
	pdf.SetLineWidth(0.3)
	pdf.Line(20, pdf.GetY(), pageW-20, pdf.GetY())
	pdf.Ln(8)

	// ---- TÍTULO RECIBO ----
	pdf.SetFont("Helvetica", "B", 22)
	pdf.SetTextColor(darkR, darkG, darkB)
	pdf.CellFormat(safeW, 10, "RECIBO DE PAGO", "", 1, "C", false, 0, "")
	pdf.Ln(2)

	// ---- FOLIO Y ESTADO ----
	pdf.SetFont("Helvetica", "", 10)
	pdf.SetTextColor(grayR, grayG, grayB)
	pdf.CellFormat(safeW, 6, "Folio: "+folioNumber, "", 1, "C", false, 0, "")
	pdf.Ln(4)

	// Badge PAGADO
	badgeW := 32.0
	badgeH := 7.0
	badgeX := (pageW - badgeW) / 2
	badgeY := pdf.GetY()
	pdf.SetFillColor(successR, successG, successB)
	pdf.RoundedRect(badgeX, badgeY, badgeW, badgeH, 3, "1234", "F")
	pdf.SetFont("Helvetica", "B", 9)
	pdf.SetTextColor(255, 255, 255)
	pdf.SetXY(badgeX, badgeY+0.8)
	pdf.CellFormat(badgeW, badgeH-1.5, "✓  PAGADO", "", 0, "C", false, 0, "")
	pdf.Ln(badgeH + 8)

	// ---- MONTO DESTACADO ----
	pdf.SetFont("Helvetica", "B", 36)
	pdf.SetTextColor(primaryR, primaryG, primaryB)
	pdf.CellFormat(safeW, 16, payment.GetFormattedAmount(), "", 1, "C", false, 0, "")
	pdf.Ln(2)
	pdf.SetFont("Helvetica", "", 9)
	pdf.SetTextColor(grayR, grayG, grayB)
	pdf.CellFormat(safeW, 5, "IVA incluido", "", 1, "C", false, 0, "")
	pdf.Ln(10)

	// ---- LÍNEA DIVISORIA ----
	pdf.SetDrawColor(borderR, borderG, borderB)
	pdf.Line(20, pdf.GetY(), pageW-20, pdf.GetY())
	pdf.Ln(10)

	// ---- DOS COLUMNAS: DATOS CLIENTE | DATOS EMPRESA ----
	colW := safeW / 2
	startY := pdf.GetY()

	// -- Columna izquierda: Cliente --
	pdf.SetFont("Helvetica", "B", 8)
	pdf.SetTextColor(grayR, grayG, grayB)
	pdf.SetX(20)
	pdf.CellFormat(colW, 5, "FACTURADO A", "", 1, "L", false, 0, "")

	pdf.SetFont("Helvetica", "B", 11)
	pdf.SetTextColor(darkR, darkG, darkB)
	pdf.SetX(20)
	displayName := user.Company
	if displayName == "" {
		displayName = user.Email
	}
	pdf.CellFormat(colW, 7, displayName, "", 1, "L", false, 0, "")

	pdf.SetFont("Helvetica", "", 10)
	pdf.SetTextColor(grayR, grayG, grayB)
	pdf.SetX(20)
	pdf.CellFormat(colW, 6, user.Email, "", 1, "L", false, 0, "")

	if subscription.StripeCustomerID != "" {
		pdf.SetFont("Helvetica", "", 8)
		pdf.SetX(20)
		pdf.CellFormat(colW, 5, "ID Cliente: "+subscription.StripeCustomerID, "", 1, "L", false, 0, "")
	}

	// -- Columna derecha: Emisor --
	pdf.SetXY(20+colW, startY)
	pdf.SetFont("Helvetica", "B", 8)
	pdf.SetTextColor(grayR, grayG, grayB)
	pdf.CellFormat(colW, 5, "EMITIDO POR", "", 1, "L", false, 0, "")

	pdf.SetFont("Helvetica", "B", 11)
	pdf.SetTextColor(darkR, darkG, darkB)
	pdf.SetX(20 + colW)
	pdf.CellFormat(colW, 7, "Attomos Industries", "", 1, "L", false, 0, "")

	pdf.SetFont("Helvetica", "", 10)
	pdf.SetTextColor(grayR, grayG, grayB)
	pdf.SetX(20 + colW)
	pdf.CellFormat(colW, 6, "contacto@attomos.com", "", 1, "L", false, 0, "")

	pdf.SetFont("Helvetica", "", 10)
	pdf.SetX(20 + colW)
	pdf.CellFormat(colW, 6, "attomos.com", "", 1, "L", false, 0, "")

	pdf.Ln(12)

	// ---- DETALLES DEL PAGO ----
	sectionY := pdf.GetY()
	pdf.SetFillColor(lightR, lightG, lightB)
	pdf.Rect(20, sectionY, safeW, 7, "F")
	pdf.SetFont("Helvetica", "B", 9)
	pdf.SetTextColor(darkR, darkG, darkB)
	pdf.SetXY(24, sectionY+1)
	pdf.CellFormat(safeW-8, 5, "DETALLES DEL PAGO", "", 1, "L", false, 0, "")
	pdf.Ln(4)

	// Tabla de detalles
	rowH := 8.0
	type detailRow struct {
		label string
		value string
	}
	rows := []detailRow{
		{"Descripción", planDisplay + " — Suscripción Attomos"},
		{"Ciclo de facturación", cycleDisplay},
		{"Fecha de pago", formatDateES(paidDate)},
		{"ID de transacción", payment.StripePaymentIntentID},
	}
	if payment.StripeChargeID != "" {
		rows = append(rows, detailRow{"ID de cargo", payment.StripeChargeID})
	}
	rows = append(rows,
		detailRow{"Método de pago", "Tarjeta de crédito/débito"},
		detailRow{"Moneda", "MXN (Peso Mexicano)"},
		detailRow{"Estado", "Pagado"},
	)

	for i, row := range rows {
		if i%2 == 0 {
			pdf.SetFillColor(255, 255, 255)
		} else {
			pdf.SetFillColor(248, 250, 252)
		}
		rowY := pdf.GetY()
		pdf.Rect(20, rowY, safeW, rowH, "F")

		pdf.SetFont("Helvetica", "", 9)
		pdf.SetTextColor(grayR, grayG, grayB)
		pdf.SetXY(24, rowY+1.5)
		pdf.CellFormat(colW-4, rowH-3, row.label, "", 0, "L", false, 0, "")

		pdf.SetFont("Helvetica", "B", 9)
		pdf.SetTextColor(darkR, darkG, darkB)
		pdf.SetXY(20+colW, rowY+1.5)
		pdf.CellFormat(colW-4, rowH-3, row.value, "", 1, "L", false, 0, "")
	}

	// Borde alrededor de la tabla
	tableH := float64(len(rows)) * rowH
	pdf.SetDrawColor(borderR, borderG, borderB)
	pdf.SetLineWidth(0.3)
	pdf.Rect(20, sectionY+7+4, safeW, tableH, "D")
	pdf.Ln(6)

	// ---- TOTAL ----
	totalY := pdf.GetY()
	pdf.SetFillColor(primaryR, primaryG, primaryB)
	pdf.Rect(20, totalY, safeW, 12, "F")
	pdf.SetFont("Helvetica", "B", 12)
	pdf.SetTextColor(255, 255, 255)
	pdf.SetXY(24, totalY+2)
	pdf.CellFormat(colW-4, 8, "TOTAL PAGADO", "", 0, "L", false, 0, "")
	pdf.SetXY(20+colW, totalY+2)
	pdf.CellFormat(colW-4, 8, payment.GetFormattedAmount(), "", 1, "R", false, 0, "")
	pdf.Ln(12)

	// ---- NOTA RFC / DATOS FISCALES ----
	noteY := pdf.GetY()
	pdf.SetFillColor(254, 252, 232) // amarillo muy claro
	pdf.SetDrawColor(253, 224, 71)  // amarillo borde
	pdf.SetLineWidth(0.3)
	pdf.Rect(20, noteY, safeW, 16, "FD")
	pdf.SetFont("Helvetica", "B", 9)
	pdf.SetTextColor(133, 77, 14) // café oscuro
	pdf.SetXY(24, noteY+2)
	pdf.CellFormat(safeW-8, 5, "📋  ¿Necesitas factura fiscal (CFDI)?", "", 1, "L", false, 0, "")
	pdf.SetFont("Helvetica", "", 8)
	pdf.SetTextColor(133, 77, 14)
	pdf.SetX(24)
	pdf.CellFormat(safeW-8, 5, "Envía tu RFC y datos fiscales a: facturacion@attomos.com", "", 1, "L", false, 0, "")
	pdf.SetX(24)
	pdf.CellFormat(safeW-8, 5, "Incluye el folio: "+folioNumber, "", 1, "L", false, 0, "")
	pdf.Ln(10)

	// ---- FOOTER ----
	_, pageH := pdf.GetPageSize()
	footerY := pageH - 25.0
	pdf.SetDrawColor(borderR, borderG, borderB)
	pdf.SetLineWidth(0.3)
	pdf.Line(20, footerY, pageW-20, footerY)

	pdf.SetFont("Helvetica", "", 8)
	pdf.SetTextColor(grayR, grayG, grayB)
	pdf.SetXY(20, footerY+3)
	pdf.CellFormat(safeW/2, 5, "© "+fmt.Sprintf("%d", time.Now().Year())+" Attomos Industries. Todos los derechos reservados.", "", 0, "L", false, 0, "")
	pdf.SetXY(20+safeW/2, footerY+3)
	pdf.CellFormat(safeW/2, 5, "Generado el "+formatDateES(time.Now()), "", 1, "R", false, 0, "")
	pdf.SetXY(20, footerY+8)
	pdf.CellFormat(safeW, 5, "Este documento es un comprobante de pago electrónico emitido por Attomos Industries.", "", 1, "C", false, 0, "")

	// ============================================
	// ENVIAR PDF AL CLIENTE
	// ============================================
	filename := fmt.Sprintf("recibo-%s.pdf", folioNumber)

	c.Header("Content-Type", "application/pdf")
	c.Header("Content-Disposition", fmt.Sprintf("attachment; filename=\"%s\"", filename))
	c.Header("Cache-Control", "no-store")

	if err := pdf.Output(c.Writer); err != nil {
		log.Printf("❌ [User %d] Error generando PDF: %v", user.ID, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Error generando recibo"})
		return
	}

	log.Printf("✅ [User %d] Recibo PDF generado: %s", user.ID, filename)
}

// formatDateES formatea una fecha en español
func formatDateES(t time.Time) string {
	months := []string{"", "enero", "febrero", "marzo", "abril", "mayo", "junio",
		"julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"}
	return fmt.Sprintf("%d de %s de %d", t.Day(), months[t.Month()], t.Year())
}
