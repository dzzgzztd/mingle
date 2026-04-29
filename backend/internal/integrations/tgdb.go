package integrations

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/url"
	"os"
	"sort"
	"strconv"
	"strings"
	"time"
)

type TGDBClient struct {
	apiKey string
	base   string
	http   *http.Client
}

func NewTGDB() *TGDBClient {
	base := os.Getenv("TGDB_BASE_URL")
	if base == "" {
		base = "https://api.thegamesdb.net/v1"
	}
	return &TGDBClient{
		apiKey: os.Getenv("TGDB_API_KEY"),
		base:   base,
		http:   &http.Client{Timeout: 12 * time.Second},
	}
}

type tgdbBoxartItem struct {
	ID         int    `json:"id"`
	Type       string `json:"type"`
	Side       string `json:"side"`
	FileName   string `json:"filename"`
	Resolution string `json:"resolution"`
}

type tgdbBoxartBaseURL struct {
	Original           string `json:"original"`
	Small              string `json:"small"`
	Thumb              string `json:"thumb"`
	CroppedCenterThumb string `json:"cropped_center_thumb"`
	Medium             string `json:"medium"`
	Large              string `json:"large"`
}

type tgdbDeveloperItem struct {
	ID   int    `json:"id"`
	Name string `json:"name"`
}

type tgdbGame struct {
	ID          int    `json:"id"`
	GameTitle   string `json:"game_title"`
	Name        string `json:"name"`
	ReleaseDate string `json:"release_date"`
	Overview    string `json:"overview"`
	Description string `json:"description"`
	Developers  any    `json:"developers"`
	Platform    int    `json:"platform"`
	RegionID    int    `json:"region_id"`
	CountryID   int    `json:"country_id"`
}

func tgdbPickBaseURL(base tgdbBoxartBaseURL) string {
	for _, s := range []string{
		base.Medium,
		base.Large,
		base.Original,
		base.Small,
		base.Thumb,
	} {
		if strings.TrimSpace(s) != "" {
			return s
		}
	}
	return ""
}

func tgdbBoxartURL(gameID int, base tgdbBoxartBaseURL, boxart map[string][]tgdbBoxartItem) string {
	key := strconv.Itoa(gameID)
	items, ok := boxart[key]
	if !ok || len(items) == 0 {
		return ""
	}

	baseURL := tgdbPickBaseURL(base)
	if baseURL == "" {
		return ""
	}

	for _, preferredSide := range []string{"front", ""} {
		for _, it := range items {
			if strings.TrimSpace(it.FileName) == "" {
				continue
			}
			if strings.ToLower(strings.TrimSpace(it.Type)) != "boxart" {
				continue
			}
			if preferredSide != "" && strings.ToLower(strings.TrimSpace(it.Side)) != preferredSide {
				continue
			}
			return strings.TrimRight(baseURL, "/") + "/" + strings.TrimLeft(it.FileName, "/")
		}
	}

	return ""
}

func tgdbNormalizeTitle(s string) string {
	s = strings.ToLower(strings.TrimSpace(s))
	s = strings.ReplaceAll(s, "—", "-")
	s = strings.ReplaceAll(s, "–", "-")

	replacer := strings.NewReplacer(
		"[", " ",
		"]", " ",
		"(", " ",
		")", " ",
		":", " ",
		"_", " ",
	)
	s = replacer.Replace(s)

	parts := strings.Fields(s)
	return strings.Join(parts, " ")
}

func tgdbReleaseScore(year *int) int {
	if year == nil {
		return 0
	}
	y := *year
	if y < 1990 {
		return -50
	}
	return y - 2000
}

func tgdbCandidateScore(title string, year *int, imageURL string, regionID int, countryID int) int {
	score := 0

	if imageURL != "" {
		score += 100
	}
	score += tgdbReleaseScore(year)

	if countryID == 0 {
		score += 15
	}
	if regionID == 0 {
		score += 10
	}

	t := strings.ToLower(title)
	if strings.Contains(t, "edition") || strings.Contains(t, "[") || strings.Contains(t, "]") {
		score -= 10
	}

	return score
}

func tgdbDeveloperMap(raw json.RawMessage) map[string]string {
	out := map[string]string{}
	if len(raw) == 0 || string(raw) == "null" {
		return out
	}

	var asMap map[string]tgdbDeveloperItem
	if err := json.Unmarshal(raw, &asMap); err == nil {
		for id, dev := range asMap {
			if strings.TrimSpace(dev.Name) != "" {
				out[id] = strings.TrimSpace(dev.Name)
			}
		}
		return out
	}

	var asSlice []tgdbDeveloperItem
	if err := json.Unmarshal(raw, &asSlice); err == nil {
		for _, dev := range asSlice {
			if dev.ID != 0 && strings.TrimSpace(dev.Name) != "" {
				out[strconv.Itoa(dev.ID)] = strings.TrimSpace(dev.Name)
			}
		}
	}

	return out
}

func tgdbDeveloperNames(raw any, include map[string]string) string {
	push := func(names []string, id string) []string {
		id = strings.TrimSpace(id)
		if id == "" {
			return names
		}
		if name, ok := include[id]; ok && strings.TrimSpace(name) != "" {
			return append(names, strings.TrimSpace(name))
		}
		if _, err := strconv.Atoi(id); err != nil {
			return append(names, id)
		}
		return names
	}

	names := []string{}

	switch v := raw.(type) {
	case []any:
		for _, item := range v {
			switch idv := item.(type) {
			case float64:
				names = push(names, strconv.Itoa(int(idv)))
			case string:
				names = push(names, idv)
			case map[string]any:
				if name, ok := idv["name"].(string); ok {
					names = push(names, name)
				} else if id, ok := idv["id"].(float64); ok {
					names = push(names, strconv.Itoa(int(id)))
				}
			}
		}
	case []int:
		for _, idNum := range v {
			names = push(names, strconv.Itoa(idNum))
		}
	case float64:
		names = push(names, strconv.Itoa(int(v)))
	case int:
		names = push(names, strconv.Itoa(v))
	case string:
		for _, part := range strings.Split(v, ",") {
			names = push(names, part)
		}
	case map[string]any:
		if name, ok := v["name"].(string); ok {
			names = push(names, name)
		} else if id, ok := v["id"].(float64); ok {
			names = push(names, strconv.Itoa(int(id)))
		}
	}

	if len(names) == 0 {
		return ""
	}

	seen := map[string]bool{}
	uniq := make([]string, 0, len(names))
	for _, name := range names {
		name = strings.TrimSpace(name)
		if name == "" || seen[name] {
			continue
		}
		seen[name] = true
		uniq = append(uniq, name)
	}

	return strings.Join(uniq, ", ")
}

func tgdbParseGames(raw json.RawMessage) []tgdbGame {
	if len(raw) == 0 || string(raw) == "null" {
		return nil
	}

	var asSlice []tgdbGame
	if err := json.Unmarshal(raw, &asSlice); err == nil {
		return asSlice
	}

	var asMap map[string]tgdbGame
	if err := json.Unmarshal(raw, &asMap); err == nil {
		out := make([]tgdbGame, 0, len(asMap))
		for _, game := range asMap {
			out = append(out, game)
		}
		return out
	}

	return nil
}

func tgdbGameTitle(g tgdbGame) string {
	if strings.TrimSpace(g.GameTitle) != "" {
		return strings.TrimSpace(g.GameTitle)
	}
	return strings.TrimSpace(g.Name)
}

func tgdbGameDescription(g tgdbGame) string {
	for _, s := range []string{g.Overview, g.Description} {
		if strings.TrimSpace(s) != "" {
			return strings.TrimSpace(s)
		}
	}
	return ""
}

func (c *TGDBClient) Search(ctx context.Context, q string, page int) ([]ExternalSearchItem, error) {
	if c.apiKey == "" {
		return nil, errors.New("TGDB_API_KEY is not set")
	}

	u, _ := url.Parse(c.base + "/Games/ByGameName")
	v := u.Query()
	v.Set("apikey", c.apiKey)
	v.Set("name", q)
	v.Set("include", "boxart,developers")
	v.Set("fields", "overview")
	if page > 1 {
		v.Set("page", strconv.Itoa(page))
	}
	u.RawQuery = v.Encode()

	req, _ := http.NewRequestWithContext(ctx, "GET", u.String(), nil)
	resp, err := c.http.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var data struct {
		Data struct {
			Games json.RawMessage `json:"games"`
		} `json:"data"`
		Include struct {
			Boxart struct {
				BaseURL tgdbBoxartBaseURL           `json:"base_url"`
				Data    map[string][]tgdbBoxartItem `json:"data"`
			} `json:"boxart"`
			Developers struct {
				Data json.RawMessage `json:"data"`
			} `json:"developers"`
		} `json:"include"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&data); err != nil {
		return nil, err
	}

	developers := tgdbDeveloperMap(data.Include.Developers.Data)

	type candidate struct {
		Item      ExternalSearchItem
		Score     int
		NormTitle string
	}

	bestByTitle := map[string]candidate{}

	for _, g := range tgdbParseGames(data.Data.Games) {
		title := tgdbGameTitle(g)
		if title == "" {
			continue
		}
		year := parseYearFromPublished(g.ReleaseDate)
		img := tgdbBoxartURL(g.ID, data.Include.Boxart.BaseURL, data.Include.Boxart.Data)
		creator := tgdbDeveloperNames(g.Developers, developers)

		item := ExternalSearchItem{
			Source:     "tgdb",
			ExternalID: strconv.Itoa(g.ID),
			Type:       "game",
			Title:      title,
			Year:       year,
			Creator:    creator,
			ImageURL:   img,
		}

		norm := tgdbNormalizeTitle(title)
		score := tgdbCandidateScore(title, year, img, g.RegionID, g.CountryID)

		prev, exists := bestByTitle[norm]
		if !exists || score > prev.Score {
			bestByTitle[norm] = candidate{
				Item:      item,
				Score:     score,
				NormTitle: norm,
			}
		}
	}

	candidates := make([]candidate, 0, len(bestByTitle))
	for _, cnd := range bestByTitle {
		candidates = append(candidates, cnd)
	}

	sort.SliceStable(candidates, func(i, j int) bool {
		if candidates[i].Score != candidates[j].Score {
			return candidates[i].Score > candidates[j].Score
		}
		return strings.ToLower(candidates[i].Item.Title) < strings.ToLower(candidates[j].Item.Title)
	})

	out := make([]ExternalSearchItem, 0, len(candidates))
	for _, cnd := range candidates {
		out = append(out, cnd.Item)
	}

	return out, nil
}

func (c *TGDBClient) GetByID(ctx context.Context, id string) (ExternalDetails, error) {
	if c.apiKey == "" {
		return ExternalDetails{}, errors.New("TGDB_API_KEY is not set")
	}

	u, _ := url.Parse(c.base + "/Games/ByGameID")
	v := u.Query()
	v.Set("apikey", c.apiKey)
	v.Set("id", id)
	v.Set("include", "boxart,developers")
	v.Set("fields", "overview")
	u.RawQuery = v.Encode()

	req, _ := http.NewRequestWithContext(ctx, "GET", u.String(), nil)
	resp, err := c.http.Do(req)
	if err != nil {
		return ExternalDetails{}, err
	}
	defer resp.Body.Close()

	var data struct {
		Data struct {
			Games json.RawMessage `json:"games"`
		} `json:"data"`
		Include struct {
			Boxart struct {
				BaseURL tgdbBoxartBaseURL           `json:"base_url"`
				Data    map[string][]tgdbBoxartItem `json:"data"`
			} `json:"boxart"`
			Developers struct {
				Data json.RawMessage `json:"data"`
			} `json:"developers"`
		} `json:"include"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&data); err != nil {
		return ExternalDetails{}, err
	}

	games := tgdbParseGames(data.Data.Games)
	if len(games) == 0 {
		return ExternalDetails{}, errors.New("tgdb: not found")
	}

	developers := tgdbDeveloperMap(data.Include.Developers.Data)
	g := games[0]
	year := parseYearFromPublished(g.ReleaseDate)
	img := tgdbBoxartURL(g.ID, data.Include.Boxart.BaseURL, data.Include.Boxart.Data)
	creator := tgdbDeveloperNames(g.Developers, developers)
	title := tgdbGameTitle(g)

	return ExternalDetails{
		ExternalSearchItem: ExternalSearchItem{
			Source:     "tgdb",
			ExternalID: strconv.Itoa(g.ID),
			Type:       "game",
			Title:      title,
			Year:       year,
			Creator:    creator,
			ImageURL:   img,
		},
		Description: tgdbGameDescription(g),
	}, nil
}
