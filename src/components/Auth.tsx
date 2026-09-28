"use client";

import { useState } from 'react';

type AuthUser = { name: string; email: string };
type AuthResponse = { user?: AuthUser; access_token?: string; message?: string };

export default function Auth({ onAuthenticated }: { onAuthenticated: (user: AuthUser, token: string) => void }) {
  const [isLogin, setIsLogin] = useState(true);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const endpoint = isLogin ? '/api/login' : '/api/register';
    const body = isLogin ? { email, password } : { name, email, password };

    try {
      const res = await fetch(`https://gameapi.jinskadamthodu.com${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify(body),
      });

      const data = await res.json() as AuthResponse;

      if (!res.ok) {
        throw new Error(data.message || 'Authentication failed');
      }
      if (!data.user || !data.access_token) {
        throw new Error('Authentication response was incomplete');
      }

      // Automatically authenticate the user and return the token
      onAuthenticated(data.user, data.access_token);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="multiplayer-lobby" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
      <form className="lobby-card" onSubmit={handleSubmit}>
        <span className="lobby-eyebrow">ETHERA ACCOUNT</span>
        <h2>{isLogin ? 'Welcome Back' : 'Create an Account'}</h2>

        {!isLogin && (
          <label>
            Name
            <input type="text" value={name} onChange={e => setName(e.target.value)} required />
          </label>
        )}
        <label>
          Email
          <input type="email" value={email} onChange={e => setEmail(e.target.value)} required />
        </label>
        <label>
          Password
          <input type="password" value={password} onChange={e => setPassword(e.target.value)} required />
        </label>

        <button disabled={loading}>{loading ? 'Please wait...' : (isLogin ? 'Sign In' : 'Register')}</button>

        {error && <p role="alert" className="lobby-error">{error}</p>}

        <p style={{ marginTop: '1rem', textAlign: 'center', fontSize: '0.9rem' }}>
          {isLogin ? "Don't have an account? " : "Already have an account? "}
          <button type="button" onClick={() => setIsLogin(!isLogin)} style={{ background: 'none', border: 'none', color: '#38bdf8', cursor: 'pointer', textDecoration: 'underline', padding: 0 }}>
            {isLogin ? 'Register' : 'Sign In'}
          </button>
        </p>
      </form>
    </div>
  );
}
