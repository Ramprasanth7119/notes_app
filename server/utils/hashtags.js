// "#react and #node_js" -> ['react', 'node_js']. A markdown heading such as
// "# Title" has a space after the # and is not treated as a tag.
const extractHashtags = (content) =>
  (content.match(/#(\w+)/g) || []).map((tag) => tag.slice(1));

module.exports = { extractHashtags };
