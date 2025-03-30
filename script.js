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
let isProcessingNext = false;
let lastProcessedNextTimestamp = null;

// DOM elements
const queueDisplay = document.getElementById('queue-list');
const currentVideoDisplay = document.getElementById('current-video');
const youtubeUrlInput = document.getElementById('youtube-url');
const addButton = document.getElementById('add-to-queue');
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

// Add this function after extractVideoId function
async function getVideoDetails(videoId) {
  try {
    if (!hasApiKey) {
      // If no API key, return basic details
      return {
        videoId: videoId,
        title: null,
        thumbnail: `https://img.youtube.com/vi/${videoId}/3.jpg`
      };
    }

    const response = await fetch(
      `https://www.googleapis.com/youtube/v3/videos?part=snippet&id=${videoId}&key=${YOUTUBE_API_KEY}`
    );
    const data = await response.json();

    if (data.items && data.items.length > 0) {
      const video = data.items[0];
      return {
        videoId: videoId,
        title: video.snippet.title,
        thumbnail: video.snippet.thumbnails.default.url
      };
    } else {
      throw new Error('Video not found');
    }
  } catch (error) {
    console.error('Error fetching video details:', error);
    // Return basic details on error
    return {
      videoId: videoId,
      title: null,
      thumbnail: `https://img.youtube.com/vi/${videoId}/3.jpg`
    };
  }
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
  console.log('Updating current video display with:', currentVideo);
  
  // Check if this is a Next placeholder (dummy object)
  if (currentVideo && currentVideo.videoId === null && currentVideo.status?.action === 'Next') {
    // Show "Playing next video" state for dummy Next object
    const div = document.createElement('div');
    div.classList.add('queue-item');
    div.innerHTML = `
      <div class="queue-item-info">
        <div class="queue-position">Currently Playing</div>
        <div class="video-title">Playing next video...</div>
        <div class="queue-status">
          <span class="status-action next">
            <span class="material-icons">skip_next</span>
            Next
          </span>
          <span class="status-user">by ${currentVideo.status.user}</span>
          <span class="status-timestamp">${currentVideo.status.timestamp}</span>
        </div>
      </div>
    `;
    currentVideoDisplay.appendChild(div);
  } else if (currentVideo && currentVideo.videoId) {
    // Show normal video display for actual videos
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
  console.log('Updating queue display with:', queue);
  
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
  
  // Filter out Next placeholders for display
  const displayQueue = queue.filter(item => {
    // Log each item for debugging
    console.log('Checking queue item:', item);
    
    // Check if this is a Next placeholder
    const isNextPlaceholder = 
      item.status?.action === 'Next' || // Check for Next action
      item.videoId === null; // Check for null videoId
    
    console.log('Is Next placeholder:', isNextPlaceholder);
    
    // Keep items that are NOT Next placeholders
    return !isNextPlaceholder;
  });
  
  console.log('Filtered queue for display:', displayQueue);
  
  if (displayQueue.length === 0) {
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
  
  displayQueue.forEach((item, index) => {
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
    try {
      const url = youtubeUrlInput.value.trim();
      if (!url) {
        showNotification('Please enter a YouTube URL');
        return;
      }

      // Store original placeholder
      const originalPlaceholder = youtubeUrlInput.placeholder;
      
      // Disable input and button during processing
      youtubeUrlInput.disabled = true;
      addButton.disabled = true;

      // Update placeholder to show validation status
      youtubeUrlInput.placeholder = 'Validating link...';
      console.log('Processing URL:', url);

      // Extract video ID
      const videoId = extractVideoId(url);
      if (!videoId) {
        showNotification('Invalid YouTube URL');
        youtubeUrlInput.value = '';
        youtubeUrlInput.placeholder = originalPlaceholder;
        youtubeUrlInput.disabled = false;
        addButton.disabled = false;
        return;
      }

      // Check if video exists in queue or currently playing
      const queueResponse = await fetch('get_queue.php');
      const queueData = await queueResponse.json();
      
      // Check current video
      if (currentVideo && currentVideo.videoId === videoId) {
        showNotification('This video is currently playing');
        youtubeUrlInput.value = '';
        youtubeUrlInput.placeholder = originalPlaceholder;
        youtubeUrlInput.disabled = false;
        addButton.disabled = false;
        return;
      }

      // Check queue
      if (queueData.some(item => item.videoId === videoId)) {
        showNotification('This video is already in the queue');
        youtubeUrlInput.value = '';
        youtubeUrlInput.placeholder = originalPlaceholder;
        youtubeUrlInput.disabled = false;
        addButton.disabled = false;
        return;
      }

      // Update placeholder to show fetching status
      youtubeUrlInput.placeholder = 'Fetching video details...';

      // Get video details from YouTube
      const videoDetails = await getVideoDetails(videoId);
      if (!videoDetails) {
        showNotification('Could not fetch video details');
        youtubeUrlInput.value = '';
        youtubeUrlInput.placeholder = originalPlaceholder;
        youtubeUrlInput.disabled = false;
        addButton.disabled = false;
        return;
      }

      // Update placeholder to show queue update status
      youtubeUrlInput.placeholder = 'Adding to queue...';

      // Get current queue first
      const currentQueueResponse = await fetch('get_queue.php');
      const currentQueue = await currentQueueResponse.json();

      // Create Next placeholder for this video
      const nextPlaceholder = {
        videoId: null,
        title: 'Loading next video...',
        status: {
          action: 'Next',
          user: userName,
          position: 0,
          timestamp: new Date().toISOString(),
          details: 'Next: ' + (videoDetails.title || url)
        }
      };

      // Create the actual video object
      const queueItem = {
        videoId: videoId,
        title: videoDetails.title,
        thumbnail: videoDetails.thumbnail,
        url: url,
        addedBy: userName,
        timestamp: new Date().toISOString()
      };

      // Add items to the end of current queue - Next placeholder BEFORE the video
      const newQueue = [...currentQueue, nextPlaceholder, queueItem];

      // Save the updated queue
      const response = await fetch('save_queue.php', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ queue: newQueue })
      });

      console.log('Add to queue response status:', response.status);
      const responseData = await response.text();
      console.log('Add to queue response data:', responseData);

      if (!response.ok) {
        throw new Error(`Failed to add to queue: ${response.status} ${responseData}`);
      }

      // Show success notification
      showNotification('Added to queue: ' + (videoDetails.title || 'Video'));

      // Clear input and restore placeholder
      youtubeUrlInput.value = '';
      youtubeUrlInput.placeholder = originalPlaceholder;

      // Re-enable input and button
      youtubeUrlInput.disabled = false;
      addButton.disabled = false;

      // Force an immediate queue refresh
      await loadQueue();

    } catch (error) {
      console.error('Error adding to queue:', error);
      showNotification('Error adding to queue: ' + error.message);
      
      // Reset input state
      youtubeUrlInput.value = '';
      youtubeUrlInput.placeholder = 'Paste YouTube URL here';
      youtubeUrlInput.disabled = false;
      addButton.disabled = false;
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
  document.getElementById('next-button').addEventListener('click', async () => {
    try {
      // First check if there's a next video available
      const queueResponse = await fetch('get_queue.php');
      const queueData = await queueResponse.json();
      
      if (!queueData || queueData.length === 0) {
        showNotification('No videos in queue');
        return;
      }

      // Get the next video (first item in queue)
      const nextVideo = queueData[0];
      console.log('Moving to next video:', nextVideo);

      // Remove first video from queue
      const newQueue = queueData.slice(1);
      console.log('Updated queue:', newQueue);

      // First save the updated queue
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

      // Wait for response data
      await updateResponse.json();

      // Update local state
      currentVideo = currentVideoUpdate;
      updateCurrentVideoDisplay();

      console.log('Successfully moved to next video');

    } catch (error) {
      console.error('Error handling Next action:', error);
      showNotification('Error changing video');
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
}

// Initialize app after player is ready
async function initializeApp() {
  console.log('initializeApp started');
  
  // Load configuration
  await loadConfig();
  
  // Load initial queue and current video
  const [queueResponse, currentVideoResponse] = await Promise.all([
    fetch('get_queue.php'),
    fetch('get_current_video.php')
  ]);

  const queueData = await queueResponse.json();
  const currentVideoData = await currentVideoResponse.json();

  // If there's no current video but queue has items, set up the first video
  if ((!currentVideoData || !currentVideoData.videoId) && queueData && queueData.length > 0) {
    console.log('No current video but queue has items, setting up first video');

    // Create a new queue with Next placeholder at start
    const newQueue = [
      {
        videoId: null,
        title: 'Loading next video...',
        status: {
          action: 'Next',
          user: userName || 'System',
          position: 0,
          timestamp: new Date().toISOString(),
          details: 'Next: ' + (queueData[0].title || queueData[0].url)
        }
      },
      ...queueData
    ];

    // Save the queue with Next placeholder
    console.log('Saving queue with Next placeholder');
    await fetch('save_queue.php', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ queue: newQueue })
    });
  }
  
  // Update displays immediately
  await Promise.all([loadQueue(), loadCurrentVideo()]);
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

// Update processQueueState to always check control visibility
async function processQueueState() {
  try {
    // Get current video state
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

    // Always update control buttons visibility if we have video data
    if (currentVideoData && currentVideoData.status) {
      console.log('Updating controls visibility for action:', currentVideoData.status.action);
      updateControlButtonsVisibility(currentVideoData.status.action);
    }

    // First check if current video is empty
    if (!currentVideoData || !currentVideoData.videoId) {
      console.log('No current video, checking queue');
      
      // Get queue state
      const queueResponse = await fetch('get_queue.php');
      const queueData = await queueResponse.json();

      if (queueData && queueData.length > 0) {
        // Get the first video from queue
        const nextVideo = queueData[0];
        console.log('Found video in queue:', nextVideo);

        // Remove the video from queue
        const newQueue = queueData.slice(1);
        console.log('Updated queue:', newQueue);
        
        // Save the updated queue first
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

        // Then update current video with the queue item
        const currentVideoUpdate = {
          ...nextVideo,
          status: {
            action: 'Play',
            user: userName || 'System',
            position: 0,
            timestamp: new Date().toISOString(),
            details: nextVideo.title || nextVideo.url
          }
        };

        console.log('Updating current video with:', currentVideoUpdate);

        // Update current video
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

        // Load the video (but don't play if not synced)
        console.log('Loading video:', nextVideo.videoId);
        if (hasInitialSync) {
          player.loadVideoById({
            videoId: nextVideo.videoId,
            startSeconds: 0,
            suggestedQuality: 'hd720'
          });
        } else {
          player.cueVideoById({
            videoId: nextVideo.videoId,
            startSeconds: 0,
            suggestedQuality: 'hd720'
          });
        }
        return;
      }
    }

    // Then check for Next placeholder in current video
    if (currentVideoData && 
        currentVideoData.videoId === null && 
        currentVideoData.status?.action === 'Next') {
      console.log('Found Next placeholder in currently playing, processing...');

      // Get queue state
      const queueResponse = await fetch('get_queue.php');
      const queueData = await queueResponse.json();

      // Get the next video from queue
      if (queueData && queueData.length > 0) {
        const nextVideo = queueData[0];
        console.log('Next video found:', nextVideo);

        // Remove the video from queue
        const newQueue = queueData.slice(1);
        console.log('Updated queue:', newQueue);
        
        // Save the updated queue first
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

        console.log('Updating current video with:', currentVideoUpdate);

        // Update current video
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
      }
    }
  } catch (error) {
    console.error('Error processing video state:', error);
  }
}

// Add this function to update control buttons visibility
function updateControlButtonsVisibility(action) {
  console.log('Updating control buttons for action:', action);
  if (action === 'Play') {
    playButton.style.display = 'none';
    pauseButton.style.display = 'flex';
  } else {
    playButton.style.display = 'flex';
    pauseButton.style.display = 'none';
  }
}