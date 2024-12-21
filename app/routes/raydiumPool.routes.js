const router = require('express').Router();
const RaydiumPool = require('../controllers/raydiumPool.controller');
const raydiumPool = new RaydiumPool();

router.post('/create', raydiumPool.createRaydiumPoolList);


module.exports = router;