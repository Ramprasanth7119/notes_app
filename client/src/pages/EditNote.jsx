import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Form, Button, Card } from 'react-bootstrap';
import axios from 'axios';

const EditNote = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [note, setNote] = useState(null);
  const [formData, setFormData] = useState({
    title: '',
    content: '',
    tags: []
  });

  useEffect(() => {
    const fetchNote = async () => {
      try {
        const response = await axios.get(`https://notes-cw4m.onrender.com/api/notes/${id}`);
        const noteData = response.data;
        setNote(noteData);
        setFormData({
          title: noteData.title,
          content: noteData.content,
          tags: noteData.tags
        });
      } catch (error) {
        console.error('Error fetching note:', error);
      }
    };
    fetchNote();
  }, [id]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await axios.put(`https://notes-cw4m.onrender.com/api/notes/${id}`, formData);
      navigate(`/notes/${note.date}`);
    } catch (error) {
      console.error('Error updating note:', error);
    }
  };

  if (!note) return <div>Loading...</div>;

  return (
    <Card>
      <Card.Body>
        <Form onSubmit={handleSubmit}>
          <Form.Group className="mb-3">
            <Form.Label>Title</Form.Label>
            <Form.Control
              type="text"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            />
          </Form.Group>

          <Form.Group className="mb-3">
            <Form.Label>Content</Form.Label>
            <Form.Control
              as="textarea"
              rows={10}
              value={formData.content}
              onChange={(e) => setFormData({ ...formData, content: e.target.value })}
            />
          </Form.Group>

          <Form.Group className="mb-3">
            <Form.Label>Tags (comma-separated)</Form.Label>
            <Form.Control
              type="text"
              value={formData.tags.join(', ')}
              onChange={(e) => setFormData({ 
                ...formData, 
                tags: e.target.value.split(',').map(tag => tag.trim())
              })}
            />
          </Form.Group>

          <div className="d-flex gap-2">
            <Button variant="primary" type="submit">
              Save Changes
            </Button>
            <Button variant="secondary" onClick={() => navigate(`/notes/${note.date}`)}>
              Cancel
            </Button>
          </div>
        </Form>
      </Card.Body>
    </Card>
  );
};

export default EditNote;