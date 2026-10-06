import http from './http';

export const listCollections = () => http.get('/collections').then((res) => res.data);
export const getCollection = (id) => http.get(`/collections/${id}`).then((res) => res.data);
export const createCollection = (collection) => http.post('/collections', collection).then((res) => res.data);
export const updateCollection = (id, changes) => http.put(`/collections/${id}`, changes).then((res) => res.data);
export const deleteCollection = (id) => http.delete(`/collections/${id}`);
export const addNoteToCollection = (id, noteId) =>
  http.post(`/collections/${id}/notes`, { noteId }).then((res) => res.data);
export const removeNoteFromCollection = (id, noteId) =>
  http.delete(`/collections/${id}/notes/${noteId}`).then((res) => res.data);
