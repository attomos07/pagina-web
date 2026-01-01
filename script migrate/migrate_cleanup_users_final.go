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
	fmt.Println("╔═══════════════════════════════════════════════════════════════╗")
	fmt.Println("║     🧹 LIMPIEZA: ELIMINAR COLUMNAS OBSOLETAS DE USERS        ║")
	fmt.Println("╚═══════════════════════════════════════════════════════════════╝")
	fmt.Println()

	// Cargar variables de entorno
	if err := godotenv.Load(); err != nil {
		log.Println("⚠️  Advertencia: No se encontró archivo .env")
	}

	// Conectar a la base de datos
	fmt.Println("📡 Conectando a la base de datos...")
	config.ConnectDatabase()
	fmt.Println("✅ Conectado a la base de datos\n")

	fmt.Println("📋 Esta migración eliminará las siguientes columnas de 'users':")
	fmt.Println()
	fmt.Println("   ❌ Columnas de Meta WhatsApp:")
	fmt.Println("      • meta_access_token")
	fmt.Println("      • meta_waba_id")
	fmt.Println("      • meta_phone_number_id")
	fmt.Println("      • meta_display_number")
	fmt.Println("      • meta_verified_name")
	fmt.Println("      • meta_connected")
	fmt.Println("      • meta_connected_at")
	fmt.Println("      • meta_token_expires_at")
	fmt.Println()
	fmt.Println("   ❌ Columnas de Servidor Compartido:")
	fmt.Println("      • shared_server_id")
	fmt.Println("      • shared_server_ip")
	fmt.Println("      • shared_server_password")
	fmt.Println("      • shared_server_status")
	fmt.Println()
	fmt.Println("   ❌ Columnas de Nombres:")
	fmt.Println("      • first_name")
	fmt.Println("      • last_name")
	fmt.Println()
	fmt.Println("💡 Estas columnas ya no son utilizadas en el sistema")
	fmt.Println()
	fmt.Print("¿Continuar? (escribe 'SI' para continuar): ")

	reader := bufio.NewReader(os.Stdin)
	confirmation, _ := reader.ReadString('\n')
	confirmation = strings.TrimSpace(strings.ToUpper(confirmation))

	if confirmation != "SI" {
		fmt.Println("❌ Migración cancelada")
		return
	}

	fmt.Println()
	fmt.Println("═══════════════════════════════════════════════════════════════")
	fmt.Println("INICIANDO LIMPIEZA")
	fmt.Println("═══════════════════════════════════════════════════════════════")

	// Verificar que la tabla users existe
	fmt.Println("\n🔍 Verificando que tabla 'users' existe...")
	var userCount int64
	config.DB.Model(&models.User{}).Count(&userCount)
	fmt.Printf("✅ Tabla users existe con %d registros\n", userCount)

	// Lista de columnas a eliminar
	columnsToRemove := []string{
		// Meta WhatsApp
		"meta_access_token",
		"meta_waba_id",
		"meta_phone_number_id",
		"meta_display_number",
		"meta_verified_name",
		"meta_connected",
		"meta_connected_at",
		"meta_token_expires_at",
		// Servidor Compartido
		"shared_server_id",
		"shared_server_ip",
		"shared_server_password",
		"shared_server_status",
		// Nombres
		"first_name",
		"last_name",
	}

	fmt.Println("\n📝 Eliminando columnas obsoletas...")
	fmt.Println(strings.Repeat("─", 65))

	successCount := 0
	skipCount := 0
	errorCount := 0

	for _, column := range columnsToRemove {
		fmt.Printf("   → Procesando: %s... ", column)

		// Verificar si la columna existe
		if !columnExists(column, "users") {
			fmt.Printf("⏭️  No existe (saltando)\n")
			skipCount++
			continue
		}

		// Eliminar la columna
		dropSQL := fmt.Sprintf("ALTER TABLE users DROP COLUMN %s", column)
		if err := config.DB.Exec(dropSQL).Error; err != nil {
			fmt.Printf("❌ Error: %v\n", err)
			errorCount++
		} else {
			fmt.Printf("✅ Eliminada\n")
			successCount++
		}
	}

	// Eliminar índices relacionados si existen
	fmt.Println("\n📝 Eliminando índices obsoletos...")
	fmt.Println(strings.Repeat("─", 65))

	indicesToRemove := []string{
		"idx_users_meta_connected",
		"idx_users_meta_phone_number_id",
		"idx_users_shared_server_status",
	}

	for _, index := range indicesToRemove {
		fmt.Printf("   → Procesando índice: %s... ", index)

		if !indexExists(index, "users") {
			fmt.Printf("⏭️  No existe (saltando)\n")
			continue
		}

		dropIndexSQL := fmt.Sprintf("DROP INDEX %s ON users", index)
		if err := config.DB.Exec(dropIndexSQL).Error; err != nil {
			fmt.Printf("⚠️  Error: %v\n", err)
		} else {
			fmt.Printf("✅ Eliminado\n")
		}
	}

	// Resumen
	fmt.Println(strings.Repeat("─", 65))
	fmt.Printf("\n📊 Resumen:\n")
	fmt.Printf("   ✅ Columnas eliminadas: %d\n", successCount)
	fmt.Printf("   ⏭️  Columnas saltadas (no existían): %d\n", skipCount)
	if errorCount > 0 {
		fmt.Printf("   ❌ Errores: %d\n", errorCount)
	}

	// Verificación final
	fmt.Println("\n🔍 Verificando estructura actual de 'users'...")

	type TableColumn struct {
		Field   string
		Type    string
		Null    string
		Key     string
		Default *string
		Extra   string
	}

	var userColumns []TableColumn
	config.DB.Raw("DESCRIBE users").Scan(&userColumns)

	fmt.Println("\n📋 Columnas actuales en 'users':")
	for _, col := range userColumns {
		fmt.Printf("   • %s (%s)\n", col.Field, col.Type)
	}

	// Verificar que no queden columnas obsoletas
	hasObsoleteColumns := false
	for _, col := range userColumns {
		for _, obsolete := range columnsToRemove {
			if col.Field == obsolete {
				hasObsoleteColumns = true
				fmt.Printf("   ⚠️  Columna obsoleta todavía presente: %s\n", obsolete)
			}
		}
	}

	fmt.Println()
	if !hasObsoleteColumns {
		fmt.Println("═══════════════════════════════════════════════════════════════")
		fmt.Println("✅ LIMPIEZA COMPLETADA EXITOSAMENTE")
		fmt.Println("═══════════════════════════════════════════════════════════════")
		fmt.Println()
		fmt.Println("📋 Próximos pasos:")
		fmt.Println("   1. Reinicia tu aplicación")
		fmt.Println("   2. Verifica que todo funcione correctamente")
		fmt.Println("   3. Las columnas obsoletas han sido eliminadas")
		fmt.Println()
		fmt.Println("💡 Estructura simplificada:")
		fmt.Println("   • Columnas de Meta: Eliminadas")
		fmt.Println("   • Columnas de servidor compartido: Eliminadas")
		fmt.Println("   • Columnas de nombres: Eliminadas (usar businessName)")
		fmt.Println()
		fmt.Println("📊 Total de usuarios en sistema: ", userCount)
	} else {
		fmt.Println("⚠️  Todavía quedan columnas obsoletas. Intenta ejecutar manualmente:")
		fmt.Println()
		for _, col := range columnsToRemove {
			fmt.Printf("   ALTER TABLE users DROP COLUMN IF EXISTS %s;\n", col)
		}
	}
}

// columnExists verifica si una columna existe en una tabla
func columnExists(columnName, tableName string) bool {
	var count int64
	query := `
		SELECT COUNT(*) 
		FROM information_schema.COLUMNS 
		WHERE TABLE_SCHEMA = DATABASE() 
		AND TABLE_NAME = ? 
		AND COLUMN_NAME = ?
	`
	config.DB.Raw(query, tableName, columnName).Scan(&count)
	return count > 0
}

// indexExists verifica si un índice existe en una tabla
func indexExists(indexName, tableName string) bool {
	var count int64
	query := `
		SELECT COUNT(*) 
		FROM information_schema.STATISTICS 
		WHERE TABLE_SCHEMA = DATABASE() 
		AND TABLE_NAME = ? 
		AND INDEX_NAME = ?
	`
	config.DB.Raw(query, tableName, indexName).Scan(&count)
	return count > 0
}
