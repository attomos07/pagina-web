package main

import (
	"bufio"
	"fmt"
	"log"
	"os"
	"strings"

	"attomos/config"
	"attomos/models"

	"github.com/joho/godotenv"
)

func main() {
	fmt.Println("🔄 Iniciando migración de base de datos")
	fmt.Println("=========================================\n")

	// Cargar variables de entorno
	if err := godotenv.Load(); err != nil {
		log.Println("⚠️  Advertencia: No se encontró archivo .env")
	}

	// Conectar a la base de datos (log.Fatal si falla)
	fmt.Println("📡 Conectando a la base de datos...")
	config.ConnectDatabase()
	fmt.Println("✅ Conectado a la base de datos\n")

	// Preguntar al usuario qué hacer
	fmt.Println("Selecciona una opción:")
	fmt.Println("  1. Migración automática (recomendado - crea/actualiza tablas)")
	fmt.Println("  2. Migración manual (solo muestra el SQL)")
	fmt.Println("  3. Reset completo (⚠️  ELIMINA TODAS LAS TABLAS)")
	fmt.Print("\nOpción (1/2/3): ")

	reader := bufio.NewReader(os.Stdin)
	option, _ := reader.ReadString('\n')
	option = strings.TrimSpace(option)
	fmt.Println()

	switch option {
	case "1":
		autoMigrate()
	case "2":
		manualMigrate()
	case "3":
		resetDatabase()
	default:
		log.Fatal("❌ Opción inválida")
	}
}

// autoMigrate ejecuta la migración automática de GORM
func autoMigrate() {
	fmt.Println("🔄 Ejecutando migración automática...")
	fmt.Println()

	// GORM AutoMigrate creará/actualizará las tablas según los modelos
	err := config.DB.AutoMigrate(
		&models.User{},
		&models.Agent{},
	)

	if err != nil {
		log.Fatalf("❌ Error en la migración: %v", err)
	}

	fmt.Println("✅ Migración completada exitosamente!")
	fmt.Println()
	fmt.Println("📋 Tablas migradas:")
	fmt.Println("   - users")
	fmt.Println("   - agents")
	fmt.Println()

	// Verificar estructura
	fmt.Println("🔍 Verificando estructura de tablas...")

	var userCount int64
	config.DB.Model(&models.User{}).Count(&userCount)
	fmt.Printf("   📊 Total de usuarios: %d\n", userCount)

	var agentCount int64
	config.DB.Model(&models.Agent{}).Count(&agentCount)
	fmt.Printf("   📊 Total de agentes: %d\n", agentCount)

	fmt.Println()
	fmt.Println("🎉 ¡Todo listo! Puedes iniciar tu aplicación.")
}

// manualMigrate muestra el SQL que se debe ejecutar manualmente
func manualMigrate() {
	fmt.Println("📝 SQL para migración manual:")
	fmt.Println("================================")
	fmt.Println()

	sql := `-- ============================================
-- MIGRACIÓN: Permitir NULL en gcp_project_id
-- ============================================

-- Paso 1: Eliminar constraint UNIQUE si existe
ALTER TABLE users DROP INDEX IF EXISTS uni_users_gcp_project_id;

-- Paso 2: Modificar columna para permitir NULL
ALTER TABLE users MODIFY COLUMN gcp_project_id VARCHAR(255) NULL DEFAULT NULL;

-- Paso 3: Limpiar valores vacíos (convertir '' a NULL)
UPDATE users SET gcp_project_id = NULL WHERE gcp_project_id = '';

-- Paso 4: Recrear constraint UNIQUE
ALTER TABLE users ADD UNIQUE INDEX uni_users_gcp_project_id (gcp_project_id);

-- Verificar cambios
DESCRIBE users;
SELECT id, email, gcp_project_id, project_status FROM users;`

	fmt.Println(sql)
	fmt.Println()
	fmt.Println("💡 Instrucciones:")
	fmt.Println("   1. Copia este SQL")
	fmt.Println("   2. Ejecútalo en tu cliente MySQL (MySQL Workbench, DBeaver, etc.)")
	fmt.Println("   3. Luego ejecuta esta migración con la opción 1")
}

// resetDatabase elimina y recrea todas las tablas (⚠️ PELIGROSO)
func resetDatabase() {
	fmt.Println("⚠️  ¡ADVERTENCIA! Esto eliminará TODAS las tablas y datos.")
	fmt.Println("⚠️  Esta acción NO se puede deshacer.")
	fmt.Print("\n¿Estás seguro? Escribe 'SI ELIMINAR TODO' para confirmar: ")

	reader := bufio.NewReader(os.Stdin)
	confirmation, _ := reader.ReadString('\n')
	confirmation = strings.TrimSpace(confirmation)

	if confirmation != "SI ELIMINAR TODO" {
		fmt.Println("❌ Operación cancelada")
		return
	}

	fmt.Println()
	fmt.Println("🗑️  Eliminando tablas...")

	// Desactivar foreign key checks temporalmente
	config.DB.Exec("SET FOREIGN_KEY_CHECKS = 0")

	// Eliminar tablas en orden
	if err := config.DB.Migrator().DropTable(&models.Agent{}); err != nil {
		log.Printf("⚠️  Error eliminando tabla agents: %v", err)
	} else {
		fmt.Println("   ✅ Tabla 'agents' eliminada")
	}

	if err := config.DB.Migrator().DropTable(&models.User{}); err != nil {
		log.Printf("⚠️  Error eliminando tabla users: %v", err)
	} else {
		fmt.Println("   ✅ Tabla 'users' eliminada")
	}

	// Reactivar foreign key checks
	config.DB.Exec("SET FOREIGN_KEY_CHECKS = 1")

	fmt.Println()
	fmt.Println("🔄 Recreando tablas...")

	// Recrear tablas
	err := config.DB.AutoMigrate(
		&models.User{},
		&models.Agent{},
	)

	if err != nil {
		log.Fatalf("❌ Error recreando tablas: %v", err)
	}

	fmt.Println("   ✅ Tabla 'users' creada")
	fmt.Println("   ✅ Tabla 'agents' creada")
	fmt.Println()
	fmt.Println("🎉 Base de datos reseteada completamente.")
	fmt.Println("💡 Puedes empezar a usar tu aplicación desde cero.")
}
