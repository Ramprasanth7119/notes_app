import { useState } from 'react';
import { Link } from 'react-router-dom';
import { BsEye, BsEyeSlash } from 'react-icons/bs';
import { useAuth } from '../contexts/auth';
import Field from '../components/ui/Field';
import ThemeToggle from '../components/ui/ThemeToggle';

const COPY = {
  login: {
    title: 'Welcome back',
    subtitle: 'Log in to your notes.',
    submit: 'Log in',
    busy: 'Logging in…',
    switchText: 'New here?',
    switchLink: 'Create an account',
    switchTo: '/register'
  },
  register: {
    title: 'Create your account',
    subtitle: 'Your notes are private to your account.',
    submit: 'Create account',
    busy: 'Creating account…',
    switchText: 'Already have an account?',
    switchLink: 'Log in',
    switchTo: '/login'
  }
};

export default function AuthPage({ mode }) {
  const copy = COPY[mode];
  const { login, register } = useAuth();
  const [form, setForm] = useState({ email: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const fieldErrors = error?.fieldErrors || {};
  const update = (field) => (event) => setForm((current) => ({ ...current, [field]: event.target.value }));

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await (mode === 'login' ? login(form) : register(form));
      // The PublicOnly route guard redirects once the user is authenticated.
    } catch (err) {
      setError(err);
      setSubmitting(false);
    }
  };

  return (
    <div className="auth">
      <div className="auth__theme">
        <ThemeToggle />
      </div>
      <div className="auth__card">
        <div className="brand brand--large" aria-hidden="true">
          <span className="brand__mark">N</span>
          <span className="brand__name">Notes</span>
        </div>
        <h1 className="auth__title">{copy.title}</h1>
        <p className="muted">{copy.subtitle}</p>

        <form className="stack" onSubmit={handleSubmit} noValidate>
          {error && !error.details.length && (
            <p className="alert" role="alert">
              {error.message}
            </p>
          )}

          <Field label="Email" error={fieldErrors.email}>
            {(props) => (
              <input
                {...props}
                className="input"
                type="email"
                autoComplete="email"
                value={form.email}
                onChange={update('email')}
                required
              />
            )}
          </Field>

          <Field
            label="Password"
            hint={mode === 'register' ? 'At least 8 characters.' : undefined}
            error={fieldErrors.password}
          >
            {(props) => (
              <div className="input-group">
                <input
                  {...props}
                  className="input"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                  value={form.password}
                  onChange={update('password')}
                  required
                />
                <button
                  type="button"
                  className="icon-button input-group__button"
                  onClick={() => setShowPassword((value) => !value)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <BsEyeSlash aria-hidden="true" /> : <BsEye aria-hidden="true" />}
                </button>
              </div>
            )}
          </Field>

          <button type="submit" className="button button--primary button--block" disabled={submitting}>
            {submitting ? copy.busy : copy.submit}
          </button>
        </form>

        <p className="auth__switch muted">
          {copy.switchText} <Link to={copy.switchTo}>{copy.switchLink}</Link>
        </p>
      </div>
    </div>
  );
}
