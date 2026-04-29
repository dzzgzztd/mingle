package main

import (
	"log"
	"os"

	"mingle_backend/internal/db"
	"mingle_backend/internal/models"
	"mingle_backend/internal/routes"
	"mingle_backend/internal/seed"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

func normalizeExistingUserRoles(database *gorm.DB) {
	if err := database.Model(&models.User{}).
		Where("role = '' OR role IS NULL").
		Update("role", string(models.RoleUser)).Error; err != nil {
		log.Println("[roles] failed to normalize empty roles:", err)
	}

	var adminCount int64
	if err := database.Model(&models.User{}).
		Where("role = ?", string(models.RoleAdmin)).
		Count(&adminCount).Error; err != nil {
		log.Println("[roles] failed to count admins:", err)
		return
	}

	if adminCount > 0 {
		return
	}

	var first models.User
	if err := database.Order("id asc").First(&first).Error; err == nil {
		if err := database.Model(&first).Update("role", string(models.RoleAdmin)).Error; err != nil {
			log.Println("[roles] failed to promote first user:", err)
		} else {
			log.Println("[roles] promoted first user to admin:", first.Email)
		}
	}
}

func main() {
	database := db.InitPostgres()

	if err := database.AutoMigrate(
		&models.User{},
		&models.MediaItem{},
		&models.MediaSubmission{},
		&models.UserMedia{},
		&models.Collection{},
		&models.CollectionItem{},
	); err != nil {
		log.Fatal("failed to migrate:", err)
	}

	normalizeExistingUserRoles(database)

	seed.ImportCatalogIfEmpty(database, "/app/seed/catalog.jsonl", 1000)

	router := gin.Default()
	routes.RegisterRoutes(router, database)

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}
	log.Println("Mingle backend started on :" + port)
	router.Run(":" + port)
}
