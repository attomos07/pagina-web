package config

import (
	"fmt"
	"log"
	"net/url"
	"os"
	"strings"

	"gorm.io/driver/mysql"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

var DB *gorm.DB

func ConnectDatabase() {
	var dsn string

	// Intentar con MYSQL_PUBLIC_URL primero (Railway)
	publicURL := os.Getenv("MYSQL_PUBLIC_URL")

	if publicURL != "" {
		// Parsear la URL de MySQL
		parsedURL, err := url.Parse(publicURL)
		if err != nil {
			log.Fatal("Error al parsear MYSQL_PUBLIC_URL:", err)
		}

		// Extraer componentes
		password, _ := parsedURL.User.Password()
		username := parsedURL.User.Username()
		host := parsedURL.Hostname()
		port := parsedURL.Port()
		database := strings.TrimPrefix(parsedURL.Path, "/")

		// Construir DSN en el formato correcto
		dsn = fmt.Sprintf("%s:%s@tcp(%s:%s)/%s?charset=utf8mb4&parseTime=True&loc=Local",
			username, password, host, port, database)
	} else {
		// Construcción manual (desarrollo local)
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
