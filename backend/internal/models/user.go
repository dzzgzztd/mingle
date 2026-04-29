package models

import "gorm.io/gorm"

type UserRole string

const (
	RoleUser  UserRole = "user"
	RoleAdmin UserRole = "admin"
)

type User struct {
	gorm.Model
	Email     string   `gorm:"uniqueIndex;not null" json:"email"`
	Password  string   `gorm:"not null" json:"-"`
	Name      string   `json:"name"`
	AvatarURL string   `json:"avatar_url"`
	Role      UserRole `gorm:"type:varchar(20);not null;default:'user';index" json:"role"`
}
