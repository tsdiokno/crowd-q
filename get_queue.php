<?php
// Path to your queue file (e.g., a JSON file)
$queueFile = 'queue.json';

// Function to read the queue from the file
function getQueue() {
    global $queueFile;
    if (file_exists($queueFile)) {
        $queueData = file_get_contents($queueFile);
        return json_decode($queueData, true) ?? [];
    }
    return [];
}

// Fetch the current queue and return it as JSON
header('Content-Type: application/json');
echo json_encode(getQueue());