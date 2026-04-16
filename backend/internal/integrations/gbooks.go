package integrations

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"os"
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

	out := make([]ExternalSearchItem, 0, len(data.Items))
	for _, it := range data.Items {
		year := parseYearFromPublished(it.VolumeInfo.PublishedDate)
		creator := strings.Join(it.VolumeInfo.Authors, ", ")
		img := it.VolumeInfo.ImageLinks.Thumbnail
		if strings.HasPrefix(img, "http://") {
			img = "https://" + strings.TrimPrefix(img, "http://")
		}
		out = append(out, ExternalSearchItem{
			Source:     "gbooks",
			ExternalID: it.ID,
			Type:       "book",
			Title:      it.VolumeInfo.Title,
			Year:       year,
			Creator:    creator,
			ImageURL:   img,
		})
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
	if err := json.NewDecoder(resp.Body).Decode(&data); err != nil {
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
