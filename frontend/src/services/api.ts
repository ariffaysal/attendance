import axios from 'axios';

/** Same base URL for REST (axios) and Socket.IO client (see live-attendance page). */
export const publicApiUrl = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001').replace(
  /\/$/,
  '',
);

export const api = axios.create({
  baseURL: publicApiUrl,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true, // Enable sending cookies
});

export const unwrapResponse = <T>(response: { data: T }): T => response.data;
