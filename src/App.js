import React, { useState } from 'react';
import { listFiles, getFileContents, summarize, generate, createPR } from './api';
import RepoForm from './components/RepoForm';
import FileList from './components/FileList';
import SummariesList from './components/SummariesList';
import CodeViewer from './components/CodeViewer';
import './App.css';

export default function App() {
  const [token, setToken] = useState('');
  const [owner, setOwner] = useState('');
  const [repo, setRepo] = useState('');
  const [files, setFiles] = useState([]);
  const [selectedPaths, setSelectedPaths] = useState([]); 
  const [fileContents, setFileContents] = useState([]);
  const [summaries, setSummaries] = useState([]);
  const [generated, setGenerated] = useState(null);
  const [prUrl, setPrUrl] = useState(null);

  async function handleFetchFiles() {
    if (!owner || !repo || !token) {
      alert('Owner, repo, and token are required.');
      return;
    }
    const res = await listFiles(owner, repo, token);
    setFiles(res.files || []);
  }

  async function handleSelectAndSummarize(paths) {
    if (!paths || paths.length === 0) {
      alert('Please select at least one file.');
      return;
    }
    setSelectedPaths(paths);
    const contentsResp = await getFileContents(owner, repo, token, paths);
    setFileContents(contentsResp.files || []);
    const sum = await summarize(contentsResp.files || []);
    setSummaries(sum.summaries || []);
    setGenerated(null);
    setPrUrl(null);
  }

  async function handleGenerate(summary) {
    if (!summary) {
      alert('No summary selected.');
      return;
    }
    const gen = await generate(summary, fileContents);
    setGenerated(gen.generated || gen);
  }

  async function handleCreatePR(branchName, prTitle) {
    if (!generated || !generated.files || generated.files.length === 0) {
      alert('No generated files to push.');
      return;
    }
    const payload = {
      owner,
      repo,
      token,
      branchName,
      prTitle,
      prBody: `Auto-generated tests: ${prTitle}`,
      files: generated.files.map(f => ({
        path: f.path,
        content: f.content
      }))
    };
    const res = await createPR(payload);
    setPrUrl(res.prUrl);
  }

  return (
    <div className="container">
      <h1>Testcase Generator</h1>

      <RepoForm
        token={token}
        setToken={setToken}
        owner={owner}
        setOwner={setOwner}
        repo={repo}
        setRepo={setRepo}
        onFetch={handleFetchFiles}
      />

      <hr />

      <div className="row">
        <div className="col">
          <h3>Files (select group)</h3>
        
          <FileList
            files={files}
            selectedPaths={selectedPaths}
            onSummarize={handleSelectAndSummarize}
          />
        </div>

        <div className="col">
          <h3>Summaries</h3>
          <SummariesList
            summaries={summaries}
            onGenerate={handleGenerate}
          />
        </div>
      </div>

      <hr />

      <div>
        <h3>Generated Files</h3>
        {generated ? (
          <>
            {generated.files.map((f, i) => (
              <CodeViewer key={i} filename={f.path} code={f.content} />
            ))}
            <div style={{ marginTop: 12 }}>
              <input
                placeholder="branch name (e.g. testgen/add-tests-1)"
                id="branch"
              />
              <input
                placeholder="PR title"
                id="prtitle"
                style={{ marginLeft: 6 }}
              />
              <button
                onClick={() => {
                  const branch =
                    document.getElementById('branch').value ||
                    `testgen/${Date.now()}`;
                  const title =
                    document.getElementById('prtitle').value ||
                    `Add generated tests ${Date.now()}`;
                  handleCreatePR(branch, title);
                }}
              >
                Create PR on GitHub
              </button>
            </div>
            {prUrl && (
              <p>
                PR created:{' '}
                <a href={prUrl} target="_blank" rel="noreferrer">
                  {prUrl}
                </a>
              </p>
            )}
          </>
        ) : (
          <p>No generated files yet — select a summary and click Generate.</p>
        )}
      </div>
    </div>
  );
}
