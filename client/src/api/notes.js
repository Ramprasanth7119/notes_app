import http, { API_BASE_URL } from './http';

// Server-side search: text, tag and collection filters plus pagination are
// all evaluated by MongoDB. Returns { results, page, limit, total, totalPages }.
export const searchNotes = ({ q, tag, collection, page, limit }, { signal } = {}) =>
  http
    .get('/notes/search', {
      params: { q: q || undefined, tag: tag || undefined, collection: collection || undefined, page, limit },
      signal
    })
    .then((res) => res.data);

export const getNote = (id) => http.get(`/notes/${id}`).then((res) => res.data);
export const createNote = (note) => http.post('/notes', note).then((res) => res.data.data);
export const updateNote = (id, changes) => http.put(`/notes/${id}`, changes).then((res) => res.data);
export const deleteNote = (id) => http.delete(`/notes/${id}`);
export const togglePin = (id) => http.patch(`/notes/${id}/pin`).then((res) => res.data);
export const getStats = () => http.get('/notes/stats').then((res) => res.data);

export const uploadAttachment = (noteId, file, onProgress) => {
  const form = new FormData();
  form.append('media', file);
  return http
    .post(`/notes/${noteId}/upload`, form, {
      onUploadProgress: (event) => event.total && onProgress?.(Math.round((event.loaded * 100) / event.total))
    })
    .then((res) => res.data);
};

export const deleteAttachment = (noteId, fileId) => http.delete(`/notes/${noteId}/files/${fileId}`);

// Used directly as <img src> / <a href>: the browser sends the auth cookie,
// and the server checks that the note belongs to the signed-in user.
export const attachmentUrl = (noteId, fileId) => `${API_BASE_URL}/notes/${noteId}/files/${fileId}`;
