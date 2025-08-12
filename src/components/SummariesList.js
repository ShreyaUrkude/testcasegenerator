import React from 'react';

export default function SummariesList({ summaries = [], onGenerate }) {
  if (!summaries.length) return <p>No summaries yet. Click "Summarize selected files".</p>;

  return (
    <div style={{maxHeight:300, overflow:'auto', border:'1px solid #ddd', padding:8}}>
      {summaries.map(s => (
        <div key={s.id} className="summary">
          <h4>{s.title}</h4>
          <p>{s.description}</p>
          <p><b>Framework:</b> {s.suggested_framework}</p>
          <button onClick={()=>onGenerate(s)}>Generate test code</button>
        </div>
      ))}
    </div>
  );
}
