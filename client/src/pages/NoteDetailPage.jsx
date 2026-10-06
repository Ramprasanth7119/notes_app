import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { BsArrowLeft, BsLink45Deg, BsPencil, BsPin, BsPinAngleFill, BsTrash } from 'react-icons/bs';
import { addNoteToCollection, listCollections } from '../api/collections';
import { deleteNote, getNote, togglePin, updateNote } from '../api/notes';
import Attachments from '../components/notes/Attachments';
import { MarkdownEditor, MarkdownViewer } from '../components/notes/Markdown';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import Field from '../components/ui/Field';
import { EmptyState, ErrorState, LoadingState } from '../components/ui/States';
import { useToast } from '../contexts/toast';
import { formatDateTime, parseTags, pluralize } from '../lib/format';

function AddToCollection({ noteId }) {
  const toast = useToast();
  const [collections, setCollections] = useState(null);
  const [selected, setSelected] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    listCollections()
      .then(setCollections)
      .catch(() => setCollections([]));
  }, []);

  if (!collections?.length) return null;

  const available = collections.filter((c) => !c.notes.some((n) => n._id === noteId));
  const add = async () => {
    setBusy(true);
    try {
      const updated = await addNoteToCollection(selected, noteId);
      setCollections((list) => list.map((c) => (c._id === selected ? { ...c, notes: [...c.notes, { _id: noteId }] } : c)));
      toast.show(`Added to ${updated.name}`);
      setSelected('');
    } catch (error) {
      toast.show(error.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="inline-form">
      <select
        className="input select"
        aria-label="Add to collection"
        value={selected}
        onChange={(event) => setSelected(event.target.value)}
        disabled={available.length === 0}
      >
        <option value="">{available.length ? 'Add to collection…' : 'In all your collections'}</option>
        {available.map((c) => (
          <option key={c._id} value={c._id}>
            {c.name}
          </option>
        ))}
      </select>
      <button type="button" className="button button--ghost" onClick={add} disabled={!selected || busy}>
        Add
      </button>
    </div>
  );
}

export default function NoteDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();

  const [state, setState] = useState({ status: 'loading', note: null, error: null });
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(() => {
    setState({ status: 'loading', note: null, error: null });
    getNote(id)
      .then((note) => setState({ status: 'success', note, error: null }))
      .catch((error) => setState({ status: 'error', note: null, error }));
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const { status, note, error } = state;
  const setNote = (updater) =>
    setState((current) => ({ ...current, note: typeof updater === 'function' ? updater(current.note) : updater }));

  if (status === 'loading') return <LoadingState label="Loading note…" />;
  if (status === 'error') {
    // Another user's note and a missing note both come back as 404.
    return error.status === 404 || error.status === 400 ? (
      <EmptyState title="Note not found" action={<Link to="/" className="button">Back to notes</Link>}>
        It may have been deleted.
      </EmptyState>
    ) : (
      <ErrorState title="Couldn't load this note" error={error} onRetry={load} />
    );
  }

  const startEditing = () => {
    setDraft({ title: note.title, content: note.content, tags: note.tags.join(', ') });
    setSaveError(null);
    setEditing(true);
  };

  const save = async (event) => {
    event.preventDefault();
    setSaving(true);
    setSaveError(null);
    try {
      const updated = await updateNote(note._id, {
        title: draft.title.trim(),
        content: draft.content,
        tags: parseTags(draft.tags)
      });
      setNote(updated);
      setEditing(false);
      toast.show('Note saved');
    } catch (err) {
      setSaveError(err);
    } finally {
      setSaving(false);
    }
  };

  const handlePin = async () => {
    try {
      const updated = await togglePin(note._id);
      setNote(updated);
      toast.show(updated.pinned ? 'Pinned' : 'Unpinned');
    } catch (err) {
      toast.show(err.message, 'error');
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await deleteNote(note._id);
      toast.show('Note deleted');
      navigate('/', { replace: true });
    } catch (err) {
      toast.show(err.message, 'error');
      setDeleting(false);
      setConfirmingDelete(false);
    }
  };

  const fieldErrors = saveError?.fieldErrors || {};

  return (
    <article className="stack stack--loose note-detail">
      <Link to="/" className="back-link">
        <BsArrowLeft aria-hidden="true" /> All notes
      </Link>

      {editing ? (
        <form className="card stack" onSubmit={save} noValidate>
          {saveError && !saveError.details.length && <p className="alert" role="alert">{saveError.message}</p>}
          <Field label="Title" error={fieldErrors.title}>
            {(props) => (
              <input
                {...props}
                className="input input--title"
                value={draft.title}
                maxLength={200}
                onChange={(event) => setDraft({ ...draft, title: event.target.value })}
              />
            )}
          </Field>
          <Field label="Content" error={fieldErrors.content}>
            {(props) => (
              <MarkdownEditor
                {...props}
                height={420}
                value={draft.content}
                onChange={(content) => setDraft({ ...draft, content })}
              />
            )}
          </Field>
          <Field label="Tags" hint="Comma-separated. #hashtags in the content are added too." error={fieldErrors.tags}>
            {(props) => (
              <input
                {...props}
                className="input"
                value={draft.tags}
                onChange={(event) => setDraft({ ...draft, tags: event.target.value })}
              />
            )}
          </Field>
          <div className="button-row">
            <button type="button" className="button button--ghost" onClick={() => setEditing(false)} disabled={saving}>
              Cancel
            </button>
            <button type="submit" className="button button--primary" disabled={saving}>
              {saving ? 'Saving…' : 'Save changes'}
            </button>
          </div>
        </form>
      ) : (
        <>
          <header className="note-detail__header">
            <h1 className="page-title">{note.title}</h1>
            <p className="muted small">
              Updated {formatDateTime(note.updatedAt)} · {pluralize(note.wordCount, 'word')} · {note.readingTime} min read
            </p>
            {note.tags.length > 0 && (
              <ul className="tags" aria-label="Tags">
                {note.tags.map((tag) => (
                  <li key={tag}>
                    <Link to={`/?tag=${encodeURIComponent(tag)}`} className="tag">
                      #{tag}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
            <div className="button-row button-row--start">
              <button type="button" className="button button--ghost" onClick={startEditing}>
                <BsPencil aria-hidden="true" /> Edit
              </button>
              <button type="button" className="button button--ghost" onClick={handlePin} aria-pressed={note.pinned}>
                {note.pinned ? <BsPinAngleFill aria-hidden="true" /> : <BsPin aria-hidden="true" />}
                {note.pinned ? 'Unpin' : 'Pin'}
              </button>
              <button type="button" className="button button--ghost button--danger-text" onClick={() => setConfirmingDelete(true)}>
                <BsTrash aria-hidden="true" /> Delete
              </button>
              <AddToCollection noteId={note._id} />
            </div>
          </header>

          <div className="card note-detail__content">
            <MarkdownViewer source={note.content} />
          </div>
        </>
      )}

      <Attachments
        noteId={note._id}
        files={note.mediaFiles}
        onChange={(mediaFiles) => setNote((current) => ({ ...current, mediaFiles }))}
      />

      {note.sources?.length > 0 && (
        <section className="section" aria-labelledby="sources-heading">
          <h2 id="sources-heading" className="section__title">
            <BsLink45Deg aria-hidden="true" /> Sources
          </h2>
          <ul className="sources">
            {note.sources.map((source) => (
              <li key={source._id || source.url}>
                <a href={source.url} target="_blank" rel="noopener noreferrer">
                  {source.title}
                </a>
                <span className="muted small">{source.url}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <ConfirmDialog
        open={confirmingDelete}
        title="Delete this note?"
        message="The note and its attachments will be permanently deleted."
        busy={deleting}
        onConfirm={handleDelete}
        onCancel={() => setConfirmingDelete(false)}
      />
    </article>
  );
}
