import { Link } from 'react-router-dom';
import { useAuth } from '../context/useAuth';

/** Catch-all for unknown URLs (B-23). */
export function NotFound() {
  const { isAuthenticated } = useAuth();
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center px-6 text-center">
      <p className="m-0 font-mono text-5xl text-primary">404</p>
      <h1 className="font-heading text-2xl">This page got away</h1>
      <p className="text-muted-foreground">The link may be wrong, or the page was moved or removed.</p>
      <Link to={isAuthenticated ? '/dashboard' : '/'} className="underline underline-offset-4">
        {isAuthenticated ? 'Back to your dashboard' : 'Back to the home page'}
      </Link>
    </div>
  );
}
