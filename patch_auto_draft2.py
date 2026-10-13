import re

file_path = '/home/nikita/Desktop/Projects/inventory management billing system/msme-paytrack/frontend/src/pages/retail/POSPage.jsx'
with open(file_path, 'r') as f:
    content = f.read()

visibility_logic = """
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden' && autoSaveRef.current) {
        const { payload, draftId } = autoSaveRef.current;
        if (draftId) {
          // Fire and forget using standard fetch
          discardDraft(draftId).then(() => createBill(payload)).catch(() => {});
        } else {
          createBill(payload).catch(() => {});
        }
      }
    };
    window.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      window.removeEventListener('visibilitychange', handleVisibilityChange);
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
"""

old_unmount_logic = """  useEffect(() => {
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
  }, []);"""

content = content.replace(old_unmount_logic, visibility_logic)

with open(file_path, 'w') as f:
    f.write(content)
print("Added visibilitychange listener.")
