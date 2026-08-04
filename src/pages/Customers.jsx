import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { getCustomers, deleteCustomer } from '../api/customerAPI';
import { setCustomers, setLoading } from '../store/customerSlice';
import Navbar from '../components/common/Navbar';
import Table from '../components/common/Table';
import { SkeletonTable } from '../components/common/LoadingSpinner';
import { useDebounce } from '../hooks/useDebounce';
import { formatDate } from '../utils/formatters';
import { Search, ChevronLeft, ChevronRight, Plus, Pencil, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';

export default function Customers() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { customers, loading, filters, totalCount } = useSelector((s) => s.customers);
  const [search, setSearch] = useState(filters.search || '');
  const [page, setPage] = useState(1);
  const debouncedSearch = useDebounce(search, 400);

  useEffect(() => { loadCustomers(); }, [debouncedSearch, page]);

  const loadCustomers = async () => {
    dispatch(setLoading(true));
    const params = { page, page_size: 20 };
    if (debouncedSearch) params.search = debouncedSearch;
    const { data } = await getCustomers(params);
    if (data?.data) dispatch(setCustomers(data.data));
    dispatch(setLoading(false));
  };

  const handleDelete = async (e, customerId, customerName) => {
    e.stopPropagation();
    if (!window.confirm(`Are you sure you want to delete "${customerName}"?`)) return;
    const { error } = await deleteCustomer(customerId);
    if (error) {
      toast.error(typeof error === 'string' ? error : 'Failed to delete customer. They may have linked invoices.');
    } else {
      toast.success(`"${customerName}" deleted successfully.`);
      loadCustomers();
    }
  };

  const columns = [
    { key: 'name', label: 'Customer', sortable: true, render: (val, row) => (
      <div>
        <p className="font-medium text-slate-800">{val}</p>
        <p className="text-xs text-slate-400">{row.company}</p>
      </div>
    )},
    { key: 'email', label: 'Email', sortable: true },
    { key: 'phone', label: 'Phone', sortable: false },
    { key: 'gstin', label: 'GSTIN', sortable: false },
    { key: 'created_at', label: 'Created', sortable: true, render: (val) => formatDate(val) },
    { key: 'actions', label: 'Actions', sortable: false, render: (_, row) => (
      <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
        <button onClick={(e) => { e.stopPropagation(); navigate(`/customers/edit/${row.id}`); }}
          className="p-1.5 text-amber-600 hover:bg-amber-50 rounded-full transition-colors" title="Edit">
          <Pencil className="w-4 h-4" />
        </button>
        <button onClick={(e) => handleDelete(e, row.id, row.name)}
          className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-full transition-colors" title="Delete">
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    )},
  ];

  const totalPages = Math.ceil(totalCount / 20);

  return (
    <div className="flex-1 overflow-y-auto">
      <Navbar title="Customers" />
      <div className="p-6 space-y-6">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input type="text" value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              placeholder="Search customers..."
              className="input-field pl-10" />
          </div>
          <button onClick={() => navigate('/customers/add')} className="flex items-center gap-2 px-4 py-2.5 bg-[#1a2744] text-white rounded-lg text-sm font-semibold hover:bg-[#243352] transition-all shadow-md whitespace-nowrap">
            <Plus className="w-4 h-4" /> Add Customer
          </button>
        </div>

        <div className="glass-card overflow-hidden">
          {loading ? <div className="p-6"><SkeletonTable rows={8} cols={6} /></div> : (
            <Table columns={columns} data={customers || []}
              onRowClick={(row) => navigate(`/customers/edit/${row.id}`)} />
          )}
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-500">{totalCount} customers total</p>
            <div className="flex items-center gap-2">
              <button onClick={() => setPage(Math.max(1, page - 1))} disabled={page === 1}
                className="btn-secondary py-2 px-3 disabled:opacity-30"><ChevronLeft className="w-4 h-4" /></button>
              <span className="text-sm text-slate-600">Page {page} of {totalPages}</span>
              <button onClick={() => setPage(Math.min(totalPages, page + 1))} disabled={page === totalPages}
                className="btn-secondary py-2 px-3 disabled:opacity-30"><ChevronRight className="w-4 h-4" /></button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
