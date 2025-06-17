import React, { useState, useEffect } from 'react';
import { Modal, Button, Spinner } from 'react-bootstrap';
import { Document, Page, pdfjs } from 'react-pdf';
import { BsX, BsDownload, BsZoomIn, BsZoomOut } from 'react-icons/bs';
import axios from 'axios';

pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;

const FileViewer = ({ file, onClose }) => {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [numPages, setNumPages] = useState(null);
    const [pageNumber, setPageNumber] = useState(1);
    const [zoom, setZoom] = useState(1);

    const fileUrl = `https://notes-cw4m.onrender.com/api/notes/files/${file.path.split('/').pop()}`;

    const handleDownload = async () => {
        try {
            const response = await axios.get(fileUrl, {
                responseType: 'blob'
            });
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', file.filename);
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url);
        } catch (error) {
            console.error('Download error:', error);
            setError('Failed to download file');
        }
    };

    const renderContent = () => {
        if (error) {
            return <div className="error-message">{error}</div>;
        }

        if (file.type.startsWith('image/')) {
            return (
                <img
                    src={fileUrl}
                    alt={file.filename}
                    className="img-preview"
                    onLoad={() => setLoading(false)}
                    onError={() => {
                        setLoading(false);
                        setError('Failed to load image');
                    }}
                />
            );
        }

        if (file.type === 'application/pdf') {
            return (
                <div className="pdf-container" style={{ transform: `scale(${zoom})` }}>
                    <Document
                        file={fileUrl}
                        onLoadSuccess={({ numPages }) => {
                            setNumPages(numPages);
                            setLoading(false);
                        }}
                        onLoadError={(error) => {
                            console.error('PDF load error:', error);
                            setLoading(false);
                            setError('Failed to load PDF');
                        }}
                        loading={<Spinner animation="border" />}
                    >
                        <Page pageNumber={pageNumber} />
                    </Document>
                </div>
            );
        }

        return <div className="unsupported-file">This file type cannot be previewed</div>;
    };

    return (
        <Modal show={true} onHide={onClose} size="lg" centered className="file-viewer-modal">
            <Modal.Header>
                <Modal.Title>{file.filename}</Modal.Title>
                <div className="modal-actions">
                    <Button
                        variant="outline-primary"
                        onClick={handleDownload}
                        className="me-2"
                    >
                        <BsDownload /> Download
                    </Button>
                    {file.type === 'application/pdf' && (
                        <div className="zoom-controls me-2">
                            <Button
                                variant="outline-secondary"
                                onClick={() => setZoom(prev => Math.max(prev - 0.2, 0.5))}
                            >
                                <BsZoomOut />
                            </Button>
                            <Button
                                variant="outline-secondary"
                                onClick={() => setZoom(prev => Math.min(prev + 0.2, 2))}
                            >
                                <BsZoomIn />
                            </Button>
                        </div>
                    )}
                    <Button variant="outline-danger" onClick={onClose}>
                        <BsX size={24} />
                    </Button>
                </div>
            </Modal.Header>
            <Modal.Body>
                {loading && (
                    <div className="loading-spinner">
                        <Spinner animation="border" />
                    </div>
                )}
                {renderContent()}
            </Modal.Body>
        </Modal>
    );
};

export default FileViewer;