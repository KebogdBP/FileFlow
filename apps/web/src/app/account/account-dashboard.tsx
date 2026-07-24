'use client';

import { useCallback, useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Badge, Button, Card, Input } from '@fileflow/ui';
import { ACCOUNT_TOKEN_KEY, API_URL, downloadJobResult } from '../cloud-api';

type Account = { id: string; email: string; plan: 'free'; created_at: string };
type Limits = {
  cloud_jobs_used: number;
  cloud_jobs_limit: number;
  resets_at: string;
};
type Job = {
  id: string;
  operation: string;
  status: string;
  created_at: string;
  progress: number;
  error_code: string | null;
  result_size_bytes: number | null;
  runtime_ms: number | null;
};
type ApiKey = {
  id: string;
  name: string;
  prefix: string;
  created_at: string;
  last_used_at: string | null;
};

function apiRequest(path: string, accessToken: string, init?: RequestInit) {
  return fetch(`${API_URL}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
  });
}

export function AccountDashboard() {
  const [token, setToken] = useState<string | null>(null);
  const [account, setAccount] = useState<Account | null>(null);
  const [limits, setLimits] = useState<Limits | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [createdKey, setCreatedKey] = useState('');
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  const loadAccount = useCallback(async (accessToken: string) => {
    const [profileResponse, limitsResponse, historyResponse, keysResponse] = await Promise.all([
      apiRequest('/account/me', accessToken),
      apiRequest('/account/limits', accessToken),
      apiRequest('/account/history?limit=20', accessToken),
      apiRequest('/account/api-keys', accessToken),
    ]);
    if (!profileResponse.ok || !limitsResponse.ok || !historyResponse.ok || !keysResponse.ok) {
      window.localStorage.removeItem(ACCOUNT_TOKEN_KEY);
      setToken(null);
      return;
    }
    setToken(accessToken);
    setAccount((await profileResponse.json()) as Account);
    setLimits((await limitsResponse.json()) as Limits);
    setJobs(((await historyResponse.json()) as { items: Job[] }).items);
    setApiKeys(((await keysResponse.json()) as { items: ApiKey[] }).items);
  }, []);

  useEffect(() => {
    const saved = window.localStorage.getItem(ACCOUNT_TOKEN_KEY);
    if (saved) void loadAccount(saved);
  }, [loadAccount]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage('');
    const data = new FormData(event.currentTarget);
    try {
      const response = await fetch(`${API_URL}/account/${mode}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: data.get('email'), password: data.get('password') }),
      });
      const payload = (await response.json()) as {
        access_token?: string;
        error?: { message: string };
      };
      if (!response.ok || !payload.access_token) {
        setMessage(payload.error?.message ?? 'Account request failed.');
        return;
      }
      window.localStorage.setItem(ACCOUNT_TOKEN_KEY, payload.access_token);
      await loadAccount(payload.access_token);
    } catch {
      setMessage('The account service is not available. Try again shortly.');
    } finally {
      setBusy(false);
    }
  }

  async function logout() {
    if (token) await apiRequest('/account/session', token, { method: 'DELETE' });
    window.localStorage.removeItem(ACCOUNT_TOKEN_KEY);
    setToken(null);
    setAccount(null);
    setLimits(null);
    setJobs([]);
    setApiKeys([]);
    setCreatedKey('');
  }

  async function createApiKey(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token) return;
    const data = new FormData(event.currentTarget);
    const response = await apiRequest('/account/api-keys', token, {
      method: 'POST',
      body: JSON.stringify({ name: data.get('name') }),
    });
    const payload = (await response.json()) as ApiKey & {
      key?: string;
      error?: { message: string };
    };
    if (!response.ok || !payload.key) {
      setMessage(payload.error?.message ?? 'Could not create API key.');
      return;
    }
    setCreatedKey(payload.key);
    event.currentTarget.reset();
    await loadAccount(token);
  }

  async function revokeApiKey(keyId: string) {
    if (!token) return;
    const response = await apiRequest(`/account/api-keys/${keyId}`, token, { method: 'DELETE' });
    if (!response.ok) {
      setMessage('Could not revoke API key.');
      return;
    }
    setCreatedKey('');
    await loadAccount(token);
  }

  async function cancelHistoryJob(jobId: string) {
    if (!token) return;
    await apiRequest(`/jobs/${jobId}`, token, { method: 'DELETE' });
    await loadAccount(token);
  }

  async function downloadHistoryJob(jobId: string) {
    if (!token) return;
    try {
      const result = await downloadJobResult(jobId, token);
      const url = URL.createObjectURL(result.blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = result.filename;
      anchor.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not download result.');
    }
  }

  if (!account) {
    return (
      <Card className="account-auth">
        <div className="account-mode" aria-label="Account action">
          <Button
            variant={mode === 'login' ? 'primary' : 'secondary'}
            onClick={() => setMode('login')}
          >
            Sign in
          </Button>
          <Button
            variant={mode === 'register' ? 'primary' : 'secondary'}
            onClick={() => setMode('register')}
          >
            Create account
          </Button>
        </div>
        <form onSubmit={submit}>
          <Input label="Email" name="email" type="email" autoComplete="email" required />
          <Input
            label="Password"
            name="password"
            type="password"
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            minLength={mode === 'register' ? 12 : 1}
            required
          />
          {message && (
            <p className="account-error" role="alert">
              {message}
            </p>
          )}
          <Button type="submit" disabled={busy}>
            {busy ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Create account'}
          </Button>
        </form>
      </Card>
    );
  }

  return (
    <section className="account-dashboard" aria-label="Account overview">
      <Card>
        <div className="account-card-heading">
          <div>
            <Badge variant="private">{account.plan}</Badge>
            <h2>{account.email}</h2>
          </div>
          <Button variant="secondary" onClick={logout}>
            Sign out
          </Button>
        </div>
        {limits && (
          <p>
            <strong>
              {limits.cloud_jobs_used} of {limits.cloud_jobs_limit}
            </strong>{' '}
            cloud jobs used today. Resets {new Date(limits.resets_at).toLocaleString()}.
          </p>
        )}
      </Card>
      <Card>
        <h2>Cloud history</h2>
        {jobs.length === 0 ? (
          <p>No authenticated cloud jobs yet. Local work is intentionally not recorded.</p>
        ) : (
          <ul className="account-history">
            {jobs.map((job) => (
              <li key={job.id}>
                <span>
                  <strong>{job.operation}</strong>
                  <small>
                    {new Date(job.created_at).toLocaleString()} · {job.progress}%
                    {job.result_size_bytes
                      ? ` · ${Math.round(job.result_size_bytes / 1024)} KB`
                      : ''}
                    {job.runtime_ms ? ` · ${(job.runtime_ms / 1000).toFixed(1)} s` : ''}
                    {job.error_code ? ` · ${job.error_code}` : ''}
                  </small>
                </span>
                <span className="history-actions">
                  <Badge>{job.status}</Badge>
                  {job.status === 'succeeded' ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => void downloadHistoryJob(job.id)}
                    >
                      Download
                    </Button>
                  ) : null}
                  {job.status === 'queued' || job.status === 'running' ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => void cancelHistoryJob(job.id)}
                    >
                      Cancel
                    </Button>
                  ) : null}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
      <Card className="api-key-card">
        <h2>Developer API keys</h2>
        <p>Create a revocable key for the FileFlow API and MCP adapter.</p>
        <form onSubmit={createApiKey}>
          <Input label="Key name" name="name" maxLength={80} required />
          <Button type="submit">Create API key</Button>
        </form>
        {createdKey ? (
          <div className="api-key-secret" role="status">
            <strong>Copy this key now. It will not be shown again.</strong>
            <code>{createdKey}</code>
          </div>
        ) : null}
        {apiKeys.length ? (
          <ul className="account-history">
            {apiKeys.map((key) => (
              <li key={key.id}>
                <span>
                  <strong>{key.name}</strong>
                  <small>
                    {key.prefix}… · created {new Date(key.created_at).toLocaleString()}
                  </small>
                </span>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => void revokeApiKey(key.id)}
                >
                  Revoke
                </Button>
              </li>
            ))}
          </ul>
        ) : (
          <p>No active API keys.</p>
        )}
      </Card>
      {message ? (
        <p className="account-error" role="alert">
          {message}
        </p>
      ) : null}
    </section>
  );
}
