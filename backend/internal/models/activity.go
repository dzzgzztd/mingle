package models

import "gorm.io/gorm"

type UserMedia struct {
	gorm.Model `json:"-"`

	UserID  uint `gorm:"not null;index:ux_user_media,unique" json:"user_id"`
	MediaID uint `gorm:"not null;index:ux_user_media,unique" json:"media_id"`

	Status string `gorm:"index" json:"status"`

	Rating *int `json:"rating"`
}
