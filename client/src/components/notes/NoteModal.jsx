// src/components/NoteModal.jsx
import React, { useState } from 'react';
import { Modal, Form, Button, Row, Col, InputGroup } from 'react-bootstrap';
import { BsPaperclip, BsTrash, BsFileEarmark, BsLink45Deg, BsPlusCircle } from 'react-icons/bs';
import axios from 'axios';
import MDEditor from '@uiw/react-md-editor';
import { useTheme } from '../../contexts/ThemeContext';

const NoteModal = ({ show, handleClose, handleSubmit, formData, setFormData, editingNoteId }) => {
  const { isDark } = useTheme();
  const [uploadProgress, setUploadProgress] = useState({});
  const [tempFiles, setTempFiles] = useState([]);
  const [newSource, setNewSource] = useState({ title: '', url: '' });

  // Add sources array to formData if it doesn't exist
  if (!formData.sources) {
    setFormData({ ...formData, sources: [] });
  }

  const validateUrl = (url) => {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  };

  const handleAddSource = () => {
    if (newSource.title && newSource.url) {
      if (!validateUrl(newSource.url)) {
        showToast('Please enter a valid URL', 'error');
        return;
      }
      
      setFormData({
        ...formData,
        sources: [...(formData.sources || []), {
          ...newSource,
          url: newSource.url.startsWith('http') ? newSource.url : `https://${newSource.url}`
        }]
      });
      setNewSource({ title: '', url: '' }); // Reset form
    }
  };

  const handleRemoveSource = (index) => {
    const updatedSources = formData.sources.filter((_, i) => i !== index);
    setFormData({ ...formData, sources: updatedSources });
  };

  const handleFileUpload = async (e) => {
    const files = Array.from(e.target.files);
    
    // First show temporary preview
    const newTempFiles = files.map(file => ({
      id: Date.now() + Math.random(),
      file,
      preview: file.type.startsWith('image/') ? URL.createObjectURL(file) : null,
      uploading: true
    }));
    
    setTempFiles(prev => [...prev, ...newTempFiles]);

    for (const file of files) {
      const formData = new FormData();
      formData.append('media', file);

      try {
        const response = await axios.post(
          `https://notes-cw4m.onrender.com/api/notes/${editingNoteId}/upload`,
          formData,
          {
            onUploadProgress: (progressEvent) => {
              const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total);
              setUploadProgress(prev => ({...prev, [file.name]: progress}));
            }
          }
        );

        // Remove temp preview and add actual file
        setTempFiles(prev => prev.filter(f => f.file !== file));
        setFormData(prev => ({
          ...prev,
          mediaFiles: [...(prev.mediaFiles || []), response.data]
        }));
      } catch (error) {
        console.error('Upload error:', error);
      }
    }
  };

  const renderFilePreview = (file, isTemp = false) => (
    <Col xs={6} md={4} lg={3} key={file.id || file._id}>
      <div className="file-preview-card">
        {isTemp ? (
          <>
            {file.preview ? (
              <img src={file.preview} alt="preview" className="preview-image" />
            ) : (
              <BsFileEarmark size={24} />
            )}
            <div className="progress mt-2">
              <div 
                className="progress-bar" 
                style={{width: `${uploadProgress[file.file.name] || 0}%`}}
              />
            </div>
          </>
        ) : (
          <>
            {file.type.startsWith('image/') ? (
              <img 
                src={`https://notes-cw4m.onrender.com/${file.path}`} 
                alt={file.filename} 
                className="preview-image"
              />
            ) : (
              <BsFileEarmark size={24} />
            )}
            <Button
              variant="outline-danger"
              size="sm"
              className="remove-btn"
              onClick={() => handleRemoveFile(file._id)}
            >
              <BsTrash />
            </Button>
          </>
        )}
        <small className="filename">{isTemp ? file.file.name : file.filename}</small>
      </div>
    </Col>
  );

  return (
    <Modal show={show} onHide={handleClose} size="lg">
      <Modal.Header closeButton>
        <Modal.Title>{editingNoteId ? 'Edit Note' : 'Create Note'}</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <Form onSubmit={handleSubmit}>
          <Form.Group className="mb-2">
            <Form.Label>Date</Form.Label>
            <Form.Control
              type="date"
              required
              value={formData.date}
              onChange={e => setFormData({ ...formData, date: e.target.value })}
            />
          </Form.Group>
          <Form.Group className="mb-2">
            <Form.Label>Title</Form.Label>
            <Form.Control
              value={formData.title}
              onChange={e => setFormData({ ...formData, title: e.target.value })}
            />
          </Form.Group>
          <Form.Group className="mb-2">
            <Form.Label>Tags (comma-separated)</Form.Label>
            <Form.Control
              value={formData.tags}
              onChange={e => setFormData({ ...formData, tags: e.target.value })}
            />
          </Form.Group>
          <Form.Group className="mb-2">
            <Form.Label>Content</Form.Label>
            <Form.Control
              as="textarea"
              rows={4}
              value={formData.content}
              onChange={e => setFormData({ ...formData, content: e.target.value })}
            />
          </Form.Group>
          
          <Form.Group className="mb-3 attachment-header">
            <Form.Label>
              <BsPaperclip /> Attachments
            </Form.Label>
            <Form.Control
              type="file"
              multiple
              onChange={handleFileUpload}
              accept="image/*,.pdf,.doc,.docx,.txt"
            />
          </Form.Group>

          <Form.Group className="mb-3">
            <MDEditor
              value={formData.content}
              onChange={(value) => setFormData({ ...formData, content: value })}
              preview="edit"
              height={400}
              data-color-mode={isDark ? 'dark' : 'light'}
              className="md-editor-custom"
            />
          </Form.Group>

          <Form.Group className="mb-4">
            <Form.Label className="d-flex align-items-center gap-2">
              <BsLink45Deg size={20} />
              <span>Reference Sources</span>
            </Form.Label>
            
            <div className="source-input-container p-3 border rounded mb-3">
              <Row className="g-2">
                <Col xs={12} md={5}>
                  <Form.Control
                    placeholder="Source Title"
                    value={newSource.title}
                    onChange={(e) => setNewSource({...newSource, title: e.target.value})}
                    onKeyPress={(e) => e.key === 'Enter' && handleAddSource()}
                  />
                </Col>
                <Col xs={12} md={5}>
                  <Form.Control
                    type="url"
                    placeholder="https://example.com"
                    value={newSource.url}
                    onChange={(e) => setNewSource({...newSource, url: e.target.value})}
                    onKeyPress={(e) => e.key === 'Enter' && handleAddSource()}
                  />
                </Col>
                <Col xs={12} md={2}>
                  <Button 
                    variant="primary" 
                    onClick={handleAddSource}
                    className="w-100"
                    disabled={!newSource.title || !newSource.url}
                  >
                    <BsPlusCircle className="me-1" /> Add
                  </Button>
                </Col>
              </Row>
            </div>

            {/* Sources list */}
            {formData.sources?.length > 0 && (
              <div className="sources-list-container border rounded p-2">
                {formData.sources.map((source, index) => (
                  <div 
                    key={index} 
                    className="source-item d-flex align-items-center gap-2 p-2 border-bottom"
                  >
                    <BsLink45Deg className="text-muted" />
                    <div className="flex-grow-1">
                      <a 
                        href={source.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="source-link"
                        onClick={(e) => {
                          e.preventDefault();
                          window.open(source.url, '_blank');
                        }}
                      >
                        {source.title}
                      </a>
                    </div>
                    <Button
                      variant="link"
                      className="text-danger p-0"
                      onClick={() => handleRemoveSource(index)}
                    >
                      <BsTrash />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </Form.Group>

          {(tempFiles.length > 0 || formData.mediaFiles?.length > 0) && (
            <div className="attached-files mt-3">
              <h6>Attached Files:</h6>
              <Row className="g-2">
                {tempFiles.map(file => renderFilePreview(file, true))}
                {formData.mediaFiles?.map(file => renderFilePreview(file))}
              </Row>
            </div>
          )}

          <div className="d-flex justify-content-end gap-2 mt-3">
            <Button variant="secondary" onClick={handleClose}>
              Cancel
            </Button>
            <Button variant="primary" type="submit">
              {editingNoteId ? 'Update' : 'Create'}
            </Button>
          </div>
        </Form>
      </Modal.Body>
    </Modal>
  );
};

export default NoteModal;
