// Mirrors the server's upload rules (server/middleware/upload.js) so users get
// instant feedback. The server still enforces them.
export const MAX_FILE_SIZE = 5 * 1024 * 1024;
export const ACCEPTED_FILES = '.png,.jpg,.jpeg,.gif,.webp,.pdf,.txt,.doc,.docx';
const ACCEPTED_EXTENSIONS = ACCEPTED_FILES.split(',');

export const checkFile = (file) => {
  const extension = `.${file.name.split('.').pop().toLowerCase()}`;
  if (!ACCEPTED_EXTENSIONS.includes(extension)) {
    return `${file.name}: only images, PDF, TXT, DOC and DOCX files can be attached`;
  }
  if (file.size > MAX_FILE_SIZE) {
    return `${file.name}: files must be at most 5 MB`;
  }
  return null;
};

// mediaFiles[].type is the first half of the MIME type ("image", "application", ...)
export const isImage = (file) => file.type === 'image';
