<?php
header('Content-Type: application/json');

// Define the file where the queue is stored
$queueFile = 'queue.json';

// Get the POST data
$data = json_decode(file_get_contents('php://input'), true);
$queue = $data['queue'] ?? [];

// Save the queue to the file
file_put_contents($queueFile, json_encode($queue));

// Broadcast the update to all connected WebSocket clients
$ch = curl_init('http://localhost:8080');
curl_setopt($ch, CURLOPT_POST, 1);
curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($queue));
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_exec($ch);
curl_close($ch);

// Respond with a success message
echo json_encode(['success' => true]);
?>
