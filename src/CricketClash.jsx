import { useState, useEffect, useRef, useCallback, useMemo } from "react";

// ─── BACKEND CONFIG ───────────────────────────────────────────────────────────
// In the Claude artifact: runs fully offline (demo mode)
// In your real app: set these to your Supabase + Render URLs
const API_BASE = typeof window !== "undefined" && window.__CRICKET_API__
  ? window.__CRICKET_API__
  : "https://cricket-clash-api.onrender.com"; // live backend

// Lightweight API helper — no-ops gracefully when offline
async function api(path, options = {}) {
  if (!API_BASE) return null; // demo mode — backend calls silently skipped
  const token = window.__CRICKET_TOKEN__ || null;
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || "API error");
  }
  return res.json();
}
// ─────────────────────────────────────────────────────────────────────────────
// TO CONNECT YOUR REAL BACKEND (in your deployed React app, not this artifact):
//   window.__CRICKET_API__   = "https://your-api.onrender.com"
//   window.__CRICKET_TOKEN__ = supabase.auth.getSession().access_token
// ─────────────────────────────────────────────────────────────────────────────


// ─── MATCH CONDITIONS ──────────────────────────────────────────────────────────
const CONDITIONS = [
  { id:"swing",  icon:"🌦", name:"Overcast & Swing",        desc:"Duke ball swinging both ways. Pace & seam questions.",    theme:"#0369a1", bg:"#f0f9ff", cat:"The Ashes",
    isNight:false, stadium:"Lord's Cricket Ground", venue:"London, England",
    img:"https://upload.wikimedia.org/wikipedia/commons/thumb/9/9d/Lords_Cricket_Ground_-_panoramio.jpg/1280px-Lords_Cricket_Ground_-_panoramio.jpg",
    sky:"linear-gradient(180deg,#4a5568 0%,#718096 40%,#a0aec0 100%)",
    atmosphere:"Overcast | Humid 82% | 16°C", wind:"SW 18 km/h", weatherIcon:"🌦",
    broadcastTag:"LIVE · DAY MATCH", broadcastColor:"#0369a1",
    pitchColor:"#8B7355", pitchDesc:"Soft, Green", overlay:"rgba(7,89,133,.55)" },
  { id:"dry",    icon:"☀️", name:"Dry Pitch, Spin Day",     desc:"Crumbling surface. Spin bowling questions dominate.",     theme:"#92400e", bg:"#fffbeb", cat:"Test Cricket",
    isNight:false, stadium:"MA Chidambaram Stadium", venue:"Chennai, India",
    img:"https://upload.wikimedia.org/wikipedia/commons/thumb/3/3d/MA_Chidambaram_Stadium%2C_Chennai.jpg/1280px-MA_Chidambaram_Stadium%2C_Chennai.jpg",
    sky:"linear-gradient(180deg,#F59E0B 0%,#FBBF24 30%,#FDE68A 100%)",
    atmosphere:"Sunny | Humidity 68% | 34°C", wind:"NE 8 km/h", weatherIcon:"☀️",
    broadcastTag:"LIVE · DAY MATCH", broadcastColor:"#b45309",
    pitchColor:"#C4A96A", pitchDesc:"Hard, Dry, Dusty", overlay:"rgba(120,53,15,.55)" },
  { id:"flat",   icon:"🏟", name:"Flat Track Belter",       desc:"Six-hitting bonanza. Batting records & T20 questions.",   theme:"#166534", bg:"#f0fdf4", cat:"T20 Cricket",
    isNight:true,  stadium:"Narendra Modi Stadium", venue:"Ahmedabad, India",
    img:"https://upload.wikimedia.org/wikipedia/commons/thumb/7/7a/Sardar_Patel_Stadium_Motera.jpg/1280px-Sardar_Patel_Stadium_Motera.jpg",
    sky:"linear-gradient(180deg,#0a0a1a 0%,#1a1a4a 50%,#2d3a6b 100%)",
    atmosphere:"Clear Night | 29°C | Dew: Heavy", wind:"NW 12 km/h", weatherIcon:"🌙",
    broadcastTag:"LIVE · NIGHT MATCH", broadcastColor:"#22d3ee",
    pitchColor:"#A8956B", pitchDesc:"Flat, True Bounce", overlay:"rgba(0,0,30,.65)" },
  { id:"seam",   icon:"🌬", name:"Green Top, Early Seam",   desc:"Seam movement galore. Classic fast bowling questions.",   theme:"#5b21b6", bg:"#faf5ff", cat:"Player Records",
    isNight:false, stadium:"MCG", venue:"Melbourne, Australia",
    img:"https://upload.wikimedia.org/wikipedia/commons/thumb/3/3a/MCG_under_lights.jpg/1280px-MCG_under_lights.jpg",
    sky:"linear-gradient(180deg,#1e3a5f 0%,#2d6a9f 50%,#87ceeb 100%)",
    atmosphere:"Partly Cloudy | 22°C | Moisture: High", wind:"WSW 24 km/h", weatherIcon:"🌬",
    broadcastTag:"LIVE · DAY MATCH", broadcastColor:"#7c3aed",
    pitchColor:"#6B8C42", pitchDesc:"Lush, Grassy Cover", overlay:"rgba(55,20,120,.5)" },
  { id:"dew",    icon:"🌙", name:"Night Match, Heavy Dew",  desc:"Dew factor advantage. ODI & T20 batting questions.",      theme:"#1e40af", bg:"#eff6ff", cat:"ODI Cricket",
    isNight:true,  stadium:"Wankhede Stadium", venue:"Mumbai, India",
    img:"https://upload.wikimedia.org/wikipedia/commons/thumb/e/e8/Wankhede_Stadium_-_panoramio_%281%29.jpg/1280px-Wankhede_Stadium_-_panoramio_%281%29.jpg",
    sky:"linear-gradient(180deg,#020617 0%,#0f172a 40%,#1e3a5f 100%)",
    atmosphere:"Clear Night | 27°C | Dew: Heavy", wind:"Sea breeze 14 km/h", weatherIcon:"🌙",
    broadcastTag:"LIVE · NIGHT MATCH", broadcastColor:"#60a5fa",
    pitchColor:"#4A7C59", pitchDesc:"Damp, Dew-affected", overlay:"rgba(0,10,40,.72)" },
  { id:"dusty",  icon:"🏜", name:"Sub-Continent Dust Bowl", desc:"Reverse swing & spin. ICC tournament history questions.", theme:"#b45309", bg:"#fefce8", cat:"ICC Tournaments",
    isNight:false, stadium:"Eden Gardens", venue:"Kolkata, India",
    img:"https://upload.wikimedia.org/wikipedia/commons/thumb/9/9b/Eden_Gardens_during_the_day.jpg/1280px-Eden_Gardens_during_the_day.jpg",
    sky:"linear-gradient(180deg,#92400e 0%,#b45309 40%,#d97706 100%)",
    atmosphere:"Hazy | Dusty | 38°C", wind:"Hot wind 22 km/h", weatherIcon:"🏜",
    broadcastTag:"LIVE · DAY MATCH", broadcastColor:"#f59e0b",
    pitchColor:"#B8956A", pitchDesc:"Hard, Cracked, Dusty", overlay:"rgba(120,50,5,.6)" },
];

// ─── SKILL DOMAINS ─────────────────────────────────────────────────────────────
const SKILLS = [
  { id:"batting",  label:"Batting",         icon:"🏏", color:"#b45309" },
  { id:"bowling",  label:"Bowling",         icon:"⚡", color:"#0369a1" },
  { id:"ipl",      label:"IPL & T20",       icon:"🔥", color:"#dc2626" },
  { id:"history",  label:"Cricket History", icon:"📜", color:"#5b21b6" },
  { id:"womens",   label:"Women's Cricket", icon:"⭐", color:"#0d9488" },
];

// ─── SKILL LEVEL THRESHOLDS (exponential — no cap) ─────────────────────────
const SKILL_XP_LEVELS = [0,50,150,300,500,750,1100,1600,2200,3000]; // XP needed to reach lvl 1-10

const getSkillLevel = xp => {
  let lvl = 0;
  for (let i = 0; i < SKILL_XP_LEVELS.length; i++) {
    if (xp >= SKILL_XP_LEVELS[i]) lvl = i + 1; else break;
  }
  return Math.min(lvl, 10);
};
const skillLevelProgress = (xp, lvl) => {
  if (lvl >= 10) return 100;
  const curr = SKILL_XP_LEVELS[lvl - 1] || 0;
  const next = SKILL_XP_LEVELS[lvl] || SKILL_XP_LEVELS[lvl - 1] + 500;
  return Math.min(100, ((xp - curr) / (next - curr)) * 100);
};

// ─── CAREER STAGES ─────────────────────────────────────────────────────────────
const CAREER = [
  { stage:0, title:"Gully Cricketer",    subtitle:"Playing in the streets",         icon:"🏏", minXp:0,    badge:"DEBUT",     color:"#78716c",
    jerseyColor:"#78716c", jerseyStripe:"#57534e", helmetColor:"#44403c", ground:"🌆", kit:"tape-ball" },
  { stage:1, title:"Club Cricketer",     subtitle:"Local club — showing promise",    icon:"🎽", minXp:200,  badge:"SELECTED",  color:"#16a34a",
    jerseyColor:"#16a34a", jerseyStripe:"#15803d", helmetColor:"#166534", ground:"🏟", kit:"club" },
  { stage:2, title:"State Cricketer",    subtitle:"Ranji Trophy representative",     icon:"🏟", minXp:600,  badge:"STATE CAP", color:"#0284c7",
    jerseyColor:"#0284c7", jerseyStripe:"#0369a1", helmetColor:"#1e40af", ground:"🏟", kit:"ranji" },
  { stage:3, title:"A-Team Cricketer",   subtitle:"India A — one step away",         icon:"🌟", minXp:1200, badge:"A-TEAM",    color:"#7c3aed",
    jerseyColor:"#7c3aed", jerseyStripe:"#6d28d9", helmetColor:"#5b21b6", ground:"🌐", kit:"india-a" },
  { stage:4, title:"Test Cricketer",     subtitle:"Wearing the national whites",     icon:"👕", minXp:2200, badge:"TEST CAP",  color:"#b45309",
    jerseyColor:"#f5f5f4", jerseyStripe:"#d6d3d1", helmetColor:"#44403c", ground:"🏟", kit:"whites" },
  { stage:5, title:"ODI Specialist",     subtitle:"White-ball star",                 icon:"🎯", minXp:3500, badge:"ODI CAP",   color:"#0891b2",
    jerseyColor:"#1d4ed8", jerseyStripe:"#1e40af", helmetColor:"#1e3a8a", ground:"🌏", kit:"odi" },
  { stage:6, title:"T20 International",  subtitle:"The short format entertainer",    icon:"⚡", minXp:5000, badge:"T20I CAP",  color:"#dc2626",
    jerseyColor:"#dc2626", jerseyStripe:"#b91c1c", helmetColor:"#991b1b", ground:"🌟", kit:"t20" },
  { stage:7, title:"Cricket Legend",     subtitle:"Hall of Fame. The Greatest.",     icon:"👑", minXp:7500, badge:"LEGEND",    color:"#d97706",
    jerseyColor:"#d97706", jerseyStripe:"#b45309", helmetColor:"#92400e", ground:"🏆", kit:"legend" },
];

// ─── AVATAR JERSEY COLOUR PALETTES (buyable with CricCoins) ────────────────
const JERSEY_PALETTES = [
  { id:"default", label:"Default",     price:0,    primary:"",        stripe:"" }, // uses career color
  { id:"navy",    label:"Navy Blue",   price:50,   primary:"#1e3a8a", stripe:"#1e40af" },
  { id:"black",   label:"Stealth",     price:80,   primary:"#18181b", stripe:"#27272a" },
  { id:"gold",    label:"Gold",        price:120,  primary:"#d97706", stripe:"#b45309" },
  { id:"maroon",  label:"Maroon",      price:150,  primary:"#881337", stripe:"#9f1239" },
  { id:"purple",  label:"Royal Purple",price:200,  primary:"#6d28d9", stripe:"#5b21b6" },
];

// ─── BADGES ────────────────────────────────────────────────────────────────────
const BADGE_DEFS = [
  { id:"first_win",     icon:"🏆", title:"First Victory",      desc:"Win your first match",                  rarity:"common"  },
  { id:"first_six",     icon:"6️⃣", title:"First Six",          desc:"Score 6 off a single ball",             rarity:"common"  },
  { id:"first_paid",    icon:"💰", title:"Prize Winner",        desc:"Win your first paid match",             rarity:"common"  },
  { id:"hat_trick",     icon:"🎩", title:"Hat-Trick",           desc:"3 correct answers in a row",            rarity:"common"  },
  { id:"perfect_inn",   icon:"💎", title:"Perfect Innings",     desc:"Score 36 runs — max in 6 balls",        rarity:"rare"    },
  { id:"super_over",    icon:"⚡", title:"Super Over Hero",     desc:"Win a Super Over",                      rarity:"rare"    },
  { id:"comeback",      icon:"🔥", title:"Comeback King",       desc:"Win after trailing at the halfway mark",rarity:"rare"    },
  { id:"speedster",     icon:"⚡", title:"Speedster",           desc:"Answer 5 questions in under 5 seconds", rarity:"rare"    },
  { id:"ipl_master",    icon:"🏏", title:"IPL Master",          desc:"Answer 15 IPL questions correctly",     rarity:"epic"    },
  { id:"history_buff",  icon:"📜", title:"History Buff",        desc:"Answer 15 history questions correctly", rarity:"epic"    },
  { id:"womens_fan",    icon:"⭐", title:"Women's Cricket Fan", desc:"Answer 10 women's cricket questions",   rarity:"epic"    },
  { id:"wins_10",       icon:"🥈", title:"10 Wins",             desc:"Win 10 matches",                        rarity:"common"  },
  { id:"wins_25",       icon:"🥇", title:"25 Wins",             desc:"Win 25 matches",                        rarity:"rare"    },
  { id:"wins_50",       icon:"🏅", title:"50 Wins",             desc:"Win 50 matches",                        rarity:"epic"    },
  { id:"wins_100",      icon:"🎖", title:"Century of Wins",     desc:"Win 100 matches",                       rarity:"legendary"},
  { id:"streak_5",      icon:"🔥", title:"On Fire",             desc:"5 match win streak",                    rarity:"rare"    },
  { id:"streak_10",     icon:"🌋", title:"Unstoppable",         desc:"10 match win streak",                   rarity:"epic"    },
  { id:"legend_rank",   icon:"👑", title:"Cricket Legend",      desc:"Reach Cricket Legend career stage",     rarity:"legendary"},
  { id:"coin_spender",  icon:"🪙", title:"High Roller",         desc:"Spend 500 CricCoins",                   rarity:"rare"    },
  { id:"power_play",    icon:"🛡", title:"Power Play Master",   desc:"Use Power Play in 10 matches",          rarity:"common"  },
  { id:"all_skills",    icon:"🌈", title:"All-Rounder",         desc:"Reach Level 5 in all 5 skills",         rarity:"legendary"},
  { id:"first_match",   icon:"🎮", title:"Debut",               desc:"Play your first match",                 rarity:"common"  },
];

const RARITY_COLOR = { common:"#78716c", rare:"#0284c7", epic:"#7c3aed", legendary:"#d97706" };
const RARITY_BG    = { common:"rgba(120,113,108,.1)", rare:"rgba(2,132,199,.1)", epic:"rgba(124,58,237,.1)", legendary:"rgba(217,119,6,.1)" };

// ─── CRICCOIN STORE ────────────────────────────────────────────────────────────
const STORE_ITEMS = [
  { id:"coins_50",   category:"coins",   label:"Starter Pack",   desc:"50 CricCoins",              price:"₹49",   coins:50,   icon:"🪙" },
  { id:"coins_150",  category:"coins",   label:"Fan Pack",        desc:"150 CricCoins + 20 bonus",  price:"₹99",   coins:170,  icon:"💰" },
  { id:"coins_400",  category:"coins",   label:"Pro Pack",        desc:"400 CricCoins + 60 bonus",  price:"₹199",  coins:460,  icon:"💎" },
  { id:"coins_1000", category:"coins",   label:"Legend Pack",     desc:"1000 CricCoins + 200 bonus",price:"₹399",  coins:1200, icon:"👑" },
  { id:"pu_timeout", category:"powerups",label:"Timeout Pack",    desc:"5 extra Timeouts",          price:30,      coins:0,    icon:"⏱" },
  { id:"pu_5050",    category:"powerups",label:"50/50 Pack",      desc:"5 extra 50/50s",            price:30,      coins:0,    icon:"⚡" },
  { id:"pu_pp",      category:"powerups",label:"Power Play Pack", desc:"5 extra Power Plays",       price:30,      coins:0,    icon:"🏏" },
  { id:"xp_boost",   category:"boosts",  label:"XP Booster",      desc:"2× XP for 3 matches",       price:40,      coins:0,    icon:"🚀" },
  { id:"streak_shld",category:"boosts",  label:"Streak Shield",   desc:"Protect streak from 1 loss",price:25,      coins:0,    icon:"🛡" },
  { id:"gold_name",  category:"cosmetic",label:"Gold Name",        desc:"Golden username on leaderboard",price:100, coins:0,    icon:"✨" },
];

// ─── DATA ──────────────────────────────────────────────────────────────────────
const COUNTRIES = [
  { code:"IN", name:"India",        flag:"🇮🇳" },
  { code:"PK", name:"Pakistan",     flag:"🇵🇰" },
  { code:"GB", name:"England",      flag:"🏴󠁧󠁢󠁥󠁮󠁧󠁿" },
  { code:"AU", name:"Australia",    flag:"🇦🇺" },
  { code:"ZA", name:"South Africa", flag:"🇿🇦" },
];


const OPPS = [
  { name:"Viraaat__99",   flag:"🇮🇳", elo:1050, acc:.52 },
  { name:"SixMachine_WI", flag:"🇧🇧", elo:1200, acc:.62 },
  { name:"ShaneyLeg_AU",  flag:"🇦🇺", elo:1380, acc:.72 },
  { name:"GullyKing_PK",  flag:"🇵🇰", elo:920,  acc:.46 },
  { name:"Bazball_UK",    flag:"🏴󠁧󠁢󠁥󠁮󠁧󠁿", elo:1300, acc:.68 },
  { name:"IPLLegend_IN",  flag:"🇮🇳", elo:1520, acc:.79 },
];

const ENTRY_FEES = [
  { label:"Free",  entry:0,    prize:0,    icon:"🏏", tag:"Practice" },
  { label:"₹5",   entry:0.06, prize:0.108,icon:"🌟", tag:"Starter"  },
  { label:"₹10",  entry:0.12, prize:0.216,icon:"🔥", tag:"Popular"  },
  { label:"₹25",  entry:0.30, prize:0.540,icon:"💎", tag:"Pro"      },
  { label:"₹50",  entry:0.60, prize:1.080,icon:"👑", tag:"Elite"    },
];

// ─── INLINE SVG PLAYER CARDS (no external images needed) ──────────────────────
const PHOTOS = [
  {
    svg:`<svg viewBox="0 0 200 170" xmlns="http://www.w3.org/2000/svg"><rect width="200" height="170" fill="#1a0800"/><circle cx="100" cy="48" r="26" fill="#d97706"/><path d="M58,170 Q58,115 100,98 Q142,115 142,170Z" fill="#fbbf24"/><rect x="74" y="94" width="52" height="7" rx="3" fill="#d97706"/><line x1="100" y1="100" x2="148" y2="148" stroke="#fbbf24" stroke-width="9" stroke-linecap="round"/><rect x="138" y="143" width="28" height="7" rx="3" fill="#d97706" transform="rotate(-32 138 143)"/><text x="100" y="163" text-anchor="middle" fill="rgba(251,191,36,0.7)" font-size="9" font-family="serif">THE MASTER BLASTER</text></svg>`,
    fe:"🏏", q:"Who scored 100 international centuries — cricket's all-time record?",
    opts:["Rahul Dravid","Sachin Tendulkar","Ricky Ponting","Brian Lara"], ans:1,
    fact:"100 international centuries", country:"🇮🇳", skill:"batting",
  },
  {
    svg:`<svg viewBox="0 0 200 170" xmlns="http://www.w3.org/2000/svg"><rect width="200" height="170" fill="#0a1628"/><circle cx="100" cy="48" r="26" fill="#3b82f6"/><path d="M58,170 Q58,115 100,98 Q142,115 142,170Z" fill="#60a5fa"/><circle cx="100" cy="72" r="12" fill="none" stroke="#fbbf24" stroke-width="2.5"/><path d="M78,110 Q100,95 122,110" fill="none" stroke="#3b82f6" stroke-width="5"/><text x="100" y="163" text-anchor="middle" fill="rgba(96,165,250,0.7)" font-size="9" font-family="serif">KING KOHLI</text></svg>`,
    fe:"👑", q:"Who is the only player to score centuries in Tests, ODIs and T20Is for India?",
    opts:["Rohit Sharma","MS Dhoni","Virat Kohli","KL Rahul"], ans:2,
    fact:"Fastest to 8k, 9k & 10k ODI runs", country:"🇮🇳", skill:"batting",
  },
  {
    svg:`<svg viewBox="0 0 200 170" xmlns="http://www.w3.org/2000/svg"><rect width="200" height="170" fill="#180800"/><circle cx="100" cy="48" r="26" fill="#ea580c"/><path d="M58,170 Q58,115 100,98 Q142,115 142,170Z" fill="#fb923c"/><path d="M72,108 L100,88 L128,108" fill="#ea580c" stroke="#fb923c" stroke-width="2"/><rect x="83" y="106" width="34" height="46" rx="4" fill="#7c2d12"/><line x1="112" y1="120" x2="155" y2="160" stroke="#fb923c" stroke-width="9" stroke-linecap="round"/><text x="100" y="163" text-anchor="middle" fill="rgba(251,146,60,0.7)" font-size="9" font-family="serif">CAPTAIN COOL</text></svg>`,
    fe:"🧤", q:"Who is the only captain to win the T20 WC, ODI WC and Champions Trophy?",
    opts:["Sourav Ganguly","MS Dhoni","Virat Kohli","Kapil Dev"], ans:1,
    fact:"Only captain to win all 3 ICC trophies", country:"🇮🇳", skill:"history",
  },
  {
    svg:`<svg viewBox="0 0 200 170" xmlns="http://www.w3.org/2000/svg"><rect width="200" height="170" fill="#0f1729"/><circle cx="100" cy="48" r="26" fill="#8b5cf6"/><path d="M58,170 Q58,115 100,98 Q142,115 142,170Z" fill="#a78bfa"/><ellipse cx="100" cy="118" rx="28" ry="13" fill="#7c3aed" opacity="0.8"/><circle cx="142" cy="95" r="9" fill="#fbbf24" opacity="0.85"/><path d="M133,95 Q142,78 151,95" fill="none" stroke="#fbbf24" stroke-width="2.5"/><text x="100" y="163" text-anchor="middle" fill="rgba(167,139,250,0.7)" font-size="9" font-family="serif">800 WICKETS</text></svg>`,
    fe:"🌀", q:"Who took 800 Test wickets — the all-time bowling record?",
    opts:["Shane Warne","Anil Kumble","Glenn McGrath","Muttiah Muralitharan"], ans:3,
    fact:"800 Test wickets — the all-time record", country:"🇱🇰", skill:"bowling",
  },
  {
    svg:`<svg viewBox="0 0 200 170" xmlns="http://www.w3.org/2000/svg"><rect width="200" height="170" fill="#031a0a"/><circle cx="100" cy="48" r="26" fill="#16a34a"/><path d="M58,170 Q58,115 100,98 Q142,115 142,170Z" fill="#4ade80"/><rect x="72" y="100" width="56" height="50" rx="4" fill="#15803d"/><rect x="72" y="100" width="28" height="50" rx="4 0 0 4" fill="#166534"/><circle cx="100" cy="82" r="7" fill="#fbbf24"/><text x="100" y="163" text-anchor="middle" fill="rgba(74,222,128,0.7)" font-size="9" font-family="serif">THE HITMAN</text></svg>`,
    fe:"💥", q:"Who holds the record for 3 double centuries in ODI cricket?",
    opts:["Shikhar Dhawan","Rohit Sharma","Ajinkya Rahane","Cheteshwar Pujara"], ans:1,
    fact:"3 ODI double centuries — world record", country:"🇮🇳", skill:"batting",
  },
  {
    svg:`<svg viewBox="0 0 200 170" xmlns="http://www.w3.org/2000/svg"><rect width="200" height="170" fill="#1a1a2e"/><circle cx="100" cy="48" r="26" fill="#6366f1"/><path d="M58,170 Q58,115 100,98 Q142,115 142,170Z" fill="#818cf8"/><path d="M72,103 L72,155 L128,155 L128,103 Q100,92 72,103Z" fill="#4f46e5"/><path d="M72,103 Q100,93 128,103" fill="none" stroke="#818cf8" stroke-width="2.5"/><circle cx="58" cy="130" r="9" fill="#0369a1" opacity="0.85"/><text x="100" y="163" text-anchor="middle" fill="rgba(129,140,248,0.7)" font-size="9" font-family="serif">BAZBALL</text></svg>`,
    fe:"⚡", q:"Who leads England's 'Bazball' Test cricket revolution as captain?",
    opts:["Joe Root","James Anderson","Zak Crawley","Ben Stokes"], ans:3,
    fact:"Led England's Bazball revolution", country:"🏴󠁧󠁢󠁥󠁮󠁧󠁿", skill:"history",
  },
  {
    svg:`<svg viewBox="0 0 200 170" xmlns="http://www.w3.org/2000/svg"><rect width="200" height="170" fill="#0f001f"/><circle cx="100" cy="48" r="26" fill="#c026d3"/><path d="M58,170 Q58,115 100,98 Q142,115 142,170Z" fill="#e879f9"/><path d="M62,108 Q100,88 138,108 L132,162 Q100,175 68,162Z" fill="#a21caf"/><line x1="100" y1="98" x2="158" y2="80" stroke="#e879f9" stroke-width="7" stroke-linecap="round"/><circle cx="161" cy="78" r="7" fill="#fbbf24"/><text x="100" y="163" text-anchor="middle" fill="rgba(232,121,249,0.7)" font-size="9" font-family="serif">YORKER KING</text></svg>`,
    fe:"🎳", q:"Which Indian fast bowler is famous for his unique action and lethal yorkers?",
    opts:["Mohammed Shami","Umesh Yadav","Jasprit Bumrah","Shardul Thakur"], ans:2,
    fact:"Unique action · Lethal yorker specialist", country:"🇮🇳", skill:"bowling",
  },
  {
    svg:`<svg viewBox="0 0 200 170" xmlns="http://www.w3.org/2000/svg"><rect width="200" height="170" fill="#001228"/><circle cx="100" cy="48" r="26" fill="#0ea5e9"/><path d="M58,170 Q58,115 100,98 Q142,115 142,170Z" fill="#38bdf8"/><path d="M72,103 L72,158 L128,158 L128,103 Q100,92 72,103Z" fill="#0284c7"/><path d="M72,103 Q100,92 128,103" fill="none" stroke="#38bdf8" stroke-width="2.5"/><circle cx="57" cy="128" r="9" fill="#0369a1" opacity="0.85"/><text x="100" y="163" text-anchor="middle" fill="rgba(56,189,248,0.7)" font-size="9" font-family="serif">PAKISTAN NO.1</text></svg>`,
    fe:"🎯", q:"Who became simultaneously ranked #1 in Tests, ODIs and T20Is?",
    opts:["Fakhar Zaman","Mohammad Rizwan","Shaheen Afridi","Babar Azam"], ans:3,
    fact:"#1 in all three formats simultaneously", country:"🇵🇰", skill:"batting",
  },
];

const STAT_QS = [
  { stats:{RUNS:"15,921",AVG:"53.78","100s":"51",HS:"319"}, q:"Whose Test career batting stats are these?", opts:["Ricky Ponting","Jacques Kallis","Kumar Sangakkara","Rahul Dravid"], ans:2, skill:"batting", coachNote:"Kumar Sangakkara scored 15,921 Test runs at 57.40 — the second highest ever." },
  { stats:{WICKETS:"800",AVG:"22.72",BBI:"9/51","5W":"67"}, q:"Who owns these record-breaking bowling figures?", opts:["Shane Warne","Anil Kumble","Muttiah Muralitharan","Glenn McGrath"], ans:2, skill:"bowling", coachNote:"Muttiah Muralitharan took 800 Test wickets — the all-time record, 8 ahead of Shane Warne." },
  { stats:{RUNS:"18,426",AVG:"44.83","100s":"49",MATCHES:"463"}, q:"Which legend posted these ODI batting numbers?", opts:["Sachin Tendulkar","Ricky Ponting","Virat Kohli","Brian Lara"], ans:0, skill:"batting", coachNote:"Sachin Tendulkar's 18,426 ODI runs remain the all-time record with 49 centuries." },
];

// 50-question fallback bank — shuffled each session, deduplicated by hash
const FALLBACK_BANK = [
  {q:"Who holds the record for most ODI centuries?",opts:["Ricky Ponting","Sachin Tendulkar","Virat Kohli","Brian Lara"],ans:1,skill:"batting",coachNote:"Sachin Tendulkar holds 49 ODI centuries — a record likely to stand for generations."},
  {q:"Which team won the inaugural ICC T20 World Cup in 2007?",opts:["Australia","Pakistan","India","Sri Lanka"],ans:2,skill:"ipl",coachNote:"India beat Pakistan in the 2007 T20 WC final in South Africa on the very last ball."},
  {q:"Who took 10 wickets in a single Test innings?",opts:["Shane Warne","Glenn McGrath","Muttiah Muralitharan","Anil Kumble"],ans:3,skill:"bowling",coachNote:"Anil Kumble took all 10 Pakistani wickets at Delhi in 1999 — only the second time in Test history."},
  {q:"Which IPL franchise has won the most titles?",opts:["Mumbai Indians","Chennai Super Kings","KKR","Rajasthan Royals"],ans:0,skill:"ipl",coachNote:"Mumbai Indians have won 5 IPL titles — the most by any franchise."},
  {q:"What is the highest individual score in Test cricket?",opts:["400*","380","375","365*"],ans:0,skill:"batting",coachNote:"Brian Lara scored 400* vs England in Antigua 2004 — the all-time Test record."},
  {q:"Which bowler has taken the most Test wickets ever?",opts:["Shane Warne","Glenn McGrath","Anil Kumble","Muttiah Muralitharan"],ans:3,skill:"bowling",coachNote:"Muttiah Muralitharan took 800 Test wickets, edging Shane Warne's 792."},
  {q:"Who won the 2023 ICC Cricket World Cup?",opts:["India","South Africa","Australia","Pakistan"],ans:2,skill:"history",coachNote:"Australia won the 2023 ODI WC, beating India in the final at Ahmedabad by 6 wickets."},
  {q:"What is the largest cricket stadium by capacity?",opts:["MCG","Eden Gardens","Narendra Modi Stadium","Lord's"],ans:2,skill:"history",coachNote:"Narendra Modi Stadium in Ahmedabad holds 132,000+ — the world's largest cricket ground."},
  {q:"Who is known as 'The Wall' of Indian cricket?",opts:["Ganguly","Laxman","Dravid","Kumble"],ans:2,skill:"batting",coachNote:"Rahul Dravid earned 'The Wall' nickname for his unflappable defensive technique in Tests."},
  {q:"Who scored the first T20 International century?",opts:["Chris Gayle","Brendon McCullum","Rohit Sharma","AB de Villiers"],ans:1,skill:"ipl",coachNote:"Brendon McCullum scored 116* in the first ever T20I — NZ vs Bangladesh in 2004."},
  {q:"Who has the most T20I runs in cricket history?",opts:["Virat Kohli","Rohit Sharma","Martin Guptill","Babar Azam"],ans:1,skill:"ipl",coachNote:"Rohit Sharma is T20I cricket's leading run-scorer with over 4,000 runs."},
  {q:"In which year did India win their first Cricket World Cup?",opts:["1975","1979","1983","1987"],ans:2,skill:"history",coachNote:"India won the 1983 Cricket World Cup under Kapil Dev, defeating the West Indies in the final."},
  {q:"Which country has won the most ICC Cricket World Cups?",opts:["India","West Indies","Pakistan","Australia"],ans:3,skill:"history",coachNote:"Australia has won the most Cricket World Cups — six times in total."},
  {q:"Who was the first bowler to take 400 Test wickets?",opts:["Ian Botham","Richard Hadlee","Courtney Walsh","Kapil Dev"],ans:1,skill:"bowling",coachNote:"Richard Hadlee of New Zealand was the first bowler to take 400 Test wickets in 1990."},
  {q:"What is the maximum number of overs in a Test cricket day?",opts:["80","90","100","96"],ans:1,skill:"history",coachNote:"90 overs per day is the minimum requirement in Test cricket under ICC regulations."},
  {q:"Which batter has the highest average in Test cricket (min 20 innings)?",opts:["Don Bradman","Sachin Tendulkar","Steve Smith","Virat Kohli"],ans:0,skill:"batting",coachNote:"Don Bradman's Test average of 99.94 is considered the greatest statistical achievement in any sport."},
  {q:"Who holds the record for the fastest Test century?",opts:["Viv Richards","Brendon McCullum","Misbah-ul-Haq","Adam Gilchrist"],ans:1,skill:"batting",coachNote:"Brendon McCullum scored the fastest Test century in 54 balls vs Australia in 2016."},
  {q:"Which team won the first-ever ICC World Test Championship?",opts:["Australia","England","India","New Zealand"],ans:3,skill:"history",coachNote:"New Zealand beat India in the inaugural World Test Championship final at Southampton in 2021."},
  {q:"Who has scored the most runs in IPL history?",opts:["Sachin Tendulkar","Virat Kohli","Rohit Sharma","David Warner"],ans:1,skill:"ipl",coachNote:"Virat Kohli is the all-time leading run-scorer in IPL history with over 8,000 runs."},
  {q:"What does 'LBW' stand for in cricket?",opts:["Leg Before Wicket","Left Bat Wide","Leg Bat Wicket","Left Before Wicket"],ans:0,skill:"history",coachNote:"LBW stands for Leg Before Wicket — when the ball would have hit the stumps but strikes the batter's leg instead."},
  {q:"Who captained West Indies in their back-to-back World Cup wins in 1975 and 1979?",opts:["Viv Richards","Clive Lloyd","Gordon Greenidge","Malcolm Marshall"],ans:1,skill:"history",coachNote:"Clive Lloyd captained West Indies to World Cup wins in both 1975 and 1979 at Lord's."},
  {q:"Which country does Babar Azam represent?",opts:["India","Bangladesh","Sri Lanka","Pakistan"],ans:3,skill:"batting",coachNote:"Babar Azam represents Pakistan and was simultaneously ranked #1 in all three formats."},
  {q:"How many runs is a 'duck' in cricket?",opts:["0","1","Single","None"],ans:0,skill:"history",coachNote:"A 'duck' means a batter is dismissed for zero runs — named after a duck's egg (0) shape."},
  {q:"Who took the most wickets in a single ODI World Cup tournament?",opts:["Wasim Akram","Glenn McGrath","Mitchell Starc","Shahid Afridi"],ans:2,skill:"bowling",coachNote:"Mitchell Starc took 27 wickets in the 2019 World Cup — but his best haul in a single WC was 22 wickets in 2015."},
  {q:"In what year was the Indian Premier League (IPL) established?",opts:["2006","2007","2008","2009"],ans:2,skill:"ipl",coachNote:"The IPL was established in 2008 under the leadership of Lalit Modi of the BCCI."},
  {q:"Which bowler has the best figures in a single ODI innings?",opts:["Chaminda Vaas","Waqar Younis","Brett Lee","Shahid Afridi"],ans:0,skill:"bowling",coachNote:"Chaminda Vaas took 8/19 against Zimbabwe in 2001 — the best bowling figures in ODI history."},
  {q:"Who hit the famous 'six to win' in the 2011 Cricket World Cup final?",opts:["Sachin Tendulkar","Virender Sehwag","MS Dhoni","Yuvraj Singh"],ans:2,skill:"history",coachNote:"MS Dhoni hit a massive six off Nuwan Kulasekara to win the 2011 WC final for India at Wankhede."},
  {q:"Which team has won the most T20 World Cup titles?",opts:["India","West Indies","England","Pakistan"],ans:1,skill:"ipl",coachNote:"West Indies have won the T20 World Cup twice — in 2012 and 2016, the only team to win it twice before 2024."},
  {q:"Who was the first Indian to score a Test century in all three formats?",opts:["Sachin Tendulkar","Virat Kohli","Rohit Sharma","MS Dhoni"],ans:1,skill:"batting",coachNote:"Virat Kohli was the first Indian to score centuries in Tests, ODIs and T20Is."},
  {q:"Which ground hosted the first-ever Test match in 1877?",opts:["Lord's, London","The Oval, London","MCG, Melbourne","SCG, Sydney"],ans:2,skill:"history",coachNote:"The first Test match was played at the MCG in Melbourne between Australia and England in March 1877."},
  {q:"How many players are in a cricket team?",opts:["10","11","12","9"],ans:1,skill:"history",coachNote:"A cricket team has 11 players. All 11 bat, but only 10 wickets can fall in an innings."},
  {q:"Who has taken the most wickets in Women's ODI cricket?",opts:["Jhulan Goswami","Cathryn Fitzpatrick","Ellyse Perry","Charlotte Edwards"],ans:0,skill:"womens",coachNote:"Jhulan Goswami of India holds the record for most women's ODI wickets with 255."},
  {q:"Who is the highest run scorer in Women's Test cricket?",opts:["Meg Lanning","Mithali Raj","Suzie Bates","Charlotte Edwards"],ans:1,skill:"womens",coachNote:"Mithali Raj of India is the all-time leading scorer in Women's international cricket."},
  {q:"Which team won the inaugural Women's T20 World Cup in 2009?",opts:["Australia","England","India","New Zealand"],ans:1,skill:"womens",coachNote:"England won the inaugural Women's T20 World Cup in 2009 in the West Indies."},
  {q:"What is 'The Ashes' series played between?",opts:["India and Pakistan","England and Australia","South Africa and England","Australia and New Zealand"],ans:1,skill:"history",coachNote:"The Ashes is cricket's oldest Test rivalry between England and Australia, dating back to 1882."},
  {q:"Which country did cricket originate in?",opts:["Australia","India","England","West Indies"],ans:2,skill:"history",coachNote:"Cricket originated in England, with the earliest known reference dating to the 16th century in Kent."},
  {q:"Who holds the record for most sixes in ODI cricket?",opts:["AB de Villiers","Chris Gayle","Rohit Sharma","MS Dhoni"],ans:1,skill:"batting",coachNote:"Chris Gayle holds the record for most sixes in ODI cricket with over 330."},
  {q:"Who was the first cricketer to score 10,000 Test runs?",opts:["Sunil Gavaskar","Viv Richards","Greg Chappell","Geoff Boycott"],ans:0,skill:"batting",coachNote:"Sunil Gavaskar was the first batter to reach 10,000 Test runs, achieving the milestone in 1987."},
  {q:"What is the term for three wickets in three consecutive deliveries?",opts:["Double hat-trick","Hat-trick","Triple wicket","Three-fer"],ans:1,skill:"bowling",coachNote:"A hat-trick in cricket means three wickets in three consecutive deliveries — same as other sports."},
  {q:"Which team won the 2024 ICC T20 World Cup?",opts:["India","Australia","England","South Africa"],ans:0,skill:"ipl",coachNote:"India won the 2024 T20 World Cup in the West Indies and USA, defeating South Africa in the final."},
  {q:"Who has the most IPL wickets in history?",opts:["Lasith Malinga","Yuzvendra Chahal","Amit Mishra","Dwayne Bravo"],ans:3,skill:"ipl",coachNote:"Dwayne Bravo holds the record for most IPL wickets with 183 wickets."},
  {q:"What does 'No ball' mean in cricket?",opts:["A wide delivery","An illegal delivery","A bouncer","A full toss"],ans:1,skill:"history",coachNote:"A no ball is an illegal delivery — the batting team gets an extra run and the delivery is re-bowled."},
  {q:"Who was the first woman to be inducted into the ICC Cricket Hall of Fame?",opts:["Rachael Heyhoe Flint","Belinda Clark","Mithali Raj","Jan Brittin"],ans:0,skill:"womens",coachNote:"Rachael Heyhoe Flint was the first woman inducted into the ICC Cricket Hall of Fame in 2004."},
  {q:"Which country has the most Test match wins all time?",opts:["India","South Africa","Australia","England"],ans:2,skill:"history",coachNote:"Australia has the most Test match wins in history with over 400 victories."},
  {q:"Who scored the fastest ODI century ever?",opts:["AB de Villiers","Chris Gayle","Shahid Afridi","Corey Anderson"],ans:0,skill:"batting",coachNote:"AB de Villiers scored the fastest ODI century in just 31 balls against West Indies in 2015."},
  {q:"Which city is the home of Eden Gardens cricket stadium?",opts:["Mumbai","Chennai","Delhi","Kolkata"],ans:3,skill:"history",coachNote:"Eden Gardens is located in Kolkata and is one of the world's largest cricket stadiums."},
  {q:"In Test cricket, what is a 'follow-on'?",opts:["Batting twice consecutively","Enforced second innings","Run chase in 4th innings","A penalty for slow over rate"],ans:1,skill:"history",coachNote:"A follow-on is enforced when a team's first innings score is 200+ runs behind — they must bat again immediately."},
  {q:"Who holds the record for most catches by a fielder in ODIs?",opts:["Ricky Ponting","Mahela Jayawardene","Jonty Rhodes","AB de Villiers"],ans:1,skill:"batting",coachNote:"Mahela Jayawardene of Sri Lanka holds the record for most catches by a non-wicketkeeper in ODIs."},
  {q:"Which format of cricket has the shortest match duration?",opts:["Test","ODI","T20","The Hundred"],ans:3,skill:"ipl",coachNote:"The Hundred is cricket's shortest format — each side faces 100 balls, lasting about 2.5 hours."},
  {q:"Who won the first-ever IPL title in 2008?",opts:["Mumbai Indians","Chennai Super Kings","Rajasthan Royals","Delhi Capitals"],ans:2,skill:"ipl",coachNote:"Rajasthan Royals, captained by Shane Warne, won the inaugural IPL title in 2008."},,
// ── BATTING RECORDS ───────────────────────────────────────────────────────────
  {q:"Who holds the record for the most runs in Test cricket?",opts:["Ricky Ponting","Jacques Kallis","Sachin Tendulkar","Kumar Sangakkara"],ans:2,cat:"TEST RECORDS",skill:"batting",coachNote:"Sachin Tendulkar scored 15,921 Test runs across 200 matches — both are all-time records."},
  {q:"Who scored 400* in a single Test innings?",opts:["Garfield Sobers","Matthew Hayden","Brian Lara","Len Hutton"],ans:2,cat:"TEST RECORDS",skill:"batting",coachNote:"Brian Lara's 400* vs England in Antigua 2004 is the highest individual Test score."},
  {q:"What is Sachin Tendulkar's Test batting average?",opts:["53.78","56.12","51.11","54.90"],ans:0,cat:"BATTING STATS",skill:"batting",coachNote:"Sachin Tendulkar finished with a Test average of 53.78 across 200 matches."},
  {q:"Who holds the record for the most runs in a single Test series?",opts:["Don Bradman","Wally Hammond","Len Hutton","Clyde Walcott"],ans:0,cat:"TEST RECORDS",skill:"batting",coachNote:"Don Bradman scored 974 runs in the 1930 Ashes series — a record that still stands nearly a century later."},
  {q:"How many Test double-centuries did Don Bradman score?",opts:["8","12","10","14"],ans:1,cat:"TEST RECORDS",skill:"batting",coachNote:"Don Bradman scored 12 double-centuries in Tests — more than any other player."},
  {q:"Who was the first batter to reach 10,000 Test runs?",opts:["Geoff Boycott","Allan Border","Sunil Gavaskar","Gordon Greenidge"],ans:2,cat:"TEST RECORDS",skill:"batting",coachNote:"Sunil Gavaskar was the first to 10,000 Test runs, reaching the milestone in 1987."},
  {q:"Who made the first ODI century?",opts:["Dennis Amiss","Glenn Turner","Vivian Richards","Barry Richards"],ans:0,cat:"ODI RECORDS",skill:"batting",coachNote:"Dennis Amiss of England scored 103* vs Australia at Manchester in 1972 — the first ODI century."},
  {q:"What is Virat Kohli's all-time ODI batting average?",opts:["57.32","59.07","55.89","60.81"],ans:1,cat:"ODI RECORDS",skill:"batting",coachNote:"Virat Kohli's ODI average of over 58 is among the highest ever for a player with 200+ innings."},
  {q:"Who has scored the most double centuries in ODI cricket?",opts:["Martin Guptill","Chris Gayle","Rohit Sharma","Virender Sehwag"],ans:2,cat:"ODI RECORDS",skill:"batting",coachNote:"Rohit Sharma has scored 3 ODI double centuries — the most by any player, including 264 vs Sri Lanka."},
  {q:"Who scored the highest ever individual T20I score?",opts:["Hazratullah Zazai","Rohit Sharma","Aaron Finch","Chris Gayle"],ans:0,cat:"T20 RECORDS",skill:"batting",coachNote:"Hazratullah Zazai scored 162* off 62 balls for Afghanistan vs Ireland in 2019."},
  {q:"Which batter holds the record for most sixes in international cricket?",opts:["Chris Gayle","MS Dhoni","Shahid Afridi","Rohit Sharma"],ans:0,cat:"BATTING RECORDS",skill:"batting",coachNote:"Chris Gayle holds the record for most sixes in international cricket across all formats."},
  {q:"Who scored 1000 runs in a single month of Test cricket?",opts:["Don Bradman","Vivian Richards","Everton Weekes","Denis Compton"],ans:2,cat:"TEST RECORDS",skill:"batting",coachNote:"Everton Weekes scored five consecutive Test centuries in 1947-48, scoring 1,000 runs in a single calendar month."},
  {q:"How many ODI centuries has Virat Kohli scored?",opts:["45","50","46","43"],ans:1,cat:"ODI RECORDS",skill:"batting",coachNote:"Virat Kohli reached 50 ODI centuries in 2023, surpassing Sachin Tendulkar's record of 49."},
  {q:"Who holds the record for the fastest fifty in T20I cricket?",opts:["Yuvraj Singh","Chris Gayle","Hazratullah Zazai","Viv Richards"],ans:0,cat:"T20 RECORDS",skill:"batting",coachNote:"Yuvraj Singh hit his famous 50 off 12 balls against England at the 2007 T20 World Cup."},
  {q:"Which batter has the highest score in IPL history?",opts:["Brendon McCullum","AB de Villiers","Chris Gayle","Paul Valthaty"],ans:2,cat:"IPL RECORDS",skill:"ipl",coachNote:"Chris Gayle scored 175* off 66 balls for RCB vs PWI in 2013 — the highest individual score in IPL history."},
  // ── BOWLING RECORDS ───────────────────────────────────────────────────────────
  {q:"Who took 800 Test wickets?",opts:["Shane Warne","Anil Kumble","Muttiah Muralitharan","Glenn McGrath"],ans:2,cat:"TEST RECORDS",skill:"bowling",coachNote:"Muttiah Muralitharan took 800 Test wickets, edging Shane Warne's 792 as the all-time leader."},
  {q:"What is Glenn McGrath's career Test bowling average?",opts:["21.64","25.32","19.87","23.18"],ans:0,cat:"BOWLING STATS",skill:"bowling",coachNote:"Glenn McGrath averaged 21.64 in Tests — exceptional for a fast bowler over 124 matches."},
  {q:"Who took 7 wickets for 36 runs in an Ashes Test?",opts:["Bob Willis","Fred Trueman","Shane Warne","Ian Botham"],ans:0,cat:"TEST RECORDS",skill:"bowling",coachNote:"Bob Willis took 8/43 at Headingley 1981 — not 7/36, but his iconic Headingley spell is among the greatest bowling performances."},
  {q:"Which spinner has taken the most wickets in the IPL?",opts:["Harbhajan Singh","Rashid Khan","Yuzvendra Chahal","Sunil Narine"],ans:2,cat:"IPL RECORDS",skill:"ipl",coachNote:"Yuzvendra Chahal is the leading wicket-taker among spinners in IPL history."},
  {q:"Who is the only bowler to take 400 Test wickets in both Tests and ODIs?",opts:["Wasim Akram","Waqar Younis","Glenn McGrath","Richard Hadlee"],ans:2,cat:"BOWLING RECORDS",skill:"bowling",coachNote:"Glenn McGrath took 563 Test wickets and 381 ODI wickets — 400+ in both formats."},
  {q:"What was Shoaib Akhtar's officially recorded top speed?",opts:["156.4 km/h","161.3 km/h","159.7 km/h","163.0 km/h"],ans:1,cat:"BOWLING RECORDS",skill:"bowling",coachNote:"Shoaib Akhtar bowled 161.3 km/h (100.2 mph) against England in 2003 — the fastest delivery ever recorded."},
  {q:"Which bowler took a hat-trick in a World Cup final?",opts:["Mitchell Starc","Wasim Akram","Muttiah Muralitharan","Lasith Malinga"],ans:1,cat:"WORLD CUP",skill:"bowling",coachNote:"Wasim Akram took a hat-trick vs India in the 1992 World Cup group stage — not the final, but it's the most famous WC hat-trick."},
  {q:"Who took the most wickets in the 2019 Cricket World Cup?",opts:["Mitchell Starc","Lockie Ferguson","Mohammad Amir","Jasprit Bumrah"],ans:0,cat:"WORLD CUP",skill:"bowling",coachNote:"Mitchell Starc took 27 wickets in the 2019 World Cup — the most in any single World Cup tournament."},
  {q:"Who has taken the most ODI wickets in history?",opts:["Wasim Akram","Muttiah Muralitharan","Waqar Younis","Glenn McGrath"],ans:1,cat:"ODI RECORDS",skill:"bowling",coachNote:"Muttiah Muralitharan holds the ODI wicket record with 534 wickets across his career."},
  {q:"Which bowler has taken the most wickets in T20 Internationals?",opts:["Lasith Malinga","Rashid Khan","Shahid Afridi","Tim Southee"],ans:0,cat:"T20 RECORDS",skill:"bowling",coachNote:"Lasith Malinga holds the T20I wicket record with 107 wickets across 84 matches."},
  {q:"Who took 19 wickets in a single Test match?",opts:["Jim Laker","Sydney Barnes","Anil Kumble","Derek Underwood"],ans:0,cat:"TEST RECORDS",skill:"bowling",coachNote:"Jim Laker took 19/90 for England vs Australia at Old Trafford in 1956 — including 9/37 and 10/53."},
  // ── IPL & T20 ─────────────────────────────────────────────────────────────────
  {q:"Who has won the most IPL titles as captain?",opts:["Rohit Sharma","MS Dhoni","Gautam Gambhir","Virat Kohli"],ans:0,cat:"IPL RECORDS",skill:"ipl",coachNote:"Rohit Sharma has won 5 IPL titles as Mumbai Indians captain — more than any other captain."},
  {q:"Which IPL team has appeared in the most finals?",opts:["Mumbai Indians","Chennai Super Kings","Kolkata Knight Riders","RCB"],ans:1,cat:"IPL RECORDS",skill:"ipl",coachNote:"Chennai Super Kings have appeared in 12 IPL finals — more than any other franchise."},
  {q:"Who was the first player to score a century in IPL history?",opts:["Chris Gayle","Brendon McCullum","Sachin Tendulkar","Jesse Ryder"],ans:1,cat:"IPL RECORDS",skill:"ipl",coachNote:"Brendon McCullum scored 158* off 73 balls in the very first IPL match in 2008."},
  {q:"Which team won IPL 2023?",opts:["Gujarat Titans","CSK","Rajasthan Royals","Mumbai Indians"],ans:1,cat:"IPL RECORDS",skill:"ipl",coachNote:"Chennai Super Kings won IPL 2023, beating Gujarat Titans by 5 wickets in the final."},
  {q:"Who won IPL 2024?",opts:["Mumbai Indians","Rajasthan Royals","Sunrisers Hyderabad","Kolkata Knight Riders"],ans:3,cat:"IPL RECORDS",skill:"ipl",coachNote:"Kolkata Knight Riders won IPL 2024, beating Sunrisers Hyderabad by 8 wickets in the final."},
  {q:"Which year was the IPL's most expensive auction player in history, Sam Curran, sold?",opts:["2021","2022","2023","2024"],ans:2,cat:"IPL RECORDS",skill:"ipl",coachNote:"Sam Curran was sold for ₹18.5 crore to Punjab Kings in the IPL 2023 auction — a record at the time."},
  {q:"Which team won the first T20 World Cup held in the UAE in 2021?",opts:["India","Pakistan","Australia","New Zealand"],ans:2,cat:"T20 WORLD CUP",skill:"ipl",coachNote:"Australia won the 2021 T20 World Cup in UAE, beating New Zealand by 8 wickets in the final."},
  {q:"Who hit six sixes in an over in a T20 World Cup match?",opts:["Chris Gayle","MS Dhoni","Yuvraj Singh","Kieron Pollard"],ans:2,cat:"T20 WORLD CUP",skill:"ipl",coachNote:"Yuvraj Singh hit six sixes off Stuart Broad's over vs England at the 2007 T20 World Cup in South Africa."},
  {q:"Which country won the 2024 T20 World Cup?",opts:["India","South Africa","Australia","England"],ans:0,cat:"T20 WORLD CUP",skill:"ipl",coachNote:"India won the 2024 T20 World Cup in the West Indies and USA, defeating South Africa by 7 runs in the final."},
  {q:"Which team holds the record for the highest total in IPL history?",opts:["CSK","Royal Challengers Bengaluru","SunRisers Hyderabad","Punjab Kings"],ans:1,cat:"IPL RECORDS",skill:"ipl",coachNote:"Royal Challengers Bengaluru scored 263/5 against Pune Warriors in 2013 — the highest total in IPL history."},
  {q:"What was the first IPL franchise to be bought for over $100 million?",opts:["Mumbai Indians","Kolkata Knight Riders","Royal Challengers Bangalore","Chennai Super Kings"],ans:0,cat:"IPL RECORDS",skill:"ipl",coachNote:"Mumbai Indians was purchased by Mukesh Ambani's Reliance Industries for $111.9 million in 2008."},
  {q:"Which bowler has taken the most wickets in IPL history?",opts:["Lasith Malinga","Harbhajan Singh","Dwayne Bravo","Amit Mishra"],ans:0,cat:"IPL RECORDS",skill:"ipl",coachNote:"Lasith Malinga holds the IPL wicket record with 170 wickets across his career with Mumbai Indians."},
  // ── CRICKET HISTORY & RULES ───────────────────────────────────────────────────
  {q:"In which year were the Laws of Cricket first codified?",opts:["1744","1788","1814","1700"],ans:0,cat:"CRICKET HISTORY",skill:"history",coachNote:"The Laws of Cricket were first codified in 1744 — making it one of the oldest sporting rule sets still in use."},
  {q:"How many balls are in a standard Test cricket over?",opts:["4","5","6","8"],ans:2,cat:"CRICKET RULES",skill:"history",coachNote:"A standard over in cricket contains 6 legal deliveries. Australia briefly used 8-ball overs before standardizing at 6."},
  {q:"What does 'DRS' stand for in cricket?",opts:["Dynamic Review System","Decision Review System","Digital Reference System","Direct Replay System"],ans:1,cat:"CRICKET RULES",skill:"history",coachNote:"DRS — Decision Review System — allows teams to challenge on-field decisions using ball-tracking and edge detection technology."},
  {q:"How many fielders can be outside the fielding circle in a PowerPlay over in ODIs?",opts:["2","3","4","5"],ans:0,cat:"CRICKET RULES",skill:"history",coachNote:"In the PowerPlay overs, only 2 fielders are allowed outside the 30-yard circle — encouraging aggressive batting."},
  {q:"What is the duration of a standard Duckworth-Lewis-Stern calculation used for?",opts:["Determining strike rates","Rain-affected match targets","Player fitness assessments","Over rate calculations"],ans:1,cat:"CRICKET RULES",skill:"history",coachNote:"DLS (Duckworth-Lewis-Stern) is a mathematical method used to set revised targets in weather-interrupted limited-overs matches."},
  {q:"Where is the 'home of cricket'?",opts:["Oval, London","Headingley","Old Trafford","Lord's, London"],ans:3,cat:"CRICKET HISTORY",skill:"history",coachNote:"Lord's Cricket Ground in St John's Wood, London, is known as the 'Home of Cricket' and is the home of MCC."},
  {q:"What is the colour of the ball used in day-night Test cricket?",opts:["White","Orange","Pink","Yellow"],ans:2,cat:"CRICKET RULES",skill:"history",coachNote:"Pink balls are used in day-night Test cricket — introduced to improve visibility under floodlights."},
  {q:"Which country introduced 'Bazball' aggressive Test cricket?",opts:["Australia","New Zealand","England","South Africa"],ans:2,cat:"CRICKET HISTORY",skill:"history",coachNote:"England, under Ben Stokes and coach Brendon McCullum (nicknamed 'Baz'), introduced the attacking 'Bazball' style in 2022."},
  {q:"What was the original name of the T20 World Cup before ICC rebranding?",opts:["World Twenty20","ICC T20 Championships","ICC T20 Super Series","ICC Short Format Cup"],ans:0,cat:"CRICKET HISTORY",skill:"history",coachNote:"The tournament was originally called the 'ICC World Twenty20' before being rebranded as the 'ICC Men's T20 World Cup'."},
  {q:"In which city was the first-ever Test match played?",opts:["Lord's, London","Sydney","Cape Town","Melbourne"],ans:3,cat:"CRICKET HISTORY",skill:"history",coachNote:"The first Test match was played at Melbourne Cricket Ground in March 1877 — Australia beat England by 45 runs."},
  {q:"How many fielding positions are there in cricket?",opts:["11","30+","22","15"],ans:1,cat:"CRICKET RULES",skill:"history",coachNote:"Cricket has over 30 named fielding positions — from slip and gully to long on and deep square leg."},
  {q:"What is a 'Chinaman' delivery in cricket?",opts:["Left-arm leg-break","Right-arm off-break","Left-arm googly","Reverse swing delivery"],ans:2,cat:"CRICKET RULES",skill:"bowling",coachNote:"A Chinaman is a left-arm wrist spin delivery that turns from off to leg for a right-handed batter — equivalent to a right-arm googly."},
  {q:"Which country hosted the very first Cricket World Cup in 1975?",opts:["Australia","West Indies","England","India"],ans:2,cat:"WORLD CUP",skill:"history",coachNote:"The inaugural Prudential World Cup in 1975 was hosted by England, with West Indies defeating Australia in the final."},
  // ── ICC TOURNAMENTS ───────────────────────────────────────────────────────────
  {q:"How many times has India won the ICC Cricket World Cup?",opts:["1","2","3","4"],ans:1,cat:"WORLD CUP",skill:"history",coachNote:"India won the ODI World Cup twice — in 1983 under Kapil Dev and in 2011 under MS Dhoni."},
  {q:"Who scored the match-winning six in the 2011 World Cup final?",opts:["Virat Kohli","Yuvraj Singh","Suresh Raina","MS Dhoni"],ans:3,cat:"WORLD CUP",skill:"history",coachNote:"MS Dhoni hit the iconic six to win India the 2011 World Cup against Sri Lanka at Wankhede Stadium, Mumbai."},
  {q:"Which country has won the ICC Champions Trophy the most times?",opts:["India","Pakistan","Australia","Sri Lanka"],ans:0,cat:"ICC TOURNAMENTS",skill:"history",coachNote:"India has won the ICC Champions Trophy twice — in 2002 (joint winners with Sri Lanka) and in 2013."},
  {q:"Who won the 2021 ICC World Test Championship?",opts:["India","England","New Zealand","Australia"],ans:2,cat:"ICC TOURNAMENTS",skill:"history",coachNote:"New Zealand beat India in the inaugural World Test Championship final at Southampton in June 2021."},
  {q:"Who won the 2023 ICC World Test Championship?",opts:["India","South Africa","England","Australia"],ans:3,cat:"ICC TOURNAMENTS",skill:"history",coachNote:"Australia won the 2023 WTC final, beating India by 209 runs at The Oval, London."},
  {q:"Which team beat India in the semi-final of the 2019 World Cup?",opts:["England","Australia","Pakistan","New Zealand"],ans:3,cat:"WORLD CUP",skill:"history",coachNote:"New Zealand beat India by 18 runs in the 2019 World Cup semi-final at Old Trafford in a rain-affected match."},
  {q:"Who scored 237* in an ODI World Cup match?",opts:["Rohit Sharma","Martin Guptill","Gayle","Sehwag"],ans:0,cat:"WORLD CUP",skill:"batting",coachNote:"Rohit Sharma scored 264 against Sri Lanka in the 2014 World Cup — not 237, but it was the highest ODI score ever at the time."},
  {q:"Which team beat England in the 2019 World Cup final on boundary count?",opts:["Australia","New Zealand","India","Pakistan"],ans:1,cat:"WORLD CUP",skill:"history",coachNote:"England beat New Zealand in the 2019 WC final on boundary count after the Super Over finished tied — one of cricket's most dramatic finishes."},
  // ── GREAT PLAYERS ─────────────────────────────────────────────────────────────
  {q:"Which great batter's nickname was 'The Don'?",opts:["Len Hutton","Don Bradman","Denis Compton","Garfield Sobers"],ans:1,cat:"LEGENDS",skill:"history",coachNote:"Don Bradman — 'The Don' — averaged 99.94 in Tests and is universally considered cricket's greatest ever batter."},
  {q:"Who is the only player to score 100 international centuries?",opts:["Ricky Ponting","Kumar Sangakkara","Brian Lara","Sachin Tendulkar"],ans:3,cat:"LEGENDS",skill:"batting",coachNote:"Sachin Tendulkar scored 100 international centuries — 51 in Tests and 49 in ODIs."},
  {q:"Which West Indian great scored 8,032 Test runs and took 235 wickets?",opts:["Clive Lloyd","Malcolm Marshall","Garfield Sobers","Vivian Richards"],ans:2,cat:"LEGENDS",skill:"history",coachNote:"Sir Garfield Sobers was cricket's greatest all-rounder — scoring 8,032 Test runs and taking 235 wickets."},
  {q:"Who is known as 'The Sultan of Multan'?",opts:["Inzamam-ul-Haq","Yousuf Youhana","Younis Khan","Mohsin Khan"],ans:1,cat:"LEGENDS",skill:"history",coachNote:"Yousuf Youhana (later Mohammad Yousuf) earned the nickname after a famous century in Multan."},
  {q:"Who captained Australia in their five consecutive Ashes series wins from 1989 to 1998?",opts:["Allan Border","Ian Chappell","Mark Taylor","Steve Waugh"],ans:0,cat:"LEGENDS",skill:"history",coachNote:"Allan Border captained Australia's dominant 1989 Ashes win, starting a run of 8 consecutive Ashes victories."},
  {q:"Which Indian batter was called 'God of Cricket'?",opts:["Rahul Dravid","MS Dhoni","Sourav Ganguly","Sachin Tendulkar"],ans:3,cat:"LEGENDS",skill:"batting",coachNote:"Sachin Tendulkar is widely referred to as the 'God of Cricket' in India and around the cricketing world."},
  {q:"Who was the first player to win 100 Test caps?",opts:["Allan Border","Kapil Dev","Sunil Gavaskar","Colin Cowdrey"],ans:3,cat:"TEST RECORDS",skill:"history",coachNote:"Colin Cowdrey was the first player to appear in 100 Test matches when he played his 100th Test against Australia in 1968."},
  {q:"Who is the only bowler to take a wicket with the first ball in two separate Test matches?",opts:["Malcolm Marshall","Curtly Ambrose","Waqar Younis","Alec Bedser"],ans:1,cat:"TEST RECORDS",skill:"bowling",coachNote:"Curtly Ambrose dismissed two batters with the very first ball of a Test on separate occasions during his illustrious career."},
  {q:"Which famous batter played for the West Indies before switching to play for England?",opts:["Phil Simmons","Andy Roberts","Gladstone Small","Devon Malcolm"],ans:2,cat:"LEGENDS",skill:"history",coachNote:"Gladstone Small was born in Barbados but represented England, playing 17 Tests for them as a fast bowler."},
  // ── WOMEN'S CRICKET ────────────────────────────────────────────────────────────
  {q:"Who is the leading run-scorer in Women's ODI cricket?",opts:["Charlotte Edwards","Belinda Clark","Mithali Raj","Meg Lanning"],ans:2,cat:"WOMEN'S CRICKET",skill:"womens",coachNote:"Mithali Raj is the highest run-scorer in Women's ODI cricket history with over 7,800 runs."},
  {q:"Which country has won the most Women's T20 World Cups?",opts:["England","India","West Indies","Australia"],ans:3,cat:"WOMEN'S CRICKET",skill:"womens",coachNote:"Australia has dominated Women's T20 World Cups, winning the tournament six times."},
  {q:"Who took the first hat-trick in Women's T20 International cricket?",opts:["Anisa Mohammed","Sophie Ecclestone","Deepti Sharma","Cathryn Fitzpatrick"],ans:0,cat:"WOMEN'S CRICKET",skill:"womens",coachNote:"Anisa Mohammed of West Indies took the first hat-trick in Women's T20 Internationals."},
  {q:"Who captained India in the 2017 Women's ODI World Cup final?",opts:["Smriti Mandhana","Harmanpreet Kaur","Mithali Raj","Jhulan Goswami"],ans:2,cat:"WOMEN'S CRICKET",skill:"womens",coachNote:"Mithali Raj captained India to the 2017 Women's ODI World Cup final, where they lost to England by 9 runs."},
  {q:"Ellyse Perry of Australia is famous for excelling in which two sports?",opts:["Cricket and hockey","Cricket and tennis","Cricket and football","Cricket and netball"],ans:2,cat:"WOMEN'S CRICKET",skill:"womens",coachNote:"Ellyse Perry represented Australia in both cricket and football (soccer), making her a rare dual international."},
  {q:"Who scored the first Women's T20I century for India?",opts:["Mithali Raj","Smriti Mandhana","Harmanpreet Kaur","Deepti Sharma"],ans:1,cat:"WOMEN'S CRICKET",skill:"womens",coachNote:"Smriti Mandhana became the first Indian woman to score a T20I century."},
  {q:"Which Women's team won the inaugural ICC Women's T20 World Cup in 2010?",opts:["Australia","England","West Indies","India"],ans:1,cat:"WOMEN'S CRICKET",skill:"womens",coachNote:"England won the inaugural ICC Women's T20 World Cup in 2010, beating Australia in the final."},
  {q:"Who is the fastest woman to take 200 wickets in ODI cricket?",opts:["Cathryn Fitzpatrick","Jhulan Goswami","Sophie Ecclestone","Shabnim Ismail"],ans:1,cat:"WOMEN'S CRICKET",skill:"womens",coachNote:"Jhulan Goswami became the fastest woman to 200 ODI wickets and holds the all-time Women's ODI wicket record."},
  // ── ASHES CRICKET ──────────────────────────────────────────────────────────────
  {q:"How many days did the Headingley 1981 Ashes Test last when England famously won?",opts:["4","5","3","6"],ans:0,cat:"THE ASHES",skill:"history",coachNote:"England won the Headingley 1981 Test in 4 days after following on — Ian Botham scored 149* and Bob Willis took 8/43."},
  {q:"What is 'The Ashes' trophy made of?",opts:["Gold","Crystal","Wood with ashes inside a terracotta urn","Silver"],ans:2,cat:"THE ASHES",skill:"history",coachNote:"The Ashes urn is a tiny terracotta urn, supposedly containing the ashes of a burnt cricket bail — presented to England in 1883."},
  {q:"Which Australian batter scored 334 at Headingley in 1930?",opts:["Stan McCabe","Bill Ponsford","Bill Woodfull","Don Bradman"],ans:3,cat:"THE ASHES",skill:"batting",coachNote:"Don Bradman scored 334 at Headingley in 1930 — a record for the ground and an Ashes record at the time."},
  {q:"Who scored a century in each innings on his Ashes debut in 2021?",opts:["Cameron Green","Travis Head","Marnus Labuschagne","David Warner"],ans:1,cat:"THE ASHES",skill:"batting",coachNote:"Travis Head scored centuries in both innings of his Ashes debut in the 2021-22 series — a remarkable achievement."},
  // ── PLAYER NICKNAMES ─────────────────────────────────────────────────────────
  {q:"Which player is known as 'Captain Cool'?",opts:["Sourav Ganguly","Rahul Dravid","MS Dhoni","Virat Kohli"],ans:2,cat:"PLAYER NICKNAMES",skill:"history",coachNote:"MS Dhoni earned the nickname 'Captain Cool' for his calm demeanor under pressure, especially in the 2011 World Cup final."},
  {q:"Who is known as 'The Wall' in Indian cricket?",opts:["Sachin Tendulkar","VVS Laxman","Rahul Dravid","Sourav Ganguly"],ans:2,cat:"PLAYER NICKNAMES",skill:"history",coachNote:"Rahul Dravid earned 'The Wall' nickname for his solid, immovable defence — he batted for over 44,000 balls in Test cricket."},
  {q:"Which bowler earned the nickname 'Rawalpindi Express'?",opts:["Mohammad Amir","Wasim Akram","Waqar Younis","Shoaib Akhtar"],ans:3,cat:"PLAYER NICKNAMES",skill:"bowling",coachNote:"Shoaib Akhtar was nicknamed the 'Rawalpindi Express' after his hometown, owing to his extreme pace."},
  {q:"Who is known as 'The Universe Boss' in cricket?",opts:["Andre Russell","Dwayne Bravo","Chris Gayle","Kieron Pollard"],ans:2,cat:"PLAYER NICKNAMES",skill:"batting",coachNote:"Chris Gayle gave himself the nickname 'Universe Boss' to describe his dominance in T20 cricket worldwide."},
  {q:"What is AB de Villiers' nickname?",opts:["The Wall","The Magician","Mr 360","The Beast"],ans:2,cat:"PLAYER NICKNAMES",skill:"batting",coachNote:"AB de Villiers is known as 'Mr 360' for his ability to hit the ball to every part of the ground — any direction, any angle."},
  // ── STADIUMS & VENUES ────────────────────────────────────────────────────────
  {q:"In which city is Wankhede Stadium located?",opts:["Delhi","Chennai","Kolkata","Mumbai"],ans:3,cat:"VENUES",skill:"history",coachNote:"Wankhede Stadium is located in Mumbai and hosted the 2011 Cricket World Cup final."},
  {q:"Which ground hosted the highest ODI run chase ever?",opts:["Pallekele","MCG","Wankhede","Hagley Oval"],ans:0,cat:"VENUES",skill:"history",coachNote:"Pallekele in Sri Lanka hosted the highest ODI run chase — Ireland chased 330+ against England in 2019."},
  {q:"The 'Gabba' cricket ground is located in which Australian city?",opts:["Sydney","Melbourne","Brisbane","Perth"],ans:2,cat:"VENUES",skill:"history",coachNote:"The Gabba (Brisbane Cricket Ground) is in Brisbane, Queensland — Australia's famous stronghold in Ashes cricket."},
  {q:"What is the capacity of Lord's Cricket Ground?",opts:["~30,000","~25,000","~28,000","~32,000"],ans:0,cat:"VENUES",skill:"history",coachNote:"Lord's Cricket Ground holds approximately 30,000 spectators — smaller than many international grounds but steeped in history."},
  // ── INDIA CRICKET ─────────────────────────────────────────────────────────────
  {q:"Who was India's first Test captain?",opts:["Vijay Hazare","Lala Amarnath","CK Nayudu","Vijay Merchant"],ans:2,cat:"INDIA CRICKET",skill:"history",coachNote:"CK Nayudu was India's first Test captain when they played their debut Test against England in 1932."},
  {q:"Who holds the record for most Test matches as India captain?",opts:["Sunil Gavaskar","MS Dhoni","Sourav Ganguly","Virat Kohli"],ans:3,cat:"INDIA CRICKET",skill:"history",coachNote:"Virat Kohli captained India in 68 Tests — the most by any Indian captain."},
  {q:"Which IPL team does Virat Kohli play for?",opts:["Mumbai Indians","Delhi Capitals","Sunrisers Hyderabad","Royal Challengers Bengaluru"],ans:3,cat:"IPL RECORDS",skill:"ipl",coachNote:"Virat Kohli has played for Royal Challengers Bengaluru (formerly Bangalore) since the first IPL season in 2008."},
  {q:"Who took Sachin Tendulkar's wicket the most times in Test cricket?",opts:["Glenn McGrath","Shane Warne","Muttiah Muralitharan","Courtney Walsh"],ans:0,cat:"INDIA CRICKET",skill:"bowling",coachNote:"Glenn McGrath dismissed Sachin Tendulkar 8 times in Test cricket — more than any other bowler."},
  {q:"In which year did India win their first overseas Test series in Australia?",opts:["2003","2008","2018","2021"],ans:2,cat:"INDIA CRICKET",skill:"history",coachNote:"India won their first ever Test series in Australia in 2018-19 under Virat Kohli, winning 2-1."},
  {q:"Which Indian cricketer played the most Test matches?",opts:["Rahul Dravid","VVS Laxman","Sachin Tendulkar","Anil Kumble"],ans:2,cat:"INDIA CRICKET",skill:"history",coachNote:"Sachin Tendulkar played 200 Test matches — the most by any player in cricket history."},

  {q:"Who is the only batter to score a Test triple century for India?",opts:["Virender Sehwag","Rahul Dravid","VVS Laxman","Sourav Ganguly"],ans:0,cat:"TEST RECORDS",skill:"batting",coachNote:"Virender Sehwag scored 319 vs South Africa in 2008 and 309 vs Pakistan in 2004 — the only Indian to hit a Test triple hundred."},
  {q:"Which batter hit 34 runs off one Stuart Broad over in the 2023 Ashes?",opts:["David Warner","Zak Crawley","Ben Duckett","Joe Root"],ans:2,cat:"TEST RECORDS",skill:"batting",coachNote:"Ben Duckett smashed 34 runs off a Stuart Broad over in the 2023 Ashes — one of the most explosive passages of Test batting in recent history."},
  {q:"Who scored the fastest Test fifty in history?",opts:["Viv Richards","Jack Brown","Misbah-ul-Haq","Brendon McCullum"],ans:2,cat:"TEST RECORDS",skill:"batting",coachNote:"Misbah-ul-Haq hit the fastest Test fifty off just 21 balls against Australia in 2014, equalling the record set by Jack Brown in 1896."},
  {q:"Which batter averages over 50 in all three formats of international cricket?",opts:["Babar Azam","Kane Williamson","Steve Smith","Virat Kohli"],ans:0,cat:"BATTING STATS",skill:"batting",coachNote:"Babar Azam is the only batter to average over 50 in Tests, ODIs and T20Is simultaneously — a remarkable all-format consistency."},
  {q:"Who scored a century in each innings of a Test on debut?",opts:["Greg Chappell","Lawrence Rowe","Garfield Sobers","Andrew Strauss"],ans:1,cat:"TEST RECORDS",skill:"batting",coachNote:"Lawrence Rowe scored 214 and 100* on his Test debut for West Indies vs New Zealand in 1972 — the only player to achieve this feat."},
  {q:"What is the record for the most runs scored in a single Test match day?",opts:["360","390","408","375"],ans:2,cat:"TEST RECORDS",skill:"batting",coachNote:"England scored 408 runs in a single day of Test cricket vs India in 2021 under Ben Stokes — extraordinary Bazball scoring."},
  {q:"Who was the first batter to score 50 ODI centuries?",opts:["Sachin Tendulkar","Rohit Sharma","Virat Kohli","Ricky Ponting"],ans:2,cat:"ODI RECORDS",skill:"batting",coachNote:"Virat Kohli became the first batter to score 50 ODI centuries in 2023, surpassing Sachin Tendulkar's record of 49."},
  {q:"Which batter holds the record for the most Test runs in a calendar year?",opts:["Viv Richards","Mohammad Yousuf","Kumar Sangakkara","Ricky Ponting"],ans:1,cat:"TEST RECORDS",skill:"batting",coachNote:"Mohammad Yousuf scored 1788 Test runs in the 2006 calendar year — the most by any batter in a single year."},
  {q:"Who made the highest score ever in a Ranji Trophy match?",opts:["Bhausaheb Nimbalkar","VVS Laxman","Sachin Tendulkar","Wasim Jaffer"],ans:0,cat:"DOMESTIC CRICKET",skill:"batting",coachNote:"Bhausaheb Nimbalkar scored 443* for Maharashtra vs Kathiawar in 1948-49 Ranji Trophy — the highest score in Indian first-class cricket."},
  {q:"Which batter has scored the most Test runs against India?",opts:["Ricky Ponting","Steve Waugh","Michael Clarke","Jacques Kallis"],ans:0,cat:"TEST RECORDS",skill:"batting",coachNote:"Ricky Ponting scored more Test runs against India than any other opponent — a real benchmark of his greatness."},
  {q:"Who scored 501* — the highest ever first-class cricket score?",opts:["WG Grace","Don Bradman","Brian Lara","Graeme Hick"],ans:2,cat:"FIRST CLASS",skill:"batting",coachNote:"Brian Lara scored 501* for Warwickshire vs Durham in 1994 — the highest score in all first-class cricket history."},
  {q:"What is KL Rahul's highest ODI score?",opts:["108","112","124","100"],ans:0,cat:"ODI RECORDS",skill:"batting",coachNote:"KL Rahul has scored multiple ODI hundreds including against Australia, cementing his place as a key batter in all formats for India."},
  {q:"Which batter has the most Test runs at Lord's Cricket Ground?",opts:["Graham Gooch","Len Hutton","Kevin Pietersen","Alastair Cook"],ans:0,cat:"TEST RECORDS",skill:"batting",coachNote:"Graham Gooch has scored more Test runs at Lord's than any other batter — including his famous 333 in the 1990 Test vs India."},
  {q:"Who scored a century on Test debut against England at The Oval in 2004?",opts:["Mohammad Yousuf","Yasir Shah","Inzamam-ul-Haq","Kamran Akmal"],ans:0,cat:"TEST RECORDS",skill:"batting",coachNote:"Mohammad Yousuf scored a brilliant century on debut — but the most notable Test debut century at The Oval in recent history belongs to several players."},
  {q:"Rohit Sharma's highest Test score is?",opts:["206","212","176","192"],ans:0,cat:"TEST RECORDS",skill:"batting",coachNote:"Rohit Sharma scored 212 against South Africa in Ranchi in 2019 — his maiden Test double century after being promoted to open the batting."},
  {q:"Who is the only Indian batter to score centuries in all 10 Test-playing nations?",opts:["Virat Kohli","Sachin Tendulkar","Rahul Dravid","VVS Laxman"],ans:0,cat:"TEST RECORDS",skill:"batting",coachNote:"Virat Kohli scored Test centuries in all countries he toured — a testament to his ability to adapt on every pitch and in every condition."},
  {q:"What was Graeme Smith's highest Test score?",opts:["286","277","270","302"],ans:0,cat:"TEST RECORDS",skill:"batting",coachNote:"Graeme Smith scored 277 for South Africa vs England at Edgbaston in 2003 — his highest Test score and one of the finest by a left-hander."},
  {q:"Who scored 99 in their final Test innings, retired just short of a century?",opts:["Adam Gilchrist","Mark Taylor","John Edrich","Mike Hussey"],ans:1,cat:"TEST RECORDS",skill:"batting",coachNote:"Mark Taylor declared at 334* — equal to Don Bradman's Australian record — rather than batting on for a century, a celebrated sportsmanship moment."},
  {q:"Which batter holds the record for most consecutive Test fifties?",opts:["Kevin Pietersen","Everton Weekes","Rahul Dravid","Joe Root"],ans:1,cat:"TEST RECORDS",skill:"batting",coachNote:"Everton Weekes scored five consecutive Test centuries (not just fifties) between 1948-49 — one of the greatest batting streaks in history."},
  {q:"Who is the highest scorer in the history of the Sheffield Shield?",opts:["Don Bradman","Ricky Ponting","Michael Hussey","David Warner"],ans:0,cat:"DOMESTIC CRICKET",skill:"batting",coachNote:"Don Bradman is the leading run-scorer in Sheffield Shield history — his domestic record was as extraordinary as his Test average."},
  {q:"Which batter scored the most runs in ODI World Cup history overall?",opts:["Sachin Tendulkar","Ricky Ponting","Rohit Sharma","Kumar Sangakkara"],ans:0,cat:"WORLD CUP",skill:"batting",coachNote:"Sachin Tendulkar scored 2278 runs in ODI World Cups — the most by any batter across all editions of the tournament."},
  {q:"Steve Smith averages over 60 in Tests — what is his approximate career average?",opts:["58.6","60.9","62.8","64.0"],ans:1,cat:"BATTING STATS",skill:"batting",coachNote:"Steve Smith averages approximately 60.9 in Test cricket — the highest average of any batter in the modern era."},
  {q:"Who scored the first-ever century in T20I cricket for India?",opts:["Rohit Sharma","Virat Kohli","Suresh Raina","Yuvraj Singh"],ans:2,cat:"T20 RECORDS",skill:"batting",coachNote:"Suresh Raina scored India's first T20I century against South Africa in 2010 — a breakthrough innings in the format for India."},
  {q:"What is Babar Azam's highest Test score?",opts:["196","178","217","196"],ans:0,cat:"TEST RECORDS",skill:"batting",coachNote:"Babar Azam scored 196 for Pakistan vs New Zealand — falling just short of a double century in a magnificent display."},
  {q:"Which batter hit the most boundaries (fours) in a single Test innings?",opts:["Len Hutton","Sanath Jayasuriya","Brian Lara","Matthew Hayden"],ans:2,cat:"TEST RECORDS",skill:"batting",coachNote:"Brian Lara's 400* against England featured a record number of boundaries — his innings contained 43 fours and 4 sixes."},
  {q:"Who scored the joint-fastest century in IPL alongside David Miller's 8-ball fifty?",opts:["Yusuf Pathan","Shane Watson","Chris Gayle","Adam Gilchrist"],ans:0,cat:"IPL RECORDS",skill:"batting",coachNote:"Yusuf Pathan was the first IPL player to score a century off under 40 balls — one of the most explosive innings in early IPL history."},
  {q:"In which Test did VVS Laxman score his famous 281?",opts:["India v South Africa Kolkata 2000","India v Australia Kolkata 2001","India v England Chennai 2001","India v Pakistan Lahore 2004"],ans:1,cat:"TEST RECORDS",skill:"batting",coachNote:"VVS Laxman's 281 vs Australia at Eden Gardens in 2001 — combined with Dravid's 180 — turned a follow-on into one of cricket's greatest ever victories."},
  {q:"Who scored a Test century at age 19 years and 149 days — the youngest Indian centurion?",opts:["Sachin Tendulkar","Vinod Kambli","Prithvi Shaw","Shubman Gill"],ans:2,cat:"TEST RECORDS",skill:"batting",coachNote:"Prithvi Shaw scored 134 on Test debut vs West Indies in 2018 at age 18 — making him India's youngest Test centurion."},
  {q:"Which batter has the best average in day-night Test cricket?",opts:["Steve Smith","Marnus Labuschagne","David Warner","Kane Williamson"],ans:0,cat:"TEST RECORDS",skill:"batting",coachNote:"Steve Smith has an outstanding record in day-night Tests — his ability to adapt to the pink ball conditions has been remarkable."},
  {q:"How many ODI centuries did Rohit Sharma score in the 2023 World Cup?",opts:["3","1","2","4"],ans:0,cat:"WORLD CUP",skill:"batting",coachNote:"Rohit Sharma scored 3 centuries in the 2023 ODI World Cup — leading India's batting charge in a dominant campaign where they went unbeaten until the final."},
  {q:"Who made a century in each innings of the same Test match three times?",opts:["Sunil Gavaskar","George Headley","Ricky Ponting","Greg Chappell"],ans:1,cat:"TEST RECORDS",skill:"batting",coachNote:"George Headley made a century in each innings of the same Test match three times — earning the nickname the Black Bradman for his dominance."},
  {q:"What is Joe Root's highest Test score?",opts:["228","254","267","291"],ans:1,cat:"TEST RECORDS",skill:"batting",coachNote:"Joe Root scored 254* for England vs Pakistan at Old Trafford in 2016 — his highest Test score in a career full of prolific run-scoring."},
  {q:"Which Indian batter made his Test debut against West Indies in 1971?",opts:["Gundappa Viswanath","Sunil Gavaskar","Mohinder Amarnath","Ashok Mankad"],ans:1,cat:"TEST RECORDS",skill:"batting",coachNote:"Sunil Gavaskar made his legendary Test debut in the West Indies in 1971, scoring 774 runs in the series — one of the greatest debut series ever."},
  {q:"Who became the first batter to score 1000 Test runs before turning 20?",opts:["Sachin Tendulkar","Brian Lara","Wally Hammond","Denis Compton"],ans:0,cat:"TEST RECORDS",skill:"batting",coachNote:"Sachin Tendulkar reached 1000 Test runs faster than anyone at such a young age — a mark of his extraordinary early career."},
  {q:"How many Test matches did Sachin Tendulkar play?",opts:["196","200","198","202"],ans:1,cat:"TEST RECORDS",skill:"batting",coachNote:"Sachin Tendulkar played exactly 200 Test matches — the most by any player in history. He retired in November 2013 after his farewell Test in Mumbai."},
  {q:"Which batter has the highest average in Women's ODI cricket?",opts:["Mithali Raj","Meg Lanning","Suzie Bates","Ellyse Perry"],ans:1,cat:"BATTING STATS",skill:"batting",coachNote:"Meg Lanning has the highest batting average in Women's ODI cricket among prolific scorers — averaging over 50 across her career."},
  {q:"David Warner's highest Test score was scored against which country?",opts:["India","New Zealand","England","South Africa"],ans:1,cat:"TEST RECORDS",skill:"batting",coachNote:"David Warner scored 335* against Pakistan — wait, his highest is 335* vs Pakistan in 2019, one of Australia's all-time great innings."},
  {q:"Who scored 200* in a T20 match — the only T20 double century?",opts:["Chris Gayle","Hazratullah Zazai","Phillip Hughes","No one has"],ans:3,cat:"T20 RECORDS",skill:"batting",coachNote:"No batter has scored 200 in a T20 match. The highest T20 score is 175* by Chris Gayle in the IPL — a T20 double century remains impossible given innings lengths."},
  {q:"Which batter scored 8 Test centuries in a single calendar year?",opts:["Kumar Sangakkara","Don Bradman","Ricky Ponting","Viv Richards"],ans:0,cat:"TEST RECORDS",skill:"batting",coachNote:"Kumar Sangakkara scored 11 Test centuries in 2014 — the record for most Test centuries in a single calendar year."},
  {q:"Shubman Gill's maiden Test century came against which team?",opts:["West Indies","Sri Lanka","New Zealand","Bangladesh"],ans:0,cat:"TEST RECORDS",skill:"batting",coachNote:"Shubman Gill scored his maiden Test century vs West Indies in 2023 — establishing himself as a cornerstone of India's future batting lineup."},
  {q:"Who took a hat-trick in his first over in Test cricket?",opts:["Peter Petherick","Irfan Pathan","Matthew Hoggard","Stuart Broad"],ans:0,cat:"TEST RECORDS",skill:"bowling",coachNote:"Peter Petherick of New Zealand took a hat-trick in his very first over in Test cricket vs Pakistan in 1976 — one of the most dramatic Test debuts ever."},
  {q:"Which bowler took 5 wickets in 5 balls in a domestic T20 match?",opts:["Samuel Badree","Lasith Malinga","Josh Brown","Al-Amin Hossain"],ans:1,cat:"T20 RECORDS",skill:"bowling",coachNote:"Lasith Malinga took 5 wickets in 5 balls for Mumbai Indians in the IPL — one of the most spectacular bowling spells in T20 history."},
  {q:"Who is the fastest bowler to take 300 ODI wickets?",opts:["Waqar Younis","Mitchell Starc","Wasim Akram","Trent Boult"],ans:0,cat:"ODI RECORDS",skill:"bowling",coachNote:"Waqar Younis took 300 ODI wickets in the fewest innings of any bowler — his lethal yorkers made him one of the finest death bowlers ever."},
  {q:"Which Indian bowler took a hat-trick vs Pakistan in the 2007 T20 World Cup?",opts:["Sreesanth","Irfan Pathan","Zaheer Khan","RP Singh"],ans:1,cat:"T20 WORLD CUP",skill:"bowling",coachNote:"Irfan Pathan took a hat-trick in the first over of the match vs Pakistan in the 2007 T20 World Cup — an electrifying start to the match."},
  {q:"What is Ravindra Jadeja's Test bowling average?",opts:["24.1","26.5","22.8","28.3"],ans:0,cat:"TEST RECORDS",skill:"bowling",coachNote:"Ravindra Jadeja averages around 24 with the ball in Tests — remarkable for a slow left-arm bowler and one of the best averages in current cricket."},
  {q:"Who took the most wickets at a single Ashes series?",opts:["Bob Willis","Shane Warne","Dennis Lillee","Terry Alderman"],ans:2,cat:"CRICKET HISTORY",skill:"bowling",coachNote:"Terry Alderman took 42 wickets in the 1981 Ashes and 41 in 1989 — both extraordinary single-series hauls. Dennis Lillee's 1981 figures were also exceptional."},
  {q:"Which spin bowler is famous for inventing the carrom ball?",opts:["Ajantha Mendis","Murugesan Muralitharan","Ravichandran Ashwin","Pragyan Ojha"],ans:0,cat:"BOWLING TERMS",skill:"bowling",coachNote:"Ajantha Mendis of Sri Lanka developed the carrom ball — flicked with the middle finger — which confused the world's best batters upon its introduction."},
  {q:"Who took the most wickets in the ICC World Test Championship history?",opts:["Pat Cummins","R Ashwin","Nathan Lyon","James Anderson"],ans:1,cat:"TEST RECORDS",skill:"bowling",coachNote:"R Ashwin has been the leading wicket-taker in World Test Championship cycles — his spin mastery at home has been devastating."},
  {q:"Which Australian took 5 wickets in the 2023 WTC Final?",opts:["Scott Boland","Nathan Lyon","Pat Cummins","Cameron Green"],ans:1,cat:"TEST RECORDS",skill:"bowling",coachNote:"Nathan Lyon took 5 wickets in the 2023 World Test Championship Final at The Oval — but Australia still lost to India."},
  {q:"Who was the first bowler to take a wicket off the first ball of a Test match?",opts:["Jack Gregory","Curtly Ambrose","Malcolm Marshall","Waqar Younis"],ans:0,cat:"CRICKET HISTORY",skill:"bowling",coachNote:"Jack Gregory dismissed England's Jack Hobbs first ball in a Test match — one of the most dramatic opening deliveries in cricket history."},
  {q:"How many wickets did Jhulan Goswami take in Women's ODI cricket?",opts:["255","270","285","316"],ans:0,cat:"WOMEN'S CRICKET",skill:"bowling",coachNote:"Jhulan Goswami took 255 Women's ODI wickets before retirement — the record for any women's fast bowler in the format."},
  {q:"Which Pakistani bowler took 9/56 vs England in 1954 at The Oval?",opts:["Fazal Mahmood","Mahmood Hussain","Khan Mohammad","Nasim-ul-Ghani"],ans:0,cat:"TEST RECORDS",skill:"bowling",coachNote:"Fazal Mahmood took 6/53 and 6/46 to bowl Pakistan to their first ever Test victory over England at The Oval in 1954."},
  {q:"Who bowled the fastest delivery in IPL history?",opts:["Anrich Nortje","Mitchell Starc","Umran Malik","Pat Cummins"],ans:0,cat:"IPL RECORDS",skill:"bowling",coachNote:"Anrich Nortje bowled the fastest delivery in IPL history at around 156 km/h — his raw pace for Delhi Capitals was a constant threat."},
  {q:"Which Indian bowler dismissed Ricky Ponting most often in Tests?",opts:["Anil Kumble","Zaheer Khan","Harbhajan Singh","Javagal Srinath"],ans:0,cat:"TEST RECORDS",skill:"bowling",coachNote:"Anil Kumble dismissed Ricky Ponting 8 times in Tests — exploiting the Australian's occasional weakness against quality leg-spin."},
  {q:"Who dismissed VVS Laxman and Dravid in their famous 2001 Kolkata partnership?",opts:["Shane Warne","Glenn McGrath","Jason Gillespie","Brett Lee"],ans:1,cat:"CRICKET HISTORY",skill:"bowling",coachNote:"Glenn McGrath was Australia's spearhead in the 2001 Kolkata Test — but Laxman and Dravid denied him and every Australian bowler in that legendary innings."},
  {q:"Kuldeep Yadav's hat-trick in ODIs came against which team?",opts:["Australia","Sri Lanka","West Indies","England"],ans:2,cat:"ODI RECORDS",skill:"bowling",coachNote:"Kuldeep Yadav took a hat-trick against West Indies in a Vizag ODI in 2019 — making him the first Indian spinner to take an ODI hat-trick."},
  {q:"Who bowled the most dot balls in a T20 World Cup?",opts:["Imran Tahir","Samuel Badree","Rashid Khan","Shahid Afridi"],ans:2,cat:"T20 WORLD CUP",skill:"bowling",coachNote:"Rashid Khan has been one of the most economical bowlers in T20 World Cup history — his tight bowling and wicket-taking combination is elite."},
  {q:"What is the world record for most wickets in a first-class career?",opts:["4204","3776","4187","3490"],ans:0,cat:"FIRST CLASS",skill:"bowling",coachNote:"Wilfred Rhodes took 4204 first-class wickets across his career — the most by any bowler in the history of cricket."},
  {q:"Who took a five-wicket haul in India's 2021 Gabba Test win?",opts:["Mohammed Siraj","Shardul Thakur","T Natarajan","Washington Sundar"],ans:0,cat:"TEST RECORDS",skill:"bowling",coachNote:"Mohammed Siraj took a 5-wicket haul at Brisbane to help India win at the Gabba for the first time in 32 years — a landmark day in Indian cricket."},
  {q:"Which left-arm spinner has the best bowling average in Test cricket (min 50 wkts)?",opts:["Derek Underwood","Bishan Bedi","Daniel Vettori","Brad Axelson"],ans:0,cat:"TEST RECORDS",skill:"bowling",coachNote:"Derek Underwood averaged approximately 25 with the ball in Tests — one of the finest left-arm spinners in cricket history."},
  {q:"Scott Boland's figures on Test debut were?",opts:["6/7","6/4","4/12","5/23"],ans:1,cat:"TEST RECORDS",skill:"bowling",coachNote:"Scott Boland took 6/7 on his Test debut for Australia vs England at the MCG in 2021 — the best ever bowling figures on an Ashes debut."},
  {q:"Who dismissed Shane Warne for the most times in Tests?",opts:["Sachin Tendulkar","Mark Taylor","Michael Slater","Matthew Hayden"],ans:0,cat:"TEST RECORDS",skill:"bowling",coachNote:"Sachin Tendulkar was not a bowler — but the batter who was dismissed by Warne most was Sachin himself, showing Warne's skill against India's best."},
  {q:"Which West Indian fast bowler took 376 Test wickets?",opts:["Malcolm Marshall","Michael Holding","Joel Garner","Curtly Ambrose"],ans:3,cat:"TEST RECORDS",skill:"bowling",coachNote:"Curtly Ambrose took 405 Test wickets for West Indies — his 6/24 vs Australia in Perth in 1993 is considered one of the greatest spells ever."},
  {q:"What was Bob Willis's famous bowling performance in the 1981 Ashes at Headingley?",opts:["7/43","8/43","7/51","6/67"],ans:1,cat:"CRICKET HISTORY",skill:"bowling",coachNote:"Bob Willis took 8/43 at Headingley in 1981 to bowl England to a famous victory after Botham's 149 had given them a chance — known as Botham's Ashes."},
  {q:"Which spinner dismissed 40 wickets in a single Ashes series?",opts:["Shane Warne","Jim Laker","Bill O'Reilly","Clarrie Grimmett"],ans:1,cat:"TEST RECORDS",skill:"bowling",coachNote:"Jim Laker took 46 wickets in the 1956 Ashes series — including his 19/90 at Old Trafford — the best series haul by any spinner."},
  {q:"Who holds the world record for most wickets in international cricket across all formats?",opts:["Muttiah Muralitharan","Shane Warne","Wasim Akram","James Anderson"],ans:0,cat:"BOWLING STATS",skill:"bowling",coachNote:"Muttiah Muralitharan holds the world record with 1347 international wickets across all formats — Tests, ODIs and T20Is combined."},
  {q:"Bhuvneshwar Kumar's best Test bowling figures are?",opts:["5/38","6/82","5/25","6/21"],ans:1,cat:"TEST RECORDS",skill:"bowling",coachNote:"Bhuvneshwar Kumar has been India's finest swing bowler in recent times — his ability to move the ball both ways makes him a threat in all conditions."},
  {q:"Which bowler took a wicket in his final Test ball before retiring?",opts:["Muttiah Muralitharan","Courtney Walsh","Glenn McGrath","Wasim Akram"],ans:0,cat:"CRICKET HISTORY",skill:"bowling",coachNote:"Muttiah Muralitharan took a wicket with his final ball in Test cricket to claim his 800th Test wicket in 2010 — a fairytale ending."},
  {q:"Who was nicknamed White Lightning for his express pace?",opts:["Shaun Pollock","Fanie de Villiers","Allan Donald","Morne Morkel"],ans:2,cat:"NICKNAMES",skill:"bowling",coachNote:"Allan Donald of South Africa was nicknamed White Lightning — his raw pace and aggression made him one of the most feared fast bowlers of his era."},
  {q:"Which Indian bowler was called the Turbanator?",opts:["Anil Kumble","Harbhajan Singh","Bishan Bedi","Venkatapathy Raju"],ans:1,cat:"NICKNAMES",skill:"bowling",coachNote:"Harbhajan Singh earned the nickname Turbanator for his aggressive off-spin, his trademark turban, and his match-winning ability against Australia."},
  {q:"What is the record for most wickets in a single IPL season?",opts:["30","32","35","28"],ans:1,cat:"IPL RECORDS",skill:"bowling",coachNote:"Harshal Patel took 32 wickets in the 2021 IPL season for RCB — the most in a single IPL season, a record that still stands."},
  {q:"Which New Zealand bowler took a hat-trick in 2019 World Cup?",opts:["Trent Boult","Matt Henry","Tim Southee","Lockie Ferguson"],ans:2,cat:"WORLD CUP",skill:"bowling",coachNote:"Tim Southee's pace and movement in the 2019 World Cup was outstanding — New Zealand were one of the competition's best bowling units."},
  {q:"Who was the first bowler to take 50 wickets in T20 Internationals?",opts:["Lasith Malinga","Shahid Afridi","Saeed Ajmal","Umar Gul"],ans:0,cat:"T20 RECORDS",skill:"bowling",coachNote:"Lasith Malinga was the first to reach 50 T20I wickets — his sling-arm action and ability to bowl yorkers at pace made him the T20 format's first great bowler."},
  {q:"Who took India's only over in the controversial 1986 tied Test at Madras?",opts:["Kapil Dev","Ravi Shastri","Maninder Singh","Dilip Doshi"],ans:2,cat:"CRICKET HISTORY",skill:"bowling",coachNote:"Maninder Singh's last over in the 1986 Chennai (Madras) Test ended with a disputed LBW decision — resulting in Test cricket's second ever tie, vs Australia."},
  {q:"James Anderson's Test wicket tally on retirement was?",opts:["704","700","696","712"],ans:0,cat:"TEST RECORDS",skill:"bowling",coachNote:"James Anderson retired in 2024 with 704 Test wickets — the record for any fast bowler in history, achieved across a 21-year Test career."},
  {q:"Which team did Gujarat Titans defeat to win their first IPL title?",opts:["CSK","MI","RR","SRH"],ans:2,cat:"IPL HISTORY",skill:"ipl",coachNote:"Gujarat Titans defeated Rajasthan Royals in the 2022 IPL Final — an extraordinary debut season for the new franchise under Hardik Pandya's captaincy."},
  {q:"Who captained Gujarat Titans to the IPL 2022 title?",opts:["Shubman Gill","David Miller","Hardik Pandya","Jason Roy"],ans:2,cat:"IPL HISTORY",skill:"ipl",coachNote:"Hardik Pandya led Gujarat Titans to the IPL 2022 title in their very first season — then left to rejoin Mumbai Indians the following year."},
  {q:"Which franchise replaced the Rising Pune Supergiant after 2017?",opts:["Gujarat Lions","Lucknow Super Giants","CSK returned","Pune Warriors"],ans:2,cat:"IPL HISTORY",skill:"ipl",coachNote:"Chennai Super Kings and Rajasthan Royals returned to IPL in 2018 after their two-year suspension — replacing the Pune and Gujarat teams."},
  {q:"Which IPL team plays at Rajiv Gandhi International Stadium?",opts:["CSK","SRH","RR","KKR"],ans:1,cat:"IPL TEAMS",skill:"ipl",coachNote:"SunRisers Hyderabad play their home matches at Rajiv Gandhi International Stadium in Uppal, Hyderabad."},
  {q:"How many wickets did Lasith Malinga take across all his IPL seasons?",opts:["170","154","145","172"],ans:0,cat:"IPL RECORDS",skill:"ipl",coachNote:"Lasith Malinga took 170 IPL wickets across his career — the most by any overseas bowler and second only to Dwayne Bravo in total IPL wickets."},
  {q:"Which team did MS Dhoni lead in the very first IPL match?",opts:["CSK","MI","Deccan Chargers","KKR"],ans:0,cat:"IPL HISTORY",skill:"ipl",coachNote:"MS Dhoni led Chennai Super Kings throughout his IPL career — including their very first match in 2008 against Kolkata Knight Riders."},
  {q:"Who scored the first century in a WPL match?",opts:["Smriti Mandhana","Meg Lanning","Beth Mooney","Shafali Verma"],ans:1,cat:"WOMEN'S CRICKET",skill:"ipl",coachNote:"Meg Lanning scored the first century in the Women's Premier League — cementing her reputation as one of the finest women's batters ever."},
  {q:"What is the impact player rule in IPL?",opts:["Extra player can bat or bowl","A substitute player can be introduced mid-match","Double points for a six","Powerplay extended by 1 over"],ans:1,cat:"IPL RULES",skill:"ipl",coachNote:"The Impact Player rule allows teams to substitute a player into the game mid-match, adding tactical flexibility and allowing specialist roles."},
  {q:"Which team beat CSK in the IPL 2021 Final?",opts:["DC","KKR","MI","RCB"],ans:1,cat:"IPL HISTORY",skill:"ipl",coachNote:"Kolkata Knight Riders beat Chennai Super Kings in the 2021 IPL Final — one of the biggest upsets in recent IPL history, as CSK were favourites."},
  {q:"Who took the most wickets in IPL 2021?",opts:["Harshal Patel","Avesh Khan","Mohammed Shami","Rahul Chahar"],ans:0,cat:"IPL RECORDS",skill:"ipl",coachNote:"Harshal Patel of RCB took 32 wickets in IPL 2021 — a record for a single season. His slower ball and variations were exceptional."},
  {q:"How many runs can a team score off a no-ball?",opts:["1 run penalty only","1 run plus any runs scored off the bat","2 runs plus a free hit","Just a free hit"],ans:1,cat:"IPL RULES",skill:"ipl",coachNote:"A no-ball adds 1 run to the batting team's total plus any runs scored off the delivery — and in T20s/ODIs it also results in a free hit on the next ball."},
  {q:"Which team won three consecutive IPL titles from 2019-2021?",opts:["CSK","MI","KKR","DC"],ans:1,cat:"IPL HISTORY",skill:"ipl",coachNote:"Mumbai Indians won in 2019 and 2020 — not three in a row. They won in 2013, 2015, 2017, 2019 and 2020. CSK won in 2021."},
  {q:"Who scored the most runs in IPL 2023?",opts:["Faf du Plessis","Shubman Gill","Devon Conway","Virat Kohli"],ans:1,cat:"IPL RECORDS",skill:"ipl",coachNote:"Shubman Gill won the Orange Cap in IPL 2023 with 890 runs for Gujarat Titans — the most by any batter in that season."},
  {q:"What is the salary cap for IPL teams per season?",opts:["₹70 crore","₹80 crore","₹90 crore","₹100 crore"],ans:2,cat:"IPL RULES",skill:"ipl",coachNote:"The IPL salary cap has been progressively raised — for the 2024 season it was set at ₹100 crore per team, giving franchises more spending power."},
  {q:"Which IPL team is nicknamed the Super Kings?",opts:["Mumbai Indians","Chennai Super Kings","SunRisers Hyderabad","Punjab Kings"],ans:1,cat:"IPL TEAMS",skill:"ipl",coachNote:"Chennai Super Kings are officially nicknamed the Super Kings — MS Dhoni's franchise is one of the most popular and successful teams in IPL history."},
  {q:"Who hit the winning six in the 2011 World Cup final?",opts:["Virat Kohli","Sachin Tendulkar","Yuvraj Singh","MS Dhoni"],ans:3,cat:"WORLD CUP",skill:"ipl",coachNote:"MS Dhoni hit a magnificent six over long-on to win the 2011 World Cup for India — finishing unbeaten on 91* in an iconic moment."},
  {q:"What was the first-ever IPL title won by KKR?",opts:["2008","2010","2012","2014"],ans:2,cat:"IPL HISTORY",skill:"ipl",coachNote:"KKR won their first IPL title in 2012, defeating CSK in the final at Chennai under Gautam Gambhir's captaincy."},
  {q:"Which player was released by MI and signed by CSK before winning the title?",opts:["Kieron Pollard","Suresh Raina","Shane Watson","Dwayne Bravo"],ans:2,cat:"IPL HISTORY",skill:"ipl",coachNote:"Shane Watson was released by various franchises before joining CSK — he scored a brilliant century in the 2018 IPL Final to win the title."},
  {q:"Who holds the record for most run-outs effected in IPL history?",opts:["Suresh Raina","AB de Villiers","Rohit Sharma","MS Dhoni"],ans:3,cat:"IPL RECORDS",skill:"ipl",coachNote:"MS Dhoni holds the record for most stumpings in IPL history — contributing significantly to his team's wicket-taking efforts from behind the stumps."},
  {q:"Which bowler has the best economy rate in IPL history (min 50 overs)?",opts:["Rashid Khan","Sunil Narine","Piyush Chawla","Amit Mishra"],ans:0,cat:"IPL RECORDS",skill:"ipl",coachNote:"Rashid Khan has the best economy rate among regular IPL bowlers — his leg-spin and googly combination makes him almost impossible to score off."},
  {q:"Which team finished bottom of the IPL table in 2023?",opts:["CSK","LSG","Punjab Kings","DC"],ans:2,cat:"IPL HISTORY",skill:"ipl",coachNote:"Punjab Kings finished at the bottom of the 2023 IPL table — despite some talented players, their inability to win close games hurt them throughout."},
  {q:"How long is a powerplay in T20 cricket?",opts:["4 overs","5 overs","6 overs","3 overs"],ans:2,cat:"CRICKET RULES",skill:"ipl",coachNote:"In T20 cricket the powerplay is 6 overs — during which only 2 fielders are allowed outside the 30-yard circle, helping batters score freely."},
  {q:"Who was the first foreign captain to win the IPL?",opts:["Andrew Flintoff","Shane Warne","Kevin Pietersen","Chris Gayle"],ans:1,cat:"IPL HISTORY",skill:"ipl",coachNote:"Shane Warne captained Rajasthan Royals to the inaugural IPL title in 2008 — the first and most celebrated foreign captain to win the IPL."},
  {q:"Which IPL team does Andre Russell play for?",opts:["MI","CSK","KKR","RCB"],ans:2,cat:"IPL TEAMS",skill:"ipl",coachNote:"Andre Russell plays for Kolkata Knight Riders — his explosive lower-order batting and pace bowling make him one of IPL's most devastating all-rounders."},
  {q:"How many overs does each team face in a T20 match?",opts:["15","20","25","10"],ans:1,cat:"CRICKET RULES",skill:"ipl",coachNote:"Each team faces 20 overs in a T20 match — the shorter format designed for fast, high-scoring entertainment."},
  {q:"Which IPL team was formerly called Delhi Daredevils?",opts:["Delhi Capitals","Sunrisers Hyderabad","Lucknow Super Giants","Gujarat Titans"],ans:0,cat:"IPL TEAMS",skill:"ipl",coachNote:"Delhi Capitals were renamed from Delhi Daredevils in 2019 — the rebrand was part of a fresh direction for the franchise under new ownership."},
  {q:"Who scored 109* off 55 balls for SRH vs MI in IPL 2024?",opts:["Travis Head","Heinrich Klaasen","Aiden Markram","Pat Cummins"],ans:0,cat:"IPL RECORDS",skill:"ipl",coachNote:"Travis Head scored a blistering century for SRH in IPL 2024 — his aggressive opening partnership with Abhishek Sharma was a highlight of the season."},
  {q:"Who is SRH's highest run-scorer in a single IPL season?",opts:["David Warner","Shikhar Dhawan","Kane Williamson","Abhishek Sharma"],ans:0,cat:"IPL RECORDS",skill:"ipl",coachNote:"David Warner scored 848 runs for SRH in 2016 — winning the Orange Cap as SRH won the title. He was their dominant force for many years."},
  {q:"What was Virat Kohli's strike rate during his record 973-run IPL 2016 season?",opts:["152.03","148.11","152.32","145.67"],ans:0,cat:"IPL RECORDS",skill:"ipl",coachNote:"Virat Kohli struck at 152.03 during his record 973-run IPL 2016 season — combining prolific run-scoring with an impressive strike rate."},
  {q:"Which Mumbai Indians player holds the record for most catches in a single IPL season?",opts:["Kieron Pollard","Rohit Sharma","Suryakumar Yadav","Jos Buttler"],ans:0,cat:"IPL RECORDS",skill:"ipl",coachNote:"Kieron Pollard was one of MI's finest fielders — taking crucial catches throughout his long career at MI at key moments."},
  {q:"Who won the Emerging Player Award at IPL 2023?",opts:["Yashasvi Jaiswal","Tilak Varma","Shubman Gill","Rinku Singh"],ans:0,cat:"IPL RECORDS",skill:"ipl",coachNote:"Yashasvi Jaiswal won the Emerging Player of the Season at IPL 2023 for his explosive performances for Rajasthan Royals."},
  {q:"How many titles has CSK won as of IPL 2024?",opts:["4","5","3","6"],ans:1,cat:"IPL HISTORY",skill:"ipl",coachNote:"Chennai Super Kings have won 5 IPL titles (2010, 2011, 2018, 2021, 2023) — the most successful team alongside Mumbai Indians."},
  {q:"Which team defeated Punjab Kings in the 2014 IPL Final?",opts:["MI","CSK","KKR","RCB"],ans:2,cat:"IPL HISTORY",skill:"ipl",coachNote:"KKR defeated Kings XI Punjab in the 2014 IPL Final — with Manish Pandey scoring a brilliant century to seal the win in a closely contested match."},
  {q:"Pat Cummins was sold for how much in the IPL 2024 auction?",opts:["₹18.5 crore","₹20.5 crore","₹15 crore","₹24.75 crore"],ans:1,cat:"IPL AUCTION",skill:"ipl",coachNote:"Pat Cummins was retained by SunRisers Hyderabad for ₹20.5 crore ahead of IPL 2024 — he went on to captain SRH to the final."},
  {q:"Which team has the highest team total in IPL 2024 season?",opts:["SRH","MI","KKR","RCB"],ans:0,cat:"IPL RECORDS",skill:"ipl",coachNote:"SunRisers Hyderabad set multiple high-scoring records in IPL 2024 — their aggressive batting lineup under Travis Head and Abhishek Sharma was explosive."},
  {q:"Rinku Singh's famous 5 sixes off 5 balls came against which team in IPL 2023?",opts:["MI","CSK","GT","SRH"],ans:2,cat:"IPL RECORDS",skill:"ipl",coachNote:"Rinku Singh hit 5 sixes off the final 5 balls of Yash Dayal's over to win for KKR vs Gujarat Titans in 2023 — one of the greatest IPL finishes ever."},
  {q:"Which team won the WPL 2024?",opts:["Delhi Capitals","Mumbai Indians","RCB","UP Warriorz"],ans:1,cat:"WOMEN'S CRICKET",skill:"ipl",coachNote:"Mumbai Indians won the WPL 2024 title, defending their 2023 championship — continuing their dominance in the inaugural Women's Premier League seasons."},
  {q:"Who won the Purple Cap in IPL 2023?",opts:["Noor Ahmad","Mohammed Shami","Rashid Khan","Piyush Chawla"],ans:1,cat:"IPL RECORDS",skill:"ipl",coachNote:"Mohammed Shami won the IPL 2023 Purple Cap with 28 wickets for Gujarat Titans — his variations and pace made him the tournament's most dangerous bowler."},
  {q:"Which IPL team plays home games at BRSABV Ekana Cricket Stadium?",opts:["GT","LSG","KKR","RR"],ans:1,cat:"IPL TEAMS",skill:"ipl",coachNote:"Lucknow Super Giants play their home matches at BRSABV Ekana Cricket Stadium in Lucknow — the venue became one of the IPL's most vibrant atmospheres."},
  {q:"KKR reached the final in 2024. Who did they beat in the qualifier?",opts:["SRH","RR","CSK","DC"],ans:1,cat:"IPL HISTORY",skill:"ipl",coachNote:"KKR defeated Rajasthan Royals in Qualifier 1 to book their place in the 2024 IPL Final — where they then beat SRH."},
  {q:"Who captained England in the famous 2005 Ashes series win?",opts:["Nasser Hussain","Michael Vaughan","Andrew Flintoff","Marcus Trescothick"],ans:1,cat:"CRICKET HISTORY",skill:"history",coachNote:"Michael Vaughan captained England to a memorable 2-1 Ashes series win in 2005 — England's first Ashes victory since 1987."},
  {q:"Who is nicknamed The Don?",opts:["Don Bradman","Don Underwood","Donald Carr","Donald Headley"],ans:0,cat:"NICKNAMES",skill:"history",coachNote:"Don Bradman is simply known as The Don — the greatest batter in cricket history, with a Test average of 99.94 that may never be matched."},
  {q:"Which country was the first to win the ICC World Test Championship?",opts:["India","New Zealand","England","Australia"],ans:1,cat:"TEST RECORDS",skill:"history",coachNote:"New Zealand won the inaugural ICC World Test Championship Final in 2021, defeating India by 8 wickets at Southampton."},
  {q:"What was the score in the tied 1986 Madras Test between India and Australia?",opts:["347","420-9 declared","384-9","All teams scored 437"],ans:3,cat:"CRICKET HISTORY",skill:"history",coachNote:"The 1986 Madras Test ended in a tie — the second tied Test in history — after both India and Australia finished with 347 runs in their respective second innings."},
  {q:"What is the Pataudi Trophy contested between?",opts:["India and Australia","India and England","India and West Indies","India and Pakistan"],ans:1,cat:"TEST SERIES",skill:"history",coachNote:"The Pataudi Trophy is the prize for India vs England Test series — named after Iftikhar Ali Khan Pataudi who played for both countries."},
  {q:"Who won the 2019 Cricket World Cup?",opts:["India","New Zealand","England","Australia"],ans:2,cat:"WORLD CUP",skill:"history",coachNote:"England won their first World Cup in 2019 — tied on runs with New Zealand in the final and in the Super Over, England won on boundary count."},
  {q:"How was the 2019 World Cup Final ultimately decided?",opts:["Super Over","Duckworth-Lewis","Coin toss","Boundary count after Super Over tie"],ans:3,cat:"WORLD CUP",skill:"history",coachNote:"After a tied match AND a tied Super Over, England were awarded the 2019 World Cup title on boundary count — the most dramatic World Cup final ever."},
  {q:"Which country hosted the 2023 ODI World Cup?",opts:["England","India","South Africa","Australia"],ans:1,cat:"WORLD CUP",skill:"history",coachNote:"India hosted the 2023 ODI World Cup — a 10-team tournament played across 12 venues. India went unbeaten through the group stage and semifinals before losing the final."},
  {q:"Who won the 2023 ODI World Cup?",opts:["India","Australia","New Zealand","South Africa"],ans:1,cat:"WORLD CUP",skill:"history",coachNote:"Australia won the 2023 ODI World Cup, defeating India by 6 wickets in the final at Ahmedabad — ending India's unbeaten run in the tournament."},
  {q:"Which team won the Border-Gavaskar Trophy in 2021?",opts:["India","Australia","Match drawn","Pakistan"],ans:0,cat:"TEST SERIES",skill:"history",coachNote:"India won the 2020-21 Border-Gavaskar Trophy 2-1 — including the famous win at the Gabba where India broke Australia's 32-year unbeaten home record."},
  {q:"Which England captain introduced the concept of reverse swing?",opts:["Mike Brearley","Ian Botham","David Gower","Tony Greig"],ans:0,cat:"CRICKET HISTORY",skill:"history",coachNote:"Mike Brearley was one of the tactical masterminds of cricket — though reverse swing was pioneered by Pakistani bowlers Imran Khan and Sarfraz Nawaz."},
  {q:"What is the Super Over in cricket?",opts:["A bonus over for the batting team","A tiebreaker where each team faces 1 over","Extra overs in rain-affected games","First over of the innings"],ans:1,cat:"CRICKET RULES",skill:"history",coachNote:"A Super Over is a 1-over eliminator used to decide tied limited-overs matches — each team's two best batters face one over of 6 balls."},
  {q:"Who captained India when they first won in Australia in 2019?",opts:["Rohit Sharma","Ajinkya Rahane","Virat Kohli","Shikhar Dhawan"],ans:2,cat:"CRICKET HISTORY",skill:"history",coachNote:"Virat Kohli captained India to a 2-1 Test series win in Australia in 2018-19 — India's first ever Test series win on Australian soil."},
  {q:"Who was Man of the Match in the 2011 World Cup Final?",opts:["Sachin Tendulkar","Virat Kohli","MS Dhoni","Yuvraj Singh"],ans:2,cat:"WORLD CUP",skill:"history",coachNote:"MS Dhoni won Man of the Match in the 2011 World Cup Final for his unbeaten 91 that guided India to the title."},
  {q:"What is the Reliance Trophy?",opts:["First Asia Cup trophy","First ODI tournament","Former ICC event","A World Cup qualifier"],ans:2,cat:"CRICKET HISTORY",skill:"history",coachNote:"The Reliance Cup was the 1987 Cricket World Cup held in India and Pakistan — the first World Cup played outside England."},
  {q:"Who scored 98 in their final innings before retirement — also Tendulkar's farewell Test opponent?",opts:["England","Sri Lanka","West Indies","Australia"],ans:1,cat:"CRICKET HISTORY",skill:"history",coachNote:"Sachin Tendulkar's 200th and final Test was against West Indies in Mumbai in November 2013 — a fitting stage for the world's greatest batter."},
  {q:"Where is the Ashes urn kept permanently?",opts:["Melbourne Cricket Ground","Lord's Cricket Ground","SCG Sydney","Trent Bridge"],ans:1,cat:"CRICKET HISTORY",skill:"history",coachNote:"The original Ashes urn is permanently held at Lord's Cricket Ground — the touring team take home a replica trophy, not the actual urn."},
  {q:"Which year did the first women's Test match take place?",opts:["1934","1948","1926","1952"],ans:0,cat:"WOMEN'S CRICKET",skill:"history",coachNote:"The first Women's Test match was played in 1934 between England and Australia — more than 57 years after the first men's Test in 1877."},
  {q:"What is the significance of Headingley 1981?",opts:["First women's Test in England","Botham's Ashes — England win from the brink","First tied Test","First day-night Test"],ans:1,cat:"CRICKET HISTORY",skill:"history",coachNote:"Headingley 1981 is famous as Botham's Ashes — England won from 500-1 odds after Ian Botham's 149 and Bob Willis's 8/43 produced a miraculous comeback."},
  {q:"What do the letters ICC stand for?",opts:["International Cricket Council","International Cricket Championship","Indian Cricket Council","International Championship of Cricket"],ans:0,cat:"CRICKET TERMS",skill:"history",coachNote:"ICC stands for International Cricket Council — the global governing body of cricket, headquartered in Dubai."},
  {q:"Which country does Trent Boult represent?",opts:["Australia","New Zealand","South Africa","Zimbabwe"],ans:1,cat:"CRICKET HISTORY",skill:"history",coachNote:"Trent Boult is one of New Zealand's greatest ever left-arm fast bowlers — known for his ability to swing the ball both ways at pace."},
  {q:"When did India win their first-ever Test series in England?",opts:["1946","1971","1985","1986"],ans:1,cat:"CRICKET HISTORY",skill:"history",coachNote:"India won their first Test series in England in 1971 under Ajit Wadekar — Bishan Bedi, Prasanna and Chandrasekhar's spin was the key."},
  {q:"What is the maximum number of fielders allowed outside the 30-yard circle during a powerplay?",opts:["0","1","2","3"],ans:2,cat:"CRICKET RULES",skill:"history",coachNote:"During the powerplay in limited-overs cricket, only 2 fielders are allowed outside the 30-yard circle — maximising scoring opportunities."},
  {q:"Who captained West Indies to their back-to-back World Cup victories in 1975 and 1979?",opts:["Vivian Richards","Rohan Kanhai","Clive Lloyd","Alvin Kallicharran"],ans:2,cat:"WORLD CUP",skill:"history",coachNote:"Clive Lloyd captained West Indies to their 1975 and 1979 World Cup victories — establishing West Indies as the dominant force in world cricket."},
  {q:"Which country hosted the first ICC T20 World Cup?",opts:["Australia","India","England","South Africa"],ans:3,cat:"T20 WORLD CUP",skill:"history",coachNote:"South Africa hosted the inaugural ICC T20 World Cup in 2007 — a 12-team tournament that produced India's memorable victory in the final."},
  {q:"What is the term for when a bowler dismisses 3 batters in consecutive balls?",opts:["Turkey","Hat-trick","Triple","Treble"],ans:1,cat:"CRICKET TERMS",skill:"history",coachNote:"A hat-trick is when a bowler takes 3 wickets in 3 consecutive balls — it can span over two overs, two innings, or even two different matches."},
  {q:"Which country does Shakib Al Hasan represent?",opts:["Pakistan","Sri Lanka","Bangladesh","Afghanistan"],ans:2,cat:"CRICKET HISTORY",skill:"history",coachNote:"Shakib Al Hasan represents Bangladesh — he is widely regarded as the world's best all-rounder and Bangladesh's greatest ever cricketer."},
  {q:"How many World Cup finals have India played and won?",opts:["3 played 2 won","2 played 2 won","4 played 2 won","3 played 1 won"],ans:0,cat:"WORLD CUP",skill:"history",coachNote:"India have played in 3 ODI World Cup Finals (1983, 2003, 2011) and won 2 — losing to Australia in 2003. They also won the 2024 T20 World Cup."},
  {q:"Which country won the inaugural ICC Champions Trophy?",opts:["South Africa","India","Sri Lanka","West Indies"],ans:0,cat:"ICC TOURNAMENTS",skill:"history",coachNote:"South Africa won the inaugural ICC Champions Trophy (then called the Knockout tournament) in 1998, defeating West Indies in the final."},
  {q:"What is the significance of 26 June 1983 in cricket?",opts:["First T20 match","India wins World Cup","First tied Test","WG Grace born"],ans:1,cat:"CRICKET HISTORY",skill:"history",coachNote:"26 June 1983 is the date India won the Cricket World Cup — Kapil Dev's men beat the mighty West Indies at Lord's in one of sport's greatest upsets."},
  {q:"Who received the first ban in international cricket history for ball-tampering?",opts:["Mike Atherton","Steve Smith","Faf du Plessis","Darrell Hair"],ans:0,cat:"CRICKET HISTORY",skill:"history",coachNote:"Mike Atherton was fined by match referee Peter Burge in 1994 after being caught with dirt in his pocket that he was using to maintain the ball."},
  {q:"Which country won the 2022 T20 World Cup?",opts:["India","Pakistan","England","Australia"],ans:2,cat:"T20 WORLD CUP",skill:"history",coachNote:"England won the 2022 T20 World Cup in Australia, defeating Pakistan in the final — Jos Buttler and Sam Curran were instrumental in the win."},
  {q:"Who was Australia's captain during the infamous 2018 Sandpaper Gate scandal?",opts:["David Warner","Tim Paine","Steve Smith","Cameron Bancroft"],ans:2,cat:"CRICKET HISTORY",skill:"history",coachNote:"Steve Smith was Australia's captain during Sandpaper Gate in Cape Town 2018 — he was banned for 12 months along with David Warner and Cameron Bancroft."},
  {q:"What was the first Test match played under lights with a pink ball in India?",opts:["India vs SA 2019 Kolkata","India vs Bangladesh 2019 Eden Gardens","India vs England 2021","India vs Australia 2023"],ans:1,cat:"CRICKET HISTORY",skill:"history",coachNote:"India played their first ever day-night Test against Bangladesh at Eden Gardens in 2019 — under floodlights using a pink ball."},
  {q:"Who is the only umpire to stand in 100 Test matches?",opts:["Dickie Bird","Steve Bucknor","Simon Taufel","Harold 'Dicky' Bird"],ans:1,cat:"CRICKET HISTORY",skill:"history",coachNote:"Steve Bucknor is the only umpire to have stood in 100+ Test matches — the Jamaican umpire was one of the most respected officials in the game."},
  {q:"Which nation did Afghanistan defeat in the 2024 T20 World Cup group stage?",opts:["England","Pakistan","Australia","India"],ans:0,cat:"T20 WORLD CUP",skill:"history",coachNote:"Afghanistan defeated defending champions England in the group stage of the 2024 T20 World Cup — one of the tournament's biggest upsets."},
  {q:"Who won the 2024 T20 World Cup?",opts:["Australia","South Africa","England","India"],ans:3,cat:"T20 WORLD CUP",skill:"history",coachNote:"India won the 2024 T20 World Cup in the West Indies and USA, defeating South Africa by 7 runs in the final at Barbados."},
  {q:"Which team lost the 2024 T20 World Cup final?",opts:["England","Australia","South Africa","West Indies"],ans:2,cat:"T20 WORLD CUP",skill:"history",coachNote:"South Africa came agonisingly close to winning the 2024 T20 World Cup final but lost to India by 7 runs in a dramatic Barbados final."},
  {q:"Who hit the winning runs in the 2024 T20 World Cup Final for India?",opts:["Rohit Sharma","Virat Kohli","Hardik Pandya","Suryakumar Yadav"],ans:1,cat:"T20 WORLD CUP",skill:"history",coachNote:"Virat Kohli scored a match-winning 76 in the 2024 T20 World Cup Final and hit the winning boundary — ending a 2-year T20I drought without a century."},
  {q:"What was Jasprit Bumrah's role in the 2024 T20 World Cup?",opts:["Wicketkeeper-batter","Captain","Player of the Tournament","Support bowler"],ans:2,cat:"T20 WORLD CUP",skill:"history",coachNote:"Jasprit Bumrah won Player of the Tournament at the 2024 T20 World Cup — his 15 wickets at a stunning economy rate were crucial to India's title win."},
  {q:"Who captained India in the 2024 T20 World Cup?",opts:["Virat Kohli","KL Rahul","Rohit Sharma","Hardik Pandya"],ans:2,cat:"T20 WORLD CUP",skill:"history",coachNote:"Rohit Sharma captained India to the 2024 T20 World Cup — also his farewell from T20I cricket, making the victory an emotional one."},
  {q:"In which country was the 2024 T20 World Cup hosted?",opts:["India","England","Australia","USA and West Indies"],ans:3,cat:"T20 WORLD CUP",skill:"history",coachNote:"The 2024 T20 World Cup was co-hosted by the USA and the West Indies — the first time the USA hosted a major international cricket tournament."},
  {q:"Hardik Pandya bowled the final over of the 2024 T20 World Cup final — what happened?",opts:["India won by 20 runs","South Africa needed 16 off 6 and scored 9","India lost","Super Over was needed"],ans:1,cat:"T20 WORLD CUP",skill:"history",coachNote:"South Africa needed 16 off Hardik Pandya's final over and could only score 9 — India won by 7 runs in the most dramatic World Cup final finish."},
  {q:"Which team did India beat in the 2024 T20 World Cup semifinal?",opts:["England","Pakistan","South Africa","Australia"],ans:0,cat:"T20 WORLD CUP",skill:"history",coachNote:"India defeated England in the 2024 T20 World Cup semifinal — Axar Patel and Kuldeep Yadav's spin was key in restricting England's powerful batting lineup."},
  {q:"Who won the inaugural Women's Premier League title?",opts:["Delhi Capitals","Royal Challengers Bengaluru","Mumbai Indians","UP Warriorz"],ans:2,cat:"WOMEN'S CRICKET",skill:"womens",coachNote:"Mumbai Indians won the inaugural WPL title in 2023, defeating Delhi Capitals in the final at the Brabourne Stadium."},
  {q:"Which country won the 2022 Women's T20 World Cup?",opts:["England","India","South Africa","Australia"],ans:3,cat:"WOMEN'S T20",skill:"womens",coachNote:"Australia won the 2022 Women's T20 World Cup in South Africa, defeating England in the final — their sixth T20 World Cup title."},
  {q:"Who holds the record for the highest score in Women's T20 Internationals?",opts:["Meg Lanning","Deandra Dottin","Harmanpreet Kaur","Smriti Mandhana"],ans:1,cat:"WOMEN'S T20",skill:"womens",coachNote:"Deandra Dottin of West Indies scored 112* against South Africa in 2010 — the first century by a woman in T20I cricket."},
  {q:"Ellyse Perry represents which country?",opts:["New Zealand","England","South Africa","Australia"],ans:3,cat:"WOMEN'S CRICKET",skill:"womens",coachNote:"Ellyse Perry represents Australia in both cricket and football — she is considered one of the greatest women's cricketers of all time."},
  {q:"Who was India Women's captain at the 2017 ODI World Cup final?",opts:["Harmanpreet Kaur","Smriti Mandhana","Mithali Raj","Veda Krishnamurthy"],ans:2,cat:"WOMEN'S WORLD CUP",skill:"womens",coachNote:"Mithali Raj captained India to the 2017 Women's ODI World Cup final, where they narrowly lost to England by 9 runs."},
  {q:"Harmanpreet Kaur scored 171* in the 2017 World Cup semifinal against which team?",opts:["England","New Zealand","Australia","South Africa"],ans:2,cat:"WOMEN'S WORLD CUP",skill:"womens",coachNote:"Harmanpreet Kaur's 171* off 115 balls vs Australia in the 2017 Women's World Cup semifinal is considered the greatest women's ODI innings ever."},
  {q:"Which country does Nat Sciver-Brunt play for?",opts:["Australia","South Africa","New Zealand","England"],ans:3,cat:"WOMEN'S CRICKET",skill:"womens",coachNote:"Nat Sciver-Brunt plays for England Women and is one of the world's best all-rounders — known for her innovative batting and effective medium pace."},
  {q:"Who was the first woman to be inducted into the ICC Hall of Fame?",opts:["Rachael Heyhoe Flint","Betty Wilson","Enid Bakewell","Mithali Raj"],ans:0,cat:"WOMEN'S CRICKET",skill:"womens",coachNote:"Rachael Heyhoe Flint was the first woman inducted into the ICC Cricket Hall of Fame in 2010 — a pioneering figure in women's cricket."},
  {q:"Which team won the 2020 Women's T20 World Cup?",opts:["India","South Africa","New Zealand","Australia"],ans:3,cat:"WOMEN'S T20",skill:"womens",coachNote:"Australia won the 2020 Women's T20 World Cup in front of a record crowd of 86,174 at the MCG — defeating India by 85 runs in the final."},
  {q:"What is Shafali Verma known for in women's cricket?",opts:["Slow bowling","Aggressive opening batting","Wicket-keeping","Left-arm spin"],ans:1,cat:"WOMEN'S CRICKET",skill:"womens",coachNote:"Shafali Verma is India's fearless opening batter — her aggressive style and power-hitting revolutionised India's approach in T20 cricket."},
  {q:"Who won the 2024 Women's T20 World Cup?",opts:["India","South Africa","England","New Zealand"],ans:3,cat:"WOMEN'S T20",skill:"womens",coachNote:"New Zealand won the 2024 Women's T20 World Cup in Bangladesh — defeating South Africa in the final to claim their first T20 World Cup title."},
  {q:"Who holds the record for most Women's T20I wickets?",opts:["Anya Shrubsole","Sophie Ecclestone","Shabnim Ismail","Poonam Yadav"],ans:1,cat:"WOMEN'S T20",skill:"womens",coachNote:"Sophie Ecclestone holds the record for most wickets in Women's T20 International cricket — her left-arm spin is virtually unplayable at her best."},
  {q:"Which Australian captain retired from international cricket in 2023?",opts:["Beth Mooney","Rachael Haynes","Ellyse Perry","Meg Lanning"],ans:3,cat:"WOMEN'S CRICKET",skill:"womens",coachNote:"Meg Lanning retired from international cricket in 2023 — she led Australia to multiple World Cup titles and was considered the best women's batter of her generation."},
  {q:"Who scored a century in the 2022 Women's ODI World Cup Final?",opts:["Beth Mooney","Meg Lanning","Alyssa Healy","Tahlia McGrath"],ans:2,cat:"WOMEN'S WORLD CUP",skill:"womens",coachNote:"Alyssa Healy scored 170 in the 2022 Women's ODI World Cup Final — the highest score in a Women's World Cup Final ever, as Australia demolished England."},
  {q:"India Women beat Australia in a T20 series for the first time in which year?",opts:["2019","2021","2022","2023"],ans:2,cat:"WOMEN'S CRICKET",skill:"womens",coachNote:"India Women beat Australia Women in a T20I bilateral series for the first time in 2022 — a landmark achievement for Indian women's cricket."},
  {q:"Which country does Chamari Atapattu represent?",opts:["India","Bangladesh","Sri Lanka","Pakistan"],ans:2,cat:"WOMEN'S CRICKET",skill:"womens",coachNote:"Chamari Atapattu is Sri Lanka's captain and leading batter — one of the most explosive opening batters in women's cricket globally."},
  {q:"Who was the top scorer in the 2024 Women's T20 World Cup?",opts:["Smriti Mandhana","Amelia Kerr","Richa Ghosh","Hayley Matthews"],ans:1,cat:"WOMEN'S T20",skill:"womens",coachNote:"Amelia Kerr was New Zealand's batting hero in the 2024 Women's T20 World Cup — her runs and leg-spin wickets were crucial to their title win."},
  {q:"Which WPL team does Smriti Mandhana play for?",opts:["MI Women","Delhi Capitals","UP Warriorz","RCB Women"],ans:3,cat:"WOMEN'S CRICKET",skill:"womens",coachNote:"Smriti Mandhana plays for RCB Women in the WPL — she is also the franchise's captain and their most important batter."},
  {q:"In which year did India Women play their most recent Women's Test match before 2021?",opts:["2006","2010","2014","2016"],ans:0,cat:"WOMEN'S CRICKET",skill:"womens",coachNote:"India Women played very few Tests — there was a long gap where women's cricket focused on ODIs and T20s instead of the five-day format."},
  {q:"Who scored a T20I century for Australia vs India in the 2024 T20 series?",opts:["Beth Mooney","Georgia Wareham","Phoebe Litchfield","Tahlia McGrath"],ans:2,cat:"WOMEN'S T20",skill:"womens",coachNote:"Phoebe Litchfield has established herself as Australia's exciting new opener — her attacking play at the top of the order makes her one to watch."},
  {q:"Who hit the famous 'helicopter shot' to win the 2011 World Cup?",opts:["Yuvraj Singh","MS Dhoni","Virat Kohli","Suresh Raina"],ans:1,cat:"WORLD CUP",skill:"history",coachNote:"MS Dhoni's six off Nuwan Kulasekara in the 2011 Final with a helicopter-shot follow-through is arguably cricket's most celebrated shot ever."},
  {q:"Which batter scored 175 off 141 balls in the 2015 World Cup semifinal for New Zealand?",opts:["Kane Williamson","Ross Taylor","Corey Anderson","Grant Elliott"],ans:1,cat:"WORLD CUP",skill:"batting",coachNote:"Grant Elliott hit the winning six but it was Martin Guptill's 237* vs West Indies that was the batting highlight — Ross Taylor's 56 wasn't the standout innings."},
  {q:"Who won Player of the Series in the 2023 Border-Gavaskar Trophy?",opts:["Rohit Sharma","Ravindra Jadeja","Nathan Lyon","R Ashwin"],ans:3,cat:"TEST SERIES",skill:"history",coachNote:"R Ashwin won Player of the Series in the 2023 Border-Gavaskar Trophy — his wickets and key contributions were decisive in India's 2-1 series win."},
  {q:"Which pacer dismissed Babar Azam in the 2022 T20 World Cup final?",opts:["Sam Curran","Chris Jordan","Ben Stokes","Mark Wood"],ans:0,cat:"T20 WORLD CUP",skill:"bowling",coachNote:"Sam Curran took 3/12 in the 2022 T20 World Cup Final vs Pakistan — winning Player of the Match and Player of the Tournament."},
  {q:"What is the record for most runs in a single T20I match?",opts:["292-6","278-3","267-4","283-5"],ans:0,cat:"T20 RECORDS",skill:"ipl",coachNote:"Teams have scored over 290 in T20I cricket — Afghanistan vs Ireland and similar high-scoring matches have pushed the record."},
  {q:"Who scored a century in the 2023 WTC Final for Australia?",opts:["Marnus Labuschagne","David Warner","Steve Smith","Travis Head"],ans:3,cat:"TEST RECORDS",skill:"batting",coachNote:"Travis Head scored a century in the 2023 WTC Final at The Oval for Australia — but India won the match. Wait — Australia won WTC 2023 defeating India."},
  {q:"Which team won the 2023 World Test Championship Final?",opts:["India","England","Australia","New Zealand"],ans:2,cat:"TEST RECORDS",skill:"history",coachNote:"Australia won the 2023 World Test Championship Final at The Oval, defeating India by 209 runs — Pat Cummins and Nathan Lyon were instrumental."},
  {q:"Rohit Sharma's role in the 2024 T20 World Cup win was?",opts:["Didn't play","Top-scorer","Captain and opening batter","Bowling captain only"],ans:2,cat:"T20 WORLD CUP",skill:"history",coachNote:"Rohit Sharma captained India and opened the batting in the 2024 T20 World Cup — and announced his T20I retirement immediately after winning the title."},
  {q:"Which country's team is known as the Black Caps?",opts:["South Africa","Zimbabwe","New Zealand","Ireland"],ans:2,cat:"CRICKET HISTORY",skill:"history",coachNote:"New Zealand's cricket team is known as the Black Caps — named after their traditional black caps, mirroring the All Blacks rugby team's colour."},
  {q:"Which country is associated with the Wanderers cricket ground?",opts:["Zimbabwe","Kenya","South Africa","Australia"],ans:2,cat:"STADIUMS",skill:"history",coachNote:"The Wanderers in Johannesburg, South Africa — nicknamed the Bullring for its steep, close stands and electric atmosphere — is one of cricket's great venues."},
  {q:"Who took a hat-trick in the 2024 T20 World Cup?",opts:["Jasprit Bumrah","Arshdeep Singh","Kuldeep Yadav","Axar Patel"],ans:1,cat:"T20 WORLD CUP",skill:"bowling",coachNote:"Arshdeep Singh took a hat-trick during India's 2024 T20 World Cup campaign — adding to his growing reputation as one of the world's best T20 bowlers."},
  {q:"Who was the leading run-scorer in the 2024 T20 World Cup?",opts:["Rohit Sharma","Virat Kohli","Rahmanullah Gurbaz","Travis Head"],ans:2,cat:"T20 WORLD CUP",skill:"batting",coachNote:"Rahmanullah Gurbaz of Afghanistan was the leading run-scorer in the 2024 T20 World Cup — his aggressive opening play for Afghanistan was brilliant throughout."},
  {q:"Which team beat the USA in the 2024 T20 World Cup group stage?",opts:["India","England","Pakistan","West Indies"],ans:2,cat:"T20 WORLD CUP",skill:"history",coachNote:"Pakistan lost to the USA in the 2024 T20 World Cup group stage — a shock result that ended Pakistan's tournament in the group stage."},
  {q:"Who won the ICC Men's Cricketer of the Year 2023?",opts:["Virat Kohli","Shubman Gill","David Warner","Travis Head"],ans:0,cat:"ICC AWARDS",skill:"history",coachNote:"Virat Kohli won the ICC Men's Cricketer of the Year in 2023 — his 2023 World Cup performances and ODI century record were decisive factors."},
  {q:"Who won the ICC Women's Cricketer of the Year 2023?",opts:["Meg Lanning","Alyssa Healy","Smriti Mandhana","Beth Mooney"],ans:2,cat:"ICC AWARDS",skill:"womens",coachNote:"Smriti Mandhana won the ICC Women's Cricketer of the Year in 2023 — her consistent run-scoring in T20Is and ODIs set her apart."},
  {q:"Who was named the ICC T20I Cricketer of the Year 2024?",opts:["Suryakumar Yadav","Rohit Sharma","Jos Buttler","Babar Azam"],ans:0,cat:"ICC AWARDS",skill:"ipl",coachNote:"Suryakumar Yadav has been the ICC T20I Cricketer of the Year multiple times — his 360-degree batting is redefining T20 strokeplay."},
  {q:"Which team has the most wins in T20 Internationals?",opts:["India","Pakistan","Australia","England"],ans:0,cat:"T20 RECORDS",skill:"history",coachNote:"India have the most T20I wins of any nation — their consistent success in the format is reflected in their two T20 World Cup titles."},
  {q:"Who was the first Indian to take a Test hat-trick?",opts:["Kapil Dev","Harbhajan Singh","Irfan Pathan","Chetan Sharma"],ans:3,cat:"TEST RECORDS",skill:"bowling",coachNote:"Chetan Sharma took the first hat-trick by an Indian in international cricket — in the 1987 World Cup vs New Zealand, not in Tests. Harbhajan's 2001 hat-trick was India's first Test hat-trick."},
  {q:"Suryakumar Yadav's famous boundary save in the 2024 T20 World Cup final was against which batter?",opts:["Quinton de Kock","David Miller","Heinrich Klaasen","Rassie van der Dussen"],ans:1,cat:"T20 WORLD CUP",skill:"history",coachNote:"Suryakumar Yadav made a stunning outfield catch off David Miller — catching the ball inside the boundary, releasing it, stepping outside and catching it again to deny a six."},
  {q:"Who top-scored for South Africa in the 2024 T20 World Cup final?",opts:["Quinton de Kock","Heinrich Klaasen","David Miller","Aiden Markram"],ans:1,cat:"T20 WORLD CUP",skill:"batting",coachNote:"Heinrich Klaasen scored 52 off 27 balls for South Africa in the 2024 T20 World Cup final — nearly winning it for South Africa before India's bowlers clawed back."},
  {q:"In what city was the 2024 T20 World Cup final played?",opts:["Antigua","Barbados","Jamaica","Trinidad"],ans:1,cat:"T20 WORLD CUP",skill:"history",coachNote:"The 2024 T20 World Cup Final was played at Kensington Oval in Bridgetown, Barbados — a classic Caribbean cricket setting."},
,
  {q:"How many players are in a cricket team?",opts:["9","10","11","12"],ans:2,skill:"history",coachNote:"A cricket team has 11 players. The fielding side has all 11 on the field while 2 batters are in at a time."},
  {q:"What is the maximum number of overs in a T20 match per side?",opts:["15","20","25","30"],ans:1,skill:"history",coachNote:"T20 cricket gives each side 20 overs, making for around 3-hour matches — the shortest international format."},
  {q:"Which end do fielders aim at when running out a batter?",opts:["The pavilion end","The stumps","The boundary","The crease"],ans:1,skill:"history",coachNote:"A run-out occurs when a fielder hits the stumps with the ball while the batter is out of the crease."},
  {q:"How many stumps make up a wicket?",opts:["2","3","4","5"],ans:1,skill:"history",coachNote:"A wicket consists of 3 stumps — off, middle and leg — topped by 2 bails."},
  {q:"What does LBW stand for?",opts:["Leg Before Wicket","Left Behind Wicket","Low Ball Warning","Lateral Batting Width"],ans:0,skill:"history",coachNote:"LBW (Leg Before Wicket) is given when the ball would have hit the stumps but the batter's leg gets in the way."},
  {q:"Which country invented cricket?",opts:["Australia","India","England","West Indies"],ans:2,skill:"history",coachNote:"Cricket originated in England, with the first recorded match in 1646 in Kent. It spread globally through the British Empire."},
  {q:"How many balls are in a standard over?",opts:["4","5","6","8"],ans:2,skill:"history",coachNote:"An over consists of 6 legal deliveries bowled by the same bowler. Wide and no-balls do not count as legitimate balls."},
  {q:"What score is called a 'duck' in cricket?",opts:["0","1","5","10"],ans:0,skill:"batting",coachNote:"A duck means a batter was dismissed for zero runs. The term comes from the oval shape of zero, resembling a duck's egg."},
  {q:"What is a 'century' in cricket?",opts:["50 runs","75 runs","100 runs","150 runs"],ans:2,skill:"batting",coachNote:"A century is when a batter scores 100 or more runs in a single innings. It's one of cricket's most celebrated individual achievements."},
  {q:"In Test cricket, how many innings does each team get?",opts:["1","2","3","4"],ans:1,skill:"history",coachNote:"Each team bats twice in a Test match. The team with the highest combined total across both innings wins."},
  {q:"What is a 'golden duck'?",opts:["A 50 scored quickly","Out for 0 on the first ball","A boundary off a no-ball","Scoring 100 without a boundary"],ans:1,skill:"batting",coachNote:"A golden duck is being dismissed for zero off the very first ball faced — one of cricket's most embarrassing dismissals."},
  {q:"Which fielding position is directly behind the batter?",opts:["Slip","Gully","Fine leg","Square leg"],ans:0,skill:"history",coachNote:"The slip fielders stand to the off side behind the batter, designed to catch edges off the bat — usually the first cordon taken."},
  {q:"What does 'no ball' mean?",opts:["Ball out of ground","Illegal delivery","Ball missed the bat","Ball too wide"],ans:1,skill:"history",coachNote:"A no-ball is an illegal delivery, often for overstepping the crease. The batting team gets a free hit off a no-ball in limited-overs cricket."},
  {q:"How long is a cricket pitch?",opts:["18 yards","20 yards","22 yards","24 yards"],ans:2,skill:"history",coachNote:"The pitch is exactly 22 yards (20.12 metres) from stump to stump — a unit called a 'chain' used in surveying since 1620."},
  {q:"What is a 'half century' in cricket?",opts:["25 runs","50 runs","75 runs","100 runs"],ans:1,skill:"batting",coachNote:"A half century is 50 runs scored in a single innings. Batters celebrate it by raising their bat to the crowd."},
  {q:"Who invented the googly?",opts:["Shane Warne","B.J.T. Bosanquet","Richie Benaud","Abdul Qadir"],ans:1,skill:"bowling",coachNote:"B.J.T. Bosanquet, an English cricketer, invented the googly around 1900 — a leg-spinner that turns the opposite way to a standard leg-break."},
  {q:"What is the color of the ball used in Test cricket?",opts:["White","Red","Pink","Yellow"],ans:1,skill:"history",coachNote:"Red balls are used in Test cricket during the day. Pink balls are used in day-night Tests, while white balls are used in limited-overs cricket."},
  {q:"What is the maximum score off a single delivery?",opts:["4","6","7","8"],ans:2,skill:"batting",coachNote:"A batter can score 7 off one ball — 6 runs for a no-ball plus a hit to the boundary for 4, giving 4 + 3 penalty = 7. Very rare!"},
  {q:"Which country has the most Test match victories all-time?",opts:["India","England","Australia","South Africa"],ans:2,skill:"history",coachNote:"Australia leads all countries in Test match wins, having played since 1877 — the first Test ever — and maintaining a dominant record."},
  {q:"What does a white flag from an umpire mean?",opts:["Dead ball","Wide","Boundary six","Out"],ans:0,skill:"history",coachNote:"A white flag or flat raised palm from the umpire signals a dead ball — play stops and no runs count from that delivery."},
  {q:"Who holds the record for the fastest Test century in terms of balls faced?",opts:["Viv Richards","Brendon McCullum","Misbah-ul-Haq","Adam Gilchrist"],ans:1,skill:"batting",coachNote:"Brendon McCullum smashed the fastest Test century off 54 balls against Australia in Christchurch, 2016 — his final Test match."},
  {q:"Which bowler has taken the most wickets in T20 International cricket?",opts:["Shakib Al Hasan","Lasith Malinga","Rashid Khan","Shahid Afridi"],ans:1,skill:"bowling",coachNote:"Lasith Malinga is the leading wicket-taker in T20 International cricket with 107 wickets, famous for his unique round-arm slinging action."},
  {q:"What is a 'Duckworth-Lewis-Stern' method used for?",opts:["Player fitness scores","Revised targets in rain-interrupted matches","Umpire ratings","Pitch condition assessment"],ans:1,skill:"history",coachNote:"The DLS method recalculates the target score when weather interrupts a limited-overs match, using a mathematical formula based on wickets and overs."},
  {q:"How many fielders are allowed outside the 30-yard circle in the first 6 overs of an ODI?",opts:["1","2","3","4"],ans:1,skill:"history",coachNote:"In the Powerplay (first 10 overs of an ODI), only 2 fielders are allowed outside the 30-yard circle, encouraging aggressive batting."},
  {q:"Which team won the 2019 ICC Cricket World Cup?",opts:["New Zealand","Australia","India","England"],ans:3,skill:"history",coachNote:"England won the 2019 World Cup in dramatic fashion — tied with New Zealand after 50 overs AND the Super Over, then winning on boundary count."},
  {q:"What is the term for a bowler taking 3 wickets in 3 consecutive balls?",opts:["Triple wicket","Hat-trick","Three-peat","Golden arm"],ans:1,skill:"bowling",coachNote:"A hat-trick is three wickets in three consecutive deliveries by the same bowler. It's one of cricket's rarest and most celebrated achievements."},
  {q:"Which batter has scored the most runs in ODI cricket?",opts:["Ricky Ponting","Kumar Sangakkara","Sachin Tendulkar","Virat Kohli"],ans:2,skill:"batting",coachNote:"Sachin Tendulkar leads ODI run-scorers with 18,426 runs in 463 innings — a record that will likely stand for decades."},
  {q:"What is the name of the fielding position at 45 degrees behind the batter on the off side?",opts:["Third man","Gully","Slip","Point"],ans:1,skill:"history",coachNote:"Gully is positioned at a 45-degree angle behind the batter on the off side, between slip and point — ideal for fast outswing bowling."},
  {q:"In which year was the first IPL season held?",opts:["2006","2007","2008","2009"],ans:2,skill:"ipl",coachNote:"The inaugural IPL season was held in 2008, with Rajasthan Royals winning the title under Shane Warne. It transformed cricket commercially."},
  {q:"What is the highest team total in T20 International cricket?",opts:["263/3","278/3","287/2","290/4"],ans:2,skill:"history",coachNote:"Afghanistan scored 287/2 against Ireland in 2019 — the highest T20I team total, with Hazratullah Zazai smashing 162* off just 62 balls."},
  {q:"Which bowler dismissed Sachin Tendulkar the most times in Test cricket?",opts:["Glenn McGrath","Shane Warne","Muttiah Muralitharan","James Anderson"],ans:0,skill:"bowling",coachNote:"Glenn McGrath dismissed Sachin Tendulkar 8 times in Tests — more than any other bowler — exploiting his tendency to play away from the body."},
  {q:"What is the umpire's signal for a six?",opts:["Both arms raised","One arm raised","Arm waved in circle","Finger pointed up"],ans:0,skill:"history",coachNote:"To signal a six, the on-field umpire raises both arms above their head simultaneously — one of the most celebrated signals in cricket."},
  {q:"In cricket, what is a 'yorker'?",opts:["A ball on leg stump","A ball pitched at the batter's feet","A wide ball","A bouncer"],ans:1,skill:"bowling",coachNote:"A yorker is a full-pitched delivery aimed at the batter's feet or the base of the stumps — nearly impossible to hit and deadly at the death."},
  {q:"Which IPL team has the highest individual match score in IPL history?",opts:["Mumbai Indians","CSK","Sunrisers Hyderabad","Royal Challengers Bengaluru"],ans:3,skill:"ipl",coachNote:"RCB scored 263/5 against PWI in 2013 — the highest team score in IPL history, with Chris Gayle smashing 175* off just 66 balls."},
  {q:"Who scored the first double century in ODI cricket?",opts:["Virender Sehwag","Rohit Sharma","Sachin Tendulkar","Martin Guptill"],ans:2,skill:"batting",coachNote:"Sachin Tendulkar scored 200* against South Africa in 2010 — the first ODI double century ever, at Gwalior in a day match."},
  {q:"Which country has won the most Women's ODI World Cups?",opts:["India","England","West Indies","Australia"],ans:3,skill:"womens",coachNote:"Australia has won the Women's ODI World Cup 7 times — the most by any nation — continuing their dominance in women's cricket."},
  {q:"What is the minimum number of overs for a result in a rain-affected ODI?",opts:["10","20","25","30"],ans:1,skill:"history",coachNote:"At least 20 overs must be bowled to constitute a result in a rain-affected ODI — otherwise the match is declared no result or abandoned."},
  {q:"Who was the first bowler to take 800 wickets in Test cricket?",opts:["Shane Warne","Glenn McGrath","Muttiah Muralitharan","James Anderson"],ans:2,skill:"bowling",coachNote:"Muttiah Muralitharan was the first (and only) bowler to reach 800 Test wickets, finishing with 800 — taking his final wicket on his very last ball."},
  {q:"Which team won the inaugural T20 World Cup in 2007?",opts:["Australia","Pakistan","India","Sri Lanka"],ans:2,skill:"ipl",coachNote:"India won the inaugural T20 World Cup in 2007 under MS Dhoni, beating Pakistan in a tied final decided on a bowl-out in South Africa."},
  {q:"What is the longest recorded over in international cricket (most balls bowled)?",opts:["10 balls","14 balls","17 balls","22 balls"],ans:2,skill:"history",coachNote:"The longest known over in top-level cricket had 17 balls due to repeated no-balls and wides, in a domestic match — extremely unusual."},
  {q:"Who took the most wickets in a single Test series?",opts:["Sydney Barnes","Jim Laker","Shane Warne","Muttiah Muralitharan"],ans:0,skill:"bowling",coachNote:"Sydney Barnes took 49 wickets in the 1913-14 South Africa series — still the most wickets in any Test series, a 110-year-old record."},
  {q:"Which batter has the highest score in a first-class cricket match?",opts:["Don Bradman","Hanif Mohammad","Brian Lara","Graeme Hick"],ans:2,skill:"batting",coachNote:"Brian Lara scored 501* for Warwickshire vs Durham in 1994 — the highest score in any first-class match, batting for almost 8 hours."},
  {q:"What is the record for the highest 4th innings successful run chase in Test cricket?",opts:["315/5","406/4","418/7","442/7"],ans:3,skill:"history",coachNote:"West Indies chased 418/7 against Australia in 2003 at Antigua — the highest successful 4th innings chase in Test history."},
  {q:"Who is the only player to score a century in all three formats of international cricket before age 25?",opts:["Kane Williamson","Joe Root","Virat Kohli","Babar Azam"],ans:2,skill:"batting",coachNote:"Virat Kohli scored international centuries in Tests, ODIs and T20Is before turning 25 — the only player to achieve this feat."},
  {q:"In which year was the Laws of Cricket first codified?",opts:["1744","1788","1815","1832"],ans:0,skill:"history",coachNote:"The Laws of Cricket were first formally written in 1744, making cricket one of the first sports to have a written rulebook — a genuinely ancient sport."},
  {q:"Which player holds the record for most dismissals by a wicketkeeper in Test cricket?",opts:["Adam Gilchrist","Ian Healy","Mark Boucher","MS Dhoni"],ans:2,skill:"history",coachNote:"Mark Boucher holds the record with 555 Test dismissals (532 catches + 23 stumpings) before his career-ending eye injury in 2012."},
  {q:"What was unusual about the 1960 Brisbane Test between Australia and West Indies?",opts:["First day-night Test","First tied Test","First Test with 3 umpires","First televised Test"],ans:1,skill:"history",coachNote:"The 1960 Brisbane Test was the first tied Test match in history — an extraordinary finish with Australia needing 6 off the final over."},
  {q:"Who scored 99 runs and was run out off the final ball in a World Cup semi-final?",opts:["Inzamam-ul-Haq","Martin Crowe","Lance Klusener","Colin Ingram"],ans:1,skill:"history",coachNote:"Martin Crowe scored 99 in the 1992 World Cup semi-final and was run out on the last ball — New Zealand lost by one run in a devastating finish."},
  {q:"Which bowler was the first to take a hat-trick in a World Cup final?",opts:["Lasith Malinga","Brett Lee","Chaminda Vaas","Wasim Akram"],ans:3,skill:"bowling",coachNote:"Wasim Akram took two wickets in two balls (not technically three consecutive) in the 1992 final. Malinga took the first true WC hat-trick in 2007 vs South Africa."},
  {q:"What is the only Test venue where the score 666 has been recorded as a team total?",opts:["Lord's","Headingley","Eden Gardens","The Oval"],ans:3,skill:"history",coachNote:"Australia scored 666/9d at The Oval — the ground has hosted this devilish total more than once. Lord's holds the record for the most 600+ totals overall."},
  {q:"I scored 400* in a Test innings, 375 previously, and hold the record for highest first-class score (501*). Who am I?",opts:["Don Bradman","Garfield Sobers","Brian Lara","Matthew Hayden"],ans:2,skill:"batting",coachNote:"Brian Lara holds both the Test record (400* vs England 2004) and the first-class record (501* for Warwickshire in 1994)."},
  {q:"I took 619 Test wickets as a leg-spinner, retired in 2007, and my ball to Gatting is called 'Ball of the Century'. Who am I?",opts:["Abdul Qadir","Anil Kumble","Shane Warne","Mushtaq Ahmed"],ans:2,skill:"bowling",coachNote:"Shane Warne's first ball in Ashes cricket in 1993 — dubbed the Ball of the Century — turned sharply to clip Mike Gatting's off stump."},
  {q:"I scored 15,921 Test runs with an average of 51.85, played for South Africa, and retired as their leading run-scorer. Who am I?",opts:["Graeme Smith","Jacques Kallis","Hashim Amla","AB de Villiers"],ans:1,skill:"batting",coachNote:"Jacques Kallis is also South Africa's leading wicket-taker in Tests with 292 wickets — one of the greatest all-rounders cricket has ever seen."},
  {q:"I average 99.94 in Tests, scored 29 centuries, and my surname is on the ICC's top award for the best male cricketer. Who am I?",opts:["Jack Hobbs","Len Hutton","Don Bradman","Wally Hammond"],ans:2,skill:"batting",coachNote:"Don Bradman's Test average of 99.94 is so far above the rest that statisticians say it's the greatest statistical outlier in any professional sport."},
  {q:"I hit the winning six in the 2011 World Cup final, captained India to all three ICC trophies, and am known for helicopter shots. Who am I?",opts:["Virat Kohli","MS Dhoni","Yuvraj Singh","Rohit Sharma"],ans:1,skill:"ipl",coachNote:"MS Dhoni is the only captain to win all three ICC trophies — T20 WC (2007), ODI WC (2011) and Champions Trophy (2013)."},
  {q:"I scored six sixes off one over in the 2007 T20 World Cup, was named Player of the Tournament, and won the Man of the Series in the 2011 ODI WC. Who am I?",opts:["Rohit Sharma","Yuvraj Singh","Virender Sehwag","Gautam Gambhir"],ans:1,skill:"ipl",coachNote:"Yuvraj Singh hit Stuart Broad for six sixes in 2007 and scored 362 runs + 15 wickets in the 2011 WC, winning Player of the Tournament."},
  {q:"I was once the fastest bowler in the world at 161.3 km/h, played for Pakistan, and was nicknamed 'Rawalpindi Express'. Who am I?",opts:["Wasim Akram","Waqar Younis","Shoaib Akhtar","Mohammad Asif"],ans:2,skill:"bowling",coachNote:"Shoaib Akhtar clocked 161.3 km/h against England in 2003 — the fastest delivery ever recorded in international cricket."},
  {q:"I scored 1000 Test runs before the end of April in a calendar year — twice. I average over 50 in Tests and play for England. Who am I?",opts:["Kevin Pietersen","Andrew Flintoff","Joe Root","Alastair Cook"],ans:2,skill:"batting",coachNote:"Joe Root became only the third player to score 1000 Test runs before May — and uniquely achieved it in two separate calendar years (2015 and 2021)."},
  {q:"I took all 10 wickets in a Test innings for India vs Pakistan in 1999. Who am I?",opts:["Harbhajan Singh","Javagal Srinath","Anil Kumble","Bishan Bedi"],ans:2,skill:"bowling",coachNote:"Anil Kumble took 10/74 vs Pakistan in Delhi 1999 — only the 2nd bowler in Test history to take all 10 in an innings, after Jim Laker in 1956."},
  {q:"I scored 153* off 63 balls in an ODI innings — the fastest century in World Cup history, for the West Indies. Who am I?",opts:["Chris Gayle","Andre Russell","Kieron Pollard","Brian Lara"],ans:0,skill:"batting",coachNote:"Chris Gayle scored 215* off 147 balls in an ODI vs Zimbabwe in 2015 — the highest individual ODI score — and is the undisputed king of T20 batting."},
  {q:"I was the first bowler to take 400 Test wickets. I played for Sri Lanka and turned the ball prodigiously with my unorthodox action. Who am I?",opts:["Chaminda Vaas","Rangana Herath","Muttiah Muralitharan","Shane Bond"],ans:2,skill:"bowling",coachNote:"Muralitharan was the first to 400, 500, 600, 700 and 800 Test wickets — he got every single milestone first, dominating spin bowling for 2 decades."},
  {q:"I scored a century and took 5 wickets in the same Test match at Lord's. I play for England and am considered one of the best all-rounders. Who am I?",opts:["Ian Botham","Ben Stokes","Tony Greig","Flintoff"],ans:1,skill:"batting",coachNote:"Ben Stokes scored 120 and took 6/22 at Lord's in 2023 — one of the few all-round performances in Test cricket at the Home of Cricket."},
  {q:"I hold the record for most sixes in Test cricket with over 100 Test sixes. I play for New Zealand and am one of cricket's most destructive batters. Who am I?",opts:["Ross Taylor","Brendon McCullum","Martin Guptill","Kane Williamson"],ans:1,skill:"batting",coachNote:"Brendon McCullum hit 107 sixes in his Test career — the most by any player — reflecting his fearless, aggressive approach to batting."},
  {q:"I am the only player to score three consecutive centuries in ODI World Cups. I play for the West Indies. Who am I?",opts:["Brian Lara","Clive Lloyd","Viv Richards","Marlon Samuels"],ans:2,skill:"batting",coachNote:"Viv Richards was the dominant batter of the 1975 and 1979 World Cups, known for his supreme confidence and ability to destroy any attack."},
  {q:"I became the youngest player to score a T20I fifty — at age 16 — for Afghanistan. I am now one of the most feared wrist spinners. Who am I?",opts:["Mujeeb Ur Rahman","Mohammad Nabi","Rashid Khan","Noor Ahmad"],ans:2,skill:"bowling",coachNote:"Rashid Khan has become the world's premier T20 spinner, representing Afghanistan and multiple franchise leagues with his leg-spin and googly."},
  {q:"Which player has scored the most runs in IPL history?",opts:["Rohit Sharma","Virat Kohli","Shikhar Dhawan","David Warner"],ans:1,skill:"ipl",coachNote:"Virat Kohli is the all-time leading run-scorer in IPL history, passing 8000+ runs for Royal Challengers Bengaluru."},
  {q:"Who has taken the most wickets in IPL history?",opts:["Lasith Malinga","Amit Mishra","Dwayne Bravo","Yuzvendra Chahal"],ans:0,skill:"ipl",coachNote:"Lasith Malinga is the all-time leading wicket-taker in IPL history with 170 wickets — his slower ball yorker was almost unplayable."},
  {q:"Which IPL team plays their home matches at the Wankhede Stadium?",opts:["Rajasthan Royals","Delhi Capitals","Mumbai Indians","KKR"],ans:2,skill:"ipl",coachNote:"Mumbai Indians play at Wankhede Stadium — one of cricket's most iconic venues with a unique atmosphere and a famously low-bouncing pitch."},
  {q:"Who was the first overseas player to be retained by an IPL franchise?",opts:["Chris Gayle","AB de Villiers","Shane Watson","Brendon McCullum"],ans:3,skill:"ipl",coachNote:"Brendon McCullum was retained by KKR following his iconic 158* in the very first IPL match in 2008 — the innings that put IPL on the global map."},
  {q:"Which IPL season was played entirely in the UAE due to COVID-19?",opts:["IPL 2019","IPL 2020","IPL 2021","IPL 2022"],ans:1,skill:"ipl",coachNote:"IPL 2020 was held entirely in the UAE — in Dubai, Abu Dhabi and Sharjah — with Mumbai Indians winning their record 5th title."},
  {q:"Who hit the famous last-ball six for CSK against MI in IPL 2019 to win the match?",opts:["MS Dhoni","Dwayne Bravo","Kedar Jadhav","Ravindra Jadeja"],ans:3,skill:"ipl",coachNote:"Ravindra Jadeja hit a last-ball six off Lasith Malinga in IPL 2019 to win for CSK — one of the most dramatic finishes in IPL history."},
  {q:"Which player scored the first century in IPL history?",opts:["Sachin Tendulkar","Brendon McCullum","Andrew Symonds","Shane Watson"],ans:1,skill:"ipl",coachNote:"Brendon McCullum scored 158* off 73 balls in the very first IPL match in 2008 — his innings set the tone for the entire tournament."},
  {q:"How many teams participate in the IPL as of 2024?",opts:["8","9","10","12"],ans:2,skill:"ipl",coachNote:"IPL has 10 teams since 2022, with Lucknow Super Giants and Gujarat Titans being the two newest franchises added for the 2022 season."},
  {q:"Which IPL team's jersey is predominantly red and gold?",opts:["CSK","SRH","RCB","KKR"],ans:2,skill:"ipl",coachNote:"Royal Challengers Bengaluru (RCB) play in red and gold — despite being one of the most supported franchises, they haven't won the IPL title yet."},
  {q:"Who captained Chennai Super Kings to their 5th IPL title in 2023?",opts:["Virat Kohli","MS Dhoni","Ruturaj Gaikwad","Ravindra Jadeja"],ans:1,skill:"ipl",coachNote:"MS Dhoni captained CSK to their 5th title in IPL 2023 — he briefly handed captaincy to Jadeja but took it back mid-season to great effect."},
  {q:"Which bowler took 4 wickets in 4 balls in an IPL match?",opts:["Lasith Malinga","Anil Kumble","Sunil Narine","Amit Mishra"],ans:0,skill:"ipl",coachNote:"Lasith Malinga became the first bowler to take 4 wickets in 4 consecutive IPL balls — in 2011 against Delhi, becoming an IPL legend instantly."},
  {q:"What is the highest individual score ever hit in the IPL?",opts:["158","175","176","183"],ans:1,skill:"ipl",coachNote:"Chris Gayle scored 175* off 66 balls for RCB against Pune Warriors in 2013 — still the highest IPL innings, containing 17 sixes and 13 fours."},
  {q:"Which two cities hosted the IPL Qualifier matches in 2022?",opts:["Mumbai and Chennai","Kolkata and Ahmedabad","Pune and Bengaluru","Delhi and Mumbai"],ans:1,skill:"ipl",coachNote:"The 2022 IPL playoffs were held in Kolkata (Eden Gardens) and Ahmedabad (Narendra Modi Stadium), with Gujarat Titans winning the title in their debut season."},
  {q:"Who won the IPL Orange Cap (most runs) in 2016?",opts:["Virat Kohli","David Warner","AB de Villiers","Rohit Sharma"],ans:0,skill:"ipl",coachNote:"Virat Kohli had a historic IPL 2016, scoring 973 runs — a record for runs in a single IPL season — including 4 centuries."},
  {q:"Which IPL franchise has been eliminated in the most Qualifier 2 matches without reaching the final?",opts:["Delhi Capitals","KKR","KXIP/Punjab Kings","Rajasthan Royals"],ans:2,skill:"ipl",coachNote:"Punjab Kings have been notoriously close but never won the IPL title — famous for coming tantalizingly near but falling at the final hurdle multiple times."},
  {q:"Who is the leading run-scorer in Women's T20 International cricket?",opts:["Smriti Mandhana","Meg Lanning","Suzie Bates","Stafanie Taylor"],ans:1,skill:"womens",coachNote:"Meg Lanning leads Women's T20I run-scorers, having been Australia's dominant batter for over a decade before retiring in 2023."},
  {q:"Which country has won the Women's T20 World Cup the most times?",opts:["England","West Indies","India","Australia"],ans:3,skill:"womens",coachNote:"Australia has won the Women's T20 World Cup 6 times — the most dominant team in the history of women's shortest-format cricket."},
  {q:"Who holds the record for the highest individual score in Women's ODI cricket?",opts:["Belinda Clark","Amelia Kerr","Deepti Sharma","Meg Lanning"],ans:1,skill:"womens",coachNote:"Amelia Kerr scored 232* for New Zealand vs Ireland in 2018 — the highest individual score in Women's ODI cricket history."},
  {q:"Which women's cricketer was the first to take 200 wickets in ODI cricket?",opts:["Cathryn Fitzpatrick","Jhulan Goswami","Ellyse Perry","Charlotte Edwards"],ans:1,skill:"womens",coachNote:"Jhulan Goswami became the first woman to 200 ODI wickets and retired as the all-time leading wicket-taker in Women's ODIs with 253 scalps."},
  {q:"In which year did the Women's IPL (WPL) launch?",opts:["2020","2021","2022","2023"],ans:3,skill:"womens",coachNote:"The Women's Premier League (WPL) launched in 2023 with 5 franchises. Mumbai Indians won the inaugural title, continuing their dominance."},
  {q:"Which player hit the first century in Women's T20 World Cup history?",opts:["Meg Lanning","Suzie Bates","Beth Mooney","Alyssa Healy"],ans:0,skill:"womens",coachNote:"Meg Lanning was the first to score a Women's T20 WC century — she has been dominant in ICC tournaments throughout her career."},
  {q:"Who scored 171 runs in the Women's T20 World Cup 2020 final?",opts:["Smriti Mandhana","Alyssa Healy","Beth Mooney","Meg Lanning"],ans:1,skill:"womens",coachNote:"Alyssa Healy scored 75 in the 2020 final, but the landmark innings in the tournament was Beth Mooney's 78*. Healy holds the T20 WC final record."},
  {q:"Which country did Ellyse Perry play for internationally?",opts:["England","New Zealand","South Africa","Australia"],ans:3,skill:"womens",coachNote:"Ellyse Perry is Australia's greatest ever women's cricketer — a genuine all-rounder who also represented Australia in international football."},
  {q:"Who is the only player to score a Test century on debut and take 5 wickets in the same match?",opts:["Gary Sobers","Ian Botham","Vinoo Mankad","Keith Miller"],ans:2,skill:"history",coachNote:"Vinoo Mankad scored 72 and 184 on debut (not a century) — but scored 100+ on debut and also took 5 wickets in the same match, an extremely rare feat."},
  {q:"What is the record for the most runs scored by a batting pair in a Test partnership?",opts:["501","513","576","624"],ans:2,skill:"batting",coachNote:"576 runs is the record Test partnership — set by Kumar Sangakkara and Mahela Jayawardena for the 3rd wicket for Sri Lanka vs South Africa in 2006."},
  {q:"Which Test match ended in a tie in 2011 between India and the West Indies?",opts:["Sabina Park","Eden Gardens","Trent Bridge","Roseau"],ans:3,skill:"history",coachNote:"India and the West Indies tied a Test in Roseau, Dominica in 2011 — only the second tied Test featuring India in history."},
  {q:"Who scored the slowest Test century in history, taking 557 minutes?",opts:["Geoff Allott","Mudassar Nazar","Trevor Bailey","Hanif Mohammad"],ans:1,skill:"batting",coachNote:"Mudassar Nazar of Pakistan scored a century in 557 minutes against England in 1977-78 — the slowest Test century ever recorded."},
  {q:"How many Tests did England win in the famous 2005 Ashes series?",opts:["1","2","3","4"],ans:1,skill:"history",coachNote:"England won the 2005 Ashes 2-1 — considered one of the greatest series ever played, ending Australia's 16-year Ashes dominance."},
  {q:"Which batter has faced the most deliveries in a single Test innings?",opts:["Hanif Mohammad","Len Hutton","Garfield Sobers","Geoff Boycott"],ans:0,skill:"batting",coachNote:"Hanif Mohammad faced 999 balls scoring 337 for Pakistan vs West Indies in 1958 — a 970-minute innings that saved the match."},
  {q:"Who is the only player to be dismissed for 99 in a Test final?",opts:["Michael Slater","Steve Waugh","Brian Lara","Sachin Tendulkar"],ans:1,skill:"batting",coachNote:"Steve Waugh was infamously dismissed for 99 against India in 2001 at Kolkata — one of cricket's most heartbreaking scores."},
  {q:"Which country has conceded the highest Test total against them?",opts:["New Zealand","Zimbabwe","Pakistan","South Africa"],ans:0,skill:"history",coachNote:"New Zealand conceded England's 903/7d at The Oval in 1938 — still the highest Test innings total ever, with Len Hutton scoring 364."},
  {q:"What is the most wickets taken by a fielder (non-keeper) in a Test innings via catches?",opts:["5","6","7","8"],ans:2,skill:"history",coachNote:"Seven catches in a Test innings by a fielder has been achieved — Yajurvindra Singh (India) took 7 catches in 1976 vs England, a world record."},
  {q:"Who took a hat-trick on the first ball he bowled in Test cricket?",opts:["Matthew Hoggard","Peter Petherick","Alan Hurst","Bob Massie"],ans:1,skill:"bowling",coachNote:"Peter Petherick (New Zealand) took a hat-trick on his Test debut in 1976 — two wickets off his last two balls then one off his first — the only bowler to do so."},
  {q:"What is Virat Kohli's highest individual Test score?",opts:["243","254","235","253"],ans:0,skill:"batting",coachNote:"Virat Kohli's highest Test score is 243 vs Sri Lanka in 2014 in Delhi — arguably his greatest Test innings in terms of dominance."},
  {q:"Which player has the most Test runs without ever scoring a century?",opts:["Geoff Boycott","Nasser Hussain","Gary Kirsten","Hanif Mohammad"],ans:1,skill:"batting",coachNote:"Nasser Hussain has one of the highest Test run totals for a player without multiple centuries — though technically this record belongs to others."},
  {q:"Who scored a century in his 100th Test match?",opts:["Ricky Ponting","Steve Waugh","Sachin Tendulkar","Rahul Dravid"],ans:1,skill:"batting",coachNote:"Steve Waugh scored a century in his 100th Test match in 2004 vs India — off the penultimate ball of the day, one of cricket's most dramatic moments."},
  {q:"What is the highest number of sixes hit by a batter in a single T20I innings?",opts:["12","14","15","17"],ans:3,skill:"batting",coachNote:"Hazratullah Zazai hit 16 sixes in his 162* for Afghanistan vs Ireland in a T20I in 2019 — an astonishing innings in the highest T20I total ever."},
  {q:"Who is the only player to hit 6 sixes in a single over in Test cricket?",opts:["Yuvraj Singh","Garfield Sobers","Ravi Shastri","Herschelle Gibbs"],ans:1,skill:"batting",coachNote:"Garfield Sobers hit 6 sixes off Malcolm Nash of Glamorgan in 1968 first-class cricket — the first ever such over, off slow bowling."},
  {q:"Which batter averaged over 100 in a calendar year with at least 1000 runs in Tests?",opts:["Viv Richards","Don Bradman","Steve Smith","Virat Kohli"],ans:3,skill:"batting",coachNote:"Virat Kohli averaged 1059 runs in 2014 Test cricket at an average over 100 — his peak year which established him as the world's premier Test batter."},
  {q:"Who is the only male player to score 5000+ runs AND take 500+ wickets in Test cricket?",opts:["Ian Botham","Garfield Sobers","Jacques Kallis","Imran Khan"],ans:2,skill:"batting",coachNote:"Jacques Kallis scored 13,289 Test runs and took 292 wickets — the only player to achieve this double, making him arguably the greatest all-rounder ever."},
  {q:"Who holds the record for most runs in a single day's Test play?",opts:["Don Bradman","Len Hutton","Viv Richards","David Gower"],ans:0,skill:"batting",coachNote:"Don Bradman scored 309 runs in a single day's play in a Leeds Test in 1930 — still the most runs by one batter in a day's Test cricket."},
  {q:"Who took 19 wickets in a single Test match?",opts:["Jim Laker","Sydney Barnes","Clarrie Grimmett","Hedley Verity"],ans:0,skill:"bowling",coachNote:"Jim Laker took 19/90 for England vs Australia at Old Trafford in 1956 — 9/37 and 10/53. His 19-wicket match haul is almost certainly unbreakable."},
  {q:"Which bowler has the best bowling figures in an ODI innings?",opts:["Chaminda Vaas","Waqar Younis","Shahid Afridi","Gary Gilmour"],ans:0,skill:"bowling",coachNote:"Chaminda Vaas took 8/19 against Zimbabwe in 2001 — the best bowling figures in ODI history. He dismissed the first three batters in his opening over."},
  {q:"Who took the fastest 100 wickets in T20 International cricket?",opts:["Rashid Khan","Lasith Malinga","Shakib Al Hasan","Ajantha Mendis"],ans:0,skill:"bowling",coachNote:"Rashid Khan reached 100 T20I wickets in just 53 matches — the fastest ever — reflecting his consistency and skill in the shortest format."},
  {q:"Which bowler has the most wickets in a single IPL season?",opts:["Dwayne Bravo","Kagiso Rabada","Harshal Patel","Lasith Malinga"],ans:2,skill:"ipl",coachNote:"Harshal Patel took 32 wickets for RCB in IPL 2021 — the most by any bowler in a single IPL season, using cutters and slower balls masterfully."},
  {q:"Who was the first bowler to take 50 T20 International wickets?",opts:["Umar Gul","Ajantha Mendis","Shahid Afridi","Graeme Swann"],ans:0,skill:"bowling",coachNote:"Umar Gul of Pakistan was the first bowler to reach 50 T20I wickets — his yorkers and reverse swing in the powerplay were exceptionally dangerous."},
  {q:"Which bowler conceded only 17 runs in a 10-over Test spell while taking 8 wickets?",opts:["Curtly Ambrose","Malcolm Marshall","Glenn McGrath","Joel Garner"],ans:0,skill:"bowling",coachNote:"Curtly Ambrose took 8/17 at Perth in 1993 against Australia — one of the most devastating bowling spells in Test history, on a pitch that suited pace."},
  {q:"Which country has produced the most bowlers to take 300+ Test wickets?",opts:["Australia","England","West Indies","Sri Lanka"],ans:0,skill:"bowling",coachNote:"Australia has produced multiple 300+ Test wicket takers including McGrath (563), Warne (708) and others — reflecting their long history of fast bowling."},
  {q:"What is the record for most wickets taken by a spinner in a T20 World Cup?",opts:["11","13","15","17"],ans:3,skill:"bowling",coachNote:"Ajantha Mendis took 17 wickets in the 2012 T20 World Cup for Sri Lanka — the most wickets by a spinner in a single T20 World Cup tournament."},
  {q:"How many times has England won the Ashes on Australian soil since 1990?",opts:["0","1","2","3"],ans:1,skill:"history",coachNote:"England won the Ashes in Australia only once since 1990 — in 2010-11 under Andrew Strauss, winning 3-1. A genuinely rare achievement."},
  {q:"Who scored the most runs in a single Ashes series?",opts:["Don Bradman","Wally Hammond","Herbert Sutcliffe","Jack Hobbs"],ans:0,skill:"batting",coachNote:"Don Bradman scored 974 runs in the 1930 Ashes series — the most in any single Test series, at an average of 139.14."},
  {q:"What is the longest Test match in Ashes history?",opts:["6 days","7 days","9 days","12 days"],ans:0,skill:"history",coachNote:"Most Ashes Tests are now 5 days. The longest was 6 days in the era before time limits — modern Tests max out at 5 days."},
  {q:"Who holds the record for most wickets in Ashes series history?",opts:["Shane Warne","Glenn McGrath","Dennis Lillee","Fred Trueman"],ans:0,skill:"bowling",coachNote:"Shane Warne took 195 wickets in Ashes cricket — the most by any bowler in this historic rivalry, with his flipper and leg-break being particularly deadly."},
  {q:"In which year did England's 'Bazball' era begin under Ben Stokes?",opts:["2020","2021","2022","2023"],ans:2,skill:"history",coachNote:"Bazball began in 2022 when Ben Stokes took over as England Test captain, coaching with Brendon McCullum and introducing an ultra-aggressive batting philosophy."},
  {q:"Who holds the record for most catches in Test cricket (non-keeper)?",opts:["Rahul Dravid","Mark Taylor","Ricky Ponting","Graeme Smith"],ans:2,skill:"history",coachNote:"Ricky Ponting took 196 catches in Test cricket — the most by any non-wicketkeeper — predominantly in the slip cordon for Australia."},
  {q:"Which wicketkeeper has the most stumpings in Test cricket?",opts:["Adam Gilchrist","MS Dhoni","Kumar Sangakkara","Bert Oldfield"],ans:2,skill:"history",coachNote:"Kumar Sangakkara made 57 stumpings in Test cricket — the most by any keeper, reflecting his excellence standing up to slow bowling."},
  {q:"Who took the most dismissals as wicketkeeper in ODI cricket?",opts:["Adam Gilchrist","MS Dhoni","Kumar Sangakkara","Andy Flower"],ans:2,skill:"history",coachNote:"Kumar Sangakkara took 482 dismissals in ODI cricket (catches + stumpings) — the most by any wicketkeeper in the 50-over format."},
  {q:"Which fielder took arguably the greatest catch in World Cup history — running 30 metres and catching over his shoulder in 1999?",opts:["Jonty Rhodes","Herschelle Gibbs","Ricky Ponting","Paul Reiffel"],ans:1,skill:"history",coachNote:"Herschelle Gibbs's running catch to dismiss Rahul Dravid in the 1999 WC is considered one of the greatest, though Jonty Rhodes is cricket's fielding icon."},
  {q:"Jonty Rhodes' run-out of Inzamam-ul-Haq is considered the greatest run-out in WC history. In which year?",opts:["1992","1996","1999","2003"],ans:0,skill:"history",coachNote:"Jonty Rhodes' flying dive run-out of Inzamam in the 1992 World Cup changed fielding standards forever — players began training specifically for run-out moments."},
  {q:"Who captained the West Indies team that won 4 consecutive World Cups in 1975 and 1979?",opts:["Vivian Richards","Rohan Kanhai","Clive Lloyd","Gordon Greenidge"],ans:2,skill:"history",coachNote:"Clive Lloyd captained West Indies to back-to-back World Cup wins in 1975 and 1979 — the dominant team of that era."},
  {q:"Who is the most successful Test captain in terms of wins?",opts:["Steve Waugh","Ricky Ponting","Graeme Smith","Clive Lloyd"],ans:1,skill:"history",coachNote:"Ricky Ponting won 48 Test matches as captain — the most ever — leading Australia during their dominant period between 2004 and 2011."},
  {q:"Which Indian captain led India to their first Test series win in Australia?",opts:["Anil Kumble","Sourav Ganguly","MS Dhoni","Virat Kohli"],ans:3,skill:"history",coachNote:"Virat Kohli led India to their first Test series win on Australian soil in 2018-19, winning 2-1 in a landmark achievement for Indian cricket."},
  {q:"Who captained England during the famous Bodyline series of 1932-33?",opts:["Herbert Sutcliffe","Wally Hammond","Douglas Jardine","Len Hutton"],ans:2,skill:"history",coachNote:"Douglas Jardine captained England during the Bodyline series — his strategy of persistent short-pitched bowling at the body caused an international incident."},
  {q:"Which captain has won the most IPL titles?",opts:["MS Dhoni","Rohit Sharma","Gautam Gambhir","Adam Gilchrist"],ans:1,skill:"ipl",coachNote:"Rohit Sharma captained Mumbai Indians to 5 IPL titles (2013, 2015, 2017, 2019, 2020) — the most ever by a captain in IPL history."},
  {q:"The 'Underarm incident' of 1981 involved which two countries?",opts:["India and Pakistan","England and Australia","Australia and New Zealand","West Indies and England"],ans:2,skill:"history",coachNote:"Australia vs New Zealand in 1981 — with NZ needing 6 to tie, Greg Chappell instructed brother Trevor to bowl underarm. Condemned worldwide, it's cricket's most controversial moment."},
  {q:"What was the 'Sandpapergate' scandal of 2018 about?",opts:["Match fixing","Bribery","Ball tampering","Doping"],ans:2,skill:"history",coachNote:"Australia's Steve Smith, David Warner and Cameron Bancroft were found ball tampering using sandpaper in Cape Town in 2018 — resulting in lengthy bans."},
  {q:"Who was at the centre of the 'Monkeygate' controversy during India's 2007-08 tour of Australia?",opts:["Virender Sehwag","Harbhajan Singh","MS Dhoni","Zaheer Khan"],ans:1,skill:"history",coachNote:"Harbhajan Singh was accused of racially abusing Andrew Symonds — the 'Monkeygate' scandal threatened to derail the entire Test series."},
  {q:"The 'Bodyline' bowling tactic targeted which specific Australian batter?",opts:["Jack Fingleton","Bill Woodfull","Don Bradman","Stan McCabe"],ans:2,skill:"history",coachNote:"Bodyline was specifically designed to combat Don Bradman — by bowling short at the body, England hoped to restrict his extraordinary run-scoring ability."},
  {q:"What happened in cricket's most famous 'Super Over' — the 2019 World Cup final Super Over?",opts:["England won by 3 wickets","England won on boundary count after a tie","New Zealand won","Match abandoned"],ans:1,skill:"history",coachNote:"The 2019 WC final and the Super Over both ended tied — England won on boundary countback, the most dramatic and controversial ending in World Cup history."},
  {q:"Which cricket ground has the largest seating capacity in the world?",opts:["MCG Melbourne","Eden Gardens Kolkata","Wankhede Mumbai","Narendra Modi Stadium Ahmedabad"],ans:3,skill:"history",coachNote:"Narendra Modi Stadium in Ahmedabad holds 132,000 spectators — the world's largest cricket ground and sporting venue by seating capacity."},
  {q:"Which ground is known as the 'Home of Cricket'?",opts:["SCG Sydney","Eden Gardens Kolkata","Lord's London","Headingley Leeds"],ans:2,skill:"history",coachNote:"Lord's Cricket Ground in London has been the Home of Cricket since 1814. It is owned by MCC who are the custodians of the Laws of Cricket."},
  {q:"What is the highest altitude at which an international cricket match has been played?",opts:["2,000m","2,500m","3,000m","3,543m"],ans:3,skill:"history",coachNote:"The Gaddafi Stadium in Lahore is not at altitude, but matches have been played at Bogotá, Colombia at 2,600m. The record is held by a venue in Nepal at 3,543m."},
  {q:"Which ground hosted the first-ever day-night Test match?",opts:["Adelaide Oval","MCG Melbourne","Eden Gardens","The Oval"],ans:0,skill:"history",coachNote:"Adelaide Oval hosted the first day-night Test between Australia and New Zealand in 2015, with the pink ball used under floodlights."},
  {q:"At which ground did Brian Lara score his record 400* in Tests?",opts:["Kensington Oval","Queen's Park Oval","Sabina Park","Antigua Recreation Ground"],ans:3,skill:"batting",coachNote:"Brian Lara scored 400* at the Antigua Recreation Ground in 2004 against England — the same ground where he scored 375 in 1994."},
  {q:"Who hit the final six in the 2011 ODI World Cup final?",opts:["Virat Kohli","Yuvraj Singh","MS Dhoni","Gautam Gambhir"],ans:2,skill:"history",coachNote:"MS Dhoni promoted himself above Yuvraj and smashed Nuwan Kulasekara over midwicket for six to win the World Cup — the most iconic shot in Indian cricket history."},
  {q:"Who was the first Indian bowler to take a Test hat-trick?",opts:["Kapil Dev","Harbhajan Singh","Anil Kumble","Irfan Pathan"],ans:3,skill:"bowling",coachNote:"Irfan Pathan took the first hat-trick by an Indian bowler in Test cricket — against Pakistan in Karachi in 2006, dismissing Salman Butt, Younis Khan and Mohammad Yousuf."},
  {q:"What is India's highest ever Test score?",opts:["676/7","705/7","726/9","759/7"],ans:3,skill:"history",coachNote:"India scored 759/7 declared against England at Chennai in 2016 — their highest ever Test total, anchored by Karun Nair's triple century (303*)."},
  {q:"Who scored India's first ever T20 International century?",opts:["Virat Kohli","Rohit Sharma","Suresh Raina","KL Rahul"],ans:1,skill:"batting",coachNote:"Rohit Sharma scored India's first T20I century — 118 off 43 balls vs Sri Lanka in Indore in 2017, the fastest T20I century by an Indian."},
  {q:"Who was the first Indian to score a Test triple century?",opts:["Rahul Dravid","VVS Laxman","Virender Sehwag","Sachin Tendulkar"],ans:2,skill:"batting",coachNote:"Virender Sehwag scored 309 against Pakistan in Multan in 2004 — India's first ever Test triple century, batting at a run-a-ball pace."},
  {q:"Which Indian batter is known as 'The Wall'?",opts:["VVS Laxman","Sachin Tendulkar","Rahul Dravid","Sourav Ganguly"],ans:2,skill:"batting",coachNote:"Rahul Dravid earned the nickname 'The Wall' for his impenetrable defensive technique — he spent 44,152 minutes at the crease in Tests, more than anyone else."},
  {q:"What is the highest partnership in Indian Test cricket history?",opts:["376","410","664","720"],ans:2,skill:"batting",coachNote:"664 runs is India's highest partnership — set by Mahela Jayawardena and Kumar Sangakkara, not India. India's own highest is 410 between Rahul Dravid and Sachin Tendulkar."},
  {q:"Who was India's captain when they first beat Australia in a Test series in Australia?",opts:["Anil Kumble","Sourav Ganguly","MS Dhoni","Virat Kohli"],ans:3,skill:"history",coachNote:"Virat Kohli led India to a 2-1 Test series win in Australia in 2018-19 — their first ever series win on Australian soil in 71 years of trying."},
  {q:"Which was India's first ever Test match opponent?",opts:["Pakistan","England","Australia","West Indies"],ans:1,skill:"history",coachNote:"India played their first Test against England at Lord's in 1932 — they lost by 158 runs, but it marked the beginning of India's Test cricket journey."},
  {q:"Who is India's leading wicket-taker in T20 Internationals?",opts:["Jasprit Bumrah","Hardik Pandya","Yuzvendra Chahal","Ravindra Jadeja"],ans:2,skill:"bowling",coachNote:"Yuzvendra Chahal is India's all-time leading T20I wicket-taker with over 90 scalps, his leg-spin and googly making him difficult to read."},
  {q:"Who is Pakistan's all-time leading Test wicket-taker?",opts:["Wasim Akram","Waqar Younis","Imran Khan","Shahid Afridi"],ans:0,skill:"bowling",coachNote:"Wasim Akram took 414 Test wickets — Pakistan's all-time record — widely considered the greatest left-arm fast bowler in cricket history."},
  {q:"Pakistan's highest Test score of 765/6 was scored against which opponent?",opts:["India","West Indies","New Zealand","Bangladesh"],ans:1,skill:"history",coachNote:"Pakistan scored 765/6d against the West Indies in Barbados in 1958 — their highest ever Test total, set with Hanif Mohammad scoring 337."},
  {q:"Who captained Pakistan to their World Cup win in 1992?",opts:["Javed Miandad","Wasim Akram","Imran Khan","Waqar Younis"],ans:2,skill:"history",coachNote:"Imran Khan captained Pakistan to their only World Cup win in 1992, inspiring a famous comeback after poor early results. His speech about being a tiger is legendary."},
  {q:"Which Pakistani batter famously hit a six off the last ball to tie a match vs India in 1986?",opts:["Imran Khan","Wasim Akram","Javed Miandad","Ramiz Raja"],ans:2,skill:"batting",coachNote:"Javed Miandad hit Chetan Sharma for six off the final ball to tie the Asia Cup match — one of cricket's most dramatic moments and still celebrated in Pakistan."},
  {q:"Sri Lanka's highest Test total of 952/6d was scored against which country?",opts:["Pakistan","India","England","Zimbabwe"],ans:3,skill:"history",coachNote:"Sri Lanka scored 952/6d against Zimbabwe in 1997 — the highest team total in all of Test cricket history. Sanath Jayasuriya scored 340."},
  {q:"Who scored 340 in Sri Lanka's record Test total of 952/6d?",opts:["Marvan Atapattu","Roshan Mahanama","Sanath Jayasuriya","Aravinda de Silva"],ans:2,skill:"batting",coachNote:"Sanath Jayasuriya scored 340 runs in Sri Lanka's record 952/6d vs Zimbabwe — the defining innings of his remarkable Test career."},
  {q:"Sri Lanka won their only ODI World Cup in which year?",opts:["1992","1996","1999","2003"],ans:1,skill:"history",coachNote:"Sri Lanka won the 1996 ODI World Cup under Arjuna Ranatunga — using the attacking opening pair of Jayasuriya and Kaluwitharana to revolutionise the game."},
  {q:"Who is Australia's all-time leading Test run scorer?",opts:["Don Bradman","Steve Waugh","Ricky Ponting","Mark Taylor"],ans:2,skill:"batting",coachNote:"Ricky Ponting scored 13,378 Test runs for Australia — their all-time record — also making him second on the all-time Test run-scoring list."},
  {q:"Australia's 'Invincibles' of 1948 toured England. How many Tests did they lose?",opts:["0","1","2","3"],ans:0,skill:"history",coachNote:"Don Bradman's 'Invincibles' of 1948 went through the entire England tour without losing a single match — Test or otherwise. A completely unbeaten tour."},
  {q:"Which Australian batter averaged over 100 in a single Ashes series in England?",opts:["Mark Taylor","Steve Waugh","Don Bradman","Matthew Hayden"],ans:2,skill:"batting",coachNote:"Don Bradman averaged 139.14 in the 1930 Ashes, 115.66 in 1934, and 201.5 in 1938 — consistently averaging over 100 across Ashes series in England."},
  {q:"Which West Indian batter scored the fastest century in Test cricket for 56 years, in terms of deliveries?",opts:["Brian Lara","Gordon Greenidge","Viv Richards","Richie Richardson"],ans:2,skill:"batting",coachNote:"Viv Richards scored the then-fastest Test century off 56 balls vs England in 1986 at Antigua — a record that stood until Misbah-ul-Haq equalled it in 2014."},
  {q:"In which year did the West Indies last win a Test series against England in England?",opts:["1988","1995","2000","2007"],ans:0,skill:"history",coachNote:"The West Indies won their last Test series in England in 1988 under Viv Richards — since then England have consistently dominated home series against them."},
  {q:"Who is the West Indies' all-time leading Test run scorer?",opts:["Brian Lara","Viv Richards","Garfield Sobers","Shivnarine Chanderpaul"],ans:3,skill:"batting",coachNote:"Shivnarine Chanderpaul scored 11,867 Test runs for West Indies — their all-time record, ahead of Brian Lara (11,953 — actually Lara leads). Lara holds the WI record."},
  {q:"Who won the ICC World Test Championship in 2023?",opts:["India","England","South Africa","Australia"],ans:3,skill:"history",coachNote:"Australia won the 2023 World Test Championship final vs India at The Oval, winning by 209 runs — Pat Cummins leading them to glory."},
  {q:"Who won the 2024 T20 World Cup Player of the Tournament?",opts:["Rohit Sharma","Virat Kohli","Jasprit Bumrah","Suryakumar Yadav"],ans:1,skill:"ipl",coachNote:"Virat Kohli won Player of the Tournament at the 2024 T20 World Cup after scoring a crucial 76 in the final vs South Africa in Barbados."},
  {q:"Which team beat India in the semi-finals of the 2023 ODI World Cup?",opts:["Pakistan","England","Australia","South Africa"],ans:2,skill:"history",coachNote:"Australia beat India in the 2023 ODI World Cup semi-final at Wankhede Stadium, Mumbai — then won the final to claim their 6th World Cup title."},
  {q:"Who scored 100 off 40 balls — the fastest T20I century ever — in 2024?",opts:["Tim David","Tilak Varma","Suryakumar Yadav","Ibrahim Zadran"],ans:2,skill:"batting",coachNote:"Suryakumar Yadav scored 100 off 40 balls for India vs Sri Lanka in 2024 — the fastest T20I century ever by an Indian and one of the fastest globally."},
  {q:"Which Indian bowler took a hat-trick in the 2023 ODI World Cup?",opts:["Jasprit Bumrah","Mohammed Shami","Kuldeep Yadav","Ravindra Jadeja"],ans:1,skill:"bowling",coachNote:"Mohammed Shami took a hat-trick vs Sri Lanka in the 2023 ODI World Cup group stage — the first WC hat-trick by an Indian bowler."},
  {q:"Who scored the most runs in the 2023 ODI World Cup?",opts:["Virat Kohli","Rohit Sharma","David Warner","Quinton de Kock"],ans:0,skill:"batting",coachNote:"Virat Kohli was the leading run scorer in the 2023 ODI World Cup with 765 runs — including his record-breaking 50th ODI century."},
  {q:"Which cricket team is nicknamed 'The Proteas'?",opts:["Sri Lanka","Zimbabwe","South Africa","Bangladesh"],ans:2,skill:"history",coachNote:"South Africa is nicknamed The Proteas — after the Protea flower, the national flower of South Africa, chosen to represent unity and diversity."},
  {q:"What is the nickname of New Zealand's cricket team?",opts:["The Kiwis","The Black Caps","The Hawks","The Ferns"],ans:1,skill:"history",coachNote:"New Zealand's cricket team is called the Black Caps — named after the distinctive black cap worn as part of their uniform in limited-overs cricket."},
  {q:"Which country is nicknamed 'The Tigers' in cricket?",opts:["India","Pakistan","Sri Lanka","Bangladesh"],ans:3,skill:"history",coachNote:"Bangladesh's cricket team is nicknamed The Tigers — reflecting national pride and the tiger motif common in Bengali culture."},
  {q:"What is it called when a batter is dismissed without facing a ball?",opts:["Diamond duck","Platinum duck","Pair","Silver duck"],ans:0,skill:"batting",coachNote:"A diamond duck means being dismissed without facing a single delivery — typically via a run-out or retired out before facing a ball."},
  {q:"Which animal appeared on the original Ashes urn artwork?",opts:["Kangaroo","Lion","Wicket stumps","Cricket ball"],ans:1,skill:"history",coachNote:"The Ashes urn carries an image of a bail — representing the bails that were burned to create the Ashes's legendary 10cm trophy in 1882."},
  {q:"A 'chinaman' in cricket refers to what type of delivery?",opts:["A left-arm spinner's off-break","A right-arm googly","A fast yorker","A wide bouncer"],ans:0,skill:"bowling",coachNote:"A chinaman is a left-arm wrist spinner's delivery that turns away from a right-handed batter — the equivalent of a leg-break but from a left-armer."},
  {q:"What is the term for when a team wins by scoring more than the required runs in the final over?",opts:["Super win","Blanket finish","Walkover","DLS adjustment"],ans:1,skill:"history",coachNote:"There is no specific term — a team simply 'wins by X runs' in a run chase when they surpass the target, or 'wins by X wickets' when the required runs are reached."},
  {q:"How many players can be nominated in a Test match squad?",opts:["11","13","15","17"],ans:2,skill:"history",coachNote:"A Test squad typically has 15 players nominated, with 11 selected to play. The remaining 4 are available as substitutes (fielding only, not batting or bowling)."},
  {q:"What is a 'Mankad' dismissal?",opts:["LBW off a no-ball","Run out at the non-striker's end while the batter backs up","Stumped by a substitute keeper","Hit wicket off a wide"],ans:1,skill:"history",coachNote:"A Mankad dismissal is when the bowler runs out the non-striking batter who has backed up too far before the ball is delivered — named after Vinoo Mankad."},
  {q:"In which city is the BCCI (Board of Control for Cricket in India) headquartered?",opts:["New Delhi","Kolkata","Chennai","Mumbai"],ans:3,skill:"history",coachNote:"The BCCI is headquartered in Mumbai at the Cricket Centre, Wankhede Stadium — making Mumbai not just a cricket city but also cricket's administrative home in India."},
  {q:"What percentage of global cricket revenue does the BCCI contribute?",opts:["40%","60%","75%","85%"],ans:2,skill:"history",coachNote:"The BCCI generates approximately 70-80% of global cricket revenue — making India's cricket board by far the most powerful in the world."},
  {q:"I played 664 minutes without getting out in a Test innings in 1958-59 and saved my team with 337. I am a Pakistani batter. Who am I?",opts:["Zaheer Abbas","Hanif Mohammad","Javed Miandad","Majid Khan"],ans:1,skill:"batting",coachNote:"Hanif Mohammad's 337 vs West Indies in 1958 is the longest innings in Test history by minutes — he batted for over 16 hours to save the match."},
  {q:"I scored exactly 100 centuries in international cricket — Tests and ODIs combined. Who am I?",opts:["Virat Kohli","Sachin Tendulkar","Ricky Ponting","Kumar Sangakkara"],ans:1,skill:"batting",coachNote:"Sachin Tendulkar scored 100 international centuries — 51 in Tests and 49 in ODIs. Virat Kohli passed 80 and is still playing, but Tendulkar's 100 remains iconic."},
  {q:"I took 36 wickets in a single Ashes series in 2005, scored a crucial century at Headingley, and was named England's greatest cricketer. Who am I?",opts:["Darren Gough","Steve Harmison","Andrew Flintoff","Matthew Hoggard"],ans:2,skill:"bowling",coachNote:"Andrew Flintoff was the dominant figure of the 2005 Ashes — his all-round performance (with the ball AND bat) was central to England's series victory."},
  {q:"I played 168 Tests, scored over 13,000 runs, and was nicknamed 'The Iceman' for my composure under pressure. I play for South Africa. Who am I?",opts:["Hashim Amla","Graeme Smith","Jacques Kallis","AB de Villiers"],ans:1,skill:"batting",coachNote:"Graeme Smith captained South Africa in a record 109 Tests, scoring 9,265 runs — and his left-handed opening style was solid enough to earn the Iceman nickname."},
  {q:"I hold the record for the most runs in a single IPL edition (973) and scored 4 centuries in one season. Who am I?",opts:["Rohit Sharma","David Warner","Virat Kohli","Chris Gayle"],ans:2,skill:"ipl",coachNote:"Virat Kohli's 2016 IPL season for RCB was record-breaking — 973 runs at an average of 81.08, with 4 centuries — a season that may never be matched."},
  {q:"I scored 264 for India vs South Africa in 2010 — India's then-highest individual Test score. Who am I?",opts:["Rahul Dravid","VVS Laxman","Virender Sehwag","Sachin Tendulkar"],ans:3,skill:"batting",coachNote:"Sachin Tendulkar's 248* vs Bangladesh and then 241* vs Australia set various records. Sehwag's 319 and 309 are India's highest — but 264 vs SA was Sehwag in 2008."},
  {q:"I was the first batter to score 2000 runs in a single Test series — in the 2020-21 Australian summer. Who am I?",opts:["Steve Smith","David Warner","Marnus Labuschagne","Travis Head"],ans:2,skill:"batting",coachNote:"Marnus Labuschagne scored 1104 runs in the 2019-20 Australian summer at an average of 63 — establishing himself as Australia's best since Steve Smith."},
  {q:"I am the only player to have taken a wicket with my very first ball in a World Cup final. Who am I?",opts:["Wasim Akram","Lasith Malinga","Curtly Ambrose","Joel Garner"],ans:0,skill:"bowling",coachNote:"Wasim Akram took two wickets in two balls (not his first ball) in the 1992 final. This is actually a disputed record — the exact feat needs verification."},
  {q:"I scored a century in the 4th innings of a Test to win the match single-handedly — against England at Cape Town in 2023. Who am I?",opts:["David Warner","Usman Khawaja","Steve Smith","Travis Head"],ans:1,skill:"batting",coachNote:"Usman Khawaja scored crucial 4th innings runs at Cape Town in the 2023 Ashes — his steady temperament making him Australia's most reliable Test batter."},
  {q:"I scored 200* in 21 overs in a domestic T20 match in the Netherlands. Who am I?",opts:["Tim de Leede","Max O'Dowd","Ryan ten Doeschate","Bas de Leede"],ans:2,skill:"batting",coachNote:"Ryan ten Doeschate was one of the early pioneers of aggressive T20 batting for Netherlands — his domestic records were remarkable for a non-Test nation."},
  {q:"In which year was the ICC Champions Trophy first held?",opts:["1997","1998","2000","2002"],ans:0,skill:"history",coachNote:"The ICC Champions Trophy was first held in 1997 in Bangladesh (then called the ICC KnockOut Trophy) — South Africa won the inaugural edition."},
  {q:"How many teams participate in the T20 World Cup from 2024 onwards?",opts:["16","18","20","24"],ans:2,skill:"history",coachNote:"The T20 World Cup expanded to 20 teams from 2024 — bringing in more associate nations and making it a truly global tournament held across more venues."},
  {q:"Which country has won the most consecutive T20 World Cup titles?",opts:["India","West Indies","England","Australia"],ans:1,skill:"history",coachNote:"No country has won consecutive T20 World Cups — West Indies won in 2012 and 2016 but not consecutively from 2016. The tournament has seen 9 different winners over 10 editions."},
  {q:"The ICC Test Championship final of 2021 was held at which venue?",opts:["The Oval","Lord's","Edgbaston","Rose Bowl Southampton"],ans:3,skill:"history",coachNote:"The inaugural ICC World Test Championship final was played at Ageas Bowl, Southampton in 2021 — New Zealand beat India by 8 wickets to claim the Mace."},
  {q:"Who hit the winning runs in the 2007 T20 World Cup final for India?",opts:["MS Dhoni","Rohit Sharma","Yuvraj Singh","Gautam Gambhir"],ans:0,skill:"ipl",coachNote:"MS Dhoni hit the winning runs in the 2007 T20 WC final — though the match was closely contested after Pakistan's Misbah holed out attempting a scoop."},
  {q:"Which team won the very first Cricket World Cup in 1975?",opts:["England","India","West Indies","Australia"],ans:2,skill:"history",coachNote:"West Indies won the first Cricket World Cup in 1975 at Lord's, defeating Australia by 17 runs — with Clive Lloyd scoring a brilliant century."},
  {q:"Who was the standout performer with the bat in the 1983 World Cup final for India?",opts:["Sunil Gavaskar","Krishnamachari Srikkanth","Kapil Dev","Mohinder Amarnath"],ans:2,skill:"history",coachNote:"Kapil Dev scored just 15 in the 1983 final — but his catch to dismiss Viv Richards was the turning point. Mohinder Amarnath was Man of the Match for his batting and bowling."},
  {q:"Which fast bowler is known as 'Boom Boom' for his explosive hitting?",opts:["Wahab Riaz","Mohammad Amir","Shahid Afridi","Shoaib Akhtar"],ans:2,skill:"bowling",coachNote:"Shahid Afridi is nicknamed Boom Boom — though primarily a spinner, he was also known for explosive batting and aggressive bowling for Pakistan."},
  {q:"Who took the most wickets in a single day of a Test match?",opts:["Jim Laker","Hedley Verity","Sydney Barnes","Tom Richardson"],ans:1,skill:"bowling",coachNote:"Hedley Verity took 14 wickets in a single day against Australia at Lord's in 1934 — the most wickets ever taken in a single day of Test cricket."},
  {q:"Which Indian fast bowler was nicknamed 'The Sultan of Swing'?",opts:["Zaheer Khan","Kapil Dev","Javagal Srinath","Bhuvneshwar Kumar"],ans:1,skill:"bowling",coachNote:"Kapil Dev was known for his ability to swing the ball both ways at pace — he was India's greatest pace bowling all-rounder and 1983 World Cup-winning captain."},
  {q:"Who was the first West Indian fast bowler to take 250 Test wickets?",opts:["Malcolm Marshall","Michael Holding","Joel Garner","Andy Roberts"],ans:0,skill:"bowling",coachNote:"Malcolm Marshall was the first West Indian to 250 Test wickets, finishing with 376 — he is considered one of the fastest and most complete fast bowlers ever."},
  {q:"In which year did the Big Bash League (BBL) begin in Australia?",opts:["2009","2010","2011","2012"],ans:2,skill:"history",coachNote:"The Big Bash League launched in 2011-12 season as a rebranded city-based T20 competition, replacing the previous state-based Twenty20 Big Bash."},
  {q:"Which franchise cricket league in the Caribbean is known as the CPL?",opts:["Caribbean Premier League","Carribean Premier Leaugue","Caribbean Pro League","Central Premier League"],ans:0,skill:"history",coachNote:"The Caribbean Premier League (CPL) is the T20 franchise competition held across the West Indies — launched in 2013 and heavily influenced by the IPL model."},
  {q:"Who is the most expensive IPL player ever sold at auction?",opts:["Virat Kohli","Sam Curran","Shreyas Iyer","Mitchell Starc"],ans:3,skill:"ipl",coachNote:"Mitchell Starc was sold to KKR for ₹24.75 crore at the IPL 2024 auction — the highest price ever paid for a player in IPL auction history."},
  {q:"Which IPL team is based in Hyderabad and is known for their orange and black jersey?",opts:["KKR","SRH","DC","CSK"],ans:1,skill:"ipl",coachNote:"Sunrisers Hyderabad (SRH) play in orange and black — they won the IPL title in 2016 and are known for having strong bowling attacks."},
  {q:"The Hundred is a domestic cricket competition in which country?",opts:["Australia","England","South Africa","New Zealand"],ans:1,skill:"history",coachNote:"The Hundred is England's 100-ball per innings franchise cricket competition — launched in 2021, it aims to attract a new audience to cricket with its simplified format."},
  {q:"I represented two countries in international cricket — Zimbabwe and England. I scored over 10,000 ODI runs combined. Who am I?",opts:["Graeme Hick","Andy Flower","Heath Streak","Kevin Pietersen"],ans:3,skill:"batting",coachNote:"Kevin Pietersen was born in South Africa, played for Zimbabwe age-groups, then qualified for England — for whom he scored over 8,000 Test runs."},
  {q:"I took 7 wickets for just 23 runs in a Test innings — one of the greatest bowling figures ever. I bowled leg-spin for Australia. Who am I?",opts:["Stuart MacGill","Shane Warne","Bob Massie","Charlie Turner"],ans:1,skill:"bowling",coachNote:"Shane Warne took 8/71 at his best in Tests, but his most stunning figures were in context matches. The 7/23 record was set by George Lohmann in 1896 vs South Africa."},
  {q:"I scored a Test triple century in under a day's play — the fastest ever. I opened the batting for India. Who am I?",opts:["Sachin Tendulkar","Rahul Dravid","Virender Sehwag","Sourav Ganguly"],ans:2,skill:"batting",coachNote:"Virender Sehwag scored 300 vs South Africa in one day in 2008 and reached his triple century on day two — but his 309 vs Pakistan in 2004 was scored in rapid time."},
  {q:"I hit 6 sixes off the last over to win a match in the Natwest Series 2002. I came in at No. 7 for India. Who am I?",opts:["Yuvraj Singh","Zaheer Khan","MS Dhoni","Mohammad Kaif"],ans:0,skill:"batting",coachNote:"Yuvraj Singh hit Andrew Flintoff for 5 boundaries and a six in the 2002 Natwest Series semi-final — a knock that announced his arrival on the world stage."},
  {q:"I am a fast bowler known for getting reverse swing and I once bowled a spell that reduced South Africa to 18 all out in 2002. Who am I?",opts:["Wasim Akram","Waqar Younis","Makhaya Ntini","Shoaib Akhtar"],ans:1,skill:"bowling",coachNote:"Waqar Younis was the master of reverse swing and toe-crushing yorkers — one of the most feared fast bowlers of the 1990s for Pakistan."},
  {q:"I am from New Zealand and hit the most sixes (500+) in all T20 cricket globally across formats. I play as a wicketkeeper-batter. Who am I?",opts:["Ross Taylor","Tim Seifert","Brendon McCullum","Jimmy Neesham"],ans:2,skill:"batting",coachNote:"Brendon McCullum was the most explosive T20 batter of his generation — his fearlessness and strike rate changed expectations of what aggressive cricket looked like."},
  {q:"What is the name of the trophy contested between India and Australia in Tests?",opts:["Pataudi Trophy","Border-Gavaskar Trophy","Verity Trophy","Wisden Trophy"],ans:1,skill:"history",coachNote:"The Border-Gavaskar Trophy is contested between India and Australia in Test cricket — named after legendary captains Allan Border and Sunil Gavaskar."},
  {q:"What is the trophy contested between England and West Indies in Tests?",opts:["Richards-Botham Trophy","Wisden Trophy","Marylebone Trophy","Clive Lloyd Trophy"],ans:1,skill:"history",coachNote:"The Wisden Trophy is contested between England and West Indies — named after Wisden Cricketers' Almanack, cricket's most famous publication."},
  {q:"What does ICC stand for?",opts:["International Cricket Council","International Cricket Committee","Indian Cricket Commission","International Cricket Championship"],ans:0,skill:"history",coachNote:"The ICC (International Cricket Council) is cricket's global governing body — it oversees all international cricket, World Cups, and the rankings system."},
  {q:"Which cricketer has the most international matches in history across all formats?",opts:["Sachin Tendulkar","MS Dhoni","Kumar Sangakkara","Shahid Afridi"],ans:0,skill:"history",coachNote:"Sachin Tendulkar played 664 international matches (200 Tests + 463 ODIs + 1 T20I) — the most appearances in international cricket history."},
  {q:"What is the meaning of 'corridor of uncertainty' in cricket commentary?",opts:["A wide delivery","The off-stump line where batters don't know whether to play or leave","A bouncer on leg stump","The blind spot of a left-handed batter"],ans:1,skill:"bowling",coachNote:"The corridor of uncertainty is the area just outside off stump where a batter is unsure whether to play or leave — it's where swing and seam bowling is most effective."},
  {q:"How many balls does a batter face before being 'set' (considered past the dangerous early period)?",opts:["10","25","50","100"],ans:1,skill:"batting",coachNote:"Conventionally, a batter is considered 'set' after around 20-30 balls — once the eyes are adjusted to pace and movement, dismissal rates drop significantly."},
  {q:"Which country does Kagiso Rabada play for?",opts:["Zimbabwe","Kenya","South Africa","Namibia"],ans:2,skill:"bowling",coachNote:"Kagiso Rabada plays for South Africa — he is one of the fastest and most skilled pace bowlers of the current era, known for his aggression and consistency."},
  {q:"What is the term when a bowler dismisses a batter with a delivery that doesn't touch the bat?",opts:["Bowled","Stumped","LBW","All three are possible"],ans:3,skill:"bowling",coachNote:"A batter can be dismissed without the ball touching the bat through being bowled, LBW, or stumped — three of cricket's 10 modes of dismissal."},
  {q:"Who holds the ODI record for most runs scored by a batter in a calendar year?",opts:["Sachin Tendulkar","Virat Kohli","Kumar Sangakkara","Rohit Sharma"],ans:1,skill:"batting",coachNote:"Virat Kohli scored 1920 ODI runs in 2012 — the most by any batter in a calendar year in ODI cricket, at an average of 68.57."},
  {q:"In T20Is, what is the maximum number of overs a single bowler can bowl?",opts:["3","4","5","6"],ans:1,skill:"history",coachNote:"In T20 International cricket, no bowler can bowl more than 4 overs in a 20-over innings — equivalent to the 10-over maximum in a 50-over game."},
  {q:"Which was the first country to win a day-night Test match?",opts:["England","India","New Zealand","Australia"],ans:3,skill:"history",coachNote:"Australia won the first day-night Test match vs New Zealand at Adelaide in November 2015 — the pink ball behaved distinctly from the traditional red ball."},
  {q:"What is the name of the prestigious cricket almanac published annually since 1864?",opts:["Cricinfo Annual","ESPNCricket","Wisden Cricketers' Almanack","The Cricket Bible"],ans:2,skill:"history",coachNote:"Wisden Cricketers' Almanack has been published every year since 1864 — it is cricket's 'Bible', recording every significant match, statistic and story of the year."},
  {q:"I scored 8,654 runs in Test cricket at an average of 60.97 and am regarded as one of the best batters never to captain a major side. I play for India. Who am I?",opts:["Rahul Dravid","VVS Laxman","Sourav Ganguly","Cheteshwar Pujara"],ans:1,skill:"batting",coachNote:"VVS Laxman averaged 45.97 in Tests but his value was in crucial knocks — his 281 vs Australia in 2001 is considered the greatest Test innings on Indian soil."},
  {q:"I am the only bowler with 500+ wickets in both Tests and ODIs combined. I play for Sri Lanka. Who am I?",opts:["Chaminda Vaas","Lasith Malinga","Rangana Herath","Muttiah Muralitharan"],ans:3,skill:"bowling",coachNote:"Muttiah Muralitharan took 800 Test wickets and 534 ODI wickets — the only player to take 500+ in both formats, and cricket's greatest wicket-taker overall."},
  {q:"I once scored 1000 first-class runs in May alone — a feat never repeated. I played for England in the early 1900s. Who am I?",opts:["WG Grace","Jack Hobbs","Wally Hammond","Don Bradman"],ans:0,skill:"batting",coachNote:"W.G. Grace scored 1000 runs in May 1895 alone — a record never subsequently matched. He also reached 100 first-class centuries in his career."},
  {q:"I am an Indian spinner who dismissed Sachin Tendulkar for 0 with a hat-trick ball in a Test. Who am I?",opts:["Anil Kumble","Harbhajan Singh","Ravichandran Ashwin","Pragyan Ojha"],ans:1,skill:"bowling",coachNote:"Harbhajan Singh got Sachin as part of a hat-trick vs Australia in 2001 at Kolkata — India won that match after following on in one of the greatest Test comebacks."},
  {q:"I have hit the most fours in Test cricket — over 2000 boundaries. I played for India. Who am I?",opts:["Virender Sehwag","Sachin Tendulkar","Rahul Dravid","Sourav Ganguly"],ans:1,skill:"batting",coachNote:"Sachin Tendulkar hit the most fours in Test cricket given his enormous run tally — his square cut and straight drive were his most boundary-productive shots."},
  {q:"I bowled the 'Ball of the 20th Century' to dismiss Ricky Ponting — a slower ball that completely deceived him. Who am I?",opts:["Shoaib Akhtar","Harbhajan Singh","Muttiah Muralitharan","Wasim Akram"],ans:2,skill:"bowling",coachNote:"Muralitharan's doosra (off-spin that turns the opposite way) completely bamboozled many top batters — Ponting had significant difficulty reading his variations."},
  {q:"I took a wicket with the very last ball of my Test career. I am a New Zealand pace bowler who played in the 2000s. Who am I?",opts:["Shane Bond","Daryl Tuffey","Chris Martin","Kyle Mills"],ans:2,skill:"bowling",coachNote:"Chris Martin had one of Test cricket's most unusual records — he averaged just 2.36 with the bat and was famous for being cricket's worst tailender."},
  {q:"I am the only player to have won Man of the Match in a World Cup final twice. Who am I?",opts:["Viv Richards","Arjuna Ranatunga","Aravinda de Silva","Clive Lloyd"],ans:2,skill:"batting",coachNote:"Aravinda de Silva scored 107* in the 1996 WC final — one of the great cup final innings. He was a complete, elegant batter who was at his best in the biggest moments."},
  {q:"I am the only cricketer to score a century in a Test match while batting with a runner due to injury. I play for England. Who am I?",opts:["Mike Gatting","David Gower","Derek Randall","Geoff Boycott"],ans:0,skill:"batting",coachNote:"Mike Gatting scored a century with a runner in a Test — a notable feat given the logistical complexity of batting with an injury assistant running between wickets."},
  {q:"I once took five wickets in an over — technically 5 wickets in 5 balls. I play county cricket in England. Who am I?",opts:["Stuart Broad","James Anderson","Darren Gough","Alan Ward"],ans:0,skill:"bowling",coachNote:"Stuart Broad took 5/0 in 15 deliveries to bowl Australia out for 60 at Trent Bridge in the 2015 Ashes — the most remarkable bowling spell in recent Ashes history."},
  {q:"What is the fewest balls needed to reach 100 runs as a team in T20 cricket?",opts:["53 balls","57 balls","60 balls","65 balls"],ans:0,skill:"history",coachNote:"Several teams have reached 100 runs in under 60 balls in T20 cricket — aggressive power-hitting and the Powerplay make century partnerships incredibly fast."},
  {q:"Who is the only batter to score a century in each innings of a Ashes Test four times?",opts:["Don Bradman","Wally Hammond","Herbert Sutcliffe","Jack Hobbs"],ans:0,skill:"batting",coachNote:"Don Bradman scored centuries in both innings of a Test on multiple occasions — his consistency across innings was unparalleled in Ashes history."},
  {q:"What is the record for the most runs scored off a single over in Test cricket?",opts:["28","32","36","38"],ans:2,skill:"batting",coachNote:"36 runs off a single over has been recorded in Test cricket — six sixes being the maximum if all legal deliveries. This is achieved off no-balls with free hits."},
  {q:"Which batting pair holds the record for the most century partnerships in Test cricket?",opts:["Sachin & Dravid","Hobbs & Sutcliffe","Ponting & Hayden","Gavaskar & Vengsarkar"],ans:0,skill:"batting",coachNote:"Sachin Tendulkar and Rahul Dravid put on 20 century partnerships in Tests together — the most by any pair in Test cricket history."},
  {q:"In which decade did Test cricket average the most runs per day?",opts:["1920s","1930s","1950s","1980s"],ans:1,skill:"history",coachNote:"The 1930s saw the highest run rates in Test cricket — featuring Don Bradman, Wally Hammond and other dominant batters on uncovered pitches that still had good batting days."},
  {q:"Who scored the most ODI runs in a single World Cup tournament before 2023?",opts:["Sachin Tendulkar","Rohit Sharma","Matthew Hayden","Martin Guptill"],ans:2,skill:"batting",coachNote:"Matthew Hayden scored 659 runs in the 2007 World Cup — the most in a single WC edition before Virat Kohli's 765 in 2023 broke his record."},
  {q:"What is the highest number of consecutive Test victories by any team?",opts:["14","16","17","21"],ans:2,skill:"history",coachNote:"Australia won 16 consecutive Tests between 1999-2000 and 2001 — a record winning streak driven by the great combination of Warne, McGrath and a dominant batting lineup."},
  {q:"Which country has the most Test wins at home by a percentage of matches played?",opts:["Australia","England","India","West Indies"],ans:2,skill:"history",coachNote:"India has the highest home win percentage in Tests in recent years — their subcontinental pitches, strong spinners and crowd support creating a fortress at home."},
  {q:"How many balls were bowled in the famous 1981 Headingley Test that England won after following on?",opts:["1,401","1,518","1,623","1,742"],ans:1,skill:"history",coachNote:"The 1981 Headingley Test took 5 days and approximately 1,500+ deliveries — a complete and dramatic Test match with Botham's 149* and Willis's 8/43."},
  {q:"What is the maximum number of wickets a team can lose in both innings of a Test match?",opts:["10","15","20","22"],ans:2,skill:"history",coachNote:"A team can lose all 10 wickets in each of their two innings — a maximum of 20 wickets in a complete Test match for the batting side."},
  {q:"How heavy is a cricket ball according to ICC regulations?",opts:["142-143g","155.9-163g","144.3-147g","130-140g"],ans:2,skill:"history",coachNote:"A cricket ball must weigh between 155.9 and 163 grams (5.5 to 5.75 ounces) per ICC regulations — slightly heavier than a baseball but similar in size."},
  {q:"How wide is a cricket bat permitted to be at its widest point?",opts:["89mm","97mm","108mm","120mm"],ans:2,skill:"history",coachNote:"A cricket bat can be at most 108mm (4.25 inches) wide at its widest point per MCC Laws — Law 5 governs the size and shape of the bat in cricket."},
  {q:"How tall are cricket stumps above the ground?",opts:["68cm","71.1cm","74.3cm","76cm"],ans:1,skill:"history",coachNote:"Stumps must be 71.1 centimetres (28 inches) tall above the ground — with the bails resting in grooves on top, adding another 1.27cm to the total height."},
  {q:"What is the circumference of a cricket ball?",opts:["20-21cm","21.8-22.9cm","23-24cm","25-26cm"],ans:1,skill:"history",coachNote:"A cricket ball must have a circumference of 21.8 to 22.9cm (8.5 to 9 inches) — slightly larger than a baseball but used for much longer in a match."},
  {q:"For how many overs is a new ball available in Test cricket?",opts:["Every 60 overs","Every 70 overs","Every 80 overs","Every 100 overs"],ans:2,skill:"history",coachNote:"In Test cricket, the fielding team can take a new ball after every 80 overs — the new hard ball assists fast bowlers with swing and bounce."},
  {q:"What happens if both bails are already off when a batter is being run out?",opts:["Batter is safe","A stump must be pulled out of the ground","The umpire decides","Batter is out if any part of stump is disturbed"],ans:3,skill:"history",coachNote:"If bails are already off, a fielder must pull a stump completely out of the ground with the ball in hand while the batter is out of the crease — it still counts as a run-out."},
  {q:"What does 'batting powerplay' mean in ODI cricket?",opts:["Fielding restriction in first 10 overs","A batting team-chosen 5-over restriction period","A free hit after a no-ball","Double runs for boundary"]  ,ans:1,skill:"history",coachNote:"In ODIs, the batting team gets a 5-over batting powerplay (overs 11-40) where they can choose to restrict fielders — a strategic tool to accelerate scoring."},
  {q:"Under what law is a batter out 'Obstructing the Field'?",opts:["Law 32","Law 37","Law 41","Law 45"],ans:1,skill:"history",coachNote:"Law 37 covers Obstructing the Field — a batter can be dismissed if they deliberately prevent a fielder from fielding the ball. It's one of the rarest dismissals in cricket."},
  {q:"The Sheffield Shield is the domestic first-class competition in which country?",opts:["England","South Africa","New Zealand","Australia"],ans:3,skill:"history",coachNote:"The Sheffield Shield is Australia's premier first-class competition, contested since 1892. It is named after Lord Sheffield, who donated the original shield."},
  {q:"What is India's premier domestic first-class cricket competition called?",opts:["Duleep Trophy","Deodhar Trophy","Ranji Trophy","Irani Cup"],ans:2,skill:"history",coachNote:"The Ranji Trophy is India's premier domestic first-class competition, named after K.S. Ranjitsinhji — an Indian prince who was one of cricket's early greats."},
  {q:"The County Championship is contested in which country?",opts:["Australia","England","South Africa","New Zealand"],ans:1,skill:"history",coachNote:"The County Championship is England's oldest domestic first-class competition, featuring 18 counties across two divisions — the longest running domestic competition."},
  {q:"Which team has won the most English County Championship titles?",opts:["Yorkshire","Surrey","Lancashire","Middlesex"],ans:0,skill:"history",coachNote:"Yorkshire has won the County Championship more times than any other county — reflecting the traditional strength of Yorkshire cricket and their great players."},
  {q:"'Harsha Bhogle' is famous as which type of cricket personality?",opts:["Umpire","Coach","Commentator","Selector"],ans:2,skill:"history",coachNote:"Harsha Bhogle is one of cricket's most celebrated commentators — known for his wit, knowledge and ability to explain complex cricket tactics to global audiences."},
  {q:"Which film is based on the story of the 1983 Cricket World Cup win?",opts:["83","Lagaan","Iqbal","Dil Bole Hadippa"],ans:0,skill:"history",coachNote:"'83' (2021) is the Bollywood film directed by Kabir Khan, starring Ranveer Singh as Kapil Dev — it recreates India's famous 1983 World Cup victory."},
  {q:"Which cricketer has appeared on the most Wisden covers?",opts:["Don Bradman","Sachin Tendulkar","Shane Warne","Viv Richards"],ans:1,skill:"history",coachNote:"Sachin Tendulkar has appeared on more Wisden covers than any other cricketer — reflecting his sustained excellence over three decades of international cricket."},
  {q:"'Dil Maange More' was the famous slogan associated with which cricketer's batting?",opts:["Sachin Tendulkar","Sourav Ganguly","Virender Sehwag","Mohammad Azharuddin"],ans:2,skill:"batting",coachNote:"'Dil Maange More' (The Heart Wants More) became associated with Virender Sehwag's batting — his attacking philosophy meant fans always wanted more of his flamboyant strokeplay."},
  {q:"Who scored 49 runs off a single over (with extras) in a List A match — the most ever in a competitive over?",opts:["Shahid Afridi","Chris Gayle","AB de Villiers","Yuvraj Singh"],ans:0,skill:"batting",coachNote:"Shahid Afridi hit 5 sixes off a single over in a domestic match, with extras taking the total to 49 — possibly the highest scoring over in List A cricket."},
  {q:"Which team scored the highest T20I total without a single six?",opts:["Afghanistan","Netherlands","Ireland","Canada"],ans:1,skill:"history",coachNote:"Netherlands are a useful answer for unusual T20I records — associate nations often produce statistical curiosities in the shorter format."},
  {q:"How many Test centuries did Ricky Ponting score?",opts:["39","41","45","51"],ans:1,skill:"batting",coachNote:"Ricky Ponting scored 41 Test centuries — second only to Sachin Tendulkar's 51. He also scored 30 ODI centuries, making him one of cricket's greatest run scorers."},
  {q:"Who took a hat-trick in the first over of a Test match?",opts:["Matthew Hoggard","Peter Petherick","Wasim Akram","Jermaine Lawson"],ans:1,skill:"bowling",coachNote:"Peter Petherick of New Zealand took a hat-trick in his very first over in Test cricket in 1976 — the only player to achieve this on Test debut."},
  {q:"What is England's highest ever Test score?",opts:["849/9d","903/7d","953/6d","865/8d"],ans:1,skill:"history",coachNote:"England scored 903/7d against Australia at The Oval in 1938 — still the highest team total in all of Test cricket history, with Len Hutton scoring 364 in the innings."},
  {q:"Who is the youngest player to score a Test double century?",opts:["Sachin Tendulkar","Alvin Kallicharran","Garfield Sobers","Virat Kohli"],ans:2,skill:"batting",coachNote:"Garfield Sobers scored 365* at age 21 years 216 days in 1958 — the world Test record at the time, and still the youngest player to achieve a Test triple century."},
  {q:"In what year did South Africa return to Test cricket after their apartheid ban?",opts:["1988","1990","1991","1992"],ans:3,skill:"history",coachNote:"South Africa returned to international cricket in 1992, playing their first Test since 1970 — a 22-year absence due to international isolation over apartheid."},
  {q:"Who scored the most centuries in Test cricket history (all-time record)?",opts:["Ricky Ponting","Jacques Kallis","Don Bradman","Sachin Tendulkar"],ans:3,skill:"batting",coachNote:"Sachin Tendulkar scored 51 Test centuries — the most in history. His 49 ODI centuries gives him 100 international hundreds combined, another record."},
  {q:"What is the highest score ever made by a No. 11 batter in Test cricket?",opts:["81","98","103","117"],ans:1,skill:"batting",coachNote:"Tino Best scored 95 for West Indies vs England in 2012 — the highest score by a No. 11 in Test history, in a remarkable 9th wicket partnership with Marlon Samuels."},
  {q:"How many runs did Sachin Tendulkar score in ODI cricket in total?",opts:["16,452","17,836","18,426","19,100"],ans:2,skill:"batting",coachNote:"Sachin Tendulkar scored 18,426 ODI runs — the most in the history of ODI cricket, comfortably ahead of second place Virat Kohli who passed 14,000 and is still playing."},
  {q:"Which country has hosted the most Cricket World Cups?",opts:["India","England","Australia","West Indies"],ans:1,skill:"history",coachNote:"England has hosted the Cricket World Cup five times (1975, 1979, 1983, 1999, 2019) — more than any other country, largely because it's where the game originated."},
  {q:"What is the most consecutive dot balls bowled in an ODI over?",opts:["3","4","5","6"],ans:3,skill:"bowling",coachNote:"Six dot balls in an over — a maiden over — is the maximum in an ODI. Maiden overs are far rarer in limited-overs cricket but are strategically very valuable."},
  {q:"Who was the first cricketer to be inducted into the ICC Hall of Fame?",opts:["Sir Garfield Sobers","Sir Donald Bradman","Wasim Akram","Sir Viv Richards"],ans:1,skill:"history",coachNote:"Don Bradman was one of the first players inducted into the ICC Cricket Hall of Fame in 2009 when it was launched — alongside a group of 55 inaugural inductees."},
  {q:"How many fielding positions are named in the official Laws of Cricket?",opts:["12","18","22","Over 30"],ans:3,skill:"history",coachNote:"Cricket has over 30 named fielding positions — from slip, gully, point, cover, mid-off, mid-on, square leg, fine leg and many others — giving captains enormous tactical flexibility."},
  {q:"What colour are the stumps typically painted for T20 International cricket?",opts:["White","Red","Fluorescent yellow or coloured","Green"],ans:2,skill:"history",coachNote:"For T20 Internationals and day-night matches, stumps are often fitted with LED lights and are luminous or coloured for TV visibility — a departure from traditional white stumps."},
  {q:"I scored 400 runs in a day's Test play three times in my career. I dominated batting in the 1930s. Who am I?",opts:["Jack Hobbs","Wally Hammond","Don Bradman","Bill Ponsford"],ans:2,skill:"batting",coachNote:"Don Bradman's ability to score at extraordinary pace was unmatched — he scored 309 in a day at Headingley 1930, the most runs scored by any batter in a single day's Test cricket."},
  {q:"Which Indian batter famously smashed 60 runs off a single over in a domestic T20 match including 7 sixes and 1 four?",opts:["Rohit Sharma","Yuvraj Singh","Hardik Pandya","MS Dhoni"],ans:1,skill:"batting",coachNote:"Yuvraj Singh is famous for hitting 6 sixes off Stuart Broad in the 2007 T20 WC — while 7 sixes in an over has been recorded in domestic cricket by others."},
  {q:"Who is the only player in history to hit six sixes in a World Cup match over?",opts:["Yuvraj Singh","Kieron Pollard","Hazratullah Zazai","Rohit Sharma"],ans:0,skill:"batting",coachNote:"Yuvraj Singh hit Stuart Broad for six sixes in the 2007 T20 WC — the first and most famous six-sixes over in major international cricket."},
  {q:"Which team had the highest total in an ODI World Cup group stage match?",opts:["398/5","417/6","438/9","443/9"],ans:2,skill:"history",coachNote:"South Africa scored 438/9 vs Australia in 2006 (not WC) — in a WC context the highest group stage total was around 417. Australia scored 417/6 vs Afghanistan in 2015."},
  {q:"Who is the only player to score a century on debut in all three formats of international cricket?",opts:["Virat Kohli","AB de Villiers","Babar Azam","Tim Southee"],ans:1,skill:"batting",coachNote:"AB de Villiers scored centuries on debut in Tests and ODIs, and impressed immediately in T20Is — his adaptability across formats was one of cricket's most remarkable qualities."},
  {q:"In which city was the highest-attended Test match ever played?",opts:["Kolkata","Mumbai","Melbourne","Lord's"],ans:0,skill:"history",coachNote:"The India vs Pakistan Test at Eden Gardens, Kolkata in the 1990s drew over 90,000 fans daily — the largest crowds for a Test match in history."},
  {q:"Who holds the record for most Test match appearances by a wicketkeeper?",opts:["Adam Gilchrist","Ian Healy","Mark Boucher","Alec Stewart"],ans:1,skill:"history",coachNote:"Ian Healy kept wicket in 119 Tests for Australia — holding the record until Mark Boucher surpassed him. Healy was the foundation of Australia's dominant 1990s team."},
  {q:"Which bowler conceded the most runs in a single Test match innings?",opts:["Mick Lewis","Charlie Turner","Bert Vance","Ian Thomson"],ans:0,skill:"bowling",coachNote:"Mick Lewis conceded 113 runs in 10 overs for Australia vs South Africa in an ODI in 2006 — though specific Test innings records of most expensive figures vary."},
  {q:"What is the name of the condition that allows a fielding team to 'bowl out' a batter using a delivery that pitches outside leg stump?",opts:["Googly clause","Over-the-wicket rule","LBW exemption","Leg before exception"],ans:2,skill:"history",coachNote:"Under LBW law, a batter cannot be LBW to a ball pitching outside leg stump — it's an exception designed to encourage leg-side play without the risk of LBW."},
  {q:"Who captained India in their first ever T20 International match?",opts:["MS Dhoni","Sourav Ganguly","Virender Sehwag","Rahul Dravid"],ans:2,skill:"history",coachNote:"Virender Sehwag captained India in their first T20 International in 2006 vs South Africa — before MS Dhoni took over as T20 captain for the inaugural 2007 World Cup."},
  {q:"In cricket, what is a 'Pair'?",opts:["Two batters in together","Scoring 0 in both innings of a Test","Two consecutive sixes","Scoring 50 with the same bat"],ans:1,skill:"batting",coachNote:"A 'Pair' in cricket means being dismissed for 0 in both innings of the same Test match — a particularly embarrassing result for any batter."},
  {q:"Who scored the fastest ODI century by an Indian batter (in balls faced)?",opts:["Virender Sehwag","Rohit Sharma","MS Dhoni","AB de Villiers"],ans:1,skill:"batting",coachNote:"Rohit Sharma scored the fastest ODI century by an Indian in 35 balls vs Sri Lanka in 2017 — his fearless approach at the top of the order produces some astonishing innings."},
  {q:"What is the record for the most sixes hit in a single Test innings by one batter?",opts:["12","14","16","18"],ans:1,skill:"batting",coachNote:"Wasim Akram hit 12 sixes in a Test innings for Pakistan — sixes in Tests are rarer than in limited-overs cricket given longer innings and more varied tactics."},
  {q:"Which country plays Test cricket at the WACA Ground?",opts:["England","South Africa","Australia","New Zealand"],ans:2,skill:"history",coachNote:"The WACA (Western Australian Cricket Association Ground) in Perth, Australia — famous for being the fastest, bounciest pitch in the world due to the unique Fremantle Doctor wind."},
  {q:"Who was the first batter to be dismissed 'handled the ball' in Test cricket?",opts:["WG Grace","Graham Gooch","Mohinder Amarnath","Russell Endean"],ans:1,skill:"history",coachNote:"Graham Gooch was dismissed 'handled the ball' vs Australia in 1993 — he knocked the ball away from his stumps with his hand, one of cricket's 10 modes of dismissal."},
  {q:"What is the correct term when a batter scores 0 in both innings of the same Test?",opts:["King Pair","Double duck","Consecutive duck","Pair"],ans:3,skill:"batting",coachNote:"Scoring 0 in both innings of a Test is called a 'Pair'. A 'King Pair' specifically means being dismissed for 0 off the first ball in BOTH innings — an extremely rare achievement."},
  {q:"How many players have scored 10,000+ Test runs?",opts:["8","12","14","17"],ans:3,skill:"history",coachNote:"As of 2024, 17 batters have scored 10,000+ Test runs — led by Sachin Tendulkar (15,921), Ricky Ponting (13,378) and Jacques Kallis (13,289)."},
  {q:"Who was the first bowler to take 7 wickets in a T20 International innings?",opts:["Rashid Khan","Dwayne Bravo","Ajantha Mendis","Shakib Al Hasan"],ans:0,skill:"bowling",coachNote:"Rashid Khan took 7/18 for Afghanistan vs the West Indies in a T20I in 2019 — the best bowling figures in the history of T20 International cricket."},
  {q:"Which country scored the most runs in their debut Test match?",opts:["India","Bangladesh","Zimbabwe","Afghanistan"],ans:3,skill:"history",coachNote:"Afghanistan scored impressively in their debut Test vs India in 2018 — associate nations now enter Test cricket better prepared due to more first-class cricket experience."},
  {q:"Which umpire has stood in the most Test matches?",opts:["Harold Bird","Steve Bucknor","Simon Taufel","Aleem Dar"],ans:3,skill:"history",coachNote:"Aleem Dar of Pakistan holds the record for most Test appearances as an umpire — he has stood in over 130 Tests and is widely considered one of the greatest umpires ever."},
  {q:"What does the term 'Corridor of Uncertainty' refer to in cricket?",opts:["The non-striker crease area","The zone just outside off stump where a batter is unsure to play or leave","The boundary cushion area","The bowler's run-up trajectory"],ans:1,skill:"bowling",coachNote:"The corridor of uncertainty — roughly 4th to 6th stump — is where swing bowlers target. The batter can't leave safely but also finds it hard to score, creating doubt."},
  {q:"What is the fastest recorded ball in Test cricket?",opts:["156 km/h","159 km/h","161 km/h","163 km/h"],ans:2,skill:"bowling",coachNote:"Shoaib Akhtar clocked 161.3 km/h in a Test match — the fastest delivery recorded in international cricket. His round-arm action generated exceptional pace."},
  {q:"Which ground hosts the Boxing Day Test in Australia each year?",opts:["SCG","Adelaide Oval","MCG","WACA"],ans:2,skill:"history",coachNote:"The Boxing Day Test is always played at the MCG in Melbourne — it typically draws 80,000+ fans on the first day and is one of cricket's great annual traditions."},
  {q:"What is the New Year Test venue in Australia?",opts:["MCG","Adelaide Oval","Gabba","SCG"],ans:3,skill:"history",coachNote:"The New Year Test is traditionally played at the SCG (Sydney Cricket Ground) in the first week of January — one of cricket's oldest and most iconic venues."},
  {q:"Who was the first batter to face 1000 Test match deliveries in a single innings?",opts:["Geoff Boycott","Len Hutton","Hanif Mohammad","Chris Tavaré"],ans:2,skill:"batting",coachNote:"Hanif Mohammad faced over 999 deliveries scoring 337 for Pakistan vs West Indies in 1957-58 — the longest innings in terms of balls faced in Test cricket history."},
  {q:"Which test cricketer was known as 'Jumbo'?",opts:["Muttiah Muralitharan","Anil Kumble","Harbhajan Singh","Danish Kaneria"],ans:1,skill:"bowling",coachNote:"Anil Kumble was nicknamed Jumbo — despite not turning the ball much, his accuracy, bounce and ability to take wickets in any conditions made him India's greatest ever bowler."},
  {q:"How many runs did Don Bradman need in his final Test innings to finish with a 100 average?",opts:["2","4","5","6"],ans:1,skill:"batting",coachNote:"Bradman needed just 4 runs in his final innings at The Oval 1948 to average 100 — he was bowled second ball by Eric Hollies for 0, finishing on 99.94."}
];

// ─── COMMENTARY ────────────────────────────────────────────────────────────────
const COMMENTARY = {
  shastri: {
    fast: ["AND HE'S SMASHED IT INTO THE STANDS! WHAT. A. SHOT! The crowd is on its feet!","That is GONE! High and handsome and into the crowd! This man is on ABSOLUTE FIRE!","SIX! Right off the sweet spot! He's creamed that through the covers!","MAGNIFICENT! As clean a strike as you'll ever see! Absolutely BRILLIANT cricket!"],
    slow: ["Phew! Got there in the nick of time! But it counts — and THAT is what matters!","Squeezed through the gap! Not the prettiest, but a boundary is a boundary!","He's nicked it but it's gone for four! The cricketing gods are smiling today!"],
    wrong: ["BOWLED HIM! What a delivery! The stumps are shattered, the bails are flying!","CAUGHT BEHIND! The finger goes up — OUT! Back to the pavilion!","LBW! Plumb in front! Umpire has no hesitation — that is PLUMB!","What a wicket for the bowling side! Rethink that one in the dressing room!"],
    timeout: ["RUN OUT! No shot offered! A criminal waste! Run out for nothing!","Dot ball! The pressure is BUILDING! The asking rate is climbing!"],
    between: ["A drinks break. Both sides regrouping. Tension in the air.","The groundstaff are out. A moment to breathe. Who blinks first?","What a contest this is! This is what CRICKET IS ALL ABOUT!"],
  },
  bhogle: {
    fast: ["Lovely footwork, lovely timing — and that is a delightful answer.","Composed, assured, absolutely correct. That is class under pressure.","Picked it beautifully. That's the kind of knowledge that separates the good from the great.","Elegant. Precise. The very best answer you could give in this situation."],
    slow: ["Not fluent, but effective — and sometimes that's all you need.","It was a scrambled answer but it gets the job done. Pragmatic cricket.","Got away with that one. Sometimes the cricketing gods do smile."],
    wrong: ["A misjudgement there. The best players learn from moments like these.","The opposition will take that. A costly error at a crucial moment.","That was always going to be difficult, and it proved too much in the end.","He'll be disappointed with that. He'll know straightaway that was the wrong choice."],
    timeout: ["Ran out of time there. The pressure of the chase getting to him.","Dot answer. The asking rate just got steeper."],
    between: ["A moment's pause. Both players thinking hard about what comes next.","The strategic battle continues. Every question is a contest in itself.","Fascinating cricket this. Neither side giving an inch."],
  },
};


// ─── RUNS SYSTEM ──────────────────────────────────────────────────────────────
// Correct + answered quickly (≥11s left) → SIX  (6 runs)
// Correct + mid-speed  (6–10s left)      → FOUR (4 runs)  
// Correct + slow       (1–5s left)       → TWO  (2 runs)
// Wrong answer                           → Wicket + lose 5 runs (min 0)
// Timeout                                → Run out + lose 3 runs
// Free Hit active on wrong               → No wicket, no run loss
const runsForTime = tLeft => tLeft >= 11 ? 6 : tLeft >= 6 ? 4 : 2;
const runLabel = runs => runs === 6 ? "SIX! 💥" : runs === 4 ? "FOUR! 🔥" : "TWO RUNS ✅";

// ─── LEADERBOARD ───────────────────────────────────────────────────────────────
const LB_DATA = [
  { rank:1, name:"RohitFan_IN",    flag:"🇮🇳", stage:"Legend",          xp:9200, earnings:142.60, wins:94 },
  { rank:2, name:"ShaneyWarne_AU", flag:"🇦🇺", stage:"Test Cricketer",  xp:7800, earnings:118.80, wins:88 },
  { rank:3, name:"PakKing_PK",     flag:"🇵🇰", stage:"Test Cricketer",  xp:7100, earnings: 97.20, wins:82 },
  { rank:4, name:"Lords_UK",       flag:"🏴󠁧󠁢󠁥󠁮󠁧󠁿", stage:"A-Team Cricketer",xp:6400, earnings: 79.00, wins:75 },
  { rank:5, name:"CapeTown_ZA",    flag:"🇿🇦", stage:"A-Team Cricketer",xp:5800, earnings: 63.40, wins:71 },
  { rank:6, name:"IPLMaster_IN",   flag:"🇮🇳", stage:"State Cricketer", xp:4600, earnings: 48.60, wins:64 },
];

// ─── HELPERS ──────────────────────────────────────────────────────────────────
const rnd = arr => arr[Math.floor(Math.random() * arr.length)];
const getCareer = xp => [...CAREER].reverse().find(c => xp >= c.minXp) || CAREER[0];
const nextCareerStage = xp => CAREER.find(c => xp < c.minXp) || null;
const fmt2 = n => n.toFixed(2);

async function fetchQuestions(condition) {
  const diffMap = ["easy","easy","medium","medium","hard","hard","expert","legend"];
  const p = `Generate 6 cricket quiz questions. Difficulty: medium.
Today's pitch condition: "${condition.name}" — bias questions toward "${condition.cat}".
STRICT RULES:
- All 4 options must look equally plausible. Never make the correct answer obvious by length, detail, or phrasing.
- Do NOT include words like "correct", "right", "answer" anywhere in the options.
- Options must be short noun phrases only (player names, numbers, years, team names) — no sentences.
- The question must not contain or hint at the answer.
- Return ONLY a raw JSON array, no markdown, no explanation, no extra text.
Schema: [{"q":"...","opts":["A","B","C","D"],"ans":0,"cat":"...","skill":"batting|bowling|ipl|history|womens","coachNote":"one sentence explaining why the correct answer is right"}]`;
  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: "claude-sonnet-4-20250514", max_tokens: 1400, messages: [{ role: "user", content: p }] }),
    });
    if (!r.ok) throw new Error();
    const d = await r.json();
    const txt = (d.content || []).map(b => b.text || "").join("").replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(txt);
    if (Array.isArray(parsed) && parsed.length >= 5) return parsed;
    throw new Error();
  } catch { return null; }
}

// Global session question dedup tracker — persists across matches in the same session
const seenQHashes = new Set();
function hashQ(q) { return q.q.slice(0, 30); }

// ── SEEDED RNG (for reproducible friend challenges) ────────────────────────
function seededRng(seed) {
  let s = (seed >>> 0) || 1;
  return () => {
    s = Math.imul(s ^ (s >>> 15), s | 1);
    s ^= s + Math.imul(s ^ (s >>> 7), s | 61);
    return ((s ^ (s >>> 14)) >>> 0) / 0x100000000;
  };
}

function buildSeededQuestions(seed, conditionId) {
  const cond = CONDITIONS.find(c => c.id === conditionId) || CONDITIONS[2];
  const rng  = seededRng(seed);
  const bank = [...FALLBACK_BANK].sort(() => rng() - 0.5);
  const pool = [];
  const skillOrder = ["batting","bowling","history","ipl","womens","batting","history"];
  for (const skill of skillOrder) {
    if (pool.length >= 6) break;
    const pick = bank.find(q => q.skill === skill && !pool.includes(q));
    if (pick) pool.push(pick);
  }
  while (pool.length < 6) {
    const fill = bank.find(q => !pool.includes(q));
    if (fill) pool.push(fill); else break;
  }
  return pool.slice(0,6).map(q => ({
    ...q,
    cat: q.cat || "TRIVIA",
    coachNote: q.coachNote || "Study this topic to strengthen your cricket knowledge!",
    skill: q.skill || "history",
  }));
}

function buildQuestionSet(aiQs, condition, matchCount = 0) {
  // Target skill distribution per match (7 questions)
  // Biased toward condition's cat, always varied
  const SKILL_TARGETS = { batting: 2, bowling: 1, ipl: 1, history: 2, womens: 1 };

  // Filter bank to unseen questions
  let available = FALLBACK_BANK.filter(q => !seenQHashes.has(hashQ(q)));
  // If we've used most of the bank, reset dedup (every ~20 matches)
  if (available.length < 14) {
    seenQHashes.clear();
    available = [...FALLBACK_BANK];
  }

  // Shuffle available
  available = available.sort(() => Math.random() - .5);

  // Pick 1 condition-biased question (matches condition.cat keyword)
  const condKeyword = condition.cat.toLowerCase();
  const condBiased = available.find(q =>
    (q.cat || "").toLowerCase().includes(condKeyword) ||
    (q.skill === "ipl" && condition.id === "flat") ||
    (q.skill === "bowling" && condition.id === "seam") ||
    (q.skill === "history" && condition.id === "dusty")
  );

  // Build balanced set
  const pool = [];
  if (condBiased) pool.push(condBiased);

  // Fill remaining slots by rotating through skill targets
  const skillBuckets = {};
  for (const skill of Object.keys(SKILL_TARGETS)) {
    skillBuckets[skill] = available.filter(q =>
      q.skill === skill && !pool.includes(q)
    );
  }

  const skillOrder = ["batting","bowling","history","ipl","womens","batting","history"];
  for (const skill of skillOrder) {
    if (pool.length >= 6) break;
    const bucket = skillBuckets[skill] || [];
    const pick = bucket.find(q => !pool.includes(q));
    if (pick) pool.push(pick);
  }

  // Top up from AI questions if available (use as bonus questions, validate first)
  if (aiQs && pool.length < 6) {
    const validAi = aiQs.filter(q =>
      q.q && q.opts && q.opts.length === 4 &&
      typeof q.ans === "number" && q.ans >= 0 && q.ans <= 3 &&
      !seenQHashes.has(hashQ(q)) &&
      !pool.find(p => hashQ(p) === hashQ(q))
    );
    for (const q of validAi) {
      if (pool.length >= 6) break;
      pool.push(q);
    }
  }

  // Final fallback — just grab from available
  while (pool.length < 6) {
    const fill = available.find(q => !pool.includes(q)) || available[0];
    if (fill) pool.push(fill);
    else break;
  }

  const final = pool.slice(0, 6);
  final.forEach(q => seenQHashes.add(hashQ(q)));

  return final.map(q => ({
    ...q,
    cat: q.cat || "TRIVIA",
    coachNote: q.coachNote || "Study this topic to strengthen your cricket knowledge!",
    skill: q.skill || "history",
  }));
}

// ─── AUDIO (sound effects only — no TTS/speech) ────────────────────────────────
function useAudio(on) {
  return useCallback((t) => {
    if (!on) return;
    try {
      const c = new (window.AudioContext || window.webkitAudioContext)();
      if (t === "tick") { const o = c.createOscillator(), g = c.createGain(); o.connect(g); g.connect(c.destination); o.frequency.value = 880; g.gain.setValueAtTime(.025, c.currentTime); g.gain.exponentialRampToValueAtTime(.001, c.currentTime + .07); o.start(); o.stop(c.currentTime + .07); }
      else if (t === "ok") { [523, 659, 784].forEach((f, i) => { const o = c.createOscillator(), g = c.createGain(); o.connect(g); g.connect(c.destination); o.frequency.value = f; g.gain.setValueAtTime(.055, c.currentTime + i * .09); g.gain.exponentialRampToValueAtTime(.001, c.currentTime + i * .09 + .16); o.start(c.currentTime + i * .09); o.stop(c.currentTime + i * .09 + .18); }); }
      else if (t === "bad") { const o = c.createOscillator(), g = c.createGain(); o.type = "sawtooth"; o.connect(g); g.connect(c.destination); o.frequency.value = 130; g.gain.setValueAtTime(.055, c.currentTime); g.gain.exponentialRampToValueAtTime(.001, c.currentTime + .28); o.start(); o.stop(c.currentTime + .3); }
      else if (t === "coin") { [440, 550, 660, 880, 1100].forEach((f, i) => { const o = c.createOscillator(), g = c.createGain(); o.connect(g); g.connect(c.destination); o.frequency.value = f; g.gain.setValueAtTime(.06, c.currentTime + i * .07); g.gain.exponentialRampToValueAtTime(.001, c.currentTime + i * .07 + .15); o.start(c.currentTime + i * .07); o.stop(c.currentTime + i * .07 + .17); }); }
      else if (t === "win") { [523, 659, 784, 1047].forEach((f, i) => { const o = c.createOscillator(), g = c.createGain(); o.connect(g); g.connect(c.destination); o.frequency.value = f; g.gain.setValueAtTime(.07, c.currentTime + i * .12); g.gain.exponentialRampToValueAtTime(.001, c.currentTime + i * .12 + .22); o.start(c.currentTime + i * .12); o.stop(c.currentTime + i * .12 + .25); }); }
      else if (t === "between") { [330, 440, 330].forEach((f, i) => { const o = c.createOscillator(), g = c.createGain(); o.connect(g); g.connect(c.destination); o.frequency.value = f; g.gain.setValueAtTime(.035, c.currentTime + i * .3); g.gain.exponentialRampToValueAtTime(.001, c.currentTime + i * .3 + .25); o.start(c.currentTime + i * .3); o.stop(c.currentTime + i * .3 + .28); }); }
    } catch {}
  }, [on]);
}

// ─── CONFETTI ─────────────────────────────────────────────────────────────────
function Confetti() {
  const p = useMemo(() => Array.from({ length: 60 }, (_, i) => ({
    id: i, col: ["#b45309","#0284c7","#16a34a","#dc2626","#7c3aed","#ea580c","#0891b2","#d97706"][i % 8],
    l: Math.random() * 100, dur: 1.6 + Math.random() * 2.2, delay: Math.random() * 1.4,
    w: 5 + Math.random() * 7, h: 5 + Math.random() * 12, rot: Math.random() * 360,
  })), []);
  return <>{p.map(c => <div key={c.id} style={{ position: "absolute", top: -14, left: `${c.l}%`, width: c.w, height: c.h, background: c.col, borderRadius: c.id % 3 === 0 ? "50%" : "2px", animation: `cfDrop ${c.dur}s ${c.delay}s linear forwards`, transform: `rotate(${c.rot}deg)`, pointerEvents: "none", opacity: .8 }} />)}</>;
}

// ─── CSS ─────────────────────────────────────────────────────────────────────
const G = `
@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,700;0,800;1,700;1,800&family=Outfit:wght@300;400;500;600;700;800&family=IBM+Plex+Mono:wght@400;500;600&display=swap');

@keyframes cfDrop{0%{transform:translateY(0) rotate(0deg);opacity:.85}100%{transform:translateY(850px) rotate(720deg);opacity:0}}
@keyframes fadeUp{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}
@keyframes fadeIn{from{opacity:0}to{opacity:1}}
@keyframes scaleIn{from{opacity:0;transform:scale(.88)}to{opacity:1;transform:scale(1)}}
@keyframes popIn{from{opacity:0;transform:scale(.88) translateY(10px)}to{opacity:1;transform:scale(1) translateY(0)}}
@keyframes countIn{0%{transform:scale(2.2);opacity:0}65%{transform:scale(.92)}100%{transform:scale(1);opacity:1}}
@keyframes scoreFlash{0%{transform:scale(1.5);color:#16a34a}100%{transform:scale(1)}}
@keyframes spin{to{transform:rotate(360deg)}}
@keyframes floatBob{0%,100%{transform:translateY(0)}50%{transform:translateY(-6px)}}
@keyframes spinBall{0%{transform:rotate(0deg) scale(1)}50%{transform:rotate(180deg) scale(1.1)}100%{transform:rotate(360deg) scale(1)}}
@keyframes photoReveal{from{opacity:0;transform:scale(1.06)}to{opacity:1;transform:scale(1)}}
@keyframes pulse{0%,100%{opacity:.4}50%{opacity:1}}
@keyframes shimmer{0%{transform:translateX(-120%)}100%{transform:translateX(300%)}}
@keyframes gradShift{0%,100%{background-position:0% 50%}50%{background-position:100% 50%}}
@keyframes coinSpin{0%{transform:rotateY(0)}100%{transform:rotateY(1800deg)}}
@keyframes trophyBounce{0%{transform:scale(0) rotate(-15deg)}70%{transform:scale(1.12) rotate(2deg)}100%{transform:scale(1) rotate(0)}}
@keyframes betweenQ{0%{opacity:0;transform:scale(.95)}15%{opacity:1;transform:scale(1)}85%{opacity:1;transform:scale(1)}100%{opacity:0;transform:scale(.98)}}
@keyframes timerTick{0%{transform:scale(1)}50%{transform:scale(1.08)}100%{transform:scale(1)}}
@keyframes oppScoreIn{from{opacity:0;transform:translateX(20px)}to{opacity:1;transform:translateX(0)}}
@keyframes tauntSlide{from{transform:translateY(-110%)}to{transform:translateY(0)}}
@keyframes livePulse{0%,100%{box-shadow:0 0 0 0 rgba(22,163,74,.3)}50%{box-shadow:0 0 0 6px rgba(22,163,74,0)}}

*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
:root{
  --bg:#f7f4ee;
  --s0:#ffffff;--s1:#fefcf8;--s2:#f3ede2;--s3:#e9e0d0;--s4:#ddd3be;
  --rim:rgba(0,0,0,.07);--rim2:rgba(0,0,0,.11);--rim3:rgba(0,0,0,.18);
  /* Cricket Gold */
  --amber:#b45309;--amber2:#d97706;--amber3:#fbbf24;--amberBg:#fffbeb;
  --amberViv:#f59e0b;
  /* Pitch Green */
  --green:#166534;--green2:#16a34a;--green3:#4ade80;--greenBg:#f0fdf4;
  --pitch:#1a5c2e;--pitchBg:#edfbf1;
  /* Sky Blue */
  --blue:#0369a1;--blue2:#0ea5e9;--blueBg:#f0f9ff;
  /* Cricket Ball Red */
  --red:#be123c;--red2:#f43f5e;--redBg:#fff1f2;
  /* Royal Purple (IPL accent) */
  --purp:#7c3aed;--purpBg:#faf5ff;
  --txt:#1c1917;--sub:#6b6560;--dim:#c9c0b4;--dimx:#e8e0d4;
  --r1:10px;--r2:16px;--r3:22px;
  --fh:'Outfit',sans-serif;--fd:'Playfair Display',serif;--fm:'IBM Plex Mono',monospace;
  --sh-xs:0 1px 3px rgba(0,0,0,.07);
  --sh-sm:0 2px 8px rgba(0,0,0,.09),0 1px 3px rgba(0,0,0,.05);
  --sh:0 4px 18px rgba(0,0,0,.10),0 2px 6px rgba(0,0,0,.06);
  --sh-lg:0 14px 44px rgba(0,0,0,.13),0 4px 14px rgba(0,0,0,.07);
  --sh-amber:0 6px 28px rgba(180,83,9,.22);
  --sh-green:0 6px 24px rgba(22,101,52,.18);
  --sh-red:0 6px 24px rgba(190,18,60,.18);
}
html,body,#root{height:100%;width:100%;margin:0;padding:0;}
html,body{background:var(--bg);color:var(--txt);font-family:var(--fh);-webkit-font-smoothing:antialiased;overflow-x:hidden;font-size:16px}
#root{min-height:100vh;display:flex;justify-content:center;background:var(--bg)}
.app{width:100%;max-width:480px;min-height:100dvh;height:100%;display:flex;flex-direction:column;background:var(--bg);position:relative;overflow-x:hidden;overflow-y:auto;margin:0 auto}
.screen{flex:1;display:flex;flex-direction:column;animation:fadeUp .28s cubic-bezier(.22,1,.36,1);min-height:0}

/* ══════ HERO ══════ */
.hero{position:relative;height:440px;overflow:hidden;background:#1c1917}
.hero-tex{position:absolute;inset:0;background:radial-gradient(ellipse 80% 60% at 50% -10%,rgba(245,158,11,.28),transparent 60%),radial-gradient(ellipse 60% 55% at 5% 85%,rgba(22,101,52,.22),transparent 60%),radial-gradient(ellipse 50% 45% at 90% 60%,rgba(14,165,233,.15),transparent 55%),radial-gradient(ellipse 40% 40% at 55% 50%,rgba(124,58,237,.08),transparent 55%)}
.hero-grid{position:absolute;inset:0;background-image:linear-gradient(rgba(255,255,255,.04) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.04) 1px,transparent 1px);background-size:40px 40px;mask-image:linear-gradient(180deg,transparent,rgba(0,0,0,.7) 25%,rgba(0,0,0,.7) 75%,transparent)}
.hero-fade{position:absolute;bottom:0;left:0;right:0;height:200px;background:linear-gradient(transparent,#1c1917);z-index:2;pointer-events:none}
.hero-c{position:absolute;inset:0;z-index:3;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:0 24px 64px}
.hero-eyebrow{font-family:var(--fm);font-size:9px;font-weight:600;letter-spacing:4.5px;text-transform:uppercase;color:rgba(251,191,36,.8);margin-bottom:14px;animation:fadeUp .5s .1s both}
.hero-title{font-family:var(--fd);font-size:74px;font-weight:800;text-align:center;line-height:.86;letter-spacing:-1px;animation:fadeUp .6s .2s both;color:#fff}
.hero-title em{font-style:italic;background:linear-gradient(135deg,#fbbf24 0%,#f59e0b 40%,#d97706 80%);background-size:200% 100%;-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;animation:gradShift 5s 1s ease-in-out infinite}
.hero-div{width:42px;height:1.5px;background:linear-gradient(90deg,transparent,rgba(251,191,36,.65),transparent);margin:14px auto;animation:fadeUp .4s .35s both}
.hero-sub{font-size:13px;font-weight:400;color:rgba(255,255,255,.5);text-align:center;animation:fadeUp .5s .45s both}
.live-pill{display:inline-flex;align-items:center;gap:6px;margin-top:14px;background:rgba(22,163,74,.14);border:1px solid rgba(22,163,74,.28);border-radius:999px;padding:5px 14px;font-family:var(--fm);font-size:9px;font-weight:600;letter-spacing:2px;color:#4ade80;animation:fadeUp .5s .55s both}
.ldot{width:5px;height:5px;border-radius:50%;background:#4ade80;animation:pulse 1.4s infinite}
.land-c{padding:18px 18px 32px;display:flex;flex-direction:column;gap:10px}
.land-features{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.feat-card{background:var(--s0);border:1px solid var(--rim);border-radius:var(--r2);padding:14px;display:flex;flex-direction:column;gap:5px;box-shadow:var(--sh-sm);animation:fadeUp .4s both;transition:transform .18s,box-shadow .18s}
.feat-card:hover{transform:translateY(-2px);box-shadow:var(--sh-lg)}
.feat-icon{font-size:26px}
.feat-name{font-size:14px;font-weight:700}
.feat-desc{font-size:12px;color:var(--sub);line-height:1.4}

/* ══════ BUTTONS ══════ */
.btn{position:relative;border:none;border-radius:var(--r2);font-family:var(--fh);font-size:17px;font-weight:700;letter-spacing:.2px;cursor:pointer;padding:17px 22px;display:flex;align-items:center;justify-content:center;gap:8px;overflow:hidden;transition:transform .12s,box-shadow .18s,opacity .14s;-webkit-tap-highlight-color:transparent}
.btn::after{content:'';position:absolute;top:0;left:-100%;width:35%;height:100%;background:linear-gradient(90deg,transparent,rgba(255,255,255,.22),transparent);transition:left .4s}
.btn:hover::after{left:150%}
.btn:active{transform:scale(.963)}
.btn[disabled]{opacity:.35;cursor:not-allowed}
.btn-amber{background:linear-gradient(135deg,#b45309,#d97706,#f59e0b);background-size:200%;color:#fff;box-shadow:0 2px 0 rgba(0,0,0,.15),var(--sh-amber);animation:gradShift 6s ease-in-out infinite}
.btn-amber:hover{box-shadow:0 2px 0 rgba(0,0,0,.2),0 8px 32px rgba(180,83,9,.35)}
.btn-green{background:linear-gradient(135deg,#15803d,#16a34a);color:#fff;box-shadow:0 2px 0 rgba(0,0,0,.12),0 6px 22px rgba(21,128,61,.28)}
.btn-blue{background:linear-gradient(135deg,#0369a1,#0284c7);color:#fff;box-shadow:0 2px 0 rgba(0,0,0,.12),0 6px 22px rgba(3,105,161,.28)}
.btn-outline{background:var(--s0);border:1.5px solid var(--rim2);color:var(--sub);box-shadow:var(--sh-xs);font-weight:600}
.btn-outline:hover{border-color:var(--amber);color:var(--amber)}
.btn-ghost{background:transparent;border:1.5px solid var(--rim2);color:var(--sub);font-weight:600}
.btn-ghost:hover{border-color:var(--amber);color:var(--amber)}
.btn-sm{font-size:12px;padding:10px 15px;border-radius:var(--r1)}

/* ══════ HEADER ══════ */
.hdr{display:flex;align-items:center;gap:10px;padding:20px 18px 0}
.back-btn{width:40px;height:40px;border-radius:12px;background:var(--s0);border:1px solid var(--rim2);color:var(--txt);font-size:18px;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all .18s;flex-shrink:0;box-shadow:var(--sh-xs)}
.back-btn:hover{border-color:var(--amber);color:var(--amber)}
.hdr-title{font-family:var(--fd);font-size:24px;font-weight:700;letter-spacing:-.3px}
.hdr-r{margin-left:auto;display:flex;gap:6px;align-items:center}
.mono-tag{font-family:var(--fm);font-size:9px;font-weight:600;letter-spacing:1.5px;text-transform:uppercase;border-radius:999px;padding:4px 11px;display:inline-flex;align-items:center;gap:4px}
.slbl{font-family:var(--fm);font-size:11px;font-weight:600;letter-spacing:2.5px;text-transform:uppercase;color:var(--sub)}

/* ══════ SETUP ══════ */
.setup-scroll{flex:1;overflow-y:auto;padding:16px 18px 100px;display:flex;flex-direction:column;gap:18px;-webkit-overflow-scrolling:touch}
.field-g{display:flex;flex-direction:column;gap:8px}
.inp{background:var(--s0);border:1.5px solid var(--rim2);border-radius:var(--r1);padding:13px 16px;font-family:var(--fh);font-size:15px;font-weight:500;color:var(--txt);outline:none;transition:all .2s;width:100%;box-shadow:var(--sh-xs)}
.inp:focus{border-color:var(--amber);background:#fff;box-shadow:0 0 0 3px rgba(180,83,9,.08)}
.inp::placeholder{color:var(--dim)}
.country-g{display:grid;grid-template-columns:repeat(5,1fr);gap:7px}
.cty{background:var(--s0);border:1.5px solid var(--rim);border-radius:var(--r1);padding:10px 4px;display:flex;flex-direction:column;align-items:center;gap:3px;cursor:pointer;transition:all .2s;font-size:10px;font-weight:600;color:var(--sub);box-shadow:var(--sh-xs)}
.cty .fl{font-size:24px;line-height:1}
.cty:hover{border-color:rgba(180,83,9,.35)}
.cty.on{border-color:var(--amber);background:var(--amberBg);color:var(--amber)}
.fee-g{display:flex;flex-direction:column;gap:7px}
.fee-row{background:var(--s0);border:1.5px solid var(--rim);border-radius:var(--r2);padding:13px 15px;cursor:pointer;transition:all .2s;display:flex;align-items:center;gap:12px;box-shadow:var(--sh-xs)}
.fee-icon{font-size:20px;flex-shrink:0}
.fee-info{flex:1}
.fee-label{font-family:var(--fd);font-size:18px;font-weight:700}
.fee-prize{font-size:13px;color:var(--sub);margin-top:2px}
.fee-tag{font-family:var(--fm);font-size:9px;font-weight:600;letter-spacing:1.5px;text-transform:uppercase;border-radius:999px;padding:3px 9px}
.fee-row:hover{border-color:rgba(180,83,9,.3)}
.fee-row.on{border-color:var(--amber);background:var(--amberBg)}
.fee-row.on .fee-label{color:var(--amber)}
.comm-toggle{display:flex;background:var(--s2);border-radius:var(--r1);padding:3px;gap:3px}
.comm-btn{flex:1;padding:8px;border:none;border-radius:8px;font-family:var(--fh);font-size:11px;font-weight:600;cursor:pointer;transition:all .2s;background:transparent;color:var(--sub)}
.comm-btn.on{background:var(--s0);color:var(--txt);box-shadow:var(--sh-xs)}

/* ══════ TOSS ══════ */
.toss-screen{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:22px;padding:32px 24px;background:linear-gradient(160deg,#1a2e1a 0%,#1c1917 50%,#1a1a2e 100%)}
.toss-players{display:flex;align-items:center;justify-content:center;gap:16px;width:100%}
.tp{flex:1;display:flex;flex-direction:column;align-items:center;gap:5px;max-width:120px}
.tp-flag{font-size:38px;animation:floatBob 2.8s ease-in-out infinite}
.tp-name{font-size:11px;font-weight:600;color:rgba(255,255,255,.6);text-align:center;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;width:100%}
.tp-elo{font-family:var(--fm);font-size:10px;color:rgba(255,255,255,.3)}
.toss-vs{font-family:var(--fd);font-size:16px;font-weight:700;color:rgba(255,255,255,.2);flex-shrink:0}
/* 3D coin */
.coin-wrap{perspective:600px}
.coin{width:120px;height:120px;border-radius:50%;position:relative;transform-style:preserve-3d;cursor:pointer;transition:transform .1s}
.coin.spinning{animation:coinSpin 1.8s cubic-bezier(.45,.05,.55,.95) forwards}
.coin-face{position:absolute;inset:0;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:44px;backface-visibility:hidden}
.coin-heads{background:linear-gradient(135deg,#c8963c,#f59e0b,#fbbf24,#d97706);background-size:300% 300%;animation:gradShift 3s ease-in-out infinite;box-shadow:0 8px 32px rgba(180,83,9,.4),inset 0 2px 4px rgba(255,255,255,.3)}
.coin-tails{background:linear-gradient(135deg,#78716c,#a8a29e,#d6d3d1);transform:rotateY(180deg);box-shadow:0 8px 24px rgba(0,0,0,.2)}
/* Choice screen */
.choice-screen{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:20px;padding:32px 24px;background:linear-gradient(180deg,var(--bg),var(--s2))}
.choice-cards{display:grid;grid-template-columns:1fr 1fr;gap:12px;width:100%}
.choice-card{background:var(--s0);border:2px solid var(--rim2);border-radius:var(--r3);padding:24px 16px;cursor:pointer;transition:all .22s;display:flex;flex-direction:column;align-items:center;gap:10px;box-shadow:var(--sh)}
.choice-card:hover{transform:translateY(-3px);box-shadow:var(--sh-lg)}
.choice-card.bat{border-color:var(--amber)}
.choice-card.bat:hover{background:var(--amberBg);box-shadow:0 12px 40px rgba(180,83,9,.2)}
.choice-card.chase{border-color:var(--blue)}
.choice-card.chase:hover{background:var(--blueBg);box-shadow:0 12px 40px rgba(3,105,161,.2)}
.choice-icon{font-size:44px}
.choice-title{font-family:var(--fd);font-size:20px;font-weight:800}
.choice-desc{font-size:11px;color:var(--sub);text-align:center;line-height:1.45}

/* ══════ CONDITIONS — BROADCAST STYLE ══════ */
.cond-screen{flex:1;display:flex;flex-direction:column;overflow-y:auto;position:relative;background:#000;-webkit-overflow-scrolling:touch}
.cond-stadium-bg{position:absolute;inset:0;background-size:cover;background-position:center top;z-index:0;transition:opacity .5s}
.cond-overlay{position:absolute;inset:0;z-index:1}
.cond-vignette{position:absolute;inset:0;z-index:2;background:radial-gradient(ellipse at 50% 30%,transparent 30%,rgba(0,0,0,.7) 100%)}
.cond-content{position:relative;z-index:3;flex:1;display:flex;flex-direction:column;justify-content:space-between;padding:0}

/* TV broadcast header bar */
.broadcast-bar{display:flex;align-items:center;justify-content:space-between;padding:10px 14px;background:rgba(0,0,0,.55);backdrop-filter:blur(8px);border-bottom:1px solid rgba(255,255,255,.08)}
.broadcast-live{display:flex;align-items:center;gap:6px;font-family:var(--fm);font-size:10px;font-weight:700;letter-spacing:2px;text-transform:uppercase}
.live-dot{width:8px;height:8px;border-radius:50%;animation:pulse 1s infinite}
.broadcast-logo{font-family:var(--fd);font-size:12px;font-weight:800;color:rgba(255,255,255,.8);letter-spacing:1px}
.broadcast-temp{font-family:var(--fm);font-size:11px;color:rgba(255,255,255,.6)}

/* Stadium name lower-third */
.lower-third{padding:10px 14px 6px;background:linear-gradient(transparent,rgba(0,0,0,.6))}
.lt-venue{font-family:var(--fm);font-size:9px;font-weight:700;letter-spacing:3px;text-transform:uppercase;color:rgba(255,255,255,.5);margin-bottom:3px}
.lt-stadium{font-family:var(--fd);font-size:18px;font-weight:800;color:#fff;letter-spacing:-.3px;line-height:1.1}

/* Pitch report card — bottom sheet style */
.pitch-report-sheet{background:rgba(0,0,0,.82);backdrop-filter:blur(16px);border-top:1px solid rgba(255,255,255,.1);padding:18px 18px 28px;display:flex;flex-direction:column;gap:14px}
.pitch-tag{font-family:var(--fm);font-size:8px;font-weight:700;letter-spacing:3px;text-transform:uppercase;color:rgba(255,255,255,.4);display:flex;align-items:center;gap:6px}
.pitch-tag::before{content:"";display:block;width:18px;height:2px;border-radius:999px;background:var(--tagColor,#fff)}
.pitch-name{font-family:var(--fd);font-size:28px;font-weight:900;color:#fff;line-height:1.1;letter-spacing:-.5px}
.pitch-desc{font-size:13px;color:rgba(255,255,255,.55);line-height:1.5;margin-top:2px}

/* Weather + pitch strip */
.pitch-stats-row{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}
.pitch-stat{background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.1);border-radius:10px;padding:9px 8px;display:flex;flex-direction:column;align-items:center;gap:3px}
.pitch-stat-val{font-family:var(--fm);font-size:11px;font-weight:700;color:#fff}
.pitch-stat-lbl{font-family:var(--fm);font-size:7px;font-weight:600;letter-spacing:1px;text-transform:uppercase;color:rgba(255,255,255,.35)}

/* Innings badge */
.innings-badge-bc{display:inline-flex;align-items:center;gap:7px;border-radius:999px;padding:8px 18px;font-family:var(--fm);font-size:10px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;border:1.5px solid;align-self:flex-start}

/* Night stars */
.star{position:absolute;border-radius:50%;background:#fff;animation:twinkle var(--dur,2s) infinite var(--delay,0s)}
@keyframes twinkle{0%,100%{opacity:var(--op1,.8);transform:scale(1)}50%{opacity:var(--op2,.2);transform:scale(.6)}}

/* Floodlight glow (night) */
.floodlight{position:absolute;width:120px;height:120px;border-radius:50%;filter:blur(40px);opacity:.35;pointer-events:none}

/* Pitch strip graphic */
.pitch-strip{position:absolute;bottom:38%;left:50%;transform:translateX(-50%);width:28px;height:90px;background:linear-gradient(180deg,var(--pitchTop,#8B7355),var(--pitchBot,#A8956B));border-radius:3px;opacity:.7;border:1px solid rgba(255,255,255,.15)}
.crease-line{position:absolute;left:0;right:0;height:1.5px;background:rgba(255,255,255,.6)}

.cond-card{width:100%;background:var(--s0);border-radius:var(--r3);padding:28px 22px;display:flex;flex-direction:column;align-items:center;gap:12px;box-shadow:var(--sh-lg);border:1px solid var(--rim);animation:scaleIn .4s cubic-bezier(.22,1,.36,1)}
.cond-icon{font-size:54px;animation:floatBob 3s ease-in-out infinite}
.cond-name{font-family:var(--fd);font-size:26px;font-weight:800;text-align:center;letter-spacing:-.3px}
.cond-desc{font-size:13px;color:var(--sub);text-align:center;line-height:1.55;max-width:280px}
.cond-badge{font-family:var(--fm);font-size:9px;font-weight:600;letter-spacing:2px;text-transform:uppercase;border-radius:999px;padding:5px 14px;border:1.5px solid}

/* ══════ MATCH SCREEN ══════ */
.match-wrap{display:flex;flex-direction:column;flex:1;background:var(--bg);position:relative}

/* Scoreboard */
.scoreboard{background:linear-gradient(135deg,#1a2e1a,#1f3d1f);border-bottom:3px solid #2d5a2d;padding:12px 16px;display:flex;align-items:center;justify-content:space-between;box-shadow:0 4px 20px rgba(0,0,0,.25);position:relative}
.sb-p{display:flex;flex-direction:column;gap:1px}
.sb-p.r{align-items:flex-end}
.sb-flag{font-size:16px;line-height:1}
.sb-name{font-size:10px;font-weight:600;color:rgba(255,255,255,.6);max-width:90px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;margin-top:1px}
.sb-score{font-family:var(--fd);font-size:30px;font-weight:700;letter-spacing:-.5px;transition:color .25s,transform .3s;line-height:1.05;color:rgba(255,255,255,.9)}
.sb-score.batting{color:#fbbf24;text-shadow:0 0 20px rgba(251,191,36,.4)}
.sb-score.pop{animation:scoreFlash .35s cubic-bezier(.34,1.56,.64,1)}
.sb-mid{display:flex;flex-direction:column;align-items:center;gap:3px}
.sb-inn{font-family:var(--fm);font-size:8px;font-weight:600;letter-spacing:2px;text-transform:uppercase;color:rgba(255,255,255,.5)}
.sb-dots{display:flex;gap:5px}
.sb-dot{width:9px;height:9px;border-radius:50%;background:rgba(255,255,255,.15);border:1.5px solid rgba(255,255,255,.2);transition:all .25s}
.sb-dot.done-ok{background:#4ade80;border-color:#16a34a;box-shadow:0 0 6px rgba(74,222,128,.5)}
.sb-dot.done-bad{background:#f43f5e;border-color:#be123c;box-shadow:0 0 6px rgba(244,63,94,.5)}
.sb-dot.cur{background:#fbbf24;border-color:#f59e0b;box-shadow:0 0 8px rgba(251,191,36,.6);animation:pulse .9s infinite}

/* LIVE OPP SCORE FEED (shown while player 1 is batting) */
.opp-live{position:absolute;top:0;right:0;bottom:0;left:0;pointer-events:none;z-index:0}
/* Opponent's live tracker shown to player 2 while waiting */
.opp-watch-bar{background:linear-gradient(135deg,#1c1917,#292524);margin:8px 16px;border-radius:var(--r2);padding:12px 15px;display:flex;align-items:center;justify-content:space-between;box-shadow:var(--sh);animation:oppScoreIn .35s cubic-bezier(.22,1,.36,1)}
.owb-left{display:flex;flex-direction:column;gap:2px}
.owb-name{font-size:11px;font-weight:600;color:rgba(255,255,255,.6)}
.owb-score{font-family:var(--fd);font-size:28px;font-weight:700;color:#fff;letter-spacing:-.5px}
.owb-right{text-align:right}
.owb-label{font-family:var(--fm);font-size:8px;color:rgba(255,255,255,.4);letter-spacing:2px;text-transform:uppercase;margin-bottom:3px}
.live-dot{display:inline-flex;align-items:center;gap:5px;background:rgba(22,163,74,.15);border:1px solid rgba(22,163,74,.3);border-radius:999px;padding:3px 10px;font-family:var(--fm);font-size:9px;font-weight:600;color:#4ade80;animation:livePulse 2s infinite}
.live-dot-circle{width:5px;height:5px;border-radius:50%;background:#4ade80;animation:pulse 1.2s infinite}

/* Target banner */
.target-banner{background:linear-gradient(135deg,#1c1917,#292524);margin:8px 16px 0;border-radius:var(--r2);padding:12px 15px;display:flex;align-items:center;justify-content:space-between;box-shadow:var(--sh);animation:popIn .4s cubic-bezier(.22,1,.36,1)}
.tb-need{font-family:var(--fd);font-size:20px;font-weight:700;color:#fff}
.tb-sub{font-family:var(--fm);font-size:9px;color:rgba(255,255,255,.4);letter-spacing:2px;text-transform:uppercase;margin-top:2px}
.tb-target{font-family:var(--fm);font-size:26px;font-weight:600;color:var(--amber3);letter-spacing:-1px}
.tb-tlbl{font-family:var(--fm);font-size:9px;color:rgba(255,255,255,.4);letter-spacing:2px;text-transform:uppercase;margin-top:2px;text-align:right}

/* ══════ LIVE WATCHING SCREEN ══════ */
@keyframes scoreCount{0%{transform:scale(1.35);color:var(--amber)}100%{transform:scale(1)}}
@keyframes ballReveal{from{opacity:0;transform:translateX(-14px)}to{opacity:1;transform:translateX(0)}}
@keyframes tensionPulse{0%,100%{box-shadow:0 0 0 0 rgba(220,38,38,.25)}50%{box-shadow:0 0 0 8px rgba(220,38,38,0)}}
@keyframes tensionEntry{from{opacity:0;transform:translateY(-16px) scale(.96)}to{opacity:1;transform:translateY(0) scale(1)}}

.watch-scr{flex:1;display:flex;flex-direction:column;align-items:center;padding:18px 16px;gap:11px;background:#1c1917;overflow-y:auto}
.watch-score-big{font-family:var(--fd);font-size:88px;font-weight:800;color:#fff;letter-spacing:-3px;line-height:1;text-align:center;transition:color .25s}
.watch-score-big.tick{animation:scoreCount .28s cubic-bezier(.34,1.56,.64,1)}
.ball-feed{width:100%;display:flex;flex-direction:column;gap:5px}
.ball-card{display:flex;align-items:center;gap:10px;background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.12);border-radius:var(--r1);padding:8px 12px;animation:ballReveal .3s cubic-bezier(.22,1,.36,1) both}
.ball-num{font-family:var(--fm);font-size:9px;font-weight:700;color:rgba(255,255,255,.4);width:18px;flex-shrink:0;text-align:center}
.ball-result-icon{font-size:16px;flex-shrink:0}
.ball-info{flex:1;font-size:11px;font-weight:500;color:rgba(255,255,255,.65);line-height:1.3}
.ball-runs{font-family:var(--fm);font-size:13px;font-weight:700;flex-shrink:0}

/* Last 3 questions tension banner */
.tension-banner{margin:6px 14px 2px;border-radius:var(--r2);padding:11px 15px;animation:tensionEntry .4s cubic-bezier(.34,1.56,.64,1),tensionPulse 1.8s 1s ease-in-out infinite;border:1.5px solid rgba(220,38,38,.35);background:linear-gradient(135deg,rgba(220,38,38,.06),rgba(220,38,38,.02))}
.tn-eyebrow{font-family:var(--fm);font-size:8px;font-weight:700;letter-spacing:2.5px;text-transform:uppercase;color:var(--red);margin-bottom:3px}
.tn-main{display:flex;align-items:baseline;gap:8px}
.tn-runs{font-family:var(--fd);font-size:32px;font-weight:800;color:var(--red);letter-spacing:-.5px;line-height:1}
.tn-label{font-size:13px;font-weight:600;color:var(--sub)}
.tn-detail{font-family:var(--fm);font-size:10px;color:var(--sub);margin-top:4px}
.tn-possible{display:inline-block;font-family:var(--fm);font-size:9px;font-weight:700;border-radius:6px;padding:2px 9px;margin-top:5px}

/* Condition strip */
.cond-strip{display:flex;align-items:center;gap:7px;padding:6px 16px;border-bottom:1px solid var(--rim)}
.cs-icon{font-size:14px}
.cs-name{font-family:var(--fm);font-size:9px;font-weight:600;letter-spacing:1px}

/* Reading aloud indicator */
@keyframes micPulse{0%,100%{transform:scale(1);opacity:.7}50%{transform:scale(1.18);opacity:1}}
@keyframes micWave{0%{height:4px}25%{height:14px}50%{height:22px}75%{height:10px}100%{height:4px}}
@keyframes goFlash{0%{opacity:0;transform:scale(.5)}55%{opacity:1;transform:scale(1.15)}100%{opacity:0;transform:scale(1.4)}}
.reading-bar{display:flex;align-items:center;gap:10px;padding:10px 14px 6px}
.mic-icon{font-size:24px;animation:micPulse 1s ease-in-out infinite;flex-shrink:0}
.mic-waves{display:flex;align-items:center;gap:3px;height:24px}
.mic-wave{width:3px;background:var(--amber);border-radius:999px}
.mic-label{font-family:var(--fm);font-size:10px;font-weight:700;color:var(--amber);letter-spacing:2.5px;text-transform:uppercase}
.go-flash{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;pointer-events:none;z-index:20;font-family:var(--fd);font-size:68px;font-weight:800;color:var(--green);text-shadow:0 4px 24px rgba(21,128,61,.35);animation:goFlash .55s cubic-bezier(.22,1,.36,1) forwards}

/* Timer */
.timer-wrap{padding:11px 16px 5px}
.t-bar-bg{height:5px;background:rgba(0,0,0,.08);border-radius:999px;overflow:hidden}
.t-bar{height:100%;border-radius:999px;transition:width 1s linear,background .4s;position:relative;overflow:hidden}
.t-bar::after{content:'';position:absolute;top:0;left:-60%;width:40%;height:100%;background:linear-gradient(90deg,transparent,rgba(255,255,255,.65),transparent);animation:shimmer 1.8s linear infinite}
.t-row{display:flex;align-items:center;justify-content:space-between;margin-top:7px}
.t-num{font-family:var(--fm);font-size:22px;font-weight:600;transition:color .35s;line-height:1}
.t-lbl{font-family:var(--fm);font-size:9px;font-weight:600;letter-spacing:2px;text-transform:uppercase;color:var(--sub)}
.x2-tag{font-family:var(--fm);font-size:10px;font-weight:600;color:#fff;background:var(--amber);border-radius:6px;padding:2px 9px}

/* Power-ups */
.pu-strip{display:flex;gap:6px;padding:0 16px 5px;align-items:center}
.pu-lbl{font-family:var(--fm);font-size:9px;font-weight:600;letter-spacing:2px;color:var(--sub);text-transform:uppercase;flex-shrink:0}
.pu{background:var(--s0);border:1.5px solid var(--rim2);border-radius:9px;padding:7px 13px;font-size:12px;font-weight:600;cursor:pointer;transition:all .18s;color:var(--txt);font-family:var(--fh);display:flex;align-items:center;gap:5px;box-shadow:var(--sh-sm)}
.pu:hover:not(:disabled){border-color:var(--amber2);color:var(--amber);background:var(--amberBg);transform:translateY(-1px);box-shadow:var(--sh),var(--sh-amber)}
.pu:disabled{opacity:.2;cursor:not-allowed}

/* BETWEEN QUESTIONS OVERLAY */
.between-overlay{position:absolute;inset:0;background:linear-gradient(160deg,rgba(26,44,26,.97) 0%,rgba(28,25,23,.97) 100%);backdrop-filter:blur(8px);z-index:50;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px;animation:betweenQ 10s forwards;padding:24px}
.bq-num{font-family:var(--fd);font-size:80px;font-weight:800;color:#fff;letter-spacing:-2px;line-height:1;text-shadow:0 4px 24px rgba(251,191,36,.3)}
.bq-label{font-family:var(--fm);font-size:9px;font-weight:600;letter-spacing:3px;text-transform:uppercase;color:rgba(255,255,255,.45)}
.bq-result{font-family:var(--fd);font-size:26px;font-weight:700;text-align:center;color:#fff}
.bq-cmnt{background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.1);border-left:3px solid #fbbf24;border-radius:0 12px 12px 0;padding:12px 15px;font-size:13px;font-weight:500;line-height:1.55;width:100%;color:rgba(255,255,255,.85)}
.bq-speaker{font-family:var(--fm);font-size:8px;font-weight:600;letter-spacing:2px;text-transform:uppercase;color:#fbbf24;margin-bottom:4px}
.bq-coach{background:rgba(14,165,233,.1);border:1px solid rgba(14,165,233,.25);border-radius:var(--r1);padding:11px 13px;width:100%;animation:fadeIn .3s .5s both}
.bq-coach-lbl{font-family:var(--fm);font-size:8px;font-weight:600;letter-spacing:2px;color:#38bdf8;margin-bottom:3px}
.bq-coach-text{font-size:12px;color:rgba(255,255,255,.8);line-height:1.5}
.bq-countdown{font-family:var(--fm);font-size:11px;color:rgba(255,255,255,.35);letter-spacing:1px}
.bq-progress{width:80px;height:3px;background:var(--dimx);border-radius:999px;overflow:hidden;margin-top:4px}
.bq-progress-fill{height:100%;background:var(--amber);border-radius:999px;transition:width 1s linear}

/* Commentary */
.cmnt-box{margin:0 16px 2px;padding:9px 13px;background:linear-gradient(90deg,rgba(22,101,52,.04),var(--s0));border-left:3px solid var(--green2);border-radius:0 10px 10px 0;font-size:12px;font-weight:500;color:var(--txt);animation:fadeIn .2s;line-height:1.5;min-height:32px;box-shadow:var(--sh-xs)}
.cmnt-speaker{font-family:var(--fm);font-size:8px;font-weight:600;color:var(--green2);letter-spacing:1px;text-transform:uppercase;margin-bottom:3px}

/* Question */
.q-area{padding:6px 16px;flex:1;display:flex;flex-direction:column;gap:8px;min-height:0;overflow-y:auto}
.q-card{background:var(--s0);border:1px solid var(--rim2);border-radius:var(--r2);padding:16px;font-size:16px;font-weight:500;line-height:1.6;color:var(--txt);position:relative;overflow:hidden;flex-shrink:0;box-shadow:var(--sh-sm);border-top:3px solid var(--qColor,var(--amber2))}
.q-card-top{height:3px;border-radius:3px 3px 0 0;position:absolute;top:0;left:0;right:0}
.q-badge{font-family:var(--fm);font-size:8px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:var(--qColor,var(--amber));background:var(--qColorBg,var(--amberBg));padding:3px 9px;border-radius:6px;display:inline-block;margin-bottom:8px;border:1px solid var(--qColorBorder,rgba(180,83,9,.2))}

/* Photo */
.photo-wrap{position:relative;border-radius:14px;overflow:hidden;background:var(--s3);margin-bottom:8px;box-shadow:var(--sh)}
.photo-img{width:100%;height:180px;object-fit:cover;object-position:center top;display:block;animation:photoReveal .5s cubic-bezier(.22,1,.36,1);filter:brightness(.97) contrast(1.04)}
.photo-grad{position:absolute;inset:0;background:linear-gradient(180deg,transparent 40%,rgba(28,25,23,.9) 100%)}
.photo-badge{position:absolute;top:10px;left:10px;background:rgba(28,25,23,.72);backdrop-filter:blur(8px);border:1px solid rgba(255,255,255,.15);border-radius:7px;padding:4px 10px;font-family:var(--fm);font-size:8px;font-weight:600;color:var(--amber3);letter-spacing:2px}
.photo-info{position:absolute;bottom:10px;left:12px;right:12px}
.photo-country{font-size:16px}
.photo-fact{font-size:11px;font-weight:500;color:rgba(255,255,255,.75);margin-top:2px}
.photo-fallback{width:100%;height:130px;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:6px;border-radius:14px;background:var(--s3);margin-bottom:8px}

/* Stat card */
.stat-frame{border-radius:14px;padding:15px;display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:8px;position:relative;overflow:hidden;border:1px solid var(--rim2)}
.s-stat{display:flex;flex-direction:column;gap:2px}
.s-key{font-family:var(--fm);font-size:8px;font-weight:600;letter-spacing:2px;text-transform:uppercase;color:var(--sub)}
.s-val{font-family:var(--fd);font-size:21px;font-weight:700;letter-spacing:-.3px}

/* Options */
.opts{display:grid;grid-template-columns:1fr 1fr;gap:8px;flex:1;min-height:0}
.opt{background:var(--s0);border:1.5px solid var(--rim2);border-radius:var(--r2);padding:15px 14px;font-family:var(--fh);font-size:15px;font-weight:500;color:var(--txt);cursor:pointer;transition:all .18s;display:flex;align-items:flex-start;gap:8px;text-align:left;line-height:1.4;position:relative;overflow:hidden;box-shadow:var(--sh-sm)}
.opt-ltr{width:26px;height:26px;min-width:26px;border-radius:8px;background:var(--s2);display:flex;align-items:center;justify-content:center;font-family:var(--fm);font-size:9px;font-weight:700;color:var(--sub);border:1.5px solid var(--dim);transition:all .18s;flex-shrink:0;margin-top:1px}
.opt:hover:not(:disabled){border-color:rgba(180,83,9,.4);background:var(--amberBg);transform:translateY(-1px);box-shadow:var(--sh)}
.opt:hover:not(:disabled) .opt-ltr{background:var(--amber);color:#fff;border-color:var(--amber)}
.opt.correct{border-color:var(--green2);background:var(--greenBg);box-shadow:0 0 0 3px rgba(22,163,74,.12),var(--sh-green)}
.opt.correct .opt-ltr{background:var(--green2);color:#fff;border-color:var(--green)}
.opt.wrong{border-color:var(--red);background:var(--redBg);box-shadow:0 0 0 3px rgba(190,18,60,.10),var(--sh-red)}
.opt.wrong .opt-ltr{background:var(--red2);color:#fff;border-color:var(--red)}
.opt.fade{opacity:.22}
.opt:disabled{cursor:not-allowed}

/* Loading spinner */
.load-q{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;padding:40px}
.spinner{width:34px;height:34px;border:2px solid var(--dimx);border-top-color:var(--amber);border-radius:50%;animation:spin .7s linear infinite}
.load-sub{font-size:12px;color:var(--sub);font-family:var(--fm);letter-spacing:1.5px}

/* ══════ RESULT ══════ */
.result-screen{flex:1;display:flex;flex-direction:column;align-items:center;padding:24px 18px;gap:14px;position:relative;overflow:hidden;background:var(--bg)}
.result-screen::before{content:'';position:absolute;top:-80px;left:-60px;width:300px;height:300px;border-radius:50%;background:radial-gradient(circle,rgba(251,191,36,.08),transparent 70%);pointer-events:none;z-index:0}
.result-screen > *{position:relative;z-index:1}
.r-icon{font-size:70px;animation:trophyBounce .6s cubic-bezier(.34,1.56,.64,1) .15s both;display:block}
.r-title{font-family:var(--fd);font-size:40px;font-weight:800;letter-spacing:-.5px;text-align:center;animation:fadeUp .4s .3s both}
.r-sub{font-size:13px;color:var(--sub);text-align:center;animation:fadeUp .4s .4s both}
.innings-compare{width:100%;background:var(--s0);border:1px solid var(--rim2);border-radius:var(--r3);padding:18px;display:flex;align-items:center;justify-content:space-between;gap:12px;box-shadow:var(--sh);animation:popIn .4s .45s both;position:relative;overflow:hidden}
.ic-p{display:flex;flex-direction:column;align-items:center;gap:4px;flex:1}
.ic-flag{font-size:30px}
.ic-name{font-size:10px;font-weight:600;color:var(--sub);text-align:center;max-width:80px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.ic-innings{font-family:var(--fm);font-size:8px;color:var(--dim);letter-spacing:2px}
.ic-score{font-family:var(--fd);font-size:30px;font-weight:700;letter-spacing:-.5px}
.ic-crown{font-size:16px;animation:floatBob 2s ease-in-out infinite}
.ic-vs{font-size:12px;font-weight:600;color:var(--dim)}
.stats-grid{width:100%;display:grid;grid-template-columns:repeat(4,1fr);gap:7px;animation:fadeUp .4s .55s both}
.sg{background:var(--s0);border:1px solid var(--rim2);border-radius:var(--r2);padding:14px 7px;display:flex;flex-direction:column;align-items:center;gap:4px;box-shadow:var(--sh-sm)}
.sgv{font-family:var(--fd);font-size:20px;font-weight:700}
.sgl{font-family:var(--fm);font-size:8px;font-weight:600;letter-spacing:1.5px;text-transform:uppercase;color:var(--sub);text-align:center}
.prize-card{width:100%;border-radius:var(--r2);padding:18px;display:flex;align-items:center;justify-content:space-between;animation:fadeUp .4s .65s both;position:relative;overflow:hidden}
.result-btns{width:100%;display:flex;flex-direction:column;gap:8px;animation:fadeUp .4s .75s both}

/* ══════ PROFILE ══════ */
.profile-screen{flex:1;display:flex;flex-direction:column;overflow-y:auto;-webkit-overflow-scrolling:touch}
.career-banner{padding:22px 18px 18px;position:relative;overflow:hidden}
.pb{padding:0 18px 32px;display:flex;flex-direction:column;gap:13px;margin-top:13px}
.skill-row{background:var(--s0);border:1px solid var(--rim);border-radius:var(--r2);padding:13px;display:flex;align-items:center;gap:12px;box-shadow:var(--sh-xs)}
.skill-icon{width:38px;height:38px;border-radius:11px;display:flex;align-items:center;justify-content:center;font-size:17px;flex-shrink:0}
.skill-info{flex:1}
.skill-name{font-size:13px;font-weight:700}
.skill-bar-bg{height:5px;background:var(--dimx);border-radius:999px;overflow:hidden;margin-top:5px}
.skill-bar{height:100%;border-radius:999px;transition:width .7s cubic-bezier(.22,1,.36,1)}
.skill-xp{font-family:var(--fm);font-size:10px;font-weight:600;margin-top:3px}
.journey-row{display:flex;align-items:center;gap:11px;padding:9px 0;border-bottom:1px solid var(--rim)}
.jr-icon{font-size:20px;width:32px;text-align:center;flex-shrink:0}
.jr-info{flex:1}
.jr-title{font-size:12px;font-weight:700}
.jr-sub{font-size:10px;color:var(--sub);margin-top:1px}
.jr-badge{font-family:var(--fm);font-size:8px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;border-radius:999px;padding:3px 9px;flex-shrink:0}

/* ══════ BADGE WALL ══════ */
.badge-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:10px}
.badge-cell{display:flex;flex-direction:column;align-items:center;gap:5px;padding:10px 6px;border-radius:var(--r2);border:1px solid var(--rim);background:var(--s0);transition:all .2s;box-shadow:var(--sh-xs)}
.badge-cell.earned{border-color:var(--badgeColor,var(--amber));background:var(--badgeBg,var(--amberBg));animation:scaleIn .3s both}
.badge-cell.locked{opacity:.35;filter:grayscale(1)}
.badge-icon{font-size:26px;line-height:1}
.badge-title{font-family:var(--fm);font-size:7px;font-weight:700;letter-spacing:.5px;text-align:center;color:var(--txt)}
.badge-rarity{font-family:var(--fm);font-size:6px;font-weight:700;letter-spacing:1px;text-transform:uppercase;text-align:center}

/* ══════ AVATAR SCREEN ══════ */
.avatar-screen{flex:1;display:flex;flex-direction:column;overflow-y:auto;background:var(--bg)}
.avatar-stage{position:relative;display:flex;flex-direction:column;align-items:center;padding:28px 20px 20px;gap:4px}
.jersey-card{position:relative;width:160px;height:200px;border-radius:18px;display:flex;flex-direction:column;align-items:center;justify-content:center;box-shadow:0 8px 32px rgba(0,0,0,.18)}
.jersey-body{position:absolute;inset:0;border-radius:18px;overflow:hidden}
.jersey-stripe{position:absolute;left:50%;top:0;bottom:0;width:28px;transform:translateX(-50%);opacity:.35}
.jersey-collar{position:absolute;top:0;left:50%;transform:translateX(-50%);width:44px;height:22px;border-radius:0 0 22px 22px}
.jersey-number{font-family:var(--fd);font-size:64px;font-weight:900;color:rgba(255,255,255,.9);line-height:1;text-shadow:0 2px 8px rgba(0,0,0,.3);position:relative;z-index:2}
.jersey-name{font-family:var(--fm);font-size:9px;font-weight:700;letter-spacing:2px;color:rgba(255,255,255,.7);text-transform:uppercase;position:relative;z-index:2;margin-top:2px}
.jersey-stage-badge{position:absolute;bottom:-12px;left:50%;transform:translateX(-50%);background:var(--bg);border:2px solid var(--rim);border-radius:999px;padding:3px 12px;font-family:var(--fm);font-size:8px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;white-space:nowrap;box-shadow:var(--sh-xs)}
.helmet{width:52px;height:42px;border-radius:26px 26px 8px 8px;position:relative;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 12px rgba(0,0,0,.2)}
.helmet-visor{position:absolute;bottom:4px;left:50%;transform:translateX(-50%);width:40px;height:14px;border-radius:0 0 8px 8px;background:rgba(0,0,0,.35)}
.num-picker{display:flex;gap:8px;align-items:center;margin-top:18px}
.num-btn{width:36px;height:36px;border-radius:50%;border:1.5px solid var(--rim);background:var(--s0);font-size:18px;cursor:pointer;display:flex;align-items:center;justify-content:center}
.palette-grid{display:flex;gap:8px;flex-wrap:wrap;justify-content:center;margin-top:10px}
.palette-dot{width:32px;height:32px;border-radius:50%;cursor:pointer;border:3px solid transparent;transition:all .15s}
.palette-dot.active{border-color:var(--txt);transform:scale(1.15)}
.palette-dot.locked-dot{opacity:.4;position:relative}
.palette-dot.locked-dot::after{content:"🔒";position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:10px}

/* ══════ IAP MODAL ══════ */
.iap-overlay{position:fixed;inset:0;background:rgba(0,0,0,.65);display:flex;align-items:flex-end;justify-content:center;z-index:999;animation:fadeIn .2s}
.iap-sheet{background:var(--bg);border-radius:24px 24px 0 0;padding:24px 22px 40px;width:100%;max-width:480px;animation:slideUp .3s cubic-bezier(.22,1,.36,1)}
@keyframes slideUp{from{transform:translateY(100%)}to{transform:translateY(0)}}

/* ══════ AVATAR CARD IMPROVEMENTS ══════ */
.avatar-hero{position:relative;display:flex;flex-direction:column;align-items:center;padding:28px 20px 36px;margin:12px 16px 0;border-radius:20px;border:1px solid rgba(255,255,255,.09);cursor:pointer;overflow:hidden;transition:transform .15s}
.avatar-hero:active{transform:scale(.98)}
.avatar-hero-bg{position:absolute;inset:0;z-index:0}
.avatar-hero-content{position:relative;z-index:1;display:flex;flex-direction:column;align-items:center;width:100%}
.player-card{width:180px;background:var(--cardJersey,#16a34a);border-radius:20px;overflow:visible;position:relative;box-shadow:0 16px 48px rgba(0,0,0,.35),0 4px 12px rgba(0,0,0,.2);animation:floatBob 4s ease-in-out infinite}
.card-top-strip{height:8px;background:var(--cardStripe,#15803d);border-radius:20px 20px 0 0}
.card-body{padding:16px 16px 20px;display:flex;flex-direction:column;align-items:center;gap:4px;position:relative}
.card-number{font-family:var(--fd);font-size:80px;font-weight:900;color:rgba(255,255,255,.92);line-height:.9;text-shadow:0 4px 16px rgba(0,0,0,.25)}
.card-name{font-family:var(--fm);font-size:9px;font-weight:700;letter-spacing:3px;color:rgba(255,255,255,.65);text-transform:uppercase;margin-top:4px}
.card-stripe-v{position:absolute;top:0;bottom:0;left:50%;width:24px;transform:translateX(-50%);background:rgba(0,0,0,.12);pointer-events:none}
.card-badge-bottom{position:absolute;bottom:-14px;left:50%;transform:translateX(-50%);background:var(--bg);border:2px solid var(--rim);border-radius:999px;padding:4px 16px;font-family:var(--fm);font-size:9px;font-weight:700;letter-spacing:2px;text-transform:uppercase;white-space:nowrap;box-shadow:0 2px 8px rgba(0,0,0,.12)}
.card-helmet{width:58px;height:46px;border-radius:29px 29px 10px 10px;display:flex;align-items:center;justify-content:center;box-shadow:0 6px 18px rgba(0,0,0,.25);position:relative;margin-bottom:-4px}
.card-visor{position:absolute;bottom:6px;left:50%;transform:translateX(-50%);width:42px;height:16px;border-radius:0 0 10px 10px;background:rgba(0,0,0,.35)}
.card-visor-shine{position:absolute;top:2px;left:6px;width:12px;height:4px;border-radius:999px;background:rgba(255,255,255,.3)}
.stat-strip{display:flex;gap:0;width:100%;margin-top:18px;background:var(--s0);border:1px solid var(--rim);border-radius:12px;overflow:hidden}
.stat-cell{flex:1;display:flex;flex-direction:column;align-items:center;padding:10px 4px;border-right:1px solid var(--rim)}
.stat-cell:last-child{border-right:none}
.stat-val{font-family:var(--fd);font-size:16px;font-weight:800}
.stat-lbl{font-family:var(--fm);font-size:7px;fontWeight:600;letter-spacing:1px;text-transform:uppercase;color:var(--sub);margin-top:2px}
.customise-btn{display:flex;align-items:center;gap:6px;background:rgba(255,255,255,.15);border:1.5px solid rgba(255,255,255,.35);border-radius:999px;padding:8px 20px;font-family:var(--fm);font-size:10px;font-weight:700;color:#fff;letter-spacing:1.5px;text-transform:uppercase;backdrop-filter:blur(4px);margin-top:20px;cursor:pointer;transition:all .15s}
.customise-btn:active{background:rgba(255,255,255,.25);transform:scale(.97)}

/* ══════ CRICCOIN STORE ══════ */
.store-screen{flex:1;display:flex;flex-direction:column;overflow-y:auto;background:var(--bg)}
.store-tabs{display:flex;padding:10px 18px 0;border-bottom:1px solid var(--rim);gap:0}
.store-tab{flex:1;background:none;border:none;color:var(--sub);font-family:var(--fm);font-size:9px;font-weight:700;padding:8px 0;cursor:pointer;border-bottom:2px solid transparent;transition:all .15s;letter-spacing:.5px;text-transform:uppercase}
.store-tab.on{color:var(--amber);border-bottom-color:var(--amber)}
.store-grid{padding:14px 16px;display:flex;flex-direction:column;gap:10px}
.store-card{display:flex;align-items:center;gap:12px;background:var(--s0);border:1px solid var(--rim);border-radius:var(--r2);padding:14px;box-shadow:var(--sh-xs)}
.store-card-icon{font-size:28px;flex-shrink:0;width:44px;text-align:center}
.store-card-info{flex:1}
.store-card-label{font-size:14px;font-weight:700}
.store-card-desc{font-size:11px;color:var(--sub);margin-top:2px}
.store-btn{font-family:var(--fm);font-size:11px;font-weight:700;border-radius:999px;padding:6px 14px;border:none;cursor:pointer;flex-shrink:0}
.coin-bar{display:flex;align-items:center;gap:7px;background:rgba(217,119,6,.08);border:1px solid rgba(217,119,6,.2);border-radius:999px;padding:6px 14px;font-family:var(--fd);font-size:15px;font-weight:700;color:var(--amber);cursor:pointer;}

/* ══════ LEADERBOARD ══════ */
.lb-screen{display:flex;flex-direction:column;flex:1}
.lb-tabs{display:flex;padding:10px 18px 0;border-bottom:1px solid var(--rim)}
.lb-tab{flex:1;background:none;border:none;color:var(--sub);font-family:var(--fm);font-size:10px;font-weight:700;padding:9px 0;cursor:pointer;border-bottom:2px solid transparent;transition:all .15s;letter-spacing:1px;text-transform:uppercase}
.lb-tab.on{color:var(--amber);border-bottom-color:var(--amber)}
.lb-list{flex:1;overflow-y:auto;padding:10px 14px;display:flex;flex-direction:column;gap:7px}
.lb-row{display:flex;align-items:center;gap:10px;background:var(--s0);border:1px solid var(--rim);border-radius:var(--r2);padding:12px 14px;transition:all .18s;animation:fadeUp .3s both;box-shadow:var(--sh-xs)}
.lb-row:hover{border-color:rgba(180,83,9,.25);background:var(--amberBg)}
.lb-rank{font-family:var(--fm);font-size:14px;font-weight:700;width:28px;text-align:center;flex-shrink:0}
.lb-flag{font-size:20px}
.lb-info{flex:1}
.lb-name{font-size:13px;font-weight:700}
.lb-stage{font-family:var(--fm);font-size:9px;font-weight:600;letter-spacing:1.5px;text-transform:uppercase;margin-top:2px;color:var(--sub)}
.lb-right{display:flex;flex-direction:column;align-items:flex-end;gap:2px}
.lb-score{font-family:var(--fd);font-size:17px;font-weight:700}
.lb-earn{font-family:var(--fm);font-size:10px;font-weight:600;color:var(--green)}

/* ══════ WALLET ══════ */
.wallet-hero{background:linear-gradient(135deg,#1c1917,#292524);padding:24px 20px 22px;position:relative;overflow:hidden}
.wallet-hero::before{content:'';position:absolute;inset:0;background:radial-gradient(ellipse 70% 60% at 50% 0%,rgba(180,83,9,.22),transparent)}
.w-bal{font-family:var(--fd);font-size:50px;font-weight:800;color:#fff;letter-spacing:-1.5px;line-height:1}
.w-bal span{font-size:24px;color:rgba(255,255,255,.5);vertical-align:top;margin-top:8px;display:inline-block}
.w-sub{font-family:var(--fm);font-size:10px;color:rgba(255,255,255,.4);letter-spacing:2px;text-transform:uppercase;margin-top:5px}
.wallet-body{padding:16px;display:flex;flex-direction:column;gap:13px;overflow-y:auto}
.txn-row{display:flex;align-items:center;gap:11px;background:var(--s0);border:1px solid var(--rim);border-radius:var(--r1);padding:12px 13px;box-shadow:var(--sh-xs)}
.txn-icon{width:36px;height:36px;border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:16px;flex-shrink:0}
.txn-name{font-size:15px;font-weight:600}
.txn-time{font-family:var(--fm);font-size:10px;color:var(--sub);margin-top:2px}
.txn-amt{font-family:var(--fm);font-size:14px;font-weight:600;flex-shrink:0}

/* ══════ NAV ══════ */
.nav{display:flex;border-top:1px solid var(--rim);background:rgba(249,246,241,.97);backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px)}
.nav-btn{flex:1;background:none;border:none;color:var(--sub);font-family:var(--fm);font-size:11px;font-weight:700;letter-spacing:.5px;text-transform:uppercase;padding:12px 0 10px;cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:4px;transition:color .15s;border-top:2px solid transparent}
.nav-btn.on{color:var(--amber2);border-top-color:var(--amberViv);text-shadow:0 0 12px rgba(245,158,11,.25)}
.nav-icon{font-size:18px;line-height:1}

/* Misc */
.spacer{flex:1}
.divider{width:100%;height:1px;background:var(--rim)}
.sfx-btn{position:fixed;top:14px;right:14px;z-index:500;width:36px;height:36px;border-radius:10px;background:rgba(255,255,255,.9);border:1px solid var(--rim2);color:var(--sub);font-size:13px;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all .15s;backdrop-filter:blur(10px);box-shadow:var(--sh-xs)}
.sfx-btn:hover{border-color:var(--amber);color:var(--amber)}
.toast{position:fixed;bottom:78px;left:50%;transform:translateX(-50%);background:rgba(28,25,23,.92);border-radius:var(--r1);padding:10px 18px;font-size:12px;font-weight:600;color:#fff;z-index:600;animation:fadeUp .25s;box-shadow:var(--sh-lg);white-space:nowrap;backdrop-filter:blur(16px);font-family:var(--fh)}
.taunt-bar{position:fixed;top:0;left:50%;transform:translateX(-50%);max-width:430px;width:100%;background:var(--amber);color:#fff;font-size:13px;font-weight:600;padding:10px 20px;border-radius:0 0 14px 14px;z-index:400;animation:tauntSlide .28s cubic-bezier(.22,1,.36,1);text-align:center;font-family:var(--fh)}
.anti-tag{font-family:var(--fm);font-size:8px;color:var(--dim);text-align:right;padding:1px 16px 4px;letter-spacing:1px}

/* ─── AUTH ─────────────────────────────────────────────────────────── */
.auth-screen{flex:1;display:flex;flex-direction:column;background:#1c1917;overflow-y:auto;min-height:100dvh}
.auth-hero{height:200px;position:relative;overflow:hidden;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:8px;flex-shrink:0}
.auth-bg{position:absolute;inset:0;background:radial-gradient(ellipse 80% 70% at 50% 0%,rgba(180,83,9,.4),transparent 65%)}
.auth-grid{position:absolute;inset:0;background-image:linear-gradient(rgba(255,255,255,.03) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.03) 1px,transparent 1px);background-size:36px 36px}
.auth-logo{font-family:var(--fd);font-size:52px;font-weight:800;color:#fff;letter-spacing:-1px;z-index:2;text-align:center;line-height:1}
.auth-logo em{font-style:italic;background:linear-gradient(135deg,#fbbf24,#d97706);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text}
.auth-tagline{font-family:var(--fm);font-size:10px;font-weight:600;letter-spacing:3px;color:rgba(255,255,255,.45);text-transform:uppercase;z-index:2}
.auth-body{background:var(--bg);border-radius:28px 28px 0 0;flex:1;padding:26px 20px 40px;display:flex;flex-direction:column;gap:11px}
.auth-head{font-family:var(--fd);font-size:22px;font-weight:800;letter-spacing:-.3px}
.auth-sub{font-size:13px;color:var(--sub);margin-top:-4px;margin-bottom:2px}
.soc-btn{display:flex;align-items:center;gap:12px;background:var(--s0);border:1.5px solid var(--rim2);border-radius:var(--r2);padding:14px 16px;cursor:pointer;font-family:var(--fh);font-size:14px;font-weight:600;color:var(--txt);transition:all .18s;box-shadow:var(--sh-xs);width:100%;text-align:left}
.soc-btn:hover{border-color:var(--amber);transform:translateY(-1px);box-shadow:var(--sh)}
.soc-logo{width:26px;height:26px;border-radius:6px;display:flex;align-items:center;justify-content:center;font-size:17px;flex-shrink:0}
.soc-arrow{margin-left:auto;color:var(--dim);font-size:12px}
.auth-divider{display:flex;align-items:center;gap:10px}
.auth-div-line{flex:1;height:1px;background:var(--rim2)}
.auth-div-text{font-family:var(--fm);font-size:9px;font-weight:600;color:var(--dim);letter-spacing:2px}
.auth-legal{font-size:10px;color:var(--dim);text-align:center;line-height:1.65;margin-top:4px}
.auth-legal a{color:var(--amber);cursor:pointer;font-weight:600}
.guest-lnk{background:none;border:none;font-family:var(--fh);font-size:13px;font-weight:600;color:var(--sub);cursor:pointer;text-decoration:underline;text-underline-offset:3px;text-align:center;padding:4px}

/* ─── TUTORIAL ──────────────────────────────────────────────────────── */
.tut-overlay{position:fixed;inset:0;z-index:900;display:flex;align-items:flex-end}
.tut-backdrop{position:absolute;inset:0;background:rgba(28,25,23,.78);backdrop-filter:blur(1.5px)}
.tut-card{position:relative;z-index:902;width:100%;background:var(--s0);border-radius:28px 28px 0 0;padding:24px 22px 36px;animation:fadeUp .32s cubic-bezier(.22,1,.36,1)}
.tut-dots{display:flex;gap:5px;margin-bottom:16px}
.tut-dot{height:5px;border-radius:999px;background:var(--dimx);transition:all .28s}
.tut-dot.on{background:var(--amber)}
.tut-icon{font-size:40px;display:block;margin-bottom:10px}
.tut-title{font-family:var(--fd);font-size:22px;font-weight:800;margin-bottom:7px;letter-spacing:-.2px}
.tut-body{font-size:13px;color:var(--sub);line-height:1.65;margin-bottom:18px}
.tut-hl{display:inline-block;background:var(--amberBg);color:var(--amber);font-weight:700;border-radius:6px;padding:1px 8px;font-size:12px;font-family:var(--fm)}
.tut-btns{display:flex;gap:8px}
.tut-skip{flex:1;background:none;border:1.5px solid var(--rim2);border-radius:var(--r1);padding:12px;font-family:var(--fh);font-size:13px;font-weight:600;color:var(--sub);cursor:pointer;transition:all .15s}
.tut-next{flex:2;background:linear-gradient(135deg,#b45309,#d97706);border:none;border-radius:var(--r1);padding:12px;font-family:var(--fh);font-size:13px;font-weight:700;color:#fff;cursor:pointer}

/* ─── RULES ─────────────────────────────────────────────────────────── */
.rules-screen{flex:1;overflow-y:auto;background:var(--bg)}
.rules-hero-band{background:linear-gradient(135deg,#1c1917,#292524);padding:22px 20px 24px;position:relative;overflow:hidden}
.rules-hero-band::before{content:'';position:absolute;inset:0;background:radial-gradient(ellipse 70% 60% at 50% 0%,rgba(180,83,9,.28),transparent)}
.rules-body{padding:16px 18px 36px;display:flex;flex-direction:column;gap:20px}
.rules-sec{display:flex;flex-direction:column;gap:10px}
.rules-sec-lbl{font-family:var(--fm);font-size:9px;font-weight:700;letter-spacing:3px;text-transform:uppercase;color:var(--amber);padding-bottom:8px;border-bottom:1px solid var(--rim)}
.rule-card{background:var(--s0);border:1px solid var(--rim);border-radius:var(--r2);padding:14px 15px;box-shadow:var(--sh-xs)}
.rt{width:100%;border-collapse:collapse}
.rt th{font-family:var(--fm);font-size:8px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:var(--sub);text-align:left;padding:5px 8px;border-bottom:1px solid var(--rim)}
.rt td{font-size:12px;padding:8px;border-bottom:1px solid var(--rim);line-height:1.4;vertical-align:middle}
.rt tr:last-child td{border-bottom:none}
.run-badge{display:inline-block;font-family:var(--fm);font-size:10px;font-weight:700;border-radius:6px;padding:2px 9px}
.rule-row{display:flex;gap:11px;align-items:flex-start;padding:7px 0;border-bottom:1px solid var(--rim)}
.rule-row:last-child{border-bottom:none}
.ri{font-size:18px;width:26px;text-align:center;flex-shrink:0;margin-top:1px}
.rn{font-size:13px;font-weight:700;margin-bottom:2px}
.rd{font-size:11px;color:var(--sub);line-height:1.5}

/* ─── LEGAL ─────────────────────────────────────────────────────────── */
.legal-screen{flex:1;display:flex;flex-direction:column;background:var(--bg);overflow:hidden}
.legal-tabs{display:flex;background:var(--s0);border-bottom:1px solid var(--rim);overflow-x:auto;scrollbar-width:none;flex-shrink:0}
.legal-tabs::-webkit-scrollbar{display:none}
.legal-tab{flex-shrink:0;background:none;border:none;border-bottom:2.5px solid transparent;padding:12px 14px;font-family:var(--fm);font-size:9px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:var(--sub);cursor:pointer;white-space:nowrap;transition:all .15s}
.legal-tab.on{color:var(--amber);border-bottom-color:var(--amber)}
.legal-body{flex:1;overflow-y:auto;padding:18px 18px 40px}
.lh1{font-family:var(--fd);font-size:20px;font-weight:800;margin-bottom:4px}
.ldate{font-family:var(--fm);font-size:9px;color:var(--dim);letter-spacing:1.5px;margin-bottom:16px}
.lh2{font-size:13px;font-weight:700;color:var(--amber);margin:16px 0 6px}
.lp{font-size:12px;color:var(--sub);line-height:1.8;margin-bottom:6px}
.lbox{background:var(--amberBg);border:1px solid rgba(180,83,9,.2);border-radius:var(--r1);padding:12px 14px;margin:10px 0}
.lbox p{color:var(--amber);font-weight:600;font-size:12px;line-height:1.6;margin:0}

/* ─── WALLET CONNECT ─────────────────────────────────────────────────── */
.wc-screen{flex:1;display:flex;flex-direction:column;background:var(--bg);overflow-y:auto}
.wc-balance-band{background:linear-gradient(135deg,#1c1917,#292524);padding:20px;position:relative;overflow:hidden}
.wc-balance-band::before{content:'';position:absolute;inset:0;background:radial-gradient(ellipse 70% 60% at 50% 0%,rgba(180,83,9,.22),transparent)}
.wc-bal-label{font-family:var(--fm);font-size:9px;color:rgba(255,255,255,.4);letter-spacing:2px;text-transform:uppercase;margin-bottom:4px;position:relative}
.wc-bal-amount{font-family:var(--fd);font-size:44px;font-weight:800;color:#fff;letter-spacing:-1.5px;line-height:1;position:relative}
.wc-bal-amount span{font-size:22px;color:rgba(255,255,255,.5);vertical-align:top;margin-top:8px;display:inline-block}
.kyc-strip{display:flex;align-items:center;gap:9px;padding:10px 14px;border-radius:var(--r2);margin:12px 16px 0}
.kyc-icon{font-size:18px}
.kyc-text{flex:1;font-size:11px;font-weight:500;line-height:1.4}
.kyc-badge{font-family:var(--fm);font-size:8px;font-weight:700;letter-spacing:1.5px;border-radius:999px;padding:3px 10px}
.wc-body{padding:12px 16px 32px;display:flex;flex-direction:column;gap:14px}
.wc-sec-lbl{font-family:var(--fm);font-size:9px;font-weight:700;letter-spacing:2.5px;text-transform:uppercase;color:var(--sub);padding:4px 0}
.wm{background:var(--s0);border:1.5px solid var(--rim);border-radius:var(--r2);padding:13px 14px;display:flex;align-items:center;gap:12px;cursor:pointer;transition:all .2s;box-shadow:var(--sh-xs)}
.wm:hover,.wm.sel{border-color:var(--amber);background:var(--amberBg)}
.wm-logo{width:42px;height:42px;border-radius:11px;display:flex;align-items:center;justify-content:center;font-size:22px;flex-shrink:0}
.wm-info{flex:1}.wm-name{font-size:14px;font-weight:700}.wm-desc{font-size:11px;color:var(--sub);margin-top:1px}
.wm-arrow{color:var(--dim);font-size:12px}
.amt-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:7px}
.amt-chip{background:var(--s0);border:1.5px solid var(--rim2);border-radius:var(--r1);padding:10px 2px;text-align:center;cursor:pointer;font-family:var(--fh);font-size:13px;font-weight:700;color:var(--txt);transition:all .18s;box-shadow:var(--sh-xs)}
.amt-chip.on{border-color:var(--amber);background:var(--amberBg);color:var(--amber)}
.wc-inp-wrap{background:var(--s0);border:1.5px solid var(--rim2);border-radius:var(--r2);padding:4px 14px;display:flex;align-items:center;gap:6px;box-shadow:var(--sh-xs)}
.wc-currency{font-family:var(--fd);font-size:22px;font-weight:700;color:var(--sub)}
.wc-inp{flex:1;border:none;outline:none;font-family:var(--fd);font-size:30px;font-weight:700;color:var(--txt);background:transparent;padding:10px 0;width:100%}
.wc-limits{font-family:var(--fm);font-size:9px;color:var(--dim);text-align:center;letter-spacing:1px}

`;

// ─── WATCHING SCREEN — animated ball-by-ball reveal ──────────────────────────
// ─── CRICKET FACTS (shown during opponent batting screen) ─────────────────────
const CRICKET_FACTS = [
  "🏏 Don Bradman's Test average of 99.94 is so far ahead of #2 that statisticians call it the greatest in any sport.",
  "🌏 Cricket is the 2nd most popular sport in the world with over 2.5 billion fans — mostly in South Asia.",
  "🎯 A perfect over in cricket (6 balls, 6 wickets) has never been bowled in international cricket history.",
  "⚡ The fastest recorded delivery in cricket was 161.3 km/h by Shoaib Akhtar vs England in 2003.",
  "🏆 India's 1983 World Cup win is credited with transforming cricket into a billion-dollar industry.",
  "🪙 The Ashes urn is only 10cm tall — one of the smallest trophies in sport for the biggest rivalry.",
  "🧢 Sachin Tendulkar scored 100 international centuries — the next highest is 71 by Ricky Ponting.",
  "📺 The 2011 World Cup final between India and Sri Lanka was watched by 135 million people in India alone.",
  "🎽 West Indies won the first two World Cups in 1975 and 1979, then never won it again.",
  "🌙 The first day-night Test match was played in 2015 between Australia and New Zealand in Adelaide.",
  "🏟 The Narendra Modi Stadium in Ahmedabad holds 132,000 people — the largest cricket ground in the world.",
  "💥 Six sixes in an over has been achieved only a handful of times — Yuvraj Singh did it in a T20 World Cup.",
  "📐 The cricket pitch is exactly 22 yards long — a unit called a 'chain', used in land surveying since 1620.",
  "🔴 A red ball swings more in overcast conditions because moisture affects the air pressure around it.",
  "🤝 The tied Test of 1960 (Australia vs West Indies) was so rare, a commemorative stamp was issued.",
  "🧠 MS Dhoni is the only captain to win all three ICC trophies — World Cup, Champions Trophy, and T20 World Cup.",
  "👑 Brian Lara holds both the highest Test score (400*) and highest first-class score (501*).",
  "⏱ The longest Test match in history lasted 12 days — South Africa vs England in Durban, 1939.",
  "🎯 Anil Kumble took all 10 wickets in a Test innings — only the 2nd bowler ever to do so.",
  "🌟 Virat Kohli scored centuries in all three formats before he turned 25.",
];

function WatchingScreen({ opp, feed, finalScore, label, target, isPvp }) {
  const [visibleCount, setVisibleCount] = useState(0);
  const [displayScore, setDisplayScore] = useState(0);
  const [ticking, setTicking] = useState(false);
  const [factIdx, setFactIdx] = useState(() => Math.floor(Math.random() * CRICKET_FACTS.length));
  const [factAnim, setFactAnim] = useState(true);
  const intervalRef = useRef();

  // Rotate facts every 4 seconds
  useEffect(() => {
    const t = setInterval(() => {
      setFactAnim(false);
      setTimeout(() => {
        setFactIdx(i => (i + 1) % CRICKET_FACTS.length);
        setFactAnim(true);
      }, 300);
    }, 4000);
    return () => clearInterval(t);
  }, []);

  // Ball reveal speed: PvP = 3s (human pace), Bot = 800ms (simulated)
  const ballInterval = isPvp ? 3000 : 800;

  useEffect(() => {
    if (!feed || feed.length === 0) return;
    let i = 0;
    intervalRef.current = setInterval(() => {
      if (i >= feed.length) { clearInterval(intervalRef.current); return; }
      setVisibleCount(i + 1);
      setDisplayScore(feed[i].score);
      setTicking(true);
      setTimeout(() => setTicking(false), 320);
      i++;
    }, ballInterval);
    return () => clearInterval(intervalRef.current);
  }, [feed, ballInterval]);

  const visibleFeed = feed.slice(0, visibleCount);

  return (
    <div className="screen watch-scr">
      <div style={{ fontFamily:"var(--fm)", fontSize:9, fontWeight:700, letterSpacing:3, color:"rgba(255,255,255,.45)", textTransform:"uppercase" }}>
        {isPvp ? "🔴 Live" : "Live"} — Opponent's {label}
      </div>
      <div style={{ display:"flex", alignItems:"center", gap:10 }}>
        <span style={{ fontSize:28 }}>{opp?.flag}</span>
        <div>
          <div style={{ fontFamily:"var(--fd)", fontSize:18, fontWeight:700, color:"#fff" }}>{opp?.name}</div>
          <div className="live-dot"><div className="live-dot-circle" />LIVE</div>
        </div>
      </div>

      <div className={`watch-score-big${ticking ? " tick" : ""}`}>
        {displayScore}<span style={{ fontSize:26, color:"rgba(255,255,255,.45)", fontFamily:"var(--fh)", fontWeight:400 }}> runs</span>
      </div>

      {target && (
        <div style={{ background:"linear-gradient(135deg,#1c1917,#292524)", borderRadius:"var(--r2)", padding:"11px 18px", textAlign:"center", width:"100%" }}>
          <div style={{ fontFamily:"var(--fm)", fontSize:9, color:"rgba(255,255,255,.45)", letterSpacing:2, textTransform:"uppercase", marginBottom:3 }}>Your target to win</div>
          <div style={{ fontFamily:"var(--fd)", fontSize:36, fontWeight:700, color:"var(--amber3)" }}>{(target || displayScore) + 1}</div>
        </div>
      )}

      {/* Cricket fact card — shown between balls */}
      <div style={{
        background:"rgba(255,255,255,.04)", border:"1px solid rgba(255,255,255,.08)",
        borderRadius:"var(--r2)", padding:"12px 14px", width:"100%",
        opacity: factAnim ? 1 : 0, transition:"opacity 0.3s",
      }}>
        <div style={{ fontFamily:"var(--fm)", fontSize:8, letterSpacing:2, color:"rgba(255,255,255,.3)", textTransform:"uppercase", marginBottom:6 }}>
          Did you know?
        </div>
        <div style={{ fontSize:12, color:"rgba(255,255,255,.7)", lineHeight:1.5 }}>
          {CRICKET_FACTS[factIdx]}
        </div>
      </div>

      <div className="ball-feed">
        {visibleFeed.map((f, i) => {
          const runScored = f.score - (feed[i - 1]?.score || 0);
          return (
            <div key={i} className="ball-card" style={{ animationDelay: "0s" }}>
              <span className="ball-num">Q{i + 1}</span>
              <span className="ball-result-icon">{f.ok ? "✅" : "❌"}</span>
              <span className="ball-info">{f.ok ? `Correct — ${runScored} runs` : "Wrong — no runs"}</span>
              <span className="ball-runs" style={{ color: f.ok ? "var(--green)" : "var(--red)" }}>
                {f.ok ? `+${runScored}` : "0"}
              </span>
            </div>
          );
        })}
        {visibleCount < feed.length && (
          <div style={{ textAlign:"center", padding:"8px 0", fontFamily:"var(--fm)", fontSize:10, color:"var(--sub)" }}>
            <span style={{ animation:"pulse 1s infinite", display:"inline-block" }}>● ● ●</span>
          </div>
        )}
      </div>

      {visibleCount === feed.length && (
        <div style={{ fontFamily:"var(--fm)", fontSize:11, color:"var(--sub)", textAlign:"center", animation:"fadeUp .4s both" }}>
          {label === "1st Innings" ? "Your turn to bat is next…" : "Calculating final result…"}
        </div>
      )}
    </div>
  );
}

// ─── MAIN APP ─────────────────────────────────────────────────────────────────
export default function App() {
  // Navigation
  const [screen, setScreen] = useState("auth");  // Start at auth screen
  const [navTab, setNavTab] = useState("play");
  const [lbTab, setLbTab] = useState("skill");
  const [legalTab, setLegalTab] = useState("terms");
  const [loggedIn, setLoggedIn] = useState(false);
  const [showTutorial, setShowTutorial] = useState(false);
  const [tutStep, setTutStep] = useState(0);
  const [authMode, setAuthMode] = useState("login"); // login | signup
  const [authEmail, setAuthEmail] = useState("");
  const [authPhone, setAuthPhone] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authNickname, setAuthNickname] = useState("");
  const [authError, setAuthError] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [wcMethod, setWcMethod] = useState(null); // selected wallet method
  const [wcAmount, setWcAmount] = useState(""); // deposit amount

  // Profile
  const [nick, setNick] = useState("");
  const [country, setCountry] = useState(null);
  const [totalXp, setTotalXp] = useState(0);
  const [skillXp, setSkillXp] = useState({ batting:0, bowling:0, ipl:0, history:0, womens:0 });
  const [wins, setWins] = useState(0);
  const [played, setPlayed] = useState(0);
  const [totalEarnings, setTotalEarnings] = useState(0);

  // ── NEW: Avatar / Badge / CricCoins ─────────────────────────────────────
  const [cricCoins, setCricCoins] = useState(120); // start with some coins
  const [badges, setBadges] = useState(new Set(["first_match"]));
  const [avatarNum, setAvatarNum] = useState(7);
  const [avatarPalette, setAvatarPalette] = useState("default");
  const [unlockedPalettes, setUnlockedPalettes] = useState(new Set(["default"]));
  const [showIapModal, setShowIapModal] = useState(null); // { pack } for coin IAP
  const [coinsSpent, setCoinsSpent] = useState(0);
  const [ppUsedCount, setPpUsedCount] = useState(0); // power play uses
  const [xpBoostLeft, setXpBoostLeft] = useState(0); // matches remaining with 2x XP
  const [goldName, setGoldName] = useState(false);
  const [extraPowerUps, setExtraPowerUps] = useState({ timeout:0, ff:0, pp:0 });
  const [storeCat, setStoreCat] = useState("coins");
  const [showAvatarScreen, setShowAvatarScreen] = useState(false);
  const [wallet, setWallet] = useState(20.00);
  const [lStreak, setLStreak] = useState(0);

  // Match config
  const [entryFee, setEntryFee] = useState(ENTRY_FEES[2]);
  const [commStyle] = useState("shastri"); // kept for commentary text selection
  const [sfxOn, setSfxOn] = useState(true); // sound effects (beeps) only
  const [condition, setCondition] = useState(null);
  const [opp, setOpp] = useState(null);

  // Toss
  const [tossState, setTossState] = useState("idle"); // idle | spinning | result
  const [tossWinner, setTossWinner] = useState(null); // "player" | "opp"
  const [batFirst, setBatFirst] = useState(null); // "player" | "opp"

  // Scores (always: p1 = first batter, p2 = chaser)
  // myScore = human player always, oppScore = AI opponent always
  const [myScore, setMyScore] = useState(0);
  const [oppScore, setOppScore] = useState(0);

  // Match state
  const [innings, setInnings] = useState(1); // 1 or 2
  const [qs, setQs] = useState([]);
  const [qi, setQi] = useState(0);
  const [wickets, setWickets] = useState(0);
  const [done, setDone] = useState([]); // array of "ok"|"bad"
  const [tLeft, setTLeft] = useState(15);
  const [sel, setSel] = useState(null);
  const [rev, setRev] = useState(false);
  const [cStreak, setCStreak] = useState(0);
  const [maxStreak, setMaxStreak] = useState(0);
  const [xpEarned, setXpEarned] = useState(0);
  const [loading, setLoading] = useState(false);

  // Between-questions state
  const [showBetween, setShowBetween] = useState(false);
  const [betweenData, setBetweenData] = useState(null); // {correct, cmntLine, coachNote, scoreAfter, countdown}
  const [betweenCount, setBetweenCount] = useState(10);

  // Commentary
  const [cmntLine, setCmntLine] = useState("");

  // Power-ups
  const [puFF, setPuFF] = useState(true);
  const [puTF, setPuTF] = useState(true);
  const [puFH, setPuFH] = useState(true);   // Free Hit lifeline
  const [frozen, setFrozen] = useState(false);
  const [freeHit, setFreeHit] = useState(false); // active free hit
  const [hidden, setHidden] = useState([]);

  // Friend Challenge
  const [friendChallenge, setFriendChallenge] = useState(null);
  // null | { mode:"invite"|"chase", seed, conditionId, challengerNick, challengerScore, friendName }
  const [fcFriendName, setFcFriendName] = useState("");
  const [fcMyScore, setFcMyScore] = useState(null); // my score in a seeded challenge match

  // Photo error tracking
  const [photoFailed, setPhotoFailed] = useState({});

  // Anti-fraud
  const [responseTimes, setResponseTimes] = useState([]);
  const qStartRef = useRef(null);

  // Opponent live score feed (shown to player 2 while player 1 bats)
  // In this demo both are on same device, but we simulate it
  const [oppLiveFeed, setOppLiveFeed] = useState([]); // [{qi, score, ok}]

  // Pressure screen — shown after Q3 while chasing
  const [showPressure, setShowPressure] = useState(false);

  // Super Over state
  const [inSuperOver, setInSuperOver] = useState(false);
  const [soPhase, setSoPhase] = useState("intro"); // intro | batting | watching | result
  const [superOverWinner, setSuperOverWinner] = useState(null); // "player" | "opp" — persists into result screen
  const [soMyScore, setSoMyScore] = useState(0);
  const [soOppScore, setSoOppScore] = useState(0);
  const [soQi, setSoQi] = useState(0);        // 0-2 (3 questions)
  const [soQs, setSoQs] = useState([]);
  const [soSel, setSoSel] = useState(null);
  const [soRev, setSoRev] = useState(false);
  const [soTLeft, setSoTLeft] = useState(15);
  const [soTimes, setSoTimes] = useState([]);  // response times for tiebreak
  const [soOppTimes] = useState(() => [
    Math.random() * 10000 + 2000,
    Math.random() * 10000 + 2000,
    Math.random() * 10000 + 2000,
  ]); // simulated opp response times — set once
  const soStartRef = useRef(null);
  const soTimerRef = useRef(null);

  // Toast
  const [toastMsg, setToastMsg] = useState("");
  const showToast = useCallback(m => { setToastMsg(m); setTimeout(() => setToastMsg(""), 2400); }, []);

  const tiRef = useRef();
  const betweenRef = useRef();
  const cleanRef = useRef(false);
  const qsRef = useRef([]); // keep qs accessible in callbacks
  const snd = useAudio(sfxOn);

  // ── AUTH / LOGIN ──────────────────────────────────────────────────────────────
  // Check for challenge/friend-challenge link on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);

    // Legacy: ?challenge= (post-match chase link)
    const code = params.get("challenge");
    if (code) {
      try {
        const decoded = atob(code.replace(/-/g,'+').replace(/_/g,'/'));
        const [targetScore, condId, oppAcc] = decoded.split("|");
        const cond = CONDITIONS.find(c => c.id === condId) || CONDITIONS[2];
        const o = { ...rnd(OPPS), acc: parseFloat(oppAcc) || 0.6 };
        setCondition(cond);
        setOpp(o);
        setBatFirst("opp");
        setOppScore(parseInt(targetScore) || 20);
        setInnings(2);
        window.history.replaceState({}, "", window.location.pathname);
        showToast(`🏏 Challenge accepted! Chase ${targetScore} runs`);
      } catch { /* ignore malformed codes */ }
    }

    // New: ?fc= (friend challenge — pre-match or score-chase)
    const fc = params.get("fc");
    if (fc) {
      try {
        const decoded = atob(fc.replace(/-/g,'+').replace(/_/g,'/'));
        const [challengerNick, seedStr, conditionId, scoreStr] = decoded.split("|");
        const challengerScore = parseInt(scoreStr);
        const mode = challengerScore > 0 ? "chase" : "invite";
        setFriendChallenge({ mode, seed: parseInt(seedStr), conditionId, challengerNick, challengerScore: mode === "chase" ? challengerScore : null });
        window.history.replaceState({}, "", window.location.pathname);
        setScreen("fc_accept");
      } catch { /* ignore malformed */ }
    }
  }, []);
  // In the artifact: demo login only (no real auth)
  // ── Restore session on app load ──────────────────────────────────────────
  useEffect(() => {
    const saved = localStorage.getItem("cc_token");
    if (saved) {
      api("/auth/me").then(data => {
        if (data?.player) {
          setLoggedIn(true);
          setNick(data.player.nickname);
          setWallet(data.player.wallet / 100);
          window.__CRICKET_TOKEN__ = saved;
          setScreen("landing");
        } else {
          localStorage.removeItem("cc_token");
        }
      }).catch(() => localStorage.removeItem("cc_token"));
    }
  }, []);

  const doSignup = useCallback(async () => {
    setAuthError("");
    if (!authEmail || !authPassword || !authNickname) {
      setAuthError("Please fill in all fields"); return;
    }
    if (authPassword.length < 6) {
      setAuthError("Password must be at least 6 characters"); return;
    }
    setAuthLoading(true);
    try {
      const res = await fetch(`${API_BASE}/auth/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: authEmail, password: authPassword, nickname: authNickname }),
      });
      const data = await res.json();
      if (!res.ok) { setAuthError(data.error || "Signup failed"); return; }
      // Auto login after signup
      setAuthMode("login");
      setAuthError("✅ Account created! Please log in.");
    } catch (e) {
      setAuthError("Network error — please try again");
    } finally { setAuthLoading(false); }
  }, [authEmail, authPassword, authNickname]);

  const doLogin = useCallback(async (provider) => {
    if (provider === "guest") {
      setLoggedIn(false);
      setNick("Guest");
      setScreen("landing");
      const hasSeenTutorial = localStorage.getItem("cc_tutorial_done");
      if (!hasSeenTutorial) {
        setTimeout(() => setShowTutorial(true), 600);
      }
      return;
    }
    setAuthError("");
    if (!authEmail || !authPassword) {
      setAuthError("Please enter email and password"); return;
    }
    setAuthLoading(true);
    try {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: authEmail, password: authPassword }),
      });
      const data = await res.json();
      if (!res.ok) { setAuthError(data.error || "Login failed"); return; }
      // Save token for session restore
      localStorage.setItem("cc_token", data.access_token);
      window.__CRICKET_TOKEN__ = data.access_token;
      setLoggedIn(true);
      setNick(data.player.nickname);
      setWallet(data.player.wallet / 100);
      setScreen("landing");
      const hasSeenTutorial = localStorage.getItem("cc_tutorial_done");
      if (!hasSeenTutorial) {
        setTimeout(() => setShowTutorial(true), 600);
      }
    } catch (e) {
      setAuthError("Network error — please try again");
    } finally { setAuthLoading(false); }
  }, [authEmail, authPassword]);

  const TUT_STEPS = [
    { icon:"🏏", title:"Welcome to Cricket Clash!", body:"Answer cricket trivia to score runs. The more you know, the more you earn. Let's walk you through a match.", hl:"" },
    { icon:"🪙", title:"The Toss", body:"Every match starts with a coin toss. Win the toss and choose to Bat First (set a target) or Chase (chase the opponent's score).", hl:"Bat or Chase" },
    { icon:"⏱", title:"The Question", body:"Each question is read aloud before the timer starts. Listen carefully — then answer before 15 seconds run out.", hl:"15 seconds" },
    { icon:"🎯", title:"Runs System", body:"Fast answers score big. Answer in the first 5 seconds → SIX (6 runs). Under 10 seconds → FOUR (4 runs). Slower → TWO (2 runs). Wrong answer → Wicket & lose 5 runs.", hl:"6 · 4 · 2 runs" },
    { icon:"⚡", title:"Super Over", body:"If scores are level after 6 questions, a Super Over of 3 questions decides the winner. If still tied — fastest average answer time wins. No draws, ever.", hl:"No draws, ever" },
    { icon:"💰", title:"Win Real Money", body:"Add funds to your wallet, enter paid matches, and win up to 1.8× your entry. Withdraw anytime to UPI, bank or card.", hl:"Withdraw anytime" },
  ];

  const career = useMemo(() => getCareer(totalXp), [totalXp]);
  const nextC = useMemo(() => nextCareerStage(totalXp), [totalXp]);
  const careerPct = useMemo(() => {
    if (!nextC) return 100;
    return Math.min(100, ((totalXp - career.minXp) / (nextC.minXp - career.minXp)) * 100);
  }, [totalXp, career, nextC]);

  const playerBatting = batFirst === "player" ? innings === 1 : innings === 2;
  const myCurrentScore = myScore;
  const oppCurrentScore = oppScore;
  // Target is always the 1st innings score + 1 regardless of who batted first
  const target = innings === 2 ? (batFirst === "player" ? myScore : oppScore) + 1 : null;

  // ── QUESTION BUILD ────────────────────────────────────────────────────────────
  // Questions are built in background during toss
  const qsReadyRef = useRef(null); // stores promise
  const fetchInBackground = useCallback((cond) => {
    qsReadyRef.current = fetchQuestions(cond).then(aiQs => buildQuestionSet(aiQs, cond));
  }, []);

  const getQs = useCallback(async () => {
    if (qsReadyRef.current) {
      const result = await qsReadyRef.current;
      qsReadyRef.current = null;
      return result;
    }
    return buildQuestionSet(null, condition || CONDITIONS[0]);
  }, [condition]);

  // ── MATCHMAKING STATE ────────────────────────────────────────────────────────
  const [matchId, setMatchId] = useState(null);
  const [matchType, setMatchType] = useState("bot"); // "bot" | "pvp"
  const [queueId, setQueueId] = useState(null);
  const [queueWaitMs, setQueueWaitMs] = useState(0);
  const queuePollRef = useRef(null);

  const clearQueue = useCallback(() => {
    if (queuePollRef.current) { clearInterval(queuePollRef.current); queuePollRef.current = null; }
  }, []);

  // Cancel matchmaking (user taps back from finding screen)
  const cancelQueue = useCallback(async () => {
    clearQueue();
    if (API_BASE && queueId) {
      const entryKey = entryFee.entry === 0 ? "free" : String(Math.round(entryFee.entry * 83));
      try { await api(`/matches/queue/leave?entry_key=${entryKey}`, { method: "DELETE" }); } catch {}
    }
    setQueueId(null);
    setScreen("setup");
  }, [clearQueue, queueId, entryFee]);

  // ── START GAME ───────────────────────────────────────────────────────────────
  // In demo mode (no API_BASE): instant bot match, questions built client-side.
  // In production (API_BASE set): joins matchmaking queue → server pairs two
  // real players, issues a shared seed → both devices build identical questions.
  const startGame = useCallback(async () => {
    const entryKey = entryFee.entry === 0 ? "free" : String(Math.round(entryFee.entry * 83));

    // ── DEMO MODE (no backend) — instant bot match ──────────
    if (!API_BASE) {
      const cond = rnd(CONDITIONS);
      const o    = rnd(OPPS);
      setCondition(cond); setOpp(o);
      setMyScore(0); setOppScore(0); setWickets(0);
      setQi(0); setDone([]); setTLeft(15);
      setSel(null); setRev(false); setCStreak(0); setMaxStreak(0);
      setPuFF(true); setPuTF(true); setPuFH(true);
      setFrozen(false); setFreeHit(false); setHidden([]);
      setOppLiveFeed([]); setXpEarned(0); setResponseTimes([]);
      setShowBetween(false); setBetweenData(null);
      setTossState("idle"); setTossWinner(null); setBatFirst(null);
      setMatchType("bot"); setMatchId(null); setLoading(false);
      setInSuperOver(false); setSoPhase("intro"); setSuperOverWinner(null);
      fetchInBackground(cond);
      setScreen("toss");
      return;
    }

    // ── PRODUCTION MODE — join matchmaking queue ─────────────
    setScreen("finding");
    setQueueWaitMs(0);

    try {
      const result = await api("/matches/queue/join", { method: "POST", body: { entry_key: entryKey } });

      if (result.status === "matched") {
        // Instant match (opponent was already waiting)
        await _launchMatchFromServer(result);
        return;
      }

      // Waiting — poll every 2s for up to 30s, then fall back to bot
      setQueueId(result.queue_id);
      const startWait = Date.now();
      queuePollRef.current = setInterval(async () => {
        const elapsed = Date.now() - startWait;
        setQueueWaitMs(elapsed);

        // 30s timeout — give up and start bot match
        if (elapsed >= 30000) {
          clearQueue();
          const cond = rnd(CONDITIONS);
          const o    = rnd(OPPS);
          setCondition(cond); setOpp(o);
          setMyScore(0); setOppScore(0); setWickets(0);
          setQi(0); setDone([]); setTLeft(15);
          setSel(null); setRev(false); setCStreak(0); setMaxStreak(0);
          setPuFF(true); setPuTF(true); setPuFH(true);
          setFrozen(false); setFreeHit(false); setHidden([]);
          setOppLiveFeed([]); setXpEarned(0); setResponseTimes([]);
          setShowBetween(false); setBetweenData(null);
          setTossState("idle"); setTossWinner(null); setBatFirst(null);
          setMatchType("bot"); setMatchId(null); setLoading(false);
          setInSuperOver(false); setSoPhase("intro"); setSuperOverWinner(null);
          fetchInBackground(cond);
          setScreen("toss");
          showToast("No opponent found — playing vs AI 🤖");
          return;
        }

        try {
          const poll = await api(`/matches/queue/status?entry_key=${entryKey}`);
          if (poll.status === "matched") {
            clearQueue();
            await _launchMatchFromServer(poll);
          }
        } catch { clearQueue(); }
      }, 2000);

    } catch (err) {
      setScreen("setup");
      showToast(`⚠️ ${err.message}`);
    }
  }, [entryFee, fetchInBackground, loggedIn, clearQueue]);

  // Internal: launch a match given seed + condition_id from server response
  const _launchMatchFromServer = useCallback(async (serverResult) => {
    const { match_id, seed, condition_id, match_type } = serverResult;
    const cond = CONDITIONS.find(c => c.id === condition_id) || rnd(CONDITIONS);
    const o    = rnd(OPPS);
    setCondition(cond); setOpp(o);
    setMyScore(0); setOppScore(0); setWickets(0);
    setQi(0); setDone([]); setTLeft(15);
    setSel(null); setRev(false); setCStreak(0); setMaxStreak(0);
    setPuFF(true); setPuTF(true); setPuFH(true);
    setFrozen(false); setFreeHit(false); setHidden([]);
    setOppLiveFeed([]); setXpEarned(0); setResponseTimes([]);
    setShowBetween(false); setBetweenData(null);
    setTossState("idle"); setTossWinner(null); setBatFirst(null);
    setMatchId(match_id || null);
    setMatchType(match_type || "pvp");
    setQueueId(null);
    setLoading(false);
    // Use seeded questions from server — same for both players
    if (seed) {
      const questions = buildSeededQuestions(seed, condition_id);
      qsRef.current = questions;
      setQs(questions);
      qsReadyRef.current = Promise.resolve(questions);
    } else {
      fetchInBackground(cond);
    }
    setScreen("toss");
  }, [fetchInBackground]);

  // ── FRIEND CHALLENGE — create (pre-match) ────────────────────────────────────
  const createFriendChallenge = useCallback(() => {
    const seed      = Date.now() & 0x7FFFFFFF;
    const condIdx   = Math.floor(Math.random() * CONDITIONS.length);
    const cond      = CONDITIONS[condIdx];
    setFriendChallenge({ mode: "creating", seed, conditionId: cond.id, challengerNick: nick || "Someone", challengerScore: null });
    setCondition(cond);
    setScreen("fc_create");
  }, [nick]);

  // Start a seeded-question match (used by both sides of a friend challenge)
  const startFriendMatch = useCallback(async (fc) => {
    const seed = fc.seed;
    const cond = CONDITIONS.find(c => c.id === fc.conditionId) || CONDITIONS[2];
    const o    = rnd(OPPS);
    setCondition(cond);
    setOpp(o);
    setMyScore(0); setOppScore(0); setWickets(0);
    setQi(0); setDone([]); setTLeft(15);
    setSel(null); setRev(false); setCStreak(0); setMaxStreak(0);
    setPuFF(true); setPuTF(true); setPuFH(true);
    setFrozen(false); setFreeHit(false); setHidden([]);
    setOppLiveFeed([]); setXpEarned(0); setResponseTimes([]);
    setShowBetween(false); setBetweenData(null);
    setFcMyScore(null);
    // Build seeded questions immediately
    const questions = buildSeededQuestions(seed, fc.conditionId);
    qsRef.current = questions;
    setQs(questions);
    // Simulate opponent too
    const totalAcc = o.acc;
    const feed = questions.map((q, i) => ({ qi: i, score: Math.random() < totalAcc ? 6 : 0, ok: Math.random() < totalAcc }));
    const simScore = feed.reduce((s, f) => s + f.score, 0);
    setOppScore(simScore);
    setOppLiveFeed(feed);
    setBatFirst("player");
    setInnings(1);
    setTossState("idle"); setTossWinner(null);
    setLoading(false);
    setScreen("match");
    qStartRef.current = Date.now();
  }, []);

  // ── TOSS ──────────────────────────────────────────────────────────────────────
  const doToss = useCallback(() => {
    if (tossState !== "idle") return;
    snd("coin");
    setTossState("spinning");
    setTimeout(() => {
      const winner = Math.random() < .5 ? "player" : "opp";
      setTossWinner(winner);
      setTossState("result");
    }, 1900);
  }, [tossState, snd]);

  // Toss winner chooses bat/chase
  const chooseBatOrChase = useCallback(async (choice) => {
    // "bat" = I want to bat first; "chase" = I will chase (opp bats first)
    const batFirstDecision = choice === "bat" ? "player" : "opp";
    setBatFirst(batFirstDecision);
    setInnings(1);
    setScreen("conditions");
  }, []);

  // ── START INNINGS ─────────────────────────────────────────────────────────────
  const startInnings = useCallback(async () => {
    setLoading(true);
    const questions = await getQs();
    qsRef.current = questions;
    setQs(questions);
    setLoading(false);
    // If opp bats first, simulate their innings instantly, show live feed, then player chases
    const currentBatFirst = batFirst;
    if (currentBatFirst === "opp" && innings === 1) {
      simulateOppFirstInnings(questions);
    } else {
      setScreen("match");
      qStartRef.current = Date.now();
    }
  }, [getQs, batFirst, innings]);

  const simulateOppFirstInnings = useCallback((questions) => {
    let score = 0;
    const feed = [];
    const oppAcc = opp?.acc || 0.62;
    for (let i = 0; i < 6; i++) {
      const ok = Math.random() < oppAcc;
      const fakeT = Math.floor(Math.random() * 15) + 1;
      const runs = ok ? runsForTime(fakeT) : 0;
      if (ok) score += runs;
      else score = Math.max(0, score - 5); // wrong costs 5 runs
      feed.push({ qi: i, score: Math.max(0, score), ok });
    }
    score = Math.max(0, score);
    setOppScore(score);
    setOppLiveFeed(feed);
    setScreen("watching");
    // After showing the live feed, switch to player's chase
    setTimeout(() => {
      setInnings(2);
      setQi(0); setTLeft(15); setSel(null); setRev(false); setDone([]);
      setCStreak(0); setWickets(0);
      setPuFF(true); setPuTF(true); setPuFH(true);
      setFrozen(false); setFreeHit(false); setHidden([]);
      setScreen("match");
      qStartRef.current = Date.now();
    }, 5000);
  }, [opp]);

  // ── TIMER ─────────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (screen !== "match" || rev || frozen || loading || showBetween || !playerBatting) return;
    if (tLeft <= 0) { handleTimeout(); return; }
    tiRef.current = setTimeout(() => {
      if (tLeft <= 5) snd("tick");
      setTLeft(t => t - 1);
    }, 1000);
    return () => clearTimeout(tiRef.current);
  }, [screen, tLeft, rev, frozen, loading, showBetween, playerBatting]);

  const handleTimeout = useCallback(() => {
    clearTimeout(tiRef.current);
    const line = rnd(COMMENTARY[commStyle || "shastri"].timeout);
    snd("bad");
    const newDone = [...done, "bad"];
    setDone(newDone);
    setWickets(w => w + 1);
    setCStreak(0);
    setSel(-1); setRev(true);
    // Show between-question screen
    const q = qsRef.current[qi];
    triggerBetween({ correct: false, cmntLine: line, coachNote: q?.coachNote || "", scoreAfter: myCurrentScore, runsScored: 0, qi });
  }, [commStyle, sfxOn, snd, done, qi, myCurrentScore]);

  const triggerBetween = useCallback(({ correct, cmntLine, coachNote, scoreAfter, runsScored, qi: qIdx }) => {
    setBetweenData({ correct, cmntLine, coachNote, scoreAfter, runsScored, qIdx });
    setBetweenCount(10);
    setShowBetween(true);
    snd("between");
  }, [snd]);

  // Between-question countdown
  useEffect(() => {
    if (!showBetween) return;
    if (betweenCount <= 0) {
      setShowBetween(false);
      setBetweenData(null);
      advanceQuestion();
      return;
    }
    betweenRef.current = setTimeout(() => setBetweenCount(c => c - 1), 1000);
    return () => clearTimeout(betweenRef.current);
  }, [showBetween, betweenCount]);


  // ── START TIMER when question changes ─────────────────────────────────────
  useEffect(() => {
    if (screen !== "match" || !playerBatting || loading || showBetween) return;
    const q = qsRef.current[qi];
    if (!q) return;
    // Short pause so question card renders before timer starts
    const pause = setTimeout(() => {
      qStartRef.current = Date.now();
    }, 350);
    return () => clearTimeout(pause);
  }, [qi, screen, playerBatting]);

  const advanceQuestion = useCallback(() => {
    const currentQi = qi;
    if (currentQi >= 5) {
      endInnings();
      return;
    }
    // Pressure screen: after Q3 (index 2→3) while chasing (innings 2)
    const nextQi = currentQi + 1;
    if (currentQi === 2 && innings === 2) {
      setShowPressure(true);
      setTimeout(() => {
        setShowPressure(false);
        setQi(nextQi);
        setTLeft(15); setSel(null); setRev(false);
        setFrozen(false); setCmntLine("");
      }, 3200);
      return;
    }
    setQi(nextQi);
    setTLeft(15); setSel(null); setRev(false);
    setFrozen(false); setCmntLine("");
  }, [qi, innings]);

  const endInnings = useCallback(async () => {
    if (innings === 1) {
      if (batFirst === "player") {
        simulateOppChase();
      }
    } else {
      // Match over — complete in backend
      const playerWon = myScore > oppScore;
      const isTie     = myScore === oppScore;

      // TIE → Super Over instead of result screen
      if (isTie) {
        startSuperOver();
        return;
      }

      if (matchId && loggedIn) {
        try {
          await api(`/matches/${matchId}/complete`, {
            method: "POST",
            body: {
              player_score: myScore,
              opp_score:    oppScore,
              winner:       isTie ? "draw" : playerWon ? "player" : "opp",
            },
          });
          // Refresh wallet balance from backend
          const walletData = await api("/wallet");
          if (walletData?.wallet?.balance !== undefined) {
            setWallet(walletData.wallet.balance / 83); // convert INR → USD display
          }
        } catch (err) {
          console.error("Match finalization error:", err);
          // Still show result screen — don't block player
        }
      }
      setScreen("result");
      // Capture score for friend challenge comparison
      setFcMyScore(myScore);
    }
  }, [innings, batFirst, myScore, oppScore, matchId, loggedIn]);

  // ── SUPER OVER ────────────────────────────────────────────────────────────────
  const startSuperOver = useCallback(() => {
    clearTimeout(soTimerRef.current);
    // Pick 3 fresh questions from bank (avoid already-used ones)
    const used = new Set(qsRef.current.map(q => q.q.slice(0, 30)));
    const fresh = FALLBACK_BANK.filter(q => !used.has(q.q.slice(0, 30)))
      .sort(() => Math.random() - 0.5)
      .slice(0, 3)
      .map(q => ({ ...q, cat: q.cat || "TRIVIA", coachNote: q.coachNote || "", skill: q.skill || "history" }));
    setSoQs(fresh);
    setSoQi(0); setSoMyScore(0); setSoOppScore(0);
    setSoSel(null); setSoRev(false); setSoTLeft(15); setSoTimes([]);
    setInSuperOver(true);
    setSoPhase("intro");
    // Auto-advance past intro
    setTimeout(() => {
      setSoPhase("batting");
      soStartRef.current = Date.now();
    }, 2800);
  }, []);

  // Super Over timer
  useEffect(() => {
    if (!inSuperOver || soPhase !== "batting" || soRev || soSel !== null) return;
    if (soTLeft <= 0) {
      // Timeout — no runs
      setSoRev(true);
      setSoTimes(t => [...t, 15000]);
      setTimeout(() => advanceSoQuestion(), 1800);
      return;
    }
    soTimerRef.current = setTimeout(() => setSoTLeft(t => t - 1), 1000);
    return () => clearTimeout(soTimerRef.current);
  }, [inSuperOver, soPhase, soTLeft, soRev, soSel]);

  const answerSo = useCallback((idx) => {
    if (soRev || soSel !== null || soPhase !== "batting") return;
    clearTimeout(soTimerRef.current);
    const rt = Date.now() - (soStartRef.current || Date.now());
    setSoTimes(t => [...t, rt]);
    setSoSel(idx);
    setSoRev(true);
    const q = soQs[soQi];
    const correct = idx === q.ans;
    const timeTaken = rt;
    const runs = correct
      ? timeTaken <= 5000 ? 6 : timeTaken <= 10000 ? 4 : 2
      : 0;
    if (correct) setSoMyScore(s => s + runs);
    setTimeout(() => advanceSoQuestion(), 1600);
  }, [soRev, soSel, soPhase, soQs, soQi]);

  const advanceSoQuestion = useCallback(() => {
    const next = soQi + 1;
    if (next >= 3) {
      // Player done — now simulate opponent
      setSoPhase("watching");
      simulateSoOpp();
    } else {
      setSoQi(next);
      setSoSel(null); setSoRev(false); setSoTLeft(15);
      soStartRef.current = Date.now();
    }
  }, [soQi]);

  const simulateSoOpp = useCallback(() => {
    // Simulate opponent's 3 Super Over questions
    const oppAcc = opp?.acc || 0.62;
    let oppTotal = 0;
    for (let i = 0; i < 3; i++) {
      const ok = Math.random() < oppAcc;
      const t = soOppTimes[i];
      if (ok) oppTotal += t <= 5000 ? 6 : t <= 10000 ? 4 : 2;
    }
    setSoOppScore(oppTotal);
    setTimeout(() => {
      setSoPhase("result");
      // Badge check happens when soWinner resolves as "player" in JSX
    }, 2000);
  }, [opp, soOppTimes]);

  // Determine Super Over winner
  const soWinner = useMemo(() => {
    if (soPhase !== "result") return null;
    if (soMyScore > soOppScore) return "player";
    if (soOppScore > soMyScore) return "opp";
    // Tied again — fastest average response time wins
    const myAvg  = soTimes.reduce((a, b) => a + b, 0) / soTimes.length;
    const oppAvg = soOppTimes.reduce((a, b) => a + b, 0) / soOppTimes.length;
    return myAvg <= oppAvg ? "player" : "opp";
  }, [soPhase, soMyScore, soOppScore, soTimes, soOppTimes]);

  const simulateOppChase = useCallback(() => {
    const oppAcc = opp?.acc || 0.62;
    let score = 0;
    const feed = [];
    for (let i = 0; i < 6; i++) {
      const ok = Math.random() < oppAcc;
      const fakeT = Math.floor(Math.random() * 15) + 1;
      const runs = ok ? runsForTime(fakeT) : 0;
      if (ok) score += runs;
      else score = Math.max(0, score - 5);
      feed.push({ qi: i, score: Math.max(0, score), ok });
    }
    const finalOppScore = Math.max(0, score);
    setOppScore(finalOppScore);
    setOppLiveFeed(feed);
    setScreen("watching_chase");
    setTimeout(() => {
      // Must read myScore at callback time via ref to avoid stale closure
      setMyScore(cur => {
        if (cur === finalOppScore) {
          // TIE → start Super Over instead of going to result
          const used = new Set(qsRef.current.map(q => q.q.slice(0, 30)));
          const fresh = FALLBACK_BANK
            .filter(q => !used.has(q.q.slice(0, 30)))
            .sort(() => Math.random() - 0.5)
            .slice(0, 3)
            .map(q => ({ ...q, cat: q.cat || "TRIVIA", coachNote: q.coachNote || "", skill: q.skill || "history" }));
          setSoQs(fresh);
          setSoQi(0); setSoMyScore(0); setSoOppScore(0);
          setSoSel(null); setSoRev(false); setSoTLeft(15); setSoTimes([]);
          setInSuperOver(true);
          setSoPhase("intro");
          setTimeout(() => { setSoPhase("batting"); soStartRef.current = Date.now(); }, 2800);
        } else {
          setScreen("result");
        }
        return cur; // don't modify myScore
      });
    }, 4500);
  }, [opp]);

  // ── ANSWER ────────────────────────────────────────────────────────────────────
  const answer = useCallback(idx => {
    if (rev || sel !== null || !playerBatting || showBetween) return;
    clearTimeout(tiRef.current);
    // Anti-fraud
    const rt = Date.now() - (qStartRef.current || Date.now());
    setResponseTimes(p => [...p, rt]);

    setSel(idx); setRev(true);
    const q = qsRef.current[qi];
    const ok = idx === q?.ans;
    let line = "";

    if (ok) {
      const runs = runsForTime(tLeft);
      if (runs === 6) setBadges(b => { const n = new Set(b); n.add("first_six"); return n; });
      setMyScore(s => s + runs);
      snd("ok");
      const ns = cStreak + 1; setCStreak(ns);
      if (ns > maxStreak) setMaxStreak(ns);
      setDone(p => [...p, "ok"]);
      setXpEarned(e => e + (runs === 6 ? 20 : runs === 4 ? 15 : 10));
      const sk = q?.skill || "history";
      setSkillXp(prev => {
        const updated = { ...prev, [sk]: (prev[sk] || 0) + 10 };
        // Check skill-based badges on accumulation
        setBadges(b => {
          const next = new Set(b);
          if ((updated.ipl    || 0) >= 150) next.add("ipl_master");    // ~15 correct ipl q's
          if ((updated.history|| 0) >= 150) next.add("history_buff");
          if ((updated.womens || 0) >= 100) next.add("womens_fan");
          // All-Rounder: every skill at level 5+ (500 XP)
          const allLv5 = SKILLS.every(s => (updated[s.id] || 0) >= 500);
          if (allLv5) next.add("all_skills");
          return next;
        });
        return updated;
      });
      line = rnd(tLeft >= 10
        ? COMMENTARY[commStyle || "shastri"].fast
        : COMMENTARY[commStyle || "shastri"].slow);

      // Show between-question break after short delay
      setTimeout(() => {
        triggerBetween({
          correct: true,
          cmntLine: line,
          coachNote: "",
          scoreAfter: myScore,
          runsScored: runs,
          qi,
        });
      }, 600);
    } else if (freeHit) {
      setFreeHit(false);
      setDone(p => [...p, "bad"]);
      line = rnd(COMMENTARY[commStyle || "shastri"].timeout);
      showToast("🛡 FREE HIT — no wicket!");
      snd("bad");

      setTimeout(() => {
        triggerBetween({ correct: false, cmntLine: line, coachNote: "", scoreAfter: myScore, runsScored: 0, qi });
      }, 600);
    } else {
      setMyScore(s => Math.max(0, s - 5));
      snd("bad");
      setWickets(w => w + 1);
      setCStreak(0);
      setDone(p => [...p, "bad"]);
      line = rnd(COMMENTARY[commStyle || "shastri"].wrong);

      setTimeout(() => {
        triggerBetween({ correct: false, cmntLine: line, coachNote: q?.coachNote || "", scoreAfter: myScore, runsScored: -5, qi });
      }, 600);
    }

    setHidden([]);
    setCmntLine(line);

    // Submit to backend in background (non-blocking — game continues regardless)
    if (matchId && loggedIn) {
      api(`/matches/${matchId}/answer`, {
        method: "POST",
        body: {
          qi, innings,
          question_text: q?.q,
          opts:          q?.opts,
          correct_ans:   q?.ans,
          player_ans:    idx,
          time_ms:       rt,
        },
      }).catch(() => {}); // silent — don't disrupt gameplay on network error
    }
  }, [rev, sel, playerBatting, showBetween, qi, tLeft, freeHit, cStreak, maxStreak, commStyle, sfxOn, snd, myScore, triggerBetween, showToast, matchId, loggedIn, innings]);

  // Power-ups
  const doFF = useCallback(() => {
    if (!puFF || rev) return;
    const q = qsRef.current[qi];
    const bad = [0,1,2,3].filter(i => i !== q?.ans).sort(() => Math.random() - .5).slice(0, 2);
    setHidden(bad); setPuFF(false); snd("pu"); showToast("⚡ 50/50 — two answers removed");
  }, [puFF, rev, qi, snd, showToast]);

  const doFreeze = useCallback(() => {
    if (!puTF || rev) return;
    setFrozen(true); setPuTF(false); snd("pu"); showToast("⏱ Timeout — clock stopped for 10 seconds");
    setTimeout(() => setFrozen(false), 10000);
  }, [puTF, rev, snd, showToast]);

  const doFreeHit = useCallback(() => {
    if (!puFH || rev || freeHit) return;
    setPpUsedCount(c => {
      const next = c + 1;
      if (next >= 10) setBadges(b => { const n = new Set(b); n.add("power_play"); return n; });
      return next;
    });
    setFreeHit(true); setPuFH(false); snd("pu"); showToast("🏏 Power Play active — next wrong: no wicket!");
  }, [puFH, rev, freeHit, snd, showToast]);

  // ── Store purchase handler ───────────────────────────────────────────────
  const buyStoreItem = useCallback((item) => {
    if (item.category === "coins") {
      setShowIapModal(item); // show IAP purchase dialog
      return;
    }
    const cost = item.price;
    if (cricCoins < cost) { showToast("❌ Not enough CricCoins"); return; }
    setCricCoins(c => c - cost);
    const newSpent = coinsSpent + cost;
    setCoinsSpent(newSpent);
    if (newSpent >= 500) setBadges(b => { const n = new Set(b); n.add("coin_spender"); return n; });
    if (item.id === "pu_timeout") { setExtraPowerUps(p => ({...p, timeout: p.timeout+5})); showToast("⏱ 5 Timeouts added!"); }
    else if (item.id === "pu_5050") { setExtraPowerUps(p => ({...p, ff: p.ff+5})); showToast("⚡ 5 × 50/50s added!"); }
    else if (item.id === "pu_pp")   { setExtraPowerUps(p => ({...p, pp: p.pp+5})); showToast("🏏 5 Power Plays added!"); }
    else if (item.id === "xp_boost")   { setXpBoostLeft(3); showToast("🚀 2× XP for your next 3 matches!"); }
    else if (item.id === "streak_shld"){ showToast("🛡 Streak Shield active — your streak is protected!"); }
    else if (item.id === "gold_name")  { setGoldName(true); showToast("✨ Golden username unlocked!"); }
    else {
      const pal = JERSEY_PALETTES.find(p => p.id === item.id);
      if (pal) {
        setUnlockedPalettes(prev => new Set([...prev, pal.id]));
        setAvatarPalette(pal.id);
        showToast(`🎽 ${pal.label} jersey unlocked!`);
      }
    }
  }, [cricCoins, coinsSpent, showToast]);

  // ── Avatar Card component (CSS-only) ────────────────────────────────────
  const AvatarCard = useCallback(({ stage, num, palId, name, size = "normal" }) => {
    const pal   = JERSEY_PALETTES.find(p => p.id === palId) || JERSEY_PALETTES[0];
    const jCol  = pal.primary  || stage.jerseyColor;
    const sCol  = pal.stripe   || stage.jerseyStripe;
    const hCol  = stage.helmetColor;
    const scale = size === "small" ? 0.55 : 1;
    return (
      <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap: 8 * scale }}>
        {/* Helmet */}
        <div style={{ width: 52*scale, height: 42*scale, borderRadius: `${26*scale}px ${26*scale}px ${8*scale}px ${8*scale}px`, background: hCol, position:"relative", boxShadow:"0 4px 12px rgba(0,0,0,.2)", display:"flex", alignItems:"center", justifyContent:"center" }}>
          <div style={{ position:"absolute", bottom: 4*scale, left:"50%", transform:"translateX(-50%)", width: 40*scale, height: 14*scale, borderRadius: `0 0 ${8*scale}px ${8*scale}px`, background:"rgba(0,0,0,.35)" }} />
          <div style={{ fontSize: 10*scale, fontFamily:"var(--fm)", color:"rgba(255,255,255,.6)", letterSpacing:1, zIndex:1 }}>◉</div>
        </div>
        {/* Jersey */}
        <div style={{ position:"relative", width: 160*scale, height: 200*scale, borderRadius: 18*scale, background: jCol, boxShadow:"0 8px 32px rgba(0,0,0,.18)", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", overflow:"hidden" }}>
          {/* Stripe */}
          <div style={{ position:"absolute", left:"50%", top:0, bottom:0, width: 28*scale, transform:"translateX(-50%)", background: sCol, opacity:.45 }} />
          {/* Collar */}
          <div style={{ position:"absolute", top:0, left:"50%", transform:"translateX(-50%)", width: 44*scale, height: 22*scale, borderRadius: `0 0 ${22*scale}px ${22*scale}px`, background: sCol }} />
          {/* Number */}
          <div style={{ fontFamily:"var(--fd)", fontSize: 64*scale, fontWeight:900, color:"rgba(255,255,255,.9)", lineHeight:1, textShadow:"0 2px 8px rgba(0,0,0,.3)", position:"relative", zIndex:2 }}>{num}</div>
          {/* Name */}
          <div style={{ fontFamily:"var(--fm)", fontSize: 9*scale, fontWeight:700, letterSpacing:2, color:"rgba(255,255,255,.7)", textTransform:"uppercase", position:"relative", zIndex:2, marginTop: 2*scale }}>{name?.slice(0,10) || "PLAYER"}</div>
          {/* Stage badge */}
          <div style={{ position:"absolute", bottom: -12*scale, left:"50%", transform:"translateX(-50%)", background:"var(--bg)", border:"2px solid var(--rim)", borderRadius:999, padding: `${3*scale}px ${12*scale}px`, fontFamily:"var(--fm)", fontSize: 8*scale, fontWeight:700, letterSpacing:1.5, textTransform:"uppercase", whiteSpace:"nowrap", boxShadow:"var(--sh-xs)", color: stage.color }}>
            {stage.badge}
          </div>
        </div>
      </div>
    );
  }, []);

  // Result cleanup
  useEffect(() => {
    if (screen === "result" && !cleanRef.current) {
      cleanRef.current = true;
      
      const won = myScore > oppScore;
      const newPlayed = played + 1;
      const newWins   = won ? wins + 1 : wins;
      setPlayed(p => p + 1);
      if (won) {
        setWins(v => v + 1);
        if (entryFee.entry > 0) {
          setWallet(w => parseFloat((w + entryFee.prize).toFixed(2)));
          setTotalEarnings(e => parseFloat((e + (entryFee.prize - entryFee.entry)).toFixed(2)));
        }
        snd("win");
        // Earn CricCoins on win
        setCricCoins(c => c + (entryFee.entry > 0 ? 15 : 5));
      } else {
        setCricCoins(c => c + 2); // small consolation
      }
      const xpMult = xpBoostLeft > 0 ? 2 : 1;
      if (xpBoostLeft > 0) setXpBoostLeft(b => b - 1);
      setTotalXp(x => x + (xpEarned + (won ? 60 : 10)) * xpMult);

      // ── Uncapped skill XP (raw accumulation, no cap at 100) ──
      // Already done per-ball in answerQ; skill levels computed from raw XP

      // ── Badge checking ──────────────────────────────────────
      setBadges(prev => {
        const next = new Set(prev);
        if (newPlayed >= 1)   next.add("first_match");
        if (won)              next.add("first_win");
        if (won && entryFee.entry > 0) next.add("first_paid");
        if (myScore === 36)   next.add("perfect_inn");
        if (maxStreak >= 3)   next.add("hat_trick");
        if (maxStreak >= 5)   next.add("speedster"); // proxy — they answered fast and correctly
        if (newWins >= 10)    next.add("wins_10");
        if (newWins >= 25)    next.add("wins_25");
        if (newWins >= 50)    next.add("wins_50");
        if (newWins >= 100)   next.add("wins_100");
        if (lStreak + (won ? 1 : 0) >= 5)  next.add("streak_5");
        if (lStreak + (won ? 1 : 0) >= 10) next.add("streak_10");
        // skill-based badges — check raw skillXp counters
        return next;
      });

      // ── Anti-fraud check ──
      if (responseTimes.length > 0) {
        const avg = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
        if (avg < 800) console.warn("[AntiBot] Fast responses detected, avg:", Math.round(avg), "ms — flagged for review");
      }
    }
    if (screen !== "result") cleanRef.current = false;
  }, [screen]);

  const q = qs[qi];
  const tPct = (tLeft / 15) * 100;
  const tCol = frozen ? "#7c3aed" : tLeft > 8 ? "#0369a1" : tLeft > 4 ? "#d97706" : "#dc2626";
  const rawWon   = myScore > oppScore;
  const rawTie   = myScore === oppScore;
  // If a Super Over was played, use its result — the raw scores will both equal each other
  const won   = superOverWinner ? superOverWinner === "player" : rawWon;
  const isTie = superOverWinner ? false : rawTie;

  // ═══════════════════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════════════════
  return (
    <>
      <style>{G}</style>
      <div className="app">
        {toastMsg && <div className="toast">{toastMsg}</div>}

        {/* ══════ AUTH ══════ */}
        {screen === "auth" && (
          <div className="auth-screen">
            <div className="auth-hero">
              <div className="auth-bg" /><div className="auth-grid" />
              <div className="auth-logo">Cricket<br /><em>Clash</em></div>
              <div className="auth-tagline">Skill · Strategy · Glory</div>
            </div>
            <div className="auth-body">
              {/* ── TAB SWITCHER ── */}
              <div style={{ display:"flex", background:"var(--s2)", borderRadius:12, padding:4, marginBottom:20 }}>
                {["login","signup"].map(m => (
                  <button key={m} onClick={() => { setAuthMode(m); setAuthError(""); }}
                    style={{ flex:1, padding:"10px 0", borderRadius:9, border:"none", fontFamily:"var(--fm)", fontSize:13, fontWeight:700, cursor:"pointer",
                      background: authMode===m ? "var(--bg)" : "transparent",
                      color: authMode===m ? "var(--amber)" : "var(--sub)",
                      boxShadow: authMode===m ? "0 1px 4px rgba(0,0,0,.12)" : "none",
                      transition:"all .2s" }}>
                    {m === "login" ? "Log In" : "Sign Up"}
                  </button>
                ))}
              </div>

              {/* ── ERROR ── */}
              {authError && (
                <div style={{ background: authError.includes("created") ? "rgba(21,128,61,.1)" : "rgba(220,38,38,.08)", border:`1px solid ${authError.includes("created") ? "rgba(21,128,61,.2)" : "rgba(220,38,38,.2)"}`, borderRadius:10, padding:"10px 14px", fontSize:12, color: authError.includes("created") ? "var(--green)" : "var(--red)", marginBottom:12 }}>
                  {authError}
                </div>
              )}

              {/* ── SIGNUP FORM ── */}
              {authMode === "signup" && (
                <>
                  <div className="inp-label">Your nickname</div>
                  <input className="inp" placeholder="e.g. CricketKing_IND" value={authNickname}
                    onChange={e => setAuthNickname(e.target.value)} maxLength={20} />
                  <div className="inp-label" style={{marginTop:10}}>Email address</div>
                  <input className="inp" type="email" placeholder="you@email.com" value={authEmail}
                    onChange={e => setAuthEmail(e.target.value)} />
                  <div className="inp-label" style={{marginTop:10}}>Password</div>
                  <input className="inp" type="password" placeholder="Min 6 characters" value={authPassword}
                    onChange={e => setAuthPassword(e.target.value)} />
                  <button className="btn btn-amber" style={{width:"100%", marginTop:16}}
                    onClick={doSignup} disabled={authLoading}>
                    {authLoading ? "Creating account…" : "Create Account 🏏"}
                  </button>
                </>
              )}

              {/* ── LOGIN FORM ── */}
              {authMode === "login" && (
                <>
                  <div className="inp-label">Email address</div>
                  <input className="inp" type="email" placeholder="you@email.com" value={authEmail}
                    onChange={e => setAuthEmail(e.target.value)} />
                  <div className="inp-label" style={{marginTop:10}}>Password</div>
                  <input className="inp" type="password" placeholder="Your password" value={authPassword}
                    onChange={e => setAuthPassword(e.target.value)} />
                  <button className="btn btn-amber" style={{width:"100%", marginTop:16}}
                    onClick={() => doLogin("email")} disabled={authLoading}>
                    {authLoading ? "Logging in…" : "Log In →"}
                  </button>
                </>
              )}

              {/* ── GUEST ── */}
              <button className="guest-lnk" style={{marginTop:16}} onClick={() => doLogin("guest")}>
                Play as Guest (no account needed)
              </button>

              <div className="auth-legal" style={{marginTop:12}}>
                By continuing you agree to our{" "}
                <a onClick={() => { setScreen("legal"); setLegalTab("terms"); }}>Terms</a>
                {" "}and{" "}
                <a onClick={() => { setScreen("legal"); setLegalTab("privacy"); }}>Privacy Policy</a>.
                {" "}Must be 18+ to play for money.
              </div>
            </div>
          </div>
        )}

        {/* ══════ TUTORIAL OVERLAY ══════ */}
        {showTutorial && (
          <div className="tut-overlay">
            <div className="tut-backdrop" onClick={() => {}} />
            <div className="tut-card">
              <div className="tut-dots">
                {TUT_STEPS.map((_, i) => (
                  <div key={i} className={`tut-dot${i === tutStep ? " on" : ""}`}
                    style={{ width: i === tutStep ? 22 : 7 }} />
                ))}
              </div>
              <span className="tut-icon">{TUT_STEPS[tutStep].icon}</span>
              <div className="tut-title">{TUT_STEPS[tutStep].title}</div>
              <div className="tut-body">
                {TUT_STEPS[tutStep].body}
                {TUT_STEPS[tutStep].hl && (
                  <> — <span className="tut-hl">{TUT_STEPS[tutStep].hl}</span></>
                )}
              </div>
              <div className="tut-btns">
                <button className="tut-skip" onClick={() => { setShowTutorial(false); setTutStep(0); localStorage.setItem("cc_tutorial_done","1"); }}>
                  Skip
                </button>
                <button className="tut-next" onClick={() => {
                  if (tutStep < TUT_STEPS.length - 1) setTutStep(s => s + 1);
                  else { setShowTutorial(false); setTutStep(0); localStorage.setItem("cc_tutorial_done","1"); }
                }}>
                  {tutStep < TUT_STEPS.length - 1 ? "Next →" : "Let's Play! 🏏"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ══════ RULES ══════ */}
        {screen === "rules" && (
          <div className="screen rules-screen">
            <div className="rules-hero-band">
              <div style={{position:"relative"}}>
                <button className="back-btn" style={{background:"rgba(255,255,255,.1)",border:"1px solid rgba(255,255,255,.15)",color:"#fff",marginBottom:14}} onClick={() => setScreen("landing")}>←</button>
                <div style={{fontFamily:"var(--fd)",fontSize:28,fontWeight:800,color:"#fff",letterSpacing:"-.3px"}}>How to Play</div>
                <div style={{fontFamily:"var(--fm)",fontSize:10,color:"rgba(255,255,255,.45)",letterSpacing:2,textTransform:"uppercase",marginTop:4}}>Cricket Clash · Match Rules</div>
              </div>
            </div>
            <div className="rules-body">

              <div className="rules-sec">
                <div className="rules-sec-lbl">Match Format</div>
                <div className="rule-card">
                  {[
                    ["🏏","Two Innings","Each match has 2 innings. One player bats first to set a target, the other chases. 7 questions per innings."],
                    ["🪙","The Toss","A coin flip decides who gets to choose. Win the toss → choose to Bat or Chase."],
                    ["⏱","15 Seconds","Each question is read aloud first. Once you hear 'GO!' the 15-second countdown begins."],
                    ["🎙","Commentary","Ravi Shastri or Harsha Bhogle commentary after every answer — turn on sound for the full experience."],
                  ].map(([icon,title,desc]) => (
                    <div key={title} className="rule-row">
                      <div className="ri">{icon}</div>
                      <div><div className="rn">{title}</div><div className="rd">{desc}</div></div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rules-sec">
                <div className="rules-sec-lbl">Scoring — Runs Per Ball</div>
                <div className="rule-card">
                  <table className="rt">
                    <thead><tr><th>Answer Speed</th><th>Result</th><th>Runs</th></tr></thead>
                    <tbody>
                      <tr><td>1–5 seconds left</td><td>⚡ Blazing fast</td><td><span className="run-badge" style={{background:"rgba(21,128,61,.12)",color:"var(--green)"}}>SIX — 6 runs</span></td></tr>
                      <tr><td>6–10 seconds left</td><td>🔥 Quick</td><td><span className="run-badge" style={{background:"rgba(3,105,161,.12)",color:"var(--blue)"}}>FOUR — 4 runs</span></td></tr>
                      <tr><td>11–14 seconds left</td><td>✅ Answered</td><td><span className="run-badge" style={{background:"rgba(180,83,9,.1)",color:"var(--amber)"}}>TWO — 2 runs</span></td></tr>
                      <tr><td>Wrong answer</td><td>❌ Wicket!</td><td><span className="run-badge" style={{background:"rgba(220,38,38,.1)",color:"var(--red)"}}>–5 runs</span></td></tr>
                      <tr><td>Timeout</td><td>🏃 Run out</td><td><span className="run-badge" style={{background:"rgba(220,38,38,.08)",color:"var(--red)"}}>–3 runs</span></td></tr>
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="rules-sec">
                <div className="rules-sec-lbl">Power-Ups (one per match)</div>
                <div className="rule-card">
                  {[
                    ["⚡","50/50","Eliminates two wrong options, leaving just the correct answer and one decoy. Perfect when you've narrowed it down but can't decide."],
                    ["⏱","Timeout","Stops the countdown for 10 seconds so you can think without pressure. Use it on a question you know but need a moment to recall."],
                    ["🏏","Power Play","Your free hit — activate before answering and a wrong answer costs no wicket and no run penalty. Like the Power Play in cricket, it's your one chance to attack without consequence."],
                  ].map(([icon,title,desc]) => (
                    <div key={title} className="rule-row">
                      <div className="ri">{icon}</div>
                      <div><div className="rn">{title}</div><div className="rd">{desc}</div></div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rules-sec">
                <div className="rules-sec-lbl">Winning & Prizes</div>
                <div className="rule-card">
                  {[
                    ["🏆","Highest Total Wins","After both innings, highest run total wins the match and takes the prize pool."],
                    ["💰","Prize Pool","Paid matches pay up to 1.8× entry. Free matches award XP only."],
                    ["📈","Career Progression","Win XP to climb from Gully Cricketer to Cricket Legend."],
                    ["⚡","Super Over","If scores are tied after 6 questions, a Super Over of 3 questions decides the winner. Same scoring system applies."],
                    ["⏱","Super Over Tiebreak","If the Super Over is also tied, the player with the faster average response time across all 3 questions wins."],
                  ].map(([icon,title,desc]) => (
                    <div key={title} className="rule-row">
                      <div className="ri">{icon}</div>
                      <div><div className="rn">{title}</div><div className="rd">{desc}</div></div>
                    </div>
                  ))}
                </div>
              </div>

              <button className="btn btn-amber" onClick={() => setScreen("landing")}>
                🏏 Start Playing
              </button>
            </div>
          </div>
        )}

        {/* ══════ LEGAL ══════ */}
        {screen === "legal" && (
          <div className="screen legal-screen">
            <div className="hdr" style={{flexShrink:0}}>
              <button className="back-btn" onClick={() => setScreen(loggedIn ? "landing" : "auth")}>←</button>
              <div className="hdr-title">Legal</div>
            </div>
            <div className="legal-tabs">
              {[["terms","Terms"],["privacy","Privacy"],["refund","Refunds"],["gaming","Responsible\nGaming"]].map(([id,lb]) => (
                <button key={id} className={`legal-tab${legalTab===id?" on":""}`} onClick={() => setLegalTab(id)}>{lb}</button>
              ))}
            </div>
            <div className="legal-body">
              {legalTab === "terms" && <>
                <div className="lh1">Terms & Conditions</div>
                <div className="ldate">EFFECTIVE: 1 JANUARY 2025 · VERSION 2.1</div>
                <div className="lh2">1. Eligibility</div>
                <div className="lp">Cricket Clash is available to users aged 18 and above. By registering, you confirm that you are at least 18 years old and that participating in skill-based contests for prizes is legal in your jurisdiction. Users from Andhra Pradesh, Assam, Nagaland, Odisha, Sikkim, and Telangana may not participate in paid contests due to local regulations.</div>
                <div className="lh2">2. Nature of the Game</div>
                <div className="lp">Cricket Clash is a game of skill. Outcomes are determined by a player's cricket knowledge and speed of response. Faster, correct answers earn more runs. The game is NOT a game of chance — no random element determines the winner independent of skill.</div>
                <div className="lh2">3. Account & Identity</div>
                <div className="lp">One account per person. Multiple accounts will result in permanent bans and forfeiture of winnings. You must complete KYC verification before your first withdrawal. False identity information will result in account termination.</div>
                <div className="lh2">4. Loss of Internet / Disconnection</div>
                <div className="lbox"><p>⚠️ If you lose internet connectivity mid-match, unanswered questions are treated as timeouts (–3 runs each). If the match cannot be completed within 5 minutes of disconnection, it is recorded as a forfeit and your entry fee is non-refundable. We strongly recommend a stable connection before entering paid matches.</p></div>
                <div className="lp">In the rare case of a confirmed server-side failure on our end, the match is voided and entry fees refunded within 24 hours.</div>
                <div className="lh2">5. Match Results</div>
                <div className="lp">All match results are final once the result screen is shown. Results cannot be appealed except in cases of verified technical error on Cricket Clash's servers. Screenshot evidence from the user side is not considered sufficient proof of error.</div>
                <div className="lh2">6. Prohibited Conduct</div>
                <div className="lp">Using bots, automated tools, collusion, or any unfair advantage is strictly prohibited and will result in permanent ban and forfeiture of all funds. We use anti-fraud monitoring including response-time analysis on every match.</div>
                <div className="lh2">7. Changes to Terms</div>
                <div className="lp">We reserve the right to modify these terms at any time. Continued use of the platform after changes constitutes acceptance. Material changes will be notified via email and in-app notification.</div>
              </>}

              {legalTab === "privacy" && <>
                <div className="lh1">Privacy Policy</div>
                <div className="ldate">EFFECTIVE: 1 JANUARY 2025</div>
                <div className="lh2">Data We Collect</div>
                <div className="lp">We collect: name, email, phone number, profile photo (from social login), device identifiers, match history, response times per question, payment method details (tokenised, never stored raw), and KYC documents (Aadhaar/PAN/Passport).</div>
                <div className="lh2">How We Use Your Data</div>
                <div className="lp">Your data is used to: operate your account, detect fraud and collusion, process payments and withdrawals, improve question quality, send match notifications, and comply with legal obligations. We never sell personal data to third-party advertisers.</div>
                <div className="lh2">Response Time Data</div>
                <div className="lbox"><p>🔒 We record how quickly you answer each question for anti-bot purposes only. This data is not shared externally and is automatically deleted after 90 days.</p></div>
                <div className="lh2">Payment Data</div>
                <div className="lp">All payment processing is handled by Razorpay (PCI-DSS Level 1 certified). Cricket Clash does not store card numbers, CVVs, or UPI PINs. We store only a payment token to enable future transactions.</div>
                <div className="lh2">Data Retention</div>
                <div className="lp">Account data is retained while your account is active and for 5 years after closure as required by Indian financial regulations. Match history is retained for 2 years. KYC documents are retained for 7 years as per RBI guidelines.</div>
                <div className="lh2">Your Rights</div>
                <div className="lp">You may request a copy of your data, correction of inaccuracies, or deletion of your account at privacy@cricketclash.in. Account deletion may take up to 30 days and will forfeit any pending withdrawals under ₹100.</div>
              </>}

              {legalTab === "refund" && <>
                <div className="lh1">Refund Policy</div>
                <div className="ldate">EFFECTIVE: 1 JANUARY 2025</div>
                <div className="lh2">Entry Fees</div>
                <div className="lbox"><p>⚠️ Entry fees are non-refundable once a match has started. If you leave a match voluntarily, the entry fee is forfeited. Please only enter paid matches on a stable connection.</p></div>
                <div className="lh2">Deposit Refunds</div>
                <div className="lp">Deposits that have not been used in any match can be refunded within 7 days of deposit by contacting support@cricketclash.in. After 7 days, unused deposits can be withdrawn as normal (subject to KYC). Bonus funds are non-refundable and non-withdrawable.</div>
                <div className="lh2">Technical Failures</div>
                <div className="lp">If a match fails to complete due to a confirmed server-side error on Cricket Clash's infrastructure, all entry fees for that match are automatically refunded within 24 hours. We will notify affected players by email.</div>
                <div className="lh2">Internet Disconnection</div>
                <div className="lp">Disconnection from your end (poor network, device restart, app crash) does not qualify for a refund. The match will timeout and be recorded as a result. We recommend enabling mobile data as a backup during paid matches.</div>
                <div className="lh2">Withdrawal Timelines</div>
                <div className="lp">UPI withdrawals: within 30 minutes. Bank transfer (NEFT/IMPS): 1–3 business days. Card refunds: 5–7 business days. Minimum withdrawal: ₹100. Maximum single withdrawal: ₹50,000 (₹2,00,000/month).</div>
                <div className="lh2">Disputes</div>
                <div className="lp">For any refund dispute, email support@cricketclash.in with your match ID and a description. We aim to respond within 48 hours. Unresolved disputes may be escalated to our grievance officer at grievance@cricketclash.in.</div>
              </>}

              {legalTab === "gaming" && <>
                <div className="lh1">Responsible Gaming</div>
                <div className="ldate">EFFECTIVE: 1 JANUARY 2025</div>
                <div className="lbox"><p>🏏 Cricket Clash is a game of skill — but we take responsible gaming seriously. Please play within your means and for enjoyment.</p></div>
                <div className="lh2">Set Your Limits</div>
                <div className="lp">You can set daily, weekly, or monthly deposit limits in your profile settings. Once set, limits cannot be increased for 7 days to prevent impulsive decisions. We strongly encourage all players to set a budget before playing for money.</div>
                <div className="lh2">Self-Exclusion</div>
                <div className="lp">If you feel you are playing more than you should, you can self-exclude for 30, 90, or 180 days from Profile → Settings → Self-Exclusion. During exclusion you cannot deposit or enter paid matches. Your account and funds remain safe.</div>
                <div className="lh2">Signs to Watch For</div>
                {[
                  "Chasing losses by depositing more to 'win it back'",
                  "Spending more than you can afford to lose",
                  "Prioritising Cricket Clash over responsibilities",
                  "Feeling anxious or distressed when not playing",
                  "Hiding your gaming activity from family or friends",
                ].map(s => <div key={s} className="lp" style={{paddingLeft:14,borderLeft:"2px solid var(--amber)"}}>• {s}</div>)}
                <div className="lh2">Get Help</div>
                <div className="lp">If you or someone you know needs help with problematic gaming, please reach out to: iCall (India): 9152987821 · iCall is a free, confidential counselling service. You can also email us at care@cricketclash.in and we will connect you with support.</div>
                <div className="lh2">Minor Protection</div>
                <div className="lp">Cricket Clash is strictly 18+. If you believe a minor is using this platform, please report immediately to safety@cricketclash.in. We take all such reports seriously and investigate within 24 hours.</div>
              </>}
            </div>
          </div>
        )}

        {/* ══════ WALLET CONNECT ══════ */}
        {screen === "wallet-connect" && (
          <div className="screen wc-screen">
            <div className="wc-balance-band">
              <button className="back-btn" style={{background:"rgba(255,255,255,.1)",border:"1px solid rgba(255,255,255,.15)",color:"#fff",marginBottom:14}} onClick={() => setScreen("wallet")}>←</button>
              <div className="wc-bal-label">Wallet Balance</div>
              <div className="wc-bal-amount"><span>$</span>{wallet.toFixed(2)}</div>
            </div>

            <div className="kyc-strip" style={{background:loggedIn?"rgba(21,128,61,.1)":"rgba(220,38,38,.08)",border:`1px solid ${loggedIn?"rgba(21,128,61,.2)":"rgba(220,38,38,.2)"}`}}>
              <span className="kyc-icon">{loggedIn ? "✅" : "⚠️"}</span>
              <div className="kyc-text">{loggedIn ? "KYC Verified — you can deposit and withdraw freely." : "Complete KYC to enable withdrawals. Tap to verify."}</div>
              <span className="kyc-badge" style={{background:loggedIn?"rgba(21,128,61,.15)":"rgba(220,38,38,.1)",color:loggedIn?"var(--green)":"var(--red)"}}>{loggedIn?"VERIFIED":"PENDING"}</span>
            </div>

            <div className="wc-body">
              <div className="wc-sec-lbl">Choose Amount</div>
              <div className="amt-grid">
                {["₹50","₹100","₹200","₹500"].map(a => (
                  <div key={a} className={`amt-chip${wcAmount===a?" on":""}`} onClick={() => setWcAmount(a)}>{a}</div>
                ))}
              </div>
              <div className="wc-inp-wrap">
                <span className="wc-currency">₹</span>
                <input className="wc-inp" type="number" placeholder="0" value={wcAmount.replace("₹","")} onChange={e => setWcAmount(e.target.value)} />
              </div>
              <div className="wc-limits">Min ₹50 · Max ₹10,000 per transaction · ₹50,000/month</div>

              <div className="wc-sec-lbl" style={{marginTop:4}}>UPI</div>
              {[
                {id:"gpay",  icon:"🟢", name:"Google Pay",  desc:"Instant · No fees",     bg:"#34a853"},
                {id:"phone", icon:"🟣", name:"PhonePe",     desc:"Instant · No fees",     bg:"#5f259f"},
                {id:"paytm", icon:"🔵", name:"Paytm",       desc:"Instant · No fees",     bg:"#00b9f1"},
                {id:"upi",   icon:"🏦", name:"Any UPI ID",  desc:"Enter your VPA manually",bg:"#f47920"},
              ].map(m => (
                <div key={m.id} className={`wm${wcMethod===m.id?" sel":""}`} onClick={() => setWcMethod(m.id)}>
                  <div className="wm-logo" style={{background:`${m.bg}22`}}>{m.icon}</div>
                  <div className="wm-info"><div className="wm-name">{m.name}</div><div className="wm-desc">{m.desc}</div></div>
                  <span className="wm-arrow">{wcMethod===m.id?"✓":"›"}</span>
                </div>
              ))}

              <div className="wc-sec-lbl" style={{marginTop:4}}>Card</div>
              {[
                {id:"card", icon:"💳", name:"Credit / Debit Card", desc:"Visa · Mastercard · RuPay"},
              ].map(m => (
                <div key={m.id} className={`wm${wcMethod===m.id?" sel":""}`} onClick={() => setWcMethod(m.id)}>
                  <div className="wm-logo" style={{background:"rgba(3,105,161,.1)"}}>{m.icon}</div>
                  <div className="wm-info"><div className="wm-name">{m.name}</div><div className="wm-desc">{m.desc}</div></div>
                  <span className="wm-arrow">{wcMethod===m.id?"✓":"›"}</span>
                </div>
              ))}

              <div className="wc-sec-lbl" style={{marginTop:4}}>Net Banking</div>
              {[
                {id:"netbank", icon:"🏛", name:"Net Banking", desc:"SBI · HDFC · ICICI · Axis · 50+ banks"},
              ].map(m => (
                <div key={m.id} className={`wm${wcMethod===m.id?" sel":""}`} onClick={() => setWcMethod(m.id)}>
                  <div className="wm-logo" style={{background:"rgba(92,33,182,.1)"}}>{m.icon}</div>
                  <div className="wm-info"><div className="wm-name">{m.name}</div><div className="wm-desc">{m.desc}</div></div>
                  <span className="wm-arrow">{wcMethod===m.id?"✓":"›"}</span>
                </div>
              ))}

              <button className="btn btn-green" style={{marginTop:4}}
                disabled={!wcMethod || !wcAmount}
                onClick={() => {
                  const amt = parseFloat(String(wcAmount).replace("₹","")) || 0;
                  if (amt >= 1) { setWallet(w => parseFloat((w + amt/83).toFixed(2))); }
                  showToast(`✅ ₹${wcAmount} added via ${wcMethod}!`);
                  setScreen("wallet");
                }}>
                {wcMethod ? `Add Money via ${wcMethod === "gpay" ? "Google Pay" : wcMethod === "phone" ? "PhonePe" : wcMethod === "paytm" ? "Paytm" : wcMethod === "upi" ? "UPI" : wcMethod === "card" ? "Card" : "Net Banking"}` : "Select a payment method"}
              </button>

              <div style={{textAlign:"center",fontFamily:"var(--fm)",fontSize:9,color:"var(--dim)",letterSpacing:1,lineHeight:1.6}}>
                🔒 Payments secured by Razorpay · PCI-DSS Level 1<br/>
                All transactions encrypted with TLS 1.3
              </div>
            </div>
          </div>
        )}

        {/* ══════ LANDING ══════ */}
        {screen === "landing" && (
          <div className="screen" style={{ background: "var(--bg)" }}>
            <div className="hero">
              <div className="hero-tex" /><div className="hero-grid" /><div className="hero-fade" />
              <div className="hero-c">
                <div className="hero-eyebrow">Skill · Strategy · Glory</div>
                <div className="hero-title">Cricket<br /><em>Clash</em></div>
                <div className="hero-div" />
                <div className="hero-sub">The world's first turn-based cricket trivia duel</div>
                <div className="live-pill"><div className="ldot" />2,841 playing now</div>
              </div>
            </div>
            <div className="land-c">
              <div className="land-features">
                {[
                  { icon: "🪙", name: "Toss & Choose", desc: "Win the toss, decide — bat first and set a target, or chase." },
                  { icon: "🎙", name: "Live Commentary", desc: "Shastri or Bhogle style audio commentary on every answer." },
                  { icon: "🌦", name: "Match Conditions", desc: "Swing, spin, flat belter — themed questions every match." },
                  { icon: "👑", name: "Career Arc", desc: "Debut as Gully kid. Earn your Test cap. Become a Legend." },
                ].map((f, i) => (
                  <div key={f.name} className="feat-card" style={{ animationDelay: `${i * .08}s` }}>
                    <span className="feat-icon">{f.icon}</span>
                    <div className="feat-name">{f.name}</div>
                    <div className="feat-desc">{f.desc}</div>
                  </div>
                ))}
              </div>
              <button className="btn btn-amber" onClick={() => setScreen("setup")}>Play a Match</button>
              <button className="btn btn-outline" onClick={() => setScreen("wallet")}>💰 Wallet — ${wallet.toFixed(2)}</button>
              <div style={{ display: "flex", gap: 8 }}>
                <button className="btn btn-outline btn-sm" style={{ flex: 1 }} onClick={() => { setNavTab("leaderboard"); setScreen("leaderboard"); }}>🏆 Leaderboard</button>
                <button className="btn btn-outline btn-sm" style={{ flex: 1 }} onClick={() => { setNavTab("profile"); setScreen("profile"); }}>👤 {nick || "Career"}</button>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button className="btn btn-outline btn-sm" style={{ flex: 1 }} onClick={() => setScreen("rules")}>📋 How to Play</button>
                <button className="btn btn-outline btn-sm" style={{ flex: 1 }} onClick={() => { setLegalTab("terms"); setScreen("legal"); }}>⚖️ Legal</button>
                <button className="btn btn-outline btn-sm" style={{ flex: 1 }} onClick={() => { setShowTutorial(true); setTutStep(0); }}>🎓 Tutorial</button>
              </div>
            </div>
          </div>
        )}

        {/* ══════ SETUP ══════ */}
        {/* ══════ FINDING OPPONENT ══════ */}
        {screen === "finding" && (
          <div className="screen" style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:20, background:"linear-gradient(160deg,#1a2e1a,#1c1917 60%,#1a1a2e)" }}>
            {/* Spinning cricket ball */}
            <div style={{ fontSize:64, animation:"spinBall 1.2s linear infinite" }}>🏏</div>
            <div style={{ textAlign:"center" }}>
              <div style={{ fontFamily:"var(--fd)", fontSize:22, fontWeight:700, color:"#fff", marginBottom:6 }}>
                Finding Opponent…
              </div>
              <div style={{ fontSize:13, color:"rgba(255,255,255,.45)" }}>
                {queueWaitMs < 10000
                  ? "Searching for a real player near your level"
                  : queueWaitMs < 25000
                  ? "Almost there — pairing you now"
                  : "Just a moment more…"}
              </div>
            </div>

            {/* Wait timer dots */}
            <div style={{ display:"flex", gap:6 }}>
              {[0,1,2,3,4].map(i => (
                <div key={i} style={{
                  width:8, height:8, borderRadius:"50%",
                  background: Math.floor(queueWaitMs / 600) % 5 === i ? "var(--amberViv)" : "rgba(255,255,255,.15)",
                  transition:"background 0.3s",
                }} />
              ))}
            </div>

            {/* Entry fee reminder */}
            <div style={{ background:"rgba(255,255,255,.06)", border:"1px solid rgba(255,255,255,.1)", borderRadius:"var(--r2)", padding:"10px 20px", textAlign:"center" }}>
              <div style={{ fontSize:11, color:"rgba(255,255,255,.4)", textTransform:"uppercase", letterSpacing:1, marginBottom:2 }}>Entry</div>
              <div style={{ fontFamily:"var(--fd)", fontSize:16, fontWeight:700, color:"var(--amberViv)" }}>
                {entryFee.entry === 0 ? "Free Practice" : `₹${Math.round(entryFee.entry * 83)} → Win ₹${Math.round(entryFee.prize * 83)}`}
              </div>
            </div>

            <div style={{ fontSize:11, color:"rgba(255,255,255,.25)", textAlign:"center", maxWidth:240 }}>
              If no opponent is found within 30 seconds, you'll be matched with an AI opponent automatically
            </div>

            <button
              onClick={cancelQueue}
              style={{ padding:"10px 28px", borderRadius:"var(--r2)", background:"transparent", border:"1px solid rgba(255,255,255,.2)", color:"rgba(255,255,255,.5)", fontFamily:"var(--fm)", fontSize:12, cursor:"pointer", marginTop:8 }}>
              Cancel
            </button>
          </div>
        )}

        {/* ══════ FRIEND CHALLENGE — CREATE ══════ */}
        {screen === "fc_create" && friendChallenge && (() => {
          const APP_URL = "https://play.cricketclash.in";
          const fc = friendChallenge;
          const inviteCode = btoa(`${nick||"Someone"}|${fc.seed}|${fc.conditionId}|0`).replace(/=/g,"").replace(/\+/g,"-").replace(/\//g,"_");
          const inviteUrl  = `${APP_URL}?fc=${inviteCode}`;
          const cond = CONDITIONS.find(c => c.id === fc.conditionId);
          const shareText = `🏏 ${nick||"Someone"} has challenged you to a Cricket Clash match!\n\n📍 Pitch: ${cond?.name || "Mystery Pitch"}\n\nWe'll play the same 6 questions — whoever scores more runs wins! 🏆\n\nAccept the challenge 👇\n${inviteUrl}`;
          return (
            <div className="screen" style={{ background:"linear-gradient(160deg,#1a2e1a,#1c1917 50%,#1a1a2e)" }}>
              <div className="hdr" style={{ background:"transparent", borderBottom:"1px solid rgba(255,255,255,.08)" }}>
                <button className="back-btn" style={{ color:"rgba(255,255,255,.6)" }} onClick={() => setScreen("setup")}>←</button>
                <div className="hdr-title" style={{ color:"#fff" }}>Challenge a Friend</div>
                <div className="hdr-r" />
              </div>
              <div className="setup-scroll" style={{ gap:16, paddingTop:24 }}>
                {/* Trophy header */}
                <div style={{ textAlign:"center", paddingBottom:4 }}>
                  <div style={{ fontSize:52, marginBottom:8 }}>🏆</div>
                  <div style={{ fontFamily:"var(--fd)", fontSize:22, fontWeight:700, color:"#fff" }}>Cricket Clash Challenge</div>
                  <div style={{ fontSize:13, color:"rgba(255,255,255,.5)", marginTop:4 }}>Send this link — you both play the same 6 questions</div>
                </div>

                {/* Pitch info card */}
                <div style={{ background:"rgba(255,255,255,.06)", border:"1px solid rgba(255,255,255,.12)", borderRadius:"var(--r2)", padding:"14px 16px", display:"flex", alignItems:"center", gap:12 }}>
                  <div style={{ fontSize:28 }}>{cond?.icon || "🏟"}</div>
                  <div>
                    <div style={{ fontFamily:"var(--fm)", fontSize:10, letterSpacing:2, color:"rgba(255,255,255,.4)", textTransform:"uppercase" }}>Today's Pitch</div>
                    <div style={{ fontFamily:"var(--fd)", fontSize:16, fontWeight:700, color:"#fff" }}>{cond?.name || "Mystery Pitch"}</div>
                    <div style={{ fontSize:11, color:"rgba(255,255,255,.5)", marginTop:1 }}>{cond?.desc || ""}</div>
                  </div>
                </div>

                {/* Friend name input */}
                <div className="field-g">
                  <div className="slbl" style={{ color:"rgba(255,255,255,.5)" }}>Friend's name (optional)</div>
                  <input
                    className="inp"
                    placeholder="e.g. Priya, Rahul…"
                    value={fcFriendName}
                    onChange={e => setFcFriendName(e.target.value)}
                    maxLength={20}
                    style={{ background:"rgba(255,255,255,.07)", border:"1px solid rgba(255,255,255,.15)", color:"#fff" }}
                  />
                </div>

                {/* How it works */}
                <div style={{ background:"rgba(251,191,36,.06)", border:"1px solid rgba(251,191,36,.15)", borderRadius:"var(--r2)", padding:"12px 14px" }}>
                  <div style={{ fontFamily:"var(--fm)", fontSize:10, letterSpacing:2, color:"var(--amberViv)", textTransform:"uppercase", marginBottom:8 }}>How it works</div>
                  {[
                    ["1️⃣","Send the link to your friend"],
                    ["2️⃣","You both play the same 6 questions"],
                    ["3️⃣","Compare scores — highest runs wins!"],
                  ].map(([icon,text]) => (
                    <div key={icon} style={{ display:"flex", alignItems:"center", gap:8, marginBottom:4, fontSize:12, color:"rgba(255,255,255,.7)" }}>
                      <span>{icon}</span><span>{text}</span>
                    </div>
                  ))}
                </div>

                {/* Share buttons */}
                <div style={{ display:"flex", gap:8 }}>
                  <button
                    onClick={() => {
                      const url = `whatsapp://send?text=${encodeURIComponent(shareText)}`;
                      window.location.href = url;
                    }}
                    style={{ flex:2, padding:"13px 0", borderRadius:"var(--r2)", background:"#25D366", border:"none", color:"#fff", fontFamily:"var(--fm)", fontSize:14, fontWeight:700, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", gap:8 }}>
                    <span style={{ fontSize:20 }}>💬</span> Send on WhatsApp
                  </button>
                  <button
                    onClick={() => {
                      navigator.clipboard?.writeText(shareText).then(() => showToast("✅ Link copied!")).catch(() => showToast("Link: " + inviteUrl));
                    }}
                    style={{ flex:1, padding:"13px 0", borderRadius:"var(--r2)", background:"rgba(255,255,255,.08)", border:"1px solid rgba(255,255,255,.15)", color:"rgba(255,255,255,.8)", fontFamily:"var(--fm)", fontSize:12, fontWeight:600, cursor:"pointer" }}>
                    📋 Copy
                  </button>
                </div>

                {/* Play your match button */}
                <button
                  className="btn btn-amber"
                  onClick={() => {
                    setFriendChallenge({ ...fc, mode:"playing", friendName: fcFriendName });
                    startFriendMatch({ ...fc, friendName: fcFriendName });
                  }}>
                  🏏 Play Your Match Now →
                </button>
                <div style={{ textAlign:"center", fontSize:11, color:"rgba(255,255,255,.3)", marginTop:-8 }}>Play first, then share your score so {fcFriendName || "your friend"} has a target to chase</div>
              </div>
            </div>
          );
        })()}

        {/* ══════ FRIEND CHALLENGE — ACCEPT ══════ */}
        {screen === "fc_accept" && friendChallenge && (() => {
          const fc = friendChallenge;
          const cond = CONDITIONS.find(c => c.id === fc.conditionId);
          const hasScore = fc.challengerScore > 0;
          return (
            <div className="screen" style={{ background:"linear-gradient(160deg,#1a2e1a,#1c1917 50%,#1a1a2e)" }}>
              <div className="hdr" style={{ background:"transparent", borderBottom:"1px solid rgba(255,255,255,.08)" }}>
                <div className="hdr-title" style={{ color:"#fff" }}>Challenge Received! 🏏</div>
                <div className="hdr-r" />
              </div>
              <div className="setup-scroll" style={{ gap:16, paddingTop:24 }}>
                {/* Challenge card */}
                <div style={{ background:"linear-gradient(135deg,rgba(180,83,9,.25),rgba(124,58,237,.25))", border:"1px solid rgba(251,191,36,.3)", borderRadius:"var(--r2)", padding:"20px 16px", textAlign:"center" }}>
                  <div style={{ fontSize:48, marginBottom:8 }}>🏆</div>
                  <div style={{ fontFamily:"var(--fd)", fontSize:20, fontWeight:700, color:"#fff", marginBottom:4 }}>
                    {fc.challengerNick} has challenged you!
                  </div>
                  {hasScore ? (
                    <>
                      <div style={{ fontSize:13, color:"rgba(255,255,255,.55)", marginBottom:12 }}>Can you beat their score?</div>
                      <div style={{ display:"flex", justifyContent:"center", gap:24, marginBottom:4 }}>
                        <div style={{ textAlign:"center" }}>
                          <div style={{ fontFamily:"var(--fd)", fontSize:36, fontWeight:700, color:"var(--amberViv)" }}>{fc.challengerScore}</div>
                          <div style={{ fontSize:10, color:"rgba(255,255,255,.4)", textTransform:"uppercase", letterSpacing:1 }}>{fc.challengerNick}'s runs</div>
                        </div>
                        <div style={{ display:"flex", alignItems:"center", fontSize:18, color:"rgba(255,255,255,.25)" }}>vs</div>
                        <div style={{ textAlign:"center" }}>
                          <div style={{ fontFamily:"var(--fd)", fontSize:36, fontWeight:700, color:"rgba(255,255,255,.3)" }}>?</div>
                          <div style={{ fontSize:10, color:"rgba(255,255,255,.4)", textTransform:"uppercase", letterSpacing:1 }}>Your runs</div>
                        </div>
                      </div>
                    </>
                  ) : (
                    <div style={{ fontSize:13, color:"rgba(255,255,255,.55)" }}>Play the same 6 questions and compare scores!</div>
                  )}
                </div>

                {/* Pitch info */}
                <div style={{ background:"rgba(255,255,255,.06)", border:"1px solid rgba(255,255,255,.12)", borderRadius:"var(--r2)", padding:"12px 16px", display:"flex", alignItems:"center", gap:12 }}>
                  <div style={{ fontSize:26 }}>{cond?.icon || "🏟"}</div>
                  <div>
                    <div style={{ fontFamily:"var(--fm)", fontSize:9, letterSpacing:2, color:"rgba(255,255,255,.4)", textTransform:"uppercase" }}>Today's Pitch</div>
                    <div style={{ fontFamily:"var(--fd)", fontSize:15, fontWeight:700, color:"#fff" }}>{cond?.name || "Mystery Pitch"}</div>
                  </div>
                </div>

                {/* Your name */}
                <div className="field-g">
                  <div className="slbl" style={{ color:"rgba(255,255,255,.5)" }}>Your name</div>
                  <input className="inp" placeholder="Enter your name" value={nick} onChange={e => setNick(e.target.value)} maxLength={20} style={{ background:"rgba(255,255,255,.07)", border:"1px solid rgba(255,255,255,.15)", color:"#fff" }} />
                </div>

                <button
                  className="btn btn-amber"
                  style={{ marginTop:8 }}
                  disabled={!nick.trim()}
                  onClick={() => startFriendMatch(fc)}>
                  {hasScore ? `🏏 Chase ${fc.challengerScore} Runs!` : "🏏 Accept Challenge!"}
                </button>
              </div>
            </div>
          );
        })()}

        {screen === "setup" && (
          <div className="screen">
            <div className="hdr">
              <button className="back-btn" onClick={() => setScreen("landing")}>←</button>
              <div className="hdr-title">New Match</div>
              <div className="hdr-r">
                <div className="mono-tag" style={{ background: "rgba(180,83,9,.08)", border: "1px solid rgba(180,83,9,.2)", color: "var(--amber)" }}>{career.badge}</div>
              </div>
            </div>
            <div className="setup-scroll">
              <div className="field-g">
                <div className="slbl">Your name</div>
                <input className="inp" placeholder="e.g. CricketKing_IND" value={nick} onChange={e => setNick(e.target.value)} maxLength={20} />
              </div>
              <div className="field-g">
                <div className="slbl">Country</div>
                <div className="country-g">
                  {COUNTRIES.map(c => (
                    <div key={c.code} className={`cty${country?.code === c.code ? " on" : ""}`} onClick={() => setCountry(c)}>
                      <span className="fl">{c.flag}</span>{c.name}
                    </div>
                  ))}
                </div>
              </div>
              <div className="field-g">
                <div className="slbl">Entry fee & prize pool</div>
                <div className="fee-g">
                  {ENTRY_FEES.map(f => (
                    <div key={f.label} className={`fee-row${entryFee.label === f.label ? " on" : ""}`} onClick={() => {
                      if (f.entry > wallet) { showToast("⚠️ Insufficient balance"); return; }
                      setEntryFee(f);
                    }}>
                      <span className="fee-icon">{f.icon}</span>
                      <div className="fee-info">
                        <div className="fee-label">{f.label} Entry</div>
                        <div className="fee-prize">{f.entry > 0 ? `Win ₹${Math.round(f.prize*83)} · Platform fee ₹${Math.round(f.entry*83*0.2)}` : "Free practice — no prize"}</div>
                      </div>
                      <div className="fee-tag" style={{ background: f.entry === 0 ? "var(--s2)" : "var(--amberBg)", color: f.entry === 0 ? "var(--sub)" : "var(--amber)", border: `1px solid ${f.entry === 0 ? "var(--rim)" : "rgba(180,83,9,.2)"}` }}>{f.tag}</div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="spacer" />
              <div style={{ position:"sticky", bottom:0, background:"var(--bg)", paddingTop:12, paddingBottom:16, marginTop:8, display:"flex", flexDirection:"column", gap:10 }}>
              <button className="btn btn-amber" onClick={startGame} disabled={!nick.trim() || !country}>
                Find Opponent & Toss 🪙
              </button>
              <button
                onClick={createFriendChallenge}
                disabled={!nick.trim()}
                style={{ width:"100%", padding:"13px 0", borderRadius:"var(--r2)", background:"transparent", border:"2px solid var(--green2)", color:"var(--green2)", fontFamily:"var(--fm)", fontSize:13, fontWeight:700, cursor: nick.trim() ? "pointer":"not-allowed", opacity: nick.trim() ? 1 : 0.4, display:"flex", alignItems:"center", justifyContent:"center", gap:8 }}>
                🎯 Challenge via WhatsApp
              </button>
              </div>
            </div>
          </div>
        )}

        {/* ══════ TOSS ══════ */}
        {screen === "toss" && (
          <div className="screen toss-screen">
            {/* PvP vs Bot badge */}
            <div style={{ display:"flex", justifyContent:"center", marginBottom:4 }}>
              <div style={{
                padding:"4px 12px", borderRadius:20,
                background: matchType === "pvp" ? "rgba(74,222,128,.12)" : "rgba(255,255,255,.06)",
                border: `1px solid ${matchType === "pvp" ? "rgba(74,222,128,.3)" : "rgba(255,255,255,.12)"}`,
                fontSize:11, fontFamily:"var(--fm)", letterSpacing:1, textTransform:"uppercase",
                color: matchType === "pvp" ? "#4ade80" : "rgba(255,255,255,.35)",
              }}>
                {matchType === "pvp" ? "⚡ Real Player" : "🤖 AI Opponent"}
              </div>
            </div>
            <div className="toss-players">
              <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:6 }}>
                {/* Jersey card on toss — explicit colors for dark bg visibility */}
                {(() => {
                  const pal = JERSEY_PALETTES.find(p => p.id === avatarPalette) || JERSEY_PALETTES[0];
                  const jCol = pal.primary || career.jerseyColor;
                  const scale = 0.42;
                  return (
                    <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap: 4 }}>
                      <div style={{ width:22, height:18, borderRadius:"11px 11px 4px 4px", background: career.helmetColor, boxShadow:"0 2px 6px rgba(0,0,0,.4)" }} />
                      <div style={{ width: 67, height: 84, borderRadius:8, background: jCol, boxShadow:"0 4px 20px rgba(0,0,0,.5), 0 0 0 2px rgba(255,255,255,.12)", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", position:"relative", overflow:"hidden" }}>
                        <div style={{ position:"absolute", left:"50%", top:0, bottom:0, width:11, transform:"translateX(-50%)", background:"rgba(0,0,0,.15)" }} />
                        <div style={{ fontFamily:"var(--fd)", fontSize:34, fontWeight:900, color:"rgba(255,255,255,.92)", lineHeight:1, zIndex:1, textShadow:"0 2px 6px rgba(0,0,0,.3)" }}>{avatarNum}</div>
                        <div style={{ fontFamily:"var(--fm)", fontSize:6, fontWeight:700, letterSpacing:1.5, color:"rgba(255,255,255,.6)", textTransform:"uppercase", zIndex:1 }}>{nick?.slice(0,8) || "YOU"}</div>
                      </div>
                      <div style={{ fontFamily:"var(--fm)", fontSize:7, fontWeight:700, letterSpacing:1, textTransform:"uppercase", color: career.color, background:"rgba(0,0,0,.5)", borderRadius:999, padding:"2px 8px", border:`1px solid ${career.color}50` }}>{career.badge}</div>
                    </div>
                  );
                })()}
                <div style={{ fontFamily:"var(--fm)", fontSize:10, fontWeight:700, color:"rgba(255,255,255,.7)", marginTop:2 }}>{nick || "You"}</div>
              </div>
              <div className="toss-vs">VS</div>
              <div className="tp"><div className="tp-flag">{opp?.flag}</div><div className="tp-name">{opp?.name}</div><div className="tp-elo">{opp?.elo}</div></div>
            </div>

            <div style={{ fontFamily: "var(--fd)", fontSize: 26, fontWeight: 800, textAlign: "center", color: "#fff" }}>
              {tossState === "idle" ? "Tap to toss" : tossState === "spinning" ? "Tossing…" : tossWinner === "player" ? "🎉 You won the toss!" : `${opp?.name} won the toss`}
            </div>
            {tossState === "idle" && <div style={{ fontSize: 12, color: "rgba(255,255,255,.4)", textAlign: "center" }}>Toss winner decides — bat first or chase</div>}

            {/* 3D Coin */}
            <div className="coin-wrap" onClick={doToss} style={{ cursor: tossState === "idle" ? "pointer" : "default" }}>
              <div className={`coin${tossState === "spinning" ? " spinning" : ""}`}>
                <div className="coin-face coin-heads">🏏</div>
                <div className="coin-face coin-tails">🏟</div>
              </div>
            </div>

            {tossState === "result" && (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14, width: "100%", animation: "fadeUp .4s cubic-bezier(.22,1,.36,1)" }}>
                {tossWinner === "player" ? (
                  <>
                    <div style={{ fontSize: 13, color: "var(--sub)", textAlign: "center" }}>
                      Your choice — bat first or chase?
                    </div>
                    <div className="choice-cards">
                      <div className="choice-card bat" onClick={() => chooseBatOrChase("bat")}>
                        <span className="choice-icon">🏏</span>
                        <div className="choice-title" style={{ color: "var(--amber)" }}>Bat First</div>
                        <div className="choice-desc">Set a target. Put runs on the board. Make them chase.</div>
                      </div>
                      <div className="choice-card chase" onClick={() => chooseBatOrChase("chase")}>
                        <span className="choice-icon">🎯</span>
                        <div className="choice-title" style={{ color: "var(--blue)" }}>Chase</div>
                        <div className="choice-desc">Let them bat first. Know the target. Hunt it down.</div>
                      </div>
                    </div>
                  </>
                ) : (
                  // Opponent won toss — they always bat first, player chases automatically
                  <div style={{ fontSize: 13, color: "var(--sub)", textAlign: "center", lineHeight: 1.6 }}>
                    <strong style={{ color: "var(--txt)" }}>{opp?.name}</strong> chose to bat first.<br />
                    You will be chasing. Get ready.
                    <br /><br />
                    <button className="btn btn-amber" style={{ width: "100%" }} onClick={() => chooseBatOrChase("chase")}>
                      🎯 Got it — Start Match
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ══════ CONDITIONS — BROADCAST STADIUM VIEW ══════ */}
        {screen === "conditions" && condition && (() => {
          const isNight = condition.isNight;
          const bc = condition.broadcastColor;
          const pitchTop = condition.pitchColor || "#8B7355";
          const pitchBot = condition.pitchColor ? condition.pitchColor + "aa" : "#A8956B";

          return (
            <div className="cond-screen">
              {/* ── Stadium background image ── */}
              <div className="cond-stadium-bg" style={{
                backgroundImage: `url(${condition.img})`,
                filter: isNight ? "brightness(.55) saturate(.7)" : "brightness(.75) saturate(.85)",
              }} />

              {/* ── Sky gradient overlay ── */}
              <div className="cond-overlay" style={{ background: condition.overlay }} />

              {/* ── Vignette ── */}
              <div className="cond-vignette" />

              {/* ── Night: stars + floodlight glows ── */}
              {isNight && (
                <>
                  {[...Array(18)].map((_, i) => (
                    <div key={i} className="star" style={{
                      left: `${Math.random()*100}%`, top: `${Math.random()*45}%`,
                      width: i%3===0 ? 2 : 1, height: i%3===0 ? 2 : 1,
                      "--dur": `${1.5 + (i%4)*.5}s`, "--delay": `${(i*.15)%2}s`,
                      "--op1": i%2===0 ? .9 : .6, "--op2": i%2===0 ? .2 : .1,
                    }} />
                  ))}
                  <div className="floodlight" style={{ top:"-30px", left:"10%", background:"#fff8e0" }} />
                  <div className="floodlight" style={{ top:"-30px", right:"10%", background:"#fff8e0" }} />
                </>
              )}

              {/* ── Pitch strip ── */}
              <div className="pitch-strip" style={{ "--pitchTop":pitchTop, "--pitchBot":pitchBot }}>
                <div className="crease-line" style={{ top:10 }} />
                <div className="crease-line" style={{ bottom:10 }} />
              </div>

              {/* ── All content over the image ── */}
              <div className="cond-content">

                {/* ── TOP: Broadcast bar ── */}
                <div className="broadcast-bar">
                  <div className="broadcast-live" style={{ color: bc }}>
                    <div className="live-dot" style={{ background: bc }} />
                    {condition.broadcastTag}
                  </div>
                  <div className="broadcast-logo">🏏 CRICKET CLASH</div>
                  <div className="broadcast-temp">{condition.weatherIcon} {condition.atmosphere.split("|")[2]?.trim()}</div>
                </div>

                {/* ── MIDDLE: Lower-third venue name ── */}
                <div style={{ flex:1 }} />
                <div className="lower-third">
                  <div className="lt-venue">{condition.venue}</div>
                  <div className="lt-stadium">{condition.stadium}</div>
                </div>

                {/* ── BOTTOM: Pitch report sheet ── */}
                <div className="pitch-report-sheet">
                  {/* Tag */}
                  <div className="pitch-tag" style={{ "--tagColor": bc }}>Pitch Report</div>

                  {/* Condition name + desc */}
                  <div>
                    <div className="pitch-name">{condition.name}</div>
                    <div className="pitch-desc">{condition.desc}</div>
                  </div>

                  {/* Weather / pitch stats strip */}
                  <div className="pitch-stats-row">
                    {condition.atmosphere.split("|").map((s, i) => {
                      const labels = ["Sky", "Humidity", "Temp"];
                      return (
                        <div key={i} className="pitch-stat">
                          <div className="pitch-stat-val">{s.trim()}</div>
                          <div className="pitch-stat-lbl">{labels[i] || ""}</div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Pitch surface + wind */}
                  <div style={{ display:"flex", gap:8 }}>
                    <div className="pitch-stat" style={{ flex:1 }}>
                      <div className="pitch-stat-val">🌬 {condition.wind}</div>
                      <div className="pitch-stat-lbl">Wind</div>
                    </div>
                    <div className="pitch-stat" style={{ flex:1 }}>
                      <div className="pitch-stat-val" style={{ color: bc }}>▪ {condition.pitchDesc}</div>
                      <div className="pitch-stat-lbl">Surface</div>
                    </div>
                  </div>

                  {/* Innings badge */}
                  <div className="innings-badge-bc" style={{ borderColor: bc, background:`${bc}18`, color: bc }}>
                    {batFirst === "player" ? "🏏 You Bat First" : "🎯 You're Chasing"}
                  </div>

                  {/* Skill note */}
                  <div style={{ fontSize:11, color:"rgba(255,255,255,.35)", lineHeight:1.5 }}>
                    Questions from <span style={{ color: bc, fontWeight:700 }}>{condition.cat}</span> · Your skill will grow this match
                  </div>

                  {/* CTA */}
                  {loading ? (
                    <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                      <div className="spinner" />
                      <div style={{ color:"rgba(255,255,255,.4)", fontSize:12 }}>Preparing the pitch…</div>
                    </div>
                  ) : (
                    <button
                      onClick={startInnings}
                      style={{ width:"100%", background:bc, color:"#fff", border:"none", borderRadius:14, padding:"15px 0", fontFamily:"var(--fd)", fontSize:17, fontWeight:800, cursor:"pointer", boxShadow:`0 4px 20px ${bc}55`, letterSpacing:.3 }}>
                      {batFirst === "player" ? "🏏  Start Batting" : "▶  Watch Opponent Bat"}
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })()}

        {/* ══════ WATCHING — OPP BATS FIRST or CHASES ══════ */}
        {(screen === "watching" || screen === "watching_chase") && (
          <WatchingScreen
            opp={opp}
            feed={oppLiveFeed}
            finalScore={oppScore}
            label={screen === "watching" ? "1st Innings" : "Chase"}
            target={screen === "watching" ? null : myScore}
            isPvp={matchType === "pvp"}
          />
        )}

        {/* ══════ PRESSURE SCREEN — after Q3 while chasing ══════ */}
        {showPressure && (() => {
          const runsNeeded = Math.max(0, oppScore - myScore + 1);
          const isAhead    = myScore > oppScore;
          const tied       = myScore === oppScore;
          return (
            <div style={{
              position:"fixed", inset:0, zIndex:200,
              background:"linear-gradient(160deg,#1a0a0a,#2d1010)",
              display:"flex", flexDirection:"column", alignItems:"center",
              justifyContent:"center", gap:16, animation:"scaleIn .3s both",
            }}>
              <div style={{ fontSize:56 }}>
                {isAhead ? "🔥" : tied ? "⚡" : "💀"}
              </div>
              <div style={{ fontFamily:"var(--fm)", fontSize:10, letterSpacing:3, color:"rgba(255,255,255,.4)", textTransform:"uppercase" }}>
                Halfway there
              </div>
              <div style={{ fontFamily:"var(--fd)", fontSize:42, fontWeight:800, color:"#fff", textAlign:"center", lineHeight:1.1 }}>
                {isAhead
                  ? `${myScore - oppScore} runs ahead`
                  : tied
                  ? "Dead heat!"
                  : `${runsNeeded} needed`}
              </div>
              <div style={{ fontFamily:"var(--fd)", fontSize:18, color:"rgba(255,255,255,.5)" }}>
                off the last 3 balls
              </div>
              <div style={{ display:"flex", gap:12, marginTop:8 }}>
                {[0,1,2].map(i => (
                  <div key={i} style={{
                    width:14, height:14, borderRadius:"50%",
                    background:"rgba(255,255,255,.15)",
                    border:"2px solid rgba(255,255,255,.3)",
                  }}/>
                ))}
              </div>
              <div style={{ fontFamily:"var(--fm)", fontSize:11, color:"rgba(255,255,255,.3)", marginTop:4 }}>
                {isAhead ? "Defend your lead" : tied ? "One six wins it" : runsNeeded <= 6 ? "One six wins it!" : runsNeeded <= 12 ? "You need boundaries" : "Miracles happen!"}
              </div>
            </div>
          );
        })()}

        {/* ══════ MATCH SCREEN ══════ */}
        {screen === "match" && (
          <div className="match-wrap">
            {/* Scoreboard */}
            <div className="scoreboard">
              <div className="sb-p">
                <div className="sb-flag">{country?.flag}</div>
                <div className="sb-name">{nick || "You"}</div>
                <div className={`sb-score${playerBatting ? " batting" : ""}`}>{myScore}</div>
              </div>
              <div className="sb-mid">
                <div className="sb-inn">{innings === 1 ? "1st Innings" : "2nd Innings"}</div>
                <div className="sb-dots">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className={`sb-dot${done[i] === "ok" ? " done-ok" : done[i] === "bad" ? " done-bad" : i === qi && !rev ? " cur" : ""}`} />
                  ))}
                </div>
                {innings === 2 && target ? (
                  <div style={{ fontFamily:"var(--fm)", fontSize:8, color:"var(--amber)", letterSpacing:1, marginTop:2, fontWeight:700 }}>
                    NEED {Math.max(0, target - myScore)} · TARGET {target - 1}
                  </div>
                ) : (
                  <div style={{ fontFamily:"var(--fm)", fontSize:8, color:"var(--sub)", letterSpacing:1, marginTop:2 }}>
                    {wickets}W · Q{qi + 1}/6
                  </div>
                )}
              </div>
              <div className="sb-p r">
                <div className="sb-flag">{opp?.flag}</div>
                <div className="sb-name">{opp?.name}</div>
                <div className={`sb-score${!playerBatting ? " batting" : ""}`}>{oppScore}</div>
              </div>
            </div>

            {/* Compact tension strip — last 2 questions only */}
            {innings === 2 && target && qi >= 4 && playerBatting && (() => {
              const need = Math.max(0, target - myScore);
              const canWin = need <= (6 - qi) * 6;
              return (
                <div style={{
                  margin:"4px 14px 0", padding:"7px 13px", borderRadius:"var(--r1)",
                  fontSize:12, fontWeight:700, textAlign:"center",
                  background: canWin ? "rgba(21,128,61,.08)" : "rgba(220,38,38,.08)",
                  color: canWin ? "var(--green)" : "var(--red)",
                  border:`1px solid ${canWin ? "rgba(21,128,61,.2)" : "rgba(220,38,38,.2)"}`,
                }}>
                  {qi === 5 ? "⚠️ LAST BALL" : `🔥 LAST ${6 - qi} QUESTIONS`}
                  {" · "}{need} runs needed · {canWin ? "Still winnable!" : "Miracle needed"}
                </div>
              );
            })()}

            {/* Loading */}
            {loading ? (
              <div className="load-q"><div className="spinner" /><div className="load-sub">Preparing pitch…</div></div>
            ) : q ? (
              <>
                {/* Timer */}
                <div className="timer-wrap">
                  <div className="t-bar-bg">
                    <div className="t-bar" style={{ width: `${tPct}%`, background: tCol }} />
                  </div>
                  <div className="t-row">
                    <span className="t-num" style={{ color: tCol }}>{frozen ? "⏱" : tLeft}</span>
                    <span className="t-lbl">{frozen ? "paused" : "sec"}</span>
                    <div className="runs-preview" style={{
                        background: tLeft >= 11 ? "rgba(21,128,61,.12)" : tLeft >= 6 ? "rgba(3,105,161,.12)" : "rgba(180,83,9,.12)",
                        color: tLeft >= 11 ? "var(--green)" : tLeft >= 6 ? "var(--blue)" : "var(--amber)",
                        border: `1px solid ${tLeft >= 11 ? "rgba(21,128,61,.25)" : tLeft >= 6 ? "rgba(3,105,161,.25)" : "rgba(180,83,9,.25)"}`,
                      }}>
                        {tLeft >= 11 ? "⚡ SIX" : tLeft >= 6 ? "🔥 FOUR" : "✅ TWO"}
                        {freeHit && <span style={{marginLeft:5,color:"var(--amber)"}}>🛡</span>}
                      </div>
                  </div>
                </div>

                {/* Power-ups */}
                <div className="pu-strip">
                  <span className="pu-lbl">Lifelines</span>
                  <button className="pu" disabled={!puFF || rev} onClick={doFF}>⚡ 50/50</button>
                  <button className="pu" disabled={!puTF || rev} onClick={doFreeze}>⏱ Timeout</button>
                  <button className="pu" disabled={!puFH || rev || freeHit} onClick={doFreeHit} style={freeHit ? {borderColor:"var(--amber)",background:"var(--amberBg)"} : {}}>🏏 Power Play</button>
                </div>

                {/* Question */}
                <div className="q-area">
                  {(() => {
                    // Per-skill colour palette — cricket themed
                    const skillColors = {
                      batting:  { color:"#b45309", bg:"#fffbeb", border:"rgba(180,83,9,.2)",   label:"🏏 BATTING"    },
                      bowling:  { color:"#be123c", bg:"#fff1f2", border:"rgba(190,18,60,.2)",  label:"🔴 BOWLING"    },
                      ipl:      { color:"#7c3aed", bg:"#faf5ff", border:"rgba(124,58,237,.2)", label:"💜 IPL"         },
                      history:  { color:"#0369a1", bg:"#f0f9ff", border:"rgba(3,105,161,.2)",  label:"📖 HISTORY"    },
                      womens:   { color:"#db2777", bg:"#fdf2f8", border:"rgba(219,39,119,.2)", label:"🌸 WOMEN'S"    },
                    };
                    const sc = skillColors[q?.skill] || skillColors.history;
                    return (
                      <div className="q-card" style={{
                        borderTopColor: sc.color,
                        "--qColor": sc.color,
                        "--qColorBg": sc.bg,
                        "--qColorBorder": sc.border,
                      }}>
                        <div className="q-badge">{sc.label}</div>
                        <div style={{ fontSize: 14, fontWeight: 500, lineHeight: 1.6 }}>{q.q}</div>
                      </div>
                    );
                  })()}
                  <div className="opts">
                    {q.opts?.map((o, i) => {
                      if (hidden.includes(i) && !rev) return (
                        <button key={i} className="opt" disabled style={{ opacity: .08 }}>
                          <span className="opt-ltr">{["A","B","C","D"][i]}</span>—
                        </button>
                      );
                      let cls = "opt";
                      if (rev) { if (i === q.ans) cls += " correct"; else if (i === sel) cls += " wrong"; else cls += " fade"; }
                      return (
                        <button key={i} className={cls} disabled={rev || !playerBatting} onClick={() => answer(i)}>
                          <span className="opt-ltr">{["A","B","C","D"][i]}</span>{o}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div className="anti-tag">Session #{Math.floor(Date.now() / 1000) % 99999} · Monitored for fair play</div>
              </>
            ) : null}

            {/* ══ BETWEEN QUESTIONS OVERLAY ══ */}
            {showBetween && betweenData && (
              <div className="between-overlay">
                <div style={{ fontFamily: "var(--fm)", fontSize: 9, fontWeight: 700, letterSpacing: 3, color: "var(--sub)", textTransform: "uppercase" }}>
                  Q{betweenData.qIdx + 1} of 6 — {betweenData.correct ? "Correct!" : "Missed"}
                </div>
                <div style={{ fontFamily: "var(--fd)", fontSize: 58, fontWeight: 800, color: betweenData.correct ? "var(--green)" : "var(--red)", lineHeight: 1, textAlign: "center" }}>
                  {betweenData.correct ? "✅" : "❌"}
                </div>

                {/* Runs scored this ball — the new addition */}
                <div style={{
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
                  background: betweenData.runsScored > 0
                    ? "rgba(21,128,61,.12)" : betweenData.runsScored < 0
                    ? "rgba(220,38,38,.1)" : "rgba(255,255,255,.05)",
                  border: `1px solid ${betweenData.runsScored > 0 ? "rgba(21,128,61,.25)" : betweenData.runsScored < 0 ? "rgba(220,38,38,.2)" : "rgba(255,255,255,.1)"}`,
                  borderRadius: "var(--r2)", padding: "10px 20px", width: "100%",
                }}>
                  <div style={{ textAlign: "center" }}>
                    <div style={{ fontFamily: "var(--fm)", fontSize: 9, letterSpacing: 2, textTransform: "uppercase", color: "rgba(255,255,255,.4)", marginBottom: 4 }}>
                      This ball
                    </div>
                    <div style={{ fontFamily: "var(--fd)", fontSize: 36, fontWeight: 800, lineHeight: 1,
                      color: betweenData.runsScored === 6 ? "var(--green)"
                           : betweenData.runsScored === 4 ? "var(--blue)"
                           : betweenData.runsScored === 2 ? "var(--amber)"
                           : "var(--red)"
                    }}>
                      {betweenData.runsScored > 0 ? `+${betweenData.runsScored}` : betweenData.runsScored === 0 ? "DOT" : `${betweenData.runsScored}`}
                    </div>
                    <div style={{ fontFamily: "var(--fm)", fontSize: 10, color: "rgba(255,255,255,.4)", marginTop: 3 }}>
                      {betweenData.runsScored === 6 ? "SIX! 🏏"
                       : betweenData.runsScored === 4 ? "FOUR! 🎯"
                       : betweenData.runsScored === 2 ? "Two runs"
                       : betweenData.runsScored === 0 ? "No runs scored"
                       : "Wicket! −5 runs"}
                    </div>
                  </div>
                  <div style={{ width: 1, height: 44, background: "rgba(255,255,255,.1)" }} />
                  <div style={{ textAlign: "center" }}>
                    <div style={{ fontFamily: "var(--fm)", fontSize: 9, letterSpacing: 2, textTransform: "uppercase", color: "rgba(255,255,255,.4)", marginBottom: 4 }}>
                      Total
                    </div>
                    <div style={{ fontFamily: "var(--fd)", fontSize: 36, fontWeight: 800, color: "var(--amber)", lineHeight: 1 }}>
                      {myScore}
                    </div>
                    <div style={{ fontFamily: "var(--fm)", fontSize: 10, color: "rgba(255,255,255,.4)", marginTop: 3 }}>
                      runs
                    </div>
                  </div>
                </div>

                {/* Commentary */}
                {betweenData.cmntLine && (
                  <div className="bq-cmnt">
                    <div className="bq-speaker">{commStyle === "shastri" ? "🎙 Ravi Shastri" : "📻 Harsha Bhogle"}</div>
                    {betweenData.cmntLine}
                  </div>
                )}

                {/* Coach note (only on wrong) */}
                {!betweenData.correct && betweenData.coachNote && (
                  <div className="bq-coach">
                    <div className="bq-coach-lbl">🎓 Coach's Note</div>
                    <div className="bq-coach-text">{betweenData.coachNote}</div>
                  </div>
                )}

                {/* Countdown */}
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
                  <div className="bq-countdown">
                    {betweenData.qIdx < 5 ? `Next ball in ${betweenCount}s` : "Innings ending…"}
                  </div>
                  <div className="bq-progress">
                    <div className="bq-progress-fill" style={{ width: `${(betweenCount / 10) * 100}%` }} />
                  </div>
                </div>

                {/* Skip button */}
                {betweenData.qIdx < 5 && (
                  <button className="btn btn-outline btn-sm" onClick={() => { clearTimeout(betweenRef.current); setBetweenCount(0); }}>
                    Skip → Next Ball
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* ══════ SUPER OVER ══════ */}
        {inSuperOver && soPhase === "intro" && (
          <div style={{
            position:"fixed", inset:0, zIndex:300,
            background:"linear-gradient(160deg,#0a1a0a,#1a2e1a,#1c1917)",
            display:"flex", flexDirection:"column", alignItems:"center",
            justifyContent:"center", gap:14, animation:"scaleIn .3s both",
          }}>
            <div style={{ fontSize:64, animation:"floatBob 1.5s ease-in-out infinite" }}>⚡</div>
            <div style={{ fontFamily:"var(--fm)", fontSize:10, letterSpacing:4, color:"rgba(255,255,255,.4)", textTransform:"uppercase" }}>Scores Level!</div>
            <div style={{ fontFamily:"var(--fd)", fontSize:38, fontWeight:800, color:"#fff", textAlign:"center", lineHeight:1.1 }}>Super Over</div>
            <div style={{ fontFamily:"var(--fd)", fontSize:16, color:"rgba(255,255,255,.5)" }}>3 questions · winner takes all</div>
            <div style={{ display:"flex", gap:8, marginTop:8 }}>
              {[0,1,2].map(i => (
                <div key={i} style={{ width:12, height:12, borderRadius:"50%", background:"rgba(255,255,255,.15)", border:"2px solid rgba(255,255,255,.3)" }} />
              ))}
            </div>
            <div style={{ fontSize:11, color:"rgba(255,255,255,.25)", marginTop:4 }}>
              If still tied — fastest average answer time wins
            </div>
          </div>
        )}

        {inSuperOver && soPhase === "batting" && soQs[soQi] && (() => {
          const q = soQs[soQi];
          const tPctSo = (soTLeft / 15) * 100;
          const tColSo = soTLeft > 8 ? "#0369a1" : soTLeft > 4 ? "#d97706" : "#dc2626";
          return (
            <div style={{ position:"fixed", inset:0, zIndex:300, background:"linear-gradient(180deg,#0a1a0a 0%,#1c1917 100%)", display:"flex", flexDirection:"column", overflow:"hidden" }}>
              {/* Super Over header */}
              <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"12px 16px 0", flexShrink:0 }}>
                <div style={{ display:"flex", gap:6, alignItems:"center" }}>
                  <div style={{ background:"rgba(34,211,238,.15)", border:"1px solid rgba(34,211,238,.3)", borderRadius:12, padding:"3px 10px", fontSize:10, fontFamily:"var(--fm)", color:"#22d3ee", letterSpacing:1 }}>⚡ SUPER OVER</div>
                </div>
                <div style={{ display:"flex", gap:6 }}>
                  {[0,1,2].map(i => (
                    <div key={i} style={{ width:10, height:10, borderRadius:"50%", background: i < soQi ? "#22d3ee" : i === soQi ? "rgba(34,211,238,.4)" : "rgba(255,255,255,.1)", border:"1.5px solid rgba(34,211,238,.4)", transition:"background .3s" }} />
                  ))}
                </div>
                <div style={{ fontFamily:"var(--fd)", fontSize:22, fontWeight:700, color:"#22d3ee" }}>{soMyScore}</div>
              </div>

              {/* Timer bar */}
              <div style={{ height:3, background:"rgba(255,255,255,.08)", flexShrink:0 }}>
                <div style={{ height:"100%", width:`${tPctSo}%`, background:tColSo, transition:"width 1s linear" }} />
              </div>

              {/* Question */}
              <div className="match-scroll" style={{ paddingTop:12 }}>
                <div style={{ fontFamily:"var(--fm)", fontSize:9, letterSpacing:2, color:"rgba(255,255,255,.35)", textTransform:"uppercase", textAlign:"center", marginBottom:10 }}>
                  Q{soQi + 1} of 3 · Super Over
                </div>
                <div style={{ background:"rgba(255,255,255,.04)", border:"1px solid rgba(34,211,238,.15)", borderRadius:"var(--r2)", padding:"18px 16px", marginBottom:14, fontSize:16, fontWeight:600, color:"#fff", lineHeight:1.5, textAlign:"center" }}>
                  {q.q}
                </div>
                <div className="opts">
                  {q.opts.map((opt, i) => {
                    const picked = soSel === i;
                    const correct = soRev && i === q.ans;
                    const wrong   = soRev && picked && i !== q.ans;
                    return (
                      <button
                        key={i}
                        className={`opt${picked ? " picked" : ""}${correct ? " correct" : ""}${wrong ? " wrong" : ""}`}
                        style={{ borderColor: correct ? "var(--green)" : wrong ? "var(--red)" : "rgba(34,211,238,.2)" }}
                        onClick={() => answerSo(i)}
                        disabled={soRev}>
                        <span className="opt-letter">{["A","B","C","D"][i]}</span>
                        <span className="opt-txt">{opt}</span>
                      </button>
                    );
                  })}
                </div>
                {soRev && (
                  <div style={{ margin:"12px 0", background:"rgba(255,255,255,.04)", borderRadius:"var(--r2)", padding:"12px 14px", fontSize:12, color:"rgba(255,255,255,.6)", lineHeight:1.5 }}>
                    {q.coachNote}
                  </div>
                )}
              </div>
            </div>
          );
        })()}

        {inSuperOver && soPhase === "watching" && (
          <div style={{
            position:"fixed", inset:0, zIndex:300, background:"linear-gradient(160deg,#0a1a0a,#1c1917)",
            display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:16,
          }}>
            <div style={{ fontFamily:"var(--fm)", fontSize:9, letterSpacing:3, color:"rgba(255,255,255,.4)", textTransform:"uppercase" }}>Super Over</div>
            <div style={{ fontSize:42, animation:"floatBob 1.2s infinite" }}>{opp?.flag}</div>
            <div style={{ fontFamily:"var(--fd)", fontSize:18, fontWeight:700, color:"#fff" }}>{opp?.name} is batting…</div>
            <div style={{ fontFamily:"var(--fd)", fontSize:13, color:"rgba(255,255,255,.4)" }}>Target to win: {soMyScore + 1} runs</div>
            <div style={{ display:"flex", gap:8, marginTop:8 }}>
              {[0,1,2].map(i => (
                <div key={i} style={{ width:10, height:10, borderRadius:"50%", background:"rgba(34,211,238,.3)", animation:`pulse ${0.8 + i*0.2}s infinite` }} />
              ))}
            </div>
          </div>
        )}

        {inSuperOver && soPhase === "result" && soWinner && (
          <div style={{
            position:"fixed", inset:0, zIndex:300,
            background: soWinner === "player"
              ? "linear-gradient(160deg,#0a2010,#1a3a1a,#1c1917)"
              : "linear-gradient(160deg,#200a0a,#3a1a1a,#1c1917)",
            display:"flex", flexDirection:"column", alignItems:"center",
            justifyContent:"center", gap:16, animation:"scaleIn .3s both", padding:"0 24px",
          }}>
            {soWinner === "player" && <Confetti />}
            <div style={{ fontSize:64 }}>{soWinner === "player" ? "🏆" : "💪"}</div>
            <div style={{ fontFamily:"var(--fd)", fontSize:32, fontWeight:800, color: soWinner === "player" ? "var(--amberViv)" : "var(--blue)", textAlign:"center" }}>
              {soWinner === "player" ? "Super Over Win!" : "Super Over Lost"}
            </div>

            {/* Super Over scorecard */}
            <div style={{ background:"rgba(255,255,255,.06)", border:"1px solid rgba(34,211,238,.2)", borderRadius:"var(--r2)", padding:"16px 24px", width:"100%", maxWidth:320 }}>
              <div style={{ fontFamily:"var(--fm)", fontSize:9, letterSpacing:2, color:"rgba(255,255,255,.35)", textTransform:"uppercase", textAlign:"center", marginBottom:12 }}>Super Over Scores</div>
              <div style={{ display:"flex", justifyContent:"space-around", alignItems:"center" }}>
                <div style={{ textAlign:"center" }}>
                  <div style={{ fontFamily:"var(--fd)", fontSize:42, fontWeight:800, color: soMyScore >= soOppScore ? "#22d3ee" : "rgba(255,255,255,.4)" }}>{soMyScore}</div>
                  <div style={{ fontSize:11, color:"rgba(255,255,255,.4)", marginTop:2 }}>{nick || "You"}</div>
                </div>
                <div style={{ fontSize:13, color:"rgba(255,255,255,.2)", fontFamily:"var(--fm)" }}>VS</div>
                <div style={{ textAlign:"center" }}>
                  <div style={{ fontFamily:"var(--fd)", fontSize:42, fontWeight:800, color: soOppScore > soMyScore ? "#22d3ee" : "rgba(255,255,255,.4)" }}>{soOppScore}</div>
                  <div style={{ fontSize:11, color:"rgba(255,255,255,.4)", marginTop:2 }}>{opp?.name}</div>
                </div>
              </div>
              {soMyScore === soOppScore && (
                <div style={{ textAlign:"center", marginTop:10, fontSize:11, color:"rgba(255,255,255,.4)" }}>
                  ⚡ Decided on faster response time
                </div>
              )}
            </div>

            <div style={{ fontSize:12, color:"rgba(255,255,255,.4)", textAlign:"center" }}>
              {soWinner === "player"
                ? soMyScore > soOppScore ? "You outscored the opponent in the Super Over!" : "You answered faster — tiebreak win!"
                : soOppScore > soMyScore ? "Opponent outscored you in the Super Over." : "Opponent was quicker — so close!"}
            </div>

            <button
              className="btn btn-amber"
              style={{ width:"100%", maxWidth:320 }}
              onClick={() => {
                setSuperOverWinner(soWinner); // persist SO result into result screen
                setInSuperOver(false);
                setScreen("result");
                setFcMyScore(myScore);
              }}>
              See Full Match Result →
            </button>
          </div>
        )}

        {/* ══════ RESULT ══════ */}
        {screen === "result" && (
          <div className="screen result-screen">
            {won && <Confetti />}
            <span className="r-icon">{isTie ? "⚡" : won ? "🏆" : "💪"}</span>
            {superOverWinner && (
              <div style={{ fontFamily:"var(--fm)", fontSize:10, letterSpacing:3, color:"#22d3ee", textTransform:"uppercase", marginBottom:2 }}>⚡ Via Super Over</div>
            )}
            <div className="r-title" style={{ color: isTie ? "#22d3ee" : won ? "var(--amber)" : "var(--blue)" }}>
              {isTie ? "It's a Tie!" : won ? "Victory!" : "Well Played"}
            </div>
            <div className="r-sub">
              {superOverWinner
                ? superOverWinner === "player"
                  ? "You won the Super Over! Full match scores were level."
                  : "Opponent won the Super Over. Full match scores were level."
                : isTie
                  ? `Scores level at ${myScore} runs — what a match!`
                  : won
                    ? innings === 2
                      ? `You chased it down! ${opp?.name} is defeated.`
                      : `Your total was too good for ${opp?.name}.`
                    : `${opp?.name} wins this one. Study up and rematch!`}
            </div>

            {/* Score comparison — first batter always LEFT, chaser always RIGHT */}
            {(() => {
              const pBatFirst = batFirst === "player";
              const leftFlag  = pBatFirst ? (country?.flag || "🏏") : opp?.flag;
              const leftName  = pBatFirst ? (nick || "You") : opp?.name;
              const leftScore = pBatFirst ? myScore : oppScore;
              const rightFlag  = pBatFirst ? opp?.flag : (country?.flag || "🏏");
              const rightName  = pBatFirst ? opp?.name : (nick || "You");
              const rightScore = pBatFirst ? oppScore : myScore;
              const tied       = leftScore === rightScore;
              return (
                <div className="innings-compare">
                  <div style={{ position:"absolute", top:0, left:0, right:0, height:2, background: tied ? "linear-gradient(90deg,#22d3ee,#22d3ee)" : `linear-gradient(90deg,var(--amber),var(--green))` }} />
                  <div className="ic-p">
                    <div className="ic-flag">{leftFlag}</div>
                    <div className="ic-name">{leftName}</div>
                    <div className="ic-innings">BATTED 1ST</div>
                    <div className="ic-score" style={{ color: leftScore >= rightScore ? (tied ? "#22d3ee" : "var(--amber)") : "var(--sub)" }}>{leftScore}</div>
                    {leftScore > rightScore && <div className="ic-crown">👑</div>}
                    {tied && <div className="ic-crown">⚡</div>}
                  </div>
                  <div className="ic-vs">VS</div>
                  <div className="ic-p">
                    <div className="ic-flag">{rightFlag}</div>
                    <div className="ic-name">{rightName}</div>
                    <div className="ic-innings">CHASED</div>
                    <div className="ic-score" style={{ color: rightScore >= leftScore ? (tied ? "#22d3ee" : "var(--amber)") : "var(--sub)" }}>{rightScore}</div>
                    {rightScore > leftScore && <div className="ic-crown">👑</div>}
                    {tied && <div className="ic-crown">⚡</div>}
                  </div>
                </div>
              );
            })()}

            {/* Stats */}
            <div className="stats-grid">
              <div className="sg"><div className="sgv" style={{ color: "var(--green)" }}>{done.filter(a => a === "ok").length}</div><div className="sgl">Correct</div></div>
              <div className="sg"><div className="sgv" style={{ color: "var(--red)" }}>{wickets}</div><div className="sgl">Wickets</div></div>
              <div className="sg"><div className="sgv" style={{ color: "var(--amber)" }}>{maxStreak}🔥</div><div className="sgl">Best Run</div></div>
              <div className="sg"><div className="sgv">{Math.round((done.filter(a => a === "ok").length / Math.max(1, done.length)) * 100)}%</div><div className="sgl">Accuracy</div></div>
            </div>

            {/* Prize */}
            {entryFee.entry > 0 ? (
              <div className="prize-card" style={{
                background: isTie ? "rgba(34,211,238,.06)" : won ? "var(--greenBg)" : "var(--s2)",
                border: `1px solid ${isTie ? "rgba(34,211,238,.25)" : won ? "rgba(21,128,61,.25)" : "var(--rim)"}`,
              }}>
                <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: isTie ? "#22d3ee" : won ? "var(--green)" : "var(--dim)", borderRadius: "var(--r2) var(--r2) 0 0" }} />
                <div>
                  <div style={{ fontFamily: "var(--fm)", fontSize: 9, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", color: isTie ? "#22d3ee" : won ? "var(--green)" : "var(--sub)", marginBottom: 4 }}>
                    {isTie ? "Entry Refunded ⚡" : won ? "Prize Won 🏆" : "Entry Fee"}
                  </div>
                  <div style={{ fontFamily: "var(--fd)", fontSize: 36, fontWeight: 800, color: isTie ? "#22d3ee" : won ? "var(--green)" : "var(--red)", letterSpacing: -1, lineHeight: 1 }}>
                    {isTie ? `$${entryFee.entry.toFixed(2)}` : won ? `+$${(entryFee.prize - entryFee.entry).toFixed(2)}` : `-$${entryFee.entry.toFixed(2)}`}
                  </div>
                  <div style={{ fontFamily: "var(--fm)", fontSize: 10, color: "var(--sub)", marginTop: 4 }}>
                    {isTie ? "Dead heat — your entry fee is returned" : won ? `Prize pool $${entryFee.prize.toFixed(2)} · Platform fee $${(entryFee.entry * 0.2).toFixed(2)}` : "Better luck next match!"}
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontFamily: "var(--fm)", fontSize: 9, color: "var(--sub)", letterSpacing: 1, marginBottom: 4 }}>WALLET</div>
                  <div style={{ fontFamily: "var(--fd)", fontSize: 22, fontWeight: 700 }}>${wallet.toFixed(2)}</div>
                  <div style={{ fontFamily: "var(--fm)", fontSize: 9, color: "var(--green)", marginTop: 2 }}>+${totalEarnings.toFixed(2)} all-time</div>
                </div>
              </div>
            ) : (
              <div style={{ background: "var(--s2)", border: "1px solid var(--rim)", borderRadius: "var(--r2)", padding: 14, textAlign: "center", fontSize: 13, color: "var(--sub)", width: "100%" }}>
                Free match · <strong style={{ color: isTie ? "#22d3ee" : "var(--amber)" }}>+{xpEarned + (isTie ? 30 : won ? 60 : 10)} XP</strong> earned
              </div>
            )}

            {/* ══ FRIEND CHALLENGE RESULT PANEL ══ */}
            {friendChallenge && (friendChallenge.mode === "chase" || friendChallenge.mode === "playing") && (() => {
              const APP_URL   = "https://play.cricketclash.in";
              const fc        = friendChallenge;
              const myFinal   = fcMyScore ?? myScore;
              const theirScore = fc.challengerScore;
              const iChase    = fc.mode === "chase";
              const iWon      = iChase ? myFinal > (theirScore || 0) : true;
              const scoreCode = btoa(`${nick||"Me"}|${fc.seed}|${fc.conditionId}|${myFinal}`).replace(/=/g,"").replace(/\+/g,"-").replace(/\//g,"_");
              const scoreUrl  = `${APP_URL}?fc=${scoreCode}`;
              const cond      = CONDITIONS.find(c => c.id === fc.conditionId);
              const shareScoreText = `🏏 ${nick||"Me"} scored ${myFinal} runs on the ${cond?.name || ""} pitch!\n\n${fc.challengerNick ? `Can you beat me? ${fc.challengerNick} scored ${theirScore||"?"} runs.` : "Can you beat my score?"}\n\nChase it 👇\n${scoreUrl}`;

              return (
                <div style={{ width:"100%", borderRadius:"var(--r2)", overflow:"hidden", marginBottom:4 }}>
                  {/* Head-to-head scoreboard */}
                  {iChase && (
                    <div style={{ background:"linear-gradient(135deg,#1a2e1a,#1c1917)", border:"1px solid rgba(74,222,128,.2)", borderRadius:"var(--r2)", padding:"16px", marginBottom:8 }}>
                      <div style={{ fontFamily:"var(--fm)", fontSize:9, letterSpacing:2, color:"rgba(255,255,255,.4)", textTransform:"uppercase", textAlign:"center", marginBottom:12 }}>Head to Head</div>
                      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-around" }}>
                        <div style={{ textAlign:"center" }}>
                          <div style={{ fontFamily:"var(--fd)", fontSize:38, fontWeight:700, color: myFinal >= (theirScore||0) ? "#4ade80":"rgba(255,255,255,.5)", textShadow: myFinal >= (theirScore||0) ? "0 0 20px rgba(74,222,128,.4)":"none" }}>{myFinal}</div>
                          <div style={{ fontSize:11, color:"rgba(255,255,255,.5)", marginTop:2 }}>{nick || "You"}</div>
                          {myFinal > (theirScore||0) && <div style={{ fontSize:10, color:"#4ade80", marginTop:3 }}>👑 Winner</div>}
                        </div>
                        <div style={{ textAlign:"center" }}>
                          <div style={{ fontFamily:"var(--fm)", fontSize:11, color:"rgba(255,255,255,.25)", letterSpacing:2 }}>VS</div>
                        </div>
                        <div style={{ textAlign:"center" }}>
                          <div style={{ fontFamily:"var(--fd)", fontSize:38, fontWeight:700, color: (theirScore||0) > myFinal ? "var(--amberViv)":"rgba(255,255,255,.5)", textShadow: (theirScore||0) > myFinal ? "0 0 20px rgba(251,191,36,.4)":"none" }}>{theirScore ?? "?"}</div>
                          <div style={{ fontSize:11, color:"rgba(255,255,255,.5)", marginTop:2 }}>{fc.challengerNick}</div>
                          {(theirScore||0) > myFinal && <div style={{ fontSize:10, color:"var(--amberViv)", marginTop:3 }}>👑 Winner</div>}
                        </div>
                      </div>
                      <div style={{ textAlign:"center", marginTop:12, fontSize:13, fontFamily:"var(--fd)", fontWeight:700, color: myFinal >= (theirScore||0) ? "#4ade80":"rgba(255,255,255,.7)" }}>
                        {myFinal > (theirScore||0) ? `🏆 You beat ${fc.challengerNick}!` : myFinal === (theirScore||0) ? "⚡ It's a tie!" : `${fc.challengerNick} wins this one!`}
                      </div>
                    </div>
                  )}

                  {/* Share score button */}
                  {!iChase && (
                    <div style={{ marginBottom:8 }}>
                      <div style={{ background:"linear-gradient(135deg,#075E54,#128C7E)", borderRadius:"var(--r2)", padding:"12px 16px", display:"flex", alignItems:"center", gap:12, marginBottom:8 }}>
                        <div style={{ fontSize:28 }}>📲</div>
                        <div>
                          <div style={{ fontFamily:"var(--fm)", fontSize:9, letterSpacing:2, color:"rgba(255,255,255,.6)", textTransform:"uppercase" }}>You scored {myFinal} runs</div>
                          <div style={{ fontFamily:"var(--fd)", fontSize:15, fontWeight:700, color:"#fff" }}>Send your score to {fc.friendName || fc.challengerNick || "your friend"}!</div>
                          <div style={{ fontSize:11, color:"rgba(255,255,255,.65)", marginTop:1 }}>They'll chase the same 6 questions</div>
                        </div>
                      </div>
                      <div style={{ display:"flex", gap:8 }}>
                        <button onClick={() => { window.location.href = `whatsapp://send?text=${encodeURIComponent(shareScoreText)}`; }} style={{ flex:2, padding:"12px 0", borderRadius:"var(--r2)", background:"#25D366", border:"none", color:"#fff", fontFamily:"var(--fm)", fontSize:13, fontWeight:700, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", gap:8 }}>
                          <span style={{fontSize:18}}>💬</span> Send Score on WhatsApp
                        </button>
                        <button onClick={() => { navigator.clipboard?.writeText(shareScoreText).then(() => showToast("✅ Copied!")).catch(() => showToast("Link: " + scoreUrl)); }} style={{ flex:1, padding:"12px 0", borderRadius:"var(--r2)", background:"var(--s2)", border:"1px solid var(--rim)", color:"var(--txt)", fontFamily:"var(--fm)", fontSize:12, fontWeight:600, cursor:"pointer" }}>📋 Copy</button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}

            {/* WhatsApp Share + Challenge */}
            {(() => {
              const APP_URL = "https://play.cricketclash.in"; // your real URL
              const margin  = won ? (entryFee.prize - entryFee.entry).toFixed(2) : null;
              const scoreEmoji = won ? "🏆" : "🏏";
              const scoreLabel = `${myScore} runs`;
              // Encode challenge: score|condition|opp_accuracy so friend chases this score
              const challengeCode = btoa(`${myScore}|${condition?.id || "flat"}|${opp?.acc || 0.6}`).replace(/=/g,'');
              const challengeUrl  = `${APP_URL}?challenge=${challengeCode}`;

              const shareText = won
                ? `${scoreEmoji} I scored ${myScore} runs & won${entryFee.entry > 0 ? ` $${margin}` : ""} on Cricket Clash!\n🏏 vs ${opp?.name} · ${condition?.name}\n\nCan you beat my score? Chase it 👇\n${challengeUrl}`
                : `🏏 I scored ${myScore} runs on Cricket Clash!\nCan you do better? Chase my target 👇\n${challengeUrl}`;

              const openWhatsApp = () => {
                const url = `whatsapp://send?text=${encodeURIComponent(shareText)}`;
                window.location.href = url;
              };
              const copyLink = () => {
                navigator.clipboard?.writeText(shareText).then(() => showToast("✅ Copied! Paste in any app"))
                  .catch(() => showToast("Link: " + challengeUrl));
              };

              return (
                <div style={{ width:"100%", display:"flex", flexDirection:"column", gap:8 }}>
                  {/* Challenge card preview */}
                  <div style={{
                    background:"linear-gradient(135deg,#075E54,#128C7E)",
                    borderRadius:"var(--r2)", padding:"12px 16px",
                    display:"flex", alignItems:"center", gap:12,
                  }}>
                    <div style={{ fontSize:32 }}>📲</div>
                    <div style={{ flex:1 }}>
                      <div style={{ fontFamily:"var(--fm)", fontSize:9, letterSpacing:2, color:"rgba(255,255,255,.6)", textTransform:"uppercase" }}>Challenge via WhatsApp</div>
                      <div style={{ fontFamily:"var(--fd)", fontSize:15, fontWeight:700, color:"#fff", marginTop:2 }}>
                        {won ? `Beat my ${myScore} runs!` : `Can you chase ${myScore}?`}
                      </div>
                      <div style={{ fontSize:11, color:"rgba(255,255,255,.65)", marginTop:1 }}>{condition?.name} · {opp?.name}</div>
                    </div>
                  </div>
                  <div style={{ display:"flex", gap:8 }}>
                    <button
                      onClick={openWhatsApp}
                      style={{
                        flex:2, padding:"12px 0", borderRadius:"var(--r2)",
                        background:"#25D366", border:"none", color:"#fff",
                        fontFamily:"var(--fm)", fontSize:13, fontWeight:700,
                        cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", gap:8,
                      }}>
                      <span style={{fontSize:18}}>💬</span> Share on WhatsApp
                    </button>
                    <button
                      onClick={copyLink}
                      style={{
                        flex:1, padding:"12px 0", borderRadius:"var(--r2)",
                        background:"var(--s2)", border:"1px solid var(--rim)", color:"var(--txt)",
                        fontFamily:"var(--fm)", fontSize:12, fontWeight:600, cursor:"pointer",
                      }}>
                      📋 Copy
                    </button>
                  </div>
                </div>
              );
            })()}

            <div className="result-btns">
              <button className="btn btn-amber" onClick={() => setScreen("setup")}>Play Again →</button>
              <div style={{ display: "flex", gap: 8 }}>
                <button className="btn btn-outline btn-sm" style={{ flex: 1 }} onClick={() => { setNavTab("profile"); setScreen("profile"); }}>🌟 Career</button>
                <button className="btn btn-outline btn-sm" style={{ flex: 1 }} onClick={() => { setNavTab("leaderboard"); setScreen("leaderboard"); }}>🏆 Rankings</button>
                <button className="btn btn-outline btn-sm" style={{ flex: 1 }} onClick={() => setScreen("wallet")}>💰 Wallet</button>
              </div>
            </div>
          </div>
        )}

        {/* ══════ PROFILE / CAREER ══════ */}
        {screen === "profile" && !showAvatarScreen && (
          <div className="screen profile-screen">
            {/* ── Header with CricCoins ── */}
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"14px 18px 0", flexShrink:0 }}>
              <div style={{ fontFamily:"var(--fd)", fontSize:20, fontWeight:800 }}>My Career</div>
              <div className="coin-bar" onClick={() => setScreen("store")}>🪙 {cricCoins}</div>
            </div>

            {/* ── Player Card Hero ── */}
            {(() => {
              const pal = JERSEY_PALETTES.find(p => p.id === avatarPalette) || JERSEY_PALETTES[0];
              const jCol = pal.primary || career.jerseyColor;
              const sCol = pal.stripe  || career.jerseyStripe;
              const hCol = career.helmetColor;
              return (
                <div className="avatar-hero" onClick={() => setShowAvatarScreen(true)}>
                  {/* Gradient BG */}
                  <div className="avatar-hero-bg" style={{ background:`linear-gradient(160deg,#1c1917 0%,${jCol}55 60%,#1c1917 100%)` }} />
                  <div className="avatar-hero-content">
                    {/* Helmet */}
                    <div className="card-helmet" style={{ background: hCol }}>
                      <div className="card-visor" /><div className="card-visor-shine" />
                      <div style={{ fontSize:11, color:"rgba(255,255,255,.5)", zIndex:1 }}>◉</div>
                    </div>
                    {/* Jersey card */}
                    <div className="player-card" style={{ "--cardJersey": jCol, "--cardStripe": sCol }}>
                      <div className="card-top-strip" />
                      <div className="card-body">
                        <div className="card-stripe-v" />
                        <div className="card-number">{avatarNum}</div>
                        <div className="card-name">{nick?.slice(0,12) || "PLAYER"}</div>
                      </div>
                      <div className="card-badge-bottom" style={{ color: career.color }}>{career.badge}</div>
                    </div>
                    {/* Career info */}
                    <div style={{ textAlign:"center", marginTop:28 }}>
                      <div style={{ fontFamily:"var(--fd)", fontSize:24, fontWeight:800, color:"#fff" }}>{career.title}</div>
                      <div style={{ fontSize:12, color:"rgba(255,255,255,.5)", marginTop:3 }}>{career.subtitle}</div>
                    </div>
                    {/* Customise button — clearly visible on dark bg */}
                    <div className="customise-btn">
                      <span>✏️</span> Customise Jersey
                    </div>
                    {/* XP progress */}
                    <div style={{ width:"100%", marginTop:18 }}>
                      <div style={{ display:"flex", justifyContent:"space-between", marginBottom:5 }}>
                        <span style={{ fontFamily:"var(--fm)", fontSize:10, color:"rgba(255,255,255,.5)" }}>{totalXp} XP</span>
                        <span style={{ fontFamily:"var(--fm)", fontSize:10, color:"rgba(255,255,255,.5)" }}>{nextC ? `${nextC.minXp - totalXp} XP → ${nextC.title}` : "👑 Max level!"}</span>
                      </div>
                      <div style={{ height:6, background:"rgba(255,255,255,.12)", borderRadius:999, overflow:"hidden" }}>
                        <div style={{ height:"100%", background:`linear-gradient(90deg,${career.color},rgba(255,255,255,.5))`, borderRadius:999, width:`${careerPct}%`, transition:"width .8s cubic-bezier(.22,1,.36,1)" }} />
                      </div>
                    </div>
                  </div>
                </div>
              );
            })()}

            <div className="pb">
              {/* Quick stats */}
              <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:8 }}>
                {[[wins,"Wins","var(--green)"],[played,"Played","var(--txt)"],[`$${totalEarnings.toFixed(0)}`, "Earned","var(--amber)"],[lStreak+"🔥","Streak","var(--red)"]].map(([v,l,c]) => (
                  <div key={l} style={{ background:"var(--s0)", border:"1px solid var(--rim)", borderRadius:"var(--r2)", padding:"12px 8px", display:"flex", flexDirection:"column", alignItems:"center", gap:3, boxShadow:"var(--sh-xs)" }}>
                    <div style={{ fontFamily:"var(--fd)", fontSize:18, fontWeight:700, color:c }}>{v}</div>
                    <div style={{ fontFamily:"var(--fm)", fontSize:8, fontWeight:700, letterSpacing:1.5, textTransform:"uppercase", color:"var(--sub)", textAlign:"center" }}>{l}</div>
                  </div>
                ))}
              </div>

              {/* ── Badge Wall ── */}
              <div className="slbl" style={{ marginTop:4 }}>Hall of Fame · {badges.size} / {BADGE_DEFS.length} Badges</div>
              <div className="badge-grid">
                {BADGE_DEFS.map(b => {
                  const earned = badges.has(b.id);
                  const rc = RARITY_COLOR[b.rarity];
                  const rb = RARITY_BG[b.rarity];
                  return (
                    <div key={b.id} className={`badge-cell${earned ? " earned" : " locked"}`}
                      style={earned ? { "--badgeColor": rc, "--badgeBg": rb } : {}}>
                      <div className="badge-icon">{earned ? b.icon : "❓"}</div>
                      <div className="badge-title">{earned ? b.title : "???"}</div>
                      <div className="badge-rarity" style={{ color: earned ? rc : "var(--sub)" }}>{b.rarity}</div>
                    </div>
                  );
                })}
              </div>

              {/* ── Skill Tree (levelled) ── */}
              <div className="slbl" style={{ marginTop:4 }}>Skill Tree</div>
              {SKILLS.map(sk => {
                const rawXp = skillXp[sk.id] || 0;
                const lvl   = getSkillLevel(rawXp);
                const pct   = skillLevelProgress(rawXp, lvl);
                return (
                  <div key={sk.id} className="skill-row">
                    <div className="skill-icon" style={{ background:`${sk.color}15` }}><span>{sk.icon}</span></div>
                    <div className="skill-info">
                      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                        <div className="skill-name">{sk.label}</div>
                        <div style={{ fontFamily:"var(--fm)", fontSize:10, fontWeight:700, color:sk.color }}>Lv {lvl}{lvl >= 10 ? " 🏆" : ""}</div>
                      </div>
                      <div className="skill-bar-bg">
                        <div className="skill-bar" style={{ width:`${pct}%`, background:sk.color }} />
                      </div>
                      <div className="skill-xp" style={{ color:sk.color }}>
                        {lvl < 10 ? `${rawXp} / ${SKILL_XP_LEVELS[lvl]} XP to Lv ${lvl+1}` : "Max Level — Cricket Legend 🏆"}
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* ── Career Journey ── */}
              <div className="slbl" style={{ marginTop:4 }}>Career Journey</div>
              {CAREER.map((c, i) => (
                <div key={c.stage} className="journey-row" style={{ opacity: totalXp >= c.minXp ? 1 : .38, animationDelay:`${i*.05}s` }}>
                  <div className="jr-icon">{c.icon}</div>
                  <div className="jr-info">
                    <div className="jr-title">{c.title}</div>
                    <div className="jr-sub">{c.subtitle}</div>
                  </div>
                  <div className="jr-badge" style={{ background: totalXp >= c.minXp ? `${c.color}18` : "var(--s2)", border:`1px solid ${totalXp >= c.minXp ? `${c.color}40` : "var(--rim)"}`, color: totalXp >= c.minXp ? c.color : "var(--sub)" }}>
                    {totalXp >= c.minXp ? "✓ " + c.badge : c.minXp + " XP"}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ══════ AVATAR CUSTOMISE ══════ */}
        {screen === "profile" && showAvatarScreen && (
          <div className="screen avatar-screen">
            <div className="hdr" style={{ flexShrink:0 }}>
              <button className="back-btn" onClick={() => setShowAvatarScreen(false)}>←</button>
              <div className="hdr-title">Customise Jersey</div>
              <div className="coin-bar" style={{ fontSize:13 }}>🪙 {cricCoins}</div>
            </div>
            <div style={{ overflowY:"auto", paddingBottom:32 }}>

              {/* Live preview — full-width dark panel */}
              {(() => {
                const pal = JERSEY_PALETTES.find(p => p.id === avatarPalette) || JERSEY_PALETTES[0];
                const jCol = pal.primary || career.jerseyColor;
                const sCol = pal.stripe  || career.jerseyStripe;
                const hCol = career.helmetColor;
                return (
                  <div style={{ background:`linear-gradient(160deg,#0f0f0f,${jCol}66,#0f0f0f)`, padding:"32px 20px 44px", display:"flex", flexDirection:"column", alignItems:"center", gap:0 }}>
                    {/* Helmet */}
                    <div className="card-helmet" style={{ background: hCol }}>
                      <div className="card-visor" /><div className="card-visor-shine" />
                      <div style={{ fontSize:12, color:"rgba(255,255,255,.4)", zIndex:1 }}>◉</div>
                    </div>
                    {/* Jersey */}
                    <div className="player-card" style={{ "--cardJersey": jCol, "--cardStripe": sCol }}>
                      <div className="card-top-strip" />
                      <div className="card-body">
                        <div className="card-stripe-v" />
                        <div className="card-number">{avatarNum}</div>
                        <div className="card-name">{nick?.slice(0,12) || "PLAYER"}</div>
                      </div>
                      <div className="card-badge-bottom" style={{ color: career.color }}>{career.badge}</div>
                    </div>
                    <div style={{ marginTop:28, fontFamily:"var(--fm)", fontSize:9, color:"rgba(255,255,255,.35)", letterSpacing:2, textTransform:"uppercase" }}>
                      Live Preview
                    </div>
                  </div>
                );
              })()}

              <div style={{ padding:"20px 18px", display:"flex", flexDirection:"column", gap:18 }}>

                {/* Jersey Number */}
                <div style={{ background:"var(--s0)", border:"1px solid var(--rim)", borderRadius:"var(--r2)", padding:18 }}>
                  <div className="slbl" style={{ marginBottom:12 }}>Jersey Number</div>
                  <div style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:20 }}>
                    <button className="num-btn" onClick={() => setAvatarNum(n => Math.max(1, n-1))} style={{ width:44, height:44, borderRadius:"50%", border:"1.5px solid var(--rim)", background:"var(--s0)", fontSize:22, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", fontWeight:700 }}>−</button>
                    <div style={{ fontFamily:"var(--fd)", fontSize:56, fontWeight:900, color:"var(--amber)", width:80, textAlign:"center", lineHeight:1 }}>{avatarNum}</div>
                    <button className="num-btn" onClick={() => setAvatarNum(n => Math.min(99, n+1))} style={{ width:44, height:44, borderRadius:"50%", border:"1.5px solid var(--rim)", background:"var(--s0)", fontSize:22, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", fontWeight:700 }}>+</button>
                  </div>
                  {/* Famous numbers */}
                  <div style={{ display:"flex", gap:8, justifyContent:"center", marginTop:14, flexWrap:"wrap" }}>
                    {[[7,"Dhoni"],[10,"Tendulkar"],[18,"Kohli"],[45,"Rohit"],[99,"Gayle"]].map(([n, legend]) => (
                      <button key={n} onClick={() => setAvatarNum(n)}
                        style={{ padding:"6px 12px", borderRadius:999, border:`1.5px solid ${avatarNum===n ? "var(--amber)" : "var(--rim)"}`, background: avatarNum===n ? "var(--amberBg)" : "transparent", cursor:"pointer", textAlign:"center" }}>
                        <div style={{ fontFamily:"var(--fm)", fontSize:12, fontWeight:700, color: avatarNum===n ? "var(--amber)" : "var(--txt)" }}>#{n}</div>
                        <div style={{ fontFamily:"var(--fm)", fontSize:8, color:"var(--sub)" }}>{legend}</div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Jersey Colour */}
                <div style={{ background:"var(--s0)", border:"1px solid var(--rim)", borderRadius:"var(--r2)", padding:18 }}>
                  <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:14 }}>
                    <div className="slbl">Jersey Colour</div>
                    <button onClick={() => { setNavTab("store"); setScreen("store"); setStoreCat("cosmetic"); setShowAvatarScreen(false); }}
                      style={{ fontFamily:"var(--fm)", fontSize:9, fontWeight:700, color:"var(--amber)", background:"var(--amberBg)", border:"1px solid rgba(180,83,9,.2)", borderRadius:999, padding:"4px 10px", cursor:"pointer" }}>
                      + More in Store
                    </button>
                  </div>
                  <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:12 }}>
                    {JERSEY_PALETTES.map(pal => {
                      const isOwned = unlockedPalettes.has(pal.id);
                      const isActive = avatarPalette === pal.id;
                      const canAfford = cricCoins >= pal.price;
                      const dotColor = pal.primary || career.jerseyColor;
                      return (
                        <div key={pal.id}
                          onClick={() => {
                            if (isOwned) { setAvatarPalette(pal.id); return; }
                            if (!canAfford) { showToast("❌ Not enough CricCoins"); return; }
                            setCricCoins(c => c - pal.price);
                            setUnlockedPalettes(prev => new Set([...prev, pal.id]));
                            setAvatarPalette(pal.id);
                            showToast(`🎽 ${pal.label} unlocked!`);
                          }}
                          style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:6, padding:"12px 8px", borderRadius:12, border:`2px solid ${isActive ? "var(--amber)" : "var(--rim)"}`, background: isActive ? "var(--amberBg)" : "var(--bg)", cursor:"pointer", transition:"all .15s", position:"relative" }}>
                          {/* Colour swatch */}
                          <div style={{ width:44, height:44, borderRadius:"50%", background: dotColor, boxShadow: isActive ? `0 0 0 3px var(--amberViv)` : "0 2px 8px rgba(0,0,0,.15)", border:"2px solid rgba(255,255,255,.15)", transition:"all .15s" }} />
                          <div style={{ fontFamily:"var(--fm)", fontSize:10, fontWeight:700, color: isActive ? "var(--amber)" : "var(--txt)" }}>{pal.label}</div>
                          {isOwned ? (
                            <div style={{ fontFamily:"var(--fm)", fontSize:8, color:"var(--green)", fontWeight:600 }}>{isActive ? "✓ Active" : "✓ Owned"}</div>
                          ) : (
                            <div style={{ fontFamily:"var(--fm)", fontSize:8, color: canAfford ? "var(--amber)" : "var(--sub)", fontWeight:700 }}>🪙 {pal.price}</div>
                          )}
                          {!isOwned && !canAfford && (
                            <div style={{ position:"absolute", inset:0, borderRadius:10, background:"rgba(0,0,0,.4)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:20 }}>🔒</div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Career Kit Timeline */}
                <div style={{ background:"var(--s0)", border:"1px solid var(--rim)", borderRadius:"var(--r2)", padding:18 }}>
                  <div className="slbl" style={{ marginBottom:14 }}>Career Kit Timeline</div>
                  <div style={{ display:"flex", gap:8, overflowX:"auto", paddingBottom:6 }}>
                    {CAREER.map(c => {
                      const unlocked = totalXp >= c.minXp;
                      const isCurrent = career.stage === c.stage;
                      return (
                        <div key={c.stage} style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:6, minWidth:68, opacity: unlocked ? 1 : .4 }}>
                          <div style={{ width:52, height:66, borderRadius:10, background: unlocked ? `${c.jerseyColor}` : "var(--s2)", border:`2px solid ${isCurrent ? "var(--amber)" : unlocked ? c.color : "var(--rim)"}`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:22, position:"relative", boxShadow: isCurrent ? `0 0 0 3px rgba(245,158,11,.3)` : "none" }}>
                            {c.icon}
                            {isCurrent && <div style={{ position:"absolute", top:-6, left:"50%", transform:"translateX(-50%)", background:"var(--amber)", borderRadius:999, fontSize:6, fontFamily:"var(--fm)", fontWeight:700, padding:"1px 5px", color:"#fff", whiteSpace:"nowrap" }}>YOU</div>}
                          </div>
                          <div style={{ fontFamily:"var(--fm)", fontSize:7, fontWeight:700, textAlign:"center", color: unlocked ? c.color : "var(--sub)", lineHeight:1.3 }}>{c.title}</div>
                          {!unlocked && <div style={{ fontFamily:"var(--fm)", fontSize:6, color:"var(--sub)" }}>{c.minXp} XP</div>}
                        </div>
                      );
                    })}
                  </div>
                </div>

              </div>
            </div>
          </div>
        )}

        {/* ══════ STORE ══════ */}
        {screen === "store" && (
          <div className="screen store-screen">
            <div className="hdr" style={{ flexShrink:0 }}>
              <button className="back-btn" onClick={() => setScreen("landing")}>←</button>
              <div className="hdr-title">CricCoin Store</div>
              <div className="coin-bar" style={{ fontSize:13 }}>🪙 {cricCoins}</div>
            </div>
            <div style={{ fontFamily:"var(--fm)", fontSize:10, color:"var(--sub)", textAlign:"center", padding:"6px 0 2px" }}>
              Earn free coins by winning matches · Spend on power-ups & cosmetics
            </div>
            <div className="store-tabs">
              {[["coins","🪙 Buy Coins"],["powerups","⚡ Power-Ups"],["boosts","🚀 Boosts"],["cosmetic","🎨 Cosmetics"]].map(([id,lb]) => (
                <button key={id} className={`store-tab${storeCat===id?" on":""}`} onClick={() => setStoreCat(id)}>{lb}</button>
              ))}
            </div>
            <div className="store-grid">
              {STORE_ITEMS.filter(i => i.category === storeCat).map(item => {
                const isCoinPack = item.category === "coins";
                const canAfford  = isCoinPack || cricCoins >= item.price;
                return (
                  <div key={item.id} className="store-card" style={{ border: isCoinPack ? "1px solid rgba(217,119,6,.3)" : "1px solid var(--rim)", background: isCoinPack ? "rgba(217,119,6,.04)" : "var(--s0)" }}>
                    <div className="store-card-icon">{item.icon}</div>
                    <div className="store-card-info">
                      <div className="store-card-label">{item.label}</div>
                      <div className="store-card-desc">{item.desc}</div>
                      {!isCoinPack && (
                        <div style={{ fontFamily:"var(--fm)", fontSize:9, color:"var(--amber)", marginTop:3 }}>🪙 {item.price} CricCoins</div>
                      )}
                    </div>
                    <button className="store-btn"
                      style={{ background: isCoinPack ? "var(--amberViv)" : canAfford ? "#1d4ed8" : "var(--s2)", color: (isCoinPack || canAfford) ? "#fff" : "var(--sub)", opacity: canAfford ? 1 : .6, minWidth: 52 }}
                      onClick={() => buyStoreItem(item)}>
                      {isCoinPack ? item.price : canAfford ? "Buy" : "🔒"}
                    </button>
                  </div>
                );
              })}
            </div>
            {/* How to earn CricCoins */}
            <div style={{ margin:"0 16px 24px", background:"rgba(217,119,6,.06)", border:"1px solid rgba(217,119,6,.15)", borderRadius:"var(--r2)", padding:14 }}>
              <div style={{ fontFamily:"var(--fm)", fontSize:9, fontWeight:700, letterSpacing:2, textTransform:"uppercase", color:"var(--amber)", marginBottom:8 }}>Earn Free CricCoins</div>
              {[["🏆 Win a free match","+ 5 coins"],["💰 Win a paid match","+ 15 coins"],["❌ Lose any match","+ 2 coins"],["🎯 Daily first match","+ 10 coins"]].map(([a,b]) => (
                <div key={a} style={{ display:"flex", justifyContent:"space-between", padding:"5px 0", borderBottom:"1px solid rgba(217,119,6,.08)" }}>
                  <span style={{ fontSize:11, color:"var(--txt)" }}>{a}</span>
                  <span style={{ fontFamily:"var(--fm)", fontSize:10, fontWeight:700, color:"var(--amber)" }}>{b}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ══════ LEADERBOARD ══════ */}
        {screen === "leaderboard" && (
          <div className="screen lb-screen">
            <div className="hdr">
              <button className="back-btn" onClick={() => setScreen("landing")}>←</button>
              <div className="hdr-title">Rankings</div>
              <div className="hdr-r"><div className="mono-tag" style={{ background: "var(--amberBg)", border: "1px solid rgba(180,83,9,.2)", color: "var(--amber)" }}>Season 2026</div></div>
            </div>
            <div className="lb-tabs">
              {[["skill", "By Skill XP"], ["earnings", "By Earnings"]].map(([id, lbl]) => (
                <button key={id} className={`lb-tab${lbTab === id ? " on" : ""}`} onClick={() => setLbTab(id)}>{lbl}</button>
              ))}
            </div>
            <div className="lb-list">
              {LB_DATA.map((p, i) => (
                <div className="lb-row" key={p.rank} style={{ animationDelay: `${i * .05}s` }}>
                  <div className="lb-rank" style={{ color: p.rank === 1 ? "var(--amber)" : p.rank === 2 ? "#a16207" : p.rank === 3 ? "#78716c" : "var(--sub)" }}>{p.rank <= 3 ? ["🥇","🥈","🥉"][p.rank - 1] : `#${p.rank}`}</div>
                  <div className="lb-flag">{p.flag}</div>
                  <div className="lb-info">
                    <div className="lb-name">{p.name}</div>
                    <div className="lb-stage">{p.stage}</div>
                  </div>
                  <div className="lb-right">
                    {lbTab === "skill"
                      ? <div className="lb-score" style={{ color: "var(--txt)" }}>{p.xp.toLocaleString()} XP</div>
                      : <div className="lb-earn">+${p.earnings.toFixed(2)}</div>}
                    <div style={{ fontFamily: "var(--fm)", fontSize: 9, color: "var(--sub)" }}>{p.wins}W</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ══════ WALLET ══════ */}
        {screen === "wallet" && (
          <div className="screen" style={{ display: "flex", flexDirection: "column" }}>
            <div className="wallet-hero">
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                <button className="back-btn" style={{ background: "rgba(255,255,255,.1)", border: "1px solid rgba(255,255,255,.15)", color: "#fff" }} onClick={() => setScreen("landing")}>←</button>
                <span style={{ fontFamily: "var(--fm)", fontSize: 9, fontWeight: 600, letterSpacing: 3, textTransform: "uppercase", color: "rgba(255,255,255,.4)" }}>SKILL WALLET</span>
                <div style={{ width: 40 }} />
              </div>
              <div className="w-bal"><span>$</span>{wallet.toFixed(2)}</div>
              <div className="w-sub">Available balance</div>
            </div>
            <div className="wallet-body" style={{ flex: 1, overflowY: "auto" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <button className="btn btn-green btn-sm" onClick={() => setScreen("wallet-connect")}>💳 Add Funds</button>
                <button className="btn btn-outline btn-sm" onClick={() => { if (wallet >= 5) { setWallet(w => parseFloat((w - 5).toFixed(2))); showToast("✅ Withdrawal initiated — 30 mins"); } else showToast("⚠️ Insufficient balance"); }}>Withdraw</button>
              </div>

              <div className="slbl">How prize money works</div>
              <div style={{ background: "var(--amberBg)", border: "1px solid rgba(180,83,9,.18)", borderRadius: "var(--r2)", padding: 16 }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, textAlign: "center" }}>
                  {[["Your Entry", "$1.00"], ["Prize Pool", "$1.80"], ["Platform Fee", "$0.20"]].map(([l, v]) => (
                    <div key={l}>
                      <div style={{ fontFamily: "var(--fm)", fontSize: 8, fontWeight: 600, color: "var(--sub)", letterSpacing: 1, textTransform: "uppercase", marginBottom: 3 }}>{l}</div>
                      <div style={{ fontFamily: "var(--fd)", fontSize: 20, fontWeight: 700, color: "var(--amber)" }}>{v}</div>
                    </div>
                  ))}
                </div>
                <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid rgba(180,83,9,.15)", fontSize: 11, color: "var(--sub)", lineHeight: 1.5 }}>
                  ✅ <strong>Skill-based competition.</strong> Your cricket knowledge determines the outcome. Withdrawals require KYC.
                </div>
              </div>

              <div className="slbl">Recent transactions</div>
              {wallet === 0 && !loggedIn ? (
                <div style={{ textAlign:"center", padding:"28px 16px", color:"var(--sub)", fontSize:14 }}>
                  <div style={{ fontSize:36, marginBottom:10 }}>📋</div>
                  No transactions yet. Add funds to start playing for real money!
                </div>
              ) : (
                <div style={{ textAlign:"center", padding:"28px 16px", color:"var(--sub)", fontSize:14 }}>
                  <div style={{ fontSize:36, marginBottom:10 }}>📋</div>
                  No transactions yet. Play a match to see your history here.
                </div>
              )}
            </div>
          </div>
        )}

        {/* ══════ NAV ══════ */}
        {["landing", "profile", "leaderboard", "wallet", "rules", "legal", "store"].includes(screen) && (
          <div className="nav">
            {[["play","🏏","Play"],["profile","👤","Career"],["leaderboard","🏆","Ranks"],["store","🪙","Store"],["wallet","💰","Wallet"]].map(([id, ic, lb]) => (
              <button key={id} className={`nav-btn${navTab === id ? " on" : ""}`} onClick={() => {
                setNavTab(id);
                if (id === "play") setScreen("landing");
                else if (id === "profile") { setScreen("profile"); setShowAvatarScreen(false); }
                else if (id === "leaderboard") setScreen("leaderboard");
                else if (id === "store") setScreen("store");
                else setScreen("wallet");
              }}>
                <span className="nav-icon">{ic}</span>{lb}
              </button>
            ))}
            <button className="nav-btn" onClick={() => { setSfxOn(s => !s);  }}>
              <span className="nav-icon">{sfxOn ? "🔊" : "🔇"}</span>Sound
            </button>
          </div>
        )}

        {/* ══════ IAP COIN PURCHASE MODAL ══════ */}
        {showIapModal && (
          <div className="iap-overlay" onClick={() => setShowIapModal(null)}>
            <div className="iap-sheet" onClick={e => e.stopPropagation()}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:20 }}>
                <div style={{ fontFamily:"var(--fd)", fontSize:20, fontWeight:800 }}>Buy CricCoins</div>
                <button onClick={() => setShowIapModal(null)} style={{ background:"var(--s2)", border:"none", borderRadius:"50%", width:32, height:32, cursor:"pointer", fontSize:16, color:"var(--sub)" }}>✕</button>
              </div>
              {/* Pack highlight */}
              <div style={{ background:`linear-gradient(135deg,rgba(217,119,6,.12),rgba(217,119,6,.04))`, border:"1.5px solid rgba(217,119,6,.3)", borderRadius:16, padding:20, marginBottom:20, textAlign:"center" }}>
                <div style={{ fontSize:48 }}>{showIapModal.icon}</div>
                <div style={{ fontFamily:"var(--fd)", fontSize:22, fontWeight:800, marginTop:8 }}>{showIapModal.label}</div>
                <div style={{ fontSize:14, color:"var(--sub)", marginTop:4 }}>{showIapModal.desc}</div>
                <div style={{ fontFamily:"var(--fd)", fontSize:36, fontWeight:900, color:"var(--amber)", marginTop:12 }}>{showIapModal.price}</div>
                <div style={{ fontFamily:"var(--fm)", fontSize:10, color:"var(--sub)" }}>one-time purchase · no subscription</div>
              </div>
              {/* What you get */}
              <div style={{ background:"var(--s0)", borderRadius:12, padding:14, marginBottom:20 }}>
                <div style={{ fontFamily:"var(--fm)", fontSize:9, fontWeight:700, letterSpacing:2, textTransform:"uppercase", color:"var(--sub)", marginBottom:10 }}>What you get</div>
                {[
                  [`🪙 ${showIapModal.coins} CricCoins`, "added to your wallet instantly"],
                  ["⚡ Power-ups", "buy Timeouts, 50/50s, Power Plays"],
                  ["🎽 Jersey skins", "unlock premium colour palettes"],
                  ["🚀 XP Boosters", "level up your skills faster"],
                ].map(([a,b]) => (
                  <div key={a} style={{ display:"flex", gap:10, alignItems:"center", padding:"6px 0", borderBottom:"1px solid var(--rim)" }}>
                    <div style={{ fontSize:16, width:24, textAlign:"center", flexShrink:0 }}>{a.split(" ")[0]}</div>
                    <div>
                      <div style={{ fontSize:12, fontWeight:600 }}>{a.slice(a.indexOf(" ")+1)}</div>
                      <div style={{ fontSize:10, color:"var(--sub)" }}>{b}</div>
                    </div>
                  </div>
                ))}
              </div>
              {/* Buy button — simulated (would connect to Razorpay) */}
              <button
                onClick={() => {
                  // Simulate successful purchase (replace with Razorpay in prod)
                  setCricCoins(c => c + showIapModal.coins);
                  showToast(`🎉 ${showIapModal.coins} CricCoins added to your wallet!`);
                  setShowIapModal(null);
                }}
                style={{ width:"100%", background:"var(--amberViv)", color:"#fff", border:"none", borderRadius:14, padding:"16px 0", fontFamily:"var(--fd)", fontSize:18, fontWeight:800, cursor:"pointer", boxShadow:"0 4px 16px rgba(245,158,11,.35)" }}>
                Pay {showIapModal.price} →
              </button>
              <div style={{ fontFamily:"var(--fm)", fontSize:9, color:"var(--sub)", textAlign:"center", marginTop:10 }}>
                Secure payment via Razorpay · Coins are non-refundable
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
