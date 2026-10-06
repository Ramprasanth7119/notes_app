import MDEditor from '@uiw/react-md-editor';
import rehypeSanitize from 'rehype-sanitize';
import '@uiw/react-md-editor/markdown-editor.css';

// Loaded lazily (see Markdown.jsx) because the editor is the largest
// dependency in the app. Rendered HTML is sanitised so markdown cannot inject
// scripts or event handlers.
const sanitize = [[rehypeSanitize]];

export function Editor({ value, onChange, height = 320, textareaProps }) {
  return (
    <MDEditor
      value={value}
      onChange={(next) => onChange(next ?? '')}
      height={height}
      preview="edit"
      visibleDragbar={false}
      previewOptions={{ rehypePlugins: sanitize }}
      textareaProps={textareaProps}
    />
  );
}

export function Viewer({ source }) {
  return <MDEditor.Markdown source={source} rehypePlugins={sanitize} className="markdown" />;
}
