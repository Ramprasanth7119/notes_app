import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Button } from 'react-bootstrap';
import { BsTrash } from 'react-icons/bs';
import FileViewer from './FileViewer';
import axios from 'axios';

const getFileUrl = (path) => {
  // const baseUrl = process.env.REACT_APP_API_URL || 'http://localhost:5000';
    const baseUrl = 'https://notes-cw4m.onrender.com';
  return `${baseUrl}/uploads${path}`;
};

const AttachmentPreview = ({ file, onDelete, isEditing }) => {
  const [showPreview, setShowPreview] = useState(false);

  const handleDelete = (e) => {
    e.stopPropagation(); // Prevent opening preview when clicking delete
    if (window.confirm('Are you sure you want to delete this file?')) {
      onDelete();
    }
  };

  return (
    <>
      <motion.div
        whileHover={{ scale: 1.02 }}
        className="attachment-preview"
      >
        <div 
          className="preview-content"
          onClick={() => setShowPreview(true)}
        >
          {file.type.startsWith('image/') ? (
            <img
              src={getFileUrl(file.path)}
              alt={file.filename}
              className="preview-thumbnail"
            />
          ) : (
            <div className="file-icon">
              <span className="filename">{file.filename}</span>
            </div>
          )}
        </div>
        
        {isEditing && (
          <Button
            variant="outline-danger"
            size="sm"
            className="delete-btn"
            onClick={handleDelete}
          >
            <BsTrash />
          </Button>
        )}
      </motion.div>

      {showPreview && (
        <FileViewer
          file={file}
          onClose={() => setShowPreview(false)}
        />
      )}
    </>
  );
};

const NoteCard = ({ note, onDeleteNote, showToast }) => {
  const handleDelete = async (e) => {
    e.stopPropagation(); // Prevent card click
    if (window.confirm('Are you sure you want to delete this note?')) {
      try {
        showToast('Deleting note...', 'info');
        await axios.delete(`https://notes-cw4m.onrender.com/api/notes/${note._id}`);
        onDeleteNote(note._id);
        showToast('Note deleted successfully', 'success');
      } catch (error) {
        console.error('Error deleting note:', error);
        showToast('Failed to delete note', 'error');
      }
    }
  };

  return (
    <div className="note-card">
      {/* ...existing note card content... */}
      <Button variant="danger" onClick={handleDelete}>
        Delete Note
      </Button>
    </div>
  );
};

const NoteView = ({ noteId: propNoteId, onBack, showToast }) => {
  // ...existing code...

  const handleFileDelete = async (fileId) => {
    try {
      showToast('Deleting file...', 'info');
      await axios.delete(`https://notes-cw4m.onrender.com/api/notes/${note._id}/files/${fileId}`);
      setNote(prev => ({
        ...prev,
        mediaFiles: prev.mediaFiles.filter(file => file._id !== fileId)
      }));
      showToast('File deleted successfully', 'success');
    } catch (error) {
      console.error('Error deleting file:', error);
      showToast('Failed to delete file', 'error');
    }
  };

  const handleDelete = async () => {
    if (window.confirm('Are you sure you want to delete this note? This action cannot be undone.')) {
      try {
        showToast('Deleting note...', 'info');
        await axios.delete(`https://notes-cw4m.onrender.com/api/notes/${id}`);
        showToast('Note deleted successfully', 'success');
        navigate('/');
      } catch (error) {
        console.error('Error deleting note:', error);
        showToast('Failed to delete note', 'error');
      }
    }
  };

  // ...rest of the component
};

export default AttachmentPreview;