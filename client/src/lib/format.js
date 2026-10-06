const dateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' });
const dateTimeFormat = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' });

export const formatDate = (value) => (value ? dateFormat.format(new Date(value)) : '');
export const formatDateTime = (value) => (value ? dateTimeFormat.format(new Date(value)) : '');

export const pluralize = (count, word) => `${count} ${word}${count === 1 ? '' : 's'}`;

// Plain-text preview of markdown for note cards.
export const excerpt = (markdown = '', length = 160) => {
  const text = markdown
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/^#+\s*/gm, '')
    .replace(/[*_~`>]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return text.length > length ? `${text.slice(0, length).trimEnd()}…` : text;
};

// "react, node js,, ideas" -> ['react', 'node js', 'ideas']
export const parseTags = (input) => input.split(',').map((tag) => tag.trim()).filter(Boolean);
