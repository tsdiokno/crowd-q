<?php
header('Content-Type: application/json');

try {
    // Get the JSON data from the request
    $json = file_get_contents('php://input');
    $queueItem = json_decode($json, true);

    if (!$queueItem) {
        throw new Exception('Invalid JSON data');
    }

    // Load the current queue
    $queueFile = 'queue.json';
    $queue = [];
    if (file_exists($queueFile)) {
        $queue = json_decode(file_get_contents($queueFile), true) ?: [];
    }

    // Add the new item to the queue
    $queue[] = $queueItem;

    // Save the updated queue
    if (file_put_contents($queueFile, json_encode($queue, JSON_PRETTY_PRINT)) === false) {
        throw new Exception('Failed to save queue file');
    }

    // Return success response
    echo json_encode([
        'status' => 'success',
        'message' => 'Item added to queue',
        'queueLength' => count($queue)
    ]);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'status' => 'error',
        'message' => $e->getMessage()
    ]);
}
?> 