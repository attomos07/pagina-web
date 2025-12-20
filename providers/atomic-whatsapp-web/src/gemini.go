package src

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"os"
	"strings"

	"github.com/google/generative-ai-go/genai"
	"google.golang.org/api/option"
)

var geminiClient *genai.Client
var geminiModel *genai.GenerativeModel
var geminiEnabled bool

// AppointmentAnalysis estructura para análisis de agendamiento
type AppointmentAnalysis struct {
	WantsToSchedule bool              `json:"wantsToSchedule"`
	ExtractedData   map[string]string `json:"extractedData"`
	Confidence      float64           `json:"confidence"`
}

// InitGemini inicializa el cliente de Gemini AI
func InitGemini() error {
	apiKey := os.Getenv("GEMINI_API_KEY")
	if apiKey == "" {
		geminiEnabled = false
		return fmt.Errorf("GEMINI_API_KEY no configurada")
	}

	ctx := context.Background()
	client, err := genai.NewClient(ctx, option.WithAPIKey(apiKey))
	if err != nil {
		geminiEnabled = false
		return fmt.Errorf("error creando cliente Gemini: %w", err)
	}

	geminiClient = client
	geminiModel = client.GenerativeModel("gemini-2.0-flash-exp")

	// Configurar parámetros del modelo
	geminiModel.SetTemperature(0.7)
	geminiModel.SetMaxOutputTokens(1024)
	geminiModel.SetTopP(0.9)
	geminiModel.SetTopK(40)

	geminiEnabled = true
	log.Println("✅ Gemini AI inicializado correctamente")
	return nil
}

// IsGeminiEnabled verifica si Gemini está habilitado
func IsGeminiEnabled() bool {
	return geminiEnabled
}

// Chat función principal para chatear con Gemini usando configuración dinámica
func Chat(promptContext, userMessage, conversationHistory string) (string, error) {
	if geminiClient == nil {
		return "", fmt.Errorf("Gemini no inicializado")
	}

	ctx := context.Background()

	// Obtener el prompt del sistema desde la configuración del negocio
	systemPrompt := GetSystemPrompt()

	// Construir prompt completo
	fullPrompt := fmt.Sprintf(`%s

HISTORIAL DE CONVERSACIÓN:
%s

CONTEXTO ADICIONAL: %s

MENSAJE DEL CLIENTE: %s

INSTRUCCIONES:
- Responde de manera natural basándote en la información del negocio
- Máximo 3-4 líneas de respuesta
- Sé útil y directo
- Si no sabes algo, dilo claramente

RESPUESTA:`,
		systemPrompt,
		conversationHistory,
		promptContext,
		userMessage)

	// Generar respuesta
	resp, err := geminiModel.GenerateContent(ctx, genai.Text(fullPrompt))
	if err != nil {
		return "", fmt.Errorf("error generando respuesta: %w", err)
	}

	if resp == nil || len(resp.Candidates) == 0 {
		return "¿Podrías repetir eso?", nil
	}

	// Extraer texto de la respuesta
	var answer strings.Builder
	for _, cand := range resp.Candidates {
		if cand.Content != nil {
			for _, part := range cand.Content.Parts {
				answer.WriteString(fmt.Sprintf("%v", part))
			}
		}
	}

	result := strings.TrimSpace(answer.String())

	// Limitar longitud
	if len(result) > 500 {
		result = result[:450] + "..."
	}

	if result == "" {
		return "¿Podrías repetir eso?", nil
	}

	return result, nil
}

// AnalyzeForAppointment analiza si el mensaje indica intención de agendamiento
func AnalyzeForAppointment(message, conversationHistory string, isCurrentlyScheduling bool) (*AppointmentAnalysis, error) {
	if geminiClient == nil {
		// Fallback sin Gemini
		return fallbackAnalysis(message), nil
	}

	ctx := context.Background()

	// Obtener servicios disponibles
	servicesInfo := ""
	if BusinessCfg != nil && len(BusinessCfg.Services) > 0 {
		servicesInfo = "SERVICIOS DISPONIBLES:\n"
		for _, service := range BusinessCfg.Services {
			servicesInfo += fmt.Sprintf("- %s\n", service.Title)
		}
	}

	// Obtener trabajadores disponibles
	workersInfo := ""
	if BusinessCfg != nil && len(BusinessCfg.Workers) > 0 {
		workersInfo = "PERSONAL DISPONIBLE:\n"
		for _, worker := range BusinessCfg.Workers {
			workersInfo += fmt.Sprintf("- %s\n", worker.Name)
		}
	}

	// Construir prompt de análisis
	analysisPrompt := fmt.Sprintf(`Analiza este mensaje y extrae información de agendamiento.

%s

%s

PALABRAS CLAVE DE AGENDAMIENTO:
- agendar, cita, turno, reservar, apartar
- cuando, horario, disponible, puede

HISTORIAL:
%s

MENSAJE: "%s"

¿YA ESTÁ AGENDANDO?: %v

EXTRAE SOLO LO QUE ESTÁ EN EL MENSAJE:
- nombre (nombre completo del cliente)
- servicio (debe ser uno de los servicios listados arriba)
- barbero/trabajador (si lo menciona, debe ser uno de los listados arriba)
- fecha (DD/MM/YYYY o "mañana", "lunes", etc.)
- hora (HH:MM o "mañana", "tarde")

NO extraigas teléfonos.

RESPONDE EN JSON:
{
    "wantsToSchedule": true/false,
    "extractedData": {
        "nombre": "nombre o null",
        "servicio": "servicio o null",
        "barbero": "barbero o null",
        "fecha": "fecha o null",
        "hora": "hora o null"
    },
    "confidence": 0.0-1.0
}`,
		servicesInfo,
		workersInfo,
		conversationHistory,
		message,
		isCurrentlyScheduling)

	// Generar análisis
	resp, err := geminiModel.GenerateContent(ctx, genai.Text(analysisPrompt))
	if err != nil {
		log.Printf("⚠️  Error en análisis, usando fallback: %v\n", err)
		return fallbackAnalysis(message), nil
	}

	if resp == nil || len(resp.Candidates) == 0 {
		return fallbackAnalysis(message), nil
	}

	// Extraer respuesta
	var responseText string
	for _, cand := range resp.Candidates {
		if cand.Content != nil {
			for _, part := range cand.Content.Parts {
				responseText += fmt.Sprintf("%v", part)
			}
		}
	}

	// Extraer JSON de la respuesta
	jsonStart := strings.Index(responseText, "{")
	jsonEnd := strings.LastIndex(responseText, "}")

	if jsonStart == -1 || jsonEnd == -1 {
		log.Printf("⚠️  No se pudo extraer JSON, usando fallback")
		return fallbackAnalysis(message), nil
	}

	jsonStr := responseText[jsonStart : jsonEnd+1]

	// Parsear JSON
	var analysis AppointmentAnalysis
	if err := json.Unmarshal([]byte(jsonStr), &analysis); err != nil {
		log.Printf("⚠️  Error parseando JSON: %v, usando fallback\n", err)
		return fallbackAnalysis(message), nil
	}

	// Asegurar que el mapa esté inicializado
	if analysis.ExtractedData == nil {
		analysis.ExtractedData = make(map[string]string)
	}

	log.Printf("📊 Análisis: wantsToSchedule=%v, confidence=%.2f, data=%v",
		analysis.WantsToSchedule,
		analysis.Confidence,
		analysis.ExtractedData)

	return &analysis, nil
}

// fallbackAnalysis análisis simple sin Gemini
func fallbackAnalysis(message string) *AppointmentAnalysis {
	lowerMessage := strings.ToLower(message)
	keywords := []string{"cita", "agendar", "turno", "reservar", "apartar"}

	wantsToSchedule := false
	for _, keyword := range keywords {
		if strings.Contains(lowerMessage, keyword) {
			wantsToSchedule = true
			break
		}
	}

	return &AppointmentAnalysis{
		WantsToSchedule: wantsToSchedule,
		ExtractedData:   make(map[string]string),
		Confidence:      0.6,
	}
}

// CheckGeminiHealth verifica que Gemini esté funcionando
func CheckGeminiHealth() bool {
	if geminiClient == nil {
		return false
	}

	_, err := Chat("", "test", "")
	return err == nil
}

// GenerateWelcomeMessage genera un mensaje de bienvenida personalizado
func GenerateWelcomeMessage() string {
	if BusinessCfg == nil {
		return "¡Hola! ¿En qué puedo ayudarte hoy?"
	}

	// Si hay Gemini, generar mensaje dinámico
	if geminiEnabled {
		ctx := context.Background()
		prompt := fmt.Sprintf(`Genera un mensaje de bienvenida breve (2-3 líneas) para %s, un %s.

Incluye:
- Saludo amigable
- Mención de que pueden preguntar sobre servicios, horarios o agendar cita
- Un emoji apropiado

Tono: %s

RESPONDE SOLO CON EL MENSAJE, SIN EXPLICACIONES.`,
			BusinessCfg.AgentName,
			BusinessCfg.BusinessType,
			BusinessCfg.Personality.Tone)

		resp, err := geminiModel.GenerateContent(ctx, genai.Text(prompt))
		if err == nil && resp != nil && len(resp.Candidates) > 0 {
			var msg strings.Builder
			for _, cand := range resp.Candidates {
				if cand.Content != nil {
					for _, part := range cand.Content.Parts {
						msg.WriteString(fmt.Sprintf("%v", part))
					}
				}
			}
			if msg.Len() > 0 {
				return strings.TrimSpace(msg.String())
			}
		}
	}

	// Mensaje por defecto
	return fmt.Sprintf("¡Hola! Bienvenido a %s 👋\n\nPuedo ayudarte con información sobre nuestros servicios, horarios o agendar una cita. ¿En qué te puedo ayudar?",
		BusinessCfg.AgentName)
}
