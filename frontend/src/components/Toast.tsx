import React, { useEffect, useState } from 'react';

const VISIBLE_MS = 1000;
const FADE_MS = 350;

interface ToastProps {
  message: string;
  onDismiss: () => void;
}

export const Toast: React.FC<ToastProps> = ({ message, onDismiss }) => {
  const [visible, setVisible] = useState(false);
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    if (!message) {
      setVisible(false);
      setExiting(false);
      return;
    }

    setVisible(true);
    setExiting(false);

    const hideTimer = setTimeout(() => setExiting(true), VISIBLE_MS);
    const dismissTimer = setTimeout(() => {
      setVisible(false);
      onDismiss();
    }, VISIBLE_MS + FADE_MS);

    return () => {
      clearTimeout(hideTimer);
      clearTimeout(dismissTimer);
    };
  }, [message, onDismiss]);

  if (!visible || !message) return null;

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
