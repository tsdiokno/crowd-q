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
let lastSyncClickTime = null;
let lastSyncedPosition = null;
let lastSyncedAction = null;
let lastProcessedJson = null;
let lastCurrentVideoJson = null;
let lastQueueJson = null;

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
const playButton = document.getElementById('play-button');
const pauseButton = document.getElementById('pause-button');

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
  console.log('loadQueue started');
  try {
    const response = await fetch('get_queue.php');
    const newQueueData = await response.json();
    
    // Convert to string for comparison
    const newQueueJson = JSON.stringify(newQueueData);
    
    // Only update if the queue has changed
    if (newQueueJson !== lastQueueJson) {
      console.log('Queue data changed, updating display');
      lastQueueJson = newQueueJson;
      queue = newQueueData;
      updateQueueDisplay();
      console.log('Queue display updated');
    } else {
      console.log('Queue unchanged, skipping update');
    }
  } catch (error) {
    console.error('Error loading queue:', error);
  }
}

// Load current video from server
async function loadCurrentVideo() {
  console.log('loadCurrentVideo started');
  try {
    const response = await fetch('get_current_video.php');
    const newCurrentVideo = await response.json();
    
    // Convert to string for comparison
    const newCurrentVideoJson = JSON.stringify(newCurrentVideo);
    
    // Only update if the current video data has changed
    if (newCurrentVideoJson !== lastCurrentVideoJson) {
      console.log('Current video data changed, updating display');
      lastCurrentVideoJson = newCurrentVideoJson;
      currentVideo = newCurrentVideo;
      updateCurrentVideoDisplay();
      console.log('Current video display updated');
    } else {
      console.log('Current video unchanged, skipping update');
    }
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
  window.playerState = {
    isPlaying: false,
    currentVideoId: null
  };
  
  event.target.setPlaybackQuality('default');
  event.target.setPlaybackRate(1);
  event.target.unMute();

  try {
    const response = await fetch('get_current_video.php');
    const currentVideoData = await response.json();
    console.log('Current video data on player ready:', currentVideoData);

    if (currentVideoData && currentVideoData.videoId) {
      // Just load the video without playing
      player.cueVideoById({
        videoId: currentVideoData.videoId,
        startSeconds: 0,
        suggestedQuality: 'hd720'
      });

      // Show sync button and hide controls initially
      syncPlaybackButton.style.display = 'flex';
      controlButtons.style.display = 'none';
      hasInitialSync = false;

      // Hide both play and pause buttons initially
      playButton.style.display = 'none';
      pauseButton.style.display = 'none';
    }
  } catch (error) {
    console.error('Error loading current video on player ready:', error);
    syncPlaybackButton.style.display = 'flex';
    controlButtons.style.display = 'none';
  }
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
  
  // Try to reload the video if it's a temporary error
  if (event.data === 5 && player) {
    setTimeout(() => {
      const currentVideoId = player.getVideoData().video_id;
      if (currentVideoId) {
        player.loadVideoById({
          videoId: currentVideoId,
          playerVars: {
            'autoplay': 0,
            'playsinline': 1,
            'enablejsapi': 1,
            'origin': window.location.origin,
            'controls': 1,
            'rel': 0,
            'showinfo': 0,
            'modestbranding': 1,
            'fs': 1,
            'cc_load_policy': 1,
            'iv_load_policy': 3,
            'enablejsapi': 1,
            'widget_referrer': window.location.href,
            'mute': 1,
            'disablekb': 0,
            'vq': 'hd720'
          }
        });
      }
    }, 2000);
  }
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

  // If video just started playing and position is 0, update the timestamp
  if (event.data === YT.PlayerState.PLAYING && currentVideo && 
      currentVideo.status.position === 0 && 
      currentVideo.status.action !== 'Play') {
    console.log('Video started playing for the first time, updating timestamp');
    const currentVideoUpdate = {
      ...currentVideo,
      status: {
        ...currentVideo.status,
        action: 'Play',
        position: 0,
        timestamp: new Date().toISOString()
      }
    };

    // Update current video on server
    fetch('update_current_video.php', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(currentVideoUpdate)
    }).then(response => {
      if (response.ok) {
        currentVideo = currentVideoUpdate;
        updateCurrentVideoDisplay();
      }
    }).catch(error => {
      console.error('Error updating video timestamp:', error);
    });
  }

  if (event.data === YT.PlayerState.ENDED) {
    // Call addLogEntry with 'Next' action when video ends
    if (currentVideo && currentVideo.videoId) {
      addLogEntry('Next', currentVideo.title);
    }
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

    // Create UTC timestamp
    const timestamp = new Date().toISOString();

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

// Name submission handler
submitNameButton.addEventListener('click', () => {
  console.log('Submit name button clicked');
  const name = userNameInput.value.trim();
  console.log('Entered name:', name);
  
  if (name) {
    console.log('Valid name entered, updating userName');
    userName = name;
    sessionStorage.setItem('userName', name);
    console.log('userName saved to sessionStorage');
    
    nameModal.style.display = 'none';
    console.log('Modal hidden');
  } else {
    console.log('No name entered');
  }
});

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
          action: 'Play',
          user: userName,
          position: 0,
          timestamp: new Date().toISOString(),
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
            action: 'Play',
            user: userName,
            position: 0,
            timestamp: new Date().toISOString(), // This will be updated when video actually starts playing
            details: title || url
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
          player.cueVideoById({
            videoId: videoId,
            playerVars: {
              'autoplay': 0,
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
    if (currentVideo && currentVideo.videoId && player) {
      const currentPosition = player.getCurrentTime();
      console.log('Playing video at position:', currentPosition);
      
      // First play the video
      player.playVideo();
      
      // Then update the status
      await addLogEntry('Play', currentVideo.title, currentPosition);
    }
  });

  // Pause button click handler - updates current video state
  document.getElementById('pause-button').addEventListener('click', async () => {
    if (currentVideo && currentVideo.videoId && player) {
      const currentPosition = player.getCurrentTime();
      console.log('Pausing video at position:', currentPosition);
      
      // First pause the video
      player.pauseVideo();
      
      // Then update the status
      await addLogEntry('Pause', currentVideo.title, currentPosition);
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
      console.log('=== SYNC PLAYBACK STARTED ===');
      const syncClickTime = new Date();
      console.log('Sync clicked at:', syncClickTime.toISOString());
      
      const response = await fetch('get_current_video.php');
      const currentVideoData = await response.json();
      
      if (currentVideoData && currentVideoData.videoId && player) {
        const currentAction = currentVideoData.status?.action || 'Play';
        const lastUpdateTime = currentVideoData.status?.timestamp;
        const lastUpdatePosition = parseFloat(currentVideoData.status?.position) || 0;
        
        // Update control buttons visibility based on current state
        updateControlButtonsVisibility(currentAction);

        console.log('=== SYNC DATA ===');
        console.log('Action:', currentAction);
        console.log('Last Update Position:', lastUpdatePosition);
        console.log('Last Update Time:', lastUpdateTime);

        // Calculate position only if video is playing
        let currentPosition = lastUpdatePosition;
        if (currentAction === 'Play' && lastUpdateTime) {
          const lastUpdate = new Date(lastUpdateTime);
          const elapsedMilliseconds = syncClickTime.getTime() - lastUpdate.getTime();
          const elapsedSeconds = Math.round(elapsedMilliseconds / 1000);
          currentPosition = lastUpdatePosition + elapsedSeconds;
          console.log('=== POSITION CALCULATION ===');
          console.log('Last Update:', lastUpdate.toISOString());
          console.log('Sync Click:', syncClickTime.toISOString());
          console.log('Elapsed MS:', elapsedMilliseconds);
          console.log('Elapsed Seconds:', elapsedSeconds);
          console.log('Starting Position:', lastUpdatePosition);
          console.log('Final Position:', currentPosition);
        } else {
          console.log('Using exact JSON position (no elapsed time):', currentPosition);
        }

        // Set hasInitialSync before loading
        hasInitialSync = true;

        // Load video and seek to position in one step
        console.log('Loading video at position:', currentPosition);
        if (currentAction === 'Play') {
          player.loadVideoById({
            videoId: currentVideoData.videoId,
            startSeconds: currentPosition,
            suggestedQuality: 'hd720'
          });
        } else {
          player.cueVideoById({
            videoId: currentVideoData.videoId,
            startSeconds: currentPosition,
            suggestedQuality: 'hd720'
          });
        }

        // Wait for video to be ready
        await new Promise((resolve) => {
          const checkState = setInterval(() => {
            const state = player.getPlayerState();
            if (state !== YT.PlayerState.UNSTARTED) {
              clearInterval(checkState);
              resolve();
            }
          }, 100);
          setTimeout(() => {
            clearInterval(checkState);
            resolve();
          }, 5000);
        });

        // Update UI
        syncPlaybackButton.style.display = 'none';
        controlButtons.style.display = 'flex';
        
        console.log('=== SYNC PLAYBACK COMPLETED ===');
      }
    } catch (error) {
      console.error('=== SYNC ERROR ===');
      console.error('Error:', error);
      showNotification('Error syncing playback. Please try again.');
    }
  });

  // Refresh button click handler
  refreshButton.addEventListener('click', loadQueue);
}

// Initialize app after player is ready
async function initializeApp() {
  console.log('initializeApp started');
  
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
  
  // Show sync button and hide controls
  syncPlaybackButton.style.display = 'flex';
  controlButtons.style.display = 'none';
  
  console.log('initializeApp completed');
}

// Show name modal if no name is set
function showNameModal() {
  console.log('showNameModal called');
  nameModal.style.display = 'flex';
  console.log('Modal display set to flex');
}

// Wait for YouTube API to be ready
window.onYouTubeIframeAPIReady = function() {
  console.log('YouTube API Ready');
  // Initialize player
  player = new YT.Player('youtube-player', {
    height: '360',
    width: '640',
    playerVars: {
      'playsinline': 1,
      'enablejsapi': 1,
      'origin': window.location.origin,
      'autoplay': 0,  // Changed to 0 to prevent autoplay issues
      'controls': 1,  // Show controls initially
      'rel': 0,
      'showinfo': 0,
      'modestbranding': 1,
      'fs': 1,
      'cc_load_policy': 1,
      'iv_load_policy': 3,
      'enablejsapi': 1,
      'widget_referrer': window.location.href,
      'mute': 1,
      'disablekb': 0,  // Enable keyboard controls
      'vq': 'hd720'  // Request HD quality
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
window.onload = () => {
  console.log('Window onload triggered');
  // Show video container immediately
  videoContainer.style.display = 'block';
  
  // Initialize app regardless of username
  initializeApp();
  
  // Show name modal if no username
  if (!userName) {
    showNameModal();
  }
};

// Process queue state changes
async function processQueueState() {
  try {
    const response = await fetch('get_current_video.php');
    const currentVideoData = await response.json();
    
    // Convert to string for comparison
    const currentJson = JSON.stringify(currentVideoData);
    
    // If nothing has changed in the JSON, don't process
    if (currentJson === lastProcessedJson) {
      return;
    }

    // Update our last processed JSON
    lastProcessedJson = currentJson;
    console.log('Processing new JSON state:', currentVideoData);

    if (!currentVideoData || !currentVideoData.videoId) {
      return;
    }

    // Always update control buttons visibility
    if (currentVideoData.status) {
      updateControlButtonsVisibility(currentVideoData.status.action);
    }

    // If we haven't done initial sync, just load the video without playing
    if (!hasInitialSync) {
      if (player && player.getVideoData().video_id !== currentVideoData.videoId) {
        player.cueVideoById({
          videoId: currentVideoData.videoId,
          startSeconds: 0,
          suggestedQuality: 'hd720'
        });
      }
      return;
    }

    // Only process if this is a new video ID or action
    if (currentVideoData.status) {
      const currentAction = currentVideoData.status.action;
      const videoId = currentVideoData.videoId;
      const position = parseFloat(currentVideoData.status.position) || 0;
      
      console.log('Processing action:', currentAction);

      // Handle different actions
      switch (currentAction) {
        case 'Next':
          console.log('Processing Next action');
          // Load queue to get next video
          const queueResponse = await fetch('get_queue.php');
          const queueData = await queueResponse.json();
          
          if (queueData && queueData.length > 0) {
            // Get the next video from queue
            const nextVideo = queueData[0];
            console.log('Next video from queue:', nextVideo);

            // First, remove the video from queue and save it
            const newQueue = queueData.slice(1);
            console.log('Updated queue:', newQueue);
            
            // Save updated queue first
            const saveQueueResponse = await fetch('save_queue.php', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({ queue: newQueue })
            });

            if (!saveQueueResponse.ok) {
              throw new Error('Failed to save queue');
            }

            // Then update current video with the next one
            const currentVideoUpdate = {
              ...nextVideo,
              status: {
                action: 'Play',
                user: userName,
                position: 0,
                timestamp: new Date().toISOString(),
                details: nextVideo.title || nextVideo.url
              }
            };

            // Update current video on server
            const updateResponse = await fetch('update_current_video.php', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json'
              },
              body: JSON.stringify(currentVideoUpdate)
            });

            if (!updateResponse.ok) {
              throw new Error('Failed to update current video');
            }

            // Load and play the next video
            console.log('Loading next video:', nextVideo.videoId);
            player.loadVideoById({
              videoId: nextVideo.videoId,
              startSeconds: 0,
              suggestedQuality: 'hd720'
            });
          } else {
            console.log('Queue is empty, no next video available');
          }
          break;

        case 'Play':
          if (player.getVideoData().video_id !== videoId) {
            console.log('Loading new video for Play:', videoId);
            player.loadVideoById({
              videoId: videoId,
              startSeconds: position,
              suggestedQuality: 'hd720'
            });
          } else if (player.getPlayerState() !== YT.PlayerState.PLAYING) {
            console.log('Playing current video');
            player.playVideo();
          }
          break;
          
        case 'Pause':
          if (player.getPlayerState() !== YT.PlayerState.PAUSED) {
            console.log('Pausing video');
            player.pauseVideo();
          }
          break;
      }
    }
  } catch (error) {
    console.error('Error processing video state:', error);
  }
}

// Add this function to update control buttons visibility
function updateControlButtonsVisibility(action) {
  if (action === 'Play') {
    playButton.style.display = 'none';
    pauseButton.style.display = 'flex';
  } else {
    playButton.style.display = 'flex';
    pauseButton.style.display = 'none';
  }
}