import { useEffect, useState, useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import '../styles/transactions.css';

export default function Transactions() {
    const [transactions, setTransactions] = useState([]);
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [showForm, setShowForm] = useState(false);
    const [formData, setFormData] = useState({
        type: 'stockIn',
        quantity: '',
        observations: '',
        date: new Date().toISOString().slice(0, 16),
        productId: '',
    });
    const [formLoading, setFormLoading] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;
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
                
                // Get transactions
                const transactionsRes = await fetch('http://localhost:3001/api/transactions', {
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    }
                });
                
                if (transactionsRes.status === 401 || transactionsRes.status === 403) {
                    localStorage.removeItem('token');
                    navigate('/login');
                    return;
                }
                
                if (!transactionsRes.ok) {
                    throw new Error('Error getting moves');
                }
                
                const transactionsData = await transactionsRes.json();
                setTransactions(transactionsData);
                
                // Get products
                const productsRes = await fetch('http://localhost:3001/api/products', {
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    }
                });
                
                if (!productsRes.ok) {
                    throw new Error('Error getting products');
                }
                
                const productsData = await productsRes.json();
                setProducts(productsData);
                
            } catch (error) {
                console.error('Error fetching data:', error);
                setError(error.message);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [user, navigate]);

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setFormLoading(true);
        setError(null);
        
        try {
            const token = localStorage.getItem('token');
            
            if (!token) {
                navigate('/login');
                return;
            }

            // Validations
            if (!formData.type || !formData.quantity || !formData.productId) {
                setError('Please complete all required fields');
                return;
            }

            if (isNaN(formData.quantity) || parseInt(formData.quantity) <= 0) {
                setError('The amount must be a number greater than 0');
                return;
            }

            const transactionData = {
                type: formData.type,
                quantity: parseInt(formData.quantity),
                observations: formData.observations.trim() || null,
                date: formData.date ? new Date(formData.date).toISOString() : new Date().toISOString(),
                productId: parseInt(formData.productId),
            };

            const res = await fetch('http://localhost:3001/api/transactions', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(transactionData)
            });

            if (res.status === 401 || res.status === 403) {
                localStorage.removeItem('token');
                navigate('/login');
                return;
            }

            if (!res.ok) {
                const errorData = await res.json();
                throw new Error(errorData.message || 'Error creating movement');
            }

            const transactionResponse = await res.json();
            
            setTransactions(prev => [...prev, transactionResponse]);
            resetForm();
            
        } catch (error) {
            console.error('Error creating transaction:', error);
            setError(error.message);
        } finally {
            setFormLoading(false);
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm("Are you sure you want to delete this transaction? This will affect the product´s stock.")) {
            return;
        }

        try {
            const token = localStorage.getItem('token');
            const res = await fetch(`http://localhost:3001/api/transactions/${id}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${token}`,
                }
            });

            if (res.status === 401 || res.status === 403) {
                localStorage.removeItem('token');
                navigate('/login');
                return;
            }

            if (!res.ok) {
                throw new Error('Error deleting movement');
            }

            setTransactions(prev => prev.filter(mov => mov.id !== id));
        } catch (error) {
            console.error('Error deleting transaction:', error);
            setError(error.message);
        }
    };

    const resetForm = () => {
        setFormData({
            type: 'stockIn',
            quantity: '',
            observations: '',
            date: new Date().toISOString().slice(0, 16),
            productId: '',
        });
        setShowForm(false);
        setError(null);
    };

    const formatDate = (dateString) => {
        if (!dateString) return 'Undated';
        const options = {
            year: 'numeric', 
            month: '2-digit', 
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        };
        return new Date(dateString).toLocaleString('es-ES', options);
    };

    const getTypeClass = (type) => {
        switch(type) {
            case 'stockIn': return 'stockIn';
            case 'stockOut': return 'stockOut';
            case 'adjustment': return 'adjustment';
            default: return '';
        }
    };

    // Pagination
    const indexOfLastItem = currentPage * itemsPerPage;
    const indexOfFirstItem = indexOfLastItem - itemsPerPage;
    const currentTransactions = transactions.slice(indexOfFirstItem, indexOfLastItem);
    const totalPages = Math.ceil(transactions.length / itemsPerPage);

    if (loading) {
        return <div>Charging transactions...</div>;
    }

    return (
        <div>
            <h1>List of Movements</h1>
            
            <button onClick={() => setShowForm(!showForm)}>
                {showForm ? 'Cancel' : 'Add New Transaction'}
            </button>

            {showForm && (
                <div>
                    <h2>Create New Transaction</h2>
                    {error && <div style={{color: 'red'}}>{error}</div>}
                    <form onSubmit={handleSubmit}>
                        <div>
                            <label>Type *</label>
                            <select
                                name="type"
                                value={formData.type}
                                onChange={handleInputChange}
                                required
                            >
                                <option value="stockIn">Stock In</option>
                                <option value="stockOut">Stock Out</option>
                                <option value="adjustment">Adjustment</option>
                            </select>
                        </div>

                        <div>
                            <label>Quantity *</label>
                            <input
                                type="number"
                                name="quantity"
                                value={formData.quantity}
                                onChange={handleInputChange}
                                min="1"
                                required
                            />
                        </div>

                        <div>
                            <label>Product *</label>
                            <select
                                name="productId"
                                value={formData.productId}
                                onChange={handleInputChange}
                                required
                            >
                                <option value="">Select a product</option>
                                {products.map(product => (
                                    <option key={product.id} value={product.id}>
                                        {product.name} (ID: {product.id})
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label>Date and Time</label>
                            <input
                                type="datetime-local"
                                name="date"
                                value={formData.date}
                                onChange={handleInputChange}
                            />
                        </div>

                        <div>
                            <label>Observations</label>
                            <textarea
                                name="observations"
                                value={formData.observations}
                                onChange={handleInputChange}
                                rows="3"
                            />
                        </div>

                        <button type="submit" disabled={formLoading}>
                            {formLoading ? 'Creating...' : 'Create Transaction'}
                        </button>
                        <button type="button" onClick={resetForm}>
                            Cancel
                        </button>
                    </form>
                </div>
            )}

            {error && !showForm && <div style={{color: 'red'}}>{error}</div>}

            {transactions.length === 0 ? (
                <p>No transactions available.</p>
            ) : (
                <>
                    <table>
                        <thead>
                            <tr>
                                <th>ID</th>
                                <th>Type</th>
                                <th>Quantity</th>
                                <th>Product</th>
                                <th>Date</th>
                                <th>Observations</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {currentTransactions.map((transaction) => {
                                const product = products.find(p => p.id === transaction.productId);
                                return (
                                    <tr key={transaction.id}>
                                        <td>{transaction.id}</td>
                                        <td className={getTypeClass(transaction.type)}>
                                            {transaction.type}
                                        </td>
                                        <td>{transaction.quantity}</td>
                                        <td>
                                            {product ? product.name : 'Product not found'}
                                        </td>
                                        <td>{formatDate(transaction.date)}</td>
                                        <td>{transaction.observations || 'No comments'}</td>
                                        <td>
                                            <button onClick={() => handleDelete(transaction.id)}>
                                                Delete
                                            </button>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>

                    <div>
                        <button 
                            onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                            disabled={currentPage === 1}
                        >
                            Previous
                        </button>
                        <span>Page {currentPage} de {totalPages}</span>
                        <button 
                            onClick={() => setCurrentPage(prev => 
                                indexOfLastItem < transactions.length ? prev + 1 : prev
                            )}
                            disabled={indexOfLastItem >= transactions.length}
                        >
                            Next
                        </button>
                    </div>
                </>
            )}
            
            <button onClick={() => navigate('/')}>
                Back to Home
            </button>
        </div>
    );
}