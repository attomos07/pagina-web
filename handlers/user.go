package handlers

import (
	"fmt"
	"log"
	"net/http"
	"strings"

	"attomos/config"
	"attomos/models"
	"attomos/services"

	"github.com/gin-gonic/gin"
)

type UpdatePasswordRequest struct {
	NewPassword string `json:"newPassword" binding:"required,min=8"`
}

// UpdatePassword actualiza la contraseña del usuario
func UpdatePassword(c *gin.Context) {
	var req UpdatePasswordRequest

	if err := c.ShouldBindJSON(&req); err != nil {
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

	// Actualizar contraseña
	if err := user.HashPassword(req.NewPassword); err != nil {
		log.Printf("❌ Error al hashear nueva contraseña: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Error al actualizar la contraseña",
		})
		return
	}

	if err := config.DB.Save(&user).Error; err != nil {
		log.Printf("❌ Error guardando nueva contraseña: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Error al actualizar la contraseña",
		})
		return
	}

	log.Printf("✅ [User %d] Contraseña actualizada exitosamente", user.ID)

	c.JSON(http.StatusOK, gin.H{
		"message": "Contraseña actualizada exitosamente",
	})
}

// DeleteAccount elimina completamente la cuenta del usuario y todos sus datos
func DeleteAccount(c *gin.Context) {
	userInterface, exists := c.Get("user")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{
			"error": "No autenticado",
		})
		return
	}

	user := userInterface.(*models.User)

	log.Println("\n" + strings.Repeat("═", 80))
	log.Println("🗑️  INICIANDO ELIMINACIÓN DE CUENTA")
	log.Printf("Usuario ID: %d\n", user.ID)
	log.Println(strings.Repeat("═", 80))

	// PASO 1: Obtener todos los agentes del usuario
	var agents []models.Agent
	if err := config.DB.Where("user_id = ?", user.ID).Find(&agents).Error; err != nil {
		log.Printf("❌ Error obteniendo agentes: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Error al eliminar la cuenta",
		})
		return
	}

	log.Printf("📊 Total de agentes a eliminar: %d", len(agents))

	// PASO 2: Eliminar todos los bots del servidor compartido
	if user.SharedServerIP != "" && user.SharedServerPassword != "" && len(agents) > 0 {
		log.Println("\n🤖 Eliminando bots del servidor...")

		deployService := services.NewBotDeployService(user.SharedServerIP, user.SharedServerPassword)

		if err := deployService.Connect(); err != nil {
			log.Printf("⚠️  Error conectando al servidor (continuando): %v", err)
		} else {
			defer deployService.Close()

			for _, agent := range agents {
				log.Printf("   → Eliminando bot del agente %d...", agent.ID)
				if err := deployService.StopAndRemoveBot(agent.ID); err != nil {
					log.Printf("   ⚠️  Error eliminando bot %d (continuando): %v", agent.ID, err)
				} else {
					log.Printf("   ✅ Bot %d eliminado del servidor", agent.ID)
				}
			}
		}
	}

	// PASO 3: Eliminar servidor compartido de Hetzner
	if user.SharedServerID > 0 {
		log.Println("\n☁️  Eliminando servidor de Hetzner...")

		hetznerService, err := services.NewHetznerService()
		if err != nil {
			log.Printf("⚠️  Error inicializando Hetzner (continuando): %v", err)
		} else {
			if err := hetznerService.DeleteServer(user.SharedServerID); err != nil {
				log.Printf("⚠️  Error eliminando servidor %d (continuando): %v", user.SharedServerID, err)
			} else {
				log.Printf("✅ Servidor %d eliminado de Hetzner", user.SharedServerID)
			}
		}
	}

	// PASO 4: Eliminar DNS de Cloudflare
	if user.SharedServerIP != "" {
		log.Println("\n🌐 Eliminando registro DNS de Cloudflare...")

		cloudflareService, err := services.NewCloudflareService()
		if err != nil {
			log.Printf("⚠️  Error inicializando Cloudflare (continuando): %v", err)
		} else {
			dnsName := fmt.Sprintf("chat-user%d.attomos.com", user.ID)
			if err := cloudflareService.DeleteDNSRecord(dnsName); err != nil {
				log.Printf("⚠️  Error eliminando DNS %s (continuando): %v", dnsName, err)
			} else {
				log.Printf("✅ DNS %s eliminado de Cloudflare", dnsName)
			}
		}
	}

	// PASO 5: Eliminar proyecto de Google Cloud
	if user.GCPProjectID != nil && *user.GCPProjectID != "" {
		log.Println("\n☁️  Eliminando proyecto de Google Cloud...")

		gcpService, err := services.NewGoogleCloudAutomation()
		if err != nil {
			log.Printf("⚠️  Error inicializando GCP (continuando): %v", err)
		} else {
			if err := gcpService.DeleteProject(*user.GCPProjectID); err != nil {
				log.Printf("⚠️  Error eliminando proyecto GCP (continuando): %v", err)
			} else {
				log.Printf("✅ Proyecto GCP %s marcado para eliminación", *user.GCPProjectID)
			}
		}
	}

	// PASO 6: Eliminar todos los agentes de la base de datos (HARD DELETE)
	log.Println("\n💾 Eliminando agentes de la base de datos (HARD DELETE)...")
	if err := config.DB.Unscoped().Where("user_id = ?", user.ID).Delete(&models.Agent{}).Error; err != nil {
		log.Printf("❌ Error eliminando agentes de BD: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Error al eliminar la cuenta",
		})
		return
	}
	log.Printf("✅ %d agentes eliminados permanentemente de la base de datos", len(agents))

	// PASO 7: Eliminar el usuario de la base de datos (HARD DELETE)
	log.Println("\n👤 Eliminando usuario de la base de datos (HARD DELETE)...")

	// IMPORTANTE: Usar Unscoped() para hacer hard delete
	if err := config.DB.Unscoped().Delete(&user).Error; err != nil {
		log.Printf("❌ Error eliminando usuario: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Error al eliminar la cuenta",
		})
		return
	}
	log.Printf("✅ Usuario %d eliminado PERMANENTEMENTE de la base de datos", user.ID)

	log.Println("\n" + strings.Repeat("═", 80))
	log.Println("✅ CUENTA ELIMINADA EXITOSAMENTE")
	log.Println(strings.Repeat("═", 80) + "\n")

	// Eliminar cookie de autenticación
	c.SetCookie("auth_token", "", -1, "/", "", false, true)

	c.JSON(http.StatusOK, gin.H{
		"message": "Cuenta eliminada exitosamente",
	})
}
