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

func mediaToHistoryItem(media models.MediaItem, rating *int) services.HistoryItem {
	return services.HistoryItem{
		MediaID:     media.ID,
		Title:       media.Title,
		Description: media.Description,
		Type:        media.Type,
		Creator:     media.Creator,
		Year:        media.Year,
		Rating:      rating,
	}
}

func mediaToCatalogItem(media models.MediaItem) services.CatalogItem {
	return services.CatalogItem{
		MediaID:     media.ID,
		Title:       media.Title,
		Description: media.Description,
		Type:        media.Type,
		Creator:     media.Creator,
		Year:        media.Year,
	}
}

func recommendationDTOFromMedia(media models.MediaItem, score float64) RecommendationDTO {
	return RecommendationDTO{
		ID:       media.ID,
		Title:    media.Title,
		ImageURL: media.ImageURL,
		Score:    score,
	}
}

func idsFromSet(set map[uint]bool) []uint {
	out := make([]uint, 0, len(set))
	for id := range set {
		out = append(out, id)
	}
	return out
}

func loadCatalogItems(db *gorm.DB) ([]services.CatalogItem, error) {
	var catalogMedia []models.MediaItem
	if err := db.Find(&catalogMedia).Error; err != nil {
		return nil, err
	}

	catalog := make([]services.CatalogItem, 0, len(catalogMedia))
	for _, m := range catalogMedia {
		catalog = append(catalog, mediaToCatalogItem(m))
	}

	return catalog, nil
}

func loadUserActivity(db *gorm.DB, userID uint) ([]models.UserMedia, error) {
	var activity []models.UserMedia
	if err := db.Where("user_id = ?", userID).Find(&activity).Error; err != nil {
		return nil, err
	}
	return activity, nil
}

func recommendationsToDTO(db *gorm.DB, resp services.RecommendationResponse) []RecommendationDTO {
	result := make([]RecommendationDTO, 0, len(resp.Recommendations))

	for _, rec := range resp.Recommendations {
		var media models.MediaItem
		if err := db.First(&media, rec.MediaID).Error; err != nil {
			continue
		}
		result = append(result, recommendationDTOFromMedia(media, rec.Score))
	}

	return result
}

func GetRecommendations(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		userID := c.GetUint("user_id")

		activity, err := loadUserActivity(db, userID)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to load user activity"})
			return
		}

		if len(activity) == 0 {
			c.JSON(http.StatusOK, gin.H{"recommendations": []any{}})
			return
		}

		history := make([]services.HistoryItem, 0, len(activity))
		excludeSet := make(map[uint]bool)

		for _, a := range activity {
			excludeSet[a.MediaID] = true

			var media models.MediaItem
			if err := db.First(&media, a.MediaID).Error; err == nil {
				history = append(history, mediaToHistoryItem(media, a.Rating))
			}
		}

		if len(history) == 0 {
			c.JSON(http.StatusOK, gin.H{"recommendations": []any{}})
			return
		}

		catalog, err := loadCatalogItems(db)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to load catalog"})
			return
		}

		resp, err := services.GetRecommendations(services.RecommendationRequest{
			UserID:      userID,
			UserHistory: history,
			Catalog:     catalog,
			Limit:       10,
			ExcludeIDs:  idsFromSet(excludeSet),
		})
		if err != nil {
			c.JSON(http.StatusBadGateway, gin.H{"error": "recommendation service unavailable"})
			return
		}

		c.JSON(http.StatusOK, gin.H{"recommendations": recommendationsToDTO(db, resp)})
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

		excludeSet := map[uint]bool{
			target.ID: true,
		}

		activity, err := loadUserActivity(db, userID)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to load user activity"})
			return
		}

		for _, a := range activity {
			excludeSet[a.MediaID] = true
		}

		catalog, err := loadCatalogItems(db)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to load catalog"})
			return
		}

		resp, err := services.GetRecommendations(services.RecommendationRequest{
			UserID:      userID,
			UserHistory: []services.HistoryItem{mediaToHistoryItem(target, nil)},
			Catalog:     catalog,
			Limit:       10,
			ExcludeIDs:  idsFromSet(excludeSet),
		})
		if err != nil {
			c.JSON(http.StatusBadGateway, gin.H{"error": "recommendation service unavailable"})
			return
		}

		c.JSON(http.StatusOK, gin.H{"recommendations": recommendationsToDTO(db, resp)})
	}
}
