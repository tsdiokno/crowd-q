// Global variables
let queue = [];
let currentVideo = null;
let player = null;
let userName = sessionStorage.getItem('userName');
let lastProcessedLogEntry = null;
let lastAction = null;
let YOUTUBE_API_KEY = null;
let hasApiKey = false;
let hasInitialSync = false;

// DOM elements
const queueDisplay = document.getElementById('queue-list');
const currentVideoDisplay = document.getElementById('current-video');
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
    console.log('Loaded queue:', data); // Debug log
    
    queue = data;
    updateQueueDisplay();
  } catch (error) {
    console.error('Error loading queue:', error);
  }
}

// Load current video from server
async function loadCurrentVideo() {
  try {
    const response = await fetch('get_current_video.php');
    currentVideo = await response.json();
    console.log('Loaded current video:', currentVideo); // Debug log
    updateCurrentVideoDisplay();
  } catch (error) {
    console.error('Error loading current video:', error);
  }
}

// Save queue to server
async function saveQueue() {
  try {
    const response = await fetch('save_queue.php', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ queue: queue })
    });

    if (!response.ok) {
      throw new Error('Failed to save queue');
    }

    const data = await response.json();
    console.log('Queue saved successfully:', data); // Debug log
  } catch (error) {
    console.error('Error saving queue:', error);
    throw error;
  }
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
    // Get the current video state
    const response = await fetch('get_current_video.php');
    const currentVideoData = await response.json();
    
    // Skip if this is the same action as the current video
    if (currentVideoData && currentVideoData.status && currentVideoData.status.action === action) {
      return;
    }

    // Create timestamp in 12-hour format with consistent options
    const timestamp = new Date().toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
      timeZone: 'UTC'
    });

    // Update the current video status
    if (currentVideoData && currentVideoData.videoId) {
      // Update the status with the new action
      currentVideoData.status = {
        action: action,
        user: userName,
        position: position,
        timestamp: timestamp,
        details: details
      };

      // Update current video
      const updateResponse = await fetch('update_current_video.php', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(currentVideoData)
      });

      if (!updateResponse.ok) {
        throw new Error('Failed to update current video state');
      }

      // Update local state
      currentVideo = currentVideoData;
      updateCurrentVideoDisplay();

      // Process the state change immediately
      await processQueueState();
    }
  } catch (error) {
    console.error('Error updating current video:', error);
  }
}

// Update current video display
function updateCurrentVideoDisplay() {
  currentVideoDisplay.innerHTML = '';
  console.log('Updating current video display with:', currentVideo); // Debug log
  
  if (currentVideo && currentVideo.videoId) {
    const div = document.createElement('div');
    div.classList.add('queue-item');
    
    // Format the status information if it exists
    let statusHtml = '';
    if (currentVideo.status) {
      const status = currentVideo.status;
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
      <img class="queue-item-thumbnail" src="https://img.youtube.com/vi/${currentVideo.videoId}/3.jpg" alt="Thumbnail">
      <div class="queue-item-info">
        <div class="queue-position">Currently Playing</div>
        ${currentVideo.title ? `<div class="video-title">${currentVideo.title}</div>` : ''}
        <a href="${currentVideo.url}" target="_blank" rel="noopener noreferrer">${currentVideo.url} <span class="material-icons">open_in_new</span></a>
        ${statusHtml}
      </div>
    `;
    currentVideoDisplay.appendChild(div);
  } else {
    // Show empty state
    currentVideoDisplay.innerHTML = `
      <div class="queue-item empty-state">
        <div class="queue-item-info">
          <div class="queue-position">No video playing</div>
          <div class="video-title">Add a video to start playing</div>
        </div>
      </div>
    `;
  }
}

// Update the queue display (now only shows upcoming videos)
function updateQueueDisplay() {
  queueDisplay.innerHTML = '';
  console.log('Updating queue display with:', queue); // Debug log
  
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
  
  if (queue.length === 0) {
    // Show empty state
    queueDisplay.innerHTML = `
      <div class="queue-item empty-state">
        <div class="queue-item-info">
          <div class="queue-position">Queue is empty</div>
          <div class="video-title">Add videos to the queue</div>
        </div>
      </div>
    `;
    return;
  }
  
  queue.forEach((item, index) => {
    const div = document.createElement('div');
    div.classList.add('queue-item');
    
    div.innerHTML = `
      <img class="queue-item-thumbnail" src="https://img.youtube.com/vi/${item.videoId}/3.jpg" alt="Thumbnail">
      <div class="queue-item-info">
        <div class="queue-position">Queue Position: ${index + 1}</div>
        ${item.title ? `<div class="video-title">${item.title}</div>` : ''}
        <a href="${item.url}" target="_blank" rel="noopener noreferrer">${item.url} <span class="material-icons">open_in_new</span></a>
      </div>
    `;
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
    console.log('Add button clicked');
    const url = youtubeUrlInput.value.trim();
    const videoId = extractVideoId(url);
    console.log('Extracted video ID:', videoId);
    
    if (videoId && !queue.some(item => item.url === url)) {
      console.log('Video ID is valid and not in queue');
      
      // Check if video allows embedding using a more reliable method
      const embedUrl = `https://www.youtube.com/embed/${videoId}`;
      const iframe = document.createElement('iframe');
      iframe.style.display = 'none';
      iframe.src = embedUrl;
      
      // Create a promise to check if the video loads
      const embedCheck = new Promise((resolve) => {
        iframe.onload = () => {
          console.log('Embed check passed');
          resolve(true);
        };
        iframe.onerror = () => {
          console.log('Embed check failed');
          resolve(false);
        };
        
        // Set a timeout to resolve as true if we can't determine otherwise
        setTimeout(() => {
          console.log('Embed check timed out');
          resolve(true);
        }, 2000);
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
      console.log('Got video title:', title);
      
      // Create new video item with proper structure
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
      console.log('Created new item:', newItem);

      // Check if there's a current video
      const currentVideoResponse = await fetch('get_current_video.php');
      const currentVideoData = await currentVideoResponse.json();
      console.log('Current video data:', currentVideoData);
      
      if (!currentVideoData.videoId) {
        console.log('No current video, making this the current video');
        // If no current video, make this the current video
        const currentVideoUpdate = {
          ...newItem,
          status: {
            ...newItem.status,
            action: 'Play',
            position: 0
          }
        };

        // Update current video
        const updateCurrentResponse = await fetch('update_current_video.php', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(currentVideoUpdate)
        });

        if (!updateCurrentResponse.ok) {
          throw new Error('Failed to update current video');
        }

        // Update local state
        currentVideo = currentVideoUpdate;
        updateCurrentVideoDisplay();

        // If player is ready, start playing
        if (player) {
          console.log('Loading video in player');
          player.loadVideoById({
            videoId: videoId,
            playerVars: {
              'autoplay': 1,
              'playsinline': 1,
              'enablejsapi': 1,
              'origin': window.location.origin,
              'start': 0,
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
      } else {
        console.log('Current video exists, adding to queue');
        // If there is a current video, add to queue
        queue.push(newItem);
        console.log('Updated queue:', queue);
        
        // Save queue to server
        const saveResponse = await fetch('save_queue.php', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ queue: queue })
        });

        if (!saveResponse.ok) {
          throw new Error('Failed to save queue');
        }

        const saveResult = await saveResponse.json();
        console.log('Save queue response:', saveResult);

        // Update local state and display
        updateQueueDisplay();
      }

      youtubeUrlInput.value = '';
    } else {
      console.log('Invalid video ID or already in queue');
      alert('Invalid YouTube URL or already in queue');
    }
  });

  // Play button click handler - updates current video state
  document.getElementById('play-button').addEventListener('click', async () => {
    if (currentVideo && currentVideo.videoId) {
      const currentPosition = player ? player.getCurrentTime() : 0;
      addLogEntry('Play', currentVideo.title, currentPosition);
    }
  });

  // Pause button click handler - updates current video state
  document.getElementById('pause-button').addEventListener('click', () => {
    if (currentVideo && currentVideo.videoId && player) {
      const currentPosition = player.getCurrentTime();
      addLogEntry('Pause', '', currentPosition);
    }
  });

  // Next button click handler - updates current video state
  document.getElementById('next-button').addEventListener('click', () => {
    if (currentVideo && currentVideo.videoId) {
      addLogEntry('Next', currentVideo.title);
    }
  });

  // Sync playback button click handler
  syncPlaybackButton.addEventListener('click', async () => {
    try {
      const response = await fetch('get_current_video.php');
      const currentVideoData = await response.json();
      
      if (currentVideoData && currentVideoData.videoId && player) {
        // Add log entry for sync
        addLogEntry('Play', currentVideoData.title, currentVideoData.status?.position || 0);
        
        // Load and play video
        player.loadVideoById({
          videoId: currentVideoData.videoId,
          playerVars: {
            'autoplay': 1,
            'playsinline': 1,
            'enablejsapi': 1,
            'origin': window.location.origin,
            'start': currentVideoData.status?.position || 0,
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
  
  // Load initial queue and current video
  await Promise.all([loadQueue(), loadCurrentVideo()]);
  
  // Update displays immediately
  updateCurrentVideoDisplay();
  updateQueueDisplay();
  
  // Start polling for updates
  setInterval(loadQueue, 5000);
  setInterval(loadCurrentVideo, 5000);
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

// Process queue state changes
async function processQueueState() {
  try {
    // Get the current video state from server
    const response = await fetch('get_current_video.php');
    const currentVideoData = await response.json();
    
    if (!currentVideoData || !currentVideoData.videoId) {
      return;
    }

    // Validate video ID format
    if (!/^[a-zA-Z0-9_-]{11}$/.test(currentVideoData.videoId)) {
      console.error('Invalid video ID format:', currentVideoData.videoId);
      return;
    }

    // Check if this is a new action we haven't processed yet
    if (currentVideoData.status && 
        (!lastProcessedLogEntry || 
         currentVideoData.status.timestamp !== lastProcessedLogEntry.timestamp ||
         currentVideoData.status.action !== lastProcessedLogEntry.action)) {
      
      console.log('Processing new video state:', currentVideoData.status);
      
      // Update last processed entry
      lastProcessedLogEntry = currentVideoData.status;
      
      // Handle different actions
      switch (currentVideoData.status.action) {
        case 'Play':
          if (player && player.getVideoData().video_id !== currentVideoData.videoId) {
            console.log('Loading video:', currentVideoData.videoId);
            player.loadVideoById({
              videoId: currentVideoData.videoId,
              playerVars: {
                'autoplay': 1,
                'playsinline': 1,
                'enablejsapi': 1,
                'origin': window.location.origin,
                'start': currentVideoData.status.position || 0,
                'mute': 1,
                'rel': 0,
                'showinfo': 0,
                'modestbranding': 1,
                'fs': 1,
                'cc_load_policy': 1,
                'iv_load_policy': 3
              }
            });
          } else if (player) {
            console.log('Playing video at position:', currentVideoData.status.position);
            player.playVideo();
            player.seekTo(currentVideoData.status.position || 0, true);
          }
          break;
          
        case 'Pause':
          if (player) {
            console.log('Pausing video at position:', currentVideoData.status.position);
            player.pauseVideo();
            if (currentVideoData.status.position !== undefined) {
              player.seekTo(currentVideoData.status.position, true);
            }
          }
          break;
          
        case 'Next':
          if (player) {
            console.log('Moving to next video');
            // Get the queue to find the next video
            const queueResponse = await fetch('get_queue.php');
            const queueData = await queueResponse.json();
            
            if (queueData && queueData.length > 0) {
              // Get the first video from the queue
              const nextVideo = queueData[0];
              
              // Update current video with the next video
              const updateResponse = await fetch('update_current_video.php', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                  ...nextVideo,
                  status: {
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
                    details: nextVideo.title || nextVideo.url
                  }
                })
              });

              if (!updateResponse.ok) {
                throw new Error('Failed to update current video');
              }

              // Remove the video from the queue
              queueData.shift();
              await fetch('save_queue.php', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify({ queue: queueData })
              });

              // Update local state
              queue = queueData;
              currentVideo = nextVideo;
              updateQueueDisplay();
              updateCurrentVideoDisplay();
            }
          }
          break;
      }
    }
  } catch (error) {
    console.error('Error processing video state:', error);
  }
}