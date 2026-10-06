// mongoose.isValidObjectId() also accepts any 12-character string, so check
// for the 24-hex-character form that the API actually hands out.
const isObjectId = (value) => typeof value === 'string' && /^[a-f\d]{24}$/i.test(value);

module.exports = { isObjectId };
