package auth

import (
	"context"
	"encoding/json"
	"net/http"
	"strings"

	"github.com/golang-jwt/jwt/v5"
)

type contextKey string

const userKey contextKey = "userClaims"

type Claims struct {
	Sub         string `json:"sub"`
	Provider    string `json:"provider"`
	Login       string `json:"login"`
	Name        string `json:"name"`
	Email       string `json:"email"`
	Avatar      string `json:"avatar"`
	GithubToken string `json:"githubToken"`
	jwt.RegisteredClaims
}

type Middleware struct {
	secret []byte
}

func NewMiddleware(secret string) *Middleware {
	return &Middleware{secret: []byte(secret)}
}

func (m *Middleware) RequireAuth(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		token := bearerToken(r.Header.Get("Authorization"))
		if token == "" {
			token = r.URL.Query().Get("token")
		}
		if token == "" {
			writeError(w, http.StatusUnauthorized, "Authentication required - send Authorization: Bearer <token>")
			return
		}

		claims := &Claims{}
		parsed, err := jwt.ParseWithClaims(token, claims, func(token *jwt.Token) (any, error) {
			return m.secret, nil
		})
		if err != nil || !parsed.Valid {
			writeError(w, http.StatusUnauthorized, "Invalid or expired token")
			return
		}

		ctx := context.WithValue(r.Context(), userKey, claims)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

func UserFromContext(ctx context.Context) (*Claims, bool) {
	claims, ok := ctx.Value(userKey).(*Claims)
	return claims, ok
}

func bearerToken(header string) string {
	if len(header) < 7 {
		return ""
	}
	if !strings.HasPrefix(strings.ToLower(header), "bearer ") {
		return ""
	}
	return strings.TrimSpace(header[7:])
}

func writeError(w http.ResponseWriter, status int, msg string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(map[string]string{"error": msg})
}
