package handlers

import (
	"net/http"

	"mingle_backend/internal/models"
	"mingle_backend/internal/services"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type RecommendationDTO struct {
	ID       uint    `json:"id"`
	Title    string  `json:"title"`
	ImageURL string  `json:"image_url"`
	Score    float64 `json:"score"`
}

func GetRecommendations(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		userID := c.GetUint("user_id")

		var activity []models.UserMedia
		if err := db.Where("user_id = ? AND rating IS NOT NULL", userID).Find(&activity).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to load user activity"})
			return
		}

		if len(activity) == 0 {
			c.JSON(http.StatusOK, gin.H{"recommendations": []any{}})
			return
		}

		history := []services.HistoryItem{}
		exclude := []uint{}
		for _, a := range activity {
			var media models.MediaItem
			if err := db.First(&media, a.MediaID).Error; err == nil {
				history = append(history, services.HistoryItem{
					MediaID:     media.ID,
					Description: media.Description,
					Rating:      a.Rating,
				})
				exclude = append(exclude, media.ID)
			}
		}

		var catalogMedia []models.MediaItem
		db.Find(&catalogMedia)
		catalog := []services.CatalogItem{}
		for _, m := range catalogMedia {
			catalog = append(catalog, services.CatalogItem{MediaID: m.ID, Description: m.Description})
		}

		resp, err := services.GetRecommendations(services.RecommendationRequest{
			UserID:      userID,
			UserHistory: history,
			Catalog:     catalog,
			Limit:       10,
			ExcludeIDs:  exclude,
		})
		if err != nil {
			c.JSON(http.StatusBadGateway, gin.H{"error": "recommendation service unavailable"})
			return
		}

		result := []RecommendationDTO{}
		for _, rec := range resp.Recommendations {
			var media models.MediaItem
			if err := db.First(&media, rec.MediaID).Error; err != nil {
				continue
			}
			result = append(result, RecommendationDTO{ID: media.ID, Title: media.Title, ImageURL: media.ImageURL, Score: rec.Score})
		}

		c.JSON(http.StatusOK, gin.H{"recommendations": result})
	}
}

func GetRecommendationsForMedia(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		userID := c.GetUint("user_id")
		id := c.Param("id")

		var target models.MediaItem
		if err := db.First(&target, id).Error; err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "not found"})
			return
		}

		history := []services.HistoryItem{{MediaID: target.ID, Description: target.Description, Rating: nil}}
		exclude := []uint{target.ID}

		var catalogMedia []models.MediaItem
		db.Find(&catalogMedia)
		catalog := []services.CatalogItem{}
		for _, m := range catalogMedia {
			catalog = append(catalog, services.CatalogItem{MediaID: m.ID, Description: m.Description})
		}

		resp, err := services.GetRecommendations(services.RecommendationRequest{
			UserID:      userID,
			UserHistory: history,
			Catalog:     catalog,
			Limit:       10,
			ExcludeIDs:  exclude,
		})
		if err != nil {
			c.JSON(http.StatusBadGateway, gin.H{"error": "recommendation service unavailable"})
			return
		}

		result := []RecommendationDTO{}
		for _, rec := range resp.Recommendations {
			var media models.MediaItem
			if err := db.First(&media, rec.MediaID).Error; err != nil { continue }
			result = append(result, RecommendationDTO{ID: media.ID, Title: media.Title, ImageURL: media.ImageURL, Score: rec.Score})
		}
		c.JSON(http.StatusOK, gin.H{"recommendations": result})
	}
}
