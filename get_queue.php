<?php
header('Content-Type: application/json');

// Path to your queue file
$queueFile = 'queue.json';

// Function to read the queue from the file
function getQueue() {
    global $queueFile;
    if (file_exists($queueFile)) {
        $queueData = file_get_contents($queueFile);
        $queue = json_decode($queueData, true);
        return is_array($queue) ? $queue : [];
    }
    return [];
}

// Fetch the current queue and return it as JSON
$queue = getQueue();
echo json_encode($queue);