FROM golang:1.23-alpine AS builder
WORKDIR /app
COPY go.mod go.sum* ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -o /bin/backend-go ./cmd/server

FROM alpine:3.21
RUN apk add --no-cache ca-certificates docker-cli
WORKDIR /app
COPY --from=builder /bin/backend-go /usr/local/bin/backend-go
EXPOSE 3002
CMD ["backend-go"]
