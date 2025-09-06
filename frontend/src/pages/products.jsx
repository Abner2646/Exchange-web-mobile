import { useEffect, useState, useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import '../styles/products.css';

export default function Products() {
    const [products, setProducts] = useState([]);
    const [categories, setCategories] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [showForm, setShowForm] = useState(false);
    const [editingProduct, setEditingProduct] = useState(null);
    const [formData, setFormData] = useState({
        name: '',
        purchasePrice: '',
        salePrice: '',
        stock: 0,
        categoryId: '',
        active: true
    });
    const [formLoading, setFormLoading] = useState(false);
    const [filterCategory , setFilterCategory ] = useState('');
    const [searchCategory, setSearchCategory] = useState('');
    const { user } = useContext(AuthContext);
    const navigate = useNavigate();

    useEffect(() => {
        if (!user) {
            navigate('/login');
            return;
        }

        const fetchData = async () => {
            try {
                setLoading(true);
                setError(null);
                
                const token = localStorage.getItem('token');
                
                if (!token) {
                    navigate('/login');
                    return;
                }
                
                // Get products and categories in parallel
                const [productsRes, categoriesRes] = await Promise.all([
                    fetch('http://localhost:3001/api/products', {
                        headers: {
                            'Authorization': `Bearer ${token}`,
                            'Content-Type': 'application/json'
                        }
                    }),
                    fetch('http://localhost:3001/api/categories', {
                        headers: {
                            'Authorization': `Bearer ${token}`,
                            'Content-Type': 'application/json'
                        }
                    })
                ]);
                
                if (productsRes.status === 401 || productsRes.status === 403 || 
                    categoriesRes.status === 401 || categoriesRes.status === 403) {
                    localStorage.removeItem('token');
                    navigate('/login');
                    return;
                }
                
                if (!productsRes.ok || !categoriesRes.ok) {
                    throw new Error('Error getting data');
                }
                
                const productsData = await productsRes.json();
                const categoriesData = await categoriesRes.json();
                
                setProducts(productsData);
                setCategories(categoriesData);
            } catch (error) {
                console.error('Error fetching data:', error);
                setError(error.message);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [user, navigate]);

    // Function to get the category name
    const getCategoryName = (categoryId) => {
        if (!categoryId) return 'Uncategorized';
        const category = categories.find(cat => cat.id === categoryId);
        return category ? category.name : 'Category not found';
    };

    // Filter products by category
    const filteredProducts = products.filter(product => {
        const meetsFilterCategory = filterCategory === '' || 
            product.categoryId === parseInt(filterCategory);
        
        const fulfillsSearch = searchCategory === '' || 
            getCategoryName(product.categoryId).toLowerCase().includes(searchCategory.toLowerCase());
        
        return meetsFilterCategory && fulfillsSearch;
    });

    const handleInputChange = (e) => {
        const { name, value, type, checked } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setFormLoading(true);
        
        try {
            const token = localStorage.getItem('token');
            
            if (!token) {
                navigate('/login');
                return;
            }

            // Basic validations
            if (!formData.name || !formData.purchasePrice || !formData.salePrice) {
                alert('Please complete all required fields');
                return;
            }

            if (parseFloat(formData.purchasePrice) <= 0 || parseFloat(formData.salePrice) <= 0) {
                alert('Prices must be greater than 0');
                return;
            }

            const productData = {
                name: formData.name,
                purchasePrice: parseFloat(formData.purchasePrice),
                salePrice: parseFloat(formData.salePrice),
                stock: parseInt(formData.stock) || 0,
                categoryId: formData.categoryId ? parseInt(formData.categoryId) : null,
                active: formData.active,
                userId: user.id
            };

            const isEditing = editingProduct !== null;
            const url = isEditing 
                ? `http://localhost:3001/api/products/${editingProduct.id}`
                : 'http://localhost:3001/api/products';
            
            const method = isEditing ? 'PUT' : 'POST';

            const res = await fetch(url, {
                method: method,
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(productData)
            });

            if (res.status === 401 || res.status === 403) {
                localStorage.removeItem('token');
                navigate('/login');
                return;
            }

            if (!res.ok) {
                const errorData = await res.json();
                throw new Error(errorData.message || `Error at ${isEditing ? 'update' : 'create'} the product`);
            }

            const productResponse = await res.json();
            
            if (isEditing) {
                setProducts(prev => prev.map(p => 
                    p.id === editingProduct.id ? productResponse : p
                ));
            } else {
                setProducts(prev => [...prev, productResponse]);
            }
            
            resetForm();
            
        } catch (error) {
            console.error('Error with product:', error);
            alert(`Error at ${editingProduct ? 'update' : 'create'} the product: ${error.message}`);
        } finally {
            setFormLoading(false);
        }
    };

    const resetForm = () => {
        setFormData({
            name: '',
            purchasePrice: '',
            salePrice: '',
            stock: 0,
            categoryId: '',
            active: true
        });
        setShowForm(false);
        setEditingProduct(null);
    };

    const handleEdit = (product) => {
        setEditingProduct(product);
        setFormData({
            name: product.name,
            purchasePrice: product.purchasePrice.toString(),
            salePrice: product.salePrice.toString(),
            stock: product.stock,
            categoryId: product.categoryId ? product.categoryId.toString() : '',
            active: product.active
        });
        setShowForm(true);
    };

    const handleDelete = async (product) => {
        const confirmDelete = window.confirm(`Are you sure you want to delete the product "${product.name}"?`);
        
        if (!confirmDelete) return;

        try {
            const token = localStorage.getItem('token');
            
            if (!token) {
                navigate('/login');
                return;
            }

            const res = await fetch(`http://localhost:3001/api/products/${product.id}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (res.status === 401 || res.status === 403) {
                localStorage.removeItem('token');
                navigate('/login');
                return;
            }

            if (!res.ok) {
                const errorData = await res.json();
                throw new Error(errorData.message || 'Error deleting product');
            }

            setProducts(prev => prev.filter(p => p.id !== product.id));

        } catch (error) {
            console.error('Error deleting product:', error);
            alert(`Error deleting product: ${error.message}`);
        }
    };

    const cleanFilters = () => {
        setFilterCategory('');
        setSearchCategory('');
    };

    if (loading) {
        return (
            <div id="products-container">
                <h1 className="products-title">Product List</h1>
                <p className="loading-message">Loading products...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div id="products-container">
                <h1 className="products-title">Products List</h1>
                <p className="error-message">Error: {error}</p>
                <button onClick={() => navigate('/')} className="button-back-home">Back to Home</button>
            </div>
        );
    }

    return (
        <div id="products-container">
            <h1 className="products-title">Products List</h1>
            
            <div className="form-toggle-section">
                <button 
                    onClick={() => setShowForm(!showForm)}
                    className={showForm ? 'button-cancel' : 'button-add-new'}
                >
                    {showForm ? 'Cancel' : 'Add New Product'}
                </button>
            </div>

            <div className="filters-section">
                <h3 className="filters-title">Filters</h3>
                <div className="filters-grid">
                    <div className="filter-item">
                        <label htmlFor="filterCategory" className="filter-label">
                            Filter by Category:
                        </label>
                        <select
                            id="filterCategory"
                            value={filterCategory}
                            onChange={(e) => setFilterCategory(e.target.value)}
                            className="filter-select"
                        >
                            <option value="">All categories</option>
                            {categories.map(category => (
                                <option key={category.id} value={category.id}>
                                    {category.name}
                                </option>
                            ))}
                        </select>
                    </div>
                    
                    <div className="filter-item">
                        <label htmlFor="searchCategory" className="filter-label">
                            Search by Category:
                        </label>
                        <input
                            type="text"
                            id="searchCategory"
                            value={searchCategory}
                            onChange={(e) => setSearchCategory(e.target.value)}
                            placeholder="Write category name..."
                            className="filter-input"
                        />
                    </div>
                    
                    <div className="filter-actions">
                        <button 
                            onClick={cleanFilters}
                            className="button-clear-filters"
                        >
                            Clean Filters
                        </button>
                    </div>
                </div>
                
                {(filterCategory || searchCategory) && (
                    <div className="filter-results-info">
                        Showing {filteredProducts.length} de {products.length} products
                    </div>
                )}
            </div>

            {showForm && (
                <div className="product-form-section">
                    <h2 className="form-title">{editingProduct ? 'Edit Product' : 'Create New Product'}</h2>
                    <form onSubmit={handleSubmit} className="product-form">
                        <div className="form-grid">
                            <div className="form-group">
                                <label htmlFor="name" className="form-label">
                                    Name *
                                </label>
                                <input
                                    type="text"
                                    id="name"
                                    name="name"
                                    value={formData.name}
                                    onChange={handleInputChange}
                                    required
                                    className="form-input"
                                />
                            </div>

                            <div className="form-group">
                                <label htmlFor="categoryId" className="form-label">
                                    Category
                                </label>
                                <select
                                    id="categoryId"
                                    name="categoryId"
                                    value={formData.categoryId}
                                    onChange={handleInputChange}
                                    className="form-select"
                                >
                                    <option value="">Uncategorized</option>
                                    {categories.map(category => (
                                        <option key={category.id} value={category.id}>
                                            {category.name}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className="form-group">
                                <label htmlFor="purchasePrice" className="form-label">
                                    Purchase Price *
                                </label>
                                <input
                                    type="number"
                                    id="purchasePrice"
                                    name="purchasePrice"
                                    value={formData.purchasePrice}
                                    onChange={handleInputChange}
                                    step="0.01"
                                    min="0"
                                    required
                                    className="form-input"
                                />
                            </div>

                            <div className="form-group">
                                <label htmlFor="salePrice" className="form-label">
                                    Sale Price *
                                </label>
                                <input
                                    type="number"
                                    id="salePrice"
                                    name="salePrice"
                                    value={formData.salePrice}
                                    onChange={handleInputChange}
                                    step="0.01"
                                    min="0"
                                    required
                                    className="form-input"
                                />
                            </div>

                            <div className="form-group">
                                <label htmlFor="stock" className="form-label">
                                    Stock
                                </label>
                                <input
                                    type="number"
                                    id="stock"
                                    name="stock"
                                    value={formData.stock}
                                    onChange={handleInputChange}
                                    min="0"
                                    className="form-input"
                                />
                            </div>

                            <div className="form-group form-group-checkbox">
                                <label className="form-label">
                                    Status
                                </label>
                                <div className="checkbox-wrapper">
                                    <label className="checkbox-label">
                                        <input
                                            type="checkbox"
                                            name="active"
                                            checked={formData.active}
                                            onChange={handleInputChange}
                                            className="form-checkbox"
                                        />
                                        Active Product
                                    </label>
                                </div>
                            </div>
                        </div>

                        <div className="form-actions">
                            <button 
                                type="submit" 
                                disabled={formLoading}
                                className="button-submit"
                            >
                                {formLoading ? (editingProduct ? 'Updating...' : 'Creating...') : (editingProduct ? 'Update Product' : 'Create Product')}
                            </button>
                            <button 
                                type="button" 
                                onClick={resetForm}
                                className="button-cancel-form"
                            >
                                Cancel
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {filteredProducts.length === 0 ? (
                <p className="no-products-message">There are no available products {(filterCategory || searchCategory) ? ' that match the filters.' : '.'}</p>
            ) : (
                <table className="products-table">
                    <thead>
                        <tr>
                            <th>ID</th>
                            <th>Name</th>
                            <th>Purchase price</th>
                            <th>Sale price</th>
                            <th>Stock</th>
                            <th>Category</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredProducts.map((product) => (
                            <tr key={product.id}>
                                <td>{product.id}</td>
                                <td>{product.name}</td>
                                <td>${product.purchasePrice}</td>
                                <td>${product.salePrice}</td>
                                <td>{product.stock}</td>
                                <td>{getCategoryName(product.categoryId)}</td>
                                <td className="actions-cell">
                                    <button
                                        onClick={() => handleEdit(product)}
                                        className="button-edit"
                                    >
                                        Edit
                                    </button>
                                    <button
                                        onClick={() => handleDelete(product)}
                                        className="button-delete"
                                    >
                                        Delete
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            )}
            
            <div className="back-home-section">
                <button 
                    onClick={() => navigate('/')}
                    className="button-back-home"
                >
                    Back to Home
                </button>
            </div>
        </div>
    );
}