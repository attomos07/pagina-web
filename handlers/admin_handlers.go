package handlers

import (
	"crypto/sha256"
	"fmt"
	"net/http"
	"os"
	"time"

	"attomos/config"
	"attomos/models"

	"github.com/gin-gonic/gin"
)

func getAdminSessionToken() string {
	secret := os.Getenv("ADMIN_SESSION_SECRET")
	if secret == "" {
		secret = "attomos-admin-fallback-secret"
	}
	h := sha256.Sum256([]byte(secret))
	return fmt.Sprintf("%x", h)
}

// AdminLogin — POST /admin/api/login
func AdminLogin(c *gin.Context) {
	var body struct {
		Identifier string `json:"identifier"`
		Password   string `json:"password"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Datos inválidos."})
		return
	}

	adminUser := os.Getenv("ADMIN_USERNAME")
	adminPass := os.Getenv("ADMIN_PASSWORD")

	if adminUser == "" || adminPass == "" {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Administrador no configurado."})
		return
	}

	if body.Identifier != adminUser || body.Password != adminPass {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Credenciales incorrectas."})
		return
	}

	c.SetCookie(
		"admin_session",
		getAdminSessionToken(),
		int(8*time.Hour/time.Second),
		"/",
		"",
		os.Getenv("ENVIRONMENT") == "production",
		true,
	)

	c.JSON(http.StatusOK, gin.H{"success": true})
}

// AdminLogout — POST /admin/api/logout
func AdminLogout(c *gin.Context) {
	c.SetCookie("admin_session", "", -1, "/", "", false, true)
	c.JSON(http.StatusOK, gin.H{"success": true})
}

// AdminGetCompanies — GET /admin/api/companies
func AdminGetCompanies(c *gin.Context) {

	type CompanyRow struct {
		BranchID      uint                    `gorm:"column:branch_id"`
		BusinessName  string                  `gorm:"column:business_name"`
		BusinessType  string                  `gorm:"column:business_type"`
		BusinessSize  string                  `gorm:"column:business_size"`
		PhoneNumber   string                  `gorm:"column:phone_number"`
		Location      models.BusinessLocation `gorm:"column:location"`
		UserID        uint                    `gorm:"column:user_id"`
		Email         string                  `gorm:"column:email"`
		Company       string                  `gorm:"column:company"`
		UserCreatedAt time.Time               `gorm:"column:user_created_at"`
	}

	var rows []CompanyRow
	result := config.DB.
		Table("my_business_info b").
		Select(`b.id AS branch_id, b.business_name, b.business_type, b.business_size,
			b.phone_number, b.location,
			u.id AS user_id, u.email, u.company, u.created_at AS user_created_at`).
		Joins("JOIN users u ON u.id = b.user_id").
		Where("b.branch_number = 1 AND b.deleted_at IS NULL AND u.deleted_at IS NULL").
		Order("u.created_at DESC").
		Scan(&rows)

	if result.Error != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Error al obtener empresas."})
		return
	}

	// Obtener planes desde subscriptions (LEFT JOIN por si no tienen suscripción)
	type SubRow struct {
		UserID uint   `gorm:"column:user_id"`
		Plan   string `gorm:"column:plan"`
		Status string `gorm:"column:status"`
	}
	var subs []SubRow
	config.DB.Table("subscriptions").
		Select("user_id, plan, status").
		Where("status = 'active'").
		Scan(&subs)

	// Mapa userID → plan
	planMap := make(map[uint]string)
	for _, s := range subs {
		planMap[s.UserID] = s.Plan
	}

	companies := make([]gin.H, len(rows))
	for i, r := range rows {
		plan := planMap[r.UserID]
		if plan == "" {
			plan = "gratuito"
		}
		companies[i] = gin.H{
			"id":           r.UserID,
			"branchId":     r.BranchID,
			"businessName": r.BusinessName,
			"businessType": r.BusinessType,
			"businessSize": r.BusinessSize,
			"phoneNumber":  r.PhoneNumber,
			"city":         r.Location.City,
			"email":        r.Email,
			"company":      r.Company,
			"plan":         plan,
			"createdAt":    r.UserCreatedAt,
			"status":       "active",
		}
	}

	// Stats
	var totalCount int64
	config.DB.Model(&models.User{}).Where("deleted_at IS NULL").Count(&totalCount)

	var paidCount int64
	config.DB.Table("subscriptions").Where("status = 'active' AND plan NOT IN ?", []string{"gratuito", ""}).Count(&paidCount)

	firstOfMonth := time.Now().Truncate(24*time.Hour).AddDate(0, 0, -time.Now().Day()+1)
	var newCount int64
	config.DB.Model(&models.User{}).Where("created_at >= ? AND deleted_at IS NULL", firstOfMonth).Count(&newCount)

	c.JSON(http.StatusOK, gin.H{
		"companies": companies,
		"stats": gin.H{
			"total":  totalCount,
			"active": totalCount, // sin last_login_at usamos total como fallback
			"paid":   paidCount,
			"new":    newCount,
		},
	})
}
