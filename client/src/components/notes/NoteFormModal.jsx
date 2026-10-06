import { useState } from 'react';
import { createNote } from '../../api/notes';
import { parseTags } from '../../lib/format';
import Field from '../ui/Field';
import Modal from '../ui/Modal';
import { MarkdownEditor } from './Markdown';

const EMPTY = { title: '', content: '', tags: '' };

export default function NoteFormModal({ open, onClose, onCreated }) {
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const fieldErrors = error?.fieldErrors || {};

  const close = () => {
    if (saving) return;
    setForm(EMPTY);
    setError(null);
    onClose();
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const note = await createNote({
        // An empty title lets the server use the first line of the content.
        title: form.title.trim() || undefined,
        content: form.content,
        tags: parseTags(form.tags)
      });
      setForm(EMPTY);
      onCreated(note);
    } catch (err) {
      setError(err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      title="New note"
      onClose={close}
      size="lg"
      footer={
        <>
          <button type="button" className="button button--ghost" onClick={close} disabled={saving}>
            Cancel
          </button>
          <button type="submit" form="new-note-form" className="button button--primary" disabled={saving}>
            {saving ? 'Saving…' : 'Create note'}
          </button>
        </>
      }
    >
      <form id="new-note-form" className="stack" onSubmit={handleSubmit} noValidate>
        {error && !error.details.length && <p className="alert" role="alert">{error.message}</p>}

        <Field label="Title" hint="Optional — the first line is used if you leave it empty." error={fieldErrors.title}>
          {(props) => (
            <input
              {...props}
              className="input"
              value={form.title}
              maxLength={200}
              onChange={(event) => setForm({ ...form, title: event.target.value })}
            />
          )}
        </Field>

        <Field label="Content" error={fieldErrors.content}>
          {(props) => (
            <MarkdownEditor {...props} value={form.content} onChange={(content) => setForm({ ...form, content })} />
          )}
        </Field>

        <Field label="Tags" hint="Comma-separated, e.g. work, ideas" error={fieldErrors.tags}>
          {(props) => (
            <input
              {...props}
              className="input"
              value={form.tags}
              onChange={(event) => setForm({ ...form, tags: event.target.value })}
            />
          )}
        </Field>
      </form>
    </Modal>
  );
}
