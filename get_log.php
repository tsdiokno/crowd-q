<?php
header('Content-Type: application/json');

$logFile = 'queue.json';
if (file_exists($logFile)) {
    echo file_get_contents($logFile);
} else {
    echo json_encode(['entries' => []]);
}
?> 