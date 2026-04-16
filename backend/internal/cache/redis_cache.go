package cache

import (
	"context"
	"crypto/sha1"
	"encoding/hex"
	"encoding/json"
	"os"
	"time"

	"github.com/redis/go-redis/v9"
)

type RedisCache struct {
	rdb *redis.Client
}

func NewRedisCacheFromEnv() *RedisCache {
	addr := os.Getenv("REDIS_ADDR")
	if addr == "" {
		addr = "redis:6379"
	}
	pass := os.Getenv("REDIS_PASSWORD") // обычно пусто
	db := 0

	rdb := redis.NewClient(&redis.Options{
		Addr:     addr,
		Password: pass,
		DB:       db,
	})

	return &RedisCache{rdb: rdb}
}

func (c *RedisCache) Ping(ctx context.Context) error {
	return c.rdb.Ping(ctx).Err()
}

func hashKey(s string) string {
	h := sha1.Sum([]byte(s))
	return hex.EncodeToString(h[:])
}

func (c *RedisCache) GetJSON(ctx context.Context, key string, dest any) (bool, error) {
	val, err := c.rdb.Get(ctx, key).Result()
	if err == redis.Nil {
		return false, nil
	}
	if err != nil {
		return false, err
	}
	if err := json.Unmarshal([]byte(val), dest); err != nil {
		_ = c.rdb.Del(ctx, key).Err()
		return false, nil
	}
	return true, nil
}

func (c *RedisCache) SetJSON(ctx context.Context, key string, value any, ttl time.Duration) error {
	b, err := json.Marshal(value)
	if err != nil {
		return err
	}
	return c.rdb.Set(ctx, key, b, ttl).Err()
}

func SearchCacheKey(q string, typ string) string {
	return "search:v1:" + typ + ":" + hashKey(q)
}

func ExternalSearchCacheKey(provider, q string) string {
	return "external_search:v1:" + provider + ":" + hashKey(q)
}

func ExternalDetailsCacheKey(provider, externalID string) string {
	return "external_details:v1:" + provider + ":" + hashKey(externalID)
}
