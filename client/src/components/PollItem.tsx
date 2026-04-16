import { useState } from 'react';
import { PollItem as PollItemType, SessionInfo } from '../types';
import { VoterAvatars } from './VoterAvatars';
import { apiFetch } from '../utils/api';

interface PollItemProps {
  item: PollItemType;
  pollCode: string;
  session: SessionInfo;
  isOwner: boolean;
  onDelete: (itemId: string) => void;
  onVoteChange: () => void;
}

export function PollItem({ item, pollCode, session, isOwner, onDelete, onVoteChange }: PollItemProps) {
  const [voting, setVoting] = useState(false);
  const score = item.upvotes.length - item.downvotes.length;
  const userUpvoted = item.upvotes.some(v => v.userId === session.id);
  const userDownvoted = item.downvotes.some(v => v.userId === session.id);

  const vote = async (type: 'up' | 'down') => {
    if (voting) return;
    setVoting(true);
    try {
      const voteValue = (type === 'up' && userUpvoted) || (type === 'down' && userDownvoted) ? null : type;
      await apiFetch(`/api/polls/${pollCode}/items/${item.id}/vote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vote: voteValue }),
      });
      onVoteChange();
    } catch (err) {
      console.error(err);
    } finally {
      setVoting(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm(`Delete "${item.text}"?`)) return;
    try {
      await apiFetch(`/api/polls/${pollCode}/items/${item.id}`, { method: 'DELETE' });
      onDelete(item.id);
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="poll-item">
      <div className="poll-item-text">{item.text}</div>
      <div className="poll-item-votes">
        <div className="vote-section vote-section--up">
          <VoterAvatars voters={item.upvotes} type="up" />
          <button
            className={`vote-btn vote-btn--up ${userUpvoted ? 'active' : ''}`}
            onClick={() => vote('up')}
            disabled={voting || !session.username}
            title={!session.username ? 'Set your name to vote' : 'Upvote'}
          >
            👍 <span className="vote-count">{item.upvotes.length}</span>
          </button>
        </div>
        <div className="vote-score" title={`Score: ${score}`}>{score > 0 ? '+' : ''}{score}</div>
        <div className="vote-section vote-section--down">
          <button
            className={`vote-btn vote-btn--down ${userDownvoted ? 'active' : ''}`}
            onClick={() => vote('down')}
            disabled={voting || !session.username}
            title={!session.username ? 'Set your name to vote' : 'Downvote'}
          >
            👎 <span className="vote-count">{item.downvotes.length}</span>
          </button>
          <VoterAvatars voters={item.downvotes} type="down" />
        </div>
      </div>
      {isOwner && (
        <button className="item-delete-btn" onClick={handleDelete} title="Delete item">×</button>
      )}
    </div>
  );
}
