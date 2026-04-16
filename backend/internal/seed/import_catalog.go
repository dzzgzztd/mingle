package seed

import (
	"bufio"
	"encoding/json"
	"log"
	"os"

	"mingle_backend/internal/models"

	"gorm.io/gorm"
)

type catalogRow struct {
	Type        string `json:"type"` // movie|series|book|game
	Title       string `json:"title"`
	Year        *int   `json:"year"`
	Creator     string `json:"creator"`
	Description string `json:"description"`
	ImageURL    string `json:"imageURL"`

	Source     string `json:"source,omitempty"`
	ExternalID string `json:"externalId,omitempty"`
}

func ImportCatalogIfEmpty(db *gorm.DB, path string, batchSize int) {
	var total int64
	db.Model(&models.MediaItem{}).Count(&total)
	if total > 0 {
		log.Println("[catalog] media_items not empty -> skip import")
		return
	}

	f, err := os.Open(path)
	if err != nil {
		log.Println("[catalog] cannot open:", path, "err:", err)
		return
	}
	defer f.Close()

	log.Println("[catalog] importing from", path)

	sc := bufio.NewScanner(f)
	buf := make([]byte, 0, 1024*1024)
	sc.Buffer(buf, 10*1024*1024)

	batch := make([]models.MediaItem, 0, batchSize)
	inserted := 0

	flush := func() {
		if len(batch) == 0 {
			return
		}
		if err := db.Create(&batch).Error; err != nil {
			log.Println("[catalog] batch insert error:", err)
			return
		}
		inserted += len(batch)
		batch = batch[:0]
	}

	for sc.Scan() {
		line := sc.Bytes()
		var r catalogRow
		if err := json.Unmarshal(line, &r); err != nil {
			continue
		}
		if r.Type == "" || r.Title == "" {
			continue
		}

		batch = append(batch, models.MediaItem{
			Title:       r.Title,
			Description: r.Description,
			Type:        r.Type,
			Year:        r.Year,
			Creator:     r.Creator,
			ImageURL:    r.ImageURL,
			Source:      r.Source,
			ExternalID:  r.ExternalID,
		})

		if len(batch) >= batchSize {
			flush()
		}
	}
	flush()

	if err := sc.Err(); err != nil {
		log.Println("[catalog] scan error:", err)
	}

	log.Println("[catalog] imported:", inserted)
}
