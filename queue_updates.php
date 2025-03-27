<?php
header('Content-Type: application/json');

// Get the last modification time of queue.json
$queueFile = 'queue.json';
$lastModified = file_exists($queueFile) ? filemtime($queueFile) : 0;

// Return the last modified timestamp
echo json_encode(['lastModified' => $lastModified]); 