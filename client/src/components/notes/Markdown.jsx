import { lazy, Suspense } from 'react';

const LazyEditor = lazy(() => import('./MarkdownImpl').then((module) => ({ default: module.Editor })));
const LazyViewer = lazy(() => import('./MarkdownImpl').then((module) => ({ default: module.Viewer })));

const PLACEHOLDER = 'Write in markdown. Words like #idea become tags automatically.';

// While the editor bundle downloads, a plain textarea keeps the form usable.
export function MarkdownEditor({ value, onChange, height, ...textareaProps }) {
  return (
    <Suspense
      fallback={
        <textarea
          {...textareaProps}
          className="input input--textarea"
          rows={10}
          value={value}
          placeholder={PLACEHOLDER}
          onChange={(event) => onChange(event.target.value)}
        />
      }
    >
      <LazyEditor
        value={value}
        onChange={onChange}
        height={height}
        textareaProps={{ ...textareaProps, placeholder: PLACEHOLDER }}
      />
    </Suspense>
  );
}

export function MarkdownViewer({ source }) {
  return (
    <Suspense fallback={<p className="pre-wrap">{source}</p>}>
      <LazyViewer source={source} />
    </Suspense>
  );
}
