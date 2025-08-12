import axios from 'axios';
const BASE = process.env.REACT_APP_API_URL || 'http://localhost:5000';

export const listFiles = (owner, repo, token) => axios.post(`${BASE}/api/github/list-files`, { owner, repo, token }).then(r => r.data);
export const getFileContents = (owner, repo, token, paths) => axios.post(`${BASE}/api/github/get-file-contents`, { owner, repo, token, paths }).then(r => r.data);
export const summarize = (files) => axios.post(`${BASE}/api/ai/summarize`, { files }).then(r => r.data);
export const generate = (summary, files) => axios.post(`${BASE}/api/ai/generate`, { summary, files }).then(r => r.data);
export const createPR = (payload) => axios.post(`${BASE}/api/github/create-pr`, payload).then(r => r.data);
