import React from 'react';
import { Toast, ToastContainer } from 'react-bootstrap';
import { BsCheckCircle, BsXCircle, BsInfoCircle } from 'react-icons/bs';

const ToastMessage = ({ show, onClose, message, type = 'success' }) => {
  const icons = {
    success: <BsCheckCircle className="me-2" />,
    error: <BsXCircle className="me-2" />,
    info: <BsInfoCircle className="me-2" />
  };

  return (
    <ToastContainer position="top-end" className="p-3 toast-container">
      <Toast 
        show={show} 
        onClose={onClose} 
        delay={3000} 
        autohide
        bg={type === 'error' ? 'danger' : type}
        className="text-white"
      >
        <Toast.Header closeButton={false} className="text-white">
          {icons[type]}
          <strong className="me-auto">Notification</strong>
          <button 
            type="button" 
            className="btn-close btn-close-white" 
            onClick={onClose}
            aria-label="Close"
          />
        </Toast.Header>
        <Toast.Body>{message}</Toast.Body>
      </Toast>
    </ToastContainer>
  );
};

export default ToastMessage;