import React, { useState } from 'react';
import type { Account } from '../../lib/schemas';
import {
  calculateDebtPlan,
  type DebtStrategy,
} from '../../lib/debtPlanner';

export interface DebtPlannerCardProps {
  accounts: Account[];
  onPayDebt?: (targetAccountId: string, suggestedAmount: number) => void;
}

const PRESET_ALLOCATIONS = [500000, 1000000, 2000000, 5000000];

function formatIdr(amount: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(amount);
}

export const DebtPlannerCard: React.FC<DebtPlannerCardProps> = ({ accounts, onPayDebt }) => {
  const [strategy, setStrategy] = useState<DebtStrategy>('snowball');
  const [monthlyAllocation, setMonthlyAllocation] = useState<number>(2000000);
  const [isCustomAlloc, setIsCustomAlloc] = useState<boolean>(false);
  const [customInput, setCustomInput] = useState<string>('');
  const [isExpanded, setIsExpanded] = useState<boolean>(true);

  const plan = calculateDebtPlan(accounts, monthlyAllocation, strategy);

  // If no debt at all
  if (plan.totalDebt === 0) {
    return (
      <div className="debt-planner-card debt-free-card">
        <div className="debt-free-content">
          <span className="debt-free-icon">🎉</span>
          <div>
            <h3 className="debt-free-title">Bebas Hutang!</h3>
            <p className="debt-free-sub">Semua akun liabilitas dan PayLater Anda bersaldo Rp 0.</p>
          </div>
        </div>
      </div>
    );
  }

  const focusItem = plan.items[0];
  const upcomingItems = plan.items.slice(1);

  return (
    <div className="debt-planner-card">
      {/* Header */}
      <div className="debt-planner-header">
        <div className="debt-planner-title-group">
          <span className="debt-planner-icon">🛡️</span>
          <div>
            <h3 className="debt-planner-title">Rencana Bebas Hutang</h3>
            <p className="debt-planner-sub">
              Total {plan.items.length} pinjaman berjalan:{' '}
              <strong className="debt-total-text">{formatIdr(plan.totalDebt)}</strong>
            </p>
          </div>
        </div>
        <button
          type="button"
          className="debt-toggle-btn"
          onClick={() => setIsExpanded(!isExpanded)}
          aria-label={isExpanded ? 'Sembunyikan' : 'Tampilkan'}
        >
          {isExpanded ? '▲' : '▼'}
        </button>
      </div>

      {isExpanded && (
        <div className="debt-planner-body">
          {/* Strategy Pills */}
          <div className="debt-strategy-section">
            <span className="debt-section-label">Pilih Strategi:</span>
            <div className="debt-strategy-pills">
              <button
                type="button"
                className={`debt-strategy-pill ${strategy === 'snowball' ? 'active' : ''}`}
                onClick={() => setStrategy('snowball')}
              >
                ❄️ Snowball (Saldo Terkecil)
              </button>
              <button
                type="button"
                className={`debt-strategy-pill ${strategy === 'avalanche' ? 'active' : ''}`}
                onClick={() => setStrategy('avalanche')}
              >
                ⚡ Avalanche (Bunga & Biaya)
              </button>
            </div>
          </div>

          {/* Monthly Allocation Presets */}
          <div className="debt-alloc-section">
            <span className="debt-section-label">Alokasi Cicilan per Bulan:</span>
            <div className="debt-alloc-presets">
              {PRESET_ALLOCATIONS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  className={`debt-alloc-pill ${!isCustomAlloc && monthlyAllocation === preset ? 'active' : ''}`}
                  onClick={() => {
                    setMonthlyAllocation(preset);
                    setIsCustomAlloc(false);
                  }}
                >
                  {preset >= 1000000 ? `${preset / 1000000} Jt` : `${preset / 1000} Rb`}
                </button>
              ))}
              <button
                type="button"
                className={`debt-alloc-pill ${isCustomAlloc ? 'active' : ''}`}
                onClick={() => setIsCustomAlloc(true)}
              >
                Kustom
              </button>
            </div>

            {isCustomAlloc && (
              <div className="debt-custom-alloc-input">
                <span className="input-prefix">Rp</span>
                <input
                  type="text"
                  inputMode="numeric"
                  className="form-input"
                  placeholder="Masukkan nominal alokasi"
                  value={customInput}
                  onChange={(e) => {
                    const raw = e.target.value.replace(/\D/g, '');
                    setCustomInput(raw ? new Intl.NumberFormat('id-ID').format(parseInt(raw, 10)) : '');
                    if (raw) {
                      setMonthlyAllocation(parseInt(raw, 10));
                    }
                  }}
                />
              </div>
            )}
          </div>

          {/* Projection Banner */}
          <div className="debt-projection-banner">
            <div className="debt-projection-left">
              <span className="debt-projection-flag">🏁</span>
              <div>
                <span className="debt-projection-label">Estimasi Bebas Hutang</span>
                <strong className="debt-projection-val">{plan.debtFreeDateLabel}</strong>
              </div>
            </div>
            <div className="debt-projection-pace">
              Pace: <strong>{formatIdr(plan.monthlyAllocation)}/bln</strong>
            </div>
          </div>

          {/* Current Focus Target #1 */}
          {focusItem && (
            <div className="debt-focus-card">
              <div className="debt-focus-badge">🎯 FOKUS UTAMA #{1}</div>
              <div className="debt-focus-main">
                <div className="debt-focus-info">
                  <span className="debt-focus-icon">{focusItem.icon || '💳'}</span>
                  <div>
                    <strong className="debt-focus-name">{focusItem.name}</strong>
                    <div className="debt-focus-meta">
                      Sisa: <span className="debt-amount-highlight">{formatIdr(focusItem.remainingDebt)}</span>
                      <span className="debt-meta-bullet">•</span>
                      Target lunas: {focusItem.payoffDateLabel}
                    </div>
                  </div>
                </div>
                {onPayDebt && (
                  <button
                    type="button"
                    className="debt-pay-action-btn"
                    onClick={() =>
                      onPayDebt(
                        focusItem.accountId,
                        Math.min(plan.monthlyAllocation, focusItem.remainingDebt)
                      )
                    }
                  >
                    Bayar Cicilan
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Upcoming Targets Queue */}
          {upcomingItems.length > 0 && (
            <div className="debt-queue-container">
              <span className="debt-queue-title">Antrean Pelunasan Berikutnya:</span>
              <div className="debt-queue-list">
                {upcomingItems.map((item, idx) => (
                  <div key={item.accountId} className="debt-queue-item">
                    <span className="debt-queue-step">#{idx + 2}</span>
                    <span className="debt-queue-icon">{item.icon || '💳'}</span>
                    <div className="debt-queue-details">
                      <span className="debt-queue-name">{item.name}</span>
                      <span className="debt-queue-val">{formatIdr(item.remainingDebt)}</span>
                    </div>
                    <span className="debt-queue-eta">{item.payoffDateLabel}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
