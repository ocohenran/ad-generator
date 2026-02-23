import { useState, useEffect, useRef } from 'react';

const STORAGE_KEY = 'ad-gen:anthropic-api-key';

interface Props {
  onClose: () => void;
}

export function ApiKeyModal({ onClose }: Props) {
  const [key, setKey] = useState('');
  const [saved, setSaved] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const existing = localStorage.getItem(STORAGE_KEY);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose]);

  const handleSave = () => {
    if (key.trim()) {
      localStorage.setItem(STORAGE_KEY, key.trim());
      setSaved(true);
      setTimeout(onClose, 600);
    }
  };

  const handleClear = () => {
    localStorage.removeItem(STORAGE_KEY);
    setKey('');
    setSaved(false);
  };

  return (
    <div className="api-key-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="api-key-modal">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700 }} className="text-primary">Settings</h2>
          <button className="btn-icon" onClick={onClose} aria-label="Close">&times;</button>
        </div>

        <label className="editor-label">Anthropic API Key</label>
        {existing && !saved ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <span className="text-muted" style={{ fontSize: 13 }}>
              Key set: ****{existing.slice(-4)}
            </span>
            <button className="btn-secondary" onClick={handleClear} style={{ fontSize: 11 }}>
              Clear
            </button>
          </div>
        ) : null}

        <input
          ref={inputRef}
          type="password"
          className="editor-input"
          placeholder="sk-ant-..."
          value={key}
          onChange={(e) => setKey(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') handleSave(); }}
          style={{ marginBottom: 12 }}
        />

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn-primary" onClick={handleSave} disabled={!key.trim()}>
            {saved ? 'Saved!' : 'Save Key'}
          </button>
        </div>

        <p style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 12, marginBottom: 0 }}>
          Your key is stored in localStorage and sent directly to Anthropic. It never leaves your browser.
        </p>
      </div>
    </div>
  );
}

export function getApiKey(): string | null {
  return localStorage.getItem(STORAGE_KEY);
}
