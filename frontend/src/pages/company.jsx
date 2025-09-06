import React, { useState, useEffect } from 'react';
import '../styles/company.css';

const CompanyManager = () => {
  const [userInfo, setUserInfo] = useState(null);
  //const [companyActual, setCompanyActual] = useState(null);
  const [currentCompany, setCurrentCompany] = useState(null);
  const [loading, setLoading] = useState(true);
  const [companyName, setCompanyName] = useState('');
  const [invitationToken, setInvitationToken] = useState('');
  const [generatedCode, setGeneratedCode] = useState('');
  const [showCode, setShowCode] = useState(false);
  const [message, setMessage] = useState({ text: '', type: '' });

  // Function to display messages
  const showMessage = (text, type = 'info') => {
    setMessage({ text, type });
    setTimeout(() => {
      setMessage({ text: '', type: '' });
    }, 5000);
  };

  // Function to decode JWT and obtain user information
  const decodeJWT = (token) => {
    try {
      const base64Url = token.split('.')[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
        return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
      }).join(''));
      return JSON.parse(jsonPayload);
    } catch (error) {
      console.error('Error decoding JWT:', error);
      return null;
    }
  };

  // Function to get the current token
  const getCurrentToken = () => {
    // First try to get from localStorage (if it exists)
    let token = localStorage.getItem('token');
    
    // If not in localStorage, try extracting cookies
    if (!token) {
      const cookies = document.cookie.split(';');
      const tokenCookie = cookies.find(cookie => cookie.trim().startsWith('token='));
      if (tokenCookie) {
        token = tokenCookie.split('=')[1];
      }
    }
    
    return token;
  };

  // Function to make requests with automatic token handling
  const fetchWithAuth = async (url, options = {}) => {
    const token = getCurrentToken();
    
    const defaultOptions = {
      credentials: 'include', // To include cookies
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      }
    };

    // If we have a token, add it to the headers.
    if (token) {
      defaultOptions.headers.Authorization = `Bearer ${token}`;
    }

    const response = await fetch(url, {
      ...defaultOptions,
      ...options
    });

    return response;
  };

  // Load initial user information
  useEffect(() => {
    const loadUserInfo = async () => {
      try {
        const token = getCurrentToken();
        if (token) {
          const decoded = decodeJWT(token);
          setUserInfo(decoded);
          
          // If the user has a company, obtain company information
          if (decoded?.companyId || decoded?.companyId) {
            await getCompaniesByOwner();
          }
        }
      } catch (error) {
        console.error('Error loading user information:', error);
      } finally {
        setLoading(false);
      }
    };

    loadUserInfo();
  }, []);

  // Get companies from the owner
  const getCompaniesByOwner = async () => {
    try {
      const response = await fetchWithAuth('/api/companies/');
      if (response.ok) {
        const companies = await response.json();
        if (companies && companies.length > 0) {
          setCurrentCompany(companies[0]); // Assuming the user has a business
        }
      }
    } catch (error) {
      console.error('Error getting companies:', error);
    }
  };

  // Create company
  const createCompany = async (e) => {
    e.preventDefault();
    if (!companyName.trim()) {
      showMessage('Please enter the company name', 'error');
      return;
    }

    try {
      const response = await fetchWithAuth('/api/companies/', {
        method: 'POST',
        body: JSON.stringify({ name: companyName })
      });

      if (response.ok) {
        const result = await response.json();
        
        // If there is a new token, save it
        if (result.token) {
          localStorage.setItem('token', result.token);
          const newUserInfo = decodeJWT(result.token);
          setUserInfo(newUserInfo);
        }
        
        showMessage('Company created correctly', 'success');
        setCompanyName('');
        setCurrentCompany(result.company);
      } else {
        const error = await response.json();
        showMessage(`Error: ${error.message}`, 'error');
      }
    } catch (error) {
      showMessage('Error creating company: ' + error.message, 'error');
    }
  };

  // Join a company
  const joinCompany = async (e) => {
    e.preventDefault();
    if (!invitationToken.trim()) {
      showMessage('Please enter the invitation code', 'error');
      return;
    }

    try {
      const response = await fetchWithAuth('/api/companies/acceptInvitation', {
        method: 'POST',
        body: JSON.stringify({ invitationToken: invitationToken })
      });

      if (response.ok) {
        const result = await response.json();
        
        // If there is a new token, save it
        if (result.token) {
          localStorage.setItem('token', result.token);
          const newUserInfo = decodeJWT(result.token);
          setUserInfo(newUserInfo);
        }
        
        showMessage('You have successfully joined the company', 'success');
        setInvitationToken('');
        setCurrentCompany(result.company);
      } else {
        const error = await response.json();
        showMessage(`Error: ${error.message}`, 'error');
      }
    } catch (error) {
      showMessage('Error joining company: ' + error.message, 'error');
    }
  };

  // Leaving the company
  const leaveCompany = async () => {
    try {
      const response = await fetchWithAuth('/api/companies/leaveCompany', {
        method: 'POST'
      });

      if (response.ok) {
        const result = await response.json();
        
        // If there is a new token, save it
        if (result.token) {
          localStorage.setItem('token', result.token);
          const newUserInfo = decodeJWT(result.token);
          setUserInfo(newUserInfo);
        }
        
        showMessage('You have successfully left the company', 'success');
        setCurrentCompany(null);
      } else {
        const error = await response.json();
        showMessage(`Error: ${error.message}`, 'error');
      }
    } catch (error) {
      showMessage('Error abandoning company: ' + error.message, 'error');
    }
  };

  // Confirm leaving company
  const confirmLeaveCompany = () => {
    showMessage('Are you sure you want to leave the company? Click again to confirm.', 'warning');
    // Add temporary class to confirm
    setTimeout(() => {
      const confirmBtn = document.querySelector('.btn-danger');
      if (confirmBtn) {
        confirmBtn.classList.add('confirm-abandon');
        confirmBtn.textContent = 'Confirm Abandonment';
        confirmBtn.onclick = leaveCompany;
        
        // Reset after 10 seconds
        setTimeout(() => {
          confirmBtn.classList.remove('confirm-abandon');
          confirmBtn.textContent = 'Leave company';
          confirmBtn.onclick = confirmLeaveCompany;
        }, 10000);
      }
    }, 100);
  };

  // Generate invitation code
  const generateInvitationToken = async () => {
    try {
      const response = await fetchWithAuth('/api/companies/generateInvitation', {
        method: 'POST'
      });

      if (response.ok) {
        const result = await response.json();
        setGeneratedCode(result.invitationToken);
        setShowCode(true);
        showMessage('Invitation code generated successfully', 'success');
        showMessage('Invitation code generated successfully', 'success');
      } else {
        const error = await response.json();
        showMessage(`Error: ${error.message}`, 'error');
      }
    } catch (error) {
      showMessage('Error generating invitation code: ' + error.message, 'error');
    }
  };

  // Copy code to clipboard
  const copyCode = () => {
    navigator.clipboard.writeText(generatedCode).then(() => {
      showMessage('Code copied to clipboard', 'success');
    }).catch(() => {
      showMessage('Error copying code', 'error');
    });
  };

  // Navigate to the home page
  const irAlHome = () => {
    window.location.href = '/';
  };

  const hasCompany = userInfo && (userInfo.companyId || userInfo.companyId);

  if (loading) {
    return <div className="loading">Charging...</div>;
  }

  return (
    <div className="company-manager">
      <div className="container">
        <h1>Set up Your Company</h1>
        
        {/* Show messages */}
        {message.text && (
          <div className={`message message-${message.type}`}>
            {message.text}
          </div>
        )}
        
        {userInfo && (
          <div className="user-info">
            <p>Welcome, <strong>{userInfo.username}</strong></p>
            {hasCompany && currentCompany && (
              <div className="current-company">
                <h3>Your Company:</h3>
                <p><strong>{currentCompany.name}</strong></p>
              </div>
            )}
          </div>
        )}

        <div className="actions-container">
          {!hasCompany ? (
            <>
              {/* Create Company */}
              <div className="card">
                <h2>Create new company</h2>
                <div className="form-container">
                  <div className="form-group">
                    <label htmlFor="companyName">Company Name:</label>
                    <input
                      type="text"
                      id="companyName"
                      value={companyName}
                      onChange={(e) => setCompanyName(e.target.value)}
                      placeholder="Enter your company name"
                      onKeyPress={(e) => e.key === 'Enter' && createCompany(e)}
                    />
                  </div>
                  <button onClick={createCompany} className="btn btn-primary">
                    Create Company
                  </button>
                </div>
              </div>

              {/* Join Company */}
              <div className="card">
                <h2>Joining a Company</h2>
                <div className="form-container">
                  <div className="form-group">
                    <label htmlFor="invitationToken">Invitation Code:</label>
                    <input
                      type="text"
                      id="invitationToken"
                      value={invitationToken}
                      onChange={(e) => setInvitationToken(e.target.value)}
                      placeholder="Enter the invitation code"
                      onKeyPress={(e) => e.key === 'Enter' && joinCompany(e)}
                    />
                  </div>
                  <button onClick={joinCompany} className="btn btn-success">
                    Join Company
                  </button>
                </div>
              </div>
            </>
          ) : (
            <>
              {/* Leave Company */}
              <div className="card">
                <h2>Manage Membership</h2>
                <button onClick={confirmLeaveCompany} className="btn btn-danger">
                  Leave Company
                </button>
              </div>

              {/* Invite to Company */}
              <div className="card">
                <h2>Invite Users</h2>
                <button onClick={generateInvitationToken} className="btn btn-info">
                  Generate Invitation Code
                </button>
                
                {showCode && generatedCode && (
                  <div className="code-container">
                    <h3>Invitation Code:</h3>
                    <div className="code-display">
                      <span className="code">{generatedCode}</span>
                      <button onClick={copyCode} className="btn btn-small">
                        Copy
                      </button>
                    </div>
                    <p className="code-info">
                      Share this code with the people you want to invite to your company.
                    </p>
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Button Home */}
        <div className="home-button-container">
          <button onClick={irAlHome} className="btn btn-home">
            🏠 Home
          </button>
        </div>
      </div>
    </div>
  );
};

export default CompanyManager;