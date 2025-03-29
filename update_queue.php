<?php
header('Content-Type: application/json');

// Only allow PATCH method
if ($_SERVER['REQUEST_METHOD'] !== 'PATCH') {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
    exit;
}

// Get the raw input data
$input = file_get_contents('php://input');
$data = json_decode($input, true);

if (!$data || !isset($data['index']) || !isset($data['status'])) {
    http_response_code(400);
    echo json_encode(['error' => 'Invalid request data']);
    exit;
}

$queueFile = 'queue.json';
$index = $data['index'];
$newStatus = $data['status'];

// Read current queue
if (!file_exists($queueFile)) {
    http_response_code(404);
    echo json_encode(['error' => 'Queue file not found']);
    exit;
}

$queue = json_decode(file_get_contents($queueFile), true);

if (!is_array($queue)) {
    http_response_code(500);
    echo json_encode(['error' => 'Invalid queue data']);
    exit;
}

// Check if index exists
if (!isset($queue[$index])) {
    http_response_code(404);
    echo json_encode(['error' => 'Queue item not found']);
    exit;
}

// Update the status of the specified item
$queue[$index]['status'] = $newStatus;

// Save the updated queue
if (file_put_contents($queueFile, json_encode($queue, JSON_PRETTY_PRINT))) {
    echo json_encode(['success' => true, 'queue' => $queue]);
} else {
    http_response_code(500);
    echo json_encode(['error' => 'Failed to save queue']);
}
?> 