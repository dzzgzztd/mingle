package models

import "gorm.io/gorm"

type MediaSubmissionStatus string

const (
	MediaSubmissionPending  MediaSubmissionStatus = "pending"
	MediaSubmissionApproved MediaSubmissionStatus = "approved"
	MediaSubmissionRejected MediaSubmissionStatus = "rejected"
)

type MediaSubmission struct {
	gorm.Model

	UserID uint `gorm:"not null;index" json:"user_id"`

	Title       string `gorm:"not null" json:"title"`
	Description string `json:"description"`
	Type        string `gorm:"index;not null" json:"type"`
	Year        *int   `json:"year"`
	Creator     string `json:"creator"`
	ImageURL    string `json:"imageURL"`

	Status       MediaSubmissionStatus `gorm:"type:varchar(20);not null;default:'pending';index" json:"status"`
	AdminComment string                `json:"admin_comment"`
	ReviewedBy   *uint                 `json:"reviewed_by"`
	MediaID      *uint                 `json:"media_id"`
}
