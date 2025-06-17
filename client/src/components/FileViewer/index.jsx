import React, { useState } from 'react';
import { Modal, Button } from 'react-bootstrap';
import { 
  BsDownload, 
  BsZoomIn, 
  BsZoomOut,
  BsFullscreen,
  BsFullscreenExit
} from 'react-icons/bs';

const FileViewer = ({ file, onClose }) => {
  const [zoom, setZoom] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const handleZoomIn = () => setZoom(prev => Math.min(prev + 0.25, 3));
  const handleZoomOut = () => setZoom(prev => Math.max(prev - 0.25, 0.5));

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  const renderPreview = () => {
    if (!file) return null;

    switch (file.type) {
      case 'image':
        return (
          <div className="image-viewer">
            <div className="controls">
              <Button variant="light" onClick={handleZoomOut}>
                <BsZoomOut />
              </Button>
              <span className="zoom-level">{Math.round(zoom * 100)}%</span>
              <Button variant="light" onClick={handleZoomIn}>
                <BsZoomIn />
              </Button>
              <Button variant="light" onClick={toggleFullscreen}>
                {isFullscreen ? <BsFullscreenExit /> : <BsFullscreen />}
              </Button>
            </div>
            <div 
              className="image-container"
              style={{ transform: `scale(${zoom})` }}
            >
              <img
                src={`https://notes-cw4m.onrender.com/${file.path}`}
                alt={file.filename}
                className="preview-image"
              />
            </div>
          </div>
        );
      case 'pdf':
        return (
          <iframe
            src={`https://notes-cw4m.onrender.com/${file.path}`}
            title={file.filename}
            className="pdf-viewer"
          />
        );
      default:
        return (
          <div className="unsupported-format">
            <p>Preview not available for this file type</p>
            <Button 
              variant="primary"
              href={`https://notes-cw4m.onrender.com/${file.path}`}
              download
            >
              <BsDownload /> Download File
            </Button>
          </div>
        );
    }
  };

  return (
    <Modal 
      show={true} 
      onHide={onClose}
      size="xl"
      className="file-viewer-modal"
    >
      <Modal.Header closeButton>
        <Modal.Title>{file?.filename}</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        {renderPreview()}
      </Modal.Body>
    </Modal>
  );
};

export default FileViewer;