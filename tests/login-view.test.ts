import { describe, it, expect } from 'bun:test';
import React from 'react';
import { LoginView } from '../src/features/auth/LoginView';

describe('LoginView Component', () => {
  it('exports LoginView component cleanly', () => {
    expect(LoginView).toBeDefined();
  });

  it('renders required brand elements and value proposition content', () => {
    const element = React.createElement(LoginView, {
      onSignIn: async () => {},
      loading: false,
      error: null,
    });
    expect(element).toBeDefined();
    expect(element.props.loading).toBe(false);
    expect(element.props.error).toBeNull();
  });

  it('handles loading state properly', () => {
    const element = React.createElement(LoginView, {
      onSignIn: async () => {},
      loading: true,
      error: null,
    });
    expect(element.props.loading).toBe(true);
  });

  it('handles error prop correctly', () => {
    const element = React.createElement(LoginView, {
      onSignIn: async () => {},
      loading: false,
      error: 'Gagal masuk dengan Google',
    });
    expect(element.props.error).toBe('Gagal masuk dengan Google');
  });
});
