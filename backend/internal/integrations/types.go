package integrations

type ExternalSearchItem struct {
	Source     string `json:"source"`
	ExternalID string `json:"externalId"`
	Type       string `json:"type"` // movie|series|book|game
	Title      string `json:"title"`
	Year       *int   `json:"year,omitempty"`
	Creator    string `json:"creator,omitempty"`
	ImageURL   string `json:"imageUrl,omitempty"`
}

type ExternalDetails struct {
	ExternalSearchItem
	Description string `json:"description,omitempty"`
}
