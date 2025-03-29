<?php
header('Content-Type: application/json');

$currentVideoFile = 'current_video.json';

if (file_exists($currentVideoFile)) {
    echo file_get_contents($currentVideoFile);
} else {
    echo json_encode([
        'videoId' => '',
        'url' => '',
        'title' => '',
        'status' => [
            'action' => '',
            'user' => '',
            'position' => 0,
            'timestamp' => '',
            'details' => ''
        ]
    ]);
} 