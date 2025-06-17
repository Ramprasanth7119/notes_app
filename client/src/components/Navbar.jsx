import React from 'react';
import { Link } from 'react-router-dom';
import { Navbar, Container, Nav } from 'react-bootstrap';
import { useTheme } from '../contexts/ThemeContext';
import ThemeToggle from './ThemeToggle';
import Statistics from '../components/StatsDisplay';

const NavigationBar = () => {
    const { isDark, toggleTheme } = useTheme();

    return (
        <Navbar 
            bg={isDark ? 'dark' : 'light'} 
            variant={isDark ? 'dark' : 'light'} 
            expand="lg"
        >
            <Container>
                <Navbar.Brand as={Link} to="/">
                    📝 NoteApp
                </Navbar.Brand>
                <Navbar.Toggle aria-controls="basic-navbar-nav" />
                <Navbar.Collapse id="basic-navbar-nav">
                    <Nav className="me-auto">
                        <Nav.Link as={Link} to="/">Home</Nav.Link>
                        <Nav.Link as={Link} to="/collections">Collections</Nav.Link>
                    </Nav>
                    <Nav>
                        <Statistics />
                        <div className="theme-toggle-container">
                            <ThemeToggle isDark={isDark} onToggle={toggleTheme} />
                        </div>
                    </Nav>
                </Navbar.Collapse>
            </Container>
        </Navbar>
    );
};

export default NavigationBar;