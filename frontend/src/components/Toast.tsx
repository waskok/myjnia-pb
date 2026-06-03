import React, { useEffect, useState } from 'react';

const BASE_VISIBLE_MS = 3500;
const MAX_VISIBLE_MS = 7000;
const FADE_MS = 350;

interface ToastProps {
  message: string;
  onDismiss: () => void;
}

export const Toast: React.FC<ToastProps> = ({ message, onDismiss }) => {
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    if (!message) return;

    const text = message.replace(/^✅\s*|^❌\s*/, '');
    const dynamicVisibleMs = Math.min(
      MAX_VISIBLE_MS,
      BASE_VISIBLE_MS + Math.max(0, text.length - 80) * 30,
    );

    const hideTimer = setTimeout(() => setExiting(true), dynamicVisibleMs);
    const dismissTimer = setTimeout(() => onDismiss(), dynamicVisibleMs + FADE_MS);

    return () => {
      clearTimeout(hideTimer);
      clearTimeout(dismissTimer);
    };
  }, [message, onDismiss]);

  if (!message) return null;

  const isSuccess = message.includes('✅');
  const text = message.replace(/^✅\s*|^❌\s*/, '');

  return (
    <div
      className={`toast-popup ${isSuccess ? 'toast-success' : 'toast-error'} ${exiting ? 'toast-exit' : ''}`}
      role="status"
      aria-live="polite"
    >
      {text}
    </div>
  );
};
