require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { AppTokenAuthProvider } = require('@twurple/auth');
const { ApiClient } = require('@twurple/api');

// Load Twitch credentials from your .env file
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

// Time window: last 1 hour 45 minutes (105 minutes)
const CHECK_WINDOW_MS = 1.75 * 60 * 60 * 1000; 

// Minimum views threshold
const MIN_VIEWS = 45;

// In-memory store of matched clips
// Example structure: { lacy: [ { id, title, url, views, creationDate }, ... ], ... }
let matchedClips = {};

// JSON file to persist clip data
const CLIPS_JSON_PATH = path.join(__dirname, 'streamerClips.json');

// Attempt to load existing data on startup (if file exists)
if (fs.existsSync(CLIPS_JSON_PATH)) {
  try {
    matchedClips = JSON.parse(fs.readFileSync(CLIPS_JSON_PATH, 'utf8'));
  } catch (err) {
    console.error('Failed to parse streamerClips.json:', err);
    matchedClips = {};
  }
}

// Fetch and store clips for a single streamer
async function checkStreamerClips(streamerName) {
  try {
    // 1. Resolve the user by name
    const user = await apiClient.users.getUserByName(streamerName);
    if (!user) {
      console.log(`[${streamerName}] not found on Twitch`);
      return;
    }

    // 2. Calculate time window (now - 1h45m)
    const now = new Date();
    const startDate = new Date(now.getTime() - CHECK_WINDOW_MS);

    // 3. Get a paginator for the broadcaster's clips in that window
    const clipPaginator = apiClient.clips.getClipsForBroadcasterPaginated(user.id, {
      startDate,
      endDate: now
    });

    // 4. Retrieve all pages
    const allClips = await clipPaginator.getAll();

    // 5. Filter for clips with ≥ MIN_VIEWS
    const validClips = allClips.filter(clip => clip.views >= MIN_VIEWS);

    // 6. Sort by view count, descending
    validClips.sort((a, b) => b.views - a.views);

    // 7. Update our in-memory object
    if (!matchedClips[streamerName]) {
      matchedClips[streamerName] = [];
    }

    for (const clip of validClips) {
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
    }

    // 8. Persist the updated data to streamerClips.json
    fs.writeFileSync(CLIPS_JSON_PATH, JSON.stringify(matchedClips, null, 2), 'utf8');

    // Log info
    if (validClips.length > 0) {
      console.log(`[${streamerName}] Found ${validClips.length} new clips (≥${MIN_VIEWS} views)`);
    } else {
      console.log(`[${streamerName}] No new clips in last 1h45m with ≥${MIN_VIEWS} views`);
    }

  } catch (error) {
    console.error(`[${streamerName}] Error:`, error);
  }
}

// Start monitoring all streamers
function startMonitoring() {
  // Immediately run once on startup
  STREAMERS.forEach(checkStreamerClips);

  // Then repeat every 5 minutes
  setInterval(() => {
    STREAMERS.forEach(checkStreamerClips);
  }, 5 * 60 * 1000);
}

// Provide a getter for the clips (useful in Electron to display them)
function getClipsForStreamer(streamerName) {
  return matchedClips[streamerName] || [];
}

// If we run "node twitch.js" directly in the terminal,
// automatically start monitoring:
if (require.main === module) {
  startMonitoring();
}

// Export for use in other files (e.g., in main.js for Electron)
module.exports = {
  startMonitoring,
  getClipsForStreamer
};
