import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { BsFolder2, BsFolderPlus, BsPlusLg } from 'react-icons/bs';
import { createCollection, listCollections } from '../api/collections';
import CollectionFormModal from '../components/notes/CollectionFormModal';
import { EmptyState, ErrorState, LoadingState } from '../components/ui/States';
import { useToast } from '../contexts/toast';
import { formatDate, pluralize } from '../lib/format';

export default function CollectionsPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const [state, setState] = useState({ status: 'loading', collections: [], error: null });
  const [creating, setCreating] = useState(false);

  const load = useCallback(() => {
    setState((current) => ({ ...current, status: 'loading', error: null }));
    listCollections()
      .then((collections) => setState({ status: 'success', collections, error: null }))
      .catch((error) => setState({ status: 'error', collections: [], error }));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleCreate = async (fields) => {
    const collection = await createCollection(fields);
    setCreating(false);
    toast.show('Collection created');
    navigate(`/collections/${collection._id}`);
  };

  const { status, collections, error } = state;

  return (
    <div className="stack stack--loose">
      <div className="page-header">
        <div>
          <h1 className="page-title">Collections</h1>
          <p className="muted">{status === 'success' ? pluralize(collections.length, 'collection') : ' '}</p>
        </div>
        <button type="button" className="button button--primary" onClick={() => setCreating(true)}>
          <BsPlusLg aria-hidden="true" /> New collection
        </button>
      </div>

      {status === 'loading' && <LoadingState label="Loading collections…" />}
      {status === 'error' && <ErrorState title="Couldn't load collections" error={error} onRetry={load} />}

      {status === 'success' && collections.length === 0 && (
        <EmptyState
          icon={BsFolderPlus}
          title="No collections yet"
          action={<button type="button" className="button button--primary" onClick={() => setCreating(true)}>Create a collection</button>}
        >
          Group related notes, like a project or a reading list.
        </EmptyState>
      )}

      {status === 'success' && collections.length > 0 && (
        <div className="grid">
          {collections.map((collection) => (
            <article key={collection._id} className="card collection-card">
              <BsFolder2 className="collection-card__icon" aria-hidden="true" />
              <h2 className="note-card__title">
                <Link to={`/collections/${collection._id}`} className="stretched-link">
                  {collection.name}
                </Link>
              </h2>
              {collection.description && <p className="note-card__excerpt">{collection.description}</p>}
              <p className="note-card__meta">
                <span>{pluralize(collection.notes.length, 'note')}</span>
                <span>Updated {formatDate(collection.updatedAt)}</span>
              </p>
            </article>
          ))}
        </div>
      )}

      {creating && (
        <CollectionFormModal
          open
          title="New collection"
          submitLabel="Create collection"
          onSubmit={handleCreate}
          onClose={() => setCreating(false)}
        />
      )}
    </div>
  );
}
