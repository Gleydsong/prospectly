import { Navigate, useLocation, useParams } from 'react-router-dom';

export function LegacyRedirect({ to }: { to: string }) {
  const location = useLocation();
  const { id } = useParams();
  const [pathname, query] = to.replace(':id', encodeURIComponent(id ?? '')).split('?');
  const params = new URLSearchParams(location.search);
  new URLSearchParams(query).forEach((value, key) => params.set(key, value));
  const search = params.toString();
  return <Navigate to={`${pathname}${search ? `?${search}` : ''}${location.hash}`} replace />;
}
