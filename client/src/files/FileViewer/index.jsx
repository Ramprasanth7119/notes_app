import React, { useState } from 'react';
import { Modal, Button, Spinner } from 'react-bootstrap';
import { BsX, BsDownload } from 'react-icons/bs';
import axios from 'axios';

const API_URL = 'https://notes-cw4m.onrender.com';

const FileViewer = ({ file, onClose }) => {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const getFileUrl = (filePath) => {
        if (!filePath) return '';
        const filename = filePath.split(/[\/\\]/).pop();
        return `${API_URL}/api/notes/files/${filename}`;
    };

    const handleDownload = async () => {
        try {
            setLoading(true);
            const fileUrl = getFileUrl(file.path);
            const response = await fetch(fileUrl);
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const blob = await response.blob();
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
    };

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
                {error ? (
                    <div className="error-message text-center">
                        <p>{error}</p>
                        <Button variant="primary" onClick={handleDownload}>
                            Try Download Instead
                        </Button>
                    </div>
                ) : (
                    file.type.startsWith('image/') ? (
                        <img
                            src={getFileUrl(file.path)}
                            alt={file.filename}
                            className="img-fluid"
                            onLoad={() => setLoading(false)}
                            onError={() => {
                                setLoading(false);
                                setError('Failed to load image');
                            }}
                        />
                    ) : (
                        <div className="text-center p-4">
                            <p>File type: {file.type || 'Unknown'}</p>
                            <Button variant="primary" onClick={handleDownload}>
                                <BsDownload className="me-2" />
                                Download File
                            </Button>
                        </div>
                    )
                )}
            </Modal.Body>
        </Modal>
    );
};

export default FileViewer;