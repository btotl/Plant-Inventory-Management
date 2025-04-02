<?php
$csvFile = 'products.csv';

// Create CSV file if it doesn't exist
if (!file_exists($csvFile)) {
    $headers = ['name_size', 'price', 'supplier', 'quantity', 'date_added'];
    file_put_contents($csvFile, implode(',', $headers) . "\n");
}

function ensureFileWritable($filename) {
    if (!file_exists($filename)) {
        // Try to create the file if it doesn't exist
        try {
            file_put_contents($filename, '');
        } catch (Exception $e) {
            return [
                'success' => false,
                'message' => "Could not create file: " . $e->getMessage()
            ];
        }
    }

    // Check current permissions
    $currentPerms = fileperms($filename);
    if ($currentPerms === false) {
        return [
            'success' => false,
            'message' => "Could not get file permissions"
        ];
    }

    // Convert to octal
    $currentPerms = decoct($currentPerms & 0777);
    
    // If file is not writable, try to make it writable
    if (!is_writable($filename)) {
        try {
            // Try to set permissions to 0666 (rw-rw-rw-)
            if (!chmod($filename, 0666)) {
                return [
                    'success' => false,
                    'message' => "Could not set file permissions. Current permissions: $currentPerms"
                ];
            }
            
            // Double check if file is now writable
            if (!is_writable($filename)) {
                return [
                    'success' => false,
                    'message' => "File is still not writable after chmod. Please check file ownership."
                ];
            }
        } catch (Exception $e) {
            return [
                'success' => false,
                'message' => "Error setting permissions: " . $e->getMessage()
            ];
        }
    }

    return [
        'success' => true,
        'message' => "File is writable"
    ];
}

// Handle API requests
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    header('Content-Type: application/json');
    
    if (isset($_POST['action'])) {
        if ($_POST['action'] === 'add') {
            try {
                // Check for duplicates
                $products = [];
                if (($handle = fopen($csvFile, "r")) !== FALSE) {
                    fgetcsv($handle); // Skip header
                    while (($data = fgetcsv($handle)) !== FALSE) {
                        $products[] = [
                            'name_size' => $data[0],
                            'price' => $data[1],
                            'supplier' => $data[2],
                            'quantity' => $data[3],
                            'date_added' => $data[4]
                        ];
                    }
                    fclose($handle);
                }

                $newName = $_POST['name_size'];
                $duplicateIndex = -1;
                foreach ($products as $index => $product) {
                    if (strtolower($product['name_size']) === strtolower($newName)) {
                        $duplicateIndex = $index;
                        break;
                    }
                }

                if ($duplicateIndex !== -1) {
                    echo json_encode([
                        'success' => false,
                        'is_duplicate' => true,
                        'existing_product' => $products[$duplicateIndex]
                    ]);
                    exit;
                }

                // If no duplicate found, add the new product
                $newProduct = [
                    $_POST['name_size'],
                    $_POST['price'],
                    $_POST['supplier'],
                    $_POST['quantity'],
                    date('Y-m-d H:i:s')
                ];
                
                file_put_contents($csvFile, implode(',', $newProduct) . "\n", FILE_APPEND);
                echo json_encode(['success' => true]);
            } catch(Exception $e) {
                echo json_encode(['success' => false, 'error' => $e->getMessage()]);
            }
        } elseif ($_POST['action'] === 'update_quantity') {
            try {
                $products = [];
                if (($handle = fopen($csvFile, "r")) !== FALSE) {
                    $headers = fgetcsv($handle);
                    while (($data = fgetcsv($handle)) !== FALSE) {
                        $products[] = $data;
                    }
                    fclose($handle);
                }

                $index = intval($_POST['index']);
                $change = $_POST['change'];
                
                if ($index >= 0 && $index < count($products)) {
                    $products[$index][3] = max(0, intval($products[$index][3]) + $change);

                    // Write back to CSV
                    $fp = fopen($csvFile, 'w');
                    fputcsv($fp, $headers);
                    foreach ($products as $product) {
                        fputcsv($fp, $product);
                    }
                    fclose($fp);

                    echo json_encode(['success' => true, 'new_quantity' => $products[$index][3]]);
                } else {
                    echo json_encode(['success' => false, 'error' => 'Invalid index']);
                }
            } catch(Exception $e) {
                echo json_encode(['success' => false, 'error' => $e->getMessage()]);
            }
        } elseif ($_POST['action'] === 'edit') {
            try {
                $products = [];
                if (($handle = fopen($csvFile, "r")) !== FALSE) {
                    $headers = fgetcsv($handle);
                    while (($data = fgetcsv($handle)) !== FALSE) {
                        $products[] = $data;
                    }
                    fclose($handle);
                }

                $index = intval($_POST['index']);
                
                if ($index >= 0 && $index < count($products)) {
                    // Update the product at the specified index
                    $products[$index] = [
                        $_POST['name_size'],
                        $_POST['price'],
                        $_POST['supplier'],
                        $_POST['quantity'],
                        date('Y-m-d H:i:s')
                    ];

                    // Write back to CSV with proper escaping
                    $fp = fopen($csvFile, 'w');
                    if ($fp) {
                        // Write headers
                        fputcsv($fp, ['name_size', 'price', 'supplier', 'quantity', 'date_added']);
                        
                        // Write data
                        foreach ($products as $product) {
                            fputcsv($fp, $product);
                        }
                        fclose($fp);
                        echo json_encode(['success' => true]);
                    } else {
                        echo json_encode(['success' => false, 'error' => 'Could not open file for writing']);
                    }
                } else {
                    echo json_encode(['success' => false, 'error' => 'Invalid index']);
                }
            } catch(Exception $e) {
                echo json_encode(['success' => false, 'error' => $e->getMessage()]);
            }
        } elseif ($_POST['action'] === 'delete') {
            try {
                $products = [];
                if (($handle = fopen($csvFile, "r")) !== FALSE) {
                    $headers = fgetcsv($handle);
                    while (($data = fgetcsv($handle)) !== FALSE) {
                        $products[] = $data;
                    }
                    fclose($handle);
                }

                $index = intval($_POST['index']);
                
                if ($index >= 0 && $index < count($products)) {
                    // Remove the product at the specified index
                    array_splice($products, $index, 1);

                    // Write back to CSV with proper escaping
                    $fp = fopen($csvFile, 'w');
                    if ($fp) {
                        // Write headers
                        fputcsv($fp, ['name_size', 'price', 'supplier', 'quantity', 'date_added']);
                        
                        // Write data
                        foreach ($products as $product) {
                            fputcsv($fp, $product);
                        }
                        fclose($fp);
                        echo json_encode(['success' => true]);
                    } else {
                        echo json_encode(['success' => false, 'error' => 'Could not open file for writing']);
                    }
                } else {
                    echo json_encode(['success' => false, 'error' => 'Invalid index']);
                }
            } catch(Exception $e) {
                echo json_encode(['success' => false, 'error' => $e->getMessage()]);
            }
        }
        exit;
    }
}

// Handle GET requests for products
if ($_SERVER['REQUEST_METHOD'] === 'GET' && isset($_GET['action']) && $_GET['action'] === 'get_products') {
    header('Content-Type: application/json');
    
    $search = isset($_GET['search']) ? $_GET['search'] : '';
    $sort = isset($_GET['sort']) ? $_GET['sort'] : 'date_added';
    $page = isset($_GET['page']) ? max(1, intval($_GET['page'])) : 1;
    $per_page = 10;
    
    try {
        $products = [];
        if (($handle = fopen($csvFile, "r")) !== FALSE) {
            $headers = fgetcsv($handle); // Store headers
            
            while (($data = fgetcsv($handle)) !== FALSE) {
                if (count($data) >= 5) { // Make sure we have all required fields
                    $products[] = [
                        'name_size' => $data[0],
                        'price' => $data[1],
                        'supplier' => $data[2],
                        'quantity' => $data[3],
                        'date_added' => $data[4]
                    ];
                }
            }
            fclose($handle);
        }
        
        // Filter by search if search term is provided
        if (!empty($search) && strlen($search) >= 3) {
            $products = array_filter($products, function($product) use ($search) {
                return stripos($product['name_size'], $search) !== false;
            });
            $products = array_values($products); // Reset array keys
        }
        
        // Sort products
        usort($products, function($a, $b) use ($sort) {
            if ($sort === 'date_added') {
                return strtotime($b['date_added']) - strtotime($a['date_added']);
            } elseif ($sort === 'price') {
                return floatval($a['price']) - floatval($b['price']);
            } elseif ($sort === 'quantity') {
                return intval($a['quantity']) - intval($b['quantity']);
            }
            return strcasecmp($a[$sort], $b[$sort]);
        });
        
        // Calculate pagination
        $total_products = count($products);
        $total_pages = max(1, ceil($total_products / $per_page));
        $page = min($page, $total_pages); // Ensure page doesn't exceed total pages
        
        // Get products for current page
        $offset = ($page - 1) * $per_page;
        $paged_products = array_slice($products, $offset, $per_page);
        
        // Add the original index to each product
        foreach ($paged_products as $i => $product) {
            $product['original_index'] = $offset + $i;
        }
        
        echo json_encode([
            'products' => $paged_products,
            'pagination' => [
                'current_page' => $page,
                'total_pages' => $total_pages,
                'total_products' => $total_products,
                'per_page' => $per_page
            ]
        ]);
    } catch(Exception $e) {
        echo json_encode([
            'error' => $e->getMessage(),
            'products' => [],
            'pagination' => [
                'current_page' => 1,
                'total_pages' => 1,
                'total_products' => 0,
                'per_page' => $per_page
            ]
        ]);
    }
    exit;
}
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
    <meta name="apple-mobile-web-app-capable" content="yes">
    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
    <title>Product Inventory</title>
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.0/font/bootstrap-icons.css">
    <link rel="stylesheet" href="style.css">
    <style>
        /* ... existing styles ... */
        
        .word-box {
            transition: background-color 0.2s ease;
            border-radius: 2px;
        }
        
        .word-box:hover {
            background: rgba(0,123,255,0.2) !important;
        }
        
        .selected-text {
            min-height: 38px;
            background: #f8f9fa;
        }
        
        .selection-container {
            background: #fff;
            border-radius: 8px;
            overflow: hidden;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }

        .live-detection-overlay {
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            pointer-events: none;
        }

        .live-text-box {
            position: absolute;
            border: 2px solid #00ff00;
            background: rgba(0, 255, 0, 0.1);
            animation: pulse 2s infinite;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 12px;
            color: white;
            text-shadow: 0 0 2px black;
        }

        .text-label {
            background: rgba(0, 0, 0, 0.7);
            padding: 2px 4px;
            border-radius: 3px;
            white-space: nowrap;
            transform: scale(0.8);
            pointer-events: none;
        }

        @keyframes pulse {
            0% {
                border-color: currentColor;
                background: rgba(255, 255, 255, 0.1);
            }
            50% {
                border-color: currentColor;
                background: rgba(255, 255, 255, 0.2);
            }
            100% {
                border-color: currentColor;
                background: rgba(255, 255, 255, 0.1);
            }
        }

        .camera-container {
            position: relative;
            overflow: hidden;
            background: black;
        }

        #camera {
            width: 100%;
            height: auto;
            max-height: 70vh;
            transform: scaleX(-1); /* Mirror the camera for more natural interaction */
        }

        .scan-overlay {
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            pointer-events: none;
            border: 2px solid rgba(255, 255, 255, 0.5);
            box-shadow: 0 0 0 9999px rgba(0, 0, 0, 0.5);
        }

        .scan-frame {
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            width: 80%;
            height: 60%;
            border: 2px solid #fff;
            border-radius: 10px;
            box-shadow: 0 0 0 9999px rgba(0, 0, 0, 0.5);
        }
        
        /* ... rest of existing styles ... */
    </style>
</head>
<body>
    <div class="container mt-4">
        <h1 class="mb-4">Product Inventory</h1>
        
        <!-- Add Product Form -->
        <div class="card mb-4 glass-effect">
            <div class="card-body">
                <h5 class="card-title">Add New Product</h5>
                <form id="addProductForm">
                    <div class="row g-3">
                        <div class="col-md-6">
                            <div class="input-group">
                                <input type="text" class="form-control modern-input" id="nameSize" name="name_size" placeholder="Name & Size" required>
                                <button type="button" class="btn btn-outline-primary modern-button" id="scanButton">
                                    <i class="bi bi-camera"></i> Scan
                                </button>
                            </div>
                        </div>
                        <div class="col-md-3">
                            <input type="number" class="form-control modern-input" id="price" name="price" placeholder="Price" step="0.01" required>
                        </div>
                        <div class="col-md-3">
                            <input type="number" class="form-control modern-input" id="quantity" name="quantity" placeholder="Quantity" required>
                        </div>
                        <div class="col-md-12">
                            <input type="text" class="form-control modern-input" id="supplier" name="supplier" placeholder="Supplier (Optional)">
                        </div>
                        <div class="col-12">
                            <button type="submit" class="btn btn-primary modern-button">Add Product</button>
                        </div>
                    </div>
                </form>
            </div>
        </div>

        <!-- Camera Modal -->
        <div class="modal fade" id="cameraModal" tabindex="-1" data-bs-backdrop="static">
            <div class="modal-dialog modal-lg modal-dialog-centered">
                <div class="modal-content glass-effect">
                    <div class="modal-header">
                        <h5 class="modal-title">Scan Price Tag</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body p-0">
                        <div class="camera-container">
                            <video id="camera" playsinline autoplay muted style="width: 100%; height: auto; max-height: 70vh;"></video>
                            <canvas id="canvas" style="display: none;"></canvas>
                            <div class="scan-overlay">
                                <div class="scan-frame"></div>
                            </div>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary modern-button" data-bs-dismiss="modal">Cancel</button>
                        <button type="button" class="btn btn-primary modern-button" id="captureButton">
                            <i class="bi bi-camera-fill"></i> Capture
                        </button>
                    </div>
                </div>
            </div>
        </div>

        <!-- Search and Sort -->
        <div class="row mb-3">
            <div class="col-md-6">
                <input type="text" class="form-control modern-input" id="searchInput" placeholder="Search (min 3 characters)">
            </div>
            <div class="col-md-6">
                <select class="form-select modern-input" id="sortSelect">
                    <option value="date_added">Most Recent</option>
                    <option value="name_size">Name</option>
                    <option value="price">Price</option>
                    <option value="quantity">Quantity</option>
                </select>
            </div>
        </div>

        <!-- Products Table -->
        <div class="table-responsive glass-effect">
            <table class="table">
                <thead>
                    <tr>
                        <th>Name & Size</th>
                        <th>Price</th>
                        <th>Supplier</th>
                        <th>Quantity</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody id="productsTableBody">
                </tbody>
            </table>
            <div id="pagination" class="mt-3"></div>
        </div>
    </div>

    <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/tesseract.js@v2.1.1/dist/tesseract.min.js"></script>
    <script src="script.js"></script>
</body>
</html> 