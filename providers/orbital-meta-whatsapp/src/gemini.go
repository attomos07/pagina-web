package src

import (
	"context"
	"fmt"
	"log"
	"os"

	"github.com/google/generative-ai-go/genai"
	"google.golang.org/api/option"
)

var (
	geminiClient *genai.Client
	geminiModel  *genai.GenerativeModel
	geminiCtx    context.Context
)

// InitGemini inicializa el cliente de Gemini
func InitGemini() error {
	apiKey := os.Getenv("GEMINI_API_KEY")
	if apiKey == "" {
		log.Println("⚠️  GEMINI_API_KEY no configurado - Gemini deshabilitado")
		return nil
	}

	ctx := context.Background()
	client, err := genai.NewClient(ctx, option.WithAPIKey(apiKey))
	if err != nil {
		return fmt.Errorf("error creando cliente Gemini: %w", err)
	}

	geminiClient = client
	geminiModel = client.GenerativeModel("gemini-1.5-flash")
	geminiCtx = ctx

	// Configuración del modelo
	geminiModel.SetTemperature(0.7)
	geminiModel.SetTopP(0.95)
	geminiModel.SetTopK(40)
	geminiModel.SetMaxOutputTokens(512)

	log.Println("✅ Gemini AI inicializado correctamente")
	log.Println("   🧠 Modelo: gemini-1.5-flash")
	log.Println("   🌡️  Temperatura: 0.7")

	return nil
}

// GenerateResponse genera una respuesta usando Gemini
func GenerateResponse(prompt string) (string, error) {
	if geminiClient == nil || geminiModel == nil {
		return "", fmt.Errorf("Gemini no está inicializado")
	}

	log.Println("🤖 Generando respuesta con Gemini...")

	resp, err := geminiModel.GenerateContent(geminiCtx, genai.Text(prompt))
	if err != nil {
		return "", fmt.Errorf("error generando respuesta: %w", err)
	}

	if len(resp.Candidates) == 0 {
		return "", fmt.Errorf("no se generó ninguna respuesta")
	}

	if len(resp.Candidates[0].Content.Parts) == 0 {
		return "", fmt.Errorf("respuesta vacía")
	}

	response := fmt.Sprintf("%v", resp.Candidates[0].Content.Parts[0])
	log.Printf("✅ Respuesta generada: %s", response)

	return response, nil
}

// GenerateSmartResponse genera una respuesta inteligente basada en contexto
func GenerateSmartResponse(message, senderName, businessContext string) (string, error) {
	prompt := fmt.Sprintf(`Eres un asistente virtual profesional y amigable.

Contexto del negocio:
%s

Cliente: %s
Mensaje del cliente: %s

Instrucciones:
1. Responde de manera natural, profesional y amigable
2. Mantén las respuestas breves (máximo 3 líneas)
3. Si es un saludo, saluda de vuelta
4. Si pregunta por servicios, horarios o ubicación, proporciona la información
5. Si quiere agendar, pide los datos necesarios (fecha y hora)
6. Usa emojis ocasionalmente para hacer la conversación más amigable
7. Responde en español

Genera la respuesta:`, businessContext, senderName, message)

	return GenerateResponse(prompt)
}

// IsGeminiEnabled verifica si Gemini está habilitado
func IsGeminiEnabled() bool {
	return geminiClient != nil && geminiModel != nil
}

// CloseGemini cierra el cliente de Gemini
func CloseGemini() {
	if geminiClient != nil {
		geminiClient.Close()
		log.Println("👋 Cliente Gemini cerrado")
	}
}
