'use client';

import Image from 'next/image';
import { Camera } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { Badge, Button, Card, Input } from '@fileflow/ui';
import { ACCOUNT_TOKEN_KEY, API_URL, downloadJobResult } from '../cloud-api';
import { useFileFlowLanguage } from '../use-fileflow-language';

const authCopy = {
  en: {
    signIn: 'Sign in',
    create: 'Create account',
    name: 'Name or nickname',
    email: 'Email',
    password: 'Password',
    confirm: 'Confirm password',
    wait: 'Please wait…',
    mismatch: 'Passwords do not match.',
    signOut: 'Sign out',
    account: 'Account overview',
    used: 'cloud jobs used today. Resets',
    history: 'Cloud history',
    emptyHistory: 'No authenticated cloud jobs yet. Local work is intentionally not recorded.',
    download: 'Download',
    cancel: 'Cancel',
    apiTitle: 'Developer API keys',
    apiLead: 'Create a revocable key for the FileFlow API and MCP adapter.',
    keyName: 'Key name',
    createKey: 'Create API key',
    copyKey: 'Copy this key now. It will not be shown again.',
    created: 'created',
    revoke: 'Revoke',
    noKeys: 'No active API keys.',
  },
  ru: {
    signIn: 'Войти',
    create: 'Создать аккаунт',
    name: 'Имя или никнейм',
    email: 'Электронная почта',
    password: 'Пароль',
    confirm: 'Подтвердите пароль',
    wait: 'Подождите…',
    mismatch: 'Пароли не совпадают.',
    signOut: 'Выйти',
    account: 'Обзор аккаунта',
    used: 'облачных задач использовано сегодня. Сброс',
    history: 'Облачная история',
    emptyHistory:
      'Авторизованных облачных задач пока нет. Локальная работа намеренно не записывается.',
    download: 'Скачать',
    cancel: 'Отменить',
    apiTitle: 'API-ключи разработчика',
    apiLead: 'Создайте отзывной ключ для API FileFlow и MCP-адаптера.',
    keyName: 'Название ключа',
    createKey: 'Создать API-ключ',
    copyKey: 'Скопируйте ключ сейчас. Он больше не будет показан.',
    created: 'создан',
    revoke: 'Отозвать',
    noKeys: 'Активных API-ключей нет.',
  },
  es: {
    signIn: 'Iniciar sesión',
    create: 'Crear cuenta',
    name: 'Nombre o apodo',
    email: 'Correo electrónico',
    password: 'Contraseña',
    confirm: 'Confirmar contraseña',
    wait: 'Espera…',
    mismatch: 'Las contraseñas no coinciden.',
    signOut: 'Cerrar sesión',
    account: 'Resumen de la cuenta',
    used: 'trabajos en la nube usados hoy. Reinicio',
    history: 'Historial en la nube',
    emptyHistory: 'Aún no hay trabajos autenticados. El trabajo local no se registra.',
    download: 'Descargar',
    cancel: 'Cancelar',
    apiTitle: 'Claves API para desarrolladores',
    apiLead: 'Crea una clave revocable para la API de FileFlow y el adaptador MCP.',
    keyName: 'Nombre de la clave',
    createKey: 'Crear clave API',
    copyKey: 'Copia esta clave ahora. No se volverá a mostrar.',
    created: 'creada',
    revoke: 'Revocar',
    noKeys: 'No hay claves API activas.',
  },
} as const;

const accountExtraCopy = {
  en: {
    forgot: 'Forgot password?',
    resetTitle: 'Choose a new password',
    sendReset: 'Send reset link',
    resetSent: 'If this email is registered, a reset link has been sent.',
    newPassword: 'New password',
    currentPassword: 'Current password',
    changePassword: 'Change password',
    passwordChanged: 'Password changed.',
    profile: 'Profile settings',
    avatar: 'Avatar (JPEG, PNG or WebP, up to 5 MB)',
    uploadAvatar: 'Upload avatar',
    changeAvatar: 'Change avatar',
    avatarUpdated: 'Avatar updated.',
    invalidAvatar: 'Choose a JPEG, PNG or WebP image up to 5 MB.',
  },
  ru: {
    forgot: 'Забыли пароль?',
    resetTitle: 'Задайте новый пароль',
    sendReset: 'Отправить ссылку для сброса',
    resetSent: 'Если этот email зарегистрирован, ссылка для сброса отправлена.',
    newPassword: 'Новый пароль',
    currentPassword: 'Текущий пароль',
    changePassword: 'Изменить пароль',
    passwordChanged: 'Пароль изменён.',
    profile: 'Настройки профиля',
    avatar: 'Аватар (JPEG, PNG или WebP, до 5 МБ)',
    uploadAvatar: 'Загрузить аватар',
    changeAvatar: 'Сменить аватар',
    avatarUpdated: 'Аватар обновлён.',
    invalidAvatar: 'Выберите JPEG, PNG или WebP до 5 МБ.',
  },
  es: {
    forgot: '¿Olvidaste la contraseña?',
    resetTitle: 'Elige una nueva contraseña',
    sendReset: 'Enviar enlace',
    resetSent: 'Si el correo está registrado, se ha enviado un enlace.',
    newPassword: 'Nueva contraseña',
    currentPassword: 'Contraseña actual',
    changePassword: 'Cambiar contraseña',
    passwordChanged: 'Contraseña cambiada.',
    profile: 'Ajustes del perfil',
    avatar: 'Avatar (JPEG, PNG o WebP, hasta 5 MB)',
    uploadAvatar: 'Subir avatar',
    changeAvatar: 'Cambiar avatar',
    avatarUpdated: 'Avatar actualizado.',
    invalidAvatar: 'Elige una imagen JPEG, PNG o WebP de hasta 5 MB.',
  },
} as const;

type Account = {
  id: string;
  email: string;
  display_name: string;
  plan: 'free';
  created_at: string;
  has_avatar: boolean;
};
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
  const { language } = useFileFlowLanguage();
  const text = authCopy[language];
  const extra = accountExtraCopy[language];
  const [token, setToken] = useState<string | null>(null);
  const [account, setAccount] = useState<Account | null>(null);
  const [limits, setLimits] = useState<Limits | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [createdKey, setCreatedKey] = useState('');
  const [mode, setMode] = useState<'login' | 'register' | 'forgot' | 'reset'>('login');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState('');
  const avatarUrlRef = useRef('');
  const avatarInputRef = useRef<HTMLInputElement>(null);

  const loadAvatar = useCallback(async (accessToken: string) => {
    const response = await fetch(`${API_URL}/account/avatar`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!response.ok) return;
    const url = URL.createObjectURL(await response.blob());
    if (avatarUrlRef.current) URL.revokeObjectURL(avatarUrlRef.current);
    avatarUrlRef.current = url;
    setAvatarUrl(url);
  }, []);

  const loadAccount = useCallback(
    async (accessToken: string) => {
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
      const profile = (await profileResponse.json()) as Account;
      setAccount(profile);
      if (profile.has_avatar) void loadAvatar(accessToken);
      window.localStorage.setItem(
        'fileflow-user-profile',
        JSON.stringify({ displayName: profile.display_name }),
      );
      window.dispatchEvent(new Event('fileflow-profile-change'));
      setLimits((await limitsResponse.json()) as Limits);
      setJobs(((await historyResponse.json()) as { items: Job[] }).items);
      setApiKeys(((await keysResponse.json()) as { items: ApiKey[] }).items);
    },
    [loadAvatar],
  );

  useEffect(() => {
    const resetToken = new URLSearchParams(window.location.search).get('reset_token');
    if (resetToken) setMode('reset');
    const saved = window.localStorage.getItem(ACCOUNT_TOKEN_KEY);
    if (saved) void loadAccount(saved);
    return () => {
      if (avatarUrlRef.current) URL.revokeObjectURL(avatarUrlRef.current);
    };
  }, [loadAccount]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage('');
    const data = new FormData(event.currentTarget);
    const password = String(data.get('password') ?? '');
    if (
      (mode === 'register' || mode === 'reset') &&
      password !== String(data.get('confirmPassword') ?? '')
    ) {
      setMessage(text.mismatch);
      return;
    }
    setBusy(true);
    try {
      const path =
        mode === 'forgot'
          ? '/account/password/forgot'
          : mode === 'reset'
            ? '/account/password/reset'
            : `/account/${mode}`;
      const response = await fetch(`${API_URL}${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          mode === 'forgot'
            ? { email: data.get('email') }
            : mode === 'reset'
              ? {
                  token: new URLSearchParams(window.location.search).get('reset_token'),
                  new_password: password,
                }
              : {
                  email: data.get('email'),
                  password,
                  ...(mode === 'register' ? { display_name: data.get('displayName') } : {}),
                },
        ),
      });
      const payload = (await response.json()) as {
        access_token?: string;
        account?: Account;
        message?: string;
        error?: { message: string };
      };
      if (mode === 'forgot' && response.ok) {
        setMessage(extra.resetSent);
        return;
      }
      if (!response.ok || !payload.access_token) {
        setMessage(payload.error?.message ?? 'Account request failed.');
        return;
      }
      window.localStorage.setItem(ACCOUNT_TOKEN_KEY, payload.access_token);
      if (payload.account) {
        window.localStorage.setItem(
          'fileflow-user-profile',
          JSON.stringify({ displayName: payload.account.display_name }),
        );
        window.dispatchEvent(new Event('fileflow-profile-change'));
      }
      window.location.assign('/');
    } catch {
      setMessage('The account service is not available. Try again shortly.');
    } finally {
      setBusy(false);
    }
  }

  async function logout() {
    if (token) await apiRequest('/account/session', token, { method: 'DELETE' });
    window.localStorage.removeItem(ACCOUNT_TOKEN_KEY);
    window.localStorage.removeItem('fileflow-user-profile');
    window.dispatchEvent(new Event('fileflow-profile-change'));
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

  async function saveAvatar(file: File, form?: HTMLFormElement) {
    if (!token) return;
    if (
      !['image/jpeg', 'image/png', 'image/webp'].includes(file.type) ||
      file.size === 0 ||
      file.size > 5 * 1024 * 1024
    ) {
      setMessage(extra.invalidAvatar);
      return;
    }
    setBusy(true);
    try {
      const response = await fetch(`${API_URL}/account/avatar`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': file.type },
        body: file,
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as {
          error?: { message?: string };
        } | null;
        setMessage(payload?.error?.message ?? extra.invalidAvatar);
        return;
      }
      await loadAvatar(token);
      setAccount((current) => (current ? { ...current, has_avatar: true } : current));
      window.dispatchEvent(new Event('fileflow-profile-change'));
      form?.reset();
      if (avatarInputRef.current) avatarInputRef.current.value = '';
      setMessage(extra.avatarUpdated);
    } finally {
      setBusy(false);
    }
  }

  async function uploadAvatar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const file = new FormData(form).get('avatar');
    if (!(file instanceof File)) {
      setMessage(extra.invalidAvatar);
      return;
    }
    await saveAvatar(file, form);
  }

  async function changePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    const newPassword = String(data.get('newPassword') ?? '');
    if (newPassword !== String(data.get('confirmPassword') ?? '')) {
      setMessage(text.mismatch);
      return;
    }
    setBusy(true);
    try {
      const response = await apiRequest('/account/password/change', token, {
        method: 'POST',
        body: JSON.stringify({
          current_password: data.get('currentPassword'),
          new_password: newPassword,
        }),
      });
      const payload = (await response.json()) as {
        access_token?: string;
        error?: { message?: string };
      };
      if (!response.ok || !payload.access_token) {
        setMessage(payload.error?.message ?? 'Could not change password.');
        return;
      }
      window.localStorage.setItem(ACCOUNT_TOKEN_KEY, payload.access_token);
      setToken(payload.access_token);
      form.reset();
      setMessage(extra.passwordChanged);
    } finally {
      setBusy(false);
    }
  }

  if (!account) {
    return (
      <Card className="account-auth">
        <div className="account-mode" aria-label="Account action">
          <Button
            variant={mode === 'login' ? 'primary' : 'secondary'}
            onClick={() => {
              setMode('login');
              setMessage('');
            }}
          >
            {text.signIn}
          </Button>
          <Button
            variant={mode === 'register' ? 'primary' : 'secondary'}
            onClick={() => {
              setMode('register');
              setMessage('');
            }}
          >
            {text.create}
          </Button>
        </div>
        <form onSubmit={submit}>
          {mode === 'register' ? (
            <Input
              label={text.name}
              name="displayName"
              autoComplete="nickname"
              minLength={2}
              maxLength={80}
              required
            />
          ) : null}
          {mode !== 'reset' ? (
            <Input label={text.email} name="email" type="email" autoComplete="email" required />
          ) : (
            <h2>{extra.resetTitle}</h2>
          )}
          {mode !== 'forgot' ? (
            <Input
              label={mode === 'reset' ? extra.newPassword : text.password}
              name="password"
              type="password"
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              minLength={mode === 'login' ? 1 : 12}
              required
            />
          ) : null}
          {mode === 'register' || mode === 'reset' ? (
            <Input
              label={text.confirm}
              name="confirmPassword"
              type="password"
              autoComplete="new-password"
              minLength={12}
              required
            />
          ) : null}
          {message && (
            <p className="account-error" role="alert">
              {message}
            </p>
          )}
          <Button type="submit" disabled={busy}>
            {busy
              ? text.wait
              : mode === 'login'
                ? text.signIn
                : mode === 'register'
                  ? text.create
                  : mode === 'forgot'
                    ? extra.sendReset
                    : extra.resetTitle}
          </Button>
          {mode === 'login' ? (
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setMode('forgot');
                setMessage('');
              }}
            >
              {extra.forgot}
            </Button>
          ) : null}
        </form>
      </Card>
    );
  }

  return (
    <section className="account-dashboard" aria-label={text.account}>
      <Card>
        <div className="account-card-heading">
          <div className="account-identity">
            <button
              className="account-avatar-button"
              type="button"
              aria-label={extra.changeAvatar}
              title={extra.changeAvatar}
              disabled={busy}
              onClick={() => avatarInputRef.current?.click()}
            >
              {avatarUrl ? (
                <Image
                  className="account-avatar"
                  src={avatarUrl}
                  alt=""
                  width={72}
                  height={72}
                  unoptimized
                />
              ) : (
                <span className="account-avatar account-avatar-fallback" aria-hidden="true">
                  {account.display_name.slice(0, 1).toUpperCase()}
                </span>
              )}
              <span className="account-avatar-edit" aria-hidden="true">
                <Camera size={16} />
              </span>
            </button>
            <input
              ref={avatarInputRef}
              className="account-avatar-input"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              aria-label={extra.changeAvatar}
              onChange={(event) => {
                const file = event.currentTarget.files?.[0];
                if (file) void saveAvatar(file);
              }}
            />
            <div>
              <Badge variant="private">{account.plan}</Badge>
              <h2>{account.display_name}</h2>
              <p>{account.email}</p>
            </div>
          </div>
          <Button variant="secondary" onClick={logout}>
            {text.signOut}
          </Button>
        </div>
        {limits && (
          <p>
            <strong>
              {limits.cloud_jobs_used} of {limits.cloud_jobs_limit}
            </strong>{' '}
            {text.used} {new Date(limits.resets_at).toLocaleString(language)}.
          </p>
        )}
      </Card>
      <Card className="account-profile-settings">
        <h2>{extra.profile}</h2>
        <form onSubmit={uploadAvatar}>
          <label>
            {extra.avatar}
            <input name="avatar" type="file" accept="image/jpeg,image/png,image/webp" required />
          </label>
          <Button type="submit" disabled={busy}>
            {extra.uploadAvatar}
          </Button>
        </form>
        <form onSubmit={changePassword}>
          <Input
            label={extra.currentPassword}
            name="currentPassword"
            type="password"
            autoComplete="current-password"
            required
          />
          <Input
            label={extra.newPassword}
            name="newPassword"
            type="password"
            autoComplete="new-password"
            minLength={12}
            required
          />
          <Input
            label={text.confirm}
            name="confirmPassword"
            type="password"
            autoComplete="new-password"
            minLength={12}
            required
          />
          <Button type="submit" disabled={busy}>
            {extra.changePassword}
          </Button>
        </form>
      </Card>
      <Card>
        <h2>{text.history}</h2>
        {jobs.length === 0 ? (
          <p>{text.emptyHistory}</p>
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
                      {text.download}
                    </Button>
                  ) : null}
                  {job.status === 'queued' || job.status === 'running' ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => void cancelHistoryJob(job.id)}
                    >
                      {text.cancel}
                    </Button>
                  ) : null}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
      <Card className="api-key-card">
        <h2>{text.apiTitle}</h2>
        <p>{text.apiLead}</p>
        <form onSubmit={createApiKey}>
          <Input label={text.keyName} name="name" maxLength={80} required />
          <Button type="submit">{text.createKey}</Button>
        </form>
        {createdKey ? (
          <div className="api-key-secret" role="status">
            <strong>{text.copyKey}</strong>
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
                    {key.prefix}… · {text.created}{' '}
                    {new Date(key.created_at).toLocaleString(language)}
                  </small>
                </span>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => void revokeApiKey(key.id)}
                >
                  {text.revoke}
                </Button>
              </li>
            ))}
          </ul>
        ) : (
          <p>{text.noKeys}</p>
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
