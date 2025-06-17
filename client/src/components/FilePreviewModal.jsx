import React, { useState } from 'react';
import { Modal, Button } from 'react-bootstrap';
import { BsDownload, BsZoomIn, BsZoomOut } from 'react-icons/bs';

const FilePreviewModal = ({ show, onHide, file }) => {
  const [zoom, setZoom] = useState(1);

  const handleZoomIn = () => setZoom(prev => Math.min(prev + 0.25, 3));
  const handleZoomOut = () => setZoom(prev => Math.max(prev - 0.25, 0.5));

  const renderContent = () => {
    if (!file) return null;

    if (file.type.startsWith('image/')) {
      return (
        <div className="preview-container">
          <div className="zoom-controls">
            <Button variant="light" onClick={handleZoomOut}>
              <BsZoomOut />
            </Button>
            <Button variant="light" onClick={handleZoomIn}>
              <BsZoomIn />
            </Button>
          </div>
          <div className="image-container" style={{ transform: `scale(${zoom})` }}>
            <img
              src={`http://localhost:5000/${file.path}`}
              alt={file.filename}
              className="preview-image"
            />
          </div>
        </div>
      );
    }

    return (
      <div className="preview-container">
        <iframe
          src={`http://localhost:5000/${file.path}`}
          title="File preview"
          className="preview-frame"
        />
      </div>
    );
  };

  return (
    <Modal show={show} onHide={onHide} size="xl" centered className="preview-modal">
      <Modal.Header closeButton>
        <Modal.Title>{file?.filename}</Modal.Title>
        <Button
          variant="primary"
          href={`http://localhost:5000/${file?.path}`}
          download
          className="ms-auto me-2"
        >
          <BsDownload /> Download
        </Button>
      </Modal.Header>
      <Modal.Body>{renderContent()}</Modal.Body>
    </Modal>
  );
};

export default FilePreviewModal;