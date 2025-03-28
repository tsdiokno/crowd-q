<?php
header('Content-Type: application/json');

$logFile = 'activity_log.json';
if (file_exists($logFile)) {
    echo file_get_contents($logFile);
} else {
    echo json_encode(['entries' => []]);
}
?> 