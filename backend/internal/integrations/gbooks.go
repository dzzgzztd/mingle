package integrations

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"os"
	"sort"
	"strconv"
	"strings"
	"time"
)

type GBooksClient struct {
	apiKey string
	http   *http.Client
}

func NewGBooks() *GBooksClient {
	return &GBooksClient{
		apiKey: os.Getenv("GOOGLE_BOOKS_API_KEY"),
		http:   &http.Client{Timeout: 10 * time.Second},
	}
}

type gbooksSearchResp struct {
	Items []struct {
		ID         string `json:"id"`
		VolumeInfo struct {
			Title         string   `json:"title"`
			Authors       []string `json:"authors"`
			Description   string   `json:"description"`
			PublishedDate string   `json:"publishedDate"`
			ImageLinks    struct {
				Thumbnail string `json:"thumbnail"`
			} `json:"imageLinks"`
		} `json:"volumeInfo"`
	} `json:"items"`
}

func normalizeBookTitle(s string) string {
	s = strings.ToLower(strings.TrimSpace(s))
	replacer := strings.NewReplacer(
		":", " ",
		"—", " ",
		"–", " ",
		"(", " ",
		")", " ",
		"[", " ",
		"]", " ",
	)
	s = replacer.Replace(s)
	return strings.Join(strings.Fields(s), " ")
}

func bookScore(query, title, creator string, year *int, hasImage bool) int {
	q := normalizeBookTitle(query)
	t := normalizeBookTitle(title)
	c := strings.ToLower(strings.TrimSpace(creator))

	score := 0

	switch {
	case t == q:
		score += 1000
	case strings.HasPrefix(t, q):
		score += 500
	case strings.Contains(t, q):
		score += 250
	}

	for _, part := range strings.Fields(q) {
		if strings.Contains(t, part) {
			score += 40
		}
		if c != "" && strings.Contains(c, part) {
			score += 20
		}
	}

	if hasImage {
		score += 40
	}
	if creator != "" {
		score += 20
	}
	if year != nil && *year >= 1950 {
		score += 10
	}

	if strings.Contains(t, "study guide") || strings.Contains(t, "summary") || strings.Contains(t, "workbook") {
		score -= 300
	}

	return score
}

func (c *GBooksClient) Search(ctx context.Context, q string, page int) ([]ExternalSearchItem, error) {
	if c.apiKey == "" {
		return nil, errors.New("GOOGLE_BOOKS_API_KEY is not set")
	}

	u, _ := url.Parse("https://www.googleapis.com/books/v1/volumes")
	v := u.Query()
	v.Set("q", q)
	v.Set("key", c.apiKey)
	v.Set("maxResults", "20")
	if page > 1 {
		v.Set("startIndex", strconv.Itoa((page-1)*20))
	}
	u.RawQuery = v.Encode()

	req, _ := http.NewRequestWithContext(ctx, "GET", u.String(), nil)
	resp, err := c.http.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var raw map[string]any
	if err := json.NewDecoder(resp.Body).Decode(&raw); err != nil {
		return nil, err
	}
	if e, ok := raw["error"].(map[string]any); ok {
		msg, _ := e["message"].(string)
		code, _ := e["code"].(float64)
		return nil, fmt.Errorf("gbooks error (code %.0f): %s", code, msg)
	}

	b, _ := json.Marshal(raw)
	var data gbooksSearchResp
	if err := json.Unmarshal(b, &data); err != nil {
		return nil, err
	}

	type ranked struct {
		Item  ExternalSearchItem
		Score int
		Key   string
	}

	bestByTitle := map[string]ranked{}

	for _, it := range data.Items {
		year := parseYearFromPublished(it.VolumeInfo.PublishedDate)
		creator := strings.Join(it.VolumeInfo.Authors, ", ")
		img := it.VolumeInfo.ImageLinks.Thumbnail
		if strings.HasPrefix(img, "http://") {
			img = "https://" + strings.TrimPrefix(img, "http://")
		}

		item := ExternalSearchItem{
			Source:     "gbooks",
			ExternalID: it.ID,
			Type:       "book",
			Title:      it.VolumeInfo.Title,
			Year:       year,
			Creator:    creator,
			ImageURL:   img,
		}

		key := normalizeBookTitle(it.VolumeInfo.Title)
		score := bookScore(q, it.VolumeInfo.Title, creator, year, img != "")

		prev, ok := bestByTitle[key]
		if !ok || score > prev.Score {
			bestByTitle[key] = ranked{
				Item:  item,
				Score: score,
				Key:   key,
			}
		}
	}

	rankedItems := make([]ranked, 0, len(bestByTitle))
	for _, v := range bestByTitle {
		rankedItems = append(rankedItems, v)
	}

	sort.SliceStable(rankedItems, func(i, j int) bool {
		if rankedItems[i].Score != rankedItems[j].Score {
			return rankedItems[i].Score > rankedItems[j].Score
		}
		return strings.ToLower(rankedItems[i].Item.Title) < strings.ToLower(rankedItems[j].Item.Title)
	})

	out := make([]ExternalSearchItem, 0, len(rankedItems))
	for _, r := range rankedItems {
		out = append(out, r.Item)
	}

	return out, nil
}

func (c *GBooksClient) GetByID(ctx context.Context, id string) (ExternalDetails, error) {
	if c.apiKey == "" {
		return ExternalDetails{}, errors.New("GOOGLE_BOOKS_API_KEY is not set")
	}
	u := "https://www.googleapis.com/books/v1/volumes/" + url.PathEscape(id) + "?key=" + url.QueryEscape(c.apiKey)

	req, _ := http.NewRequestWithContext(ctx, "GET", u, nil)
	resp, err := c.http.Do(req)
	if err != nil {
		return ExternalDetails{}, err
	}
	defer resp.Body.Close()

	var raw map[string]any
	if err := json.NewDecoder(resp.Body).Decode(&raw); err != nil {
		return ExternalDetails{}, err
	}
	if e, ok := raw["error"].(map[string]any); ok {
		msg, _ := e["message"].(string)
		code, _ := e["code"].(float64)
		return ExternalDetails{}, fmt.Errorf("gbooks error (code %.0f): %s", code, msg)
	}

	b, _ := json.Marshal(raw)
	var data struct {
		ID         string `json:"id"`
		VolumeInfo struct {
			Title         string   `json:"title"`
			Authors       []string `json:"authors"`
			Description   string   `json:"description"`
			PublishedDate string   `json:"publishedDate"`
			ImageLinks    struct {
				Thumbnail string `json:"thumbnail"`
			} `json:"imageLinks"`
		} `json:"volumeInfo"`
	}
	if err := json.Unmarshal(b, &data); err != nil {
		return ExternalDetails{}, err
	}

	year := parseYearFromPublished(data.VolumeInfo.PublishedDate)
	creator := strings.Join(data.VolumeInfo.Authors, ", ")
	img := data.VolumeInfo.ImageLinks.Thumbnail
	if strings.HasPrefix(img, "http://") {
		img = "https://" + strings.TrimPrefix(img, "http://")
	}

	return ExternalDetails{
		ExternalSearchItem: ExternalSearchItem{
			Source:     "gbooks",
			ExternalID: data.ID,
			Type:       "book",
			Title:      data.VolumeInfo.Title,
			Year:       year,
			Creator:    creator,
			ImageURL:   img,
		},
		Description: data.VolumeInfo.Description,
	}, nil
}

func parseYearFromPublished(s string) *int {
	if len(s) < 4 {
		return nil
	}
	y, err := strconv.Atoi(s[:4])
	if err != nil {
		return nil
	}
	return &y
}
