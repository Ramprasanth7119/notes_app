const express = require('express');
const router = express.Router();
const requireAuth = require('../middleware/requireAuth');
const { validate, validateParam } = require('../middleware/validate');
const { objectId } = require('../validation/common');
const { createCollectionBody, updateCollectionBody, addNoteBody } = require('../validation/collections');
const {
  getCollections,
  createCollection,
  getCollection,
  updateCollection,
  deleteCollection,
  addNoteToCollection,
  removeNoteFromCollection
} = require('../controllers/collectionController');

router.use(requireAuth);
router.param('id', validateParam(objectId));
router.param('noteId', validateParam(objectId));

router.get('/', getCollections);
router.post('/', validate({ body: createCollectionBody }), createCollection);
router.get('/:id', getCollection);
router.put('/:id', validate({ body: updateCollectionBody }), updateCollection);
router.delete('/:id', deleteCollection);
router.post('/:id/notes', validate({ body: addNoteBody }), addNoteToCollection);
router.delete('/:id/notes/:noteId', removeNoteFromCollection);

module.exports = router;
