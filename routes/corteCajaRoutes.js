const express = require('express');
const router = express.Router();
const auth = require('../middlewares/authMiddleware');
const {
    crearCorte,
    finalizarCorte,
    obtenerCorteActivo
} = require('../controllers/corteCajaController')

router.post('/', auth, crearCorte);
router.put('/:corteId/finalizar/:grabar', auth, finalizarCorte);
router.get('/activo/:usuarioId/:farmaciaId', obtenerCorteActivo);

module.exports = router;
