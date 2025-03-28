<?php
header('Content-Type: application/json');

// Get POST data
$data = json_decode(file_get_contents('php://input'), true);

if (isset($data['action']) && isset($data['user']) && isset($data['timestamp'])) {
    // Read current log
    $logFile = 'activity_log.json';
    $logData = file_exists($logFile) ? json_decode(file_get_contents($logFile), true) : ['entries' => []];
    
    // Add new entry
    $newEntry = [
        'timestamp' => $data['timestamp'],
        'user' => $data['user'],
        'action' => $data['action'],
        'details' => $data['details'] ?? ''
    ];
    
    array_unshift($logData['entries'], $newEntry);
    
    // Keep only the last 50 entries
    $logData['entries'] = array_slice($logData['entries'], 0, 50);
    
    // Save updated log
    file_put_contents($logFile, json_encode($logData));
    echo json_encode(['success' => true]);
} else {
    echo json_encode(['success' => false, 'error' => 'Missing required data']);
}
?> 