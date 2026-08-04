import { getTierBadgeClass, getTierLabel } from '../../utils/creditScore';

export default function Badge({ tier, className = '' }) {
  if (!tier) return null;
  return (
    <span className={`${getTierBadgeClass(tier)} ${className}`}>
      {getTierLabel(tier)}
    </span>
  );
}

export function StatusBadge({ status }) {
  const styles = {
    PAID: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    LATE: 'bg-amber-50 text-amber-700 border-amber-200',
    PARTIAL: 'bg-orange-50 text-orange-700 border-orange-200',
    OVERDUE: 'bg-rose-50 text-rose-700 border-rose-200',
    PENDING: 'bg-slate-50 text-slate-600 border-slate-200',
  };

  return (
    <span className={`badge border ${styles[status] || styles.PENDING}`}>
      {status}
    </span>
  );
}
