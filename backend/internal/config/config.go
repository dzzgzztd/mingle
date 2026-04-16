package config

import "os"

func JWTSecret() string {
	secret := os.Getenv("JWT_SECRET")
	if secret == "" {
		secret = "super-secret-key"
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
