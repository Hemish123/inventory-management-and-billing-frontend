const axios = require('axios');
(async () => {
  try {
    const res = await axios.post('http://localhost:8000/api/billing/create-bill/', {
      branch_id: 1,
      payment_method: "CASH",
      amount_received: 100,
      customer_name: "",
      customer_phone: "",
      notes: "",
      items: [
        { product: 1, quantity: 1, unit_price: 100, tax_percentage: 18, tax_amount: 18, line_total: 118 }
      ]
    }, {
      // no auth needed if permission is removed, wait I need a token!
    });
  } catch (e) {
    console.log(e.response.data);
  }
})();
