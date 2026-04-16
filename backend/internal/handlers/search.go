package handlers

import (
	"net/http"
	"strings"
	"time"

	"mingle_backend/internal/cache"
	"mingle_backend/internal/models"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type SearchHandler struct {
	db    *gorm.DB
	cache *cache.RedisCache
}

func NewSearchHandler(db *gorm.DB, c *cache.RedisCache) *SearchHandler {
	return &SearchHandler{db: db, cache: c}
}

func (h *SearchHandler) SearchMedia() gin.HandlerFunc {
	return func(c *gin.Context) {
		q := strings.TrimSpace(c.Query("q"))
		typ := strings.TrimSpace(c.Query("type"))

		if q == "" {
			c.JSON(http.StatusOK, []models.MediaItem{})
			return
		}

		ck := cache.SearchCacheKey(q, typ)
		var cached []models.MediaItem
		if h.cache != nil {
			ok, _ := h.cache.GetJSON(c.Request.Context(), ck, &cached)
			if ok {
				c.JSON(http.StatusOK, cached)
				return
			}
		}

		sql := `
SELECT *
FROM media_items
WHERE ($2 = '' OR type = $2)
  AND (
    to_tsvector('simple', unaccent(coalesce(title,'') || ' ' || coalesce(creator,'') || ' ' || coalesce(description,'')))
      @@ plainto_tsquery('simple', unaccent($1))
    OR title % $1
    OR creator % $1
    OR lower(description) LIKE '%' || lower($1) || '%'
  )
ORDER BY
  (
    0.7 * ts_rank(
      to_tsvector('simple', unaccent(coalesce(title,'') || ' ' || coalesce(creator,'') || ' ' || coalesce(description,''))),
      plainto_tsquery('simple', unaccent($1))
    )
    + 0.3 * GREATEST(similarity(title, $1), similarity(creator, $1))
  ) DESC,
  popularity_score DESC,
  id DESC
LIMIT 200;
`
		var out []models.MediaItem
		err := h.db.Raw(sql, q, typ).Scan(&out).Error

		if err != nil {
			like := "%" + strings.ToLower(q) + "%"
			qb := h.db.Model(&models.MediaItem{}).
				Where("(lower(title) LIKE ? OR lower(creator) LIKE ? OR lower(description) LIKE ?)", like, like, like).
				Order("id DESC").
				Limit(200)
			if typ != "" {
				qb = qb.Where("type = ?", typ)
			}
			_ = qb.Find(&out).Error
		}

		if h.cache != nil {
			_ = h.cache.SetJSON(c.Request.Context(), ck, out, 10*time.Minute)
		}

		c.JSON(http.StatusOK, out)
	}
}
