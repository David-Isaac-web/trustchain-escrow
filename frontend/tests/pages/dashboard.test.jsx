import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import DashboardPage from '../../app/dashboard/page';
import { renderWithAppProviders } from '../test-utils';

const CONNECTED_WALLET = { address: 'GABCD1234', isConnected: true };

function renderDashboard() {
  return renderWithAppProviders(<DashboardPage />, { wallet: CONNECTED_WALLET });
}

beforeEach(() => {
  global.fetch = jest.fn((url) => {
    if (url.includes('/api/users/GABCD1234/escrows')) {
      return Promise.resolve({
        ok: true,
        json: async () => ({
          escrows: [
            {
              id: 1,
              title: 'Logo Design Project',
              status: 'Active',
              totalAmount: '1,250 USDC',
              milestoneProgress: '1 / 3',
              counterparty: 'GFREE1...1234',
              role: 'client',
            },
            {
              id: 2,
              title: 'Smart Contract Audit',
              status: 'Active',
              totalAmount: '3,000 USDC',
              milestoneProgress: '2 / 4',
              counterparty: 'GFREE2...5678',
              role: 'client',
            },
            {
              id: 3,
              title: 'Mobile App UX Review',
              status: 'Active',
              totalAmount: '2,200 USDC',
              milestoneProgress: '1 / 2',
              counterparty: 'GFREE3...9012',
              role: 'freelancer',
            },
            {
              id: 4,
              title: 'Brand Identity Refresh',
              status: 'Active',
              totalAmount: '1,900 USDC',
              milestoneProgress: '3 / 5',
              counterparty: 'GFREE4...3456',
              role: 'client',
            },
            {
              id: 5,
              title: 'Tokenomics Model',
              status: 'Active',
              totalAmount: '4,100 USDC',
              milestoneProgress: '2 / 3',
              counterparty: 'GFREE5...7890',
              role: 'freelancer',
            },
            {
              id: 6,
              title: 'Market Research Sprint',
              status: 'Active',
              totalAmount: '2,900 USDC',
              milestoneProgress: '1 / 4',
              counterparty: 'GFREE6...2468',
              role: 'client',
            },
          ],
        }),
      });
    }

    if (url.includes('/api/reputation/GABCD1234')) {
      return Promise.resolve({
        ok: true,
        json: async () => ({ totalScore: 8700 }),
      });
    }

    if (url.includes('/api/escrows/stats/GABCD1234')) {
      return Promise.resolve({
        ok: true,
        json: async () => ({
          total: 7,
          active: 2,
          completed: 4,
          disputed: 1,
          totalValueLocked: '42500000',
          successRate: 80,
        }),
      });
    }

    if (url.includes('/api/escrows/activity/GABCD1234')) {
      return Promise.resolve({
        ok: true,
        json: async () => ({
          escrows: [
            {
              id: 1,
              status: 'Active',
              updatedAt: new Date().toISOString(),
              clientAddress: 'GABCD1234',
              freelancerAddress: 'GFREE1ADDRESS',
              totalAmount: '12500000',
            },
          ],
        }),
      });
    }

    return Promise.resolve({
      ok: true,
      json: async () => ({}),
    });
  });
});

afterEach(() => {
  jest.clearAllMocks();
  window.localStorage.clear();
});

describe('DashboardPage', () => {
  it('renders stat cards', async () => {
    renderDashboard();
    expect(await screen.findByText('Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Welcome back.')).toBeInTheDocument();
  });

  it('renders fetched stats values', async () => {
    renderDashboard();
    const totalEscrowsMetric = await screen.findByRole('region', {
      name: /total escrows metric/i,
    });
    const completedMetric = screen.getByRole('region', { name: /completed metric/i });

    expect(totalEscrowsMetric).toHaveTextContent('7');
    expect(completedMetric).toHaveTextContent('4');
  });

  it('renders active escrows section', async () => {
    renderDashboard();
    await screen.findByText('Logo Design Project');
    expect(screen.getByText('Your Active Escrows')).toBeInTheDocument();
  });

  it('renders a pinned section and supports pinning and unpinning', async () => {
    renderDashboard();
    const pinButtons = await screen.findAllByRole('button', { name: /pin escrow/i });

    fireEvent.click(pinButtons[0]);
    fireEvent.click(pinButtons[1]);

    expect(screen.getByText('Pinned Escrows')).toBeInTheDocument();
    expect(screen.getByText('Logo Design Project')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /unpin escrow/i }).length).toBeGreaterThan(0);

    fireEvent.click(screen.getAllByRole('button', { name: /unpin escrow/i })[0]);
    expect(screen.queryByText('Pinned Escrows')).not.toBeInTheDocument();
  });

  it('enforces the maximum of 5 pinned escrows', async () => {
    window.localStorage.setItem('dashboard-pinned-escrows', JSON.stringify([1, 2, 3, 4, 5]));
    renderDashboard();

    await waitFor(() => {
      expect(screen.getAllByRole('button', { name: /pin escrow/i }).length).toBeGreaterThan(0);
    });

    const sixthPinButton = screen.getAllByRole('button', { name: /pin escrow/i }).at(-1);
    fireEvent.click(sixthPinButton);

    await waitFor(() => {
      expect(screen.getByText('Max 5 pinned')).toBeInTheDocument();
      expect(JSON.parse(window.localStorage.getItem('dashboard-pinned-escrows') || '[]')).toHaveLength(5);
    });
  });

  it('preserves pinned order and supports drag-and-drop reordering', async () => {
    window.localStorage.setItem('dashboard-pinned-escrows', JSON.stringify([1, 2]));
    renderDashboard();

    await screen.findByText('Logo Design Project');
    const pinnedSection = await screen.findByRole('region', { name: /pinned escrows/i });
    const firstPinned = within(pinnedSection).getByTestId('pinned-escrow-1');
    const secondPinned = within(pinnedSection).getByTestId('pinned-escrow-2');
    const dataTransfer = {
      effectAllowed: 'move',
      values: {},
      setData: jest.fn((type, value) => {
        dataTransfer.values[type] = value;
      }),
      getData: jest.fn((type) => dataTransfer.values[type] || ''),
    };

    fireEvent.dragStart(firstPinned, { dataTransfer });
    fireEvent.dragOver(secondPinned, { dataTransfer });
    fireEvent.drop(secondPinned, { dataTransfer });

    await waitFor(() => {
      expect(JSON.parse(window.localStorage.getItem('dashboard-pinned-escrows') || '[]')).toEqual([2, 1]);
    });
  });

  it('renders escrow cards', async () => {
    renderDashboard();
    expect(await screen.findByText('Logo Design Project')).toBeInTheDocument();
    expect(screen.getByText('Smart Contract Audit')).toBeInTheDocument();
  });

  it('renders New Escrow button', async () => {
    renderDashboard();
    await screen.findByText('Logo Design Project');
    expect(screen.getByRole('link', { name: '+ Create Escrow' })).toBeInTheDocument();
  });

  it('renders reputation badge', async () => {
    renderDashboard();
    expect(await screen.findByText('87')).toBeInTheDocument();
  });
});
