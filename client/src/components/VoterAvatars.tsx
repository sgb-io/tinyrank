import { useState } from 'react';
import { VoteRecord } from '../types';
import { generateAvatar } from '../utils/avatar';

interface VoterAvatarsProps {
  voters: VoteRecord[];
  type: 'up' | 'down';
  maxVisible?: number;
}

export function VoterAvatars({ voters, type, maxVisible = 3 }: VoterAvatarsProps) {
  const [showModal, setShowModal] = useState(false);

  if (voters.length === 0) return null;

  const visible = voters.slice(0, maxVisible);
  const extra = voters.length - maxVisible;

  return (
    <div className={`voter-avatars voter-avatars--${type}`}>
      <div
        className="voter-stack"
        onMouseEnter={() => voters.length > 0 && setShowModal(true)}
        onMouseLeave={() => setShowModal(false)}
      >
        {visible.map((v, i) => (
          <img
            key={v.userId}
            src={generateAvatar(v.avatarSeed, 24)}
            alt={v.username}
            title={v.username}
            className="voter-avatar"
            style={{ zIndex: visible.length - i }}
          />
        ))}
        {extra > 0 && (
          <span className="voter-extra">+{extra}</span>
        )}
        {showModal && (
          <div className="voter-modal">
            <div className="voter-modal-title">{type === 'up' ? '👍 Upvoters' : '👎 Downvoters'}</div>
            {voters.map(v => (
              <div key={v.userId} className="voter-modal-item">
                <img src={generateAvatar(v.avatarSeed, 20)} alt={v.username} />
                <span>{v.username}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
