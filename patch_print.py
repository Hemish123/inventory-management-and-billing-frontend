import re

file_path = '/home/nikita/Desktop/Projects/inventory management billing system/msme-paytrack/frontend/src/pages/retail/POSPage.jsx'
with open(file_path, 'r') as f:
    content = f.read()

old_print = """      if (receiptType === 'PDF') {
        const printUrl = `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api'}/billing/${res.data.data.id}/pdf/`;
        const printWindow = window.open(printUrl, '_blank');
        if(printWindow) {
          printWindow.onload = () => printWindow.print();
        }
      }"""

new_print = """      if (receiptType === 'PDF') {
        try {
          const printUrl = `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api'}/billing/${res.data.data.id}/pdf/`;
          const printToast = toast.loading("Preparing receipt...");
          
          const response = await fetch(printUrl);
          const blob = await response.blob();
          const blobUrl = URL.createObjectURL(blob);
          
          const iframe = document.createElement('iframe');
          iframe.style.display = 'none';
          iframe.src = blobUrl;
          document.body.appendChild(iframe);
          
          iframe.onload = () => {
            setTimeout(() => {
              iframe.contentWindow.focus();
              iframe.contentWindow.print();
              toast.dismiss(printToast);
              
              // Clean up
              setTimeout(() => {
                document.body.removeChild(iframe);
                URL.revokeObjectURL(blobUrl);
              }, 60000); // 1 minute to allow print dialog to finish
            }, 500);
          };
        } catch (error) {
          console.error('Print failed', error);
          toast.error("Failed to prepare print");
        }
      }"""

content = content.replace(old_print, new_print)

with open(file_path, 'w') as f:
    f.write(content)
print("Patched POSPage.jsx to use hidden iframe for printing.")
