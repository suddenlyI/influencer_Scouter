import type { VercelRequest, VercelResponse } from '@vercel/node';
import axios from 'axios';
import * as cheerio from 'cheerio';
import crypto from 'crypto';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

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
}
