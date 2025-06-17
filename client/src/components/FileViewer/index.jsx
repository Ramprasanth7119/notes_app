import React, { useState, useCallback } from 'react';
import { Modal, Button, Spinner } from 'react-bootstrap';
import { BsX, BsDownload } from 'react-icons/bs';
import axios from 'axios';

const API_URL = 'https://notes-cw4m.onrender.com';

const FileViewer = ({ file, onClose }) => {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [fileContent, setFileContent] = useState(null);

    const getFileUrl = useCallback((filePath) => {
        if (!filePath) return '';
        const filename = filePath.split(/[\/\\]/).pop();
        return `${API_URL}/api/notes/files/${filename}`;
    }, []);

    const handleDownload = useCallback(async () => {
        try {
            setLoading(true);
            const response = await axios.get(getFileUrl(file.path), {
                responseType: 'blob'
            });

            const blob = new Blob([response.data], { type: response.headers['content-type'] });
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = file.filename;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(url);
        } catch (err) {
            console.error('Download error:', err);
            setError('Failed to download file');
        } finally {
            setLoading(false);
        }
    }, [file, getFileUrl]);

    const FileContent = useCallback(() => {
        if (error) {
            return (
                <div className="error-container">
                    <div className="error-message">{error}</div>
                    <Button variant="primary" onClick={handleDownload}>
                        Try Download Instead
                    </Button>
                </div>
            );
        }

        const fileUrl = getFileUrl(file.path);

        if (!fileUrl) {
            return <div className="error-message">Invalid file path</div>;
        }

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

        return (
            <div className="file-info">
                <p>File type: {file.type || 'Unknown'}</p>
                <p>Filename: {file.filename}</p>
                <Button variant="primary" onClick={handleDownload}>
                    <BsDownload className="me-2" />
                    Download File
                </Button>
            </div>
        );
    }, [error, file, getFileUrl, handleDownload]);

    return (
        <Modal 
            show={true} 
            onHide={onClose} 
            size="lg" 
            centered
            className="file-viewer-modal"
        >
            <Modal.Header>
                <Modal.Title>{file.filename}</Modal.Title>
                <Button 
                    variant="outline-secondary" 
                    onClick={onClose}
                    className="close-button"
                >
                    <BsX size={20} />
                </Button>
            </Modal.Header>
            <Modal.Body>
                {loading && (
                    <div className="loading-container">
                        <Spinner animation="border" />
                    </div>
                )}
                <FileContent />
            </Modal.Body>
        </Modal>
    );
};

export default FileViewer;