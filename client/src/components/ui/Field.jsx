import { useId } from 'react';

// Label + control + hint/error, wired up with aria-describedby.
export default function Field({ label, hint, error, children }) {
  const id = useId();
  const messageId = `${id}-message`;
  const message = error || hint;

  return (
    <div className={`field${error ? ' field--invalid' : ''}`}>
      <label htmlFor={id} className="field__label">
        {label}
      </label>
      {children({ id, 'aria-invalid': Boolean(error), 'aria-describedby': message ? messageId : undefined })}
      {message && (
        <p id={messageId} className={error ? 'field__error' : 'field__hint'}>
          {message}
        </p>
      )}
    </div>
  );
}
