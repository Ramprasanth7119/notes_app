// src/components/NoteCard.jsx
import React, { useState } from 'react';
import { Card, Dropdown } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { BsThreeDotsVertical, BsTrash, BsPinFill } from 'react-icons/bs';
import moment from 'moment';
import axios from 'axios';

const NoteCard = ({ note, onDeleteNote }) => {
  const navigate = useNavigate();
  const [showMenu, setShowMenu] = useState(false);

  const handleCardClick = (e) => {
    e.preventDefault();
    if (note && note._id) {
      navigate(`/notes/${note._id}`);
    }
  };

  const handleDelete = async (e) => {
    e.stopPropagation(); // Prevent card click
    if (window.confirm('Are you sure you want to delete this note?')) {
      try {
        await axios.delete(`https://notes-cw4m.onrender.com/api/notes/${note._id}`);
        onDeleteNote(note._id);
      } catch (error) {
        console.error('Error deleting note:', error);
      }
    }
  };

  return (
    <motion.div
      whileHover={{ y: -5 }}
      onHoverStart={() => setShowMenu(true)}
      onHoverEnd={() => setShowMenu(false)}
    >
      <Card className="note-card" onClick={handleCardClick}>
        <Card.Header className="d-flex justify-content-between align-items-center border-0 bg-transparent">
          <div>
            {note.pinned && <BsPinFill className="text-warning" />}
          </div>
          <Dropdown 
            onClick={(e) => e.stopPropagation()}
            className={`three-dots ${showMenu ? 'visible' : 'invisible'}`}
          >
            <Dropdown.Toggle as="div" className="custom-toggle">
              <BsThreeDotsVertical />
            </Dropdown.Toggle>
            <Dropdown.Menu align="end">
              <Dropdown.Item 
                className="text-danger"
                onClick={handleDelete}
              >
                <BsTrash className="me-2" /> Delete Note
              </Dropdown.Item>
            </Dropdown.Menu>
          </Dropdown>
        </Card.Header>

        <Card.Body>
          <Card.Title>{note.title}</Card.Title>
          <Card.Text className="text-muted">
            {note.content?.slice(0, 100)}...
          </Card.Text>
          {note.tags?.length > 0 && (
            <div className="mb-2">
              {note.tags.map(tag => (
                <span key={tag} className="badge bg-light text-secondary me-1">
                  #{tag}
                </span>
              ))}
            </div>
          )}
        </Card.Body>

        <Card.Footer className="bg-transparent border-top-0">
          <small className="text-muted">
            Last updated {moment(note.updatedAt).fromNow()}
          </small>
        </Card.Footer>
      </Card>
    </motion.div>
  );
};

export default NoteCard;
