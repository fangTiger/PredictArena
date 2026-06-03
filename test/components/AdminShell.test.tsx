import React from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AdminShell } from '@/components/AdminShell';

describe('AdminShell', () => {
  it('renders the greyscale sidebar links and nested content', () => {
    render(
      <AdminShell>
        <div>Operator placeholder</div>
      </AdminShell>
    );

    expect(screen.getByRole('link', { name: 'Overview' })).toHaveAttribute('href', '/admin');
    expect(screen.getByRole('link', { name: 'Control Room' })).toHaveAttribute(
      'href',
      '/admin/control-room'
    );
    expect(screen.getByRole('link', { name: 'Receipts' })).toHaveAttribute(
      'href',
      '/admin/receipts'
    );
    expect(screen.getByRole('link', { name: 'Resolution' })).toHaveAttribute(
      'href',
      '/admin/resolution'
    );
    expect(screen.getByRole('link', { name: 'Proof' })).toHaveAttribute(
      'href',
      '/admin/proof'
    );
    expect(screen.getByRole('link', { name: 'Health' })).toHaveAttribute(
      'href',
      '/admin/health'
    );
    expect(screen.getByText('Operator placeholder')).toBeInTheDocument();
  });
});
