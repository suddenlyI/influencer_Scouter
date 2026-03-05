import express from 'express';
import { createServer as createViteServer } from 'vite';
import axios from 'axios';
import * as cheerio from 'cheerio';
import Database from 'better-sqlite3';
import crypto from 'crypto';
import { kv } from '@vercel/kv';
import Redis from 'ioredis';

// Configuration Priorities:
// 1. REDIS_URL (Standard Redis, e.g., Redis Cloud)
// 2. KV_REST_API_URL (Vercel KV)
// 3. SQLite (Local/Fallback)

const redisUrl = process.env.REDIS_URL;
const useVercelKV = !redisUrl && process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN;

// Initialize Redis Client (if REDIS_URL is provided)
const redisClient = redisUrl ? new Redis(redisUrl) : null;

if (redisClient) {
  redisClient.on('error', (err) => console.error('Redis Client Error', err));
  redisClient.on('connect', () => console.log('Connected to Redis'));
}

// Initialize SQLite (Fallback if no Redis/KV)
const db = (() => {
  if (redisClient || useVercelKV) return null;
  try {
    return new Database('database.sqlite');
  } catch (error) {
    console.error('Failed to initialize file-based database, falling back to in-memory:', error);
    return new Database(':memory:');
  }
})();

if (db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS app_state (
      key TEXT PRIMARY KEY,
      value TEXT
    )
  `);
}

const INITIAL_KEYWORDS = [
  "다이어트 식단",
  "뱃살 빼는 운동",
  "헬스 루틴",
  "홈트레이닝",
  "스트레칭",
  "오운완",
  "단기간 다이어트",
  "공복 유산소",
  "어깨 넓어지는 운동",
  "힙업 운동",
  "거북목 스트레칭",
  "스쿼트 자세",
  "체지방 줄이는 법",
  "등 운동 루틴",
  "전신 유산소 운동",
  "운동 전후 식사",
  "기초대사량 높이는 법",
  "바디프로필",
  "필라테스 효과",
  "폼롤러 마사지"
];

// Helper to get state
const getState = async (key: string, defaultValue: any) => {
  try {
    if (redisClient) {
      const value = await redisClient.get(key);
      return value ? JSON.parse(value) : defaultValue;
    } else if (useVercelKV) {
      const value = await kv.get(key);
      return value !== null ? value : defaultValue;
    } else {
      const row = db!.prepare('SELECT value FROM app_state WHERE key = ?').get(key) as { value: string } | undefined;
      return row ? JSON.parse(row.value) : defaultValue;
    }
  } catch (error) {
    console.error(`Error getting state for key ${key}:`, error);
    return defaultValue;
  }
};

// Helper to set state
const setState = async (key: string, value: any) => {
  try {
    if (redisClient) {
      await redisClient.set(key, JSON.stringify(value));
    } else if (useVercelKV) {
      await kv.set(key, value);
    } else {
      db!.prepare('INSERT OR REPLACE INTO app_state (key, value) VALUES (?, ?)').run(key, JSON.stringify(value));
    }
  } catch (error) {
    console.error(`Error setting state for key ${key}:`, error);
  }
};

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '50mb' }));

  // API Routes
  
  // Get global state
  app.get('/api/state', async (req, res) => {
    try {
      const keywordGroups = await getState('keywordGroups', [
        { id: 'default', name: '기본 그룹', keywords: INITIAL_KEYWORDS }
      ]);
      const influencers = await getState('influencers', []);
      res.json({ keywordGroups, influencers });
    } catch (error) {
      console.error('Get state error:', error);
      res.status(500).json({ error: 'Failed to get state' });
    }
  });

  // Save global state
  app.post('/api/state', async (req, res) => {
    try {
      const { keywordGroups, influencers } = req.body;
      if (keywordGroups) await setState('keywordGroups', keywordGroups);
      if (influencers) await setState('influencers', influencers);
      res.json({ success: true });
    } catch (error) {
      console.error('Save state error:', error);
      res.status(500).json({ error: 'Failed to save state' });
    }
  });

  app.get('/api/crawl', async (req, res) => {
    const keyword = req.query.keyword as string;
    if (!keyword) {
      return res.status(400).json({ error: 'Keyword is required' });
    }

    try {
      const url = `https://search.naver.com/search.naver?where=influencer&query=${encodeURIComponent(keyword)}`;
      console.log(`Crawling: ${url}`);

      const response = await axios.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
          'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
          'Accept-Encoding': 'gzip, deflate, br',
          'Referer': 'https://search.naver.com/',
          'Upgrade-Insecure-Requests': '1',
          'Sec-Fetch-Dest': 'document',
          'Sec-Fetch-Mode': 'navigate',
          'Sec-Fetch-Site': 'same-origin',
          'Sec-Fetch-User': '?1',
          'Cache-Control': 'max-age=0'
        }
      });

      const $ = cheerio.load(response.data);
      const influencers: any[] = [];

      // Debug: Log the HTML structure length to see if we got content
      console.log(`Fetched HTML length: ${response.data.length}`);

      // Naver Influencer search structure often changes. 
      // Try multiple selectors if the first one fails.
      let elements = $('li.keyword_bx');
      if (elements.length === 0) {
         elements = $('.influencer_list_area .list_item'); // Fallback selector
      }
      
      console.log(`Found ${elements.length} elements`);

      elements.each((_, element) => {
        // ... existing extraction logic ...
        const name = $(element).find('.user_info .name .txt').text().trim() || 
                     $(element).find('.name_area .name').text().trim();
                     
        let url = $(element).find('.user_info .name').attr('href') || 
                  $(element).find('.name_area').attr('href') || '';
        
        // Clean URL (remove query params)
        if (url.includes('?')) {
          url = url.split('?')[0];
        }

        const fans = $(element).find('.user_info .fan_count ._fan_count').text().trim();
        const specialty = $(element).find('.user_info .etc_area .etc').first().text().trim();

        if (name && url) {
          influencers.push({
            id: crypto.randomUUID(),
            keyword,
            name,
            url,
            fans,
            specialty
          });
        }
      });

      res.json({ influencers });
    } catch (error) {
      console.error('Crawl error:', error);
      res.status(500).json({ error: 'Failed to crawl data' });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // Production static file serving (if needed later)
    app.use(express.static('dist'));
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
