package handlers

import (
	"net/http"
	"strings"
	"time"

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

type activityDTO struct {
	ID        uint      `json:"id"`
	MediaID   uint      `json:"media_id"`
	Status    string    `json:"status"`
	Rating    *int      `json:"rating"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

func toActivityDTO(a models.UserMedia) activityDTO {
	return activityDTO{
		ID:        a.ID,
		MediaID:   a.MediaID,
		Status:    a.Status,
		Rating:    a.Rating,
		CreatedAt: a.CreatedAt,
		UpdatedAt: a.UpdatedAt,
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
		if status == "" || !allowed[status] {
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

		err := db.Unscoped().
			Where("user_id = ? AND media_id = ?", userID, input.MediaID).
			First(&record).Error

		if err == nil {
			updates := map[string]any{
				"status":     status,
				"deleted_at": nil,
				"updated_at": time.Now(),
			}

			if input.Rating == nil {
				updates["rating"] = nil
			} else {
				updates["rating"] = *input.Rating
			}

			if err := db.Unscoped().
				Model(&record).
				Updates(updates).Error; err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to save activity"})
				return
			}

			if err := db.First(&record, record.ID).Error; err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to reload activity"})
				return
			}
		} else if err == gorm.ErrRecordNotFound {
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
		} else {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to check activity"})
			return
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
		if err := db.Where("user_id = ?", userID).
			Order("updated_at desc, id desc").
			Find(&activity).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to fetch activity"})
			return
		}

		out := make([]activityDTO, 0, len(activity))
		for _, a := range activity {
			out = append(out, toActivityDTO(a))
		}

		c.JSON(http.StatusOK, out)
	}
}

func DeleteUserMedia(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		userID := c.GetUint("user_id")
		mediaID := c.Param("mediaId")

		res := db.Unscoped().
			Where("user_id = ? AND media_id = ?", userID, mediaID).
			Delete(&models.UserMedia{})

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
