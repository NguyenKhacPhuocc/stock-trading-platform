import axios from 'axios';

const apiOrigin = (process.env.NEXT_PUBLIC_API_URL ?? '').replace(/\/$/, '');
const apiClient = axios.create({
  baseURL: apiOrigin ? `${apiOrigin}/api` : '/api',
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
});

/** Axios instance cho BFF gateway (same-origin, không có baseURL cố định). */
const bffClient = axios.create({
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
});

export { bffClient };
export default apiClient;
