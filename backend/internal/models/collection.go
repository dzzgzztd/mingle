package models

import "gorm.io/gorm"

type Collection struct {
	gorm.Model
	UserID      uint   `gorm:"index;not null"`
	Title       string `gorm:"not null"`
	Description string
}

type CollectionItem struct {
	gorm.Model
	CollectionID uint `gorm:"not null;index;uniqueIndex:ux_collection_media"`
	MediaID      uint `gorm:"not null;index;uniqueIndex:ux_collection_media"`
}
