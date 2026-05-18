package main

import (
	"log"
	"mingle_backend/seed"
	"os"

	"mingle_backend/internal/config"
	"mingle_backend/internal/db"
	"mingle_backend/internal/models"
	"mingle_backend/internal/routes"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

func normalizeExistingUserRoles(database *gorm.DB) {
	if err := database.Model(&models.User{}).
		Where("role = '' OR role IS NULL").
		Update("role", string(models.RoleUser)).Error; err != nil {
		log.Println("[roles] failed to normalize empty roles:", err)
	}
}

func ensurePostgresSetup(database *gorm.DB) {
	statements := []string{
		`CREATE EXTENSION IF NOT EXISTS unaccent`,
		`CREATE EXTENSION IF NOT EXISTS pg_trgm`,
		`
		CREATE UNIQUE INDEX IF NOT EXISTS ux_media_source_external_not_empty
		ON media_items(source, external_id)
		WHERE deleted_at IS NULL
		  AND source <> ''
		  AND external_id <> ''
		`,
	}

	for _, stmt := range statements {
		if err := database.Exec(stmt).Error; err != nil {
			log.Println("[db setup] failed:", err)
		}
	}
}

func main() {
	_ = config.JWTSecret()

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

	ensurePostgresSetup(database)

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
