package handlers

import (
	"net/http"

	"mingle_backend/internal/models"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

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

		var record models.UserMedia
		err := db.Where("user_id = ? AND media_id = ?", userID, input.MediaID).
			First(&record).Error

		created := false
		if err == nil {
			record.Status = input.Status
			record.Rating = input.Rating
			if err := db.Save(&record).Error; err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to save activity"})
				return
			}
		} else {
			record = models.UserMedia{
				UserID:  userID,
				MediaID: input.MediaID,
				Status:  input.Status,
				Rating:  input.Rating,
			}
			if err := db.Create(&record).Error; err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to save activity"})
				return
			}
			created = true
		}

		inc := 1.0
		if created {
			inc = 3.0
		}
		if input.Rating != nil {
			inc += 1.0
		}

		_ = db.Model(&models.MediaItem{}).
			Clauses(clause.Locking{Strength: "UPDATE"}).
			Where("id = ?", input.MediaID).
			UpdateColumn("popularity_score", gorm.Expr("COALESCE(popularity_score, 0) + ?", inc)).Error

		c.JSON(http.StatusOK, gin.H{"message": "activity saved"})
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
