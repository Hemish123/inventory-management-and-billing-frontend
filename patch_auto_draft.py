import re

file_path = '/home/nikita/Desktop/Projects/inventory management billing system/msme-paytrack/frontend/src/pages/retail/POSPage.jsx'
with open(file_path, 'r') as f:
    content = f.read()

auto_save_logic = """  const holdBillRef = useRef(null);
  holdBillRef.current = handleHoldBill;

  // --- Auto Save Draft on Unmount ---
  const autoSaveRef = useRef(null);
  useEffect(() => {
    if (cart.length > 0 && selectedBranch) {
      autoSaveRef.current = {
        payload: buildPayload(true),
        draftId: activeDraftId
      };
    } else {
      autoSaveRef.current = null;
    }
  }); // runs every render to keep ref updated

  useEffect(() => {
    return () => {
      // Component unmounting
      if (autoSaveRef.current) {
        const { payload, draftId } = autoSaveRef.current;
        if (draftId) {
          discardDraft(draftId).then(() => createBill(payload)).catch(() => {});
        } else {
          createBill(payload).catch(() => {});
        }
      }
    };
  }, []);
  // ----------------------------------"""

# The script replaces "holdBillRef.current = handleHoldBill;" with the new logic.
content = content.replace("  holdBillRef.current = handleHoldBill;", auto_save_logic)

with open(file_path, 'w') as f:
    f.write(content)
print("Patched auto save logic.")
