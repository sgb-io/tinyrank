import { useEffect, useState, useCallback, useRef } from 'react';
import { Poll, SessionInfo } from '../types';
import { TierList } from './TierList';
import { apiFetch } from '../utils/api';

interface PollPageProps {
  code: string;
  session: SessionInfo;
  setSession: (s: SessionInfo) => void;
  navigate: (to: string) => void;
}

function useCountdown(expiresAt: number) {
  const [remaining, setRemaining] = useState(expiresAt - Date.now());
  useEffect(() => {
    const id = setInterval(() => setRemaining(expiresAt - Date.now()), 1000);
    return () => clearInterval(id);
  }, [expiresAt]);
  if (remaining <= 0) return 'Expired';
  const h = Math.floor(remaining / 3600000);
  const m = Math.floor((remaining % 3600000) / 60000);
  const s = Math.floor((remaining % 60000) / 1000);
  return `${h}h ${m}m ${s}s`;
}

export function PollPage({ code, session, setSession, navigate }: PollPageProps) {
  const [poll, setPoll] = useState<Poll | null>(null);
  const [isOwner, setIsOwner] = useState(false);
  const [error, setError] = useState('');
  const [username, setUsername] = useState(session.username || '');
  const [showUsernameModal, setShowUsernameModal] = useState(!session.username);
  const [usernameError, setUsernameError] = useState('');
  const [newItemText, setNewItemText] = useState('');
  const [addingItem, setAddingItem] = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleInput, setTitleInput] = useState('');
  const sseRef = useRef<EventSource | null>(null);

  const countdown = useCountdown(poll?.expiresAt ?? Date.now() + 86400000);

  const loadPoll = useCallback(async () => {
    try {
      const res = await apiFetch(`/api/polls/${code}`);
      if (!res.ok) {
        const d = await res.json();
        setError(d.error || 'Failed to load poll');
        return;
      }
      const data = await res.json();
      setPoll(data.poll);
      setIsOwner(data.isOwner);
    } catch {
      setError('Network error');
    }
  }, [code]);

  useEffect(() => {
    loadPoll();
  }, [loadPoll]);

  // SSE connection
  useEffect(() => {
    const es = new EventSource(`/api/poll/${code}/events`);
    sseRef.current = es;
    es.onmessage = (e) => {
      try {
        const updatedPoll: Poll = JSON.parse(e.data);
        setPoll(updatedPoll);
      } catch { /* ignore */ }
    };
    es.onerror = () => {
      // SSE will auto-reconnect
    };
    return () => {
      es.close();
    };
  }, [code]);

  const handleSetUsername = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = username.trim();
    if (!name) { setUsernameError('Name required'); return; }
    try {
      const res = await apiFetch('/api/session', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: name }),
      });
      if (!res.ok) { setUsernameError('Failed to set name'); return; }
      setSession({ ...session, username: name });
      setShowUsernameModal(false);
    } catch {
      setUsernameError('Network error');
    }
  };

  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = newItemText.trim();
    if (!text) return;
    setAddingItem(true);
    try {
      const res = await apiFetch(`/api/polls/${code}/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });
      if (res.ok) setNewItemText('');
    } catch { /* ignore */ } finally {
      setAddingItem(false);
    }
  };

  const handleDeletePoll = async () => {
    if (!confirm('Delete this poll? This cannot be undone.')) return;
    await apiFetch(`/api/polls/${code}`, { method: 'DELETE' });
    navigate('/');
  };

  const handleRenameTitle = async () => {
    const trimmed = titleInput.trim();
    if (!trimmed || !poll) return;
    await apiFetch(`/api/polls/${code}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: trimmed }),
    });
    setEditingTitle(false);
  };

  const handleDeleteItem = useCallback(async (itemId: string) => {
    await apiFetch(`/api/polls/${code}/items/${itemId}`, { method: 'DELETE' });
  }, [code]);

  if (error) {
    return (
      <div className="poll-error">
        <h2>😕 {error}</h2>
        <button className="btn btn-primary" onClick={() => navigate('/')}>Go Home</button>
      </div>
    );
  }

  if (!poll) {
    return <div className="loading">Loading poll...</div>;
  }

  return (
    <div className="poll-page">
      {showUsernameModal && (
        <div className="modal-overlay">
          <div className="modal">
            <h2>👋 What's your name?</h2>
            <p>Enter a display name to vote and add items.</p>
            <form onSubmit={handleSetUsername}>
              <input
                type="text"
                placeholder="Your name"
                value={username}
                onChange={e => setUsername(e.target.value)}
                maxLength={32}
                autoFocus
              />
              {usernameError && <div className="error-msg">{usernameError}</div>}
              <button type="submit" className="btn btn-primary">Let's go!</button>
              <button type="button" className="btn btn-ghost" onClick={() => setShowUsernameModal(false)}>
                Skip (view only)
              </button>
            </form>
          </div>
        </div>
      )}

      <div className="poll-header">
        <button className="btn btn-ghost back-btn" onClick={() => navigate('/')}>← Back</button>
        <div className="poll-title-row">
          {editingTitle ? (
            <div className="title-edit">
              <input
                type="text"
                value={titleInput}
                onChange={e => setTitleInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleRenameTitle(); if (e.key === 'Escape') setEditingTitle(false); }}
                maxLength={100}
                autoFocus
              />
              <button className="btn btn-primary" onClick={handleRenameTitle}>Save</button>
              <button className="btn btn-ghost" onClick={() => setEditingTitle(false)}>Cancel</button>
            </div>
          ) : (
            <h1 className="poll-title">
              {poll.title}
              {isOwner && (
                <button
                  className="edit-title-btn"
                  onClick={() => { setTitleInput(poll.title); setEditingTitle(true); }}
                  title="Rename poll"
                >✏️</button>
              )}
            </h1>
          )}
        </div>
        <div className="poll-meta">
          <span className="poll-code">Code: <strong>{code}</strong></span>
          <span className="poll-expires">⏱ Expires in: <strong>{countdown}</strong></span>
          {isOwner && <span className="owner-badge">👑 Owner</span>}
          {session.username && (
            <span className="username-badge">
              🙋 {session.username}
              <button className="btn btn-ghost change-name-btn" onClick={() => setShowUsernameModal(true)}>change</button>
            </span>
          )}
          {!session.username && (
            <button className="btn btn-ghost" onClick={() => setShowUsernameModal(true)}>Set name to vote</button>
          )}
        </div>
        {isOwner && (
          <div className="owner-controls">
            <button className="btn btn-danger" onClick={handleDeletePoll}>🗑 Delete Poll</button>
          </div>
        )}
      </div>

      <TierList
        items={poll.items}
        pollCode={code}
        session={session}
        isOwner={isOwner}
        onVoteChange={loadPoll}
        onDeleteItem={handleDeleteItem}
      />

      <div className="add-item-section">
        <form onSubmit={handleAddItem} className="add-item-form">
          <input
            type="text"
            placeholder="Add a new item..."
            value={newItemText}
            onChange={e => setNewItemText(e.target.value)}
            maxLength={200}
          />
          <button type="submit" className="btn btn-primary" disabled={addingItem || !newItemText.trim()}>
            {addingItem ? '...' : '+ Add'}
          </button>
        </form>
      </div>
    </div>
  );
}
