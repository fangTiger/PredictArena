import React from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { HomeTransitionFooter } from '@/components/HomeTransitionFooter';

describe('HomeTransitionFooter', () => {
  it('renders a link to /arena with the Enter Arena label', () => {
    render(<HomeTransitionFooter />);

    const link = screen.getByRole('link', { name: /enter arena/i });
    expect(link).toHaveAttribute('href', '/arena');
  });
});
