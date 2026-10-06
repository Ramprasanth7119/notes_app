import axios from 'axios';

// In production the client and API share one origin: Vercel forwards /api/*
// to the Express server (client/vercel.json), and in development Vite does the
// same (vite.config.js). That keeps the auth cookie first-party.
// VITE_API_URL can point at a different API origin if needed.
export const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

const http = axios.create({
  baseURL: API_BASE_URL,
  // Send the httpOnly auth cookie with every request. The token itself is
  // never visible to this code.
  withCredentials: true
});

// Normalised error for every failed request. The server always answers with
//   { success: false, error: { code, message, details? } }
export class ApiError extends Error {
  constructor(message, { status = 0, code = 'NETWORK_ERROR', details = [] } = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }

  // { email: 'Email address is not valid', ... } from VALIDATION_ERROR details
  get fieldErrors() {
    return Object.fromEntries(
      this.details.map((detail) => [detail.field.split('.').slice(1).join('.'), detail.message])
    );
  }
}

let onSessionExpired = () => {};
export const setSessionExpiredHandler = (handler) => {
  onSessionExpired = handler;
};

http.interceptors.response.use(
  (response) => response,
  (error) => {
    if (axios.isCancel(error)) {
      return Promise.reject(error);
    }
    const { response } = error;
    if (!response) {
      return Promise.reject(new ApiError('Cannot reach the server. Check your connection and try again.'));
    }

    const body = response.data?.error;
    const apiError = new ApiError(body?.message || `Request failed (${response.status})`, {
      status: response.status,
      code: body?.code || 'HTTP_ERROR',
      details: body?.details || []
    });

    if (apiError.code === 'UNAUTHENTICATED') {
      onSessionExpired();
    }
    return Promise.reject(apiError);
  }
);

export const isCancelled = (error) => axios.isCancel(error);

export default http;
