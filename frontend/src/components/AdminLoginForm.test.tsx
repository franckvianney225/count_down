import '@testing-library/jest-dom';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import AdminLoginForm from './AdminLoginForm';

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn() }),
}));

jest.mock('@/lib/api', () => ({
  apiCall: jest.fn(),
}));

import { apiCall } from '@/lib/api';

describe('AdminLoginForm', () => {
  beforeEach(() => jest.clearAllMocks());

  it('affiche le formulaire de connexion', () => {
    render(<AdminLoginForm />);
    expect(screen.getByLabelText(/mot de passe/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /se connecter/i })).toBeInTheDocument();
  });

  it('affiche une erreur si le mot de passe est incorrect', async () => {
    (apiCall as jest.Mock).mockRejectedValue(new Error('Mot de passe incorrect'));

    render(<AdminLoginForm />);
    fireEvent.change(screen.getByLabelText(/mot de passe/i), {
      target: { value: 'mauvais' },
    });
    fireEvent.click(screen.getByRole('button', { name: /se connecter/i }));

    await waitFor(() => {
      expect(screen.getByText('Mot de passe incorrect')).toBeInTheDocument();
    });
  });

  it('désactive le bouton pendant la soumission', async () => {
    (apiCall as jest.Mock).mockImplementation(
      () => new Promise(resolve => setTimeout(resolve, 500)),
    );

    render(<AdminLoginForm />);
    fireEvent.change(screen.getByLabelText(/mot de passe/i), {
      target: { value: 'admin123' },
    });
    fireEvent.click(screen.getByRole('button', { name: /se connecter/i }));

    expect(screen.getByRole('button', { name: /connexion/i })).toBeDisabled();
  });
});
