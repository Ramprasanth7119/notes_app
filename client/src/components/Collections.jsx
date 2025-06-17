import React, { useState, useEffect } from 'react';
import { Card, Button, Modal, Form, Row, Col } from 'react-bootstrap';
import { motion } from 'framer-motion';
import { BsFolder, BsFolderPlus, BsThreeDotsVertical, BsArrowLeft } from 'react-icons/bs';
import NoteView from '../pages/NoteView';
import axios from 'axios';

const Collections = () => {
  const [collections, setCollections] = useState([]);
  const [showNewModal, setShowNewModal] = useState(false);
  const [showAddNoteModal, setShowAddNoteModal] = useState(false);
  const [selectedCollection, setSelectedCollection] = useState(null);
  const [selectedNote, setSelectedNote] = useState(null);
  const [allNotes, setAllNotes] = useState([]);
  const [newCollection, setNewCollection] = useState({
    name: '',
    description: ''
  });

  useEffect(() => {
    fetchCollections();
    fetchNotesForCollection();
  }, []);

  const fetchCollections = async () => {
    try {
      const response = await axios.get('https://notes-cw4m.onrender.com/api/collections');
      setCollections(response.data);
    } catch (error) {
      console.error('Error fetching collections:', error);
    }
  };

  const fetchNotesForCollection = async () => {
    try {
      const response = await axios.get('https://notes-cw4m.onrender.com/api/notes');
      setAllNotes(response.data.data);
    } catch (error) {
      console.error('Error fetching notes:', error);
    }
  };

  const handleCreateCollection = async (e) => {
    e.preventDefault();
    try {
      await axios.post('https://notes-cw4m.onrender.com/api/collections', newCollection);
      setShowNewModal(false);
      setNewCollection({ name: '', description: '' });
      fetchCollections();
    } catch (error) {
      console.error('Error creating collection:', error);
    }
  };

  const handleAddNoteToCollection = async (noteId) => {
    try {
      await axios.post(`https://notes-cw4m.onrender.com/api/collections/${selectedCollection._id}/notes`, {
        noteId
      });
      
      // Update local state immediately
      setCollections(collections.map(collection => {
        if (collection._id === selectedCollection._id) {
          return {
            ...collection,
            notes: [...collection.notes, allNotes.find(note => note._id === noteId)]
          };
        }
        return collection;
      }));
      
      setSelectedCollection(prev => ({
        ...prev,
        notes: [...prev.notes, allNotes.find(note => note._id === noteId)]
      }));
      
    } catch (error) {
      console.error('Error adding note to collection:', error);
    }
  };

  // Filter out already added notes
  const getAvailableNotes = () => {
    if (!selectedCollection) return [];
    const addedNoteIds = selectedCollection.notes.map(note => note._id);
    return allNotes.filter(note => !addedNoteIds.includes(note._id));
  };

  const handleCollectionClick = (collection) => {
    setSelectedCollection(collection);
  };

  const handleBackToCollections = () => {
    setSelectedCollection(null);
    setSelectedNote(null);
  };

  const handleNoteClick = (note) => {
    setSelectedNote(note);
  };

  return (
    <div className="collections-container">
      {!selectedCollection ? (
        // Collections List View
        <>
          <div className="d-flex justify-content-between align-items-center mb-4">
            <h2>Collections</h2>
            <Button onClick={() => setShowNewModal(true)}>
              <BsFolderPlus /> New Collection
            </Button>
          </div>

          <Row xs={1} md={2} lg={3} className="g-4">
            {collections.map(collection => (
              <Col key={collection._id}>
                <motion.div 
                  whileHover={{ y: -5 }}
                  onClick={() => handleCollectionClick(collection)}
                >
                  <Card className="collection-card">
                    <Card.Body>
                      <div className="d-flex justify-content-between align-items-start">
                        <div className="d-flex align-items-center gap-2">
                          <BsFolder className="folder-icon" />
                          <div>
                            <Card.Title>{collection.name}</Card.Title>
                            <Card.Subtitle className="text-muted">
                              {collection.notes.length} notes
                            </Card.Subtitle>
                          </div>
                        </div>
                        <Button
                          variant="light"
                          size="sm"
                          onClick={() => {
                            setSelectedCollection(collection);
                            setShowAddNoteModal(true);
                          }}
                        >
                          <BsThreeDotsVertical />
                        </Button>
                      </div>
                      <Card.Text className="mt-2">{collection.description}</Card.Text>
                      <small className="text-muted d-block mt-2">
                        Created {new Date(collection.createdAt).toLocaleDateString()}
                      </small>
                    </Card.Body>
                  </Card>
                </motion.div>
              </Col>
            ))}
          </Row>
        </>
      ) : (
        // Collection Detail View
        <>
          <div className="mb-4">
            <Button 
              variant="link" 
              className="p-0 mb-3"
              onClick={handleBackToCollections}
            >
              <BsArrowLeft /> Back to Collections
            </Button>
            <div className="d-flex justify-content-between align-items-center">
              <h3>{selectedCollection.name}</h3>
              <Button 
                variant="outline-primary"
                onClick={() => {
                  setShowAddNoteModal(true);
                }}
              >
                Add Notes
              </Button>
            </div>
            <p className="text-muted">{selectedCollection.description}</p>
          </div>

          {selectedNote ? (
            <NoteView 
              noteId={selectedNote._id}
              onBack={() => setSelectedNote(null)}
            />
          ) : (
            <Row xs={1} md={2} lg={3} className="g-4">
              {selectedCollection.notes.map(note => (
                <Col key={note._id}>
                  <motion.div 
                    whileHover={{ y: -5 }}
                    onClick={() => handleNoteClick(note)}
                  >
                    <Card className="note-card">
                      <Card.Body>
                        <Card.Title>{note.title}</Card.Title>
                        <Card.Text>
                          {note.content.substring(0, 100)}...
                        </Card.Text>
                        <div className="mt-2">
                          {note.tags.map(tag => (
                            <span 
                              key={tag} 
                              className="badge bg-light text-secondary me-1"
                            >
                              #{tag}
                            </span>
                          ))}
                        </div>
                      </Card.Body>
                    </Card>
                  </motion.div>
                </Col>
              ))}
            </Row>
          )}
        </>
      )}

      {/* New Collection Modal */}
      <Modal show={showNewModal} onHide={() => setShowNewModal(false)}>
        <Modal.Header closeButton>
          <Modal.Title>Create New Collection</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form onSubmit={handleCreateCollection}>
            <Form.Group className="mb-3">
              <Form.Label>Name</Form.Label>
              <Form.Control
                type="text"
                value={newCollection.name}
                onChange={(e) => setNewCollection({
                  ...newCollection,
                  name: e.target.value
                })}
                required
              />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Description</Form.Label>
              <Form.Control
                as="textarea"
                rows={3}
                value={newCollection.description}
                onChange={(e) => setNewCollection({
                  ...newCollection,
                  description: e.target.value
                })}
              />
            </Form.Group>
            <Button type="submit">Create Collection</Button>
          </Form>
        </Modal.Body>
      </Modal>

      {/* Add Note to Collection Modal */}
      <Modal show={showAddNoteModal} onHide={() => setShowAddNoteModal(false)}>
        <Modal.Header closeButton>
          <Modal.Title>Add Notes to {selectedCollection?.name}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {getAvailableNotes().length === 0 ? (
            <p className="text-muted">All notes have been added to this collection.</p>
          ) : (
            getAvailableNotes().map(note => (
              <div key={note._id} className="note-item p-2 border-bottom">
                <div className="d-flex justify-content-between align-items-center">
                  <div>
                    <h6 className="mb-0">{note.title}</h6>
                    <small className="text-muted">
                      Created: {new Date(note.createdAt).toLocaleDateString()}
                    </small>
                  </div>
                  <Button
                    size="sm"
                    variant="primary"
                    onClick={() => handleAddNoteToCollection(note._id)}
                  >
                    Add to Collection
                  </Button>
                </div>
              </div>
            ))
          )}
        </Modal.Body>
      </Modal>
    </div>
  );
};

export default Collections;