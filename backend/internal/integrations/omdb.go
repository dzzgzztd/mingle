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
	"time"
)

type OMDbClient struct {
	apiKey string
	http   *http.Client
}

func NewOMDb() *OMDbClient {
	return &OMDbClient{
		apiKey: os.Getenv("OMDB_API_KEY"),
		http:   &http.Client{Timeout: 10 * time.Second},
	}
}

type omdbSearchResp struct {
	Search []struct {
		Title  string `json:"Title"`
		Year   string `json:"Year"`
		ImdbID string `json:"imdbID"`
		Type   string `json:"Type"`
		Poster string `json:"Poster"`
	} `json:"Search"`
	Response string `json:"Response"`
	Error    string `json:"Error"`
}

type omdbDetailsResp struct {
	Title    string `json:"Title"`
	Year     string `json:"Year"`
	ImdbID   string `json:"imdbID"`
	Type     string `json:"Type"`
	Poster   string `json:"Poster"`
	Plot     string `json:"Plot"`
	Director string `json:"Director"`
	Writer   string `json:"Writer"`
	Actors   string `json:"Actors"`
	Response string `json:"Response"`
	Error    string `json:"Error"`
}

func (c *OMDbClient) Search(ctx context.Context, q string, page int) ([]ExternalSearchItem, error) {
	if c.apiKey == "" {
		return nil, errors.New("OMDB_API_KEY is not set")
	}
	u, _ := url.Parse("https://www.omdbapi.com/")
	v := u.Query()
	v.Set("apikey", c.apiKey)
	v.Set("s", q)
	if page > 0 {
		v.Set("page", strconv.Itoa(page))
	}
	u.RawQuery = v.Encode()

	req, _ := http.NewRequestWithContext(ctx, "GET", u.String(), nil)
	resp, err := c.http.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var data omdbSearchResp
	if err := json.NewDecoder(resp.Body).Decode(&data); err != nil {
		return nil, err
	}
	if data.Response != "True" {
		if data.Error != "" {
			return nil, fmt.Errorf("omdb error: %s", data.Error)
		}
		return nil, fmt.Errorf("omdb empty response")
	}

	out := make([]ExternalSearchItem, 0, len(data.Search))
	for _, it := range data.Search {
		year := parseYear(it.Year)
		typ := it.Type
		out = append(out, ExternalSearchItem{
			Source:     "omdb",
			ExternalID: it.ImdbID,
			Type:       typ,
			Title:      it.Title,
			Year:       year,
			ImageURL:   fixPoster(it.Poster),
		})
	}
	return out, nil
}

func (c *OMDbClient) GetByID(ctx context.Context, imdbID string) (ExternalDetails, error) {
	if c.apiKey == "" {
		return ExternalDetails{}, errors.New("OMDB_API_KEY is not set")
	}
	u, _ := url.Parse("https://www.omdbapi.com/")
	v := u.Query()
	v.Set("apikey", c.apiKey)
	v.Set("i", imdbID)
	v.Set("plot", "full")
	u.RawQuery = v.Encode()

	req, _ := http.NewRequestWithContext(ctx, "GET", u.String(), nil)
	resp, err := c.http.Do(req)
	if err != nil {
		return ExternalDetails{}, err
	}
	defer resp.Body.Close()

	var data omdbDetailsResp
	if err := json.NewDecoder(resp.Body).Decode(&data); err != nil {
		return ExternalDetails{}, err
	}
	if data.Response != "True" {
		return ExternalDetails{}, errors.New("omdb: not found")
	}

	year := parseYear(data.Year)
	creator := data.Director
	if creator == "" {
		creator = data.Writer
	}

	return ExternalDetails{
		ExternalSearchItem: ExternalSearchItem{
			Source:     "omdb",
			ExternalID: data.ImdbID,
			Type:       data.Type, // movie|series
			Title:      data.Title,
			Year:       year,
			Creator:    creator,
			ImageURL:   fixPoster(data.Poster),
		},
		Description: data.Plot,
	}, nil
}

func parseYear(s string) *int {
	if len(s) < 4 {
		return nil
	}
	y, err := strconv.Atoi(s[:4])
	if err != nil {
		return nil
	}
	return &y
}

func fixPoster(p string) string {
	if p == "" || p == "N/A" {
		return ""
	}
	return p
}

func (c *OMDbClient) GetByTitle(ctx context.Context, title string, typ string) (ExternalDetails, error) {
	if c.apiKey == "" {
		return ExternalDetails{}, errors.New("OMDB_API_KEY is not set")
	}
	u, _ := url.Parse("https://www.omdbapi.com/")
	v := u.Query()
	v.Set("apikey", c.apiKey)
	v.Set("t", title)
	v.Set("plot", "full")
	if typ != "" {
		v.Set("type", typ)
	}
	u.RawQuery = v.Encode()

	req, _ := http.NewRequestWithContext(ctx, "GET", u.String(), nil)
	resp, err := c.http.Do(req)
	if err != nil {
		return ExternalDetails{}, err
	}
	defer resp.Body.Close()

	var data omdbDetailsResp
	if err := json.NewDecoder(resp.Body).Decode(&data); err != nil {
		return ExternalDetails{}, err
	}
	if data.Response != "True" {
		if data.Error != "" {
			return ExternalDetails{}, fmt.Errorf("omdb error: %s", data.Error)
		}
		return ExternalDetails{}, errors.New("omdb: not found")
	}

	year := parseYear(data.Year)
	creator := data.Director
	if creator == "" {
		creator = data.Writer
	}

	return ExternalDetails{
		ExternalSearchItem: ExternalSearchItem{
			Source:     "omdb",
			ExternalID: data.ImdbID,
			Type:       data.Type,
			Title:      data.Title,
			Year:       year,
			Creator:    creator,
			ImageURL:   fixPoster(data.Poster),
		},
		Description: data.Plot,
	}, nil
}
