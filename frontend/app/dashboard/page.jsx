'use client';

import { useState, useEffect, useMemo, Suspense, useRef } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import EscrowCard from '../../components/escrow/EscrowCard';
import ReputationBadge from '../../components/ui/ReputationBadge';
import Button from '../../components/ui/Button';
import CardSkeleton from '../../components/ui/CardSkeleton';
import PageTransition from '../../components/layout/PageTransition';
import ErrorBoundary from '../../components/error/ErrorBoundary';
import DashboardTour from '../../components/onboarding/DashboardTour';
import { usePerformance } from '../../hooks/usePerformance';
import { useI18n } from '../../i18n/index.jsx';
import { useWalletStore } from '../../store/app-store';

const StatWidgets = dynamic(() => import('../../components/dashboard/StatWidgets'), {
  ssr: false,
  loading: () => (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="card animate-pulse">
          <div className="h-3 w-20 bg-gray-700 rounded mb-3" />
          <div className="h-8 w-16 bg-gray-700 rounded" />
        </div>
      ))}
    </div>
  ),
});

const ActivityTimeline = dynamic(() => import('../../components/dashboard/ActivityTimeline'), {
  loading: () => (
    <div className="card animate-pulse space-y-4">
      <div className="h-5 w-36 bg-gray-700 rounded" />
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="h-3 w-full bg-gray-800 rounded" />
      ))}
    </div>
  ),
});

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
const PINNED_ESCROWS_KEY = 'dashboard-pinned-escrows';
const PINNED_ESCROW_DRAG_TYPE = 'application/dashboard-pinned-escrow-id';

function readPinnedEscrowIds() {
  if (typeof window === 'undefined') return [];

  try {
    const stored = window.localStorage.getItem(PINNED_ESCROWS_KEY);
    const parsed = stored ? JSON.parse(stored) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export default function DashboardPage() {
  const { t } = useI18n();
  const { address } = useWalletStore();
  const router = useRouter();
  const [escrows, setEscrows] = useState([]);
  const [escrowsLoading, setEscrowsLoading] = useState(true);
  const [reputation, setReputation] = useState(null);
  const [pinnedEscrowIds, setPinnedEscrowIds] = useState(readPinnedEscrowIds);
  const [pinnedMessage, setPinnedMessage] = useState('');
  const draggedPinnedIdRef = useRef(null);
  const { measureAsync } = usePerformance('DashboardPage');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(PINNED_ESCROWS_KEY, JSON.stringify(pinnedEscrowIds));
    }
  }, [pinnedEscrowIds]);

  useEffect(() => {
    if (!address) router.replace('/');
  }, [address, router]);

  useEffect(() => {
    if (!address) return;
    setEscrowsLoading(true);
    measureAsync('fetch-escrows', () =>
      fetch(`${API_BASE}/api/users/${address}/escrows?status=Active&limit=6`)
        .then((r) => r.json())
        .then((data) => {
          setEscrows(Array.isArray(data?.escrows) ? data.escrows : []);
        })
        .catch(() => setEscrows([])),
    ).finally(() => setEscrowsLoading(false));
  }, [measureAsync, address]);

  useEffect(() => {
    if (!address) return;
    fetch(`${API_BASE}/api/reputation/${address}`)
      .then((r) => r.json())
      .then((data) => {
        if (!data?.error) setReputation(data);
      })
      .catch(() => {});
  }, [address]);

  const reputationScore = reputation?.totalScore
    ? Math.min(100, Math.round(Number(reputation.totalScore) / 100))
    : null;

  const pinnedEscrows = useMemo(() => {
    const pinnedIds = Array.isArray(pinnedEscrowIds) ? pinnedEscrowIds : [];
    return pinnedIds
      .map((escrowId) => escrows.find((escrow) => escrow.id === escrowId))
      .filter(Boolean);
  }, [escrows, pinnedEscrowIds]);

  const activeEscrows = useMemo(() => {
    const pinnedIds = new Set(Array.isArray(pinnedEscrowIds) ? pinnedEscrowIds : []);
    return escrows.filter((escrow) => !pinnedIds.has(escrow.id));
  }, [escrows, pinnedEscrowIds]);

  const handlePinToggle = (escrowId) => {
    const currentPinned = Array.isArray(pinnedEscrowIds) ? [...pinnedEscrowIds] : [];

    if (currentPinned.includes(escrowId)) {
      setPinnedEscrowIds(currentPinned.filter((id) => id !== escrowId));
      setPinnedMessage('');
      return;
    }

    if (currentPinned.length >= 5) {
      setPinnedMessage('Max 5 pinned');
      return;
    }

    setPinnedEscrowIds([...currentPinned, escrowId]);
    setPinnedMessage('');
  };

  const handlePinnedEscrowReorder = (sourceId, targetId) => {
    if (sourceId === targetId) return;

    setPinnedEscrowIds((currentPinned) => {
      const nextPinned = Array.isArray(currentPinned) ? [...currentPinned] : [];
      const sourceIndex = nextPinned.indexOf(sourceId);
      const targetIndex = nextPinned.indexOf(targetId);

      if (sourceIndex === -1 || targetIndex === -1) return nextPinned;

      const [movedEscrow] = nextPinned.splice(sourceIndex, 1);
      nextPinned.splice(targetIndex, 0, movedEscrow);
      return nextPinned;
    });
  };

  if (!address) return null;

  return (
    <PageTransition>
      <ErrorBoundary>
        <div className="space-y-8" role="main">
          <DashboardTour />

          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-white">{t('nav.dashboard')}</h1>
              <p className="text-gray-400 mt-1">Welcome back.</p>
            </div>
            <div className="flex items-center gap-3">
              {reputationScore !== null && <ReputationBadge score={reputationScore} />}
              <Button
                href="/escrow/create"
                variant="primary"
                data-tour="create-escrow"
                className="focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-gray-950 rounded-lg"
              >
                + {t('escrow.create')}
              </Button>
            </div>
          </div>

          <div
            data-tour="get-testnet-xlm"
            className="card rounded-3xl border border-indigo-500/20 bg-gray-950 p-5 text-sm text-gray-300"
          >
            Connect your wallet and use the Stellar Friendbot faucet to fund testnet XLM for your
            first escrow contract experiments.
          </div>

          <section aria-label="Key performance metrics">
            <h2 className="sr-only">Dashboard Statistics</h2>
            <Suspense fallback={<div className="h-40 card animate-pulse" />}>
              <StatWidgets address={address} />
            </Suspense>
          </section>

          <section aria-label="Recent activity feed">
            <Suspense fallback={<div className="h-40 card animate-pulse" />}>
              <ActivityTimeline address={address} />
            </Suspense>
          </section>

          {pinnedMessage && (
            <div role="status" className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
              {pinnedMessage}
            </div>
          )}

          {pinnedEscrows.length > 0 && (
            <section aria-label="Pinned escrows" role="region">
              <h2 className="text-lg font-semibold text-white mb-4">Pinned Escrows</h2>
              <div className="grid gap-4 md:grid-cols-2" role="list">
                {pinnedEscrows.map((escrow) => (
                  <div
                    key={escrow.id}
                    role="listitem"
                    draggable
                    data-testid={`pinned-escrow-${escrow.id}`}
                    onDragStart={(event) => {
                      const sourceId = Number(escrow.id);
                      draggedPinnedIdRef.current = sourceId;
                      event.dataTransfer.effectAllowed = 'move';
                      event.dataTransfer.setData(PINNED_ESCROW_DRAG_TYPE, String(sourceId));
                      event.dataTransfer.setData('text/plain', String(sourceId));
                    }}
                    onDragOver={(event) => {
                      event.preventDefault();
                    }}
                    onDrop={(event) => {
                      event.preventDefault();
                      const sourceId =
                        Number(event.dataTransfer.getData(PINNED_ESCROW_DRAG_TYPE)) ||
                        Number(event.dataTransfer.getData('text/plain')) ||
                        draggedPinnedIdRef.current;

                      if (sourceId) {
                        handlePinnedEscrowReorder(Number(sourceId), Number(escrow.id));
                      }
                      draggedPinnedIdRef.current = null;
                    }}
                  >
                    <EscrowCard
                      escrow={escrow}
                      isPinned
                      onPinToggle={handlePinToggle}
                    />
                  </div>
                ))}
              </div>
            </section>
          )}

          <section aria-label="Active escrow agreements" data-tour="disputes">
            <h2 className="text-lg font-semibold text-white mb-4">Your Active Escrows</h2>
            {escrowsLoading ? (
              <div className="grid gap-4 md:grid-cols-2">
                <CardSkeleton />
                <CardSkeleton />
                <CardSkeleton />
              </div>
            ) : activeEscrows.length === 0 ? (
              <div className="card text-center py-10">
                <p className="text-gray-400 font-medium">No active escrows yet.</p>
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2" role="list">
                {activeEscrows.map((escrow) => (
                  <div key={escrow.id} role="listitem">
                    <EscrowCard escrow={escrow} isPinned={false} onPinToggle={handlePinToggle} />
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </ErrorBoundary>
    </PageTransition>
  );
}
