document.addEventListener('DOMContentLoaded', function() {
    const addProductForm = document.getElementById('addProductForm');
    const searchInput = document.getElementById('searchInput');
    const sortSelect = document.getElementById('sortSelect');
    const productsTableBody = document.getElementById('productsTableBody');

    // Load products on page load
    loadProducts();

    // Add product form submission
    addProductForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const productData = {
            name_size: document.getElementById('nameSize').value,
            price: document.getElementById('price').value,
            supplier: document.getElementById('supplier').value,
            quantity: document.getElementById('quantity').value
        };

        try {
            const response = await fetch('/api/products', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(productData)
            });

            if (response.ok) {
                addProductForm.reset();
                loadProducts();
            }
        } catch (error) {
            console.error('Error adding product:', error);
        }
    });

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
    async function loadProducts() {
        const searchQuery = searchInput.value;
        const sortBy = sortSelect.value;

        try {
            const response = await fetch(`/api/products?search=${searchQuery}&sort=${sortBy}`);
            const products = await response.json();

            productsTableBody.innerHTML = '';
            products.forEach(product => {
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>${product.Name_Size}</td>
                    <td>$${parseFloat(product.Price).toFixed(2)}</td>
                    <td>${product.Supplier || '-'}</td>
                    <td>${product.Quantity}</td>
                    <td>${new Date(product.Date_Added).toLocaleString()}</td>
                `;
                productsTableBody.appendChild(row);
            });
        } catch (error) {
            console.error('Error loading products:', error);
        }
    }
}); 