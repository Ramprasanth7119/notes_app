import React, { useState, useCallback } from 'react';
import { Modal, Button, Spinner } from 'react-bootstrap';
import { BsX, BsDownload } from 'react-icons/bs';
import './FileViewer.css';

const API_URL = 'https://notes-cw4m.onrender.com';

const FileViewer = ({ file, onClose }) => {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // Use useCallback to memoize the function
    const getFileUrl = useCallback((filePath) => {
        const filename = filePath.split('/').pop();
        return `${API_URL}/api/notes/files/${filename}`;
    }, []);

    const handleDownload = useCallback(async () => {
        try {
            const response = await fetch(getFileUrl(file.path));
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = file.filename;
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url);
        } catch (err) {
            setError('Failed to download file');
            console.error('Download error:', err);
        }
    }, [file, getFileUrl]);

    // Move content rendering to a memoized component
    const FileContent = useCallback(() => {
        if (error) {
            return <div className="error-message">{error}</div>;
        }

        const fileUrl = getFileUrl(file.path);

        if (file.type.startsWith('image/')) {
            return (
                <img
                    src={fileUrl}
                    alt={file.filename}
                    className="file-preview-image"
                    onLoad={() => setLoading(false)}
                    onError={() => {
                        setLoading(false);
                        setError('Failed to load image');
                    }}
                />
            );
        }

        // Handle other file types
        return (
            <div className="file-info">
                <p>File type: {file.type}</p>
                <p>Filename: {file.filename}</p>
                <Button variant="primary" onClick={handleDownload}>
                    <BsDownload className="me-2" />
                    Download File
                </Button>
            </div>
        );
    }, [error, file, getFileUrl, handleDownload]);

    return (
        <Modal show={true} onHide={onClose} size="lg" centered>
            <Modal.Header>
                <Modal.Title>{file.filename}</Modal.Title>
                <Button variant="outline-secondary" onClick={onClose}>
                    <BsX size={20} />
                </Button>
            </Modal.Header>
            <Modal.Body>
                {loading && (
                    <div className="text-center p-4">
                        <Spinner animation="border" />
                    </div>
                )}
                <FileContent />
            </Modal.Body>
        </Modal>
    );
};

export default FileViewer;