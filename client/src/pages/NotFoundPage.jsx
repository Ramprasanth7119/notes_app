import { Link } from 'react-router-dom';
import { EmptyState } from '../components/ui/States';

export default function NotFoundPage() {
  return (
    <EmptyState title="Page not found" action={<Link to="/" className="button">Back to notes</Link>}>
      The page you were looking for doesn’t exist.
    </EmptyState>
  );
}
