from flask import Flask, render_template, request, jsonify
import pandas as pd
from datetime import datetime
import os

app = Flask(__name__)

# Ensure the products.csv file exists
if not os.path.exists('products.csv'):
    df = pd.DataFrame(columns=['Name_Size', 'Price', 'Supplier', 'Quantity', 'Date_Added'])
    df.to_csv('products.csv', index=False)

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/products', methods=['GET'])
def get_products():
    df = pd.read_csv('products.csv')
    search_query = request.args.get('search', '')
    
    if len(search_query) >= 3:
        df = df[df['Name_Size'].str.contains(search_query, case=False, na=False)]
    
    sort_by = request.args.get('sort', 'Date_Added')
    if sort_by in df.columns:
        df = df.sort_values(by=sort_by, ascending=False)
    
    return jsonify(df.to_dict('records'))

@app.route('/api/products', methods=['POST'])
def add_product():
    data = request.json
    df = pd.read_csv('products.csv')
    
    new_product = {
        'Name_Size': data['name_size'],
        'Price': float(data['price']),
        'Supplier': data.get('supplier', ''),
        'Quantity': int(data['quantity']),
        'Date_Added': datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    }
    
    df = pd.concat([df, pd.DataFrame([new_product])], ignore_index=True)
    df.to_csv('products.csv', index=False)
    
    return jsonify({'message': 'Product added successfully'})

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True) 