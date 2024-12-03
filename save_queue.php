<?php
// Define the file where the queue is stored
$queueFile = 'queue.json';

// Get the queue from the POST request (it's expected to be in JSON format)
$data = json_decode(file_get_contents('php://input'), true);

// Save the queue to the file
if (isset($data['queue'])) {
    // Encode the queue as JSON and write it to the file
    file_put_contents($queueFile, json_encode($data['queue']));
}

// Respond with a success message
echo json_encode(['status' => 'success']);
?>
