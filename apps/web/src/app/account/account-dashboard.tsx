'use client';

import { useCallback, useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Badge, Button, Card, Input } from '@fileflow/ui';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000/api/v1';
const TOKEN_KEY = 'fileflow.account-token';

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
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  const loadAccount = useCallback(async (accessToken: string) => {
    const [profileResponse, limitsResponse, historyResponse] = await Promise.all([
      apiRequest('/account/me', accessToken),
      apiRequest('/account/limits', accessToken),
      apiRequest('/account/history?limit=20', accessToken),
    ]);
    if (!profileResponse.ok || !limitsResponse.ok || !historyResponse.ok) {
      window.localStorage.removeItem(TOKEN_KEY);
      setToken(null);
      return;
    }
    setToken(accessToken);
    setAccount((await profileResponse.json()) as Account);
    setLimits((await limitsResponse.json()) as Limits);
    setJobs(((await historyResponse.json()) as { items: Job[] }).items);
  }, []);

  useEffect(() => {
    const saved = window.localStorage.getItem(TOKEN_KEY);
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
      window.localStorage.setItem(TOKEN_KEY, payload.access_token);
      await loadAccount(payload.access_token);
    } catch {
      setMessage('The account service is not available. Try again shortly.');
    } finally {
      setBusy(false);
    }
  }

  async function logout() {
    if (token) await apiRequest('/account/session', token, { method: 'DELETE' });
    window.localStorage.removeItem(TOKEN_KEY);
    setToken(null);
    setAccount(null);
    setLimits(null);
    setJobs([]);
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
                  <small>{new Date(job.created_at).toLocaleString()}</small>
                </span>
                <Badge>{job.status}</Badge>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </section>
  );
}
