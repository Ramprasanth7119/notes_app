import React, { useState, useEffect } from 'react';
import { Row, Col, Button, Dropdown, ButtonGroup } from 'react-bootstrap';
import { motion } from 'framer-motion';
import { BsPlusLg, BsSearch, BsFilter, BsSortDown, BsSortDownAlt } from 'react-icons/bs';
import moment from 'moment';
import axios from 'axios';
import NoteCard from '../components/NoteCard';
import AddNoteModal from '../components/AddNoteModal';
import StatsDisplay from '../components/StatsDisplay'; // Add this import at the top


const Home = () => {
  const [notes, setNotes] = useState([]);
  const [filteredNotes, setFilteredNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCriteria, setFilterCriteria] = useState('all');
  const [sortOrder, setSortOrder] = useState('desc');
  const [sortBy, setSortBy] = useState('updatedAt');

  useEffect(() => {
    fetchNotes();
  }, []);

  const fetchNotes = async () => {
    try {
      const response = await axios.get('https://notes-cw4m.onrender.com/api/notes');
      const sortedNotes = response.data.data.sort((a, b) => {
        if (a.pinned === b.pinned) return new Date(b.date) - new Date(a.date);
        return a.pinned ? -1 : 1;
      });
      setNotes(sortedNotes);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching notes:', error);
      setLoading(false);
    }
  };

  useEffect(() => {
    let filtered = [...notes];

    // Apply search filter
    if (searchTerm) {
      filtered = filtered.filter(note =>
        note.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        note.content.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Apply month/date filter
    if (filterCriteria !== 'all') {
      const currentDate = new Date();
      switch (filterCriteria) {
        case 'today':
          filtered = filtered.filter(note =>
            moment(note.updatedAt).isSame(currentDate, 'day')
          );
          break;
        case 'week':
          filtered = filtered.filter(note =>
            moment(note.updatedAt).isAfter(moment().subtract(1, 'week'))
          );
          break;
        case 'month':
          filtered = filtered.filter(note =>
            moment(note.updatedAt).isSame(currentDate, 'month')
          );
          break;
        default:
          break;
      }
    }

    // Apply sorting
    filtered.sort((a, b) => {
      const dateA = new Date(a[sortBy]);
      const dateB = new Date(b[sortBy]);
      return sortOrder === 'desc' ? dateB - dateA : dateA - dateB;
    });

    setFilteredNotes(filtered);
  }, [notes, searchTerm, filterCriteria, sortOrder, sortBy]);

  const handleDeleteNote = (deletedId) => {
    setNotes(prevNotes => prevNotes.filter(note => note._id !== deletedId));
  };

  const container = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  };

  return (
    <div className="home-container">
      <div className="header-section mb-4">
        <motion.div 
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="d-flex justify-content-between align-items-center"
        >
          <h1 className="app-title">My Notes</h1>
          <Button 
            variant="primary" 
            className="add-note-btn"
            onClick={() => setShowAddModal(true)}
          >
            <BsPlusLg /> New Note
          </Button>
        </motion.div>
        
        <motion.div 
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="search-box mt-3"
        >
          <BsSearch className="search-icon" />
          <input
            type="text"
            placeholder="Search notes..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-input"
          />
        </motion.div>

        <motion.div className="filter-section mt-3 d-flex gap-2">
          <Dropdown as={ButtonGroup}>
            <Button variant="outline-secondary">
              <BsFilter /> Filter
            </Button>
            <Dropdown.Toggle split variant="outline-secondary" />
            <Dropdown.Menu>
              <Dropdown.Item 
                active={filterCriteria === 'all'}
                onClick={() => setFilterCriteria('all')}
              >
                All Notes
              </Dropdown.Item>
              <Dropdown.Item 
                active={filterCriteria === 'today'}
                onClick={() => setFilterCriteria('today')}
              >
                Today
              </Dropdown.Item>
              <Dropdown.Item 
                active={filterCriteria === 'week'}
                onClick={() => setFilterCriteria('week')}
              >
                This Week
              </Dropdown.Item>
              <Dropdown.Item 
                active={filterCriteria === 'month'}
                onClick={() => setFilterCriteria('month')}
              >
                This Month
              </Dropdown.Item>
            </Dropdown.Menu>
          </Dropdown>

          <Dropdown as={ButtonGroup}>
            <Button variant="outline-secondary">
              {sortBy === 'createdAt' ? 'Created' : 'Updated'}
            </Button>
            <Dropdown.Toggle split variant="outline-secondary" />
            <Dropdown.Menu>
              <Dropdown.Item 
                onClick={() => setSortBy('createdAt')}
                active={sortBy === 'createdAt'}
              >
                Creation Date
              </Dropdown.Item>
              <Dropdown.Item 
                onClick={() => setSortBy('updatedAt')}
                active={sortBy === 'updatedAt'}
              >
                Last Modified
              </Dropdown.Item>
            </Dropdown.Menu>
          </Dropdown>

          <Button 
            variant="outline-secondary"
            onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
          >
            {sortOrder === 'desc' ? <BsSortDown /> : <BsSortDownAlt />}
          </Button>
        </motion.div>
      </div>

      {loading ? (
        <div className="text-center">
          <div className="spinner-border text-primary" role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
        </div>
      ) : (
        <>
          <StatsDisplay />
          <motion.div
            variants={container}
            initial="hidden"
            animate="show"
          >
            <Row>
              {filteredNotes.map(note => (
                <Col key={note._id} xs={12} md={6} lg={4} className="mb-4">
                  <NoteCard 
                    note={note}
                    onDeleteNote={handleDeleteNote}
                  />
                </Col>
              ))}
            </Row>
          </motion.div>
        </>
      )}

      <AddNoteModal 
        show={showAddModal} 
        handleClose={() => setShowAddModal(false)}
        refreshNotes={fetchNotes}
      />
    </div>
  );
};

export default Home;
