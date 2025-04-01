// Global variables
let queue = [];
let currentVideo = null;
let player = null;
let userName = sessionStorage.getItem('userName');
let YOUTUBE_API_KEY = null;
let hasApiKey = false;
let hasInitialSync = false;

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
const nextButton = document.getElementById('next-button');
const syncDisplayWrapper = document.getElementById('sync-display-wrapper');

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

  if(hasInitialSync){

    console.log('loadQueue Running...');

    try {

      const response = await fetch('get_queue.php');

      const newQueueData = await response.json();
      
      // Update queue and display
      queue = newQueueData;

      updateQueueDisplay();

      console.log('Queue display updated');

    } catch (error) {

      console.error('Error loading queue:', error);

    }

  }
  
}

// Load current video from server

async function loadCurrentVideo() {

  if(hasInitialSync){

    console.log('loadCurrentVideo Running...');

    try {

      const response = await fetch('get_current_video.php');

      const newCurrentVideo = await response.json();
      
      // Update current video and display

      currentVideo = newCurrentVideo;

      updateCurrentVideoDisplay();

      console.log('Current Video UI updated');

    } catch (error) {

      console.error('Error loading Current Video UI:', error);

    }

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

    console.log('Current Video JSON Loaded on Player:', currentVideoData);

    const playerReadyPosition = currentVideoData.status.position;

    console.log('Loaded Ready Video Position:', playerReadyPosition);

    if (currentVideoData && currentVideoData.videoId !== hasInitialSync) {
      console.log('Has not synced yet.');
    }

    if (currentVideoData && currentVideoData.videoId) {

      // Show sync button and hide controls initially
      syncPlaybackButton.style.display = 'flex';

      //controlButtons.style.display = 'none';

      hasInitialSync = false;

      // Hide both play and pause buttons initially

      syncDisplayWrapper.style.display = 'none';

    }
  } catch (error) {
    console.error('Error loading current video on player ready:', error);
    syncPlaybackButton.style.display = 'flex';
    syncDisplayWrapper.style.display = 'none';
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
  
  //Try to reload the video if it's a temporary error
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

    }
  } catch (error) {
    console.error('Error updating current video:', error);
  }
}


// Update current video display (UI)

function updateCurrentVideoDisplay() {
  currentVideoDisplay.innerHTML = '';
  console.log('Updating current video display with:', currentVideo);
  
  if (!currentVideo) {
    // Show empty state
    currentVideoDisplay.innerHTML = `
      <div class="queue-item empty-state">
        <div class="queue-item-info">
          <div class="queue-position">No video playing</div>
          <div class="video-title">Add a video to start playing</div>
        </div>
      </div>
    `;
    return;
  }

  // Check if this is a Next placeholder (dummy object)
  if (currentVideo.videoId === null) {
    console.log('Displaying Next placeholder state');
    const div = document.createElement('div');
    div.classList.add('queue-item');
    div.innerHTML = `
      <div class="queue-item-info">
        <div class="queue-position">Currently Playing</div>
        <div class="video-title">Playing next item...</div>
        <div class="queue-status">
          <span class="status-action next">
            <span class="material-icons">skip_next</span>
            Next
          </span>
          ${currentVideo.status ? `<span class="status-user">by ${currentVideo.status.user}</span>` : ''}
        </div>
      </div>
    `;
    currentVideoDisplay.appendChild(div);
    return;
  }

  // Regular video display
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
}

// Update the queue display (now only shows upcoming videos)

function updateQueueDisplay() {

  queueDisplay.innerHTML = '';

  // console.log('Updating queue display with:', queue);

  console.log('Updating queue display...');
  
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
  
  //console.log('Filtered queue for display:', displayQueue);
  
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
        timestamp: new Date().toISOString(),
        status: {
          action: 'Play',
          user: userName,
          position: 0,
          timestamp: new Date().toISOString(),
          details: 'Loading next video...'
        }
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

  // Next button click handler - updates current video state

  nextButton.addEventListener('click', handleNextAction);


  // Sync playback button click handler

  syncPlaybackButton.addEventListener('click', async () => {

    try {

      console.log('=== SYNC PLAYBACK STARTED');
      
      // Get current video state
      const response = await fetch('get_current_video.php');
      const currentVideoData = await response.json();

      const lastUpdateTime = new Date(currentVideoData.status.timestamp);
      const syncClickTime = new Date();
      const elapsedSeconds = Math.floor((syncClickTime - lastUpdateTime) / 1000);
      const startPosition = parseFloat(currentVideoData.status.position);
      const currentPosition = startPosition + elapsedSeconds;
      
      console.log('Current Video JSON on Sync Playback:', currentVideoData);

      // Calculate initial position if video is playing
      if (currentVideoData?.status?.action === 'Play' && currentVideoData.videoId) {

        console.log('Current Video on JSON is PLAY');

        console.log('Time calculation:', {
          lastUpdate: lastUpdateTime.toISOString(),
          syncClick: syncClickTime.toISOString(),
          elapsed: elapsedSeconds,
          startPos: startPosition,
          currentPos: currentPosition
        });
       

        // Load video at calculated position

        hasInitialSync = true;
        await loadCurrentVideo();
        await processQueueState();
        await loadQueue();

        player.loadVideoById({
          videoId: currentVideoData.videoId,
          startSeconds: currentPosition,
          suggestedQuality: 'hd720'
        });

      } else {

        hasInitialSync = true;
        await loadCurrentVideo();
        await processQueueState();
        await loadQueue();

        player.cueVideoById({
          videoId: currentVideoData.videoId,
          startSeconds: startPosition,
          suggestedQuality: 'hd720'
        });

      }
      
      // Update UI
      syncPlaybackButton.style.display = 'none';
      syncDisplayWrapper.style.display = 'block';
      
      console.log('=== SYNC PLAYBACK COMPLETED');

    } catch (error) {

      console.error('Sync error:', error);

      showNotification('Error syncing playback');

    }

  });
}


// Initialize app after player is ready

async function initializeApp() {

  console.log('initializeApp started');
  
  // Load configuration
  await loadConfig();
  
  // Start ALL polling immediately
  setInterval(loadQueue, 5000);
  setInterval(loadCurrentVideo, 5000);
  setInterval(processQueueState, 3000); 
  
  // Set up event listeners

  setupEventListeners();
  
  // Show sync button and hide controls initially
  syncPlaybackButton.style.display = 'flex';
  // controlButtons.style.display = 'none';
  
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
      'controls': 0,  // Show controls initially
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

async function handleNextAction() {

  console.log('Handling Next action');

  const queueResponse = await fetch('get_queue.php');

  const queueData = await queueResponse.json();

  if (queueData && queueData.length > 0) {

    const nextVideo = queueData[0];
    console.log('Loading next video:', nextVideo);
    
    // Remove first video from queue
    const newQueue = queueData.slice(1);
    
    // Save the updated queue
    await fetch('save_queue.php', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ queue: newQueue })

    });


    const currentVideoUpdate = {
      ...nextVideo,
      status: {
        user: userName || 'System',
        position: 0,
        timestamp: new Date().toISOString(),
        details: nextVideo.title || nextVideo.url
      }

    };

    // Update current video on server

    await fetch('update_current_video.php', {

      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(currentVideoUpdate)

    });

    // Load the video in player if we have initial sync

    if (hasInitialSync && player && nextVideo.videoId) {
      player.loadVideoById({
        videoId: nextVideo.videoId,
        startSeconds: 0,
        suggestedQuality: 'hd720'
      });

    }

    // Update local state

    currentVideo = currentVideoUpdate;

    updateCurrentVideoDisplay();

  }

}

// PROCESS QUEUE STATE

async function processQueueState() {

  if (hasInitialSync) {

  console.log('Initial Sync: ', hasInitialSync);

  console.log('Running Process Queue State...');
  
  try {

    // Get current video state
    const response = await fetch('get_current_video.php');
    const currentVideoData = await response.json();

    //console.log('Current Video in Client: ', currentVideo);
    //console.log('Current Video in Server: ', currentVideoData);
    
    // Always update control buttons visibility based on current JSON state
    if (currentVideoData && currentVideoData.status) {

      console.log('Updating control buttons for action:', currentVideoData.status.action);
      updateControlButtonsVisibility(currentVideoData.status.action);

    }

    // Check for Next action - simplified check
    if (currentVideoData?.status?.action === 'Next' || currentVideoData?.videoId === null) {
      console.log('Found Next action, handling it');
      await handleNextAction();
      return;
    }

    // Handle regular video state changes

    if (currentVideoData && currentVideoData.videoId) {
      
      // Always load the new video if it's different from what's currently playing

      if (currentVideoData.videoId !== player.getVideoData()?.video_id) {

        const status = currentVideoData.status;
        const position = status?.position || 0;
        
        console.log('Processing new JSON state:', currentVideoData);
        console.log('Loading different video with position:', position);
        
        if (status?.action === 'Play' ) {

          player.loadVideoById({
            videoId: currentVideoData.videoId,
            startSeconds: position,
            suggestedQuality: 'hd720'
          });

        } 

      } else {

        // Same video, just update play state

        const status = currentVideoData.status;
        const currentPlayerState = player.getPlayerState();
        const position = status?.position || 0;
        
        if (status.action === 'Play' && currentPlayerState !== YT.PlayerState.PLAYING) {
          
          setTimeout( function () {

            player.loadVideoById({
              videoId: currentVideoData.videoId,
              startSeconds: position,
              suggestedQuality: 'hd720'
            });
  

          }, 1000);

          console.log('Player State: ', YT.PlayerState);


        } else if (status.action === 'Pause' && currentPlayerState !== YT.PlayerState.PAUSED) {

          setTimeout( function () {

            player.pauseVideo();

          }, 1000);
          
          console.log('Player State: ', YT.PlayerState);

        }
      }
    } // Handle regular video state changes

    // Update our local state

    currentVideo = currentVideoData;

  } catch (error) {

    console.error('Error processing video state:', error);

  }

  }
  
}

// Play button click handler - updates current video state

playButton.addEventListener('click', async () => {
      
  if (currentVideo && currentVideo.videoId && player) {

      const currentPosition = player.getCurrentTime();

      console.log('== Click PLAY - Updating Currently Playing JSON with:', currentPosition);

      // Then update the status
      await addLogEntry('Play', currentVideo.title, currentPosition);

  }

});

// Pause button click handler - updates current video state
pauseButton.addEventListener('click', async () => {
  if (currentVideo && currentVideo.videoId && player) {

    const currentPosition = player.getCurrentTime();

    console.log('== Click PAUSE - Updating Currently Playing JSON with:', currentPosition);

    // Then update the status
    await addLogEntry('Pause', currentVideo.title, currentPosition);
    
  }
});



// Add this function to update control buttons visibility
function updateControlButtonsVisibility(action) {
  console.log('Updating UI control buttons for action:', action);
  
  // Always show both buttons initially
  playButton.style.display = 'flex';
  pauseButton.style.display = 'flex';
  
  // Then hide the appropriate button based on action
  if (action === 'Play') {
    playButton.style.display = 'none';
    pauseButton.style.display = 'flex';
  } else if (action === 'Pause') {
    playButton.style.display = 'flex';
    pauseButton.style.display = 'none';
  }
}

// Helper function to update control buttons
function updateControlButtons(action) {
  const playButton = document.getElementById('play-button');
  const pauseButton = document.getElementById('pause-button');
  
  if (action === 'Play') {
    playButton.style.display = 'none';
    pauseButton.style.display = 'inline-block';
  } else if (action === 'Pause') {
    playButton.style.display = 'inline-block';
    pauseButton.style.display = 'none';
  }
}

