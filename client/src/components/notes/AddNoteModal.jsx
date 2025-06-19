import React, { useState } from 'react';
import { Modal, Form, Button } from 'react-bootstrap';
import MDEditor from '@uiw/react-md-editor';
import axios from 'axios';

const AddNoteModal = ({ show, handleClose, refreshNotes }) => {
  const [formData, setFormData] = useState({
    title: '',
    content: '',
    tags: []
  });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const today = new Date();
      const payload = {
        ...formData,
        date: today.toISOString().split('T')[0],
        month: today.toLocaleString('default', { month: 'long' })
      };
      await axios.post('https://notes-cw4m.onrender.com/api/notes', payload);
      refreshNotes();
      handleClose();
      setFormData({ title: '', content: '', tags: [] });
    } catch (error) {
      console.error('Error creating note:', error);
    }
    setSaving(false);
  };

  return (
    <Modal show={show} onHide={handleClose} size="lg">
      <Modal.Header closeButton>
        <Modal.Title>Create New Note</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <Form onSubmit={handleSubmit}>
          <Form.Group className="mb-3">
            <Form.Label>Title</Form.Label>
            <Form.Control
              type="text"
              value={formData.title}
              onChange={(e) => setFormData({...formData, title: e.target.value})}
              placeholder="Enter note title"
              required
            />
          </Form.Group>

          <Form.Group className="mb-3">
            <Form.Label>Content</Form.Label>
            <MDEditor
              value={formData.content}
              onChange={(value) => setFormData({...formData, content: value || ''})}
              preview="live"
              height={300}
            />
          </Form.Group>

          <Form.Group className="mb-3">
            <Form.Label>Tags (comma-separated)</Form.Label>
            <Form.Control
              type="text"
              placeholder="tag1, tag2, tag3"
              onChange={(e) => setFormData({
                ...formData,
                tags: e.target.value.split(',').map(tag => tag.trim())
              })}
            />
          </Form.Group>

          <div className="d-flex justify-content-end gap-2">
            <Button variant="secondary" onClick={handleClose}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" disabled={saving}>
              {saving ? 'Creating...' : 'Create Note'}
            </Button>
          </div>
        </Form>
      </Modal.Body>
    </Modal>
  );
};

export default AddNoteModal;