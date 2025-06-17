import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, Button, Row, Col, Badge, ButtonGroup, Form } from 'react-bootstrap';
import { motion } from 'framer-motion';
import { BsPinAngleFill, BsTrash, BsPencilSquare, BsCheck2, BsX, BsCloudUpload, BsPaperclip, BsArrowLeft } from 'react-icons/bs';
import MDEditor from '@uiw/react-md-editor';
import axios from 'axios';
import moment from 'moment';

import '@uiw/react-md-editor/markdown-editor.css';
import AttachmentPreview from '../components/AttachmentPreview';

const NoteView = ({ noteId: propNoteId, onBack }) => {
  const { id: paramId } = useParams();
  const navigate = useNavigate();
  const [note, setNote] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editedNote, setEditedNote] = useState(null);
  const fileInputRef = useRef(null);
  const [tempFiles, setTempFiles] = useState([]);
  const [uploadProgress, setUploadProgress] = useState({});

  const id = propNoteId || paramId;

  useEffect(() => {
    const fetchNote = async () => {
      if (!id) {
        setError('No note ID provided');
        setLoading(false);
        return;
      }

      try {
        const response = await axios.get(`https://notes-cw4m.onrender.com/api/notes/${id}`);
        if (response.data) {
          setNote(response.data);
          setEditedNote(response.data);
          setError(null);
        } else {
          setError('Note not found');
        }
      } catch (error) {
        console.error('Error fetching note:', error);
        setError('Failed to fetch note');
      } finally {
        setLoading(false);
      }
    };

    fetchNote();
  }, [id]);

  const handleEdit = () => {
    setIsEditing(true);
  };

  const handleSave = async () => {
    try {
      const response = await axios.put(`https://notes-cw4m.onrender.com/api/notes/${id}`, editedNote);
      setNote(response.data);
      setIsEditing(false);
    } catch (error) {
      console.error('Error updating note:', error);
    }
  };

  const handleCancel = () => {
    setEditedNote(note);
    setIsEditing(false);
  };

  const handleDelete = async () => {
    if (window.confirm('Are you sure you want to delete this note? This action cannot be undone.')) {
      try {
        await axios.delete(`https://notes-cw4m.onrender.com/api/notes/${id}`);
        navigate('/');
      } catch (error) {
        console.error('Error deleting note:', error);
      }
    }
  };

  const handleFileUpload = async (e) => {
    const files = Array.from(e.target.files);
    
    // Show temporary previews immediately
    const newTempFiles = files.map(file => ({
      id: Date.now() + Math.random(),
      file,
      preview: file.type.startsWith('image/') ? URL.createObjectURL(file) : null,
      name: file.name,
      type: file.type
    }));
    
    setTempFiles(prev => [...prev, ...newTempFiles]);

    for (const file of files) {
      const formData = new FormData();
      formData.append('media', file);

      try {
        const response = await axios.post(
          `https://notes-cw4m.onrender.com/api/notes/${id}/upload`,
          formData,
          {
            headers: { 'Content-Type': 'multipart/form-data' },
            onUploadProgress: (progressEvent) => {
              const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total);
              setUploadProgress(prev => ({
                ...prev,
                [file.name]: progress
              }));
            },
          }
        );

        // Remove temp preview and add actual file
        setTempFiles(prev => prev.filter(f => f.file !== file));
        setEditedNote(prev => ({
          ...prev,
          mediaFiles: [...prev.mediaFiles, response.data]
        }));
        
        // Clean up the URL object
        URL.revokeObjectURL(newTempFiles.find(f => f.file === file)?.preview);
      } catch (error) {
        console.error('Upload error:', error);
      }
    }
  };

  const handleRemoveFile = async (fileId) => {
    try {
      await axios.delete(`https://notes-cw4m.onrender.com/api/notes/${id}/files/${fileId}`);
      setEditedNote(prev => ({
        ...prev,
        mediaFiles: prev.mediaFiles.filter(file => file._id !== fileId)
      }));
    } catch (error) {
      console.error('Error removing file:', error);
    }
  };

  const handleFileDelete = async (fileId) => {
    try {
      await axios.delete(`https://notes-cw4m.onrender.com/api/notes/${note._id}/files/${fileId}`);
      setNote(prev => ({
        ...prev,
        mediaFiles: prev.mediaFiles.filter(file => file._id !== fileId)
      }));
    } catch (error) {
      console.error('Error deleting file:', error);
    }
  };

  // Add back button if onBack prop is provided
  const renderHeader = () => (
    <div className="d-flex justify-content-between align-items-center mb-4">
      {onBack && (
        <Button variant="link" className="p-0" onClick={onBack}>
          <BsArrowLeft /> Back to Collection
        </Button>
      )}
      <h2>{note?.title}</h2>
    </div>
  );

  const renderFilePreview = (file, isTemp = false) => (
    <Col 
      // Add unique key to the Col component
      key={isTemp ? `temp-${file.id}` : `file-${file._id}`}
      xs={12} 
      md={6} 
      lg={4}
    >
      <div className="file-preview-card">
        {isTemp ? (
          <>
            {file.preview ? (
              <img
                src={file.preview}
                alt={file.name}
                className="preview-thumbnail"
              />
            ) : (
              <div className="file-icon">
                📄 {file.name}
              </div>
            )}
            <div className="upload-progress">
              <div 
                className="progress-bar"
                style={{ width: `${uploadProgress[file.name] || 0}%` }}
              >
                {uploadProgress[file.name] || 0}%
              </div>
            </div>
          </>
        ) : (
          <>
            {file.type.startsWith('image/') ? (
              <img
                src={`https://notes-cw4m.onrender.com/${file.path}`}
                alt={file.filename}
                className="preview-thumbnail"
              />
            ) : (
              <div className="file-icon">
                📄 {file.filename}
              </div>
            )}
            {isEditing && (
              <Button
                variant="outline-danger"
                size="sm"
                className="remove-btn"
                onClick={() => handleRemoveFile(file._id)}
              >
                <BsTrash />
              </Button>
            )}
          </>
        )}
      </div>
    </Col>
  );

  if (loading) {
    return (
      <div className="text-center p-5">
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="alert alert-danger" role="alert">
        {error}
      </div>
    );
  }

  if (!note) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
    >
      <Card className="shadow-sm">
        <Card.Body>
          {renderHeader()}
          <div className="d-flex justify-content-between align-items-center mb-4">
            <h2 className="mb-0">{note.title}</h2>
            <ButtonGroup>
              {isEditing ? (
                <>
                  <Button variant="success" onClick={handleSave}>
                    <BsCheck2 /> Save
                  </Button>
                  <Button variant="outline-secondary" onClick={handleCancel}>
                    <BsX /> Cancel
                  </Button>
                </>
              ) : (
                <>
                  <Button 
                    variant="outline-primary" 
                    onClick={handleEdit}
                    className="d-flex align-items-center gap-2"
                  >
                    <BsPencilSquare /> Edit
                  </Button>
                  <Button 
                    variant="outline-danger" 
                    onClick={handleDelete}
                    className="d-flex align-items-center gap-2"
                  >
                    <BsTrash /> Delete
                  </Button>
                </>
              )}
            </ButtonGroup>
          </div>

          {isEditing ? (
            <MDEditor
              value={editedNote.content}
              onChange={(value) => setEditedNote({ ...editedNote, content: value })}
              preview="live"
              height={400}
            />
          ) : (
            <div className="note-content">
              <MDEditor.Markdown 
                source={note.content} 
                className="content-preview"
              />
            </div>
          )}

          {isEditing && (
            <div className="file-upload-section mt-4">
              <h5 className="mb-3">
                <BsPaperclip /> Attachments
              </h5>
              
              <Form.Group className="mb-3">
                <div className="d-flex align-items-center gap-2">
                  <Button 
                    variant="outline-primary"
                    onClick={() => fileInputRef.current.click()}
                  >
                    <BsCloudUpload /> Upload Files
                  </Button>
                  <small className="text-muted">
                    Supported formats: Images, PDF, DOC, DOCX, TXT (Max 5MB)
                  </small>
                </div>
                <Form.Control
                  type="file"
                  multiple
                  className="d-none"
                  ref={fileInputRef}
                  onChange={handleFileUpload}
                  accept="image/*,.pdf,.doc,.docx,.txt"
                />
              </Form.Group>

              <div className="attached-files mt-3">
                <Row xs={1} md={2} lg={3} className="g-3">
                  {tempFiles.map(file => renderFilePreview(file, true))}
                  {editedNote.mediaFiles?.map(file => renderFilePreview(file, false))}
                </Row>
              </div>
            </div>
          )}

          {note.mediaFiles?.length > 0 && !isEditing && (
            <div className="mt-4">
              <h6>Attachments</h6>
              <Row xs={1} md={2} lg={3} className="g-3">
                {note.mediaFiles.map((file) => (
                  <Col key={file._id}>
                    <AttachmentPreview 
                      file={file}
                      onDelete={() => handleFileDelete(file._id)}
                      isEditing={isEditing}
                    />
                  </Col>
                ))}
              </Row>
            </div>
          )}

          <div className="mt-4 text-muted">
            <small>
              Created: {moment(note.createdAt).format('MMMM Do YYYY, h:mm a')}
              <br />
              Last updated: {moment(note.updatedAt).format('MMMM Do YYYY, h:mm a')}
            </small>
          </div>
        </Card.Body>
      </Card>
    </motion.div>
  );
};

export default NoteView;