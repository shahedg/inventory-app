import { useState, useEffect } from 'react';
import './App.css';

function App() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // NEW: Authentication State
  const [user, setUser] = useState(null);
  const [dbUserId, setDbUserId] = useState(null); // FIX 1: Added state
  const [authLoading, setAuthLoading] = useState(true);

  // Modal States
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newItem, setNewItem] = useState({ ItemName: '', Description: '', ImageURL: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [transferItem, setTransferItem] = useState(null);
  const [transferToUser, setTransferToUser] = useState('');
  const [isTransferring, setIsTransferring] = useState(false);

  // const availableUsers = [
  //   { UserID: 1, Name: 'Alice Admin' },
  //   { UserID: 2, Name: 'Bob Builder' }
  // ];
  const [users, setUsers] = useState([]);

  // // NEW: Fetch User Authentication Status from Azure
  // useEffect(() => {
  //   fetch('/.auth/me')
  //     .then(response => response.json())
  //     .then(data => {
  //       if (data.clientPrincipal) {
  //         setUser(data.clientPrincipal);
  //         fetchItems(); // Only fetch tools if the user is logged in
  //       } else {
  //         setAuthLoading(false); // Done checking, user is not logged in
  //       }
  //     })
  //     .catch(err => {
  //       console.error("Auth error:", err);
  //       setAuthLoading(false);
  //     });
  // }, []);
  // Replace your existing auth useEffect with this:

// useEffect(() => {
//   async function handleAuth() {
//     const response = await fetch('/.auth/me');
//     const data = await response.json();
//     const principal = data.clientPrincipal;

//     if (principal) {
//       const usersRes = await fetch('/api/GetUsers');
//       const usersData = await usersRes.json();
//       setUsers(usersData);;
      
//       // SYNC: Tell the backend who logged in to get the SQL UserID
//       const syncRes = await fetch('/api/SyncUser', {
//         method: 'POST',
//         headers: { 'Content-Type': 'application/json' },
//         body: JSON.stringify({ 
//           email: principal.userDetails, 
//           name: principal.userDetails.split('@')[0] 
//         })
//       });
      
//       const { dbUserId } = await syncRes.json();
//       setDbUserId(dbUserId); // Add a new state: const [dbUserId, setDbUserId] = useState(null);
      
//       fetchItems();
//     } else {
//       setAuthLoading(false);
//     }
//   }
//   handleAuth();
// }, []);

useEffect(() => {
  async function handleAuth() {
    try {
      const response = await fetch('/.auth/me');
      const data = await response.json();
      const principal = data.clientPrincipal;

      if (principal) {
        setUser(principal);
        
        // Wait for the DB to sync before doing anything else
        const syncRes = await fetch('/api/SyncUser', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            email: principal.userDetails, 
            name: principal.userDetails.split('@')[0] 
          })
        });
        
        const { dbUserId } = await syncRes.json();
        setDbUserId(dbUserId); 
        
        // NOW fetch items
        fetchItems();
      } else {
        setAuthLoading(false);
      }
    } catch (err) {
      console.error("Auth initialization failed", err);
      setAuthLoading(false);
    }
  }
  handleAuth();
}, []);

  const fetchItems = () => {
    fetch('/api/GetItems')
      .then(response => {
        if (!response.ok) throw new Error('Network response was not ok');
        return response.json();
      })
      .then(data => {
        setItems(data);
        setLoading(false);
        setAuthLoading(false);
      })
      .catch(error => {
        console.error("Error fetching items:", error);
        setError("Failed to load inventory.");
        setLoading(false);
        setAuthLoading(false);
      });
  };

  const handleAddItem = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    // Still temporarily hardcoded to UserID 1 until we link the SSO email to the database
    const itemData = { ...newItem, CurrentOwnerID: dbUserId }; 

    try {
        const response = await fetch('/api/AddItem', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(itemData)
        });

        if (response.ok) {
            setIsModalOpen(false);
            setNewItem({ ItemName: '', Description: '', ImageURL: '' });
            fetchItems();
        } else {
            alert("Failed to add tool.");
        }
    } catch (error) {
        console.error("Error:", error);
    } finally {
        setIsSubmitting(false);
    }
  };

  const handleTransfer = async (e) => {
    e.preventDefault();
    setIsTransferring(true);

    try {
        const response = await fetch('/api/InitiateTransfer', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                ItemID: transferItem.ItemID,
                ToUserID: parseInt(transferToUser),
                InitiatorID: dbUserId 
            })
        });

        if (response.ok) {
            setIsTransferModalOpen(false);
            setTransferItem(null);
            setTransferToUser('');
            fetchItems(); 
        } else {
            alert("Failed to initiate transfer.");
        }
    } catch (error) {
        console.error("Error:", error);
    } finally {
        setIsTransferring(false);
    }
  };

  const handleResolveTransfer = async (itemID, resolution) => {
    try {
        const response = await fetch('/api/ResolveTransfer', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ItemID: itemID, Resolution: resolution })
        });
        if (response.ok) fetchItems();
    } catch (error) {
        console.error("Error resolving transfer:", error);
    }
  };

  // --- NEW: LOGIN SCREEN RENDER ---
  if (authLoading) return <div className="dashboard-container"><p>Verifying secure connection...</p></div>;

  if (!user) {
    return (
      <div className="login-container">
        <div className="login-box">
          <h2>Tool Inventory Login</h2>
          <p>Please sign in to access the dashboard.</p>
          <div className="login-buttons">
            <a href="/.auth/login/aad" className="login-btn ms-btn">Sign in with Microsoft</a>
            <a href="/.auth/login/github" className="login-btn gh-btn">Sign in with GitHub</a>
          </div>
        </div>
      </div>
    );
  }

  // --- MAIN DASHBOARD RENDER ---
  return (
    <div className="dashboard-container">
      <header className="dashboard-header">
        <div>
          <h1>Global Inventory Dashboard</h1>
          {/* Display the logged-in user's name/email */}
          <p className="user-greeting">Welcome, {user.userDetails} | <a href="/.auth/logout" className="logout-link">Logout</a></p>
        </div>
        <button className="add-btn" onClick={() => setIsModalOpen(true)}>+ Add New Tool</button>
      </header>
      
      {loading && <p>Loading tools from database...</p>}
      {error && <p className="error-text">{error}</p>}

      <div className="item-grid">
        {items.map(item => (
          <div key={item.ItemID} className="item-card">
            <img src={item.ImageURL || 'https://via.placeholder.com/150'} alt={item.ItemName} className="item-image" />
            <div className="item-details">
              <h3>{item.ItemName}</h3>
              <p className="description">{item.Description}</p>
              <div className="meta-info">
                <span className="owner-badge">👤 {item.OwnerName}</span>
                <span className={`status-badge ${item.Status.replace(/\s+/g, '-').toLowerCase()}`}>
                  {item.Status}
                </span>
              </div>
            </div>
            
            <div className="card-actions">
              {item.Status === 'Pending Transfer' ? (
                <div className="resolve-actions">
                  <button className="accept-btn" onClick={() => handleResolveTransfer(item.ItemID, 'Accept')}>Accept</button>
                  <button className="reject-btn" onClick={() => handleResolveTransfer(item.ItemID, 'Reject')}>Reject</button>
                </div>
              ) : (
                <button className="transfer-btn" onClick={() => { setTransferItem(item); setIsTransferModalOpen(true); }}>
                  Transfer Tool
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Add Modal */}
      {isModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h2>Add a New Tool</h2>
            <form onSubmit={handleAddItem}>
              <div className="form-group">
                <label>Tool Name *</label>
                <input type="text" required value={newItem.ItemName} onChange={(e) => setNewItem({...newItem, ItemName: e.target.value})} />
              </div>
              <div className="form-group">
                <label>Description</label>
                <textarea value={newItem.Description} onChange={(e) => setNewItem({...newItem, Description: e.target.value})} />
              </div>
              <div className="form-group">
                <label>Image URL (Optional)</label>
                <input type="text" placeholder="https://..." value={newItem.ImageURL} onChange={(e) => setNewItem({...newItem, ImageURL: e.target.value})} />
              </div>
              <div className="modal-actions">
                <button type="button" className="cancel-btn" onClick={() => setIsModalOpen(false)}>Cancel</button>
                <button type="submit" className="save-btn" disabled={isSubmitting}>{isSubmitting ? 'Saving...' : 'Save Tool'}
                  {isSubmitting ? 'Saving...' : 'Save Tool'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Transfer Modal */}
      {isTransferModalOpen && transferItem && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h2>Transfer "{transferItem.ItemName}"</h2>
            <p className="description">Currently owned by: <strong>{transferItem.OwnerName}</strong></p>
            
            <form onSubmit={handleTransfer}>
              <div className="form-group">
                <label>Transfer To User: *</label>
                <select required value={transferToUser} onChange={(e) => setTransferToUser(e.target.value)} style={{ padding: '10px', borderRadius: '6px', border: '1px solid #d1d5db' }}>
                  <option value="" disabled>Select a user...</option>
                  {users.map(u => (
                  <option key={u.UserID} value={u.UserID}>{u.Username}</option>
                  ))}
                </select>
              </div>
              <div className="modal-actions">
                <button type="button" className="cancel-btn" onClick={() => { setIsTransferModalOpen(false); setTransferItem(null); setTransferToUser(''); }}>Cancel</button>
                <button type="submit" className="save-btn" disabled={isTransferring || !transferToUser}>{isTransferring ? 'Initiating...' : 'Request Transfer'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;