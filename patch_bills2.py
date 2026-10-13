import re

file_path = '/home/nikita/Desktop/Projects/inventory management billing system/msme-paytrack/frontend/src/pages/retail/BillsPage.jsx'
with open(file_path, 'r') as f:
    content = f.read()

# 1. Add Info to lucide-react imports if it's missing
if "Info" not in content.split("lucide-react")[0]:
    content = content.replace("Search, ", "Search, Info, ")

# 2. Update payment_method render
payment_col_old = """    { key: 'payment_method', label: 'Payment', sortable: true, render: (v, row) => (
      v === 'SPLIT' ? (
        <button onClick={() => setSelectedBillForBreakdown(row)} className="px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wider bg-indigo-100 text-indigo-700 hover:bg-indigo-200 transition-colors shadow-sm">
          SPLIT (VIEW)
        </button>
      ) : (
        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wider bg-slate-100 text-slate-600">{v}</span>
      )
    )},"""
payment_col_new = """    { key: 'payment_method', label: 'Payment', sortable: true, render: (v, row) => (
      v === 'SPLIT' ? (
        <div className="flex items-center gap-1.5">
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wider bg-slate-100 text-slate-600">{v}</span>
          <button onClick={() => setSelectedBillForBreakdown(row)} className="text-slate-400 hover:text-indigo-600 transition-colors outline-none flex items-center justify-center">
            <Info className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wider bg-slate-100 text-slate-600">{v}</span>
      )
    )},"""
content = content.replace(payment_col_old, payment_col_new)

with open(file_path, 'w') as f:
    f.write(content)
print("Patched BillsPage.jsx with Info icon")
