import { useState } from "react";
import { SessionInfo } from "../types";
import { apiFetch } from "../utils/api";

interface HomePageProps {
  session: SessionInfo;
  setSession: (s: SessionInfo) => void;
  navigate: (to: string) => void;
}

export function HomePage({ session, setSession, navigate }: HomePageProps) {
  const [createTitle, setCreateTitle] = useState("");
  const [createItems, setCreateItems] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [createError, setCreateError] = useState("");
  const [joinError, setJoinError] = useState("");
  const [creating, setCreating] = useState(false);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError("");
    const title = createTitle.trim();
    const items = createItems
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);
    if (!title) {
      setCreateError("Title is required");
      return;
    }
    if (items.length < 1) {
      setCreateError("At least 1 item required");
      return;
    }

    setCreating(true);
    try {
      const res = await apiFetch("/api/polls", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, items }),
      });
      const data = await res.json();
      if (!res.ok) {
        setCreateError(data.error || "Failed to create poll");
        return;
      }
      setSession({
        ...session,
        pollsCreated: [...session.pollsCreated, data.code],
        polls: [...(session.polls ?? []), { code: data.code, title: title }],
      });
      navigate(`/poll/${data.code}`);
    } catch {
      setCreateError("Network error. Please try again.");
    } finally {
      setCreating(false);
    }
  };

  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault();
    setJoinError("");
    const code = joinCode.trim().toLowerCase();
    if (!code || code.length !== 6) {
      setJoinError("Enter a valid 6-character code");
      return;
    }
    navigate(`/poll/${code}`);
  };

  return (
    <div className="home-page">
      <header className="home-header">
        <h1 className="logo">🏆 TinyRank</h1>
        <p className="tagline">Live ranking polls, instantly shareable</p>
      </header>

      <div className="home-cards">
        <div className="card">
          <h2>Create a Poll</h2>
          <form onSubmit={handleCreate} className="create-form">
            <div className="form-group">
              <label htmlFor="poll-title">Poll Title</label>
              <input
                id="poll-title"
                type="text"
                placeholder="e.g. Best programming languages"
                value={createTitle}
                onChange={(e) => setCreateTitle(e.target.value)}
                maxLength={100}
                required
              />
            </div>
            <div className="form-group">
              <label htmlFor="poll-items">Items (one per line)</label>
              <textarea
                id="poll-items"
                placeholder={"TypeScript\nPython\nRust\nGo"}
                value={createItems}
                onChange={(e) => setCreateItems(e.target.value)}
                rows={5}
              />
            </div>
            {createError && <div className="error-msg">{createError}</div>}
            <button
              type="submit"
              className="btn btn-primary"
              disabled={creating}
            >
              {creating ? "Creating..." : "🚀 Create Poll"}
            </button>
          </form>
        </div>

        <div className="card">
          <h2>Join a Poll</h2>
          <form onSubmit={handleJoin} className="join-form">
            <div className="form-group">
              <label htmlFor="join-code">Poll Code</label>
              <input
                id="join-code"
                type="text"
                placeholder="e.g. giwkch"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toLowerCase())}
                maxLength={6}
                pattern="[a-z0-9]{6}"
              />
            </div>
            {joinError && <div className="error-msg">{joinError}</div>}
            <button type="submit" className="btn btn-secondary">
              🔍 Join Poll
            </button>
          </form>

          {session.pollsCreated.length > 0 && (
            <div className="my-polls">
              <h3>Your Polls</h3>
              <ul>
                {(session.polls ?? []).map((p) => (
                  <li key={p.code}>
                    <button
                      className="poll-link"
                      onClick={() => navigate(`/poll/${p.code}`)}
                    >
                      {p.title}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
