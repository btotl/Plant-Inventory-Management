document.addEventListener('DOMContentLoaded', function() {
    const addProductForm = document.getElementById('addProductForm');
    const searchInput = document.getElementById('searchInput');
    const sortSelect = document.getElementById('sortSelect');
    const productsTableBody = document.getElementById('productsTableBody');
    const scanButton = document.getElementById('scanButton');
    const cameraModal = new bootstrap.Modal(document.getElementById('cameraModal'));
    const camera = document.getElementById('camera');
    const canvas = document.getElementById('canvas');
    const captureButton = document.getElementById('captureButton');
    let stream = null;

    // Load products on page load
    loadProducts(1);

    // Camera functionality
    let liveDetectionInterval = null;
    let isProcessing = false;

    scanButton.addEventListener('click', async function() {
        try {
            // Check if we're using HTTPS
            if (window.location.protocol !== 'https:') {
                throw new Error('Camera access requires a secure connection (HTTPS). Please access this site using HTTPS or contact your administrator to set up SSL.');
            }

            // First check if the browser supports getUserMedia
            if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                throw new Error('Your browser does not support camera access. Please try using Safari or Chrome on your iPhone.');
            }

            // iOS-specific camera constraints
            const constraints = {
                video: {
                    facingMode: { exact: 'environment' },
                    width: { ideal: 1280 },
                    height: { ideal: 720 }
                },
                audio: false
            };

            console.log('Requesting camera access with constraints:', constraints);

            // Request camera access
            stream = await navigator.mediaDevices.getUserMedia(constraints);
            console.log('Camera access granted, stream:', stream);

            // Set the video source
            camera.srcObject = stream;
            
            // iOS-specific video setup
            camera.setAttribute('playsinline', '');
            camera.setAttribute('autoplay', '');
            camera.setAttribute('muted', '');
            
            // Remove mirroring
            camera.style.transform = 'none';
            
            // Wait for the video to be ready
            await new Promise((resolve, reject) => {
                camera.onloadedmetadata = () => {
                    console.log('Video metadata loaded');
                    camera.play()
                        .then(() => {
                            console.log('Video playback started');
                            resolve();
                        })
                        .catch(e => {
                            console.error('Video playback failed:', e);
                            reject(e);
                        });
                };
                camera.onerror = (e) => {
                    console.error('Video error:', e);
                    reject(e);
                };
            });

            // Create live detection overlay
            const overlayContainer = document.createElement('div');
            overlayContainer.className = 'live-detection-overlay';
            document.querySelector('.camera-container').appendChild(overlayContainer);

            // Start live detection
            liveDetectionInterval = setInterval(async () => {
                if (!isProcessing) {
                    const context = canvas.getContext('2d');
                    canvas.width = camera.videoWidth;
                    canvas.height = camera.videoHeight;
                    context.drawImage(camera, 0, 0);

                    // Image processing for better text detection
                    try {
                        // Increase contrast and sharpness
                        const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
                        const data = imageData.data;
                        
                        // Increase contrast
                        const contrast = 1.8; // Increased contrast for better text detection
                        const factor = (259 * (contrast + 255)) / (255 * (259 - contrast));
                        
                        for (let i = 0; i < data.length; i += 4) {
                            // Apply contrast
                            data[i] = factor * (data[i] - 128) + 128;     // red
                            data[i + 1] = factor * (data[i + 1] - 128) + 128; // green
                            data[i + 2] = factor * (data[i + 2] - 128) + 128; // blue
                        }
                        
                        context.putImageData(imageData, 0, 0);

                        // Perform OCR with optimized settings
                        const result = await Tesseract.recognize(
                            canvas.toDataURL('image/jpeg', 0.9), // Increased quality
                            'eng',
                            {
                                logger: m => {},
                                tessedit_char_whitelist: '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz$., ',
                                tessedit_pageseg_mode: '7',  // Treat the image as a single text line
                                tessjs_create_pdf: '0',
                                tessjs_create_hocr: '0',
                                tessjs_create_tsv: '0',
                                tessjs_create_box: '0',
                                tessjs_create_unlv: '0',
                                tessjs_create_osd: '0'
                            }
                        );

                        // Update overlay with detected text boxes
                        overlayContainer.innerHTML = '';
                        result.data.words
                            .filter(word => word.confidence > 70) // Increased confidence threshold
                            .forEach(word => {
                                const box = document.createElement('div');
                                box.className = 'live-text-box';
                                const scale = camera.offsetWidth / canvas.width;
                                
                                // Add text label
                                box.innerHTML = `<span class="text-label">${word.text}</span>`;
                                
                                // Position the box
                                box.style.left = `${word.bbox.x0 * scale}px`;
                                box.style.top = `${word.bbox.y0 * scale}px`;
                                box.style.width = `${(word.bbox.x1 - word.bbox.x0) * scale}px`;
                                box.style.height = `${(word.bbox.y1 - word.bbox.y0) * scale}px`;
                                
                                // Color code based on confidence
                                const confidence = word.confidence;
                                const hue = Math.min(120, confidence); // 0-120 maps to red-yellow-green
                                box.style.borderColor = `hsla(${hue}, 100%, 50%, 0.8)`;
                                box.style.backgroundColor = `hsla(${hue}, 100%, 50%, 0.1)`;
                                
                                overlayContainer.appendChild(box);
                            });
                    } catch (e) {
                        console.error('Live detection error:', e);
                    }
                }
            }, 800); // Reduced interval to 800ms for more frequent updates

            // Show the modal
            cameraModal.show();
        } catch (error) {
            console.error('Camera error:', error);
            
            // iOS-specific error handling
            let errorMessage = 'Could not access camera. ';
            if (error.message.includes('HTTPS')) {
                errorMessage = 'Camera access requires a secure connection (HTTPS).\n\n';
                errorMessage += 'To fix this:\n';
                errorMessage += '1. Access this site using HTTPS (https://) instead of HTTP\n';
                errorMessage += '2. If you\'re using KSWEB, make sure to:\n';
                errorMessage += '   - Enable SSL in KSWEB settings\n';
                errorMessage += '   - Access the site using https://localhost:port\n';
                errorMessage += '   - Accept the SSL certificate in your browser\n\n';
                errorMessage += 'If you\'re not sure how to set this up, please contact your administrator.';
            } else if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
                errorMessage = 'Camera access denied. To enable camera access on your iPhone:\n\n';
                errorMessage += '1. Open iPhone Settings\n';
                errorMessage += '2. Scroll down to Safari\n';
                errorMessage += '3. Tap "Camera"\n';
                errorMessage += '4. Change the setting to "Allow"\n';
                errorMessage += '5. Return to this page and try again\n\n';
                errorMessage += 'If you don\'t see Safari in Settings:\n';
                errorMessage += '1. Open Safari\n';
                errorMessage += '2. Tap the "aA" button in the address bar\n';
                errorMessage += '3. Tap "Website Settings"\n';
                errorMessage += '4. Tap "Camera" and change to "Allow"\n\n';
                errorMessage += 'If you\'re still having issues:\n';
                errorMessage += '1. Close all browser tabs\n';
                errorMessage += '2. Force close Safari\n';
                errorMessage += '3. Reopen Safari and try again';
            } else if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
                errorMessage += 'No camera found. Please make sure your iPhone has a camera.';
            } else if (error.name === 'NotReadableError' || error.name === 'TrackStartError') {
                errorMessage += 'Your camera is in use by another application. Please close other apps that might be using the camera.';
            } else {
                errorMessage += `Error: ${error.message}\n\nPlease try using Safari or Chrome on your iPhone.`;
            }
            
            alert(errorMessage);
        }
    });

    // Handle modal close
    document.getElementById('cameraModal').addEventListener('hidden.bs.modal', function() {
        if (stream) {
            stream.getTracks().forEach(track => {
                console.log('Stopping track:', track.kind);
                track.stop();
            });
            stream = null;
        }
        // Clear live detection
        if (liveDetectionInterval) {
            clearInterval(liveDetectionInterval);
            liveDetectionInterval = null;
        }
        // Remove overlay
        const overlay = document.querySelector('.live-detection-overlay');
        if (overlay) overlay.remove();
    });

    // Capture and process image
    captureButton.addEventListener('click', async function() {
        try {
            isProcessing = true;
            // Freeze the video
            const tracks = stream.getTracks();
            tracks.forEach(track => track.stop());
            stream = null;

            const context = canvas.getContext('2d');
            canvas.width = camera.videoWidth;
            canvas.height = camera.videoHeight;
            context.drawImage(camera, 0, 0);

            // Show loading indicator
            const loadingDiv = document.createElement('div');
            loadingDiv.className = 'ocr-loading active';
            loadingDiv.innerHTML = '<i class="bi bi-hourglass-split"></i> Processing image...';
            document.querySelector('.camera-container').appendChild(loadingDiv);

            // Clear live detection
            if (liveDetectionInterval) {
                clearInterval(liveDetectionInterval);
                liveDetectionInterval = null;
            }

            // Keep the last frame visible
            camera.style.display = 'none';
            const lastFrame = document.createElement('img');
            lastFrame.src = canvas.toDataURL('image/jpeg', 0.8);
            lastFrame.style.width = '100%';
            lastFrame.style.height = 'auto';
            lastFrame.style.maxHeight = '70vh';
            camera.parentNode.insertBefore(lastFrame, camera);

            // Perform OCR with optimized settings
            const result = await Tesseract.recognize(
                canvas.toDataURL('image/jpeg', 0.8),
                'eng',
                {
                    logger: m => console.log(m),
                    tessedit_char_whitelist: '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz$., ',
                    tessedit_pageseg_mode: '6',
                    preserve_interword_spaces: '1'
                }
            );

            console.log('OCR result:', result);

            // Create selection modal
            const selectionModal = document.createElement('div');
            selectionModal.className = 'modal fade';
            selectionModal.id = 'selectionModal';
            
            // Get all words with their bounding boxes
            const words = result.data.words;
            
            // Create a container for the image and words
            const imageWidth = canvas.width;
            const imageHeight = canvas.height;
            const scale = Math.min(500 / imageWidth, 400 / imageHeight);
            
            selectionModal.innerHTML = `
                <div class="modal-dialog modal-lg">
                    <div class="modal-content glass-effect">
                        <div class="modal-header">
                            <h5 class="modal-title">Select Text</h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body">
                            <p class="text-muted">Tap on the text to select where it should go:</p>
                            <div class="selection-container" style="position: relative; width: ${imageWidth * scale}px; height: ${imageHeight * scale}px; margin: 0 auto;">
                                <img src="${canvas.toDataURL('image/jpeg', 0.8)}" style="width: 100%; height: 100%; object-fit: contain;">
                                <div class="word-overlays" style="position: absolute; top: 0; left: 0; right: 0; bottom: 0;">
                                    ${words.map((word, index) => `
                                        <div class="word-box" 
                                             data-text="${word.text}"
                                             style="position: absolute; 
                                                    left: ${word.bbox.x0 * scale}px; 
                                                    top: ${word.bbox.y0 * scale}px; 
                                                    width: ${(word.bbox.x1 - word.bbox.x0) * scale}px; 
                                                    height: ${(word.bbox.y1 - word.bbox.y0) * scale}px; 
                                                    cursor: pointer;
                                                    border: 1px solid rgba(0,123,255,0.3);
                                                    background: rgba(0,123,255,0.1);">
                                        </div>
                                    `).join('')}
                                </div>
                            </div>
                            <div class="mt-3">
                                <div class="row">
                                    <div class="col">
                                        <div class="form-group">
                                            <label>Name & Size:</label>
                                            <div class="selected-text name-size-preview p-2 border rounded"></div>
                                        </div>
                                    </div>
                                    <div class="col">
                                        <div class="form-group">
                                            <label>Price:</label>
                                            <div class="selected-text price-preview p-2 border rounded"></div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary modern-button" data-bs-dismiss="modal">Cancel</button>
                            <button type="button" class="btn btn-primary modern-button" onclick="applySelection()">Apply Selection</button>
                        </div>
                    </div>
                </div>
            `;

            // Remove loading indicator and show selection modal
            loadingDiv.remove();
            document.body.appendChild(selectionModal);
            const modal = new bootstrap.Modal(selectionModal);
            modal.show();

            // Store selected text
            window.selectedText = {
                nameSize: [],
                price: null
            };

            // Add click handlers to word boxes
            const wordBoxes = selectionModal.querySelectorAll('.word-box');
            wordBoxes.forEach(box => {
                box.addEventListener('click', function() {
                    const text = this.dataset.text;
                    
                    // Check if it looks like a price
                    if (text.match(/^\$?\d+\.\d{2}$/)) {
                        // If it's a price, update price preview
                        window.selectedText.price = text.replace('$', '');
                        document.querySelector('.price-preview').textContent = '$' + window.selectedText.price;
                        this.style.background = 'rgba(255,193,7,0.3)';
                    } else {
                        // If it's not a price, add to name & size
                        if (!window.selectedText.nameSize.includes(text)) {
                            window.selectedText.nameSize.push(text);
                            document.querySelector('.name-size-preview').textContent = 
                                window.selectedText.nameSize.join(' ');
                            this.style.background = 'rgba(40,167,69,0.3)';
                        }
                    }
                });
            });

            // Clean up modal when it's hidden
            selectionModal.addEventListener('hidden.bs.modal', function() {
                document.body.removeChild(selectionModal);
            });

            // Make applySelection function globally available
            window.applySelection = function() {
                if (window.selectedText.nameSize.length > 0) {
                    document.getElementById('nameSize').value = 
                        window.selectedText.nameSize.join(' ');
                }
                if (window.selectedText.price) {
                    document.getElementById('price').value = window.selectedText.price;
                }
                modal.hide();
                cameraModal.hide();
            };

        } catch (error) {
            console.error('Error processing image:', error);
            alert('Error processing image. Please try again.');
        }
    });

    // Add product form submission
    addProductForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const formData = new FormData(this);
        formData.append('action', 'add');

        try {
            const response = await fetch('index.php', {
                method: 'POST',
                body: formData
            });

            const result = await response.json();
            if (result.success) {
                addProductForm.reset();
                loadProducts();
            } else if (result.is_duplicate) {
                // Show duplicate confirmation modal
                const duplicateModal = document.createElement('div');
                duplicateModal.className = 'modal fade';
                duplicateModal.id = 'duplicateModal';
                duplicateModal.innerHTML = `
                    <div class="modal-dialog">
                        <div class="modal-content glass-effect">
                            <div class="modal-header">
                                <h5 class="modal-title">Duplicate Product Found</h5>
                                <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                            </div>
                            <div class="modal-body">
                                <p>A product with the same name already exists:</p>
                                <ul class="list-unstyled">
                                    <li><strong>Name:</strong> ${result.existing_product.name_size}</li>
                                    <li><strong>Price:</strong> $${parseFloat(result.existing_product.price).toFixed(2)}</li>
                                    <li><strong>Current Quantity:</strong> ${result.existing_product.quantity}</li>
                                </ul>
                                <p>Would you like to:</p>
                                <div class="d-grid gap-2">
                                    <button class="btn btn-primary modern-button" onclick="handleDuplicateChoice('add_quantity')">
                                        Add to Existing Quantity
                                    </button>
                                    <button class="btn btn-secondary modern-button" onclick="handleDuplicateChoice('new_entry')">
                                        Create New Entry
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                `;
                document.body.appendChild(duplicateModal);
                const modal = new bootstrap.Modal(duplicateModal);
                modal.show();

                // Store the form data for later use
                window.pendingProductData = {
                    formData: formData,
                    existingProduct: result.existing_product
                };

                // Clean up modal when it's hidden
                duplicateModal.addEventListener('hidden.bs.modal', function() {
                    document.body.removeChild(duplicateModal);
                });
            }
        } catch (error) {
            console.error('Error adding product:', error);
            alert('Error adding product. Please try again.');
        }
    });

    // Make handleDuplicateChoice function globally available
    window.handleDuplicateChoice = async function(choice) {
        const modal = bootstrap.Modal.getInstance(document.getElementById('duplicateModal'));
        modal.hide();

        if (choice === 'add_quantity') {
            // Add quantity to existing product
            const formData = new FormData();
            formData.append('action', 'update_quantity');
            formData.append('index', window.pendingProductData.existingProduct.index);
            formData.append('change', parseInt(document.getElementById('quantity').value));

            try {
                const response = await fetch('index.php', {
                    method: 'POST',
                    body: formData
                });

                const result = await response.json();
                if (result.success) {
                    addProductForm.reset();
                    loadProducts();
                }
            } catch (error) {
                console.error('Error updating quantity:', error);
                alert('Error updating quantity. Please try again.');
            }
        } else {
            // Create new entry with a modified name
            const formData = window.pendingProductData.formData;
            formData.set('name_size', formData.get('name_size') + ' (2)');
            
            try {
                const response = await fetch('index.php', {
                    method: 'POST',
                    body: formData
                });

                const result = await response.json();
                if (result.success) {
                    addProductForm.reset();
                    loadProducts();
                }
            } catch (error) {
                console.error('Error adding product:', error);
                alert('Error adding product. Please try again.');
            }
        }

        // Clean up
        window.pendingProductData = null;
    };

    // Search functionality
    let searchTimeout;
    searchInput.addEventListener('input', function() {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
            loadProducts();
        }, 300);
    });

    // Sort functionality
    sortSelect.addEventListener('change', loadProducts);

    // Load products function
    async function loadProducts(page = 1) {
        const searchQuery = searchInput.value;
        const sortBy = sortSelect.value || 'date_added'; // Set default sort to date_added

        try {
            console.log('Loading products with search:', searchQuery, 'sort:', sortBy, 'page:', page);
            const response = await fetch(`index.php?action=get_products&search=${searchQuery}&sort=${sortBy}&page=${page}`);
            const data = await response.json();
            console.log('Loaded data:', data);

            if (!data.products) {
                console.error('No products data received:', data);
                return;
            }

            productsTableBody.innerHTML = '';
            data.products.forEach((product, index) => {
                const actualIndex = ((page - 1) * 10) + index; // Calculate the actual index based on page
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>${product.name_size}</td>
                    <td>$${parseFloat(product.price).toFixed(2)}</td>
                    <td>${product.supplier || '-'}</td>
                    <td>
                        <div class="quantity-controls">
                            <button class="btn btn-sm btn-outline-primary quantity-btn" onclick="updateQuantity(${actualIndex}, -1)">
                                <i class="bi bi-dash"></i>
                            </button>
                            <span class="quantity-display">${product.quantity}</span>
                            <button class="btn btn-sm btn-outline-primary quantity-btn" onclick="updateQuantity(${actualIndex}, 1)">
                                <i class="bi bi-plus"></i>
                            </button>
                        </div>
                    </td>
                    <td>
                        <div class="btn-group" role="group">
                            <button class="btn btn-sm btn-outline-primary" onclick="editProduct(${actualIndex}, '${product.name_size.replace(/'/g, "\\'")}', ${product.price}, '${(product.supplier || '').replace(/'/g, "\\'")}', ${product.quantity})" title="Edit">
                                <i class="bi bi-pencil"></i>
                            </button>
                            <button class="btn btn-sm btn-outline-danger" onclick="deleteProduct(${actualIndex}, '${product.name_size.replace(/'/g, "\\'")}')" title="Delete">
                                <i class="bi bi-trash"></i>
                            </button>
                        </div>
                    </td>
                `;
                productsTableBody.appendChild(row);
            });

            // Update pagination
            const paginationContainer = document.getElementById('pagination');
            if (paginationContainer) {
                paginationContainer.innerHTML = '';
                
                if (data.pagination.total_pages > 1) {
                    const pagination = document.createElement('nav');
                    pagination.setAttribute('aria-label', 'Product navigation');
                    pagination.innerHTML = `
                        <ul class="pagination justify-content-center mb-0">
                            <li class="page-item ${data.pagination.current_page === 1 ? 'disabled' : ''}">
                                <a class="page-link" href="#" onclick="loadProducts(${data.pagination.current_page - 1}); return false;">
                                    <i class="bi bi-chevron-left"></i>
                                </a>
                            </li>
                            ${generatePaginationItems(data.pagination.current_page, data.pagination.total_pages)}
                            <li class="page-item ${data.pagination.current_page === data.pagination.total_pages ? 'disabled' : ''}">
                                <a class="page-link" href="#" onclick="loadProducts(${data.pagination.current_page + 1}); return false;">
                                    <i class="bi bi-chevron-right"></i>
                                </a>
                            </li>
                        </ul>
                    `;
                    paginationContainer.appendChild(pagination);
                }
            }
        } catch (error) {
            console.error('Error loading products:', error);
        }
    }

    // Helper function to generate pagination items
    function generatePaginationItems(currentPage, totalPages) {
        let items = '';
        const maxVisible = 5;
        let start = Math.max(1, currentPage - Math.floor(maxVisible / 2));
        let end = Math.min(totalPages, start + maxVisible - 1);

        if (end - start + 1 < maxVisible) {
            start = Math.max(1, end - maxVisible + 1);
        }

        if (start > 1) {
            items += `
                <li class="page-item">
                    <a class="page-link" href="#" onclick="loadProducts(1); return false;">1</a>
                </li>
                ${start > 2 ? '<li class="page-item disabled"><span class="page-link">...</span></li>' : ''}
            `;
        }

        for (let i = start; i <= end; i++) {
            items += `
                <li class="page-item ${i === currentPage ? 'active' : ''}">
                    <a class="page-link" href="#" onclick="loadProducts(${i}); return false;">${i}</a>
                </li>
            `;
        }

        if (end < totalPages) {
            items += `
                ${end < totalPages - 1 ? '<li class="page-item disabled"><span class="page-link">...</span></li>' : ''}
                <li class="page-item">
                    <a class="page-link" href="#" onclick="loadProducts(${totalPages}); return false;">${totalPages}</a>
                </li>
            `;
        }

        return items;
    }

    // Make loadProducts function globally available
    window.loadProducts = loadProducts;

    // Make updateQuantity function globally available
    window.updateQuantity = async function(index, change) {
        try {
            const formData = new FormData();
            formData.append('action', 'update_quantity');
            formData.append('index', index);
            formData.append('change', change);

            const response = await fetch('index.php', {
                method: 'POST',
                body: formData
            });

            const result = await response.json();
            if (result.success) {
                loadProducts();
            }
        } catch (error) {
            console.error('Error updating quantity:', error);
        }
    };

    // Make editProduct function globally available
    window.editProduct = async function(index, name, price, supplier, quantity) {
        // Create a modal for editing
        const editModal = document.createElement('div');
        editModal.className = 'modal fade';
        editModal.id = 'editModal';
        editModal.innerHTML = `
            <div class="modal-dialog">
                <div class="modal-content glass-effect">
                    <div class="modal-header">
                        <h5 class="modal-title">Edit Product</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body">
                        <form id="editProductForm">
                            <input type="hidden" id="editIndex" value="${index}">
                            <div class="mb-3">
                                <label class="form-label">Name & Size</label>
                                <input type="text" class="form-control modern-input" id="editNameSize" value="${name}" required>
                            </div>
                            <div class="mb-3">
                                <label class="form-label">Price</label>
                                <input type="number" class="form-control modern-input" id="editPrice" value="${price}" step="0.01" required>
                            </div>
                            <div class="mb-3">
                                <label class="form-label">Supplier</label>
                                <input type="text" class="form-control modern-input" id="editSupplier" value="${supplier}">
                            </div>
                            <div class="mb-3">
                                <label class="form-label">Quantity</label>
                                <input type="number" class="form-control modern-input" id="editQuantity" value="${quantity}" required>
                            </div>
                        </form>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary modern-button" data-bs-dismiss="modal">Cancel</button>
                        <button type="button" class="btn btn-primary modern-button" onclick="saveEdit()">Save Changes</button>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(editModal);
        const modal = new bootstrap.Modal(editModal);
        modal.show();

        // Clean up modal when it's hidden
        editModal.addEventListener('hidden.bs.modal', function() {
            document.body.removeChild(editModal);
        });
    };

    // Make saveEdit function globally available
    window.saveEdit = async function() {
        const index = document.getElementById('editIndex').value;
        const formData = new FormData();
        formData.append('action', 'edit');
        formData.append('index', index);
        formData.append('name_size', document.getElementById('editNameSize').value);
        formData.append('price', document.getElementById('editPrice').value);
        formData.append('supplier', document.getElementById('editSupplier').value);
        formData.append('quantity', document.getElementById('editQuantity').value);

        try {
            console.log('Sending edit request:', Object.fromEntries(formData));
            const response = await fetch('index.php', {
                method: 'POST',
                body: formData
            });

            const result = await response.json();
            console.log('Edit response:', result);
            
            if (result.success) {
                const modal = bootstrap.Modal.getInstance(document.getElementById('editModal'));
                modal.hide();
                await loadProducts(); // Reload the current page
                console.log('Products reloaded after edit');
            } else {
                console.error('Edit failed:', result.message || result.error || 'Unknown error');
                alert('Error saving changes: ' + (result.message || result.error || 'Unknown error'));
            }
        } catch (error) {
            console.error('Error saving edit:', error);
            alert('Error saving changes. Please try again.');
        }
    };

    // Make deleteProduct function globally available
    window.deleteProduct = async function(index, productName) {
        if (!confirm(`Are you sure you want to delete "${productName}"?`)) {
            return;
        }

        try {
            const formData = new FormData();
            formData.append('action', 'delete');
            formData.append('index', index);

            const response = await fetch('index.php', {
                method: 'POST',
                body: formData
            });

            const result = await response.json();
            if (result.success) {
                await loadProducts(); // Reload the current page
            } else {
                console.error('Delete failed:', result.message || result.error || 'Unknown error');
                alert('Error deleting product: ' + (result.message || result.error || 'Unknown error'));
            }
        } catch (error) {
            console.error('Error deleting product:', error);
            alert('Error deleting product. Please try again.');
        }
    };
}); 