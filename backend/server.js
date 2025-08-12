require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const { Octokit } = require('@octokit/rest');
const fetch = (...args) => import('node-fetch').then(({ default: f }) => f(...args));

const app = express();

app.use(cors({
  origin: ['http://localhost:3000'],
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(bodyParser.json({ limit: '10mb' }));

const PORT = process.env.PORT || 5000;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-3.5-turbo';

function octokitForToken(token) {
  return new Octokit({ auth: token });
}




app.post('/api/github/list-files', async (req, res) => {
  try {
    const { owner, repo, token } = req.body;
    if (!owner || !repo || !token) {
      return res.status(400).json({ error: 'owner, repo, and token are required' });
    }

    const octokit = octokitForToken(token);
    const repoInfo = await octokit.repos.get({ owner, repo });
    const defaultBranch = repoInfo.data.default_branch;

    const branchInfo = await octokit.repos.getBranch({ owner, repo, branch: defaultBranch });
    const treeSha = branchInfo.data.commit.commit.tree.sha;

    const treeResp = await octokit.git.getTree({
      owner,
      repo,
      tree_sha: treeSha,
      recursive: '1'
    });

    const files = treeResp.data.tree
      .filter(item => item.type === 'blob')
      .map(item => ({ path: item.path, sha: item.sha }));

    res.json({ defaultBranch, files });
  } catch (err) {
    console.error('list-files error:', err);
    res.status(500).json({ error: err.message || 'Error listing files' });
  }
});


app.post('/api/github/get-file-contents', async (req, res) => {
  try {
    const { owner, repo, token, paths } = req.body;
    if (!owner || !repo || !token || !Array.isArray(paths)) {
      return res.status(400).json({ error: 'owner, repo, token, and paths[] required' });
    }

    const octokit = octokitForToken(token);
    const out = [];

    for (const path of paths) {
      const contentResp = await octokit.repos.getContent({ owner, repo, path });
      const data = contentResp.data;
      const buff = Buffer.from(data.content || '', 'base64');
      out.push({ path, content: buff.toString('utf8') });
    }

    res.json({ files: out });
  } catch (err) {
    console.error('get-file-contents error:', err);
    res.status(500).json({ error: err.message || 'Error fetching file contents' });
  }
});


function detectLanguageFromPath(path) {
  if (path.endsWith('.js') || path.endsWith('.jsx')) return 'javascript';
  if (path.endsWith('.ts') || path.endsWith('.tsx')) return 'typescript';
  if (path.endsWith('.py')) return 'python';
  if (path.endsWith('.java')) return 'java';
  return 'unknown';
}

function mockSummarize(files) {
  return files.map((f, i) => {
    const lang = detectLanguageFromPath(f.path);
    const suggested_framework =
      lang === 'javascript' ? 'jest' :
      lang === 'python' ? 'pytest' : 'unit';
    return {
      id: `s-${i}`,
      title: `Basic unit tests for ${f.path}`,
      description: `Generate ${suggested_framework} tests covering main functions in ${f.path}.`,
      suggested_framework,
      paths: [f.path]
    };
  });
}

function mockGenerateTest(summary) {
  return `// Mock test file for ${summary.paths?.[0] || 'unknown file'}\n` +
         `describe('${summary.title}', () => {\n` +
         `  it('should run a mock test', () => {\n` +
         `    expect(true).toBe(true);\n` +
         `  });\n` +
         `});`;
}

async function openaiChat(messages) {
  try {
    const r = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        messages,
        temperature: 0.2,
        max_tokens: 1500
      })
    });

    if (!r.ok) {
      const errText = await r.text();
      throw new Error(`OpenAI API error ${r.status}: ${errText}`);
    }

    const json = await r.json();
    return json.choices?.[0]?.message?.content;
  } catch (err) {
    throw err;
  }
}

app.post('/api/ai/summarize', async (req, res) => {
  try {
    const { files } = req.body;
    if (!Array.isArray(files) || files.length === 0) {
      return res.status(400).json({ error: 'files[] required' });
    }

    if (!OPENAI_API_KEY) {
      console.warn('⚠ No API key, using mock summarization.');
      return res.json({ summaries: mockSummarize(files) });
    }

    const items = files.map(f =>
      `===FILE_START===\nPATH: ${f.path}\nCONTENT:\n${f.content.slice(0, 1400)}\n===FILE_END===`
    ).join('\n\n');

    const system = `You are an assistant that reads code files and proposes a compact list of suggested test cases.`;
    const user = `Files:\n\n${items}\n\nGive up to 8 suggestions in JSON format: id, title, description, suggested_framework, paths.`;

    let reply;
    try {
      reply = await openaiChat([
        { role: 'system', content: system },
        { role: 'user', content: user }
      ]);
    } catch (err) {
      if (err.message.includes('insufficient_quota') || err.message.includes('invalid_api_key')) {
        console.warn(`⚠ AI error: ${err.message}. Falling back to mock summarization.`);
        return res.json({ summaries: mockSummarize(files) });
      }
      throw err;
    }

    let parsed;
    try {
      parsed = JSON.parse(reply);
    } catch {
      const match = reply.match(/\[.*\]/s);
      if (match) parsed = JSON.parse(match[0]);
      else throw new Error('Failed to parse AI response as JSON.');
    }

    res.json({ summaries: parsed });
  } catch (err) {
    console.error('AI summarize error:', err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/ai/generate', async (req, res) => {
  try {
    const { summary, files } = req.body;
    if (!summary || !Array.isArray(files) || files.length === 0) {
      return res.status(400).json({ error: 'summary and files[] required' });
    }

    if (!OPENAI_API_KEY) {
      console.warn('⚠ No API key, using mock test generation.');
      return res.json({ files: [{ path: 'test.spec.js', content: mockGenerateTest(summary) }] });
    }

    const items = files.map(f =>
      `PATH: ${f.path}\nCONTENT:\n${f.content.slice(0, 2000)}`
    ).join('\n\n');

    const system = `You are an AI code generator. Given code and a testing summary, output only the test file content without explanations.`;
    const user = `Summary:\n${JSON.stringify(summary, null, 2)}\n\nFiles:\n${items}\n\nGenerate the test code in ${summary.suggested_framework}.`;

    let reply;
    try {
      reply = await openaiChat([
        { role: 'system', content: system },
        { role: 'user', content: user }
      ]);
    } catch (err) {
      if (err.message.includes('insufficient_quota') || err.message.includes('invalid_api_key')) {
        console.warn(`⚠ AI error: ${err.message}. Falling back to mock test generation.`);
        return res.json({ files: [{ path: 'test.spec.js', content: mockGenerateTest(summary) }] });
      }
      throw err;
    }

    res.json({
      files: [
        { path: `__tests__/generated-${Date.now()}.spec.js`, content: reply.trim() }
      ]
    });
  } catch (err) {
    console.error('AI generate error:', err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/github/create-pr', async (req, res) => {
  try {
    const { owner, repo, token, branchName, prTitle, prBody, files } = req.body;
    if (!owner || !repo || !token || !branchName || !files?.length) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }

    const octokit = octokitForToken(token);
    const repoInfo = await octokit.repos.get({ owner, repo });
    const defaultBranch = repoInfo.data.default_branch;

    const branchInfo = await octokit.repos.getBranch({ owner, repo, branch: defaultBranch });
    const commitSha = branchInfo.data.commit.sha;

    await octokit.git.createRef({
      owner, repo,
      ref: `refs/heads/${branchName}`,
      sha: commitSha
    });

    for (const f of files) {
      await octokit.repos.createOrUpdateFileContents({
        owner, repo,
        path: f.path,
        message: `Add generated test: ${f.path}`,
        content: Buffer.from(f.content).toString('base64'),
        branch: branchName
      });
    }

    const pr = await octokit.pulls.create({
      owner, repo,
      title: prTitle,
      body: prBody,
      head: branchName,
      base: defaultBranch
    });

    res.json({ prUrl: pr.data.html_url });
  } catch (err) {
    console.error('create-pr error:', err);
    res.status(500).json({ error: err.message });
  }
});


app.listen(PORT, () => {
  console.log(`✅ Backend listening on port ${PORT}`);
});
