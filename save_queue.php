<?php
header('Content-Type: application/json');

// Enable error reporting
error_reporting(E_ALL);
ini_set('display_errors', 1);

// Define the file where the queue is stored
$queueFile = 'queue.json';

// Get the POST data
$input = file_get_contents('php://input');
error_log("Received input: " . $input);

$data = json_decode($input, true);
if (json_last_error() !== JSON_ERROR_NONE) {
    error_log("JSON decode error: " . json_last_error_msg());
    http_response_code(400);
    echo json_encode(['error' => 'Invalid JSON data']);
    exit;
}

// Extract queue from data
$queue = $data['queue'] ?? [];
if (!is_array($queue)) {
    error_log("Queue is not an array: " . print_r($queue, true));
    http_response_code(400);
    echo json_encode(['error' => 'Queue must be an array']);
    exit;
}

// Save the queue to the file
$result = file_put_contents($queueFile, json_encode($queue, JSON_PRETTY_PRINT));
if ($result === false) {
    error_log("Failed to write to queue file");
    http_response_code(500);
    echo json_encode(['error' => 'Failed to save queue']);
    exit;
}

// Broadcast the update to all connected WebSocket clients
$ch = curl_init('http://localhost:8080');
curl_setopt($ch, CURLOPT_POST, 1);
curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($queue));
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_exec($ch);
curl_close($ch);

// Respond with success and the saved queue
echo json_encode([
    'success' => true,
    'queue' => $queue
]);
?>
