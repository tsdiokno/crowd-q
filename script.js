// Global variables
let queue = [];
let player = null;
let userName = sessionStorage.getItem('userName');
let lastProcessedLogEntry = null;
let lastAction = null;
let YOUTUBE_API_KEY = null;
let hasApiKey = false;
let hasInitialSync = false;

// DOM elements
const queueDisplay = document.getElementById('queue-list');
const youtubeUrlInput = document.getElementById('youtube-url');
const addButton = document.getElementById('add-to-queue');
const refreshButton = document.getElementById('refresh-button');
const nameModal = document.getElementById('name-modal');
const userNameInput = document.getElementById('user-name');
const submitNameButton = document.getElementById('submit-name');
const controlButtons = document.querySelector('.control-buttons');
const videoContainer = document.querySelector('#video-container');
const notification = document.getElementById('notification');
const notificationText = document.getElementById('notification-text');
const syncPlaybackButton = document.getElementById('sync-playback-button');

// Cache for video titles
const titleCache = new Map();

// Show notification function
function showNotification(message) {
  notificationText.textContent = message;
  notification.classList.add('show');
  setTimeout(() => {
    notification.classList.remove('show');
  }, 3000);
}

// Load configuration
async function loadConfig() {
  try {
    const response = await fetch('config.json');
    const config = await response.json();
    YOUTUBE_API_KEY = config.youtube_api_key;
    hasApiKey = YOUTUBE_API_KEY && YOUTUBE_API_KEY !== "YOUR_API_KEY";
  } catch (error) {
    console.error('Error loading config:', error);
    hasApiKey = false;
  }
}

// Load queue from server
async function loadQueue() {
  try {
    const response = await fetch('get_queue.php');
    const data = await response.json();
    
    // Check if the current song has changed
    if (queue.length > 0 && data.length > 0) {
      const currentSong = queue[0];
      const newCurrentSong = data[0];
      
      if (currentSong.videoId !== newCurrentSong.videoId) {
        addLogEntry('Song Changed', newCurrentSong.title || newCurrentSong.url);
      }
    }
    
    queue = data;
    updateQueueDisplay();
  } catch (error) {
    console.error('Error loading queue:', error);
  }
}

// Save queue to server
function saveQueue() {
  fetch('save_queue.php', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ queue: queue })
  });
}

// Helper function to extract VIDEO_ID from a YouTube URL
function extractVideoId(url) {
  const regex = /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([\w-]{11})/;
  const match = url.match(regex);
  return match ? match[1] : null;
}

// Fetch video titles using YouTube Data API with batching
async function fetchVideoTitles(videoIds) {
  if (!hasApiKey || !videoIds.length) return new Map();
  
  // Filter out already cached IDs
  const uncachedIds = videoIds.filter(id => !titleCache.has(id));
  if (!uncachedIds.length) return titleCache;

  try {
    // YouTube API allows up to 50 videos per request
    const batchSize = 50;
    const results = new Map();
    
    for (let i = 0; i < uncachedIds.length; i += batchSize) {
      const batch = uncachedIds.slice(i, i + batchSize);
      const response = await fetch(
        `https://www.googleapis.com/youtube/v3/videos?part=snippet&id=${batch.join(',')}&key=${YOUTUBE_API_KEY}`
      );
      const data = await response.json();
      
      if (data.items) {
        data.items.forEach(item => {
          results.set(item.id, item.snippet.title);
        });
      }
    }

    // Update cache with new results
    results.forEach((title, id) => titleCache.set(id, title));
    return titleCache;
  } catch (error) {
    console.error('Error fetching video titles:', error);
    return titleCache;
  }
}

// Handle API change event
function onApiChange(event) {
  // No logs needed
}

// Handle player ready event
async function onPlayerReady(event) {
  // Store player state
  window.playerState = {
    isPlaying: false,
    currentVideoId: null
  };
  
  // Enable programmatic control
  event.target.setPlaybackQuality('default');
  event.target.setPlaybackRate(1);
  event.target.unMute(); // Unmute after player is ready

  // Show sync button initially
  syncPlaybackButton.style.display = 'flex';
  controlButtons.style.display = 'none';
}

// Handle player errors
function onPlayerError(event) {
  console.error('Player error:', event.data);
  let errorMessage = 'Error playing video. ';
  switch (event.data) {
    case 2:
      errorMessage += 'Invalid video ID or parameters.';
      break;
    case 5:
      errorMessage += 'HTML5 player error.';
      break;
    case 100:
      errorMessage += 'Video not found or removed.';
      break;
    case 101:
    case 150:
      errorMessage += 'Video not allowed to be played in embedded players.';
      break;
    default:
      errorMessage += 'Please try again.';
  }
  showNotification(errorMessage);
}

// Handle YouTube Player state changes
function onPlayerStateChange(event) {
  // Update stored state
  if (window.playerState) {
    window.playerState.isPlaying = event.data === YT.PlayerState.PLAYING;
    window.playerState.currentVideoId = player.getVideoData().video_id;
  }

  // Update queue display to show current state
  updateQueueDisplay();

  if (event.data === YT.PlayerState.ENDED) {
    nextSong();
  }
}

// Add log entry function
async function addLogEntry(action, details = '', position = null) {
  try {
    // First check the latest queue state from server
    const response = await fetch('get_queue.php');
    const data = await response.json();
    
    // Skip if this is the same action as the latest queue entry
    if (data && data.length > 0) {
      const latestEntry = data[0];
      if (latestEntry.status && latestEntry.status.action === action) {
        return;
      }
    }

    // Create timestamp in 12-hour format with consistent options
    const timestamp = new Date().toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
      timeZone: 'UTC'
    });

    // Update the first item in the queue with the new status
    if (data && data.length > 0) {
      // Ensure the queue item has the correct structure
      const currentItem = data[0];
      if (!currentItem.status) {
        currentItem.status = {};
      }

      // Update the status with the new action
      currentItem.status = {
        action: action,
        user: userName,
        position: position,
        timestamp: timestamp,
        details: details
      };

      // Use PATCH method to update only the status of the current item
      const patchResponse = await fetch('update_queue.php', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          index: 0,
          status: currentItem.status
        })
      });

      if (!patchResponse.ok) {
        throw new Error('Failed to update queue state');
      }

      // Update local queue
      queue = data;
      updateQueueDisplay();

      // Process the queue state change immediately
      await processQueueState();
    }
  } catch (error) {
    console.error('Error updating queue:', error);
  }
}

// Process queue state changes
async function processQueueState() {
  try {
    const response = await fetch('get_queue.php');
    const data = await response.json();
    
    if (data && data.length > 0) {
      const latestEntry = data[0];
      const status = latestEntry.status;
      
      if (!status) return;
      
      // Skip if this is the same action as the last one we processed
      if (lastProcessedLogEntry && lastProcessedLogEntry.status.action === status.action) {
        return;
      }
      
      // Update last processed entry
      lastProcessedLogEntry = latestEntry;
      
      // Handle different actions
      switch (status.action.toLowerCase()) {
        case 'play':
          if (player && latestEntry.videoId) {
            // Validate video ID format
            if (!/^[a-zA-Z0-9_-]{11}$/.test(latestEntry.videoId)) {
              console.error('Invalid video ID format:', latestEntry.videoId);
              return;
            }

            // Get the current video ID from the player
            const currentVideoId = player.getVideoData().video_id;
            
            // If we're already playing this video, just seek to the position
            if (currentVideoId === latestEntry.videoId) {
              player.seekTo(status.position || 0, true);
              player.playVideo();
            } else {
              // If it's a different video, load it with the correct position
              player.loadVideoById({
                videoId: latestEntry.videoId,
                playerVars: {
                  'autoplay': 1,
                  'playsinline': 1,
                  'enablejsapi': 1,
                  'origin': window.location.origin,
                  'start': status.position || 0,
                  'mute': 1,
                  'rel': 0,
                  'showinfo': 0,
                  'modestbranding': 1,
                  'fs': 1,
                  'cc_load_policy': 1,
                  'iv_load_policy': 3
                }
              });
            }
          }
          break;
          
        case 'pause':
          if (player) {
            player.pauseVideo();
          }
          break;
          
        case 'next':
          if (data.length > 1) {
            // Remove the first item and save the updated queue
            const saveResponse = await fetch('save_queue.php', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json'
              },
              body: JSON.stringify(data.slice(1)) // Send the queue without the first item
            });
            
            if (!saveResponse.ok) {
              throw new Error('Failed to save queue state');
            }
            
            // Update local queue
            queue = data.slice(1);
            updateQueueDisplay();
            
            // If there's a next video, play it
            if (queue.length > 0) {
              // Add a small delay to ensure the queue is updated
              setTimeout(async () => {
                // Create a new status for the next video
                const nextStatus = {
                  action: 'Play',
                  user: userName,
                  position: 0,
                  timestamp: new Date().toLocaleTimeString('en-US', { 
                    hour: '2-digit', 
                    minute: '2-digit',
                    second: '2-digit',
                    hour12: true,
                    timeZone: 'UTC'
                  }),
                  details: queue[0].title || queue[0].url
                };

                // Update the status of the next video
                const patchResponse = await fetch('update_queue.php', {
                  method: 'PATCH',
                  headers: {
                    'Content-Type': 'application/json'
                  },
                  body: JSON.stringify({
                    index: 0,
                    status: nextStatus
                  })
                });

                if (!patchResponse.ok) {
                  throw new Error('Failed to update next video status');
                }

                // Process the queue state again to play the next video
                await processQueueState();
              }, 100);
            }
          }
          break;
      }
    }
  } catch (error) {
    console.error('Error processing queue state:', error);
  }
}

// Update the queue display
function updateQueueDisplay() {
  queueDisplay.innerHTML = '';
  if (!hasApiKey) {
    const warningDiv = document.createElement('div');
    warningDiv.style.cssText = `
      background-color: var(--md-sys-color-error);
      color: var(--md-sys-color-on-error);
      padding: 12px;
      border-radius: 8px;
      margin-bottom: 16px;
      font-size: 0.875rem;
    `;
    warningDiv.innerHTML = `
      <span class="material-icons" style="vertical-align: middle; margin-right: 8px;">warning</span>
      YouTube API key not configured. Video titles will not be displayed. To enable titles, replace the API key in the code.
    `;
    queueDisplay.appendChild(warningDiv);
  }
  queue.forEach((item, index) => {
    const div = document.createElement('div');
    div.classList.add('queue-item');
    
    // Format the status information if it exists
    let statusHtml = '';
    if (item.status) {
      const status = item.status;
      const position = status.position ? Math.floor(status.position) : 0;
      const minutes = Math.floor(position / 60);
      const seconds = position % 60;
      const timeString = `${minutes}:${seconds.toString().padStart(2, '0')}`;
      
      statusHtml = `
        <div class="queue-status">
          <span class="status-action ${status.action.toLowerCase()}">
            <span class="material-icons">${getStatusIcon(status.action)}</span>
            ${status.action}
          </span>
          <span class="status-time">at ${timeString}</span>
          <span class="status-user">by ${status.user}</span>
          <span class="status-timestamp">${status.timestamp}</span>
        </div>
      `;
    }
    
    div.innerHTML = `
      <img class="queue-item-thumbnail" src="https://img.youtube.com/vi/${item.videoId}/3.jpg" alt="Thumbnail">
      <div class="queue-item-info">
        <div class="queue-position">Queue Position: ${index + 1}</div>
        ${item.title ? `<div class="video-title">${item.title}</div>` : ''}
        <a href="${item.url}" target="_blank" rel="noopener noreferrer">${item.url} <span class="material-icons">open_in_new</span></a>
        ${statusHtml}
      </div>
    `;
    if (index === 0) div.classList.add('current-playing');
    queueDisplay.appendChild(div);
  });
}

// Helper function to get the appropriate icon for each status action
function getStatusIcon(action) {
  switch (action.toLowerCase()) {
    case 'play':
      return 'play_arrow';
    case 'pause':
      return 'pause';
    case 'next':
      return 'skip_next';
    case 'add':
      return 'add';
    case 'song changed':
      return 'music_note';
    default:
      return 'info';
  }
}

// Set up all event listeners
function setupEventListeners() {
  // Add button click handler
  addButton.addEventListener('click', async () => {
    const url = youtubeUrlInput.value.trim();
    const videoId = extractVideoId(url);
    if (videoId && !queue.some(item => item.url === url)) {
      // Check if video allows embedding using a more reliable method
      const embedUrl = `https://www.youtube.com/embed/${videoId}`;
      const iframe = document.createElement('iframe');
      iframe.style.display = 'none';
      iframe.src = embedUrl;
      
      // Create a promise to check if the video loads
      const embedCheck = new Promise((resolve) => {
        iframe.onload = () => {
          // If we can load the iframe, the video is embeddable
          resolve(true);
        };
        iframe.onerror = () => {
          // If there's an error loading the iframe, the video might not be embeddable
          resolve(false);
        };
        
        // Set a timeout to resolve as true if we can't determine otherwise
        setTimeout(() => resolve(true), 2000);
      });
      
      // Add iframe to document temporarily
      document.body.appendChild(iframe);
      
      // Wait for the check to complete
      const canEmbed = await embedCheck;
      document.body.removeChild(iframe);
      
      if (!canEmbed) {
        alert('This video does not allow embedding. Please choose a different video.');
        return;
      }
      
      // Get title from cache or fetch if needed
      const titles = await fetchVideoTitles([videoId]);
      const title = titles.get(videoId) || null;
      
      // Create new queue item with proper structure
      const newItem = {
        url: url,
        title: title,
        videoId: videoId,
        status: {
          action: 'Add',
          user: userName,
          timestamp: new Date().toLocaleTimeString('en-US', { 
            hour: '2-digit', 
            minute: '2-digit',
            second: '2-digit',
            hour12: true,
            timeZone: 'UTC'
          }),
          details: title || url
        }
      };
      
      queue.push(newItem);
      saveQueue();
      updateQueueDisplay();
      youtubeUrlInput.value = '';
    } else {
      alert('Invalid YouTube URL or already in queue');
    }
  });

  // Play button click handler - only updates queue state
  document.getElementById('play-button').addEventListener('click', async () => {
    if (queue.length > 0) {
      const currentPosition = player ? player.getCurrentTime() : 0;
      addLogEntry('Play', queue[0].title, currentPosition);
    }
  });

  // Pause button click handler - only updates queue state
  document.getElementById('pause-button').addEventListener('click', () => {
    if (player) {
      const currentPosition = player.getCurrentTime();
      addLogEntry('Pause', '', currentPosition);
    }
  });

  // Next button click handler - only updates queue state
  document.getElementById('next-button').addEventListener('click', () => {
    if (queue.length > 1) {
      addLogEntry('Next', queue[0].title);
    }
  });

  // Sync playback button click handler
  syncPlaybackButton.addEventListener('click', async () => {
    try {
      const response = await fetch('get_queue.php');
      const data = await response.json();
      
      if (data && data.length > 0) {
        const latestEntry = data[0];
        
        if (latestEntry.videoId && player) {
          // Add log entry for sync
          addLogEntry('Play', latestEntry.title, latestEntry.status?.position || 0);
          
          // Load and play video
          player.loadVideoById({
            videoId: latestEntry.videoId,
            playerVars: {
              'autoplay': 1,
              'playsinline': 1,
              'enablejsapi': 1,
              'origin': window.location.origin,
              'start': latestEntry.status?.position || 0,
              'mute': 1,
              'rel': 0,
              'showinfo': 0,
              'modestbranding': 1,
              'fs': 1,
              'cc_load_policy': 1,
              'iv_load_policy': 3
            }
          });
        }
        
        syncPlaybackButton.style.display = 'none';
        controlButtons.style.display = 'flex';
        hasInitialSync = true;
      }
    } catch (error) {
      console.error('Error syncing playback:', error);
      showNotification('Error syncing playback. Please try again.');
    }
  });

  // Refresh button click handler
  refreshButton.addEventListener('click', loadQueue);

  // Name submission handler
  submitNameButton.addEventListener('click', () => {
    const name = userNameInput.value.trim();
    if (name) {
      userName = name;
      sessionStorage.setItem('userName', name);
      nameModal.style.display = 'none';
      videoContainer.style.display = 'block';
      syncPlaybackButton.style.display = 'flex';
      controlButtons.style.display = 'none';
    }
  });
}

// Initialize app after player is ready
async function initializeApp() {
  // Check for user name
  if (!userName) {
    showNameModal();
    return;
  }

  // Load configuration
  await loadConfig();
  
  // Load initial queue
  await loadQueue();
  
  // Start polling for queue updates
  setInterval(loadQueue, 5000);
  // Start polling for queue state changes
  setInterval(processQueueState, 1000);
  
  // Set up event listeners
  setupEventListeners();
}

// Show name modal if no name is set
function showNameModal() {
  nameModal.style.display = 'flex';
}

// Load the YouTube Iframe API
const tag = document.createElement('script');
tag.src = 'https://www.youtube.com/iframe_api';
const firstScriptTag = document.getElementsByTagName('script')[0];
firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);

// Wait for YouTube API to be ready
window.onYouTubeIframeAPIReady = function() {
  // Initialize player
  player = new YT.Player('youtube-player', {
    height: '360',
    width: '640',
    playerVars: {
      'playsinline': 1,
      'enablejsapi': 1,
      'origin': window.location.origin,
      'autoplay': 1,
      'controls': 1,
      'rel': 0,
      'showinfo': 0,
      'modestbranding': 1,
      'fs': 1,
      'cc_load_policy': 1,
      'iv_load_policy': 3,
      'enablejsapi': 1,
      'widget_referrer': window.location.href,
      'mute': 1
    },
    events: {
      'onStateChange': onPlayerStateChange,
      'onError': onPlayerError,
      'onReady': onPlayerReady,
      'onApiChange': onApiChange
    }
  });
};

// Start the app when the page loads
window.onload = initializeApp;

// Show name modal if no name is set
if (!userName) {
  nameModal.style.display = 'flex';
} else {
  videoContainer.style.display = 'block';
  syncPlaybackButton.style.display = 'flex';
  controlButtons.style.display = 'none';
}