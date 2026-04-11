package handlers

import (
	"fmt"
	"io"
	"log"
	"net/http"
	"path/filepath"
	"strings"
	"time"

	"attomos/config"
	"attomos/models"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/pkg/sftp"
	"golang.org/x/crypto/ssh"
)

// UploadServiceImage recibe una imagen, la sube vía SFTP al servidor Hetzner
// correcto y devuelve la URL pública. No guarda nada en disco local (Railway).
//
// POST /api/upload/service-image?branch_id={id}
//
// Lógica de selección de servidor:
//  1. Si el usuario tiene un agente con ese branch_id → usar su servidor
//  2. Si tiene cualquier agente → usar el servidor de ese agente
//  3. Si NO tiene agentes aún (onboarding) → usar el servidor global AtomicBot
func UploadServiceImage(c *gin.Context) {
	userInterface, exists := c.Get("user")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "No autenticado"})
		return
	}
	user := userInterface.(*models.User)

	branchIDStr := c.Query("branch_id")
	imageType := c.Query("type") // "logo", "banner" o vacío para servicio

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

	fileBytes, err := io.ReadAll(file)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Error leyendo imagen"})
		return
	}

	// Nombre único para el archivo
	prefix := "svc"
	if imageType == "logo" {
		prefix = "logo"
	} else if imageType == "banner" {
		prefix = "banner"
	}
	filename := fmt.Sprintf("%s_%s_%d%s", prefix, uuid.New().String()[:8], time.Now().Unix(), ext)

	// ── Buscar agente del usuario ────────────────────────────────────
	// Prioridad: branch_id exacto → cualquier agente → nil (onboarding)
	var agent *models.Agent

	if branchIDStr != "" {
		var a models.Agent
		if config.DB.Where("user_id = ? AND branch_id = ?", user.ID, branchIDStr).
			First(&a).Error == nil {
			agent = &a
		}
	}

	if agent == nil {
		var a models.Agent
		if config.DB.Where("user_id = ?", user.ID).
			Order("created_at desc").First(&a).Error == nil {
			agent = &a
		}
	}

	// ── Subir imagen ─────────────────────────────────────────────────
	var publicURL string

	if agent == nil || agent.BotType == "atomic" {
		// Sin agente (onboarding) o AtomicBot → servidor global compartido
		var globalServer models.GlobalServer
		if err := config.DB.
			Where("purpose = ? AND status = ?", "atomic-bots", "ready").
			Order("current_agents ASC").
			First(&globalServer).Error; err != nil {
			log.Printf("❌ [Upload] No hay servidor global activo: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{
				"error": "Servidor de imágenes no disponible. Verifica que el servidor global esté activo.",
			})
			return
		}

		remotePath := fmt.Sprintf("/var/www/uploads/user_%d/branch_%s", user.ID, branchIDStr)
		remoteFile := remotePath + "/" + filename

		if err := uploadViaSFTP(globalServer.IPAddress, globalServer.RootPassword,
			remotePath, remoteFile, fileBytes); err != nil {
			log.Printf("❌ [Upload] SFTP AtomicBot global: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Error subiendo imagen al servidor"})
			return
		}

		publicURL = fmt.Sprintf("http://%s/uploads/user_%d/branch_%s/%s",
			globalServer.IPAddress, user.ID, branchIDStr, filename)

	} else {
		// OrbitalBot → servidor individual del agente
		remotePath := fmt.Sprintf("/var/www/uploads/branch_%s", branchIDStr)
		remoteFile := remotePath + "/" + filename

		if err := uploadViaSFTP(agent.ServerIP, agent.ServerPassword,
			remotePath, remoteFile, fileBytes); err != nil {
			log.Printf("❌ [Upload] SFTP OrbitalBot: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Error subiendo imagen al servidor"})
			return
		}

		publicURL = fmt.Sprintf("http://%s:8080/uploads/branch_%s/%s",
			agent.ServerIP, branchIDStr, filename)
	}

	log.Printf("✅ [Upload] user=%d branch=%s → %s", user.ID, branchIDStr, publicURL)
	c.JSON(http.StatusOK, gin.H{"url": publicURL})
}

// uploadViaSFTP conecta por SSH/SFTP, crea el directorio y sube el archivo en memoria.
func uploadViaSFTP(serverIP, password, remotePath, remoteFile string, data []byte) error {
	sshConfig := &ssh.ClientConfig{
		User:            "root",
		Auth:            []ssh.AuthMethod{ssh.Password(password)},
		HostKeyCallback: ssh.InsecureIgnoreHostKey(),
		Timeout:         30 * time.Second,
	}

	sshClient, err := ssh.Dial("tcp", serverIP+":22", sshConfig)
	if err != nil {
		return fmt.Errorf("SSH %s: %w", serverIP, err)
	}
	defer sshClient.Close()

	sftpClient, err := sftp.NewClient(sshClient)
	if err != nil {
		return fmt.Errorf("SFTP init: %w", err)
	}
	defer sftpClient.Close()

	if err := sftpClient.MkdirAll(remotePath); err != nil {
		return fmt.Errorf("mkdir %s: %w", remotePath, err)
	}

	f, err := sftpClient.Create(remoteFile)
	if err != nil {
		return fmt.Errorf("create %s: %w", remoteFile, err)
	}
	defer f.Close()

	if _, err := f.Write(data); err != nil {
		return fmt.Errorf("write: %w", err)
	}

	return nil
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
