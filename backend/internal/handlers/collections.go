package handlers

import (
	"net/http"
	"strings"
	"time"

	"mingle_backend/internal/models"
	"mingle_backend/internal/services"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type collectionDTO struct {
	ID          uint      `json:"id"`
	Title       string    `json:"title"`
	Description string    `json:"description,omitempty"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

func toCollectionDTO(c models.Collection) collectionDTO {
	return collectionDTO{
		ID:          c.ID,
		Title:       c.Title,
		Description: c.Description,
		CreatedAt:   c.CreatedAt,
		UpdatedAt:   c.UpdatedAt,
	}
}

func ListCollections(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		userID := c.GetUint("user_id")

		var cols []models.Collection
		if err := db.Where("user_id = ?", userID).
			Order("updated_at desc").
			Find(&cols).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to fetch collections"})
			return
		}

		out := make([]collectionDTO, 0, len(cols))
		for _, col := range cols {
			out = append(out, toCollectionDTO(col))
		}

		c.JSON(http.StatusOK, out)
	}
}

func CreateCollection(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		userID := c.GetUint("user_id")

		var input struct {
			Title       string `json:"title" binding:"required"`
			Description string `json:"description"`
		}
		if err := c.ShouldBindJSON(&input); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		title := strings.TrimSpace(input.Title)
		if title == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "title cannot be empty"})
			return
		}

		col := models.Collection{
			UserID:      userID,
			Title:       title,
			Description: strings.TrimSpace(input.Description),
		}

		if err := db.Create(&col).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create collection"})
			return
		}

		c.JSON(http.StatusCreated, toCollectionDTO(col))
	}
}

func UpdateCollection(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		userID := c.GetUint("user_id")
		id := c.Param("id")

		var col models.Collection
		if err := db.Where("user_id = ?", userID).First(&col, id).Error; err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "not found"})
			return
		}

		var input struct {
			Title       *string `json:"title"`
			Description *string `json:"description"`
		}
		if err := c.ShouldBindJSON(&input); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		if input.Title != nil {
			t := strings.TrimSpace(*input.Title)
			if t == "" {
				c.JSON(http.StatusBadRequest, gin.H{"error": "title cannot be empty"})
				return
			}
			col.Title = t
		}

		if input.Description != nil {
			col.Description = strings.TrimSpace(*input.Description)
		}

		if err := db.Save(&col).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to update"})
			return
		}

		c.JSON(http.StatusOK, toCollectionDTO(col))
	}
}

func GetCollection(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		userID := c.GetUint("user_id")
		id := c.Param("id")

		var col models.Collection
		if err := db.Where("user_id = ?", userID).First(&col, id).Error; err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "not found"})
			return
		}

		var links []models.CollectionItem
		if err := db.Where("collection_id = ?", col.ID).Order("created_at asc").Find(&links).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to load items"})
			return
		}

		media := make([]models.MediaItem, 0, len(links))
		for _, link := range links {
			var m models.MediaItem
			if err := db.First(&m, link.MediaID).Error; err == nil {
				media = append(media, m)
			}
		}

		c.JSON(http.StatusOK, gin.H{
			"collection": toCollectionDTO(col),
			"items":      media,
		})
	}
}

func AddToCollection(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		userID := c.GetUint("user_id")
		id := c.Param("id")

		var col models.Collection
		if err := db.Where("user_id = ?", userID).First(&col, id).Error; err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "collection not found"})
			return
		}

		var input struct {
			MediaID uint `json:"media_id" binding:"required"`
		}
		if err := c.ShouldBindJSON(&input); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		var m models.MediaItem
		if err := db.First(&m, input.MediaID).Error; err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "media not found"})
			return
		}

		var existing models.CollectionItem
		err := db.Where("collection_id = ? AND media_id = ?", col.ID, input.MediaID).First(&existing).Error
		if err == nil {
			c.JSON(http.StatusOK, gin.H{"message": "already in collection"})
			return
		}
		if err != nil && err != gorm.ErrRecordNotFound {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to check existing"})
			return
		}

		it := models.CollectionItem{CollectionID: col.ID, MediaID: input.MediaID}
		if err := db.Create(&it).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to add"})
			return
		}

		c.JSON(http.StatusCreated, gin.H{"message": "added"})
	}
}

func RemoveFromCollection(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		userID := c.GetUint("user_id")
		id := c.Param("id")
		mediaID := c.Param("mediaId")

		var col models.Collection
		if err := db.Where("user_id = ?", userID).First(&col, id).Error; err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "collection not found"})
			return
		}

		res := db.Where("collection_id = ? AND media_id = ?", col.ID, mediaID).Delete(&models.CollectionItem{})
		if res.Error != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to remove"})
			return
		}
		if res.RowsAffected == 0 {
			c.JSON(http.StatusNotFound, gin.H{"error": "item not found in collection"})
			return
		}

		c.JSON(http.StatusOK, gin.H{"message": "removed"})
	}
}

func RecommendForCollection(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		userID := c.GetUint("user_id")
		id := c.Param("id")

		var col models.Collection
		if err := db.Where("user_id = ?", userID).First(&col, id).Error; err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "not found"})
			return
		}

		var items []models.CollectionItem
		db.Where("collection_id = ?", col.ID).Find(&items)
		if len(items) == 0 {
			c.JSON(http.StatusOK, gin.H{"recommendations": []any{}})
			return
		}

		history := make([]services.HistoryItem, 0, len(items))
		exclude := make([]uint, 0, len(items))

		for _, it := range items {
			var m models.MediaItem
			if err := db.First(&m, it.MediaID).Error; err == nil {
				history = append(history, services.HistoryItem{
					MediaID:     m.ID,
					Description: m.Description,
					Rating:      nil,
				})
				exclude = append(exclude, m.ID)
			}
		}

		var catalogMedia []models.MediaItem
		db.Find(&catalogMedia)

		catalog := make([]services.CatalogItem, 0, len(catalogMedia))
		for _, m := range catalogMedia {
			catalog = append(catalog, services.CatalogItem{
				MediaID:     m.ID,
				Description: m.Description,
			})
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

		out := []gin.H{}
		for _, rec := range resp.Recommendations {
			var m models.MediaItem
			if err := db.First(&m, rec.MediaID).Error; err != nil {
				continue
			}
			out = append(out, gin.H{"id": m.ID, "title": m.Title, "image_url": m.ImageURL, "score": rec.Score})
		}

		c.JSON(http.StatusOK, gin.H{"recommendations": out})
	}
}
