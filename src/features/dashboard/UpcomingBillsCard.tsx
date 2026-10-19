import React from 'react';
import type { Account } from '../../lib/schemas';
import { getUpcomingBills, type UpcomingBill } from '../../lib/bills';
import { formatIdr } from '../../lib/formatters';

interface UpcomingBillsCardProps {
  accounts: Account[];
  onPayBill: (bill: UpcomingBill) => void;
}

export const UpcomingBillsCard: React.FC<UpcomingBillsCardProps> = ({ accounts, onPayBill }) => {
  const upcomingBills = React.useMemo(() => {
    return getUpcomingBills(accounts);
  }, [accounts]);

  if (upcomingBills.length === 0) return null;

  return (
    <div className="upcoming-bills-card" role="region" aria-label="Pengingat Tagihan & PayLater">
      <div className="upcoming-bills-header">
        <div className="upcoming-bills-title-wrap">
          <span className="upcoming-bills-icon" aria-hidden="true">🗓️</span>
          <span className="upcoming-bills-title">Pengingat Tagihan & PayLater</span>
        </div>
        <span className="upcoming-bills-count-badge">
          {upcomingBills.length} Tagihan
        </span>
      </div>

      <div className="upcoming-bills-list">
        {upcomingBills.map((bill) => {
          const isOverdue = bill.urgency === 'overdue';

          let countdownLabel = `Jatuh tempo ${bill.daysLeft} hari lagi`;
          if (isOverdue) {
            countdownLabel = `⚠️ Lewat jatuh tempo (${Math.abs(bill.daysLeft)} hari lalu)`;
          } else if (bill.daysLeft === 0) {
            countdownLabel = '🚨 Jatuh tempo HARI INI';
          } else if (bill.daysLeft === 1) {
            countdownLabel = '⚡ Jatuh tempo BESOK';
          }

          return (
            <div key={bill.accountId} className={`upcoming-bill-item ${bill.urgency}`}>
              <div className="upcoming-bill-info">
                <div className="upcoming-bill-name-row">
                  <span className="upcoming-bill-acc-icon">{bill.accountIcon || '💳'}</span>
                  <span className="upcoming-bill-acc-name">{bill.accountName}</span>
                </div>
                <div className="upcoming-bill-sub-row">
                  <span className="upcoming-bill-amount">{formatIdr(bill.amount)}</span>
                  <span className={`upcoming-bill-badge ${bill.urgency}`}>
                    {countdownLabel}
                  </span>
                </div>
              </div>

              <button
                type="button"
                className="upcoming-bill-pay-btn"
                onClick={() => onPayBill(bill)}
                aria-label={`Bayar tagihan ${bill.accountName} sebesar ${formatIdr(bill.amount)}`}
              >
                Bayar
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};
