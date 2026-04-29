package handlers

import (
	"net/http"
	"strings"
	"time"

	"mingle_backend/internal/models"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type mediaPayload struct {
	Title       string `json:"title"`
	Description string `json:"description"`
	Type        string `json:"type"`
	Year        *int   `json:"year"`
	Creator     string `json:"creator"`
	ImageURL    string `json:"imageURL"`
}

type mediaSubmissionDTO struct {
	ID           uint                         `json:"id"`
	UserID       uint                         `json:"user_id"`
	Title        string                       `json:"title"`
	Description  string                       `json:"description"`
	Type         string                       `json:"type"`
	Year         *int                         `json:"year"`
	Creator      string                       `json:"creator"`
	ImageURL     string                       `json:"imageURL"`
	Status       models.MediaSubmissionStatus `json:"status"`
	AdminComment string                       `json:"admin_comment"`
	ReviewedBy   *uint                        `json:"reviewed_by"`
	MediaID      *uint                        `json:"media_id"`
	CreatedAt    time.Time                    `json:"created_at"`
	UpdatedAt    time.Time                    `json:"updated_at"`
}

func isAllowedMediaType(t string) bool {
	switch strings.TrimSpace(t) {
	case string(models.Movie), string(models.Series), string(models.Book), string(models.Game):
		return true
	default:
		return false
	}
}

func normalizeMediaPayload(input mediaPayload) (mediaPayload, string) {
	input.Title = strings.TrimSpace(input.Title)
	input.Description = strings.TrimSpace(input.Description)
	input.Type = strings.TrimSpace(input.Type)
	input.Creator = strings.TrimSpace(input.Creator)
	input.ImageURL = strings.TrimSpace(input.ImageURL)

	if input.Title == "" {
		return input, "title cannot be empty"
	}
	if !isAllowedMediaType(input.Type) {
		return input, "type must be one of: movie, series, book, game"
	}
	if input.Year != nil && (*input.Year < 1800 || *input.Year > 2100) {
		return input, "year must be in range 1800..2100"
	}

	return input, ""
}

func toSubmissionDTO(s models.MediaSubmission) mediaSubmissionDTO {
	return mediaSubmissionDTO{
		ID:           s.ID,
		UserID:       s.UserID,
		Title:        s.Title,
		Description:  s.Description,
		Type:         s.Type,
		Year:         s.Year,
		Creator:      s.Creator,
		ImageURL:     s.ImageURL,
		Status:       s.Status,
		AdminComment: s.AdminComment,
		ReviewedBy:   s.ReviewedBy,
		MediaID:      s.MediaID,
		CreatedAt:    s.CreatedAt,
		UpdatedAt:    s.UpdatedAt,
	}
}

func CreateMediaSubmission(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		userID := c.GetUint("user_id")

		var input mediaPayload
		if err := c.ShouldBindJSON(&input); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		input, validationErr := normalizeMediaPayload(input)
		if validationErr != "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": validationErr})
			return
		}

		submission := models.MediaSubmission{
			UserID:      userID,
			Title:       input.Title,
			Description: input.Description,
			Type:        input.Type,
			Year:        input.Year,
			Creator:     input.Creator,
			ImageURL:    input.ImageURL,
			Status:      models.MediaSubmissionPending,
		}

		if err := db.Create(&submission).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create submission"})
			return
		}

		c.JSON(http.StatusCreated, toSubmissionDTO(submission))
	}
}

func ListMyMediaSubmissions(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		userID := c.GetUint("user_id")

		var submissions []models.MediaSubmission
		if err := db.Where("user_id = ?", userID).Order("updated_at desc").Find(&submissions).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to fetch submissions"})
			return
		}

		out := make([]mediaSubmissionDTO, 0, len(submissions))
		for _, s := range submissions {
			out = append(out, toSubmissionDTO(s))
		}
		c.JSON(http.StatusOK, out)
	}
}

func ListMediaSubmissions(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		status := strings.TrimSpace(c.Query("status"))

		query := db.Model(&models.MediaSubmission{})
		if status != "" {
			query = query.Where("status = ?", status)
		}

		var submissions []models.MediaSubmission
		if err := query.Order("created_at desc").Limit(300).Find(&submissions).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to fetch submissions"})
			return
		}

		out := make([]mediaSubmissionDTO, 0, len(submissions))
		for _, s := range submissions {
			out = append(out, toSubmissionDTO(s))
		}
		c.JSON(http.StatusOK, out)
	}
}

func ApproveMediaSubmission(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		adminID := c.GetUint("user_id")
		id := c.Param("id")

		var submission models.MediaSubmission
		if err := db.First(&submission, id).Error; err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "submission not found"})
			return
		}

		if submission.Status != models.MediaSubmissionPending {
			c.JSON(http.StatusBadRequest, gin.H{"error": "submission is already reviewed"})
			return
		}

		item := models.MediaItem{
			Title:           submission.Title,
			Description:     submission.Description,
			Type:            submission.Type,
			Year:            submission.Year,
			Creator:         submission.Creator,
			ImageURL:        submission.ImageURL,
			Source:          "user_submission",
			PopularityScore: 1,
		}

		err := db.Transaction(func(tx *gorm.DB) error {
			if err := tx.Create(&item).Error; err != nil {
				return err
			}

			submission.Status = models.MediaSubmissionApproved
			submission.ReviewedBy = &adminID
			submission.MediaID = &item.ID
			return tx.Save(&submission).Error
		})
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to approve submission"})
			return
		}

		c.JSON(http.StatusOK, gin.H{"submission": toSubmissionDTO(submission), "item": item})
	}
}

func RejectMediaSubmission(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		adminID := c.GetUint("user_id")
		id := c.Param("id")

		var input struct {
			Comment string `json:"comment"`
		}
		_ = c.ShouldBindJSON(&input)

		var submission models.MediaSubmission
		if err := db.First(&submission, id).Error; err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "submission not found"})
			return
		}

		if submission.Status != models.MediaSubmissionPending {
			c.JSON(http.StatusBadRequest, gin.H{"error": "submission is already reviewed"})
			return
		}

		submission.Status = models.MediaSubmissionRejected
		submission.AdminComment = strings.TrimSpace(input.Comment)
		submission.ReviewedBy = &adminID

		if err := db.Save(&submission).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to reject submission"})
			return
		}

		c.JSON(http.StatusOK, toSubmissionDTO(submission))
	}
}

func AdminUpdateMedia(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		id := c.Param("id")

		var media models.MediaItem
		if err := db.First(&media, id).Error; err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "media not found"})
			return
		}

		var input mediaPayload
		if err := c.ShouldBindJSON(&input); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		input, validationErr := normalizeMediaPayload(input)
		if validationErr != "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": validationErr})
			return
		}

		media.Title = input.Title
		media.Description = input.Description
		media.Type = input.Type
		media.Year = input.Year
		media.Creator = input.Creator
		media.ImageURL = input.ImageURL

		if err := db.Save(&media).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to update media"})
			return
		}

		c.JSON(http.StatusOK, media)
	}
}

func AdminDeleteMedia(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		id := c.Param("id")

		res := db.Delete(&models.MediaItem{}, id)
		if res.Error != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to delete media"})
			return
		}
		if res.RowsAffected == 0 {
			c.JSON(http.StatusNotFound, gin.H{"error": "media not found"})
			return
		}

		c.JSON(http.StatusOK, gin.H{"message": "media deleted"})
	}
}
