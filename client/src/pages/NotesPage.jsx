import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { BsJournalPlus, BsPlusLg, BsSearch, BsX } from 'react-icons/bs';
import { listCollections } from '../api/collections';
import { isCancelled } from '../api/http';
import { getStats, searchNotes } from '../api/notes';
import NoteCard, { NoteCardSkeleton } from '../components/notes/NoteCard';
import NoteFormModal from '../components/notes/NoteFormModal';
import Pagination from '../components/ui/Pagination';
import { EmptyState, ErrorState } from '../components/ui/States';
import { useToast } from '../contexts/toast';
import { pluralize } from '../lib/format';

const PAGE_SIZE = 12;
const SEARCH_DELAY_MS = 300;

export default function NotesPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const [params, setParams] = useSearchParams();

  // The URL is the source of truth for the current search, so filters survive
  // a refresh and the back button works.
  const q = params.get('q') || '';
  const tag = params.get('tag') || '';
  const collection = params.get('collection') || '';
  const page = Math.max(1, Number.parseInt(params.get('page'), 10) || 1);
  const hasFilters = Boolean(q || tag || collection);

  const [searchInput, setSearchInput] = useState(q);
  const searchTimer = useRef(null);
  const [result, setResult] = useState({ status: 'loading', data: null, error: null });
  const [reloadKey, setReloadKey] = useState(0);
  const [topTags, setTopTags] = useState([]);
  const [collections, setCollections] = useState([]);
  const [creating, setCreating] = useState(false);

  const updateParams = useCallback(
    (changes) => {
      setParams((current) => {
        const next = new URLSearchParams(current);
        Object.entries(changes).forEach(([key, value]) => (value ? next.set(key, value) : next.delete(key)));
        // Any filter change starts again from page 1.
        if (!('page' in changes)) next.delete('page');
        return next;
      });
    },
    [setParams]
  );

  // Fetch whenever the search changes. The previous request is aborted, so a
  // slow response for an old query can never overwrite a newer one.
  useEffect(() => {
    const controller = new AbortController();
    setResult((current) => ({ ...current, status: 'loading', error: null }));
    searchNotes({ q, tag, collection, page, limit: PAGE_SIZE }, { signal: controller.signal })
      .then((data) => setResult({ status: 'success', data, error: null }))
      .catch((error) => {
        if (!isCancelled(error)) setResult((current) => ({ ...current, status: 'error', error }));
      });
    return () => controller.abort();
  }, [q, tag, collection, page, reloadKey]);

  // Filter options: the user's most used tags and their collections.
  useEffect(() => {
    getStats()
      .then((stats) => setTopTags(stats.tagStats.map((entry) => entry._id)))
      .catch(() => setTopTags([]));
    listCollections()
      .then(setCollections)
      .catch(() => setCollections([]));
  }, [reloadKey]);

  const handleSearchChange = (value) => {
    setSearchInput(value);
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => updateParams({ q: value.trim() }), SEARCH_DELAY_MS);
  };

  const clearFilters = () => {
    clearTimeout(searchTimer.current);
    setSearchInput('');
    setParams({});
  };

  const toggleTag = (value) => updateParams({ tag: value === tag ? '' : value });

  const handleCreated = (note) => {
    setCreating(false);
    toast.show('Note created');
    navigate(`/notes/${note._id}`);
  };

  const { status, data, error } = result;
  const activeCollection = collections.find((c) => c._id === collection);
  const tagOptions = tag && !topTags.includes(tag) ? [tag, ...topTags] : topTags;

  return (
    <div className="stack stack--loose">
      <div className="page-header">
        <div>
          <h1 className="page-title">Notes</h1>
          <p className="muted" aria-live="polite">
            {data ? `${pluralize(data.total, hasFilters ? 'result' : 'note')}` : ' '}
          </p>
        </div>
        <button type="button" className="button button--primary" onClick={() => setCreating(true)}>
          <BsPlusLg aria-hidden="true" /> New note
        </button>
      </div>

      <div className="toolbar" role="search">
        <div className="search">
          <BsSearch className="search__icon" aria-hidden="true" />
          <input
            type="search"
            className="input search__input"
            placeholder="Search titles and content…"
            aria-label="Search notes"
            value={searchInput}
            onChange={(event) => handleSearchChange(event.target.value)}
          />
          {searchInput && (
            <button
              type="button"
              className="icon-button icon-button--small search__clear"
              onClick={() => handleSearchChange('')}
              aria-label="Clear search"
            >
              <BsX aria-hidden="true" />
            </button>
          )}
        </div>
        <select
          className="input select"
          aria-label="Filter by collection"
          value={collection}
          onChange={(event) => updateParams({ collection: event.target.value })}
        >
          <option value="">All collections</option>
          {collections.map((c) => (
            <option key={c._id} value={c._id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      {tagOptions.length > 0 && (
        <div className="chip-row" aria-label="Filter by tag">
          {tagOptions.map((value) => (
            <button
              key={value}
              type="button"
              className={`chip${value === tag ? ' chip--active' : ''}`}
              aria-pressed={value === tag}
              onClick={() => toggleTag(value)}
            >
              #{value}
            </button>
          ))}
        </div>
      )}

      {hasFilters && (
        <div className="active-filters">
          <span className="muted small">Filtered by</span>
          {q && <span className="pill">“{q}”</span>}
          {tag && <span className="pill">#{tag}</span>}
          {collection && <span className="pill">{activeCollection?.name || 'collection'}</span>}
          <button type="button" className="link-button" onClick={clearFilters}>
            Clear all
          </button>
        </div>
      )}

      {status === 'error' && !data && (
        <ErrorState title="Couldn't load your notes" error={error} onRetry={() => setReloadKey((k) => k + 1)} />
      )}
      {status === 'error' && data && (
        <p className="alert" role="alert">
          {error.message}{' '}
          <button type="button" className="link-button" onClick={() => setReloadKey((k) => k + 1)}>
            Retry
          </button>
        </p>
      )}

      {status === 'loading' && !data && (
        <div className="grid" aria-busy="true" aria-label="Loading notes">
          {Array.from({ length: 6 }, (_, i) => (
            <NoteCardSkeleton key={i} />
          ))}
        </div>
      )}

      {data && data.results.length === 0 && (
        hasFilters ? (
          <EmptyState
            icon={BsSearch}
            title="No notes match"
            action={<button type="button" className="button" onClick={clearFilters}>Clear filters</button>}
          >
            Search matches whole words, so “react” finds “React” but “rea” does not.
          </EmptyState>
        ) : page > 1 ? (
          <EmptyState
            title="This page is empty"
            action={<button type="button" className="button" onClick={() => updateParams({ page: '' })}>Go to page 1</button>}
          />
        ) : (
          <EmptyState
            icon={BsJournalPlus}
            title="No notes yet"
            action={<button type="button" className="button button--primary" onClick={() => setCreating(true)}>Write your first note</button>}
          >
            Notes you create are private to your account.
          </EmptyState>
        )
      )}

      {data && data.results.length > 0 && (
        <>
          <div className={`grid${status === 'loading' ? ' grid--stale' : ''}`} aria-busy={status === 'loading'}>
            {data.results.map((note) => (
              <NoteCard key={note._id} note={note} onTagClick={toggleTag} activeTag={tag} />
            ))}
          </div>
          <Pagination
            page={data.page}
            totalPages={data.totalPages}
            disabled={status === 'loading'}
            onChange={(next) => {
              updateParams({ page: next > 1 ? String(next) : '' });
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
          />
        </>
      )}

      <NoteFormModal open={creating} onClose={() => setCreating(false)} onCreated={handleCreated} />
    </div>
  );
}
