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

// UploadServiceImage recibe una imagen de servicio/producto,
// la sube vía SFTP al servidor Hetzner correcto y devuelve la URL pública.
//
// POST /api/upload/service-image?branch_id={id}
//
// Rutas en Hetzner:
//
//	AtomicBot (servidor compartido): /var/www/uploads/user_{userID}/branch_{branchID}/{file}
//	OrbitalBot (servidor individual): /var/www/uploads/branch_{branchID}/{file}
//
// URLs públicas:
//
//	AtomicBot: http://{globalServerIP}/uploads/user_{userID}/branch_{branchID}/{file}
//	OrbitalBot: http://{serverIP}:8080/uploads/branch_{branchID}/{file}
func UploadServiceImage(c *gin.Context) {
	userInterface, exists := c.Get("user")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "No autenticado"})
		return
	}
	user := userInterface.(*models.User)

	branchIDStr := c.Query("branch_id")
	if branchIDStr == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "branch_id es requerido"})
		return
	}

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

	filename := fmt.Sprintf("%s_%d%s", uuid.New().String(), time.Now().Unix(), ext)

	// Buscar agente del usuario — primero por branch_id, luego cualquiera
	var agent models.Agent
	err = config.DB.Where("user_id = ? AND branch_id = ?", user.ID, branchIDStr).First(&agent).Error
	if err != nil {
		err = config.DB.Where("user_id = ?", user.ID).Order("created_at desc").First(&agent).Error
		if err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "No se encontró agente para este usuario"})
			return
		}
	}

	var publicURL string

	switch agent.BotType {
	case "atomic":
		// AtomicBot: servidor compartido — buscamos el servidor global activo
		var globalServer models.GlobalServer
		if err := config.DB.Where("purpose = ? AND status = ?", "atomic-bots", "ready").
			Order("current_agents ASC").First(&globalServer).Error; err != nil {
			log.Printf("⚠️  [Upload] No se encontró servidor global activo: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Servidor compartido no disponible"})
			return
		}
		remotePath := fmt.Sprintf("/var/www/uploads/user_%d/branch_%s", user.ID, branchIDStr)
		remoteFile := remotePath + "/" + filename
		if err := uploadViaSSFTP(globalServer.IPAddress, globalServer.RootPassword, remotePath, remoteFile, fileBytes); err != nil {
			log.Printf("❌ [Upload] Error SFTP AtomicBot: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Error subiendo imagen"})
			return
		}
		publicURL = fmt.Sprintf("http://%s/uploads/user_%d/branch_%s/%s",
			globalServer.IPAddress, user.ID, branchIDStr, filename)

	case "orbital":
		// OrbitalBot: servidor individual — IP del propio agente
		remotePath := fmt.Sprintf("/var/www/uploads/branch_%s", branchIDStr)
		remoteFile := remotePath + "/" + filename
		if err := uploadViaSSFTP(agent.ServerIP, agent.ServerPassword, remotePath, remoteFile, fileBytes); err != nil {
			log.Printf("❌ [Upload] Error SFTP OrbitalBot: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Error subiendo imagen"})
			return
		}
		publicURL = fmt.Sprintf("http://%s:8080/uploads/branch_%s/%s",
			agent.ServerIP, branchIDStr, filename)

	default:
		c.JSON(http.StatusBadRequest, gin.H{"error": "Tipo de bot no soportado"})
		return
	}

	log.Printf("✅ [Upload] Imagen subida: %s", publicURL)
	c.JSON(http.StatusOK, gin.H{"url": publicURL})
}

// uploadViaSSFTP conecta por SSH/SFTP, crea el directorio y sube el archivo.
func uploadViaSSFTP(serverIP, password, remotePath, remoteFile string, data []byte) error {
	sshConfig := &ssh.ClientConfig{
		User:            "root",
		Auth:            []ssh.AuthMethod{ssh.Password(password)},
		HostKeyCallback: ssh.InsecureIgnoreHostKey(),
		Timeout:         30 * time.Second,
	}

	sshClient, err := ssh.Dial("tcp", serverIP+":22", sshConfig)
	if err != nil {
		return fmt.Errorf("error conectando SSH a %s: %w", serverIP, err)
	}
	defer sshClient.Close()

	sftpClient, err := sftp.NewClient(sshClient)
	if err != nil {
		return fmt.Errorf("error iniciando SFTP: %w", err)
	}
	defer sftpClient.Close()

	if err := sftpClient.MkdirAll(remotePath); err != nil {
		return fmt.Errorf("error creando directorio %s: %w", remotePath, err)
	}

	f, err := sftpClient.Create(remoteFile)
	if err != nil {
		return fmt.Errorf("error creando archivo remoto: %w", err)
	}
	defer f.Close()

	if _, err := f.Write(data); err != nil {
		return fmt.Errorf("error escribiendo archivo remoto: %w", err)
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
