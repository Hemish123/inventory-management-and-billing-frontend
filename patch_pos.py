import re

file_path = '/home/nikita/Desktop/Projects/inventory management billing system/msme-paytrack/frontend/src/pages/retail/POSPage.jsx'
with open(file_path, 'r') as f:
    content = f.read()

# 1. Add states
state_addition = """  const [paymentMethod, setPaymentMethod] = useState('CASH');
  const [amountReceived, setAmountReceived] = useState('');
  const [splitCash, setSplitCash] = useState('');
  const [splitUpi, setSplitUpi] = useState('');
  const [splitCard, setSplitCard] = useState('');"""
content = content.replace("  const [paymentMethod, setPaymentMethod] = useState('CASH');\n  const [amountReceived, setAmountReceived] = useState('');", state_addition)

# 2. Reset form
reset_addition = """    setAmountReceived('');
    setSplitCash('');
    setSplitUpi('');
    setSplitCard('');"""
content = content.replace("    setAmountReceived('');", reset_addition)

# 3. Calculation & change due
calc_replace = """  const changeDue = Math.max(0, (parseFloat(amountReceived) || grandTotal) - grandTotal);"""
calc_new = """  const splitTotal = (parseFloat(splitCash)||0) + (parseFloat(splitUpi)||0) + (parseFloat(splitCard)||0);
  const actualAmountReceived = paymentMethod === 'SPLIT' ? splitTotal : (parseFloat(amountReceived) || grandTotal);
  const changeDue = Math.max(0, actualAmountReceived - grandTotal);"""
content = content.replace(calc_replace, calc_new)

# 4. buildPayload update amount_received
content = content.replace("      amount_received: parseFloat(amountReceived) || grandTotal,", "      amount_received: actualAmountReceived,")

# 5. buildPayload add payments array
payload_addition = """    if (selectedCustomerId) payload.customer_id = selectedCustomerId;
    if (selectedSalesPerson) payload.salesperson_id = selectedSalesPerson;
    
    if (paymentMethod === 'SPLIT') {
      const payments = [];
      if (parseFloat(splitCash) > 0) payments.push({ payment_method: 'CASH', amount: parseFloat(splitCash) });
      if (parseFloat(splitUpi) > 0) payments.push({ payment_method: 'UPI', amount: parseFloat(splitUpi) });
      if (parseFloat(splitCard) > 0) payments.push({ payment_method: 'CARD', amount: parseFloat(splitCard) });
      payload.payments = payments;
    }
    
    return payload;"""
content = content.replace("""    if (selectedCustomerId) payload.customer_id = selectedCustomerId;
    if (selectedSalesPerson) payload.salesperson_id = selectedSalesPerson;
    return payload;""", payload_addition)

# 6. UI insertion
ui_replace = """              {/* Cash Received Row */}
              {paymentMethod === 'CASH' && (
                <div className="bg-emerald-50 p-2 rounded-xl border border-emerald-200 flex items-center justify-between gap-2 shadow-sm shrink-0">
                  <span className="text-xs font-bold text-emerald-800 whitespace-nowrap">Cash Received</span>
                  <input type="number" value={amountReceived} onChange={e => setAmountReceived(e.target.value)} placeholder={grandTotal} className="flex-1 input-field bg-white text-sm font-bold font-mono text-emerald-700 border-emerald-300 py-1 px-2.5 focus:border-emerald-500 shadow-sm text-right" />
                </div>
              )}"""

ui_new = ui_replace + """

              {/* Split Payment Row */}
              {paymentMethod === 'SPLIT' && (
                <div className="bg-indigo-50 p-2 rounded-xl border border-indigo-200 flex flex-col gap-2 shadow-sm shrink-0">
                  <span className="text-xs font-bold text-indigo-800">Split Breakdown</span>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <span className="text-[10px] font-semibold text-indigo-700 block mb-1">Cash</span>
                      <input type="number" value={splitCash} onChange={e => setSplitCash(e.target.value)} placeholder="0" className="w-full input-field bg-white text-xs font-bold font-mono text-indigo-900 border-indigo-300 py-1 px-2 focus:border-indigo-500 shadow-sm text-right" />
                    </div>
                    <div>
                      <span className="text-[10px] font-semibold text-indigo-700 block mb-1">UPI</span>
                      <input type="number" value={splitUpi} onChange={e => setSplitUpi(e.target.value)} placeholder="0" className="w-full input-field bg-white text-xs font-bold font-mono text-indigo-900 border-indigo-300 py-1 px-2 focus:border-indigo-500 shadow-sm text-right" />
                    </div>
                    <div>
                      <span className="text-[10px] font-semibold text-indigo-700 block mb-1">Card</span>
                      <input type="number" value={splitCard} onChange={e => setSplitCard(e.target.value)} placeholder="0" className="w-full input-field bg-white text-xs font-bold font-mono text-indigo-900 border-indigo-300 py-1 px-2 focus:border-indigo-500 shadow-sm text-right" />
                    </div>
                  </div>
                  {splitTotal > 0 && splitTotal !== grandTotal && (
                    <div className="text-[10px] font-bold text-right text-rose-500 mt-1">
                      Total: {splitTotal.toFixed(2)} / {grandTotal.toFixed(2)}
                    </div>
                  )}
                </div>
              )}"""
content = content.replace(ui_replace, ui_new)

# 7. Update bottom checkout total for change due (cash OR split)
change_replace = """            {paymentMethod === 'CASH' && changeDue > 0 && ("""
change_new = """            {['CASH', 'SPLIT'].includes(paymentMethod) && changeDue > 0 && ("""
content = content.replace(change_replace, change_new)

with open(file_path, 'w') as f:
    f.write(content)
print("Patched POSPage.jsx")
