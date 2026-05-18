package config

import (
	"log"
	"os"
	"strings"
)

func JWTSecret() string {
	secret := strings.TrimSpace(os.Getenv("JWT_SECRET"))
	if secret == "" {
		log.Fatal("JWT_SECRET environment variable is required")
	}
	if len(secret) < 32 {
		log.Fatal("JWT_SECRET must be at least 32 characters")
	}
	return secret
}

func RecommendationURL() string {
	url := os.Getenv("RECOMMENDATION_URL")
	if url == "" {
		url = "http://recommendation:8000/recommend"
	}
	return url
}
