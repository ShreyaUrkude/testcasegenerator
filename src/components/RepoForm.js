import React from 'react';

export default function RepoForm({ token, setToken, owner, setOwner, repo, setRepo, onFetch }) {
  return (
    <div className="card">
      <div className="row">
        <div>
          <label>GitHub Token</label>
          <input type="password" value={token} onChange={e=>setToken(e.target.value)} placeholder="paste PAT (repo scope)"/>
        </div>
        <div>
          <label>Owner</label>
          <input value={owner} onChange={e=>setOwner(e.target.value)} placeholder="owner or org"/>
        </div>
        <div>
          <label>Repo</label>
          <input value={repo} onChange={e=>setRepo(e.target.value)} placeholder="repo name"/>
        </div>
        <div style={{alignSelf:'end'}}>
          <button onClick={onFetch}>Fetch files</button>
        </div>
      </div>
    </div>
  );
}
