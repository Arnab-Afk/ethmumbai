package config

import (
	"fmt"
	"math/big"
	"os"
	"strconv"
	"time"

	"github.com/joho/godotenv"
)

type Config struct {
	Port                    string
	JWTSecret               string
	SepoliaRPCURL           string
	PrivateKey              string
	SubnameRegistryContract string
	PinataJWT               string
	DockerImage             string
	MaxConcurrentDeploys    int
	ChainID                 *big.Int
	CloneTimeout            time.Duration
	BuildTimeout            time.Duration
	IPFSTimeout             time.Duration
	TxTimeout               time.Duration
	RequestTimeout          time.Duration
}

func Load() (Config, error) {
	_ = godotenv.Load()

	cfg := Config{
		Port:                    envOr("PORT", "3002"),
		JWTSecret:               os.Getenv("JWT_SECRET"),
		SepoliaRPCURL:           os.Getenv("SEPOLIA_RPC_URL"),
		PrivateKey:              os.Getenv("PRIVATE_KEY"),
		SubnameRegistryContract: os.Getenv("SUBNAME_REGISTRY_CONTRACT"),
		PinataJWT:               os.Getenv("PINATA_JWT"),
		DockerImage:             envOr("DOCKER_IMAGE", "alpine/git:2.47.2"),
		MaxConcurrentDeploys:    intEnv("MAX_CONCURRENT_DEPLOYS", 3),
		CloneTimeout:            secondsEnv("CLONE_TIMEOUT_SECONDS", 300),
		BuildTimeout:            secondsEnv("BUILD_TIMEOUT_SECONDS", 1800),
		IPFSTimeout:             secondsEnv("IPFS_TIMEOUT_SECONDS", 300),
		TxTimeout:               secondsEnv("TX_TIMEOUT_SECONDS", 180),
	}
	cfg.RequestTimeout = cfg.CloneTimeout + cfg.BuildTimeout + cfg.IPFSTimeout + cfg.TxTimeout + 30*time.Second

	if cfg.JWTSecret == "" {
		return Config{}, fmt.Errorf("JWT_SECRET is required")
	}
	if cfg.SepoliaRPCURL == "" {
		return Config{}, fmt.Errorf("SEPOLIA_RPC_URL is required")
	}
	if cfg.PrivateKey == "" {
		return Config{}, fmt.Errorf("PRIVATE_KEY is required")
	}
	if cfg.SubnameRegistryContract == "" {
		return Config{}, fmt.Errorf("SUBNAME_REGISTRY_CONTRACT is required")
	}
	if cfg.PinataJWT == "" {
		return Config{}, fmt.Errorf("PINATA_JWT is required")
	}

	chainIDRaw := envOr("CHAIN_ID", "11155111")
	chainID, ok := new(big.Int).SetString(chainIDRaw, 10)
	if !ok {
		return Config{}, fmt.Errorf("invalid CHAIN_ID: %s", chainIDRaw)
	}
	cfg.ChainID = chainID

	return cfg, nil
}

func envOr(key, fallback string) string {
	v := os.Getenv(key)
	if v == "" {
		return fallback
	}
	return v
}

func secondsEnv(key string, fallback int) time.Duration {
	raw := envOr(key, strconv.Itoa(fallback))
	n, err := strconv.Atoi(raw)
	if err != nil || n <= 0 {
		n = fallback
	}
	return time.Duration(n) * time.Second
}

func intEnv(key string, fallback int) int {
	raw := envOr(key, strconv.Itoa(fallback))
	n, err := strconv.Atoi(raw)
	if err != nil || n <= 0 {
		return fallback
	}
	return n
}
