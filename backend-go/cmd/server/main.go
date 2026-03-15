package main

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"sync/atomic"
	"syscall"
	"time"

	"everdeploy/backend-go/internal/auth"
	"everdeploy/backend-go/internal/chain"
	"everdeploy/backend-go/internal/config"
	"everdeploy/backend-go/internal/githubclone"
	"everdeploy/backend-go/internal/ipfs"
	"everdeploy/backend-go/internal/service"
)

type deployRequest struct {
	RepoURL     string `json:"repoUrl"`
	Label       string `json:"label"`
	Meta        string `json:"meta"`
	GithubToken string `json:"githubToken"`
	DryRun      bool   `json:"dryRun"`
}

type errorResponse struct {
	Error string `json:"error"`
}

type deploySSEOutcome struct {
	result service.Output
	err    error
}

func main() {
	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("config error: %v", err)
	}

	cloner := githubclone.NewDockerCloner(cfg.DockerImage, cfg.CloneTimeout, cfg.BuildTimeout)
	uploader := ipfs.NewPinataClient(cfg.PinataJWT, cfg.IPFSTimeout)
	writer, err := chain.NewSubnameRegistryWriter(
		cfg.SepoliaRPCURL,
		cfg.PrivateKey,
		cfg.SubnameRegistryContract,
		cfg.ChainID,
		cfg.TxTimeout,
	)
	if err != nil {
		log.Fatalf("chain setup error: %v", err)
	}

	pipeline := service.NewPipeline(cloner, uploader, writer)
	authMW := auth.NewMiddleware(cfg.JWTSecret)
	var activeJobs int32

	mux := http.NewServeMux()
	mux.HandleFunc("/healthz", func(w http.ResponseWriter, _ *http.Request) {
		writeJSON(w, http.StatusOK, map[string]any{"ok": true})
	})

	authMeHandler := authMW.RequireAuth(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		claims, ok := auth.UserFromContext(r.Context())
		if !ok {
			writeError(w, http.StatusUnauthorized, "unauthorized")
			return
		}

		expiresAt := ""
		if claims.ExpiresAt != nil {
			expiresAt = claims.ExpiresAt.Time.UTC().Format(time.RFC3339)
		}

		writeJSON(w, http.StatusOK, map[string]any{
			"user": map[string]any{
				"sub":      claims.Sub,
				"provider": claims.Provider,
				"login":    claims.Login,
				"name":     claims.Name,
				"email":    claims.Email,
				"avatar":   claims.Avatar,
			},
			"canManageRepos": claims.Provider == "github",
			"tokenExpires":   expiresAt,
		})
	}))
	mux.Handle("/api/v1/auth/me", authMeHandler)
	mux.Handle("/api/auth/me", authMeHandler)

	deployStatusHandler := http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		writeJSON(w, http.StatusOK, map[string]any{
			"active": atomic.LoadInt32(&activeJobs),
			"max":    cfg.MaxConcurrentDeploys,
		})
	})
	mux.Handle("/api/v1/deploy/status", deployStatusHandler)
	mux.Handle("/api/deploy/status", deployStatusHandler)

	deployJSONHandler := authMW.RequireAuth(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			writeError(w, http.StatusMethodNotAllowed, "method not allowed")
			return
		}

		var req deployRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeError(w, http.StatusBadRequest, "invalid JSON body")
			return
		}

		if req.RepoURL == "" || req.Label == "" {
			writeError(w, http.StatusBadRequest, "repoUrl and label are required")
			return
		}

		claims, _ := auth.UserFromContext(r.Context())
		if req.GithubToken == "" && claims != nil {
			req.GithubToken = claims.GithubToken
		}

		if !tryAcquireSlot(&activeJobs, cfg.MaxConcurrentDeploys) {
			writeError(w, http.StatusTooManyRequests, "Too many concurrent deploys - try again shortly")
			return
		}
		defer atomic.AddInt32(&activeJobs, -1)

		ctx, cancel := context.WithTimeout(r.Context(), cfg.RequestTimeout)
		defer cancel()

		result, err := pipeline.Run(ctx, service.Input{
			RepoURL:     req.RepoURL,
			Label:       req.Label,
			Meta:        req.Meta,
			GithubToken: req.GithubToken,
			DryRun:      req.DryRun,
		})
		if err != nil {
			status := http.StatusInternalServerError
			if errors.Is(err, service.ErrInvalidRepoURL) || errors.Is(err, service.ErrInvalidLabel) {
				status = http.StatusBadRequest
			}
			writeError(w, status, err.Error())
			return
		}

		writeJSON(w, http.StatusOK, result)
	}))
	mux.Handle("/api/v1/deploy", deployJSONHandler)
	mux.Handle("/api/deploy", deployJSONHandler)

	deploySSEHandler := authMW.RequireAuth(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			writeError(w, http.StatusMethodNotAllowed, "method not allowed")
			return
		}

		var req deployRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeError(w, http.StatusBadRequest, "invalid JSON body")
			return
		}
		if req.RepoURL == "" || req.Label == "" {
			writeError(w, http.StatusBadRequest, "repoUrl and label are required")
			return
		}

		claims, _ := auth.UserFromContext(r.Context())
		if req.GithubToken == "" && claims != nil {
			req.GithubToken = claims.GithubToken
		}

		if !tryAcquireSlot(&activeJobs, cfg.MaxConcurrentDeploys) {
			writeError(w, http.StatusTooManyRequests, "Too many concurrent deploys - try again shortly")
			return
		}
		defer atomic.AddInt32(&activeJobs, -1)

		ctx, cancel := context.WithTimeout(r.Context(), cfg.RequestTimeout)
		defer cancel()

		setupSSE(w)
		flusher, ok := w.(http.Flusher)
		if !ok {
			writeError(w, http.StatusInternalServerError, "streaming not supported")
			return
		}

		sendSSE(w, "start", map[string]any{
			"repoUrl": req.RepoURL,
			"label":   req.Label,
			"ts":      time.Now().UTC(),
		})
		flusher.Flush()

		logs := make(chan string, 128)
		outcome := make(chan deploySSEOutcome, 1)
		heartbeat := time.NewTicker(15 * time.Second)
		defer heartbeat.Stop()

		go func() {
			result, err := pipeline.RunWithLogger(ctx, service.Input{
				RepoURL:     req.RepoURL,
				Label:       req.Label,
				Meta:        req.Meta,
				GithubToken: req.GithubToken,
				DryRun:      req.DryRun,
			}, func(line string) {
				select {
				case logs <- line:
				case <-ctx.Done():
				}
			})
			outcome <- deploySSEOutcome{result: result, err: err}
		}()

		for {
			select {
			case <-ctx.Done():
				sendSSE(w, "error", map[string]any{"status": http.StatusRequestTimeout, "message": "request context ended"})
				flusher.Flush()
				return
			case t := <-heartbeat.C:
				sendSSE(w, "heartbeat", map[string]any{"ts": t.UTC()})
				flusher.Flush()
			case line := <-logs:
				sendSSE(w, "log", map[string]any{"line": line})
				flusher.Flush()
			case final := <-outcome:
				if final.err != nil {
					status := http.StatusInternalServerError
					if errors.Is(final.err, service.ErrInvalidRepoURL) || errors.Is(final.err, service.ErrInvalidLabel) {
						status = http.StatusBadRequest
					}
					sendSSE(w, "error", map[string]any{"status": status, "message": final.err.Error()})
					flusher.Flush()
					return
				}

				sendSSE(w, "done", final.result)
				flusher.Flush()
				return
			}
		}
	}))
	mux.Handle("/api/v1/deploy/stream", deploySSEHandler)
	mux.Handle("/api/deploy/stream", deploySSEHandler)

	handler := loggingMiddleware(mux)
	handler = corsMiddleware(handler)
	server := &http.Server{
		Addr:         ":" + cfg.Port,
		Handler:      handler,
		ReadTimeout:  15 * time.Second,
		WriteTimeout: cfg.RequestTimeout + 10*time.Second,
		IdleTimeout:  60 * time.Second,
	}

	go func() {
		log.Printf("backend-go listening on :%s", cfg.Port)
		if err := server.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			log.Fatalf("listen error: %v", err)
		}
	}()

	sig := make(chan os.Signal, 1)
	signal.Notify(sig, syscall.SIGINT, syscall.SIGTERM)
	<-sig

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	_ = server.Shutdown(ctx)
}

func loggingMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		next.ServeHTTP(w, r)
		log.Printf("%s %s %s", r.Method, r.URL.Path, time.Since(start))
	})
}

func corsMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Authorization, Content-Type")
		w.Header().Set("Access-Control-Max-Age", "600")

		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}

		next.ServeHTTP(w, r)
	})
}

func writeError(w http.ResponseWriter, status int, msg string) {
	writeJSON(w, status, errorResponse{Error: msg})
}

func writeJSON(w http.ResponseWriter, status int, payload any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(payload)
}

func setupSSE(w http.ResponseWriter) {
	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")
	w.Header().Set("X-Accel-Buffering", "no")
}

func sendSSE(w http.ResponseWriter, event string, data any) {
	encoded, err := json.Marshal(data)
	if err != nil {
		encoded = []byte(`{"error":"encode_failed"}`)
	}
	_, _ = fmt.Fprintf(w, "event: %s\n", event)
	_, _ = fmt.Fprintf(w, "data: %s\n\n", string(encoded))
}

func tryAcquireSlot(active *int32, max int) bool {
	if max <= 0 {
		max = 1
	}
	for {
		current := atomic.LoadInt32(active)
		if int(current) >= max {
			return false
		}
		if atomic.CompareAndSwapInt32(active, current, current+1) {
			return true
		}
	}
}
