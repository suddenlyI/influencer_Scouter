import type { VercelRequest, VercelResponse } from '@vercel/node';

// In-memory store for Vercel (stateless, will reset on cold start)
// For persistent storage on Vercel, you need a database like Supabase, Neon, or Vercel KV.
let inMemoryState: any = {
  keywordGroups: [
    { id: 'default', name: '기본 그룹', keywords: [
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
    ] }
  ],
  influencers: []
};

export default function handler(req: VercelRequest, res: VercelResponse) {
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

  if (req.method === 'GET') {
    res.json(inMemoryState);
  } else if (req.method === 'POST') {
    const { keywordGroups, influencers } = req.body;
    if (keywordGroups) inMemoryState.keywordGroups = keywordGroups;
    if (influencers) inMemoryState.influencers = influencers;
    res.json({ success: true });
  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
}
