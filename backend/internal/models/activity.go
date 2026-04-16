package models

import "gorm.io/gorm"

type UserMedia struct {
	gorm.Model `json:"-"`

	UserID  uint `gorm:"not null;index:ux_user_media,unique" json:"user_id"`
	MediaID uint `gorm:"not null;index:ux_user_media,unique" json:"media_id"`

	// status:
	// movies/series: viewed|watching|will_watch
	// books: read|reading|will_read
	// games: completed|playing|will_play
	Status string `gorm:"index" json:"status"`

	// 1–10
	Rating *int `json:"rating"`
}
