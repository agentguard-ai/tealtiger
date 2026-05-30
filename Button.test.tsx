import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import Button from '../../components/Button'; // adjust path as needed

describe('Button', () => {
  // 1. Render smoke test
  it('renders with default props', () => {
    render(<Button>Click me</Button>);
    const button = screen.getByRole('button', { name: /click me/i });
    expect(button).toBeInTheDocument();
    expect(button).not.toBeDisabled();
  });

  // 2. onClick handler
  it('calls onClick when clicked', async () => {
    const handleClick = vi.fn();
    const user = userEvent.setup();
    render(<Button onClick={handleClick}>Submit</Button>);
    const button = screen.getByRole('button', { name: /submit/i });
    await user.click(button);
    expect(handleClick).toHaveBeenCalledOnce();
  });

  // 3. Variant classes
  it('applies correct class for variant "primary"', () => {
    render(<Button variant="primary">Primary</Button>);
    const button = screen.getByRole('button', { name: /primary/i });
    expect(button).toHaveClass('btn', 'btn-primary');
  });

  it('applies correct class for variant "secondary"', () => {
    render(<Button variant="secondary">Secondary</Button>);
    const button = screen.getByRole('button', { name: /secondary/i });
    expect(button).toHaveClass('btn', 'btn-secondary');
  });

  it('applies correct class for variant "danger"', () => {
    render(<Button variant="danger">Danger</Button>);
    const button = screen.getByRole('button', { name: /danger/i });
    expect(button).toHaveClass('btn', 'btn-danger');
  });

  // 4. Disabled state
  it('disables button and prevents click', async () => {
    const handleClick = vi.fn();
    const user = userEvent.setup();
    render(
      <Button disabled onClick={handleClick}>
        Disabled
      </Button>
    );
    const button = screen.getByRole('button', { name: /disabled/i });
    expect(button).toBeDisabled();
    await user.click(button);
    expect(handleClick).not.toHaveBeenCalled();
  });

  // 5. Custom className
  it('merges custom className with component classes', () => {
    render(<Button className="my-custom-class">Custom</Button>);
    const button = screen.getByRole('button', { name: /custom/i });
    expect(button).toHaveClass('btn', 'my-custom-class');
  });
});