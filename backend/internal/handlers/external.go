package handlers

import (
	"log"
	"net/http"
	"sort"
	"strings"

	"mingle_backend/internal/integrations"
	"mingle_backend/internal/models"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

func ExternalSearch(db *gorm.DB) gin.HandlerFunc {
	omdb := integrations.NewOMDb()
	gbooks := integrations.NewGBooks()
	tgdb := integrations.NewTGDB()

	return func(c *gin.Context) {
		q := strings.TrimSpace(c.Query("q"))
		if q == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "q is required"})
			return
		}

		typ := strings.TrimSpace(c.Query("type"))
		src := strings.TrimSpace(c.Query("source"))
		page := 1

		var items []integrations.ExternalSearchItem

		switch {
		case src == "omdb":
			res, err := omdb.Search(c.Request.Context(), q, page)
			if err != nil {
				log.Println("[external-search][omdb] error:", err)
				c.JSON(http.StatusBadGateway, gin.H{"error": err.Error()})
				return
			}
			items = append(items, res...)

		case src == "gbooks":
			res, err := gbooks.Search(c.Request.Context(), q, page)
			if err != nil {
				log.Println("[external-search][gbooks] error:", err)
				c.JSON(http.StatusBadGateway, gin.H{"error": err.Error()})
				return
			}
			items = append(items, res...)

		case src == "tgdb":
			res, err := tgdb.Search(c.Request.Context(), q, page)
			if err != nil {
				log.Println("[external-search][tgdb] error:", err)
				c.JSON(http.StatusBadGateway, gin.H{"error": err.Error()})
				return
			}
			items = append(items, res...)

		case typ == "movie" || typ == "series":
			res, err := omdb.Search(c.Request.Context(), q, page)
			if err != nil {
				log.Println("[external-search][omdb] error:", err)
				c.JSON(http.StatusBadGateway, gin.H{"error": err.Error()})
				return
			}
			items = append(items, res...)

		case typ == "book":
			res, err := gbooks.Search(c.Request.Context(), q, page)
			if err != nil {
				log.Println("[external-search][gbooks] error:", err)
				c.JSON(http.StatusBadGateway, gin.H{"error": err.Error()})
				return
			}
			items = append(items, res...)

		case typ == "game":
			res, err := tgdb.Search(c.Request.Context(), q, page)
			if err != nil {
				log.Println("[external-search][tgdb] error:", err)
				c.JSON(http.StatusBadGateway, gin.H{"error": err.Error()})
				return
			}
			items = append(items, res...)

		default:
			if res, err := omdb.Search(c.Request.Context(), q, page); err == nil {
				items = append(items, res...)
			} else {
				log.Println("[external-search][omdb] error:", err)
			}

			if res, err := gbooks.Search(c.Request.Context(), q, page); err == nil {
				items = append(items, res...)
			} else {
				log.Println("[external-search][gbooks] error:", err)
			}

			if res, err := tgdb.Search(c.Request.Context(), q, page); err == nil {
				items = append(items, res...)
			} else {
				log.Println("[external-search][tgdb] error:", err)
			}
		}

		if typ != "" {
			filtered := make([]integrations.ExternalSearchItem, 0, len(items))
			for _, it := range items {
				if it.Type == typ {
					filtered = append(filtered, it)
				}
			}
			items = filtered
		}

		if typ == "" {
			typeRank := func(t string) int {
				switch t {
				case "movie":
					return 1
				case "series":
					return 2
				case "book":
					return 3
				case "game":
					return 4
				default:
					return 10
				}
			}

			sort.SliceStable(items, func(i, j int) bool {
				ri := typeRank(items[i].Type)
				rj := typeRank(items[j].Type)
				if ri != rj {
					return ri < rj
				}
				return strings.ToLower(items[i].Title) < strings.ToLower(items[j].Title)
			})
		}

		c.JSON(http.StatusOK, gin.H{"items": items})
	}
}

func ExternalImport(db *gorm.DB) gin.HandlerFunc {
	omdb := integrations.NewOMDb()
	gbooks := integrations.NewGBooks()
	tgdb := integrations.NewTGDB()

	return func(c *gin.Context) {
		var req struct {
			Source     string `json:"source" binding:"required"`
			ExternalID string `json:"externalId" binding:"required"`
		}
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		var details integrations.ExternalDetails
		var err error

		switch req.Source {
		case "omdb":
			details, err = omdb.GetByID(c.Request.Context(), req.ExternalID)
		case "gbooks":
			details, err = gbooks.GetByID(c.Request.Context(), req.ExternalID)
		case "tgdb":
			details, err = tgdb.GetByID(c.Request.Context(), req.ExternalID)
		default:
			c.JSON(http.StatusBadRequest, gin.H{"error": "unknown source"})
			return
		}
		if err != nil {
			c.JSON(http.StatusBadGateway, gin.H{"error": err.Error()})
			return
		}

		var existing models.MediaItem
		if err := db.Where("source = ? AND external_id = ?", req.Source, req.ExternalID).First(&existing).Error; err == nil {
			if strings.TrimSpace(details.Title) != "" {
				existing.Title = details.Title
			}
			if strings.TrimSpace(details.Description) != "" {
				existing.Description = details.Description
			}
			if strings.TrimSpace(details.Type) != "" {
				existing.Type = details.Type
			}
			if details.Year != nil {
				existing.Year = details.Year
			}
			if strings.TrimSpace(details.Creator) != "" {
				existing.Creator = details.Creator
			}
			if strings.TrimSpace(details.ImageURL) != "" {
				existing.ImageURL = details.ImageURL
			}

			if err := db.Save(&existing).Error; err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to update existing media"})
				return
			}

			c.JSON(http.StatusOK, gin.H{"mediaId": existing.ID, "item": existing})
			return
		}

		item := models.MediaItem{
			Title:           details.Title,
			Description:     details.Description,
			Type:            details.Type,
			Year:            details.Year,
			Creator:         details.Creator,
			ImageURL:        details.ImageURL,
			Source:          details.Source,
			ExternalID:      details.ExternalID,
			PopularityScore: 10,
		}

		if err := db.Create(&item).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to save media"})
			return
		}

		c.JSON(http.StatusCreated, gin.H{"mediaId": item.ID, "item": item})
	}
}
