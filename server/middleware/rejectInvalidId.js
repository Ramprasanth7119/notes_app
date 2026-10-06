const { isObjectId } = require('../utils/objectId');

// Used with router.param(): a malformed id cannot match any document, so it
// gets the same 404 as a missing one instead of a Mongoose CastError.
const rejectInvalidId = (resourceName) => (req, res, next, value) => {
  if (!isObjectId(value)) {
    return res.status(404).json({ message: `${resourceName} not found` });
  }
  next();
};

module.exports = rejectInvalidId;
