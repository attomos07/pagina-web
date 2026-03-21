package handlers

import (
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"attomos/models"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// Directorio base donde se guardan las imágenes en Hetzner.
// /static está montado en router.Static("/static", "./static").
const serviceImageBaseDir = "./static/uploads/services"

// UploadServiceImage recibe una imagen de servicio/producto,
// la guarda en disco y devuelve la URL pública.
//
// POST /api/upload/service-image
func UploadServiceImage(c *gin.Context) {
	userInterface, exists := c.Get("user")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "No autenticado"})
		return
	}
	user := userInterface.(*models.User)

	file, header, err := c.Request.FormFile("image")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "No se recibió ninguna imagen"})
		return
	}
	defer file.Close()

	if header.Size > 5*1024*1024 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "La imagen no debe superar 5 MB"})
		return
	}

	ext, err := validateServiceImageExt(header.Filename)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	userDir := filepath.Join(serviceImageBaseDir, fmt.Sprintf("%d", user.ID))
	if err := os.MkdirAll(userDir, 0755); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Error creando directorio"})
		return
	}

	filename := fmt.Sprintf("%s_%d%s", uuid.New().String(), time.Now().Unix(), ext)
	savePath := filepath.Join(userDir, filename)

	if err := c.SaveUploadedFile(header, savePath); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Error guardando imagen"})
		return
	}

	publicURL := fmt.Sprintf("/static/uploads/services/%d/%s", user.ID, filename)
	if baseURL := os.Getenv("BASE_URL"); baseURL != "" {
		publicURL = strings.TrimRight(baseURL, "/") + publicURL
	}

	c.JSON(http.StatusOK, gin.H{"url": publicURL})
}

// validateServiceImageExt valida la extensión del archivo.
func validateServiceImageExt(filename string) (string, error) {
	allowed := map[string]bool{
		".jpg": true, ".jpeg": true,
		".png": true, ".webp": true, ".gif": true,
	}
	ext := strings.ToLower(filepath.Ext(filename))
	if !allowed[ext] {
		return "", fmt.Errorf("formato no permitido: %s — usa jpg, png, webp o gif", ext)
	}
	return ext, nil
}
