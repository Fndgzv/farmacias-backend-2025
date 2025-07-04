const Venta = require("../models/Venta");
const Producto = require("../models/Producto");
const Cliente = require("../models/Cliente");
const InventarioFarmacia = require("../models/InventarioFarmacia");
const generarFolioUnico = require('../utils/generarFolioUnico');

const crearVenta = async (req, res) => {
    try {
        const {
            folio,
            clienteId,
            productos,
            aplicaInapam,
            efectivo = 0,
            tarjeta = 0,
            transferencia = 0,
            importeVale = 0,
            farmacia,
        } = req.body;

        let folioFinal = folio;

        if (!folioFinal || await Venta.exists({ folio: folioFinal })) {
            folioFinal = await generarFolioUnico(Venta, {
                prefijo: 'FB',
                incluirDia: true
            });
        }

        const usuario = req.usuario;

        if (!['admin', 'empleado'].includes(usuario.rol)) {
            return res.status(403).json({ mensaje: 'Solo administradores o empleados pueden realizar ventas' });
        }

        // comprobar que el importeVale pueda pagarse con el monedero del cliente
        const cliente = clienteId ? await Cliente.findById(clienteId) : null;
        if (cliente && importeVale > cliente.totalMonedero) {
            return res.status(405).json({ mensaje: `** Fondos insuficientes en el monedero, solo cuentas con: ${cliente.totalMonedero} **` });
        }

        if (!cliente && importeVale > 0) {
            return res.status(406).json({ mensaje: `** Usted aún no cuenta con monedero electrónico **` });
        }

        const esCliente = cliente ? true : false;   // determninar si es un cliente

        let totalVenta = 0;
        let totalDescuento = 0;
        let cantidadDeProductos = 0;

        let totalPalmonedero = 0;
        const productosProcesados = [];

        const farmaciaId = farmacia;
        let i = 0;

        const ahora = soloFecha(new Date());  // fecha de hoy
        const diaSemana = ahora.getDay(); // Número del día de la semana

        for (const item of productos) {

            const productoDB = await Producto.findById(item.producto);
            if (!productoDB) continue;

            const inventario = await InventarioFarmacia.findOne({
                producto: productoDB._id,
                farmacia: farmaciaId
            });

            if (!inventario || inventario.existencia < item.cantidad) {
                return res.status(400).json({ mensaje: `** No hay suficiente stock en la farmacia para ${productoDB.nombre} **` });
            }

            const precioBase = inventario.precioVenta;  // Tomo el precio de la farmacia ---
            let palmonedero = 0;
            let descuentoRenglon = 0;
            let precioFinal = precioBase;
            let promoAplicada = "";
            let cadDesc = "";
            const clienteInapam = aplicaInapam === true;

            let fechaIni = soloFecha(new Date(ahora));
            let fechaFin = soloFecha(new Date(ahora));

            // determinar cantidad requerida
            if (
                productoDB.promoCantidadRequerida &&
                soloFecha(productoDB.inicioPromoCantidad) <= soloFecha(ahora) &&
                soloFecha(productoDB.finPromoCantidad) >= soloFecha(ahora)
            ) {

                descuentoRenglon = 0;
                precioFinal = precioBase;
                palmonedero = 0;
                promoAplicada = '';
                cadDesc = '';

                if (item.cantidad >= productoDB.promoCantidadRequerida - 1) {
                    promoAplicada = `${getEtiquetaPromo(productoDB.promoCantidadRequerida)}`;
                }

                if (item.precio === 0) {
                    descuentoRenglon = precioBase;
                    precioFinal = 0;
                    cadDesc = '100%';
                    promoAplicada = `${getEtiquetaPromo(productoDB.promoCantidadRequerida)}-Gratis`;
                }

                if (clienteInapam && productoDB.descuentoINAPAM && item.precio > 0) {
                    descuentoRenglon = (precioFinal * 5) / 100;
                    precioFinal = precioFinal - descuentoRenglon;
                    promoAplicada = `${promoAplicada}-INAPAM`;
                    cadDesc = '5%'
                }
            } else {
                //determinar los campos de descuento x dia y el porcentaje de descuento
                let descuentoXDia = 0;
                let aplica2xCiento = false;
                switch (diaSemana) {
                    case 0:
                        fechaIni = productoDB?.promoDomingo?.inicio ?? null;
                        fechaFin = productoDB?.promoDomingo?.fin ?? null;
                        descuentoXDia = productoDB?.promoDomingo?.porcentaje ?? null;
                        aplica2xCiento = productoDB?.promoDomingo?.monedero ?? null;
                        break;
                    case 1:
                        fechaIni = productoDB?.promoLunes?.inicio ?? null;
                        fechaFin = productoDB?.promoLunes?.fin ?? null;
                        descuentoXDia = productoDB?.promoLunes?.porcentaje ?? null;
                        aplica2xCiento = productoDB?.promoLunes?.monedero ?? null;
                        break;
                    case 2:
                        fechaIni = productoDB?.promoMartes?.inicio ?? null;
                        fechaFin = productoDB?.promoMartes?.fin ?? null;
                        descuentoXDia = productoDB?.promoMartes?.porcentaje ?? null;
                        aplica2xCiento = productoDB?.promoMartes?.monedero ?? null;
                        break;
                    case 3:
                        fechaIni = productoDB?.promoMiercoles?.inicio ?? null;
                        fechaFin = productoDB?.promoMiercoles?.fin ?? null;
                        descuentoXDia = productoDB?.promoMiercoles?.porcentaje ?? null;
                        aplica2xCiento = productoDB?.promoMiercoles?.monedero ?? null;
                        break;
                    case 4:
                        fechaIni = productoDB?.promoJueves?.inicio ?? null;
                        fechaFin = productoDB?.promoJueves?.fin ?? null;
                        descuentoXDia = productoDB?.promoJueves?.porcentaje ?? null;
                        aplica2xCiento = productoDB?.promoJueves?.monedero ?? null;
                        break;
                    case 5:
                        fechaIni = productoDB?.promoViernes?.inicio ?? null;
                        fechaFin = productoDB?.promoViernes?.fin ?? null;
                        descuentoXDia = productoDB?.promoViernes?.porcentaje ?? null;
                        aplica2xCiento = productoDB?.promoViernes?.monedero ?? null;
                        break;
                    case 6:
                        fechaIni = productoDB?.promoSabado?.inicio ?? null;
                        fechaFin = productoDB?.promoSabado?.fin ?? null;
                        descuentoXDia = productoDB?.promoSabado?.porcentaje ?? null;
                        aplica2xCiento = productoDB?.promoSabado?.monedero ?? null;
                        break;
                    default:
                        descuentoXDia = 0;
                }

                if (!descuentoXDia) {
                    fechaIni = soloFecha(new Date(ahora));
                    // sumamos 5 dias a la fecha inicial de la promo para que no aplique
                    fechaIni.setDate(fechaIni.getDate() + 5);
                }

                if (soloFecha(fechaIni) <= soloFecha(ahora) && soloFecha(fechaFin) >= soloFecha(ahora)) {
                    precioFinal = precioBase * (1 - descuentoXDia / 100);
                    descuentoRenglon = precioBase - precioFinal;
                    cadDesc = `${descuentoXDia}%`;
                    promoAplicada = getNombreDia(diaSemana);
                    palmonedero = 0;
                    if (esCliente && aplica2xCiento &&
                        !(productoDB.categoria === 'Recargas' || productoDB.categoria === 'Servicio Médico')
                    ) {
                        palmonedero = precioBase * 0.02;
                    }
                }

                if (productoDB.promoDeTemporada && productoDB.promoDeTemporada.inicio && productoDB.promoDeTemporada.fin) {
                    if (soloFecha(productoDB.promoDeTemporada.inicio) <= soloFecha(ahora) &&
                        soloFecha(productoDB.promoDeTemporada.fin) >= soloFecha(ahora)) {
                        let precioFinalB = precioBase * (1 - productoDB.promoDeTemporada.porcentaje / 100);
                        if (precioFinalB < precioFinal) {
                            precioFinal = precioFinalB;
                            descuentoRenglon = precioBase - precioFinal;
                            cadDesc = `${productoDB.promoDeTemporada.porcentaje}%`;
                            promoAplicada = 'Temporada';
                            palmonedero = 0;
                            if (esCliente && productoDB.promoDeTemporada.monedero === true &&
                                !(productoDB.categoria === 'Recargas' || productoDB.categoria === 'Servicio Médico')
                            ) {
                                palmonedero = precioBase * 0.02;
                            }
                        }
                    }
                }

                descuento = (precioBase - precioFinal) / precioBase * 100;    // calcular el % de descuento aplicado

                if (descuentoRenglon >= 0) {
                    if (clienteInapam && productoDB.descuentoINAPAM && descuento < 25) {
                        precioFinal = precioFinal * 0.95;
                        descuentoRenglon = precioBase - precioFinal;
                        promoAplicada += `-INAPAM`;
                        cadDesc += ` + 5%`;
                    }
                } else if (clienteInapam && productoDB.descuentoINAPAM && descuento < 25) {
                    precioFinal = precioBase * 0.95;
                    descuentoRenglon = precioBase - precioFinal;
                    promoAplicada = `INAPAM`;
                    cadDesc = `5%`;
                }
            }

            promoAplicada = limpiarPromocion(promoAplicada); // quitar guión inicial si existe.

            if (promoAplicada === '' && esCliente &&
                !(productoDB.categoria === 'Recargas' || productoDB.categoria === 'Servicio Médico')) {
                promoAplicada = 'Cliente';
                palmonedero = precioBase * 0.02;
            }

            if (promoAplicada === '') promoAplicada = 'Ninguno';

            const descuentoTotalRenglon = descuentoRenglon * item.cantidad;
            const total = precioFinal * item.cantidad;
            totalVenta += total;
            totalDescuento += descuentoTotalRenglon;
            cantidadDeProductos += item.cantidad;
            palmonedero = palmonedero * item.cantidad;
            totalPalmonedero += palmonedero;

            inventario.existencia -= item.cantidad;
            await inventario.save();    // actualizamos inventario

            productosProcesados.push({
                producto: productoDB._id,
                categoria: productoDB.categoria,
                cantidad: item.cantidad,
                precio: precioFinal,
                totalRen: total,
                descuento: descuentoTotalRenglon,
                monederoCliente: palmonedero,
                precioOriginal: precioBase,
                iva: item.iva || 0,
                tipoDescuento: promoAplicada,
                cadenaDescuento: cadDesc,
                lotes: []
            });
            i++;
        }  /* fin ciclo de recorrido producto por producto */

        const sumaPagos = parseFloat(efectivo) + parseFloat(tarjeta) + parseFloat(transferencia) + parseFloat(importeVale);

        if (Math.abs(sumaPagos - totalVenta) > 0.019) {
            return res.status(400).json({ mensaje: 'La suma de efectivo y otras formas de pago no coincide con el total de la venta.' });
        }

        const venta = new Venta({
            farmacia: farmaciaId,
            cliente: clienteId || null,
            usuario: usuario.id,
            productos: productosProcesados,
            cantidadProductos: cantidadDeProductos,
            total: totalVenta,
            totalDescuento,
            totalMonederoCliente: totalPalmonedero,
            formaPago: {
                efectivo,
                tarjeta,
                transferencia,
                vale: importeVale
            },
            fecha: new Date(),
            folio: folioFinal
        });
        await venta.save();

        if (cliente) {
            let motivo = null;
            if (totalPalmonedero > 0) motivo = 'Premio';
            if (totalPalmonedero > 0 && importeVale > 0) motivo = 'Premio-Pago venta';
            if (totalPalmonedero <= 0 && importeVale > 0) motivo = 'Pago venta';
            cliente.historialCompras.push({ venta: venta._id });
            const actual = Number.isFinite(cliente.totalMonedero)
                ? cliente.totalMonedero : 0;
            cliente.monedero.push({
                fechaUso: new Date(),
                montoIngreso: totalPalmonedero,
                montoEgreso: importeVale,
                motivo,
                farmaciaUso: farmaciaId
            });
            cliente.totalMonedero = actual + totalPalmonedero - importeVale;

            await cliente.save();
        }

        res.status(201).json({ mensaje: 'Venta realizada con éxito', venta });
    } catch (error) {
        console.error('Error al crear venta:', error);
        res.status(500).json({ mensaje: 'Error interno del servidor', error });
    }
};

function soloFecha(date) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function getEtiquetaPromo(valor) {
    if (valor === 2) return '2x1';
    if (valor === 3) return '3x2';
    if (valor === 4) return '4x3';
    return 'Promo';
}

function getNombreDia(num) {
    return ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'][num];
}

function limpiarPromocion(promo) {
    const str = (promo || '').toString();
    return str.startsWith('-') ? str.slice(1) : str;
}

module.exports = {
    crearVenta
};
