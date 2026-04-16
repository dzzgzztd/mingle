package models

import (
	"time"

	"gorm.io/datatypes"
	"gorm.io/gorm"
)

type MediaType string

const (
	Movie  MediaType = "movie"
	Series MediaType = "series"
	Book   MediaType = "book"
	Game   MediaType = "game"
)

type MediaItem struct {
	ID        uint           `gorm:"primaryKey" json:"id"`
	CreatedAt time.Time      `json:"-"`
	UpdatedAt time.Time      `json:"-"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`

	Title       string `gorm:"not null" json:"title"`
	Description string `json:"description"`
	Type        string `gorm:"index;not null" json:"type"`
	Year        *int   `json:"year"`
	Creator     string `json:"creator"`
	ImageURL    string `json:"imageURL"`

	Source     string `json:"source"`
	ExternalID string `json:"externalId"`

	NormalizedTitle string  `gorm:"index" json:"normalizedTitle"`
	PopularityScore float64 `gorm:"index" json:"popularityScore"`

	Metadata datatypes.JSON `gorm:"type:jsonb" json:"metadata"`
	RawData  datatypes.JSON `gorm:"type:jsonb" json:"rawData"`
}
