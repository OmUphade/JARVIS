/**
 * Standard Success Response Wrapper
 * @param {Object} res Express response object
 * @param {any} data Response data
 * @param {number} statusCode HTTP Status Code (default 200)
 */
export const sendSuccess = (res, data = null, statusCode = 200) => {
  return res.status(statusCode).json({
    success: true,
    data,
  });
};

/**
 * Standard Error Response Wrapper
 * @param {Object} res Express response object
 * @param {string} message Error message
 * @param {string} errorCode Error code classification
 * @param {number} statusCode HTTP Status Code (default 500)
 */
export const sendError = (res, message = "An unexpected error occurred", errorCode = "INTERNAL_SERVER_ERROR", statusCode = 500) => {
  return res.status(statusCode).json({
    success: false,
    error: {
      code: errorCode,
      message,
    },
  });
};
