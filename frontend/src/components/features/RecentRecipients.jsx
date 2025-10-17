// src/components/features/RecentRecipients.jsx
import { getUniqueRecipients } from '../../utils/formatters';

export default function RecentRecipients({ historial, onSelectRecipient }) {
  const recentRecipients = getUniqueRecipients(historial, 12);

  if (recentRecipients.length === 0) {
    return null;
  }

  return (
    <div className="recent-recipients">
      <label className="form-label">Destinatarios recientes</label>
      <div className="recipients-list">
        {recentRecipients.map((recipient) => (
          <button
            key={recipient.id}
            type="button"
            className="recipient-item"
            onClick={() => onSelectRecipient(recipient)}
          >
            <div className="recipient-avatar">
              {recipient.username?.charAt(0).toUpperCase()}
            </div>
            <span className="recipient-name">{recipient.username}</span>
          </button>
        ))}
      </div>
    </div>
  );
}