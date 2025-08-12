import React from 'react';

export default function CodeViewer({ filename, code }) {
  return (
    <div className="code-card">
      <div className="code-header">
        <strong>{filename}</strong>
        <button onClick={() => {
          navigator.clipboard.writeText(code);
          alert('Copied code to clipboard');
        }}>Copy</button>
      </div>
      <pre className="code-block">
        {code}
      </pre>
    </div>
  );
}
