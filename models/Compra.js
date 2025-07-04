// models/Compra.js
const mongoose = require('mongoose');
const { Schema } = mongoose;

// Subesquema para cada producto en la compra
const CompraItemSchema = new Schema({
  producto: { type: Schema.Types.ObjectId, ref: 'Producto', required: true },
  cantidad: { type: Number, required: true },
  lote: { type: String, required: true },
  fechaCaducidad: { type: Date, required: true },
  costoUnitario: { type: Number, required: true },
  precioUnitario: { type: Number, required: true },
}, { _id: false });

const CompraSchema = new Schema({
  usuario: { type: Schema.Types.ObjectId, ref: "Usuario", required: true },
  proveedor: { type: Schema.Types.ObjectId, ref: "Proveedor", required: true },
  productos: { type: [CompraItemSchema], required: true, validate: items => items.length > 0 },
  total: { type: Number, required: true },
  fecha: { type: Date, default: Date.now }
}, { timestamps: true });

module.exports = mongoose.model("Compra", CompraSchema);
