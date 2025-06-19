import React from 'react';
import { Link } from 'react-router-dom';
import { Navbar, Container, Nav } from 'react-bootstrap';
import { useTheme } from '../../contexts/ThemeContext';
import ThemeToggle from '../common/ThemeToggle';
import Statistics from '../StatsDisplay';

const NavigationBar = ({ showToast }) => {
    const { isDark, toggleTheme } = useTheme();

    return (
        <Navbar 
            bg={isDark ? 'dark' : 'light'} 
            variant={isDark ? 'dark' : 'light'} 
            expand="lg" 
            fixed="top"
            className="navbar-custom"
        >
            <Container>
                <Navbar.Brand as={Link} to="/" className="brand-logo">
                    📝 NoteApp
                </Navbar.Brand>
                <Navbar.Toggle aria-controls="basic-navbar-nav" />
                <Navbar.Collapse id="basic-navbar-nav">
                    <Nav className="me-auto">
                        <Nav.Link as={Link} to="/" className="nav-link-custom">
                            Home
                        </Nav.Link>
                        <Nav.Link as={Link} to="/collections" className="nav-link-custom">
                            Collections
                        </Nav.Link>
                    </Nav>
                    <Nav className="ms-auto align-items-center">
                        <Statistics showToast={showToast} />
                        <div className="theme-toggle-wrapper">
                            <ThemeToggle isDark={isDark} onToggle={toggleTheme} />
                        </div>
                    </Nav>
                </Navbar.Collapse>
            </Container>
        </Navbar>
    );
};

export default NavigationBar;