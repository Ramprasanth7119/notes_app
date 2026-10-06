import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { BsArrowLeft, BsJournalPlus, BsPencil, BsPlusLg, BsSearch, BsTrash, BsX } from 'react-icons/bs';
import {
  addNoteToCollection,
  deleteCollection,
  getCollection,
  removeNoteFromCollection,
  updateCollection
} from '../api/collections';
import { isCancelled } from '../api/http';
import { searchNotes } from '../api/notes';
import CollectionFormModal from '../components/notes/CollectionFormModal';
import NoteCard from '../components/notes/NoteCard';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import Modal from '../components/ui/Modal';
import { EmptyState, ErrorState, LoadingState, Spinner } from '../components/ui/States';
import { useToast } from '../contexts/toast';
import { pluralize } from '../lib/format';

// Lists the user's notes via the server-side search endpoint so it scales to
// any number of notes, and hides the ones already in the collection.
function AddNotesModal({ collection, onAdded, onClose }) {
  const toast = useToast();
  const [input, setInput] = useState('');
  const [query, setQuery] = useState('');
  const timer = useRef(null);
  const [result, setResult] = useState({ status: 'loading', notes: [], error: null });
  const [adding, setAdding] = useState(null);

  useEffect(() => {
    const controller = new AbortController();
    setResult((current) => ({ ...current, status: 'loading' }));
    searchNotes({ q: query, page: 1, limit: 20 }, { signal: controller.signal })
      .then((data) => setResult({ status: 'success', notes: data.results, error: null }))
      .catch((error) => {
        if (!isCancelled(error)) setResult({ status: 'error', notes: [], error });
      });
    return () => controller.abort();
  }, [query]);

  const inCollection = new Set(collection.notes.map((note) => note._id));
  const available = result.notes.filter((note) => !inCollection.has(note._id));

  const add = async (note) => {
    setAdding(note._id);
    try {
      await addNoteToCollection(collection._id, note._id);
      onAdded(note);
      toast.show(`Added “${note.title}”`);
    } catch (error) {
      toast.show(error.message, 'error');
    } finally {
      setAdding(null);
    }
  };

  return (
    <Modal open title={`Add notes to ${collection.name}`} onClose={onClose}>
      <div className="stack">
        <div className="search">
          <BsSearch className="search__icon" aria-hidden="true" />
          <input
            type="search"
            className="input search__input"
            placeholder="Search your notes…"
            aria-label="Search your notes"
            value={input}
            onChange={(event) => {
              setInput(event.target.value);
              clearTimeout(timer.current);
              const value = event.target.value.trim();
              timer.current = setTimeout(() => setQuery(value), 300);
            }}
          />
        </div>
        {result.status === 'loading' && (
          <div className="state state--compact">
            <Spinner />
          </div>
        )}
        {result.status === 'error' && <p className="alert" role="alert">{result.error.message}</p>}
        {result.status === 'success' && available.length === 0 && (
          <p className="muted">{query ? 'No matching notes outside this collection.' : 'All of your notes are already here.'}</p>
        )}
        {result.status === 'success' && available.length > 0 && (
          <ul className="picker">
            {available.map((note) => (
              <li key={note._id} className="picker__item">
                <span className="picker__title">{note.title}</span>
                <button
                  type="button"
                  className="button button--ghost button--small"
                  onClick={() => add(note)}
                  disabled={adding === note._id}
                >
                  <BsPlusLg aria-hidden="true" /> Add
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Modal>
  );
}

export default function CollectionDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const [state, setState] = useState({ status: 'loading', collection: null, error: null });
  const [dialog, setDialog] = useState(null); // 'edit' | 'delete' | 'add'
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(() => {
    setState({ status: 'loading', collection: null, error: null });
    getCollection(id)
      .then((collection) => setState({ status: 'success', collection, error: null }))
      .catch((error) => setState({ status: 'error', collection: null, error }));
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const { status, collection, error } = state;
  const setCollection = (updater) => setState((current) => ({ ...current, collection: updater(current.collection) }));

  if (status === 'loading') return <LoadingState label="Loading collection…" />;
  if (status === 'error') {
    return error.status === 404 || error.status === 400 ? (
      <EmptyState title="Collection not found" action={<Link to="/collections" className="button">Back to collections</Link>} />
    ) : (
      <ErrorState title="Couldn't load this collection" error={error} onRetry={load} />
    );
  }

  const handleEdit = async (fields) => {
    const updated = await updateCollection(collection._id, fields);
    setCollection((current) => ({ ...current, name: updated.name, description: updated.description }));
    setDialog(null);
    toast.show('Collection updated');
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await deleteCollection(collection._id);
      toast.show('Collection deleted — its notes were kept');
      navigate('/collections', { replace: true });
    } catch (err) {
      toast.show(err.message, 'error');
      setDeleting(false);
      setDialog(null);
    }
  };

  const handleRemove = async (note) => {
    try {
      await removeNoteFromCollection(collection._id, note._id);
      setCollection((current) => ({ ...current, notes: current.notes.filter((n) => n._id !== note._id) }));
      toast.show(`Removed “${note.title}”`);
    } catch (err) {
      toast.show(err.message, 'error');
    }
  };

  return (
    <div className="stack stack--loose">
      <Link to="/collections" className="back-link">
        <BsArrowLeft aria-hidden="true" /> All collections
      </Link>

      <div className="page-header">
        <div>
          <h1 className="page-title">{collection.name}</h1>
          {collection.description && <p className="muted">{collection.description}</p>}
          <p className="muted small">{pluralize(collection.notes.length, 'note')}</p>
        </div>
        <div className="button-row">
          <button type="button" className="button button--primary" onClick={() => setDialog('add')}>
            <BsPlusLg aria-hidden="true" /> Add notes
          </button>
          <Link to={`/?collection=${collection._id}`} className="button button--ghost">
            <BsSearch aria-hidden="true" /> Search in collection
          </Link>
          <button type="button" className="button button--ghost" onClick={() => setDialog('edit')}>
            <BsPencil aria-hidden="true" /> Edit
          </button>
          <button type="button" className="button button--ghost button--danger-text" onClick={() => setDialog('delete')}>
            <BsTrash aria-hidden="true" /> Delete
          </button>
        </div>
      </div>

      {collection.notes.length === 0 ? (
        <EmptyState
          icon={BsJournalPlus}
          title="This collection is empty"
          action={<button type="button" className="button" onClick={() => setDialog('add')}>Add notes</button>}
        />
      ) : (
        <div className="grid">
          {collection.notes.map((note) => (
            <NoteCard
              key={note._id}
              note={note}
              action={
                <button
                  type="button"
                  className="icon-button icon-button--small"
                  onClick={() => handleRemove(note)}
                  aria-label={`Remove ${note.title} from collection`}
                  title="Remove from collection"
                >
                  <BsX aria-hidden="true" />
                </button>
              }
            />
          ))}
        </div>
      )}

      {dialog === 'edit' && (
        <CollectionFormModal
          open
          title="Edit collection"
          submitLabel="Save"
          initial={{ name: collection.name, description: collection.description || '' }}
          onSubmit={handleEdit}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog === 'add' && (
        <AddNotesModal
          collection={collection}
          onAdded={(note) => setCollection((current) => ({ ...current, notes: [...current.notes, note] }))}
          onClose={() => setDialog(null)}
        />
      )}
      <ConfirmDialog
        open={dialog === 'delete'}
        title="Delete this collection?"
        message="The collection is removed. The notes in it are kept."
        busy={deleting}
        onConfirm={handleDelete}
        onCancel={() => setDialog(null)}
      />
    </div>
  );
}
