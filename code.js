// twitch.js
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { AppTokenAuthProvider } = require('@twurple/auth');
const { ApiClient } = require('@twurple/api');

// Twitch credentials from .env
const clientId = process.env.TWITCH_CLIENT_ID;
const clientSecret = process.env.TWITCH_CLIENT_SECRET;

// Twurple Auth + API Client
const authProvider = new AppTokenAuthProvider(clientId, clientSecret);
const apiClient = new ApiClient({ authProvider });

// Channels to watch
const STREAMERS = [
  'lacy',
  'stableronaldo',
  'silky',
  'jasontheween',
  'adapt',
  'plaqueboymax'
];

// Time window: 1 hour 45 minutes (105 minutes)
const CHECK_WINDOW_MS = 1.75 * 60 * 60 * 1000; // 1.75 hours -> 105 minutes

// Minimum views
const MIN_VIEWS = 45;

// In-memory store for matched clips
let matchedClips = {};
// e.g., matchedClips = { lacy: [ { id, title, url, views, creationDate }, ... ], ... }

// JSON path to persist data across restarts
const CLIPS_JSON_PATH = path.join(__dirname, 'streamerClips.json');

// Load existing data if present
if (fs.existsSync(CLIPS_JSON_PATH)) {
  try {
    matchedClips = JSON.parse(fs.readFileSync(CLIPS_JSON_PATH, 'utf8'));
  } catch (err) {
    console.error('Failed to parse streamerClips.json:', err);
    matchedClips = {};
  }
}

// Fetch clips for a single streamer
async function checkStreamerClips(streamerName) {
  try {
    // 1. Fetch user by name
    const user = await apiClient.users.getUserByName(streamerName);
    if (!user) {
      console.log(`[${streamerName}] not found on Twitch`);
      return;
    }

    // 2. Time range: now - 105min
    const now = new Date();
    const startDate = new Date(now.getTime() - CHECK_WINDOW_MS);

    // 3. Get a paginator for broadcaster's clips in that window
    const clipPaginator = apiClient.clips.getClipsForBroadcasterPaginated(user.id, {
      startDate,
      endDate: now
    });

    // 4. Get all pages
    const allClips = await clipPaginator.getAll();

    // 5. Filter by view count
    const validClips = allClips.filter(clip => clip.views >= MIN_VIEWS);

    // 6. Sort descending by views
    validClips.sort((a, b) => b.views - a.views);

    // 7. Update in-memory store
    if (!matchedClips[streamerName]) {
      matchedClips[streamerName] = [];
    }

    // Add new ones we haven't seen yet
    validClips.forEach(clip => {
      const alreadyExists = matchedClips[streamerName].some(c => c.id === clip.id);
      if (!alreadyExists) {
        matchedClips[streamerName].push({
          id: clip.id,
          title: clip.title,
          url: clip.url,
          views: clip.views,
          creationDate: clip.creationDate
        });
      }
    });

    // Save to JSON
    fs.writeFileSync(CLIPS_JSON_PATH, JSON.stringify(matchedClips, null, 2), 'utf8');

    if (validClips.length > 0) {
      console.log(`[${streamerName}] Found ${validClips.length} new clips (≥45 views)`);
    } else {
      console.log(`[${streamerName}] No new clips in last 1h45m with ≥45 views`);
    }

  } catch (error) {
    console.error(`[${streamerName}] Error:`, error);
  }
}

// Periodically check all streamers
function startMonitoring() {
  // Immediately run once
  STREAMERS.forEach(checkStreamerClips);

  // Then run every 5 minutes
  setInterval(() => {
    STREAMERS.forEach(checkStreamerClips);
  }, 5 * 60 * 1000);
}

// Electron or other code can call this to retrieve data
function getClipsForStreamer(streamerName) {
  return matchedClips[streamerName] || [];
}

module.exports = {
  startMonitoring,
  getClipsForStreamer
};
