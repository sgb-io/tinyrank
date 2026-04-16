import { useEffect, useState } from 'react';
import { HomePage } from './components/HomePage';
import { PollPage } from './components/PollPage';
import { SessionInfo } from './types';

export default function App() {
  const [session, setSession] = useState<SessionInfo | null>(null);
  const [path, setPath] = useState(window.location.pathname);

  useEffect(() => {
    fetch('/api/session')
      .then(r => r.json())
      .then(data => setSession(data))
      .catch(console.error);
  }, []);

  useEffect(() => {
    const onPop = () => setPath(window.location.pathname);
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const navigate = (to: string) => {
    window.history.pushState({}, '', to);
    setPath(to);
  };

  if (!session) return <div className="loading">Loading...</div>;

  const pollMatch = path.match(/^\/poll\/([a-z0-9]{6})$/i);
  if (pollMatch) {
    return (
      <PollPage
        code={pollMatch[1].toLowerCase()}
        session={session}
        setSession={setSession}
        navigate={navigate}
      />
    );
  }

  return (
    <HomePage
      session={session}
      setSession={setSession}
      navigate={navigate}
    />
  );
}
