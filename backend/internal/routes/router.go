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

	c := cache.NewRedisCacheFromEnv()
	searchHandler := handlers.NewSearchHandler(db, c)
	api.GET("/search", searchHandler.SearchMedia())

	api.GET("/external/search", handlers.ExternalSearch(db))
	api.POST("/external/import", handlers.ExternalImport(db))

	protected := api.Group("/")
	protected.Use(middleware.AuthRequired())

	protected.GET("/profile", handlers.GetProfile(db))
	protected.PATCH("/profile", handlers.UpdateProfile(db))

	protected.POST("/media", handlers.CreateMediaSubmission(db))
	protected.POST("/media/submissions", handlers.CreateMediaSubmission(db))
	protected.GET("/submissions/media/my", handlers.ListMyMediaSubmissions(db))

	protected.POST("/activity", handlers.UpsertUserMedia(db))
	protected.GET("/activity", handlers.GetUserActivity(db))
	protected.DELETE("/activity/:mediaId", handlers.DeleteUserMedia(db))

	protected.GET("/recommendations", handlers.GetRecommendations(db))
	protected.GET("/media/:id/recommendations", handlers.GetRecommendationsForMedia(db))

	protected.GET("/collections", handlers.ListCollections(db))
	protected.POST("/collections", handlers.CreateCollection(db))
	protected.GET("/collections/:id", handlers.GetCollection(db))
	protected.PATCH("/collections/:id", handlers.UpdateCollection(db))

	protected.POST("/collections/:id/items", handlers.AddToCollection(db))
	protected.DELETE("/collections/:id/items/:mediaId", handlers.RemoveFromCollection(db))
	protected.GET("/collections/:id/recommendations", handlers.RecommendForCollection(db))

	admin := protected.Group("/admin")
	admin.Use(middleware.AdminRequired(db))
	admin.GET("/submissions/media", handlers.ListMediaSubmissions(db))
	admin.POST("/submissions/media/:id/approve", handlers.ApproveMediaSubmission(db))
	admin.POST("/submissions/media/:id/reject", handlers.RejectMediaSubmission(db))
	admin.PATCH("/media/:id", handlers.AdminUpdateMedia(db))
	admin.DELETE("/media/:id", handlers.AdminDeleteMedia(db))
}
