import { useEffect, useState, useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import '../styles/categories.css'


export default function Categories() {
    const [categories, setCategories] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [showForm, setShowForm] = useState(false);
    const [editingCategory, setEditingCategory] = useState(null);
    const [formData, setFormData] = useState({
        name: '',
        description: ''
    });
    const [formLoading, setFormLoading] = useState(false);
    const { user } = useContext(AuthContext);
    const navigate = useNavigate();

    useEffect(() => {
        if (!user) {
            navigate('/login');
            return;
        }

        const fetchCategories = async () => {
            try {
                setLoading(true);
                setError(null);
                
                const token = localStorage.getItem('token');
                
                if (!token) {
                    navigate('/login');
                    return;
                }
                
                const res = await fetch('http://localhost:3001/api/categories', {
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
                    throw new Error('Error getting categories');
                }
                
                const data = await res.json();
                setCategories(data);
            } catch (error) {
                console.error('Error fetching categories:', error);
                setError(error.message);
            } finally {
                setLoading(false);
            }
        };

        fetchCategories();
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
        
        try {
            const token = localStorage.getItem('token');
            
            if (!token) {
                navigate('/login');
                return;
            }

            // Basic validations
            if (!formData.name.trim()) {
                alert('Please enter a name for the category');
                return;
            }

            const categoryData = {
                name: formData.name.trim(),
                description: formData.description.trim() || null,
                userId: user.id // Add the authenticated user ID
            };

            const isEditing = editingCategory !== null;
            const url = isEditing 
                ? `http://localhost:3001/api/categories/${editingCategory.id}`
                : 'http://localhost:3001/api/categories';
            
            const method = isEditing ? 'PUT' : 'POST';

            const res = await fetch(url, {
                method: method,
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(categoryData)
            });

            if (res.status === 401 || res.status === 403) {
                localStorage.removeItem('token');
                navigate('/login');
                return;
            }

            if (!res.ok) {
                const errorData = await res.json();
                throw new Error(errorData.message || `Error at ${isEditing ? 'update' : 'create'} the category`);
            }

            const categoryResponse = await res.json();
            
            if (isEditing) {
                // Update the category in the list
                setCategories(prev => prev.map(c => 
                    c.id === editingCategory.id ? categoryResponse : c
                ));
            } else {
                // Add the new category to the list
                setCategories(prev => [...prev, categoryResponse]);
            }
            
            // Clear the form and reset the status
            resetForm();
            
        } catch (error) {
            console.error('Error with category:', error);
            alert(`Error at ${editingCategory ? 'update' : 'create'} the category: ${error.message}`);
        } finally {
            setFormLoading(false);
        }
    };

    const resetForm = () => {
        setFormData({
            name: '',
            description: ''
        });
        setShowForm(false);
        setEditingCategory(null);
    };

    const handleEdit = (category) => {
        setEditingCategory(category);
        setFormData({
            name: category.name,
            description: category.description || ''
        });
        setShowForm(true);
    };

    const handleDelete = async (category) => {
        const confirmDelete = window.confirm(`Are you sure you want to delete the category "${category.name}"?`);
        
        if (!confirmDelete) return;

        try {
            const token = localStorage.getItem('token');
            
            if (!token) {
                navigate('/login');
                return;
            }

            const res = await fetch(`http://localhost:3001/api/categories/${category.id}`, {
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
                throw new Error(errorData.message || 'Error deleting category');
            }

            // Remove the category from the list
            setCategories(prev => prev.filter(c => c.id !== category.id));

        } catch (error) {
            console.error('Error deleting category:', error);
            alert(`Error deleting category: ${error.message}`);
        }
    };

    if (loading) {
        return (
            <div id="categories-container">
                <h1 className="categories-title">Category List</h1>
                <p className="categories-loading">Loading categories...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div id="categories-container">
                <h1 className="categories-title">Category List</h1>
                <p className="categories-error">Error: {error}</p>
                <button className="categories-button-home" onClick={() => navigate('/')}>Back to Home</button>
            </div>
        );
    }

    return (
        <div id="categories-container">
            <h1 className="categories-title">Category List</h1>
            
            {/* Button to show/hide form */}
            <div className="categories-button-wrapper">
                <button 
                    onClick={() => setShowForm(!showForm)}
                    className={`categories-toggle-form-button ${showForm ? 'categories-button-cancel' : 'categories-button-add'}`}
                >
                    {showForm ? 'Cancel' : 'Add new category'}
                </button>
            </div>

            {/* Form to create/edit category */}
            {showForm && (
                <div className="categories-form-container">
                    <h2 className="categories-form-title">{editingCategory ? 'Edit Category' : 'Create New Category'}</h2>
                    <form onSubmit={handleSubmit} className="categories-form">
                        <div className="categories-form-grid">
                            <div className="categories-form-group">
                                <label htmlFor="name" className="categories-label">
                                    name *
                                </label>
                                <input
                                    type="text"
                                    id="name"
                                    name="name"
                                    value={formData.name}
                                    onChange={handleInputChange}
                                    required
                                    className="categories-input"
                                />
                            </div>

                            <div className="categories-form-group">
                                <label htmlFor="description" className="categories-label">
                                    description
                                </label>
                                <input
                                    type="text"
                                    id="description"
                                    name="description"
                                    value={formData.description}
                                    onChange={handleInputChange}
                                    className="categories-input"
                                />
                            </div>
                        </div>

                        <div className="categories-form-actions">
                            <button 
                                type="submit" 
                                disabled={formLoading}
                                className={`categories-submit-button ${formLoading ? 'categories-button-loading' : 'categories-button-save'}`}
                            >
                                {formLoading ? (editingCategory ? 'Updating...' : 'Creating...') : (editingCategory ? 'Update category' : 'Create category')}
                            </button>
                            <button 
                                type="button" 
                                onClick={resetForm}
                                className="categories-button-cancel"
                            >
                                Cancel
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* Category tables */}
            {categories.length === 0 ? (
                <p className="categories-no-data">There are no categories available.</p>
            ) : (
                <table className="categories-table">
                    <thead>
                        <tr className="categories-table-header-row">
                            <th className="categories-table-header">ID</th>
                            <th className="categories-table-header">name</th>
                            <th className="categories-table-header">description</th>
                            <th className="categories-table-header">actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {categories.map((category) => (
                            <tr key={category.id} className="categories-table-row">
                                <td className="categories-table-data">{category.id}</td>
                                <td className="categories-table-data">{category.name}</td>
                                <td className="categories-table-data">{category.description || 'No description'}</td>
                                <td className="categories-table-data categories-actions-cell">
                                    <button
                                        onClick={() => handleEdit(category)}
                                        className="categories-button-edit"
                                    >
                                        Edit
                                    </button>
                                    <button
                                        onClick={() => handleDelete(category)}
                                        className="categories-button-delete"
                                    >
                                        Delete
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            )}
            
            <div className="categories-button-wrapper-bottom">
                <button 
                    onClick={() => navigate('/')}
                    className="categories-button-home"
                >
                    Back to Home
                </button>
            </div>
        </div>
    );
}