import { Link } from 'react-router-dom';
import { BsPaperclip, BsPinAngleFill } from 'react-icons/bs';
import { excerpt, formatDate } from '../../lib/format';

export function TagList({ tags, onTagClick, activeTag }) {
  if (!tags?.length) return null;
  return (
    <ul className="tags" aria-label="Tags">
      {tags.map((tag) => (
        <li key={tag}>
          {onTagClick ? (
            <button
              type="button"
              className={`tag${tag === activeTag ? ' tag--active' : ''}`}
              onClick={() => onTagClick(tag)}
              aria-pressed={tag === activeTag}
            >
              #{tag}
            </button>
          ) : (
            <span className="tag">#{tag}</span>
          )}
        </li>
      ))}
    </ul>
  );
}

export function NoteCardSkeleton() {
  return (
    <div className="card note-card note-card--skeleton" aria-hidden="true">
      <span className="skeleton skeleton--title" />
      <span className="skeleton" />
      <span className="skeleton" />
      <span className="skeleton skeleton--short" />
    </div>
  );
}

export default function NoteCard({ note, onTagClick, activeTag, action }) {
  const preview = excerpt(note.content);
  const attachments = note.mediaFiles?.length || 0;

  return (
    <article className={`card note-card${note.pinned ? ' note-card--pinned' : ''}`}>
      <header className="note-card__header">
        <h3 className="note-card__title">
          {/* The ::after of this link covers the card, so the whole card is clickable. */}
          <Link to={`/notes/${note._id}`} className="stretched-link">
            {note.title}
          </Link>
        </h3>
        {note.pinned && <BsPinAngleFill className="note-card__pin" aria-label="Pinned" />}
      </header>
      {preview && <p className="note-card__excerpt">{preview}</p>}
      <TagList tags={note.tags} onTagClick={onTagClick} activeTag={activeTag} />
      <footer className="note-card__meta">
        <span>{formatDate(note.updatedAt)}</span>
        {attachments > 0 && (
          <span>
            <BsPaperclip aria-hidden="true" /> {attachments}
            <span className="visually-hidden"> attachments</span>
          </span>
        )}
        {action && <span className="note-card__action">{action}</span>}
      </footer>
    </article>
  );
}
