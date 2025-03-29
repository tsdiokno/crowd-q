<?php
header('Content-Type: application/json');

$currentVideoFile = 'current_video.json';
$input = file_get_contents('php://input');
$data = json_decode($input, true);

if ($data) {
    file_put_contents($currentVideoFile, json_encode($data, JSON_PRETTY_PRINT));
    echo json_encode(['success' => true]);
} else {
    http_response_code(400);
    echo json_encode(['error' => 'Invalid data']);
} 