module.exports = {
  success: (res, data = null, message = 'Success', status = 200) => {
    return res.status(status).json({ success: true, message, data });
  },

  error: (res, message = 'Error', status = 500) => {
    return res.status(status).json({ success: false, message });
  },

  // Custom response without wrapping
  profsuccess: (res, payload, status = 200) => {
    return res.status(status).json(payload);
  }
};