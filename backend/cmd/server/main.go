package main

import (
	"log"
	"os"

	"mingle_backend/internal/db"
	"mingle_backend/internal/models"
	"mingle_backend/internal/routes"
	"mingle_backend/internal/seed"

	"github.com/gin-gonic/gin"
)

func main() {
	database := db.InitPostgres()

	if err := database.AutoMigrate(
		&models.User{},
		&models.MediaItem{},
		&models.UserMedia{},
		&models.Collection{},
		&models.CollectionItem{},
	); err != nil {
		log.Fatal("failed to migrate:", err)
	}

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
