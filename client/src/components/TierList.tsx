import { useMemo } from 'react';
import { PollItem as PollItemType, SessionInfo, Tier, getTier } from '../types';
import { PollItem } from './PollItem';

const TIERS: Tier[] = ['S', 'A', 'B', 'C', 'D', 'E'];

const TIER_COLORS: Record<Tier, string> = {
  S: '#FFD700',
  A: '#FF8C00',
  B: '#32CD32',
  C: '#4169E1',
  D: '#9370DB',
  E: '#808080',
};

interface TierListProps {
  items: PollItemType[];
  pollCode: string;
  session: SessionInfo;
  isOwner: boolean;
  onVoteChange: () => void;
  onDeleteItem: (itemId: string) => void;
}

export function TierList({ items, pollCode, session, isOwner, onVoteChange, onDeleteItem }: TierListProps) {
  const grouped = useMemo(() => {
    const map: Record<Tier, PollItemType[]> = { S: [], A: [], B: [], C: [], D: [], E: [] };
    for (const item of items) {
      const score = item.upvotes.length - item.downvotes.length;
      const tier = getTier(score);
      map[tier].push(item);
    }
    // Sort each tier by score descending
    for (const tier of TIERS) {
      map[tier].sort((a, b) => {
        const sa = a.upvotes.length - a.downvotes.length;
        const sb = b.upvotes.length - b.downvotes.length;
        return sb - sa;
      });
    }
    return map;
  }, [items]);

  return (
    <div className="tier-list">
      {TIERS.map(tier => (
        <div key={tier} className="tier-row">
          <div
            className="tier-label"
            style={{ backgroundColor: TIER_COLORS[tier] }}
          >
            {tier}
          </div>
          <div className="tier-items">
            {grouped[tier].length === 0 ? (
              <div className="tier-empty">—</div>
            ) : (
              grouped[tier].map(item => (
                <PollItem
                  key={item.id}
                  item={item}
                  pollCode={pollCode}
                  session={session}
                  isOwner={isOwner}
                  onDelete={onDeleteItem}
                  onVoteChange={onVoteChange}
                />
              ))
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
