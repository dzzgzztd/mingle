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

func normalizeSearchText(s string) string {
	s = strings.ToLower(strings.TrimSpace(s))
	replacer := strings.NewReplacer(
		":", " ",
		"—", " ",
		"–", " ",
		"(", " ",
		")", " ",
		"[", " ",
		"]", " ",
		"_", " ",
	)
	s = replacer.Replace(s)
	return strings.Join(strings.Fields(s), " ")
}

func searchScore(query, title, creator string, year *int, hasImage bool) int {
	q := normalizeSearchText(query)
	t := normalizeSearchText(title)
	c := normalizeSearchText(creator)

	if q == "" || t == "" {
		return 0
	}

	score := 0

	switch {
	case t == q:
		score += 1200
	case strings.HasPrefix(t, q):
		score += 700
	case strings.Contains(t, q):
		score += 350
	}

	for _, token := range strings.Fields(q) {
		if strings.Contains(t, token) {
			score += 40
		}
		if c != "" && strings.Contains(c, token) {
			score += 15
		}
	}

	if hasImage {
		score += 35
	}
	if creator != "" {
		score += 15
	}
	if year != nil && *year >= 1950 {
		score += 5
	}

	lowTitle := strings.ToLower(title)
	if strings.Contains(lowTitle, "summary") || strings.Contains(lowTitle, "guide") || strings.Contains(lowTitle, "workbook") {
		score -= 120
	}

	return score
}

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

		src := strings.TrimSpace(c.Query("source"))
		page := 1

		var items []integrations.ExternalSearchItem

		switch src {
		case "omdb":
			res, err := omdb.Search(c.Request.Context(), q, page)
			if err != nil {
				log.Println("[external-search][omdb] error:", err)
				c.JSON(http.StatusBadGateway, gin.H{"error": err.Error()})
				return
			}
			items = append(items, res...)

		case "gbooks":
			res, err := gbooks.Search(c.Request.Context(), q, page)
			if err != nil {
				log.Println("[external-search][gbooks] error:", err)
				c.JSON(http.StatusBadGateway, gin.H{"error": err.Error()})
				return
			}
			items = append(items, res...)

		case "tgdb":
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

		sort.SliceStable(items, func(i, j int) bool {
			si := searchScore(q, items[i].Title, items[i].Creator, items[i].Year, items[i].ImageURL != "")
			sj := searchScore(q, items[j].Title, items[j].Creator, items[j].Year, items[j].ImageURL != "")
			if si != sj {
				return si > sj
			}
			return strings.ToLower(items[i].Title) < strings.ToLower(items[j].Title)
		})

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
