# Build stage
FROM golang:1.24-alpine AS builder

WORKDIR /app

# Copiar archivos de dependencias primero (aprovecha cache de Docker)
COPY go.mod go.sum ./
RUN go mod download

# Copiar código fuente
COPY . .

# Build con optimizaciones
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-w -s" -a -installsuffix cgo -o out

# Runtime stage - imagen mínima
FROM alpine:latest

# Instalar certificados SSL (importante para APIs externas)
RUN apk --no-cache add ca-certificates

WORKDIR /root/

# Copiar solo el binario del build stage
COPY --from=builder /app/out .

# Puerto (ajusta según tu app)
EXPOSE 8080

CMD ["./out"]
```

**2. (Opcional) Crea un `.dockerignore`:**
```
.git
.env
*.md
.gitignore
.DS_Store
tmp/
vendor/