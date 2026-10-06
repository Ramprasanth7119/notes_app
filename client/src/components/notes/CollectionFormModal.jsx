import { useState } from 'react';
import Field from '../ui/Field';
import Modal from '../ui/Modal';

// Used for both "New collection" and "Edit collection".
export default function CollectionFormModal({ open, title, submitLabel, initial, onSubmit, onClose }) {
  const [form, setForm] = useState(initial || { name: '', description: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const fieldErrors = error?.fieldErrors || {};

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await onSubmit({ name: form.name.trim(), description: form.description.trim() });
    } catch (err) {
      setError(err);
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      title={title}
      onClose={saving ? () => {} : onClose}
      footer={
        <>
          <button type="button" className="button button--ghost" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button type="submit" form="collection-form" className="button button--primary" disabled={saving}>
            {saving ? 'Saving…' : submitLabel}
          </button>
        </>
      }
    >
      <form id="collection-form" className="stack" onSubmit={handleSubmit} noValidate>
        {error && !error.details.length && <p className="alert" role="alert">{error.message}</p>}
        <Field label="Name" error={fieldErrors.name}>
          {(props) => (
            <input
              {...props}
              className="input"
              value={form.name}
              maxLength={100}
              onChange={(event) => setForm({ ...form, name: event.target.value })}
              required
            />
          )}
        </Field>
        <Field label="Description" hint="Optional" error={fieldErrors.description}>
          {(props) => (
            <textarea
              {...props}
              className="input input--textarea"
              rows={3}
              maxLength={1000}
              value={form.description}
              onChange={(event) => setForm({ ...form, description: event.target.value })}
            />
          )}
        </Field>
      </form>
    </Modal>
  );
}
