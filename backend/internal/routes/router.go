package routes

import (
	"mingle_backend/internal/cache"
	"mingle_backend/internal/handlers"
	"mingle_backend/internal/middleware"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

func RegisterRoutes(r *gin.Engine, db *gorm.DB) {
	r.Use(cors.New(cors.Config{
		AllowOrigins: []string{
			"http://localhost:5173",
			"http://127.0.0.1:5173",
			"http://localhost:3000",
			"http://127.0.0.1:3000",
		},
		AllowMethods:     []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"},
		AllowHeaders:     []string{"Authorization", "Content-Type"},
		ExposeHeaders:    []string{"Content-Length"},
		AllowCredentials: true,
	}))

	api := r.Group("/api")

	api.POST("/auth/register", handlers.Register(db))
	api.POST("/auth/login", handlers.Login(db))

	api.GET("/media", handlers.GetMedia(db))
	api.GET("/media/:id", handlers.GetMediaByID(db))

	protected := api.Group("/")
	protected.Use(middleware.AuthRequired())

	protected.GET("/profile", handlers.GetProfile(db))
	protected.PATCH("/profile", handlers.UpdateProfile(db))

	protected.POST("/media", handlers.CreateMedia(db))

	protected.POST("/activity", handlers.UpsertUserMedia(db))
	protected.GET("/activity", handlers.GetUserActivity(db))
	protected.DELETE("/activity/:mediaId", handlers.DeleteUserMedia(db))

	protected.GET("/recommendations", handlers.GetRecommendations(db))
	protected.GET("/media/:id/recommendations", handlers.GetRecommendationsForMedia(db))

	c := cache.NewRedisCacheFromEnv()
	searchHandler := handlers.NewSearchHandler(db, c)
	api.GET("/search", searchHandler.SearchMedia())

	protected.GET("/collections", handlers.ListCollections(db))
	protected.POST("/collections", handlers.CreateCollection(db))
	protected.GET("/collections/:id", handlers.GetCollection(db))
	protected.PATCH("/collections/:id", handlers.UpdateCollection(db))

	protected.POST("/collections/:id/items", handlers.AddToCollection(db))
	protected.DELETE("/collections/:id/items/:mediaId", handlers.RemoveFromCollection(db))
	protected.GET("/collections/:id/recommendations", handlers.RecommendForCollection(db))

	api.GET("/external/search", handlers.ExternalSearch(db))
	api.POST("/external/import", handlers.ExternalImport(db))
}
