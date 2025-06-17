import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Button } from 'react-bootstrap';
import { BsTrash } from 'react-icons/bs';
import FileViewer from './FileViewer';

const getFileUrl = (path) => {
  const baseUrl = process.env.REACT_APP_API_URL || 'http://localhost:5000';
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

export default AttachmentPreview;