import { useRef, useState } from 'react';
import { BsDownload, BsFileEarmarkText, BsPaperclip, BsTrash, BsUpload } from 'react-icons/bs';
import { attachmentUrl, deleteAttachment, uploadAttachment } from '../../api/notes';
import { useToast } from '../../contexts/toast';
import { ACCEPTED_FILES, checkFile, isImage } from '../../lib/files';
import ConfirmDialog from '../ui/ConfirmDialog';

export default function Attachments({ noteId, files, onChange }) {
  const toast = useToast();
  const inputRef = useRef(null);
  const [uploads, setUploads] = useState([]); // [{ name, progress }]
  const [pendingDelete, setPendingDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const handleFiles = async (event) => {
    const selected = Array.from(event.target.files);
    event.target.value = '';

    let current = files;
    // One at a time, so progress and errors are reported per file.
    for (const file of selected) {
      const problem = checkFile(file);
      if (problem) {
        toast.show(problem, 'error');
        continue;
      }
      setUploads((list) => [...list, { name: file.name, progress: 0 }]);
      try {
        const saved = await uploadAttachment(noteId, file, (progress) =>
          setUploads((list) => list.map((u) => (u.name === file.name ? { ...u, progress } : u)))
        );
        current = [...current, saved];
        onChange(current);
        toast.show(`Attached ${file.name}`);
      } catch (error) {
        toast.show(`${file.name}: ${error.message}`, 'error');
      } finally {
        setUploads((list) => list.filter((u) => u.name !== file.name));
      }
    }
  };

  const confirmDelete = async () => {
    setDeleting(true);
    try {
      await deleteAttachment(noteId, pendingDelete._id);
      onChange(files.filter((file) => file._id !== pendingDelete._id));
      toast.show('Attachment deleted');
      setPendingDelete(null);
    } catch (error) {
      toast.show(error.message, 'error');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <section className="section" aria-labelledby="attachments-heading">
      <div className="section__header">
        <h2 id="attachments-heading" className="section__title">
          <BsPaperclip aria-hidden="true" /> Attachments
        </h2>
        <button type="button" className="button button--ghost" onClick={() => inputRef.current.click()}>
          <BsUpload aria-hidden="true" /> Upload
        </button>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={ACCEPTED_FILES}
          className="visually-hidden"
          onChange={handleFiles}
          tabIndex={-1}
          aria-label="Upload attachments"
        />
      </div>

      {files.length === 0 && uploads.length === 0 && (
        <p className="muted small">Images, PDF, TXT, DOC or DOCX — up to 5 MB each.</p>
      )}

      <ul className="files">
        {files.map((file) => {
          const url = attachmentUrl(noteId, file._id);
          return (
            <li key={file._id} className="file">
              <a href={url} target="_blank" rel="noopener noreferrer" className="file__preview">
                {isImage(file) ? (
                  <img src={url} alt={file.filename} loading="lazy" />
                ) : (
                  <BsFileEarmarkText aria-hidden="true" />
                )}
              </a>
              <span className="file__name" title={file.filename}>{file.filename}</span>
              <span className="file__actions">
                <a href={url} download={file.filename} className="icon-button icon-button--small" aria-label={`Download ${file.filename}`}>
                  <BsDownload aria-hidden="true" />
                </a>
                <button
                  type="button"
                  className="icon-button icon-button--small icon-button--danger"
                  onClick={() => setPendingDelete(file)}
                  aria-label={`Delete ${file.filename}`}
                >
                  <BsTrash aria-hidden="true" />
                </button>
              </span>
            </li>
          );
        })}
        {uploads.map((upload) => (
          <li key={upload.name} className="file file--uploading">
            <span className="file__name">{upload.name}</span>
            <progress max="100" value={upload.progress} aria-label={`Uploading ${upload.name}`} />
          </li>
        ))}
      </ul>

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title="Delete attachment?"
        message={`"${pendingDelete?.filename}" will be removed from this note.`}
        busy={deleting}
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(null)}
      />
    </section>
  );
}
