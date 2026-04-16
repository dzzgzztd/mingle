package handlers

import (
	"net/http"
	"strings"

	"mingle_backend/internal/models"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

func allowedStatusesForType(mediaType string) map[string]bool {
	switch mediaType {
	case "movie", "series":
		return map[string]bool{
			"viewed":     true,
			"will_watch": true,
		}
	case "book":
		return map[string]bool{
			"read":      true,
			"will_read": true,
		}
	case "game":
		return map[string]bool{
			"completed": true,
			"will_play": true,
		}
	default:
		return map[string]bool{}
	}
}

func defaultStatusForType(mediaType string) string {
	switch mediaType {
	case "movie", "series":
		return "viewed"
	case "book":
		return "read"
	case "game":
		return "completed"
	default:
		return ""
	}
}

func UpsertUserMedia(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		userID := c.GetUint("user_id")

		var input struct {
			MediaID uint   `json:"media_id" binding:"required"`
			Status  string `json:"status"`
			Rating  *int   `json:"rating"`
		}

		if err := c.ShouldBindJSON(&input); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		var media models.MediaItem
		if err := db.First(&media, input.MediaID).Error; err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "media not found"})
			return
		}

		status := strings.TrimSpace(input.Status)
		if status == "" {
			status = defaultStatusForType(media.Type)
		}

		allowed := allowedStatusesForType(media.Type)
		if status != "" && !allowed[status] {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid status for media type"})
			return
		}

		if input.Rating != nil {
			if *input.Rating < 1 || *input.Rating > 10 {
				c.JSON(http.StatusBadRequest, gin.H{"error": "rating must be in range 1..10"})
				return
			}
		}

		var record models.UserMedia
		err := db.Where("user_id = ? AND media_id = ?", userID, input.MediaID).
			First(&record).Error

		if err == nil {
			record.Status = status
			record.Rating = input.Rating
			if err := db.Save(&record).Error; err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to save activity"})
				return
			}
		} else {
			record = models.UserMedia{
				UserID:  userID,
				MediaID: input.MediaID,
				Status:  status,
				Rating:  input.Rating,
			}
			if err := db.Create(&record).Error; err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create activity"})
				return
			}
		}

		c.JSON(http.StatusOK, gin.H{
			"message": "activity saved",
			"item":    record,
		})
	}
}

func GetUserActivity(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		userID := c.GetUint("user_id")

		var activity []models.UserMedia
		if err := db.Where("user_id = ?", userID).Order("updated_at desc").Find(&activity).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to fetch activity"})
			return
		}

		c.JSON(http.StatusOK, activity)
	}
}

func DeleteUserMedia(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		userID := c.GetUint("user_id")
		mediaID := c.Param("mediaId")

		res := db.Where("user_id = ? AND media_id = ?", userID, mediaID).Delete(&models.UserMedia{})
		if res.Error != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to delete activity"})
			return
		}
		if res.RowsAffected == 0 {
			c.JSON(http.StatusNotFound, gin.H{"error": "activity not found"})
			return
		}

		c.JSON(http.StatusOK, gin.H{"message": "activity deleted"})
	}
}
