package main

import (
	"context"
	"fmt"
	"log"
	"os"
	"os/signal"
	"syscall"
	"time"

	"atomic-whatsapp-web/src"

	"github.com/joho/godotenv"
	_ "github.com/mattn/go-sqlite3"
	"github.com/mdp/qrterminal/v3"
	"go.mau.fi/whatsmeow"
	"go.mau.fi/whatsmeow/store/sqlstore"
	"go.mau.fi/whatsmeow/types/events"
	waLog "go.mau.fi/whatsmeow/util/log"
)

func main() {
	printBanner()

	// Cargar variables de entorno (no falla si no existe)
	if err := godotenv.Load(); err != nil {
		log.Println("ℹ️  Archivo .env no encontrado, usando variables de entorno del sistema")
	} else {
		log.Println("✅ Archivo .env cargado correctamente")
	}

	// ============================================
	// CARGAR CONFIGURACIÓN DEL NEGOCIO
	// ============================================
	log.Println("\n🔧 Cargando configuración del negocio...")
	if err := src.LoadBusinessConfig(); err != nil {
		log.Printf("⚠️  Error cargando configuración: %v", err)
		log.Println("⚠️  El bot funcionará con configuración por defecto")
	} else {
		log.Println("✅ Configuración del negocio cargada exitosamente")
		if src.BusinessCfg != nil {
			log.Printf("   - Negocio: %s", src.BusinessCfg.AgentName)
			log.Printf("   - Tipo: %s", src.BusinessCfg.BusinessType)
			log.Printf("   - Servicios configurados: %d", len(src.BusinessCfg.Services))
			log.Printf("   - Trabajadores: %d", len(src.BusinessCfg.Workers))
		}
	}

	// Mostrar estado de configuración
	showConfigurationStatus()

	// Inicializar servicios
	log.Println("\n🚀 Inicializando servicios...")
	log.Println("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")

	// Inicializar Gemini AI
	geminiStatus := "❌ No disponible"
	if err := src.InitGemini(); err != nil {
		log.Printf("⚠️  Gemini AI: %v\n", err)
		log.Println("💡 El bot funcionará con respuestas básicas (sin IA)")
	} else {
		geminiStatus = "✅ Conectado"
		log.Println("✅ Gemini AI inicializado correctamente")
	}

	// Inicializar Google Sheets
	sheetsStatus := "❌ No disponible"
	if err := src.InitSheets(); err != nil {
		log.Printf("⚠️  Google Sheets: %v\n", err)
		log.Println("💡 Las citas no se guardarán en Sheets")
	} else {
		sheetsStatus = "✅ Conectado"
		log.Println("✅ Google Sheets inicializado correctamente")
	}

	// Inicializar Google Calendar
	calendarStatus := "❌ No disponible"
	if err := src.InitCalendar(); err != nil {
		log.Printf("⚠️  Google Calendar: %v\n", err)
		log.Println("💡 Las citas no se crearán en Calendar")
	} else {
		calendarStatus = "✅ Conectado"
		log.Println("✅ Google Calendar inicializado correctamente")
	}

	log.Println("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")

	// Iniciar watchdog para recargar configuración
	go configWatchdog()

	// Configurar logger de WhatsApp
	dbLog := waLog.Stdout("Database", "INFO", true)

	// Crear contexto
	ctx := context.Background()

	// Obtener ruta de la base de datos
	dbFile := os.Getenv("DATABASE_FILE")
	if dbFile == "" {
		dbFile = "whatsapp.db"
	}

	log.Printf("📁 Base de datos: %s\n", dbFile)

	// Crear contenedor de store SQLite
	container, err := sqlstore.New(ctx, "sqlite3", fmt.Sprintf("file:%s?_foreign_keys=on", dbFile), dbLog)
	if err != nil {
		log.Fatalf("❌ Error creando store: %v", err)
	}

	// Si no hay dispositivos, crear uno nuevo
	deviceStore, err := container.GetFirstDevice(ctx)
	if err != nil {
		log.Fatalf("❌ Error obteniendo dispositivo: %v", err)
	}

	clientLog := waLog.Stdout("Client", "INFO", true)
	client := whatsmeow.NewClient(deviceStore, clientLog)

	// Configurar cliente global
	src.SetClient(client)

	// Registrar manejador de eventos
	client.AddEventHandler(func(evt interface{}) {
		handleEvents(evt, client)
	})

	log.Println("\n📱 Conectando a WhatsApp...")
	log.Println("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")

	// Si no está conectado, mostrar QR
	if client.Store.ID == nil {
		qrChan, _ := client.GetQRChannel(context.Background())
		err = client.Connect()
		if err != nil {
			log.Fatalf("❌ Error conectando: %v", err)
		}

		fmt.Println("\n🔐 Escanea este código QR con tu WhatsApp:")
		fmt.Println("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")

		qrShown := false

		for evt := range qrChan {
			if evt.Event == "code" {
				// Limpiar QR anterior si ya se mostró uno
				if qrShown {
					// Limpiar pantalla completa y volver al inicio
					fmt.Print("\033[2J\033[H")
					// Re-imprimir header
					fmt.Println("\n🔐 Escanea este código QR con tu WhatsApp:")
					fmt.Println("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
				}

				// Generar y mostrar QR directamente
				qrterminal.GenerateHalfBlock(evt.Code, qrterminal.L, os.Stdout)

				fmt.Println("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
				fmt.Println("⏳ Esperando escaneo... (El QR se actualiza automáticamente)")

				qrShown = true
			} else {
				log.Printf("📱 Estado de login: %s\n", evt.Event)
			}
		}
	} else {
		err = client.Connect()
		if err != nil {
			log.Fatalf("❌ Error conectando: %v", err)
		}
	}

	// Mostrar estado final
	printFinalStatus(geminiStatus, sheetsStatus, calendarStatus)

	// Crear calendario semanal si está habilitado
	if src.IsSheetsEnabled() {
		if err := src.InitializeWeeklyCalendar(); err != nil {
			log.Printf("⚠️  No se pudo inicializar calendario semanal: %v\n", err)
		} else {
			log.Println("✅ Calendario semanal configurado")
		}
	}

	// Mantener el programa corriendo
	c := make(chan os.Signal, 1)
	signal.Notify(c, os.Interrupt, syscall.SIGTERM)
	<-c

	fmt.Println("\n👋 Desconectando bot...")
	client.Disconnect()
}

// Banner del bot
func printBanner() {
	banner := `
╔═══════════════════════════════════════════════════════╗
║                                                       ║
║        🤖 AtomicBot WhatsApp - Attomos Edition       ║
║                                                       ║
║          Bot Inteligente con IA para Negocios        ║
║                                                       ║
╚═══════════════════════════════════════════════════════╝
`
	fmt.Println(banner)
}

// Mostrar estado de configuración
func showConfigurationStatus() {
	log.Println("\n📋 Estado de Configuración:")
	log.Println("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")

	// Verificar business_config.json
	configPath := os.Getenv("BUSINESS_CONFIG_PATH")
	if configPath == "" {
		configPath = "business_config.json"
	}

	if _, err := os.Stat(configPath); err == nil {
		log.Printf("✅ Configuración del negocio: %s\n", configPath)
		if src.BusinessCfg != nil {
			log.Printf("   - Negocio: %s\n", src.BusinessCfg.AgentName)
			log.Printf("   - Servicios: %d configurados\n", len(src.BusinessCfg.Services))
		}
	} else {
		log.Printf("⚠️  Configuración del negocio: No encontrada\n")
		log.Println("   💡 Se usará configuración por defecto")
	}

	// Verificar .env
	if _, err := os.Stat(".env"); err == nil {
		log.Println("✅ Archivo .env: Encontrado")
	} else {
		log.Println("⚠️  Archivo .env: No encontrado")
		log.Println("   💡 Crea un archivo .env para configurar el bot")
	}

	// Verificar google.json
	if _, err := os.Stat("google.json"); err == nil {
		log.Println("✅ Archivo google.json: Encontrado")
	} else {
		log.Println("⚠️  Archivo google.json: No encontrado")
		log.Println("   💡 Necesario para Google Sheets y Calendar")
	}

	// Verificar variables de entorno
	vars := map[string]string{
		"GEMINI_API_KEY":     "Gemini AI",
		"SPREADSHEETID":      "Google Sheets",
		"GOOGLE_CALENDAR_ID": "Google Calendar",
	}

	log.Println("\n📊 Variables de Entorno:")
	for env, service := range vars {
		value := os.Getenv(env)
		if value != "" {
			masked := maskValue(value)
			log.Printf("   ✅ %s: %s\n", env, masked)
		} else {
			log.Printf("   ⚠️  %s: No configurada (necesaria para %s)\n", env, service)
		}
	}
}

// Enmascarar valores sensibles
func maskValue(value string) string {
	if len(value) <= 8 {
		return "***"
	}
	return value[:4] + "..." + value[len(value)-4:]
}

// Mostrar estado final
func printFinalStatus(gemini, sheets, calendar string) {
	fmt.Println("\n╔═══════════════════════════════════════════════════════╗")
	fmt.Println("║              ✅ BOT CONECTADO EXITOSAMENTE            ║")
	fmt.Println("╚═══════════════════════════════════════════════════════╝")

	if src.BusinessCfg != nil {
		fmt.Println("\n🏢 Negocio Configurado:")
		fmt.Println("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
		fmt.Printf("   📋 Nombre: %s\n", src.BusinessCfg.AgentName)
		fmt.Printf("   🏪 Tipo: %s\n", src.BusinessCfg.BusinessType)
		fmt.Printf("   📦 Servicios: %d\n", len(src.BusinessCfg.Services))
		fmt.Printf("   👥 Trabajadores: %d\n", len(src.BusinessCfg.Workers))
	}

	fmt.Println("\n📊 Estado de Servicios:")
	fmt.Println("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
	fmt.Printf("   🧠 Gemini AI:        %s\n", gemini)
	fmt.Printf("   📊 Google Sheets:    %s\n", sheets)
	fmt.Printf("   📅 Google Calendar:  %s\n", calendar)
	fmt.Println("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
	fmt.Println("\n📱 Esperando mensajes de WhatsApp...")
	fmt.Println("💡 Presiona Ctrl+C para detener el bot\n")
}

// Watchdog para recargar configuración automáticamente
func configWatchdog() {
	ticker := time.NewTicker(30 * time.Second)
	defer ticker.Stop()

	lastEnvMod := getFileModTime(".env")
	lastGoogleMod := getFileModTime("google.json")
	lastConfigMod := getFileModTime("business_config.json")

	for range ticker.C {
		// Verificar si business_config.json cambió
		currentConfigMod := getFileModTime("business_config.json")
		if currentConfigMod != lastConfigMod {
			log.Println("\n🔄 Detectado cambio en business_config.json, recargando...")
			if err := src.LoadBusinessConfig(); err == nil {
				log.Println("✅ Configuración del negocio recargada")
				if src.BusinessCfg != nil {
					log.Printf("   - Negocio: %s\n", src.BusinessCfg.AgentName)
					log.Printf("   - Servicios: %d\n", len(src.BusinessCfg.Services))
				}
			} else {
				log.Printf("⚠️  Error recargando configuración: %v\n", err)
			}
			lastConfigMod = currentConfigMod
		}

		// Verificar si .env cambió
		currentEnvMod := getFileModTime(".env")
		if currentEnvMod != lastEnvMod {
			log.Println("\n🔄 Detectado cambio en .env, recargando configuración...")
			if err := godotenv.Load(); err == nil {
				log.Println("✅ Configuración recargada")

				if !src.IsGeminiEnabled() {
					if err := src.InitGemini(); err == nil {
						log.Println("✅ Gemini AI ahora está disponible")
					}
				}

				if !src.IsSheetsEnabled() {
					if err := src.InitSheets(); err == nil {
						log.Println("✅ Google Sheets ahora está disponible")
					}
				}

				if !src.IsCalendarEnabled() {
					if err := src.InitCalendar(); err == nil {
						log.Println("✅ Google Calendar ahora está disponible")
					}
				}
			}
			lastEnvMod = currentEnvMod
		}

		// Verificar si google.json cambió
		currentGoogleMod := getFileModTime("google.json")
		if currentGoogleMod != lastGoogleMod {
			log.Println("\n🔄 Detectado cambio en google.json, recargando servicios...")

			if !src.IsSheetsEnabled() {
				if err := src.InitSheets(); err == nil {
					log.Println("✅ Google Sheets ahora está disponible")
				}
			}

			if !src.IsCalendarEnabled() {
				if err := src.InitCalendar(); err == nil {
					log.Println("✅ Google Calendar ahora está disponible")
				}
			}

			lastGoogleMod = currentGoogleMod
		}
	}
}

// Obtener tiempo de modificación de archivo
func getFileModTime(filename string) time.Time {
	info, err := os.Stat(filename)
	if err != nil {
		return time.Time{}
	}
	return info.ModTime()
}

// Manejador de eventos
func handleEvents(evt interface{}, client *whatsmeow.Client) {
	switch v := evt.(type) {
	case *events.Message:
		src.HandleMessage(v, client)
	case *events.Receipt:
		if v.Type == events.ReceiptTypeRead || v.Type == events.ReceiptTypeReadSelf {
			log.Printf("✓✓ Mensaje leído: %s\n", v.MessageIDs[0])
		}
	case *events.Connected:
		fmt.Println("🟢 Conectado a WhatsApp")
	case *events.Disconnected:
		fmt.Println("🔴 Desconectado de WhatsApp")
	case *events.LoggedOut:
		fmt.Println("🚪 Sesión cerrada")
		log.Println("💡 Elimina whatsapp.db y vuelve a escanear el QR")
	}
}
