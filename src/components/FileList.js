import React, { useState } from 'react';

export default function FileList({ files = [], onSummarize }) {
  const [checked, setChecked] = useState({});

  function toggle(path) {
    setChecked(prev => ({ ...prev, [path]: !prev[path] }));
  }

  function handleSummarize() {
    const sel = Object.keys(checked).filter(p => checked[p]);
    if (sel.length === 0) return alert('Select some files first');
    onSummarize(sel);
  }

  return (
    <div>
      <div style={{maxHeight:300, overflow:'auto', border:'1px solid #ddd', padding:8}}>
        {files.map(f => (
          <div key={f.path}>
            <label>
              <input type="checkbox" checked={!!checked[f.path]} onChange={()=>toggle(f.path)} />
              <span className="file-path">{f.path}</span>
            </label>
          </div>
        ))}
      </div>
      <div style={{marginTop:8}}>
        <button onClick={handleSummarize}>Summarize selected files</button>
      </div>
    </div>
  );
}
