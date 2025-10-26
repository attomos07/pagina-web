package config

import (
	"fmt"
	"log"
	"os"

	"gorm.io/driver/mysql"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

var DB *gorm.DB

func ConnectDatabase() {
	// Primero intentar con MYSQL_PUBLIC_URL (Railway)
	publicURL := os.Getenv("MYSQL_PUBLIC_URL")

	var dsn string

	if publicURL != "" {
		// Usar la URL pública directamente
		dsn = publicURL
	} else {
		// Construir DSN manualmente (para desarrollo local)
		host := os.Getenv("MYSQL_HOST")
		port := os.Getenv("MYSQL_PORT")
		database := os.Getenv("MYSQL_DATABASE")
		user := os.Getenv("MYSQL_USER")
		password := os.Getenv("MYSQL_PASSWORD")

		dsn = fmt.Sprintf("%s:%s@tcp(%s:%s)/%s?charset=utf8mb4&parseTime=True&loc=Local",
			user, password, host, port, database)
	}

	// Conectar a la base de datos
	db, err := gorm.Open(mysql.Open(dsn), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Info),
	})

	if err != nil {
		log.Fatal("Error al conectar con la base de datos:", err)
	}

	DB = db
	log.Println("✅ Conexión exitosa con MySQL")
}

func GetDB() *gorm.DB {
	return DB
}
