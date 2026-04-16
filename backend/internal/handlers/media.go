package handlers

import (
	"net/http"
	"strings"

	"mingle_backend/internal/models"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

func GetMedia(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		q := strings.TrimSpace(c.Query("q"))
		typ := strings.TrimSpace(c.Query("type"))

		query := db.Model(&models.MediaItem{})

		if typ != "" {
			query = query.Where("type = ?", typ)
		}
		if q != "" {
			query = query.Where("lower(title) LIKE ?", "%"+strings.ToLower(q)+"%")
			query = query.Order("id desc")
		} else {
			query = query.Order("popularity_score DESC, id DESC")
		}

		var media []models.MediaItem
		if err := query.Limit(200).Find(&media).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to fetch media"})
			return
		}

		c.JSON(http.StatusOK, media)
	}
}

func GetMediaByID(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		id := c.Param("id")
		var item models.MediaItem

		if err := db.First(&item, id).Error; err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "not found"})
			return
		}

		c.JSON(http.StatusOK, item)
	}
}

func CreateMedia(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var input models.MediaItem
		if err := c.ShouldBindJSON(&input); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		if input.Title == "" || input.Type == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "title and type are required"})
			return
		}
		if err := db.Create(&input).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create media"})
			return
		}
		c.JSON(http.StatusCreated, input)
	}
}
