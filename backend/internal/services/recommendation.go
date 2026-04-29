package services

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"mingle_backend/internal/config"
)

type HistoryItem struct {
	MediaID     uint   `json:"media_id"`
	Title       string `json:"title,omitempty"`
	Description string `json:"description"`
	Type        string `json:"type,omitempty"`
	Creator     string `json:"creator,omitempty"`
	Year        *int   `json:"year,omitempty"`
	Rating      *int   `json:"rating"`
}

type CatalogItem struct {
	MediaID     uint   `json:"media_id"`
	Title       string `json:"title,omitempty"`
	Description string `json:"description"`
	Type        string `json:"type,omitempty"`
	Creator     string `json:"creator,omitempty"`
	Year        *int   `json:"year,omitempty"`
}

type RecommendationRequest struct {
	UserID      uint          `json:"user_id"`
	UserHistory []HistoryItem `json:"user_history"`
	Catalog     []CatalogItem `json:"catalog"`
	Limit       int           `json:"limit"`
	ExcludeIDs  []uint        `json:"exclude_ids,omitempty"`
}

type RecommendationResultItem struct {
	MediaID uint    `json:"media_id"`
	Score   float64 `json:"score"`
}

type RecommendationResponse struct {
	Recommendations []RecommendationResultItem `json:"recommendations"`
}

func GetRecommendations(req RecommendationRequest) (RecommendationResponse, error) {
	url := config.RecommendationURL()

	body, err := json.Marshal(req)
	if err != nil {
		return RecommendationResponse{}, err
	}

	httpClient := &http.Client{Timeout: 7 * time.Second}

	hreq, _ := http.NewRequest(http.MethodPost, url, bytes.NewReader(body))
	hreq.Header.Set("Content-Type", "application/json")

	resp, err := httpClient.Do(hreq)
	if err != nil {
		return RecommendationResponse{}, err
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return RecommendationResponse{}, fmt.Errorf("recommendation service status: %d", resp.StatusCode)
	}

	var out RecommendationResponse
	if err := json.NewDecoder(resp.Body).Decode(&out); err != nil {
		return RecommendationResponse{}, err
	}
	return out, nil
}
