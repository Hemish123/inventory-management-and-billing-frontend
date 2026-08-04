import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../../components/common/Navbar';
import Table from '../../components/common/Table';
import { SkeletonTable } from '../../components/common/LoadingSpinner';
import { getBills, voidBill } from '../../api/billingAPI';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { Search, XCircle, FileText, PlayCircle } from 'lucide-react';
import toast from 'react-hot-toast';

export default function BillsPage() {
  const [bills, setBills] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const navigate = useNavigate();

  useEffect(() => { loadBills(); }, []);

  const loadBills = async () => {
    setLoading(true);
    const { data } = await getBills();
    if (data?.data) setBills(Array.isArray(data.data) ? data.data : data.data.results || []);
    setLoading(false);
  };

  const handleVoid = async (id, billNumber) => {
    if (!window.confirm(`Void bill ${billNumber}? This will restore stock.`)) return;
    const { error } = await voidBill(id);
    if (error) toast.error(error);
    else { toast.success(`Bill ${billNumber} voided`); loadBills(); }
  };

  const filtered = bills.filter(b =>
    b.bill_number?.toLowerCase().includes(search.toLowerCase()) ||
    b.customer_name?.toLowerCase().includes(search.toLowerCase()) ||
    b.cashier_name?.toLowerCase().includes(search.toLowerCase())
  );

  const columns = [
    { key: 'bill_number', label: 'Bill #', sortable: true, render: v => (
      <span className="font-mono text-sm font-semibold text-indigo-600">{v}</span>
    )},
    { key: 'customer_name', label: 'Customer', sortable: true },
    { key: 'branch_name', label: 'Branch', sortable: true },
    { key: 'cashier_name', label: 'Cashier', sortable: true, render: v => v ? (
      <span className="text-xs text-slate-500 font-medium">{v}</span>
    ) : <span className="text-slate-300">—</span> },
    { key: 'grand_total', label: 'Total', sortable: true, render: v => formatCurrency(v) },
    { key: 'payment_method', label: 'Payment', sortable: true, render: v => (
      <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600">{v}</span>
    )},
    { key: 'status', label: 'Status', sortable: true, render: v => (
      <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
        v === 'COMPLETED' ? 'bg-emerald-50 text-emerald-700' :
        v === 'VOID' ? 'bg-rose-50 text-rose-700' : 'bg-amber-50 text-amber-700'
      }`}>{v === 'HOLD' ? 'DRAFT' : v}</span>
    )},
    { key: 'billing_date', label: 'Date', sortable: true, render: v => formatDate(v) },
    { key: 'actions', label: '', render: (_, row) => (
      <div className="flex gap-2 justify-end">
        {row.status === 'HOLD' && (
          <button onClick={() => navigate(`/pos?draftId=${row.id}`)}
            className="p-1.5 text-indigo-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-full transition-colors" title="Resume Bill">
            <PlayCircle className="w-5 h-5" />
          </button>
        )}
        {row.status !== 'VOID' && (
          <button onClick={() => handleVoid(row.id, row.bill_number)}
            className="p-1.5 text-rose-400 hover:text-rose-600 hover:bg-rose-50 rounded-full transition-colors" title="Void Bill">
            <XCircle className="w-5 h-5" />
          </button>
        )}
      </div>
    )},
  ];

  return (
    <div className="flex-1 overflow-y-auto">
      <Navbar title="Bills History" />
      <div className="p-6 space-y-6">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search by bill, customer, or cashier..." className="input-field pl-10" />
        </div>
        <div className="glass-card overflow-hidden">
          {loading ? <div className="p-6"><SkeletonTable rows={8} cols={7} /></div> : (
            <Table columns={columns} data={filtered} />
          )}
        </div>
      </div>
    </div>
  );
}
