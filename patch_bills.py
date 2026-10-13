import re

file_path = '/home/nikita/Desktop/Projects/inventory management billing system/msme-paytrack/frontend/src/pages/retail/BillsPage.jsx'
with open(file_path, 'r') as f:
    content = f.read()

# 1. Add Modal import if missing
if "import Modal" not in content:
    content = content.replace("import Table", "import Modal from '../../components/common/Modal';\nimport Table")

# 2. Add state for modal
state_addition = """  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [selectedBillForBreakdown, setSelectedBillForBreakdown] = useState(null);"""
content = content.replace("  const [page, setPage] = useState(1);\n  const [totalCount, setTotalCount] = useState(0);", state_addition)

# 3. Update payment_method render
payment_col_old = """    { key: 'payment_method', label: 'Payment', sortable: true, render: v => (
      <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600">{v}</span>
    )},"""
payment_col_new = """    { key: 'payment_method', label: 'Payment', sortable: true, render: (v, row) => (
      v === 'SPLIT' ? (
        <button onClick={() => setSelectedBillForBreakdown(row)} className="px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wider bg-indigo-100 text-indigo-700 hover:bg-indigo-200 transition-colors shadow-sm">
          SPLIT (VIEW)
        </button>
      ) : (
        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wider bg-slate-100 text-slate-600">{v}</span>
      )
    )},"""
content = content.replace(payment_col_old, payment_col_new)

# 4. Add Modal UI at the bottom
modal_ui = """
      {/* Payment Breakdown Modal */}
      {selectedBillForBreakdown && (
        <Modal title={`Payment Breakdown: ${selectedBillForBreakdown.bill_number}`} onClose={() => setSelectedBillForBreakdown(null)}>
          <div className="p-6">
            <div className="border-b border-slate-100 pb-2 mb-4 flex justify-between text-xs font-bold text-slate-500 uppercase tracking-wider">
              <span>Payment Method</span>
              <span>Amount</span>
            </div>
            <div className="space-y-4">
              {selectedBillForBreakdown.payments?.length > 0 ? (
                selectedBillForBreakdown.payments.map(p => (
                  <div key={p.id} className="flex justify-between items-center">
                    <span className="text-slate-700 font-medium">{p.payment_method}</span>
                    <span className="text-indigo-600 font-bold">{formatCurrency(p.amount)}</span>
                  </div>
                ))
              ) : (
                <div className="text-center text-sm text-slate-400 py-2">No breakdown details available.</div>
              )}
            </div>
            <div className="mt-6 pt-4 border-t border-slate-100 flex justify-between items-center bg-slate-50 p-4 rounded-xl shadow-inner">
              <span className="font-bold text-slate-800">Total Amount</span>
              <span className="font-bold text-indigo-600 text-lg">{formatCurrency(selectedBillForBreakdown.grand_total)}</span>
            </div>
            <div className="mt-6 flex justify-end">
              <button onClick={() => setSelectedBillForBreakdown(null)} className="px-5 py-2 bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-xl font-bold transition-colors">
                Close
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}"""

content = content.replace("    </div>\n  );\n}", modal_ui)

with open(file_path, 'w') as f:
    f.write(content)
print("Patched BillsPage.jsx")
